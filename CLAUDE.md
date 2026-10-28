# 정기시험 결과분석 협의록 작성 도우미

교사가 나이스 자료 4종(엑셀 2·PDF 2)을 올리면 협의록 양식의 빨간 글씨 칸을 채운 HWPX 초안을 만들어 주는, 서버 없는 정적 웹앱.

**요구사항의 기준은 `docs/PRD.md`다** (실제 시험 수치가 들어 있어 저장소에 올리지 않는 로컬 전용 파일). 구현·판단이 PRD와 어긋나면 PRD를 따르고, PRD에 없거나 모호하면 사용자에게 묻는다.

## 기술 스택

Vite + React + TypeScript, Vitest. 엑셀은 SheetJS(공식 CDN 배포판 `xlsx-0.20.3`, npm 레지스트리 버전 아님), PDF는 `pdfjs-dist`(legacy 빌드, 브라우저·Node 공용), HWPX는 JSZip. 배포는 GitHub Pages(`.github/workflows/deploy.yml`, `vite.config.ts`의 `base`가 저장소 이름).

## 폴더 구조

| 경로 | 책임 |
| --- | --- |
| `src/core/` | 계산·판정. UI·파일 형식과 무관한 순수 함수. `types.ts`에 F1~F20 타입 |
| `src/parsers/` | 엑셀·PDF → 구조화된 데이터. 입력은 `Uint8Array`/`ArrayBuffer`, DOM 의존 금지 |
| `src/parsers/pdf/` | pdf.js로 글자 좌표(화면 좌표, 페이지 회전 반영)를 뽑아 표 복원. 브라우저·Node 공용 |
| `scripts/pdf-dump.mjs` | PDF 좌표 덤프 도구. 새 양식 PDF 구조 확인용 (`node scripts/pdf-dump.mjs 파일.pdf [쪽]`) |
| `src/export/` | `hwpx.ts`: 템플릿 표시어 치환·블록 삭제·문항 행 복제로 HWPX 생성(@xmldom/xmldom + JSZip, 브라우저·Node 공용). `hwpxInput.ts`: 입력 검사(가벼움). `clipboard.ts`: 표 복사(브라우저 전용) |
| `src/ui/` | React 화면. 상태는 `useMinutesState.ts` 한 곳에서 모아 `computeMinutesNumbers`(core)에 넘김. 미리보기 `components/Preview.tsx`는 HWP 양식과 같은 구성. 브라우저 전용 설정(`setupPdfWorker.ts`)·localStorage(`storage.ts`)도 여기 |
| `scripts/e2e-demo.mjs` | '예시 파일로 체험하기'로 화면 전 과정 확인. 배포 주소도 가능 (playwright-core + 설치된 Edge) |
| `tests/local/` | **로컬 전용**(gitignore). samples/ 기대값 테스트와 `e2e-samples.mjs`(PRD 9-1과 화면 대조) |
| `tests/` | Vitest 테스트. `tests/samples.ts`로 샘플 파일을 읽음 |
| `docs/` | PRD 등 문서 |
| `templates/` | `협의록_양식.hwpx`: 내보내기 템플릿(표시어). `협의록_원본.hwp`: 표시어 넣기 전 원본. 커밋 대상 |
| `samples/` | 실제 나이스 자료. **gitignore됨, 커밋 금지** |
| `public/demo/` | 공개용 가상 예시 파일 4종. `scripts/make-demo.mjs`로 생성, 정답값은 `tests/fixtures/demo-expected.json` |

## 명령

```bash
npm run dev      # 개발 서버
npm test         # Vitest 1회 실행 (npm run test:watch 는 감시 모드)
npm run build    # 타입 검사(tsc -b) + 프로덕션 빌드 → dist/
npm run lint     # oxlint
npm run e2e      # 빌드 후 데모 파일로 브라우저 전 과정 확인
npm run e2e:samples  # 로컬 전용: samples/로 전 과정 확인, 미리보기를 PRD 9-1과 대조 (스크린샷은 e2e-screenshots/)
```

## 규칙

- 파서와 계산은 순수 함수로 `src/parsers`·`src/core`에 두고 UI에서 분리한다. UI는 이 함수들을 호출해 결과를 보여주기만 한다.
- `samples/`는 절대 커밋하지 않는다(학교명·교사명·IP가 들어 있다). 커밋 전 `git status`로 확인한다. 테스트에 필요한 값은 샘플 파일 대신 기대값으로 적는다.
- 샘플 파일이 필요한 묶음은 `describeWithSamples([...], ...)`(tests/samples.ts), 개별 테스트는 `it.skipIf(!hasSample(...))`로 감싼다. `describe.skipIf`는 건너뛰어도 본문(파일 읽기)을 실행해 CI에서 실패하므로 쓰지 않는다. 바꾼 뒤에는 samples/를 잠시 치우고 `npm test`가 통과하는지 확인한다.
- CI에서 도는 테스트는 `public/demo/` 가상 파일(`tests/demo.test.ts`)로 한다. 파서·계산을 바꾸면 이 테스트도 통과해야 한다.
- 공개되는 파일(코드 주석, 테스트, 문서, 커밋 메시지 포함)에 실제 학교명·교사명·IP·학교 내부 코드를 쓰지 않는다. 예시는 '가상고등학교', '홍길동'처럼 가상의 값으로.
- 숫자 결과는 PRD 9-1장 기대값으로 테스트한다(로컬 전용 `tests/local/prd-9-1.test.ts`). 공개 테스트는 데모 정답값(`tests/fixtures/demo-expected.json`)으로 한다.
- UI 문구는 전부 한국어.
- 파일은 브라우저 밖으로 보내지 않는다(PRD 8장 개인정보). 네트워크 호출은 AI 다듬기(선택 기능)만 예외.
- 한 단계가 끝나면 `npm test`와 `npm run build` 통과를 확인한 뒤 커밋한다. 화면을 바꿨으면 `npm run e2e`와 `npm run e2e:samples`도 돌린다.
