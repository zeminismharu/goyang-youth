import { getSetting, setSetting, db } from './db.js';

// 비밀번호(4자리)는 그대로 저장하지 않고, 되돌릴 수 없는 형태(PBKDF2 해시)로만 저장합니다.
// 주의: 이것은 '앱 잠금'입니다. 기록 자체를 암호화하지는 않습니다.
const ITER = 150000;

function toHex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function derive(pin, saltHex) {
  const salt = new Uint8Array(saltHex.match(/../g).map((h) => parseInt(h, 16)));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITER }, key, 256);
  return toHex(bits);
}

export async function hasPin() {
  return !!(await getSetting('pin'));
}

export async function savePin(pin) {
  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
  await setSetting('pin', { salt, hash: await derive(pin, salt) });
}

export async function checkPin(pin) {
  const p = await getSetting('pin');
  if (!p) return true;
  return (await derive(pin, p.salt)) === p.hash;
}

export function removePin() {
  return db.settings.delete('pin');
}
