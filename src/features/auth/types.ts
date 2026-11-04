/** 성인 인증 진행 상태 (users.adult_status). 승인은 관리자만 할 수 있다. */
export type AdultStatus = "none" | "pending" | "approved" | "rejected";

/** 화면에서 쓰는 로그인 사용자. users 테이블 기준. */
export type AppUser = {
  id: string;
  email: string;
  nickname: string;
  /** 관리자가 승인했을 때만 true */
  isAdultVerified: boolean;
  adultStatus: AdultStatus;
  /** 반려 사유 (rejected일 때) */
  adultRejectReason: string | null;
  verifiedAt: string | null;
  isAdmin: boolean;
  createdAt: string;
};

/** 관리자 화면: 승인 대기 중인 요청 */
export type PendingAdultRequest = {
  userId: string;
  nickname: string;
  email: string;
  declaredBirthYear: number | null;
  requestedAt: string | null;
  joinedAt: string;
};

/** 출생연도 확인(인증 요청 준비) 결과. 이것만으로는 인증되지 않고, 관리자 승인이 필요하다. */
export type AdultVerificationSuccess = {
  ok: true;
  verifiedAt: string;
  /** 포트원 연동 후 imp_uid 같은 인증 거래 번호. 서버에서 재확인할 때 쓴다. */
  verificationId: string;
  /** 회원이 직접 고른 출생연도. 관리자 승인 판단용으로 서버에 보내고, 승인·반려 후 지운다. */
  declaredBirthYear?: number;
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
  /** 성인 인증 요청 (관리자 승인 대기 상태가 된다) */
  requestAdultVerification(verification: AdultVerificationSuccess): Promise<AppUser>;
  /** 관리자: 승인 대기 목록 */
  listPendingAdultRequests(): Promise<PendingAdultRequest[]>;
  /** 관리자: 승인(true) 또는 반려(false) */
  reviewAdultRequest(userId: string, approve: boolean, reason?: string): Promise<void>;
  /** 비밀번호 재설정 메일 보내기. 가입 여부는 알려주지 않는다 */
  requestPasswordReset(email: string): Promise<void>;
  /** 재설정 메일 링크로 들어온 뒤(또는 로그인 상태에서) 새 비밀번호 저장 */
  updatePassword(password: string): Promise<void>;
  /** 회원 탈퇴: 사진·신고·포인트·인증 기록과 계정을 모두 지운다 */
  deleteAccount(): Promise<void>;
  /** event는 "PASSWORD_RECOVERY"처럼 Supabase Auth 이벤트 이름 */
  onAuthChange(callback: (event?: string) => void): () => void;
}
