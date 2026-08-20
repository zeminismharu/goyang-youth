/**
 * /api/policies — 정책 목록 서버 프록시
 * ==================================================================
 * 이 라우트가 존재하는 이유는 하나, "인증키를 브라우저에 노출하지 않기".
 *
 * ⚠️ 온통청년 API는 두 세대가 공존하고, 어느 쪽이 발급된 키에 맞는지
 *    공식 문서로 확정할 수 없었다. 그래서 후보를 순서대로 시도하고
 *    실제로 데이터가 나오는 쪽을 채택한다. 어느 쪽이 통했는지는
 *    로그와 응답의 strategy 필드로 알 수 있다.
 */

import { XMLParser } from 'fast-xml-parser';
import { mockPolicies, MOCK_NOTICE } from '@/lib/mockPolicies';
import {
  normalizePolicies,
  diagnose,
  GYEONGGI_SIDO_CODE,
  GOYANG_ZIP_CODES,
} from '@/lib/normalize';
import {
  buildGgUrl,
  extractGgRows,
  ggRowToIntermediate,
  isGoyangRow,
  GG_MAX_PAGES,
} from '@/lib/ggSource';

/**
 * 요청마다 실행한다. 정적으로 굳히면 배포 후 인증키를 넣어도
 * 재빌드 전까지 빌드 당시 결과(샘플)가 계속 나간다.
 */
export const dynamic = 'force-dynamic';

/** 온통청년 호출 캐시 시간(초) */
const REVALIDATE_SECONDS = 3600;
/** 한 페이지 건수 (구버전 문서: 최대 100) */
const PAGE_SIZE = 100;
/** 최대 조회 페이지 */
const MAX_PAGES = 10;

// ==================================================================
// 시도할 API 후보
// ------------------------------------------------------------------
// [신버전] 공식 명세를 찾지 못했다. 인증키가 UUID 형식이면 이쪽일
//          가능성이 높다. 법정시군구코드(41280)로 고양시를 직접 지정한다.
// [구버전] 공식 문서에 명세가 있다. XML 응답. 지역은 시·도 단위뿐이라
//          경기 전체를 받아 normalize.js가 고양시만 걸러낸다.
// ==================================================================
const STRATEGIES = [
  {
    name: 'v2-getPlcy',
    url: 'https://www.youthcenter.go.kr/go/ythip/getPlcy',
    params: (key, page) => ({
      apiKeyNm: key,
      pageNum: String(page),
      pageSize: String(PAGE_SIZE),
      rtnType: 'json',
      zipCd: GOYANG_ZIP_CODES.join(','),
    }),
  },
  {
    name: 'v1-youthPlcyList',
    url: 'https://www.youthcenter.go.kr/opi/youthPlcyList.do',
    params: (key, page) => ({
      openApiVlak: key,
      pageIndex: String(page),
      display: String(PAGE_SIZE),
      srchPolyBizSecd: GYEONGGI_SIDO_CODE,
    }),
  },
];

/** UUID 형식이면 신버전을 먼저 시도한다 */
function orderStrategies(key) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key);
  return isUuid ? STRATEGIES : [...STRATEGIES].reverse();
}

const parser = new XMLParser({
  ignoreAttributes: false,
  trimValues: true,
  // 003002008, 41280 처럼 앞자리 0이 있는 코드가 숫자로 바뀌며 깨지는 것을 막는다
  parseTagValue: false,
  parseAttributeValue: false,
});

function parseBody(text) {
  const t = text.trim();
  if (t.startsWith('{') || t.startsWith('[')) return JSON.parse(t);
  return parser.parse(t);
}

/** 응답에서 정책 배열을 꺼낸다. 두 세대의 봉투 모양을 모두 본다. */
function extractRows(payload) {
  if (!payload) return [];
  const candidates = [
    payload?.result?.youthPolicyList,
    payload?.result?.youthPolicy,
    payload?.youthPolicyList?.youthPolicy,
    payload?.youthPolicyList,
    payload?.youthPolicy,
    payload?.data?.youthPolicyList,
    payload?.response?.body?.items?.item,
    payload?.data,
    payload?.items,
  ];
  for (const c of candidates) {
    if (Array.isArray(c)) return c;
    if (c && typeof c === 'object') {
      const inner = c.youthPolicy ?? c.item;
      if (Array.isArray(inner)) return inner;
      if (inner && typeof inner === 'object') return [inner];
      // 객체 자체가 정책 1건인 경우
      if (Object.keys(c).length > 3) return [c];
    }
  }
  return [];
}

