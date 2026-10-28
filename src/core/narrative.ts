/**
 * 개선방안 문단 초안 (F16~F20, PRD 7장).
 * 수치 조건에 따라 문장 틀을 고르고, 틀의 {자리}에 계산된 값만 넣는다. 틀에 없는 수치는 만들지 않는다.
 * 문장 틀과 임계값은 아래 상수에서 고치면 된다. 자리 이름은 {중괄호} 안의 영문.
 */
import { formatPercent, round1 } from './format';
import type { Choice, Difficulty, Improvements, ItemAnalysis, ItemMemo, MinutesNumbers } from './types';

// ---------------------------------------------------------------------------
// 임계값
// ---------------------------------------------------------------------------

/** (평균) |실제 − 예상|이 이 값(점) 이하면 '근접' */
export const AVERAGE_NEAR_POINTS = 5;

/** (최고·최하점) 최고점이 이 값이면 '성취율 100%' 문장 */
export const PERFECT_SCORE = 100;

/** (분포) 미도달 비율(%)이 이 값 이상이면 학습 결손 원인 분석 문장을 덧붙인다 */
export const HIGH_UNREACHED_PERCENT = 30;

/** (A 수준) 한 강의실이 A 학생의 이 비율 이상을 차지하면 '집중' */
export const A_CONCENTRATION_SHARE = 0.5;
/** (A 수준) A 학생이 이 수보다 적으면 쏠림을 판단하지 않고 '골고루'로 본다 */
export const A_CONCENTRATION_MIN_STUDENTS = 4;

/** (정답률 차이) 최다 오답 비율(%)이 이 값 이상이면 '쏠린 문항'으로 언급 */
export const DISTRACTOR_FOCUS_PERCENT = 20;

/** 교사가 채울 자리 (양식의 '~~~') */
export const PLACEHOLDER = '~~~';

// ---------------------------------------------------------------------------
// 문장 틀 (양식 「협의록」 개선방안 문체: '∙ (소제목) ~함.' / '~하고자 함.')
// ---------------------------------------------------------------------------

