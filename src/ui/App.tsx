import { useState } from 'react';
import { issuesForStep } from './display';
import { Step, type StepStatus } from './components/common';
import { Preview } from './components/Preview';
import { Step1Basic } from './components/Step1Basic';
import { Step2Upload } from './components/Step2Upload';
import { Step3Scores } from './components/Step3Scores';
import { Step4Items } from './components/Step4Items';
import { Step5Export } from './components/Step5Export';
import { useMinutesState, type MinutesState } from './useMinutesState';

const STEP_TITLES = ['기본 정보와 분할 방식', '파일 올리기', '평균과 성취수준 분포', '차이 문항 확인', '개선방안과 내보내기'];

function stepStatuses(s: MinutesState): StepStatus[] {
  const hasError = (step: 2 | 3 | 4) => issuesForStep(s.issues, step).some((i) => i.severity === 'error');
  const hasAny = (step: 2 | 3 | 4) => issuesForStep(s.issues, step).length > 0;

  const filesReady =
    Boolean(s.analysis) &&
    (s.manualExpectedMode || Boolean(s.itemInfoRaw)) &&
    s.numbers.actualAverage !== null &&
    (s.mode === 'estimated' || Boolean(s.freq));
  const avg = s.expectedAverageValue;
  const scoresReady = avg !== null && avg >= 0 && avg <= 100 && s.numbers.distribution !== null;
  const itemsReady = s.numbers.items.length > 0 && s.numbers.items.every((i) => i.expected !== null);

  const status = (ready: boolean, step: 2 | 3 | 4): StepStatus =>
    hasError(step) ? 'attention' : ready ? (hasAny(step) ? 'attention' : 'done') : 'todo';
  return [
    s.subjectName.trim() ? 'done' : 'todo',
    status(filesReady, 2),
    status(scoresReady, 3),
    status(itemsReady, 4),
    'todo',
  ];
}

function stepSummaries(s: MinutesState): string[] {
  const n = s.numbers;
  const loaded = Object.keys(s.uploads).length;
  return [
    `${s.mode === 'fixed' ? '고정분할' : '추정분할'}${s.subjectName ? ` · ${s.subjectName}` : ''}`,
    loaded ? `파일 ${loaded}개${n.examinees !== null ? ` · 응시 ${n.examinees}명` : ''}` : '',
    s.expectedAverageValue !== null ? `예상 ${s.expectedAverageValue} / 실제 ${n.actualAverage ?? '—'}` : '',
    n.items.length ? `차이 문항 ${n.mismatchItems.length}개` : '',
    '',
  ];
}

export default function App() {
  const s = useMinutesState();
  const [active, setActive] = useState(1);
  const statuses = stepStatuses(s);
  const summaries = stepSummaries(s);

  function goTo(step: number) {
    setActive(step);
    // 펼친 단계의 머리글로 초점을 옮겨 키보드·화면낭독기 사용자가 위치를 잃지 않게 한다
    requestAnimationFrame(() => {
      const button = document.getElementById(`step-${step}-button`);
      button?.focus();
      // 마법사 칸 안에서만 스크롤 (페이지 전체가 밀리지 않게)
      button?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }

  function body(no: number) {
    switch (no) {
      case 1:
        return <Step1Basic s={s} />;
      case 2:
        return <Step2Upload s={s} />;
      case 3:
        return <Step3Scores s={s} />;
      case 4:
        return <Step4Items s={s} />;
      default:
        return <Step5Export />;
    }
  }

  return (
    <div className="app">
      <header className="app__header">
        <h1>정기시험 결과분석 협의록 작성 도우미</h1>
        <p className="app__tagline">나이스 자료를 올리면 협의록의 빨간 글씨 칸을 채워 드립니다.</p>
      </header>
      <main className="app__main">
        <div className="wizard" aria-label="작성 단계">
          {STEP_TITLES.map((title, i) => {
            const no = i + 1;
            return (
              <Step
                key={no}
                no={no}
                title={title}
                summary={summaries[i]}
                status={statuses[i]}
                open={active === no}
                onToggle={() => (active === no ? setActive(0) : goTo(no))}
                onPrev={no > 1 ? () => goTo(no - 1) : undefined}
                onNext={no < STEP_TITLES.length ? () => goTo(no + 1) : undefined}
              >
                {body(no)}
              </Step>
            );
          })}
        </div>
        <aside className="preview-pane" aria-labelledby="preview-title">
          <h2 id="preview-title" className="preview-pane__title">
            협의록 미리보기 <span className="legend">빨간 글씨 = 자동으로 채운 칸</span>
          </h2>
          <Preview s={s} />
        </aside>
      </main>
    </div>
  );
}
