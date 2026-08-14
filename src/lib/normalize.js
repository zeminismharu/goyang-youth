/**
 * 온통청년 OPEN API 응답 → 이 앱의 Policy 스키마 변환기
 * ==================================================================
 * ⚠️ 중요 / 반드시 읽을 것
 *
 * 이 파일의 필드 매핑은 "아직 실제 응답으로 검증되지 않았다".
 * 작성 시점에 온통청년 OPEN API 문서(youthcenter.go.kr) 접근이 막혀 있어
 * 문서상의 실제 필드명을 확인하지 못했다. 아래 이름들은 널리 알려진
 * 온통청년 필드명(plcyNm, plcyExplnCn 등)을 근거로 한 "추정"이다.
 *
 * ▶ 실제 연동 순서
 *   1) .env.local 에 YOUTH_API_KEY 를 넣는다.
 *   2) src/app/api/policies/route.js 안의 console.log(첫 항목) 출력을 확인한다.
 *      → 터미널에 실제 응답의 키 목록이 그대로 찍힌다.
 *   3) 그 키 이름으로 아래 FIELD_CANDIDATES 를 고쳐 확정한다.
 *   4) 확정한 뒤에는 pick() 의 후보 배열을 실제 키 하나만 남겨 정리하는 것을 권장.
 *
 * 지금은 "후보 여러 개를 순서대로 시도"하는 방식이라 필드명이 조금 달라도
 * 앱이 죽지 않고 최대한 값을 찾아낸다. 다만 이는 임시방편이며
 * 실제 키 확인 후 반드시 확정할 것.
 */

import { CATEGORIES, REGION_ALL } from './policy';

// ------------------------------------------------------------------
// 법정동(시군구) 코드 → 우리 화면의 지역명
// ------------------------------------------------------------------
// TODO(확인필요): 아래 코드는 웹 검색으로 확인한 값이며 1차 출처(행정표준코드관리
// 시스템 code.go.kr 의 법정동코드 전체자료)로 재확인이 필요하다.
//   41280 고양시(시 전체)
//   41281 고양시 덕양구
//   41285 고양시 일산동구
//   41287 고양시 일산서구
// code.go.kr → 법정동코드 전체자료 다운로드 후 '고양'으로 검색하면 확정 가능.
export const GOYANG_ZIP = '41280';

export const ZIP_TO_REGION = {
  41280: REGION_ALL,
  41281: '덕양구',
  41285: '일산동구',
  41287: '일산서구',
};

/** 고양시 관련 시군구 코드 전체 (구 단위까지 포함해 조회할 때 사용) */
export const GOYANG_ZIP_CODES = Object.keys(ZIP_TO_REGION);

// ------------------------------------------------------------------
// 응답 필드명 후보
// ------------------------------------------------------------------
// TODO(확인필요): 실제 응답 키를 확인해 각 배열을 실제 키 하나로 확정할 것.
const FIELD_CANDIDATES = {
  // 정책 고유 ID (예전 응답에서는 bizId 였다)
  id: ['plcyNo', 'bizId', 'polyBizSjnm', 'plcyId'],
  // 정책명
  title: ['plcyNm', 'polyBizSjnm', 'plcyKywdNm'],
  // 정책 설명 / 한 줄 요약
  summary: ['plcyExplnCn', 'polyItcnCn', 'plcySprtCn'],
  // 지원 내용
  benefit: ['plcySprtCn', 'sporCn', 'sporScvl'],
  // 지원 대상 (여러 필드를 합쳐야 할 수도 있음)
  target: ['sprtTrgtAgeCn', 'addAplyQlfcCndCn', 'ageInfo', 'trgtAgeCn'],
  // 신청 시작일 / 종료일 (YYYYMMDD 형태로 오는 경우가 많다)
  start: ['aplyBgngYmd', 'bizPrdBgngYmd', 'rqutPrdBgngYmd'],
  end: ['aplyEndYmd', 'bizPrdEndYmd', 'rqutPrdEndYmd'],
  // 신청 기간이 문자열 한 덩어리로 오는 경우 (예: '20260801 ~ 20260831')
  periodText: ['aplyYmd', 'rqutPrdCn', 'bizPrdCn'],
  // 담당 기관 / 부서
  agency: ['rgtrInstCdNm', 'sprvsnInstCdNm', 'operInstCdNm', 'cnsgNmor'],
  // 신청 URL
  applyUrl: ['aplyUrlAddr', 'refUrlAddr1', 'rqutUrla', 'rfcSiteUrla1'],
  // 지역(법정동) 코드
  zipCode: ['zipCd', 'rgtrUpInstCd', 'polyBizSecd'],
  // 정책 분류 (2023년 개편 후 대분류/중분류)
  categoryLarge: ['lclsfNm', 'polyRlmCd', 'plcyMajorCd'],
  categoryMiddle: ['mclsfNm', 'mdclsfNm'],
};

/** 후보 키들을 순서대로 훑어 처음으로 값이 있는 것을 반환한다. */
function pick(row, keys) {
  if (!row) return '';
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return '';
}

/**
 * 날짜 문자열을 'YYYY-MM-DD'로 정규화한다.
 * '20260814', '2026-08-14', '2026.08.14' 모두 받아준다.
 * 알아볼 수 없으면 null (= 상시접수로 처리됨).
 */
