/** 내보내기 버튼 동작 (브라우저 전용). 파일은 이 컴퓨터 안에서 만들어 바로 내려받는다 */
import templateUrl from '../../templates/협의록_양식.hwpx?url';
import type { HwpxInput } from '../export/hwpxInput';

/** HWPX를 만들어 내려받는다. JSZip·XML 파서는 이때만 불러와 첫 화면을 가볍게 둔다 */
export async function downloadHwpx(input: HwpxInput, fileName: string): Promise<void> {
  const [{ buildHwpx }, res] = await Promise.all([import('../export/hwpx'), fetch(templateUrl)]);
  if (!res.ok) throw new Error(`협의록 양식을 불러오지 못했습니다 (${res.status}).`);
  const bytes = await buildHwpx(await res.arrayBuffer(), input);
  const blob = new Blob([bytes as BlobPart], { type: 'application/hwp+zip' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export async function copyPreviewTable(elementId: string, blackText: boolean): Promise<void> {
  const el = document.getElementById(elementId);
  if (!el) throw new Error('복사할 표를 찾지 못했습니다.');
  const { copyToClipboard } = await import('../export/clipboard');
  await copyToClipboard(el, { blackText });
}
