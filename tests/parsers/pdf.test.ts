import { describe, expect, it } from 'vitest';
import { detectFileKind, parseItemInfo, parseScoreSummary } from '../../src/parsers';
import { parseItemInfoItems } from '../../src/parsers/pdf/itemInfo';
import type { PdfTextItem } from '../../src/parsers/pdf/textItems';
import { hasSample, readSample, SAMPLE } from '../samples';

describe('파일 종류 판별 (4종)', () => {
  it.skipIf(![SAMPLE.frequency, SAMPLE.itemAnalysis, SAMPLE.itemInfo, SAMPLE.scoreSummary].every(hasSample))(
    '샘플 4종을 내용으로 판별',
    async () => {
      expect((await detectFileKind(readSample(SAMPLE.frequency))).kind).toBe('frequency');
      expect((await detectFileKind(readSample(SAMPLE.itemAnalysis))).kind).toBe('itemAnalysis');
      expect((await detectFileKind(readSample(SAMPLE.itemInfo))).kind).toBe('itemInfo');
      expect((await detectFileKind(readSample(SAMPLE.scoreSummary))).kind).toBe('scoreSummary');
    },
  );

  it("글자 없는 PDF(스캔본)는 '읽을 수 없음' 경고", async () => {
    const blank = new TextEncoder().encode(
      '%PDF-1.4\n1 0 obj <</Type/Catalog/Pages 2 0 R>> endobj\n2 0 obj <</Type/Pages/Kids[3 0 R]/Count 1>> endobj\n' +
        '3 0 obj <</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]>> endobj\ntrailer <</Root 1 0 R>>\n%%EOF\n',
    );
    expect(await detectFileKind(blank)).toEqual({ kind: null, format: 'pdf', noText: true });
    const { value, warnings } = await parseItemInfo(blank);
    expect(value.items).toEqual([]);
    expect(warnings.map((w) => w.code)).toEqual(['NO_TEXT']);
    const summary = await parseScoreSummary(blank, '화학 반응의 세계');
    expect(summary.warnings.map((w) => w.code)).toEqual(['NO_TEXT']);
  });
});

describe('문항정보표 합성 좌표', () => {
  // 실제 샘플의 열 위치를 흉내 낸 글자 덩어리
  const at = (str: string, x: number, y: number, w = 10, page = 1): PdfTextItem => ({ page, str, x, y, w });
  const header = [
    at('( 국어(4) ) 과목', 40, 50, 150),
    at('2026년도 1학기 2차 정기시험', 74, 120, 130),
    at('1학년', 325, 120, 25),
    at('총 문항수 2 문항', 452, 120, 85),
    at('총점 100.00 점', 144, 165, 70),
    at('선택형 80.00 점', 360, 165, 80),
    at('서답형 20.00 점', 450, 165, 70),
    at('문항번호', 44, 220, 40),
    at('배점', 496, 220, 20),
    at('정답', 529, 220, 20),
    at('어려', 424, 225, 18),
    at('움', 428, 234, 9),
    at('보통', 448, 228, 18),
    at('쉬움', 472, 228, 18),
  ];
  const row = (no: number, circleX: number, y: number, page = 1) => [
    at(String(no), 61, y, 5, page),
    at('○', circleX, y, 10, page),
    at('40', 499, y, 10, page),
    at('2', 537, y, 5, page),
  ];

  it('서답형 배점 경고, ○ 판정이 총합계와 다르면 경고', () => {
    const warnings: { code: string; message: string }[] = [];
    const table = parseItemInfoItems(
      [
        ...header,
        ...row(1, 428, 260),
        ...row(2, 452, 30, 2),
        at('총합계', 213, 300, 30, 2),
        at('1', 430, 300, 5, 2),
        at('0', 455, 300, 5, 2),
        at('1', 479, 300, 5, 2),
      ],
      warnings,
    );
    expect(table.meta).toMatchObject({ subjectName: '국어', schoolYear: 2026, semester: 1, grade: 1, examName: '2차 정기시험' });
    expect(table.items.map((i) => i.expected)).toEqual(['어려움', '보통']);
    expect(warnings.map((w) => w.code)).toEqual(['ESSAY_ITEMS_EXCLUDED', 'DIFFICULTY_COUNT_MISMATCH']);
  });

  it('○가 없거나 번호가 빠지면 경고', () => {
    const warnings: { code: string; message: string }[] = [];
    parseItemInfoItems([...header, ...row(2, 476, 260).filter((i) => i.str !== '○')], warnings);
    expect(warnings.map((w) => w.code)).toEqual([
      'ESSAY_ITEMS_EXCLUDED',
      'DIFFICULTY_UNREADABLE',
      'MISSING_ITEM',
      'TOTAL_ROW_NOT_FOUND',
    ]);
  });
});
