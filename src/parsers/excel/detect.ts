import type { ExcelKind } from '../types';
import { findCell, readGrid, type Grid } from './grid';

/** 내용의 제목 문자열로 엑셀 자료 종류를 판별한다 (파일명은 'download-숫자'라 쓸 수 없음) */
export function detectExcelKindFromGrid(grid: Grid): ExcelKind | null {
  if (findCell(grid, (t) => t.includes('도수분포표'))) return 'frequency';
  if (findCell(grid, (t) => t.includes('문항분석표'))) return 'itemAnalysis';
  return null;
}

export function detectExcelKind(data: ArrayBuffer | Uint8Array): ExcelKind | null {
  return detectExcelKindFromGrid(readGrid(data).grid);
}