// ==================================================================
// 인증키 읽기
// ------------------------------------------------------------------
// Cloudflare Workers에서 시크릿을 읽는 경로가 두 가지다.
//   1) process.env            — OpenNext가 채워주는 경우
//   2) getCloudflareContext() — 어댑터가 제공하는 정식 경로
// 버전·설정에 따라 한쪽만 되는 경우가 있어 둘 다 본다.
// Node(next dev/build)에서는 2번이 없으므로 try로 감싼다.
// ==================================================================
async function resolveSecret(name) {
  const fromProcess = String(process.env[name] || '').trim();
  if (fromProcess) return { key: fromProcess, via: 'process.env' };

  try {
    const mod = await import('@opennextjs/cloudflare');
    const ctx = await mod.getCloudflareContext({ async: true });
    const v = String(ctx?.env?.[name] || '').trim();
    if (v) return { key: v, via: 'cloudflareContext.env' };
  } catch {
    // Node 환경이면 이 경로가 없다. 정상이다.
  }

  return { key: '', via: null };
}

const resolveApiKey = () => resolveSecret('YOUTH_API_KEY');

/**
 * 지금 워커가 볼 수 있는 환경변수 "이름" 목록.
 * ⚠️ 값은 절대 담지 않는다. 이름만 본다.
 * 시크릿 이름을 잘못 넣었을 때 그 사실이 바로 드러나게 하는 장치다.
 * (실제로 이름을 'Secret'으로 넣어 한참 헤맨 적이 있다.)
 */
async function visibleSecretNames() {
  const isNoise = (n) => /^(npm_|NODE|PATH|HOME|PWD|SHLVL|_$|LANG|TZ|HOSTNAME|TERM|__)/.test(n);
  const proc = Object.keys(process.env || {}).filter((n) => !isNoise(n));

  let cf = null;
  try {
    const mod = await import('@opennextjs/cloudflare');
    const ctx = await mod.getCloudflareContext({ async: true });
    cf = Object.keys(ctx?.env || {});
  } catch {
    // Node 환경
  }
  return { proc, cf };
}

/** 특정 키를 못 찾았을 때 어디를 봐야 하는지 알려주는 문자열 */
async function diagnoseMissingSecret(name) {
  const { proc, cf } = await visibleSecretNames();
  const parts = [`${name} 을(를) 찾지 못했습니다.`];

  if (cf === null) {
    parts.push(`process.env 이름 ${proc.length}개: ${proc.slice(0, 20).join(', ') || '(없음)'}`);
    parts.push('Cloudflare 바인딩 접근 불가(Node 환경)');
  } else {
    parts.push(`Cloudflare 바인딩 ${cf.length}개: ${cf.join(', ') || '(없음)'}`);
  }
  parts.push('Settings > Variables and Secrets(빌드 변수 아님)에 이 이름 그대로 등록했는지 확인하세요.');
  return parts.join(' | ');
}

const diagnoseMissingKey = () => diagnoseMissingSecret('YOUTH_API_KEY');

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

