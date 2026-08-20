/**
 * 온통청년 OPEN API 응답 → 이 앱의 Policy 스키마 변환기
 * ==================================================================
 * 근거 (2026-08 확인)
 *   - 제공목록 : https://www.youthcenter.go.kr/cmnFooter/openapiIntro/oaiDoc
 *   - 이용방법 : https://www.youthcenter.go.kr/cmnFooter/openapiIntro/oaiGuide
 *
 * ⚠️ 온통청년 API는 두 세대가 공존한다.
 *
 *   [구버전] /opi/youthPlcyList.do   — 공식 문서에 명세가 있는 쪽. XML 응답.
 *            인증키 openApiVlak (22자 영숫자), 지역은 시·도 단위만.
 *
 *   [신버전] /go/ythip/getPlcy       — 공식 명세를 찾지 못했다. JSON 응답 추정.
 *            인증키 apiKeyNm (UUID 형식), 법정시군구코드(zipCd) 지원 추정.
 *            근거: 공공데이터포털의 같은 API 설명에 "법정시군구코드를
 *            파라미터로 받아"라는 문구가 있다.
 *
 * 어느 쪽이 맞는지 문서로 확정할 수 없어 route.js가 둘 다 시도한다.
 * 이 파일은 양쪽 응답 모양을 모두 받아낼 수 있게 되어 있다.
 */

import { REGION_ALL } from './policy';

// ==================================================================
// 지역 코드
// ==================================================================

/** [확정] 구버전 지역 파라미터. 광역 17개뿐이며 경기 = 003002008 */
export const GYEONGGI_SIDO_CODE = '003002008';

/**
 * [추정] 신버전 법정시군구코드.
 * 웹 검색으로 확인했으나 1차 출처(code.go.kr 법정동코드 전체자료)로
 * 재확인하면 좋다.
 */
export const ZIP_TO_REGION = {
  41280: REGION_ALL, // 고양시 전체
  41281: '덕양구',
  41285: '일산동구',
  41287: '일산서구',
};

export const GOYANG_ZIP_CODES = Object.keys(ZIP_TO_REGION);

/** 고양시 판정 키워드. 지역코드가 없거나 광역 단위일 때 쓰는 폴백. */
const GOYANG_PATTERNS = [
  { pattern: /덕양/, region: '덕양구' },
  { pattern: /일산동구|일산\s*동/, region: '일산동구' },
  { pattern: /일산서구|일산\s*서/, region: '일산서구' },
  { pattern: /일산/, region: REGION_ALL },
  { pattern: /고양/, region: REGION_ALL },
];

/** 텍스트에서 고양시 여부·구를 판정한다. 무관하면 null. */
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
// 앞쪽 = 신버전(JSON) 추정 이름, 뒤쪽 = 구버전(XML) 관찰 이름.
// route.js 로그로 실제 키를 확인한 뒤 하나로 줄이면 확정된다.
// ==================================================================
const F = {
  id: ['plcyNo', 'bizId', 'polyBizId'],
  title: ['plcyNm', 'polyBizSjnm'],
  summary: ['plcyExplnCn', 'polyItcnCn'],
  benefit: ['plcySprtCn', 'sporCn', 'sporScvl'],

  ageMin: ['sprtTrgtMinAge'],
  ageMax: ['sprtTrgtMaxAge'],
  age: ['ageInfo', 'sprtTrgtAgeCn'],
  education: ['schoolCd', 'accrRqisCn'],
  employment: ['jobCd', 'empmSttsCn'],
  etcTarget: ['addAplyQlfcCndCn', 'aditRscn', 'prcpCn'],

  startDate: ['aplyBgngYmd', 'bizPrdBgngYmd'],
  endDate: ['aplyEndYmd', 'bizPrdEndYmd'],
  periodText: ['aplyYmd', 'rqutPrdCn', 'bizPrdCn'],

  agency: ['rgtrInstCdNm', 'sprvsnInstCdNm', 'operInstCdNm', 'cnsgNmor', 'mngtMson'],
  applyUrl: ['aplyUrlAddr', 'rqutUrla', 'refUrlAddr1', 'rfcSiteUrla1'],

  zipCode: ['zipCd', 'polyBizSecd'],
  categoryCode: ['lclsfNm', 'mclsfNm', 'polyRlmCd'],
};

