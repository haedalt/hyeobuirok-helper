// public/demo/ 가상 데모 파일 4종이 앱 파서·계산으로 올바르게 읽히는지 (samples/ 없이 CI에서 실행)
// 정답값 tests/fixtures/demo-expected.json은 scripts/make-demo.mjs가 가상 학생 답안에서 직접 계산한 값이다.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildImprovementDrafts, computeMinutesNumbers, IMPROVEMENT_KEYS, PLACEHOLDER } from '../src/core';
import {
  detectFileKind,
  parseFrequencyTable,
  parseItemAnalysis,
  parseItemInfo,
  parseScoreSummary,
} from '../src/parsers';
import expected from './fixtures/demo-expected.json';
import { dataNumbers, expectOnlyKnownNumbers, unknownNumbers } from './narrativeCheck';

const demo = (name: string) => new Uint8Array(readFileSync(resolve(import.meta.dirname, '../public/demo', name)));
const FILES = {
  frequency: '예시_도수분포표.xlsx',
  itemAnalysis: '예시_문항분석표.xlsx',
  itemInfo: '예시_문항정보표.pdf',
  scoreSummary: '예시_성적집계표.pdf',
} as const;

describe('데모 파일 4종', async () => {
  const freq = parseFrequencyTable(demo(FILES.frequency));
  const analysis = parseItemAnalysis(demo(FILES.itemAnalysis));
  const info = await parseItemInfo(demo(FILES.itemInfo));
  const summary = await parseScoreSummary(demo(FILES.scoreSummary), freq.value.meta.subjectRaw!);

  it('내용으로 종류 판별', async () => {
    for (const [kind, name] of Object.entries(FILES)) {
      expect((await detectFileKind(demo(name))).kind, name).toBe(kind);
    }
  });

  it('네 파일 모두 경고 없이 읽힌다', () => {
    expect(freq.warnings).toEqual([]);
    expect(analysis.warnings).toEqual([]);
    expect(info.warnings).toEqual([]);
    expect(summary.warnings).toEqual([]);
  });

  it('시험 정보', () => {
    expect(freq.value.meta).toEqual(expected.meta);
    expect(analysis.value.meta).toEqual(expected.meta);
    expect(info.value.meta.subjectName).toBe(expected.meta.subjectName);
    expect(summary.value.meta).toMatchObject({ schoolYear: 2026, semester: 2, grade: 2, examName: '1차 정기시험' });
  });

  it('도수분포표: 강의실별 응시자·결시자·평균', () => {
    expect(freq.value.binSize).toBe(10);
    expect(
      freq.value.classes.map((c) => ({ name: c.name, examinees: c.examinees, absentees: c.absentees, average: c.average })),
    ).toEqual(expected.rooms.map(({ name, examinees, absentees, average }) => ({ name, examinees, absentees, average })));
  });

  it('문항분석표: 정답·학과 전체 응답·정답률·무표기·중복표기 (세로 병합 칸 포함)', () => {
    expect(analysis.value.totalExaminees).toBe(expected.summary.examinees);
    expect(
      analysis.value.items.map((i) => ({
        no: i.no,
        answer: i.answer,
        rate: i.correctRate!.total,
        responses: i.responses.map((p) => p!.total),
        blank: i.blank!.total,
        multiple: i.multiple!.total,
      })),
    ).toEqual(expected.items.map(({ no, answer, rate, responses, blank, multiple }) => ({ no, answer, rate, responses, blank, multiple })));
  });

  it('문항정보표: 예상 난이도·배점·정답, 총합계 일치', () => {
    expect(info.value.items.map((i) => ({ no: i.no, expected: i.expected, points: i.points, answer: i.answer }))).toEqual(
      expected.items.map(({ no, expected: e, points, answer }) => ({ no, expected: e, points, answer })),
    );
    expect(info.value.reportedCounts).toEqual({ 어려움: 6, 보통: 12, 쉬움: 6 });
  });

  it('성적집계표: 8개 과목 중 데모 과목 열', () => {
    expect(summary.value.subjects).toHaveLength(8);
    expect(summary.value.average).toBe(expected.summary.average);
    expect(summary.value.maxScore).toBe(expected.summary.max);
    expect(summary.value.minScoreExcludingTransfers).toBe(expected.summary.min);
    expect(summary.value.examinees).toBe(expected.summary.examinees);
    expect(summary.value.absentees).toBe(expected.summary.absentees);
    expect(summary.value.classAverages).toEqual(expected.summary.classAverages);
  });

  it('협의록 수치: 교차 검증 통과, 성취수준·차이 문항이 정답값과 같다', () => {
    const { value: m, issues } = computeMinutesNumbers({
      mode: 'fixed',
      files: { frequency: freq.value, itemAnalysis: analysis.value, itemInfo: info.value, scoreSummary: summary.value },
    });
    expect(issues).toEqual([]);
    expect(m.title).toBe(expected.title);
    expect(m.distribution!.counts).toEqual(expected.levelCounts);
    expect(m.distribution!.total).toBe(expected.summary.examinees);
    if (m.distribution!.mode === 'fixed') {
      expect(m.distribution!.levelAByClass.map((c) => c.count)).toEqual(expected.rooms.map((r) => r.levelA));
    }
    expect(m.items.map((i) => i.actual)).toEqual(expected.items.map((i) => i.actual));
    expect(m.mismatchItems.map((i) => i.no)).toEqual(expected.mismatches);

    const drafts = buildImprovementDrafts({ expectedAverage: 60, numbers: m, memos: {} });
    for (const key of IMPROVEMENT_KEYS) expect(drafts[key], key).toBeTruthy();
    expect(drafts.itemGap).toContain(`다른 문항은 ${expected.mismatches.length}문항이었음`);
    expect(drafts.itemGap).toContain(PLACEHOLDER);
  });

  it('개선방안 숫자 검증: 모든 문단의 숫자가 입력·계산 값이거나 문장 틀 자체의 숫자', () => {
    const { value: m } = computeMinutesNumbers({
      mode: 'fixed',
      files: { frequency: freq.value, itemAnalysis: analysis.value, itemInfo: info.value, scoreSummary: summary.value },
    });
    const memos = { [expected.mismatches[0]]: { misconception: '2단계 반응식을 1단계로 착각함', distractorReason: '' } };
    for (const expectedAverage of [50, 54, 60]) {
      const drafts = buildImprovementDrafts({ expectedAverage, numbers: m, memos });
      const allowed = dataNumbers(m, expectedAverage, memos);
      for (const key of IMPROVEMENT_KEYS) expectOnlyKnownNumbers(drafts[key]!, allowed);
      // 지어낸 숫자는 잡아낸다
      expect(unknownNumbers(`${drafts.average} 123.4점 456명`, allowed)).toEqual([123.4, 456]);
    }
  });
});
