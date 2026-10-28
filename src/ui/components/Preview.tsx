/**
 * 협의록 미리보기. 「2학기_1차_정기시험_결과분석_협의록.hwp」 양식과 같은 순서·표 구성이며,
 * 양식의 빨간 글씨 칸(F1~F20)에 들어가는 값은 빨간 글씨로 표시한다.
 */
import { useState, type ReactNode } from 'react';
import { ACHIEVEMENT_LEVELS, formatPercent, IMPROVEMENT_KEYS, PERCENT_TOTAL_LABEL } from '../../core';
import { choiceSymbol, formatRate, IMPROVEMENT_LABELS, LEVEL_LABELS } from '../display';
import { copyPreviewTable } from '../exportActions';
import type { MinutesState } from '../useMinutesState';

/** 빨간 글씨 칸. 값이 없으면 어느 칸인지 보이는 빈칸 */
function Red({ value, field }: { value: ReactNode | null | undefined; field: string }) {
  if (value === null || value === undefined || value === '') {
    return (
      <span className="pv-empty" title={`${field}: 아직 값이 없습니다`}>
        {field}
      </span>
    );
  }
  return <span className="pv-red">{value}</span>;
}

/** 표를 기존 HWP 양식에 붙여 넣을 수 있게 클립보드로 복사 (인쇄·복사 내용에서는 빠진다) */
function CopyButton({ target, label, blackText }: { target: string; label: string; blackText: boolean }) {
  const [state, setState] = useState<'idle' | 'done' | 'error'>('idle');
  async function copy() {
    try {
      await copyPreviewTable(target, blackText);
      setState('done');
    } catch {
      setState('error');
    }
    setTimeout(() => setState('idle'), 2000);
  }
  return (
    <button type="button" className="pv-copy" data-no-copy onClick={copy} aria-label={`${label} 복사`}>
      {state === 'done' ? '복사됨' : state === 'error' ? '복사 실패' : '복사'}
      <span className="visually-hidden" role="status">{state === 'done' ? `${label}을(를) 복사했습니다` : ''}</span>
    </button>
  );
}

/** 검은 글씨 선택 칸. 비어 있으면 양식 원래 글자 */
function Black({ value, fallback }: { value: string; fallback: string }) {
  return <>{value.trim() || fallback}</>;
}

