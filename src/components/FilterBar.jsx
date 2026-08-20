'use client';

/**
 * 검색 · 카테고리 · 운영주체 · 정렬 · 관심만 보기
 * ------------------------------------------------------------------
 * 칩(chip)은 전부 회색조. 선택된 칩만 검정 배경.
 * '관심만 보기'는 관심저장 기능이라 활성 시 빨강을 허용한다.
 */

import { Archive, Bookmark, Search, X } from 'lucide-react';
import { CATEGORY_FILTERS, REGION_FILTERS, SORT_OPTIONS } from '@/lib/policy';

function Chip({ active, children, ...props }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={[
        'shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2',
        active
          ? 'border-neutral-900 bg-neutral-900 text-white'
          : 'border-neutral-300 bg-white text-neutral-600 hover:border-neutral-500 hover:text-neutral-900',
      ].join(' ')}
      {...props}
    >
      {children}
    </button>
  );
}

export default function FilterBar({
  query,
  onQueryChange,
  category,
  onCategoryChange,
  region,
  onRegionChange,
  sort,
  onSortChange,
  bookmarkOnly,
  onBookmarkOnlyChange,
  showClosed,
  onShowClosedChange,
}) {
  return (
    <div className="space-y-3">
      {/* 검색 */}
      <div className="relative">
        <Search
          size={18}
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
        />
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="정책명, 지원내용, 대상으로 검색"
          aria-label="정책 검색"
          className="w-full rounded-lg border border-neutral-300 bg-white py-2.5 pl-10 pr-10 text-sm text-neutral-900 placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900"
        />
        {query && (
          <button
            type="button"
            onClick={() => onQueryChange('')}
            aria-label="검색어 지우기"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900"
          >
            <X size={16} aria-hidden="true" />
          </button>
        )}
      </div>

      {/* 카테고리 */}
      <div>
        <h2 className="sr-only">카테고리 필터</h2>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {CATEGORY_FILTERS.map((item) => (
            <Chip
              key={item}
              active={category === item}
              onClick={() => onCategoryChange(item)}
            >
              {item}
            </Chip>
          ))}
        </div>
      </div>

      {/* 지역 */}
      <div>
        <h2 className="sr-only">운영주체 필터</h2>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {REGION_FILTERS.map((item) => (
            <Chip key={item} active={region === item} onClick={() => onRegionChange(item)}>
              {item}
            </Chip>
          ))}
        </div>
      </div>

      {/* 정렬 + 토글들 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <label htmlFor="sort" className="text-xs font-medium text-neutral-500">
            정렬
          </label>
          <select
            id="sort"
            value={sort}
            onChange={(event) => onSortChange(event.target.value)}
            className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* 접수마감 포함 — 기본은 꺼짐(마감된 공고는 숨김). 회색조로만. */}
          <button
            type="button"
            onClick={() => onShowClosedChange(!showClosed)}
            aria-pressed={showClosed}
            title="이미 마감된 공고도 함께 보기"
            className={[
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2',
              showClosed
                ? 'border-neutral-900 bg-neutral-900 text-white'
                : 'border-neutral-300 bg-white text-neutral-600 hover:border-neutral-500 hover:text-neutral-900',
            ].join(' ')}
          >
            <Archive size={15} aria-hidden="true" />
            접수마감 포함
          </button>

          <button
            type="button"
            onClick={() => onBookmarkOnlyChange(!bookmarkOnly)}
            aria-pressed={bookmarkOnly}
            className={[
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
              bookmarkOnly
                ? 'border-red-600 bg-white text-red-600 focus-visible:ring-red-600'
                : 'border-neutral-300 bg-white text-neutral-600 hover:border-neutral-500 hover:text-neutral-900 focus-visible:ring-neutral-900',
            ].join(' ')}
          >
            <Bookmark
              size={15}
              fill={bookmarkOnly ? 'currentColor' : 'none'}
              aria-hidden="true"
            />
            관심만 보기
          </button>
        </div>
      </div>
    </div>
  );
}
