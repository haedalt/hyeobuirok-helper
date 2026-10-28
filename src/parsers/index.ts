/**
 * 파서 입구. 문항정보표·성적집계표는 엑셀(권장)과 PDF 모두 받으며, 형식은 내용으로 스스로 구분한다.
 * PDF 파서(pdf.js)는 PDF를 받았을 때만 불러온다(엑셀만 쓰면 내려받지 않음).
 */
import { parseItemInfoExcel } from './excel/itemInfo';
import { parseScoreSummaryExcel } from './excel/scoreSummary';
import { isPdf } from './format';
import type { ItemInfoTable } from './itemInfo';
import type { SubjectScoreSummary } from './scoreSummary';
import type { ParseResult } from './types';

export * from './types';
export { detectFileKind, type DetectResult } from './detect';
export { detectExcelKind } from './excel/detect';
export { parseFrequencyTable, type ClassStats, type FrequencyBin, type FrequencyTable } from './excel/frequencyTable';
export { parseItemAnalysis, type ItemAnalysisTable, type ItemRow } from './excel/itemAnalysis';
export { countDifficulties, type ItemInfoRow, type ItemInfoTable } from './itemInfo';
export type { SubjectScoreSummary } from './scoreSummary';
export { isPdf } from './format';

/** 문항정보표 (엑셀 또는 PDF) */
export async function parseItemInfo(data: ArrayBuffer | Uint8Array): Promise<ParseResult<ItemInfoTable>> {
  if (isPdf(data)) return (await import('./pdf/itemInfo')).parseItemInfoPdf(data);
  return parseItemInfoExcel(data);
}

/**
 * 성적집계표 (엑셀 또는 PDF). 학년의 모든 과목 중 교과명에 맞는 열만 읽는다.
 * @param subjectName 다른 파일에서 읽은 교과명. 원문('과학:화학 반응의 세계(3)')이나 정리본 모두 가능
 */
export async function parseScoreSummary(
  data: ArrayBuffer | Uint8Array,
  subjectName: string,
): Promise<ParseResult<SubjectScoreSummary>> {
  if (isPdf(data)) return (await import('./pdf/scoreSummary')).parseScoreSummaryPdf(data, subjectName);
  return parseScoreSummaryExcel(data, subjectName);
}
