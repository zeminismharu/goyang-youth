import React, { useCallback, useEffect, useRef, useState } from 'react';
import { db, getSetting, requestPersist } from './lib/db.js';
import { hasPin } from './lib/pin.js';
import Home from './screens/Home.jsx';
import Settings from './screens/Settings.jsx';
import CheckinPlaceholder from './screens/CheckinPlaceholder.jsx';
import { Unlock, SetPin } from './screens/Lock.jsx';

// 앱을 내렸다가 이 시간 이상 지나서 다시 열면 잠금
const RELOCK_MS = 60 * 1000;

export default function App() {
  const [screen, setScreen] = useState({ name: 'home' });
  const [startDate, setStartDate] = useState(undefined); // undefined = 불러오는 중
  const [doneDays, setDoneDays] = useState(new Set());
  const [pinSet, setPinSet] = useState(undefined);
  const [locked, setLocked] = useState(true);
  const hiddenAt = useRef(null);

  const reload = useCallback(async () => {
    setStartDate(await getSetting('startDate'));
    const days = await db.days.toArray();
    setDoneDays(new Set(days.map((d) => d.day)));
    setPinSet(await hasPin());
  }, []);

  useEffect(() => {
    reload();
    requestPersist();
  }, [reload]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt.current = Date.now();
      } else {
        if (hiddenAt.current && Date.now() - hiddenAt.current > RELOCK_MS) setLocked(true);
        reload(); // 날짜가 바뀌었을 수 있으니 다시 계산
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [reload]);

  if (startDate === undefined || pinSet === undefined) return <div className="app" />;

  // 비밀번호가 없으면 먼저 만들기
  if (!pinSet) {
    return <div className="app"><SetPin onDone={async () => { await reload(); setLocked(false); }} /></div>;
  }
  if (locked) {
    return <div className="app"><Unlock onUnlock={() => setLocked(false)} /></div>;
  }

  const go = (name, params = {}) => {
    setScreen({ name, ...params });
    window.scrollTo(0, 0);
  };
  const back = async () => { await reload(); go('home'); };

  return (
    <div className="app">
      {screen.name === 'home' && <Home startDate={startDate} doneDays={doneDays} go={go} reload={reload} />}
      {screen.name === 'checkin' && <CheckinPlaceholder day={screen.day} startDate={startDate} back={back} />}
      {screen.name === 'settings' && <Settings startDate={startDate} back={back} go={go} />}
      {screen.name === 'change-pin' && <SetPin title="새 비밀번호 4자리" onDone={back} onCancel={back} />}
    </div>
  );
}
