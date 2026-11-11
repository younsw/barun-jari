/**
 * 카카오맵 SDK 불러오기, 장소·주소 검색, 길찾기 링크, 현재 위치(GPS) 얻기.
 * 만든 날: 2026-10-28 · 마지막 수정: 2026-11-11
 */
// 카카오맵 JavaScript SDK 로더와 길찾기 링크
// 키: .env의 VITE_KAKAO_MAP_JS_KEY (카카오 개발자 콘솔 > 앱 키 > JavaScript 키)
// 콘솔의 JavaScript SDK 도메인에 접속 주소(예: http://localhost:8443)를 등록해야 지도가 뜹니다.

declare global {
  interface Window {
    kakao: any;
  }
}

/** 위도·경도 좌표 (만든 날: 2026-10-28) */
export type LatLng = { latitude: number; longitude: number };
type RouteMode = "walk" | "car" | "traffic" | "bicycle";

/** 카카오맵 JavaScript 키 (.env의 VITE_KAKAO_MAP_JS_KEY) (만든 날: 2026-10-28) */
const JS_KEY = import.meta.env.VITE_KAKAO_MAP_JS_KEY as string | undefined;
let sdkPromise: Promise<any> | null = null;

/** 카카오맵 키가 있는지 (없으면 목업 지도를 보여준다) (만든 날: 2026-10-28) */
export const hasKakaoMapKey = Boolean(JS_KEY);

/** 카카오맵 SDK 스크립트를 한 번만 불러와 kakao.maps를 돌려준다 (만든 날: 2026-10-28) */
export function loadKakaoMaps(): Promise<any> {
  if (!JS_KEY) return Promise.reject(new Error("VITE_KAKAO_MAP_JS_KEY가 없습니다"));
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(JS_KEY)}&autoload=false&libraries=services`;
    script.async = true;
    script.onload = () => window.kakao.maps.load(() => resolve(window.kakao));
    script.onerror = () => {
      sdkPromise = null;
      reject(new Error("카카오맵 SDK를 불러오지 못했습니다 (키 또는 등록 도메인 확인)"));
    };
    document.head.appendChild(script);
  });
  return sdkPromise;
}

/** 위치 검색 결과: 좌표 + 화면에 보일 이름 (만든 날: 2026-11-11) */
export type SearchedArea = LatLng & { label: string };

/** 검색어(지역명·장소명·주소)를 카카오 장소 검색 → 주소 검색 순서로 찾아 좌표를 돌려준다. 없으면 null */
export async function searchLocation(query: string): Promise<SearchedArea | null> {
  const keyword = query.trim();
  if (!keyword) return null;
  const kakao = await loadKakaoMaps();
  const { services } = kakao.maps;
  const fromPlaces = await new Promise<SearchedArea | null>((resolve) => {
    new services.Places().keywordSearch(keyword, (result: any[], status: string) => {
      const first = status === services.Status.OK ? result[0] : null;
      resolve(first ? { latitude: Number(first.y), longitude: Number(first.x), label: first.place_name } : null);
    }, { size: 1 });
  });
  if (fromPlaces) return fromPlaces;
  return new Promise((resolve) => {
    new services.Geocoder().addressSearch(keyword, (result: any[], status: string) => {
      const first = status === services.Status.OK ? result[0] : null;
      resolve(first ? { latitude: Number(first.y), longitude: Number(first.x), label: first.address_name } : null);
    });
  });
}

// 링크 형식: https://map.kakao.com/link/by/{이동수단}/출발이름,위도,경도/도착이름,위도,경도
// 이름에 쉼표·슬래시가 있으면 링크가 깨지므로 공백으로 바꿉니다.
function linkPoint(name: string, point: LatLng): string {
  const safeName = encodeURIComponent(name.replace(/[,/]/g, " ").trim());
  return `${safeName},${point.latitude},${point.longitude}`;
}

/** 카카오맵 길찾기 링크 (출발지를 모르면 도착지만) (만든 날: 2026-10-28) */
export function buildDirectionsUrl(
  destinationName: string,
  destination: LatLng,
  origin?: LatLng | null,
  mode: RouteMode = "walk",
): string {
  if (!origin) return `https://map.kakao.com/link/to/${linkPoint(destinationName, destination)}`;
  return `https://map.kakao.com/link/by/${mode}/${linkPoint("내 위치", origin)}/${linkPoint(destinationName, destination)}`;
}

// 좌표가 아직 없는 장소는 주소로 카카오맵 검색을 연다.
export function buildSearchUrl(address: string): string {
  return `https://map.kakao.com/?q=${encodeURIComponent(address)}`;
}

/** 현재 위치를 빠르게 얻는다. 실패하면 null (목록 거리 계산용) (만든 날: 2026-10-28) */
export function getCurrentPosition(timeoutMs = 5000): Promise<LatLng | null> {
  if (!("geolocation" in navigator)) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60_000 },
    );
  });
}

/** 정확도(m)가 포함된 GPS 위치 (현장 인증·신고용) (만든 날: 2026-11-04) */
export type GpsFix = LatLng & { accuracy: number };

/** 신고 현장 인증용: 정확도(m)까지 받고, 실패 사유를 한국어로 돌려준다. 캐시된 위치는 쓰지 않는다. */
export function getGpsFix(timeoutMs = 15000): Promise<GpsFix> {
  if (!("geolocation" in navigator)) return Promise.reject(new Error("이 기기에서는 위치를 확인할 수 없어요."));
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy }),
      (error) => reject(new Error(
        error.code === error.PERMISSION_DENIED ? "위치 권한을 허용해야 신고할 수 있어요. 브라우저 설정에서 위치를 허용해 주세요."
          : error.code === error.TIMEOUT ? "위치 확인 시간이 지났어요. 실외에서 다시 시도해 주세요."
          : "현재 위치를 확인하지 못했어요. 다시 시도해 주세요.",
      )),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 },
    );
  });
}
