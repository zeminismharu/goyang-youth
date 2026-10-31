import React, { useEffect, useRef, useState } from 'react';
import PinPad from './PinPad.jsx';
import { checkPin, savePin } from '../lib/pin.js';
import { db } from '../lib/db.js';
import { enableFaceId, faceIdEnabled, verifyFaceId } from '../lib/faceid.js';

// 잠금 해제 화면
export function Unlock({ onUnlock }) {
  const [error, setError] = useState('');
  const [fails, setFails] = useState(0);
  const [waitUntil, setWaitUntil] = useState(0);
  const [forgot, setForgot] = useState(false);
  const [faceOn, setFaceOn] = useState(false);
  const [faceBusy, setFaceBusy] = useState(false);
  const tried = useRef(false);

  const tryFace = async () => {
    if (faceBusy) return;
    setFaceBusy(true);
    const ok = await verifyFaceId();
    setFaceBusy(false);
    if (ok) onUnlock();
  };

  // 화면이 뜨자마자 Face ID를 한 번 자동으로 시도 (아이폰이 막으면 버튼으로)
  useEffect(() => {
    faceIdEnabled().then((on) => {
      setFaceOn(on);
      if (on && !tried.current) { tried.current = true; tryFace(); }
    });
  }, []);

  const submit = async (pin) => {
    if (Date.now() < waitUntil) {
      setError(`잠시 후 다시 시도해 주세요`);
      return;
    }
    if (await checkPin(pin)) return onUnlock();
    const n = fails + 1;
    setFails(n);
    if (n % 5 === 0) {
      setWaitUntil(Date.now() + 30000);
      setError('5번 틀렸어요. 30초 뒤에 다시 시도해 주세요');
    } else {
      setError(`비밀번호가 달라요 (${n}번 틀림)`);
    }
  };

  if (forgot) return <Forgot back={() => setForgot(false)} />;

  return (
    <PinPad
      title="비밀번호를 입력해 주세요"
      error={error}
      onComplete={submit}
      footer={
        <>
          {faceOn && (
            <button className="btn secondary face-btn" onClick={tryFace} disabled={faceBusy}>
              Face ID로 열기
            </button>
          )}
          <button className="text-btn" onClick={() => setForgot(true)}>비밀번호를 잊었어요</button>
        </>
      }
    />
  );
}

// 비밀번호를 만든 직후: Face ID도 쓸지 물어보기
export function FaceIdOffer({ onDone }) {
  const [error, setError] = useState('');
  const turnOn = async () => {
    try {
      await enableFaceId();
      onDone();
    } catch {
      setError('Face ID를 켜지 못했어요. 나중에 설정에서 다시 켤 수 있어요.');
    }
  };
  return (
    <main className="screen has-cta">
      <header className="top" />
      <h1 className="title lg">Face ID로<br />더 빠르게 열까요?</h1>
      <p className="body sub">매일 밤 기록할 때 비밀번호 대신 얼굴로 열 수 있어요. Face ID가 안 될 때는 비밀번호로 열면 돼요.</p>
      <section className="card">
        <p className="body sub">얼굴 정보는 아이폰이 직접 확인하고, 앱은 '본인 맞음' 결과만 받아요. 어디에도 전송되지 않아요.</p>
        <p className="caption">아이폰 설정 &gt; 암호 앱에 '제레미' 항목이 생길 수 있어요. Face ID 등록을 위해 아이폰이 만드는 열쇠예요.</p>
      </section>
      {error && <p className="body" style={{ color: 'var(--red)' }}>{error}</p>}
      <div className="cta-bar cta-two">
        <button className="btn secondary" onClick={onDone}>나중에</button>
        <button className="btn" onClick={turnOn}>Face ID 켜기</button>
      </div>
    </main>
  );
}

function Forgot({ back }) {
  const wipe = async () => {
    if (!window.confirm('기록과 캡처가 전부 지워지고 되돌릴 수 없어요. 정말 지울까요?')) return;
    await db.delete();
    window.location.reload();
  };
  return (
    <main className="screen">
      <header className="top"><button className="icon-btn" onClick={back}>← 뒤로</button></header>
      <h1 className="title">비밀번호를 잊었나요?</h1>
      <p className="body">
        비밀번호는 이 휴대폰에만 있고 어디에도 보내지 않아서, 찾아드릴 방법이 없어요.
        처음부터 다시 시작하려면 모든 데이터를 지워야 해요.
      </p>
      <p className="body sub">백업 파일이 있다면 지운 뒤 복원할 수 있어요. (백업 기능은 1-4단계에서 추가돼요)</p>
      <div className="cta-bar"><button className="btn danger" onClick={wipe}>모든 데이터 지우고 처음부터</button></div>
    </main>
  );
}

// 비밀번호 만들기 (두 번 입력해서 확인)
export function SetPin({ onDone, title = '비밀번호 4자리를 만들어 주세요', onCancel }) {
  const [first, setFirst] = useState(null);
  const [error, setError] = useState('');

  const submit = async (pin) => {
    if (!first) { setFirst(pin); setError(''); return; }
    if (pin !== first) { setFirst(null); setError('두 번 입력한 비밀번호가 달라요. 처음부터 다시 입력해 주세요'); return; }
    await savePin(pin);
    onDone();
  };

  return (
    <PinPad
      title={first ? '한 번 더 입력해 주세요' : title}
      sub={first ? '' : '앱을 열 때마다 물어볼게요'}
      error={error}
      onComplete={submit}
      footer={onCancel && <button className="text-btn" onClick={onCancel}>취소</button>}
    />
  );
}