export const TEMPLATES = {
  average: {
    near: '∙ (평균) 실제 평균점수({actual}점)가 예상 평균점수({expected}점)에 근접하여 전반적으로 출제 의도가 적중함.',
    lower:
      '∙ (평균) 실제 평균점수({actual}점)가 예상 평균점수({expected}점)보다 {diff}점 낮아, 학습 결손 영역을 점검하고 보충 지도를 실시하고자 함.',
    higher:
      '∙ (평균) 실제 평균점수({actual}점)가 예상 평균점수({expected}점)보다 {diff}점 높아, 변별도를 고려한 문항 난이도 조정을 검토하고자 함.',
  },
  maxMin: {
    perfect:
      '∙ (최고ㆍ최하점) 성취율 100%에 해당하는 학생이 최고점을 받았으며, 최하점({min}점)을 받은 학생의 성취수준을 분석하여 성취수준 보장지도를 실시하고자 함.',
    notPerfect:
      '∙ (최고ㆍ최하점) 최고점({max}점)을 받은 학생의 학습 과정을 공유하고, 최하점({min}점)을 받은 학생의 성취수준을 분석하여 성취수준 보장지도를 실시하고자 함.',
  },
  distribution: {
    some: '∙ (성취수준별 분포 비율 분석) 미도달 {count}명({percent})을 대상으로 상담과 교과 보충을 통해 최소 성취수준 예방지도를 병행하고자 함.',
    none: '∙ (성취수준별 분포 비율 분석) 미도달 학생은 없었으나, E 수준 {eCount}명({ePercent})을 대상으로 상담과 교과 보충을 통해 최소 성취수준 예방지도를 병행하고자 함.',
    high: ' 미도달 비율이 높으므로 학습 결손의 원인을 분석하여 수업 개선에 반영하고자 함.',
  },
  levelA: {
    even: '성취수준 A학생이 학급별로 골고루 분포되어 있음을 확인함.',
    concentrated: '성취수준 A학생 {total}명 중 {count}명이 {rooms} 학급에 집중되어 있음을 확인함.',
    none: '성취수준 A학생이 없었으므로, 상위 수준 학생의 성장을 위한 심화 활동을 마련하고자 함.',
    /** 추정분할: 강의실별 근거가 없으므로 인원만 */
    estimated: '성취수준 A학생은 {total}명({percent})으로 확인됨.',
    follow:
      ' 이들에게 동료의 학습 활동을 지원하기 위한 피드백 교육을 실시하고 멘토/멘티 활동에 참여하도록 제안하려고 함. 각 수준별 학생들이 학습의 주도성을 높일 수 있도록 준거 참조 및 조언적 피드백을 강화하고자 함.',
  },
  itemGap: {
    none: '∙ (정답률 차이 분석) 예상 난이도와 실제 난이도가 다른 문항이 없어 출제 의도에 맞는 난이도가 형성되었음.',
    head: '∙ (정답률 차이 분석) 예상 난이도와 실제 난이도가 다른 문항은 {count}문항이었음.',
    /** 〈분석의 주안점〉 1: 예상 난이도별로 묶음 */
    group: "'{expected}'(으)로 예상한 {count}문항({numbers}번)은 정답률 {rates}로 '{actual}' 수준이었음.",
    /** 〈분석의 주안점〉 2 */
    beatsAnswer: '정답보다 오답을 많이 선택한 문항은 {list}이었음.',
    beatsAnswerItem: '{no}번(오답 {wrong} {wrongCount}명 > 정답 {answer} {answerCount}명)',
    focus: '최다 오답에 응답이 쏠린 문항은 {list}이었음.',
    focusItem: '{no}번({choice} {percent})',
    /** 〈분석의 주안점〉 3 */
    misconception: "{numbers}번 문항에서 파악할 수 있었던 학생의 오개념은 '{memo}'{copula}.",
    misconceptionBlank: '{numbers}번 문항에서 파악할 수 있었던 학생의 오개념은 ' + PLACEHOLDER + ' 이었음.',
    /** 〈분석의 주안점〉 4 */
    reason: "{no}번에서 최다 오답 {choice}{objectParticle} 많이 고른 이유는 '{memo}'{instrumental} 보임.",
    reasonBlank: '최다 오답을 많이 고른 이유는 ' + PLACEHOLDER + '(으)로 보임.',
    closing:
      '이에 대해 즉시 피드백을 실시하였으며 지속적으로 학생의 학습 상태를 관찰하여 ' +
      PLACEHOLDER +
      '과 같이 성취수준에 도달할 수 있도록 하였음.',
  },
} as const;

// ---------------------------------------------------------------------------

export type ImprovementKey = keyof Improvements;
export const IMPROVEMENT_KEYS: ImprovementKey[] = ['average', 'maxMin', 'distribution', 'levelA', 'itemGap'];

export interface NarrativeInput {
  /** F2 교사 입력 */
  expectedAverage: number | null;
  numbers: MinutesNumbers;
  /** 4단계 교사 메모 (문항번호 → 메모) */
  memos: Readonly<Record<number, ItemMemo>>;
}

/** 문단별 초안. 필요한 값이 없으면 null (화면에서 무엇이 필요한지 안내) */
export type ImprovementDrafts = Record<ImprovementKey, string | null>;

export function buildImprovementDrafts(input: NarrativeInput): ImprovementDrafts {
  const { numbers } = input;
  return {
    average: averageParagraph(numbers.actualAverage, input.expectedAverage),
    maxMin: maxMinParagraph(numbers.maxScore, numbers.minScore),
    distribution: distributionParagraph(numbers),
    levelA: levelAParagraph(numbers),
    itemGap: numbers.items.length ? itemGapParagraph(numbers.mismatchItems, input.memos) : null,
  };
}

/** '{name}' 자리를 값으로 바꾼다. 없는 자리 이름은 그대로 남겨 테스트에서 드러나게 한다 */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in values ? String(values[key]) : whole));
}

/** 점수 표기: 54.2 → '54.2', 100.00 → '100', 3.60 → '3.6' */
export function formatScore(value: number): string {
  return String(Number(value.toFixed(2)));
}

// ---- (평균) ------------------------------------------------------------------

function averageParagraph(actual: number | null, expected: number | null): string | null {
  if (actual === null || expected === null) return null;
  const diff = round1(Math.abs(actual - expected));
  const values = { actual: formatScore(actual), expected: formatScore(expected), diff: formatScore(diff) };
  if (diff <= AVERAGE_NEAR_POINTS) return fill(TEMPLATES.average.near, values);
  return fill(actual < expected ? TEMPLATES.average.lower : TEMPLATES.average.higher, values);
}

