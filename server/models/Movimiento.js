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

    /* ===== Comunes ===== */
    fecha: { type: String, required: true, index: true }, // YYYY-MM-DD
    personal: String,
    registradaPor: String,

    // Datos logísticos reutilizados por todos los tipos
    numeroContenedor: String, // ahora común (antes lo usabas en cargas también)
    numeroPrecinto: String, // común
    remolque: String, // NUEVO (lo usas en descarga/carga/mixta)
    tractora: String, // NUEVO (opcional, sólo si lo quieres guardar)
    destino: String, // NUEVO (requerido por reglas en carga y mixta; el controlador valida)

    // Tiempos (comunes)
    timestamp: Date, // llegada en DESCARGA
    timestampLlegada: Date, // llegada en CARGAS (simple/mixta)
    timestampSalida: Date, // salida en cualquier tipo

    /* ===== Específicos ===== */
    // Descarga
    origen: String, // sólo descarga
    palets: { type: Number, min: 0 },
    numeroCajas: { type: Number, min: 0 },

    // Carga simple
    empresaTransportista: String,
    tipoPalet: String,
    numeroPalets: { type: Number, min: 1 },

    // Carga mixta
    items: [ItemMixtoSchema],
    totalPalets: { type: Number, min: 1 },
  },
  { timestamps: true, collection: "movimientos" }
);

export default mongoose.models.Movimiento ||
  mongoose.model("Movimiento", MovimientoSchema);
