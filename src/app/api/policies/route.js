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
  isBlockedPage,
  GG_HEADERS,
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
// 네트워크 유틸
// ------------------------------------------------------------------
// 지난번 온통청년 장애 때 진단이 "HTTP 400 / HTTP 522" 뿐이라 원인을
// 좁힐 수 없었다. 서버가 본문에 이유를 적어 보내는데 그걸 버리고
// 있었기 때문이다. 이제는 본문 앞부분을 사유에 함께 담는다.
// 522(엣지 연결 타임아웃) 같은 일시 장애는 한 번 더 시도해 본다.
// ==================================================================

/** 최대 시도 횟수(원 시도 포함). 522는 응답까지 오래 걸려 크게 두지 않는다. */
const MAX_ATTEMPTS = 2;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** 잠깐 뒤 다시 하면 될 법한 상태코드인가 */
function isTransient(status) {
  return status === 408 || status === 429 || status >= 500;
}

/** 혹시 본문에 인증키가 섞여 돌아오더라도 로그·응답에 남지 않게 지운다 */
function redact(text, apiKey) {
  if (!apiKey) return text;
  return text.split(apiKey).join('***');
}

/** 오류 사유에 붙일 만큼만 줄인다. 길면 붙여넣다 잘린다. */
function shorten(text) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, 200);
}

/**
 * 응답 본문을 글자 깨짐 없이 읽는다.
 *
 * ⚠️ 경기데이터드림 오류 페이지가 EUC-KR 로 온다. UTF-8 로 읽으면
 *    "- ���� ��å�� ..." 처럼 통째로 깨져서 원인을 읽을 수 없다.
 *    Content-Type 의 charset 을 우선 보고, 못 믿을 때를 대비해
 *    후보를 돌려가며 대체문자(U+FFFD)가 가장 적은 결과를 고른다.
 *    (Workers 런타임은 compatibility_date 2026-03-03 부터 CJK 전용
 *     TextDecoder 를 기본으로 쓴다. 우리 설정은 그 이후다.)
 */
