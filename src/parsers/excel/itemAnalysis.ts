/** 정기시험 문항분석표 파서 (PRD 3-2). 괄호 안 값이 학과(학년) 전체 수치다. */
import type { ByChoice, Choice } from '../../core/types';
import { missingMetaFields, parseExamMeta, parsePair, squash, toInt } from '../text';
import type { ExamMeta, ParseResult, ParseWarning, ValuePair } from '../types';
import { isEmpty, readGrid, rowTexts, type CellValue, type Grid } from './grid';

export interface ItemRow {
  no: number;
  /** 정답 1~5. 못 읽으면 null */
  answer: Choice | null;
  /** 답지 ①~⑤ 응답 인원 (강의실 / 학과 전체) */
  responses: ByChoice<ValuePair | null>;
  /** 정답률 % (강의실 / 학과 전체) */
  correctRate: ValuePair | null;
  /** 무표기 인원. 빈칸이면 0 */
  blank: ValuePair | null;
  /** 중복표기 인원. 빈칸이면 0 */
  multiple: ValuePair | null;
  /** '합계' 열: 강의실 응시 인원 */
  roomTotal: number | null;
}

export interface ItemAnalysisTable {
  meta: ExamMeta;
  /** 파일의 강의실 ('3A') */
  room: string | null;
  /** 문항번호 순 */
  items: ItemRow[];
  /** 학과 전체 응시자 = 문항별 (응답 합 + 무표기 + 중복표기)의 최빈값 */
  totalExaminees: number | null;
}

interface ColumnMap {
  no: number;
  choices: number[];
  answer: number;
  rate: number;
  blank: number;
  multiple: number;
  roomTotal: number;
}

const ZERO: ValuePair = { room: 0, total: 0 };

export function parseItemAnalysis(data: ArrayBuffer | Uint8Array): ParseResult<ItemAnalysisTable> {
  const { grid, error } = readGrid(data);
  const warnings: ParseWarning[] = [];
  if (error) warnings.push({ code: 'FILE_UNREADABLE', message: error });
  return { value: parseItemAnalysisGrid(grid, warnings), warnings };
}

export function parseItemAnalysisGrid(grid: Grid, warnings: ParseWarning[] = []): ItemAnalysisTable {
  const lines = rowTexts(grid);
  const meta = parseExamMeta(lines);
  const missing = missingMetaFields(meta);
  if (missing.length) {
    warnings.push({ code: 'META_MISSING', message: `문항분석표 머리글에서 ${missing.join('·')}을(를) 읽지 못했습니다.` });
  }
  let room: string | null = null;
  for (const line of lines) {
    const m = /(\S+)\s*강의실/.exec(line);
    if (m) {
      room = m[1];
      break;
    }
  }

  const byNo = new Map<number, ItemRow>();
  let columns: ColumnMap | null = null;

  // 페이지가 나뉘면 머리글 행이 반복되므로, 머리글을 만날 때마다 열 위치를 다시 잡는다.
  for (const row of grid) {
    const mapped = mapHeader(row);
    if (mapped) {
      columns = mapped;
      continue;
    }
    if (!columns) continue;
    const no = toInt(row[columns.no]);
    if (no === null || no < 1) continue; // 바닥글('1 / 2 OO고등학교')·빈 행
    const responses = columns.choices.map((c) => (c < 0 ? null : parsePair(row[c])));
    if (responses.every((p) => p === null)) continue; // 문항 행이 아님

    if (byNo.has(no)) {
      warnings.push({ code: 'DUPLICATE_ITEM', message: `문항분석표에 ${no}번 문항이 두 번 있습니다. 처음 것을 사용합니다.` });
      continue;
    }
    byNo.set(no, readItem(no, row, columns, responses as unknown as ByChoice<ValuePair | null>, warnings));
  }

  if (!columns) {
    warnings.push({ code: 'HEADER_NOT_FOUND', message: "문항분석표에서 '정답'·'정답률(%)' 머리글 행을 찾지 못했습니다." });
  }

  const items = [...byNo.values()].sort((a, b) => a.no - b.no);
  if (columns && items.length === 0) {
    warnings.push({ code: 'ITEMS_NOT_FOUND', message: '문항분석표에서 문항 행을 찾지 못했습니다.' });
  }
  const maxNo = items.length ? items[items.length - 1].no : 0;
  const missingNos: number[] = [];
  for (let n = 1; n <= maxNo; n++) if (!byNo.has(n)) missingNos.push(n);
  if (missingNos.length) {
    warnings.push({ code: 'MISSING_ITEM', message: `문항분석표에 ${missingNos.join(', ')}번 문항이 없습니다.` });
  }

  const totalExaminees = checkTotals(items, warnings);
  return { meta, room, items, totalExaminees };
}

