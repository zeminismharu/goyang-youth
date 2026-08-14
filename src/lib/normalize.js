/**
 * 온통청년 OPEN API 응답 → 이 앱의 Policy 스키마 변환기
 * ==================================================================
 * 근거 문서 (2026-08 확인)
 *   - 오픈 API 제공목록 : https://www.youthcenter.go.kr/cmnFooter/openapiIntro/oaiDoc
 *   - 오픈 API 이용방법 : https://www.youthcenter.go.kr/cmnFooter/openapiIntro/oaiGuide
 *   → "결과 데이터는 XML 방식으로 전송됩니다"
 *
 * ⚠️ 확정된 것과 아직 추정인 것을 구분해 두었다.
 *   [확정] 요청 파라미터명 — 공식 요청예시로 확인
 *   [추정] 응답 필드명 — 공식 출력결과표가 JS로 렌더돼 읽지 못했다.
 *          외부 구현체에서 관찰된 이름을 후보로 넣었다.
 *          실제 응답을 한 번 보면 확정할 수 있다(route.js 로그 참고).
 */

import { REGION_ALL } from './policy';

// ==================================================================
// 지역 처리
// ------------------------------------------------------------------
// ⚠️ 설계 변경 사유 (중요)
// 이 API의 지역 필터 srchPolyBizSecd 는 "시·도" 단위만 지원한다.
// 코드값이 003002001(서울) ~ 003002017(세종)로 광역 17개뿐이고
// 고양시 같은 시군구 코드가 없다.
//
// 따라서 법정동코드 41280으로 거르려던 원래 계획은 쓸 수 없다.
// 대신 경기(003002008) 전체를 받아 와서 고양시 정책만 골라낸다.
// ==================================================================

/** [확정] 경기도 시·도 코드 */
export const GYEONGGI_SIDO_CODE = '003002008';

/** 고양시로 판정할 키워드. 구 단위까지 잡아낸다. */
const GOYANG_PATTERNS = [
  { pattern: /덕양/, region: '덕양구' },
  { pattern: /일산동구|일산\s*동/, region: '일산동구' },
  { pattern: /일산서구|일산\s*서/, region: '일산서구' },
  { pattern: /일산/, region: REGION_ALL }, // 동/서 구분이 없는 '일산'
  { pattern: /고양/, region: REGION_ALL },
];

/**
 * 정책 텍스트에서 고양시 관련 여부와 구를 판정한다.
 * @returns {string|null} 지역명, 고양시와 무관하면 null
 */
export function detectGoyangRegion(text) {
  if (!text) return null;
  for (const { pattern, region } of GOYANG_PATTERNS) {
    if (pattern.test(text)) return region;
  }
  return null;
}

// ==================================================================
// 응답 필드명 후보
// ------------------------------------------------------------------
// [추정] 각 배열의 앞쪽이 가장 유력한 이름이다.
// route.js가 첫 응답의 키 목록을 로그로 남기니, 그걸 보고 배열을
// 실제 이름 하나로 줄이면 확정된다.
// ==================================================================
const F = {
  id: ['bizId', 'polyBizId', 'plcyNo'],
  title: ['polyBizSjnm', 'plcyNm'],
  summary: ['polyItcnCn', 'plcyExplnCn'],
  benefit: ['sporCn', 'plcySprtCn', 'sporScvl'],
  // 대상은 여러 필드를 합쳐야 쓸 만하다
  age: ['ageInfo', 'sprtTrgtAgeCn'],
  education: ['accrRqisCn', 'acc'],
  employment: ['empmSttsCn'],
  etcTarget: ['aditRscn', 'prcpCn', 'addAplyQlfcCndCn'],
  // 신청기간 — 자유 텍스트다. 아래 parsePeriod가 처리한다.
  periodText: ['rqutPrdCn', 'aplyYmd', 'bizPrdCn'],
  // 혹시 정규 날짜 필드가 따로 있으면 우선 쓴다
  startDate: ['bizPrdBgngYmd', 'aplyBgngYmd'],
  endDate: ['bizPrdEndYmd', 'aplyEndYmd'],
  agency: ['cnsgNmor', 'mngtMson', 'rgtrInstCdNm', 'rgtrHghrkInstCdNm'],
  applyUrl: ['rqutUrla', 'rfcSiteUrla1', 'rfcSiteUrla2', 'aplyUrlAddr'],
  sidoCode: ['polyBizSecd', 'polyBizSecdNm'],
  categoryCode: ['polyRlmCd', 'lclsfNm'],
};

