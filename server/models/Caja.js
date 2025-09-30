// models/Caja.js
import mongoose from "mongoose";

const cajaSchema = new mongoose.Schema({
  tipo: { type: String, required: true },
  cantidad: { type: Number, required: true, min: 1 },
  trabajadora: { type: String, default: null }, // 👈 NUEVO
  registradaPor: { type: String, required: true, lowercase: true },
  timestamp: { type: Date, default: Date.now },
});

export default mongoose.model("Caja", cajaSchema);
