import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
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
    enum: ["yoana", "lidia", "admin"],
    required: true,
  },
});

const User = mongoose.model("User", userSchema);
export default User;
