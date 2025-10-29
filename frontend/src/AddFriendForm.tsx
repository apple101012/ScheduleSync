// src/AddFriendForm.tsx
import { useState } from "react"
import { api } from "./api"

export default function AddFriendForm({
  onAdded
}: {
  onAdded: () => void
}) {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    if (!email.trim()) return
    setLoading(true)
    try {
      await api.post("/friends/add", { email: email.trim() })
      setMsg("Friend added ✅")
      setEmail("")
      onAdded()
    } catch (e: any) {
      setMsg(e.message || "Failed to add friend")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className="add-friend" onSubmit={submit}>
      <input
        className="input"
        type="email"
        placeholder="friend@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <button className="btn" disabled={loading || !email.trim()}>
        {loading ? "…" : "Add"}
      </button>
      {msg && <div className="muted small" style={{ marginTop: 6 }}>{msg}</div>}
    </form>
  )
}
