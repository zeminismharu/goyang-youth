/**
 * 경기데이터드림 Open API 어댑터 (두 번째 데이터 소스)
 * ==================================================================
 * 왜 필요한가
 *   온통청년 API로 받은 339건을 확인해 보니 사실상 전부 중앙부처 전국
 *   사업이었다. 고양시청이 직접 운영하는 정책은 거의 등록돼 있지 않다.
 *   "고양시 청년정책"이라는 앱인데 정작 고양시 것이 없는 상태였다.
 *
 *   경기데이터드림은 경기도 일자리플랫폼 '잡아바'의 지원정책을 제공하고,
 *   무엇보다 SIGUN_CD로 시군 단위 조회가 된다(고양시 = 41280).
 *   온통청년에 없는 경기도·고양시 정책이 여기에 있다.
 *
 * [확정] 기본 인자 (경기데이터드림 OpenAPI 이용안내)
 *   KEY    인증키 (없으면 sample 로 5건만 나온다)
 *   Type   xml | json
 *   pIndex 페이지 (1부터)
 *   pSize  페이지당 건수 (최대 1000)
 *   SIGUN_CD 시군코드 — 요청인자. 고양시 41280
 *   출처: https://data.gg.go.kr/portal/openapi/usagePage.do
 *
 * [미확정] 서비스명(요청주소)과 출력 필드명
 *   데이터셋 상세 페이지의 요청주소·출력값 표가 JavaScript로 렌더돼
 *   읽지 못했다. 지어내지 않고 후보를 순서대로 시도하며, 어느 것이
 *   통했는지는 /api/policies?debug=1 로 확인할 수 있다.
 *   확정하려면 아래 페이지에서 "명세서 다운로드"를 받아 요청주소를 보면 된다.
 *   https://data.gg.go.kr/portal/data/service/selectServicePage.do?infId=C3R46QAIB3ZHGXG2TDOQ29456117&infSeq=2
 *   확인 후 GG_SERVICE_NAMES 를 실제 이름 하나로 줄이면 된다.
 */

import { LEVEL_GOYANG, LEVEL_GYEONGGI } from './policy';

/** [확정] 고양시 시군코드 */
export const GOYANG_SIGUN_CD = '41280';

/** [미확정] 서비스명 후보. 환경변수 GG_SERVICE_NAME 이 있으면 그것을 우선한다. */
const GG_SERVICE_NAMES = [
  'JobSprtPolicy',
  'JobPolicy',
  'TBJobSprtPolicy',
  'JobabaPolicy',
];

const GG_BASE = 'https://openapi.gg.go.kr';
const PAGE_SIZE = 1000;

export function ggServiceCandidates() {
  const fromEnv = String(process.env.GG_SERVICE_NAME || '').trim();
  return fromEnv ? [fromEnv] : GG_SERVICE_NAMES;
}

export function buildGgUrl(serviceName, apiKey, pIndex = 1) {
  const url = new URL(`${GG_BASE}/${serviceName}`);
  url.searchParams.set('KEY', apiKey);
  url.searchParams.set('Type', 'json');
  url.searchParams.set('pIndex', String(pIndex));
  url.searchParams.set('pSize', String(PAGE_SIZE));
  url.searchParams.set('SIGUN_CD', GOYANG_SIGUN_CD);
  return url;
}

/**
 * 경기데이터드림 JSON 봉투에서 행 배열을 꺼낸다.
 * 이 플랫폼의 응답은 { <서비스명>: [ {head:[...]}, {row:[...]} ] } 형태로 알려져 있다.
 * 구조가 다를 수 있어 재귀로 'row' 배열을 찾는다.
 */
export function extractGgRows(payload) {
  if (!payload || typeof payload !== 'object') return [];

  if (Array.isArray(payload.row)) return payload.row;

  for (const value of Object.values(payload)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = extractGgRows(item);
        if (found.length) return found;
      }
    } else if (value && typeof value === 'object') {
      const found = extractGgRows(value);
      if (found.length) return found;
    }
  }
  return [];
}

/** [미확정] 출력 필드명 후보 */
const G = {
  id: ['POLICY_NO', 'IDX', 'SEQ', 'POLICY_ID', 'NUM'],
  title: ['POLICY_NM', 'TITLE', 'SJ', 'BSNS_NM', 'PBANC_NM'],
  summary: ['POLICY_CN', 'CN', 'SUMRY_CN', 'BSNS_SUMRY'],
  benefit: ['SPRT_CN', 'SUPPORT_CN', 'BSNS_CN', 'DTL_CN'],
  target: ['TRGT_CN', 'SPRT_TRGT', 'QUALF_CN', 'TRGT'],
  start: ['RCEPT_BGNDE', 'BEGIN_DE', 'APPL_BGNDE', 'RCEPT_BGNG_YMD'],
  end: ['RCEPT_ENDDE', 'END_DE', 'APPL_ENDDE', 'RCEPT_END_YMD'],
  agency: ['INSTT_NM', 'JURISD_INSTT_NM', 'DEPT_NM', 'MNG_INSTT_NM', 'SIGUN_NM'],
  url: ['DETAIL_URL', 'HMPG_URL', 'REQST_URL', 'URL', 'LINK_URL'],
  sigunNm: ['SIGUN_NM'],
  category: ['CTGRY_NM', 'FIELD_NM', 'CL_NM'],
};

function ggPick(row, keys) {
  if (!row) return '';
  for (const key of keys) {
    const v = row[key];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

/** 경기데이터드림 행 → 이 앱의 Policy 형태로 쓸 중간 객체 */
export function ggRowToIntermediate(row, index = 0) {
  const title = ggPick(row, G.title);
  if (!title) return null;

  const sigun = ggPick(row, G.sigunNm);
  const agency = ggPick(row, G.agency) || (sigun ? `${sigun}` : '경기도');

  return {
    // normalize.js 가 알아볼 수 있도록 온통청년 필드명으로 맞춰 넣는다
    plcyNo: ggPick(row, G.id) || `gg-${index}`,
    plcyNm: title,
    plcyExplnCn: ggPick(row, G.summary),
    plcySprtCn: ggPick(row, G.benefit),
    addAplyQlfcCndCn: ggPick(row, G.target),
    aplyBgngYmd: ggPick(row, G.start),
    aplyEndYmd: ggPick(row, G.end),
    rgtrInstCdNm: agency,
    aplyUrlAddr: ggPick(row, G.url),
    lclsfNm: ggPick(row, G.category),
    // 이 소스는 SIGUN_CD=41280 으로 조회하므로 전부 고양시 대상이다
    zipCd: GOYANG_SIGUN_CD,
    // 운영주체 힌트
    __level: /고양/.test(agency) ? LEVEL_GOYANG : LEVEL_GYEONGGI,
  };
}
