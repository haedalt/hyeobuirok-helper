// 공개용 가상 데모 파일 4종 생성 (public/demo/) + 정답값 (tests/fixtures/demo-expected.json)
//
// 실제 나이스 파일과 같은 셀 배치·병합·PDF 글자 좌표를 따르되, 학교·교사·IP·과목·성적은 모두 가상이다.
// 가상의 학생 답안을 먼저 만들고 거기서 4종을 계산하므로, 파일끼리 교차 검증이 맞아떨어진다.
//
// 사용: node scripts/make-demo.mjs <한글 TTF 글꼴 경로>
//   글꼴은 OFL 라이선스인 나눔고딕을 권장:
//   https://github.com/google/fonts/raw/main/ofl/nanumgothic/NanumGothic-Regular.ttf
import fontkit from '@pdf-lib/fontkit';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import * as XLSX from 'xlsx';

const fontPath = process.argv[2];
if (!fontPath) {
  console.error('사용: node scripts/make-demo.mjs <한글 TTF 글꼴 경로>');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 가상 설정
// ---------------------------------------------------------------------------
const SCHOOL = '한빛고등학교';
const TEACHER = '홍길동';
const STAMP = `${SCHOOL}/2026.10.28 11:42/192.0.***.10/${TEACHER}`; // 192.0.2.0/24는 문서용 예약 주소
const DATE = '2026.10.28.';
const YEAR = 2026;
const SEMESTER = 2;
const GRADE = 2;
const EXAM = '1차 정기시험';
const GROUP = '과학';
const SUBJECT = '화학 반응의 세계';
const CREDITS = 3;
const SUBJECT_RAW = `${GROUP}:${SUBJECT}(${CREDITS})`;
const ROOMS = [
  { name: '3A', code: 30301, size: 26, absent: 0 },
  { name: '3B', code: 30302, size: 25, absent: 1 },
  { name: '3C', code: 30303, size: 24, absent: 0 },
  { name: '3D', code: 30304, size: 23, absent: 2 },
];

/** 문항: 배점(합 100), 정답, 예상 난이도, 난이도 모수 b, 오답 가중치 */
const ITEMS = [
  // 쉬움으로 예상
  ['쉬움', -2.3], ['쉬움', -1.9], ['쉬움', -0.5], ['쉬움', -2.1], ['쉬움', -0.7], ['쉬움', -1.8],
  // 보통으로 예상
  ['보통', -0.2], ['보통', 0.3], ['보통', -0.6], ['보통', 0.6], ['보통', -2.6], ['보통', 0.1],
  ['보통', 0.4], ['보통', -0.3], ['보통', 2.3], ['보통', 0.5], ['보통', -0.1], ['보통', 0.2],
  // 어려움으로 예상
  ['어려움', 1.9], ['어려움', 0.4], ['어려움', 2.4], ['어려움', 1.4], ['어려움', 0.5], ['어려움', 2.2],
].map(([expected, b], i) => ({
  no: i + 1,
  points: i < 8 ? 3.5 : i < 16 ? 4.2 : 4.8,
  answer: [3, 2, 2, 5, 3, 4, 4, 1, 5, 3, 3, 2, 1, 5, 1, 1, 4, 3, 4, 2, 5, 5, 1, 2][i],
  expected,
  b,
  // 22번은 한 오답에 쏠리게 해서 '정답보다 많이 고른 오답' 사례를 만든다
  strongDistractor: i === 21 ? 0.75 : i % 5 === 0 ? 0.45 : 0,
  area: AREAS()[i % 6],
}));

function AREAS() {
  return [
    { name: '산과 염기', std: ['[12화반01-01]산과 염기의 정의를 비교하고, 생활 속', '물질을 산과 염기로 구분할 수 있다.'] },
    { name: '중화 반응', std: ['[12화반01-02]중화 반응의 양적 관계를 실험으로', '확인하고, 중화 반응이 이용되는 사례를', '조사하여 설명할 수 있다.'] },
    { name: '산화 환원', std: ['[12화반02-01]산화와 환원을 전자의 이동으로', '설명하고, 산화수 변화로 산화제와 환원', '제를 구별할 수 있다.'] },
    { name: '반응 속도', std: ['[12화반03-01]반응 속도에 영향을 주는 요인을', '탐구하고 그 결과를 설명할 수 있다.'] },
    { name: '화학 평형', std: ['[12화반03-02]가역 반응에서 화학 평형 상태를', '이해하고, 평형 이동의 원리를 적용하여', '현상을 설명할 수 있다.'] },
    { name: '전기 화학', std: ['[12화반02-02]화학 전지의 원리를 산화 환원', '반응으로 설명할 수 있다.'] },
  ];
}

/** 성적집계표의 다른 과목 열. lines는 PDF 머리글 줄바꿈, name은 엑셀 머리글 */
const OTHER_SUBJECTS = [
  { name: '국어:화법과 언어(4)', lines: ['국어:화법과', '언어(4)'], examinees: 246 },
  { name: '수학:미적분Ⅰ(4)', lines: ['수학:미적분', 'Ⅰ(4)'], examinees: 246 },
  { name: '영어:영어Ⅱ(4)', lines: ['영어:영어', 'Ⅱ(4)'], examinees: 247 },
  { name: '사회(역사/도덕포함):세계시민과 지리(3)', lines: ['사회(역사', '/도덕포함', '):세계시민', '과 지리(3)'], examinees: 122 },
  { name: '사회(역사/도덕포함):법과 사회(3)', lines: ['사회(역사', '/도덕포함', '):법과 사회', '(3)'], examinees: 109 },
  { name: '과학:물리학(3)', lines: ['과학:물리학', '(3)'], examinees: 73 },
  { name: '과학:생명과학(3)', lines: ['과학:생명', '과학(3)'], examinees: 109 },
];

// ---------------------------------------------------------------------------
// 가상 학생 답안 (고정 시드)
// ---------------------------------------------------------------------------
let seed = 20261028;
function rand() {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function normal() {
  return Math.sqrt(-2 * Math.log(rand() || 1e-9)) * Math.cos(2 * Math.PI * rand());
}

const students = [];
for (const room of ROOMS) {
  for (let k = 0; k < room.size - room.absent; k++) {
    const theta = normal() * 1.1 - 0.3;
    const answers = ITEMS.map((item) => {
      const r = rand();
      if (r < 0.006) return 0; // 무표기
      if (r < 0.009) return -1; // 중복표기
      const p = 0.2 + 0.8 / (1 + Math.exp(-1.7 * (theta - item.b)));
      if (rand() < p) return item.answer;
      const wrong = [1, 2, 3, 4, 5].filter((c) => c !== item.answer);
      if (item.strongDistractor && rand() < item.strongDistractor) return wrong[(item.no * 7) % 4];
      return wrong[Math.floor(rand() * 4)];
    });
    const score = round(ITEMS.reduce((s, item, i) => s + (answers[i] === item.answer ? item.points : 0), 0), 1);
    students.push({ room: room.name, homeroom: 1 + Math.floor(rand() * 10), answers, score });
  }
}

function round(x, d) {
  const f = 10 ** d;
  return Math.round(x * f + Number.EPSILON) / f;
}
const fix2 = (x) => x.toFixed(2);
const N = students.length;
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

// 문항 통계
const itemStats = ITEMS.map((item, i) => {
  const count = (list, value) => list.filter((s) => s.answers[i] === value).length;
  const inRoom = students.filter((s) => s.room === ROOMS[0].name);
  const choices = [1, 2, 3, 4, 5].map((c) => ({ room: count(inRoom, c), total: count(students, c) }));
  const blank = { room: count(inRoom, 0), total: count(students, 0) };
  const multiple = { room: count(inRoom, -1), total: count(students, -1) };
  const correct = choices[item.answer - 1];
  return {
    ...item,
    choices,
    blank,
    multiple,
    rateRoom: round((correct.room / inRoom.length) * 100, 2),
    rateTotal: round((correct.total / N) * 100, 2),
  };
});

// ---------------------------------------------------------------------------
// 엑셀 공통
// ---------------------------------------------------------------------------
/** 시트 범위가 B1부터 시작한다(실제 파일과 같음). r, c는 B1 기준 0부터 */
function makeSheet(ref) {
  const ws = { '!ref': ref, '!merges': [] };
  const set = (r, c, v) => {
    if (v === null || v === undefined) return;
    ws[XLSX.utils.encode_cell({ r, c: c + 1 })] = typeof v === 'number' ? { t: 'n', v } : { t: 's', v };
  };
  const merge = (r1, c1, r2, c2) => ws['!merges'].push({ s: { r: r1, c: c1 + 1 }, e: { r: r2, c: c2 + 1 } });
  return { ws, set, merge };
}
function writeBook(ws, path) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'sheet1');
  writeFileSync(path, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

// ---------------------------------------------------------------------------
// 도수분포표 (B1:O26)
// ---------------------------------------------------------------------------
function makeFrequency(path) {
  const { ws, set, merge } = makeSheet('B1:O26');
  set(1, 13, DATE);
  set(2, 3, '정기시험 도수분포표');
  merge(2, 3, 2, 10);
  set(4, 0, `${YEAR}학년도    ${SEMESTER}학기    주간 일반계    ${GRADE}학년`);
  merge(4, 0, 4, 14);
  set(6, 0, `고사 : ${EXAM}    교과목 : ${SUBJECT_RAW}    급간 : 10`);
  merge(6, 0, 6, 14);
  set(8, 0, '강의실\n점수');
  merge(8, 0, 9, 0);
  ROOMS.forEach((room, k) => {
    set(8, 1 + k, room.code);
    set(9, 1 + k, room.name);
  });
  const totalCol = 1 + ROOMS.length;
  set(8, totalCol, '합 계');
  set(9, totalCol, '합 계');
  for (let r = 8; r <= 22; r++) merge(r, totalCol, r, totalCol + 1);

  const bins = [];
  for (let lower = 90; lower >= 0; lower -= 10) bins.push(lower);
  bins.forEach((lower, k) => {
    const r = 10 + k;
    const inBin = (s) => (lower === 90 ? s.score >= 90 : s.score >= lower && s.score < lower + 10);
    set(r, 0, lower === 90 ? '90이상 ~ 100이하' : `${lower}이상 ~ ${lower + 10}미만`);
    ROOMS.forEach((room, j) => set(r, 1 + j, students.filter((s) => s.room === room.name && inBin(s)).length));
    set(r, totalCol, `${students.filter(inBin).length} 명`);
  });
  set(20, 0, '응시자');
  set(21, 0, '결시자');
  set(22, 0, '평   균');
  ROOMS.forEach((room, j) => {
    const scores = students.filter((s) => s.room === room.name).map((s) => s.score);
    set(20, 1 + j, `${scores.length} 명`);
    set(21, 1 + j, `${room.absent} 명`);
    set(22, 1 + j, round(mean(scores), 1));
  });
  set(22, totalCol, '');
  set(24, 6, 1);
  set(24, 7, '/');
  set(24, 9, 1);
  set(24, 12, SCHOOL);
  merge(24, 12, 24, 13);
  writeBook(ws, path);
}

// ---------------------------------------------------------------------------
// 문항분석표 (B1:V47) — 한 강의실 파일, 괄호 안이 학과 전체
// ---------------------------------------------------------------------------
function makeItemAnalysis(path) {
  const { ws, set, merge } = makeSheet('B1:V47');
  const pair = (p) => `${p.room}(${p.total})`;
  const rate = (room, total) => `${room.toFixed(2).padStart(7)}(${total.toFixed(2).padStart(7)})`;
  const COL = { no: 0, c1: 1, c2: 2, c3: 4, c4: 5, c5: 7, sum: 10, answer: 15, rate: 17, blank: 19, multiple: 20 };
  const header = (r) => {
    set(r, COL.no, '          답안번호\n문항번호');
    ['c1', 'c2', 'c3', 'c4', 'c5'].forEach((k, i) => set(r, COL[k], `${i + 1}번`));
    set(r, COL.sum, '합계');
    set(r, COL.answer, '정답');
    set(r, COL.rate, '정답률(%)');
    set(r, COL.blank, '무표기');
    set(r, COL.multiple, '중복표기');
    rowMerges(r);
  };
  const rowMerges = (r) => {
    merge(r, 2, r, 3);
    merge(r, 5, r, 6);
    merge(r, 7, r, 9);
    merge(r, 10, r, 14);
    merge(r, 15, r, 16);
    merge(r, 17, r, 18);
  };
  /** 나이스처럼 같은 값이 이어지는 무표기·중복표기 칸은 세로로 병합해 맨 위에만 값을 쓴다 */
  const verticalRuns = (rows, col, values) => {
    let start = 0;
    for (let k = 1; k <= values.length; k++) {
      if (k < values.length && values[k] === values[start]) continue;
      set(rows[start], col, values[start]);
      if (k - start > 1) merge(rows[start], col, rows[k - 1], col);
      start = k;
    }
  };
  const roomSize = students.filter((s) => s.room === ROOMS[0].name).length;
  const page = (headerRow, from, to) => {
    header(headerRow);
    const rows = [];
    for (let no = from; no <= to; no++) {
      const it = itemStats[no - 1];
      const r = headerRow + 1 + (no - from);
      rows.push(r);
      set(r, COL.no, no);
      ['c1', 'c2', 'c3', 'c4', 'c5'].forEach((k, i) => set(r, COL[k], pair(it.choices[i])));
      set(r, COL.sum, roomSize);
      set(r, COL.answer, it.answer);
      set(r, COL.rate, rate(it.rateRoom, it.rateTotal));
      rowMerges(r);
    }
    const items = itemStats.slice(from - 1, to);
    verticalRuns(rows, COL.blank, items.map((it) => pair(it.blank)));
    verticalRuns(rows, COL.multiple, items.map((it) => pair(it.multiple)));
  };

  set(1, 15, DATE);
  set(3, 3, '정기시험 문항분석표 조회');
  set(5, 0, `${YEAR}학년도   ${SEMESTER}학기   주간 일반계   ${GRADE}학년      ${ROOMS[0].name} 강의실`);
  set(7, 0, `고사 :  ${EXAM}   교과목 :  ${SUBJECT_RAW}`);
  set(7, 14, `교과담당교사 (${TEACHER}) 인`);
  set(9, 0, '※ ()안 숫자는 학과전체 응답인원 수에 대한 정보입니다.');
  page(11, 1, 16);
  set(29, 8, 1);
  set(29, 9, '/');
  set(29, 11, 2);
  set(29, 16, SCHOOL);
  set(31, 15, DATE);
  set(33, 14, `교과담당교사 (${TEACHER}) 인`);
  page(35, 17, 24);
  set(45, 8, 2);
  set(45, 9, '/');
  set(45, 11, 2);
  set(45, 16, SCHOOL);
  writeBook(ws, path);
}

// ---------------------------------------------------------------------------
// PDF 공통: 화면 좌표(왼쪽 위 원점)로 받아 pdf-lib 좌표로 바꿔 그린다
// ---------------------------------------------------------------------------
async function makePdf(width, height) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(readFileSync(fontPath), { subset: true });
  doc.setTitle('예시 자료 (가상)');
  doc.setProducer('hyeobuirok-helper demo');
  doc.setCreator('hyeobuirok-helper demo');
  const pages = [];
  const addPage = () => {
    const page = doc.addPage([width, height]);
    pages.push(page);
    return page;
  };
  const text = (page, str, x, y, size = 10) => page.drawText(str, { x, y: height - y, size, font });
  const widthOf = (str, size = 10) => font.widthOfTextAtSize(str, size);
  const center = (page, str, cx, y, size = 10) => text(page, str, cx - widthOf(str, size) / 2, y, size);
  const right = (page, str, rx, y, size = 10) => text(page, str, rx - widthOf(str, size), y, size);
  return { doc, addPage, text, center, right, widthOf };
}

// ---------------------------------------------------------------------------
// 문항정보표 (A4 세로)
// ---------------------------------------------------------------------------
async function makeItemInfo(path) {
  const { doc, addPage, text, center } = await makePdf(595, 842);
  const W = { hard: 432.9, normal: 457.2, easy: 481.5 };
  const LINE = 14.1;
  const BOTTOM = 772;
  const pageCount = 2;

  const footer = (page, n) => {
    text(page, String(n), 287.9, 796.7);
    text(page, '/', 308.4, 796.7);
    text(page, String(pageCount), 328.4, 796.7);
    text(page, SCHOOL, 491.3, 796.7);
    text(page, STAMP, 402.6, 829, 6);
  };

  let page = addPage();
  text(page, `( ${SUBJECT}(${CREDITS}) ) 과목`, 39.9, 53.2, 12);
  for (const [s, x] of [['계', 379.6], ['부 장', 421.9], ['교 감', 472], ['교 장', 522.2]]) text(page, s, x, 53.2);
  ['문', '항', '정', '보', '표'].forEach((s, k) => text(page, s, 47.7 + 32 * k, 81.6, 16));
  text(page, '(과목 코드 : 21)', 205.6, 81.6);
  text(page, `${YEAR}년도 ${SEMESTER}학기 ${EXAM}`, 74.3, 117.5);
  text(page, `${GRADE}학년`, 325.4, 117.5);
  text(page, `총 문항수 ${ITEMS.length} 문항`, 452.2, 117.5);
  text(page, `고사일시 ${YEAR}년 10월 16일 2교시`, 101.5, 140.5);
  text(page, '공동출제자', 333.4, 140.5);
  text(page, `${TEACHER} (인)`, 499.8, 140.5);
  text(page, '총점 100.00 점', 144, 163.1);
  text(page, '선택형 100.00 점', 360.6, 163.1);
  text(page, '서답형 0.00 점', 449.9, 163.1);
  text(page, '선택형 문항', 270.4, 183.7);
  center(page, '난이도', W.normal, 203.9);
  text(page, '문항번호', 43.9, 216.7);
  text(page, '내용영역', 113.1, 216.7);
  text(page, '성취기준', 277.6, 216.7);
  center(page, '배점', 506.1, 216.7);
  center(page, '정답', 539.2, 216.7);
  center(page, '어려', W.hard, 222.8, 9);
  center(page, '움', W.hard, 231.8, 9);
  center(page, '보통', W.normal, 227.3, 9);
  center(page, '쉬움', W.easy, 227.3, 9);

  // 성취기준 여러 줄 중 둘째 줄 높이에 번호·○·배점·정답 (샘플과 같음). 넘치면 다음 쪽으로 이어진다
  let y = 247;
  let pageNo = 1;
  for (const item of ITEMS) {
    const lines = item.area.std;
    const rowY = y + LINE;
    if (rowY > BOTTOM) {
      footer(page, pageNo++);
      page = addPage();
      y = 80;
    }
    const numberY = y + LINE;
    lines.forEach((line, k) => {
      let ly = y + LINE * k;
      if (ly > BOTTOM && pageNo === 1) {
        // 성취기준 글이 쪽을 넘어감
        footer(page, pageNo++);
        page = addPage();
        y = 80 - LINE * k;
        ly = 80;
      }
      text(page, line, 176.8, ly);
    });
    const p = page;
    center(p, String(item.no), 64.1, numberY);
    text(p, item.area.name, 96.8, numberY);
    center(p, '○', W[{ 어려움: 'hard', 보통: 'normal', 쉬움: 'easy' }[item.expected]], numberY);
    center(p, String(item.points), 506.1, numberY);
    center(p, String(item.answer), 539.3, numberY);
    y += LINE * (lines.length + 1);
  }
  const counts = { 어려움: 0, 보통: 0, 쉬움: 0 };
  ITEMS.forEach((item) => counts[item.expected]++);
  y += 8;
  center(page, '100.00', 506.1, y);
  text(page, '총합계', 213.5, y);
  center(page, String(counts['어려움']), W.hard, y);
  center(page, String(counts['보통']), W.normal, y);
  center(page, String(counts['쉬움']), W.easy, y);
  center(page, '-', 539.3, y);
  y += 20;
  text(page, '비율(%)', 211, y);
  for (const [k, cx] of [['어려움', W.hard], ['보통', W.normal], ['쉬움', W.easy]]) {
    center(page, String(Math.round((counts[k] / ITEMS.length) * 100)), cx, y);
  }
  center(page, '100', 506.1, y);
  center(page, '-', 539.3, y);
  footer(page, pageNo);
  writeFileSync(path, await doc.save());
}

// ---------------------------------------------------------------------------
// 성적집계표 (A4 가로) — 학년 모든 과목이 열
// ---------------------------------------------------------------------------
/** 성적집계표 열 8개: 다른 과목 값은 가상으로 만든다 (PDF·엑셀이 같은 값을 쓰도록 한 번만 만든다) */
function buildScoreColumns(summary) {
  const ours = { name: SUBJECT_RAW, lines: ['과학:화학', '반응의', `세계(${CREDITS})`], ...summary };
  const others = OTHER_SUBJECTS.map((s) => {
    const classAverages = Array.from({ length: 10 }, () => round(35 + rand() * 30, 1));
    return {
      ...s,
      classAverages,
      absentees: Math.floor(rand() * 3),
      max: [100, 98, 96.5][Math.floor(rand() * 3)],
      min: round(rand() * 9, 1),
      average: round(mean(classAverages), 1),
    };
  });
  return [...others.slice(0, 6), ours, others[6]];
}

async function makeScoreSummary(path, columns) {
  const { doc, addPage, text, center, right } = await makePdf(842, 595);
  const page = addPage();
  text(page, DATE, 762.9, 43.5);
  text(page, '정기시험 성적집계표', 327.6, 71.5, 20);
  for (const [s, x] of [[`${YEAR}학년도`, 52.3], [`${SEMESTER}학기`, 118.5], ['주간 일반계', 154.3], [`${GRADE}학년`, 217.6]]) text(page, s, x, 94.6);
  text(page, '고사 :', 52.3, 114.3);
  text(page, EXAM, 85.6, 114.3);
  text(page, '＊표시된 숫자는 반평균점수입니다.', 52.3, 133.6, 9);
  text(page, '교과목', 82.2, 159.6);
  text(page, '반', 52.3, 171.7);

  const ROW_Y = Array.from({ length: 10 }, (_, k) => 195.6 + 18.37 * k);
  const Y = { examinees: 379.3, absentees: 397.6, max: 416, min: 434.3, minExcl: 456.4, average: 478.5 };
  ROW_Y.forEach((y, k) => center(page, String(k + 1), 83.3, y));
  for (const [label, y] of [['응 시 자', Y.examinees], ['결 시 자', Y.absentees], ['최 고 점', Y.max], ['최 하 점', Y.min]]) text(page, label, 65, y);
  text(page, '최 하 점', 66.9, 451.4);
  text(page, '(전입생제외)', 57.5, 461.4, 9);
  text(page, '과목평균', 63.4, Y.average);

  columns.forEach((col, k) => {
    const cx = 143.95 + 54.94 * k;
    const top = 166.7 - ((col.lines.length - 1) * 10) / 2;
    col.lines.forEach((line, i) => center(page, line, cx, top + 10 * i));
    const rx = cx + 25.5;
    col.classAverages.forEach((v, i) => v !== null && right(page, v.toFixed(1), rx, ROW_Y[i]));
    right(page, `${col.examinees} 명`, rx, Y.examinees);
    right(page, `${col.absentees} 명`, rx, Y.absentees);
    right(page, fix2(col.max), rx, Y.max);
    right(page, fix2(col.min), rx, Y.min);
    right(page, fix2(col.min), rx, Y.minExcl);
    right(page, col.average.toFixed(1), rx, Y.average);
  });
  text(page, '1', 397.7, 558.9);
  text(page, '/', 418.8, 558.9);
  text(page, '1', 438.2, 558.9);
  text(page, SCHOOL, 758.8, 558.9);
  text(page, STAMP, 650.4, 583.4, 6);
  writeFileSync(path, await doc.save());
}

// ---------------------------------------------------------------------------
// 문항정보표 엑셀판 (B1:W46) — 실제 나이스 엑셀과 같은 배치. 12번 성취기준은 다음 쪽으로 넘어간다
// ---------------------------------------------------------------------------
function makeItemInfoXlsx(path) {
  const { ws, set, merge } = makeSheet('B1:W46');
  // makeSheet의 c는 B열 기준 0부터: B=0, C=1, D=2, … O=13, Q=15, S=17, T=18, V=20
  const COL = { no: 0, area: 1, std: 2, hard: 13, normal: 15, easy: 17, points: 18, answer: 20 };
  const LEVEL_COL = { 어려움: COL.hard, 보통: COL.normal, 쉬움: COL.easy };
  const rowMerges = (r) => {
    merge(r, COL.std, r, 12);
    merge(r, COL.hard, r, 14);
    merge(r, COL.normal, r, 16);
    merge(r, COL.points, r, 19);
    merge(r, COL.answer, r, 21);
  };
  const footer = (r, n) => {
    set(r, 5, n);
    set(r, 6, '/');
    set(r, 7, 2);
    set(r, 10, SCHOOL);
  };
  set(1, 0, `( ${SUBJECT}(${CREDITS}) ) 과목`);
  for (const [c, s] of [[10, '계'], [12, '부 장'], [16, '교 감'], [19, '교 장']]) set(2, c, s);
  set(4, 0, ' 문  항  정  보  표');
  set(4, 3, '(과목 코드 : 21)');
  set(7, 0, `${YEAR}년도 ${SEMESTER}학기 ${EXAM}`);
  set(7, 4, ` ${GRADE}학년 `);
  set(7, 14, `총 문항수 ${ITEMS.length} 문항`);
  set(8, 0, `고사일시 ${YEAR}년 10월 16일 2교시`);
  set(8, 7, '공동출제자');
  set(8, 11, `${TEACHER} (인)`);
  set(9, 0, '총점 100.00 점');
  set(9, 7, '선택형 100.00 점  서답형 0.00 점');
  set(10, 0, '선택형 문항');
  set(11, COL.no, '문항번호');
  set(11, COL.area, '내용영역');
  set(11, COL.std, '성취기준');
  set(11, COL.hard, '난이도');
  set(11, COL.points, '배점');
  set(11, COL.answer, '정답');
  merge(11, COL.no, 12, COL.no);
  merge(11, COL.area, 12, COL.area);
  merge(11, COL.std, 12, 12);
  merge(11, COL.hard, 11, 17);
  merge(11, COL.points, 12, 19);
  merge(11, COL.answer, 12, 21);
  set(12, COL.hard, '어려움');
  set(12, COL.normal, '보통');
  set(12, COL.easy, '쉬움');
  merge(12, COL.hard, 12, 14);
  merge(12, COL.normal, 12, 16);

  const PAGE1 = 12;
  let r = 13;
  for (const item of ITEMS) {
    const std = item.area.std.join('');
    set(r, COL.no, item.no);
    set(r, COL.area, item.area.name);
    if (item.no === PAGE1) {
      // 쪽 경계: 성취기준 앞부분만 이 행에, 나머지는 다음 쪽 첫 줄 (번호 칸은 비어 있음)
      set(r, COL.std, item.area.std[0]);
      footer(r + 2, 1);
      set(r + 4, COL.std, item.area.std.slice(1).join(''));
      merge(r + 4, COL.std, r + 4, 12);
    } else {
      set(r, COL.std, std);
    }
    set(r, LEVEL_COL[item.expected], '○');
    set(r, COL.points, item.points);
    set(r, COL.answer, item.answer);
    rowMerges(r);
    r += item.no === PAGE1 ? 5 : 1;
  }
  const counts = { 어려움: 0, 보통: 0, 쉬움: 0 };
  ITEMS.forEach((item) => counts[item.expected]++);
  set(r, COL.no, '총합계');
  for (const [k, c] of Object.entries(LEVEL_COL)) set(r, c, counts[k]);
  set(r, COL.points, 100);
  set(r, COL.answer, '-');
  set(r + 1, COL.no, '비율(%)');
  for (const [k, c] of Object.entries(LEVEL_COL)) set(r + 1, c, Math.round((counts[k] / ITEMS.length) * 100));
  set(r + 1, COL.points, 100);
  set(r + 1, COL.answer, '-');
  footer(r + 3, 2);
  writeBook(ws, path);
}

// ---------------------------------------------------------------------------
// 성적집계표 엑셀판 (B1:V31) — 과목 열은 병합 칸 여러 개에 걸친다
// ---------------------------------------------------------------------------
function makeScoreSummaryXlsx(path, columns) {
  const { ws, set, merge } = makeSheet('B1:V31');
  set(1, 15, DATE);
  set(3, 5, '정기시험 성적집계표');
  merge(3, 5, 3, 17);
  set(5, 0, `${YEAR}학년도    ${SEMESTER}학기   주간 일반계   ${GRADE}학년`);
  merge(5, 0, 5, 19);
  set(7, 0, `고사 :  ${EXAM}`);
  merge(7, 0, 7, 7);
  set(9, 0, '＊표시된 숫자는 반평균점수입니다.');
  merge(9, 0, 9, 2);
  set(11, 0, '         교과목\n반');
  // 과목 열 위치와 병합 폭 (실제 양식처럼 1~3칸)
  const SPANS = [[1, 1], [2, 2], [4, 2], [6, 1], [7, 2], [9, 3], [12, 2], [14, 3]];
  const ROWS = { examinees: 22, absentees: 23, max: 24, min: 25, minExcl: 26, average: 27 };
  for (let k = 0; k < 10; k++) set(12 + k, 0, k + 1);
  set(ROWS.examinees, 0, '응 시 자');
  set(ROWS.absentees, 0, '결 시 자');
  set(ROWS.max, 0, '최 고 점');
  set(ROWS.min, 0, '최 하 점');
  set(ROWS.minExcl, 0, '최 하 점\n(전입생제외)');
  set(ROWS.average, 0, '과목평균');
  columns.forEach((col, k) => {
    const [c, span] = SPANS[k];
    const cell = (r, v) => {
      set(r, c, v);
      if (span > 1) merge(r, c, r, c + span - 1);
    };
    cell(11, col.name);
    col.classAverages.forEach((v, i) => v !== null && cell(12 + i, v));
    cell(ROWS.examinees, `${col.examinees} 명`);
    cell(ROWS.absentees, `${col.absentees} 명`);
    cell(ROWS.max, col.max);
    cell(ROWS.min, col.min);
    cell(ROWS.minExcl, col.min);
    cell(ROWS.average, col.average);
  });
  set(29, 9, 1);
  set(29, 10, '/');
  set(29, 11, 1);
  set(29, 16, SCHOOL);
  merge(29, 16, 29, 20);
  writeBook(ws, path);
}

// ---------------------------------------------------------------------------
// 실행
// ---------------------------------------------------------------------------
const outDir = resolve('public/demo');
mkdirSync(outDir, { recursive: true });
mkdirSync(resolve('tests/fixtures'), { recursive: true });

const scores = students.map((s) => s.score);
const summary = {
  examinees: N,
  absentees: ROOMS.reduce((a, r) => a + r.absent, 0),
  max: Math.max(...scores),
  min: Math.min(...scores),
  average: round(mean(scores), 1),
  classAverages: Array.from({ length: 10 }, (_, k) => {
    const xs = students.filter((s) => s.homeroom === k + 1).map((s) => s.score);
    return xs.length ? round(mean(xs), 1) : null;
  }),
};

// 체험용은 엑셀 4종(권장 형식). PDF판은 예비 경로 테스트용으로 tests/fixtures/에 둔다
const pdfDir = resolve('tests/fixtures/demo-pdf');
mkdirSync(pdfDir, { recursive: true });
makeFrequency(resolve(outDir, '예시_도수분포표.xlsx'));
makeItemAnalysis(resolve(outDir, '예시_문항분석표.xlsx'));
makeItemInfoXlsx(resolve(outDir, '예시_문항정보표.xlsx'));
await makeItemInfo(resolve(pdfDir, '예시_문항정보표.pdf'));
const scoreColumns = buildScoreColumns(summary);
makeScoreSummaryXlsx(resolve(outDir, '예시_성적집계표.xlsx'), scoreColumns);
await makeScoreSummary(resolve(pdfDir, '예시_성적집계표.pdf'), scoreColumns);

// 정답값: 파서·계산과 무관하게 가상 학생 답안에서 직접 구한 값
const levelOf = (s) => (s >= 90 ? 'A' : s >= 80 ? 'B' : s >= 70 ? 'C' : s >= 60 ? 'D' : s >= 40 ? 'E' : 'U');
const levelCounts = { A: 0, B: 0, C: 0, D: 0, E: 0, U: 0 };
scores.forEach((s) => levelCounts[levelOf(s)]++);
const actualOf = (rate) => (rate < 25 ? '어려움' : rate >= 75 ? '쉬움' : '보통');
const expected = {
  meta: { schoolYear: YEAR, semester: SEMESTER, grade: GRADE, examName: EXAM, subjectRaw: SUBJECT_RAW, subjectName: SUBJECT, credits: CREDITS },
  title: `${GRADE}학년 ${SUBJECT}`,
  rooms: ROOMS.map((r) => ({
    name: r.name,
    examinees: r.size - r.absent,
    absentees: r.absent,
    average: round(mean(students.filter((s) => s.room === r.name).map((s) => s.score)), 1),
    levelA: students.filter((s) => s.room === r.name && s.score >= 90).length,
  })),
  summary,
  levelCounts,
  items: itemStats.map((it) => ({
    no: it.no,
    answer: it.answer,
    points: it.points,
    expected: it.expected,
    actual: actualOf(it.rateTotal),
    rate: it.rateTotal,
    responses: it.choices.map((c) => c.total),
    blank: it.blank.total,
    multiple: it.multiple.total,
  })),
};
expected.mismatches = expected.items.filter((i) => i.expected !== i.actual).map((i) => i.no);
writeFileSync(resolve('tests/fixtures/demo-expected.json'), JSON.stringify(expected, null, 2) + '\n');

console.log(`학생 ${N}명, 평균 ${summary.average}, 최고 ${summary.max}, 최하 ${summary.min}`);
console.log('성취수준', levelCounts);
console.log('차이 문항', expected.mismatches.join(', '));
console.log('문항별 실제 난이도', expected.items.map((i) => `${i.no}:${i.expected[0]}→${i.actual[0]}(${i.rate})`).join(' '));
