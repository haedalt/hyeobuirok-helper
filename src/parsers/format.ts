import type { FileKind } from './types';

/** 파일 바이트가 PDF인가 ('%PDF'로 시작). 아니면 엑셀로 읽어 본다 */
export function isPdf(data: ArrayBuffer | Uint8Array): boolean {
  const b = data instanceof Uint8Array ? data : new Uint8Array(data);
  return b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46;
}

/** 문서 제목 글자로 4종 판별 (형식 공통). 제목은 '문 항 정 보 표'처럼 떨어져 있어 공백을 지우고 비교한다 */
export function kindFromText(text: string): FileKind | null {
  const t = text.replace(/\s+/g, '');
  if (t.includes('문항정보표')) return 'itemInfo';
  if (t.includes('성적집계표')) return 'scoreSummary';
  if (t.includes('도수분포표')) return 'frequency';
  if (t.includes('문항분석표')) return 'itemAnalysis';
  return null;
}
