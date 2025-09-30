import Caja from "../models/Caja.js";
import { DateTime } from "luxon";

// ✅ Crear nueva caja
export const createCaja = async (req, res) => {
  try {
    const { tipo, cantidad, trabajadora, registradaPor } = req.body; // 👈 leer del body
    const userReg = (req.user?.username || registradaPor || "").toLowerCase();

    const nuevaCaja = new Caja({
      tipo,
      cantidad,
      trabajadora: trabajadora || null, // 👈 guardar
      registradaPor: userReg,
    });

    await nuevaCaja.save();
    res.status(201).json(nuevaCaja);
  } catch (err) {
    console.error("❌ Error al guardar caja:", err);
    res.status(500).json({ msg: "Error al guardar caja" });
  }
};

// ✅ Obtener cajas por fecha con Luxon (zona horaria Madrid)
export const getCajasPorFecha = async (req, res) => {
  try {
    const { fecha } = req.query;
    if (!fecha) return res.status(400).json({ msg: "Fecha requerida" });

    // Luxon: convertir la fecha recibida al inicio y fin del día en zona horaria de Madrid
    const start = DateTime.fromISO(fecha, { zone: "Europe/Madrid" })
      .startOf("day")
      .toUTC();
    const end = DateTime.fromISO(fecha, { zone: "Europe/Madrid" })
      .endOf("day")
      .toUTC();

    const isAdmin = req.user.username.toLowerCase() === "admin";
    const filter = {
      timestamp: { $gte: start.toJSDate(), $lte: end.toJSDate() },
    };

    if (!isAdmin) {
      filter.registradaPor = req.user.username.toLowerCase();
    }

    const cajas = await Caja.find(filter).sort({ timestamp: 1 });
    res.json(cajas);
  } catch (err) {
    console.error("❌ Error al obtener cajas:", err);
    res.status(500).json({ msg: "Error al obtener cajas" });
  }
};

// ✅ Actualizar cantidad de una caja
export const updateCajaCantidad = async (req, res) => {
  try {
    const { id } = req.params;
    const { cantidad } = req.body;

    const caja = await Caja.findById(id);
    if (!caja) return res.status(404).json({ msg: "Caja no encontrada" });

    caja.cantidad = cantidad;
    await caja.save();

    res.json(caja);
  } catch (err) {
    console.error("❌ Error al actualizar caja:", err);
    res.status(500).json({ msg: "Error al actualizar caja" });
  }
};

// ✅ Eliminar una caja por ID
export const deleteCaja = async (req, res) => {
  try {
    await Caja.findByIdAndDelete(req.params.id);
    res.json({ msg: "Caja eliminada correctamente" });
  } catch (err) {
    console.error("❌ Error al eliminar caja:", err);
    res.status(500).json({ msg: "Error al eliminar caja" });
  }
};
