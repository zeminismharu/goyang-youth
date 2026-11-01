import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// base: './' → 저장소 이름이 바뀌어도(goyang-youth → jeremy) 그대로 동작하게 상대경로로 빌드
const PREVIEW = process.env.PREVIEW === '1'; // 폰 미리보기용(서비스 워커 없음)

export default defineConfig({
  base: './',
  define: {
    __PREVIEW__: JSON.stringify(PREVIEW),
    // 화면에 표시할 버전(빌드 시각, 한국 시간) → 새 배포가 들어왔는지 눈으로 확인
    __BUILD__: JSON.stringify(new Date(Date.now() + 9 * 3600e3).toISOString().slice(5, 16).replace('T', ' ')),
  },
  build: { outDir: PREVIEW ? 'dist-preview' : 'dist' },
  plugins: [
    react(),
    !PREVIEW && VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false, // main.jsx에서 직접 등록 (새 버전이 오면 자동 새로고침)
      includeAssets: ['apple-touch-icon.png'],
      workbox: {
        skipWaiting: true, clientsClaim: true, cleanupOutdatedCaches: true,
        navigateFallbackDenylist: [/^\/about/], // 랜딩페이지는 앱 화면으로 바꾸지 않음
      },
      manifest: {
        name: '제레미 7일 실험',
        short_name: '제레미',
        description: '내 휴대폰 사용과 알고리즘 노출을 7일 동안 기록하는 실험',
        lang: 'ko',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#faf8f5',
        theme_color: '#faf8f5',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
});
