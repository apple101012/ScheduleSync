import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  email: string;
  name: string;
  passwordHash: string;
  friends: mongoose.Types.ObjectId[];
  admin?: boolean;
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, unique: true, required: true },
    name: { type: String, required: true },
    passwordHash: { type: String, required: true },
    friends: [{ type: Schema.Types.ObjectId, ref: "User" }],
    admin: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model<IUser>("User", UserSchema);
