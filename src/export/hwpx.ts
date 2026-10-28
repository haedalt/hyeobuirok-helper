/**
 * HWPX 협의록 생성 (PRD 8장). templates/협의록_양식.hwpx의 표시어({{F3_AVG}} 등, PRD 4-1)를 값으로 바꾼다.
 * 브라우저와 Node(테스트) 양쪽에서 같은 코드로 돈다: XML은 @xmldom/xmldom, 압축은 JSZip.
 */
import { DOMParser, XMLSerializer, type Document, type Element, type Node } from '@xmldom/xmldom';
import JSZip from 'jszip';
import {
  ACHIEVEMENT_LEVELS,
  choiceSymbol,
  formatPercent,
  formatRate,
  formatScore,
  PERCENT_TOTAL_LABEL,
  type CutMode,
  type ImprovementKey,
  type ItemAnalysis,
} from '../core';
import { missingForHwpx, type HwpxInput } from './hwpxInput';

export { hwpxFileName, missingForHwpx, type HwpxInput } from './hwpxInput';

const HP = 'http://www.hancom.co.kr/hwpml/2011/paragraph';
const HH = 'http://www.hancom.co.kr/hwpml/2011/head';
const SECTION = 'Contents/section0.xml';
const HEADER = 'Contents/header.xml';
const PREVIEW_TEXT = 'Preview/PrvText.txt';
/** 원본 패키지에서 압축하지 않고 저장된 항목 (OWPML: mimetype은 반드시 맨 앞·무압축) */
const STORED = new Set(['mimetype', 'version.xml', 'Preview/PrvImage.png']);
const RED = '#FF0000';
const BLACK = '#000000';

/** 선택 표시어가 비었을 때 되돌릴 원래 양식 글자 */
const OPTIONAL_FALLBACK = { SUBJ_HEAD: 'OO', SUBJ_AGENDA: '     ', PLACE: '', ATTENDEES: '' } as const;

const IMP_MARKERS: Record<ImprovementKey, string> = {
  average: 'IMP_AVG',
  maxMin: 'IMP_MAXMIN',
  distribution: 'IMP_DIST',
  levelA: 'IMP_A',
  itemGap: 'IMP_ITEM',
};

/**
 * 템플릿 HWPX에 값을 채운 새 HWPX(zip 바이트)를 만든다.
 * 템플릿 구조가 예상과 다르면(표시어 없음 등) 잘못된 파일을 만들지 않고 예외를 던진다.
 */
export async function buildHwpx(template: ArrayBuffer | Uint8Array, input: HwpxInput): Promise<Uint8Array> {
  const missing = missingForHwpx(input);
  if (missing.length) throw new Error(`내보내기에 필요한 값이 없습니다: ${missing.join(', ')}`);

  const zip = await JSZip.loadAsync(template);
  const sectionText = await zip.file(SECTION)?.async('string');
  const headerText = await zip.file(HEADER)?.async('string');
  if (!sectionText || !headerText) throw new Error('협의록 양식(HWPX)에서 본문 또는 머리 정보를 찾지 못했습니다.');

  const sec = parseXml(sectionText);
  const head = parseXml(headerText);

  removeUnusedBlock(sec, input.mode);
  fillItemRows(sec, input.numbers.mismatchItems, Boolean(input.responsePercents));
  fillImprovements(sec, input.improvements);
  const values = fieldValues(input);
  for (const p of elements(sec, 'p')) replaceMarkers(p, (name) => values[name]);

  const leftover = elements(sec, 'p').flatMap((p) => [...paragraphText(p).matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]));
  if (leftover.length) throw new Error(`양식에 처리하지 못한 표시어가 있습니다: ${[...new Set(leftover)].join(', ')}`);

  if (input.blackText) recolorRedToBlack(sec, head);

  const out = new JSZip();
  // 원본 항목 순서와 압축 방식을 그대로 지킨다
  for (const name of Object.keys(zip.files)) {
    const file = zip.files[name];
    if (file.dir) continue;
    let content: string | Uint8Array;
    if (name === SECTION) content = serialize(sec, sectionText);
    else if (name === HEADER) content = serialize(head, headerText);
    else if (name === PREVIEW_TEXT) content = previewText(sec);
    else content = await file.async('uint8array');
    out.file(name, content, { compression: STORED.has(name) ? 'STORE' : 'DEFLATE', date: file.date, createFolders: false });
  }
  return out.generateAsync({ type: 'uint8array', mimeType: 'application/hwp+zip' });
}

