// '예시 파일로 체험하기'로 전체 흐름을 브라우저에서 확인한다. samples/ 없이 돈다.
// 사용:
//   npm run build && node scripts/e2e-demo.mjs                 # 로컬 vite preview (GitHub Pages와 같은 base 경로)
//   node scripts/e2e-demo.mjs https://<사용자>.github.io/<저장소>/  # 배포된 주소
//   옵션 --readme-shots: README용 화면 캡처를 docs/images/에 저장
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';

const args = process.argv.slice(2);
const readmeShots = args.includes('--readme-shots');
const targetUrl = args.find((a) => a.startsWith('http'));
const expected = JSON.parse(readFileSync(resolve('tests/fixtures/demo-expected.json'), 'utf8'));

let failures = 0;
function check(name, actual, want) {
  const ok = JSON.stringify(actual) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `\n      기대: ${JSON.stringify(want)}\n      실제: ${JSON.stringify(actual)}`}`);
}

let server = null;
let url = targetUrl;
if (!url) {
  const { preview } = await import('vite');
  server = await preview({ preview: { port: 4181, strictPort: true }, logLevel: 'silent' });
  url = server.resolvedUrls.local[0];
}
console.log(`대상: ${url}`);

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, locale: 'ko-KR' });
const page = await context.newPage();
const consoleErrors = [];
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
page.on('pageerror', (e) => consoleErrors.push(String(e)));
const origin = new URL(url).origin;
const externalRequests = [];
page.on('request', (r) => {
  const u = r.url();
  if (!u.startsWith(origin) && !u.startsWith('data:') && !u.startsWith('blob:')) externalRequests.push(u);
});
const cellTexts = (selector) => page.$$eval(selector, (els) => els.map((e) => e.textContent.trim()));

try {
  await page.goto(url);
  check('앱 제목', await page.textContent('h1'), '정기시험 결과분석 협의록 작성 도우미');
  if (readmeShots) await page.screenshot({ path: 'docs/images/screenshot-start.png' });

  await page.click('text=예시 파일로 체험하기');
  await page.waitForFunction(
    (avg) => document.querySelector('.summary-card dl')?.textContent.includes(`${avg}점`),
    expected.summary.average,
    { timeout: 30000 },
  );
  check('체험 후 2단계로 이동', await page.evaluate(() => document.activeElement?.id), 'step-2-button');
  check('파일 칸 4개 모두 읽음', await page.$$eval('.slot--loaded', (e) => e.length), 4);
  check('2단계 경고 없음', await page.$$eval('#step-2-panel .issue', (e) => e.length), 0);
  const summary = Object.fromEntries(
    await page.$$eval('.summary-card dl > div', (divs) => divs.map((d) => [d.querySelector('dt').textContent, d.querySelector('dd').textContent])),
  );
  check('요약: 교과', summary['교과'], expected.meta.subjectName);
  check('요약: 응시자', summary['응시자'], `${expected.summary.examinees}명`);
  check('요약: 난이도 분포', summary['예상 난이도 (어려움/보통/쉬움)'], '6 / 12 / 6');

  await page.click('#step-3-button');
  await page.fill('#expected-average', '60');
  const levels = ['A', 'B', 'C', 'D', 'E', 'U'];
  check(
    '미리보기 성취수준 인원',
    await cellTexts('.pv-dist tbody tr:nth-child(1) td'),
    [...levels.map((l) => `${expected.levelCounts[l]}명`), `${expected.summary.examinees}명`],
  );

  await page.click('#step-4-button');
  await page.waitForSelector('.items-table');
  check('미리보기 차이 문항', await cellTexts('.pv-items tbody tr td:first-child'), expected.mismatches.map(String));
  await page.fill('.focus-card textarea', '예시 메모: 산화수 변화의 방향을 반대로 이해함');
  if (readmeShots) {
    // 마법사 칸만 스크롤 (scrollIntoView는 페이지 전체까지 움직인다)
    await page.$eval('.wizard', (w) => (w.scrollTop = document.getElementById('step-4-button').offsetTop - 8));
    await page.screenshot({ path: 'docs/images/screenshot-items.png' });
  }

  await page.click('#step-5-button');
  const average = await page.inputValue('#improvement-average');
  check('개선방안 (평균) 초안', average.includes(`실제 평균점수(${expected.summary.average}점)`) && average.includes('예상 평균점수(60점)'), true);
  check('개선방안 5문단이 미리보기에', (await cellTexts('.pv-improve__para')).filter(Boolean).length, 5);
  check('콘솔 오류 없음', consoleErrors, []);
  check('외부로 나간 요청 없음', externalRequests, []);
} catch (e) {
  failures++;
  console.error('FAIL  예외:', e);
} finally {
  await browser.close();
  await server?.close();
}
console.log(failures ? `\n실패 ${failures}건` : '\n모두 통과');
process.exit(failures ? 1 : 0);
