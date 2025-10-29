let token: string | null = null;
export function setToken(t: string | null) { token = t; if (t) localStorage.setItem("ss_token", t); else localStorage.removeItem("ss_token"); }

const BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

async function handle(res: Response) {
  const text = await res.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { /* ignore */ }
  if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}: ${text}`);
  return body;
}

export const api = {
  async get(p: string) {
    const res = await fetch(`${BASE}${p}`, {
      headers: { Authorization: token ? `Bearer ${token}` : "" }
    });
    return handle(res);
  },
  async post(p: string, body?: any) {
    const res = await fetch(`${BASE}${p}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token ? `Bearer ${token}` : ""
      },
      body: JSON.stringify(body || {})
    });
    return handle(res);
  },
  async put(p: string, body?: any) {
    const res = await fetch(`${BASE}${p}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: token ? `Bearer ${token}` : ""
      },
      body: JSON.stringify(body || {})
    });
    return handle(res);
  },
  async del(p: string) {
    const res = await fetch(`${BASE}${p}`, {
      method: "DELETE",
      headers: { Authorization: token ? `Bearer ${token}` : "" }
    });
    return handle(res);
  },
};
