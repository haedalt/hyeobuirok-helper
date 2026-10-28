import type { FileKind } from '../parsers';

export interface FileKindInfo {
  kind: FileKind;
  label: string;
  format: string;
  /** 나이스 내려받기 경로 (PRD 3-5) */
  neisPath: string;
  /** 협의록에서 쓰는 값 */
  usage: string;
}

export const FILE_KINDS: Record<FileKind, FileKindInfo> = {
  itemAnalysis: {
    kind: 'itemAnalysis',
    label: '문항분석표',
    format: '엑셀',
    neisPath: '평가 › 정기시험조회/통계 › 정기시험통계 › 문항분석표',
    usage: '실제 정답률, 답안별 응답 인원',
  },
  itemInfo: {
    kind: 'itemInfo',
    label: '문항정보표',
    format: '엑셀·PDF',
    neisPath: '평가 › 정기시험 › 문항정보표관리 › 조회',
    usage: '예상 난이도',
  },
  scoreSummary: {
    kind: 'scoreSummary',
    label: '성적집계표',
    format: '엑셀·PDF',
    neisPath: '평가 › 정기시험조회/통계 › 정기시험통계 › 성적집계표',
    usage: '실제 평균, 최고·최하점',
  },
  frequency: {
    kind: 'frequency',
    label: '도수분포표',
    format: '엑셀',
    neisPath: '정기시험 도수분포표',
    usage: '성취수준별 인원 (고정분할만)',
  },
};

/** 업로드 칸 표시 순서 */
export const FILE_KIND_ORDER: FileKind[] = ['itemAnalysis', 'itemInfo', 'scoreSummary', 'frequency'];
