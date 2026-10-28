import type { ExamMeta, ValuePair } from './types';

/** 모든 공백·줄바꿈 제거. '평   균' → '평균', '강의실\n점수' → '강의실점수' */
export function squash(value: unknown): string {
  return value == null ? '' : String(value).replace(/\s+/g, '');
}

const NUMBER_RE = /^[-+]?\d+(?:\.\d+)?$/;

/** 숫자 또는 '7 명'·' 54.2 '·'25%' 같은 문자열 → 숫자. 못 읽으면 null */
export function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const s = squash(value).replace(/(명|점|%)$/, '');
  return NUMBER_RE.test(s) ? Number(s) : null;
}

/** 정수로 읽기. '3.0'·'20301.0'·'7 명' → 정수, 3.5처럼 소수부가 있으면 null */
export function toInt(value: unknown): number | null {
  const n = toNumber(value);
  return n !== null && Number.isInteger(n) ? n : null;
}

const PAIR_RE = /^([-+]?\d+(?:\.\d+)?)\(([-+]?\d+(?:\.\d+)?)\)$/;

/** '21(67)' → { room: 21, total: 67 }, '  72.00(  70.53)' → { room: 72, total: 70.53 } */
export function parsePair(value: unknown): ValuePair | null {
  const m = PAIR_RE.exec(squash(value));
  return m ? { room: Number(m[1]), total: Number(m[2]) } : null;
}

/** '과학:화학 반응의 세계(3)' → 교과명 '화학 반응의 세계', 학점 3 */
export function splitSubject(raw: string): { name: string; credits: number | null } {
  const m = /\((\d+)\)\s*$/.exec(raw);
  const withoutCredits = m ? raw.slice(0, m.index) : raw;
  const name = withoutCredits.split(':').pop()!.trim();
  return { name, credits: m ? Number(m[1]) : null };
}

/**
 * 머리글 줄들에서 학년도·학기·학년·고사·교과목을 찾는다.
 * 한 줄에 여러 항목이 '고사 : …    교과목 : …    급간 : 10'처럼 이어져 있으므로
 * 다음 표제어 앞까지를 값으로 본다.
 */
export function parseExamMeta(lines: string[]): ExamMeta {
  const meta: ExamMeta = {
    schoolYear: null,
    semester: null,
    grade: null,
    examName: null,
    subjectRaw: null,
    subjectName: null,
    credits: null,
  };
  for (const line of lines) {
    if (meta.schoolYear === null && /학년도/.test(line)) {
      meta.schoolYear = matchInt(line, /(\d{4})\s*학년도/);
      meta.semester = matchInt(line, /(?<!\d)(\d)\s*학기/);
      meta.grade = matchInt(line, /(?<!\d)(\d)\s*학년(?!도)/);
    }
    if (meta.examName === null) {
      const m = /고사\s*:\s*(.*?)(?=\s*(?:교과목\s*:|급간\s*:|교과담당|$))/.exec(line);
      if (m && m[1]) meta.examName = m[1].trim();
    }
    if (meta.subjectRaw === null) {
      const m = /교과목\s*:\s*(.*?)(?=\s*(?:고사\s*:|급간\s*:|교과담당|$))/.exec(line);
      if (m && m[1]) {
        meta.subjectRaw = m[1].trim();
        const { name, credits } = splitSubject(meta.subjectRaw);
        meta.subjectName = name;
        meta.credits = credits;
      }
    }
  }
  return meta;
}

function matchInt(text: string, re: RegExp): number | null {
  const m = re.exec(text);
  return m ? Number(m[1]) : null;
}

/** ExamMeta에서 못 읽은 항목 이름 목록 (경고용) */
export function missingMetaFields(meta: ExamMeta): string[] {
  const labels: [keyof ExamMeta, string][] = [
    ['schoolYear', '학년도'],
    ['semester', '학기'],
    ['grade', '학년'],
    ['examName', '고사명'],
    ['subjectRaw', '교과목'],
  ];
  return labels.filter(([key]) => meta[key] === null).map(([, label]) => label);
}
