// PDF 글자 좌표 덤프 (화면 좌표, 회전 반영). 사용: node scripts/pdf-dump.mjs <파일.pdf> [쪽]
import { getDocument, Util } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { readFileSync } from 'node:fs';
const [file, pageArg] = process.argv.slice(2);
const doc = await getDocument({ data: new Uint8Array(readFileSync(file)) }).promise;
for (let p = 1; p <= doc.numPages; p++) {
  if (pageArg && Number(pageArg) !== p) continue;
  const page = await doc.getPage(p);
  const vp = page.getViewport({ scale: 1 });
  const tc = await page.getTextContent();
  console.log(`=== page ${p} rotate ${page.rotate} view ${vp.width}x${vp.height}`);
  const sample = tc.items.find((i) => i.str.trim());
  console.log('sample raw transform', sample.str, sample.transform, 'w', sample.width, 'h', sample.height);
  const items = tc.items.filter((i) => i.str.trim() !== '').map((i) => {
    const m = Util.transform(vp.transform, i.transform);
    return { s: i.str, x: +m[4].toFixed(1), y: +m[5].toFixed(1), dir: `${m[0].toFixed(0)},${m[1].toFixed(0)}`, w: +i.width.toFixed(1) };
  });
  items.sort((a, b) => a.y - b.y || a.x - b.x);
  let lastY = null, line = [];
  const flush = () => { if (line.length) console.log(`y=${lastY}: ` + line.map((i) => `[${i.x}+${i.w}${i.dir === line[0].dir ? '' : ' d' + i.dir}]${i.s}`).join(' ') + ` (dir ${line[0].dir})`); line = []; };
  for (const i of items) { if (lastY === null || Math.abs(i.y - lastY) > 2) { flush(); lastY = i.y; } line.push(i); }
  flush();
}
