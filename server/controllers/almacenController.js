import Movimiento from "../models/Movimiento.js";

const isYYYYMMDD = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);

export const crearMovimiento = async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.tipo || !["descarga", "carga", "carga-mixta"].includes(b.tipo)) {
      return res.status(400).json({ msg: "Tipo inválido" });
    }

    // Normaliza "fecha" (YYYY-MM-DD) para indexar
    let fecha = b.fecha;
    if (!fecha) {
      const base =
        b.tipo === "descarga"
          ? b.timestamp
          : b.timestampLlegada || b.timestampSalida || Date.now();
      const d = new Date(base);
      fecha = d.toISOString().slice(0, 10);
    }
    if (!isYYYYMMDD(fecha))
      return res.status(400).json({ msg: "Fecha inválida" });

    // Validaciones mínimas por tipo
    if (b.tipo === "descarga") {
      if (
        !b.numeroContenedor ||
        !b.origen ||
        b.palets == null ||
        !b.numeroPrecinto ||
        !b.timestamp
      ) {
        return res.status(400).json({ msg: "Campos de descarga incompletos" });
      }
    } else if (b.tipo === "carga") {
      if (
        !b.empresaTransportista ||
        !b.tipoPalet ||
        !b.numeroPalets ||
        !b.timestampLlegada
      ) {
        return res.status(400).json({ msg: "Campos de carga incompletos" });
      }
    } else if (b.tipo === "carga-mixta") {
      if (
        !b.empresaTransportista ||
        !Array.isArray(b.items) ||
        !b.items.length ||
        !b.timestampLlegada
      ) {
        return res
          .status(400)
          .json({ msg: "Campos de carga mixta incompletos" });
      }
    }

    const doc = await Movimiento.create({ ...b, fecha });
    res.json(doc);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error al guardar movimiento" });
  }
};

export const listarPorFecha = async (req, res) => {
  try {
    const { fecha, tipo } = req.query;
    if (!isYYYYMMDD(fecha))
      return res.status(400).json({ msg: "Fecha inválida" });

    const q = { fecha };
    if (tipo && tipo !== "todos") q.tipo = tipo;

    const data = await Movimiento.find(q).sort({ createdAt: -1 }).lean();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error al listar movimientos" });
  }
};

export const listarPorRango = async (req, res) => {
  try {
    const { from, to, tipo } = req.query;
    if (!isYYYYMMDD(from) || !isYYYYMMDD(to)) {
      return res.status(400).json({ msg: "Rango inválido" });
    }
    const q = { fecha: { $gte: from, $lte: to } };
    if (tipo && tipo !== "todos") q.tipo = tipo;

    const data = await Movimiento.find(q)
      .sort({ fecha: -1, createdAt: -1 })
      .lean();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error al listar rango" });
  }
};