// ---- (최고·최하점) -----------------------------------------------------------

function maxMinParagraph(max: number | null, min: number | null): string | null {
  if (max === null || min === null) return null;
  const template = max >= PERFECT_SCORE ? TEMPLATES.maxMin.perfect : TEMPLATES.maxMin.notPerfect;
  return fill(template, { max: formatScore(max), min: formatScore(min) });
}

// ---- (성취수준별 분포 비율 분석) ---------------------------------------------

function distributionParagraph(numbers: MinutesNumbers): string | null {
  const d = numbers.distribution;
  if (!d) return null;
  if (d.counts.U === 0) {
    return fill(TEMPLATES.distribution.none, { eCount: d.counts.E, ePercent: formatPercent(d.percents.E) });
  }
  let text = fill(TEMPLATES.distribution.some, { count: d.counts.U, percent: formatPercent(d.percents.U) });
  if (d.percents.U >= HIGH_UNREACHED_PERCENT) text += TEMPLATES.distribution.high;
  return text;
}

// ---- (A 수준 분포) -------------------------------------------------------------

function levelAParagraph(numbers: MinutesNumbers): string | null {
  const d = numbers.distribution;
  if (!d) return null;
  const total = d.counts.A;
  if (total === 0) return TEMPLATES.levelA.none;
  if (d.mode === 'estimated') {
    return fill(TEMPLATES.levelA.estimated, { total, percent: formatPercent(d.percents.A) }) + TEMPLATES.levelA.follow;
  }
  const top = Math.max(...d.levelAByClass.map((c) => c.count));
  const topRooms = d.levelAByClass.filter((c) => c.count === top);
  const share = (top * topRooms.length) / total;
  const concentrated = total >= A_CONCENTRATION_MIN_STUDENTS && topRooms.length === 1 && share >= A_CONCENTRATION_SHARE;
  const first = concentrated
    ? fill(TEMPLATES.levelA.concentrated, { total, count: top, rooms: topRooms.map((c) => c.name).join(', ') })
    : TEMPLATES.levelA.even;
  return first + TEMPLATES.levelA.follow;
}

// ---- (정답률 차이 분석) --------------------------------------------------------

const CHOICE_SYMBOLS = ['①', '②', '③', '④', '⑤'] as const;
const symbol = (c: Choice) => CHOICE_SYMBOLS[c - 1];
const DIFFICULTY_ORDER: Difficulty[] = ['쉬움', '보통', '어려움'];

