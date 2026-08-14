'use client';

/**
 * 정책 상세 모달
 * ------------------------------------------------------------------
 * 보여주는 것: 대상 · 지원내용 · 기간 · 담당부서 · 신청링크
 * 접근성: ESC로 닫기, 열릴 때 닫기 버튼에 포커스, 배경 스크롤 잠금,
 *         Tab이 모달 밖으로 나가지 않도록 순환시킨다.
 */

import { useCallback, useEffect, useRef } from 'react';
import { Bookmark, Building2, CalendarDays, ExternalLink, MapPin, X } from 'lucide-react';
import { StatusBadge, NewBadge, Tag } from './Badges';
import { formatPeriod } from '@/lib/policy';

const FOCUSABLE =
  'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

export default function PolicyModal({ policy, now, bookmarked, onToggleBookmark, onClose }) {
  const panelRef = useRef(null);
  const closeButtonRef = useRef(null);

  const handleKeyDown = useCallback(
    (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      // 포커스가 모달 밖으로 새지 않게 순환
      const nodes = panelRef.current?.querySelectorAll(FOCUSABLE);
      if (!nodes || nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  useEffect(() => {
    closeButtonRef.current?.focus();
    document.body.classList.add('scroll-lock');
    return () => document.body.classList.remove('scroll-lock');
  }, []);

  if (!policy) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-neutral-900/60 p-0 sm:items-center sm:p-4"
      onClick={onClose}
      onKeyDown={handleKeyDown}
      role="presentation"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="policy-modal-title"
        onClick={(event) => event.stopPropagation()}
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
      >
        {/* 헤더 (검정 바) */}
        <div className="sticky top-0 flex items-start justify-between gap-3 bg-neutral-900 px-5 py-4 text-white">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              <StatusBadge policy={policy} now={now} />
              <NewBadge policy={policy} now={now} />
            </div>
            <h2 id="policy-modal-title" className="text-lg font-bold leading-snug">
              {policy.title}
            </h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="shrink-0 rounded p-1.5 text-neutral-300 transition hover:bg-neutral-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="px-5 py-5">
          <div className="mb-4 flex flex-wrap gap-1.5">
            <Tag>{policy.category}</Tag>
            <Tag>{policy.region}</Tag>
          </div>

          <p className="mb-5 text-sm leading-relaxed text-neutral-700">{policy.summary}</p>

          <dl className="divide-y divide-neutral-200 border-y border-neutral-200 text-sm">
            <Row label="지원 대상">{policy.target}</Row>
            <Row label="지원 내용">{policy.benefit}</Row>
            <Row label="접수 기간" icon={<CalendarDays size={14} aria-hidden="true" />}>
              <span className="tabular-nums">{formatPeriod(policy)}</span>
            </Row>
            <Row label="담당 부서" icon={<Building2 size={14} aria-hidden="true" />}>
              {policy.agency}
            </Row>
            <Row label="지역" icon={<MapPin size={14} aria-hidden="true" />}>
              {policy.region}
            </Row>
          </dl>

          {/* 액션 — 빨강을 쓰는 두 자리(신청 버튼, 관심저장) */}
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <a
              href={policy.applyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2"
            >
              신청 페이지로 이동
              <ExternalLink size={16} aria-hidden="true" />
            </a>
            <button
              type="button"
              onClick={() => onToggleBookmark(policy.id)}
              aria-pressed={bookmarked}
              className={[
                'inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-bold transition',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                bookmarked
                  ? 'border-red-600 text-red-600 hover:bg-red-50 focus-visible:ring-red-600'
                  : 'border-neutral-300 text-neutral-700 hover:bg-neutral-100 focus-visible:ring-neutral-900',
              ].join(' ')}
            >
              <Bookmark
                size={16}
                fill={bookmarked ? 'currentColor' : 'none'}
                aria-hidden="true"
              />
              {bookmarked ? '관심저장됨' : '관심저장'}
            </button>
          </div>

          <p className="mt-4 text-xs leading-relaxed text-neutral-400">
            신청 전 반드시 담당 부서의 원문 공고에서 자격요건과 마감일을 다시 확인하세요.
          </p>
        </div>
      </div>
    </div>
  );
}

function Row({ label, icon, children }) {
  return (
    <div className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-[7rem_1fr] sm:gap-3">
      <dt className="flex items-center gap-1.5 font-semibold text-neutral-500">
        {icon}
        {label}
      </dt>
      <dd className="leading-relaxed text-neutral-800">{children}</dd>
    </div>
  );
}
