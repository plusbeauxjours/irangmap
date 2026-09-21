"use client";

import { signIn, signOut, useSession } from "next-auth/react";

import { LogOut } from "./icons";

/** 헤더 우측 로그인 상태. 로그아웃 상태면 카카오 로그인 버튼, 로그인 상태면 프로필 + 로그아웃. */
export function AuthButton() {
  const { data, status } = useSession();
  if (status === "loading") return <span className="h-8 w-24 animate-pulse rounded-lg bg-neutral-100" aria-hidden="true" />;
  if (!data?.user) {
    return (
      <button
        type="button"
        onClick={() => signIn("kakao")}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#FEE500] px-2.5 text-xs font-semibold text-[#191919] hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-neutral-400"
        aria-label="카카오 계정으로 로그인"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#191919" d="M12 3C6.5 3 2 6.6 2 11c0 2.8 1.9 5.3 4.7 6.7L5.6 21.6c-.1.4.3.7.6.5l4.6-3.1c.4 0 .8.1 1.2.1 5.5 0 10-3.6 10-8.1S17.5 3 12 3z" />
        </svg>
        카카오 로그인
      </button>
    );
  }
  const name = data.user.name ?? "회원";
  return (
    <div className="flex items-center gap-2">
      {data.user.image ? (
        <img src={data.user.image} alt="" className="h-7 w-7 rounded-full object-cover" referrerPolicy="no-referrer" />
      ) : (
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-200 text-xs font-semibold text-neutral-700">{name.slice(0, 1)}</span>
      )}
      <span className="max-w-[7rem] truncate text-xs text-neutral-700">{name}</span>
      <button type="button" onClick={() => signOut()} className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100" aria-label="로그아웃" title="로그아웃">
        <LogOut size={14} />
      </button>
    </div>
  );
}
