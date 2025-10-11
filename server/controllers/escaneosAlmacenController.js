// controllers/escaneosAlmacenController.js
import EscaneoAlmacen from "../models/EscaneoAlmacen.js";

const isYYYYMMDD = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);

/**
 * POST /api/almacen/escaneos
 * Guarda una copia íntegra del palet + metadatos de almacén.
 * Requiere: codigo, fecha (YYYY-MM-DD), turno, responsableEscaneo
 * Acepta: cualquier otro campo del palet (strict:false)
 */
export const crearEscaneoAlmacen = async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.codigo) return res.status(400).json({ msg: "Falta 'codigo'" });
    if (!b.turno || !["yoana", "lidia"].includes(b.turno))
      return res.status(400).json({ msg: "Falta o es inválido 'turno'" });
    if (!b.responsableEscaneo || !String(b.responsableEscaneo).trim())
      return res.status(400).json({ msg: "Falta 'responsableEscaneo'" });
    if (!b.fecha || !isYYYYMMDD(b.fecha))
      return res
        .status(400)
        .json({ msg: "Falta o es inválida 'fecha' (YYYY-MM-DD)" });

    // Deduplicación: codigo+fecha
    const exists = await EscaneoAlmacen.findOne({
      codigo: b.codigo,
      fecha: b.fecha,
    }).lean();

    if (exists) {
      return res
        .status(409)
        .json({ msg: "Ya existe un escaneo para ese código hoy" });
    }

    // Crea tal cual (strict:false) + asegura timestamp si no viene
    if (!b.timestamp) b.timestamp = new Date();

    const doc = await EscaneoAlmacen.create(b);
    return res.status(201).json(doc);
  } catch (err) {
    console.error("❌ Error crearEscaneoAlmacen:", err);
    // Manejo de índice único
    if (err?.code === 11000) {
      return res.status(409).json({ msg: "Duplicado: código ya añadido hoy" });
    }
    res.status(500).json({ msg: "Error al guardar escaneo de almacén" });
  }
};

/**
 * GET /api/almacen/escaneos/fecha?fecha=YYYY-MM-DD[&turno=yoana|lidia]
 */
export const listarEscaneosPorFecha = async (req, res) => {
  try {
    const { fecha, turno } = req.query;
    if (!isYYYYMMDD(fecha))
      return res.status(400).json({ msg: "Fecha inválida" });

    const q = { fecha };
    if (turno && ["yoana", "lidia"].includes(turno)) q.turno = turno;

    const data = await EscaneoAlmacen.find(q).sort({ createdAt: -1 }).lean();
    res.json(data);
  } catch (err) {
    console.error("❌ Error listarEscaneosPorFecha:", err);
    res.status(500).json({ msg: "Error al listar escaneos" });
  }
};

/**
 * GET /api/almacen/escaneos/rango?from=YYYY-MM-DD&to=YYYY-MM-DD[&turno=...]
 */
export const listarEscaneosPorRango = async (req, res) => {
  try {
    const { from, to, turno } = req.query;
    if (!isYYYYMMDD(from) || !isYYYYMMDD(to)) {
      return res.status(400).json({ msg: "Rango inválido" });
    }

    const q = { fecha: { $gte: from, $lte: to } };
    if (turno && ["yoana", "lidia"].includes(turno)) q.turno = turno;

    const data = await EscaneoAlmacen.find(q)
      .sort({ fecha: -1, createdAt: -1 })
      .lean();

    res.json(data);
  } catch (err) {
    console.error("❌ Error listarEscaneosPorRango:", err);
    res.status(500).json({ msg: "Error al listar escaneos" });
  }
};
