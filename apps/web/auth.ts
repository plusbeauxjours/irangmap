import NextAuth from "next-auth";
import Kakao from "next-auth/providers/kakao";

/**
 * 카카오 로그인(Auth.js v5). DB 없이 JWT 세션만 쓴다 — 제보·사업자 확인이 붙을 때 DB 어댑터를 더한다.
 * 필요한 env: AUTH_SECRET, AUTH_KAKAO_ID(REST API 키), AUTH_KAKAO_SECRET(Client Secret).
 * 카카오 콘솔 Redirect URI: {origin}/api/auth/callback/kakao
 */
export const authEnabled = Boolean(process.env.AUTH_KAKAO_ID && process.env.AUTH_SECRET);

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Kakao({ clientId: process.env.AUTH_KAKAO_ID, clientSecret: process.env.AUTH_KAKAO_SECRET })],
  session: { strategy: "jwt" },
  trustHost: true,
  pages: {},
  callbacks: {
    jwt({ token, account, profile }) {
      if (account) token.provider = account.provider;
      if (profile && typeof profile === "object" && "id" in profile) token.kakaoId = String((profile as { id: unknown }).id);
      return token;
    },
    session({ session, token }) {
      return { ...session, provider: token.provider as string | undefined, kakaoId: token.kakaoId as string | undefined };
    },
  },
});
