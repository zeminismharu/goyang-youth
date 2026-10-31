// 날짜 계산: 0일차 = 시작한 날. 체크인은 "그날 밤에 오늘 것"을 기록.
// 새벽 4시 전까지는 전날로 칩니다 (자정 넘어 기록해도 '오늘' 기록이 되도록).
export const TOTAL_DAYS = 7;

export const DAY_CUTOFF_HOUR = 4;

export function todayStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toUTC(str) {
  const [y, m, d] = str.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function diffDays(fromStr, toStr) {
  return Math.round((toUTC(toStr) - toUTC(fromStr)) / 86400000);
}

export function dateOfDay(startDate, n) {
  const [y, m, d] = startDate.split('-').map(Number);
  return todayStr(new Date(y, m - 1, d + n));
}

export function formatKDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  const w = '일월화수목금토'[new Date(y, m - 1, d).getDay()];
  return `${m}월 ${d}일 (${w})`;
}

// 새벽 4시 기준의 '오늘'
export function logicalToday(now = new Date()) {
  return todayStr(new Date(now.getTime() - DAY_CUTOFF_HOUR * 3600000));
}

// 오늘이 몇 일차인지 (0 = 시작일)
export function currentDay(startDate, today = logicalToday()) {
  return diffDays(startDate, today);
}

// 각 일차의 상태: done(기록함) / due(오늘 밤 기록할 차례) / missed(지났는데 비어 있음) / future(아직)
export function dayStatuses(startDate, doneDays, today = logicalToday()) {
  const cur = currentDay(startDate, today);
  const target = cur; // 오늘 밤에 기록할 날 = 오늘
  const list = [];
  for (let n = 1; n <= TOTAL_DAYS; n++) {
    let status;
    if (doneDays.has(n)) status = 'done';
    else if (n === target) status = 'due';
    else if (n < target) status = 'missed';
    else status = 'future';
    list.push({ n, date: dateOfDay(startDate, n), status });
  }
  return { cur, target, list };
}
