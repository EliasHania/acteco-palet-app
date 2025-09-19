// server/controllers/scanController.js
import mongoose from "mongoose";
import Palet from "../models/Palet.js";
import { DateTime } from "luxon";

// roles que pueden escanear
const ALLOWED_ROLES = new Set(["admin", "yoana", "lidia", "almacen"]);

// normaliza QR (acepta "QR: 1080-21", espacios, etc.)
const normalizeQR = (raw) =>
  String(raw || "")
    .trim()
    .replace(/^QR[:\s-]*/i, "")
    .replace(/\s+/g, "")
    .toUpperCase();

// rango de HOY en Europe/Madrid -> UTC
const hoyMadridUtc = () => {
  const start = DateTime.now().setZone("Europe/Madrid").startOf("day").toUTC();
  const end = DateTime.now().setZone("Europe/Madrid").endOf("day").toUTC();
  return { startUtc: start.toJSDate(), endUtc: end.toJSDate() };
};

export async function scanQr(req, res) {
  try {
    if (!ALLOWED_ROLES.has(req.user?.role)) {
      return res.status(403).json({ error: "forbidden" });
    }

    const codigoRaw = req.body?.qr;
    const codigo = normalizeQR(codigoRaw);
    if (!codigo) return res.status(400).json({ error: "invalid_qr" });

    const { startUtc, endUtc } = hoyMadridUtc();

    // solo palets del día en curso y registrados por Yoana o Lidia
    const existente = await Palet.findOne({
      codigo: { $in: [codigo, new RegExp(`(^|\\b)${codigo}\\b`, "i")] },
      registradaPor: { $in: [/^yoana$/i, /^lidia$/i] },
      timestamp: { $gte: startUtc, $lte: endUtc },
    }).lean();

    // logging opcional de escaneos
    try {
      const db = mongoose.connection.db;
      await db.collection("scans").insertOne({
        codigo,
        userId: new mongoose.Types.ObjectId(req.user._id),
        role: req.user.role,
        found: !!existente,
        paletId: existente ? existente._id : null,
        createdAt: new Date(),
      });
    } catch {}

    // incidente si no existe (opcional)
    if (!existente) {
      try {
        const db = mongoose.connection.db;
        await db.collection("incidents").insertOne({
          codigo,
          userId: new mongoose.Types.ObjectId(req.user._id),
          status: "new",
          createdAt: new Date(),
        });
      } catch {}
      return res.json({ ok: true, registered: false });
    }

    return res.json({ ok: true, registered: true });
  } catch (err) {
    console.error("scanQr error:", err);
    return res.status(500).json({ error: "server_error" });
  }
}
