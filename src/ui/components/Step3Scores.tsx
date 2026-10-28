import { ACHIEVEMENT_LEVELS, formatPercent, PERCENT_TOTAL_LABEL } from '../../core';
import { issuesForStep, LEVEL_LABELS } from '../display';
import { CUT_KEYS, CUT_LABELS, type MinutesState } from '../useMinutesState';
import { Field, IssueList } from './common';

export function Step3Scores({ s }: { s: MinutesState }) {
  const n = s.numbers;
  const avg = s.expectedAverageValue;
  const avgInvalid = s.expectedAverage.trim() !== '' && (avg === null || avg < 0 || avg > 100);

  return (
    <div className="stack">
      <div className="row">
        <Field id="expected-average" label="예상평균 (점)" hint="출제 때 예상한 평균. 0~100">
          <input
            id="expected-average"
            type="number"
            inputMode="decimal"
            min={0}
            max={100}
            step={0.1}
            value={s.expectedAverage}
            aria-describedby="expected-average-hint"
            aria-invalid={avgInvalid}
            onChange={(e) => s.setExpectedAverage(e.target.value)}
          />
        </Field>
        <div className="field">
          <span className="field__label">실제 평균 (성적집계표)</span>
          <output className="readout">{n.actualAverage !== null ? `${n.actualAverage}점` : '성적집계표를 올려 주세요'}</output>
        </div>
      </div>
      {avgInvalid && <IssueList issues={[{ severity: 'error', code: 'EXP_AVG', message: '예상평균은 0~100 사이 숫자로 입력해 주세요.' }]} />}

      {s.mode === 'estimated' && <EstimatedForm s={s} />}

      {n.distribution ? (
        <table className="data-table">
          <caption>
            성취수준별 분포 ({s.mode === 'fixed' ? '고정분할 — 도수분포표에서 자동 집계' : '추정분할 — 입력값으로 계산'})
          </caption>
          <thead>
            <tr>
              <th scope="col">급간</th>
              {ACHIEVEMENT_LEVELS.map((l) => (
                <th key={l} scope="col">
                  {LEVEL_LABELS[l]}
                  <br />
                  <span className="muted">{n.distribution!.bins[l]}</span>
                </th>
              ))}
              <th scope="col">합</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">인원</th>
              {ACHIEVEMENT_LEVELS.map((l) => (
                <td key={l}>{n.distribution!.counts[l]}명</td>
              ))}
              <td>{n.distribution.total}명</td>
            </tr>
            <tr>
              <th scope="row">비율</th>
              {ACHIEVEMENT_LEVELS.map((l) => (
                <td key={l}>{formatPercent(n.distribution!.percents[l])}</td>
              ))}
              <td>{PERCENT_TOTAL_LABEL}</td>
            </tr>
          </tbody>
        </table>
      ) : (
        <p className="muted">
          {s.mode === 'fixed' ? '도수분포표를 올리면 성취수준별 인원이 자동으로 계산됩니다.' : '분할점수와 인원을 모두 입력하면 표가 만들어집니다.'}
        </p>
      )}
      <IssueList issues={issuesForStep(s.issues, 3)} />
    </div>
  );
}

function EstimatedForm({ s }: { s: MinutesState }) {
  return (
    <div className="stack">
      <fieldset className="grid-inputs">
        <legend>분할점수 (점, 큰 값부터)</legend>
        {CUT_KEYS.map((k) => (
          <div key={k} className="mini-field">
            <label htmlFor={`cut-${k}`}>{CUT_LABELS[k]}</label>
            <input
              id={`cut-${k}`}
              type="number"
              inputMode="decimal"
              min={0}
              max={100}
              value={s.cutInputs[k]}
              onChange={(e) => s.setCutInput(k, e.target.value)}
            />
          </div>
        ))}
      </fieldset>
      <fieldset className="grid-inputs">
        <legend>수준별 인원 (명)</legend>
        {ACHIEVEMENT_LEVELS.map((l) => (
          <div key={l} className="mini-field">
            <label htmlFor={`count-${l}`}>{LEVEL_LABELS[l]}</label>
            <input
              id={`count-${l}`}
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={s.countInputs[l]}
              onChange={(e) => s.setCountInput(l, e.target.value)}
            />
          </div>
        ))}
      </fieldset>
      {s.numbers.distribution?.mode === 'estimated' && (
        <p className="muted">*분할점수: {s.numbers.distribution.cutScoreSentence}</p>
      )}
    </div>
  );
}
