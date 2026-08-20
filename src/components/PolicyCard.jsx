'use client';

/**
 * 정책 카드
 * ------------------------------------------------------------------
 * 디자인 규칙
 *  - 기본은 흑·백·회색. 카테고리/지역 태그는 회색조.
 *  - 마감임박 카드만 왼쪽에 빨간 세로선(border-l-4 border-red-600).
 *  - 빨강을 쓰는 곳: 마감임박 배지·세로선, 관심저장(저장된 상태) 뿐.
 *  - 카드 전체가 클릭 대상이지만 키보드로도 열 수 있어야 한다(Enter/Space).
 */

import { Bookmark, Building2, CalendarDays, MapPin } from 'lucide-react';
import { StatusBadge, NewBadge, Tag } from './Badges';
import { formatPeriod, statusOf } from '@/lib/policy';

export default function PolicyCard({ policy, now, bookmarked, onToggleBookmark, onOpen }) {
  const status = statusOf(policy, now);
  const urgent = status.kind === 'urgent';
  const closed = status.kind === 'closed';

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen(policy);
    }
  };

  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={`${policy.title} 상세 보기`}
      onClick={() => onOpen(policy)}
      onKeyDown={handleKeyDown}
      className={[
        'group relative cursor-pointer rounded-lg border border-l-4 bg-white p-4 text-left transition',
        'hover:border-neutral-400 hover:shadow-sm',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2',
        urgent ? 'border-l-red-600 border-neutral-200' : 'border-neutral-200 border-l-neutral-200',
        closed ? 'opacity-60' : '',
      ].join(' ')}
    >
      {/* 관심저장 토글 — 카드 클릭(모달 열기)과 겹치지 않도록 이벤트 전파를 막는다 */}
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onToggleBookmark(policy.id);
        }}
        aria-pressed={bookmarked}
        aria-label={bookmarked ? '관심저장 해제' : '관심저장'}
        title={bookmarked ? '관심저장 해제' : '관심저장'}
        className="absolute right-3 top-3 rounded p-1.5 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900"
      >
        <Bookmark
          size={18}
          className={bookmarked ? 'text-red-600' : ''}
          fill={bookmarked ? 'currentColor' : 'none'}
          aria-hidden="true"
        />
      </button>

      {/* 상태 배지 줄 */}
      <div className="mb-2 flex flex-wrap items-center gap-1.5 pr-10">
        <StatusBadge policy={policy} now={now} />
        <NewBadge policy={policy} now={now} />
        <Tag>{policy.category}</Tag>
      </div>

      <h3 className="line-clamp-2 pr-8 text-base font-bold leading-snug text-neutral-900">
        {policy.title}
      </h3>

      <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-neutral-600">
        {policy.summary}
      </p>

      {/* 메타 정보 — 아이콘 포함 전부 회색조 */}
      <dl className="mt-3 space-y-1 text-xs text-neutral-500">
        <div className="flex items-center gap-1.5">
          <dt className="sr-only">운영주체</dt>
          <MapPin size={13} aria-hidden="true" className="shrink-0" />
          <dd>{policy.region}</dd>
        </div>
        <div className="flex items-center gap-1.5">
          <dt className="sr-only">접수기간</dt>
          <CalendarDays size={13} aria-hidden="true" className="shrink-0" />
          <dd className="tabular-nums">{formatPeriod(policy)}</dd>
        </div>
        <div className="flex items-center gap-1.5">
          <dt className="sr-only">담당부서</dt>
          <Building2 size={13} aria-hidden="true" className="shrink-0" />
          <dd>{policy.agency}</dd>
        </div>
      </dl>
    </article>
  );
}
