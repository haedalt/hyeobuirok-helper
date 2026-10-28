import type { MinutesState } from '../useMinutesState';
import { Field } from './common';

export function Step1Basic({ s }: { s: MinutesState }) {
  return (
    <div className="stack">
      <fieldset className="radio-group">
        <legend>분할 방식</legend>
        <label className="radio">
          <input type="radio" name="mode" value="fixed" checked={s.mode === 'fixed'} onChange={() => s.setMode('fixed')} />
          <span>
            <strong>고정분할</strong> — 90/80/70/60/40점 고정 (예: 과학). 도수분포표로 인원을 자동 집계
          </span>
        </label>
        <label className="radio">
          <input
            type="radio"
            name="mode"
            value="estimated"
            checked={s.mode === 'estimated'}
            onChange={() => s.setMode('estimated')}
          />
          <span>
            <strong>추정분할</strong> — 교과협의회가 정한 분할점수 (예: 영어). 수준별 인원을 직접 입력
          </span>
        </label>
      </fieldset>

      <Field id="subject-name" label="교과명 (협의록 제목에 들어감)" hint="파일을 올리면 자동으로 채워집니다. 고쳐 써도 됩니다.">
        <input
          id="subject-name"
          type="text"
          value={s.subjectName}
          placeholder="예: 화학 반응의 세계"
          aria-describedby="subject-name-hint"
          onChange={(e) => s.setSubjectName(e.target.value)}
        />
      </Field>

      <div className="field">
        <label className="checkbox">
          <input type="checkbox" checked={s.fillSubjectHead} onChange={(e) => s.setFillSubjectHead(e.target.checked)} />
          양식 제목 '(OO) 교과'와 안건 '(　　)교과' 칸도 채우기
        </label>
        {s.fillSubjectHead && (
          <input
            id="subject-head"
            type="text"
            aria-label="양식 제목·안건에 넣을 교과"
            value={s.subjectHead}
            placeholder="예: 과학"
            onChange={(e) => s.setSubjectHead(e.target.value)}
          />
        )}
      </div>

      <details className="optional">
        <summary>선택 입력: 일시·장소·참석자</summary>
        <div className="stack">
          <Field id="opt-date" label="일시">
            <input
              id="opt-date"
              type="text"
              placeholder="예: 2026년 10월 30일 목요일 【15:00 ～ 16:00】"
              value={s.optional.date}
              onChange={(e) => s.setOptional({ ...s.optional, date: e.target.value })}
            />
          </Field>
          <Field id="opt-place" label="장소">
            <input
              id="opt-place"
              type="text"
              value={s.optional.place}
              onChange={(e) => s.setOptional({ ...s.optional, place: e.target.value })}
            />
          </Field>
          <Field id="opt-attendees" label="참석자">
            <input
              id="opt-attendees"
              type="text"
              value={s.optional.attendees}
              onChange={(e) => s.setOptional({ ...s.optional, attendees: e.target.value })}
            />
          </Field>
        </div>
      </details>
    </div>
  );
}
