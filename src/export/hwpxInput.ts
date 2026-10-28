/** HWPX 내보내기 입력과 사전 검사. 무거운 의존성(JSZip·XML 파서) 없이 화면에서 바로 쓴다 */
import type { CutMode, ImprovementKey, MinutesNumbers } from '../core';

export interface HwpxInput {
  mode: CutMode;
  numbers: MinutesNumbers;
  /** F2 */
  expectedAverage: number | null;
  /** F16~F20 최종 문장 (교사가 고친 것 포함). 줄바꿈은 문단을 나눈다 */
  improvements: Record<ImprovementKey, string | null>;
  /** 양식 제목 '(OO) 교과'와 안건 '(     )교과' 칸. 비우면 원래 글자 */
  subjectHead?: string;
  place?: string;
  attendees?: string;
  /** 채운 글씨를 검정으로 (기본: 양식처럼 빨강) */
  blackText?: boolean;
  /** F14b 답지별 백분율 행 추가 (PRD 9-3, 기본 끔) */
  responsePercents?: boolean;
}

/** 내보내기 전에 빠진 값. 비어 있으면 내보낼 수 있다 */
export function missingForHwpx(input: HwpxInput): string[] {
  const n = input.numbers;
  const missing: string[] = [];
  if (!n.title) missing.push('협의록 제목(학년·교과명)');
  if (input.expectedAverage === null) missing.push('예상평균 (3단계)');
  if (n.actualAverage === null) missing.push('실제 평균 (성적집계표)');
  if (!n.distribution) missing.push('성취수준별 분포 (3단계)');
  else if (n.distribution.mode !== input.mode) missing.push('성취수준별 분포 (분할 방식이 바뀜)');
  if (n.items.length === 0) missing.push('문항 분석 (문항분석표)');
  if (n.items.some((i) => i.expected === null)) missing.push('예상 난이도 (4단계)');
  const names: Record<ImprovementKey, string> = {
    average: '(평균)',
    maxMin: '(최고·최하점)',
    distribution: '(성취수준별 분포 비율 분석)',
    levelA: '(A 수준 분포)',
    itemGap: '(정답률 차이 분석)',
  };
  for (const [key, text] of Object.entries(input.improvements) as [ImprovementKey, string | null][]) {
    if (text === null) missing.push(`개선방안 ${names[key]} (5단계)`);
  }
  return missing;
}

/** '2026학년도_2학기_1차_정기시험_결과분석_협의록_화학_반응의_세계.hwpx' */
export function hwpxFileName(meta: { schoolYear?: number | null; semester?: number | null; examName?: string | null }, subject: string): string {
  const safe = (s: string) => s.trim().replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_');
  const year = meta.schoolYear ?? 2026;
  const semester = meta.semester ?? 2;
  const exam = safe(meta.examName ?? '1차 정기시험');
  return `${year}학년도_${semester}학기_${exam}_결과분석_협의록_${safe(subject) || '교과'}.hwpx`;
}
