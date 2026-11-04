import { useState, type ReactNode } from "react";
import { AuthFrame, AuthScreen } from "./AuthScreen";
import { AdultVerifyStep } from "./AdultVerifyStep";
import { ResetPasswordScreen } from "./ResetPasswordScreen";
import { useAuth } from "./useAuth";

/**
 * 로그인 + 관리자 성인 인증 승인을 마친 사용자에게만 children을 보여준다.
 * 아니면 로그인/회원가입, 인증 요청, 승인 대기 화면을 대신 보여준다.
 *
 * <RequireAdult><장소 화면 /></RequireAdult>
 */
export function RequireAdult({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  const { loading, isLoggedIn, isAdultVerified, passwordRecovery, user } = useAuth();

  if (loading) return <AuthFrame title="잠시만요" description="로그인 상태를 확인하고 있어요."><div className="auth-loading" /></AuthFrame>;
  if (isLoggedIn && passwordRecovery) return <ResetPasswordScreen />;
  if (!isLoggedIn) return <>{fallback ?? <AuthScreen />}</>;
  if (!isAdultVerified) {
    if (fallback) return <>{fallback}</>;
    return user?.adultStatus === "pending" ? <AdultApprovalPending /> : <AdultVerifyRequired />;
  }
  return <>{children}</>;
}

/** 인증 요청 전이거나 반려된 사용자 */
function AdultVerifyRequired() {
  const { user, requestAdultVerification, signOut } = useAuth();
  const rejected = user?.adultStatus === "rejected";

  return <AuthFrame
    title={rejected ? "성인 인증이 반려됐어요" : "성인 인증이 필요해요"}
    description={rejected ? "내용을 확인하고 다시 요청해 주세요." : "출생연도를 선택해 요청하면 관리자가 확인 후 승인해요."}
  >
    {rejected && <p className="auth-error" role="alert">반려 사유: {user?.adultRejectReason ?? "사유가 남겨지지 않았어요."}</p>}
    <AdultVerifyStep submitLabel="승인 요청하기" onVerified={async (result) => { await requestAdultVerification(result); }} />
    <button className="auth-text-button" onClick={() => void signOut()}>로그아웃</button>
  </AuthFrame>;
}

/** 요청을 보내고 관리자 승인을 기다리는 사용자 */
function AdultApprovalPending() {
  const { user, refresh, signOut } = useAuth();
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState("");

  const check = async () => {
    setChecking(true);
    setMessage("");
    try {
      await refresh();
      setMessage("아직 승인 대기 중이에요.");
    } catch {
      setMessage("상태를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setChecking(false);
    }
  };

  return <AuthFrame title="승인을 기다리고 있어요" description={`${user?.nickname ?? ""}님의 성인 인증 요청을 관리자가 확인하고 있어요.`}>
    <div className="auth-notice">
      <strong>관리자 승인 후 이용할 수 있어요</strong>
      <p>승인되면 흡연구역 지도와 신고·리워드 기능이 열려요. 반려되면 사유를 확인하고 다시 요청할 수 있어요.</p>
    </div>
    {message && <p className="auth-success" role="status">{message}</p>}
    <button className="auth-primary" onClick={check} disabled={checking}>{checking ? "확인 중…" : "승인 상태 새로고침"}</button>
    <button className="auth-text-button" onClick={() => void signOut()}>로그아웃</button>
  </AuthFrame>;
}
