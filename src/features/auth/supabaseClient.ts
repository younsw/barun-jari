/**
 * Supabase 연결. .env에 URL·공개 키가 없으면 null(모의 모드).
 * 만든 날: 2026-10-28 · 마지막 수정: 2026-10-28
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Supabase 프로젝트 주소 (.env의 VITE_SUPABASE_URL) (만든 날: 2026-10-28) */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
// 새 publishable 키를 우선 쓰고, 예전 이름(ANON_KEY)도 받는다.
const publishableKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;

/** .env에 Supabase 키가 없으면 null → 신고·포인트·로그인 모두 가짜(mock) 데이터로 동작한다. */
export const supabase: SupabaseClient | null = url && publishableKey ? createClient(url, publishableKey) : null;
/** Supabase 없이 예시 데이터로 동작 중인지 (만든 날: 2026-10-28) */
export const isMockData = supabase === null;
