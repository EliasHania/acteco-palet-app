import Movimiento from "../models/Movimiento.js";

const isYYYYMMDD = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);

/**
 * POST /api/almacen/movimientos
 * PASO 1:
 * - Descarga: todos obligatorios (sin palets/numeroCajas/salida)
 * - Carga/Carga-mixta: todos obligatorios excepto tractora y numeroContenedor
 */
export const crearMovimiento = async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.tipo || !["descarga", "carga", "carga-mixta"].includes(b.tipo)) {
      return res.status(400).json({ msg: "Tipo inválido" });
    }

    // -------- Normalizaciones suaves --------
    const trim = (v) => (v == null ? v : String(v).trim());
    b.numeroContenedor = trim(b.numeroContenedor);
    b.numeroPrecinto = trim(b.numeroPrecinto);
    b.origen = trim(b.origen);
    b.empresaTransportista = trim(b.empresaTransportista);
    b.tipoPalet = trim(b.tipoPalet);
    b.personal = trim(b.personal);
    b.tractora = trim(b.tractora); // opcional en carga/mixta
    b.remolque = trim(b.remolque); // requerido en carga/mixta según tu última instrucción

    // -------- Fecha (YYYY-MM-DD) para indexar --------
    let fecha = b.fecha;
    if (!fecha) {
      const base =
        b.tipo === "descarga"
          ? b.timestamp ?? Date.now() // llegada descarga
          : b.timestampLlegada ?? b.timestampSalida ?? Date.now();
      const d = new Date(base);
      fecha = d.toISOString().slice(0, 10);
    }
    if (!isYYYYMMDD(fecha)) {
      return res.status(400).json({ msg: "Fecha inválida" });
    }

    // -------- Validaciones estrictas por tipo (PASO 1) --------
    if (b.tipo === "descarga") {
      // TODOS OBLIGATORIOS EN PASO 1
      if (!b.numeroContenedor)
        return res.status(400).json({ msg: "Falta número de contenedor" });
      if (!b.origen) return res.status(400).json({ msg: "Falta origen" });
      if (!b.numeroPrecinto)
        return res.status(400).json({ msg: "Falta número de precinto" });
      if (!b.timestamp)
        return res.status(400).json({ msg: "Falta hora de llegada" });
      if (!b.personal)
        return res.status(400).json({ msg: "Faltan responsables" });

      const t = new Date(b.timestamp);
      if (isNaN(t.getTime()))
        return res.status(400).json({ msg: "timestamp inválido" });
    } else if (b.tipo === "carga") {
      // Opcionales SOLO: tractora y numeroContenedor
      // Requeridos:
      if (!b.empresaTransportista)
        return res.status(400).json({ msg: "Falta empresa transportista" });
      if (!b.tipoPalet)
        return res.status(400).json({ msg: "Falta tipo de palet" });

      b.numeroPalets = Number(b.numeroPalets);
      if (!Number.isFinite(b.numeroPalets) || b.numeroPalets <= 0)
        return res.status(400).json({ msg: "Número de palets inválido" });

      if (!b.timestampLlegada)
        return res.status(400).json({ msg: "Falta hora de llegada" });
      if (!b.numeroPrecinto)
        return res.status(400).json({ msg: "Falta número de precinto" });
      if (!b.remolque) return res.status(400).json({ msg: "Falta remolque" });
      if (!b.personal)
        return res.status(400).json({ msg: "Faltan responsables" });

      const t = new Date(b.timestampLlegada);
      if (isNaN(t.getTime()))
        return res.status(400).json({ msg: "timestampLlegada inválido" });
    } else if (b.tipo === "carga-mixta") {
      // Opcionales SOLO: tractora y numeroContenedor
      // Requeridos:
      if (!b.empresaTransportista)
        return res.status(400).json({ msg: "Falta empresa transportista" });
      if (!Array.isArray(b.items) || b.items.length === 0)
        return res.status(400).json({ msg: "Faltan líneas de palets" });

      let suma = 0;
      for (const it of b.items) {
        const tipo = trim(it.tipoPalet);
        const n = Number(it.numeroPalets);
        if (!tipo || !Number.isFinite(n) || n <= 0)
          return res.status(400).json({ msg: "Item de mixta inválido" });
        suma += n;
      }

      b.totalPalets = Number(b.totalPalets);
      if (
        !Number.isFinite(b.totalPalets) ||
        b.totalPalets <= 0 ||
        b.totalPalets !== suma
      )
        return res.status(400).json({ msg: "Total de palets inválido" });

      if (!b.timestampLlegada)
        return res.status(400).json({ msg: "Falta hora de llegada" });
      if (!b.numeroPrecinto)
        return res.status(400).json({ msg: "Falta número de precinto" });
      if (!b.remolque) return res.status(400).json({ msg: "Falta remolque" });
      if (!b.personal)
        return res.status(400).json({ msg: "Faltan responsables" });

      const t = new Date(b.timestampLlegada);
      if (isNaN(t.getTime()))
        return res.status(400).json({ msg: "timestampLlegada inválido" });
    }

    const doc = await Movimiento.create({ ...b, fecha });
    return res.status(201).json(doc);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error al guardar movimiento" });
  }
};

