/**
 * 교과별 설정을 브라우저에 저장 (PRD 8장 '저장').
 * 저장하는 것은 분할 방식·추정분할점수·난이도 기준값뿐이고, 파일·성적은 저장하지 않는다.
 */
import type { CutMode, CutScores, DifficultyThresholds } from '../core';
import { squash } from '../parsers/text';

export interface SubjectSettings {
  mode?: CutMode;
  cutScores?: CutScores;
  thresholds?: DifficultyThresholds;
}

interface Stored {
  version: 1;
  lastSubject: string | null;
  subjects: Record<string, SubjectSettings>;
}

const STORAGE_KEY = 'hyeobuirok-helper:settings';

function readAll(): Stored {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Stored) : null;
    if (parsed?.version === 1 && parsed.subjects) return parsed;
  } catch {
    // 개인정보 보호 모드 등에서는 저장소를 쓸 수 없다
  }
  return { version: 1, lastSubject: null, subjects: {} };
}

function writeAll(data: Stored): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // 저장 실패는 무시 (다음에 기본값으로 시작)
  }
}

export function loadSettings(subject: string): SubjectSettings | null {
  const key = squash(subject);
  return key ? (readAll().subjects[key] ?? null) : null;
}

/** 앱을 처음 열 때: 마지막으로 쓴 교과의 설정 */
export function loadLastSettings(): SubjectSettings | null {
  const all = readAll();
  return all.lastSubject ? (all.subjects[all.lastSubject] ?? null) : null;
}

export function saveSettings(subject: string, patch: SubjectSettings): void {
  const key = squash(subject);
  if (!key) return;
  const all = readAll();
  all.subjects[key] = { ...all.subjects[key], ...patch };
  all.lastSubject = key;
  writeAll(all);
}