/** 전략 하나로 페이지를 순회하며 원본 행을 모은다 */
async function fetchWithStrategy(strategy, apiKey) {
  const rows = [];

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const url = new URL(strategy.url);
    for (const [k, v] of Object.entries(strategy.params(apiKey, page))) {
      url.searchParams.set(k, v);
    }

    const res = await fetch(url, {
      headers: { Accept: 'application/json, text/xml;q=0.9' },
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const payload = parseBody(await res.text());
    const pageRows = extractRows(payload);

    // ============================================================
    // 👀 실제 응답 구조 확인용 (연동 첫날 한 번만 보면 된다)
    // 인증키는 절대 찍지 않는다.
    // ============================================================
    if (page === 1) {
      console.log(`[youth-api][${strategy.name}] 최상위 키:`, Object.keys(payload || {}));
      if (pageRows.length > 0) {
        console.log(`[youth-api][${strategy.name}] 항목 키:`, Object.keys(pageRows[0] || {}));
        console.log(
          `[youth-api][${strategy.name}] 첫 항목:`,
          JSON.stringify(pageRows[0], null, 2).slice(0, 3000),
        );
      } else {
        console.log(
          `[youth-api][${strategy.name}] 정책 배열 없음. 응답:`,
          JSON.stringify(payload, null, 2).slice(0, 1500),
        );
      }
    }

    if (pageRows.length === 0) break;
    rows.push(...pageRows);
    if (pageRows.length < PAGE_SIZE) break;
  }

  return rows;
}


/**
 * 경기데이터드림(잡아바)에서 고양시 정책을 가져온다.
 *
 * REGION_CD 코드값을 몰라 서버 필터를 못 걸므로 전체를 페이지로 받아
 * REGION_NM/INST_NM 에 '고양'이 있는 행만 남긴다.
 *
 * 이 소스는 보조다. 키가 없거나 실패해도 조용히 빈 배열을 반환하고,
 * 온통청년 결과만으로 화면이 정상 동작해야 한다.
 */
async function fetchGyeonggi() {
  const { key } = await resolveSecret('GG_API_KEY');
  if (!key) return { rows: [], scanned: 0, reason: await diagnoseMissingSecret('GG_API_KEY') };

  const kept = [];
  let scanned = 0;

  try {
    for (let page = 1; page <= GG_MAX_PAGES; page += 1) {
      const res = await fetch(buildGgUrl(key, page), {
        headers: { Accept: 'application/json' },
        next: { revalidate: REVALIDATE_SECONDS },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const { rows, code, message, total } = extractGgRows(JSON.parse(await res.text()));

      if (page === 1) {
        console.log(`[gg-api] 결과코드 ${code} / ${message} / 전체 ${total}건`);
        if (rows.length > 0) console.log('[gg-api] 항목 키:', Object.keys(rows[0]));
      }
      // 인증키 오류(290) 등은 여기서 드러난다
      if (rows.length === 0) {
        if (page === 1) return { rows: [], scanned: 0, reason: `${code ?? '응답'} ${message ?? '행 없음'}` };
        break;
      }

      scanned += rows.length;
      kept.push(...rows.filter(isGoyangRow));

      if (rows.length < 1000) break;
    }

    const mapped = kept.map((r, i) => ggRowToIntermediate(r, i)).filter(Boolean);
    console.log(`[gg-api] 경기 ${scanned}건 조회 → 고양시 ${mapped.length}건`);
    return { rows: mapped, scanned, reason: null };
  } catch (error) {
    console.error('[gg-api] 실패:', error?.message);
    return { rows: [], scanned, reason: error?.message };
  }
}

/** 제목이 같은 정책은 하나만 남긴다. 앞쪽(고양시·경기도)을 우선한다. */
function dedupeByTitle(policies) {
  const seen = new Set();
  const out = [];
  for (const p of policies) {
    const key = String(p.title).replace(/\s+/g, '').toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

export async function GET(request) {
  // ?debug=1 — 실제 응답의 필드명과 단계별 필터 결과를 그대로 보여준다.
  // 추측으로 필터를 손보지 않기 위한 장치다. 인증키는 담기지 않는다.
  const debug = new URL(request.url).searchParams.get('debug') === '1';

  const { key: apiKey, via } = await resolveApiKey();

  if (!apiKey) {
    const diag = await diagnoseMissingKey();
    console.log('[youth-api] 인증키를 찾지 못했습니다.', diag);
    return mockResponse(
      'YOUTH_API_KEY를 읽지 못했습니다. Cloudflare 대시보드에서 Settings > ' +
        'Variables and Secrets(빌드 변수가 아님)에 Secret으로 등록했는지 확인하세요. ' +
        `[진단] ${diag}`,
    );
  }

  console.log(`[youth-api] 인증키 확인됨 (경로: ${via}, 길이: ${apiKey.length})`);

  const attempts = [];

  for (const strategy of orderStrategies(apiKey)) {
    try {
      const rows = await fetchWithStrategy(strategy, apiKey);

      if (rows.length === 0) {
        attempts.push(`${strategy.name}: 응답은 왔지만 정책 0건`);
        continue;
      }

      const youthPolicies = normalizePolicies(rows);
      console.log(`[youth-api][${strategy.name}] 원본 ${rows.length}건 → 고양시 ${youthPolicies.length}건`);

      // 보조 소스: 경기데이터드림(잡아바)의 고양시 정책을 합친다.
      // 온통청년 쪽이 지원내용·대상까지 주므로 제목이 겹치면 그쪽을 남긴다.
      const gg = await fetchGyeonggi();
      const ggPolicies = normalizePolicies(gg.rows);
      const policies = dedupeByTitle([...youthPolicies, ...ggPolicies]);
      console.log(`[merge] 온통청년 ${youthPolicies.length} + 경기 ${ggPolicies.length} → ${policies.length}건`);

      // ?debug=1 — 실제 필드명과 단계별 필터 결과, 두 소스 현황을 그대로 보여준다.
      // 병합까지 끝난 뒤에 만들어야 경기데이터드림 상태도 함께 보인다.
      if (debug) {
        return Response.json(
          {
            debug: true,
            strategy: strategy.name,
            인증키경로: via,
            소스: {
              온통청년: youthPolicies.length,
              경기데이터드림: ggPolicies.length,
              경기조회건수: gg.scanned,
              경기미연동사유: gg.reason,
              병합후: policies.length,
            },
            진단: diagnose(rows),
            응답필드명: Object.keys(rows[0] || {}),
          },
          { headers: { 'Cache-Control': 'no-store' } },
        );
      }

      if (policies.length === 0) {
        attempts.push(`${strategy.name}: 원본 ${rows.length}건 중 고양시 0건`);
        continue;
      }

      return Response.json({
        source: 'api',
        strategy: strategy.name,
        notice: null,
        fetchedAt: new Date().toISOString(),
        total: policies.length,
        scanned: rows.length,
        sources: {
          온통청년: youthPolicies.length,
          경기데이터드림: ggPolicies.length,
          경기조회건수: gg.scanned,
          경기미연동사유: gg.reason,
        },
        policies,
      });
    } catch (error) {
      console.error(`[youth-api][${strategy.name}] 실패:`, error?.message);
      attempts.push(`${strategy.name}: ${error?.message}`);
    }
  }

  return mockResponse(`온통청년 API에서 정책을 가져오지 못했습니다. — ${attempts.join(' / ')}`);
}