/** 후보 키를 순서대로 훑어 처음 값이 있는 것을 반환 */
function pick(row, keys) {
  if (!row) return '';
  for (const key of keys) {
    let v = row[key];
    // XML CDATA를 파서가 객체로 줄 때 대비
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      v = v['#text'] ?? v._ ?? '';
    }
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      return String(v).trim();
    }
  }
  return '';
}

// ==================================================================
// 날짜 파싱
// ------------------------------------------------------------------
// ⚠️ 이 API의 신청기간(rqutPrdCn)은 정규화된 날짜가 아니라 자유 텍스트다.
// 실제 관찰된 값 예시:
//   "09.13. ~ 09.26 (18:00까지)"   ← 연도가 없다
//   "2026.08.01 ~ 2026.08.31"
//   "상시"  "연중"  "예산 소진 시까지"  "-"
//
// 이 앱의 핵심이 D-day라서 여기를 최대한 살려야 한다.
// 연도가 없으면 "올해"로 보되, 그렇게 계산한 마감일이 이미 한참 지났으면
// 내년 공고로 간주한다(연말~연초 공고가 뒤집히는 것을 막는다).
// 해석이 안 되면 null(=상시접수)로 두어 화면이 깨지지 않게 한다.
// ==================================================================

/** 상시접수로 볼 표현 */
const ALWAYS_OPEN = /상시|연중|수시|소진\s*시|추후|별도\s*공고|제한\s*없음/;

const pad = (n) => String(n).padStart(2, '0');
const toIso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

/** 'YYYYMMDD' / 'YYYY-MM-DD' / 'YYYY.MM.DD' → 'YYYY-MM-DD' */
export function toIsoDate(value) {
  if (!value) return null;
  const digits = String(value).replace(/[^0-9]/g, '');
  if (digits.length !== 8) return null;
  const y = Number(digits.slice(0, 4));
  const m = Number(digits.slice(4, 6));
  const d = Number(digits.slice(6, 8));
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return toIso(y, m, d);
}

/**
 * 자유 텍스트 신청기간 → { start, end }
 * 둘 다 못 찾으면 { start: null, end: null } (상시접수로 표시된다)
 */
