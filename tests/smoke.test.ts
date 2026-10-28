// 라이브러리가 Node(Vitest)에서 동작하는지 확인하는 뼈대 단계 테스트
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { loadPdf } from '../src/parsers/pdf/loadPdf';
import { hasSample, readSample, SAMPLE } from './samples';

describe('라이브러리 동작 확인', () => {
  it('SheetJS: 워크북을 쓰고 다시 읽는다', () => {
    const ws = XLSX.utils.aoa_to_sheet([['문항', '정답률(%)'], [1, '  72.00(  70.53)']]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '시트1');
    const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const back = XLSX.read(out, { type: 'array' });
    const rows = XLSX.utils.sheet_to_json<unknown[]>(back.Sheets['시트1'], { header: 1 });
    expect(rows[1]).toEqual([1, '  72.00(  70.53)']);
  });

  it('JSZip: 압축하고 다시 연다', async () => {
    const zip = new JSZip();
    zip.file('Contents/section0.xml', '<p>{{F1_TITLE}}</p>');
    const buf = await zip.generateAsync({ type: 'uint8array' });
    const back = await JSZip.loadAsync(buf);
    expect(await back.file('Contents/section0.xml')!.async('string')).toBe('<p>{{F1_TITLE}}</p>');
  });

  it.skipIf(!hasSample(SAMPLE.itemInfo))('pdf.js: 샘플 문항정보표 PDF에서 한글 글자를 읽는다', async () => {
    const doc = await loadPdf(readSample(SAMPLE.itemInfo));
    expect(doc.numPages).toBe(2);
    const page = await doc.getPage(1);
    const text = (await page.getTextContent()).items
      .map((item) => ('str' in item ? item.str : ''))
      .join('')
      .replace(/\s/g, '');
    expect(text).toContain('문항정보표');
    await doc.loadingTask.destroy();
  });
});
