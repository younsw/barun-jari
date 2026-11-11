/**
 * 메일 링크로 들어와 새 비밀번호를 정하는 화면.
 * 만든 날: 2026-11-04 · 마지막 수정: 2026-11-04
 */
import { useState, type FormEvent } from "react";
import { AuthFrame } from "./AuthScreen";
import { useAuth } from "./useAuth";

/** 비밀번호 재설정 메일 링크로 들어왔을 때 새 비밀번호 정하기 */
export function ResetPasswordScreen() {
  const { updatePassword, signOut } = useAuth();
  const [password, setPassword] = useState("");
  const [passwordCheck, setPasswordCheck] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (password !== passwordCheck) return setError("비밀번호가 서로 달라요.");
    setPending(true);
    setError("");
    try {
      await updatePassword(password);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "비밀번호를 바꾸지 못했어요.");
    } finally {
      setPending(false);
    }
  };

  return <AuthFrame title="새 비밀번호 정하기" description="앞으로 로그인할 때 쓸 비밀번호를 입력해 주세요.">
    <form className="auth-step" onSubmit={submit}>
      <label className="auth-field"><span>새 비밀번호</span>
        <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="8자 이상" minLength={8} required />
      </label>
      <label className="auth-field"><span>새 비밀번호 확인</span>
        <input type="password" autoComplete="new-password" value={passwordCheck} onChange={(e) => setPasswordCheck(e.target.value)} required />
      </label>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <button className="auth-primary" type="submit" disabled={pending}>{pending ? "저장 중…" : "비밀번호 바꾸기"}</button>
      <button className="auth-text-button" type="button" onClick={() => void signOut()}>취소하고 로그아웃</button>
    </form>
  </AuthFrame>;
}
