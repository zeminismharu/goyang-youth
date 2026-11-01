import React, { useState } from 'react';
import { exportBackup } from '../lib/backup.js';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db.js';
import { isPredictionDone } from '../lib/prediction.js';
import { setSetting } from '../lib/db.js';
import { dateOfDay, dayStatuses, formatKDate, logicalToday, TOTAL_DAYS } from '../lib/days.js';

const LABEL = { done: '완료', due: '오늘', missed: '빠짐', future: '' };

export default function Home({ startDate, doneDays, go, reload }) {
  const prep = useLiveQuery(async () => {
    const pred = (await db.settings.get('prediction'))?.value;
    const cl = (await db.settings.get('checklist'))?.value || {};
    const imgs = await db.images.where('day').equals(0).toArray();
    const checks = ['ytHistory', 'takeout', 'insta'].filter((k) => cl[k]).length
      + (imgs.some((r) => r.kind === 'googleAds') ? 1 : 0) + (imgs.some((r) => r.kind === 'instaAds') ? 1 : 0);
    const predDone = isPredictionDone(pred);
    const lastBackup = (await db.settings.get('lastBackup'))?.value || null;
    const hasData = (await db.days.count()) > 0;
    return { checks, predDone, lastBackup, hasData };
  }, []);

  if (!startDate) return <Intro reload={reload} go={go} />;

  const { cur, target, list } = dayStatuses(startDate, doneDays);
  const missed = list.filter((d) => d.status === 'missed');
  const doneCount = list.filter((d) => d.status === 'done').length;
  const canRecordToday = target >= 1 && target <= TOTAL_DAYS && !doneDays.has(target);

  let headline;
  if (cur < 0) headline = '시작일이 아직 안 됐어요';
  else if (cur === 0) headline = '오늘은 0일차예요';
  else if (cur <= TOTAL_DAYS) headline = `오늘은 ${cur}일차예요`;
  else if (cur === TOTAL_DAYS + 1) headline = '오늘은 분석하는 날이에요';
  else headline = '7일 실험이 끝났어요';

  return (
    <main className="screen has-cta">
      <header className="top">
        <span className="brand">제레미</span>
        <button className="icon-btn" onClick={() => go('settings')}>설정</button>
      </header>

      <section>
        <p className="caption">{formatKDate(logicalToday())}</p>
        <h1 className="title">{headline}</h1>
      </section>

      <section className="card">
        <div className="card-head">
          <span className="label">7일 기록</span>
          <span className="value"><b className="blue">{doneCount}</b> / {TOTAL_DAYS}</span>
        </div>
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
      </section>

      {cur === 0 && (
        <section className="card">
          <p className="body">내일이 1일차예요. 평소처럼 지내고 <b>내일 밤</b>에 첫 기록을 남겨 주세요.</p>
        </section>
      )}

      {prep && (
        <button className={`card prep ${cur === 0 && !prep.predDone ? 'emph' : ''}`} onClick={() => go('day0')}>
          <span>
            <span className="label">0일차 예측과 준비</span>
            <span className="caption block">
              예측 {prep.predDone ? '완료' : '아직'} · 체크리스트 {prep.checks}/5
            </span>
          </span>
          <span className="chev">›</span>
        </button>
      )}

      {missed.length > 0 && (
        <section className="card">
          <p className="label red">빠진 날 {missed.length}일</p>
          <p className="body sub">지금이라도 기록할 수 있어요. 스크린타임에서 지난 날짜를 골라 보면 돼요.</p>
          <div className="list">
            {missed.map((d) => (
              <button key={d.n} className="list-row" onClick={() => go('checkin', { day: d.n })}>
                <span>{d.n}일차 <span className="sub">{formatKDate(d.date)}</span></span>
                <span className="chev">›</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {prep?.hasData && <BackupNudge last={prep.lastBackup} />}

      {cur === 0 && prep && !prep.predDone && (
        <div className="cta-bar">
          <button className="btn" onClick={() => go('day0')}>예측 남기기</button>
        </div>
      )}

      {canRecordToday && (
        <div className="cta-bar">
          <button className="btn" onClick={() => go('checkin', { day: target })}>
            오늘({target}일차) 기록하기
          </button>
        </div>
      )}
    </main>
  );
}

// 2일 넘게 백업을 안 했으면 홈에서 한 번 탭으로 백업
function BackupNudge({ last }) {
  const [msg, setMsg] = useState('');
  const days = last ? Math.floor((Date.now() - last) / 86400000) : null;
  if (days != null && days < 2 && !msg) return null;
  const run = async () => {
    setMsg('백업 파일을 만드는 중…');
    try {
      const r = await exportBackup();
      setMsg(r.cancelled ? '' : `백업했어요 (${r.sizeMB}MB)`);
    } catch { setMsg('백업하지 못했어요. 설정 > 데이터에서 다시 시도해 주세요.'); }
  };
  return (
    <section className="card">
      <p className="label">{days == null ? '아직 백업하지 않았어요' : `마지막 백업이 ${days}일 전이에요`}</p>
      <p className="caption">휴대폰을 바꾸거나 앱이 지워져도 기록을 살릴 수 있게, 파일 앱이나 카톡 '나와의 채팅'에 저장해 두세요.</p>
      {msg ? <p className="body sub">{msg}</p> : <button className="btn secondary sm" onClick={run}>지금 백업하기</button>}
    </section>
  );
}

function Intro({ reload, go }) {
  const start = async () => {
    await setSetting('startDate', logicalToday());
    await reload();
    go('day0');
  };
  const today = logicalToday();
  return (
    <main className="screen has-cta">
      <header className="top"><span className="brand">제레미</span></header>
      <section>
        <h1 className="title lg">7일 동안<br />내 휴대폰을<br />기록해 볼까요?</h1>
        <p className="body sub" style={{ marginTop: 12 }}>
          내가 예상한 사용 시간과 실제가 얼마나 다른지,<br />알고리즘이 나에게 무엇을 보여주는지 확인해요.
        </p>
      </section>

      <section className="card">
        <Step n="0일차" t="예측 남기기" d={`${formatKDate(today)}, 오늘`} />
        <Step n="1~7일차" t="매일 밤 2분 기록" d={`${formatKDate(dateOfDay(today, 1))} ~ ${formatKDate(dateOfDay(today, 7))}`} />
        <Step n="8일차" t="분석하고 리포트 보기" d={formatKDate(dateOfDay(today, 8))} />
      </section>

      <section className="card">
        <p className="body">🔒 모든 기록은 <b>이 휴대폰 안에만</b> 저장돼요. 서버도, 로그인도, 외부 전송도 없어요.</p>
      </section>

      {!isStandalone() && (
        <section className="card notice">
          <p className="label">먼저 홈 화면에 추가해 주세요</p>
          <p className="body sub">사파리 아래 공유 버튼 → <b>홈 화면에 추가</b> → 홈 화면의 '제레미'로 열기. 사파리에서 입력한 기록은 홈 화면 앱에서 보이지 않아요.</p>
        </section>
      )}

      <div className="cta-bar">
        <button className="btn" onClick={start}>오늘을 0일차로 시작하기</button>
      </div>
    </main>
  );
}

function Step({ n, t, d }) {
  return (
    <div className="step">
      <span className="step-n">{n}</span>
      <div><p className="body"><b>{t}</b></p><p className="caption">{d}</p></div>
    </div>
  );
}

export function isStandalone() {
  return window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
}
