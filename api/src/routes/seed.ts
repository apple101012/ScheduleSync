// api/src/routes/seed.ts
import { Router } from "express";
import { Types } from "mongoose";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import Event from "../models/Event";
import User from "../models/User";
import { requireAuth, AuthedRequest } from "../middleware/auth";

dayjs.extend(utc);
const router = Router();

// ---------- Helpers ---------
type EventCandidate = {
  userId: Types.ObjectId;
  title: string;
  start: Date;
  end: Date;
  color?: string;
  isBusy?: boolean;
};

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

// Simple in-memory idempotency map with TTL (dev-friendly)
const idemCache = new Map<string, number>(); // key -> expiresAt(ms)
const IDEM_TTL_MS = 2 * 60 * 1000; // 2 minutes
function makeIdemKey(args: { uid: string; rangeStartISO: string; cid: string }) {
  return `${args.uid}|${args.rangeStartISO}|${args.cid}`;
}
function idemSeen(key: string) {
  const now = Date.now();
  const exp = idemCache.get(key) || 0;
  if (exp && exp > now) return true;
  // cleanup old
  for (const [k, v] of [...idemCache.entries()]) if (v <= now) idemCache.delete(k);
  return false;
}
function idemMark(key: string) {
  idemCache.set(key, Date.now() + IDEM_TTL_MS);
}

function groupByDay(cands: EventCandidate[]) {
  const map = new Map<string, EventCandidate[]>();
  for (const c of cands) {
    const k = dayKey(c.start);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(c);
  }
  return map;
}

