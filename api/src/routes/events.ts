import { Router } from "express"
import { requireAuth, AuthedRequest } from "../middleware/auth"
import Event from "../models/Event"
import { z } from "zod"

const router = Router()
router.use(requireAuth)

router.get("/", async (req: AuthedRequest, res) => {
  const { ownerId, includeFriends } = req.query as { ownerId?: string; includeFriends?: string }
  const filter: any = {}

  if (ownerId) filter.userId = ownerId
  else filter.userId = req.userId

  const events = await Event.find(filter).sort({ start: 1 })
  res.json(events)
})

const upsert = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  start: z.string().or(z.date()),
  end: z.string().or(z.date()),
  userId: z.string().optional()
})

router.post("/", async (req: AuthedRequest, res) => {
  const p = upsert.safeParse(req.body)
  if (!p.success) return res.status(400).json({ error: p.error.flatten() })
  const { title, description, start, end } = p.data
  const ev = await Event.create({ title, description, start: new Date(start), end: new Date(end), userId: req.userId })
  res.json(ev)
})

router.put("/:id", async (req: AuthedRequest, res) => {
  const p = upsert.partial().safeParse(req.body)
  if (!p.success) return res.status(400).json({ error: p.error.flatten() })
  const { id } = req.params
  const ev = await Event.findOneAndUpdate({ _id: id, userId: req.userId }, { ...p.data }, { new: true })
  if (!ev) return res.status(404).json({ error: "Not found" })
  res.json(ev)
})

router.delete("/:id", async (req: AuthedRequest, res) => {
  const { id } = req.params
  await Event.deleteOne({ _id: id, userId: req.userId })
  res.json({ ok: true })
})

export default router
