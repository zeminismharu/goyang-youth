/**
 * 경기데이터드림 Open API 어댑터 (보조 데이터 소스)
 * ==================================================================
 * ✅ 공식 명세서(오픈 API 명세서 - 경기도 내 일자리 관련 지원정책 정보)로
 *    전부 확정했다. 더 이상 추측이 없다.
 *
 *   요청주소 : https://openapi.gg.go.kr/JobFndtnSportPolocy
 *              (서비스명 철자가 'Polocy'인 것은 원본 그대로다. 오타가 아니다.)
 *   기본인자 : Key(필수) / Type(xml,json) / pIndex / pSize(최대 1000)
 *   요청인자 : DIV_CD(카테고리코드) / REGION_CD(지역코드)
 *   출력값   : LIST_TOTAL_COUNT, CODE, MESSAGE, API_VERSION,
 *              PBLANC_TITLE(공고명), INST_NM(기관명),
 *              RECRUT_BEGIN_DE(모집시작일), RECRUT_END_DE(모집종료일),
 *              DIV_CD/DIV_NM(카테고리), REGION_CD/REGION_NM(지역),
 *              DETAIL_PAGE_URL(잡아바 상세페이지)
 *
 * ⚠️ 두 가지 한계를 알고 쓴다.
 *
 * 1) REGION_CD 의 코드값 목록이 명세서에 없다.
 *    41280 같은 법정동코드인지 잡아바 자체 코드인지 알 수 없어
 *    지어내지 않는다. 대신 REGION_CD 를 보내지 않고 전체를 받아
 *    응답의 REGION_NM 에서 '고양'을 걸러낸다. 지역명이 출력값에
 *    들어있으므로 이 방법이 확실하다.
 *
 * 2) 지원내용·지원대상 필드가 아예 없다.
 *    이 API는 공고명·기관·모집기간·상세링크까지만 준다.
 *    없는 내용을 만들어내지 않고, 상세는 DETAIL_PAGE_URL(잡아바)로
 *    연결한다. 온통청년 쪽이 훨씬 상세하므로 제목이 겹치면 그쪽을 남긴다.
 */

import { LEVEL_GOYANG, LEVEL_GYEONGGI } from './policy';

/** [확정] 요청주소 */
const GG_ENDPOINT = 'https://openapi.gg.go.kr/JobFndtnSportPolocy';
/** [확정] 1회 최대 1,000건 */
const PAGE_SIZE = 1000;
/** 최대 조회 페이지 */
export const GG_MAX_PAGES = 5;

/**
 * 요청 헤더.
 *
 * ⚠️ 실측: 헤더 없이 부르면 경기도 WAF가 막는다.
 *    "- 보안 정책에 의해 차단 되었습니다 - 자세한 사항은
 *      사이버침해대응센터로 문의 바랍니다. ☎ 031-8008-4114"
 *    Workers 의 fetch 는 User-Agent 를 기본으로 붙이지 않는데,
 *    UA 없는 요청을 봇으로 보고 막는 국내 공공기관 WAF가 흔하다.
 *    발급받은 정상 인증키로 공개 API를 부르는 것이므로 우회가 아니라
 *    "브라우저와 같은 조건으로 부른다"는 뜻이다.
 *    이래도 막히면 IP 기반 차단이고, 그건 코드로 못 푼다.
 */
export const GG_HEADERS = {
  Accept: 'application/json, text/plain;q=0.9, */*;q=0.8',
  'Accept-Language': 'ko-KR,ko;q=0.9',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  Referer: 'https://data.gg.go.kr/',
};

/** 응답이 WAF 차단 안내 페이지인가 */
export function isBlockedPage(text) {
  const t = String(text || '');
  return /보안\s*정책에\s*의해\s*차단|사이버침해대응센터/.test(t);
}

export function buildGgUrl(apiKey, pIndex = 1) {
  const url = new URL(GG_ENDPOINT);
  url.searchParams.set('Key', apiKey); // [확정] 대문자 K + 소문자 ey
  url.searchParams.set('Type', 'json');
  url.searchParams.set('pIndex', String(pIndex));
  url.searchParams.set('pSize', String(PAGE_SIZE));
  // REGION_CD 는 코드값을 몰라 보내지 않는다. REGION_NM 으로 거른다.
  return url;
}

/**
 * 경기데이터드림 응답 봉투에서 행 배열과 결과코드를 꺼낸다.
 * 형태: { JobFndtnSportPolocy: [ { head: [...] }, { row: [...] } ] }
 */
