/**
 * 성인 기준 계산 (청소년 보호법 '연 나이' 기준)
 *
 * - 그 해에 만 19세가 되는 사람부터 성인으로 본다.
 *   → 성인 기준 출생연도 = 올해(한국 시간) - 19
 * - 2026년: 2007년생까지 가입 가능, 2008년생부터 불가
 * - 한국 시간 1월 1일 0시가 되면 자동으로 1년씩 넘어간다.
 *   (2027년 → 2008년생까지, 2028년 → 2009년생까지 …)
 *
 * 연도를 코드에 직접 적지 않고 매번 현재 날짜로 계산하므로 따로 고칠 필요가 없다.
 */

export const ADULT_AGE = 19;

/** 한국 시간(Asia/Seoul) 기준 연도. 사용자 기기의 시간대와 상관없이 같은 값을 준다. */
export function getKoreanYear(now: Date = new Date()): number {
  const year = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", year: "numeric" }).format(now);
  return Number(year);
}

/** 올해 가입할 수 있는 가장 늦은 출생연도. 예) 2026년 → 2007 */
export function getAdultCutoffYear(now: Date = new Date()): number {
  return getKoreanYear(now) - ADULT_AGE;
}

/** 출생연도가 성인 기준을 만족하는지. 기준 연도와 같거나 더 이른 해에 태어났으면 성인. */
export function isAdultBirthYear(birthYear: number, now: Date = new Date()): boolean {
  if (!Number.isInteger(birthYear)) return false;
  return birthYear <= getAdultCutoffYear(now);
}

/** 화면 안내 문구. 예) "2007년생까지 가입할 수 있어요" */
export function getAdultCutoffLabel(now: Date = new Date()): string {
  return `${getAdultCutoffYear(now)}년생까지 가입할 수 있어요`;
}
