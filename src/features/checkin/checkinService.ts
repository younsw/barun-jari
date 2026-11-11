/**
 * 현장 인증 처리: 가장 가까운 시설 찾기, 사진 업로드, 서버 함수로 인증·포인트 적립.
 * 만든 날: 2026-11-04 · 마지막 수정: 2026-11-11
 */
import { supabase } from "../auth/supabaseClient";
import type { GpsFix, LatLng } from "../places/kakaoSdk";
import { distanceMeters } from "../places/placeService";
import { mockPoints } from "../rewards/mockPoints";

// 현장 인증: 흡연시설 현장에서 위치 + 앱 카메라 사진으로 "이 장소가 실제로 있다"를 확인하고 포인트를 받는다.
// 규칙은 서버 함수 complete_onsite_checkin(009, 반경은 011)이 다시 확인한다:
// 로그인 회원, GPS 정확도 30m 이내, 시설에서 30m 이내, 같은 장소 하루 1번, 1회 1P (012, 하루 최대 10P).

/** 인증 가능 거리(m): 시설에서 30m 안 (만든 날: 2026-11-04) */
export const CHECKIN_RADIUS_M = 30;
/** 허용하는 GPS 오차(m) (만든 날: 2026-11-04) */
export const CHECKIN_MAX_ACCURACY_M = 30;
/** 인증 1회 포인트 (만든 날: 2026-11-04) */
export const CHECKIN_POINTS = 1;

/** 인증 사진을 저장하는 Storage 버킷 (만든 날: 2026-11-04) */
const PHOTO_BUCKET = "report-photos";

/** 인증 결과: 거리, 받은 포인트, 오늘 받은 포인트 (만든 날: 2026-11-04) */
export type CheckinResult = { distance: number; pointsAwarded: number; todayPoints: number };

/** 좌표가 있을 수 있는 장소 (만든 날: 2026-11-04) */
type Locatable = { id: number; latitude: number | null; longitude: number | null };

/** 현재 위치에서 가장 가까운 장소(좌표 있는 곳만)와 거리. 인증 버튼이 장소를 자동으로 고를 때 쓴다 */
export function findNearest<T extends Locatable>(places: T[], here: LatLng): { place: T; distance: number } | null {
  let best: { place: T; distance: number } | null = null;
  for (const place of places) {
    if (place.latitude === null || place.longitude === null) continue;
    const distance = distanceMeters(here, { latitude: place.latitude, longitude: place.longitude });
    if (!best || distance < best.distance) best = { place, distance };
  }
  return best;
}

/** 모의 모드: 오늘 인증한 장소 기록 (만든 날: 2026-11-04) */
const mockCheckins = new Set<string>();
/** 한국 시간 기준 오늘 날짜 (만든 날: 2026-11-04) */
const seoulToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());

/** 현장 인증 완료: 사진 업로드 후 서버에서 거리·하루 1번 규칙을 확인하고 포인트 적립 (만든 날: 2026-11-04) */
export async function completeOnsiteCheckin(input: {
  facility: Locatable;
  photo: Blob;
  location: GpsFix;
}): Promise<CheckinResult> {
  const { facility, photo, location } = input;

  if (!supabase) {
    if (facility.latitude === null || facility.longitude === null) throw new Error("아직 위치 정보가 없는 장소라 현장 인증을 할 수 없어요.");
    if (location.accuracy > CHECKIN_MAX_ACCURACY_M) throw new Error(`GPS 정확도가 낮아요 (${Math.round(location.accuracy)}m, ${CHECKIN_MAX_ACCURACY_M}m 이내여야 해요). 하늘이 트인 곳에서 다시 시도해 주세요.`);
    const distance = distanceMeters(location, { latitude: facility.latitude, longitude: facility.longitude });
    if (distance > CHECKIN_RADIUS_M) throw new Error(`장소에서 ${Math.round(distance)}m 떨어져 있어요. 현장(${CHECKIN_RADIUS_M}m 이내)에서 인증해 주세요.`);
    const key = `${facility.id}:${seoulToday()}`;
    if (mockCheckins.has(key)) throw new Error("오늘 이미 인증한 장소예요. 내일 다시 인증할 수 있어요.");
    mockCheckins.add(key);
    const todayBefore = mockPoints
      .filter((p) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date(p.created_at)) === seoulToday())
      .reduce((sum, p) => sum + p.amount, 0);
    const pointsAwarded = Math.max(0, Math.min(CHECKIN_POINTS, 10 - todayBefore));
    if (pointsAwarded > 0) {
      mockPoints.unshift({ id: `mock-c${Date.now()}`, user_id: "mock", amount: pointsAwarded, reason: "onsite_checkin", ref_id: `checkin:${key}`, created_at: new Date().toISOString() });
    }
    return { distance, pointsAwarded, todayPoints: todayBefore + pointsAwarded };
  }

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("로그인이 필요해요.");
  const photoPath = `${auth.user.id}/checkin-${crypto.randomUUID()}.jpg`;
  const upload = await supabase.storage.from(PHOTO_BUCKET).upload(photoPath, photo, { contentType: "image/jpeg", upsert: false });
  if (upload.error) throw new Error("사진을 올리지 못했어요. 다시 촬영해 주세요.");

  const { data, error } = await supabase
    .rpc("complete_onsite_checkin", {
      p_facility_id: facility.id,
      p_photo_path: photoPath,
      p_latitude: location.latitude,
      p_longitude: location.longitude,
      p_accuracy_m: Math.round(location.accuracy),
    })
    .single<{ checkin_id: number; distance_m: number; points_awarded: number; today_points: number }>();
  if (error) {
    await supabase.storage.from(PHOTO_BUCKET).remove([photoPath]);
    const onsite = error.message.match(/onsite: (.+)/);
    throw new Error(onsite ? onsite[1] : "현장 인증을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
  }
  return { distance: data.distance_m, pointsAwarded: data.points_awarded, todayPoints: data.today_points };
}
