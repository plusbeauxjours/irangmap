import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://irangmap.vercel.app"),
  openGraph: { type: "website", locale: "ko_KR", siteName: "아이랑맵" },
  title: "아이랑맵 — 전국 키즈카페 지도",
  description: "아이랑 갈 키즈카페를 이용 연령·요금·양말 규정·예약까지 출처와 확인일이 붙은 정보로 고르는 전국 지도",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <head>
        {/* Pretendard(가변, 동적 서브셋) — 한글 웹 표준 폰트, 실패 시 system-ui로 대체 */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css"
        />
      </head>
      <body className="min-h-screen bg-white text-neutral-900 antialiased">{children}</body>
    </html>
  );
}
