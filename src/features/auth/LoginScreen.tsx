import { useState, type FormEvent } from "react";
import { useAuth } from "./useAuth";

export function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      await signIn({ email, password });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "로그인에 실패했어요.");
    } finally {
      setPending(false);
    }
  };

  return <form className="auth-step" onSubmit={submit}>
    <label className="auth-field"><span>이메일</span>
      <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
    </label>
    <label className="auth-field"><span>비밀번호</span>
      <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
    </label>
    {error && <p className="auth-error" role="alert">{error}</p>}
    <button className="auth-primary" type="submit" disabled={pending}>{pending ? "로그인 중…" : "로그인"}</button>
  </form>;
}
