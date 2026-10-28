/**
 * 문항정보표 공통 (PRD 3-3): 결과 형식과 검증. 엑셀(excel/itemInfo.ts)과 PDF(pdf/itemInfo.ts) 파서가 함께 쓴다.
 */
import type { Choice, Difficulty } from '../core/types';
import { splitSubject, toInt, toNumber } from './text';
import type { ExamMeta, ParseWarning } from './types';

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

/** 문항정보표 머리글의 열 순서 */
export const DIFFICULTIES: Difficulty[] = ['어려움', '보통', '쉬움'];

export function emptyItemInfo(): ItemInfoTable {
  return {
    meta: { schoolYear: null, semester: null, grade: null, examName: null, subjectRaw: null, subjectName: null, credits: null },
    totalItems: null,
    totalScore: null,
    selectionScore: null,
    essayScore: null,
    items: [],
    reportedCounts: null,
  };
}

/**
 * 머리글 줄들에서 과목·시험·문항수·배점 구성을 읽는다.
 * '( 화학 반응의 세계(3) ) 과목', '2026년도 2학기 1차 정기시험  2학년  총 문항수 24 문항', '선택형 100.00 점  서답형 0.00 점'
 */
export function readItemInfoHeader(lines: string[], table: ItemInfoTable, warnings: ParseWarning[]): void {
  const meta = table.meta;
  for (const text of lines) {
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
  const all = lines.join('\n');
  table.totalItems = matchNumber(all, /총\s*문항수\s*(\d+)/);
  table.totalScore = matchNumber(all, /총점\s*([\d.]+)\s*점/);
  table.selectionScore = matchNumber(all, /선택형\s*([\d.]+)\s*점/);
  table.essayScore = matchNumber(all, /서답형\s*([\d.]+)\s*점/);
  if (table.essayScore !== null && table.essayScore !== 0) {
    warnings.push({
      code: 'ESSAY_ITEMS_EXCLUDED',
      message: `서답형 배점이 ${table.essayScore}점입니다. '다.' 분석은 선택형 문항만 대상으로 합니다.`,
    });
  }
}

/** 문항 한 행: ○가 찍힌 난이도 열들, 배점·정답 칸 글자 → 문항 (못 읽은 값은 경고) */
export function readItemRow(
  no: number,
  cells: { levels: Difficulty[]; points: unknown; answer: unknown },
  warnings: ParseWarning[],
): ItemInfoRow {
  const levels = [...new Set(cells.levels)];
  let expected: Difficulty | null = null;
  if (levels.length === 1) expected = levels[0];
  else {
    warnings.push({
      code: 'DIFFICULTY_UNREADABLE',
      message: `문항정보표 ${no}번 예상 난이도 표시(○)를 ${levels.length === 0 ? '찾지 못했습니다' : `${levels.length}개 찾았습니다`}.`,
    });
  }
  const points = toNumber(cells.points);
  if (points === null) warnings.push({ code: 'CELL_UNREADABLE', message: `문항정보표 ${no}번 배점을 읽지 못했습니다.` });
  const answerValue = toInt(cells.answer);
  const answer = answerValue !== null && answerValue >= 1 && answerValue <= 5 ? (answerValue as Choice) : null;
  if (answer === null) warnings.push({ code: 'CELL_UNREADABLE', message: `문항정보표 ${no}번 정답을 읽지 못했습니다.` });
  return { no, points, answer, expected };
}

/** 같은 번호가 두 번 나오면 경고하고 처음 것을 쓴다 */
export function addItemRow(byNo: Map<number, ItemInfoRow>, row: ItemInfoRow, warnings: ParseWarning[]): void {
  if (byNo.has(row.no)) {
    warnings.push({ code: 'DUPLICATE_ITEM', message: `문항정보표에 ${row.no}번 문항이 두 번 있습니다. 처음 것을 사용합니다.` });
    return;
  }
  byNo.set(row.no, row);
}

/** 문항번호 순 정렬, 누락 검사, ○ 판정과 '총합계' 행 대조 */
export function finalizeItemInfo(table: ItemInfoTable, byNo: Map<number, ItemInfoRow>, warnings: ParseWarning[]): void {
  table.items = [...byNo.values()].sort((a, b) => a.no - b.no);
  const maxNo = Math.max(table.totalItems ?? 0, ...table.items.map((i) => i.no));
  const missingNos: number[] = [];
  for (let n = 1; n <= maxNo; n++) if (!byNo.has(n)) missingNos.push(n);
  if (missingNos.length) {
    warnings.push({ code: 'MISSING_ITEM', message: `문항정보표에 ${missingNos.join(', ')}번 문항이 없습니다.` });
  }

  if (!table.reportedCounts) {
    warnings.push({ code: 'TOTAL_ROW_NOT_FOUND', message: "문항정보표 '총합계' 행의 난이도별 문항 수를 읽지 못했습니다." });
    return;
  }
  const judged = countDifficulties(table.items);
  if (DIFFICULTIES.some((d) => judged[d] !== table.reportedCounts![d])) {
    const fmt = (c: Record<Difficulty, number>) => DIFFICULTIES.map((d) => `${d} ${c[d]}`).join(' / ');
    warnings.push({
      code: 'DIFFICULTY_COUNT_MISMATCH',
      message: `문항정보표 ○ 판정(${fmt(judged)})이 총합계 행(${fmt(table.reportedCounts)})과 다릅니다.`,
    });
  }
}

/** '총합계' 행에서 읽은 난이도별 개수. 셋 다 있어야 인정 */
export function completeCounts(counts: Partial<Record<Difficulty, number>>): Record<Difficulty, number> | null {
  return DIFFICULTIES.every((d) => counts[d] !== undefined) ? (counts as Record<Difficulty, number>) : null;
}

export function countDifficulties(items: { expected: Difficulty | null }[]): Record<Difficulty, number> {
  const counts: Record<Difficulty, number> = { 어려움: 0, 보통: 0, 쉬움: 0 };
  for (const i of items) if (i.expected) counts[i.expected]++;
  return counts;
}

/** 칸 글자가 ○(예상 난이도 표시)인가 */
export function isCircle(value: unknown): boolean {
  return typeof value === 'string' && /^[○◯]$/.test(value.trim());
}

function matchNumber(text: string, re: RegExp): number | null {
  const m = re.exec(text);
  return m ? Number(m[1]) : null;
}
