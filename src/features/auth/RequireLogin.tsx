/**
 * 로그인하지 않았으면 로그인 화면을, 비밀번호 재설정 링크로 왔으면 재설정 화면을 보여주는 문지기.
 * 만든 날: 2026-11-11 · 마지막 수정: 2026-11-11
 */
import type { ReactNode } from "react";
import { AuthFrame, AuthScreen } from "./AuthScreen";
import { ResetPasswordScreen } from "./ResetPasswordScreen";
import { useAuth } from "./useAuth";

/**
 * 로그인한 사용자에게만 children을 보여준다. 아니면 로그인/회원가입 화면을 대신 보여준다.
 * (성인 인증 단계는 없앴다 — db/migrations/013_admin_roles.sql)
 *
 * <RequireLogin><장소 화면 /></RequireLogin>
 */
export function RequireLogin({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  const { loading, isLoggedIn, passwordRecovery } = useAuth();

  if (loading) return <AuthFrame title="잠시만요" description="로그인 상태를 확인하고 있어요."><div className="auth-loading" /></AuthFrame>;
  if (isLoggedIn && passwordRecovery) return <ResetPasswordScreen />;
  if (!isLoggedIn) return <>{fallback ?? <AuthScreen />}</>;
  return <>{children}</>;
}
