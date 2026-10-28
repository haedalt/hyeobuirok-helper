/** 문항정보표 PDF 파서 (PRD 3-3). 글자 좌표로 표를 복원한다. 결과 형식·검증은 ../itemInfo.ts 공통 */
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
import { centerX, extractTextItems, findItem, groupLines, NO_TEXT_MESSAGE, type PdfTextItem } from './textItems';

/** 같은 행으로 볼 y 차이 */
const ROW_TOLERANCE = 3;
/** 머리글 x 범위 바깥 여유 */
const COLUMN_MARGIN = 5;

export async function parseItemInfoPdf(data: ArrayBuffer | Uint8Array): Promise<ParseResult<ItemInfoTable>> {
  const warnings: ParseWarning[] = [];
  const { items, error } = await extractTextItems(data);
  if (error) warnings.push({ code: 'FILE_UNREADABLE', message: error });
  else if (items.length === 0) warnings.push({ code: 'NO_TEXT', message: NO_TEXT_MESSAGE });
  return { value: parseItemInfoItems(items, warnings), warnings };
}

export function parseItemInfoItems(items: PdfTextItem[], warnings: ParseWarning[] = []): ItemInfoTable {
  const table = emptyItemInfo();
  if (items.length === 0) return table;
  readItemInfoHeader(
    groupLines(items).map((l) => l.text),
    table,
    warnings,
  );

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

  const inColumn = (header: PdfTextItem) => (i: PdfTextItem) =>
    centerX(i) >= header.x - COLUMN_MARGIN && centerX(i) <= header.x + header.w + COLUMN_MARGIN;
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
    const levels = row
      .filter((i) => isCircle(i.str))
      .map(nearestDifficulty)
      .filter((d): d is Difficulty => d !== null);
    addItemRow(
      byNo,
      readItemRow(
        no,
        { levels, points: row.find(inColumn(pointsHeader))?.str, answer: row.find(inColumn(answerHeader))?.str },
        warnings,
      ),
      warnings,
    );
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
    table.reportedCounts = completeCounts(counts);
  }
  finalizeItemInfo(table, byNo, warnings);
  return table;
}
