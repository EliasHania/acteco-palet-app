import mongoose from "mongoose";

const PaletSchema = new mongoose.Schema({
  trabajadora: String,
  tipo: String,
  codigo: String, // ✅ Añadir esto
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.model("Palet", PaletSchema);