function itemGapParagraph(items: ItemAnalysis[], memos: Readonly<Record<number, ItemMemo>>): string {
  if (items.length === 0) return TEMPLATES.itemGap.none;
  const t = TEMPLATES.itemGap;
  const sentences: string[] = [fill(t.head, { count: items.length })];

  // 1. 예상 난이도 → 실제 난이도별로 묶기
  const groups = new Map<string, ItemAnalysis[]>();
  for (const item of items) {
    const key = `${item.expected}|${item.actual}`;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  const groupKeys = [...groups.keys()].sort((a, b) => {
    const [ea, aa] = a.split('|') as Difficulty[];
    const [eb, ab] = b.split('|') as Difficulty[];
    return DIFFICULTY_ORDER.indexOf(ea) - DIFFICULTY_ORDER.indexOf(eb) || DIFFICULTY_ORDER.indexOf(aa) - DIFFICULTY_ORDER.indexOf(ab);
  });
  for (const key of groupKeys) {
    const group = groups.get(key)!;
    const rates = group.map((i) => round1(i.correctRate));
    const lo = Math.min(...rates);
    const hi = Math.max(...rates);
    sentences.push(
      fill(t.group, {
        expected: group[0].expected!,
        actual: group[0].actual,
        count: group.length,
        numbers: compressNumbers(group.map((i) => i.no)),
        rates: lo === hi ? `${lo}%` : `${lo}~${hi}%`,
      }).replace("'(으)로", josaAfterQuote(group[0].expected!)),
    );
  }

  // 2. 답지별 응답 분포: 정답보다 많이 고른 오답, 최다 오답 쏠림
  const beats = items.filter((i) => i.distractorBeatsAnswer && i.topDistractor);
  if (beats.length) {
    const list = beats.map((i) =>
      fill(t.beatsAnswerItem, {
        no: i.no,
        wrong: symbol(i.topDistractor!.choice),
        wrongCount: i.topDistractor!.count,
        answer: symbol(i.answer),
        answerCount: i.responses[i.answer - 1],
      }),
    );
    sentences.push(fill(t.beatsAnswer, { list: list.join(', ') }));
  }
  const focus = items.filter(
    (i) => !i.distractorBeatsAnswer && i.topDistractor && i.topDistractor.percent >= DISTRACTOR_FOCUS_PERCENT,
  );
  if (focus.length) {
    const list = focus.map((i) =>
      fill(t.focusItem, { no: i.no, choice: symbol(i.topDistractor!.choice), percent: formatPercent(i.topDistractor!.percent) }),
    );
    sentences.push(fill(t.focus, { list: list.join(', ') }));
  }

  // 3. 오개념 (교사 메모). 메모가 없는 문항은 '~~~' 자리로 묶어 남긴다
  const blankMis: number[] = [];
  for (const item of items) {
    const memo = memos[item.no]?.misconception.trim();
    if (memo) sentences.push(fill(t.misconception, { numbers: item.no, memo, copula: copula(memo) }));
    else blankMis.push(item.no);
  }
  if (blankMis.length) sentences.push(fill(t.misconceptionBlank, { numbers: compressNumbers(blankMis) }));

  // 4. 최다 오답을 고른 이유 (교사 메모)
  const reasons = items.filter((i) => i.topDistractor && memos[i.no]?.distractorReason.trim());
  for (const item of reasons) {
    const memo = memos[item.no].distractorReason.trim();
    const choice = symbol(item.topDistractor!.choice);
    sentences.push(
      fill(t.reason, {
        no: item.no,
        choice,
        objectParticle: hasBatchim(choice) ? '을' : '를',
        memo,
        instrumental: instrumental(memo),
      }),
    );
  }
  if (reasons.length === 0) sentences.push(t.reasonBlank);

  sentences.push(t.closing);
  return sentences.join(' ');
}

/** [1, 2, 3, 4, 6, 7] → '1~4, 6, 7' (3개 이상 이어지면 묶음) */
export function compressNumbers(nos: number[]): string {
  const sorted = [...nos].sort((a, b) => a - b);
  const parts: string[] = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    if (j - i >= 2) parts.push(`${sorted[i]}~${sorted[j]}`);
    else for (let k = i; k <= j; k++) parts.push(String(sorted[k]));
    i = j + 1;
  }
  return parts.join(', ');
}

// ---- 조사 ---------------------------------------------------------------------

/** 숫자·원문자 읽기의 받침: 0영 1일 2이 3삼 4사 5오 6육 7칠 8팔 9구 */
const DIGIT_BATCHIM = [true, true, false, true, false, false, true, true, true, false];

/** 마지막 글자에 받침이 있는가. 한글·숫자·원문자가 아니면 null (조사를 '(이)'처럼 병기) */
function batchimOf(text: string): { has: boolean; rieul: boolean } | null {
  const last = text.trim().replace(/[.'"’”)\]\s]+$/u, '').slice(-1);
  if (!last) return null;
  const code = last.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) {
    const jong = (code - 0xac00) % 28;
    return { has: jong !== 0, rieul: jong === 8 };
  }
  const digit = /[0-9]/.test(last) ? Number(last) : '①②③④⑤⑥⑦⑧⑨'.indexOf(last) + 1 || null;
  if (digit !== null) return { has: DIGIT_BATCHIM[digit % 10], rieul: digit % 10 === 1 || digit % 10 === 7 || digit % 10 === 8 };
  return null;
}

function hasBatchim(text: string): boolean {
  return batchimOf(text)?.has ?? true;
}

/** '…'이었음 / '…'였음 */
function copula(text: string): string {
  const b = batchimOf(text);
  if (!b) return '(이)었음';
  return b.has ? '이었음' : '였음';
}

/** '…'으로 / '…'로 (ㄹ 받침은 '로') */
function instrumental(text: string): string {
  const b = batchimOf(text);
  if (!b) return '(으)로';
  return b.has && !b.rieul ? '으로' : '로';
}

/** 따옴표로 감싼 단어 뒤 '(으)로'를 실제 조사로 */
function josaAfterQuote(word: string): string {
  return `'${instrumental(word)}`;
}
