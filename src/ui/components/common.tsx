import type { ReactNode } from 'react';
import type { Issue } from '../../core';

export type StepStatus = 'done' | 'todo' | 'attention';

const STATUS_LABEL: Record<StepStatus, string> = {
  done: '완료',
  todo: '입력 필요',
  attention: '확인 필요',
};

interface StepProps {
  no: number;
  title: string;
  /** 접혀 있을 때 보이는 요약 */
  summary?: string;
  status: StepStatus;
  open: boolean;
  onToggle: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  children: ReactNode;
}

/** 마법사 한 단계. 머리글 버튼으로 펼치고 접는다 (키보드: Tab으로 이동, Enter/Space로 열기) */
export function Step({ no, title, summary, status, open, onToggle, onPrev, onNext, children }: StepProps) {
  const panelId = `step-${no}-panel`;
  return (
    <section className={`step${open ? ' step--open' : ''}`} aria-labelledby={`step-${no}-button`}>
      <h2 className="step__heading">
        <button
          type="button"
          id={`step-${no}-button`}
          className="step__toggle"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
        >
          <span className="step__no" aria-hidden="true">
            {no}
          </span>
          <span className="step__title">
            <span className="visually-hidden">{no}단계: </span>
            {title}
          </span>
          {!open && summary && <span className="step__summary">{summary}</span>}
          <span className={`badge badge--${status}`}>{STATUS_LABEL[status]}</span>
        </button>
      </h2>
      {open && (
        <div id={panelId} className="step__panel">
          {children}
          <div className="step__nav">
            {onPrev && (
              <button type="button" className="button button--ghost" onClick={onPrev}>
                ← 이전 단계
              </button>
            )}
            {onNext && (
              <button type="button" className="button" onClick={onNext}>
                다음 단계 →
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export function IssueList({ issues, title }: { issues: Issue[]; title?: string }) {
  if (issues.length === 0) return null;
  const hasError = issues.some((i) => i.severity === 'error');
  return (
    <div className={`issues${hasError ? ' issues--error' : ''}`} role={hasError ? 'alert' : 'status'}>
      {title && <p className="issues__title">{title}</p>}
      <ul>
        {issues.map((issue, k) => (
          <li key={`${issue.code}-${k}`} className={`issue issue--${issue.severity}`}>
            <span className="issue__tag">{issue.severity === 'error' ? '오류' : '확인'}</span>
            {issue.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

interface FieldProps {
  id: string;
  label: string;
  hint?: string;
  children: ReactNode;
}

/** 라벨·도움말이 입력란과 연결된 필드 (입력란에 id와 aria-describedby를 넘겨 쓴다) */
export function Field({ id, label, hint, children }: FieldProps) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="field__hint">
          {hint}
        </p>
      )}
    </div>
  );
}