// ---------------------------------------------------------------------------
// 값
// ---------------------------------------------------------------------------

function fieldValues(input: HwpxInput): Record<string, string> {
  const n = input.numbers;
  const d = n.distribution!;
  const values: Record<string, string> = {
    F1_TITLE: n.title!,
    F2_EXP_AVG: formatScore(input.expectedAverage!),
    F3_AVG: formatScore(n.actualAverage!),
    SUBJ_HEAD: input.subjectHead?.trim() || OPTIONAL_FALLBACK.SUBJ_HEAD,
    SUBJ_AGENDA: input.subjectHead?.trim() || OPTIONAL_FALLBACK.SUBJ_AGENDA,
    PLACE: input.place?.trim() || OPTIONAL_FALLBACK.PLACE,
    ATTENDEES: input.attendees?.trim() || OPTIONAL_FALLBACK.ATTENDEES,
  };
  const prefix = d.mode === 'fixed' ? 'FIX' : 'EST';
  for (const level of ACHIEVEMENT_LEVELS) {
    values[`${prefix}_N_${level}`] = `${d.counts[level]}명`;
    values[`${prefix}_P_${level}`] = formatPercent(d.percents[level]);
    if (d.mode === 'estimated') values[`EST_BIN_${level}`] = d.bins[level];
  }
  values[`${prefix}_N_SUM`] = `${d.total}명`;
  values[`${prefix}_P_SUM`] = PERCENT_TOTAL_LABEL;
  if (d.mode === 'estimated') {
    const c = d.cutScores;
    Object.assign(values, {
      CUT_AB: formatScore(c.ab),
      CUT_BC: formatScore(c.bc),
      CUT_CD: formatScore(c.cd),
      CUT_DE: formatScore(c.de),
      CUT_EU: formatScore(c.eu),
    });
  }
  return values;
}

function itemValues(item: ItemAnalysis): Record<string, string> {
  const values: Record<string, string> = {
    Q_NO: String(item.no),
    Q_EXP: item.expected ?? '',
    Q_RATE: formatRate(item.correctRate),
    Q_ANS: choiceSymbol(item.answer),
  };
  item.responses.forEach((count, i) => (values[`Q_R${i + 1}`] = String(count)));
  return values;
}

// ---------------------------------------------------------------------------
// XML 도우미
// ---------------------------------------------------------------------------

function parseXml(text: string): Document {
  return new DOMParser({
    onError: (level, message) => {
      if (level !== 'warning') throw new Error(`협의록 양식 XML을 읽지 못했습니다: ${message}`);
    },
  }).parseFromString(text, 'text/xml');
}

/** xmldom은 XML 선언을 버리므로 원본 선언을 다시 붙인다 */
function serialize(doc: Document, original: string): string {
  const body = new XMLSerializer().serializeToString(doc).replace(/^<\?xml[^>]*\?>\s*/, '');
  const decl = /^<\?xml[^>]*\?>/.exec(original)?.[0] ?? '<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>';
  return decl + body;
}

function elements(root: Document | Element, localName: string, ns = HP): Element[] {
  return Array.from(root.getElementsByTagNameNS(ns, localName));
}

function children(el: Element, localName?: string): Element[] {
  return Array.from(el.childNodes).filter(
    (n): n is Element => n.nodeType === 1 && (!localName || (n as Element).localName === localName),
  );
}

