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
};

export const AuthContext = createContext<AuthContextValue | null>(null);
