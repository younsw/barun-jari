import { useEffect, useState } from "react";
import { isMockData } from "../auth/supabaseClient";
import { AppIcon, ScreenAnnotation, ScreenHeader } from "../profile/AppShell";
import { getGpsFix, type GpsFix } from "../places/kakaoSdk";
import { distanceMeters } from "../places/placeService";
import { CameraCapture, type CapturedPhoto } from "../reports/CameraCapture";
import "../reports/reports.css";
import "./checkin.css";
import {
  CHECKIN_MAX_ACCURACY_M,
  CHECKIN_POINTS,
  CHECKIN_RADIUS_M,
  completeOnsiteCheckin,
  type CheckinResult,
} from "./checkinService";

type CheckinPlace = { id: number; name: string; address: string; latitude: number | null; longitude: number | null };

// UI-11 현장 인증: 장소 상세의 "현장 인증하기"에서 들어온다. 위치 확인 + 앱 카메라 촬영 → 서버 확인 → 포인트
export default function CheckinScreen({ place, onBack, onRewards, onDone }: {
  place: CheckinPlace;
  onBack: () => void;
  onRewards: () => void;
  onDone: () => void;
}) {
  const [location, setLocation] = useState<GpsFix | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [photo, setPhoto] = useState<CapturedPhoto | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<CheckinResult | null>(null);

  const hasCoords = place.latitude !== null && place.longitude !== null;
  const distance = location && hasCoords
    ? distanceMeters(location, { latitude: place.latitude!, longitude: place.longitude! })
    : null;
  const tooFar = distance !== null && distance > CHECKIN_RADIUS_M;
  const lowAccuracy = location !== null && location.accuracy > CHECKIN_MAX_ACCURACY_M;
  const canSubmit = hasCoords && location && photo && !tooFar && !lowAccuracy && !pending;

  const locate = async () => {
    setLocating(true);
    setLocationError("");
    try {
      setLocation(await getGpsFix());
    } catch (caught) {
      setLocation(null);
      setLocationError(caught instanceof Error ? caught.message : "현재 위치를 확인하지 못했어요.");
    } finally {
      setLocating(false);
    }
  };
  useEffect(() => { void locate(); }, []);
  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo.url); }, [photo]);

  const submit = async () => {
    if (!location || !photo) return;
    setPending(true);
    setError("");
    try {
      // 촬영 직후 위치를 한 번 더 받아 사진과 같은 시점의 위치로 보낸다
      const fresh = await getGpsFix().catch(() => location);
      setResult(await completeOnsiteCheckin({ facility: place, photo: photo.blob, location: fresh }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "현장 인증을 저장하지 못했어요.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="feature-pair">
      <section className="phone-frame" aria-label="UI-11 현장 인증 모바일 화면">
        <div className="feature-screen">
          <ScreenHeader title="현장 인증" onBack={onBack} />
          <div className="feature-body">
            {result ? (
              <div className="checkin-done">
                <span className="checkin-done-icon"><AppIcon name="check" size={30} /></span>
                <strong>현장 인증 완료</strong>
                <p>{place.name}</p>
                <div className="checkin-points">
                  {result.pointsAwarded > 0 ? `+${result.pointsAwarded}P 적립` : "오늘 받을 수 있는 포인트를 모두 받았어요"}
                  <small>오늘 {result.todayPoints}P / 10P · 장소에서 {Math.round(result.distance)}m</small>
                </div>
                <button className="primary-action" onClick={onRewards}>리워드 보기</button>
                <button className="secondary-action" onClick={onDone}>지도로 돌아가기</button>
              </div>
            ) : (
              <>
                <div className="demo-notice">
                  {isMockData && "Supabase 키가 없어 인증은 브라우저 메모리에만 저장됩니다. "}
                  장소에서 {CHECKIN_RADIUS_M}m 안에서 현재 위치와 현장 사진을 확인하면 {CHECKIN_POINTS}P를 드려요.
                  같은 장소는 하루 한 번, 하루 최대 10P까지예요.
                </div>
                <div className="selected-facility">
                  <strong>{place.name}</strong>
                  <span>{place.address}</span>
                </div>

                <span className="form-label">1. 현재 위치 확인</span>
                <div className={`onsite-location ${location && !tooFar && !lowAccuracy ? "ok" : ""}`}>
                  <AppIcon name="map" size={20} />
                  <div>
                    <strong>
                      {!hasCoords ? "위치 정보가 없는 장소"
                        : locating ? "현재 위치 확인 중…"
                        : !location ? "현재 위치 확인 필요"
                        : tooFar ? `장소에서 ${Math.round(distance!)}m 떨어져 있어요`
                        : lowAccuracy ? "GPS 정확도가 낮아요"
                        : `현장 확인됨 · 장소에서 ${Math.round(distance!)}m`}
                    </strong>
                    <span>
                      {!hasCoords ? "좌표가 준비되지 않아 이 장소는 아직 인증할 수 없어요."
                        : location ? `정확도 약 ${Math.round(location.accuracy)}m · ${CHECKIN_RADIUS_M}m 안, 정확도 ${CHECKIN_MAX_ACCURACY_M}m 이내여야 해요`
                        : locationError || `장소에서 ${CHECKIN_RADIUS_M}m 안에 있어야 인증할 수 있어요.`}
                    </span>
                  </div>
                  <button onClick={() => void locate()} disabled={locating || !hasCoords}>
                    {location ? "다시 확인" : "위치 확인"}
                  </button>
                </div>

                <span className="form-label">2. 현장 사진 촬영</span>
                {/* 갤러리 업로드 금지: 파일 선택 없이 앱 내 카메라만 연다 */}
                <button className="photo-upload photo-camera-button" onClick={() => setCameraOpen(true)} disabled={!hasCoords}>
                  {photo ? (
                    <img src={photo.url} alt="촬영한 현장 사진" />
                  ) : (
                    <>
                      <AppIcon name="upload" size={22} />
                      <strong>흡연구역 표지판이나 시설을 찍어 주세요</strong>
                      <span>앱 카메라로만 찍을 수 있어요 · 갤러리 사진 불가</span>
                    </>
                  )}
                </button>
                {photo && (
                  <div className="photo-actions">
                    <button onClick={() => setCameraOpen(true)}>다시 찍기</button>
                  </div>
                )}

                {error && <p className="inline-error">{error}</p>}
                <button className="primary-action report-submit" onClick={submit} disabled={!canSubmit}>
                  {pending ? "인증 중…" : `현장 인증하고 ${CHECKIN_POINTS}P 받기`}
                </button>
              </>
            )}
          </div>
          {cameraOpen && (
            <CameraCapture
              onClose={() => setCameraOpen(false)}
              onCapture={(captured) => {
                setPhoto(captured);
                setCameraOpen(false);
              }}
            />
          )}
        </div>
      </section>
      <ScreenAnnotation
        screen="UI-11 현장 인증"
        path="하단 인증하기 → 가까운 장소 상세 → 현장 인증하기"
        elements="장소 정보, 현재 위치·거리 확인, 앱 카메라 촬영(갤러리 불가), 인증 버튼, 완료 화면"
        data="facility_checkins (위치·정확도·거리·사진 경로), point_ledger onsite_checkin / Storage report-photos"
        action="위치 확인, 촬영·다시 찍기, 인증 → +2P (같은 장소 하루 1번, 하루 최대 10P)"
        link="complete_onsite_checkin(), UI-09 리워드"
      />
    </div>
  );
}
