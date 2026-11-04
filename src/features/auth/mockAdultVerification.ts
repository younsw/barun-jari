import { getAdultCutoffYear, isAdultBirthYear } from "./adultAge";
import type { AdultVerificationResult } from "./types";

/**
 * 출생연도 자기 신고. 미성년 출생연도는 바로 막고, 나머지는 관리자 승인 요청으로 넘긴다.
 * 이 결과만으로는 인증되지 않는다. (서버 request_adult_verification → 관리자 review_adult_verification)
 */
export async function mockVerifyAdult(birthYear: number | null): Promise<AdultVerificationResult> {
  await new Promise((resolve) => window.setTimeout(resolve, 500));
  if (birthYear === null) return { ok: false, reason: "cancelled", message: "출생연도를 선택해 주세요." };
  if (!isAdultBirthYear(birthYear)) {
    return { ok: false, reason: "underage", message: `${getAdultCutoffYear() + 1}년생 이후 출생자는 가입할 수 없어요.` };
  }
  return { ok: true, verifiedAt: new Date().toISOString(), verificationId: `mock_${Date.now()}`, declaredBirthYear: birthYear };
}
