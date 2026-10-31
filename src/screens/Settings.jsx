import React, { useEffect, useState } from 'react';
import { db, setSetting, storageInfo, requestPersist } from '../lib/db.js';
import { isStandalone } from './Home.jsx';

export default function Settings({ startDate, back }) {
  const [info, setInfo] = useState(null);
  const [date, setDate] = useState(startDate || '');

  const refresh = async () => setInfo(await storageInfo());
  useEffect(() => { refresh(); }, []);

  const saveDate = async () => {
    if (!date) return;
    await setSetting('startDate', date);
    back();
  };

  const clearTest = async () => {
    const tests = await db.days.filter((d) => d.test).primaryKeys();
    await db.days.bulkDelete(tests);
    back();
  };

  return (
    <main className="screen">
      <header className="top">
        <button className="icon-btn" onClick={back}>← 홈</button>
      </header>
      <h1>설정</h1>

      <section className="card">
        <h2>저장 상태</h2>
        <Row label="홈 화면 앱으로 실행 중" value={isStandalone() ? '예 ✅' : '아니오 (사파리 탭)'} />
        <Row label="데이터 영구 보관" value={info?.persisted == null ? '확인 불가' : info.persisted ? '허용됨 ✅' : '아직 아님'} />
        <Row label="사용 중인 용량" value={info?.usageMB != null ? `${info.usageMB} MB` : '확인 불가'} />
        {info && !info.persisted && (
          <button className="secondary" onClick={async () => { await requestPersist(); refresh(); }}>
            영구 보관 다시 요청
          </button>
        )}
      </section>

      <section className="card">
        <h2>시작일(0일차) 변경</h2>
        <p className="muted small">테스트용. 날짜를 과거로 바꾸면 '빠진 날' 표시를 확인할 수 있어요.</p>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <button className="secondary" onClick={saveDate}>저장</button>
      </section>

      <section className="card">
        <h2>테스트 기록 지우기</h2>
        <button className="secondary" onClick={clearTest}>(테스트) 완료 표시 모두 지우기</button>
      </section>

      <p className="muted small">백업/복원, 모든 데이터 삭제는 1-4단계에서 추가돼요.</p>
    </main>
  );
}

function Row({ label, value }) {
  return (
    <div className="row"><span>{label}</span><b>{value}</b></div>
  );
}
