/** 평균·최고·최하점 (F3, F17, PRD 3-4·6-3) */
import type { FrequencyTable, SubjectScoreSummary } from '../parsers';
import { AVERAGE_TOLERANCE } from './constants';
import type { Issue } from './types';

/** 도수분포표 강의실 평균의 응시자 가중평균. 값이 하나라도 없으면 null */
export function weightedClassAverage(table: FrequencyTable): number | null {
  let sum = 0;
  let count = 0;
  for (const c of table.classes) {
    if (c.average === null || c.examinees === null) return null;
    sum += c.average * c.examinees;
    count += c.examinees;
  }
  return count > 0 ? sum / count : null;
}

export interface ScoreFigures {
  /** F3 실제 평균 = 성적집계표 과목평균 (고정·추정 모두) */
  actualAverage: number | null;
  /** 고정분할 교차 검증용 가중평균 (반올림 전) */
  weightedAverage: number | null;
  maxScore: number | null;
  /** 최하점(전입생제외) */
  minScore: number | null;
}

/**
 * @param frequency 고정분할일 때만 넘긴다. 가중평균이 과목평균과 0.1점 넘게 다르면 경고만 띄운다
 */
export function computeScores(
  summary: SubjectScoreSummary | null,
  frequency: FrequencyTable | null = null,
): { value: ScoreFigures; issues: Issue[] } {
  const issues: Issue[] = [];
  const value: ScoreFigures = {
    actualAverage: summary?.average ?? null,
    weightedAverage: frequency ? weightedClassAverage(frequency) : null,
    maxScore: summary?.maxScore ?? null,
    minScore: summary?.minScoreExcludingTransfers ?? null,
  };
  if (value.actualAverage === null) {
    issues.push({ severity: 'error', code: 'AVERAGE_MISSING', message: '성적집계표에서 과목평균을 얻지 못했습니다. 직접 입력해 주세요.' });
  }
  if (value.actualAverage !== null && value.weightedAverage !== null) {
    const diff = Math.abs(value.actualAverage - value.weightedAverage);
    if (diff > AVERAGE_TOLERANCE + 1e-9) {
      issues.push({
        severity: 'warning',
        code: 'AVERAGE_MISMATCH',
        message: `성적집계표 과목평균(${value.actualAverage}점)과 도수분포표 반별 평균의 가중평균(${value.weightedAverage.toFixed(1)}점)이 ${diff.toFixed(1)}점 다릅니다.`,
      });
    }
  }
  return { value, issues };
}
