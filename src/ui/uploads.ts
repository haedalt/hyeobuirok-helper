/** 업로드한 파일을 판별·파싱한다. 파일은 브라우저 메모리에서만 다룬다. */
import {
  detectFileKind,
  parseFrequencyTable,
  parseItemAnalysis,
  parseItemInfo,
  type FrequencyTable,
  type ItemAnalysisTable,
  type ItemInfoTable,
  type ParseResult,
} from '../parsers';

interface Base {
  fileName: string;
}
export interface FrequencyUpload extends Base {
  kind: 'frequency';
  result: ParseResult<FrequencyTable>;
}
export interface ItemAnalysisUpload extends Base {
  kind: 'itemAnalysis';
  result: ParseResult<ItemAnalysisTable>;
}
export interface ItemInfoUpload extends Base {
  kind: 'itemInfo';
  result: ParseResult<ItemInfoTable>;
}
/** 성적집계표는 교과명이 정해져야 열을 읽을 수 있어 원본을 보관해 두고 나중에 파싱한다 */
export interface ScoreSummaryUpload extends Base {
  kind: 'scoreSummary';
  bytes: Uint8Array;
}
export type Upload = FrequencyUpload | ItemAnalysisUpload | ItemInfoUpload | ScoreSummaryUpload;

export interface Uploads {
  frequency?: FrequencyUpload;
  itemAnalysis?: ItemAnalysisUpload;
  itemInfo?: ItemInfoUpload;
  scoreSummary?: ScoreSummaryUpload;
}

export interface RejectedFile extends Base {
  message: string;
}

const ACCEPTED = /\.(xlsx|xls|pdf)$/i;

export async function readUpload(file: File): Promise<Upload | RejectedFile> {
  const fileName = file.name;
  if (!ACCEPTED.test(fileName)) {
    return { fileName, message: '엑셀(.xlsx, .xls)이나 PDF 파일만 올릴 수 있습니다.' };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { kind, noText } = await detectFileKind(bytes);
  switch (kind) {
    case 'frequency':
      return { kind, fileName, result: parseFrequencyTable(bytes) };
    case 'itemAnalysis':
      return { kind, fileName, result: parseItemAnalysis(bytes) };
    case 'itemInfo':
      return { kind, fileName, result: await parseItemInfo(bytes) };
    case 'scoreSummary':
      return { kind, fileName, bytes };
    default:
      return {
        fileName,
        message: noText
          ? 'PDF에서 글자를 읽을 수 없습니다(스캔본일 수 있음). 나이스에서 다시 내려받아 주세요.'
          : '도수분포표·문항분석표·문항정보표·성적집계표 중 어느 것인지 알 수 없습니다.',
      };
  }
}

export function isRejected(value: Upload | RejectedFile): value is RejectedFile {
  return !('kind' in value);
}
