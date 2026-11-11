/** 화면에서 쓰는 로그인 사용자. users 테이블(id, nickname, is_admin, created_at) 기준. */
export type AppUser = {
  id: string;
  email: string;
  nickname: string;
  /** 관리자 여부. 서버(users.is_admin)만 믿는다 */
  isAdmin: boolean;
  createdAt: string;
};

/** 관리자 화면의 회원 한 명 */
export type Member = {
  id: string;
  email: string;
  nickname: string;
  isAdmin: boolean;
  joinedAt: string;
  points: number;
};

export type SignUpInput = {
  email: string;
  password: string;
  nickname: string;
  agreedTerms: boolean;
  agreedPrivacy: boolean;
};

export type SignInInput = { email: string; password: string };

export interface AuthService {
  getCurrentUser(): Promise<AppUser | null>;
  signUp(input: SignUpInput): Promise<AppUser | null>;
  signIn(input: SignInInput): Promise<AppUser>;
  signOut(): Promise<void>;
  /** 비밀번호 재설정 메일 보내기. 가입 여부는 알려주지 않는다 */
  requestPasswordReset(email: string): Promise<void>;
  /** 재설정 메일 링크로 들어온 뒤(또는 로그인 상태에서) 새 비밀번호 저장 */
  updatePassword(password: string): Promise<void>;
  /** 회원 탈퇴: 사진·신고·포인트·인증 기록과 계정을 모두 지운다 */
  deleteAccount(): Promise<void>;
  /** 관리자: 전체 회원 목록 */
  listMembers(): Promise<Member[]>;
  /** 관리자: 관리자로 지정(true) 또는 일반 회원으로 변경(false). 관리자가 0명이 되면 거절 */
  setMemberAdmin(userId: string, isAdmin: boolean): Promise<void>;
  /** event는 "PASSWORD_RECOVERY"처럼 Supabase Auth 이벤트 이름 */
  onAuthChange(callback: (event?: string) => void): () => void;
}