function mapHeader(row: CellValue[]): ColumnMap | null {
  const texts = row.map(squash);
  const first = (test: (t: string) => boolean) => texts.findIndex(test);
  const answer = first((t) => t === '정답');
  const rate = first((t) => t.startsWith('정답률'));
  const no = first((t) => t.includes('문항번호'));
  if (answer < 0 || rate < 0 || no < 0) return null;
  return {
    no,
    choices: [1, 2, 3, 4, 5].map((n) => first((t) => t === `${n}번`)),
    answer,
    rate,
    blank: first((t) => t === '무표기'),
    multiple: first((t) => t === '중복표기'),
    roomTotal: first((t) => t === '합계'),
  };
}

function readItem(
  no: number,
  row: CellValue[],
  columns: ColumnMap,
  responses: ByChoice<ValuePair | null>,
  warnings: ParseWarning[],
): ItemRow {
  const warn = (field: string, value: CellValue | undefined) =>
    warnings.push({ code: 'CELL_UNREADABLE', message: `문항분석표 ${no}번 ${field} 값('${value ?? ''}')을 읽지 못했습니다.` });

  responses.forEach((p, i) => {
    if (p === null) warn(`${i + 1}번 답지`, row[columns.choices[i]]);
  });

  const answerValue = toInt(row[columns.answer]);
  const answer = answerValue !== null && answerValue >= 1 && answerValue <= 5 ? (answerValue as Choice) : null;
  if (answer === null) warn('정답', row[columns.answer]);

  const correctRate = parsePair(row[columns.rate]);
  if (correctRate === null) warn('정답률', row[columns.rate]);

  // 무표기·중복표기: 빈칸이면 0, 내용이 있는데 못 읽으면 null
  const optionalPair = (col: number, field: string): ValuePair | null => {
    if (col < 0 || isEmpty(row[col])) return ZERO;
    const p = parsePair(row[col]);
    if (p === null) warn(field, row[col]);
    return p;
  };

  return {
    no,
    answer,
    responses,
    correctRate,
    blank: optionalPair(columns.blank, '무표기'),
    multiple: optionalPair(columns.multiple, '중복표기'),
    roomTotal: columns.roomTotal < 0 ? null : toInt(row[columns.roomTotal]),
  };
}

/** 문항별 응답 합 교차 검증. 학과 전체 응시자 수(최빈값)를 돌려준다 */
function checkTotals(items: ItemRow[], warnings: ParseWarning[]): number | null {
  const sums = new Map<number, number>();
  for (const item of items) {
    const parts = [...item.responses, item.blank, item.multiple];
    if (parts.some((p) => p === null)) continue;
    const total = parts.reduce((a, p) => a + p!.total, 0);
    const room = parts.reduce((a, p) => a + p!.room, 0);
    sums.set(item.no, total);
    if (item.roomTotal !== null && room !== item.roomTotal) {
      warnings.push({
        code: 'ROOM_SUM_MISMATCH',
        message: `문항분석표 ${item.no}번 강의실 응답 합(${room})이 합계(${item.roomTotal})와 다릅니다.`,
      });
    }
  }

  const freq = new Map<number, number>();
  for (const s of sums.values()) freq.set(s, (freq.get(s) ?? 0) + 1);
  let examinees: number | null = null;
  let best = 0;
  for (const [s, n] of freq) {
    if (n > best) {
      best = n;
      examinees = s;
    }
  }
  if (examinees === null) return null;

  for (const item of items) {
    const sum = sums.get(item.no);
    if (sum !== undefined && sum !== examinees) {
      warnings.push({
        code: 'RESPONSE_SUM_MISMATCH',
        message: `문항분석표 ${item.no}번 전체 응답 합(무표기·중복표기 포함 ${sum}명)이 다른 문항(${examinees}명)과 다릅니다.`,
      });
    }
    const correct = item.answer === null ? null : item.responses[item.answer - 1];
    if (correct && item.correctRate) {
      const computed = (correct.total / examinees) * 100;
      if (Math.abs(computed - item.correctRate.total) > 0.006) {
        warnings.push({
          code: 'RATE_MISMATCH',
          message: `문항분석표 ${item.no}번 정답률(${item.correctRate.total}%)이 정답 응답 인원으로 계산한 값(${computed.toFixed(2)}%)과 다릅니다.`,
        });
      }
    }
  }
  return examinees;
}
