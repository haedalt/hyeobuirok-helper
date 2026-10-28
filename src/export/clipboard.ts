/**
 * 미리보기의 표를 클립보드로 복사 (PRD 8장 '표 복사'). 기존 HWP 양식에 붙여 넣는 교사용.
 * 서식 있는 HTML 표와 탭으로 나눈 일반 글자를 함께 넣는다. 브라우저 전용.
 */

export interface CopyOptions {
  /** 채운 글씨를 검정으로 (기본 빨강, HWPX 옵션과 같음) */
  blackText?: boolean;
}

const RED = '#FF0000';

/** 화면용 클래스 대신 한/글이 알아듣는 인라인 서식으로 바꾼 HTML과 일반 글자 */
export function clipboardPayload(source: HTMLElement, options: CopyOptions = {}): { html: string; text: string } {
  const clone = source.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('[data-no-copy]').forEach((el) => el.remove());

  const all = [clone, ...Array.from(clone.querySelectorAll<HTMLElement>('*'))];
  for (const el of all) {
    const tag = el.tagName.toLowerCase();
    if (tag === 'table') {
      el.setAttribute('border', '1');
      el.setAttribute('cellspacing', '0');
      el.style.cssText = 'border-collapse:collapse;font-family:"맑은 고딕",sans-serif;font-size:10pt;';
    } else if (tag === 'th' || tag === 'td') {
      const align = el.classList.contains('pv-left') ? 'left' : 'center';
      el.style.cssText = `border:1px solid #000;padding:2px 4px;text-align:${align};vertical-align:middle;${tag === 'th' ? 'background:#f2f2f2;font-weight:normal;' : ''}`;
    } else if (el.classList.contains('pv-red')) {
      el.style.cssText = `color:${options.blackText ? '#000000' : RED};`;
    } else if (el.classList.contains('pv-empty')) {
      el.textContent = '';
    }
    el.removeAttribute('class');
    el.removeAttribute('id');
  }

  const html = `<html><body><!--StartFragment-->${clone.outerHTML}<!--EndFragment--></body></html>`;
  const text = tableText(source);
  return { html, text };
}

/** 표는 행마다 줄, 칸은 탭으로. 표가 아니면 글자 그대로 */
function tableText(source: HTMLElement): string {
  const table = source.tagName === 'TABLE' ? (source as HTMLTableElement) : source.querySelector('table');
  if (!table) return (source.innerText ?? source.textContent ?? '').trim();
  return Array.from(table.rows)
    .map((row) =>
      Array.from(row.cells)
        .map((cell) => (cell.querySelector('[data-no-copy]') ? '' : (cell.innerText ?? cell.textContent ?? '').trim()))
        .join('\t'),
    )
    .join('\n');
}

/** 클립보드에 넣는다. 서식 복사를 지원하지 않는 브라우저는 선택 후 복사로 대신한다 */
export async function copyToClipboard(source: HTMLElement, options: CopyOptions = {}): Promise<void> {
  const { html, text } = clipboardPayload(source, options);
  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([text], { type: 'text/plain' }),
      }),
    ]);
    return;
  }
  const holder = document.createElement('div');
  holder.contentEditable = 'true';
  holder.style.cssText = 'position:fixed;left:-9999px;top:0;';
  holder.innerHTML = html;
  document.body.appendChild(holder);
  const range = document.createRange();
  range.selectNodeContents(holder);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  const ok = document.execCommand('copy');
  selection?.removeAllRanges();
  holder.remove();
  if (!ok) throw new Error('이 브라우저에서는 복사할 수 없습니다.');
}
