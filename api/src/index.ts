import "dotenv/config";
import express from "express";
import cors from "cors";
import { connectDB } from "./db";
import usersRoutes from "./routes/users";
import seedRoutes from "./routes/seed";


const app = express();
app.use(express.json());
app.use(cors({
  origin: "http://localhost:5173",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// Simple request logger to help debugging
app.use((req, _res, next) => {
  console.log(`[API] ${req.method} ${req.url}`);
  next();
});

import authRoutes from "./routes/auth";
import eventRoutes from "./routes/events";
import friendRoutes from "./routes/friends";

app.use("/auth", authRoutes);
app.use("/events", eventRoutes);
app.use("/friends", friendRoutes);
app.use("/users", usersRoutes);
app.use("/seed", seedRoutes);
app.get("/health", (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT ? Number(process.env.PORT) : 8000;

(async () => {
  try {
    await connectDB();               // ✅ wait for Mongo before listening
    app.listen(PORT, () => console.log(`API on http://localhost:${PORT}`));
  } catch (e) {
    console.error("[API] Failed to start due to DB error:", e);
    process.exit(1);
  }
})();
