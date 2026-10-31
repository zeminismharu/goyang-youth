import React from 'react';
import { setSetting } from '../lib/db.js';
import { dayStatuses, formatKDate, todayStr, TOTAL_DAYS } from '../lib/days.js';

const LABEL = { done: '완료', due: '오늘', missed: '빠짐', future: '' };

export default function Home({ startDate, doneDays, go, reload }) {
  if (!startDate) return <Intro go={go} reload={reload} />;

  const { cur, target, list } = dayStatuses(startDate, doneDays);
  const missed = list.filter((d) => d.status === 'missed');
  const dueItem = list.find((d) => d.status === 'due');
  const doneCount = list.filter((d) => d.status === 'done').length;

  let headline;
  if (cur < 0) headline = '시작일이 미래로 설정되어 있어요';
  else if (cur <= TOTAL_DAYS + 1) headline = `${cur}일차`;
  else headline = '실험 종료';

  return (
    <main className="screen">
      <header className="top">
        <span className="brand">제레미</span>
        <button className="icon-btn" onClick={() => go('settings')} aria-label="설정">설정</button>
      </header>

      <section className="hero">
        <p className="muted">{formatKDate(todayStr())}</p>
        <h1 className="day-big">{headline}</h1>
        <p className="muted">기록 {doneCount} / {TOTAL_DAYS}일</p>
      </section>

      <ol className="dots" aria-label="일차별 기록 상태">
        {list.map((d) => (
          <li key={d.n}>
            <button
              className={`dot ${d.status}`}
              disabled={d.status === 'future'}
              onClick={() => go('checkin', { day: d.n })}
            >
              <span className="dot-n">{d.n}</span>
              <span className="dot-label">{LABEL[d.status]}</span>
            </button>
          </li>
        ))}
      </ol>

      {dueItem && !doneDays.has(target) && (
        <button className="primary big" onClick={() => go('checkin', { day: target })}>
          어제({target}일차) 기록하기
          <small>{formatKDate(dueItem.date)}</small>
        </button>
      )}

      {cur === 0 && (
        <div className="card soft">
          <b>오늘은 0일차예요.</b> 1일차를 평소처럼 보내고, 2일차 아침에 앱을 열어 1일차를 기록하면 돼요.
        </div>
      )}
      {cur === 1 && (
        <div className="card soft">
          <b>오늘이 1일차예요.</b> 평소처럼 지내고 내일 아침에 기록해 주세요.
        </div>
      )}
      {cur >= TOTAL_DAYS + 1 && !dueItem && missed.length === 0 && (
        <div className="card soft"><b>7일 기록이 끝났어요.</b> 다음 단계는 분석이에요. (2단계에서 만들어요)</div>
      )}

      {missed.length > 0 && (
        <section className="card warn">
          <b>빠진 날 {missed.length}일</b>
          <p className="muted">지금이라도 기록할 수 있어요. 스크린타임에서 지난 날짜를 골라 보면 돼요.</p>
          <div className="chips">
            {missed.map((d) => (
              <button key={d.n} className="chip" onClick={() => go('checkin', { day: d.n })}>
                {d.n}일차 · {formatKDate(d.date)}
              </button>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function Intro({ reload }) {
  const start = async () => {
    await setSetting('startDate', todayStr());
    await reload();
  };
  return (
    <main className="screen intro">
      <span className="brand">제레미</span>
      <h1>7일 실험</h1>
      <p>
        일주일 동안 내 휴대폰 사용과 알고리즘이 보여주는 것을 기록하고,<br />
        내 예상과 실제가 얼마나 다른지 확인해요.
      </p>
      <div className="card soft">
        🔒 모든 기록은 <b>이 휴대폰 안에만</b> 저장돼요. 서버도, 로그인도, 외부 전송도 없어요.
      </div>
      {!isStandalone() && (
        <div className="card warn">
          <b>먼저 홈 화면에 추가해 주세요.</b>
          <p>사파리 아래 공유 버튼 → <b>홈 화면에 추가</b> → 홈 화면의 '제레미' 아이콘으로 열기.
            사파리에서 입력한 기록은 홈 화면 앱에서 보이지 않아요.</p>
        </div>
      )}
      <button className="primary big" onClick={start}>오늘을 0일차로 시작하기</button>
      <p className="muted small">0일차 예측 입력·체크리스트는 다음 단계(1-2)에서 붙어요.</p>
    </main>
  );
}

export function isStandalone() {
  return window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
}
