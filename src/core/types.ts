/**
 * 협의록 빨간 글씨 칸(F1~F20)을 담는 타입. 기준: docs/PRD.md 4장.
 * UI·파서와 무관한 순수 데이터 정의만 둔다. 기준값 상수는 constants.ts.
 */

// ---------------------------------------------------------------------------
// 공통 기본 타입
// ---------------------------------------------------------------------------

/** 성취수준. U = 미도달 (PRD 4-1 표시어 접미사와 같음) */
export type AchievementLevel = 'A' | 'B' | 'C' | 'D' | 'E' | 'U';

export const ACHIEVEMENT_LEVELS: readonly AchievementLevel[] = ['A', 'B', 'C', 'D', 'E', 'U'];

/** 성취수준별 값 6칸 (A, B, C, D, E, 미도달) */
export type ByLevel<T> = Record<AchievementLevel, T>;

/** 분할점수 방식 */
export type CutMode = 'fixed' | 'estimated';

/** 난이도 (예상: 문항정보표 ○ 위치 / 실제: 정답률 판정) */
export type Difficulty = '어려움' | '보통' | '쉬움';

/** 답지 번호 1~5 */
export type Choice = 1 | 2 | 3 | 4 | 5;

/** 답지 ①~⑤ 순서의 값 5개 */
export type ByChoice<T> = readonly [T, T, T, T, T];

/**
 * 분할점수 5개 (PRD 4-1 `{{CUT_AB}}`~`{{CUT_EU}}`).
 * 내림차순이어야 한다: ab > bc > cd > de > eu.
 */
export interface CutScores {
  ab: number;
  bc: number;
  cd: number;
  de: number;
  eu: number;
}

/** 실제 난이도 판정 기준 (PRD 6-4) */
export interface DifficultyThresholds {
  /** 이 값 미만이면 '어려움' */
  hardBelow: number;
  /** 이 값 이상이면 '쉬움' */
  easyAtOrAbove: number;
}

/** 계산 단계에서 발견한 문제. error는 진행을 막아야 하는 것(다른 과목 파일 혼입 등) */
export interface Issue {
  severity: 'error' | 'warning';
  code: string;
  /** 교사에게 보여줄 한국어 설명 */
  message: string;
}

// ---------------------------------------------------------------------------
// 나. 성취수준별 분포 (F4~F10) — 분할 방식에 따라 갈라지는 부분
// ---------------------------------------------------------------------------

/** F5~F8: 두 방식이 공유하는 분포 표 구조 */
interface DistributionTableBase {
  /** F5 급간 6칸 (예: '90-100', '80-90미만', …, '40미만') */
  bins: ByLevel<string>;
  /** F6 수준별 인원 6칸 */
  counts: ByLevel<number>;
  /** F7 인원 합 */
  total: number;
  /** F8 수준별 비율 6칸 (%, 소수 첫째 자리 반올림). 합계 칸은 항상 '100%'로 표기 */
  percents: ByLevel<number>;
}

/**
 * 고정분할 (시나리오 A).
 * - F4 '고정분할점수', F9 숨김, F10 고정 표만 남김
 * - F6 인원은 도수분포표 급간 합산으로 자동 산출
 */
export interface FixedDistribution extends DistributionTableBase {
  mode: 'fixed';
  /** 강의실(반)별 A 수준 인원 — F19 근거. 강의실 순서대로 */
  levelAByClass: { name: string; count: number }[];
}

/**
 * 추정분할 (시나리오 B).
 * - F4 '추정분할점수', F9 분할점수 문장 표시, F10 추정 표만 남김
 * - F5 급간은 분할점수로 생성, F6 인원은 교사 입력
 */
export interface EstimatedDistribution extends DistributionTableBase {
  mode: 'estimated';
  /** F9 분할점수 문장의 숫자 5개 (교사 입력) */
  cutScores: CutScores;
  /** F9 분할점수 문장 ('A/B=87점, B/C=75점, …, E/미도달=35점') */
  cutScoreSentence: string;
}

/** F4/F9/F10은 `mode`로 결정되는 판별 유니온 */
export type Distribution = FixedDistribution | EstimatedDistribution;

// ---------------------------------------------------------------------------
// 다. 예상 난이도와 실제 정답률 차이 문항 (F11~F15)
// ---------------------------------------------------------------------------

export interface ChoiceStat {
  choice: Choice;
  count: number;
  /** 응시자 대비 % (소수 첫째 자리) */
  percent: number;
}

