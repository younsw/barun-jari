import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { AuthContext, type AuthContextValue } from "./AuthContext";
import { authService } from "./authService";
import { isVerificationFresh } from "./adultVerification";
import type { AppUser, SignUpInput } from "./types";

// 메일 링크로 들어온 주소(#type=recovery, #error_code=...)는 Supabase가 곧 지우므로 처음에 읽어 둔다
const initialHash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
const openedFromRecoveryLink = initialHash.get("type") === "recovery";
const initialLinkError = initialHash.get("error_code") === "otp_expired"
  ? "메일 링크가 만료됐거나 이미 사용됐어요. 다시 요청해 주세요."
  : initialHash.get("error") ? "메일 링크를 확인하지 못했어요. 다시 요청해 주세요." : "";

const NICKNAME_PATTERN = /^[가-힣a-zA-Z0-9_]{2,12}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateSignUp(input: SignUpInput) {
  if (!input.verification?.ok) throw new Error("성인 인증을 먼저 완료해 주세요.");
  if (!isVerificationFresh(input.verification)) throw new Error("성인 인증 시간이 지났어요. 다시 인증해 주세요.");
  if (!EMAIL_PATTERN.test(input.email.trim())) throw new Error("이메일 형식을 확인해 주세요.");
  if (input.password.length < 8) throw new Error("비밀번호는 8자 이상이어야 해요.");
  if (!NICKNAME_PATTERN.test(input.nickname.trim())) throw new Error("닉네임은 한글·영문·숫자 2~12자로 입력해 주세요.");
  if (!input.agreedTerms || !input.agreedPrivacy) throw new Error("필수 약관에 동의해 주세요.");
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [passwordRecovery, setPasswordRecovery] = useState(openedFromRecoveryLink);
  const [linkError, setLinkError] = useState(initialLinkError);

  const refresh = useCallback(async () => {
    try {
      setUser(await authService.getCurrentUser());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    return authService.onAuthChange((event) => {
      if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
      void refresh();
    });
  }, [refresh]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    isLoggedIn: user !== null,
    isAdultVerified: user?.isAdultVerified === true,
    async signUp(input) {
      validateSignUp(input);
      const created = await authService.signUp({ ...input, email: input.email.trim(), nickname: input.nickname.trim() });
      setUser(created);
      return created;
    },
    async signIn(input) {
      const signedIn = await authService.signIn(input);
      setUser(signedIn);
      return signedIn;
    },
    async signOut() {
      await authService.signOut();
      setUser(null);
    },
    async saveAdultVerification(verification) {
      const updated = await authService.saveAdultVerification(verification);
      setUser(updated);
      return updated;
    },
    passwordRecovery,
    linkError,
    async requestPasswordReset(email) {
      if (!EMAIL_PATTERN.test(email.trim())) throw new Error("이메일 형식을 확인해 주세요.");
      setLinkError("");
      await authService.requestPasswordReset(email.trim());
    },
    async updatePassword(password) {
      if (password.length < 8) throw new Error("비밀번호는 8자 이상이어야 해요.");
      await authService.updatePassword(password);
      setPasswordRecovery(false);
    },
    async deleteAccount() {
      await authService.deleteAccount();
      setPasswordRecovery(false);
      setUser(null);
    },
  }), [user, loading, passwordRecovery, linkError]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
