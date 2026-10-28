import { DEFAULT_DIFFICULTY_THRESHOLDS, formatPercent, POPULAR_DISTRACTOR_PERCENT, type Difficulty, type ItemAnalysis } from '../../core';
import { choiceSymbol, DIFFICULTIES, formatRate, issuesForStep } from '../display';
import type { MinutesState } from '../useMinutesState';
import { IssueList } from './common';

export function Step4Items({ s }: { s: MinutesState }) {
  const items = s.numbers.items;
  if (items.length === 0) {
    return <p className="muted">문항분석표를 올리면 전체 문항 표가 나타납니다.</p>;
  }
  // 차이 문항을 위로, 그 안에서는 문항번호 순
  const sorted = [...items].sort((a, b) => Number(b.isMismatch) - Number(a.isMismatch) || a.no - b.no);
  const mismatches = s.numbers.mismatchItems;
  const editable = (no: number) => s.manualExpectedMode || (s.needsManualExpected && !s.expectedMap.has(no));

  return (
    <div className="stack">
      <p>
        예상 난이도와 실제 난이도가 다른 <strong>차이 문항 {mismatches.length}개</strong>(
        {mismatches.map((i) => `${i.no}번`).join(', ') || '없음'})가 모두 협의록 '다.' 표에 문항번호 순으로 들어갑니다.
      </p>
      <ThresholdSettings s={s} />

      <div className="table-scroll" tabIndex={0} role="region" aria-label="전체 문항 표">
        <table className="data-table items-table">
          <caption className="visually-hidden">전체 문항 분석 (차이 문항이 위)</caption>
          <thead>
            <tr>
              <th scope="col">번호</th>
              <th scope="col">예상</th>
              <th scope="col">정답률</th>
              <th scope="col">실제</th>
              <th scope="col">차이</th>
              <th scope="col">정답</th>
              {[1, 2, 3, 4, 5].map((c) => (
                <th key={c} scope="col">
                  {choiceSymbol(c as 1)}
                </th>
              ))}
              <th scope="col">최다 오답</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((item) => (
              <tr key={item.no} className={item.isMismatch ? 'row--mismatch' : undefined}>
                <th scope="row">{item.no}</th>
                <td>
                  {editable(item.no) ? (
                    <select
                      aria-label={`${item.no}번 예상 난이도`}
                      value={item.expected ?? ''}
                      onChange={(e) => s.setExpected(item.no, e.target.value as Difficulty | '')}
                    >
                      <option value="">선택</option>
                      {DIFFICULTIES.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  ) : (
                    (item.expected ?? '—')
                  )}
                </td>
                <td className="num">{formatRate(item.correctRate)}</td>
                <td>{item.actual}</td>
                <td>{item.isMismatch ? <strong className="tag-mismatch">차이</strong> : item.expected ? '—' : '?'}</td>
                <td>{choiceSymbol(item.answer)}</td>
                {item.responses.map((count, i) => (
                  <td key={i} className={`num${i + 1 === item.answer ? ' cell--answer' : ''}`}>
                    {count}
                    <span className="pct">{formatPercent(item.responsePercents[i])}</span>
                  </td>
                ))}
                <td>
                  {item.topDistractor ? `${choiceSymbol(item.topDistractor.choice)} ${item.topDistractor.count}명` : '—'}
                  {item.distractorBeatsAnswer && <span className="flag"> 정답보다 많음</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <IssueList issues={issuesForStep(s.issues, 4)} />

      {mismatches.length > 0 && (
        <section aria-labelledby="focus-cards-title" className="stack">
          <h3 id="focus-cards-title">〈분석의 주안점〉 차이 문항별 확인</h3>
          <p className="muted">메모는 개선방안 '(정답률 차이 분석)' 문장의 '~~~' 자리에 들어갑니다.</p>
          {mismatches.map((item) => (
            <FocusCard key={item.no} item={item} s={s} />
          ))}
        </section>
      )}
    </div>
  );
}

function ThresholdSettings({ s }: { s: MinutesState }) {
  const t = s.thresholds;
  const isDefault =
    t.hardBelow === DEFAULT_DIFFICULTY_THRESHOLDS.hardBelow && t.easyAtOrAbove === DEFAULT_DIFFICULTY_THRESHOLDS.easyAtOrAbove;
  return (
    <details className="optional">
      <summary>
        실제 난이도 판정 기준: 정답률 {t.hardBelow}% 미만 어려움 · {t.easyAtOrAbove}% 이상 쉬움
        {isDefault ? ' (매뉴얼 기본값)' : ' (변경됨)'}
      </summary>
      <div className="row">
        <div className="mini-field">
          <label htmlFor="th-hard">어려움 기준 (% 미만)</label>
          <input
            id="th-hard"
            type="number"
            min={0}
            max={100}
            value={t.hardBelow}
            onChange={(e) => s.setThresholds({ ...t, hardBelow: Number(e.target.value) })}
          />
        </div>
        <div className="mini-field">
          <label htmlFor="th-easy">쉬움 기준 (% 이상)</label>
          <input
            id="th-easy"
            type="number"
            min={0}
            max={100}
            value={t.easyAtOrAbove}
            onChange={(e) => s.setThresholds({ ...t, easyAtOrAbove: Number(e.target.value) })}
          />
        </div>
        {!isDefault && (
          <button type="button" className="button button--ghost" onClick={() => s.setThresholds({ ...DEFAULT_DIFFICULTY_THRESHOLDS })}>
            기본값으로
          </button>
        )}
      </div>
    </details>
  );
}

function FocusCard({ item, s }: { item: ItemAnalysis; s: MinutesState }) {
  const memo = s.memos[item.no] ?? { misconception: '', distractorReason: '' };
  const answerCount = item.responses[item.answer - 1];
  const direction =
    item.expected && ['쉬움', '보통', '어려움'].indexOf(item.actual) > ['쉬움', '보통', '어려움'].indexOf(item.expected)
      ? '예상보다 어려웠음'
      : '예상보다 쉬웠음';
  const idBase = `memo-${item.no}`;

  return (
    <article className="focus-card" aria-labelledby={`${idBase}-title`}>
      <h4 id={`${idBase}-title`}>
        {item.no}번 문항 <span className="muted">정답 {choiceSymbol(item.answer)}</span>
      </h4>
      <ol className="focus-list">
        <li>
          <p className="q">예상보다 지나치게 쉽거나 어려웠는가?</p>
          <p className="a">
            예상 <strong>{item.expected}</strong> → 실제 <strong>{item.actual}</strong> (정답률 {formatRate(item.correctRate)}
            ) — {direction}
            {item.levelGap === 2 && ' · 두 단계 차이'}
          </p>
        </li>
        <li>
          <p className="q">답지별 응답 분포가 출제 의도와 어떻게 다른가?</p>
          <p className="a">
            정답 {choiceSymbol(item.answer)} {answerCount}명({formatPercent(item.responsePercents[item.answer - 1])}).{' '}
            {item.popularDistractors.length > 0
              ? `정답 외 ${POPULAR_DISTRACTOR_PERCENT}% 이상 선택: ${item.popularDistractors
                  .map((d) => `${choiceSymbol(d.choice)} ${d.count}명(${formatPercent(d.percent)})`)
                  .join(', ')}`
              : `정답 외에 ${POPULAR_DISTRACTOR_PERCENT}% 이상 선택된 답지 없음`}
            {item.distractorBeatsAnswer && <strong className="flag"> · 오답이 정답보다 많이 선택됨</strong>}
          </p>
        </li>
        <li>
          <label className="q" htmlFor={`${idBase}-mis`}>
            학생들은 어떤 오개념을 갖고 있는가?
          </label>
          <textarea
            id={`${idBase}-mis`}
            rows={2}
            value={memo.misconception}
            placeholder="교사 메모"
            onChange={(e) => s.setMemo(item.no, { misconception: e.target.value })}
          />
        </li>
        <li>
          <p className="q">특정 오답(최다 오답)을 많이 고른 이유는 무엇인가?</p>
          <p className="a">
            {item.topDistractor
              ? `최다 오답 ${choiceSymbol(item.topDistractor.choice)} ${item.topDistractor.count}명(${formatPercent(item.topDistractor.percent)})`
              : '오답 선택 없음'}
          </p>
          <label className="visually-hidden" htmlFor={`${idBase}-why`}>
            {item.no}번 최다 오답을 고른 이유
          </label>
          <textarea
            id={`${idBase}-why`}
            rows={2}
            value={memo.distractorReason}
            placeholder="이유 (교사 메모)"
            onChange={(e) => s.setMemo(item.no, { distractorReason: e.target.value })}
          />
        </li>
      </ol>
    </article>
  );
}
