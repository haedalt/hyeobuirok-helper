import { kindFromText } from '../format';
import type { FileKind } from '../types';
import { readGrid, rowTexts, type Grid } from './grid';

/** 내용의 제목 문자열로 엑셀 자료 종류를 판별한다 (파일명은 'download-숫자'라 쓸 수 없음). 4종 모두 */
export function detectExcelKindFromGrid(grid: Grid): FileKind | null {
  // 제목은 시트 위쪽에 있다. 본문 칸(예: 문항정보표의 성취기준 글)이 다른 제목과 섞이지 않게 앞부분만 본다
  return kindFromText(rowTexts(grid.slice(0, 12)).join(''));
}

export function detectExcelKind(data: ArrayBuffer | Uint8Array): FileKind | null {
  return detectExcelKindFromGrid(readGrid(data).grid);
}
