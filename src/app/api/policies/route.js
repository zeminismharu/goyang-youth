/**
 * /api/policies — 정책 목록 서버 프록시
 * ==================================================================
 * 이 라우트가 존재하는 이유는 딱 하나, "인증키를 브라우저에 노출하지 않기" 위해서다.
 * 브라우저는 이 라우트만 호출하고, 온통청년 API는 서버에서만 호출한다.
 *
 * 동작
 *   - YOUTH_API_KEY 없음 → 샘플 데이터(src/lib/mockPolicies.js) 반환
 *   - YOUTH_API_KEY 있음 → 온통청년 API 호출 → normalize → 반환
 *   - 호출 실패/응답 이상 → 샘플 데이터로 폴백 (화면이 절대 빈 채로 죽지 않게)
 *   - 1시간 캐시 (revalidate = 3600)
 */

import { XMLParser } from 'fast-xml-parser';
import { mockPolicies, MOCK_NOTICE } from '@/lib/mockPolicies';
import { normalizePolicies, GOYANG_ZIP } from '@/lib/normalize';

/**
 * 요청마다 서버에서 실행한다.
 *
 * 왜 force-dynamic인가:
 * 라우트 자체를 정적으로 굳히면(빌드 시점 프리렌더) 배포 후 인증키를 넣어도
 * 재빌드 전까지 빌드 당시의 결과(=샘플 데이터)가 계속 나온다.
 * Cloudflare Workers처럼 ISR용 영속 캐시를 따로 붙여야 하는 환경에서 특히 그렇다.
 * 그래서 라우트는 런타임에 실행하고, "1시간 캐시"는 아래 온통청년 호출 자체에
 * 건다(next: { revalidate }). 결과적으로 외부 API는 1시간에 한 번만 때린다.
 */
export const dynamic = 'force-dynamic';

/** 온통청년 API 호출 캐시 시간(초). 1시간. */
const REVALIDATE_SECONDS = 3600;

// ==================================================================
// TODO(확인필요) ①: 엔드포인트 URL
// ------------------------------------------------------------------
// 작성 시점에 온통청년 OPEN API 문서 사이트 접근이 차단되어 있어 아래 URL을
// 실제 문서로 검증하지 못했다. 반드시 아래 중 하나에서 확인하고 확정할 것.
//   - https://www.youthcenter.go.kr/cmnFooter/openapiIntro/oaiDoc  (제공목록)
//   - https://www.data.go.kr/data/15143273/openapi.do              (공공데이터포털)
//
// 알려진 형태 (둘 중 어느 쪽인지 문서로 확인):
//   (구) https://www.youthcenter.go.kr/opi/youthPlcyList.do        → XML 응답
//   (신) https://www.youthcenter.go.kr/go/ythip/getPlcy            → JSON 응답
// ==================================================================
const API_ENDPOINT = 'https://www.youthcenter.go.kr/go/ythip/getPlcy';

// ==================================================================
// TODO(확인필요) ②: 쿼리 파라미터명
// ------------------------------------------------------------------
// 아래 파라미터명은 "추정"이다. 문서에서 확인 후 확정할 것.
//   apiKeyNm  : 인증키 파라미터명 (구버전은 openApiVlak, 신버전은 apiKeyNm 로 알려짐)
//   pageNum   : 페이지 번호       (구버전 pageIndex)
//   pageSize  : 페이지당 건수     (구버전 display, 최대값 확인 필요)
//   zipCd     : 법정동(시군구) 코드로 지역 필터 — 고양시=41280
//   rtnType   : 응답 형식 (json / xml). 없는 파라미터일 수도 있음.
// ==================================================================
function buildApiUrl(apiKey, { pageNum = 1, pageSize = 100 } = {}) {
  const url = new URL(API_ENDPOINT);
  url.searchParams.set('apiKeyNm', apiKey);
  url.searchParams.set('pageNum', String(pageNum));
  url.searchParams.set('pageSize', String(pageSize));
  // TODO(확인필요) ③: GOYANG_ZIP('41280')이 맞는 코드인지, 그리고 시(41280) 코드로
  // 조회했을 때 구 단위(41281/41285/41287) 정책까지 함께 나오는지 확인.
  // 안 나온다면 src/lib/normalize.js 의 GOYANG_ZIP_CODES 를 순회해 여러 번 호출해야 한다.
  url.searchParams.set('zipCd', GOYANG_ZIP);
  url.searchParams.set('rtnType', 'json');
  return url;
}

