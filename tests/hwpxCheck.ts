// 생성한 HWPX를 다시 풀어 검사하는 도우미
import { DOMParser, type Document, type Element } from '@xmldom/xmldom';
import JSZip from 'jszip';

export const HP = 'http://www.hancom.co.kr/hwpml/2011/paragraph';
export const HH = 'http://www.hancom.co.kr/hwpml/2011/head';

/** XML이 올바르지 않으면 예외 */
export function strictParse(text: string): Document {
  return new DOMParser({
    onError: (level, message) => {
      if (level !== 'warning') throw new Error(message);
    },
  }).parseFromString(text, 'text/xml');
}

/** zip 로컬 헤더를 앞에서부터 읽어 항목 이름·압축 방식 (STORED=0) */
export function zipEntries(bytes: Uint8Array): { name: string; method: number; extraLength: number }[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out = [];
  let p = 0;
  while (p + 30 <= bytes.length && view.getUint32(p, true) === 0x04034b50) {
    const flags = view.getUint16(p + 6, true);
    const method = view.getUint16(p + 8, true);
    let size = view.getUint32(p + 18, true);
    const nameLength = view.getUint16(p + 26, true);
    const extraLength = view.getUint16(p + 28, true);
    const name = new TextDecoder().decode(bytes.subarray(p + 30, p + 30 + nameLength));
    if (flags & 0x08) {
      // 데이터 뒤에 크기가 오는 형식: 다음 로컬 헤더를 찾는다
      let q = p + 30 + nameLength + extraLength;
      while (q + 4 <= bytes.length && view.getUint32(q, true) !== 0x04034b50 && view.getUint32(q, true) !== 0x02014b50) q++;
      size = q - (p + 30 + nameLength + extraLength);
    }
    out.push({ name, method, extraLength });
    p += 30 + nameLength + extraLength + size;
  }
  return out;
}

export async function unpack(bytes: Uint8Array) {
  const zip = await JSZip.loadAsync(bytes);
  const sectionXml = await zip.file('Contents/section0.xml')!.async('string');
  const headerXml = await zip.file('Contents/header.xml')!.async('string');
  const section = strictParse(sectionXml);
  const header = strictParse(headerXml);
  return { zip, sectionXml, headerXml, section, header };
}

export function elementsOf(root: Document | Element, name: string, ns = HP): Element[] {
  return Array.from(root.getElementsByTagNameNS(ns, name));
}

export function childrenOf(el: Element, name: string): Element[] {
  return Array.from(el.childNodes).filter((n): n is Element => n.nodeType === 1 && (n as Element).localName === name);
}

/** 글자를 품은 가장 안쪽 표 (바깥 표도 안쪽 표의 글자를 품고 있으므로 문서 순서상 마지막 것) */
export function innermostTable(section: Document, text: string): Element {
  const found = elementsOf(section, 'tbl').filter((t) => (t.textContent ?? '').includes(text));
  if (!found.length) throw new Error(`표를 찾지 못함: ${text}`);
  return found[found.length - 1];
}

/** 문항 표: '문항 번호' 머리글이 있는 표 */
export function itemTable(section: Document): Element {
  return innermostTable(section, '문항 번호');
}

/** 표 한 행의 칸 글자 */
export function rowTexts(tr: Element): string[] {
  return childrenOf(tr, 'tc').map((tc) => (tc.textContent ?? '').trim());
}

/** 문단 자신의 글자 (안쪽 표 제외) */
export function ownText(p: Element): string {
  return childrenOf(p, 'run')
    .flatMap((r) => childrenOf(r, 't'))
    .map((t) => t.textContent ?? '')
    .join('');
}
