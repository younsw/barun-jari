import { useState, type ReactNode } from "react";
import { AuthFrame, AuthScreen } from "./AuthScreen";
import { AdultVerifyStep } from "./AdultVerifyStep";
import { useAuth } from "./useAuth";

/**
 * 로그인 + 성인 인증을 마친 사용자에게만 children을 보여준다.
 * 아니면 로그인/회원가입 또는 성인 인증 화면을 대신 보여준다.
 *
 * <RequireAdult><장소 화면 /></RequireAdult>
 */
export function RequireAdult({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  const { loading, isLoggedIn, isAdultVerified } = useAuth();

  if (loading) return <AuthFrame title="잠시만요" description="로그인 상태를 확인하고 있어요."><div className="auth-loading" /></AuthFrame>;
  if (!isLoggedIn) return <>{fallback ?? <AuthScreen />}</>;
  if (!isAdultVerified) return <>{fallback ?? <AdultVerifyRequired />}</>;
  return <>{children}</>;
}

/** 로그인은 했지만 인증 기록이 없는 사용자(예: 예전 계정)용 */
function AdultVerifyRequired() {
  const { saveAdultVerification, signOut } = useAuth();
  const [error, setError] = useState("");

  return <AuthFrame title="성인 인증이 필요해요" description="장소 정보는 성인 인증을 마친 분만 볼 수 있어요.">
    {error && <p className="auth-error" role="alert">{error}</p>}
    <AdultVerifyStep onVerified={(result) => {
      saveAdultVerification(result).catch((caught) => setError(caught instanceof Error ? caught.message : "저장에 실패했어요."));
    }} />
    <button className="auth-text-button" onClick={() => void signOut()}>로그아웃</button>
  </AuthFrame>;
}
