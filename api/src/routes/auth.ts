import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

router.post("/register", async (req, res) => {
  const { email, password, name } = req.body || {};
  console.log("[AUTH] /register payload:", { email, name, hasPassword: !!password });

  try {
    if (!email || !password || !name) {
      console.warn("[AUTH] /register missing fields");
      return res.status(400).json({ error: "Missing email, password, or name" });
    }

    const eLower = String(email).toLowerCase();
    const existing = await User.findOne({ email: eLower });
    console.log("[AUTH] existing user?", !!existing);

    if (existing) {
      return res.status(409).json({ error: "Email already registered" });
    }

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ email: eLower, name, passwordHash: hash });
    const token = jwt.sign({ sub: String(user._id) }, JWT_SECRET, { expiresIn: "7d" });

    console.log("[AUTH] registered:", user.email);
    return res.json({ token, user: { id: String(user._id), email: user.email, name: user.name } });
  } catch (e: any) {
    console.error("[AUTH] /register error:", e?.message || e);
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  console.log("[AUTH] /login payload:", { email, hasPassword: !!password });

  try {
    if (!email || !password) {
      console.warn("[AUTH] /login missing fields");
      return res.status(400).json({ error: "Missing email or password" });
    }

    const eLower = String(email).toLowerCase();
    const user = await User.findOne({ email: eLower });
    console.log("[AUTH] user found?", !!user);

    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    console.log("[AUTH] password ok?", ok);

    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign({ sub: String(user._id) }, JWT_SECRET, { expiresIn: "7d" });
    return res.json({ token, user: { id: String(user._id), email: user.email, name: user.name } });
  } catch (e: any) {
    console.error("[AUTH] /login error:", e?.message || e);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