export function toIsoDate(value) {
  if (!value) return null;
  const digits = String(value).replace(/[^0-9]/g, '');
  if (digits.length !== 8) return null;
  const y = digits.slice(0, 4);
  const m = digits.slice(4, 6);
  const d = digits.slice(6, 8);
  if (Number(m) < 1 || Number(m) > 12 || Number(d) < 1 || Number(d) > 31) return null;
  return `${y}-${m}-${d}`;
}

/** '20260801 ~ 20260831' 같은 한 덩어리 문자열에서 시작·종료일을 뽑는다. */
function parsePeriodText(text) {
  if (!text) return { start: null, end: null };
  const found = String(text).match(/\d{4}[.\-/]?\d{2}[.\-/]?\d{2}/g);
  if (!found || found.length === 0) return { start: null, end: null };
  return {
    start: toIsoDate(found[0]),
    end: found.length > 1 ? toIsoDate(found[1]) : null,
  };
}

// ------------------------------------------------------------------
// 카테고리 매핑
// ------------------------------------------------------------------
// TODO(확인필요): 온통청년 대분류(lclsfNm)의 실제 값 목록을 확인해 확정할 것.
// 2023년 개편 이후 대분류는 '일자리 / 주거 / 교육 / 복지문화 / 참여권리' 5종으로
// 알려져 있으나, 응답에 코드값(예: '023010')으로 올 수도 있다.
const CATEGORY_MAP = {
  일자리: '취업',
  취업: '취업',
  창업: '취업',
  주거: '주거',
  주택: '주거',
  금융: '금융',
  '금융·자산': '금융',
  복지: '복지',
  복지문화: '복지',
  '복지·문화': '복지',
  생활지원: '복지',
  교육: '교육·문화',
  문화: '교육·문화',
  참여권리: '교육·문화',
  '참여·권리': '교육·문화',
};

/** 응답의 분류값 + 텍스트를 근거로 우리 카테고리 5종 중 하나로 정한다. */
export function resolveCategory(row) {
  const large = pick(row, FIELD_CANDIDATES.categoryLarge);
  const middle = pick(row, FIELD_CANDIDATES.categoryMiddle);

  for (const raw of [large, middle]) {
    if (!raw) continue;
    if (CATEGORIES.includes(raw)) return raw;
    if (CATEGORY_MAP[raw]) return CATEGORY_MAP[raw];
    // 부분 일치도 한 번 시도 (예: '일자리분야' → '취업')
    const hit = Object.keys(CATEGORY_MAP).find((key) => raw.includes(key));
    if (hit) return CATEGORY_MAP[hit];
  }

  // 분류를 못 찾으면 제목·설명 키워드로 최후의 추정
  const text = `${pick(row, FIELD_CANDIDATES.title)} ${pick(row, FIELD_CANDIDATES.summary)}`;
  if (/전세|월세|주택|임대|보증금|기숙/.test(text)) return '주거';
  if (/대출|이자|저축|적금|자산|금융|부채/.test(text)) return '금융';
  if (/취업|일자리|채용|인턴|창업|면접/.test(text)) return '취업';
  if (/교육|강좌|문화|공연|여행|자격증/.test(text)) return '교육·문화';
  return '복지';
}

/** 법정동코드 → 지역명. 모르면 '고양시 전역'으로 둔다. */
export function resolveRegion(row) {
  const zip = pick(row, FIELD_CANDIDATES.zipCode);
  if (!zip) return REGION_ALL;
  // 여러 코드가 콤마로 붙어 오는 경우가 있어 첫 번째 것만 본다.
  const first = zip.split(/[,\s]+/)[0].slice(0, 5);
  return ZIP_TO_REGION[first] || REGION_ALL;
}

/**
 * 응답 1건 → Policy 1건
 * @param {object} row 온통청년 응답 항목
 * @param {number} index 목록 내 순번 (id가 없을 때 대체용)
 */
export function normalizePolicy(row, index = 0) {
  let start = toIsoDate(pick(row, FIELD_CANDIDATES.start));
  let end = toIsoDate(pick(row, FIELD_CANDIDATES.end));

  // 개별 날짜 필드가 비어 있으면 기간 문자열에서 뽑아본다.
  if (!start && !end) {
    const parsed = parsePeriodText(pick(row, FIELD_CANDIDATES.periodText));
    start = parsed.start;
    end = parsed.end;
  }

  const title = pick(row, FIELD_CANDIDATES.title) || '(정책명 없음)';

  return {
    id: pick(row, FIELD_CANDIDATES.id) || `policy-${index}`,
    title,
    category: resolveCategory(row),
    region: resolveRegion(row),
    summary: pick(row, FIELD_CANDIDATES.summary) || title,
    target: pick(row, FIELD_CANDIDATES.target) || '공고 본문 확인 필요',
    benefit: pick(row, FIELD_CANDIDATES.benefit) || '공고 본문 확인 필요',
    start,
    end,
    agency: pick(row, FIELD_CANDIDATES.agency) || '고양시',
    applyUrl: pick(row, FIELD_CANDIDATES.applyUrl) || 'https://www.youthcenter.go.kr/',
  };
}

/** 응답 배열 → Policy 배열. 제목 없는 쓰레기 항목은 걸러낸다. */
export function normalizePolicies(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row, index) => normalizePolicy(row, index))
    .filter((policy) => policy.title && policy.title !== '(정책명 없음)');
}

export default normalizePolicies;
