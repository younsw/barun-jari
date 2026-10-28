import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { AuthContext, type AuthContextValue } from "./AuthContext";
import { authService } from "./authService";
import { isVerificationFresh } from "./adultVerification";
import type { AppUser, SignUpInput } from "./types";

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

  const refresh = useCallback(async () => {
    try {
      setUser(await authService.getCurrentUser());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    return authService.onAuthChange(() => void refresh());
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
  }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
