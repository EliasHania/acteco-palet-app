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

    // ---- Comunes ----
    fecha: { type: String, required: true, index: true }, // YYYY-MM-DD
    personal: String,
    registradaPor: String,

    // ---- Descarga ----
    numeroContenedor: String,
    origen: String,
    palets: { type: Number, min: 0 },
    numeroCajas: { type: Number, min: 0 },
    numeroPrecinto: String,
    timestamp: Date, // hora de llegada / descarga
    timestampSalida: Date, // 👈 válida también para cargas y descargas

    // ---- Carga simple ----
    empresaTransportista: String,
    tipoPalet: String,
    numeroPalets: { type: Number, min: 1 },
    timestampLlegada: Date,

    // ---- Carga mixta ----
    items: [ItemMixtoSchema],
    totalPalets: { type: Number, min: 1 },
  },
  { timestamps: true, collection: "movimientos" }
);

export default mongoose.models.Movimiento ||
  mongoose.model("Movimiento", MovimientoSchema);
