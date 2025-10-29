import { Router } from "express";
import { AuthedRequest, requireAuth } from "../middleware/auth";
import Event from "../models/Event";
import { randomInt } from "crypto";

const router = Router();

function weekBoundsNow() {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0,0,0,0);
  const day = start.getDay();          // 0=Sun
  const diffToMon = (day + 6) % 7;     // days since Monday
  start.setDate(start.getDate() - diffToMon);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start, end };
}

router.post("/my-week", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.userId!;
    const { clear = true, monFriOnly = true } = req.body || {};
    const { start, end } = weekBoundsNow();

    if (clear) {
      await Event.deleteMany({
        userId,
        start: { $gte: start, $lt: end }
      });
    }

    const count = randomInt(5, 11); // 5–10 events
    const titles = ["Class","Study Session","Gym","Work Shift","Meeting","Project","Lab","Group Study","Office Hours"];

    const toInsert = [];
    for (let i = 0; i < count; i++) {
      const dayOffset = monFriOnly ? randomInt(0, 5) : randomInt(0, 7);
      const s = new Date(start);
      s.setDate(s.getDate() + dayOffset);
      s.setHours(randomInt(9, 19), 0, 0, 0); // 09–18 start
      const e = new Date(s);
      e.setHours(e.getHours() + randomInt(1, 4)); // 1–3 hours
      toInsert.push({
        userId,
        title: titles[randomInt(0, titles.length)],
        description: "Seeded",
        start: s,
        end: e,
      });
    }

    if (toInsert.length) await Event.insertMany(toInsert);
    return res.json({ ok: true, created: toInsert.length });
  } catch (e: any) {
    console.error("[SEED] my-week error:", e?.message || e);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
