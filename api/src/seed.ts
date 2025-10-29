import dotenv from "dotenv"
dotenv.config()
import mongoose from "mongoose"
import User from "./models/User"
import Event from "./models/Event"

function randomInt(a: number, b: number) { return Math.floor(Math.random() * (b - a + 1)) + a }
function shiftHours(d: Date, h: number) { const x = new Date(d); x.setHours(x.getHours() + h, 0, 0, 0); return x }

async function main() {
  await mongoose.connect(process.env.MONGO_URI!)
  await User.deleteMany({})
  await Event.deleteMany({})

  const users = await User.insertMany([
    { email: "you@example.com", name: "You", passwordHash: "seed" },
    { email: "alice@example.com", name: "Alice", passwordHash: "seed" },
    { email: "bob@example.com", name: "Bob", passwordHash: "seed" },
    { email: "charlie@example.com", name: "Charlie", passwordHash: "seed" }
  ])

  // make everyone friends with you
  const me = users[0]
  me.friends = users.slice(1).map(u => u._id)
  await me.save()

  // generate week of events for each
  const startOfWeek = (() => {
    const d = new Date()
    const day = d.getDay() // 0 Sun
    const diff = d.getDate() - day // back to Sunday
    const sun = new Date(d); sun.setDate(diff); sun.setHours(0,0,0,0)
    return sun
  })()

  const titles = ["Lecture", "Study", "Gym", "Work Shift", "Group Project", "Meeting", "Commute", "Lunch"]

  for (const u of users) {
    for (let day = 0; day < 7; day++) {
      const base = new Date(startOfWeek); base.setDate(base.getDate() + day)
      const blocks = randomInt(2, 4)
      for (let i = 0; i < blocks; i++) {
        const startHour = randomInt(8, 18)
        const dur = [1, 1.5, 2, 3][randomInt(0, 3)]
        const s = new Date(base); s.setHours(startHour, 0, 0, 0)
        const e = shiftHours(s, dur)
        await Event.create({
          owner: u._id,
          title: titles[randomInt(0, titles.length - 1)],
          description: "Seeded event",
          start: s,
          end: e
        })
      }
    }
  }

  console.log("Seed complete")
  await mongoose.disconnect()
}

main().catch(err => { console.error(err); process.exit(1) })
