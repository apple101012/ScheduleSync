import mongoose from "mongoose"

const EventSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
  title: String,
  description: String,
  start: { type: Date, index: true },
  end: { type: Date, index: true },
}, { timestamps: true })

export type EventDoc = mongoose.InferSchemaType<typeof EventSchema> & { _id: any }
export default mongoose.model("Event", EventSchema)
