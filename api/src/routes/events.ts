import { Router } from "express"
import { requireAuth, Authed } from "../middleware/auth"
import Event from "../models/Event"
import { z } from "zod"

const router = Router()
router.use(requireAuth)

router.get("/", async (req: Authed, res) => {
  const { ownerId, includeFriends } = req.query as { ownerId?: string; includeFriends?: string }
  const filter: any = {}

  if (ownerId) filter.owner = ownerId
  else filter.owner = req.userId

  const events = await Event.find(filter).sort({ start: 1 })
  res.json(events)
})

const upsert = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  start: z.string().or(z.date()),
  end: z.string().or(z.date()),
  owner: z.string().optional()
})

router.post("/", async (req: Authed, res) => {
  const p = upsert.safeParse(req.body)
  if (!p.success) return res.status(400).json({ error: p.error.flatten() })
  const { title, description, start, end } = p.data
  const ev = await Event.create({ title, description, start: new Date(start), end: new Date(end), owner: req.userId })
  res.json(ev)
})

router.put("/:id", async (req: Authed, res) => {
  const p = upsert.partial().safeParse(req.body)
  if (!p.success) return res.status(400).json({ error: p.error.flatten() })
  const { id } = req.params
  const ev = await Event.findOneAndUpdate({ _id: id, owner: req.userId }, { ...p.data }, { new: true })
  if (!ev) return res.status(404).json({ error: "Not found" })
  res.json(ev)
})

router.delete("/:id", async (req: Authed, res) => {
  const { id } = req.params
  await Event.deleteOne({ _id: id, owner: req.userId })
  res.json({ ok: true })
})

export default router
