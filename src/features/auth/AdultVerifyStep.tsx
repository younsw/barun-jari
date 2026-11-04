import { useState } from "react";
import { ADULT_VERIFICATION_MODE, verifyAdult } from "./adultVerification";
import { getAdultCutoffLabel, getAdultCutoffYear, getKoreanYear } from "./adultAge";
import type { AdultVerificationSuccess } from "./types";

export function AdultVerifyStep({ onVerified, submitLabel = "다음" }: { onVerified: (result: AdultVerificationSuccess) => void | Promise<void>; submitLabel?: string }) {
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
      if (result.ok) await onVerified(result);
      else setError(result.message);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "인증 요청 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setPending(false);
    }
  };

  return <div className="auth-step">
    <div className="auth-notice">
      <strong>성인만 가입할 수 있어요</strong>
      <p>{getAdultCutoffLabel()} · 관리자가 확인한 뒤 승인되면 이용할 수 있어요.</p>
    </div>

    {ADULT_VERIFICATION_MODE === "admin" && <label className="auth-field">
      <span>출생연도 <em>관리자 승인 필요</em></span>
      <select value={birthYear ?? ""} onChange={(event) => setBirthYear(event.target.value ? Number(event.target.value) : null)}>
        <option value="">선택해 주세요</option>
        {years.map((year) => <option key={year} value={year}>{year}년{year === cutoffYear ? " (가입 가능 마지막 연도)" : ""}</option>)}
      </select>
      <small>출생연도는 관리자 확인에만 쓰고, 승인·반려 후 바로 지워요.</small>
    </label>}

    {error && <p className="auth-error" role="alert">{error}</p>}
    <button className="auth-primary" onClick={submit} disabled={pending}>{pending ? "확인 중…" : submitLabel}</button>
  </div>;
}
