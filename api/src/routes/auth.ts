import { Router } from "express"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import { z } from "zod"
import User from "../models/User"

const router = Router()

const creds = z.object({ email: z.string().email(), password: z.string().min(6), name: z.string().optional() })

router.post("/register", async (req, res) => {
  const p = creds.safeParse(req.body)
  if (!p.success) return res.status(400).json({ error: p.error.flatten() })
  const { email, password, name } = p.data
  const exists = await User.findOne({ email })
  if (exists) return res.status(409).json({ error: "Email already registered" })
  const passwordHash = await bcrypt.hash(password, 10)
  const user = await User.create({ email, name: name ?? email.split("@")[0], passwordHash, friends: [] })
  const token = jwt.sign({ uid: user._id.toString() }, process.env.JWT_SECRET!, { expiresIn: "7d" })
  res.json({ token, user: { id: user._id, email: user.email, name: user.name } })
})

router.post("/login", async (req, res) => {
  const p = creds.pick({ email: true, password: true }).safeParse(req.body)
  if (!p.success) return res.status(400).json({ error: p.error.flatten() })
  const { email, password } = p.data
  const user = await User.findOne({ email })
  if (!user) return res.status(401).json({ error: "Invalid credentials" })
  const ok = await bcrypt.compare(password, user.passwordHash)
  if (!ok) return res.status(401).json({ error: "Invalid credentials" })
  const token = jwt.sign({ uid: user._id.toString() }, process.env.JWT_SECRET!, { expiresIn: "7d" })
  res.json({ token, user: { id: user._id, email: user.email, name: user.name } })
})

export default router
