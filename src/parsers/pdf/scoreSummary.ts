/**
 * 정기시험 성적집계표 PDF 파서 (PRD 3-4).
 * 학년의 모든 과목이 열로 나열되어 있으므로, 교과명으로 열을 찾아 그 열만 읽는다.
 */
import { applySubject, emptyScoreSummary, matchSubject, requireValue, subjectNotFound, type SubjectScoreSummary } from '../scoreSummary';
import { parseExamMeta, squash, toInt, toNumber } from '../text';
import type { ParseResult, ParseWarning } from '../types';
import { centerX, extractTextItems, findItem, groupLines, NO_TEXT_MESSAGE, type PdfTextItem } from './textItems';

interface Column {
  header: string;
  center: number;
  left: number;
  right: number;
}

/** 행 이름과 값의 y 차이 허용치 */
const ROW_TOLERANCE = 6;

/**
 * @param subjectName 다른 파일에서 읽은 교과명. 원문('과학:화학 반응의 세계(3)')이나 정리본('화학 반응의 세계') 모두 가능
 */
export async function parseScoreSummaryPdf(
  data: ArrayBuffer | Uint8Array,
  subjectName: string,
): Promise<ParseResult<SubjectScoreSummary>> {
  const warnings: ParseWarning[] = [];
  const { items, error } = await extractTextItems(data);
  if (error) warnings.push({ code: 'FILE_UNREADABLE', message: error });
  else if (items.length === 0) warnings.push({ code: 'NO_TEXT', message: NO_TEXT_MESSAGE });
  return { value: parseScoreSummaryItems(items, subjectName, warnings), warnings };
}

export function parseScoreSummaryItems(
  items: PdfTextItem[],
  subjectName: string,
  warnings: ParseWarning[] = [],
): SubjectScoreSummary {
  const summary = emptyScoreSummary(parseExamMeta(groupLines(items.filter((i) => i.page === 1)).map((l) => l.text)));
  if (items.length === 0) return summary;

  // 왼쪽 위 '교과목' 칸과 첫 학반 행('1') 사이가 과목 머리글 영역
  const cornerLabel = findItem(items, (t) => t === '교과목');
  const averageLabel = findItem(items, (t) => t === '과목평균');
  if (!cornerLabel || !averageLabel) {
    warnings.push({ code: 'HEADER_NOT_FOUND', message: "성적집계표에서 '교과목'·'과목평균' 칸을 찾지 못했습니다." });
    return summary;
  }
  const page = cornerLabel.page;
  const labelRight = cornerLabel.x + cornerLabel.w;
  const onPage = items.filter((i) => i.page === page);
  const rowLabels = onPage.filter((i) => centerX(i) < labelRight);
  const firstRowLabel = rowLabels.filter((i) => toInt(i.str) !== null && i.y > cornerLabel.y).sort((a, b) => a.y - b.y)[0];
  const headerBottom = firstRowLabel ? firstRowLabel.y - 5 : averageLabel.y;

  const columns = buildColumns(
    onPage.filter((i) => i.x >= labelRight - 1 && i.y >= cornerLabel.y - 30 && i.y < headerBottom),
  );
  summary.subjects = columns.map((c) => c.header);
  const column = columns[matchSubject(summary.subjects, subjectName)];
  if (!column) {
    warnings.push(subjectNotFound(subjectName));
    return summary;
  }
  applySubject(summary, column.header);

  const valueAt = (rowY: number | null, field: string, read: (v: string) => number | null): number | null => {
    if (rowY === null) {
      warnings.push({ code: 'ROW_NOT_FOUND', message: `성적집계표에서 '${field}' 행을 찾지 못했습니다.` });
      return null;
    }
    const candidates = onPage
      .filter((i) => i.y > headerBottom && Math.abs(i.y - rowY) <= ROW_TOLERANCE)
      .filter((i) => centerX(i) >= column.left && centerX(i) < column.right)
      .sort((a, b) => Math.abs(a.y - rowY) - Math.abs(b.y - rowY));
    if (candidates.length === 0) return null; // 빈 칸
    const value = read(candidates[0].str.replace(/[*＊]/g, ''));
    if (value === null) {
      warnings.push({
        code: 'CELL_UNREADABLE',
        message: `성적집계표 ${column.header} '${field}' 값('${candidates[0].str}')을 읽지 못했습니다.`,
      });
    }
    return value;
  };
  const required = (value: number | null, field: string) => requireValue(value, column.header, field, warnings);

  // '최하점(전입생제외)'는 '최 하 점' / '(전입생제외)' 두 줄이고, 값은 그 사이 높이에 있다
  const transferNote = rowLabels.find((i) => squash(i.str) === '(전입생제외)') ?? null;
  const minLabels = rowLabels.filter((i) => squash(i.str) === '최하점');
  const transferMin = transferNote
    ? (minLabels.filter((i) => i.y <= transferNote.y && transferNote.y - i.y < 20).sort((a, b) => b.y - a.y)[0] ?? null)
    : null;
  const plainMin = minLabels.find((i) => i !== transferMin) ?? null;
  const labelY = (name: string) => rowLabels.find((i) => squash(i.str) === name)?.y ?? null;

  summary.average = required(valueAt(averageLabel.y, '과목평균', toNumber), '과목평균');
  summary.maxScore = required(valueAt(labelY('최고점'), '최고점', toNumber), '최고점');
  summary.minScore = required(valueAt(plainMin?.y ?? null, '최하점', toNumber), '최하점');
  summary.minScoreExcludingTransfers = required(
    valueAt(transferMin && transferNote ? (transferMin.y + transferNote.y) / 2 : null, '최하점(전입생제외)', toNumber),
    '최하점(전입생제외)',
  );
  summary.examinees = required(valueAt(labelY('응시자'), '응시자', toInt), '응시자');
  summary.absentees = required(valueAt(labelY('결시자'), '결시자', toInt), '결시자');

  const classRows = rowLabels
    .map((i) => ({ no: toInt(i.str), y: i.y }))
    .filter((r): r is { no: number; y: number } => r.no !== null && r.no >= 1 && r.y > headerBottom && r.y < averageLabel.y)
    .sort((a, b) => a.no - b.no);
  for (const row of classRows) {
    summary.classAverages[row.no - 1] = valueAt(row.y, `${row.no}반 평균`, toNumber);
  }
  for (let i = 0; i < summary.classAverages.length; i++) summary.classAverages[i] ??= null;

  return summary;
}

/** 머리글 글자 덩어리를 가운데 x로 묶어 열을 만든다. 여러 줄 머리글은 위에서부터 이어 붙인다 */
function buildColumns(headerItems: PdfTextItem[]): Column[] {
  const groups: PdfTextItem[][] = [];
  for (const item of [...headerItems].sort((a, b) => centerX(a) - centerX(b))) {
    const last = groups[groups.length - 1];
    if (last && Math.abs(centerX(item) - centerX(last[0])) <= 8) last.push(item);
    else groups.push([item]);
  }
  const centers = groups.map((g) => g.reduce((a, i) => a + centerX(i), 0) / g.length);
  return groups.map((g, k) => {
    const prevGap = k > 0 ? centers[k] - centers[k - 1] : centers[k + 1] - centers[k];
    const nextGap = k < centers.length - 1 ? centers[k + 1] - centers[k] : prevGap;
    return {
      header: squash(
        [...g]
          .sort((a, b) => a.y - b.y || a.x - b.x)
          .map((i) => i.str)
          .join(''),
      ),
      center: centers[k],
      left: centers[k] - prevGap / 2,
      right: centers[k] + nextGap / 2,
    };
  });
}
