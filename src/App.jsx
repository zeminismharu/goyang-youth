import React, { useCallback, useEffect, useRef, useState } from 'react';
import { db, getSetting, requestPersist } from './lib/db.js';
import { hasPin } from './lib/pin.js';
import Home from './screens/Home.jsx';
import Settings from './screens/Settings.jsx';
import Checkin from './screens/Checkin.jsx';
import Day0 from './screens/Day0.jsx';
import { currentDay } from './lib/days.js';
import { Unlock, SetPin, FaceIdOffer } from './screens/Lock.jsx';
import { faceIdSupported } from './lib/faceid.js';

// 앱을 내렸다가 이 시간 이상 지나서 다시 열면 잠금
const RELOCK_MS = 60 * 1000;

export default function App() {
  const [screen, setScreen] = useState({ name: 'home' });
  const [startDate, setStartDate] = useState(undefined); // undefined = 불러오는 중
  const [doneDays, setDoneDays] = useState(new Set());
  const [pinSet, setPinSet] = useState(undefined);
  const [locked, setLocked] = useState(true);
  const [offerFace, setOfferFace] = useState(false);
  const hiddenAt = useRef(null);

  const reload = useCallback(async () => {
    setStartDate(await getSetting('startDate'));
    const days = await db.days.toArray();
    // 총 사용 시간을 넣었으면 '완료'로 봄
    setDoneDays(new Set(days.filter((d) => d.totalMinutes != null || d.test).map((d) => d.day)));
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

  // 잠금은 선택 사항: 설정에서 비밀번호를 켠 경우에만 잠금 화면
  if (offerFace) {
    return <div className="app"><FaceIdOffer onDone={() => setOfferFace(false)} /></div>;
  }
  if (pinSet && locked) {
    return <div className="app"><Unlock onUnlock={() => setLocked(false)} /></div>;
  }

  const go = (name, params = {}) => {
    setScreen({ name, ...params });
    window.scrollTo(0, 0);
  };
  const back = async () => { await reload(); go('home'); };

  return (
    <div className="app">
      {__PREVIEW__ && (
        <div className="preview-bar">미리보기 · 여기 입력한 내용은 실제 앱으로 옮겨지지 않아요</div>
      )}
      {screen.name === 'home' && <Home startDate={startDate} doneDays={doneDays} go={go} reload={reload} />}
      {screen.name === 'checkin' && <Checkin key={screen.day} day={screen.day} startDate={startDate} back={back} />}
      {screen.name === 'day0' && <Day0 cur={startDate ? currentDay(startDate) : 0} back={back} />}
      {screen.name === 'settings' && <Settings startDate={startDate} back={back} go={go} />}
      {screen.name === 'change-pin' && <SetPin title="새 비밀번호 4자리" onDone={back} onCancel={back} />}
      {screen.name === 'new-pin' && (
        <SetPin
          onDone={async () => { setLocked(false); setOfferFace(await faceIdSupported()); back(); }}
          onCancel={back}
        />
      )}
    </div>
  );
}
