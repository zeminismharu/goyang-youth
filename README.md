# 제레미 7일 실험

내 휴대폰 사용과 알고리즘 노출을 7일 동안 기록하고, **내 예측과 실제를 비교**하는 모바일 웹앱(PWA).

## 원칙
- 모든 기록·캡처는 **휴대폰 브라우저 안(IndexedDB)** 에만 저장. 서버·로그인·외부 전송 없음.
- GitHub에는 **코드만** 올라감. GitHub Pages는 앱 파일을 내려주기만 함.
- 체크인은 **다음 날 아침에 '어제'를 기록** (스크린타임 숫자가 확정된 뒤).

## 진행 상황
- [x] 1-1 뼈대 · 홈(일차/빠진 날 표시) · PWA · 저장소
- [ ] 1-2 0일차: 예측 입력, 체크리스트, 광고 화면 캡처
- [ ] 1-3 데일리 체크인 (최소 터치)
- [ ] 1-4 백업/복원, 모든 데이터 삭제
- [ ] 2 테이크아웃/인스타 분석 (실제 파일 샘플 받은 뒤)
- [ ] 3 리포트 + 이미지/PDF 저장

## 기술 스택
Vite + React(화면), Dexie(IndexedDB 저장), vite-plugin-pwa(홈 화면 앱), GitHub Actions → GitHub Pages(배포)

## 실행 (컴퓨터에서)
```bash
npm install
npm run dev     # 같은 와이파이의 폰에서도 표시되는 주소로 접속 가능 (단, 홈 화면 앱 설치는 https 배포 주소에서만)
npm run build   # 배포용 파일을 dist/ 에 생성
```

## 배포
코드를 push하면 `.github/workflows/deploy.yml`이 자동으로 GitHub Pages에 배포합니다.
처음 한 번: 저장소 Settings → Pages → Source를 **GitHub Actions**로 설정.
