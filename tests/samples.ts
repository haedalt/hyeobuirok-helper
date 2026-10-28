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
