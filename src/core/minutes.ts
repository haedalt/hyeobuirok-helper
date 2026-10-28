/** 파서 결과 → 협의록 수치(F1, F3~F15, F17 근거)를 한 번에 계산 */
import { checkExaminees, checkItemsMatch, checkSameExam, type UploadedFiles } from './consistency';
import { estimatedDistribution, fixedDistribution } from './distribution';
import { analyzeItems, expectedFromItemInfo } from './items';
import { computeScores } from './scores';
import type { ByLevel, CutMode, CutScores, Difficulty, DifficultyThresholds, Issue, MinutesNumbers } from './types';

export interface MinutesInput {
  mode: CutMode;
  files: UploadedFiles;
  /** 추정분할일 때 교사 입력 */
  estimated?: { cutScores: CutScores; counts: ByLevel<number> };
  /** 문항정보표 대신 교사가 직접 넣은 예상 난이도 (스캔본 PDF 등) */
  expectedOverride?: ReadonlyMap<number, Difficulty>;
  /** 1단계에서 교사가 고친 교과명 */
  subjectName?: string;
  thresholds?: DifficultyThresholds;
}

export function computeMinutesNumbers(input: MinutesInput): { value: MinutesNumbers; issues: Issue[] } {
  const { mode, files } = input;
  const issues: Issue[] = [...checkSameExam(files), ...checkExaminees(files, mode)];
  if (files.itemInfo && files.itemAnalysis) issues.push(...checkItemsMatch(files.itemInfo, files.itemAnalysis));

  const scores = computeScores(files.scoreSummary ?? null, mode === 'fixed' ? (files.frequency ?? null) : null);
  issues.push(...scores.issues);

  const examinees = files.scoreSummary?.examinees ?? files.itemAnalysis?.totalExaminees ?? null;

  let distribution: MinutesNumbers['distribution'] = null;
  if (mode === 'fixed') {
    if (files.frequency) {
      const result = fixedDistribution(files.frequency);
      distribution = result.value;
      issues.push(...result.issues);
    } else {
      issues.push({ severity: 'error', code: 'FREQUENCY_MISSING', message: '고정분할에는 도수분포표가 필요합니다.' });
    }
  } else if (input.estimated) {
    const result = estimatedDistribution(input.estimated.cutScores, input.estimated.counts, examinees);
    distribution = result.value;
    issues.push(...result.issues);
  } else {
    issues.push({ severity: 'error', code: 'ESTIMATED_INPUT_MISSING', message: '추정분할에는 분할점수와 수준별 인원 입력이 필요합니다.' });
  }

  let items: MinutesNumbers['items'] = [];
  let mismatchItems: MinutesNumbers['mismatchItems'] = [];
  if (files.itemAnalysis) {
    const expected = input.expectedOverride ?? (files.itemInfo ? expectedFromItemInfo(files.itemInfo) : new Map());
    const result = analyzeItems({ analysis: files.itemAnalysis, expected, thresholds: input.thresholds });
    items = result.items;
    mismatchItems = result.mismatchItems;
    issues.push(...result.issues);
  } else {
    issues.push({ severity: 'error', code: 'ITEM_ANALYSIS_MISSING', message: '문항분석표가 필요합니다.' });
  }

  return {
    value: {
      title: buildTitle(files, input.subjectName),
      actualAverage: scores.value.actualAverage,
      weightedAverage: scores.value.weightedAverage,
      maxScore: scores.value.maxScore,
      minScore: scores.value.minScore,
      examinees,
      distribution,
      items,
      mismatchItems,
    },
    issues,
  };
}

/** F1 '2학년 화학 반응의 세계'. 교과명은 엑셀(띄어쓰기 보존) 값을 우선 */
function buildTitle(files: UploadedFiles, subjectOverride?: string): string | null {
  const metas = [files.frequency, files.itemAnalysis, files.itemInfo, files.scoreSummary]
    .filter((f) => f != null)
    .map((f) => f.meta);
  const grade = metas.find((m) => m.grade !== null)?.grade ?? null;
  const subject = subjectOverride?.trim() || (metas.find((m) => m.subjectName)?.subjectName ?? null);
  if (grade === null || !subject) return null;
  return `${grade}학년 ${subject}`;
}