/** 후보 키를 순서대로 훑어 처음 값이 있는 것을 반환 */
function pick(row, keys) {
  if (!row) return '';
  for (const key of keys) {
    let v = row[key];
    // XML CDATA를 파서가 객체로 줄 때 대비
    if (v && typeof v === 'object' && !Array.isArray(v)) v = v['#text'] ?? v._ ?? '';
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

// ==================================================================
// 날짜
// ------------------------------------------------------------------
// 구버전 신청기간(rqutPrdCn)은 자유 텍스트다. 실제 관찰된 값:
//   "09.13. ~ 09.26 (18:00까지)"   ← 연도가 없다
//   "상시"  "예산 소진 시까지"  "-"
// D-day가 이 앱의 핵심이라 최대한 살려 파싱한다.
// ==================================================================

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

/** 자유 텍스트 신청기간 → { start, end }. 해석 불가면 둘 다 null(상시접수). */
export function parsePeriod(text, now = new Date()) {
  const raw = String(text || '').trim();
  if (!raw || raw === '-') return { start: null, end: null };
  if (ALWAYS_OPEN.test(raw)) return { start: null, end: null };

  const withYear = [...raw.matchAll(/(20\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/g)].map(
    (m) => toIso(Number(m[1]), Number(m[2]), Number(m[3])),
  );
  const compact = [...raw.matchAll(/\b(20\d{2})(\d{2})(\d{2})\b/g)].map((m) =>
    toIso(Number(m[1]), Number(m[2]), Number(m[3])),
  );
  const dated = [...withYear, ...compact].filter(Boolean);

  if (dated.length >= 2) return { start: dated[0], end: dated[1] };
  if (dated.length === 1) return { start: dated[0], end: null };

  // 연도 없는 날짜: "09.13. ~ 09.26"
  const noYear = [...raw.matchAll(/(?<!\d)(\d{1,2})\s*[.\-/월]\s*(\d{1,2})(?!\d)/g)]
    .map((m) => ({ m: Number(m[1]), d: Number(m[2]) }))
    .filter((v) => v.m >= 1 && v.m <= 12 && v.d >= 1 && v.d <= 31);
  if (noYear.length === 0) return { start: null, end: null };

  const endPart = noYear.length > 1 ? noYear[1] : noYear[0];
  let year = now.getFullYear();
  // 올해로 본 마감일이 6개월 넘게 지났으면 내년 공고로 본다
  const sixMonthsAgo = new Date(now.getTime() - 182 * 24 * 60 * 60 * 1000);
  if (new Date(year, endPart.m - 1, endPart.d) < sixMonthsAgo) year += 1;

  const startPart = noYear.length > 1 ? noYear[0] : null;
  // 시작월이 종료월보다 크면 해를 넘긴 공고 (12.20 ~ 01.15)
  const start = startPart
    ? toIso(startPart.m > endPart.m ? year - 1 : year, startPart.m, startPart.d)
    : null;

  return { start, end: toIso(year, endPart.m, endPart.d) };
}

// ==================================================================
// 카테고리
// ------------------------------------------------------------------
// [확정] 구버전 정책유형 코드 (공식 파라미터 표)
//   023010 일자리 / 023020 주거 / 023030 교육 / 023040 복지·문화 / 023050 참여·권리
// 이 앱의 '금융'은 API 분류에 없어 키워드로 별도 판정한다.
// ==================================================================
const CODE_TO_CATEGORY = {
  '023010': '취업',
  '023020': '주거',
  '023030': '교육·문화',
  '023040': '복지',
  '023050': '교육·문화',
};

const NAME_TO_CATEGORY = {
  일자리: '취업', 취업: '취업', 창업: '취업',
  주거: '주거', 주택: '주거',
  교육: '교육·문화', 문화: '교육·문화',
  '복지·문화': '복지', 복지문화: '복지', 복지: '복지',
  '참여·권리': '교육·문화', 참여권리: '교육·문화',
};

const FINANCE_HINT = /대출|이자|융자|저축|적금|자산형성|금융|부채|보증료|목돈|디딤돌/;

export function resolveCategory(row, text) {
  if (FINANCE_HINT.test(text)) return '금융';

  const raw = pick(row, F.categoryCode);
  if (raw) {
    if (CODE_TO_CATEGORY[raw]) return CODE_TO_CATEGORY[raw];
    for (const [name, cat] of Object.entries(NAME_TO_CATEGORY)) {
      if (raw.includes(name)) return cat;
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

/**
 * 지역 판정.
 * 1) 법정시군구코드가 고양시 코드면 그것을 쓴다 (신버전 경로)
 * 2) 아니면 텍스트에서 고양/덕양/일산을 찾는다 (구버전 경로)
 * 고양시와 무관하면 null.
 */
export function resolveRegion(row, text) {
  const zip = pick(row, F.zipCode);
  if (zip) {
    // 콤마로 여러 개 올 수 있다. 고양시 코드가 하나라도 있으면 채택.
    for (const code of zip.split(/[,\s]+/)) {
      const head = code.slice(0, 5);
      if (ZIP_TO_REGION[head]) return ZIP_TO_REGION[head];
    }
  }
  return detectGoyangRegion(text);
}

/** 지원 대상 텍스트를 여러 필드에서 모아 한 문장으로 */
function buildTarget(row) {
  const min = pick(row, F.ageMin);
  const max = pick(row, F.ageMax);
  const ageRange = min && max ? `만 ${min}~${max}세` : '';

  const parts = [
    ageRange || pick(row, F.age),
    pick(row, F.education),
    pick(row, F.employment),
    pick(row, F.etcTarget),
  ].filter((v) => v && v !== '제한없음' && v !== '-' && v !== '0');

  return parts.length > 0 ? parts.join(' / ') : '공고 본문 확인 필요';
}

/** 응답 1건 → Policy 1건. 고양시와 무관하면 null. */
export function normalizePolicy(row, index = 0, now = new Date()) {
  const title = pick(row, F.title);
  if (!title) return null;

  const summary = pick(row, F.summary);
  const benefit = pick(row, F.benefit);
  const agency = pick(row, F.agency);
  const target = buildTarget(row);

  const haystack = `${title} ${summary} ${benefit} ${agency} ${target}`;
  const region = resolveRegion(row, haystack);
  if (!region) return null;

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

/** 응답 배열 → Policy 배열 (고양시 정책만, 중복 제거) */
export function normalizePolicies(rows, now = new Date()) {
  if (!Array.isArray(rows)) return [];
  const seen = new Set();
  const out = [];
  rows.forEach((row, index) => {
    const policy = normalizePolicy(row, index, now);
    if (!policy || seen.has(policy.id)) return;
    seen.add(policy.id);
    out.push(policy);
  });
  return out;
}

export default normalizePolicies;
