import { describe, expect, it } from 'vitest';
import { parseExamMeta, parsePair, squash, toInt, toNumber } from '../../src/parsers/text';

describe('문자열 정리', () => {
  it('공백·줄바꿈을 지운다', () => {
    expect(squash('평   균')).toBe('평균');
    expect(squash('강의실\n점수')).toBe('강의실점수');
    expect(squash(null)).toBe('');
  });

  it("'7 명'·'3.0'·'20301.0'을 정수로 바꾼다", () => {
    expect(toInt('7 명')).toBe(7);
    expect(toInt('3.0')).toBe(3);
    expect(toInt('20301.0')).toBe(20301);
    expect(toInt(3)).toBe(3);
    expect(toInt('3.5')).toBeNull();
    expect(toInt('')).toBeNull();
    expect(toInt('합 계')).toBeNull();
    expect(toNumber(' 54.2 ')).toBe(54.2);
  });

  it("'반값(전체값)'을 나눈다", () => {
    expect(parsePair('21(67)')).toEqual({ room: 21, total: 67 });
    expect(parsePair('  72.00(  70.53)')).toEqual({ room: 72, total: 70.53 });
    expect(parsePair('0(1)')).toEqual({ room: 0, total: 1 });
    expect(parsePair('16')).toBeNull();
  });

  it('머리글에서 시험 정보를 읽는다', () => {
    const meta = parseExamMeta([
      '2026학년도    2학기    주간 일반계    2학년',
      '고사 :  1차 정기시험   교과목 :  과학:화학 반응의 세계(3)  교과담당교사 (홍길동) 인',
    ]);
    expect(meta).toEqual({
      schoolYear: 2026,
      semester: 2,
      grade: 2,
      examName: '1차 정기시험',
      subjectRaw: '과학:화학 반응의 세계(3)',
      subjectName: '화학 반응의 세계',
      credits: 3,
    });
  });
});
