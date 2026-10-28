/** 화면 전체 상태. 계산은 src/core에 맡기고 여기서는 입력값을 모아 넘기기만 한다. */
import { useEffect, useMemo, useState } from 'react';
import {
  ACHIEVEMENT_LEVELS,
  computeMinutesNumbers,
  DEFAULT_DIFFICULTY_THRESHOLDS,
  expectedFromItemInfo,
  type AchievementLevel,
  type ByLevel,
  type CutMode,
  type CutScores,
  type Difficulty,
  type DifficultyThresholds,
  type ItemMemo,
} from '../core';
import { countDifficulties, parseScoreSummary, type ParseResult, type SubjectScoreSummary } from '../parsers';
import { loadLastSettings, loadSettings, saveSettings } from './storage';
import { isRejected, readUpload, type RejectedFile, type Uploads } from './uploads';
import { subjectGroup } from './display';

export type CutKey = keyof CutScores;
export const CUT_KEYS: CutKey[] = ['ab', 'bc', 'cd', 'de', 'eu'];
export const CUT_LABELS: Record<CutKey, string> = { ab: 'A/B', bc: 'B/C', cd: 'C/D', de: 'D/E', eu: 'E/미도달' };

export interface OptionalInputs {
  date: string;
  place: string;
  attendees: string;
}

