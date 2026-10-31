import React, { useState } from 'react';
import PinPad from './PinPad.jsx';
import { checkPin, savePin } from '../lib/pin.js';
import { db } from '../lib/db.js';

// 잠금 해제 화면
export function Unlock({ onUnlock }) {
  const [error, setError] = useState('');
  const [fails, setFails] = useState(0);
  const [waitUntil, setWaitUntil] = useState(0);
  const [forgot, setForgot] = useState(false);

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
      footer={<button className="text-btn" onClick={() => setForgot(true)}>비밀번호를 잊었어요</button>}
    />
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
