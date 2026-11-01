import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, setSetting } from '../lib/db.js';
import { APP_OPTIONS, TOPIC_OPTIONS, fmtMinutes } from '../lib/options.js';
import { ChipPicker, ImageSlot, TimeInput } from '../components/ui.jsx';

const QUICK_HOURS = [2, 3, 4, 5, 6, 7, 8];

// 체크리스트: 앱 안에서 링크 열기 → 돌아와서 탭 한 번으로 완료
const CHECKS = [
  {
    id: 'ytHistory',
    title: '유튜브 시청 기록이 켜져 있는지 확인',
    why: '꺼져 있으면 테이크아웃에 실험 기간 기록이 남지 않아요.',
    link: 'https://myactivity.google.com/product/youtube',
    linkText: '구글 내 활동 열기',
    steps: ['YouTube 기록이 "사용"인지 확인', '꺼져 있으면 켜기'],
  },
  {
    id: 'takeout',
    title: '구글 테이크아웃 신청 (예행연습)',
    why: '지금 받은 파일로 분석 기능을 미리 맞춰요. 실험 주간이 담긴 파일은 7일차 밤에 한 번 더 신청해요.',
    link: 'https://takeout.google.com',
    linkText: '구글 테이크아웃 열기',
    steps: [
      '"모두 선택 해제" 누르기',
      'YouTube 및 YouTube Music만 체크',
      '"여러 형식"에서 기록(history)을 JSON으로 바꾸기 (기본값은 HTML)',
      '"모든 YouTube 데이터 포함됨"에서 기록만 남기기',
      '다음 단계 → 내보내기 만들기',
    ],
  },
  {
    id: 'insta',
    title: '인스타 "내 정보 다운로드" 신청 (예행연습)',
    why: '어떤 항목이 들어 있는지 보고 분석을 맞춰요. 7일차 밤에 한 번 더 신청해요.',
    link: 'https://accountscenter.instagram.com/info_and_permissions/',
    linkText: '인스타 계정 센터 열기',
    steps: [
      '링크가 안 열리면: 인스타 앱 → 프로필 → ☰ → 계정 센터',
      '내 정보 및 권한 → 내 정보 다운로드',
      '형식을 JSON으로 선택',
      '기간은 "최근 1개월" 정도면 충분해요',
    ],
  },
];

