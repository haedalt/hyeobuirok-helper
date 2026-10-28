import { detectExcelKind } from './excel/detect';
import { extractTextItems } from './pdf/textItems';
import type { FileKind } from './types';

export interface DetectResult {
  kind: FileKind | null;
  /** PDF인데 글자가 하나도 없음 (스캔본 등) */
  noText: boolean;
}

function isPdf(bytes: Uint8Array): boolean {
  // '%PDF'
  return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
}

/**
 * 파일 내용의 제목 문자열로 4종 자료를 판별한다. 파일명('download-숫자')은 쓰지 않는다.
 * PDF 제목은 '문 항 정 보 표'처럼 글자가 떨어져 있어 공백을 지우고 비교한다.
 */
export async function detectFileKind(data: ArrayBuffer | Uint8Array): Promise<DetectResult> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (!isPdf(bytes)) return { kind: detectExcelKind(bytes), noText: false };

  const { items } = await extractTextItems(bytes);
  if (items.length === 0) return { kind: null, noText: true };
  const text = items.map((i) => i.str).join('').replace(/\s+/g, '');
  if (text.includes('문항정보표')) return { kind: 'itemInfo', noText: false };
  if (text.includes('성적집계표')) return { kind: 'scoreSummary', noText: false };
  return { kind: null, noText: false };
}
