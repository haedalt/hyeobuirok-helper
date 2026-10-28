import { useState } from 'react';
import type { ImprovementKey } from '../../core';
import { IMPROVEMENT_LABELS } from '../display';
import { downloadHwpx } from '../exportActions';
import type { MinutesState } from '../useMinutesState';
import { IssueList } from './common';

/** 초안을 만들 수 없을 때 필요한 것 */
const NEEDS: Record<ImprovementKey, string> = {
  average: '3단계 예상평균과 성적집계표가 있어야 초안이 만들어집니다.',
  maxMin: '성적집계표가 있어야 초안이 만들어집니다.',
  distribution: '3단계 성취수준 분포가 있어야 초안이 만들어집니다.',
  levelA: '3단계 성취수준 분포가 있어야 초안이 만들어집니다.',
  itemGap: '문항분석표가 있어야 초안이 만들어집니다.',
};

const KEYS = Object.keys(IMPROVEMENT_LABELS) as ImprovementKey[];

export function Step5Export({ s }: { s: MinutesState }) {
  function regenerate() {
    if (s.editedKeys.length > 0) {
      const names = s.editedKeys.map((k) => IMPROVEMENT_LABELS[k]).join(', ');
      const ok = window.confirm(`직접 고친 문단 ${s.editedKeys.length}개(${names})가 새 초안으로 바뀝니다. 계속할까요?`);
      if (!ok) return;
    }
    s.resetImprovements();
  }

  return (
    <div className="stack">
      <p className="muted">
        수치에 맞춰 고른 문장 틀로 초안을 만들었습니다. 자유롭게 고쳐 쓰세요. 고치지 않은 문단은 앞 단계 값이나 4단계 메모를 바꾸면
        자동으로 다시 만들어집니다. '~~~'는 직접 채울 자리입니다.
      </p>
      {KEYS.map((key) => {
        const draft = s.drafts[key];
        const text = s.improvementText(key);
        const edited = s.editedKeys.includes(key);
        const id = `improvement-${key}`;
        return (
          <div key={key} className="field">
            <label htmlFor={id}>
              {IMPROVEMENT_LABELS[key]}
              {edited && <span className="badge badge--attention improvement__badge">직접 고침</span>}
            </label>
            <textarea
              id={id}
              rows={key === 'itemGap' ? 8 : key === 'levelA' ? 4 : 3}
              value={text ?? ''}
              placeholder={draft === null ? NEEDS[key] : undefined}
              aria-describedby={draft === null ? `${id}-hint` : undefined}
              onChange={(e) => s.setImprovementText(key, e.target.value)}
            />
            {draft === null && text === null && (
              <p id={`${id}-hint`} className="field__hint">
                {NEEDS[key]}
              </p>
            )}
          </div>
        );
      })}
      <div className="row">
        <button type="button" className="button button--ghost" onClick={regenerate}>
          초안 다시 만들기
        </button>
      </div>

      <hr className="divider" />
      <ExportPanel s={s} />
    </div>
  );
}

function ExportPanel({ s }: { s: MinutesState }) {
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [working, setWorking] = useState(false);
  const ready = s.exportMissing.length === 0;

  async function download() {
    setWorking(true);
    setStatus(null);
    try {
      await downloadHwpx(s.hwpxInput, s.exportFileName);
      setStatus({ kind: 'ok', text: `${s.exportFileName} 파일을 내려받았습니다. 한/글 2014 이상에서 열어 주세요.` });
    } catch (e) {
      setStatus({ kind: 'error', text: e instanceof Error ? e.message : String(e) });
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="stack" aria-labelledby="export-title">
      <h3 id="export-title" className="export__title">
        내보내기
      </h3>
      <fieldset className="export__options">
        <legend className="visually-hidden">내보내기 설정</legend>
        <label className="checkbox">
          <input type="checkbox" checked={s.blackText} onChange={(e) => s.setBlackText(e.target.checked)} />
          채운 글씨를 검정으로 바꾸기 (끄면 양식처럼 빨간 글씨)
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={s.responsePercents} onChange={(e) => s.setResponsePercents(e.target.checked)} />
          '다.' 표에 답지별 백분율 행 넣기 (매뉴얼 표 형식)
        </label>
      </fieldset>

      {!ready && (
        <IssueList
          title="내려받기 전에 채워야 할 값"
          issues={s.exportMissing.map((m) => ({ severity: 'warning', code: 'EXPORT_MISSING', message: m }))}
        />
      )}
      <div className="row">
        <button type="button" className="button" disabled={!ready || working} onClick={download}>
          {working ? '만드는 중…' : 'HWPX 내려받기'}
        </button>
        <button type="button" className="button button--ghost" onClick={() => window.print()}>
          PDF로 인쇄
        </button>
      </div>
      <p className="muted export__hint">
        기존 HWP 양식에 붙여 넣으려면 오른쪽 미리보기의 각 표 위 <strong>[복사]</strong>를 누르세요. PDF는 인쇄 창에서 'PDF로
        저장'을 고르면 됩니다.
      </p>
      {status && (
        <p className={`notice${status.kind === 'error' ? ' notice--error' : ''}`} role={status.kind === 'error' ? 'alert' : 'status'}>
          {status.text}
        </p>
      )}
    </section>
  );
}