/** 문단 자신의 글자 (안에 든 표의 글자는 제외) */
function paragraphText(p: Element): string {
  return textNodesOf(p).map((t) => t.textContent ?? '').join('');
}

function textNodesOf(p: Element): Element[] {
  return children(p, 'run').flatMap((run) => children(run, 't'));
}

/** 문단 안 어디든(안쪽 표 포함) 표시어가 있는가 */
function containsMarker(el: Element, name: string): boolean {
  return (el.textContent ?? '').includes(`{{${name}}}`);
}

function findParagraph(sec: Document, name: string): Element {
  const p = elements(sec, 'p').find((x) => paragraphText(x).includes(`{{${name}}}`));
  if (!p) throw new Error(`협의록 양식에서 {{${name}}} 표시어를 찾지 못했습니다.`);
  return p;
}

/**
 * 문단의 표시어를 값으로 바꾼다. 표시어가 글자 덩어리(<hp:t>) 여러 개에 걸쳐 있어도 이어 붙여 찾고,
 * 값은 표시어가 시작하는 덩어리에 넣어 그 글자모양(빨강/검정)을 유지한다.
 * lookup이 undefined를 돌려주는 표시어는 그대로 둔다.
 */
function replaceMarkers(p: Element, lookup: (name: string) => string | undefined): void {
  const ts = textNodesOf(p);
  const segs = ts.map((t) => ({ t, text: t.textContent ?? '' }));
  const full = segs.map((s) => s.text).join('');
  const matches = [...full.matchAll(/\{\{(\w+)\}\}/g)].filter((m) => lookup(m[1]) !== undefined);
  if (matches.length === 0) return;

  // 뒤에서부터 바꿔야 앞쪽 위치가 흔들리지 않는다
  for (const m of matches.reverse()) {
    const start = m.index!;
    const end = start + m[0].length;
    let pos = 0;
    let first = true;
    for (const seg of segs) {
      const segStart = pos;
      const segEnd = pos + seg.text.length;
      pos = segEnd;
      if (segEnd <= start || segStart >= end) continue;
      const localStart = Math.max(start, segStart) - segStart;
      const localEnd = Math.min(end, segEnd) - segStart;
      seg.text = seg.text.slice(0, localStart) + (first ? lookup(m[1])! : '') + seg.text.slice(localEnd);
      first = false;
    }
  }
  segs.forEach((s) => setText(s.t, s.text));
  clearLineSegments(p);
}

/** <hp:t> 내용을 글자 하나로 바꾼다 (XML 특수문자는 직렬화할 때 이스케이프된다) */
function setText(t: Element, text: string): void {
  while (t.firstChild) t.removeChild(t.firstChild);
  if (text) t.appendChild(t.ownerDocument!.createTextNode(text));
}

/** 글자가 바뀐 문단의 줄 배치 정보는 틀리므로 지운다. 한/글이 열 때 다시 계산한다 */
function clearLineSegments(p: Element): void {
  for (const seg of children(p, 'linesegarray')) p.removeChild(seg);
}

// ---------------------------------------------------------------------------
// 나. 분할 방식 블록 (PRD F10): 쓰는 블록 하나만 남기고 {{OR}} 문단은 지운다
// ---------------------------------------------------------------------------

function removeUnusedBlock(sec: Document, mode: CutMode): void {
  const or = findParagraph(sec, 'OR');
  const siblings = children(or.parentNode as Element, 'p');
  const at = siblings.indexOf(or);

  // {{OR}} 앞: '○ …추정분할점수' 제목 문단부터 {{OR}} 직전(추정분할 표, *분할점수 문장)까지
  const estStart = siblings.slice(0, at).findLastIndex((p) => paragraphText(p).includes('추정분할점수'));
  // {{OR}} 뒤: '○ …고정분할점수' 제목 문단부터 고정분할 표가 든 문단까지
  const fixEnd = siblings.findIndex((p, i) => i > at && containsMarker(p, 'FIX_N_A'));
  const estBlock = siblings.slice(estStart, at);
  const fixBlock = siblings.slice(at + 1, fixEnd + 1);

  const ok =
    estStart >= 0 &&
    fixEnd > at &&
    estBlock.some((p) => containsMarker(p, 'EST_N_A')) &&
    estBlock.some((p) => containsMarker(p, 'CUT_AB')) &&
    paragraphText(fixBlock[0]).includes('고정분할점수');
  if (!ok) throw new Error('협의록 양식의 추정분할/고정분할 블록 구조가 예상과 다릅니다.');

  for (const p of [...(mode === 'fixed' ? estBlock : fixBlock), or]) p.parentNode!.removeChild(p);
}

