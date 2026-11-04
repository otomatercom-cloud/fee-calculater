import { NextResponse } from "next/server";
import { COOKIE, DEMO, odooPost, sessionCookieOptions } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { login?: string; password?: string } = {};
  try { body = await req.json(); } catch { /* handled below */ }
  const login = (body.login || "").trim();
  const password = body.password || "";
  if (!login || !password) return NextResponse.json({ ok: false, error: "Enter your login and password." }, { status: 400 });

  if (DEMO) {
    if (login !== "admin" || password !== "admin")
      return NextResponse.json({ ok: false, error: "Demo mode: use admin / admin." }, { status: 401 });
    const res = NextResponse.json({ ok: true, name: "Demo Counsellor" });
    res.cookies.set(COOKIE, "demo", sessionCookieOptions());
    return res;
  }

  const out = await odooPost("/otm_fee/api/login", { login, password });
  const sid = out.data.session_id;
  if (out.status !== 200 || !out.data.ok || typeof sid !== "string") {
    return NextResponse.json({ ok: false, error: (out.data.error as string) || "Could not sign in." }, { status: out.status === 200 ? 401 : out.status });
  }
  const res = NextResponse.json({ ok: true, name: out.data.name });
  res.cookies.set(COOKIE, sid, sessionCookieOptions());
  return res;
}
