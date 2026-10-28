import * as XLSX from 'xlsx';
import { squash } from '../text';

export type CellValue = string | number | null;

/** 시트 내용을 2차원 배열로. 행·열 번호는 시트의 사용 범위 기준(0부터)이며 의미 없다 */
export type Grid = CellValue[][];

/**
 * 엑셀 파일의 첫 시트를 읽는다. 병합 셀은 왼쪽 위 값으로 범위 전체를 채운다.
 * (나이스 문항분석표는 같은 값이 이어지는 무표기·중복표기 칸을 세로로 병합해 내보낸다.)
 */
export function readGrid(data: ArrayBuffer | Uint8Array): { grid: Grid; error: string | null } {
  let ws: XLSX.WorkSheet | undefined;
  try {
    const wb = XLSX.read(data, { type: 'array' });
    ws = wb.Sheets[wb.SheetNames[0]];
  } catch (e) {
    return { grid: [], error: `엑셀 파일을 열 수 없습니다: ${e instanceof Error ? e.message : String(e)}` };
  }
  if (!ws || !ws['!ref']) return { grid: [], error: '엑셀 파일에 내용이 없습니다.' };

  const range = XLSX.utils.decode_range(ws['!ref']);
  const grid: Grid = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    const row: CellValue[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined;
      const v = cell?.v;
      row.push(typeof v === 'number' || typeof v === 'string' ? v : v == null ? null : String(v));
    }
    grid.push(row);
  }

  for (const m of ws['!merges'] ?? []) {
    const value = grid[m.s.r - range.s.r]?.[m.s.c - range.s.c] ?? null;
    if (value === null) continue;
    for (let r = m.s.r; r <= m.e.r; r++) {
      for (let c = m.s.c; c <= m.e.c; c++) {
        const row = grid[r - range.s.r];
        if (row && row[c - range.s.c] === null) row[c - range.s.c] = value;
      }
    }
  }
  return { grid, error: null };
}

/** 각 행의 비어 있지 않은 셀을 두 칸 공백으로 이어 붙인 문자열 */
export function rowTexts(grid: Grid): string[] {
  return grid.map((row) =>
    row
      .filter((v) => v !== null && String(v).trim() !== '')
      .map((v) => String(v).trim())
      .join('  '),
  );
}

/** 공백을 지운 텍스트가 조건을 만족하는 첫 셀 */
export function findCell(grid: Grid, test: (squashed: string) => boolean): { r: number; c: number } | null {
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (test(squash(grid[r][c]))) return { r, c };
    }
  }
  return null;
}

export function isEmpty(value: CellValue): boolean {
  return value === null || String(value).trim() === '';
}
