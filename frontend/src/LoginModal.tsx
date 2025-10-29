// src/LoginModal.tsx
import { useState } from "react"

export type AuthResult = {
  token: string
  user: { id: string; email: string; name: string }
}

export default function LoginModal({
  onClose,
  onAuthed
}: {
  onClose: () => void
  onAuthed: (res: AuthResult) => void
}) {
  const [mode, setMode] = useState<"login" | "register">("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit() {
    setErr(null); setLoading(true)
    try {
      const path = mode === "login" ? "/auth/login" : "/auth/register"
      const res = await fetch("http://localhost:8000" + path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "login" ? { email, password } : { email, password, name }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error((data && (data.error?.message || data.error)) || "Auth failed")
      onAuthed(data as AuthResult)
    } catch (e: any) {
      setErr(e.message || "Failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">{mode === "login" ? "Log in" : "Create account"}</div>
        <div className="form">
          {mode === "register" && (
            <label><span>Name</span><input value={name} onChange={e => setName(e.target.value)} /></label>
          )}
          <label><span>Email</span><input type="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
          <label><span>Password</span><input type="password" value={password} onChange={e => setPassword(e.target.value)} /></label>
        </div>
        {err && <div className="error">{err}</div>}
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={loading} onClick={submit}>
            {loading ? "..." : (mode === "login" ? "Log in" : "Register")}
          </button>
        </div>
        <div className="muted" style={{ marginTop: 8 }}>
          {mode === "login" ? (
            <>No account? <button className="link-btn" onClick={() => setMode("register")}>Register</button></>
          ) : (
            <>Have an account? <button className="link-btn" onClick={() => setMode("login")}>Log in</button></>
          )}
        </div>
      </div>
    </div>
  )
}
