import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// base: './' → 저장소 이름이 바뀌어도(goyang-youth → jeremy) 그대로 동작하게 상대경로로 빌드
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png'],
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
