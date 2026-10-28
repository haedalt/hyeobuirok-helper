/**
 * 성적집계표 공통 (PRD 3-4): 결과 형식과 과목 열 찾기. 엑셀(excel/scoreSummary.ts)과 PDF(pdf/scoreSummary.ts) 파서가 함께 쓴다.
 */
import { splitSubject, squash } from './text';
import type { ExamMeta, ParseWarning } from './types';

export interface SubjectScoreSummary {
  /** 학년도·학기·학년·고사 + 찾은 열의 교과목 */
  meta: ExamMeta;
  /** 표에 있는 모든 과목 열 머리글. 과목을 못 찾았을 때 고르게 할 목록 */
  subjects: string[];
  /** 찾은 열의 머리글. 못 찾으면 null */
  subject: string | null;
  /** 과목평균 → F3 */
  average: number | null;
  /** 최고점 → F17 */
  maxScore: number | null;
  /** 최하점 */
  minScore: number | null;
  /** 최하점(전입생제외) → F17 */
  minScoreExcludingTransfers: number | null;
  examinees: number | null;
  absentees: number | null;
  /** 학반별 평균. [0] = 1반. v1 미사용 */
  classAverages: (number | null)[];
}

export function emptyScoreSummary(meta: ExamMeta): SubjectScoreSummary {
  return {
    meta,
    subjects: [],
    subject: null,
    average: null,
    maxScore: null,
    minScore: null,
    minScoreExcludingTransfers: null,
    examinees: null,
    absentees: null,
    classAverages: [],
  };
}

/**
 * 교과명으로 과목 열 찾기: 공백·줄바꿈을 지우고 교과군 접두어('과학:')·학점('(3)')을 뗀 이름이 같은 열.
 * 정확히 같은 열이 없으면, 이름을 포함하는 열이 하나뿐일 때 그 열. 못 찾으면 -1
 */
export function matchSubject(headers: string[], subjectName: string): number {
  const key = (s: string) => squash(splitSubject(squash(s)).name);
  const target = key(subjectName);
  if (!target) return -1;
  const exact = headers.flatMap((h, i) => (key(h) === target ? [i] : []));
  if (exact.length === 1) return exact[0];
  const partial = headers.flatMap((h, i) => (key(h).includes(target) ? [i] : []));
  return partial.length === 1 ? partial[0] : -1;
}

/** 찾은 열의 머리글로 교과 정보를 채운다 */
export function applySubject(summary: SubjectScoreSummary, header: string): void {
  summary.subject = header;
  const { name, credits } = splitSubject(header);
  summary.meta = { ...summary.meta, subjectRaw: header, subjectName: name, credits };
}

export function subjectNotFound(subjectName: string): ParseWarning {
  return { code: 'SUBJECT_NOT_FOUND', message: `성적집계표에서 '${subjectName}' 과목 열을 찾지 못했습니다.` };
}

/** 꼭 있어야 하는 값이 비었으면 경고 */
export function requireValue(value: number | null, subject: string, field: string, warnings: ParseWarning[]): number | null {
  if (value === null) warnings.push({ code: 'VALUE_MISSING', message: `성적집계표 ${subject} '${field}' 값이 없습니다.` });
  return value;
}
