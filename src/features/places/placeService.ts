import { supabase } from "../auth/supabaseClient";
import type { LatLng } from "./kakaoSdk";

/** smoking_facilities 한 행. 좌표는 지오코딩(db/geocode.py) 전이면 null */
export type Place = {
  id: number;
  name: string;
  address: string;
  category: string;
  latitude: number | null;
  longitude: number | null;
};

/** Supabase 키가 없을 때만 쓰는 예시 장소 */
const mockPlaces: Place[] = [
  { id: 1, name: "예시 데이터 · 중앙광장 흡연구역", address: "예시 데이터 · 중앙광장 인근", category: "공공청사", latitude: 37.6066, longitude: 127.0927 },
  { id: 2, name: "예시 데이터 · 1번 출구 흡연부스", address: "예시 데이터 · 1번 출구 앞", category: "복합건축물", latitude: 37.5966, longitude: 127.0851 },
  { id: 3, name: "예시 데이터 · 공원 입구 흡연구역", address: "예시 데이터 · 시민공원 동문", category: "체육시설업", latitude: 37.6013, longitude: 127.0779 },
  { id: 4, name: "예시 데이터 · 복합센터 흡연부스", address: "예시 데이터 · 복합센터 후문", category: "게임업소", latitude: 37.5891, longitude: 127.0899 },
  { id: 5, name: "예시 데이터 · 업무지구 흡연구역", address: "예시 데이터 · 업무지구 보행로", category: "의료기관", latitude: 37.6131, longitude: 127.0983 },
];

export async function getFacilities(): Promise<Place[]> {
  if (!supabase) return mockPlaces;
  const { data, error } = await supabase
    .from("smoking_facilities")
    .select("id, name, address, category, latitude, longitude")
    .order("id")
    .returns<Place[]>();
  if (error) throw new Error("흡연시설 정보를 불러오지 못했어요.");
  return data;
}

export function placeCoords(place: Place): LatLng | null {
  return place.latitude === null || place.longitude === null ? null : { latitude: place.latitude, longitude: place.longitude };
}

/** 두 좌표 사이 직선거리(m) */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

export function formatDistance(meters: number | null): string {
  if (meters === null) return "거리 정보 없음";
  return meters < 1000 ? `${Math.round(meters / 10) * 10}m` : `${(meters / 1000).toFixed(1)}km`;
}
