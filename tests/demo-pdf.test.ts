// 문항정보표·성적집계표를 PDF로 올려도(예비 경로) 엑셀과 결과가 같은지 — 데모 데이터로 (CI에서 실행)
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { computeMinutesNumbers } from '../src/core';
import { detectFileKind, parseItemInfo, parseScoreSummary } from '../src/parsers';
import { DEMO_FILES, loadDemoFiles } from './demoFiles';

const pdf = (name: string) => new Uint8Array(readFileSync(resolve(import.meta.dirname, 'fixtures/demo-pdf', name)));

describe('데모 PDF판 = 엑셀판', async () => {
  const files = await loadDemoFiles();
  const subject = files.frequency!.meta.subjectRaw!;
  const infoPdf = await parseItemInfo(pdf(DEMO_FILES.itemInfo.replace('.xlsx', '.pdf')));
  const sumPdf = await parseScoreSummary(pdf(DEMO_FILES.scoreSummary.replace('.xlsx', '.pdf')), subject);

  it('PDF판도 종류를 판별한다', async () => {
    expect(await detectFileKind(pdf('예시_문항정보표.pdf'))).toEqual({ kind: 'itemInfo', format: 'pdf', noText: false });
    expect(await detectFileKind(pdf('예시_성적집계표.pdf'))).toEqual({ kind: 'scoreSummary', format: 'pdf', noText: false });
  });

  it('문항정보표: 같은 결과', () => {
    expect(infoPdf.warnings).toEqual([]);
    expect(infoPdf.value).toEqual(files.itemInfo);
  });

  it('성적집계표: 같은 수치 (PDF는 줄바꿈 자리 띄어쓰기를 알 수 없어 과목명만 다를 수 있음)', () => {
    expect(sumPdf.warnings).toEqual([]);
    const { meta: _a, subject: _b, subjects: _c, ...pdfNumbers } = sumPdf.value;
    const { meta: _d, subject: _e, subjects: _f, ...xlsxNumbers } = files.scoreSummary!;
    expect(pdfNumbers).toEqual(xlsxNumbers);
  });

  it('협의록 수치가 같다', () => {
    const viaXlsx = computeMinutesNumbers({ mode: 'fixed', files }).value;
    const viaPdf = computeMinutesNumbers({ mode: 'fixed', files: { ...files, itemInfo: infoPdf.value, scoreSummary: sumPdf.value } }).value;
    expect(viaPdf).toEqual(viaXlsx);
  });
});
