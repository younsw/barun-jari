import { supabase } from "./supabaseClient";
import { createSupabaseAuthService } from "./supabaseAuthService";
import { createMockAuthService } from "./mockAuthService";
import type { AuthService } from "./types";

/** .env에 Supabase 키가 있으면 Supabase Auth, 없으면 가짜 로그인 */
export const authService: AuthService = supabase ? createSupabaseAuthService(supabase) : createMockAuthService();
export const isMockAuth = supabase === null;
