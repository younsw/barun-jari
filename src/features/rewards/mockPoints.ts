/** point_ledger 테이블 한 행 */
export type PointLedgerRecord = {
  id: string;
  user_id: string;
  amount: number;
  reason: string;
  ref_id: string | null;
  created_at: string;
};

/** DB의 reason 코드를 화면 문구로 바꾼다 (db/migrations/004_point_ledger.sql) */
export const reasonLabels: Record<string, string> = {
  report_accepted: "오류 신고 반영",
  attendance: "출석",
};

/** Supabase 키가 없을 때만 쓰는 예시 적립 내역 */
export const mockPoints: PointLedgerRecord[] = [
  { id: "mock-p3", user_id: "mock", amount: 3, reason: "report_accepted", ref_id: "report:mock-2", created_at: "2026-10-28T09:10:00+09:00" },
  { id: "mock-p2", user_id: "mock", amount: 3, reason: "report_accepted", ref_id: "report:mock-5", created_at: "2026-10-28T08:40:00+09:00" },
  { id: "mock-p1", user_id: "mock", amount: 3, reason: "report_accepted", ref_id: "report:mock-4", created_at: "2026-10-21T17:40:00+09:00" },
];
