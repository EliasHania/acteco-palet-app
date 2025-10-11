// models/Palet.js
import mongoose from "mongoose";

const PaletSchema = new mongoose.Schema(
  {
    trabajadora: { type: String, trim: true },
    tipo: { type: String, trim: true },
    codigo: { type: String, required: true, trim: true },
    registradaPor: {
      type: String,
      required: true,
      enum: ["yoana", "lidia"], // ✅ controla el turno
      lowercase: true,
      trim: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
    versionKey: false,
    toJSON: {
      transform: (_, ret) => {
        ret.id = ret._id;
        delete ret._id;
      },
    },
  }
);

// ⚡ índices que usas en las consultas
PaletSchema.index({ codigo: 1, timestamp: 1 });
PaletSchema.index({ registradaPor: 1, timestamp: 1 });

export default mongoose.models.Palet || mongoose.model("Palet", PaletSchema);
