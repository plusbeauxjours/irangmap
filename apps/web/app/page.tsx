import { SessionProvider } from "next-auth/react";

import { authEnabled } from "@/auth";
import { Explorer } from "@/components/Explorer";
import { dbEnabled } from "@/lib/db";

const reviewsEnabled = Boolean(process.env.KAKAO_REST_API_KEY ?? process.env.AUTH_KAKAO_ID);

export default function Page() {
  if (!authEnabled) return <Explorer reviewsEnabled={reviewsEnabled} />;
  return (
    <SessionProvider>
      <Explorer authEnabled reportsEnabled={dbEnabled} reviewsEnabled={reviewsEnabled} />
    </SessionProvider>
  );
}
