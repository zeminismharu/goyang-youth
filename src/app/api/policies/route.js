/**
 * /api/policies — 정책 목록 서버 프록시
 * ==================================================================
 * 이 라우트가 존재하는 이유는 하나, "인증키를 브라우저에 노출하지 않기".
 * 브라우저는 이 라우트만 호출하고, 온통청년 API는 서버에서만 호출한다.
 *
 * 동작
 *   - YOUTH_API_KEY 없음 → 샘플 데이터 반환
 *   - 있음 → 온통청년 API 호출 → XML 파싱 → 고양시만 필터 → 반환
 *   - 실패/0건 → 샘플 데이터로 폴백 (화면이 비지 않게)
 */

import { XMLParser } from 'fast-xml-parser';
import { mockPolicies, MOCK_NOTICE } from '@/lib/mockPolicies';
import { normalizePolicies, GYEONGGI_SIDO_CODE } from '@/lib/normalize';

/**
 * 요청마다 서버에서 실행한다.
 *
 * 라우트를 정적으로 굳히면(빌드 시점 프리렌더) 배포 후 인증키를 넣어도
 * 재빌드 전까지 빌드 당시 결과(=샘플 데이터)가 계속 나간다.
 * Cloudflare Workers처럼 ISR용 영속 캐시를 따로 붙여야 하는 환경에서 특히 그렇다.
 * 그래서 라우트는 런타임 실행하고, 1시간 캐시는 아래 외부 호출에 건다.
 */
export const dynamic = 'force-dynamic';

/** 온통청년 호출 캐시 시간(초). 1시간. */
const REVALIDATE_SECONDS = 3600;

// ==================================================================
// [확정] 엔드포인트 · 파라미터
// ------------------------------------------------------------------
// 출처: https://www.youthcenter.go.kr/cmnFooter/openapiIntro/oaiDoc
// 공식 요청 예시:
//   https://www.youthcenter.go.kr/opi/youthPlcyList.do
//   openApiVlak=... | pageIndex=1 | display=10
//   | bizTycdSel=023010,023020 | srchPolyBizSecd=003002001,003002002
//
// 응답은 XML이다 (오픈 API 이용방법 페이지 명시).
// ==================================================================
const API_ENDPOINT = 'https://www.youthcenter.go.kr/opi/youthPlcyList.do';

/** display 최대값 (문서: 기본 10, 최대 100) */
const PAGE_SIZE = 100;

/**
 * 최대 조회 페이지 수.
 * 지역 필터가 경기도 단위라 경기 전체를 받아 고양시만 걸러내야 한다.
 * 1시간 캐시가 걸리므로 이 정도 호출은 감당 가능하다.
 */
const MAX_PAGES = 10;

function buildApiUrl(apiKey, pageIndex) {
  const url = new URL(API_ENDPOINT);
  url.searchParams.set('openApiVlak', apiKey); // [확정] 인증키
  url.searchParams.set('pageIndex', String(pageIndex)); // [확정] 페이지 (필수)
  url.searchParams.set('display', String(PAGE_SIZE)); // [확정] 건수 (필수, 최대 100)

  // [확정] 지역코드는 시·도 단위만 지원한다. 003002008 = 경기.
  // 고양시(시군구) 코드가 API에 없어서, 경기 전체를 받아
  // normalize.js 에서 '고양/덕양/일산' 텍스트로 걸러낸다.
  url.searchParams.set('srchPolyBizSecd', GYEONGGI_SIDO_CODE);

  return url;
}

/**
 * XML 응답에서 정책 배열을 꺼낸다.
 * 관찰된 구조: <youthPolicyList><youthPolicy>...</youthPolicy>...</youthPolicyList>
 * 구조가 다를 경우를 대비해 후보를 몇 개 더 본다.
 */
function extractRows(payload) {
  if (!payload) return [];

  const candidates = [
    payload?.youthPolicyList?.youthPolicy,
    payload?.youthPolicy,
    payload?.response?.body?.items?.item,
    payload?.result?.youthPolicyList,
  ];

  for (const c of candidates) {
    if (Array.isArray(c)) return c;
    // 결과가 1건이면 배열이 아니라 객체로 온다
    if (c && typeof c === 'object') return [c];
  }
  return [];
}

const parser = new XMLParser({
  ignoreAttributes: false,
  trimValues: true,
  // 지역코드(003002008)처럼 앞자리 0이 있는 값이 숫자로 바뀌며 깨지는 것을 막는다
  parseTagValue: false,
  parseAttributeValue: false,
});

function parseBody(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return JSON.parse(trimmed);
  return parser.parse(trimmed);
}

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

  if (!apiKey) {
    return mockResponse('YOUTH_API_KEY가 설정되지 않아 샘플 데이터를 반환했습니다.');
  }

  try {
    const allRows = [];
    let scanned = 0;

    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const res = await fetch(buildApiUrl(apiKey, page), {
        headers: { Accept: 'text/xml, application/xml, application/json;q=0.9' },
        next: { revalidate: REVALIDATE_SECONDS },
      });

      if (!res.ok) throw new Error(`온통청년 API 응답 실패: HTTP ${res.status}`);

      const payload = parseBody(await res.text());
      const rows = extractRows(payload);

      // ============================================================
      // 👀 실제 응답 키 확인용 로그 (연동 첫날 한 번만 보면 된다)
      // ------------------------------------------------------------
      // 여기 찍히는 키 이름으로 normalize.js 의 F(필드 후보)를
      // 실제 이름 하나로 확정한 뒤, 이 블록은 지우면 된다.
      // 인증키는 절대 찍지 않는다.
      // ============================================================
      if (page === 1) {
        console.log('[youth-api] 응답 최상위 키:', Object.keys(payload || {}));
        if (rows.length > 0) {
          console.log('[youth-api] 항목 키 목록:', Object.keys(rows[0] || {}));
          console.log('[youth-api] 첫 항목 원본:', JSON.stringify(rows[0], null, 2));
        } else {
          console.log(
            '[youth-api] 정책 배열을 찾지 못했습니다. 응답 구조 확인 필요:',
            JSON.stringify(payload, null, 2).slice(0, 2000),
          );
        }
      }

      if (rows.length === 0) break;
      allRows.push(...rows);
      scanned += rows.length;

      // 마지막 페이지
      if (rows.length < PAGE_SIZE) break;
    }

    const policies = normalizePolicies(allRows);
    console.log(`[youth-api] 경기 ${scanned}건 조회 → 고양시 ${policies.length}건`);

    if (policies.length === 0) {
      return mockResponse(
        `온통청년 API에서 경기 ${scanned}건을 받았지만 고양시 정책을 찾지 못했습니다. ` +
          'normalize.js 의 필드 매핑과 고양시 판정 조건을 확인하세요.',
      );
    }

    return Response.json({
      source: 'api',
      notice: null,
      fetchedAt: new Date().toISOString(),
      total: policies.length,
      scanned,
      policies,
    });
  } catch (error) {
    console.error('[youth-api] 호출 실패:', error?.message);
    return mockResponse(
      `온통청년 API 호출에 실패해 샘플 데이터를 반환했습니다. (${error?.message})`,
    );
  }
}
