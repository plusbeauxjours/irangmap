"use client";

import { useEffect, useState } from "react";

import type { ReviewItem } from "@/lib/reviews";
import { reviewQuery, type Venue } from "@/lib/venues";

import { ExternalLink } from "./icons";

/** 상세 패널의 후기 미리보기 — 카카오(다음) 검색 결과 링크만 보여주고 저장하지 않는다. */
export function ReviewPreview({ venue }: { venue: Venue }) {
  const [state, setState] = useState<{ loading: boolean; items: ReviewItem[] }>({ loading: true, items: [] });
  useEffect(() => {
    let cancelled = false;
    setState({ loading: true, items: [] });
    const q = reviewQuery(venue);
    fetch(`/api/reviews?q=${encodeURIComponent(q)}&name=${encodeURIComponent(venue.name)}`)
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((j: { items?: ReviewItem[] }) => !cancelled && setState({ loading: false, items: j.items ?? [] }))
      .catch(() => !cancelled && setState({ loading: false, items: [] }));
    return () => {
      cancelled = true;
    };
  }, [venue]);

  if (state.loading) return <p className="text-xs text-neutral-400">후기 찾는 중…</p>;
  if (state.items.length === 0) return <p className="text-xs text-neutral-500">검색된 후기가 없어요. 위의 네이버 블로그 후기 링크에서 직접 찾아보세요.</p>;
  return (
    <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
      {state.items.map((it) => (
        <li key={it.url}>
          <a href={it.url} target="_blank" rel="noopener noreferrer" className="block px-3 py-2 hover:bg-neutral-50">
            <p className="flex items-start gap-1 text-sm font-medium leading-snug text-neutral-900">
              <span className="min-w-0 flex-1 truncate">{it.title}</span>
              <ExternalLink size={12} className="mt-1 shrink-0 text-neutral-400" />
            </p>
            <p className="mt-0.5 line-clamp-2 text-xs text-neutral-500">{it.snippet}</p>
            <p className="mt-1 text-[11px] text-neutral-400">
              {it.kind === "cafe" ? "카페" : "블로그"} · {it.source} · {it.date}
              {it.sponsored && <span className="ml-1 rounded bg-neutral-100 px-1 text-neutral-500">협찬 가능성</span>}
            </p>
          </a>
        </li>
      ))}
    </ul>
  );
}
