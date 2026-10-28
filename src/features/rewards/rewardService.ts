import { supabase } from "../auth/supabaseClient";
import { mockPoints, type PointLedgerRecord } from "./mockPoints";

// 포인트 적립은 화면에서 하지 않는다. 신고가 반영되면 DB가 +3을 적립하고 하루 10P에서 멈춘다.
export const DAILY_POINT_LIMIT = 10;

export type PointSummary = { balance: number; todayEarned: number; dailyLimit: number };

const koreanDate = (value: Date | string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date(value));

export async function getPointHistory(): Promise<PointLedgerRecord[]> {
  if (!supabase) return [...mockPoints].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const { data, error } = await supabase
    .from("point_ledger")
    .select("id, user_id, amount, reason, ref_id, created_at")
    .order("created_at", { ascending: false })
    .returns<(Omit<PointLedgerRecord, "id"> & { id: number })[]>();
  if (error) throw new Error("적립 내역을 불러오지 못했어요.");
  return data.map((row) => ({ ...row, id: String(row.id) }));
}

export async function getMyPoints(): Promise<PointSummary> {
  if (!supabase) {
    const today = koreanDate(new Date());
    const todayEarned = mockPoints.filter((p) => koreanDate(p.created_at) === today).reduce((sum, p) => sum + p.amount, 0);
    return { balance: mockPoints.reduce((sum, p) => sum + p.amount, 0), todayEarned, dailyLimit: DAILY_POINT_LIMIT };
  }
  const { data, error } = await supabase.rpc("get_my_point_summary").single<{ total: number; today: number; daily_limit: number }>();
  if (error) throw new Error("포인트를 불러오지 못했어요.");
  return { balance: data.total, todayEarned: data.today, dailyLimit: data.daily_limit };
}
