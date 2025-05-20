import mongoose from "mongoose";

const PaletSchema = new mongoose.Schema({
  trabajadora: String,
  tipo: String,
  codigo: String,
  registradaPor: {
    type: String,
    required: true, // ✅ campo obligatorio: 'yoana' o 'lidia'
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.model("Palet", PaletSchema);
