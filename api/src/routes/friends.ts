import { Router } from "express";
import mongoose from "mongoose";
import User from "../models/User";
import Event from "../models/Event";
import { requireAuth, AuthedRequest } from "../middleware/auth";

const router = Router();

/** POST /friends/add { friendId } */
router.post("/add", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.userId);
    const { friendId } = req.body || {};
    if (!friendId) return res.status(400).json({ error: "Missing friendId" });

    const fid = new mongoose.Types.ObjectId(friendId);
    if (fid.equals(userId)) return res.status(400).json({ error: "Cannot friend yourself" });

    const me = await User.findById(userId);
    const friend = await User.findById(fid);
    if (!me || !friend) return res.status(404).json({ error: "User not found" });

    await User.updateOne({ _id: userId }, { $addToSet: { friends: fid } });
    await User.updateOne({ _id: fid }, { $addToSet: { friends: userId } });

    return res.json({ ok: true });
  } catch (e: any) {
    console.error("[FRIENDS] add error:", e?.message || e);
    return res.status(500).json({ error: "Server error" });
  }
});

/** GET /friends → list my friends */
router.get("/", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const me = await User.findById(req.userId).populate("friends", "name email").lean();
    if (!me) return res.status(404).json({ error: "User not found" });
    return res.json({ friends: me.friends || [] });
  } catch (e: any) {
    console.error("[FRIENDS] list error:", e?.message || e);
    return res.status(500).json({ error: "Server error" });
  }
});


router.get("/:id/busy-now", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const fid = new mongoose.Types.ObjectId(req.params.id);
    const now = new Date();
    const overlapping = await Event.findOne({
      userId: fid,
      start: { $lte: now },
      end: { $gt: now },
    }).select("_id").lean();

    return res.json({ busy: !!overlapping });
  } catch (e) {
    console.error("[FRIENDS] busy-now error:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;

