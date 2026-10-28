/** 파서 공통 타입. 파서는 예외를 던지지 않고 경고 목록으로 실패를 알린다. */

export interface ParseWarning {
  /** 기계가 판별할 코드 (예: 'HEADER_NOT_FOUND') */
  code: string;
  /** 교사에게 보여줄 한국어 설명 */
  message: string;
}

export interface ParseResult<T> {
  value: T;
  warnings: ParseWarning[];
}

/** 파일 머리글에서 읽는 시험 정보. 못 읽은 값은 null */
export interface ExamMeta {
  /** 학년도 (2026) */
  schoolYear: number | null;
  /** 학기 (2) */
  semester: number | null;
  /** 학년 (2) */
  grade: number | null;
  /** 고사명 ('1차 정기시험') */
  examName: string | null;
  /** 교과목 원문 ('과학:화학 반응의 세계(3)') */
  subjectRaw: string | null;
  /** 교과명 정리본 ('화학 반응의 세계') */
  subjectName: string | null;
  /** 학점 (3) */
  credits: number | null;
}

/** '반값(전체값)' 쌍. 협의록에는 total(학과 전체)을 쓴다 */
export interface ValuePair {
  /** 괄호 앞: 이 파일의 강의실 값 */
  room: number;
  /** 괄호 안: 학과(학년) 전체 값 */
  total: number;
}

export type ExcelKind = 'frequency' | 'itemAnalysis';
