/**
 * 정책 데이터 스키마 (화면 ↔ API 계약)
 * ------------------------------------------------------------------
 * 이 파일이 이 앱의 "단일 진실 공급원(single source of truth)"이다.
 * API Route(/api/policies)는 어떤 데이터 소스를 쓰든 반드시 아래 Policy
 * 모양으로 변환해서 내려주고, 화면은 이 모양만 믿고 렌더한다.
 *
 * Policy = {
 *   id:       string   // 고유 식별자 (온통청년 bizId 등)
 *   title:    string   // 정책명
 *   category: string   // CATEGORIES 중 하나 ('취업' | '주거' | '금융' | '복지' | '교육·문화')
 *   region:   string   // 운영주체. REGIONS 중 하나 ('고양시' | '경기도' | '중앙부처')
 *   summary:  string   // 한 줄 요약
 *   target:   string   // 지원 대상
 *   benefit:  string   // 지원 내용
 *   start:    string|null // 접수 시작일 'YYYY-MM-DD' (없으면 null)
 *   end:      string|null // 접수 마감일 'YYYY-MM-DD' (없으면 null = 상시접수)
 *   agency:   string   // 담당 부서/기관
 *   applyUrl: string   // 신청 페이지 링크
 * }
 */

/** 카테고리 필터 목록. '전체'는 화면에서만 쓰는 값이라 데이터에는 들어가지 않는다. */
export const CATEGORIES = ['취업', '주거', '금융', '복지', '교육·문화'];
export const CATEGORY_FILTERS = ['전체', ...CATEGORIES];

/**
 * 운영주체 필터 목록.
 *
 * ⚠️ 실데이터를 보고 바꾼 축이다.
 * 원래는 덕양구/일산동구/일산서구였는데, 온통청년 API에서 받은 339건이
 * 사실상 전부 '고양시 전역'으로 잡혔다. 이 API의 지역코드는 "이 정책을
 * 신청할 수 있는 지역"이라 전국 정책이면 고양시가 당연히 포함되고,
 * 정작 고양시청이 만든 정책은 거의 등록돼 있지 않다.
 * 구 단위 필터는 눌러도 결과가 바뀌지 않아 쓸모가 없었다.
 *
 * 그래서 "어디가 운영하는 정책인가"로 축을 바꿨다.
 * 가까운 순서로 둔다: 고양시 → 경기도 → 중앙부처
 */
export const REGIONS = ['고양시', '경기도', '중앙부처'];
export const REGION_FILTERS = ['전체', ...REGIONS];

/** 고양시가 직접 운영하는 정책 */
export const LEVEL_GOYANG = '고양시';
/** 경기도 사업 (고양시 청년도 신청 가능) */
export const LEVEL_GYEONGGI = '경기도';
/** 중앙부처·공공기관 전국 사업 */
export const LEVEL_CENTRAL = '중앙부처';

/** 정렬 옵션 */
export const SORT_OPTIONS = [
  { value: 'deadline', label: '마감임박순' },
  { value: 'latest', label: '최신순' },
];

/** 마감임박으로 볼 기준(일). D-7 이하면 빨강 처리. */
export const URGENT_DAYS = 7;
/** 신규로 볼 기준(일). 접수 시작일이 14일 이내면 '신규'. */
export const NEW_DAYS = 14;

/**
 * 'YYYY-MM-DD' 문자열을 로컬 자정 기준 Date로 바꾼다.
 * new Date('2026-08-14')는 UTC 자정으로 해석돼 한국 시간대에서 하루가 밀릴 수 있어
 * 직접 파싱한다.
 */
export function parseDate(value) {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value).trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 오늘 0시(로컬) */
export function startOfToday(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * 오늘부터 해당 날짜까지 남은 일수.
 * 오늘이면 0, 내일이면 1, 어제면 -1. 날짜가 없으면 null.
 */
export function daysUntil(value, now = new Date()) {
  const target = parseDate(value);
  if (!target) return null;
  return Math.round((target.getTime() - startOfToday(now).getTime()) / MS_PER_DAY);
}

/** 접수 시작일이 NEW_DAYS 이내면 신규. 아직 시작 전인 정책도 신규로 본다. */
export function isNew(policy, now = new Date()) {
  const started = daysUntil(policy?.start, now);
  if (started === null) return false;
  return started > -NEW_DAYS && started <= NEW_DAYS;
}

/**
 * 정책의 현재 상태를 계산한다.
 * kind: 'always'(상시접수) | 'closed'(접수마감) | 'urgent'(마감임박) | 'open'(D-n)
 * dday: 남은 일수 (상시접수면 null)
 */
export function statusOf(policy, now = new Date()) {
  const remain = daysUntil(policy?.end, now);

  if (remain === null) {
    return { kind: 'always', label: '상시접수', dday: null };
  }
  if (remain < 0) {
    return { kind: 'closed', label: '접수마감', dday: remain };
  }
  if (remain <= URGENT_DAYS) {
    return { kind: 'urgent', label: remain === 0 ? '오늘마감' : `마감임박 D-${remain}`, dday: remain };
  }
  return { kind: 'open', label: `D-${remain}`, dday: remain };
}

/** 마감임박(빨강 강조) 여부 */
export function isUrgent(policy, now = new Date()) {
  return statusOf(policy, now).kind === 'urgent';
}

/** 'YYYY-MM-DD' → '2026. 8. 14.' */
export function formatDate(value) {
  const d = parseDate(value);
  if (!d) return '';
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
}

/** 접수기간 표기. 마감일이 없으면 상시접수. */
export function formatPeriod(policy) {
  const from = formatDate(policy?.start);
  const to = formatDate(policy?.end);
  if (!from && !to) return '상시접수';
  if (!to) return `${from} ~ 상시접수`;
  if (!from) return `~ ${to}`;
  return `${from} ~ ${to}`;
}

/**
 * 마감임박순 정렬 비교 함수.
 * 접수 중인 정책(마감일 가까운 순) → 상시접수 → 접수마감 순으로 놓는다.
 */
export function compareByDeadline(a, b, now = new Date()) {
  const sa = statusOf(a, now);
  const sb = statusOf(b, now);
  const rank = { urgent: 0, open: 0, always: 1, closed: 2 };
  if (rank[sa.kind] !== rank[sb.kind]) return rank[sa.kind] - rank[sb.kind];
  if (sa.dday === null || sb.dday === null) return 0;
  // 접수마감끼리는 최근에 마감한 것부터
  if (sa.kind === 'closed') return sb.dday - sa.dday;
  return sa.dday - sb.dday;
}

/** 최신순 정렬 비교 함수. 접수 시작일이 늦은(최근인) 것부터. */
export function compareByLatest(a, b) {
  const da = parseDate(a?.start);
  const db = parseDate(b?.start);
  if (!da && !db) return 0;
  if (!da) return 1;
  if (!db) return -1;
  return db.getTime() - da.getTime();
}

/** 검색어가 제목·지원내용·대상에 걸리는지 확인한다. */
export function matchesQuery(policy, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return true;
  return [policy?.title, policy?.summary, policy?.benefit, policy?.target]
    .filter(Boolean)
    .some((field) => String(field).toLowerCase().includes(q));
}

/** 운영주체 필터. 정확히 일치하는 것만 남긴다. */
export function matchesRegion(policy, region) {
  if (!region || region === '전체') return true;
  return policy?.region === region;
}

/** 카테고리 필터 */
export function matchesCategory(policy, category) {
  if (!category || category === '전체') return true;
  return policy?.category === category;
}
