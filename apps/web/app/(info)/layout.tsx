import Link from "next/link";
import type { ReactNode } from "react";

import { ArrowLeft, Blocks } from "@/components/icons";

/** 소개·약관·개인정보처리방침 같은 정적 문서 페이지의 공통 틀. */
export default function InfoLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-neutral-200">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Link href="/" className="inline-flex items-center gap-2 font-bold text-neutral-900">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <Blocks size={16} aria-hidden="true" />
            </span>
            아이랑맵
          </Link>
          <Link href="/" className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900">
            <ArrowLeft size={14} /> 지도로
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-8 text-[15px] leading-7 text-neutral-800 [&_h1]:mb-2 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:tracking-tight [&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1 [&_a]:underline [&_a]:underline-offset-2 [&_table]:my-3 [&_table]:w-full [&_table]:text-sm [&_th]:border-b [&_th]:border-neutral-200 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_td]:border-b [&_td]:border-neutral-100 [&_td]:py-2 [&_td]:align-top">
        {children}
      </main>
      <footer className="mx-auto max-w-2xl px-4 pb-10 text-xs text-neutral-500">
        <nav className="flex flex-wrap gap-3">
          <Link href="/about">소개·데이터 출처</Link>
          <Link href="/terms">이용약관</Link>
          <Link href="/privacy">개인정보처리방침</Link>
          <a href="mailto:plusbeauxjours@gmail.com">문의</a>
        </nav>
        <p className="mt-2">© 2026 아이랑맵. 지도 © Kakao. 공공데이터: 행정안전부·서울특별시.</p>
      </footer>
    </div>
  );
}
