import React, { useCallback, useEffect, useState } from 'react';
import { db, getSetting, requestPersist } from './lib/db.js';
import Home from './screens/Home.jsx';
import Settings from './screens/Settings.jsx';
import CheckinPlaceholder from './screens/CheckinPlaceholder.jsx';

// 화면 이동은 주소(URL)를 바꾸지 않고 상태로만 처리 → 홈 화면 앱에서 경로 꼬임 없음
export default function App() {
  const [screen, setScreen] = useState({ name: 'home' });
  const [startDate, setStartDate] = useState(undefined); // undefined = 불러오는 중
  const [doneDays, setDoneDays] = useState(new Set());

  const reload = useCallback(async () => {
    setStartDate(await getSetting('startDate'));
    const days = await db.days.toArray();
    setDoneDays(new Set(days.map((d) => d.day)));
  }, []);

  useEffect(() => {
    reload();
    requestPersist();
  }, [reload]);

  // 아침에 앱을 다시 열면 날짜가 바뀌었을 수 있으니 다시 계산
  useEffect(() => {
    const onVisible = () => document.visibilityState === 'visible' && reload();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [reload]);

  if (startDate === undefined) return <div className="app" />;

  const go = (name, params = {}) => {
    setScreen({ name, ...params });
    window.scrollTo(0, 0);
  };
  const back = async () => { await reload(); go('home'); };

  return (
    <div className="app">
      {screen.name === 'home' && (
        <Home startDate={startDate} doneDays={doneDays} go={go} reload={reload} />
      )}
      {screen.name === 'checkin' && (
        <CheckinPlaceholder day={screen.day} startDate={startDate} back={back} />
      )}
      {screen.name === 'settings' && (
        <Settings startDate={startDate} back={back} />
      )}
    </div>
  );
}
