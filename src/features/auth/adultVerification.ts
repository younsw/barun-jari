import { mockVerifyAdult } from "./mockAdultVerification";
import { isAdultBirthYear } from "./adultAge";
import type { AdultVerificationResult, AdultVerificationSuccess } from "./types";

/**
 * 성인 인증 진입점. 화면은 이 파일의 함수만 부른다.
 *
 * 포트원 본인인증으로 바꿀 때는 이 파일만 고치면 된다.
 *   1. IMP.certification()으로 인증창을 띄워 imp_uid를 받는다.
 *   2. imp_uid를 서버(Supabase Edge Function)로 보내 포트원 API로 birthday를 조회한다.
 *   3. 서버에서 isAdultBirthYear(출생연도)로 판단하고, 생년월일은 저장하지 않고 버린다.
 *   4. 성공이면 { ok: true, verifiedAt, verificationId: imp_uid }를 돌려준다.
 * 성인 판단은 반드시 서버에서 다시 해야 한다. (브라우저 값은 조작될 수 있음)
 */
export const ADULT_VERIFICATION_MODE: "mock" | "portone" = "mock";

/** 인증 후 가입까지 허용하는 시간 */
const VERIFICATION_TTL_MS = 10 * 60 * 1000;

/** mock 모드에서는 화면에서 고른 출생연도를 넘긴다. portone 모드에서는 쓰지 않는다. */
export async function verifyAdult(mockBirthYear: number | null = null): Promise<AdultVerificationResult> {
  return mockVerifyAdult(mockBirthYear);
}

/** 가입 직전 인증 결과가 아직 유효한지 확인 */
export function isVerificationFresh(verification: AdultVerificationSuccess, now: Date = new Date()): boolean {
  return now.getTime() - new Date(verification.verifiedAt).getTime() < VERIFICATION_TTL_MS;
}

export { isAdultBirthYear };
