// 샘플 없이 도는 규칙 단위 테스트
import { describe, expect, it } from 'vitest';
import {
  analyzeItems,
  checkItemsMatch,
  checkSameExam,
  computeScores,
  estimatedDistribution,
  fixedDistribution,
  judgeDifficulty,
  levelOf,
  percent1,
  validateCutScores,
} from '../../src/core';
import type { ExamMeta, FrequencyTable, ItemAnalysisTable, ItemInfoTable, ItemRow, SubjectScoreSummary } from '../../src/parsers';

const META: ExamMeta = {
  schoolYear: 2026,
  semester: 2,
  grade: 2,
  examName: '1차 정기시험',
  subjectRaw: '과학:화학 반응의 세계(3)',
  subjectName: '화학 반응의 세계',
  credits: 3,
};

describe('실제 난이도 판정 (25% / 75%)', () => {
  it('경계값은 위 수준 쪽', () => {
    expect(judgeDifficulty(24.99)).toBe('어려움');
    expect(judgeDifficulty(25)).toBe('보통');
    expect(judgeDifficulty(74.99)).toBe('보통');
    expect(judgeDifficulty(75)).toBe('쉬움');
  });

  it('기준값을 바꿀 수 있다', () => {
    expect(judgeDifficulty(35, { hardBelow: 40, easyAtOrAbove: 80 })).toBe('어려움');
  });
});

describe('반올림', () => {
  it('소수 첫째 자리, 정확한 .5는 올림', () => {
    expect(percent1(1, 8)).toBe(12.5);
    expect(percent1(1, 16)).toBe(6.3); // 6.25
    expect(percent1(7, 94)).toBe(7.4);
    expect(percent1(0, 0)).toBe(0);
  });
});

function frequency(binSize: number, bins: [number, number, number][]): FrequencyTable {
  return {
    meta: META,
    binSize,
    classes: [{ name: '1반', examinees: bins.reduce((a, b) => a + b[2], 0), absentees: 0, average: 50 }],
    bins: bins.map(([lower, upper, n]) => ({
      label: `${lower}이상 ~ ${upper}미만`,
      lower,
      upper,
      upperInclusive: upper === 100,
      counts: [n],
      reportedTotal: n,
    })),
  };
}

describe('고정분할 집계', () => {
  it('경계 점수는 위 수준', () => {
    expect(levelOf(90)).toBe('A');
    expect(levelOf(89.9)).toBe('B');
    expect(levelOf(40)).toBe('E');
    expect(levelOf(39)).toBe('U');
  });

  it('5점 급간: 경계와 맞으면 집계하되 급간 경고', () => {
    const { value, issues } = fixedDistribution(
      frequency(5, [
        [95, 100, 1],
        [90, 95, 2],
        [85, 90, 3],
        [40, 45, 4],
        [35, 40, 5],
      ]),
    );
    expect(value.counts).toEqual({ A: 3, B: 3, C: 0, D: 0, E: 4, U: 5 });
    expect(issues.map((i) => i.code)).toEqual(['BIN_SIZE_NOT_10']);
  });

  it('경계가 급간 안에 걸치면 오류', () => {
    const { issues } = fixedDistribution(frequency(15, [[85, 100, 1]]));
    expect(issues.map((i) => i.code)).toContain('BIN_STRADDLES_CUT');
  });
});

describe('추정분할 입력 검사', () => {
  it('내림차순이 아니면 오류', () => {
    expect(validateCutScores({ ab: 87, bc: 75, cd: 75, de: 53, eu: 35 }).map((i) => i.code)).toEqual(['CUT_NOT_DESCENDING']);
    expect(validateCutScores({ ab: 87, bc: 75, cd: 65, de: 53, eu: 35 })).toEqual([]);
  });

  it('인원 합이 응시자와 같으면 경고 없음', () => {
    const { issues } = estimatedDistribution(
      { ab: 87, bc: 75, cd: 65, de: 53, eu: 35 },
      { A: 10, B: 10, C: 10, D: 10, E: 10, U: 44 },
      94,
    );
    expect(issues).toEqual([]);
  });
});

describe('평균 대조', () => {
  const summary = (average: number): SubjectScoreSummary => ({
    meta: META,
    subjects: [],
    subject: '과학:화학반응의세계(3)',
    average,
    maxScore: 100,
    minScore: 3.6,
    minScoreExcludingTransfers: 3.6,
    examinees: 10,
    absentees: 0,
    classAverages: [],
  });
  const freq = frequency(10, [[0, 10, 10]]); // 반 평균 50, 응시 10

  it('0.1점 이내면 경고 없음, 넘으면 경고', () => {
    expect(computeScores(summary(50.1), freq).issues).toEqual([]);
    expect(computeScores(summary(50.2), freq).issues.map((i) => i.code)).toEqual(['AVERAGE_MISMATCH']);
  });
});

describe('파일 일관성', () => {
  it('다른 과목 파일이 섞이면 오류', () => {
    const other = { ...META, subjectRaw: '과학:물리학(3)', subjectName: '물리학' };
    const issues = checkSameExam({
      frequency: { meta: META } as FrequencyTable,
      itemAnalysis: { meta: other } as ItemAnalysisTable,
    });
    expect(issues.map((i) => [i.severity, i.code])).toEqual([['error', 'META_MISMATCH']]);
    expect(issues[0].message).toContain('물리학');
  });

  it('성적집계표 교과명은 공백 없이 와도 같은 과목', () => {
    const issues = checkSameExam({
      frequency: { meta: META } as FrequencyTable,
      scoreSummary: { meta: { ...META, subjectName: '화학반응의세계' } } as SubjectScoreSummary,
    });
    expect(issues).toEqual([]);
  });

  it('정답 불일치·문항 집합 불일치', () => {
    const info = { items: [{ no: 1, answer: 3 }, { no: 2, answer: 1 }, { no: 3, answer: 2 }] } as ItemInfoTable;
    const analysis = { items: [{ no: 1, answer: 3 }, { no: 2, answer: 4 }] } as ItemAnalysisTable;
    expect(checkItemsMatch(info, analysis).map((i) => i.code)).toEqual(['ITEM_SET_MISMATCH', 'ANSWER_MISMATCH']);
  });
});

describe('문항 분석', () => {
  const pair = (total: number) => ({ room: 0, total });
  const row = (no: number, answer: 1 | 2 | 3 | 4 | 5, counts: number[], rate: number): ItemRow => ({
    no,
    answer,
    responses: counts.map(pair) as unknown as ItemRow['responses'],
    correctRate: pair(rate),
    blank: pair(0),
    multiple: pair(0),
    roomTotal: null,
  });

  it('두 단계 차이, 예상 난이도 누락 경고, 10% 기준은 반올림 전 비율', () => {
    const analysis: ItemAnalysisTable = {
      meta: META,
      room: null,
      totalExaminees: 100,
      items: [row(2, 1, [80, 10, 5, 5, 0], 80), row(1, 1, [20, 10, 70, 0, 0], 20)],
    };
    const { items, mismatchItems, issues } = analyzeItems({
      analysis,
      expected: new Map([[1, '쉬움' as const]]),
    });
    expect(items.map((i) => i.no)).toEqual([1, 2]);
    expect(mismatchItems.map((i) => [i.no, i.levelGap])).toEqual([[1, 2]]);
    expect(items[0].topDistractor).toEqual({ choice: 3, count: 70, percent: 70 });
    expect(items[1].popularDistractors.map((s) => s.choice)).toEqual([2]); // 10명 = 정확히 10%
    expect(issues.map((i) => i.code)).toEqual(['EXPECTED_MISSING']);
  });
});