function decodeBytes(buffer, contentType) {
  const declared = /charset=["']?([\w-]+)/i.exec(String(contentType || ''))?.[1];
  const candidates = [...new Set([declared, 'utf-8', 'euc-kr'].filter(Boolean))];

  let best = null;
  for (const label of candidates) {
    let text;
    try {
      text = new TextDecoder(label).decode(buffer);
    } catch {
      continue; // 런타임이 모르는 인코딩 이름
    }
    const broken = (text.match(/\uFFFD/g) || []).length;
    if (!best || broken < best.broken) best = { text, broken };
    if (broken === 0) break;
  }
  return best ? best.text : '';
}

async function readBody(res) {
  return decodeBytes(await res.arrayBuffer(), res.headers.get('content-type'));
}

/**
 * JSON이 아닌 응답에서 사람이 읽을 부분만 뽑는다.
 * 경기데이터드림이 오류를 HTTP 200 + 안내 HTML로 돌려주는 경우가 있는데,
 * 그때 JSON.parse 예외("Unexpected token '<'")만 남으면 원인을 알 수 없다.
 */
function describeNonJson(text) {
  const stripped = String(text)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
  return shorten(stripped) || shorten(text);
}

/** fetch + 일시 장애 재시도. 실패 시 상태코드와 본문 앞부분을 담아 던진다. */
async function fetchWithRetry(url, init, apiKey) {
  let last = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    let retriable = true;

    try {
      const res = await fetch(url, init);
      if (res.ok) return res;

      const body = shorten(redact(await readBody(res), apiKey));
      last = new Error(`HTTP ${res.status}${body ? ` \u2014 ${body}` : ''}`);
      retriable = isTransient(res.status);
    } catch (error) {
      // fetch 자체가 터진 경우(네트워크). 재시도 대상으로 둔다.
      last = error instanceof Error ? error : new Error(String(error));
    }

    if (!retriable) break;
    if (attempt < MAX_ATTEMPTS) await sleep(800);
  }

  throw last;
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
  const visible = (cf === null ? proc : cf).join(',') || '(없음)';
  // 짧게 유지한다. 길면 붙여넣다가 잘려서 정작 필요한 목록이 안 보인다.
  return `${name} 없음. 보이는 이름: ${visible}`;
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

    const res = await fetchWithRetry(
      url,
      {
        headers: { Accept: 'application/json, text/xml;q=0.9' },
        next: { revalidate: REVALIDATE_SECONDS },
      },
      apiKey,
    );

    const payload = parseBody(await readBody(res));
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
      const res = await fetchWithRetry(
        buildGgUrl(key, page),
        {
          headers: GG_HEADERS,
          next: { revalidate: REVALIDATE_SECONDS },
        },
        key,
      );

      const text = await readBody(res);

      let payload;
      try {
        payload = JSON.parse(text);
      } catch {
        // JSON이 아니다. 대개 오류 안내 HTML이다. 내용을 그대로 사유에 담는다.
        const detail = describeNonJson(redact(text, key));
        console.error('[gg-api] JSON이 아닌 응답:', detail);
        // 인증키 문제와 방화벽 차단은 조치가 전혀 다르므로 구분해서 알린다.
        const prefix = isBlockedPage(text)
          ? '경기도 방화벽이 차단(인증키 문제 아님)'
          : 'JSON이 아닌 응답';
        return { rows: [], scanned, reason: `${prefix}: ${detail}` };
      }

      const { rows, code, message, total } = extractGgRows(payload);

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

/**
 * 온통청년에서 정책을 가져온다. 전략을 순서대로 시도한다.
 * 실패해도 던지지 않고 사유만 담아 반환한다. 한 소스가 죽어도
 * 다른 소스로 서비스가 이어져야 하기 때문이다.
 */
async function fetchYouth(apiKey) {
  const attempts = [];

  for (const strategy of orderStrategies(apiKey)) {
    try {
      const rows = await fetchWithStrategy(strategy, apiKey);
      if (rows.length === 0) {
        attempts.push(`${strategy.name}: 응답은 왔지만 정책 0건`);
        continue;
      }
      const policies = normalizePolicies(rows);
      console.log(`[youth-api][${strategy.name}] 원본 ${rows.length}건 → 고양시 ${policies.length}건`);
      if (policies.length === 0) {
        attempts.push(`${strategy.name}: 원본 ${rows.length}건 중 고양시 0건`);
        continue;
      }
      return { policies, rows, strategy: strategy.name, reason: null };
    } catch (error) {
      console.error(`[youth-api][${strategy.name}] 실패:`, error?.message);
      attempts.push(`${strategy.name}: ${error?.message}`);
    }
  }

  return { policies: [], rows: [], strategy: null, reason: attempts.join(' / ') };
}

export async function GET(request) {
  // ?debug=1 — 실제 필드명과 단계별 필터 결과, 두 소스 현황을 보여준다.
  // 추측으로 필터를 손보지 않기 위한 장치다. 인증키 값은 담기지 않는다.
  const debug = new URL(request.url).searchParams.get('debug') === '1';

  const { key: apiKey, via } = await resolveApiKey();
  if (apiKey) {
    console.log(`[youth-api] 인증키 확인됨 (경로: ${via}, 길이: ${apiKey.length})`);
  }

  // ⚠️ 두 소스를 독립적으로 부른다.
  // 예전에는 경기데이터드림 호출이 온통청년 성공 분기 안에 있었다.
  // 그래서 온통청년이 죽으면(실제로 HTTP 400/522가 났다) 멀쩡한 경기
  // 데이터까지 못 쓰고 통째로 샘플로 떨어졌다. 한쪽이 죽어도 다른 쪽으로
  // 서비스가 이어져야 한다.
  const [youth, gg] = await Promise.all([
    apiKey
      ? fetchYouth(apiKey)
      : Promise.resolve({
          policies: [],
          rows: [],
          strategy: null,
          reason: await diagnoseMissingSecret('YOUTH_API_KEY'),
        }),
    fetchGyeonggi(),
  ]);

  const ggPolicies = normalizePolicies(gg.rows);
  // 온통청년이 지원내용·대상까지 주므로 제목이 겹치면 그쪽을 남긴다.
  const policies = dedupeByTitle([...youth.policies, ...ggPolicies]);

  const sources = {
    온통청년: youth.policies.length,
    온통청년실패사유: youth.reason,
    경기데이터드림: ggPolicies.length,
    경기조회건수: gg.scanned,
    경기미연동사유: gg.reason,
    병합후: policies.length,
  };
  console.log('[merge]', JSON.stringify(sources));

  if (debug) {
    return Response.json(
      {
        debug: true,
        // ⚠️ 맨 앞에 둔다. 뒤에 두면 붙여넣을 때 잘려서 못 본다.
        바인딩: (await visibleSecretNames()).cf ?? '(Node 환경)',
        strategy: youth.strategy,
        인증키경로: via,
        소스: sources,
        진단: youth.rows.length ? diagnose(youth.rows) : '온통청년 응답 없음',
        응답필드명: Object.keys(youth.rows[0] || {}),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }

  // 한 건이라도 있으면 실데이터로 서비스한다.
  if (policies.length > 0) {
    return Response.json({
      source: 'api',
      strategy: youth.strategy,
      notice: null,
      fetchedAt: new Date().toISOString(),
      total: policies.length,
      scanned: youth.rows.length,
      sources,
      policies,
    });
  }

  // 두 소스 모두 빈손일 때만 샘플로 떨어진다.
  return mockResponse(
    `실데이터를 가져오지 못했습니다. — 온통청년: ${youth.reason || '없음'} / 경기: ${gg.reason || '없음'}`,
  );
}
