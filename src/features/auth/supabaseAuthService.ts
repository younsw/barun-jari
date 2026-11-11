import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { AppUser, AuthService, Member } from "./types";

type UsersRow = { id: string; nickname: string; is_admin: boolean; created_at: string };
type MemberRow = { user_id: string; email: string; nickname: string; is_admin: boolean; joined_at: string; points: number };

function toAppUser(user: User, row: UsersRow | null): AppUser {
  const meta = user.user_metadata ?? {};
  return {
    id: user.id,
    email: user.email ?? "",
    nickname: row?.nickname ?? meta.nickname ?? "",
    // 메타데이터는 사용자가 바꿀 수 있으므로 관리자 여부는 users 행만 믿는다.
    isAdmin: row?.is_admin === true,
    createdAt: row?.created_at ?? user.created_at,
  };
}

function toKoreanError(message: string): Error {
  if (/invalid login credentials/i.test(message)) return new Error("이메일 또는 비밀번호가 맞지 않아요.");
  if (/already registered/i.test(message)) return new Error("이미 가입된 이메일이에요.");
  if (/email not confirmed/i.test(message)) return new Error("이메일 인증을 먼저 완료해 주세요.");
  // Supabase 대시보드에서 Email 로그인 방식(Enable Email provider)이 꺼져 있을 때
  if (/(signups|logins) are disabled|email_provider_disabled/i.test(message)) return new Error("지금은 이메일 로그인·가입이 꺼져 있어요. 관리자에게 알려 주세요.");
  if (/rate limit/i.test(message)) return new Error("인증 메일을 너무 많이 보냈어요. 잠시 후(최대 1시간) 다시 시도해 주세요.");
  if (/should be different/i.test(message)) return new Error("이전과 다른 비밀번호를 입력해 주세요.");
  if (/password should be at least/i.test(message)) return new Error("비밀번호는 8자 이상이어야 해요.");
  const admin = message.match(/admin: (.+)/);
  if (admin) return new Error(admin[1]);
  return new Error(message);
}

export function createSupabaseAuthService(supabase: SupabaseClient): AuthService {
  async function loadUser(user: User): Promise<AppUser> {
    const { data } = await supabase.from("users").select("id, nickname, is_admin, created_at").eq("id", user.id).maybeSingle<UsersRow>();
    return toAppUser(user, data);
  }

  return {
    async getCurrentUser() {
      const { data } = await supabase.auth.getUser();
      return data.user ? loadUser(data.user) : null;
    },

    async signUp({ email, password, nickname }) {
      // 닉네임은 메타데이터로 넘기면 DB 트리거(handle_new_user)가 users 행에 넣는다. 새 회원은 일반 회원이다.
      const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { nickname } } });
      if (error) throw toKoreanError(error.message);
      // 이메일 확인이 켜져 있으면 이미 가입된 이메일도 오류 없이 identities가 빈 사용자를 돌려준다(가입 여부 노출 방지).
      if (data.user && data.user.identities?.length === 0) throw new Error("이미 가입된 이메일이에요. 로그인하거나 비밀번호 찾기를 이용해 주세요.");
      if (!data.user || !data.session) return null;
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

    async requestPasswordReset(email) {
      // 링크를 누르면 이 사이트로 돌아오고 PASSWORD_RECOVERY 이벤트가 온다.
      // Supabase 대시보드 Authentication > URL Configuration의 Redirect URLs에 이 주소가 있어야 한다.
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
      if (error) throw toKoreanError(error.message);
    },

    async updatePassword(password) {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw toKoreanError(error.message);
    },

    async deleteAccount() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) throw new Error("로그인이 필요해요.");
      // 사진은 SQL로 지울 수 없어 Storage API로 먼저 지운다 (내 폴더만 지울 수 있음)
      const bucket = supabase.storage.from("report-photos");
      const { data: files } = await bucket.list(data.user.id, { limit: 1000 });
      if (files?.length) await bucket.remove(files.map((file) => `${data.user!.id}/${file.name}`));
      // 계정 삭제: users·신고·포인트·현장 인증 기록이 함께 지워진다 (db/migrations/010_delete_account.sql)
      const { error } = await supabase.rpc("delete_my_account");
      if (error) throw new Error("탈퇴하지 못했어요. 잠시 후 다시 시도해 주세요.");
      await supabase.auth.signOut({ scope: "local" });
    },

    // 관리자 기능: 서버 함수가 관리자인지 다시 확인한다 (db/migrations/013_admin_roles.sql)
    async listMembers() {
      const { data, error } = await supabase.rpc("admin_list_members");
      if (error) throw toKoreanError(error.message);
      return ((data ?? []) as MemberRow[]).map((row): Member => ({
        id: row.user_id,
        email: row.email,
        nickname: row.nickname,
        isAdmin: row.is_admin,
        joinedAt: row.joined_at,
        points: row.points,
      }));
    },

    async setMemberAdmin(userId, isAdmin) {
      const { error } = await supabase.rpc("admin_set_member_role", { p_user_id: userId, p_is_admin: isAdmin });
      if (error) throw toKoreanError(error.message);
    },

    onAuthChange(callback) {
      const { data } = supabase.auth.onAuthStateChange((event) => callback(event));
      return () => data.subscription.unsubscribe();
    },
  };
}
