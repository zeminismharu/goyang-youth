'use client';

/**
 * 메인 화면
 * ------------------------------------------------------------------
 * 이 앱의 임무: "마감 놓치지 말고 지금 신청".
 * 그래서 기본 정렬은 마감임박순이고, 모든 카드에 D-day가 붙는다.
 *
 * 데이터는 /api/policies(서버 프록시)에서만 가져온다.
 * 인증키는 서버에만 있으므로 이 파일에서는 키를 알 수도, 알 필요도 없다.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2, SearchX } from 'lucide-react';
import FilterBar from '@/components/FilterBar';
import PolicyCard from '@/components/PolicyCard';
import PolicyModal from '@/components/PolicyModal';
import SummaryBar from '@/components/SummaryBar';
import useBookmarks from '@/lib/useBookmarks';
import {
  compareByDeadline,
  compareByLatest,
  isUrgent,
  matchesCategory,
  matchesQuery,
  matchesRegion,
  statusOf,
} from '@/lib/policy';

export default function Home() {
  const [policies, setPolicies] = useState([]);
  const [meta, setMeta] = useState({ source: null, notice: null, reason: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('전체');
  const [region, setRegion] = useState('전체');
  const [sort, setSort] = useState('deadline'); // 기본값: 마감임박순
  const [bookmarkOnly, setBookmarkOnly] = useState(false);
  // 접수마감된 정책은 기본으로 숨긴다. 이 앱의 임무는 "지금 신청할 수 있는" 것이라
  // 이미 끝난 공고가 목록을 채우면 방해가 된다.
  const [showClosed, setShowClosed] = useState(false);
  const [selected, setSelected] = useState(null);

  const bookmarks = useBookmarks();

  // D-day 계산 기준 시각. 렌더마다 바뀌면 정렬이 흔들리므로 한 번만 만든다.
  const now = useMemo(() => new Date(), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch('/api/policies');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        setPolicies(Array.isArray(data.policies) ? data.policies : []);
        setMeta({ source: data.source, notice: data.notice, reason: data.reason });
      } catch (err) {
        if (!cancelled) setError(err?.message || '정책을 불러오지 못했습니다.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const { visible, hiddenClosedCount } = useMemo(() => {
    const matched = policies.filter(
      (policy) =>
        matchesQuery(policy, query) &&
        matchesCategory(policy, category) &&
        matchesRegion(policy, region) &&
        (!bookmarkOnly || bookmarks.has(policy.id)),
    );

    const closedCount = matched.filter((p) => statusOf(p, now).kind === 'closed').length;
    const list = showClosed
      ? matched
      : matched.filter((p) => statusOf(p, now).kind !== 'closed');

    const sorted = [...list];
    sorted.sort(sort === 'latest' ? compareByLatest : (a, b) => compareByDeadline(a, b, now));

    return { visible: sorted, hiddenClosedCount: showClosed ? 0 : closedCount };
  }, [policies, query, category, region, bookmarkOnly, bookmarks, sort, now, showClosed]);

  // 요약은 필터와 무관하게 "전체" 기준으로 보여준다.
  const urgentCount = useMemo(
    () => policies.filter((policy) => isUrgent(policy, now)).length,
    [policies, now],
  );

  const handleToggleBookmark = useCallback((id) => bookmarks.toggle(id), [bookmarks]);

  const isMock = meta.source === 'mock';

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* 헤더 — 검정 바, 흰 글씨 */}
      <header className="sticky top-0 z-40 bg-neutral-900 text-white">
        <div className="mx-auto max-w-3xl px-4 py-4">
          <h1 className="text-lg font-bold tracking-tight">고양시 청년정책</h1>
          <p className="mt-0.5 text-xs text-neutral-400">
            지금 신청할 수 있는 정책을 마감임박순으로
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-16 pt-4">
        <div className="mb-4">
          <SummaryBar
            total={policies.length}
            urgentCount={urgentCount}
            bookmarkCount={bookmarks.count}
          />
        </div>

        <div className="mb-5">
          <FilterBar
            query={query}
            onQueryChange={setQuery}
            category={category}
            onCategoryChange={setCategory}
            region={region}
            onRegionChange={setRegion}
            sort={sort}
            onSortChange={setSort}
            bookmarkOnly={bookmarkOnly}
            onBookmarkOnlyChange={setBookmarkOnly}
            showClosed={showClosed}
            onShowClosedChange={setShowClosed}
          />
        </div>

        {/* 결과 건수 */}
        {!loading && !error && (
          <p className="mb-2 text-xs text-neutral-500" aria-live="polite">
            {visible.length}건
            {hiddenClosedCount > 0 && (
              <span className="text-neutral-400"> · 접수마감 {hiddenClosedCount}건 숨김</span>
            )}
          </p>
        )}

        {loading && (
          <div className="flex items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-white py-16 text-sm text-neutral-500">
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            정책을 불러오는 중…
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-neutral-300 bg-white p-4 text-sm text-neutral-700">
            <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-semibold">정책을 불러오지 못했습니다.</p>
              <p className="mt-1 text-neutral-500">{error}</p>
            </div>
          </div>
        )}

        {!loading && !error && visible.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-neutral-200 bg-white py-16 text-center text-sm text-neutral-500">
            <SearchX size={24} className="text-neutral-400" aria-hidden="true" />
            <p className="font-medium text-neutral-700">조건에 맞는 정책이 없습니다.</p>
            <p className="text-xs">검색어나 필터를 바꿔보세요.</p>
          </div>
        )}

        {!loading && !error && visible.length > 0 && (
          <ul className="space-y-3">
            {visible.map((policy) => (
              <li key={policy.id}>
                <PolicyCard
                  policy={policy}
                  now={now}
                  bookmarked={bookmarks.has(policy.id)}
                  onToggleBookmark={handleToggleBookmark}
                  onOpen={setSelected}
                />
              </li>
            ))}
          </ul>
        )}

        {/* 하단 고지 — 샘플 데이터임을 반드시 밝힌다 */}
        <footer className="mt-10 space-y-2 border-t border-neutral-200 pt-5 text-xs leading-relaxed text-neutral-500">
          {isMock && (
            <p className="rounded border border-neutral-300 bg-white p-3 font-medium text-neutral-700">
              ⚠️ 지금 보이는 정책은 <strong>예시(샘플) 데이터</strong>입니다. 실제 공고 내용·금액·기간과
              다를 수 있으니 신청 전 담당 부서의 원문 공고를 반드시 확인하세요.
              {meta.reason ? (
                <span className="mt-1 block font-normal text-neutral-500">({meta.reason})</span>
              ) : null}
            </p>
          )}
          <p>데이터 출처: 온통청년(youthcenter.go.kr) 청년정책 OPEN API · 고양시</p>
          <p>본 서비스는 공식 서비스가 아니며, 최종 자격요건과 마감일은 원문 공고를 따릅니다.</p>
        </footer>
      </main>

      {selected && (
        <PolicyModal
          policy={selected}
          now={now}
          bookmarked={bookmarks.has(selected.id)}
          onToggleBookmark={handleToggleBookmark}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
