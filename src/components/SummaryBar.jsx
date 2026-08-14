'use client';

/**
 * 상단 요약: 전체 정책 수 / 마감임박 수 / 관심저장 수
 * 숫자는 회색조, '마감임박'만 빨강.
 */

export default function SummaryBar({ total, urgentCount, bookmarkCount }) {
  const items = [
    { label: '전체 정책', value: total, accent: false },
    { label: '마감임박', value: urgentCount, accent: true },
    { label: '관심저장', value: bookmarkCount, accent: false },
  ];

  return (
    <dl className="grid grid-cols-3 divide-x divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
      {items.map((item) => (
        <div key={item.label} className="px-3 py-3 text-center">
          <dt className="text-xs font-medium text-neutral-500">{item.label}</dt>
          <dd
            className={`mt-0.5 text-2xl font-bold tabular-nums ${
              item.accent && item.value > 0 ? 'text-red-600' : 'text-neutral-900'
            }`}
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
