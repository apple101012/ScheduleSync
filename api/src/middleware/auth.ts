import { Request, Response, NextFunction } from "express"
import jwt from "jsonwebtoken"

export type Authed = Request & { userId?: string }

export function requireAuth(req: Authed, res: Response, next: NextFunction) {
  const h = req.headers.authorization
  if (!h?.startsWith("Bearer ")) return res.status(401).json({ error: "No token" })
  try {
    const token = h.slice(7)
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { uid: string }
    req.userId = payload.uid
    next()
  } catch {
    res.status(401).json({ error: "Invalid token" })
  }
}
