import { venueKey } from "./venue-key";
import type { Venue, VenueAttrs } from "./venues";

export interface Override {
  venueKey: string;
  attrs: Record<string, string>;
  source: "owner" | "user";
  closed: number;
  updatedAt: string;
}

const LABEL: Record<Override["source"], string> = { owner: "사업자 확인", user: "이용자 제보(검토 완료)" };

/** 승인된 제보·사업자 값을 업소에 덮어쓴다. 폐업 확인된 업소는 목록에서 뺀다. */
export function applyOverrides(venues: Venue[], overrides: Override[]): Venue[] {
  if (overrides.length === 0) return venues;
  const byKey = new Map(overrides.map((o) => [o.venueKey, o]));
  const out: Venue[] = [];
  for (const v of venues) {
    const o = byKey.get(venueKey(v));
    if (!o) {
      out.push(v);
      continue;
    }
    if (o.closed) continue;
    const base: VenueAttrs = v.attrs ?? { source: o.source, source_label: LABEL[o.source], observed_at: o.updatedAt.slice(0, 10) };
    const attrs: VenueAttrs = {
      ...base,
      ...(o.attrs as Partial<VenueAttrs>),
      source: o.source,
      source_label: LABEL[o.source],
      scope: "store",
      observed_at: o.updatedAt.slice(0, 10),
    };
    out.push({ ...v, attrs, sources: v.sources.includes(`override:${o.source}`) ? v.sources : [...v.sources, `override:${o.source}`] });
  }
  return out;
}
