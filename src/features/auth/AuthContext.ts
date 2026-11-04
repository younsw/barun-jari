import { createContext } from "react";
import type { AdultVerificationSuccess, AppUser, SignInInput, SignUpInput } from "./types";

export type AuthContextValue = {
  user: AppUser | null;
  loading: boolean;
  isLoggedIn: boolean;
  isAdultVerified: boolean;
  /** 가입 후 세션이 바로 생기지 않으면(이메일 확인 필요) null */
  signUp: (input: SignUpInput) => Promise<AppUser | null>;
  signIn: (input: SignInInput) => Promise<AppUser>;
  signOut: () => Promise<void>;
  saveAdultVerification: (verification: AdultVerificationSuccess) => Promise<AppUser>;
  /** 비밀번호 재설정 메일 링크로 들어와 새 비밀번호를 정해야 하는 상태 */
  passwordRecovery: boolean;
  /** 메일 링크가 만료되는 등 링크로 들어왔지만 실패했을 때 안내 문구 */
  linkError: string;
  requestPasswordReset: (email: string) => Promise<void>;
  /** 새 비밀번호 저장. 재설정 중이었다면 재설정 상태를 끝낸다 */
  updatePassword: (password: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
