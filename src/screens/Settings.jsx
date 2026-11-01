import React, { useEffect, useRef, useState } from 'react';
import { exportBackup, readBackup, restoreBackup, wipeAll } from '../lib/backup.js';
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

  const [confirmOff, setConfirmOff] = useState(false);
  const turnOffLock = async () => {
    if (!confirmOff) { setConfirmOff(true); return; }
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
                <span style={{ color: 'var(--red)' }}>{confirmOff ? '한 번 더 누르면 잠금이 꺼져요' : '잠금 끄기'}</span><span className="chev">›</span>
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

      <DataSection back={back} />

      <details className="card dev">
        <summary className="label">개발자 테스트 (실험 중에는 쓰지 마세요)</summary>
        <p className="caption">시작일(0일차)을 과거로 바꾸면 '빠진 날' 표시를 확인할 수 있어요.</p>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <button className="btn secondary sm" onClick={saveDate}>시작일 저장</button>
        <button className="btn secondary sm" onClick={clearTest}>(테스트) 완료 표시 모두 지우기</button>
      </details>

      <p className="caption center">버전 {__BUILD__}</p>
    </main>
  );
}

function DataSection({ back }) {
  const [msg, setMsg] = useState('');
  const [pending, setPending] = useState(null); // 복원할 백업 내용
  const [wipeSure, setWipeSure] = useState(false);
  const fileRef = useRef();

  const doBackup = async () => {
    setMsg('백업 파일을 만드는 중…');
    try {
      const r = await exportBackup();
      setMsg(r.cancelled ? '' : `백업했어요 (${r.sizeMB}MB). 파일 앱이나 카톡 '나와의 채팅'에 저장해 두세요.`);
    } catch { setMsg('백업하지 못했어요. 다시 시도해 주세요.'); }
  };

  const pickRestore = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try { setPending(await readBackup(f)); setMsg(''); } catch (err) { setMsg(err.message); }
  };

  const doRestore = async () => {
    setMsg('복원하는 중…');
    try { await restoreBackup(pending); setPending(null); back(); }
    catch { setMsg('복원하지 못했어요. 파일이 손상됐을 수 있어요.'); }
  };

  const doWipe = async () => {
    if (!wipeSure) { setWipeSure(true); return; }
    await wipeAll();
    window.location.reload();
  };

  return (
    <section className="card">
      <p className="label">데이터</p>
      <p className="caption">기록은 이 휴대폰에만 있어요. 이틀에 한 번은 백업해 두세요.</p>
      <button className="btn sm" onClick={doBackup}>백업 파일 저장</button>
      <button className="btn secondary sm" onClick={() => fileRef.current.click()}>백업에서 복원</button>
      <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={pickRestore} />
      {pending && (
        <div className="confirm-box">
          <p className="body">
            {new Date(pending.exportedAt).toLocaleString('ko-KR')} 백업 · 기록 {pending.days.length}일 · 사진 {pending.images?.length || 0}장
          </p>
          <p className="caption">지금 이 휴대폰의 기록은 지워지고 백업 내용으로 바뀌어요.</p>
          <div className="two">
            <button className="btn secondary sm" onClick={() => setPending(null)}>취소</button>
            <button className="btn sm" onClick={doRestore}>복원하기</button>
          </div>
        </div>
      )}
      {msg && <p className="body sub">{msg}</p>}
      <button className="btn sm danger-soft" onClick={doWipe}>
        {wipeSure ? '한 번 더 누르면 전부 지워져요 (되돌릴 수 없음)' : '모든 데이터 삭제'}
      </button>
    </section>
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
