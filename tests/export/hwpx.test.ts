// HWPX 내보내기: 템플릿(templates/협의록_양식.hwpx) + 데모 데이터 (samples/ 없이 CI에서 실행)
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ACHIEVEMENT_LEVELS, buildImprovementDrafts, formatPercent, type MinutesNumbers } from '../../src/core';
import { buildHwpx, hwpxFileName, missingForHwpx, type HwpxInput } from '../../src/export/hwpx';
import expected from '../fixtures/demo-expected.json';
import { demoNumbers } from '../demoFiles';
import { childrenOf, elementsOf, HH, innermostTable, itemTable, ownText, rowTexts, strictParse, unpack, zipEntries } from '../hwpxCheck';

const template = new Uint8Array(readFileSync(resolve(import.meta.dirname, '../../templates/협의록_양식.hwpx')));

function inputFor(numbers: MinutesNumbers, over: Partial<HwpxInput> = {}): HwpxInput {
  const drafts = buildImprovementDrafts({ expectedAverage: 60, numbers, memos: {} });
  return { mode: numbers.distribution!.mode, numbers, expectedAverage: 60, improvements: drafts, ...over };
}

describe('HWPX 내보내기 (데모 데이터, 고정분할)', async () => {
  const numbers = await demoNumbers('fixed');
  const bytes = await buildHwpx(template, inputFor(numbers));
  const { zip, sectionXml, headerXml, section } = await unpack(bytes);

  it('패키지: mimetype이 무압축으로 맨 앞, 원본과 같은 항목 순서·압축 방식', async () => {
    const out = zipEntries(bytes);
    const orig = zipEntries(template);
    expect(out[0]).toMatchObject({ name: 'mimetype', method: 0, extraLength: 0 });
    expect(await zip.file('mimetype')!.async('string')).toBe('application/hwp+zip');
    expect(out.map((e) => [e.name, e.method])).toEqual(orig.map((e) => [e.name, e.method]));
  });

  it('모든 XML을 읽을 수 있고 XML 선언이 유지된다', async () => {
    for (const name of Object.keys(zip.files).filter((n) => /\.(xml|hpf|rdf)$/.test(n))) {
      strictParse(await zip.file(name)!.async('string'));
    }
    expect(sectionXml.startsWith('<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>')).toBe(true);
    expect(headerXml.startsWith('<?xml')).toBe(true);
  });

  it("표시어가 하나도 남지 않는다 (본문·미리보기 글자)", async () => {
    expect(sectionXml).not.toContain('{{');
    expect(await zip.file('Preview/PrvText.txt')!.async('string')).not.toContain('{{');
  });

  it('제목·평균', () => {
    const texts = elementsOf(section, 'p').map(ownText);
    expect(texts).toContain(`1. ${expected.title} 평가 결과 분석`);
    expect(sectionXml).toContain(`<hp:t>${expected.summary.average}</hp:t>`);
    expect(sectionXml).toContain('<hp:t>60</hp:t>');
  });

  it("고정분할 표만 남고 '혹은'·추정분할 블록(제목·표·분할점수 문장)은 지워진다", () => {
    const texts = elementsOf(section, 'p').map(ownText);
    expect(texts.some((t) => t.includes('고정분할점수'))).toBe(true);
    expect(texts.some((t) => t.includes('추정분할점수'))).toBe(false);
    expect(texts.some((t) => t.includes('*분할점수'))).toBe(false);
    expect(texts.some((t) => t.includes('혹은'))).toBe(false);
    const fixed = innermostTable(section, '90-100');
    const rows = childrenOf(fixed, 'tr').map(rowTexts);
    expect(rows[2]).toEqual(['인원', ...ACHIEVEMENT_LEVELS.map((l) => `${expected.levelCounts[l]}명`), `${expected.summary.examinees}명`]);
    expect(rows[3]).toEqual(['비율', ...ACHIEVEMENT_LEVELS.map((l) => formatPercent(numbers.distribution!.percents[l])), '100%']);
  });

  it("'다.' 표: 차이 문항 수만큼 행, 문항번호 순, 행 위치·행 수·머리글 반복", () => {
    const tbl = itemTable(section);
    const rows = childrenOf(tbl, 'tr');
    const dataRows = rows.slice(2);
    expect(dataRows.map((tr) => rowTexts(tr)[0])).toEqual(expected.mismatches.map(String));
    const first = expected.items.find((i) => i.no === expected.mismatches[0])!;
    expect(rowTexts(dataRows[0])).toEqual([
      String(first.no),
      first.expected,
      `${Number(first.rate.toFixed(2))}%`,
      ...first.responses.map(String),
      '①②③④⑤'[first.answer - 1],
    ]);
    expect(tbl.getAttribute('rowCnt')).toBe(String(rows.length));
    rows.forEach((tr, r) => childrenOf(tr, 'tc').forEach((tc) => expect(childrenOf(tc, 'cellAddr')[0].getAttribute('rowAddr')).toBe(String(r))));
    expect(rows.slice(0, 2).flatMap((tr) => childrenOf(tr, 'tc')).every((tc) => tc.getAttribute('header') === '1')).toBe(true);
    expect(tbl.getAttribute('repeatHeader')).toBe('1');
    expect(tbl.getAttribute('pageBreak')).toBe('CELL');
    expect(Number(childrenOf(tbl, 'sz')[0].getAttribute('height'))).toBe(4912 + 2082 * dataRows.length);
  });

  it('개선방안 5문단이 들어가고, 채운 칸은 빨간 글씨 그대로 (기본)', () => {
    const texts = elementsOf(section, 'p').map(ownText);
    expect(texts.some((t) => t.startsWith('∙ (평균) 실제 평균점수('))).toBe(true);
    expect(texts.some((t) => t.startsWith('∙ (정답률 차이 분석)'))).toBe(true);
    expect(headerXml).toContain('textColor="#FF0000"');
  });

  it("선택 칸은 비어 있으면 원래 양식 글자('OO', 빈칸)로", () => {
    const texts = elementsOf(section, 'p').map(ownText);
    expect(texts).toContain('(OO) 교과  협의록');
    expect(texts.some((t) => t.startsWith('2026학년도 (     )교과 2학기'))).toBe(true);
  });

  it('파일명', () => {
    expect(hwpxFileName({ schoolYear: 2026, semester: 2, examName: '1차 정기시험' }, '화학 반응의 세계')).toBe(
      '2026학년도_2학기_1차_정기시험_결과분석_협의록_화학_반응의_세계.hwpx',
    );
  });
});

