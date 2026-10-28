// public/demo/ 가상 파일 4종을 읽어 협의록 수치까지 계산하는 테스트 도우미
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { computeMinutesNumbers, type ByLevel, type CutMode, type CutScores, type MinutesNumbers, type UploadedFiles } from '../src/core';
import { parseFrequencyTable, parseItemAnalysis, parseItemInfo, parseScoreSummary } from '../src/parsers';

export const DEMO_FILES = {
  frequency: '예시_도수분포표.xlsx',
  itemAnalysis: '예시_문항분석표.xlsx',
  itemInfo: '예시_문항정보표.pdf',
  scoreSummary: '예시_성적집계표.pdf',
} as const;

export function readDemo(name: string): Uint8Array {
  return new Uint8Array(readFileSync(resolve(import.meta.dirname, '../public/demo', name)));
}

export async function loadDemoFiles(): Promise<UploadedFiles> {
  const frequency = parseFrequencyTable(readDemo(DEMO_FILES.frequency)).value;
  return {
    frequency,
    itemAnalysis: parseItemAnalysis(readDemo(DEMO_FILES.itemAnalysis)).value,
    itemInfo: (await parseItemInfo(readDemo(DEMO_FILES.itemInfo))).value,
    scoreSummary: (await parseScoreSummary(readDemo(DEMO_FILES.scoreSummary), frequency.meta.subjectRaw!)).value,
  };
}

export const DEMO_ESTIMATED: { cutScores: CutScores; counts: ByLevel<number> } = {
  cutScores: { ab: 87, bc: 75, cd: 65, de: 53, eu: 35 },
  counts: { A: 5, B: 9, C: 12, D: 20, E: 28, U: 21 },
};

export async function demoNumbers(mode: CutMode = 'fixed'): Promise<MinutesNumbers> {
  return computeMinutesNumbers({ mode, files: await loadDemoFiles(), estimated: DEMO_ESTIMATED }).value;
}
