import type { Venue } from "./venues";

/** 재내보내기 때 바뀌는 순번 id 대신, 첫 공공데이터 출처 키(예: playground:1008196)를 업소 식별자로 쓴다. */
export function venueKey(v: Pick<Venue, "sources">): string {
  return v.sources[0] ?? "";
}
