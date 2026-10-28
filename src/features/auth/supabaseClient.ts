import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
// 새 publishable 키를 우선 쓰고, 예전 이름(ANON_KEY)도 받는다.
const publishableKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;

/** .env에 Supabase 키가 없으면 null → 신고·포인트·로그인 모두 가짜(mock) 데이터로 동작한다. */
export const supabase: SupabaseClient | null = url && publishableKey ? createClient(url, publishableKey) : null;
export const isMockData = supabase === null;
