import { SessionProvider } from "next-auth/react";

import { authEnabled } from "@/auth";
import { Explorer } from "@/components/Explorer";
import { dbEnabled } from "@/lib/db";

export default function Page() {
  if (!authEnabled) return <Explorer />;
  return (
    <SessionProvider>
      <Explorer authEnabled reportsEnabled={dbEnabled} />
    </SessionProvider>
  );
}
