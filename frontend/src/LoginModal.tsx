import { useState } from "react";
import { api, setToken } from "./api";

export type AuthResult = {
  token: string;
  user: { id: string; email: string; name: string };
};

export default function LoginModal({
  onClose,
  onAuthed
}: {
  onClose: () => void;
  onAuthed: (res: AuthResult) => void;
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const path = mode === "login" ? "/auth/login" : "/auth/register";
      const payload =
        mode === "login"
          ? { email, password }
          : { email, password, name: name || email.split("@")[0] };

      const res = (await api.post(path, payload)) as AuthResult;
      setToken(res.token);
      onAuthed(res);
    } catch (e: any) {
      setErr(e.message || "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="tabs">
          <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Login</button>
          <button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>Register</button>
        </div>

        <form className="form" onSubmit={submit}>
          {mode === "register" && (
            <label>
              <span>Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
            </label>
          )}
          <label>
            <span>Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" required />
          </label>
          <label>
            <span>Password</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
          </label>

          {err && <div className="error">{err}</div>}

          <div className="modal-actions">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button className="btn primary" disabled={loading}>
              {loading ? "…" : mode === "login" ? "Login" : "Create account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
