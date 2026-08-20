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

import { LEVEL_CENTRAL, LEVEL_GOYANG, LEVEL_GYEONGGI } from './policy';

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
  41280: '고양시', // 시 전체
  41281: '고양시 덕양구',
  41285: '고양시 일산동구',
  41287: '고양시 일산서구',
};

export const GOYANG_ZIP_CODES = Object.keys(ZIP_TO_REGION);

/**
 * 고양시 판정 키워드.
 *
 * ⚠️ 실데이터에서 오탐이 나와 강화한 부분이다.
 * 예전에는 /일산/ 만으로 매칭했는데, 울산 동구의 "일산해수욕장"이 걸려서
 * 울산 행사가 고양시 정책으로 올라왔다.
 * 그래서 '일산'은 반드시 구 이름(일산동구/일산서구)일 때만 인정하고,
 * 그 외에는 '고양'이 있어야 한다. '고양이'는 제외한다.
 */
/** 고양시를 명시적으로 가리키는가 */
export function mentionsGoyang(text) {
  return /고양시|고양(?!이)|덕양구|일산동구|일산서구/.test(String(text || ''));
}

/**
 * 다른 지자체 이름 목록.
 *
 * ⚠️ 판정 대상은 "정책명"이다. 담당기관명이 아니다.
 * 처음에는 기관명으로 걸렀는데 위험했다. '서울대학교', '한국장학재단
 * 대전지부' 같은 전국 사업 운영기관이 지역명에 걸려 조용히 사라진다.
 * 반면 정책명에 지역이 박혀 있으면("울산 동구 청년의 날 기념행사")
 * 그 지자체 전용 정책이라는 신호가 훨씬 분명하다.
 */
const OTHER_LOCALITIES = [
  '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
  '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
  '충청', '전라', '경상',
  '수원', '성남', '의정부', '안양', '부천', '광명', '평택', '동두천',
  '안산', '과천', '구리', '남양주', '오산', '시흥', '군포', '의왕',
  '하남', '용인', '파주', '이천', '안성', '김포', '화성', '양주',
  '포천', '여주', '연천', '가평', '양평',
];

/**
 * 담당기관이 "지자체 그 자체"인가.
 *
 * ⚠️ 실데이터에서 '광주시청'이 운영하는 정책이 중앙부처로 통과했다.
 * 정책명에 지역이 없으면 걸러내지 못했기 때문이다.
 * 그렇다고 기관명에 지역명이 들어가면 무조건 빼면 '서울대학교',
 * '한국장학재단 대전지부' 같은 전국 사업 운영기관까지 사라진다.
 *
 * 그래서 "기관 자체가 지자체인가"를 본다.
 * 광역단체 정식명칭으로 시작하거나 시청/도청/군청/구청으로 끝나면 지자체다.
 * 대학교·재단·공단·진흥원은 여기 걸리지 않는다.
 */
const SIDO_FULL =
  /(서울특별시|부산광역시|대구광역시|인천광역시|광주광역시|대전광역시|울산광역시|세종특별자치시|경기도|강원특별자치도|강원도|충청북도|충청남도|전북특별자치도|전라북도|전라남도|경상북도|경상남도|제주특별자치도)/;
const GOV_OFFICE = /[가-힣]{2,5}(시청|도청|군청|구청)/;

export function isLocalGovernment(agency) {
  const a = String(agency || '');
  return SIDO_FULL.test(a) || GOV_OFFICE.test(a);
}

export function mentionsOtherLocality(text) {
  const t = String(text || '');
  return OTHER_LOCALITIES.some((name) => t.includes(name));
}

