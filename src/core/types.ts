/**
 * 협의록 빨간 글씨 칸(F1~F20)을 담는 타입. 기준: docs/PRD.md 4장.
 * UI·파서와 무관한 순수 데이터 정의만 둔다.
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

/** 고정분할 경계 (PRD 6-3) */
export const FIXED_CUT_SCORES: Readonly<CutScores> = { ab: 90, bc: 80, cd: 70, de: 60, eu: 40 };

/** 실제 난이도 판정 기준 (PRD 6-4, 매뉴얼 기본값 25% / 75%) */
export interface DifficultyThresholds {
  /** 이 값 미만이면 '어려움' */
  hardBelow: number;
  /** 이 값 이상이면 '쉬움' */
  easyAtOrAbove: number;
}

export const DEFAULT_DIFFICULTY_THRESHOLDS: Readonly<DifficultyThresholds> = {
  hardBelow: 25,
  easyAtOrAbove: 75,
};

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
  /** F8 수준별 비율 6칸 (%, 소수 첫째 자리 반올림 전 원값). 합계 칸은 항상 '100%'로 표기 */
  percents: ByLevel<number>;
}

/**
 * 고정분할 (시나리오 A).
 * - F4 '고정분할점수', F9 숨김, F10 고정 표만 남김
 * - F6 인원은 도수분포표 급간 합산으로 자동 산출
 */
export interface FixedDistribution extends DistributionTableBase {
  mode: 'fixed';
  /** 강의실(반)별 A 수준 인원 — F19 근거. 예: { '3A': 1, '3B': 0, '3C': 2, '3D': 0 } */
  levelACountByClass: Record<string, number>;
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
}

/** F4/F9/F10은 `mode`로 결정되는 판별 유니온 */
export type Distribution = FixedDistribution | EstimatedDistribution;

// ---------------------------------------------------------------------------
// 다. 예상 난이도와 실제 정답률 차이 문항 (F11~F15)
// ---------------------------------------------------------------------------

/** 문항 하나의 분석 결과 (4단계 전체 문항 표의 한 행) */
export interface ItemAnalysis {
  /** F11 문항 번호 */
  no: number;
  /** F12 예상 난이도 (문항정보표) */
  expected: Difficulty;
  /** F13 실제 정답률 (%, 학년 전체 = 문항분석표 괄호 안 값) */
  correctRate: number;
  /** 정답률로 판정한 실제 난이도 */
  actual: Difficulty;
  /** 예상 ≠ 실제 */
  isMismatch: boolean;
  /** F14 답지 ①~⑤ 응답 인원 (학년 전체) */
  responses: ByChoice<number>;
  /** F14b 답지 ①~⑤ 백분율 (F14 ÷ 전체 응시자, 옵션) */
  responsePercents: ByChoice<number>;
  /** 무표기 인원 */
  blank: number;
  /** 중복표기 인원 */
  multiple: number;
  /** F15 정답 */
  answer: Choice;
  /** 최다 오답 답지 (오답 응답이 모두 0이면 null) */
  topDistractor: Choice | null;
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

export interface MinutesFields {
  /** F1 제목의 학년·과목 (예: '2학년 화학 반응의 세계') */
  title: string;
  /** F2 예상평균 (교사 입력) */
  expectedAverage: number;
  /** F3 실제 평균 (성적집계표 과목평균) */
  actualAverage: number;
  /** F4~F10 성취수준별 분포 */
  distribution: Distribution;
  /** F11~F15 차이 문항만, 문항번호 순 */
  mismatchItems: ItemAnalysis[];
  /** F14b 백분율 행을 협의록에 넣을지 (PRD 9-3, 기본 끔) */
  showResponsePercents: boolean;
  /** F17 근거: 최고점 */
  maxScore: number;
  /** F17 근거: 최하점(전입생제외) */
  minScore: number;
  /** F16~F20 */
  improvements: Improvements;
  optional: OptionalFields;
}
