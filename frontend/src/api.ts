// src/api.ts
let TOKEN: string | null = localStorage.getItem("ss_token")

export function setToken(t: string | null) {
  TOKEN = t
  if (t) localStorage.setItem("ss_token", t)
  else localStorage.removeItem("ss_token")
}

const BASE = "http://localhost:8000"

async function request(path: string, init: RequestInit = {}) {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (TOKEN) headers["Authorization"] = `Bearer ${TOKEN}`
  const res = await fetch(BASE + path, { ...init, headers: { ...headers, ...(init.headers || {}) } })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(text || `HTTP ${res.status}`)
  }
  const ct = res.headers.get("content-type") || ""
  return ct.includes("application/json") ? res.json() : res.text()
}

export const api = {
  get: (p: string) => request(p),
  post: (p: string, body?: any) => request(p, { method: "POST", body: JSON.stringify(body ?? {}) }),
  put: (p: string, body?: any) => request(p, { method: "PUT", body: JSON.stringify(body ?? {}) }),
  del: (p: string) => request(p, { method: "DELETE" }),
}
