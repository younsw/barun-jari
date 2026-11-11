/**
 * 포인트 데이터: 내 적립 내역과 요약(보유·오늘 적립·하루 한도).
 * 만든 날: 2026-10-28 · 마지막 수정: 2026-11-11
 */
import { supabase } from "../auth/supabaseClient";
import { mockPoints, type PointLedgerRecord } from "./mockPoints";

// 포인트 적립은 화면에서 하지 않는다. 현장 인증(+1)과 신고 반영(+2) (012)을 DB가 적립하고 하루 10P에서 멈춘다.
const DAILY_POINT_LIMIT = 10;

/** 포인트 요약 (만든 날: 2026-10-28) */
export type PointSummary = { balance: number; todayEarned: number; dailyLimit: number };

/** 한국 시간 기준 날짜(YYYY-MM-DD) (만든 날: 2026-10-28) */
const koreanDate = (value: Date | string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date(value));

/** 내 포인트 적립 내역 (만든 날: 2026-10-28) */
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

/** 보유 포인트·오늘 적립·하루 한도 (만든 날: 2026-10-28) */
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