/**
 * PATCH /api/almacen/movimientos/:id/descarga-final
 * PASO 2 Descarga: palets + numeroCajas + timestampSalida son OBLIGATORIOS
 */
export const completarDescarga = async (req, res) => {
  try {
    const { id } = req.params;
    let { palets, numeroCajas, timestampSalida } = req.body || {};

    // TODOS obligatorios
    if (palets == null || numeroCajas == null || !timestampSalida) {
      return res
        .status(400)
        .json({ msg: "Faltan nº palets, nº cajas y/o hora de salida" });
    }

    palets = Number(palets);
    numeroCajas = Number(numeroCajas);
    const ts = new Date(timestampSalida);

    if (!Number.isFinite(palets) || palets < 0)
      return res.status(400).json({ msg: "Palets inválido" });
    if (!Number.isFinite(numeroCajas) || numeroCajas < 0)
      return res.status(400).json({ msg: "Número de cajas inválido" });
    if (isNaN(ts.getTime()))
      return res.status(400).json({ msg: "timestampSalida inválido" });

    const doc = await Movimiento.findById(id);
    if (!doc) return res.status(404).json({ msg: "No encontrado" });
    if (doc.tipo !== "descarga") {
      return res.status(400).json({ msg: "El movimiento no es una descarga" });
    }

    doc.palets = palets;
    doc.numeroCajas = numeroCajas;
    doc.timestampSalida = ts;
    await doc.save();

    res.json(doc);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error al completar descarga" });
  }
};

/**
 * PATCH /api/almacen/movimientos/:id/cerrar-carga
 * PASO 2 Carga/Carga-mixta: sólo timestampSalida OBLIGATORIO
 */
export const cerrarCarga = async (req, res) => {
  try {
    const { id } = req.params;
    const { timestampSalida } = req.body || {};
    if (!timestampSalida)
      return res.status(400).json({ msg: "Falta hora de salida" });

    const ts = new Date(timestampSalida);
    if (isNaN(ts.getTime())) {
      return res.status(400).json({ msg: "timestampSalida inválido" });
    }

    const doc = await Movimiento.findById(id);
    if (!doc) return res.status(404).json({ msg: "No encontrado" });
    if (doc.tipo !== "carga" && doc.tipo !== "carga-mixta") {
      return res.status(400).json({ msg: "El movimiento no es una carga" });
    }

    doc.timestampSalida = ts;
    await doc.save();
    res.json(doc);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error al cerrar carga" });
  }
};

/**
 * GET /api/almacen/movimientos/fecha?fecha=YYYY-MM-DD&tipo=(todos|descarga|carga|carga-mixta)
 */
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

/**
 * GET /api/almacen/movimientos/rango?from=YYYY-MM-DD&to=YYYY-MM-DD&tipo=(...)
 */
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