export default function Day0({ cur, back }) {
  const prediction = useLiveQuery(() => db.settings.get('prediction').then((r) => r?.value || {}), []);
  const checklist = useLiveQuery(() => db.settings.get('checklist').then((r) => r?.value || {}), []);
  const adImgs = useLiveQuery(() => db.images.where('day').equals(0).toArray(), []);
  const [open, setOpen] = useState(null);

  if (!prediction || !checklist || !adImgs) return <main className="screen" />;

  const locked = cur >= 1; // 1일차부터는 예측을 못 바꿈 (정직한 비교를 위해)
  const p = { minutes: null, apps: [], topics: [], ...prediction };
  const update = (patch) => setSetting('prediction', { ...p, ...patch, updatedAt: Date.now() });
  const toggleCheck = (id) => setSetting('checklist', { ...checklist, [id]: !checklist[id] });
  const hasImg = (k) => adImgs.some((r) => r.kind === k);

  const doneCount = CHECKS.filter((c) => checklist[c.id]).length + (hasImg('googleAds') ? 1 : 0) + (hasImg('instaAds') ? 1 : 0);
  const predDone = p.minutes != null && p.apps.length === 3 && p.topics.length === 3;

  return (
    <main className="screen has-cta">
      <header className="top"><button className="icon-btn" onClick={back}>← 홈</button></header>
      <section>
        <p className="caption">0일차</p>
        <h1 className="title">{locked ? '0일차 예측과 준비' : '실제 기록 전에\n내 예상을 남겨요'}</h1>
        {!locked && <p className="body sub">고른 내용은 바로 저장돼요. 1일차부터는 예측을 바꿀 수 없어요.</p>}
      </section>

      {locked ? (
        <section className="card">
          <p className="label">내 예측 <span className="caption">(고정됨)</span></p>
          <Row k="하루 평균 사용" v={fmtMinutes(p.minutes)} />
          <Row k="많이 쓰는 앱" v={p.apps.join(', ') || '-'} />
          <Row k="주로 보는 주제" v={p.topics.join(', ') || '-'} />
        </section>
      ) : (
        <>
          <section className="card">
            <p className="label">1. 하루에 휴대폰을 얼마나 쓸 것 같아요?</p>
            <div className="chips">
              {QUICK_HOURS.map((h) => (
                <button key={h} className={`chip ${p.minutes === h * 60 ? 'on' : ''}`} onClick={() => update({ minutes: h * 60 })}>
                  {h === 8 ? '8시간+' : `${h}시간`}
                </button>
              ))}
            </div>
            <TimeInput minutes={p.minutes} onChange={(m) => update({ minutes: m })} label="예상 하루 평균 사용 시간" />
          </section>

          <section className="card">
            <p className="label">2. 가장 많이 쓰는 앱 3개 <Count n={p.apps.length} /></p>
            <p className="caption">많이 쓰는 순서대로 눌러 주세요.</p>
            <ChipPicker options={APP_OPTIONS} selected={p.apps} onChange={(apps) => update({ apps })} />
          </section>

          <section className="card">
            <p className="label">3. 주로 보는 주제 3개 <Count n={p.topics.length} /></p>
            <ChipPicker options={TOPIC_OPTIONS} selected={p.topics} onChange={(topics) => update({ topics })} />
          </section>
        </>
      )}

      <section className="card">
        <div className="card-head">
          <span className="label">준비 체크리스트</span>
          <span className="value"><b className="blue">{doneCount}</b> / 5</span>
        </div>
        <div className="list">
          {CHECKS.map((c) => (
            <div key={c.id} className="check-item">
              <div className="check-row">
                <button className={`check ${checklist[c.id] ? 'on' : ''}`} onClick={() => toggleCheck(c.id)} aria-label={`${c.title} 완료 표시`}>✓</button>
                <button className="check-title" onClick={() => setOpen(open === c.id ? null : c.id)}>
                  <span className={checklist[c.id] ? 'done-text' : ''}>{c.title}</span>
                  <span className="chev">{open === c.id ? '⌃' : '⌄'}</span>
                </button>
              </div>
              {open === c.id && (
                <div className="guide">
                  <p className="caption">{c.why}</p>
                  <ol>{c.steps.map((s) => <li key={s}>{s}</li>)}</ol>
                  <a className="btn secondary sm link-btn" href={c.link} target="_blank" rel="noopener noreferrer">{c.linkText} ↗</a>
                  <p className="caption">메뉴 이름은 업데이트로 조금 다를 수 있어요. 끝나면 왼쪽 동그라미를 눌러 주세요.</p>
                </div>
              )}
            </div>
          ))}
        </div>
        <p className="label" style={{ marginTop: 8 }}>광고 화면 캡처</p>
        <p className="caption">
          알고리즘이 나를 어떻게 보는지 기록해요. 구글은 <a href="https://myadcenter.google.com" target="_blank" rel="noopener noreferrer">내 광고 센터 ↗</a>,
          인스타는 앱 → 계정 센터 → 광고 기본 설정 → 광고 주제 화면을 캡처해서 올려 주세요.
        </p>
        <div className="slots two">
          <ImageSlot kind="googleAds" day={0} label="구글 광고 센터" />
          <ImageSlot kind="instaAds" day={0} label="인스타 광고 주제" />
        </div>
      </section>

      <div className="cta-bar">
        <button className="btn" onClick={back}>{locked || predDone ? '완료' : '나중에 마저 하기'}</button>
      </div>
    </main>
  );
}

function Count({ n }) {
  return <span className={`count ${n === 3 ? 'full' : ''}`}>{n}/3</span>;
}

function Row({ k, v }) {
  return <div className="row"><span className="sub">{k}</span><b>{v}</b></div>;
}
