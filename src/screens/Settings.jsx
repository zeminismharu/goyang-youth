import React, { useEffect, useState } from 'react';
import { db, setSetting, storageInfo, requestPersist } from '../lib/db.js';
import { isStandalone } from './Home.jsx';
import { disableFaceId, enableFaceId, faceIdEnabled, faceIdSupported } from '../lib/faceid.js';
import { hasPin, removePin } from '../lib/pin.js';

export default function Settings({ startDate, back, go }) {
  const [info, setInfo] = useState(null);
  const [date, setDate] = useState(startDate || '');

  const [face, setFace] = useState({ supported: false, on: false, msg: '' });
  const [pinOn, setPinOn] = useState(false);

  const refresh = async () => setInfo(await storageInfo());
  const refreshFace = async () => setFace({ supported: await faceIdSupported(), on: await faceIdEnabled(), msg: '' });
  useEffect(() => { refresh(); refreshFace(); hasPin().then(setPinOn); }, []);

  const turnOffLock = async () => {
    if (!window.confirm('잠금을 끌까요? 앱을 열면 바로 기록이 보여요.')) return;
    await disableFaceId();
    await removePin();
    back();
  };

  const toggleFace = async () => {
    if (face.on) { await disableFaceId(); return refreshFace(); }
    try { await enableFaceId(); refreshFace(); }
    catch { setFace((f) => ({ ...f, msg: 'Face ID를 켜지 못했어요. 다시 시도해 주세요.' })); }
  };

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
        {!pinOn ? (
          <>
            <div className="list">
              <button className="list-row" onClick={() => go('new-pin')}>
                <span>비밀번호 잠금 켜기</span><span className="chev">›</span>
              </button>
            </div>
            <p className="caption">지금은 잠금이 꺼져 있어요. 켜면 비밀번호 4자리와 Face ID로 앱을 잠글 수 있어요.</p>
          </>
        ) : (
          <>
            <div className="list">
              <button className="list-row" onClick={() => go('change-pin')}>
                <span>비밀번호 바꾸기</span><span className="chev">›</span>
              </button>
              {face.supported ? (
                <button className="list-row" onClick={toggleFace} role="switch" aria-checked={face.on}>
                  <span>Face ID로 열기</span>
                  <span className={`switch ${face.on ? 'on' : ''}`} aria-hidden="true"><i /></span>
                </button>
              ) : (
                <div className="list-row"><span className="sub">Face ID</span><span className="caption">이 기기/브라우저에서 사용할 수 없어요</span></div>
              )}
              <button className="list-row" onClick={turnOffLock}>
                <span style={{ color: 'var(--red)' }}>잠금 끄기</span><span className="chev">›</span>
              </button>
            </div>
            {face.msg && <p className="caption" style={{ color: 'var(--red)' }}>{face.msg}</p>}
            <p className="caption">앱을 처음 열 때, 그리고 1분 넘게 다른 앱을 쓰다 돌아올 때 물어봐요.</p>
          </>
        )}
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
