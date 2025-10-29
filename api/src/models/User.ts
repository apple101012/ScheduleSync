import mongoose from "mongoose"

const UserSchema = new mongoose.Schema({
  email: { type: String, unique: true, index: true },
  name: String,
  passwordHash: String,
  friends: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }]
}, { timestamps: true })

export type UserDoc = mongoose.InferSchemaType<typeof UserSchema> & { _id: any }
export default mongoose.model("User", UserSchema)
