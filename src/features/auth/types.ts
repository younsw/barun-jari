/** 화면에서 쓰는 로그인 사용자. users 테이블(id, nickname, is_adult_verified, verified_at, created_at) 기준. */
export type AppUser = {
  id: string;
  email: string;
  nickname: string;
  isAdultVerified: boolean;
  verifiedAt: string | null;
  createdAt: string;
};

/** 성인 인증 성공 결과. 생년월일·주민번호 원본은 담지 않는다. */
export type AdultVerificationSuccess = {
  ok: true;
  verifiedAt: string;
  /** 포트원 연동 후 imp_uid 같은 인증 거래 번호. 서버에서 재확인할 때 쓴다. */
  verificationId: string;
  /** 임시(mock) 인증에서만 채운다. 서버(complete_adult_verification)가 다시 판단하고 저장하지 않는다. */
  mockBirthYear?: number;
};

export type AdultVerificationFailure = {
  ok: false;
  reason: "underage" | "cancelled" | "failed";
  message: string;
};

export type AdultVerificationResult = AdultVerificationSuccess | AdultVerificationFailure;

export type SignUpInput = {
  email: string;
  password: string;
  nickname: string;
  agreedTerms: boolean;
  agreedPrivacy: boolean;
  verification: AdultVerificationSuccess;
};

export type SignInInput = { email: string; password: string };

export interface AuthService {
  getCurrentUser(): Promise<AppUser | null>;
  signUp(input: SignUpInput): Promise<AppUser | null>;
  signIn(input: SignInInput): Promise<AppUser>;
  signOut(): Promise<void>;
  /** 이미 가입했지만 인증 기록이 없는 사용자의 인증 결과 저장 */
  saveAdultVerification(verification: AdultVerificationSuccess): Promise<AppUser>;
  onAuthChange(callback: () => void): () => void;
}
