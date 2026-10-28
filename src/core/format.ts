/** 숫자 반올림·표기. 협의록 표기 규칙 (PRD 4장) */

/** 비율(%)을 소수 첫째 자리로. 정수 연산으로 나눠 부동소수 오차 없이 반올림한다 */
export function percent1(count: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((count * 1000) / total) / 10;
}

/** 소수 첫째 자리 반올림 */
export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** 25 → '25.0%' (소수 첫째 자리 고정) */
export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

/** 7 → '7명' */
export function formatCount(value: number): string {
  return `${value}명`;
}
