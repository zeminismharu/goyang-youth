'use client';

/**
 * 관심저장(북마크) 훅
 * ------------------------------------------------------------------
 * 정책 id 목록을 localStorage에 저장해 새로고침해도 유지되게 한다.
 *
 * 주의: localStorage는 서버에 없다. 서버 렌더 결과와 클라이언트 첫 렌더가
 * 달라지면 하이드레이션 경고가 나므로, 값은 반드시 useEffect(마운트 후)에서
 * 읽는다. 읽기 전 상태는 ready=false 로 알린다.
 */

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'goyang-youth-policy:bookmarks';

export function useBookmarks() {
  const [ids, setIds] = useState([]);
  const [ready, setReady] = useState(false);

  // 마운트 후 1회 읽기
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) {
        setIds(parsed.filter((id) => typeof id === 'string'));
      }
    } catch {
      // 사생활 보호 모드 등에서 접근이 막힐 수 있다. 저장 없이 계속 동작.
    }
    setReady(true);
  }, []);

  // 값이 바뀔 때마다 저장 (첫 읽기 전에는 저장하지 않는다)
  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    } catch {
      // 저장 실패는 조용히 무시 (기능이 죽을 정도의 문제는 아님)
    }
  }, [ids, ready]);

  const toggle = useCallback((id) => {
    if (!id) return;
    setIds((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
  }, []);

  const has = useCallback((id) => ids.includes(id), [ids]);

  const clear = useCallback(() => setIds([]), []);

  return { ids, count: ids.length, ready, toggle, has, clear };
}

export default useBookmarks;
