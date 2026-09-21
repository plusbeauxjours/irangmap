import { currentUser, isAdmin } from "@/lib/session";

/** 내 로그인 상태와 권한. 관리자 지정(카카오 회원번호 확인)에도 쓴다. */
export async function GET() {
  const user = await currentUser();
  if (!user) return Response.json({ user: null });
  return Response.json({ user: { id: user.id, name: user.name }, admin: await isAdmin(user.id) });
}
