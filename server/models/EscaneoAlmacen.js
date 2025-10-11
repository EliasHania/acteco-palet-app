// models/EscaneoAlmacen.js
import mongoose from "mongoose";

const EscaneoAlmacenSchema = new mongoose.Schema(
  {
    // Metadatos de almacén
    origen: { type: String, default: "almacen" },
    turno: {
      type: String,
      enum: ["yoana", "lidia"],
      required: true,
      lowercase: true,
      trim: true,
    },
    responsableEscaneo: { type: String, required: true, trim: true },
    fecha: { type: String, required: true }, // YYYY-MM-DD
    timestamp: { type: Date, default: Date.now },

    // Clave para deduplicación por día
    codigo: {
      type: String,
      required: true,
      index: true,
      lowercase: true,
      trim: true,
    },
  },
  {
    strict: false, // copia 1:1 el resto de campos del palet
    timestamps: true, // createdAt / updatedAt
    versionKey: false,
    collection: "escaneos_almacen",
    toJSON: {
      transform: (_, ret) => {
        ret.id = ret._id;
        delete ret._id;
      },
    },
  }
);

// Evitar duplicados del mismo código el mismo día
EscaneoAlmacenSchema.index({ codigo: 1, fecha: 1 }, { unique: true });

// (Opcional) acelerar listados por fecha/turno
EscaneoAlmacenSchema.index({ fecha: 1, turno: 1, createdAt: -1 });

export default mongoose.models.EscaneoAlmacen ||
  mongoose.model("EscaneoAlmacen", EscaneoAlmacenSchema);
