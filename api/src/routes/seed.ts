import { Router } from "express";
import mongoose from "mongoose";
import Event from "../models/Event";
import User from "../models/User";
import { AuthedRequest, requireAuth } from "../middleware/auth";
import { requireAdmin } from "../middleware/admin";

const router = Router();
const toId = (s: string) => new mongoose.Types.ObjectId(s);

// ---------- UTC date helpers ----------
const MS_PER_DAY = 86_400_000;

function startOfDayUTC(d = new Date()) {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}
function startOfMondayUTC(d = new Date()) {
  const x = startOfDayUTC(d);
  const day = x.getUTCDay(); // 0=Sun..6=Sat
  const diffToMon = (day + 6) % 7;
  x.setUTCDate(x.getUTCDate() - diffToMon);
  return x;
}
function endOfWeekUTC(mondayUTC: Date) {
  const e = new Date(mondayUTC);
  e.setUTCDate(e.getUTCDate() + 7);
  e.setUTCHours(0, 0, 0, 0);
  return e; // end-exclusive
}
function startOfMonthUTC(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
}
function endOfMonthUTC(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 0, 0, 0, 0)); // end-exclusive
}

// ---------- RNG / generator ----------
const TITLES = [
  "Class","Study","Gym","Work","Meeting","Project","Lab","Club",
  "Practice","Office Hours","Lecture","Seminar"
];
const randInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

/** Generate ≤ perDayMax non-overlapping events per day within [startUTC, endUTC). */
function randomEventsForRange({
  userId,
  startUTC,
  endUTC,
  perDayMax = 3,
  dayStartHourUTC = 9,
  dayEndHourUTC = 19,
}: {
  userId: mongoose.Types.ObjectId;
  startUTC: Date;
  endUTC: Date;
  perDayMax?: number;
  dayStartHourUTC?: number;
  dayEndHourUTC?: number;
}) {
  const days = Math.ceil((+endUTC - +startUTC) / MS_PER_DAY);
  const docs: any[] = [];

  const sampleCount = () => {
    const r = Math.random();
    if (r < 0.45) return 0;
    if (r < 0.80) return 1;
    if (r < 0.95) return 2;
    return Math.min(3, perDayMax);
  };

  for (let i = 0; i < days; i++) {
    const base = new Date(startUTC);
    base.setUTCDate(base.getUTCDate() + i);
    base.setUTCHours(0, 0, 0, 0);

    const n = sampleCount();
    if (n === 0) continue;

    const slots: { start: Date; end: Date }[] = [];
    let attempts = 0;
    while (slots.length < n && attempts < 40) {
      attempts++;
      const sh = randInt(dayStartHourUTC, Math.max(dayStartHourUTC, dayEndHourUTC - 2));
      const st = new Date(base);
      st.setUTCHours(sh, 0, 0, 0);
      const durHrs = randInt(1, 2); // 1–2 hours
      const et = new Date(st);
      et.setUTCHours(et.getUTCHours() + durHrs);
      if (et.getUTCHours() > dayEndHourUTC) continue;

      const overlaps = slots.some(s => !(et <= s.start || st >= s.end));
      if (!overlaps) slots.push({ start: st, end: et });
    }

    for (const s of slots) {
      docs.push({
        userId,
        title: pick(TITLES),
        description: "Seeded",
        start: s.start,
        end: s.end,
      });
    }
  }

  return docs;
}

// ---------- CURRENT USER: seed week (always clear target range) ----------
router.post("/my-week", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const uid = toId(req.userId!);
    const weekStart = startOfMondayUTC(new Date());
    const weekEnd = endOfWeekUTC(weekStart);

    await Event.deleteMany({ userId: uid, start: { $gte: weekStart, $lt: weekEnd } });
    const docs = randomEventsForRange({
      userId: uid, startUTC: weekStart, endUTC: weekEnd, perDayMax: 3
    });
    const created = docs.length ? await Event.insertMany(docs, { ordered: false }) : [];
    res.json({ ok: true, created: created.length });
  } catch (e) {
    console.error("[SEED my-week]", e);
    res.status(500).json({ error: "Server error" });
  }
});

// ---------- CURRENT USER: seed month (always clear target range) ----------
router.post("/my-month", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const uid = toId(req.userId!);
    const mStart = startOfMonthUTC(new Date());
    const mEnd = endOfMonthUTC(new Date());

    await Event.deleteMany({ userId: uid, start: { $gte: mStart, $lt: mEnd } });
    const docs = randomEventsForRange({
      userId: uid, startUTC: mStart, endUTC: mEnd, perDayMax: 3
    });
    const created = docs.length ? await Event.insertMany(docs, { ordered: false }) : [];
    res.json({ ok: true, created: created.length });
  } catch (e) {
    console.error("[SEED my-month]", e);
    res.status(500).json({ error: "Server error" });
  }
});

