/**
 * 샘플(예시) 정책 데이터
 * ------------------------------------------------------------------
 * ⚠️ 주의: 아래 정책 내용·금액·기간·담당부서·링크는 모두 화면 확인용으로 만든
 *    "예시"이며 실제 고양시/정부 공고와 다를 수 있습니다.
 *    인증키(YOUTH_API_KEY)가 없을 때 앱이 바로 동작하도록 넣어둔 더미 데이터이고,
 *    실제 값은 온통청년 OPEN API 연동 후 대체됩니다.
 *
 * 날짜는 "오늘" 기준 상대값으로 만들어 둡니다.
 * 그래야 시간이 지나도 마감임박/신규/접수마감 배지가 항상 한 번씩 보여서
 * 화면 확인이 쉽습니다. (실데이터로 바뀌면 이 부분은 사라집니다.)
 */

import { LEVEL_CENTRAL, LEVEL_GOYANG, LEVEL_GYEONGGI } from './policy';

/** 오늘로부터 days일 뒤 날짜를 'YYYY-MM-DD'로 반환 */
function offsetDate(days) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const MOCK_NOTICE =
  '※ 현재 화면은 예시(샘플) 데이터입니다. 실제 공고 내용과 다를 수 있으니 반드시 담당 부서 공고를 확인하세요.';

