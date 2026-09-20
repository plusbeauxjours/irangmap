import type { VenueAttrs } from "./venues";

/** 픽토그램 타일용 압축 값. value가 null이면 "미확인". sub는 원문(툴팁·상세). */
export interface Fact {
  key: "age" | "fee" | "guardian" | "socks" | "reservation" | "parking";
  label: string;
  value: string | null;
  sub?: string | null;
  href?: string | null;
}

export function compactFacts(a: VenueAttrs | null | undefined): Fact[] {
  let age = a?.age_range ? a.age_range.replace(/\s*\(연나이\)\s*$/, "") : null;
  if (age && age.length > 12) age = "안내 있음";
  let fee: string | null = null;
  if (a?.child_fee_krw === 0) fee = "무료";
  else if (typeof a?.child_fee_krw === "number") fee = `${a.child_fee_krw.toLocaleString()}원`;
  else if (a?.child_fee) fee = a.child_fee.length > 12 ? "요금 안내" : a.child_fee;

  let guardian: string | null = null;
  if (a?.guardian_fee === "보호자 무료") guardian = "무료";
  else if (a?.guardian_fee) guardian = /무료/.test(a.guardian_fee) ? "일부 무료" : "안내 있음";

  let parking: string | null = null;
  if (a?.parking) {
    const t = a.parking;
    if (/불가|없음/.test(t)) parking = "불가";
    else if (/무료/.test(t) && !/유료|부과|원/.test(t)) parking = "무료";
    else if (/무료/.test(t)) parking = "일부 무료";
    else parking = "있음";
  }

  return [
    { key: "age", label: "이용 연령", value: age, sub: a?.age_range ? "연나이 기준" : null },
    { key: "fee", label: "아동 요금", value: fee, sub: a?.child_fee ?? null },
    { key: "guardian", label: "보호자", value: guardian, sub: a?.guardian_fee ?? null },
    { key: "socks", label: "양말", value: a?.socks ? (/필수|착용/.test(a.socks) ? "필수" : "안내 있음") : null, sub: a?.socks ?? null },
    { key: "reservation", label: "예약", value: a?.reservation_url ? "온라인" : a?.reservation ? "안내 있음" : null, sub: a?.reservation ?? null, href: a?.reservation_url ?? null },
    { key: "parking", label: "주차", value: parking, sub: a?.parking ?? null },
  ];
}