// ---------------------------------------------------------------------------
// 다. 차이 문항 표: {{Q_NO}} 행을 문항 수만큼 복제 (F11~F15, F14b)
// ---------------------------------------------------------------------------

function fillItemRows(sec: Document, items: ItemAnalysis[], withPercents: boolean): void {
  // 표시어 문단에서 가장 가까운 행. (바깥 표의 '협의내용' 행도 안쪽 표 글자를 품고 있어 글자로 찾으면 안 된다)
  let template: Element | null = findParagraph(sec, 'Q_NO');
  while (template && template.localName !== 'tr') template = template.parentNode as Element | null;
  if (!template) throw new Error('협의록 양식에서 문항 표의 {{Q_NO}} 행을 찾지 못했습니다.');
  const tbl = template.parentNode as Element;
  const rowsBefore = children(tbl, 'tr');
  const headerRows = rowsBefore.slice(0, rowsBefore.indexOf(template));
  const rowHeight = Math.max(...children(template, 'tc').map((tc) => Number(attr(tc, 'cellSz', 'height')) || 0));

  const newRows: Element[] = [];
  if (items.length === 0) {
    const row = template.cloneNode(true) as Element;
    fillRow(row, { Q_NO: '-', Q_EXP: '해당 문항 없음', Q_RATE: '', Q_R1: '', Q_R2: '', Q_R3: '', Q_R4: '', Q_R5: '', Q_ANS: '' });
    newRows.push(row);
  }
  for (const item of items) {
    const row = template.cloneNode(true) as Element;
    fillRow(row, itemValues(item));
    newRows.push(row);
    if (withPercents) {
      // 백분율 행: ①~⑤ 칸만. 번호·예상 난이도·정답률·정답 칸은 두 행에 걸쳐 합친다
      const pct = template.cloneNode(true) as Element;
      for (const tc of children(pct, 'tc')) {
        const col = Number(attr(tc, 'cellAddr', 'colAddr'));
        if (col < 3 || col > 7) pct.removeChild(tc);
      }
      const values: Record<string, string> = {};
      item.responsePercents.forEach((v, i) => (values[`Q_R${i + 1}`] = formatPercent(v)));
      fillRow(pct, values);
      for (const tc of children(row, 'tc')) {
        const col = Number(attr(tc, 'cellAddr', 'colAddr'));
        if (col < 3 || col > 7) {
          children(tc, 'cellSpan')[0].setAttribute('rowSpan', '2');
          children(tc, 'cellSz')[0].setAttribute('height', String(rowHeight * 2));
        }
      }
      newRows.push(pct);
    }
  }
  for (const row of newRows) tbl.insertBefore(row, template);
  tbl.removeChild(template);

  // 행 위치·행 수·표 높이 다시 계산
  const rows = children(tbl, 'tr');
  rows.forEach((tr, r) => children(tr, 'tc').forEach((tc) => children(tc, 'cellAddr')[0].setAttribute('rowAddr', String(r))));
  tbl.setAttribute('rowCnt', String(rows.length));
  const sz = children(tbl, 'sz')[0];
  if (sz) {
    const headerHeight = Number(sz.getAttribute('height')) - rowHeight;
    sz.setAttribute('height', String(headerHeight + rowHeight * (rows.length - headerRows.length)));
  }
  // 쪽이 넘어가도 머리글이 다시 나오게 (양식은 repeatHeader=1이지만 머리글 칸 지정이 빠져 있음)
  tbl.setAttribute('repeatHeader', '1');
  for (const tr of headerRows) for (const tc of children(tr, 'tc')) tc.setAttribute('header', '1');
}

