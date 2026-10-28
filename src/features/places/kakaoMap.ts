// 카카오맵 JavaScript SDK 로더와 길찾기 링크
// 키: .env의 VITE_KAKAO_MAP_JS_KEY (카카오 개발자 콘솔 > 앱 키 > JavaScript 키)
// 콘솔의 JavaScript SDK 도메인에 접속 주소(예: http://localhost:8443)를 등록해야 지도가 뜹니다.

declare global {
  interface Window {
    kakao: any;
  }
}

export type LatLng = { latitude: number; longitude: number };
export type RouteMode = "walk" | "car" | "traffic" | "bicycle";

const JS_KEY = import.meta.env.VITE_KAKAO_MAP_JS_KEY as string | undefined;
let sdkPromise: Promise<any> | null = null;

export const hasKakaoMapKey = Boolean(JS_KEY);

export function loadKakaoMaps(): Promise<any> {
  if (!JS_KEY) return Promise.reject(new Error("VITE_KAKAO_MAP_JS_KEY가 없습니다"));
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(JS_KEY)}&autoload=false`;
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

// 링크 형식: https://map.kakao.com/link/by/{이동수단}/출발이름,위도,경도/도착이름,위도,경도
// 이름에 쉼표·슬래시가 있으면 링크가 깨지므로 공백으로 바꿉니다.
function linkPoint(name: string, point: LatLng): string {
  const safeName = encodeURIComponent(name.replace(/[,/]/g, " ").trim());
  return `${safeName},${point.latitude},${point.longitude}`;
}

export function buildDirectionsUrl(
  destinationName: string,
  destination: LatLng,
  origin?: LatLng | null,
  mode: RouteMode = "walk",
): string {
  if (!origin) return `https://map.kakao.com/link/to/${linkPoint(destinationName, destination)}`;
  return `https://map.kakao.com/link/by/${mode}/${linkPoint("내 위치", origin)}/${linkPoint(destinationName, destination)}`;
}

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
