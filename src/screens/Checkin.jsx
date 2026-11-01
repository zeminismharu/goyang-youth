import React, { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getSetting } from '../lib/db.js';
import { dateOfDay, formatKDate } from '../lib/days.js';
import { DAILY_KINDS } from '../lib/images.js';
import { MOODS, APP_OPTIONS } from '../lib/options.js';
import { ImageSlot, MultiPhotoButton, TimeInput } from '../components/ui.jsx';

const EMPTY_APPS = [{ name: '', minutes: null }, { name: '', minutes: null }, { name: '', minutes: null }];

// 한 화면 체크인. 입력하는 즉시 자동 저장 → '완료'는 홈으로 돌아가는 버튼일 뿐
export default function Checkin({ day, startDate, back }) {
  const [log, setLog] = useState(null);
  const [saved, setSaved] = useState(false);
  const timer = useRef();
  const latest = useRef();

  // 처음 열 때: 저장된 기록 불러오기. 없으면 앱 이름을 전날(또는 0일차 예측)에서 미리 채움
  useEffect(() => {
    (async () => {
      const row = await db.days.get(day);
      if (row && !row.test) { setLog(row); return; }
      const prev = (await db.days.where('day').below(day).reverse().toArray()).find((d) => d.apps?.some((a) => a.name));
      const pred = await getSetting('prediction');
      const names = prev?.apps?.map((a) => a.name) || pred?.apps || [];
      setLog({
        day, totalMinutes: null, mood: null, memo: '', want: '',
        apps: EMPTY_APPS.map((a, i) => ({ ...a, name: names[i] || '' })),
      });
    })();
  }, [day]);

  const flush = async () => {
    clearTimeout(timer.current);
    if (latest.current) await db.days.put({ ...latest.current, updatedAt: Date.now() });
  };
  useEffect(() => () => { flush(); }, []); // 화면을 떠날 때도 저장

  const update = (patch) => {
    setLog((l) => {
      const next = { ...l, ...patch };
      latest.current = next;
      return next;
    });
    setSaved(false);
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => { await flush(); setSaved(true); }, 500);
  };

  const imgs = useLiveQuery(() => db.images.where('day').equals(day).toArray(), [day]);
  const appNames = useLiveQuery(async () => {
    const pred = await getSetting('prediction');
    const used = (await db.days.toArray()).flatMap((d) => d.apps?.map((a) => a.name) || []);
    return [...new Set([...(pred?.apps || []), ...used, ...APP_OPTIONS])].filter(Boolean).slice(0, 12);
  }, []);

  if (!log) return <main className="screen" />;

  const setApp = (i, patch) => update({ apps: log.apps.map((a, j) => (j === i ? { ...a, ...patch } : a)) });
  const fillName = (name) => {
    if (log.apps.some((a) => a.name === name)) return;
    const i = log.apps.findIndex((a) => !a.name);
    if (i >= 0) setApp(i, { name });
  };
  const imgCount = (imgs || []).filter((r) => DAILY_KINDS.includes(r.kind)).length;
  const finish = async () => { await flush(); back(); };

  return (
    <main className="screen has-cta">
      <header className="top">
        <button className="icon-btn" onClick={finish}>← 홈</button>
        <span className="caption">{saved ? '자동 저장됨 ✓' : ' '}</span>
      </header>
      <section>
        <p className="caption">{formatKDate(dateOfDay(startDate, day))}</p>
        <h1 className="title">{day}일차 기록</h1>
      </section>

      {/* 1. 캡처 3장 */}
      <section className="card">
        <div className="card-head">
          <span className="label">1. 캡처 3장</span>
          <span className="value"><b className="blue">{imgCount}</b> / 3</span>
        </div>
        <p className="caption">스크린타임 → 유튜브 홈 → 인스타 탐색 순서로 한 번에 고르면 알아서 들어가요. 칸을 누르면 한 장씩 바꿀 수 있어요.</p>
        <div className="slots">
          {DAILY_KINDS.map((k) => <ImageSlot key={k} kind={k} day={day} />)}
        </div>
        <MultiPhotoButton kinds={DAILY_KINDS} day={day}>사진 한 번에 고르기</MultiPhotoButton>
      </section>

      {/* 2. 스크린타임 숫자 */}
      <section className="card">
        <p className="label">2. 오늘 총 사용 시간</p>
        <TimeInput minutes={log.totalMinutes} onChange={(m) => update({ totalMinutes: m })} label="총 사용 시간" />
        <p className="label" style={{ marginTop: 10 }}>많이 쓴 앱 3개</p>
        <div className="app-rows">
          {log.apps.map((a, i) => (
            <div key={i} className="app-row">
              <span className="app-n">{i + 1}</span>
              <input className="app-name" placeholder="앱 이름" value={a.name}
                onChange={(e) => setApp(i, { name: e.target.value })} />
              <TimeInput size="sm" minutes={a.minutes} onChange={(m) => setApp(i, { minutes: m })} label={`${i + 1}위 앱 사용 시간`} />
            </div>
          ))}
        </div>
        {appNames && log.apps.some((a) => !a.name) && (
          <div className="chips small">
            {appNames.filter((n) => !log.apps.some((a) => a.name === n)).map((n) => (
              <button key={n} className="chip" onClick={() => fillName(n)}>{n}</button>
            ))}
          </div>
        )}
      </section>

      {/* 3. 기분 */}
      <section className="card">
        <p className="label">3. 오늘 기분</p>
        <div className="moods">
          {MOODS.map((m) => (
            <button key={m.v} className={`mood ${log.mood === m.v ? 'on' : ''}`} onClick={() => update({ mood: m.v })} aria-label={m.t}>
              <span className="mood-e">{m.e}</span><span className="mood-t">{m.t}</span>
            </button>
          ))}
        </div>
      </section>

      {/* 4. 한 줄 */}
      <section className="card">
        <p className="label">4. 한 줄 <span className="caption">(비워도 돼요)</span></p>
        <input className="line" placeholder="오늘 한 줄 메모" value={log.memo} onChange={(e) => update({ memo: e.target.value })} enterKeyHint="next" />
        <input className="line" placeholder="오늘 사고 싶어진 것" value={log.want} onChange={(e) => update({ want: e.target.value })} enterKeyHint="done" />
      </section>

      <div className="cta-bar">
        <button className="btn" onClick={finish}>{log.totalMinutes == null ? '나중에 마저 하기' : '완료'}</button>
      </div>
    </main>
  );
}