export function Preview({ s }: { s: MinutesState }) {
  const n = s.numbers;
  const d = n.distribution;
  const head = s.fillSubjectHead ? s.subjectHead : '';
  const isFixed = s.mode === 'fixed';

  return (
    <article className={`pv${s.blackText ? ' pv--black' : ''}`} aria-label="협의록 미리보기">
      <table className="pv-frame">
        <colgroup>
          <col style={{ width: '13%' }} />
          <col />
          <col style={{ width: '10%' }} />
          <col style={{ width: '24%' }} />
        </colgroup>
        <tbody>
          <tr>
            <th colSpan={4} className="pv-title">
              (<Black value={head} fallback="OO" />) 교과 협의록
            </th>
          </tr>
          <tr>
            <th scope="row">일 시</th>
            <td>
              <Black value={s.optional.date} fallback="2026년　 월　 일　요일 【　:　 ～　:　】" />
            </td>
            <th scope="row">장소</th>
            <td>
              <Black value={s.optional.place} fallback="" />
            </td>
          </tr>
          <tr>
            <th scope="row">안 건</th>
            <td colSpan={3}>
              2026학년도 (<Black value={head} fallback="　　　" />)교과 2학기 1차 정기시험 결과 분석 및 개선 방안 협의
            </td>
          </tr>
          <tr>
            <th scope="row">참석자</th>
            <td colSpan={3}>
              <Black value={s.optional.attendees} fallback="" />
            </td>
          </tr>
          <tr>
            <th scope="row">협의내용</th>
            <td colSpan={3} className="pv-body">
              <p className="pv-h1">
                1. <Red value={n.title} field="F1 학년·과목" /> 평가 결과 분석
              </p>

              <p className="pv-h2">
                가. 평가 결과 개요 <CopyButton target="pv-table-avg" label="가. 평가 결과 개요 표" blackText={s.blackText} />
              </p>
              <table id="pv-table-avg" className="pv-table pv-avg">
                <tbody>
                  <tr>
                    <th scope="row">예상평균</th>
                    <td>
                      <Red value={s.expectedAverageValue} field="F2" />
                    </td>
                    <th scope="row">실제 평균</th>
                    <td>
                      <Red value={n.actualAverage} field="F3" />
                    </td>
                  </tr>
                </tbody>
              </table>

              <p className="pv-h2">
                나. 성취수준별 분포 비율 분석 <CopyButton target="pv-table-dist" label="나. 성취수준별 분포 표" blackText={s.blackText} />
              </p>
              <p className="pv-h3">
                ○ 성취수준별 분포 분석(성취수준별 <span className="pv-red">{isFixed ? '고정분할점수' : '추정분할점수'}</span>)
              </p>
              <table id="pv-table-dist" className="pv-table pv-dist">
                <thead>
                  <tr>
                    <th rowSpan={2} scope="col">
                      급간
                    </th>
                    {ACHIEVEMENT_LEVELS.map((l) => (
                      <th key={l} scope="col">
                        {LEVEL_LABELS[l]}
                      </th>
                    ))}
                    <th rowSpan={2} scope="col">
                      합
                    </th>
                  </tr>
                  <tr>
                    {ACHIEVEMENT_LEVELS.map((l) => (
                      <td key={l}>
                        <Red value={d?.bins[l]} field="F5" />
                      </td>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">인원</th>
                    {ACHIEVEMENT_LEVELS.map((l) => (
                      <td key={l}>
                        <Red value={d ? `${d.counts[l]}명` : null} field="F6" />
                      </td>
                    ))}
                    <td>
                      <Red value={d ? `${d.total}명` : null} field="F7" />
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">비율</th>
                    {ACHIEVEMENT_LEVELS.map((l) => (
                      <td key={l}>
                        <Red value={d ? formatPercent(d.percents[l]) : null} field="F8" />
                      </td>
                    ))}
                    <td>
                      <Red value={d ? PERCENT_TOTAL_LABEL : null} field="F8" />
                    </td>
                  </tr>
                </tbody>
              </table>
              {!isFixed && (
                <p className="pv-note">
                  *분할점수: A/B=
                  <Red value={d?.mode === 'estimated' ? d.cutScores.ab : null} field="F9" />점, B/C=
                  <Red value={d?.mode === 'estimated' ? d.cutScores.bc : null} field="F9" />점, C/D=
                  <Red value={d?.mode === 'estimated' ? d.cutScores.cd : null} field="F9" />점, D/E=
                  <Red value={d?.mode === 'estimated' ? d.cutScores.de : null} field="F9" />점, E/미도달=
                  <Red value={d?.mode === 'estimated' ? d.cutScores.eu : null} field="F9" />점
                </p>
              )}

              <p className="pv-h2">
                다. 예상 난이도와 실제 정답률 차이가 있는 문항 분석{' '}
                <CopyButton target="pv-table-items" label="다. 문항 분석 표" blackText={s.blackText} />
              </p>
              <table id="pv-table-items" className="pv-table pv-items">
                <thead>
                  <tr>
                    <th rowSpan={2} scope="col">
                      문항
                      <br />
                      번호
                    </th>
                    <th rowSpan={2} scope="col">
                      예상
                      <br />
                      난이도
                    </th>
                    <th rowSpan={2} scope="col">
                      실제
                      <br />
                      정답률
                    </th>
                    <th colSpan={5} scope="colgroup">
                      답안별 응답 인원(명)
                    </th>
                    <th rowSpan={2} scope="col">
                      정답
                    </th>
                  </tr>
                  <tr>
                    {[1, 2, 3, 4, 5].map((c) => (
                      <th key={c} scope="col">
                        {choiceSymbol(c as 1)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {n.mismatchItems.length === 0 ? (
                    <tr>
                      <td colSpan={9}>
                        <Red value={null} field={n.items.length ? '차이 문항 없음' : 'F11~F15 차이 문항'} />
                      </td>
                    </tr>
                  ) : (
                    n.mismatchItems.flatMap((item) => {
                      // 답지별 백분율 행(F14b)을 넣으면 번호·예상·정답률·정답 칸이 두 행에 걸친다
                      const span = s.responsePercents ? 2 : undefined;
                      const rows = [
                        <tr key={item.no}>
                          <td rowSpan={span}>{item.no}</td>
                          <td rowSpan={span}>
                            <Red value={item.expected} field="F12" />
                          </td>
                          <td rowSpan={span}>
                            <Red value={formatRate(item.correctRate)} field="F13" />
                          </td>
                          {item.responses.map((count, i) => (
                            <td key={i}>
                              <Red value={count} field="F14" />
                            </td>
                          ))}
                          <td rowSpan={span}>{choiceSymbol(item.answer)}</td>
                        </tr>,
                      ];
                      if (s.responsePercents) {
                        rows.push(
                          <tr key={`${item.no}-pct`} className="pv-pct">
                            {item.responsePercents.map((p, i) => (
                              <td key={i}>
                                <Red value={formatPercent(p)} field="F14b" />
                              </td>
                            ))}
                          </tr>,
                        );
                      }
                      return rows;
                    })
                  )}
                </tbody>
              </table>

              <table id="pv-table-improve" className="pv-table pv-improve">
                <tbody>
                  <tr>
                    <th scope="row">
                      개선방안
                      <br />
                      <CopyButton target="pv-table-improve" label="개선방안" blackText={s.blackText} />
                    </th>
                    <td className="pv-left">
                      {IMPROVEMENT_KEYS.map((key, i) => (
                        <p key={key} className="pv-improve__para">
                          <Red value={s.improvementText(key)} field={`F${16 + i} ${IMPROVEMENT_LABELS[key]}`} />
                        </p>
                      ))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>
    </article>
  );
}
