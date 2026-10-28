import { useRef, useState, type DragEvent } from 'react';
import type { FileKind, ParseWarning } from '../../parsers';
import { issuesForStep, warningToIssue } from '../display';
import { FILE_KIND_ORDER, FILE_KINDS } from '../fileKinds';
import type { MinutesState } from '../useMinutesState';
import { IssueList } from './common';

export function Step2Upload({ s }: { s: MinutesState }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const kinds = FILE_KIND_ORDER.filter((k) => k !== 'frequency' || s.mode === 'fixed');

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    void s.addFiles([...e.dataTransfer.files]);
  }

  return (
    <div className="stack">
      <div
        className={`dropzone${dragging ? ' dropzone--over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <p className="dropzone__main">
          나이스에서 내려받은 파일을 <strong>한꺼번에</strong> 여기로 끌어다 놓으세요.
        </p>
        <p className="dropzone__sub">파일 이름이 'download-숫자'여도 내용을 보고 종류를 알아서 나눕니다.</p>
        <button type="button" className="button" onClick={() => inputRef.current?.click()} disabled={s.busy}>
          {s.busy ? '읽는 중…' : '파일 선택'}
        </button>
        <input
          ref={inputRef}
          id="file-input"
          className="visually-hidden"
          type="file"
          multiple
          accept=".xlsx,.xls,.pdf"
          aria-label="나이스 자료 파일 선택"
          tabIndex={-1}
          onChange={(e) => {
            void s.addFiles([...(e.target.files ?? [])]);
            e.target.value = '';
          }}
        />
        <p className="privacy">
          <span aria-hidden="true">🔒</span> 파일은 이 컴퓨터의 브라우저 안에서만 읽습니다. 어디로도 전송하거나 저장하지 않습니다.
        </p>
      </div>

      {s.notice && (
        <p className="notice" role="status">
          {s.notice}{' '}
          <button type="button" className="link" onClick={s.dismissNotice}>
            닫기
          </button>
        </p>
      )}

      {s.rejected.length > 0 && (
        <IssueList
          title="읽지 못한 파일"
          issues={s.rejected.map((r) => ({ severity: 'error', code: 'REJECTED', message: `${r.fileName}: ${r.message}` }))}
        />
      )}

      <ul className="slots">
        {kinds.map((kind) => (
          <FileSlot key={kind} kind={kind} s={s} />
        ))}
      </ul>

      <SummaryCard s={s} />
      <IssueList title="파일 교차 검증" issues={issuesForStep(s.issues, 2)} />
    </div>
  );
}

function FileSlot({ kind, s }: { kind: FileKind; s: MinutesState }) {
  const info = FILE_KINDS[kind];
  const upload = s.uploads[kind];
  let warnings: ParseWarning[] = upload && 'result' in upload ? upload.result.warnings : [];
  if (kind === 'scoreSummary' && s.scoreResult) warnings = s.scoreResult.warnings;
  const skipped = kind === 'itemInfo' && s.manualExpectedMode;
  const loaded = Boolean(upload) && !(kind === 'scoreSummary' && s.scoreLoading);
  const subjects = kind === 'scoreSummary' ? (s.scoreResult?.value.subjects ?? []) : [];
  const subjectMissing = kind === 'scoreSummary' && s.scoreResult !== null && s.scoreResult.value.subject === null;

  return (
    <li className={`slot${upload ? ' slot--loaded' : ''}${warnings.length ? ' slot--warn' : ''}`}>
      <div className="slot__head">
        <span className="slot__label">
          {info.label} <span className="slot__format">{info.format}</span>
        </span>
        <span className="slot__state">
          {skipped ? '직접 입력' : upload ? (loaded ? `✓ ${upload.fileName}` : '읽는 중…') : kind === 'frequency' ? '고정분할 필수' : '필수'}
        </span>
        {upload && (
          <button type="button" className="link" onClick={() => s.removeFile(kind)} aria-label={`${info.label} 파일 빼기`}>
            빼기
          </button>
        )}
      </div>
      <p className="slot__path">
        나이스: {info.neisPath} <span className="slot__usage">· {info.usage}</span>
      </p>
      {kind === 'itemInfo' && (
        <label className="checkbox checkbox--small">
          <input
            type="checkbox"
            checked={s.manualExpectedMode}
            onChange={(e) => s.setManualExpectedMode(e.target.checked)}
          />
          문항정보표를 읽지 못해 예상 난이도를 직접 입력하겠습니다 (4단계에서 입력)
        </label>
      )}
      {subjectMissing && subjects.length > 0 && (
        <div className="field">
          <label htmlFor="score-column">성적집계표에서 이 과목의 열을 골라 주세요</label>
          <select id="score-column" defaultValue="" onChange={(e) => s.setScoreColumn(e.target.value || null)}>
            <option value="">— 과목 선택 —</option>
            {subjects.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
      )}
      {!skipped && warnings.length > 0 && <IssueList issues={warnings.map(warningToIssue)} />}
    </li>
  );
}

function SummaryCard({ s }: { s: MinutesState }) {
  if (!s.analysis && !s.freq && !s.itemInfoRaw && !s.uploads.scoreSummary) return null;
  const n = s.numbers;
  const grade = s.analysis?.meta.grade ?? s.freq?.meta.grade ?? s.itemInfoRaw?.meta.grade ?? null;
  const rows: [string, string][] = [
    ['교과', s.subjectName || '—'],
    ['학년', grade !== null ? `${grade}학년` : '—'],
    ['응시자', n.examinees !== null ? `${n.examinees}명` : '—'],
    ['문항 수', s.analysis ? `${s.analysis.items.length}문항` : '—'],
    ['과목평균', n.actualAverage !== null ? `${n.actualAverage}점` : '—'],
    [
      '예상 난이도 (어려움/보통/쉬움)',
      s.difficultyCounts ? `${s.difficultyCounts['어려움']} / ${s.difficultyCounts['보통']} / ${s.difficultyCounts['쉬움']}` : '—',
    ],
  ];
  return (
    <section className="summary-card" aria-label="파일 읽기 결과 요약">
      <h3>읽은 내용 요약</h3>
      <dl>
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