function toNumberOrNull(value: string): number | null {
  const s = value.trim();
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function cutsToInputs(cuts: CutScores | undefined): Record<CutKey, string> {
  return {
    ab: cuts ? String(cuts.ab) : '',
    bc: cuts ? String(cuts.bc) : '',
    cd: cuts ? String(cuts.cd) : '',
    de: cuts ? String(cuts.de) : '',
    eu: cuts ? String(cuts.eu) : '',
  };
}

const EMPTY_COUNTS: Record<AchievementLevel, string> = { A: '', B: '', C: '', D: '', E: '', U: '' };

export function useMinutesState() {
  const [initial] = useState(() => loadLastSettings());

  // 1단계
  const [mode, setModeState] = useState<CutMode>(initial?.mode ?? 'fixed');
  const [subjectInput, setSubjectInput] = useState<string | null>(null);
  const [fillSubjectHead, setFillSubjectHead] = useState(true);
  const [subjectHeadInput, setSubjectHeadInput] = useState<string | null>(null);
  const [optional, setOptional] = useState<OptionalInputs>({ date: '', place: '', attendees: '' });

  // 2단계
  const [uploads, setUploads] = useState<Uploads>({});
  const [rejected, setRejected] = useState<RejectedFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [scoreColumn, setScoreColumn] = useState<string | null>(null);
  const [manualExpectedMode, setManualExpectedMode] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // 3단계
  const [expectedAverage, setExpectedAverage] = useState('');
  const [cutInputs, setCutInputs] = useState<Record<CutKey, string>>(() => cutsToInputs(initial?.cutScores));
  const [countInputs, setCountInputs] = useState<Record<AchievementLevel, string>>(EMPTY_COUNTS);

  // 4단계
  const [thresholds, setThresholdsState] = useState<DifficultyThresholds>(
    initial?.thresholds ?? DEFAULT_DIFFICULTY_THRESHOLDS,
  );
  const [manualExpected, setManualExpected] = useState<Record<number, Difficulty>>({});
  const [memos, setMemos] = useState<Record<number, ItemMemo>>({});

  // --- 파일에서 읽은 값 -----------------------------------------------------
  const freq = uploads.frequency?.result.value ?? null;
  const analysis = uploads.itemAnalysis?.result.value ?? null;
  const itemInfoRaw = uploads.itemInfo?.result.value ?? null;
  const itemInfo = manualExpectedMode ? null : itemInfoRaw;
  // 교과명은 띄어쓰기가 보존되는 엑셀 머리글을 우선한다
  const detectedMeta = analysis?.meta ?? freq?.meta ?? itemInfoRaw?.meta ?? null;
  const detectedSubject = detectedMeta?.subjectName ?? '';
  const subjectName = subjectInput ?? detectedSubject;
  const subjectHead = subjectHeadInput ?? subjectGroup(detectedMeta?.subjectRaw);

  // 성적집계표: 교과명이 정해지면 그 열을 읽는다. 결과는 (원본, 찾는 교과명) 쌍에 묶어 둔다
  const scoreBytes = uploads.scoreSummary?.bytes ?? null;
  const scoreQuery = scoreColumn ?? detectedMeta?.subjectRaw ?? subjectName;
  const [scoreParsed, setScoreParsed] = useState<{
    bytes: Uint8Array;
    query: string;
    result: ParseResult<SubjectScoreSummary>;
  } | null>(null);
  useEffect(() => {
    if (!scoreBytes || !scoreQuery) return;
    let cancelled = false;
    parseScoreSummary(scoreBytes, scoreQuery).then((result) => {
      if (!cancelled) setScoreParsed({ bytes: scoreBytes, query: scoreQuery, result });
    });
    return () => {
      cancelled = true;
    };
  }, [scoreBytes, scoreQuery]);
  const scoreResult =
    scoreParsed && scoreParsed.bytes === scoreBytes && scoreParsed.query === scoreQuery ? scoreParsed.result : null;
  const scoreSummary = scoreResult?.value.subject ? scoreResult.value : null;

  // --- 교사 입력 ------------------------------------------------------------
  const cutScores = useMemo((): CutScores | null => {
    const values = CUT_KEYS.map((k) => toNumberOrNull(cutInputs[k]));
    if (values.some((v) => v === null)) return null;
    const [ab, bc, cd, de, eu] = values as number[];
    return { ab, bc, cd, de, eu };
  }, [cutInputs]);
  const levelCounts = useMemo((): ByLevel<number> | null => {
    const values = ACHIEVEMENT_LEVELS.map((l) => toNumberOrNull(countInputs[l]));
    if (values.some((v) => v === null)) return null;
    return Object.fromEntries(ACHIEVEMENT_LEVELS.map((l, i) => [l, values[i]])) as ByLevel<number>;
  }, [countInputs]);
  const expectedAverageValue = toNumberOrNull(expectedAverage);

  const expectedMap = useMemo(() => {
    const map = itemInfo ? expectedFromItemInfo(itemInfo) : new Map<number, Difficulty>();
    for (const [no, d] of Object.entries(manualExpected)) map.set(Number(no), d);
    return map;
  }, [itemInfo, manualExpected]);

  // --- 계산 (src/core) -------------------------------------------------------
  const computed = useMemo(
    () =>
      computeMinutesNumbers({
        mode,
        files: {
          frequency: mode === 'fixed' ? freq : null,
          itemAnalysis: analysis,
          itemInfo,
          scoreSummary,
        },
        estimated: mode === 'estimated' && cutScores && levelCounts ? { cutScores, counts: levelCounts } : undefined,
        expectedOverride: expectedMap,
        subjectName,
        thresholds,
      }),
    [mode, freq, analysis, itemInfo, scoreSummary, cutScores, levelCounts, expectedMap, subjectName, thresholds],
  );

  const difficultyCounts = itemInfo ? countDifficulties(itemInfo.items) : null;
  /** 문항정보표가 없거나 읽지 못해 예상 난이도를 직접 넣어야 하는 문항이 있음 */
  const needsManualExpected =
    manualExpectedMode || (analysis !== null && analysis.items.some((i) => !expectedMap.has(i.no)) && itemInfoRaw !== null);

  // --- 동작 -----------------------------------------------------------------
  function applySavedSettings(subject: string): string | null {
    const saved = loadSettings(subject);
    if (!saved) return null;
    if (saved.mode) setModeState(saved.mode);
    if (saved.cutScores) setCutInputs(cutsToInputs(saved.cutScores));
    if (saved.thresholds) setThresholdsState(saved.thresholds);
    const modeLabel = saved.mode === 'estimated' ? '추정분할' : '고정분할';
    return `'${subject}' 교과의 지난 설정(${modeLabel}${saved.cutScores && saved.mode === 'estimated' ? '·분할점수' : ''})을 불러왔습니다.`;
  }

  async function addFiles(files: File[]) {
    if (files.length === 0) return;
    setBusy(true);
    const next: Uploads = { ...uploads };
    const newRejected: RejectedFile[] = [];
    for (const file of files) {
      const result = await readUpload(file);
      if (isRejected(result)) newRejected.push(result);
      else (next as Record<string, unknown>)[result.kind] = result;
    }
    setUploads(next);
    setRejected(newRejected);
    setBusy(false);

    // 처음으로 교과명을 알게 되면 그 교과의 저장된 설정을 불러온다
    const newSubject =
      next.itemAnalysis?.result.value.meta.subjectName ??
      next.frequency?.result.value.meta.subjectName ??
      next.itemInfo?.result.value.meta.subjectName ??
      null;
    if (newSubject && newSubject !== detectedSubject && subjectInput === null) {
      setNotice(applySavedSettings(newSubject));
    }
  }

  function removeFile(kind: keyof Uploads) {
    setUploads((u) => {
      const next = { ...u };
      delete next[kind];
      return next;
    });
    if (kind === 'scoreSummary') setScoreColumn(null);
  }

  function setMode(next: CutMode) {
    setModeState(next);
    saveSettings(subjectName, { mode: next });
  }

  function setCutInput(key: CutKey, value: string) {
    const nextInputs = { ...cutInputs, [key]: value };
    setCutInputs(nextInputs);
    const values = CUT_KEYS.map((k) => toNumberOrNull(nextInputs[k]));
    if (values.every((v) => v !== null)) {
      const [ab, bc, cd, de, eu] = values as number[];
      saveSettings(subjectName, { cutScores: { ab, bc, cd, de, eu } });
    }
  }

  function setThresholds(next: DifficultyThresholds) {
    setThresholdsState(next);
    saveSettings(subjectName, { thresholds: next });
  }

  return {
    // 1단계
    mode,
    setMode,
    subjectName,
    detectedSubject,
    setSubjectName: (value: string) => setSubjectInput(value),
    fillSubjectHead,
    setFillSubjectHead,
    subjectHead,
    setSubjectHead: (value: string) => setSubjectHeadInput(value),
    optional,
    setOptional,
    // 2단계
    uploads,
    rejected,
    busy,
    addFiles,
    removeFile,
    notice,
    dismissNotice: () => setNotice(null),
    scoreResult,
    scoreLoading: scoreBytes !== null && scoreQuery !== '' && scoreResult === null,
    setScoreColumn,
    manualExpectedMode,
    setManualExpectedMode,
    difficultyCounts,
    // 3단계
    expectedAverage,
    setExpectedAverage,
    expectedAverageValue,
    cutInputs,
    setCutInput,
    countInputs,
    setCountInput: (level: AchievementLevel, value: string) => setCountInputs((c) => ({ ...c, [level]: value })),
    estimatedReady: cutScores !== null && levelCounts !== null,
    // 4단계
    thresholds,
    setThresholds,
    expectedMap,
    needsManualExpected,
    setExpected: (no: number, d: Difficulty | '') =>
      setManualExpected((m) => {
        const next = { ...m };
        if (d === '') delete next[no];
        else next[no] = d;
        return next;
      }),
    memos,
    setMemo: (no: number, memo: Partial<ItemMemo>) =>
      setMemos((m) => ({ ...m, [no]: { ...(m[no] ?? { misconception: '', distractorReason: '' }), ...memo } })),
    // 계산 결과
    numbers: computed.value,
    // 성적집계표를 아직 안 올렸으면 '과목평균 없음'은 오류가 아니라 대기 상태 (업로드 칸에서 안내)
    issues: computed.issues.filter((i) => !(i.code === 'AVERAGE_MISSING' && !uploads.scoreSummary)),
    analysis,
    itemInfoRaw,
    freq,
  };
}

export type MinutesState = ReturnType<typeof useMinutesState>;
