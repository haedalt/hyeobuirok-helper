import { describe, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * samples/의 실제 나이스 자료는 커밋하지 않는다(개인정보).
 * 파일이 없는 환경(CI 등)에서는 해당 테스트를 건너뛴다.
 */
export const SAMPLES_DIR = resolve(import.meta.dirname, '../samples');

export const SAMPLE = {
  frequency: '도수분포표.xlsx',
  itemAnalysis: '문항분석표.xlsx',
  itemInfo: '문항정보표.pdf',
  scoreSummary: '성적집계표.pdf',
} as const;

export function hasSample(name: string): boolean {
  return existsSync(resolve(SAMPLES_DIR, name));
}

export function readSample(name: string): Uint8Array {
  return new Uint8Array(readFileSync(resolve(SAMPLES_DIR, name)));
}

export const ALL_SAMPLE_NAMES: string[] = Object.values(SAMPLE);

/**
 * samples/ 파일이 모두 있을 때만 묶음 본문을 실행한다.
 * describe.skipIf는 건너뛰어도 본문(파일 읽기)을 실행하므로, 샘플이 없는 CI에서 실패한다.
 */
export function describeWithSamples(names: string[], title: string, factory: () => void | Promise<void>): void {
  if (names.every(hasSample)) describe(title, factory);
  else describe.skip(`${title} (samples/ 없음)`, () => it.skip('건너뜀', () => {}));
}
