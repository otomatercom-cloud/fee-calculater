export class ApiError extends Error {
  code?: string;
  constructor(message: string, code?: string) { super(message); this.code = code; }
}

export async function api<T>(path: string, body: unknown = {}): Promise<T> {
  const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  let data: { ok?: boolean; error?: string; code?: string } & Record<string, unknown> = {};
  try { data = await res.json(); } catch { /* non-JSON */ }
  if (res.status === 401 && typeof window !== "undefined") window.location.href = "/login";
  if (!res.ok || data.ok === false) throw new ApiError(data.error || "Something went wrong. Please try again.", data.code);
  return data as T;
}
