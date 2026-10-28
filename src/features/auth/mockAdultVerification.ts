import { getAdultCutoffYear, isAdultBirthYear } from "./adultAge";
import type { AdultVerificationResult } from "./types";

/**
 * 가짜 성인 인증. 출생연도만 받아 성인 여부를 판단하고 바로 버린다.
 * 포트원 연동 전까지 화면 흐름 확인용으로만 쓴다.
 */
export async function mockVerifyAdult(birthYear: number | null): Promise<AdultVerificationResult> {
  await new Promise((resolve) => window.setTimeout(resolve, 500));
  if (birthYear === null) return { ok: false, reason: "cancelled", message: "출생연도를 선택해 주세요." };
  if (!isAdultBirthYear(birthYear)) {
    return { ok: false, reason: "underage", message: `${getAdultCutoffYear() + 1}년생 이후 출생자는 가입할 수 없어요.` };
  }
  return { ok: true, verifiedAt: new Date().toISOString(), verificationId: `mock_${Date.now()}`, mockBirthYear: birthYear };
}
