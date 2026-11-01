import { db } from './db.js';

// 백업 파일: 기록 + 캡처(이미지는 글자로 바꿔 담음)를 JSON 파일 하나로
// 비밀번호·Face ID 등록은 기기 전용이라 백업에 넣지 않음
const SKIP_KEYS = ['pin', 'faceid'];

function blobToDataURL(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
}

async function dataURLToBlob(url) {
  const [head, b64] = url.split(',');
  const type = head.match(/data:(.*?);/)?.[1] || 'image/jpeg';
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type });
}

export async function makeBackupFile() {
  const settings = (await db.settings.toArray()).filter((s) => !SKIP_KEYS.includes(s.key) && s.key !== 'lastBackup');
  const days = await db.days.toArray();
  const images = [];
  for (const img of await db.images.toArray()) {
    const { blob, id, ...rest } = img;
    images.push({ ...rest, data: await blobToDataURL(blob) });
  }
  const json = JSON.stringify({ app: 'jeremy', version: 1, exportedAt: new Date().toISOString(), settings, days, images });
  const d = new Date();
  const name = `jeremy-backup-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}.json`;
  return new File([json], name, { type: 'application/json' });
}

// 아이폰: 공유 시트로 '파일에 저장'·카톡 나에게 보내기 등. 안 되면 다운로드.
export async function exportBackup() {
  const file = await makeBackupFile();
  let how = 'download';
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: '제레미 백업' });
      how = 'share';
    } catch (e) {
      if (e.name === 'AbortError') return { ok: false, cancelled: true };
      how = 'download';
    }
  }
  if (how === 'download') {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url; a.download = file.name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  await db.settings.put({ key: 'lastBackup', value: Date.now() });
  return { ok: true, how, sizeMB: +(file.size / 1048576).toFixed(1) };
}

export async function readBackup(file) {
  let data;
  try { data = JSON.parse(await file.text()); } catch { throw new Error('백업 파일을 읽을 수 없어요. 제레미 백업 파일(.json)인지 확인해 주세요.'); }
  if (data?.app !== 'jeremy' || !Array.isArray(data.days)) throw new Error('제레미 백업 파일이 아니에요.');
  return data;
}

// 지금 기록을 지우고 백업 내용으로 바꿈 (이 기기의 비밀번호·Face ID는 유지)
export async function restoreBackup(data) {
  const images = [];
  for (const img of data.images || []) {
    const { data: url, ...rest } = img;
    images.push({ ...rest, blob: await dataURLToBlob(url) });
  }
  await db.transaction('rw', db.settings, db.days, db.images, async () => {
    const keep = await db.settings.where('key').anyOf(SKIP_KEYS).toArray();
    await db.settings.clear(); await db.days.clear(); await db.images.clear();
    await db.settings.bulkPut([...(data.settings || []), ...keep, { key: 'lastBackup', value: Date.now() }]);
    await db.days.bulkPut(data.days);
    await db.images.bulkAdd(images);
  });
}

export async function wipeAll() {
  await db.delete();
}
