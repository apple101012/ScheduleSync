import { Router } from "express"
import { Authed, requireAuth } from "../middleware/auth"
import User from "../models/User"
import Event from "../models/Event"

const router = Router()
router.use(requireAuth)

// list my friends
router.get("/", async (req: Authed, res) => {
  const me = await User.findById(req.userId).populate("friends", "name email")
  res.json(me?.friends ?? [])
})

// add friend by email (simple for now)
router.post("/add", async (req: Authed, res) => {
  const { email } = req.body as { email: string }
  const me = await User.findById(req.userId)
  const friend = await User.findOne({ email })
  if (!me || !friend) return res.status(404).json({ error: "Not found" })
  if (!me.friends.map(String).includes(friend._id.toString())) {
    me.friends.push(friend._id)
    await me.save()
  }
  res.json({ ok: true })
})

// busy now? — server-side check
router.get("/:friendId/busy-now", async (req, res) => {
  const { friendId } = req.params
  const now = new Date()
  const active = await Event.exists({ owner: friendId, start: { $lte: now }, end: { $gte: now } })
  res.json({ friendId, busy: !!active })
})

export default router
