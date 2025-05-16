// ✅ Nuevo seedUsers.js con soporte robusto para .env
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import User from "../models/User.js";

// Soporte robusto para .env esté donde esté
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const MONGO_URI = process.env.MONGO_URL;

if (!MONGO_URI) {
  console.error("❌ MONGO_URL no está definido en el archivo .env");
  process.exit(1);
}

const usuarios = [
  { username: "yoana", password: "1995", role: "yoana" },
  { username: "lidia", password: "1995", role: "lidia" },
  { username: "admin", password: "admin123", role: "admin" },
];

async function seedUsers() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Conectado a MongoDB");

    await User.deleteMany();
    console.log("🧹 Usuarios anteriores eliminados");

    const hashed = await Promise.all(
      usuarios.map(async (u) => ({
        ...u,
        password: await bcrypt.hash(u.password, 10),
      }))
    );

    await User.insertMany(hashed);
    console.log("✅ Usuarios insertados correctamente");
    process.exit();
  } catch (err) {
    console.error("❌ Error insertando usuarios:", err);
    process.exit(1);
  }
}

seedUsers();