export function parsePeriod(text, now = new Date()) {
  const raw = String(text || '').trim();
  if (!raw || raw === '-') return { start: null, end: null };
  if (ALWAYS_OPEN.test(raw)) return { start: null, end: null };

  const thisYear = now.getFullYear();

  // 1) 연도가 있는 날짜: 2026.08.01 / 2026-08-01 / 20260801
  const withYear = [...raw.matchAll(/(20\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/g)].map(
    (m) => toIso(Number(m[1]), Number(m[2]), Number(m[3])),
  );
  const compact = [...raw.matchAll(/\b(20\d{2})(\d{2})(\d{2})\b/g)].map((m) =>
    toIso(Number(m[1]), Number(m[2]), Number(m[3])),
  );
  const dated = [...withYear, ...compact].filter(Boolean);

  if (dated.length >= 2) return { start: dated[0], end: dated[1] };
  if (dated.length === 1) return { start: dated[0], end: null };

  // 2) 연도 없는 날짜: "09.13. ~ 09.26"
  const noYear = [...raw.matchAll(/(?<!\d)(\d{1,2})\s*[.\-/월]\s*(\d{1,2})(?!\d)/g)]
    .map((m) => ({ m: Number(m[1]), d: Number(m[2]) }))
    .filter((v) => v.m >= 1 && v.m <= 12 && v.d >= 1 && v.d <= 31);

  if (noYear.length === 0) return { start: null, end: null };

  const endPart = noYear.length > 1 ? noYear[1] : noYear[0];
  let year = thisYear;
  let end = new Date(year, endPart.m - 1, endPart.d);

  // 올해로 본 마감일이 6개월 넘게 지났으면 내년 공고로 본다
  const sixMonthsAgo = new Date(now.getTime() - 182 * 24 * 60 * 60 * 1000);
  if (end < sixMonthsAgo) {
    year += 1;
    end = new Date(year, endPart.m - 1, endPart.d);
  }

  const startPart = noYear.length > 1 ? noYear[0] : null;
  let start = null;
  if (startPart) {
    // 시작월이 종료월보다 크면 해를 넘긴 공고 (예: 12.20 ~ 01.15)
    const startYear = startPart.m > endPart.m ? year - 1 : year;
    start = toIso(startYear, startPart.m, startPart.d);
  }

  return { start, end: toIso(year, endPart.m, endPart.d) };
}

// ==================================================================
// 카테고리
// ------------------------------------------------------------------
// [확정] bizTycdSel / polyRlmCd 코드값 (공식 파라미터 표)
//   023010 일자리 / 023020 주거 / 023030 교육 / 023040 복지·문화 / 023050 참여·권리
//
// 이 앱은 '금융'을 따로 두는데 API에는 대응 분류가 없다.
// 그래서 금융은 키워드로 별도 판정한다.
// ==================================================================
const CODE_TO_CATEGORY = {
  '023010': '취업',
  '023020': '주거',
  '023030': '교육·문화',
  '023040': '복지',
  '023050': '교육·문화',
};

const NAME_TO_CATEGORY = {
  일자리: '취업',
  취업: '취업',
  창업: '취업',
  주거: '주거',
  교육: '교육·문화',
  문화: '교육·문화',
  '복지·문화': '복지',
  복지문화: '복지',
  복지: '복지',
  '참여·권리': '교육·문화',
  참여권리: '교육·문화',
};

const FINANCE_HINT = /대출|이자|융자|저축|적금|자산형성|금융|부채|보증료|목돈|디딤돌/;

export function resolveCategory(row, text) {
  const rawCode = pick(row, F.categoryCode);

  // 금융은 API 분류에 없으므로 키워드가 걸리면 우선 적용
  if (FINANCE_HINT.test(text)) return '금융';

  if (rawCode) {
    if (CODE_TO_CATEGORY[rawCode]) return CODE_TO_CATEGORY[rawCode];
    for (const [name, cat] of Object.entries(NAME_TO_CATEGORY)) {
      if (rawCode.includes(name)) return cat;
    }
  }

  if (/전세|월세|주택|임대|보증금|기숙사/.test(text)) return '주거';
  if (/취업|일자리|채용|인턴|창업|면접|직무/.test(text)) return '취업';
  if (/교육|강좌|문화|공연|여행|자격증|어학/.test(text)) return '교육·문화';
  return '복지';
}

// ==================================================================
// 변환
// ==================================================================

/** 지원 대상 텍스트를 여러 필드에서 모아 한 문장으로 만든다 */
function buildTarget(row) {
  const parts = [
    pick(row, F.age),
    pick(row, F.education),
    pick(row, F.employment),
    pick(row, F.etcTarget),
  ].filter((v) => v && v !== '제한없음' && v !== '-');

  return parts.length > 0 ? parts.join(' / ') : '공고 본문 확인 필요';
}

/**
 * 응답 1건 → Policy 1건.
 * 고양시와 무관한 정책이면 null을 반환한다.
 */
export function normalizePolicy(row, index = 0, now = new Date()) {
  const title = pick(row, F.title);
  if (!title) return null;

  const summary = pick(row, F.summary);
  const benefit = pick(row, F.benefit);
  const agency = pick(row, F.agency);
  const target = buildTarget(row);

  // 고양시 판정 — 지역코드가 시·도 단위뿐이라 텍스트로 걸러낸다
  const haystack = `${title} ${summary} ${benefit} ${agency} ${target}`;
  const region = detectGoyangRegion(haystack);
  if (!region) return null;

  // 정규 날짜 필드가 있으면 우선, 없으면 자유 텍스트에서 파싱
  let start = toIsoDate(pick(row, F.startDate));
  let end = toIsoDate(pick(row, F.endDate));
  if (!start && !end) {
    const parsed = parsePeriod(pick(row, F.periodText), now);
    start = parsed.start;
    end = parsed.end;
  }

  const url = pick(row, F.applyUrl);

  return {
    id: pick(row, F.id) || `policy-${index}`,
    title,
    category: resolveCategory(row, haystack),
    region,
    summary: summary || title,
    target,
    benefit: benefit || '공고 본문 확인 필요',
    start,
    end,
    agency: agency || '고양시',
    applyUrl: /^https?:\/\//.test(url) ? url : 'https://www.youthcenter.go.kr/',
  };
}

/** 응답 배열 → Policy 배열 (고양시 정책만 남는다) */
export function normalizePolicies(rows, now = new Date()) {
  if (!Array.isArray(rows)) return [];

  const seen = new Set();
  const out = [];

  rows.forEach((row, index) => {
    const policy = normalizePolicy(row, index, now);
    if (!policy) return;
    if (seen.has(policy.id)) return; // 페이지가 겹칠 때 중복 제거
    seen.add(policy.id);
    out.push(policy);
  });

  return out;
}

export default normalizePolicies;
