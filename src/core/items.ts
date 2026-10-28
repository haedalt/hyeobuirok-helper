/** 문항 난이도 판정과 차이 문항 (F11~F15, PRD 6-4) */
import type { ItemAnalysisTable, ItemInfoTable } from '../parsers';
import { DEFAULT_DIFFICULTY_THRESHOLDS, POPULAR_DISTRACTOR_PERCENT } from './constants';
import { percent1 } from './format';
import type { ByChoice, Choice, ChoiceStat, Difficulty, DifficultyThresholds, Issue, ItemAnalysis } from './types';

const DIFFICULTY_ORDER: Difficulty[] = ['쉬움', '보통', '어려움'];

/** 학년 전체 정답률(%)로 실제 난이도 판정. 경계값은 위 수준 쪽 (25 → 보통, 75 → 쉬움) */
export function judgeDifficulty(
  correctRate: number,
  thresholds: DifficultyThresholds = DEFAULT_DIFFICULTY_THRESHOLDS,
): Difficulty {
  if (correctRate < thresholds.hardBelow) return '어려움';
  if (correctRate >= thresholds.easyAtOrAbove) return '쉬움';
  return '보통';
}

/** 쉬움↔보통 = 1, 쉬움↔어려움 = 2 */
export function levelGap(a: Difficulty, b: Difficulty): number {
  return Math.abs(DIFFICULTY_ORDER.indexOf(a) - DIFFICULTY_ORDER.indexOf(b));
}

/** 문항정보표의 예상 난이도를 문항번호 → 난이도 표로 */
export function expectedFromItemInfo(info: ItemInfoTable): Map<number, Difficulty> {
  const map = new Map<number, Difficulty>();
  for (const item of info.items) if (item.expected) map.set(item.no, item.expected);
  return map;
}

export interface AnalyzeItemsInput {
  analysis: ItemAnalysisTable;
  /** 문항번호 → 예상 난이도 (문항정보표 또는 교사 직접 입력) */
  expected: ReadonlyMap<number, Difficulty>;
  /** 백분율 분모. 기본은 문항분석표의 학년 전체 응시자 */
  examinees?: number | null;
  thresholds?: DifficultyThresholds;
}

/**
 * 전체 문항을 분석한다. 협의록에는 mismatchItems 전부를 문항번호 순으로 싣는다
 * (PRD 6-4: 교사가 고르거나 빼는 단계 없음).
 */
export function analyzeItems(input: AnalyzeItemsInput): {
  items: ItemAnalysis[];
  mismatchItems: ItemAnalysis[];
  issues: Issue[];
} {
  const { analysis, expected, thresholds = DEFAULT_DIFFICULTY_THRESHOLDS } = input;
  const examinees = input.examinees ?? analysis.totalExaminees;
  const issues: Issue[] = [];
  if (!examinees) {
    issues.push({ severity: 'error', code: 'EXAMINEES_UNKNOWN', message: '응시자 수를 알 수 없어 답지별 백분율을 계산할 수 없습니다.' });
  }

  const items: ItemAnalysis[] = [];
  for (const row of analysis.items) {
    const answer = row.answer;
    const rate = row.correctRate?.total ?? null;
    if (answer === null || rate === null || row.responses.some((p) => p === null)) {
      issues.push({
        severity: 'error',
        code: 'ITEM_INCOMPLETE',
        message: `${row.no}번 문항의 정답·정답률·답지별 인원 중 읽지 못한 값이 있어 분석에서 뺐습니다.`,
      });
      continue;
    }
    const responses = row.responses.map((p) => p!.total) as unknown as ByChoice<number>;
    const stat = (index: number): ChoiceStat => ({
      choice: (index + 1) as Choice,
      count: responses[index],
      percent: examinees ? percent1(responses[index], examinees) : 0,
    });

    const wrong = responses.map((_, i) => stat(i)).filter((s) => s.choice !== answer);
    const top = wrong.reduce<ChoiceStat | null>((best, s) => (s.count > (best?.count ?? 0) ? s : best), null);

    const exp = expected.get(row.no) ?? null;
    if (exp === null) {
      issues.push({
        severity: 'warning',
        code: 'EXPECTED_MISSING',
        message: `${row.no}번 문항의 예상 난이도가 없어 차이 여부를 판정하지 못했습니다.`,
      });
    }
    const actual = judgeDifficulty(rate, thresholds);

    items.push({
      no: row.no,
      expected: exp,
      correctRate: rate,
      actual,
      isMismatch: exp !== null && exp !== actual,
      levelGap: exp === null ? null : levelGap(exp, actual),
      responses,
      responsePercents: responses.map((_, i) => stat(i).percent) as unknown as ByChoice<number>,
      blank: row.blank?.total ?? 0,
      multiple: row.multiple?.total ?? 0,
      answer,
      topDistractor: top,
      // 반올림 전 비율로 비교: count / examinees >= 10%
      popularDistractors: examinees ? wrong.filter((s) => s.count * 100 >= POPULAR_DISTRACTOR_PERCENT * examinees) : [],
      distractorBeatsAnswer: wrong.some((s) => s.count > responses[answer - 1]),
    });
  }

  items.sort((a, b) => a.no - b.no);
  return { items, mismatchItems: items.filter((i) => i.isMismatch), issues };
}
