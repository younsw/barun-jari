/**
 * 로그인 기능 선택: Supabase 키가 있으면 실제 서버, 없으면 브라우저 저장소 가짜 로그인(모의 모드).
 * 만든 날: 2026-10-28 · 마지막 수정: 2026-10-28
 */
import { supabase } from "./supabaseClient";
import { createSupabaseAuthService } from "./supabaseAuthService";
import { createMockAuthService } from "./mockAuthService";
import type { AuthService } from "./types";

/** .env에 Supabase 키가 있으면 Supabase Auth, 없으면 가짜 로그인 */
export const authService: AuthService = supabase ? createSupabaseAuthService(supabase) : createMockAuthService();
/** 가짜 로그인(모의 모드)인지 (만든 날: 2026-10-28) */
export const isMockAuth = supabase === null;