function shuffleInPlace<T>(arr: T[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

async function randomEventsForRange(opts: {
  userId: Types.ObjectId;
  start: Date;
  end: Date;
  perDayMax: number;
}): Promise<EventCandidate[]> {
  const start = dayjs(opts.start).utc().startOf("day");
  const end = dayjs(opts.end).utc().startOf("day");
  const days = end.diff(start, "day");
  const titles = ["Class", "Study", "Gym", "Work", "Lunch", "Project", "Meeting"];
  const out: EventCandidate[] = [];
  for (let i = 0; i < days; i++) {
    const base = start.add(i, "day");
    // Generate up to perDayMax candidates (biased to morning/afternoon/evening slots)
    const slots = [
      base.hour(9).minute(0),
      base.hour(13).minute(0),
      base.hour(18).minute(0),
      base.hour(10).minute(30),
      base.hour(15).minute(0),
    ];
    shuffleInPlace(slots);
    const count = Math.min(opts.perDayMax, Math.floor(2 + Math.random() * 3)); // 2..4 (pre-cap)
    for (let k = 0; k < count; k++) {
      const s = slots[k] || base.hour(9);
      const durHrs = [0.5, 1, 1.5, 2][Math.floor(Math.random() * 4)];
      const e = s.add(Math.floor(durHrs * 60), "minute");
      const title = titles[Math.floor(Math.random() * titles.length)];
      out.push({
        userId: opts.userId,
        title,
        start: s.toDate(),
        end: e.toDate(),
        isBusy: true,
      });
    }
  }
  return out;
}

function enforcePerDayCap(cands: EventCandidate[], perDayMax: number): EventCandidate[] {
  const byDay = groupByDay(cands);
  const capped: EventCandidate[] = [];
  for (const [k, list] of byDay) {
    shuffleInPlace(list);
    capped.push(...list.slice(0, perDayMax));
  }
  // Log distribution
  const hist: Record<string, number> = {};
  for (const e of capped) {
    const k = dayKey(e.start);
    hist[k] = (hist[k] ?? 0) + 1;
  }
  console.log(`[SEED:cap] perDay=${perDayMax} dist=${JSON.stringify(hist)}`);
  return capped;
}

async function topUpToCap(
  uid: Types.ObjectId,
  rangeStart: Date,
  rangeEnd: Date,
  cands: EventCandidate[],
  perDayMax: number
): Promise<EventCandidate[]> {
  // Count existing events per day
  const existing = await Event.aggregate([
    {
      $match: {
        userId: uid,
        start: { $gte: rangeStart, $lt: rangeEnd },
      },
    },
    {
      $project: {
        day: { $dateToString: { date: "$start", format: "%Y-%m-%d" } },
      },
    },
    { $group: { _id: "$day", n: { $sum: 1 } } },
  ]);
  const existingMap = new Map<string, number>();
  for (const row of existing) existingMap.set(row._id, row.n);
  const byDay = groupByDay(cands);
  const final: EventCandidate[] = [];
  for (const [k, list] of byDay) {
    const have = existingMap.get(k) ?? 0;
    const need = Math.max(0, perDayMax - have);
    if (need <= 0) continue;
    shuffleInPlace(list);
    final.push(...list.slice(0, need));
  }
  return final;
}

// Optional: very gentle in-memory rate limiter per user
const lastSeedAt = new Map<string, number>();
const RATE_MS = 3000;

// Protect seed routes (client and admin requests must be authenticated)
router.use(requireAuth);

// ---------- Routes ---------
// POST /seed/my-week  { clear?: boolean, perDayMax?: number }
router.post("/my-week", async (req: AuthedRequest, res, next) => {
  try {
    const uid = req.userId;
    if (!uid) return res.status(401).json({ error: "unauthorized" });
    const now = dayjs().utc();
    const monday = now.startOf("week").add(1, "day"); // Monday
    const weekEnd = monday.add(7, "day");
    // For testing keep a hard cap of 5 events/day for the "my-week" endpoint.
    const perDayMax = Math.min(Number(req.body?.perDayMax ?? 5), 5);
    const clear = req.body?.clear !== false;
    const cid = (req.headers["x-seed-req"] as string) || "-";

    // rate limit
    const last = lastSeedAt.get(uid.toString()) || 0;
    if (Date.now() - last < RATE_MS) {
      return res.status(429).json({ error: "Too many seed requests. Try again." });
    }
    lastSeedAt.set(uid.toString(), Date.now());

    // idempotency key
    const idemKey = makeIdemKey({ uid: uid.toString(), rangeStartISO: monday.toDate().toISOString(), cid });
    if (cid !== "-" && idemSeen(idemKey)) {
      console.log(`[SEED:my-week:idempotent] uid=${uid} cid=${cid} (skipping)`);
      return res.json({ ok: true, idempotent: true });
    }
    if (cid !== "-") idemMark(idemKey);

    console.log(`[SEED:my-week:init] uid=${uid} cid=${cid} clear=${clear} perDayMax=${perDayMax} range=[${monday.toISOString()} .. ${weekEnd.toISOString()})`);

    const existing = await Event.countDocuments({ userId: new Types.ObjectId(uid), start: { $gte: monday.toDate(), $lt: weekEnd.toDate() } });
    console.log(`[SEED:my-week:existing] uid=${uid} cid=${cid} existing=${existing}`);

    if (clear) {
      const del = await Event.deleteMany({ userId: new Types.ObjectId(uid), start: { $gte: monday.toDate(), $lt: weekEnd.toDate() } });
      console.log(`[SEED:my-week:cleared] uid=${uid} cid=${cid} deleted=${del.deletedCount}`);
    }

    // generate candidates
    const candidates = await randomEventsForRange({ userId: new Types.ObjectId(uid), start: monday.toDate(), end: weekEnd.toDate(), perDayMax });
    console.log(`[SEED:my-week:candidates] uid=${uid} cid=${cid} total=${candidates.length}`);

    // enforce per-day cap locally
    const capped = enforcePerDayCap(candidates, perDayMax);

    // if not clearing, top-up to cap instead of blind insert
    const toInsert = clear ? capped : await topUpToCap(new Types.ObjectId(uid), monday.toDate(), weekEnd.toDate(), capped, perDayMax);
    if (toInsert.length === 0) return res.json({ ok: true, inserted: 0 });

    const docs = toInsert.map((c) => ({ userId: c.userId, title: c.title, start: c.start, end: c.end, description: c.isBusy ? "" : "" }));
    const result = await Event.insertMany(docs, { ordered: false });
    console.log(`[SEED:my-week:inserted] uid=${uid} cid=${cid} inserted=${result.length}`);
    res.json({ ok: true, inserted: result.length });
  } catch (err) {
    next(err);
  }
});

// POST /seed/my-month  { clear?: boolean, perDayMax?: number }
router.post("/my-month", async (req: AuthedRequest, res, next) => {
  try {
    const uid = req.userId;
    if (!uid) return res.status(401).json({ error: "unauthorized" });
    const now = dayjs().utc().startOf("day");
    const monthStart = now.startOf("month");
    const monthEnd = monthStart.add(1, "month");
    const perDayMax = Number(req.body?.perDayMax ?? 3);
    const clear = req.body?.clear !== false;
    const cid = (req.headers["x-seed-req"] as string) || "-";
    console.log(`[SEED:my-month:init] uid=${uid} cid=${cid} clear=${clear} perDayMax=${perDayMax} range=[${monthStart.toISOString()} .. ${monthEnd.toISOString()})`);

    if (clear) {
      const del = await Event.deleteMany({ userId: new Types.ObjectId(uid), start: { $gte: monthStart.toDate(), $lt: monthEnd.toDate() } });
      console.log(`[SEED:my-month:cleared] uid=${uid} cid=${cid} deleted=${del.deletedCount}`);
    }

    const candidates = await randomEventsForRange({ userId: new Types.ObjectId(uid), start: monthStart.toDate(), end: monthEnd.toDate(), perDayMax });
    const capped = enforcePerDayCap(candidates, perDayMax);
    const toInsert = clear ? capped : await topUpToCap(new Types.ObjectId(uid), monthStart.toDate(), monthEnd.toDate(), capped, perDayMax);
    if (toInsert.length === 0) return res.json({ ok: true, inserted: 0 });
    const docs = toInsert.map((c) => ({ userId: c.userId, title: c.title, start: c.start, end: c.end, description: c.isBusy ? "" : "" }));
    const result = await Event.insertMany(docs, { ordered: false });
    res.json({ ok: true, inserted: result.length });
  } catch (err) {
    next(err);
  }
});

// POST /seed/all  { clear?: boolean, perDayMax?: number }
router.post("/all", async (req: AuthedRequest, res, next) => {
  try {
    const adminId = req.userId;
    if (!adminId) return res.status(401).json({ error: "unauthorized" });
    // Optional admin check
    const adminUser = await User.findById(adminId).lean();
    if (!adminUser || !adminUser.admin) return res.status(403).json({ error: "forbidden" });

    const perDayMax = Math.min(Number(req.body?.perDayMax ?? 3), 5);
    const clear = req.body?.clear !== false;
    const cid = (req.headers["x-seed-req"] as string) || "-";
    const now = dayjs().utc();
    const monday = now.startOf("week").add(1, "day");
    const weekEnd = monday.add(7, "day");
    const users = await User.find({}, { _id: 1 }).lean();
    console.log(`[SEED:all:init] by=${adminId} cid=${cid} users=${users.length} range=[${monday.toISOString()}..${weekEnd.toISOString()}) clear=${clear} perDayMax=${perDayMax}`);
    let totalInserted = 0;
    for (const u of users) {
      const uid = u._id as Types.ObjectId;
      if (clear) {
        await Event.deleteMany({ userId: uid, start: { $gte: monday.toDate(), $lt: weekEnd.toDate() } });
      }
      const cands = await randomEventsForRange({ userId: uid, start: monday.toDate(), end: weekEnd.toDate(), perDayMax });
      const capped = enforcePerDayCap(cands, perDayMax);
      const toInsert = clear ? capped : await topUpToCap(uid, monday.toDate(), weekEnd.toDate(), capped, perDayMax);
      if (toInsert.length === 0) continue;
      const docs = toInsert.map((c) => ({ userId: c.userId, title: c.title, start: c.start, end: c.end, description: c.isBusy ? "" : "" }));
      const result = await Event.insertMany(docs, { ordered: false });
      totalInserted += result.length;
      console.log(`[SEED:all:user] uid=${uid} inserted=${result.length}`);
    }
    console.log(`[SEED:all:done] totalInserted=${totalInserted}`);
    res.json({ ok: true, inserted: totalInserted });
  } catch (err) {
    next(err);
  }
});

// POST /seed/reset-sample  { domain: string, emails?: string[] }
router.post("/reset-sample", async (req: AuthedRequest, res, next) => {
  try {
    const adminId = req.userId;
    if (!adminId) return res.status(401).json({ error: "unauthorized" });
    const adminUser = await User.findById(adminId).lean();
    if (!adminUser || !adminUser.admin) return res.status(403).json({ error: "forbidden" });

    const domain = req.body?.domain as string | undefined;
    const emails = Array.isArray(req.body?.emails) ? (req.body.emails as string[]) : [];
    const clauses: any[] = [];
    if (domain) clauses.push({ email: { $regex: new RegExp(`@${domain}$`, "i") } });
    if (emails.length) clauses.push({ email: { $in: emails } });
    if (!clauses.length) return res.status(400).json({ error: "domain or emails required" });

    const users = await User.find({ $or: clauses }, { _id: 1, email: 1 }).lean();
    const ids = users.map((u) => u._id as Types.ObjectId);
    if (!ids.length) return res.json({ ok: true, removedUsers: 0, removedEvents: 0 });

    // remove events
    const del = await Event.deleteMany({ userId: { $in: ids } });
    // pull from friends arrays
    await User.updateMany({ friends: { $in: ids } }, { $pull: { friends: { $in: ids } } });
    // remove the users
    const udel = await User.deleteMany({ _id: { $in: ids } });
    res.json({ ok: true, removedUsers: udel.deletedCount, removedEvents: del.deletedCount });
  } catch (err) {
    next(err);
  }
});

// POST /seed/full-week-user { userId, startHour, endHour, clear }
router.post("/full-week-user", async (req: AuthedRequest, res, next) => {
  try {
    const adminId = req.userId;
    if (!adminId) return res.status(401).json({ error: "unauthorized" });
    const adminUser = await User.findById(adminId).lean();
    if (!adminUser || !adminUser.admin) return res.status(403).json({ error: "forbidden" });

    const { userId, startHour = 8, endHour = 22, clear = true } = req.body || {};
    if (!userId) return res.status(400).json({ error: "userId required" });
    const uid = new Types.ObjectId(userId);

    const now = dayjs().utc();
    const monday = now.startOf("week").add(1, "day");
    const nextMonday = monday.add(7, "day");

    if (clear) await Event.deleteMany({ userId: uid, start: { $gte: monday.toDate(), $lt: nextMonday.toDate() } });

    const docs: any[] = [];
    let day = monday;
    while (day.isBefore(nextMonday)) {
      const s = day.hour(startHour).minute(0).second(0).toDate();
      const e = day.hour(endHour).minute(0).second(0).toDate();
      docs.push({ userId: uid, title: "Busy Block", start: s, end: e });
      day = day.add(1, "day");
    }
    if (!docs.length) return res.json({ ok: true, created: 0 });
    const result = await Event.insertMany(docs, { ordered: false });
    res.json({ ok: true, created: result.length });
  } catch (err) {
    next(err);
  }
});

// POST /seed/dedupe  - remove duplicate events (same userId + start + end + title)
router.post("/dedupe", async (req: AuthedRequest, res, next) => {
  try {
    const adminId = req.userId;
    if (!adminId) return res.status(401).json({ error: "unauthorized" });
    const adminUser = await User.findById(adminId).lean();
    if (!adminUser || !adminUser.admin) return res.status(403).json({ error: "forbidden" });

    const dupes = await Event.aggregate([
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
    for (const d of dupes) {
      const ids: Types.ObjectId[] = d.ids as Types.ObjectId[];
      // keep first, remove the rest
      const toRemove = ids.slice(1);
      if (toRemove.length) {
        const r = await Event.deleteMany({ _id: { $in: toRemove } });
        removed += r.deletedCount || 0;
      }
    }
    res.json({ ok: true, removed });
  } catch (err) {
    next(err);
  }
});

export default router;
