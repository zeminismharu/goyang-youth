import { db } from './db.js';

// 캡처 종류
export const KINDS = {
  screentime: '스크린타임',
  youtube: '유튜브 홈',
  instagram: '인스타 탐색',
  googleAds: '구글 내 광고 센터',
  instaAds: '인스타 광고 주제',
};
export const DAILY_KINDS = ['screentime', 'youtube', 'instagram'];

// 휴대폰 안에서 이미지 크기를 줄여 저장 공간 절약 (긴 변 1800px, JPEG)
export function compressImage(file, maxSide = 1800, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.round(img.naturalWidth * scale);
      const h = Math.round(img.naturalHeight * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => (blob ? resolve({ blob, w, h }) : reject(new Error('변환 실패'))), 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('이미지를 읽지 못했어요')); };
    img.src = url;
  });
}

// 같은 날·같은 종류는 한 장만 유지 (새로 올리면 교체)
export async function saveImage(kind, day, file) {
  const { blob, w, h } = await compressImage(file);
  await db.transaction('rw', db.images, async () => {
    const old = await db.images.where({ kind, day }).primaryKeys();
    await db.images.bulkDelete(old);
    await db.images.add({ kind, day, blob, w, h, createdAt: Date.now() });
  });
}

export function deleteImage(kind, day) {
  return db.images.where({ kind, day }).delete();
}
