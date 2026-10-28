import { useContext } from "react";
import { AuthContext, type AuthContextValue } from "./AuthContext";

/**
 * 다른 팀원용 로그인 상태 훅. <AuthProvider> 안에서만 쓸 수 있다.
 * const { user, isLoggedIn, isAdultVerified, signOut } = useAuth();
 */
export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth()는 <AuthProvider> 안에서만 쓸 수 있어요.");
  return value;
}
