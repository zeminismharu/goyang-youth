import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db.js';
import { KINDS, saveImage, deleteImage } from '../lib/images.js';

// 시간 입력: [ 4 ]시간 [ 30 ]분 — 숫자 키패드가 바로 뜸
export function TimeInput({ minutes, onChange, size = 'lg', label }) {
  const h = minutes == null ? '' : Math.floor(minutes / 60);
  const m = minutes == null ? '' : minutes % 60;
  const set = (nh, nm) => {
    if (nh === '' && nm === '') return onChange(null);
    const hh = Math.max(0, Math.min(24, parseInt(nh || 0, 10) || 0));
    const mm = Math.max(0, Math.min(59, parseInt(nm || 0, 10) || 0));
    onChange(hh * 60 + mm);
  };
  return (
    <div className={`time-input ${size}`} aria-label={label}>
      <input inputMode="numeric" pattern="[0-9]*" placeholder="0" value={h}
        onChange={(e) => set(e.target.value.replace(/\D/g, '').slice(0, 2), m === '' ? '' : String(m))} />
      <span>시간</span>
      <input inputMode="numeric" pattern="[0-9]*" placeholder="0" value={m}
        onChange={(e) => set(h === '' ? '' : String(h), e.target.value.replace(/\D/g, '').slice(0, 2))} />
      <span>분</span>
    </div>
  );
}

// 탭으로 고르기 (최대 max개, 고른 순서대로 1·2·3 표시) + 직접 입력
export function ChipPicker({ options, selected, onChange, max = 3 }) {
  const [custom, setCustom] = useState('');
  const all = useMemo(() => [...options, ...selected.filter((s) => !options.includes(s))], [options, selected]);
  const toggle = (o) => {
    if (selected.includes(o)) onChange(selected.filter((s) => s !== o));
    else if (selected.length < max) onChange([...selected, o]);
    else onChange([...selected.slice(0, max - 1), o]); // 꽉 차면 마지막 것을 교체
  };
  const addCustom = () => {
    const v = custom.trim();
    if (!v) return;
    if (!selected.includes(v)) toggle(v);
    setCustom('');
  };
  return (
    <div>
      <div className="chips">
        {all.map((o) => {
          const i = selected.indexOf(o);
          return (
            <button key={o} className={`chip ${i >= 0 ? 'on' : ''}`} onClick={() => toggle(o)}>
              {i >= 0 && <b className="chip-n">{i + 1}</b>}{o}
            </button>
          );
        })}
      </div>
      <div className="custom-row">
        <input placeholder="목록에 없으면 직접 입력" value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addCustom()} enterKeyHint="done" />
        <button className="btn secondary sm inline" onClick={addCustom} disabled={!custom.trim()}>추가</button>
      </div>
    </div>
  );
}

// 저장된 이미지 한 장을 보여주는 썸네일 (object URL 관리)
function useBlobUrl(blob) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (!blob) return setUrl(null);
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}

// 사진 칸: 비어 있으면 탭해서 고르기, 있으면 탭해서 교체
export function ImageSlot({ kind, day, label }) {
  const row = useLiveQuery(() => db.images.where({ kind, day }).first(), [kind, day]);
  const url = useBlobUrl(row?.blob);
  const ref = useRef();
  const [busy, setBusy] = useState(false);
  const pick = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setBusy(true);
    try { await saveImage(kind, day, f); } catch (err) { alert(err.message); }
    setBusy(false);
  };
  return (
    <div className="slot">
      <button className={`slot-box ${url ? 'filled' : ''}`} onClick={() => ref.current.click()} aria-label={`${label || KINDS[kind]} 사진 ${url ? '바꾸기' : '고르기'}`}>
        {url ? <img src={url} alt="" /> : <span className="slot-plus">{busy ? '…' : '+'}</span>}
        {url && <span className="slot-check">✓</span>}
      </button>
      <span className="slot-label">{label || KINDS[kind]}</span>
      {url && <button className="slot-del" onClick={() => deleteImage(kind, day)}>삭제</button>}
      <input ref={ref} type="file" accept="image/*" hidden onChange={pick} />
    </div>
  );
}

// 여러 장을 한 번에 골라 빈 칸부터 순서대로 채우기
export function MultiPhotoButton({ kinds, day, children }) {
  const ref = useRef();
  const [busy, setBusy] = useState(false);
  const pick = async (e) => {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    if (!files.length) return;
    setBusy(true);
    const existing = new Set((await db.images.where('day').equals(day).toArray()).map((r) => r.kind));
    // 3장을 고르면 순서대로 전부 교체, 그보다 적으면 빈 칸부터 채움
    const targets = files.length >= kinds.length ? kinds : kinds.filter((k) => !existing.has(k));
    const order = targets.length ? targets : kinds;
    try {
      for (let i = 0; i < Math.min(files.length, order.length); i++) {
        await saveImage(order[i], day, files[i]);
      }
    } catch (err) { alert(err.message); }
    setBusy(false);
  };
  return (
    <>
      <button className="btn secondary" onClick={() => ref.current.click()} disabled={busy}>
        {busy ? '저장하는 중…' : children}
      </button>
      <input ref={ref} type="file" accept="image/*" multiple hidden onChange={pick} />
    </>
  );
}
