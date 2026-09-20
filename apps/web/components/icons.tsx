import type { SVGProps } from "react";
import { Activity, Blocks } from "lucide-react";

export { Activity, Blocks };

import type { Category } from "@/lib/venues";

export {
  ArrowLeft,
  Baby,
  BadgeCheck,
  Building2,
  CalendarCheck,
  Camera,
  ChevronDown,
  ChevronUp,
  CircleCheck,
  CircleHelp,
  CircleParking,
  Clock,
  Coins,
  ExternalLink,
  Home,
  Info,
  MapPin,
  Phone,
  Search,
  Users,
} from "lucide-react";

/** lucide에 양말이 없어 직접 그린다 (24 grid, stroke 2 — lucide와 같은 규격). */
export function SockIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M8 3h8v9.5l3.4 2.6a3.4 3.4 0 0 1 .4 5l-.4.4a3.4 3.4 0 0 1-4.7.2L8 14.6V3z" />
      <path d="M8 7h8" />
    </svg>
  );
}

export const CATEGORY_STYLE: Record<Category, { Icon: typeof Blocks; bg: string; fg: string; dot: string }> = {
  kids_cafe: { Icon: Blocks, bg: "bg-brand-50", fg: "text-brand-600", dot: "var(--color-brand-600)" },
  trampoline_park: { Icon: Activity, bg: "bg-trampoline-50", fg: "text-trampoline-600", dot: "var(--color-trampoline-600)" },
};

export function CategoryIcon({ category, size = 18, className = "" }: { category: Category; size?: number; className?: string }) {
  const { Icon, bg, fg } = CATEGORY_STYLE[category];
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full ${bg} ${fg} ${className}`} style={{ width: size + 14, height: size + 14 }}>
      <Icon size={size} aria-hidden="true" />
    </span>
  );
}
