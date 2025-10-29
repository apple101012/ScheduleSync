import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import mongoose from "mongoose"
import authRouter from "./routes/auth"
import eventsRouter from "./routes/events"
import friendsRouter from "./routes/friends"

dotenv.config()
const app = express()
app.use(cors({ origin: "http://localhost:5173", credentials: true }))
app.use(express.json())

app.get("/health", (_req, res) => res.json({ ok: true }))

app.use("/auth", authRouter)
app.use("/events", eventsRouter)
app.use("/friends", friendsRouter)

const PORT = process.env.PORT || 8000

async function start() {
  await mongoose.connect(process.env.MONGO_URI!)
  console.log("Mongo connected")
  app.listen(PORT, () => console.log(`API on :${PORT}`))
}
start().catch(err => {
  console.error(err)
  process.exit(1)
})
