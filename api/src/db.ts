import mongoose from "mongoose";

const DEFAULT_URI = "mongodb://127.0.0.1:27017/schedulesync";

// Optional: turn on mongoose query logging with DEBUG_DB=1
if (process.env.DEBUG_DB === "1") {
  mongoose.set("debug", true);
}

// Helpful strictQuery setting (optional)
mongoose.set("strictQuery", true);

export async function connectDB() {
  const uri = process.env.MONGODB_URI || DEFAULT_URI;

  // Be explicit about timeouts; useful on Windows when mongod starts slow
  const opts: mongoose.ConnectOptions = {
    serverSelectionTimeoutMS: 8000,
    socketTimeoutMS: 45000,
    maxPoolSize: 10,
  };

  let attempt = 0;
  const maxAttempts = 5;

  while (true) {
    attempt++;
    try {
      console.log(`[DB] Connecting to ${uri} (attempt ${attempt}/${maxAttempts})`);
      await mongoose.connect(uri, opts);
      console.log("[DB] Connected ✔");
      break;
    } catch (err: any) {
      console.error("[DB] Connection error:", err?.message || err);
      if (attempt >= maxAttempts) {
        console.error("[DB] Giving up after max attempts.");
        throw err;
      }
      const backoffMs = Math.min(5000, attempt * 1000);
      console.log(`[DB] Retrying in ${backoffMs}ms…`);
      await new Promise(r => setTimeout(r, backoffMs));
    }
  }

  mongoose.connection.on("error", (e) => {
    console.error("[DB] Connection error event:", e);
  });
  mongoose.connection.on("disconnected", () => {
    console.warn("[DB] Disconnected");
  });
  mongoose.connection.on("reconnected", () => {
    console.log("[DB] Reconnected");
  });
}

export function isDbReady() {
  return mongoose.connection.readyState === 1; // 1 = connected
}
