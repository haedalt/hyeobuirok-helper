// 개선방안 숫자 검증 도우미: 문장 속 모든 숫자가 입력·계산 값이거나 문장 틀 자체의 숫자인가
import { expect } from 'vitest';
import { round1, TEMPLATES, type ItemMemo, type MinutesNumbers } from '../src/core';

export function numbersIn(text: string): number[] {
  // 원문자(①~⑤)는 숫자가 아니라 답지 기호. '~'로 이은 범위는 양쪽 숫자를 따로 뽑는다
  return (text.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
}

/** 문장 틀 문자열에 원래 들어 있는 숫자 (예: '성취율 100%') */
export function templateNumbers(): Set<number> {
  const all: string[] = [];
  const walk = (v: unknown) => (typeof v === 'string' ? all.push(v) : typeof v === 'object' && v && Object.values(v).forEach(walk));
  walk(TEMPLATES);
  return new Set(all.flatMap((s) => numbersIn(s.replace(/\{\w+\}/g, ''))));
}

/** 입력 데이터와 계산 결과에서 나올 수 있는 값 */
export function dataNumbers(n: MinutesNumbers, expectedAverage: number | null, memos: Record<number, ItemMemo>): Set<number> {
  const values: number[] = [];
  const add = (...v: (number | null | undefined)[]) => v.forEach((x) => x !== null && x !== undefined && values.push(x, round1(x)));
  add(n.actualAverage, n.maxScore, n.minScore, n.examinees, expectedAverage);
  if (n.actualAverage !== null && expectedAverage !== null) add(Math.abs(n.actualAverage - expectedAverage));
  const d = n.distribution;
  if (d) {
    add(d.total, ...Object.values(d.counts), ...Object.values(d.percents));
    if (d.mode === 'fixed') {
      d.levelAByClass.forEach((c) => add(c.count, ...numbersIn(c.name)));
    }
  }
  add(n.mismatchItems.length);
  for (const item of n.mismatchItems) {
    add(item.no, item.correctRate, item.answer, ...item.responses, ...item.responsePercents);
  }
  // 예상·실제 난이도 묶음의 문항 수
  const groups = new Map<string, number>();
  n.mismatchItems.forEach((i) => groups.set(`${i.expected}|${i.actual}`, (groups.get(`${i.expected}|${i.actual}`) ?? 0) + 1));
  add(...groups.values());
  Object.values(memos).forEach((m) => add(...numbersIn(m.misconception), ...numbersIn(m.distractorReason)));
  return new Set(values);
}

export function unknownNumbers(text: string, allowed: Set<number>): number[] {
  const template = templateNumbers();
  return numbersIn(text).filter((x) => !allowed.has(x) && !template.has(x));
}

export function expectOnlyKnownNumbers(text: string, allowed: Set<number>) {
  expect(unknownNumbers(text, allowed), `문장에 출처 없는 숫자: ${text}`).toEqual([]);
}
