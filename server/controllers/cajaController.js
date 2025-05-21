import Caja from "../models/Caja.js";

// ✅ Crear nueva caja
export const createCaja = async (req, res) => {
  try {
    const { tipo, cantidad } = req.body;
    const registradaPor = req.user.username.toLowerCase();

    const nuevaCaja = new Caja({ tipo, cantidad, registradaPor });
    await nuevaCaja.save();

    res.status(201).json(nuevaCaja);
  } catch (err) {
    console.error("❌ Error al guardar caja:", err);
    res.status(500).json({ msg: "Error al guardar caja" });
  }
};

// ✅ Obtener cajas por fecha
export const getCajasPorFecha = async (req, res) => {
  try {
    const { fecha } = req.query;
    if (!fecha) return res.status(400).json({ msg: "Fecha requerida" });

    const [y, m, d] = fecha.split("-").map(Number);
    const start = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
    const end = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));

    const isAdmin = req.user.username.toLowerCase() === "admin";
    const filter = { timestamp: { $gte: start, $lte: end } };

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
