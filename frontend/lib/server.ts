import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { demoCalculate, demoChart, demoOptions } from "./demo";

export const COOKIE = "fee_session";
export const DEMO = process.env.FEE_DEMO === "1";
const ODOO_URL = (process.env.ODOO_URL || "").replace(/\/+$/, "");
const ODOO_DB = process.env.ODOO_DB || "";

const ACTIONS = new Set(["me", "options", "calculate", "chart"]);

export function sessionCookieOptions() {
  return { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 12 };
}

export async function odooPost(path: string, body: unknown, sid?: string) {
  if (!ODOO_URL) {
    return { status: 500, data: { ok: false, error: "ODOO_URL is not configured on the server." } as Record<string, unknown> };
  }
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (ODOO_DB) headers["X-Odoo-Database"] = ODOO_DB;
  if (sid) headers["Cookie"] = `session_id=${sid}`;
  const url = `${ODOO_URL}${path}${ODOO_DB ? `?db=${encodeURIComponent(ODOO_DB)}` : ""}`;
  try {
    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body ?? {}), cache: "no-store", redirect: "manual" });
    const text = await res.text();
    try {
      return { status: res.status, data: JSON.parse(text) as Record<string, unknown> };
    } catch {
      // Not JSON: redirect to /web/login (expired session), 404 (module not installed / wrong DB), or a proxy error page
      console.error(`[odoo] ${path} -> HTTP ${res.status}: ${text.slice(0, 200).replace(/\s+/g, " ")}`);
      if (res.status >= 300 && res.status < 400)
        return { status: 401, data: { ok: false, code: "session", error: "Session expired. Please sign in again." } };
      const hint = res.status === 404
        ? "Route not found - install/upgrade the otm_fee_calculator module on this Odoo, and check ODOO_DB."
        : "Check ODOO_URL / ODOO_DB and the server log.";
      return { status: 502, data: { ok: false, code: "bad_gateway", error: `Odoo returned HTTP ${res.status}. ${hint}` } };
    }
  } catch {
    return { status: 502, data: { ok: false, error: "Cannot reach the Odoo server." } as Record<string, unknown> };
  }
}

export async function handleAction(action: string, req: Request) {
  if (!ACTIONS.has(action)) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  const jar = await cookies();
  const sid = jar.get(COOKIE)?.value;
  if (!sid) return NextResponse.json({ ok: false, code: "session", error: "Please sign in." }, { status: 401 });
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty body is fine */ }

  let out: { status: number; data: Record<string, unknown> };
  if (DEMO) {
    if (action === "me") out = { status: 200, data: { ok: true, name: "Demo Counsellor", is_manager: true } };
    else if (action === "options") out = { status: 200, data: demoOptions() as unknown as Record<string, unknown> };
    else if (action === "chart") out = { status: 200, data: { ok: true, rows: demoChart() } };
    else out = demoCalculate(body);
  } else {
    out = await odooPost(`/otm_fee/api/${action}`, body, sid);
  }
  const res = NextResponse.json(out.data, { status: out.status });
  if (out.status === 401) res.cookies.delete(COOKIE);
  return res;
}