describe('HWPX 내보내기 옵션', async () => {
  const fixed = await demoNumbers('fixed');
  const estimated = await demoNumbers('estimated');

  it("추정분할: 추정 표와 분할점수 문장만 남고 고정 블록·'혹은'은 지워진다", async () => {
    const { section, sectionXml } = await unpack(await buildHwpx(template, inputFor(estimated)));
    const texts = elementsOf(section, 'p').map(ownText);
    expect(sectionXml).not.toContain('{{');
    expect(texts.some((t) => t.includes('추정분할점수'))).toBe(true);
    expect(texts.some((t) => t.includes('고정분할점수'))).toBe(false);
    expect(sectionXml).not.toContain('90-100');
    expect(texts.find((t) => t.includes('*분할점수'))!.trim()).toBe('*분할점수: A/B=87점, B/C=75점, C/D=65점, D/E=53점, E/미도달=35점');
    const est = innermostTable(section, '87-100');
    expect(childrenOf(est, 'tr').map(rowTexts)[1]).toEqual(['87-100', '75-87미만', '65-75미만', '53-65미만', '35-53미만', '0-35미만']);
  });

  it('검정 옵션: 빨간 글자모양을 쓰는 글자가 남지 않는다', async () => {
    const { section, header } = await unpack(await buildHwpx(template, inputFor(fixed, { blackText: true })));
    const charPrs = elementsOf(header, 'charPr', HH);
    const red = new Set(charPrs.filter((c) => c.getAttribute('textColor') === '#FF0000').map((c) => c.getAttribute('id')));
    const used = elementsOf(section, 'run').map((r) => r.getAttribute('charPrIDRef'));
    expect(used.filter((id) => red.has(id))).toEqual([]);
    expect(elementsOf(header, 'charProperties', HH)[0].getAttribute('itemCnt')).toBe(String(charPrs.length));
  });

  it('F14b 백분율 행: 문항마다 한 행 추가, 번호·예상·정답률·정답 칸은 두 행에 걸침', async () => {
    const { section } = await unpack(await buildHwpx(template, inputFor(fixed, { responsePercents: true })));
    const rows = childrenOf(itemTable(section), 'tr');
    expect(rows.length).toBe(2 + 2 * expected.mismatches.length);
    const [itemRow, pctRow] = rows.slice(2, 4);
    expect(childrenOf(childrenOf(itemRow, 'tc')[0], 'cellSpan')[0].getAttribute('rowSpan')).toBe('2');
    expect(rowTexts(pctRow)).toEqual(fixed.mismatchItems[0].responsePercents.map(formatPercent));
  });

  it('선택 칸 입력값, XML 특수문자 이스케이프, 줄바꿈은 문단 나누기', async () => {
    const drafts = buildImprovementDrafts({ expectedAverage: 60, numbers: fixed, memos: {} });
    const bytes = await buildHwpx(
      template,
      inputFor(fixed, {
        subjectHead: '과학',
        place: '과학실 <2>',
        attendees: '홍길동 & 김철수',
        improvements: { ...drafts, average: '∙ (평균) A & B < C > D\n둘째 줄' },
      }),
    );
    const { section, sectionXml } = await unpack(bytes);
    const texts = elementsOf(section, 'p').map(ownText);
    expect(texts).toContain('(과학) 교과  협의록');
    expect(texts).toContain('과학실 <2>');
    expect(texts).toContain('홍길동 & 김철수');
    expect(sectionXml).toContain('A &amp; B &lt; C &gt; D');
    const i = texts.indexOf('∙ (평균) A & B < C > D');
    expect(texts[i + 1]).toBe('둘째 줄');
  });

  it("차이 문항이 없으면 '해당 문항 없음' 한 행", async () => {
    const none = { ...fixed, mismatchItems: [] };
    const { section } = await unpack(await buildHwpx(template, inputFor(none)));
    const rows = childrenOf(itemTable(section), 'tr');
    expect(rows.length).toBe(3);
    expect(rowTexts(rows[2]).slice(0, 2)).toEqual(['-', '해당 문항 없음']);
  });

  it('필요한 값이 없으면 만들지 않는다', async () => {
    const input = inputFor(fixed, { expectedAverage: null });
    expect(missingForHwpx(input)).toEqual(['예상평균 (3단계)']);
    await expect(buildHwpx(template, input)).rejects.toThrow('예상평균');
  });
});
