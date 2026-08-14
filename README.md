# 고양시 청년정책

고양시 청년이 **지금 신청할 수 있는** 정부지원 정책을 마감임박순으로 보여주는 웹앱입니다.

이 앱의 임무는 하나입니다 — **마감 놓치지 말고 지금 신청.**
그래서 기본 정렬이 마감임박순이고, 모든 정책 카드에 D-day가 붙습니다.

---

## 실행법

```bash
npm install
npm run dev
```

브라우저에서 http://localhost:3000 접속.

**인증키 없이도 바로 동작합니다.** 키가 없으면 서버가 샘플 데이터를 내려주고,
화면 하단에 "예시 데이터"라는 안내가 표시됩니다.

프로덕션 빌드는 `npm run build` → `npm start`.

---

## 인증키 붙이는 법

1. 온통청년(https://www.youthcenter.go.kr) 회원가입 후 로그인
2. **마이페이지 → OPEN API** 에서 인증키 발급 신청
3. 프로젝트 루트에 `.env.local` 생성

```bash
cp .env.example .env.local
```

4. 발급받은 키를 채웁니다.

```
YOUTH_API_KEY=여기에_발급받은_인증키
```

5. 개발 서버 재시작 (`.env.local`은 서버 시작 시에만 읽힙니다)

### 키 보안 규칙

- `YOUTH_API_KEY`는 **서버 전용**입니다. 절대 `NEXT_PUBLIC_` 접두사를 붙이지 마세요. 붙이면 번들에 포함되어 브라우저에 노출됩니다.
- 브라우저는 `/api/policies`(우리 서버)만 호출하고, 온통청년 API는 서버에서만 호출합니다.
- `.env.local`은 `.gitignore`에 등록되어 있습니다. 깃에 올리지 마세요.

---

## 아키텍처

```
브라우저                    Next.js 서버                   외부
--------                   -------------                  ------
src/app/page.js            src/app/api/policies/route.js
  "use client"      ──►      process.env.YOUTH_API_KEY  ──►  온통청년 OPEN API
  fetch('/api/policies')       ├ 키 없음 → mockPolicies.js
                               ├ 키 있음 → 호출 → normalize.js → Policy[]
                               └ 실패    → mockPolicies.js 폴백
                             (revalidate = 3600, 1시간 캐시)
```

인증키를 숨기는 것이 이 프록시의 존재 이유입니다. 화면은 데이터 출처가
샘플인지 실데이터인지 신경 쓰지 않고 항상 같은 스키마만 봅니다.

### 파일 구조

| 파일 | 역할 |
|---|---|
| `src/lib/policy.js` | **데이터 스키마(화면↔API 계약)** + D-day·상태·정렬·필터 헬퍼 |
| `src/lib/mockPolicies.js` | 샘플 정책 11건 (⚠️ 전부 예시값) |
| `src/lib/normalize.js` | 온통청년 응답 → Policy 스키마 변환 |
| `src/lib/useBookmarks.js` | 관심저장 localStorage 훅 |
| `src/app/api/policies/route.js` | 서버 프록시 (키 은닉·캐시·폴백) |
| `src/app/page.js` | 메인 화면 |
| `src/components/` | 카드 · 모달 · 필터바 · 요약바 · 배지 |

### 데이터 스키마

```js
Policy = {
  id, title, category, region, summary, target, benefit,
  start,    // 'YYYY-MM-DD' | null
  end,      // 'YYYY-MM-DD' | null (null = 상시접수)
  agency, applyUrl
}
```

- `category`: 취업 / 주거 / 금융 / 복지 / 교육·문화
- `region`: 덕양구 / 일산동구 / 일산서구 / 고양시 전역
  (고양시 전역 정책은 어느 구를 골라도 함께 노출됩니다)

### 상태 배지 규칙

| 배지 | 조건 | 색 |
|---|---|---|
| 상시접수 | `end === null` | 회색 |
| 신규 | 접수 시작일이 14일 이내 | 회색 |
| D-n | 마감까지 8일 이상 | 검정 |
| 마감임박 D-n | 마감까지 7일 이하 | **빨강** |
| 접수마감 | 마감일 지남 | 연회색 |

---

## 디자인 규칙

흑·백·회색 모노톤. **빨강(red-600)은 딱 세 곳에만** 씁니다.

1. 마감임박 배지 + 카드 왼쪽 세로선
2. 신청 버튼
3. 관심저장(저장된 상태)

카테고리 태그와 일반 배지는 전부 회색조입니다. 모바일 우선 반응형이고,
키보드 포커스 링(`:focus-visible`)이 항상 보이도록 되어 있습니다.

한글 폰트는 Pretendard(CDN)이며, 네트워크가 막힌 환경에서는
`tailwind.config.js`의 시스템 폰트 폴백이 대신 쓰입니다.

---

## ⚠️ 확인이 필요한 TODO

작성 시점에 **온통청년 API 문서 사이트(`youthcenter.go.kr`, `data.go.kr`) 접근이
네트워크 정책으로 차단**되어 있어, 실제 파라미터명과 응답 필드명을 문서로
검증하지 못했습니다. 지어내지 않고 전부 TODO로 표시해 두었습니다.

### 연동 순서 (권장)

1. `.env.local`에 `YOUTH_API_KEY` 입력 후 `npm run dev`
2. 브라우저에서 한 번 접속 → **`npm run dev`를 띄운 터미널**을 확인
   `route.js`가 응답의 최상위 키 / 항목 키 / 첫 항목 원본을 그대로 찍어줍니다.
3. 찍힌 실제 키 이름으로 아래 TODO들을 확정

### TODO 위치

| # | 파일 | 내용 |
|---|---|---|
| ① | `src/app/api/policies/route.js` | **엔드포인트 URL** — 구버전(`/opi/youthPlcyList.do`, XML)인지 신버전(`/go/ythip/getPlcy`, JSON)인지 문서로 확정 |
| ② | `src/app/api/policies/route.js` | **쿼리 파라미터명** — 인증키(`apiKeyNm` vs `openApiVlak`), 페이지(`pageNum` vs `pageIndex`), 건수(`pageSize` vs `display`), 응답형식(`rtnType`) |
| ③ | `src/app/api/policies/route.js` | **`GOYANG_ZIP`** — 시 코드(41280)로 조회 시 구 단위 정책까지 나오는지 확인. 안 나오면 `GOYANG_ZIP_CODES`를 순회 호출 |
| ④ | `src/app/api/policies/route.js` | **응답 파싱 경로** — `extractRows()`가 후보를 순서대로 시도하는 임시 코드. 실제 경로 한 줄로 확정 |
| ⑤ | `src/lib/normalize.js` | **응답 필드명** — `FIELD_CANDIDATES`의 각 후보 배열을 실제 키 하나로 확정 (`plcyNm`, `plcyExplnCn`, 날짜 필드 등) |
| ⑥ | `src/lib/normalize.js` | **카테고리 매핑** — 온통청년 대분류(`lclsfNm`)의 실제 값 목록 확인. 코드값으로 올 가능성 있음 |
| ⑦ | `src/lib/normalize.js` | **법정동코드** — 41280/41281/41285/41287을 code.go.kr 법정동코드 전체자료로 재확인 |

④⑤는 "후보를 여러 개 시도"하는 임시 방식이라 필드명이 조금 달라도 앱이 죽지는
않지만, 반드시 실제 키를 확인해 확정하세요.

---

## ⚠️ 샘플 데이터 고지

`src/lib/mockPolicies.js`의 정책명·금액·기간·담당부서·링크는 **모두 화면 확인용
예시**이며 실제 고양시/정부 공고와 다릅니다. 화면 하단에도 같은 내용이 표시됩니다.
실데이터 연동 후 대체됩니다.

---

## 기술 스택

Next.js 15 (App Router) · React 18 · Tailwind CSS 3 · lucide-react ·
fast-xml-parser · JavaScript (TypeScript 미사용)
