import type { ImprovementKey } from '../../core';
import { IMPROVEMENT_LABELS } from '../display';
import type { MinutesState } from '../useMinutesState';

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
      <p className="muted">HWPX 내려받기와 표 복사는 다음 업데이트에서 추가됩니다.</p>
      <div className="row">
        <button type="button" className="button" disabled>
          HWPX 내려받기
        </button>
        <button type="button" className="button button--ghost" disabled>
          표 복사
        </button>
      </div>
    </div>
  );
}
