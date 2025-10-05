import mongoose from "mongoose";

const ItemMixtoSchema = new mongoose.Schema(
  {
    tipoPalet: { type: String, required: true },
    numeroPalets: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const MovimientoSchema = new mongoose.Schema(
  {
    // "descarga" | "carga" | "carga-mixta"
    tipo: {
      type: String,
      required: true,
      enum: ["descarga", "carga", "carga-mixta"],
    },

    // Para filtros por día (YYYY-MM-DD)
    fecha: { type: String, required: true, index: true },

    // ---- Descarga
    numeroContenedor: String,
    origen: String,
    palets: { type: Number, min: 0 },
    numeroCajas: { type: Number, min: 0 },
    numeroPrecinto: String,
    timestamp: Date,

    // ---- Carga simple
    empresaTransportista: String,
    tipoPalet: String,
    numeroPalets: { type: Number, min: 1 },
    timestampLlegada: Date,
    timestampSalida: Date,

    // ---- Carga mixta
    items: [ItemMixtoSchema],
    totalPalets: { type: Number, min: 1 },

    // ---- Comunes
    personal: String,
    registradaPor: String,
  },
  { timestamps: true, collection: "movimientos" }
);

// ❌ Eliminado: MovimientoSchema.index({ fecha: 1 });

export default mongoose.models.Movimiento ||
  mongoose.model("Movimiento", MovimientoSchema);
