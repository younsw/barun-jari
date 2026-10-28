import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { AdultVerificationSuccess, AppUser, AuthService } from "./types";

type UsersRow = { id: string; nickname: string; is_adult_verified: boolean; verified_at: string | null; created_at: string };

function toAppUser(user: User, row: UsersRow | null): AppUser {
  const meta = user.user_metadata ?? {};
  return {
    id: user.id,
    email: user.email ?? "",
    nickname: row?.nickname ?? meta.nickname ?? "",
    // 메타데이터는 사용자가 바꿀 수 있으므로 인증 여부는 users 행만 믿는다.
    isAdultVerified: row?.is_adult_verified === true,
    verifiedAt: row?.verified_at ?? null,
    createdAt: row?.created_at ?? user.created_at,
  };
}

function toKoreanError(message: string): Error {
  if (/invalid login credentials/i.test(message)) return new Error("이메일 또는 비밀번호가 맞지 않아요.");
  if (/already registered/i.test(message)) return new Error("이미 가입된 이메일이에요.");
  if (/email not confirmed/i.test(message)) return new Error("이메일 인증을 먼저 완료해 주세요.");
  return new Error(message);
}

export function createSupabaseAuthService(supabase: SupabaseClient): AuthService {
  async function loadUser(user: User): Promise<AppUser> {
    const { data } = await supabase.from("users").select("id, nickname, is_adult_verified, verified_at, created_at").eq("id", user.id).maybeSingle<UsersRow>();
    return toAppUser(user, data);
  }

  // users 행은 가입 시 DB 트리거가 만들고, 성인 인증 여부는 화면에서 직접 쓸 수 없다(RLS).
  // 서버 함수가 출생연도를 다시 판단해서 저장한다. (db/migrations/006_adult_verification.sql)
  async function saveVerification(verification: AdultVerificationSuccess) {
    if (verification.mockBirthYear === undefined) throw new Error("성인 인증 정보가 없어요. 다시 인증해 주세요.");
    const { error } = await supabase.rpc("complete_adult_verification", { p_birth_year: verification.mockBirthYear });
    if (error) throw toKoreanError(error.message);
  }

  return {
    async getCurrentUser() {
      const { data } = await supabase.auth.getUser();
      return data.user ? loadUser(data.user) : null;
    },

    async signUp({ email, password, nickname, verification }) {
      // 닉네임은 메타데이터로 넘기면 DB 트리거(handle_new_user)가 users 행에 넣는다.
      // 이메일 확인을 켜 두면 세션이 없어 인증을 저장할 수 없다 → 로그인 후 RequireAdult에서 다시 인증한다.
      const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { nickname } } });
      if (error) throw toKoreanError(error.message);
      if (!data.user || !data.session) return null;
      await saveVerification(verification);
      return loadUser(data.user);
    },

    async signIn({ email, password }) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw toKoreanError(error.message);
      return loadUser(data.user);
    },

    async signOut() {
      const { error } = await supabase.auth.signOut();
      if (error) throw toKoreanError(error.message);
    },

    async saveAdultVerification(verification) {
      const { data } = await supabase.auth.getUser();
      if (!data.user) throw new Error("로그인이 필요해요.");
      await saveVerification(verification);
      return loadUser(data.user);
    },

    onAuthChange(callback) {
      const { data } = supabase.auth.onAuthStateChange(() => callback());
      return () => data.subscription.unsubscribe();
    },
  };
}
