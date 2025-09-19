// server/controllers/scanController.js
import mongoose from "mongoose";
import Palet from "../models/Palet.js"; // ya lo tienes

export async function scanQr(req, res) {
  try {
    // quién puede escanear
    const allowed = ["admin", "yoana", "lidia", "almacen"];
    if (!allowed.includes(req.user?.role)) {
      return res.status(403).json({ error: "forbidden" });
    }

    const codigo = String(req.body?.qr || "").trim();
    if (!codigo) return res.status(400).json({ error: "invalid_qr" });

    // prefijo de hoy (YYYY-MM-DD) — tu app guarda timestamp como ISO string
    const hoy = new Date().toISOString().split("T")[0];

    // ¿Existe ese palet hoy?
    const existente = await Palet.findOne({
      codigo,
      timestamp: { $regex: `^${hoy}` },
    }).lean();

    // registrar el escaneo (colección ligera, sin modelo)
    const db = mongoose.connection.db;
    await db.collection("scans").insertOne({
      codigo,
      userId: new mongoose.Types.ObjectId(req.user._id),
      role: req.user.role,
      found: !!existente,
      paletId: existente ? existente._id : null,
      createdAt: new Date(),
    });

    // si NO existe, crear incidente para que lo vea la encargada
    if (!existente) {
      await db.collection("incidents").insertOne({
        codigo,
        userId: new mongoose.Types.ObjectId(req.user._id),
        status: "new",
        createdAt: new Date(),
      });
      return res.json({ ok: true, registered: false });
    }

    return res.json({ ok: true, registered: true });
  } catch (err) {
    console.error("scanQr error:", err);
    return res.status(500).json({ error: "server_error" });
  }
}