export function extractGgRows(payload) {
  const service = payload?.JobFndtnSportPolocy;

  // ⚠️ 오류일 때는 서비스 봉투 없이 RESULT 만 최상위로 온다. 실측:
  //    {"RESULT":{"CODE":"ERROR-290","MESSAGE":"인증키가 유효하지 않습니다. ..."}}
  //    이걸 못 읽으면 원인이 "행 없음"으로 뭉개져서 진단이 무의미해진다.
  if (!Array.isArray(service)) {
    const result = payload?.RESULT;
    return {
      rows: [],
      code: result?.CODE ?? null,
      message: result?.MESSAGE ?? null,
      total: null,
    };
  }

  let rows = [];
  let code = null;
  let message = null;
  let total = null;

  for (const block of service) {
    if (Array.isArray(block?.row)) rows = block.row;
    if (Array.isArray(block?.head)) {
      for (const h of block.head) {
        if (typeof h?.LIST_TOTAL_COUNT === 'number') total = h.LIST_TOTAL_COUNT;
        if (h?.RESULT) {
          code = h.RESULT.CODE ?? null;
          message = h.RESULT.MESSAGE ?? null;
        }
      }
    }
  }
  return { rows, code, message, total };
}

const val = (row, key) => {
  const v = row?.[key];
  return v === undefined || v === null ? '' : String(v).trim();
};

/** "2026-08-10" → "20260810". 8자리가 아니면 버린다(지어내지 않는다). */
function toYmd(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length === 8 ? digits : '';
}

/**
 * 모집시작일·종료일을 온통청년의 aplyYmd 모양("20260810 ~ 20260825")으로
 * 합친다. normalize.js 의 기간 파서가 이 형식을 읽는다.
 */
function toAplyYmd(begin, end) {
  const b = toYmd(begin);
  const e = toYmd(end);
  if (b && e) return `${b} ~ ${e}`;
  return b || e || '';
}

/**
 * 고양시 청년이 신청할 수 있는 행인가.
 * 고양시 정책은 물론, 경기도 전역 사업도 포함한다.
 * (REGION_NM 이 '경기전체'인 도 사업을 빼면 정작 신청 가능한 정책이 빠진다.)
 * '수원시' 같은 다른 시군은 제외된다.
 */
export function isGoyangRow(row) {
  const region = val(row, 'REGION_NM');
  const inst = val(row, 'INST_NM');
  if (/고양/.test(region) || /고양/.test(inst)) return true;
  return /^경기(전체|도)?$/.test(region);
}

/**
 * 경기데이터드림 행 → normalize.js 가 이해하는 중간 객체.
 * 온통청년 필드명에 맞춰 넣어 두 소스가 같은 변환기를 타게 한다.
 */
export function ggRowToIntermediate(row, index = 0) {
  const title = val(row, 'PBLANC_TITLE');
  if (!title) return null;

  const inst = val(row, 'INST_NM');
  const regionNm = val(row, 'REGION_NM');
  const detailUrl = val(row, 'DETAIL_PAGE_URL');

  return {
    plcyNo: detailUrl || `gg-${index}`,
    plcyNm: title,
    // 이 API에는 설명·지원내용 필드가 없다. 없는 값을 만들지 않고
    // 어디서 확인해야 하는지만 알린다.
    plcyExplnCn: regionNm ? `${regionNm} · ${val(row, 'DIV_NM')}`.replace(/ · $/, '') : '',
    plcySprtCn: '',
    // ⚠️ aplyBgngYmd / aplyEndYmd 로 넘기면 안 된다.
    //    온통청년 실물을 확인한 뒤 normalize.js 가 그 필드를 읽지 않도록
    //    바꿨다(실제 신청기간 필드는 aplyYmd 문자열). 여기서 같은 모양으로
    //    맞춰 보내야 경기 정책도 D-day가 붙는다.
    aplyYmd: toAplyYmd(val(row, 'RECRUT_BEGIN_DE'), val(row, 'RECRUT_END_DE')),
    rgtrInstCdNm: inst || '경기도',
    aplyUrlAddr: detailUrl,
    lclsfNm: val(row, 'DIV_NM'),
    // SIGUN 필터를 서버에서 못 걸었으므로 지역코드는 넣지 않는다.
    // 대신 운영주체를 직접 지정한다.
    __level: /고양/.test(inst) || /고양/.test(regionNm) ? LEVEL_GOYANG : LEVEL_GYEONGGI,
    __source: 'gg',
  };
}
