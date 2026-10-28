export type ReportType = "closed" | "wrong_location" | "wrong_info" | "etc";
export type ReportStatus = "received" | "reviewing" | "accepted" | "rejected";

/** reports 테이블 한 행 + 화면 표시용 시설 이름·주소 */
export type ReportRecord = {
  id: string;
  user_id: string;
  facility_id: number;
  type: ReportType;
  content: string;
  status: ReportStatus;
  created_at: string;
  facility_name?: string;
  facility_address?: string;
};

/** Supabase 키가 없을 때만 쓰는 예시 신고 (예시 장소 id 1~5 기준) */
export const mockReports: ReportRecord[] = [
  {
    id: "mock-3",
    user_id: "mock",
    facility_id: 2,
    type: "wrong_location",
    content: "표시된 위치보다 출구 쪽에 더 가까이 있습니다.",
    status: "reviewing",
    created_at: "2026-10-24T14:20:00+09:00",
  },
  {
    id: "mock-2",
    user_id: "mock",
    facility_id: 4,
    type: "wrong_info",
    content: "운영 시간 안내와 현장 이용 시간이 다른 것 같습니다.",
    status: "accepted",
    created_at: "2026-10-20T10:15:00+09:00",
  },
  {
    id: "mock-1",
    user_id: "mock",
    facility_id: 3,
    type: "etc",
    content: "현장 안내 표지판이 잘 보이지 않습니다.",
    status: "received",
    created_at: "2026-10-17T18:05:00+09:00",
  },
];
