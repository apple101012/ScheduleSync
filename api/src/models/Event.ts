import mongoose, { Schema, Document } from "mongoose";

export interface IEvent extends Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  start: Date;
  end: Date;
  createdAt: Date;
  updatedAt: Date;
}

const EventSchema = new Schema<IEvent>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true, required: true },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    start: { type: Date, index: true, required: true },
    end: { type: Date, index: true, required: true },
  },
  { timestamps: true }
);

// Prevent exact duplicates for a user in the same exact window with same title
EventSchema.index(
  { userId: 1, start: 1, end: 1, title: 1 },
  { unique: true, name: "uniq_user_time_title" }
);

export default mongoose.model<IEvent>("Event", EventSchema);
