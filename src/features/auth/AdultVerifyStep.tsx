import { useState } from "react";
import { ADULT_VERIFICATION_MODE, verifyAdult } from "./adultVerification";
import { getAdultCutoffLabel, getAdultCutoffYear, getKoreanYear } from "./adultAge";
import type { AdultVerificationSuccess } from "./types";

export function AdultVerifyStep({ onVerified }: { onVerified: (result: AdultVerificationSuccess) => void }) {
  const [birthYear, setBirthYear] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const thisYear = getKoreanYear();
  const cutoffYear = getAdultCutoffYear();
  const years = Array.from({ length: 101 }, (_, index) => thisYear - index);

  const submit = async () => {
    setPending(true);
    setError("");
    try {
      const result = await verifyAdult(birthYear);
      if (result.ok) onVerified(result);
      else setError(result.message);
    } catch {
      setError("인증 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setPending(false);
    }
  };

  return <div className="auth-step">
    <div className="auth-notice">
      <strong>성인만 가입할 수 있어요</strong>
      <p>{getAdultCutoffLabel()} · 매년 1월 1일 기준이 1년씩 바뀌어요.</p>
    </div>

    {ADULT_VERIFICATION_MODE === "mock" && <label className="auth-field">
      <span>출생연도 <em>테스트용 가짜 인증</em></span>
      <select value={birthYear ?? ""} onChange={(event) => setBirthYear(event.target.value ? Number(event.target.value) : null)}>
        <option value="">선택해 주세요</option>
        {years.map((year) => <option key={year} value={year}>{year}년{year === cutoffYear ? " (가입 가능 마지막 연도)" : ""}</option>)}
      </select>
      <small>출생연도는 성인 여부 확인에만 쓰고 저장하지 않아요.</small>
    </label>}

    {error && <p className="auth-error" role="alert">{error}</p>}
    <button className="auth-primary" onClick={submit} disabled={pending}>{pending ? "확인 중…" : "성인 인증하기"}</button>
  </div>;
}
