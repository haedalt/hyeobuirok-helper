/** 업로드 파일끼리의 일관성 검사 (PRD 3-2 교차 검증, 6-2) */
import type { ExamMeta, FrequencyTable, ItemAnalysisTable, ItemInfoTable, SubjectScoreSummary } from '../parsers';
import { squash } from '../parsers/text';
import type { CutMode, Issue } from './types';

export interface UploadedFiles {
  frequency?: FrequencyTable | null;
  itemAnalysis?: ItemAnalysisTable | null;
  itemInfo?: ItemInfoTable | null;
  scoreSummary?: SubjectScoreSummary | null;
}

const FILE_NAMES: Record<keyof UploadedFiles, string> = {
  frequency: '도수분포표',
  itemAnalysis: '문항분석표',
  itemInfo: '문항정보표',
  scoreSummary: '성적집계표',
};

const META_FIELDS: { label: string; get: (m: ExamMeta) => string | number | null }[] = [
  { label: '학년도', get: (m) => m.schoolYear },
  { label: '학기', get: (m) => m.semester },
  { label: '학년', get: (m) => m.grade },
  { label: '고사', get: (m) => (m.examName === null ? null : squash(m.examName)) },
  // 성적집계표 머리글은 줄바꿈 자리의 띄어쓰기를 알 수 없으므로 공백을 지워 비교
  { label: '교과명', get: (m) => (m.subjectName === null ? null : squash(m.subjectName)) },
];

/** 같은 학년도·학기·학년·고사·교과의 파일인지. 다르면 error (다른 반·과목 파일 혼입) */
export function checkSameExam(files: UploadedFiles): Issue[] {
  const present = (Object.keys(FILE_NAMES) as (keyof UploadedFiles)[]).filter((k) => files[k]);
  const issues: Issue[] = [];
  for (const field of META_FIELDS) {
    const values = present
      .map((k) => ({ file: FILE_NAMES[k], value: field.get(files[k]!.meta) }))
      .filter((v) => v.value !== null);
    if (new Set(values.map((v) => v.value)).size > 1) {
      issues.push({
        severity: 'error',
        code: 'META_MISMATCH',
        message: `파일마다 ${field.label}이(가) 다릅니다: ${values.map((v) => `${v.file} '${v.value}'`).join(', ')}. 같은 시험·과목 파일인지 확인해 주세요.`,
      });
    }
  }
  return issues;
}

/** 응시자 수 교차 검증: 성적집계표 = 도수분포표 응시자 합(고정분할) = 문항분석표 문항별 응답 합 */
export function checkExaminees(files: UploadedFiles, mode: CutMode): Issue[] {
  const counts: { file: string; value: number }[] = [];
  if (files.scoreSummary?.examinees != null) counts.push({ file: '성적집계표', value: files.scoreSummary.examinees });
  if (mode === 'fixed' && files.frequency) {
    const values = files.frequency.classes.map((c) => c.examinees);
    if (values.length && values.every((v) => v !== null)) {
      counts.push({ file: '도수분포표', value: values.reduce<number>((a, v) => a + v!, 0) });
    }
  }
  if (files.itemAnalysis?.totalExaminees != null) {
    counts.push({ file: '문항분석표', value: files.itemAnalysis.totalExaminees });
  }
  if (new Set(counts.map((c) => c.value)).size <= 1) return [];
  return [
    {
      severity: 'warning',
      code: 'EXAMINEES_MISMATCH',
      message: `응시자 수가 파일마다 다릅니다: ${counts.map((c) => `${c.file} ${c.value}명`).join(', ')}.`,
    },
  ];
}

/** 문항정보표와 문항분석표의 문항번호 집합·정답 대조 */
export function checkItemsMatch(info: ItemInfoTable, analysis: ItemAnalysisTable): Issue[] {
  const issues: Issue[] = [];
  const infoNos = new Set(info.items.map((i) => i.no));
  const analysisNos = new Set(analysis.items.map((i) => i.no));
  const onlyInfo = [...infoNos].filter((n) => !analysisNos.has(n));
  const onlyAnalysis = [...analysisNos].filter((n) => !infoNos.has(n));
  if (onlyInfo.length || onlyAnalysis.length) {
    const parts = [];
    if (onlyInfo.length) parts.push(`문항정보표에만 ${onlyInfo.join(', ')}번`);
    if (onlyAnalysis.length) parts.push(`문항분석표에만 ${onlyAnalysis.join(', ')}번`);
    issues.push({
      severity: 'warning',
      code: 'ITEM_SET_MISMATCH',
      message: `두 파일의 문항이 다릅니다: ${parts.join(', ')}이 있습니다.`,
    });
  }

  const infoAnswers = new Map(info.items.map((i) => [i.no, i.answer]));
  const differ = analysis.items.filter((a) => {
    const other = infoAnswers.get(a.no);
    return other != null && a.answer !== null && other !== a.answer;
  });
  if (differ.length) {
    issues.push({
      severity: 'warning',
      code: 'ANSWER_MISMATCH',
      message: `정답이 다른 문항이 있습니다: ${differ
        .map((a) => `${a.no}번(문항정보표 ${infoAnswers.get(a.no)}, 문항분석표 ${a.answer})`)
        .join(', ')}. 협의록에는 문항분석표 정답을 씁니다.`,
    });
  }
  return issues;
}
