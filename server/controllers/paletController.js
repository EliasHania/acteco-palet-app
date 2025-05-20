import Palet from "../models/Palet.js";

// Obtener todos los palets
export const getPalets = async (req, res) => {
  const { date } = req.query;

  let query = {};
  if (date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    query.timestamp = { $gte: start, $lte: end };
  }

  const palets = await Palet.find(query).sort({ timestamp: 1 });
  res.json(palets);
};

// Crear un nuevo palet y emitir evento vía WebSocket
export const createPalet = async (req, res) => {
  const { trabajadora, tipo, timestamp, codigo, registradaPor } = req.body;

  try {
    const nuevoPalet = new Palet({
      trabajadora,
      tipo,
      timestamp,
      codigo,
      registradaPor,
    });
    await nuevoPalet.save();

    // Emitir a todos los clientes conectados el nuevo palet
    const io = req.app.get("socketio");
    io.emit("nuevoPalet", nuevoPalet);

    res.status(201).json(nuevoPalet);
  } catch (err) {
    console.error("Error al crear palet:", err);
    res.status(500).json({ msg: "Error al guardar el palet" });
  }
};

// Eliminar todos los palets (solo admin)
export const deleteAll = async (req, res) => {
  await Palet.deleteMany();
  res.json({ msg: "Todos los palets eliminados" });
};

// Eliminar todos los palets de una trabajadora (para Yoana o Lidia)
export const deleteByTrabajadora = async (req, res) => {
  const { nombre } = req.params;
  await Palet.deleteMany({ trabajadora: nombre });
  res.json({ msg: `Palets de ${nombre} eliminados` });
};

// Eliminar un palet por ID
export const deletePaletPorId = async (req, res) => {
  try {
    await Palet.findByIdAndDelete(req.params.id);
    res.json({ msg: "Palet eliminado correctamente" });
  } catch (err) {
    res.status(500).json({ msg: "Error al eliminar palet" });
  }
};

// Obtener palets por fecha (yyyy-mm-dd)
export const getPaletsPorFecha = async (req, res) => {
  try {
    const fecha = req.query.fecha;
    if (!fecha) return res.status(400).json({ msg: "Fecha requerida" });

    // Crear rangos UTC correctamente
    const inicio = new Date(`${fecha}T00:00:00.000Z`);
    const fin = new Date(`${fecha}T23:59:59.999Z`);

    const palets = await Palet.find({
      timestamp: { $gte: inicio, $lte: fin },
    });

    res.json(palets);
  } catch (err) {
    res.status(500).json({ msg: "Error al obtener palets por fecha" });
  }
};
