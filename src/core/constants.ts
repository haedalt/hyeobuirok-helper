/** 판정·검증 기준값. 설정 화면에서 바꿀 수 있는 값은 함수 인자로 덮어쓴다. */
import type { CutScores, DifficultyThresholds } from './types';

/** 고정분할 경계 90/80/70/60/40점 (PRD 6-3) */
export const FIXED_CUT_SCORES: Readonly<CutScores> = { ab: 90, bc: 80, cd: 70, de: 60, eu: 40 };

/** 고정분할에서 기대하는 도수분포표 급간 (점) */
export const EXPECTED_BIN_SIZE = 10;

/** 실제 난이도 판정 기준. 매뉴얼 기본값 25% 미만 어려움 / 75% 이상 쉬움 (PRD 6-4) */
export const DEFAULT_DIFFICULTY_THRESHOLDS: Readonly<DifficultyThresholds> = {
  hardBelow: 25,
  easyAtOrAbove: 75,
};

/** 〈분석의 주안점〉 2: 정답 외에 이 비율(%) 이상 선택된 답지를 표시 */
export const POPULAR_DISTRACTOR_PERCENT = 10;

/** 성적집계표 과목평균과 도수분포표 가중평균의 허용 차이 (점, PRD 6-3) */
export const AVERAGE_TOLERANCE = 0.1;

/** 비율 합계 칸 표기 (반올림 합이 99.9%여도 항상 100%, PRD 4장) */
export const PERCENT_TOTAL_LABEL = '100%';
