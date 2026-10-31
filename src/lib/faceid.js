import { getSetting, setSetting, db } from './db.js';

// Face ID 잠금 해제 (웹 표준 WebAuthn 사용, 서버 없음)
// - 아이폰의 Face ID가 "본인 확인"을 하고, 앱은 그 결과(성공/실패)만 받습니다.
// - 얼굴 정보는 앱에 전달되지 않고, 어디에도 전송되지 않습니다.
// - 이것도 '앱 잠금'이며, 기록을 암호화하지는 않습니다.

const enc = new TextEncoder();
const rand = (n) => crypto.getRandomValues(new Uint8Array(n));
const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const fromHex = (hex) => new Uint8Array(hex.match(/../g).map((h) => parseInt(h, 16)));

export async function faceIdSupported() {
  try {
    return !!(window.PublicKeyCredential &&
      await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
  } catch {
    return false;
  }
}

export async function faceIdEnabled() {
  const f = await getSetting('faceid');
  // 배포 주소(도메인)가 바뀌면 이전 등록은 쓸 수 없음
  return !!(f && f.host === location.hostname);
}

export async function enableFaceId() {
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: rand(32),
      rp: { name: '제레미' },
      user: { id: rand(16), name: 'jeremy', displayName: '제레미 7일 실험' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'discouraged',
      },
      timeout: 60000,
      attestation: 'none',
    },
  });
  await setSetting('faceid', { id: toHex(cred.rawId), host: location.hostname });
}

export function disableFaceId() {
  return db.settings.delete('faceid');
}

// 성공하면 true. 취소·실패하면 false.
export async function verifyFaceId() {
  const f = await getSetting('faceid');
  if (!f) return false;
  try {
    const res = await navigator.credentials.get({
      publicKey: {
        challenge: rand(32),
        allowCredentials: [{ type: 'public-key', id: fromHex(f.id), transports: ['internal'] }],
        userVerification: 'required',
        timeout: 60000,
      },
    });
    // authenticatorData의 33번째 바이트 UV 비트(0x04) = 실제로 Face ID/기기 암호로 본인 확인했는지
    const flags = new Uint8Array(res.response.authenticatorData)[32];
    return (flags & 0x04) !== 0 && toHex(res.rawId) === f.id;
  } catch {
    return false;
  }
}
