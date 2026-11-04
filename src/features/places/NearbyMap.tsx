import { useEffect, useRef, useState } from "react";
import { hasKakaoMapKey, loadKakaoMaps, type LatLng } from "./kakaoSdk";

// 첫 화면(UI-01)용 지도: 내 현재 위치를 가운데에 두고 주변 흡연시설을 마커로 보여준다.
// 위치를 모르면 중랑구청을 가운데로 둔다. 키가 없거나 SDK를 못 불러오면 onUnavailable을 호출한다(목업이 보이게).

const FALLBACK_CENTER: LatLng = { latitude: 37.6066, longitude: 127.0927 }; // 중랑구청
const MAX_MARKERS = 30;

export type NearbyPlace = { id: number; name: string; coords: LatLng };

export default function NearbyMap({ userLocation, places, onSelect, onUnavailable }: {
  userLocation: LatLng | null;
  /** 가까운 순으로 정렬된 장소. 앞에서부터 MAX_MARKERS곳만 마커로 그린다 */
  places: NearbyPlace[];
  onSelect?: (id: number) => void;
  onUnavailable?: (reason: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const userOverlayRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [kakao, setKakao] = useState<any>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!hasKakaoMapKey) {
      onUnavailable?.("no-key");
      return;
    }
    let cancelled = false;
    loadKakaoMaps()
      .then((sdk) => {
        if (cancelled || !containerRef.current) return;
        const center = userLocation ?? FALLBACK_CENTER;
        mapRef.current = new sdk.maps.Map(containerRef.current, {
          center: new sdk.maps.LatLng(center.latitude, center.longitude),
          level: 4,
        });
        setKakao(sdk);
      })
      .catch((error: Error) => !cancelled && onUnavailable?.(error.message));
    return () => {
      cancelled = true;
    };
  }, []);

  // 전체 화면 전환처럼 지도 칸 크기가 바뀌면 다시 그리고, 보던 가운데를 유지한다
  useEffect(() => {
    if (!kakao || !mapRef.current || !containerRef.current) return;
    const observer = new ResizeObserver(() => {
      const center = mapRef.current.getCenter();
      mapRef.current.relayout();
      mapRef.current.setCenter(center);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [kakao]);

  // 내 위치: 파란 점, 위치가 바뀌면 지도도 따라간다
  useEffect(() => {
    if (!kakao || !mapRef.current) return;
    userOverlayRef.current?.setMap(null);
    userOverlayRef.current = null;
    if (!userLocation) return;
    const position = new kakao.maps.LatLng(userLocation.latitude, userLocation.longitude);
    const dot = document.createElement("span");
    dot.className = "kakao-user-dot";
    dot.title = "현재 위치";
    userOverlayRef.current = new kakao.maps.CustomOverlay({ position, content: dot, map: mapRef.current, zIndex: 3 });
    mapRef.current.setCenter(position);
  }, [kakao, userLocation?.latitude, userLocation?.longitude]);

  // 주변 흡연시설 마커, 누르면 상세 화면으로
  const placeKey = places.slice(0, MAX_MARKERS).map((place) => place.id).join(",");
  useEffect(() => {
    if (!kakao || !mapRef.current) return;
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = places.slice(0, MAX_MARKERS).map((place) => {
      const marker = new kakao.maps.Marker({
        position: new kakao.maps.LatLng(place.coords.latitude, place.coords.longitude),
        map: mapRef.current,
        title: place.name,
        clickable: true,
      });
      kakao.maps.event.addListener(marker, "click", () => onSelectRef.current?.(place.id));
      return marker;
    });
  }, [kakao, placeKey]);

  return <div ref={containerRef} className={`kakao-map-canvas ${kakao ? "ready" : ""}`} aria-label="내 주변 흡연시설 카카오 지도" />;
}
