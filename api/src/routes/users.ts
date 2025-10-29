import { Router } from "express";
import User from "../models/User";
import Event from "../models/Event"; // assuming you have this model
import mongoose from "mongoose";

const router = Router();
const SEED_KEY = process.env.SEED_KEY || "";

// simple middleware for seed-only endpoints
function requireSeedKey(req: any, res: any, next: any) {
  const k = req.header("X-Seed-Key") || "";
  if (!SEED_KEY || k !== SEED_KEY) return res.status(401).json({ error: "Unauthorized" });
  next();
}

/**
 * DELETE /users/by-email?email=...
 * Removes a user, their events, and cleans up friend connections.
 * Seed-key protected.
 */
router.delete("/by-email", requireSeedKey, async (req, res) => {
  try {
    const email = String(req.query.email || "").toLowerCase();
    if (!email) return res.status(400).json({ error: "Missing email" });

    const user = await User.findOne({ email });
    if (!user) return res.json({ ok: true, deleted: 0 });

    const uid = new mongoose.Types.ObjectId(user._id);

    // delete user events
    if (Event?.deleteMany) {
      await Event.deleteMany({ userId: uid });
    }

    // remove from others' friend lists (if your friend data is on User)
    await User.updateMany(
      { friends: uid },                // if you use an array of ObjectIds called 'friends'
      { $pull: { friends: uid } }
    );

    await User.deleteOne({ _id: uid });

    return res.json({ ok: true, deleted: 1 });
  } catch (e: any) {
    console.error("[USERS] delete by email error:", e?.message || e);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * POST /users/make-admin
 * body: { userId: string }
 * Seed-key protected.
 */
router.post("/make-admin", requireSeedKey, async (req, res) => {
  try {
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ error: "Missing userId" });
    await User.updateOne({ _id: userId }, { $set: { isAdmin: true } });
    return res.json({ ok: true });
  } catch (e: any) {
    console.error("[USERS] make-admin error:", e?.message || e);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /users
 * (handy for seeding – not protected)
 */
router.get("/", async (_req, res) => {
  const users = await User.find({}, { email: 1, name: 1 }).lean();
  res.json({ users });
});

export default router;
