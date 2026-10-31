import React, { useEffect, useState } from 'react';
import { db, setSetting, storageInfo, requestPersist } from '../lib/db.js';
import { isStandalone } from './Home.jsx';

export default function Settings({ startDate, back, go }) {
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
      <header className="top"><button className="icon-btn" onClick={back}>← 홈</button></header>
      <h1 className="title">설정</h1>

      <section className="card">
        <p className="label">보안</p>
        <div className="list">
          <button className="list-row" onClick={() => go('change-pin')}>
            <span>비밀번호 바꾸기</span><span className="chev">›</span>
          </button>
        </div>
        <p className="caption">앱을 처음 열 때, 그리고 1분 넘게 다른 앱을 쓰다 돌아올 때 물어봐요.</p>
      </section>

      <section className="card">
        <p className="label">저장 상태</p>
        <Row label="홈 화면 앱으로 실행 중" value={isStandalone() ? '예' : '아니오 (사파리 탭)'} ok={isStandalone()} />
        <Row label="데이터 영구 보관" value={info?.persisted == null ? '확인 불가' : info.persisted ? '허용됨' : '아직 아님'} ok={info?.persisted} />
        <Row label="사용 중인 용량" value={info?.usageMB != null ? `${info.usageMB} MB` : '확인 불가'} />
        {info && !info.persisted && (
          <button className="btn secondary sm" onClick={async () => { await requestPersist(); refresh(); }}>
            영구 보관 다시 요청
          </button>
        )}
      </section>

      <section className="card">
        <p className="label">테스트용</p>
        <p className="caption">시작일(0일차)을 과거로 바꾸면 '빠진 날' 표시를 확인할 수 있어요. 확인 후 실제 날짜로 되돌려 주세요.</p>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <button className="btn secondary sm" onClick={saveDate}>시작일 저장</button>
        <button className="btn secondary sm" onClick={clearTest}>(테스트) 완료 표시 모두 지우기</button>
      </section>

      <p className="caption center">백업/복원, 모든 데이터 삭제는 1-4단계에서 추가돼요.</p>
    </main>
  );
}

function Row({ label, value, ok }) {
  return (
    <div className="row">
      <span className="sub">{label}</span>
      <b className={ok ? 'blue' : ''}>{value}</b>
    </div>
  );
}
