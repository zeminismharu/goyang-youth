'use client';

/**
 * 배지 모음
 * ------------------------------------------------------------------
 * 디자인 규칙: 배지는 전부 회색조.
 * 딱 하나의 예외가 '마감임박'이고, 여기서만 red-600을 쓴다.
 */

import { statusOf, isNew } from '@/lib/policy';

/** 회색조 기본 배지 (카테고리·지역·신규 등) */
export function Tag({ children, className = '' }) {
  return (
    <span
      className={`inline-flex items-center rounded border border-neutral-300 bg-neutral-50 px-2 py-0.5 text-xs font-medium text-neutral-600 ${className}`}
    >
      {children}
    </span>
  );
}

/**
 * 상태 배지: 상시접수 / D-n / 마감임박 / 접수마감
 * 마감임박만 빨강.
 */
export function StatusBadge({ policy, now }) {
  const status = statusOf(policy, now);

  const styles = {
    urgent: 'border-red-600 bg-red-600 text-white',
    open: 'border-neutral-900 bg-neutral-900 text-white',
    always: 'border-neutral-300 bg-white text-neutral-600',
    closed: 'border-neutral-200 bg-neutral-100 text-neutral-400',
  };

  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-semibold tabular-nums ${styles[status.kind]}`}
    >
      {status.label}
    </span>
  );
}

/** 개설 14일 이내면 '신규' (회색조) */
export function NewBadge({ policy, now }) {
  if (!isNew(policy, now)) return null;
  return <Tag className="border-neutral-400 text-neutral-700">신규</Tag>;
}
