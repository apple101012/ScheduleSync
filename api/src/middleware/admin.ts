import { Response, NextFunction } from "express";
import User from "../models/User";
import { AuthedRequest } from "./auth";

export async function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const uid = req.userId!;
    const me = await User.findById(uid).lean();
    if (!me?.admin) return res.status(403).json({ error: "Admin only" });
    next();
  } catch (e) {
    return res.status(500).json({ error: "Server error" });
  }
}
