/** 문항정보표 PDF 파서 (PRD 3-3). 예상 난이도의 원천 */
import type { Choice, Difficulty } from '../../core/types';
import { splitSubject, squash, toInt, toNumber } from '../text';
import type { ExamMeta, ParseResult, ParseWarning } from '../types';
import { centerX, extractTextItems, findItem, groupLines, NO_TEXT_MESSAGE, type PdfTextItem } from './textItems';

export interface ItemInfoRow {
  no: number;
  /** 배점 */
  points: number | null;
  /** 정답 1~5 */
  answer: Choice | null;
  /** 예상 난이도 (○ 위치) */
  expected: Difficulty | null;
}

export interface ItemInfoTable {
  meta: ExamMeta;
  /** '총 문항수 24 문항' */
  totalItems: number | null;
  totalScore: number | null;
  /** 선택형 배점 */
  selectionScore: number | null;
  /** 서답형 배점 */
  essayScore: number | null;
  /** 문항번호 순 */
  items: ItemInfoRow[];
  /** '총합계' 행의 난이도별 문항 수 */
  reportedCounts: Record<Difficulty, number> | null;
}

const DIFFICULTIES: Difficulty[] = ['어려움', '보통', '쉬움'];
/** 같은 행으로 볼 y 차이 */
const ROW_TOLERANCE = 3;
/** 머리글 x 범위 바깥 여유 */
const COLUMN_MARGIN = 5;

export async function parseItemInfo(data: ArrayBuffer | Uint8Array): Promise<ParseResult<ItemInfoTable>> {
  const warnings: ParseWarning[] = [];
  const { items, error } = await extractTextItems(data);
  if (error) warnings.push({ code: 'FILE_UNREADABLE', message: error });
  else if (items.length === 0) warnings.push({ code: 'NO_TEXT', message: NO_TEXT_MESSAGE });
  return { value: parseItemInfoItems(items, warnings), warnings };
}

