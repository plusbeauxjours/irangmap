// 진단용: 브라우저가 보낸 performance.mark 타임라인을 서버 로그에 남긴다. `/?perf=1`에서만 전송된다.
export function GET(req: Request) {
  const url = new URL(req.url);
  console.log(`[perf] ${new Date().toISOString()} ${url.searchParams.get("ua") ?? ""} ${url.searchParams.get("marks") ?? ""}`);
  return new Response(null, { status: 204 });
}