/** 문항 하나의 분석 결과 (4단계 전체 문항 표의 한 행) */
export interface ItemAnalysis {
  /** F11 문항 번호 */
  no: number;
  /** F12 예상 난이도 (문항정보표). 모르면 null → 차이 판정 불가 */
  expected: Difficulty | null;
  /** F13 실제 정답률 (%, 학년 전체 = 문항분석표 괄호 안 값) */
  correctRate: number;
  /** 정답률로 판정한 실제 난이도 */
  actual: Difficulty;
  /** 예상 ≠ 실제 */
  isMismatch: boolean;
  /** 예상과 실제의 단계 차이 (0~2, 2 = 쉬움↔어려움). 예상을 모르면 null */
  levelGap: number | null;
  /** F14 답지 ①~⑤ 응답 인원 (학년 전체) */
  responses: ByChoice<number>;
  /** F14b 답지 ①~⑤ 백분율 (F14 ÷ 전체 응시자, 소수 첫째 자리) */
  responsePercents: ByChoice<number>;
  /** 무표기 인원 */
  blank: number;
  /** 중복표기 인원 */
  multiple: number;
  /** F15 정답 */
  answer: Choice;
  /** 최다 오답 답지 (오답 응답이 모두 0이면 null). 동률이면 앞 번호 */
  topDistractor: ChoiceStat | null;
  /** 정답 외에 응시자의 10% 이상이 고른 답지 (〈분석의 주안점〉 2) */
  popularDistractors: ChoiceStat[];
  /** 정답보다 많이 선택된 오답이 있음 */
  distractorBeatsAnswer: boolean;
}

/** 〈분석의 주안점〉 교사 메모 (PRD 6-4, F20 '~~~' 자리) */
export interface ItemMemo {
  /** 3. 학생들이 가진 오개념 */
  misconception: string;
  /** 4. 최다 오답을 많이 고른 이유 */
  distractorReason: string;
}

// ---------------------------------------------------------------------------
// 개선방안 (F16~F20) — 앱이 만든 초안 + 교사가 고친 최종 문장
// ---------------------------------------------------------------------------

export interface DraftText {
  /** 문장 틀로 생성한 초안 */
  draft: string;
  /** 교사가 고친 값. null이면 초안을 그대로 쓴다 */
  edited: string | null;
}

export interface Improvements {
  /** F16 (평균) */
  average: DraftText;
  /** F17 (최고·최하점) */
  maxMin: DraftText;
  /** F18 (성취수준별 분포 비율 분석) */
  distribution: DraftText;
  /** F19 (A 수준 분포) */
  levelA: DraftText;
  /** F20 (정답률 차이 분석) */
  itemGap: DraftText;
}

// ---------------------------------------------------------------------------
// 협의록 전체
// ---------------------------------------------------------------------------

/** 검은 글씨 칸 — 선택 입력 (PRD 4-1 선택 표시어) */
export interface OptionalFields {
  subjectHead?: string;
  subjectAgenda?: string;
  date?: string;
  place?: string;
  attendees?: string;
}

/** 파일에서 자동 산출하는 수치 부분. 못 구한 값은 null (core/minutes.ts) */
export interface MinutesNumbers {
  /** F1 제목의 학년·과목 (예: '2학년 화학 반응의 세계') */
  title: string | null;
  /** F3 실제 평균 (성적집계표 과목평균) */
  actualAverage: number | null;
  /** 고정분할 교차 검증용: 도수분포표 강의실 평균의 응시자 가중평균 */
  weightedAverage: number | null;
  /** F17 근거: 최고점 */
  maxScore: number | null;
  /** F17 근거: 최하점(전입생제외) */
  minScore: number | null;
  /** 학년 전체 응시자 */
  examinees: number | null;
  /** F4~F10 성취수준별 분포 */
  distribution: Distribution | null;
  /** 4단계 전체 문항 표 (문항번호 순) */
  items: ItemAnalysis[];
  /** F11~F15 차이 문항만, 문항번호 순 */
  mismatchItems: ItemAnalysis[];
}

/** 협의록에 들어갈 최종 값 */
export interface MinutesFields {
  /** F1 */
  title: string;
  /** F2 예상평균 (교사 입력) */
  expectedAverage: number;
  /** F3 */
  actualAverage: number;
  /** F4~F10 */
  distribution: Distribution;
  /** F11~F15 */
  mismatchItems: ItemAnalysis[];
  /** F14b 백분율 행을 협의록에 넣을지 (PRD 9-3, 기본 끔) */
  showResponsePercents: boolean;
  maxScore: number;
  minScore: number;
  /** F16~F20 */
  improvements: Improvements;
  optional: OptionalFields;
}
