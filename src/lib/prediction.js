// 0일차 예측 관련 공통 규칙
export const CONFIDENCE = [
  { v: 'sure', t: '확실해요' },
  { v: 'half', t: '반반' },
  { v: 'guess', t: '찍었어요' },
];
export const confLabel = (v) => CONFIDENCE.find((c) => c.v === v)?.t || '';

export function normalizePrediction(p) {
  return { minutes: null, apps: [], topics: [], topicsUnknown: false, confidence: {}, ...(p || {}) };
}

// 예측 완료: 시간 + 앱 3개 + (주제 3개 또는 '잘 모르겠어요')
export function isPredictionDone(p) {
  const n = normalizePrediction(p);
  return n.minutes != null && n.apps.length === 3 && (n.topics.length === 3 || n.topicsUnknown);
}