/** 텍스트가 고양시를 가리키면 '고양시', 아니면 null */
export function detectGoyangRegion(text) {
  return mentionsGoyang(text) ? LEVEL_GOYANG : null;
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

  // ⚠️ 실제 응답으로 확정한 부분.
  // aplyBgngYmd/aplyEndYmd 라는 필드는 존재하지 않는다.
  // 신청기간은 aplyYmd 에 문자열로 들어온다: "20260810 ~ 20260825"
  // bizPrdBgngYmd/EndYmd 는 '사업(행사) 기간'이라 마감일이 아니다.
  //   산림 캠프: bizPrd 20260903~20260904(캠프 열리는 날)
  //              aplyYmd 20260810 ~ 20260825(실제 접수)
  periodText: ['aplyYmd', 'rqutPrdCn', 'bizPrdCn'],
  programStart: ['bizPrdBgngYmd'],
  programEnd: ['bizPrdEndYmd'],

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
// 접수기간 추출 (실데이터를 보고 추가한 부분)
// ------------------------------------------------------------------
// ⚠️ 왜 필요한가
// aplyBgngYmd / aplyEndYmd 가 "신청기간"이 아니라 "사업·행사 기간"인
// 경우가 많다. 실제 사례:
//   산림창업가 시너지캠프
//     API 날짜   : 2026-09-03 ~ 2026-09-04  (캠프가 열리는 날)
//     실제 접수  : 2026. 8. 10. ~ 8. 25.    (지원내용 본문에만 있음)
// 이 앱의 존재 이유가 마감일이라 여기가 틀리면 앱이 거짓말을 한다.
//
// 그래서 본문에서 "접수기간/신청기간/모집기간" 뒤의 날짜를 먼저 찾고,
// 없을 때만 API 날짜 필드를 쓴다.
// ==================================================================

/** '접수기간 :' 같은 라벨 뒤 80자를 잘라낸다 */
const APPLY_LABEL = /(?:접수|신청|모집|공모|지원)\s*(?:기간|일정|기한)\s*[:：]?\s*([^\n]{0,80})/;

/**
 * 라벨 뒤 문자열에서 날짜들을 순서대로 뽑는다.
 * "2026. 8. 10.(월) ~ 8. 25.(화)" 처럼 뒷 날짜에 연도가 없는 경우
 * 앞 날짜의 연도를 물려준다.
 *
 * 라벨 뒤 좁은 구간만 보는 이유: 본문 전체를 훑으면 "연 1.5퍼센트"의
 * 1.5 같은 값이 1월 5일로 잘못 잡힌다.
 */
function parseDatesInSlice(slice) {
  const re = /(?:(20\d{2})\s*[.\-/년]\s*)?(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/g;
  const found = [];
  let m;
  while ((m = re.exec(slice)) !== null) {
    const year = m[1] ? Number(m[1]) : null;
    const month = Number(m[2]);
    const day = Number(m[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) continue;
    found.push({ year, month, day });
  }
  if (found.length === 0) return { start: null, end: null };

  // 연도가 빠진 항목은 가장 가까운 앞쪽 연도를 물려받는다
  let carried = found.find((f) => f.year)?.year ?? null;
  if (!carried) return { start: null, end: null };
  for (const f of found) {
    if (f.year) carried = f.year;
    else f.year = carried;
  }

  const iso = found.map((f) => toIso(f.year, f.month, f.day));
  return { start: iso[0], end: iso.length > 1 ? iso[1] : null };
}

/** 본문에서 접수기간을 찾는다. 못 찾으면 둘 다 null. */
export function extractApplyPeriod(text) {
  const raw = String(text || '');
  const m = APPLY_LABEL.exec(raw);
  if (!m) return { start: null, end: null };
  return parseDatesInSlice(m[1]);
}

/**
 * API 날짜가 "신청 마감일"이 아니라 사업기간으로 보이는지.
 * 회계연도 전체(1/1~12/31)이거나 300일을 넘는 구간이면 마감일로 볼 수 없다.
 * 이런 값에 D-day를 붙이면 의미 없는 숫자가 나온다.
 */
export function looksLikeProgramPeriod(start, end) {
  if (!start || !end) return false;
  if (/-01-01$/.test(start) && /-12-31$/.test(end)) return true;
  const days = (new Date(end).getTime() - new Date(start).getTime()) / 86400000;
  return days > 300;
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
 * 운영주체 판정 — 이 정책을 누가 운영하는가.
 *
 * 담당기관명이 가장 확실한 신호다.
 *   '고양시 일자리정책과'            → 고양시
 *   '경기도 미래평생교육국 청년기회과' → 경기도
 *   '고용노동부', '한국고용정보원'    → 중앙부처
 *
 * 기관명으로 판단이 안 되면 본문의 고양시 언급을 본다.
 * 여기서 null을 반환하면 목록에서 제외된다.
 */
export function resolveRegion(row, text) {
  // 다른 소스(경기데이터드림)가 운영주체를 이미 알고 넘겨준 경우
  if (row?.__level) return row.__level;

  const agency = pick(row, F.agency);
  const zip = pick(row, F.zipCode);

  // 지역코드가 있는데 고양시 코드가 없으면 고양시 청년 대상이 아니다.
  // (텍스트로 한 번 더 보던 예전 방식은 울산 '일산해수욕장'을 통과시켰다.)
  if (zip) {
    const codes = zip.split(/[,\s|]+/).map((c) => c.trim().slice(0, 5));
    if (!codes.some((c) => ZIP_TO_REGION[c])) return null;
  }

  if (mentionsGoyang(agency)) return LEVEL_GOYANG;
  if (/경기도|경기\s*청년|경기도일자리재단|경기연구원/.test(agency)) return LEVEL_GYEONGGI;

  // 기관명이 비었을 때만 본문을 본다
  if (!agency && mentionsGoyang(text)) return LEVEL_GOYANG;

  // 지역코드가 고양시를 포함하거나 아예 없으면 전국 사업으로 본다
  return LEVEL_CENTRAL;
}

/**
 * 코드값처럼 보이는 문자열인지.
 * 실제 응답의 schoolCd/jobCd 가 '0049010' 같은 코드로 와서
 * 지원대상에 그대로 노출되는 문제가 있었다.
 */
function looksLikeCode(v) {
  return /^[0-9]{4,}$/.test(v) || /^[0-9]{4,}(,[0-9]{4,})+$/.test(v);
}

/** 지원 대상 텍스트를 여러 필드에서 모아 한 문장으로 */
function buildTarget(row) {
  const min = pick(row, F.ageMin);
  const max = pick(row, F.ageMax);
  // 0 또는 비정상 값은 버린다 (연령 제한 없음을 0으로 주는 경우가 있다)
  const hasAge = min && max && Number(min) > 0 && Number(max) > 0 && Number(max) < 200;
  const ageRange = hasAge ? `만 ${min}~${max}세` : '';

  const parts = [
    ageRange || pick(row, F.age),
    pick(row, F.education),
    pick(row, F.employment),
    pick(row, F.etcTarget),
  ]
    .map((v) => String(v || '').trim())
    .filter((v) => v && v !== '제한없음' && v !== '-' && v !== '0' && !looksLikeCode(v));

  return parts.length > 0 ? parts.join(' / ') : '공고 본문 확인 필요';
}

/**
 * 담당기관이 경기도 본청 또는 도 산하기관인가.
 *
 * ⚠️ 예전에는 /^경기도(\s|$)/ 로 봤는데 '경기도일자리재단'이 걸리지
 *    않아 도(道) 사업이 '다른 지자체'로 잘못 제외됐다. 경기도 사업은
 *    고양시 청년도 신청할 수 있으므로 반드시 남아야 한다.
 *
 * 이름에 '경기'가 있으면 도 소속으로 보되, '경기도 수원시청'처럼
 * 시·군·구청이 함께 적혀 있으면 그 시군의 정책이므로 제외한다.
 * ('경기도청'은 도청이라 여기 걸리지 않는다.)
 */
function isGyeonggiAgency(agency) {
  const a = String(agency || '').trim();
  if (!/경기/.test(a)) return false;
  return !/[가-힣]{2,5}(시청|군청|구청)/.test(a);
}

/**
 * 한 행을 목록에 남길지 판정한다.
 *
 * ⚠️ 이 판정은 반드시 이 함수 하나에만 둔다.
 * 예전에는 normalizePolicy(실제 필터)와 explainRow(진단)가 같은 판정을
 * 각자 복사해서 갖고 있었다. 한쪽만 고치는 바람에 '광주시청' 정책이
 * 실제로는 걸러졌는데 진단 출력에는 통과로 찍혔다.
 * 진단이 실제 동작과 어긋나면 진단을 믿을 수 없으므로 일원화했다.
 */
function screenRow(row) {
  const title = pick(row, F.title);
  if (!title) {
    return { ok: false, reason: '정책명 필드를 찾지 못함', title: '(제목 없음)', agency: '', zip: '' };
  }

  const summary = pick(row, F.summary);
  const benefit = pick(row, F.benefit);
  const agency = pick(row, F.agency);
  const target = buildTarget(row);
  const haystack = `${title} ${summary} ${benefit} ${agency} ${target}`;
  const zip = pick(row, F.zipCode);
  const base = { title, summary, benefit, agency, target, haystack, zip };

  // 원본 지역코드가 부정확한 경우가 있어(울산 행사가 고양시 대상으로
  // 섞여 들어왔다) 두 가지를 더 본다.
  if (!mentionsGoyang(haystack)) {
    // (a) 정책명에 다른 지자체가 박혀 있으면 그 지자체 전용 정책이다.
    if (mentionsOtherLocality(title)) {
      return { ...base, ok: false, reason: '정책명이 다른 지자체를 지칭' };
    }
    // (b) 담당기관이 지자체 그 자체인데 경기도 본청이 아니면 마찬가지다.
    //     '광주시청' 정책이 (a)만으로는 걸러지지 않아 추가했다.
    if (isLocalGovernment(agency) && !isGyeonggiAgency(agency)) {
      return { ...base, ok: false, reason: '담당기관이 다른 지자체' };
    }
  }

  const region = resolveRegion(row, haystack);
  if (!region) {
    return {
      ...base,
      ok: false,
      reason: zip ? '지역코드에 고양시 코드 없음' : '지역코드 없고 본문에도 고양시 언급 없음',
    };
  }

  return { ...base, ok: true, region };
}

/** 응답 1건 → Policy 1건. 고양시와 무관하면 null. */
export function normalizePolicy(row, index = 0, now = new Date()) {
  const screened = screenRow(row);
  if (!screened.ok) return null;
  const { title, summary, benefit, agency, target, haystack, region } = screened;

  // 1순위: aplyYmd — 이 API의 실제 신청기간 필드 ("20260810 ~ 20260825")
  let { start, end } = parsePeriod(pick(row, F.periodText), now);

  // 2순위: 본문에 명시된 "접수기간/신청기간" (aplyYmd 가 비어 있을 때)
  if (!start && !end) {
    const fromText = extractApplyPeriod(`${benefit}\n${summary}`);
    start = fromText.start;
    end = fromText.end;
  }

  // 3순위: 사업기간. 마감일이 아니지만 아무 정보도 없는 것보다는 낫다.
  // 단 회계연도성 구간(1/1~12/31 등)은 D-day가 의미 없으므로 버린다.
  if (!start && !end) {
    const ps = toIsoDate(pick(row, F.programStart));
    const pe = toIsoDate(pick(row, F.programEnd));
    if (!looksLikeProgramPeriod(ps, pe)) {
      start = ps;
      end = pe;
    }
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

// ==================================================================
// 진단
// ------------------------------------------------------------------
// 실제 응답을 보지 않고 필터를 손보는 것은 추측일 뿐이다.
// route.js 의 ?debug=1 이 이 함수를 써서 어느 단계에서 몇 건이
// 걸러졌는지, 왜 걸러졌는지를 그대로 보여준다.
// ==================================================================

/** 행 하나가 왜 통과/제외됐는지 설명한다 */
export function explainRow(row) {
  const r = screenRow(row);
  return {
    title: r.title,
    agency: r.agency,
    zip: String(r.zip || '').slice(0, 60),
    kept: r.ok,
    reason: r.reason,
    region: r.region,
  };
}

/** 응답 전체에 대한 단계별 통계와 표본 */
export function diagnose(rows, now = new Date()) {
  const explained = (rows || []).map((r) => explainRow(r));
  const kept = explained.filter((e) => e.kept);
  const dropped = explained.filter((e) => !e.kept);

  const byReason = {};
  for (const d of dropped) byReason[d.reason] = (byReason[d.reason] || 0) + 1;

  // 지역코드가 실제로 필터링되고 있는지 확인용
  const zipStats = { 있음: 0, 없음: 0, 고양시코드포함: 0 };
  for (const row of rows || []) {
    const zip = pick(row, F.zipCode);
    if (!zip) {
      zipStats.없음 += 1;
      continue;
    }
    zipStats.있음 += 1;
    const codes = zip.split(/[,\s|]+/).map((c) => c.trim().slice(0, 5));
    if (codes.some((c) => ZIP_TO_REGION[c])) zipStats.고양시코드포함 += 1;
  }

  return {
    원본건수: (rows || []).length,
    통과: kept.length,
    제외: dropped.length,
    제외사유별: byReason,
    지역코드통계: zipStats,
    통과표본: kept.slice(0, 10).map((e) => `[${e.region}] ${e.title} — ${e.agency}`),
    제외표본: dropped.slice(0, 15).map((e) => `(${e.reason}) ${e.title} — ${e.agency} — zip:${e.zip}`),
  };
}