export function parseItemInfoItems(items: PdfTextItem[], warnings: ParseWarning[] = []): ItemInfoTable {
  const table: ItemInfoTable = {
    meta: readMeta(items),
    totalItems: null,
    totalScore: null,
    selectionScore: null,
    essayScore: null,
    items: [],
    reportedCounts: null,
  };
  if (items.length === 0) return table;

  const text = groupLines(items).map((l) => l.text).join('\n');
  table.totalItems = matchNumber(text, /총\s*문항수\s*(\d+)/);
  table.totalScore = matchNumber(text, /총점\s*([\d.]+)\s*점/);
  table.selectionScore = matchNumber(text, /선택형\s*([\d.]+)\s*점/);
  table.essayScore = matchNumber(text, /서답형\s*([\d.]+)\s*점/);
  if (table.essayScore !== null && table.essayScore !== 0) {
    warnings.push({
      code: 'ESSAY_ITEMS_EXCLUDED',
      message: `서답형 배점이 ${table.essayScore}점입니다. '다.' 분석은 선택형 문항만 대상으로 합니다.`,
    });
  }

  // 열 머리글. 2쪽부터는 머리글이 없으므로 1쪽 머리글의 x 범위를 모든 쪽에 쓴다.
  const noHeader = findItem(items, (t) => t === '문항번호');
  const pointsHeader = findItem(items, (t) => t === '배점');
  const answerHeader = findItem(items, (t) => t === '정답');
  const hardHeader = findItem(items, (t) => t.startsWith('어려')); // '어려' / '움' 두 줄로 쪼개져 있음
  const nearHard = (t: string) => (i: PdfTextItem) =>
    hardHeader !== null && i.page === hardHeader.page && Math.abs(i.y - hardHeader.y) < 15 && squash(i.str) === t;
  const normalHeader = items.find(nearHard('보통')) ?? null;
  const easyHeader = items.find(nearHard('쉬움')) ?? null;

  const missingHeaders = Object.entries({
    문항번호: noHeader,
    배점: pointsHeader,
    정답: answerHeader,
    어려움: hardHeader,
    보통: normalHeader,
    쉬움: easyHeader,
  })
    .filter(([, item]) => item === null)
    .map(([name]) => name);
  if (!noHeader || !pointsHeader || !answerHeader || !hardHeader || !normalHeader || !easyHeader) {
    warnings.push({
      code: 'HEADER_NOT_FOUND',
      message: `문항정보표에서 '${missingHeaders.join("'·'")}' 머리글을 찾지 못했습니다.`,
    });
    return table;
  }

  const inColumn = (header: PdfTextItem | null) => (i: PdfTextItem) =>
    header !== null && centerX(i) >= header.x - COLUMN_MARGIN && centerX(i) <= header.x + header.w + COLUMN_MARGIN;
  const difficultyCenters = [hardHeader, normalHeader, easyHeader].map(centerX);
  const halfGap = Math.min(difficultyCenters[1] - difficultyCenters[0], difficultyCenters[2] - difficultyCenters[1]) / 2;
  const nearestDifficulty = (item: PdfTextItem): Difficulty | null => {
    const distances = difficultyCenters.map((c) => Math.abs(centerX(item) - c));
    const best = distances.indexOf(Math.min(...distances));
    return distances[best] <= halfGap ? DIFFICULTIES[best] : null;
  };
  const belowHeader = (i: PdfTextItem) => i.page > noHeader.page || (i.page === noHeader.page && i.y > noHeader.y + 2);
  const sameRow = (anchor: PdfTextItem) => (i: PdfTextItem) =>
    i.page === anchor.page && Math.abs(i.y - anchor.y) <= ROW_TOLERANCE;

  // 문항번호 칸의 정수 = 문항 행. ○·배점·정답은 같은 y에 있다(성취기준 글은 위아래로 여러 줄).
  const byNo = new Map<number, ItemInfoRow>();
  for (const numberItem of items.filter((i) => belowHeader(i) && inColumn(noHeader)(i))) {
    const no = toInt(numberItem.str);
    if (no === null || no < 1) continue;
    const row = items.filter(sameRow(numberItem));

    const circles = row.filter((i) => /^[○◯]$/.test(i.str.trim()));
    const levels = circles.map(nearestDifficulty).filter((d): d is Difficulty => d !== null);
    let expected: Difficulty | null = null;
    if (levels.length === 1) expected = levels[0];
    else {
      warnings.push({
        code: 'DIFFICULTY_UNREADABLE',
        message: `문항정보표 ${no}번 예상 난이도 표시(○)를 ${levels.length === 0 ? '찾지 못했습니다' : `${levels.length}개 찾았습니다`}.`,
      });
    }

    const pointsItem = row.find(inColumn(pointsHeader));
    const points = pointsItem ? toNumber(pointsItem.str) : null;
    if (points === null) warnings.push({ code: 'CELL_UNREADABLE', message: `문항정보표 ${no}번 배점을 읽지 못했습니다.` });

    const answerItem = row.find(inColumn(answerHeader));
    const answerValue = answerItem ? toInt(answerItem.str) : null;
    const answer = answerValue !== null && answerValue >= 1 && answerValue <= 5 ? (answerValue as Choice) : null;
    if (answer === null) warnings.push({ code: 'CELL_UNREADABLE', message: `문항정보표 ${no}번 정답을 읽지 못했습니다.` });

    if (byNo.has(no)) {
      warnings.push({ code: 'DUPLICATE_ITEM', message: `문항정보표에 ${no}번 문항이 두 번 있습니다. 처음 것을 사용합니다.` });
      continue;
    }
    byNo.set(no, { no, points, answer, expected });
  }

  table.items = [...byNo.values()].sort((a, b) => a.no - b.no);
  const maxNo = Math.max(table.totalItems ?? 0, ...table.items.map((i) => i.no));
  const missingNos: number[] = [];
  for (let n = 1; n <= maxNo; n++) if (!byNo.has(n)) missingNos.push(n);
  if (missingNos.length) {
    warnings.push({ code: 'MISSING_ITEM', message: `문항정보표에 ${missingNos.join(', ')}번 문항이 없습니다.` });
  }

  // '총합계' 행: 어려움/보통/쉬움 열 아래의 숫자
  const totalLabel = findItem(items, (t) => t === '총합계');
  if (totalLabel) {
    const counts: Partial<Record<Difficulty, number>> = {};
    for (const i of items.filter(sameRow(totalLabel))) {
      const level = nearestDifficulty(i);
      const n = toInt(i.str);
      if (level && n !== null) counts[level] = n;
    }
    if (DIFFICULTIES.every((d) => counts[d] !== undefined)) table.reportedCounts = counts as Record<Difficulty, number>;
  }
  if (!table.reportedCounts) {
    warnings.push({ code: 'TOTAL_ROW_NOT_FOUND', message: "문항정보표 '총합계' 행의 난이도별 문항 수를 읽지 못했습니다." });
  } else {
    const judged = countDifficulties(table.items);
    if (DIFFICULTIES.some((d) => judged[d] !== table.reportedCounts![d])) {
      const fmt = (c: Record<Difficulty, number>) => DIFFICULTIES.map((d) => `${d} ${c[d]}`).join(' / ');
      warnings.push({
        code: 'DIFFICULTY_COUNT_MISMATCH',
        message: `문항정보표 ○ 판정(${fmt(judged)})이 총합계 행(${fmt(table.reportedCounts)})과 다릅니다.`,
      });
    }
  }
  return table;
}

export function countDifficulties(items: { expected: Difficulty | null }[]): Record<Difficulty, number> {
  const counts: Record<Difficulty, number> = { 어려움: 0, 보통: 0, 쉬움: 0 };
  for (const i of items) if (i.expected) counts[i.expected]++;
  return counts;
}

/** 머리글: '( 화학 반응의 세계(3) ) 과목', '2026년도 2학기 1차 정기시험', '2학년' */
function readMeta(items: PdfTextItem[]): ExamMeta {
  const lines = groupLines(items.filter((i) => i.page === 1));
  const meta: ExamMeta = {
    schoolYear: null,
    semester: null,
    grade: null,
    examName: null,
    subjectRaw: null,
    subjectName: null,
    credits: null,
  };
  for (const { text } of lines) {
    if (meta.subjectRaw === null) {
      const m = /\(\s*(.+?)\s*\)\s*과목/.exec(text);
      if (m) {
        meta.subjectRaw = m[1];
        const { name, credits } = splitSubject(m[1]);
        meta.subjectName = name;
        meta.credits = credits;
      }
    }
    if (meta.schoolYear === null) {
      const m = /(\d{4})\s*(?:학)?년도\s*(\d)\s*학기\s+(.+?)(?=\s{2,}|$)/.exec(text);
      if (m) {
        meta.schoolYear = Number(m[1]);
        meta.semester = Number(m[2]);
        meta.examName = m[3].trim();
        meta.grade = matchNumber(text, /(?<!\d)(\d)\s*학년(?!도)/);
      }
    }
  }
  return meta;
}

function matchNumber(text: string, re: RegExp): number | null {
  const m = re.exec(text);
  return m ? Number(m[1]) : null;
}
