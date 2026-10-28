import { useState, type FormEvent } from "react";
import { AdultVerifyStep } from "./AdultVerifyStep";
import { isVerificationFresh } from "./adultVerification";
import { useAuth } from "./useAuth";
import type { AdultVerificationSuccess } from "./types";

export function SignUpScreen({ onDone }: { onDone: (message: string) => void }) {
  const { signUp } = useAuth();
  const [verification, setVerification] = useState<AdultVerificationSuccess | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordCheck, setPasswordCheck] = useState("");
  const [nickname, setNickname] = useState("");
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  if (!verification) return <>
    <StepIndicator step={1} />
    {error && <p className="auth-error" role="alert">{error}</p>}
    <AdultVerifyStep onVerified={(result) => { setError(""); setVerification(result); }} />
  </>;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (password !== passwordCheck) return setError("비밀번호가 서로 달라요.");
    if (!isVerificationFresh(verification)) {
      setVerification(null);
      return setError("성인 인증 후 10분이 지났어요. 다시 인증해 주세요.");
    }
    setPending(true);
    setError("");
    try {
      const created = await signUp({ email, password, nickname, agreedTerms, agreedPrivacy, verification });
      onDone(created ? `${created.nickname}님, 가입을 환영해요!` : "가입 확인 메일을 보냈어요. 메일 확인 후 로그인해 주세요.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "가입에 실패했어요.");
    } finally {
      setPending(false);
    }
  };

  const allAgreed = agreedTerms && agreedPrivacy;

  return <form className="auth-step" onSubmit={submit}>
    <StepIndicator step={2} />
    <div className="auth-verified">성인 인증 완료</div>
    <label className="auth-field"><span>이메일</span>
      <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="example@email.com" required />
    </label>
    <label className="auth-field"><span>비밀번호</span>
      <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="8자 이상" minLength={8} required />
    </label>
    <label className="auth-field"><span>비밀번호 확인</span>
      <input type="password" autoComplete="new-password" value={passwordCheck} onChange={(e) => setPasswordCheck(e.target.value)} required />
    </label>
    <label className="auth-field"><span>닉네임</span>
      <input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="한글·영문·숫자 2~12자" maxLength={12} required />
    </label>

    <div className="auth-agree">
      <label className="all"><input type="checkbox" checked={allAgreed} onChange={(e) => { setAgreedTerms(e.target.checked); setAgreedPrivacy(e.target.checked); }} />전체 동의</label>
      <label><input type="checkbox" checked={agreedTerms} onChange={(e) => setAgreedTerms(e.target.checked)} />[필수] 이용약관 동의</label>
      <label><input type="checkbox" checked={agreedPrivacy} onChange={(e) => setAgreedPrivacy(e.target.checked)} />[필수] 개인정보 수집·이용 동의</label>
    </div>

    {error && <p className="auth-error" role="alert">{error}</p>}
    <button className="auth-primary" type="submit" disabled={pending || !allAgreed}>{pending ? "가입 중…" : "가입하기"}</button>
  </form>;
}

function StepIndicator({ step }: { step: 1 | 2 }) {
  return <ol className="auth-steps">
    <li className={step === 1 ? "active" : "done"}>1 성인 인증</li>
    <li className={step === 2 ? "active" : ""}>2 정보 입력</li>
  </ol>;
}
