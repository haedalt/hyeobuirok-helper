import { describe, expect, it } from 'vitest';
import { buildImprovementDrafts, compressNumbers, type MinutesNumbers } from '../../src/core';

// ---- 샘플 없이: 갈래·경계값 ------------------------------------------------------

function fakeNumbers(over: Partial<MinutesNumbers>): MinutesNumbers {
  return {
    title: null,
    actualAverage: null,
    weightedAverage: null,
    maxScore: null,
    minScore: null,
    examinees: null,
    distribution: null,
    items: [],
    mismatchItems: [],
    ...over,
  };
}

describe('문장 틀 갈래', () => {
  const avg = (actual: number, expected: number) =>
    buildImprovementDrafts({ expectedAverage: expected, numbers: fakeNumbers({ actualAverage: actual }), memos: {} }).average;

  it('(평균) 차이 5점은 근접, 5점 초과는 낮음/높음', () => {
    expect(avg(65, 70)).toContain('근접하여');
    expect(avg(75, 70)).toContain('근접하여');
    expect(avg(64.9, 70)).toContain('5.1점 낮아');
    expect(avg(75.1, 70)).toContain('5.1점 높아');
  });

  it('(평균) 예상평균이 없으면 초안 없음', () => {
    expect(buildImprovementDrafts({ expectedAverage: null, numbers: fakeNumbers({ actualAverage: 50 }), memos: {} }).average).toBeNull();
  });

  it("(최고·최하점) 최고점이 100 미만이면 '최고점(96점)'", () => {
    const d = buildImprovementDrafts({ expectedAverage: null, numbers: fakeNumbers({ maxScore: 96, minScore: 7.8 }), memos: {} });
    expect(d.maxMin).toContain('최고점(96점)');
    expect(d.maxMin).toContain('최하점(7.8점)');
    expect(d.maxMin).not.toContain('100%');
  });

  it('(A 수준) 고르게 분포', () => {
    const d = buildImprovementDrafts({
      expectedAverage: null,
      memos: {},
      numbers: fakeNumbers({
        distribution: {
          mode: 'fixed',
          bins: { A: '', B: '', C: '', D: '', E: '', U: '' },
          counts: { A: 6, B: 0, C: 0, D: 0, E: 0, U: 0 },
          total: 6,
          percents: { A: 100, B: 0, C: 0, D: 0, E: 0, U: 0 },
          levelAByClass: [
            { name: '1반', count: 2 },
            { name: '2반', count: 2 },
            { name: '3반', count: 2 },
          ],
        },
      }),
    });
    expect(d.levelA).toMatch(/^성취수준 A학생이 학급별로 골고루 분포되어 있음을 확인함\./);
    expect(d.distribution).toContain('미도달 학생은 없었으나, E 수준 0명(0.0%)');
  });

  it('(정답률 차이) 차이 문항이 없을 때', () => {
    const d = buildImprovementDrafts({
      expectedAverage: null,
      memos: {},
      numbers: fakeNumbers({ items: [{} as never], mismatchItems: [] }),
    });
    expect(d.itemGap).toContain('다른 문항이 없어');
  });

  it('문항 번호 묶기', () => {
    expect(compressNumbers([7, 6, 4, 3, 2, 1])).toBe('1~4, 6, 7');
    expect(compressNumbers([20, 21, 22, 24])).toBe('20~22, 24');
    expect(compressNumbers([5])).toBe('5');
  });
});
