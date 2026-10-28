/**
 * 문항정보표 엑셀 파서 (PRD 3-3). 머리글('문항번호', '어려움'·'보통'·'쉬움', '배점', '정답')로 열을 잡고,
 * ○가 찍힌 열로 예상 난이도를 판정한다. 결과 형식·검증은 ../itemInfo.ts 공통(PDF와 같음)
 */
import type { Difficulty } from '../../core/types';
import {
  addItemRow,
  completeCounts,
  DIFFICULTIES,
  emptyItemInfo,
  finalizeItemInfo,
  isCircle,
  readItemInfoHeader,
  readItemRow,
  type ItemInfoRow,
  type ItemInfoTable,
} from '../itemInfo';
import { squash, toInt } from '../text';
import type { ParseResult, ParseWarning } from '../types';
import { findCell, readGrid, rowTexts, type Grid } from './grid';

export function parseItemInfoExcel(data: ArrayBuffer | Uint8Array): ParseResult<ItemInfoTable> {
  const { grid, error } = readGrid(data);
  const warnings: ParseWarning[] = [];
  if (error) warnings.push({ code: 'FILE_UNREADABLE', message: error });
  return { value: parseItemInfoGrid(grid, warnings), warnings };
}

export function parseItemInfoGrid(grid: Grid, warnings: ParseWarning[] = []): ItemInfoTable {
  const table = emptyItemInfo();
  if (grid.length === 0) return table;
  readItemInfoHeader(rowTexts(grid), table, warnings);

  const header = findCell(grid, (t) => t === '문항번호');
  if (!header) {
    warnings.push({ code: 'HEADER_NOT_FOUND', message: "문항정보표에서 '문항번호' 머리글을 찾지 못했습니다." });
    return table;
  }
  // 머리글은 두 줄: '난이도' 아래에 '어려움'·'보통'·'쉬움'. 병합 칸이 펼쳐져 있어 한 난이도가 여러 열일 수 있다
  const headerRows = grid.slice(header.r, header.r + 3);
  const firstColumn = (name: string) => {
    for (const row of headerRows) {
      const c = row.findIndex((v) => squash(v) === name);
      if (c >= 0) return c;
    }
    return -1;
  };
  const pointsCol = firstColumn('배점');
  const answerCol = firstColumn('정답');
  const levelOfColumn = new Map<number, Difficulty>();
  for (const row of headerRows) {
    row.forEach((v, c) => {
      const d = DIFFICULTIES.find((x) => x === squash(v));
      if (d) levelOfColumn.set(c, d);
    });
  }
  const missing = [
    ...(pointsCol < 0 ? ['배점'] : []),
    ...(answerCol < 0 ? ['정답'] : []),
    ...DIFFICULTIES.filter((d) => ![...levelOfColumn.values()].includes(d)),
  ];
  if (missing.length) {
    warnings.push({ code: 'HEADER_NOT_FOUND', message: `문항정보표에서 '${missing.join("'·'")}' 머리글을 찾지 못했습니다.` });
    return table;
  }

  const byNo = new Map<number, ItemInfoRow>();
  for (let r = header.r + 1; r < grid.length; r++) {
    const row = grid[r];
    const label = squash(row[header.c]);
    if (label === '총합계') {
      const counts: Partial<Record<Difficulty, number>> = {};
      for (const [c, d] of levelOfColumn) {
        const n = toInt(row[c]);
        if (n !== null && counts[d] === undefined) counts[d] = n;
      }
      table.reportedCounts = completeCounts(counts);
      continue;
    }
    // 문항번호 칸의 정수 = 문항 행. 바닥글('1 / 2')·쪽을 넘어간 성취기준 줄은 번호 칸이 비어 있다
    const no = toInt(row[header.c]);
    if (no === null || no < 1) continue;
    const levels = [...levelOfColumn].filter(([c]) => isCircle(row[c])).map(([, d]) => d);
    addItemRow(byNo, readItemRow(no, { levels, points: row[pointsCol], answer: row[answerCol] }, warnings), warnings);
  }
  finalizeItemInfo(table, byNo, warnings);
  return table;
}
