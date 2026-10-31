import React, { useEffect, useState } from 'react';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];
export const PIN_LEN = 4;

// 숫자 4개를 누르면 자동으로 onComplete 호출 (확인 버튼 없음 → 터치 최소화)
export default function PinPad({ title, sub, error, onComplete, footer }) {
  const [pin, setPin] = useState('');
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (!error) return;
    setShake(true);
    setPin('');
    const t = setTimeout(() => setShake(false), 400);
    return () => clearTimeout(t);
  }, [error]);

  const press = (k) => {
    if (k === 'del') return setPin((p) => p.slice(0, -1));
    if (!k || pin.length >= PIN_LEN) return;
    const next = pin + k;
    setPin(next);
    if (next.length === PIN_LEN) {
      setTimeout(() => { onComplete(next); setPin(''); }, 120);
    }
  };

  return (
    <main className="pin-screen">
      <div className="pin-head">
        <h1 className="title">{title}</h1>
        <p className={`pin-sub ${error ? 'err' : ''}`}>{error || sub || ' '}</p>
        <div className={`pin-dots ${shake ? 'shake' : ''}`} aria-label={`${pin.length}자리 입력됨`}>
          {Array.from({ length: PIN_LEN }).map((_, i) => (
            <span key={i} className={i < pin.length ? 'on' : ''} />
          ))}
        </div>
      </div>
      <div className="keypad">
        {KEYS.map((k, i) => (
          <button
            key={i}
            className="key"
            disabled={!k}
            onClick={() => press(k)}
            aria-label={k === 'del' ? '지우기' : k}
          >
            {k === 'del' ? '⌫' : k}
          </button>
        ))}
      </div>
      {footer && <div className="pin-footer">{footer}</div>}
    </main>
  );
}