// ==================================================================
// TODO(확인필요) ④: 응답에서 "정책 배열"이 들어있는 경로
// ------------------------------------------------------------------
// 아래는 흔한 후보들을 순서대로 시도하는 임시 코드다.
// route.js 하단의 console.log 로 실제 구조를 확인한 뒤 한 줄로 확정할 것.
//   (신) data.youthPolicyList / result.youthPolicyList
//   (구) youthPolicyList.youthPolicy
// ==================================================================
function extractRows(payload) {
  if (!payload) return [];

  const candidates = [
    payload?.result?.youthPolicyList,
    payload?.result?.youthPolicy,
    payload?.data?.youthPolicyList,
    payload?.youthPolicyList?.youthPolicy,
    payload?.youthPolicyList,
    payload?.response?.body?.items?.item,
    payload?.items,
    payload?.data,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
    // 결과가 1건이면 배열이 아니라 객체로 오는 API가 많다.
    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
      const inner = candidate.youthPolicy ?? candidate.item;
      if (Array.isArray(inner)) return inner;
      if (inner && typeof inner === 'object') return [inner];
    }
  }
  return [];
}

/** 응답 본문이 JSON이든 XML이든 자바스크립트 객체로 만든다. */
function parseBody(text, contentType) {
  const trimmed = text.trim();
  const looksXml = trimmed.startsWith('<');

  if (!looksXml && !String(contentType).includes('xml')) {
    return JSON.parse(trimmed);
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    trimValues: true,
    // 숫자로 보이는 코드값(법정동코드 등)이 숫자로 바뀌며 앞의 0이 날아가는 것을 막는다.
    parseTagValue: false,
  });
  return parser.parse(trimmed);
}

/** 샘플 데이터 응답을 만든다. */
function mockResponse(reason) {
  return Response.json({
    source: 'mock',
    reason,
    notice: MOCK_NOTICE,
    fetchedAt: new Date().toISOString(),
    total: mockPolicies.length,
    policies: mockPolicies,
  });
}

export async function GET() {
  const apiKey = process.env.YOUTH_API_KEY;

  // 키가 없으면 바로 샘플 데이터. (지금 단계의 기본 동작)
  if (!apiKey) {
    return mockResponse('YOUTH_API_KEY가 설정되지 않아 샘플 데이터를 반환했습니다.');
  }

  try {
    const url = buildApiUrl(apiKey);

    const res = await fetch(url, {
      headers: { Accept: 'application/json, text/xml;q=0.9' },
      // Next.js 데이터 캐시: 1시간 유지
      next: { revalidate: REVALIDATE_SECONDS },
    });

    if (!res.ok) {
      throw new Error(`온통청년 API 응답 실패: HTTP ${res.status}`);
    }

    const text = await res.text();
    const payload = parseBody(text, res.headers.get('content-type'));
    const rows = extractRows(payload);

    // ================================================================
    // 👀 실제 응답 키를 확인하는 자리 (연동 첫날 반드시 볼 것)
    // ----------------------------------------------------------------
    // 아래 로그는 서버 터미널(npm run dev를 띄운 창)에 찍힌다.
    // 여기 찍히는 키 이름을 보고 src/lib/normalize.js 의 FIELD_CANDIDATES를
    // 실제 이름으로 확정한 뒤, 이 console.log는 지우면 된다.
    //
    // 주의: apiKey는 절대 로그에 찍지 말 것.
    // ================================================================
    if (rows.length > 0) {
      console.log('[youth-api] 응답 최상위 키:', Object.keys(payload || {}));
      console.log('[youth-api] 항목 키 목록:', Object.keys(rows[0] || {}));
      console.log('[youth-api] 첫 항목 원본:', JSON.stringify(rows[0], null, 2));
    } else {
      console.log(
        '[youth-api] 정책 배열을 찾지 못했습니다. 응답 구조를 확인하세요:',
        JSON.stringify(payload, null, 2).slice(0, 2000),
      );
    }

    const policies = normalizePolicies(rows);

    // 파싱은 됐는데 결과가 0건이면, 경로/파라미터가 틀렸을 확률이 높다.
    // 빈 화면 대신 샘플로 폴백하고 이유를 함께 내려준다.
    if (policies.length === 0) {
      return mockResponse(
        '온통청년 API 응답에서 정책을 찾지 못했습니다. route.js의 extractRows와 normalize.js의 필드 매핑을 확인하세요.',
      );
    }

    return Response.json({
      source: 'api',
      notice: null,
      fetchedAt: new Date().toISOString(),
      total: policies.length,
      policies,
    });
  } catch (error) {
    // 실패해도 앱은 살아 있어야 한다.
    console.error('[youth-api] 호출 실패:', error?.message);
    return mockResponse(`온통청년 API 호출에 실패해 샘플 데이터를 반환했습니다. (${error?.message})`);
  }
}
