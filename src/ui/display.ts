/** 화면·미리보기 표기 */
import type { AchievementLevel, Difficulty, ImprovementKey, Issue } from '../core';
import type { ParseWarning } from '../parsers';

// 표기 함수는 내보내기(src/export)와 함께 쓰므로 core에 있다
export { choiceSymbol, formatRate } from '../core';

/** 개선방안 문단 이름 (양식 개선방안 칸의 순서) */
export const IMPROVEMENT_LABELS: Record<ImprovementKey, string> = {
  average: '(평균)',
  maxMin: '(최고·최하점)',
  distribution: '(성취수준별 분포 비율 분석)',
  levelA: '(A 수준 분포)',
  itemGap: '(정답률 차이 분석)',
};

export const LEVEL_LABELS: Record<AchievementLevel, string> = { A: 'A', B: 'B', C: 'C', D: 'D', E: 'E', U: '미도달' };

export const DIFFICULTIES: Difficulty[] = ['쉬움', '보통', '어려움'];

/** 교과목 원문 '과학:화학 반응의 세계(3)' → 교과 '과학' (양식 '(OO) 교과' 칸) */
export function subjectGroup(subjectRaw: string | null | undefined): string {
  if (!subjectRaw || !subjectRaw.includes(':')) return '';
  return subjectRaw.split(':')[0].trim();
}

/** 문제 코드별로 어느 단계에서 보여줄지 */
const STEP_OF_CODE: Record<string, 2 | 3 | 4> = {
  META_MISMATCH: 2,
  EXAMINEES_MISMATCH: 2,
  ITEM_SET_MISMATCH: 2,
  ANSWER_MISMATCH: 2,
  AVERAGE_MISSING: 3,
  AVERAGE_MISMATCH: 3,
  BIN_SIZE_NOT_10: 3,
  BIN_STRADDLES_CUT: 3,
  BIN_COUNT_MISSING: 3,
  CUT_OUT_OF_RANGE: 3,
  CUT_NOT_DESCENDING: 3,
  COUNT_INVALID: 3,
  LEVEL_SUM_MISMATCH: 3,
  EXAMINEES_UNKNOWN: 4,
  ITEM_INCOMPLETE: 4,
  EXPECTED_MISSING: 4,
};

/** 파일이 아직 없어서 생기는 문제는 업로드 칸에서 안내하므로 목록에서 뺀다 */
const WAITING_CODES = new Set(['FREQUENCY_MISSING', 'ITEM_ANALYSIS_MISSING', 'ESTIMATED_INPUT_MISSING']);

export function issuesForStep(issues: Issue[], step: 2 | 3 | 4): Issue[] {
  return issues.filter((i) => !WAITING_CODES.has(i.code) && (STEP_OF_CODE[i.code] ?? 2) === step);
}

export function warningToIssue(w: ParseWarning): Issue {
  return { severity: 'warning', code: w.code, message: w.message };
}
