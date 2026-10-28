/**
 * 성적집계표 엑셀 파서 (PRD 3-4). 왼쪽 위 '교과목' 칸의 행이 과목 머리글, 같은 열이 행 이름(1~10반, 응시자…).
 * 교과명으로 열을 찾아 그 열만 읽는다. 결과 형식·과목 찾기는 ../scoreSummary.ts 공통(PDF와 같음)
 */
import {
  applySubject,
  emptyScoreSummary,
  matchSubject,
  requireValue,
  subjectNotFound,
  type SubjectScoreSummary,
} from '../scoreSummary';
import { parseExamMeta, squash, toInt, toNumber } from '../text';
import type { ParseResult, ParseWarning } from '../types';
import { findCell, isEmpty, readGrid, rowTexts, type CellValue, type Grid } from './grid';

/**
 * @param subjectName 다른 파일에서 읽은 교과명. 원문('과학:화학 반응의 세계(3)')이나 정리본('화학 반응의 세계') 모두 가능
 */
export function parseScoreSummaryExcel(data: ArrayBuffer | Uint8Array, subjectName: string): ParseResult<SubjectScoreSummary> {
  const { grid, error } = readGrid(data);
  const warnings: ParseWarning[] = [];
  if (error) warnings.push({ code: 'FILE_UNREADABLE', message: error });
  return { value: parseScoreSummaryGrid(grid, subjectName, warnings), warnings };
}

export function parseScoreSummaryGrid(grid: Grid, subjectName: string, warnings: ParseWarning[] = []): SubjectScoreSummary {
  const summary = emptyScoreSummary(parseExamMeta(rowTexts(grid)));
  if (grid.length === 0) return summary;

  // '         교과목\n반' 칸 (대각선으로 나뉜 왼쪽 위 칸)
  const corner = findCell(grid, (t) => t.startsWith('교과목'));
  if (!corner) {
    warnings.push({ code: 'HEADER_NOT_FOUND', message: "성적집계표에서 '교과목' 칸을 찾지 못했습니다." });
    return summary;
  }
  const headerRow = grid[corner.r];
  const columns: { header: string; col: number }[] = [];
  headerRow.forEach((v, c) => {
    if (c <= corner.c || isEmpty(v)) return;
    // 병합 칸을 펼친 탓에 같은 머리글이 옆 칸에 반복되면 첫 칸만 쓴다
    if (headerRow[c - 1] === v) return;
    columns.push({ header: String(v).replace(/\s*\n\s*/g, '').trim(), col: c });
  });
  summary.subjects = columns.map((c) => c.header);
  const column = columns[matchSubject(summary.subjects, subjectName)];
  if (!column) {
    warnings.push(subjectNotFound(subjectName));
    return summary;
  }
  applySubject(summary, column.header);

  // 행 이름: 같은 열(교과목 칸 열)의 아래쪽
  const rowOf = new Map<string, number>();
  const classRows: { no: number; r: number }[] = [];
  for (let r = corner.r + 1; r < grid.length; r++) {
    const label = squash(grid[r][corner.c]);
    if (!label) continue;
    const no = toInt(grid[r][corner.c]);
    if (no !== null && no >= 1 && !rowOf.has('과목평균')) classRows.push({ no, r });
    else if (!rowOf.has(label)) rowOf.set(label, r);
  }

  const valueAt = (label: string, read: (v: CellValue) => number | null): number | null => {
    const r = rowOf.get(label);
    if (r === undefined) {
      warnings.push({ code: 'ROW_NOT_FOUND', message: `성적집계표에서 '${label}' 행을 찾지 못했습니다.` });
      return null;
    }
    return readCell(grid[r][column.col], column.header, label, read, warnings);
  };
  const required = (value: number | null, field: string) => requireValue(value, column.header, field, warnings);

  summary.average = required(valueAt('과목평균', toNumber), '과목평균');
  summary.maxScore = required(valueAt('최고점', toNumber), '최고점');
  summary.minScore = required(valueAt('최하점', toNumber), '최하점');
  summary.minScoreExcludingTransfers = required(valueAt('최하점(전입생제외)', toNumber), '최하점(전입생제외)');
  summary.examinees = required(valueAt('응시자', toInt), '응시자');
  summary.absentees = required(valueAt('결시자', toInt), '결시자');

  for (const { no, r } of classRows.sort((a, b) => a.no - b.no)) {
    summary.classAverages[no - 1] = readCell(grid[r][column.col], column.header, `${no}반 평균`, toNumber, warnings);
  }
  for (let i = 0; i < summary.classAverages.length; i++) summary.classAverages[i] ??= null;
  return summary;
}

/** 빈 칸은 null, '＊' 표시는 떼고 읽는다 */
function readCell(
  value: CellValue,
  subject: string,
  field: string,
  read: (v: CellValue) => number | null,
  warnings: ParseWarning[],
): number | null {
  if (isEmpty(value)) return null;
  const cleaned = typeof value === 'string' ? value.replace(/[*＊]/g, '') : value;
  const n = read(cleaned);
  if (n === null) warnings.push({ code: 'CELL_UNREADABLE', message: `성적집계표 ${subject} '${field}' 값('${value}')을 읽지 못했습니다.` });
  return n;
}
