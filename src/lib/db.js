import Dexie from 'dexie';

// 모든 데이터는 이 브라우저(아이폰) 안의 IndexedDB에만 저장됩니다.
// 외부로 보내는 코드는 이 앱에 없습니다.
export const db = new Dexie('jeremy');

db.version(1).stores({
  settings: 'key',           // startDate, prediction, checklist 등 한 개짜리 값
  days: 'day',               // 1~7일차 데일리 기록
  images: '++id, kind, day', // 캡처 이미지 (종류, 몇 일차)
});

export async function getSetting(key, fallback = null) {
  const row = await db.settings.get(key);
  return row ? row.value : fallback;
}

export function setSetting(key, value) {
  return db.settings.put({ key, value });
}

// 아이폰이 저장 공간이 부족할 때 데이터를 지우지 않도록 "계속 보관"을 요청
export async function requestPersist() {
  if (!navigator.storage?.persist) return null;
  try {
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}

export async function storageInfo() {
  const info = { persisted: null, usageMB: null, quotaMB: null };
  try {
    if (navigator.storage?.persisted) info.persisted = await navigator.storage.persisted();
    if (navigator.storage?.estimate) {
      const e = await navigator.storage.estimate();
      info.usageMB = e.usage != null ? +(e.usage / 1048576).toFixed(1) : null;
      info.quotaMB = e.quota != null ? Math.round(e.quota / 1048576) : null;
    }
  } catch { /* 지원 안 하는 브라우저 */ }
  return info;
}
