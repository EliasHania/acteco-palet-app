import mongoose from "mongoose";

const cajaSchema = new mongoose.Schema({
  tipo: { type: String, required: true },
  cantidad: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now },
  registradaPor: { type: String, required: true },
});

export default mongoose.model("Caja", cajaSchema);