// ---------- ADMIN: seed all (week | month), skipping admins by default ----------
router.post("/all", requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  try {
    const mode = req.body?.mode === "month" ? "month" : "week";
    const s = mode === "month" ? startOfMonthUTC(new Date()) : startOfMondayUTC(new Date());
    const e = mode === "month" ? endOfMonthUTC(new Date()) : endOfWeekUTC(s);

    const includeAdmin = !!req.body?.includeAdmin; // default false
    const clear = req.body?.clear !== false;       // default true

    const userQuery = includeAdmin ? {} : { admin: { $ne: true } };
    const users = await User.find(userQuery, "_id").lean();

    let total = 0;
    for (const u of users) {
      const uid = toId(u._id.toString());
      if (clear) {
        await Event.deleteMany({ userId: uid, start: { $gte: s, $lt: e } });
      }
      const docs = randomEventsForRange({ userId: uid, startUTC: s, endUTC: e, perDayMax: 3 });
      if (!docs.length) continue;
      try {
        const created = await Event.insertMany(docs, { ordered: false });
        total += created.length;
      } catch (err: any) {
        if (err?.message?.includes("E11000")) continue;
        throw err;
      }
    }

    res.json({ ok: true, users: users.length, created: total, mode, includeAdmin });
  } catch (e) {
    console.error("[SEED all]", e);
    res.status(500).json({ error: "Server error" });
  }
});

// ---------- ADMIN: make one user fully booked this week ----------
router.post("/full-week-user", requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  try {
    const { userId, startHour = 8, endHour = 22, clear = true } = req.body || {};
    if (!userId) return res.status(400).json({ error: "userId required" });

    const uid = toId(userId);
    const s = startOfMondayUTC(new Date());
    const e = endOfWeekUTC(s);

    if (clear) {
      await Event.deleteMany({ userId: uid, start: { $gte: s, $lt: e } });
    }

    const days = Math.ceil((+e - +s) / MS_PER_DAY);
    const docs: any[] = [];
    for (let i = 0; i < days; i++) {
      const d0 = new Date(s);
      d0.setUTCDate(d0.getUTCDate() + i);
      d0.setUTCHours(startHour, 0, 0, 0);
      const d1 = new Date(d0);
      d1.setUTCHours(endHour, 0, 0, 0);
      docs.push({ userId: uid, title: "Busy Block", description: "Fully booked", start: d0, end: d1 });
    }

    const created = await Event.insertMany(docs, { ordered: false });
    res.json({ ok: true, created: created.length });
  } catch (e: any) {
    if (e?.message?.includes("E11000")) return res.json({ ok: true, created: 0, note: "duplicates ignored" });
    console.error("[SEED full-week-user]", e);
    res.status(500).json({ error: "Server error" });
  }
});

// ---------- ADMIN: dedupe exact duplicates ----------
router.post("/dedupe", requireAuth, requireAdmin, async (_req: AuthedRequest, res) => {
  try {
    const dupGroups = await Event.aggregate<{
      _id: { userId: mongoose.Types.ObjectId; start: Date; end: Date; title: string };
      ids: mongoose.Types.ObjectId[];
      count: number;
    }>([
      {
        $group: {
          _id: { userId: "$userId", start: "$start", end: "$end", title: "$title" },
          ids: { $push: "$_id" },
          count: { $sum: 1 },
        },
      },
      { $match: { count: { $gt: 1 } } },
    ]);

    let removed = 0;
    for (const g of dupGroups) {
      const ids = [...g.ids];
      ids.sort();         // deterministic
      ids.shift();        // keep one
      if (ids.length) {
        const r = await Event.deleteMany({ _id: { $in: ids } });
        removed += r.deletedCount ?? 0;
      }
    }
    res.json({ ok: true, removed });
  } catch (e) {
    console.error("[SEED dedupe]", e);
    res.status(500).json({ error: "Server error" });
  }
});

// ---------- ADMIN: reset sample users & admin/busy by email rules ----------
/**
 * POST /seed/reset-sample
 * Body (optional):
 * - domain: string (default "example.com")
 * - emails: string[] (additional explicit emails to remove)
 *
 * Deletes:
 *   - Users with email ending in @domain
 *   - Users with email in `emails`
 *   - All Events for those users
 *   - Pulls them from everyone’s friends list
 */
router.post("/reset-sample", requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  try {
    const domain: string = req.body?.domain || "example.com";
    const emails: string[] = Array.isArray(req.body?.emails) ? req.body.emails : [];

    // Find users to remove
    const regex = new RegExp(`@${domain.replace(/\./g, "\\.")}$`, "i");
    const toRemove = await User.find({ $or: [{ email: { $regex: regex } }, { email: { $in: emails } }] }, "_id email").lean();

    const ids = toRemove.map(u => toId(String(u._id)));
    if (!ids.length) return res.json({ ok: true, removedUsers: 0, removedEvents: 0, pulledFriendsFrom: 0 });

    // Delete events for those users
    const evRes = await Event.deleteMany({ userId: { $in: ids } });

    // Pull from friends arrays if you store friends as user ObjectIds on User
    const pullRes = await User.updateMany({}, { $pull: { friends: { $in: ids } } });

    // Delete users
    const delRes = await User.deleteMany({ _id: { $in: ids } });

    res.json({
      ok: true,
      removedUsers: delRes.deletedCount ?? 0,
      removedEvents: evRes.deletedCount ?? 0,
      pulledFriendsFrom: pullRes.modifiedCount ?? 0
    });
  } catch (e) {
    console.error("[SEED reset-sample]", e);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
