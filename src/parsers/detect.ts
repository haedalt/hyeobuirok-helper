import { detectExcelKind } from './excel/detect';
import { isPdf, kindFromText } from './format';
import type { FileKind } from './types';

export interface DetectResult {
  kind: FileKind | null;
  format: 'excel' | 'pdf';
  /** PDF인데 글자가 하나도 없음 (스캔본 등) */
  noText: boolean;
}

/**
 * 파일 내용의 제목 문자열로 4종 자료를 판별한다. 파일명('download-숫자')은 쓰지 않는다.
 * 엑셀·PDF 어느 형식이든 4종 모두 판별한다. 제목은 '문 항 정 보 표'처럼 글자가 떨어져 있어 공백을 지우고 비교한다.
 */
export async function detectFileKind(data: ArrayBuffer | Uint8Array): Promise<DetectResult> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (!isPdf(bytes)) return { kind: detectExcelKind(bytes), format: 'excel', noText: false };

  const { extractTextItems } = await import('./pdf/textItems');
  const { items } = await extractTextItems(bytes);
  if (items.length === 0) return { kind: null, format: 'pdf', noText: true };
  return { kind: kindFromText(items.map((i) => i.str).join('')), format: 'pdf', noText: false };
}
