import type { ReactNode } from "react";

/**
 * 수집한 자유 텍스트(요금·유의사항·연령 규칙)를 읽기 쉽게 그린다.
 * - 줄바꿈·글머리(-, *, ·, ①…)·쉼표로 이어진 요금 항목을 줄 단위로 나눠 목록으로
 * - "아동:" 같은 앞머리 라벨과 금액(16,800원)은 굵게
 */
const BULLET = /^\s*(?:[-*•·▪◦※★☆]|[①-⑳]|\d+[.)]|\(\d+\))\s*/;
const AMOUNT = /(\d{1,3}(?:,\d{3})+\s*원|\d{1,2}(?:개월|세)\b|\d{2,3}\s*cm)/g;
const LABEL = /^([가-힣A-Za-z/·\s]{1,12}):\s*/;

function splitLines(text: string): string[] {
  const raw = text.replace(/\r/g, "").split("\n").map((l) => l.trim()).filter(Boolean);
  const out: string[] = [];
  for (const line of raw) {
    // 금액이 여러 개 쉼표로 이어진 한 줄(프랜차이즈 요금표)은 항목별로 나눈다
    const amounts = line.match(/원/g)?.length ?? 0;
    if (amounts >= 3 && line.includes(",") && !BULLET.test(line)) {
      out.push(...line.split(/,\s*(?=\[|[가-힣A-Za-z(])/).map((s) => s.trim()).filter(Boolean));
    } else {
      out.push(line);
    }
  }
  return out;
}

function emphasize(line: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const label = line.match(LABEL);
  let rest = line;
  if (label) {
    nodes.push(<strong key="label" className="font-semibold text-neutral-900">{label[1]}:</strong>, " ");
    rest = line.slice(label[0].length);
  }
  let last = 0;
  for (const m of rest.matchAll(AMOUNT)) {
    const i = m.index ?? 0;
    if (i > last) nodes.push(rest.slice(last, i));
    nodes.push(<strong key={`a${i}`} className="font-semibold text-neutral-900">{m[0]}</strong>);
    last = i + m[0].length;
  }
  if (last < rest.length) nodes.push(rest.slice(last));
  return nodes;
}

export function RichText({ text, className = "" }: { text: string; className?: string }) {
  const lines = splitLines(text);
  if (lines.length <= 1) return <p className={`text-xs leading-relaxed text-neutral-600 ${className}`}>{emphasize(lines[0] ?? "")}</p>;
  return (
    <ul className={`space-y-1 text-xs leading-relaxed text-neutral-600 ${className}`}>
      {lines.map((l, i) => {
        const bullet = BULLET.test(l);
        const body = l.replace(BULLET, "");
        return (
          <li key={i} className={bullet ? "flex gap-1.5" : ""}>
            {bullet && <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-neutral-400" aria-hidden="true" />}
            <span>{emphasize(body)}</span>
          </li>
        );
      })}
    </ul>
  );
}
