import mongoose from "mongoose";

export const ROLES = ["yoana", "lidia", "admin", "almacen", "manuel"];

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ROLES,
      required: true,
      default: "yoana",
    },
  },
  { timestamps: true, collection: "users" }
);

// evita OverwriteModelError en dev/hot-reload
export default mongoose.models.User || mongoose.model("User", userSchema);