export const mockPolicies = [
  {
    id: 'mock-001',
    title: '고양시 청년 취업역량 강화 프로그램',
    category: '취업',
    region: LEVEL_GOYANG,
    summary: '직무교육 + 모의면접 + 취업컨설팅을 한 번에 지원하는 8주 과정',
    target: '고양시 거주 만 19~39세 미취업 청년',
    benefit: '교육비 전액 지원, 수료 시 활동비 30만원 지급(예시 금액)',
    start: offsetDate(-9),
    end: offsetDate(3),
    agency: '고양시 일자리정책과',
    applyUrl: 'https://www.goyang.go.kr/',
  },
  {
    id: 'mock-002',
    title: '고양시 청년 인턴십 지원사업',
    category: '취업',
    region: LEVEL_GOYANG,
    summary: '관내 중소기업에서 3개월간 인턴으로 근무하며 실무 경험을 쌓는 사업',
    target: '고양시 거주 만 19~34세 미취업 청년',
    benefit: '월 급여의 일부(최대 180만원) 기업에 지원, 인턴 수료 시 정규직 전환 우대(예시)',
    start: offsetDate(-2),
    end: offsetDate(25),
    agency: '고양시 일자리정책과',
    applyUrl: 'https://www.goyang.go.kr/',
  },
  {
    id: 'mock-003',
    title: '청년 면접정장 대여 지원',
    category: '취업',
    region: LEVEL_GOYANG,
    summary: '면접용 정장을 무료로 대여해주는 상시 사업',
    target: '고양시 거주 만 18~39세 청년(연 3회 이내)',
    benefit: '정장 대여 3박 4일 무료, 세탁비 포함(예시)',
    start: offsetDate(-120),
    end: null,
    agency: '고양시 청년정책과',
    applyUrl: 'https://www.goyang.go.kr/',
  },
  {
    id: 'mock-004',
    title: '청년 월세 한시 특별지원',
    category: '주거',
    region: LEVEL_CENTRAL,
    summary: '무주택 청년의 월세를 최대 12개월간 지원',
    target: '만 19~34세 무주택 청년, 기준중위소득 60% 이하(예시 기준)',
    benefit: '월 최대 20만원 × 12개월(예시 금액)',
    start: offsetDate(-200),
    end: null,
    agency: '국토교통부',
    applyUrl: 'https://www.bokjiro.go.kr/',
  },
  {
    id: 'mock-005',
    title: '청년 전세보증금 반환보증 보증료 지원',
    category: '주거',
    region: LEVEL_GOYANG,
    summary: '전세사기 예방을 위한 반환보증 보증료를 되돌려주는 사업',
    target: '고양시 거주 만 19~39세 무주택 청년 임차인',
    benefit: '납부한 보증료 전액(최대 30만원) 환급(예시 금액)',
    start: offsetDate(-4),
    end: offsetDate(5),
    agency: '고양시 주택과',
    applyUrl: 'https://www.goyang.go.kr/',
  },
  {
    id: 'mock-006',
    title: '청년내일저축계좌 신규 가입',
    category: '금융',
    region: LEVEL_CENTRAL,
    summary: '매월 저축하면 정부가 같은 금액 이상을 얹어주는 자산형성 지원',
    target: '만 19~34세 근로 중인 청년, 소득·재산 기준 충족자(예시 기준)',
    benefit: '본인 저축 10만원 + 정부지원금 최대 30만원 × 36개월(예시 금액)',
    start: offsetDate(-6),
    end: offsetDate(12),
    agency: '보건복지부',
    applyUrl: 'https://www.bokjiro.go.kr/',
  },
  {
    id: 'mock-007',
    title: '고양시 청년 금융교육·부채상담',
    category: '금융',
    region: LEVEL_GOYANG,
    summary: '신용관리·부채조정 1:1 상담과 재무설계 교육을 상시 제공',
    target: '고양시 거주 만 19~39세 청년',
    benefit: '상담 전액 무료, 필요 시 채무조정 기관 연계(예시)',
    start: offsetDate(-60),
    end: null,
    agency: '고양시 청년정책과',
    applyUrl: 'https://www.goyang.go.kr/',
  },
  {
    id: 'mock-008',
    title: '청년 마음건강 바우처',
    category: '복지',
    region: LEVEL_GOYANG,
    summary: '전문 심리상담을 10회까지 저렴하게 받을 수 있는 바우처',
    target: '고양시 거주 만 19~34세 청년(소득 무관, 예시 기준)',
    benefit: '회당 8만원 상당 상담 10회, 자부담 10%(예시 금액)',
    start: offsetDate(-11),
    end: offsetDate(2),
    agency: '고양시 정신건강복지센터',
    applyUrl: 'https://www.goyang.go.kr/',
  },
  {
    id: 'mock-009',
    title: '자립준비청년 자립정착금 지원',
    category: '복지',
    region: LEVEL_GOYANG,
    summary: '보호종료 후 홀로서기를 시작하는 청년에게 정착금을 지원',
    target: '고양시 거주 보호종료 5년 이내 자립준비청년',
    benefit: '자립정착금 1,000만원 및 자립수당 월 50만원(예시 금액)',
    start: offsetDate(-70),
    end: offsetDate(-6),
    agency: '고양시 아동청소년과',
    applyUrl: 'https://www.goyang.go.kr/',
  },
  {
    id: 'mock-010',
    title: '고양시 청년 문화패스',
    category: '교육·문화',
    region: LEVEL_GOYANG,
    summary: '공연·전시 관람료를 연간 포인트로 지원하는 문화누리 사업',
    target: '고양시 거주 만 19~24세 청년',
    benefit: '연 15만원 상당 문화 포인트(예시 금액)',
    start: offsetDate(-3),
    end: offsetDate(40),
    agency: '고양시 문화예술과',
    applyUrl: 'https://www.goyang.go.kr/',
  },
  {
    id: 'mock-011',
    title: '청년 디지털 직무역량 교육',
    category: '교육·문화',
    region: LEVEL_GYEONGGI,
    summary: '데이터 분석·웹개발 등 실무 중심 무료 부트캠프',
    target: '고양시 거주 만 19~39세 청년(전공 무관)',
    benefit: '수강료 전액 지원, 교육기간 중 훈련장려금 월 20만원(예시 금액)',
    start: offsetDate(-20),
    end: offsetDate(18),
    agency: '경기도일자리재단',
    applyUrl: 'https://www.jobaba.net/',
  },
];

export default mockPolicies;
