/**
 * PDF 글자 좌표 추출. 나이스 PDF는 텍스트를 순서대로 읽으면 표가 깨지므로
 * 글자 덩어리마다 화면 좌표(x, y)를 얻어 표를 복원한다.
 */
import { Util } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { squash } from '../text';
import { loadPdf } from './loadPdf';

export interface PdfTextItem {
  /** 1부터 */
  page: number;
  str: string;
  /** 화면 좌표(왼쪽 위 원점, 단위 pt). 페이지 회전(/Rotate)이 반영된 값 */
  x: number;
  /** 글자 기준선의 y. 아래로 갈수록 커진다 */
  y: number;
  /** 글자 진행 방향 폭 */
  w: number;
}

export interface PdfTextLine {
  page: number;
  y: number;
  /** x 순 */
  items: PdfTextItem[];
  /** 글자 덩어리를 두 칸 공백으로 이은 문자열 */
  text: string;
}

export function centerX(item: PdfTextItem): number {
  return item.x + item.w / 2;
}

/**
 * 모든 쪽의 글자 덩어리를 화면 좌표로 읽는다. 빈 문자열은 버린다.
 * 성적집계표는 /Rotate 90 가로 쪽이라 원시 좌표로는 글자가 세로로 놓여 있다.
 */
export async function extractTextItems(
  data: ArrayBuffer | Uint8Array,
): Promise<{ items: PdfTextItem[]; error: string | null }> {
  let doc;
  try {
    doc = await loadPdf(data);
  } catch (e) {
    return { items: [], error: `PDF 파일을 열 수 없습니다: ${e instanceof Error ? e.message : String(e)}` };
  }
  try {
    const items: PdfTextItem[] = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      for (const raw of content.items) {
        if (!('str' in raw) || raw.str.trim() === '') continue;
        const m = Util.transform(viewport.transform, raw.transform);
        items.push({ page: p, str: raw.str, x: m[4], y: m[5], w: raw.width });
      }
    }
    return { items, error: null };
  } catch (e) {
    return { items: [], error: `PDF 내용을 읽는 중 오류가 났습니다: ${e instanceof Error ? e.message : String(e)}` };
  } finally {
    await doc.loadingTask.destroy();
  }
}

/** 같은 쪽에서 y 차이가 tolerance 이하인 글자를 한 줄로 묶는다 */
export function groupLines(items: PdfTextItem[], tolerance = 2): PdfTextLine[] {
  const sorted = [...items].sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x);
  const lines: PdfTextLine[] = [];
  for (const item of sorted) {
    const last = lines[lines.length - 1];
    if (last && last.page === item.page && Math.abs(item.y - last.y) <= tolerance) last.items.push(item);
    else lines.push({ page: item.page, y: item.y, items: [item], text: '' });
  }
  for (const line of lines) {
    line.items.sort((a, b) => a.x - b.x);
    line.text = line.items.map((i) => i.str.trim()).join('  ');
  }
  return lines;
}

/** 공백을 지운 텍스트가 조건을 만족하는 첫 글자 덩어리 */
export function findItem(items: PdfTextItem[], test: (squashed: string) => boolean): PdfTextItem | null {
  return items.find((i) => test(squash(i.str))) ?? null;
}

export const NO_TEXT_MESSAGE =
  'PDF에서 글자를 읽을 수 없습니다. 스캔한 PDF일 수 있습니다. 나이스에서 PDF를 다시 내려받거나 값을 직접 입력해 주세요.';
