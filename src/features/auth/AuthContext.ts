import { createContext } from "react";
import type { AppUser, Member, SignInInput, SignUpInput } from "./types";

export type AuthContextValue = {
  user: AppUser | null;
  loading: boolean;
  isLoggedIn: boolean;
  /** 서버에서 관리자로 지정된 회원 */
  isAdmin: boolean;
  /** 관리자가 "사용자 화면으로 보기"를 켰는지. 켜면 관리자 메뉴가 숨겨진다 */
  viewAsUser: boolean;
  setViewAsUser: (on: boolean) => void;
  /** 관리자 메뉴를 보여줄지 (관리자 && 사용자 화면 보기 꺼짐) */
  showAdminTools: boolean;
  /** 가입 후 세션이 바로 생기지 않으면(이메일 확인 필요) null */
  signUp: (input: SignUpInput) => Promise<AppUser | null>;
  signIn: (input: SignInInput) => Promise<AppUser>;
  signOut: () => Promise<void>;
  /** 비밀번호 재설정 메일 링크로 들어와 새 비밀번호를 정해야 하는 상태 */
  passwordRecovery: boolean;
  /** 메일 링크가 만료되는 등 링크로 들어왔지만 실패했을 때 안내 문구 */
  linkError: string;
  requestPasswordReset: (email: string) => Promise<void>;
  /** 새 비밀번호 저장. 재설정 중이었다면 재설정 상태를 끝낸다 */
  updatePassword: (password: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
  /** 닉네임 변경 (한글·영문·숫자 2~12자) 후 내 정보를 다시 읽는다 */
  updateNickname: (nickname: string) => Promise<void>;
  listMembers: () => Promise<Member[]>;
  /** 나 자신을 일반 회원으로 바꾸면 내 정보도 다시 읽는다 */
  setMemberAdmin: (userId: string, isAdmin: boolean) => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
