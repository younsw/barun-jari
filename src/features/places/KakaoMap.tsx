import { useEffect, useRef, useState } from "react";
import { hasKakaoMapKey, loadKakaoMaps, type LatLng } from "./kakaoMap";

// 장소 한 곳을 마커로 보여주는 카카오 지도.
// 키가 없거나 SDK를 못 불러오면 아무것도 그리지 않고 onUnavailable을 호출합니다(기존 목업이 보이게).
export default function KakaoMap({ center, level = 3, onUnavailable }: {
  center: LatLng;
  level?: number;
  onUnavailable?: (reason: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!hasKakaoMapKey) {
      onUnavailable?.("no-key");
      return;
    }
    let cancelled = false;
    loadKakaoMaps()
      .then((kakao) => {
        if (cancelled || !containerRef.current) return;
        const position = new kakao.maps.LatLng(center.latitude, center.longitude);
        if (!mapRef.current) {
          mapRef.current = new kakao.maps.Map(containerRef.current, { center: position, level });
          markerRef.current = new kakao.maps.Marker({ position, map: mapRef.current });
        } else {
          mapRef.current.setCenter(position);
          markerRef.current.setPosition(position);
        }
        setReady(true);
      })
      .catch((error: Error) => !cancelled && onUnavailable?.(error.message));
    return () => {
      cancelled = true;
    };
  }, [center.latitude, center.longitude, level]);

  return <div ref={containerRef} className={`kakao-map-canvas ${ready ? "ready" : ""}`} aria-label="카카오 지도" />;
}
