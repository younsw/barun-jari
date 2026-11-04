import { useState, type FormEvent } from "react";
import { isMockAuth } from "./authService";
import { useAuth } from "./useAuth";

export function LoginScreen() {
  const { signIn, requestPasswordReset, linkError } = useAuth();
  const [mode, setMode] = useState<"login" | "forgot">(linkError ? "forgot" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(linkError);
  const [sent, setSent] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      if (mode === "login") {
        await signIn({ email, password });
      } else {
        await requestPasswordReset(email);
        // 가입 여부를 알려주지 않도록 항상 같은 문구
        setSent(isMockAuth
          ? "예시 모드라 메일 대신 바로 새 비밀번호 화면으로 이동해요. (가입된 이메일일 때만)"
          : "가입된 이메일이라면 비밀번호 재설정 메일을 보냈어요. 메일의 링크를 눌러 새 비밀번호를 정해 주세요.");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : mode === "login" ? "로그인에 실패했어요." : "메일을 보내지 못했어요.");
    } finally {
      setPending(false);
    }
  };

  const switchMode = (next: "login" | "forgot") => {
    setMode(next);
    setError("");
    setSent("");
  };

  return <form className="auth-step" onSubmit={submit}>
    {mode === "forgot" && <p className="auth-guide">가입한 이메일을 입력하면 비밀번호를 다시 정할 수 있는 링크를 보내드려요.</p>}
    <label className="auth-field"><span>이메일</span>
      <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
    </label>
    {mode === "login" && <label className="auth-field"><span>비밀번호</span>
      <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
    </label>}
    {error && <p className="auth-error" role="alert">{error}</p>}
    {sent && <p className="auth-success" role="status">{sent}</p>}
    <button className="auth-primary" type="submit" disabled={pending}>
      {mode === "login" ? (pending ? "로그인 중…" : "로그인") : (pending ? "보내는 중…" : "재설정 메일 보내기")}
    </button>
    <button className="auth-text-button" type="button" onClick={() => switchMode(mode === "login" ? "forgot" : "login")}>
      {mode === "login" ? "비밀번호를 잊으셨나요?" : "로그인으로 돌아가기"}
    </button>
  </form>;
}
