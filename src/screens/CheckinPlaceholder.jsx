import React from 'react';
import { db } from '../lib/db.js';
import { dateOfDay, formatKDate } from '../lib/days.js';

// 1-3단계에서 실제 체크인 화면으로 교체됩니다. 지금은 홈 화면 표시 확인용.
export default function CheckinPlaceholder({ day, startDate, back }) {
  const markDone = async () => {
    await db.days.put({ day, test: true, savedAt: Date.now() });
    back();
  };
  return (
    <main className="screen has-cta">
      <header className="top"><button className="icon-btn" onClick={back}>← 홈</button></header>
      <section>
        <p className="caption">{formatKDate(dateOfDay(startDate, day))}</p>
        <h1 className="title">{day}일차 기록</h1>
      </section>
      <section className="card"><p className="body sub">체크인 화면은 1-3단계에서 만들어요.</p></section>
      <div className="cta-bar">
        <button className="btn secondary" onClick={markDone}>(테스트) 이 날 기록 완료로 표시</button>
      </div>
    </main>
  );
}
