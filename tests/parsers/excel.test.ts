import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { detectExcelKind, parseFrequencyTable, parseItemAnalysis } from '../../src/parsers';

/** 샘플 없이도 돌아가는 합성 시트 테스트: 위치 이동·실패 경고 */
function workbook(rows: unknown[][], merges: string[] = []): Uint8Array {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!merges'] = merges.map((m) => XLSX.utils.decode_range(m));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'sheet1');
  return new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));
}

describe('합성 시트', () => {
  const ITEM_HEADER = ['답안번호\n문항번호', '1번', '2번', '3번', '4번', '5번', '합계', '정답', '정답률(%)', '무표기', '중복표기'];
  const itemRow = (no: number | string, answer: number | string = 1) =>
    [no, '2(10)', '0(0)', '0(0)', '0(0)', '0(0)', 2, answer, '100.00(100.00)', '', ''];

  it('머리글이 몇 행·열 밀려도 읽고, 번호 누락·중복을 경고한다', () => {
    const pad = (r: unknown[]) => [null, null, ...r];
    const data = workbook([
      [],
      pad(['정기시험 문항분석표 조회']),
      pad(['2026학년도   2학기   2학년   3A 강의실']),
      pad(['고사 : 1차 정기시험   교과목 : 국어:문학(4)']),
      pad(ITEM_HEADER),
      pad(itemRow('1.0')),
      pad(itemRow(3)),
      pad([1, '/', 2, '가상고등학교']),
      pad(ITEM_HEADER),
      pad(itemRow(3)),
    ]);
    const { value, warnings } = parseItemAnalysis(data);
    expect(value.items.map((i) => i.no)).toEqual([1, 3]);
    expect(value.meta.subjectName).toBe('문학');
    expect(value.totalExaminees).toBe(10);
    expect(warnings.map((w) => w.code).sort()).toEqual(['DUPLICATE_ITEM', 'MISSING_ITEM']);
    expect(detectExcelKind(data)).toBe('itemAnalysis');
  });

  it('정답을 못 읽으면 null과 경고를 남기고 예외는 던지지 않는다', () => {
    const { value, warnings } = parseItemAnalysis(
      workbook([['문항분석표'], ITEM_HEADER, itemRow(1, '?')]),
    );
    expect(value.items[0].answer).toBeNull();
    expect(warnings.some((w) => w.code === 'CELL_UNREADABLE' && w.message.includes('정답'))).toBe(true);
  });

  it('머리글을 못 찾으면 빈 결과와 경고', () => {
    const freq = parseFrequencyTable(workbook([['정기시험 도수분포표'], ['아무 내용']]));
    expect(freq.value.bins).toEqual([]);
    expect(freq.warnings.map((w) => w.code)).toContain('HEADER_NOT_FOUND');

    const broken = parseItemAnalysis(new Uint8Array([1, 2, 3]));
    expect(broken.value.items).toEqual([]);
    expect(broken.warnings.length).toBeGreaterThan(0);
  });

  it('도수분포표: 합계·응시자 불일치를 경고한다', () => {
    const { value, warnings } = parseFrequencyTable(
      workbook([
        ['2026학년도 2학기 2학년'],
        ['고사 : 1차 정기시험    교과목 : 과학:물리학(3)    급간 : 10'],
        ['강의실\n점수', 101, 102, '합 계'],
        [null, '1반', '2반', '합 계'],
        ['50이상 ~ 100이하', 3, 4, '8 명'],
        ['0이상 ~ 50미만', 1, 1, '2 명'],
        ['응시자', '4 명', '6 명'],
        ['결시자', '0 명', '0 명'],
        ['평   균', 70.1, 60.2, ''],
      ]),
    );
    expect(value.classes.map((c) => c.name)).toEqual(['1반', '2반']);
    expect(warnings.map((w) => w.code).sort()).toEqual(['BIN_TOTAL_MISMATCH', 'CLASS_TOTAL_MISMATCH']);
  });
});
