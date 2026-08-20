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

## 배포 (Cloudflare Workers)

[OpenNext Cloudflare 어댑터](https://opennext.js.org/cloudflare)로 Cloudflare Workers에
배포합니다. 서버 프록시(`/api/policies`)가 그대로 살아 있어서 인증키 은닉 구조가
유지됩니다.

```bash
npm run cf:preview   # 로컬에서 workerd 런타임으로 미리보기
npm run cf:deploy    # 빌드 + 배포
```

`npm run cf:deploy`는 로그인이 필요합니다(`npx wrangler login`).

워커 이름은 `wrangler.jsonc`의 `name` 값인 **`goyang-youth`** 이고, 배포되면
`https://goyang-youth.<계정서브도메인>.workers.dev` 로 접속됩니다.
`routes`와 `custom_domain`을 설정하지 않았으므로 계정 내 다른 워커나
기존 도메인의 트래픽에는 영향을 주지 않습니다.

### 자동 배포 (현재 구성)

**Cloudflare Workers Builds**가 이 저장소에 연결되어 있어, 푸시하면 자동으로
빌드·배포됩니다. GitHub Actions 워크플로는 두지 않습니다(중복이라 제거했습니다).

Cloudflare 대시보드 → `goyang-youth` → **Settings → Build** 의 설정값:

| 항목 | 값 |
|---|---|
| Build command | `npx opennextjs-cloudflare build` |
| Deploy command | `npx wrangler deploy` |
| Root directory | `/` |

> Build command를 비워두면 `.open-next/worker.js`가 만들어지지 않아
> 배포 단계에서 실패합니다. 반드시 채워져 있어야 합니다.

### 배포 후 인증키 넣기

온통청년 인증키는 **빌드가 아니라 런타임에** 필요하므로 GitHub Secrets가 아니라
Worker 시크릿으로 등록합니다.

```bash
npx wrangler secret put YOUTH_API_KEY
```

`src/app/api/policies/route.js`는 `dynamic = 'force-dynamic'`이라 요청마다 실행되고,
시크릿을 넣으면 **재배포 없이 바로** 실데이터로 전환됩니다.
외부 API 호출 자체에 1시간 캐시(`next: { revalidate: 3600 }`)가 걸려 있습니다.

> ISR/데이터 캐시를 여러 요청·인스턴스에 걸쳐 영속시키려면 `open-next.config.ts`에
> R2 또는 KV 기반 incremental cache를 붙여야 합니다.
> 지금은 기본 설정이라 캐시가 인스턴스 수명에 묶입니다.
> 참고: https://opennext.js.org/cloudflare/caching

### `open-next.config.ts`만 TypeScript인 이유

`@opennextjs/cloudflare` 어댑터가 이 파일명을 고정으로 찾기 때문입니다(다른 확장자
불가). 빌드 도구 설정 파일 3줄이며, **애플리케이션 코드는 전부 `.js`/`.jsx`** 입니다.

---

## 아키텍처

```
브라우저                    Next.js 서버 (요청마다 실행)          외부
--------                   --------------------------          ------
src/app/page.js            src/app/api/policies/route.js
  "use client"      ──►      process.env.YOUTH_API_KEY
  fetch('/api/policies')       │
                               ├ 키 없음 → mockPolicies.js
                               │
                               ├ 키 있음 → 경기 전체 조회 ──────►  youthPlcyList.do
                               │            (pageIndex 순회)        (XML, 1시간 캐시)
                               │              ↓
                               │          normalize.js
                               │           ├ XML 파싱
                               │           ├ 고양/덕양/일산 필터
                               │           ├ 자유텍스트 기간 → 날짜
                               │           └ Policy[]
                               │
                               └ 실패/0건 → mockPolicies.js 폴백
```

라우트는 `dynamic = 'force-dynamic'`이라 **요청마다** 실행됩니다. 그래야 배포 후
인증키를 넣었을 때 재빌드 없이 바로 실데이터로 넘어갑니다.
1시간 캐시는 라우트가 아니라 **온통청년 호출 자체**(`next: { revalidate: 3600 }`)에
걸려 있어서, 외부 API는 1시간에 한 번만 호출됩니다.

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

## API 연동 상태 — ✅ 실데이터 연동 완료

실제 인증키로 검증 완료했습니다. **신버전 엔드포인트가 동작합니다.**

```
GET https://www.youthcenter.go.kr/go/ythip/getPlcy
    apiKeyNm=<UUID 인증키>  pageNum  pageSize  rtnType=json
    zipCd=41280,41281,41285,41287     ← 법정시군구코드로 고양시 지정
```

- 인증키는 **UUID 형식**입니다. 공식 문서에 있는 구버전 예시
  (`openApiVlak=123AAebad2758130bb123AA`, 22자 영숫자)와 다릅니다.
- 응답은 **JSON**입니다. 구버전은 XML이었습니다.
- 조회 결과 고양시 청년이 신청 가능한 정책 **459건**을 받았습니다.

`route.js`는 신·구 두 엔드포인트를 순서대로 시도하고 데이터가 나오는 쪽을
채택합니다. 인증키가 UUID면 신버전을 먼저 봅니다. 채택된 경로는 응답의
`strategy` 필드에 담깁니다.

### 실데이터에서 발견해 고친 것

| 문제 | 원인 | 대응 |
|---|---|---|
| 전국 사업이 '덕양구'로 표시 | `zipCd`에 전국 시군구 코드가 다 들어옴 | 코드가 5개 초과면 구를 특정하지 않고 '고양시 전역' |
| 지원대상에 `0049010` 노출 | `schoolCd`/`jobCd`가 코드값 | 숫자만인 값은 걸러냄 |
| 공고문 줄바꿈 뭉개짐 | `plcySprtCn`에 개행·이모지 포함 | 모달에 `whitespace-pre-line` |

---

### 참고: 구버전 API 규격

출처
- 오픈 API 제공목록: https://www.youthcenter.go.kr/cmnFooter/openapiIntro/oaiDoc
- 오픈 API 이용방법: https://www.youthcenter.go.kr/cmnFooter/openapiIntro/oaiGuide

### ✅ 확정된 것

```
GET https://www.youthcenter.go.kr/opi/youthPlcyList.do
```

응답 형식은 **XML**입니다.

| 파라미터 | 필수 | 설명 |
|---|---|---|
| `openApiVlak` | Y | 마이페이지 > OpenAPI관리에서 발급받은 인증키 |
| `display` | Y | 출력 건수. 기본 10, **최대 100** |
| `pageIndex` | Y | 조회할 페이지. 기본 1 |
| `srchPolyBizSecd` | | 지역코드 — **시·도 단위만** |
| `bizTycdSel` | | 정책유형 코드 |
| `query` / `keyword` | | 검색어 |
| `srchPolicyId` | | 정책 ID (상세조회 시 필수) |

정책유형 코드: `023010` 일자리 · `023020` 주거 · `023030` 교육 ·
`023040` 복지·문화 · `023050` 참여·권리

시·도 코드: `003002001` 서울 … `003002008` **경기** … `003002017` 세종

### ⚠️ 이 API의 제약 두 가지

**1. 시군구 필터가 없습니다.**
`srchPolyBizSecd`는 광역 17개 코드만 받습니다. 고양시(법정동코드 41280) 같은
시군구 단위 조회가 불가능합니다.

→ 대응: 경기(`003002008`) 전체를 페이지로 받아 온 뒤, `normalize.js`의
`detectGoyangRegion()`이 정책명·소개·지원내용·담당기관 텍스트에서
`고양 / 덕양 / 일산동 / 일산서`를 찾아 걸러냅니다. 구가 특정되면 해당 구로,
아니면 `고양시 전역`으로 잡습니다.

**2. 신청기간이 자유 텍스트입니다.**
정규화된 날짜 필드가 아니라 `"09.13. ~ 09.26 (18:00까지)"` 처럼 옵니다.
**연도가 없는 경우가 많습니다.** D-day가 이 앱의 핵심이라 `parsePeriod()`에서
따로 처리합니다.

| 입력 | 결과 |
|---|---|
| `2026.08.20 ~ 2026.09.30` | `2026-08-20` ~ `2026-09-30` |
| `09.13. ~ 09.26 (18:00까지)` | 올해로 보정 → `2026-09-13` ~ `2026-09-26` |
| `12.20 ~ 01.15` | 해 넘김 인식 → `2026-12-20` ~ `2027-01-15` |
| `상시` `연중` `예산 소진 시까지` `-` | `null` (상시접수로 표시) |

연도가 없을 때는 올해로 보되, 그렇게 계산한 마감일이 6개월 넘게 지났으면
내년 공고로 간주합니다.

### ✅ 응답 필드명 (실측 확정)

배포본에서 실제로 응답한 것은 **v2 `getPlcy` (JSON)** 이고, 필드명은 아래가
확정입니다. `?debug=1` 의 `응답필드명` 으로 언제든 다시 확인할 수 있습니다.

| 용도 | 확정 필드 |
|---|---|
| 정책 ID | `plcyNo` |
| 정책명 | `plcyNm` |
| 정책 소개 | `plcyExplnCn` |
| 지원 내용 | `plcySprtCn` |
| 신청기간 | `aplyYmd` |
| 담당기관 | `rgtrInstCdNm` |
| 신청 URL | `aplyUrlAddr` |
| 지역코드 | `zipCd` |
| 정책분야 | `lclsfNm` / `mclsfNm` |

⚠️ **`aplyBgngYmd` / `aplyEndYmd` 라는 필드는 존재하지 않습니다.**
신청기간은 `aplyYmd` 에 `"20260810 ~ 20260825"` 형태의 문자열로 옵니다.
`bizPrdBgngYmd` / `bizPrdEndYmd` 는 신청기간이 아니라 **사업(행사) 기간**이라
이걸로 D-day를 계산하면 틀립니다. 실제로 산림 캠프 정책이 접수기간(8/10~8/25)
대신 캠프 날짜(9/3~9/4)로 표시되는 사고가 있었습니다.

---

## 경기데이터드림 (보조 소스) — 현재 미연동

`GG_API_KEY` 를 넣어도 데이터가 들어오지 않습니다. **코드 문제가 아니라
경기도 방화벽이 클라우드/해외 IP를 차단하기 때문**이고, 클라우드플레어에서
나가는 IP는 바꿀 수 없어 코드로는 풀 수 없습니다.

확인 과정에서 배제한 것들 (같은 길을 다시 파지 않도록):

| 의심 | 결과 |
|---|---|
| 인증키가 잘못됨 | ✗ 차단은 키 검사 이전 단계에서 일어남 |
| 데이터셋이 폐기됨 | ✗ 브라우저로는 정상 응답 |
| 엔드포인트·파라미터 철자 | ✗ 정확 (`JobFndtnSportPolocy` / `Key` / `Type`) |
| User-Agent 없는 요청이라 봇으로 차단 | ✗ 브라우저 헤더를 붙여도 동일하게 차단 |
| **출발 IP 차단** | ✅ 원인 |

차단 시 서버는 HTTP 200 에 **EUC-KR HTML**로 안내를 보냅니다.
`- 보안 정책에 의해 차단 되었습니다 - … ☎ 031-8008-4114 / 4115`
(UTF-8로 읽으면 통째로 깨져서 원인을 못 읽습니다. `decodeBytes()` 참고.)

**코드는 그대로 둡니다.** 이 소스가 실패해도 온통청년 결과만으로 화면이
정상 동작하도록 두 소스를 독립적으로 호출하기 때문에 사용자 영향은 없습니다.
나중에 재시도하려면 `?debug=1` 의 `경기미연동사유` 만 보면 됩니다.

**대안(미착수)**: 같은 데이터가 공공데이터포털에도 있습니다.
호스트(`apis.data.go.kr`)가 달라 이 방화벽과 무관합니다.
→ https://www.data.go.kr/data/15058390/openapi.do
TODO: 활용신청 후 요청주소·파라미터 명세를 확인해서 어댑터를 맞출 것.
명세 없이 추측으로 짜지 말 것 — 그러다 두 번 틀렸습니다.

---


## ⚠️ 샘플 데이터 고지

`src/lib/mockPolicies.js`의 정책명·금액·기간·담당부서·링크는 **모두 화면 확인용
예시**이며 실제 고양시/정부 공고와 다릅니다. 화면 하단에도 같은 내용이 표시됩니다.
실데이터 연동 후 대체됩니다.

---

## 기술 스택

Next.js 15 (App Router) · React 18 · Tailwind CSS 3 · lucide-react ·
fast-xml-parser · JavaScript (TypeScript 미사용)