function fillRow(row: Element, values: Record<string, string>): void {
  for (const p of Array.from(row.getElementsByTagNameNS(HP, 'p'))) replaceMarkers(p, (name) => values[name]);
}

function attr(el: Element, child: string, name: string): string | null {
  return children(el, child)[0]?.getAttribute(name) ?? null;
}

// ---------------------------------------------------------------------------
// 개선방안 (F16~F20): 문단 하나씩. 줄바꿈은 같은 모양의 문단을 복제해 나눈다
// ---------------------------------------------------------------------------

function fillImprovements(sec: Document, texts: Record<ImprovementKey, string | null>): void {
  for (const [key, marker] of Object.entries(IMP_MARKERS) as [ImprovementKey, string][]) {
    const p = findParagraph(sec, marker);
    const lines = (texts[key] ?? '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) {
      p.parentNode!.removeChild(p);
      continue;
    }
    const blank = p.cloneNode(true) as Element;
    replaceMarkers(p, (name) => (name === marker ? lines[0] : undefined));
    let after: Node = p;
    for (const line of lines.slice(1)) {
      const copy = blank.cloneNode(true) as Element;
      replaceMarkers(copy, (name) => (name === marker ? line : undefined));
      p.parentNode!.insertBefore(copy, after.nextSibling);
      after = copy;
    }
  }
}

// ---------------------------------------------------------------------------
// 빨강 → 검정 옵션: 빨간 글자모양을 복제해 색만 검정으로 바꾼 것을 추가하고 바꿔 쓴다
// ---------------------------------------------------------------------------

function recolorRedToBlack(sec: Document, head: Document): void {
  const list = elements(head, 'charProperties', HH)[0];
  const charPrs = elements(head, 'charPr', HH);
  const byId = new Map(charPrs.map((c) => [c.getAttribute('id')!, c]));
  let nextId = Math.max(...charPrs.map((c) => Number(c.getAttribute('id')))) + 1;
  const blackOf = new Map<string, string>();

  for (const run of elements(sec, 'run')) {
    const id = run.getAttribute('charPrIDRef');
    const cp = id === null ? undefined : byId.get(id);
    if (!cp || cp.getAttribute('textColor')?.toUpperCase() !== RED) continue;
    if (!blackOf.has(id!)) {
      const clone = cp.cloneNode(true) as Element;
      clone.setAttribute('id', String(nextId));
      clone.setAttribute('textColor', BLACK);
      list.appendChild(clone);
      blackOf.set(id!, String(nextId++));
    }
    run.setAttribute('charPrIDRef', blackOf.get(id!)!);
  }
  list.setAttribute('itemCnt', String(children(list, 'charPr').length));
}

// ---------------------------------------------------------------------------
// 탐색기 미리보기 글자 (Preview/PrvText.txt): 채운 본문으로 다시 만든다
// ---------------------------------------------------------------------------

function previewText(sec: Document): string {
  const out: string[] = [];
  const walk = (p: Element) => {
    out.push(paragraphText(p));
    for (const tbl of children(p, 'run').flatMap((r) => children(r, 'tbl'))) {
      for (const tr of children(tbl, 'tr')) {
        const cells = children(tr, 'tc').map((tc) => {
          const inner: string[] = [];
          const saved = out.length;
          for (const cp of children(children(tc, 'subList')[0], 'p')) walk(cp);
          inner.push(...out.splice(saved));
          return `<${inner.join(' ').trim()}>`;
        });
        out.push(cells.join('') + '\r\n');
      }
    }
  };
  for (const p of children(sec.documentElement!, 'p')) walk(p);
  return out.join('').slice(0, 1024);
}
