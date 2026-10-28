/** 정기시험 도수분포표 파서 (PRD 3-1) */
import { missingMetaFields, parseExamMeta, squash, toInt, toNumber } from '../text';
import type { ExamMeta, ParseResult, ParseWarning } from '../types';
import { findCell, isEmpty, readGrid, rowTexts, type Grid } from './grid';

export interface FrequencyBin {
  /** 원문 ('90이상 ~ 100이하') */
  label: string;
  lower: number;
  upper: number;
  /** '이하'면 true, '미만'이면 false */
  upperInclusive: boolean;
  /** 강의실별 인원 (classes 순서). 못 읽으면 null */
  counts: (number | null)[];
  /** '합 계' 열 값 ('7 명' → 7) */
  reportedTotal: number | null;
}

export interface ClassStats {
  /** 강의실(반) 이름 ('3A') */
  name: string;
  examinees: number | null;
  absentees: number | null;
  average: number | null;
}

export interface FrequencyTable {
  meta: ExamMeta;
  /** '급간 : 10' → 10 */
  binSize: number | null;
  classes: ClassStats[];
  /** 표 순서대로 (위 급간부터) */
  bins: FrequencyBin[];
}

const BIN_RE = /^(\d+)이상~(\d+)(미만|이하)$/;

export function parseFrequencyTable(data: ArrayBuffer | Uint8Array): ParseResult<FrequencyTable> {
  const { grid, error } = readGrid(data);
  const warnings: ParseWarning[] = [];
  if (error) warnings.push({ code: 'FILE_UNREADABLE', message: error });
  return { value: parseFrequencyGrid(grid, warnings), warnings };
}

export function parseFrequencyGrid(grid: Grid, warnings: ParseWarning[] = []): FrequencyTable {
  const lines = rowTexts(grid);
  const meta = parseExamMeta(lines);
  const missing = missingMetaFields(meta);
  if (missing.length) {
    warnings.push({ code: 'META_MISSING', message: `도수분포표 머리글에서 ${missing.join('·')}을(를) 읽지 못했습니다.` });
  }

  let binSize: number | null = null;
  for (const line of lines) {
    const m = /급간\s*:\s*(\d+)/.exec(line);
    if (m) {
      binSize = Number(m[1]);
      break;
    }
  }
  if (binSize === null) warnings.push({ code: 'BIN_SIZE_MISSING', message: "도수분포표에서 '급간 :' 값을 읽지 못했습니다." });

  const table: FrequencyTable = { meta, binSize, classes: [], bins: [] };

  const header = findCell(grid, (t) => t === '강의실점수');
  if (!header) {
    warnings.push({ code: 'HEADER_NOT_FOUND', message: "도수분포표에서 '강의실 점수' 머리글을 찾지 못했습니다." });
    return table;
  }
  const labelCol = header.c;
  const label = (r: number) => squash(grid[r][labelCol]);

  const binRows: number[] = [];
  for (let r = header.r + 1; r < grid.length; r++) {
    if (BIN_RE.test(label(r))) binRows.push(r);
  }
  if (binRows.length === 0) {
    warnings.push({ code: 'BINS_NOT_FOUND', message: "도수분포표에서 'N이상 ~ M미만' 급간 행을 찾지 못했습니다." });
    return table;
  }

  // 반 이름 행 = 첫 급간 행 바로 위의 내용 있는 행. 그 위의 숫자 코드 행(20301 …)은 무시한다.
  let nameRow = -1;
  for (let r = binRows[0] - 1; r >= header.r; r--) {
    if (!isEmpty(grid[r][labelCol + 1] ?? null)) {
      nameRow = r;
      break;
    }
  }
  if (nameRow < 0) {
    warnings.push({ code: 'CLASSES_NOT_FOUND', message: '도수분포표에서 강의실(반) 이름 행을 찾지 못했습니다.' });
    return table;
  }

  const classCols: number[] = [];
  let totalCol = -1;
  for (let c = labelCol + 1; c < grid[nameRow].length; c++) {
    const name = squash(grid[nameRow][c]);
    if (name === '합계') {
      totalCol = c;
      break;
    }
    if (name === '') continue;
    // 병합 셀을 펼친 탓에 같은 이름이 옆 칸에 반복되면 건너뛴다
    if (classCols.length && squash(grid[nameRow][classCols[classCols.length - 1]]) === name) continue;
    classCols.push(c);
  }

  const findStatRow = (name: string) => {
    for (let r = header.r + 1; r < grid.length; r++) if (label(r) === name) return r;
    warnings.push({ code: 'ROW_NOT_FOUND', message: `도수분포표에서 '${name}' 행을 찾지 못했습니다.` });
    return -1;
  };
  const examineeRow = findStatRow('응시자');
  const absenteeRow = findStatRow('결시자');
  const averageRow = findStatRow('평균');

  const readCell = (r: number, c: number, field: string, read: (v: unknown) => number | null) => {
    if (r < 0) return null;
    const v = read(grid[r][c]);
    if (v === null) {
      warnings.push({ code: 'CELL_UNREADABLE', message: `도수분포표 ${field} 칸 값('${grid[r][c] ?? ''}')을 읽지 못했습니다.` });
    }
    return v;
  };

  table.classes = classCols.map((c) => {
    const name = String(grid[nameRow][c]).trim();
    return {
      name,
      examinees: readCell(examineeRow, c, `${name} 응시자`, toInt),
      absentees: readCell(absenteeRow, c, `${name} 결시자`, toInt),
      average: readCell(averageRow, c, `${name} 평균`, toNumber),
    };
  });

  table.bins = binRows.map((r) => {
    const m = BIN_RE.exec(label(r))!;
    const binLabel = String(grid[r][labelCol]).trim();
    const counts = classCols.map((c, i) => readCell(r, c, `${binLabel} ${table.classes[i].name}`, toInt));
    const reportedTotal = totalCol >= 0 ? readCell(r, totalCol, `${binLabel} 합계`, toInt) : null;
    const sum = sumAll(counts);
    if (reportedTotal !== null && sum !== null && sum !== reportedTotal) {
      warnings.push({
        code: 'BIN_TOTAL_MISMATCH',
        message: `도수분포표 '${binLabel}' 반별 인원 합(${sum})이 합계(${reportedTotal})와 다릅니다.`,
      });
    }
    return { label: binLabel, lower: Number(m[1]), upper: Number(m[2]), upperInclusive: m[3] === '이하', counts, reportedTotal };
  });

  table.classes.forEach((cls, i) => {
    const sum = sumAll(table.bins.map((b) => b.counts[i]));
    if (cls.examinees !== null && sum !== null && sum !== cls.examinees) {
      warnings.push({
        code: 'CLASS_TOTAL_MISMATCH',
        message: `도수분포표 ${cls.name} 급간별 인원 합(${sum})이 응시자 수(${cls.examinees})와 다릅니다.`,
      });
    }
  });

  return table;
}

/** 하나라도 null이면 null */
function sumAll(values: (number | null)[]): number | null {
  let sum = 0;
  for (const v of values) {
    if (v === null) return null;
    sum += v;
  }
  return sum;
}
