import { Router } from "express";
import { AuthedRequest, requireAuth } from "../middleware/auth";
import { requireAdmin } from "../middleware/admin";
import Event from "../models/Event";
import User from "../models/User";
import mongoose from "mongoose";

const router = Router();

function startOfMonday(d = new Date()) {
  const x = new Date(d);
  x.setHours(0,0,0,0);
  const day = x.getDay(); // 0 Sun
  const diffToMon = (day + 6) % 7;
  x.setDate(x.getDate() - diffToMon);
  return x;
}
function endOfWeek(monday: Date) {
  const end = new Date(monday);
  end.setDate(end.getDate() + 7);
  return end;
}
function startOfMonth(d = new Date()) {
  const s = new Date(d.getFullYear(), d.getMonth(), 1);
  s.setHours(0,0,0,0);
  return s;
}
function endOfMonth(d = new Date()) {
  const e = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  e.setHours(0,0,0,0);
  return e;
}

function randInt(minInclusive: number, maxExclusive: number) {
  return Math.floor(Math.random() * (maxExclusive - minInclusive)) + minInclusive;
}

function sample<T>(arr: T[]) { return arr[randInt(0, arr.length)]; }

function randomEventsForRange(userId: mongoose.Types.ObjectId | string, start: Date, end: Date) {
  const titles = ["Class","Study Session","Gym","Work Shift","Meeting","Project","Lab","Group Study","Office Hours","Club","Practice","Tutoring"];
  const days = Math.ceil((+end - +start) / (24 * 3600e3));
  const perDayP = 0.45; // probability a day has an event
  const docs: any[] = [];
  for (let i = 0; i < days; i++) {
    if (Math.random() > perDayP) continue;
    const s = new Date(start);
    s.setDate(s.getDate() + i);
    s.setHours(randInt(8, 19), 0, 0, 0);      // 08–18 start
    const e = new Date(s);
    e.setHours(e.getHours() + randInt(1, 4)); // 1–3 hours
    docs.push({
      userId,
      title: sample(titles),
      description: "Seeded",
      start: s,
      end: e,
    });
  }
  // add chance of second event same day
  for (let i = 0; i < days; i++) {
    if (Math.random() > 0.2) continue;
    const s = new Date(start);
    s.setDate(s.getDate() + i);
    s.setHours(randInt(12, 21), 0, 0, 0);
    const e = new Date(s); e.setHours(e.getHours() + randInt(1, 3));
    docs.push({
      userId, title: sample(titles), description: "Seeded+", start: s, end: e
    });
  }
  return docs;
}

/** Seed current user's week (clear only current user's week) */
router.post("/my-week", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const uid = req.userId!;
    const monday = startOfMonday(new Date());
    const weekEnd = endOfWeek(monday);
    const clear = req.body?.clear !== false;

    if (clear) {
      await Event.deleteMany({ userId: uid, start: { $gte: monday, $lt: weekEnd } });
    }
    const docs = randomEventsForRange(uid, monday, weekEnd);
    if (docs.length) await Event.insertMany(docs);
    return res.json({ ok: true, created: docs.length, range: { start: monday, end: weekEnd } });
  } catch (e) {
    console.error("[SEED] my-week error:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

/** Seed current user's month (clear only current user's month) */
router.post("/my-month", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const uid = req.userId!;
    const s = startOfMonth(new Date());
    const e = endOfMonth(new Date());
    const clear = req.body?.clear !== false;
    if (clear) {
      await Event.deleteMany({ userId: uid, start: { $gte: s, $lt: e } });
    }
    const docs = randomEventsForRange(uid, s, e);
    if (docs.length) await Event.insertMany(docs);
    return res.json({ ok: true, created: docs.length, range: { start: s, end: e } });
  } catch (e) {
    console.error("[SEED] my-month error:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

/** Admin: seed everyone’s week or month (events unique per person) */
router.post("/all", requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  try {
    const mode = (req.body?.mode === "month") ? "month" : "week";
    const s = mode === "month" ? startOfMonth(new Date()) : startOfMonday(new Date());
    const e = mode === "month" ? endOfMonth(new Date()) : endOfWeek(s);
    const clear = req.body?.clear !== false;

    const users = await User.find({}, "_id").lean();
    let totalCreated = 0;

    for (const u of users) {
      if (clear) {
        await Event.deleteMany({ userId: u._id, start: { $gte: s, $lt: e } });
      }
      const docs = randomEventsForRange(u._id, s, e);
      if (docs.length) {
        await Event.insertMany(docs);
        totalCreated += docs.length;
      }
    }
    return res.json({ ok: true, created: totalCreated, mode, range: { start: s, end: e }, users: users.length });
  } catch (e) {
    console.error("[SEED] all error:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
