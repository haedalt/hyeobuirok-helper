/** 성취수준별 분포 (F4~F10, PRD 6-3) */
import type { FrequencyTable } from '../parsers';
import { EXPECTED_BIN_SIZE, FIXED_CUT_SCORES } from './constants';
import { percent1 } from './format';
import {
  ACHIEVEMENT_LEVELS,
  type AchievementLevel,
  type ByLevel,
  type CutScores,
  type EstimatedDistribution,
  type FixedDistribution,
  type Issue,
} from './types';

/** 고정분할 표의 급간 (양식에 고정 글자로 들어 있음) */
export const FIXED_BIN_LABELS: Readonly<ByLevel<string>> = {
  A: '90-100',
  B: '80-90미만',
  C: '70-80미만',
  D: '60-70미만',
  E: '40-60미만',
  U: '40미만',
};

/** 분할점수 5개를 위에서부터 [A/B, B/C, C/D, D/E, E/미도달] 순으로 */
function cutList(cuts: CutScores): number[] {
  return [cuts.ab, cuts.bc, cuts.cd, cuts.de, cuts.eu];
}

/** 점수가 속한 성취수준. 경계 점수는 위 수준 (90점 = A) */
export function levelOf(score: number, cuts: CutScores = FIXED_CUT_SCORES): AchievementLevel {
  const index = cutList(cuts).findIndex((cut) => score >= cut);
  return ACHIEVEMENT_LEVELS[index < 0 ? 5 : index];
}

function zeroByLevel(): ByLevel<number> {
  return { A: 0, B: 0, C: 0, D: 0, E: 0, U: 0 };
}

function percentsOf(counts: ByLevel<number>, total: number): ByLevel<number> {
  const result = zeroByLevel();
  for (const level of ACHIEVEMENT_LEVELS) result[level] = percent1(counts[level], total);
  return result;
}

function sumLevels(counts: ByLevel<number>): number {
  return ACHIEVEMENT_LEVELS.reduce((a, level) => a + counts[level], 0);
}

/**
 * 고정분할: 도수분포표 급간을 90/80/70/60/40 경계로 묶는다.
 * 10점 급간이면 A~D는 한 급간, E는 두 급간(40~60), 미도달은 네 급간(0~40)의 합.
 */
export function fixedDistribution(table: FrequencyTable): { value: FixedDistribution; issues: Issue[] } {
  const issues: Issue[] = [];
  const cuts = cutList(FIXED_CUT_SCORES);

  if (table.binSize !== null && table.binSize !== EXPECTED_BIN_SIZE) {
    issues.push({
      severity: 'warning',
      code: 'BIN_SIZE_NOT_10',
      message: `도수분포표 급간이 ${table.binSize}점입니다(기대값 ${EXPECTED_BIN_SIZE}점). 고정분할 경계와 맞는지 확인해 주세요.`,
    });
  }

  const counts = zeroByLevel();
  const levelAByClass = table.classes.map((c) => ({ name: c.name, count: 0 }));
  for (const bin of table.bins) {
    // 급간 안에 경계가 끼어 있으면(예: 85~95) 인원을 나눌 수 없다
    const straddled = cuts.find((cut) => bin.lower < cut && cut < bin.upper);
    if (straddled !== undefined) {
      issues.push({
        severity: 'error',
        code: 'BIN_STRADDLES_CUT',
        message: `도수분포표 급간 '${bin.label}'에 고정분할 경계 ${straddled}점이 걸쳐 있어 성취수준별 인원을 셀 수 없습니다. 인원을 직접 입력해 주세요.`,
      });
    }
    const level = levelOf(bin.lower);
    const known = bin.counts.every((n) => n !== null);
    const binTotal = known ? bin.counts.reduce<number>((a, n) => a + n!, 0) : bin.reportedTotal;
    if (binTotal === null) {
      issues.push({
        severity: 'error',
        code: 'BIN_COUNT_MISSING',
        message: `도수분포표 급간 '${bin.label}'의 인원을 읽지 못했습니다.`,
      });
      continue;
    }
    counts[level] += binTotal;
    if (level === 'A') bin.counts.forEach((n, i) => (levelAByClass[i].count += n ?? 0));
  }

  const total = sumLevels(counts);
  return {
    value: {
      mode: 'fixed',
      bins: { ...FIXED_BIN_LABELS },
      counts,
      total,
      percents: percentsOf(counts, total),
      levelAByClass,
    },
    issues,
  };
}

/** 추정분할 급간 문자열: '87-100', '75-87미만', …, '0-35미만' */
export function estimatedBinLabels(cuts: CutScores): ByLevel<string> {
  const [ab, bc, cd, de, eu] = cutList(cuts);
  return {
    A: `${ab}-100`,
    B: `${bc}-${ab}미만`,
    C: `${cd}-${bc}미만`,
    D: `${de}-${cd}미만`,
    E: `${eu}-${de}미만`,
    U: `0-${eu}미만`,
  };
}

/** F9 분할점수 문장 */
export function cutScoreSentence(cuts: CutScores): string {
  return `A/B=${cuts.ab}점, B/C=${cuts.bc}점, C/D=${cuts.cd}점, D/E=${cuts.de}점, E/미도달=${cuts.eu}점`;
}

/** 분할점수 검사: 0~100 사이, A/B > B/C > C/D > D/E > E/미도달 */
export function validateCutScores(cuts: CutScores): Issue[] {
  const list = cutList(cuts);
  const issues: Issue[] = [];
  if (list.some((n) => !Number.isFinite(n) || n <= 0 || n >= 100)) {
    issues.push({ severity: 'error', code: 'CUT_OUT_OF_RANGE', message: '분할점수는 0점보다 크고 100점보다 작아야 합니다.' });
  }
  if (list.some((n, i) => i > 0 && n >= list[i - 1])) {
    issues.push({
      severity: 'error',
      code: 'CUT_NOT_DESCENDING',
      message: `분할점수는 A/B > B/C > C/D > D/E > E/미도달 순으로 작아져야 합니다(입력: ${list.join(', ')}).`,
    });
  }
  return issues;
}

/**
 * 추정분할: 교사가 입력한 분할점수 5개와 수준별 인원 6개로 표를 만든다.
 * @param examinees 성적집계표 응시자 수. 인원 합과 다르면 경고
 */
export function estimatedDistribution(
  cutScores: CutScores,
  counts: ByLevel<number>,
  examinees: number | null,
): { value: EstimatedDistribution; issues: Issue[] } {
  const issues = validateCutScores(cutScores);
  if (ACHIEVEMENT_LEVELS.some((level) => !Number.isInteger(counts[level]) || counts[level] < 0)) {
    issues.push({ severity: 'error', code: 'COUNT_INVALID', message: '수준별 인원은 0 이상의 정수여야 합니다.' });
  }
  const total = sumLevels(counts);
  if (examinees !== null && total !== examinees) {
    issues.push({
      severity: 'warning',
      code: 'LEVEL_SUM_MISMATCH',
      message: `수준별 인원 합(${total}명)이 성적집계표 응시자 수(${examinees}명)와 다릅니다.`,
    });
  }
  return {
    value: {
      mode: 'estimated',
      bins: estimatedBinLabels(cutScores),
      counts: { ...counts },
      total,
      percents: percentsOf(counts, total),
      cutScores: { ...cutScores },
      cutScoreSentence: cutScoreSentence(cutScores),
    },
    issues,
  };
}
