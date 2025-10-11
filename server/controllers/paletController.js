// controllers/paletController.js
import Palet from "../models/Palet.js";
import { DateTime } from "luxon";

/**
 * Devuelve todos los palets.
 * Opcional: ?date=YYYY-MM-DD (día en Europe/Madrid)
 */
export const getPalets = async (req, res) => {
  try {
    const { date } = req.query;

    const query = {};
    if (date) {
      const start = DateTime.fromISO(date, {
        setZone: true,
        zone: "Europe/Madrid",
      })
        .startOf("day")
        .toJSDate();
      const end = DateTime.fromISO(date, {
        setZone: true,
        zone: "Europe/Madrid",
      })
        .endOf("day")
        .toJSDate();
      query.timestamp = { $gte: start, $lte: end };
    }

    const palets = await Palet.find(query).sort({ timestamp: 1 });
    res.json(palets);
  } catch (err) {
    console.error("❌ Error en getPalets:", err);
    res.status(500).json({ msg: "Error al obtener palets" });
  }
};

/**
 * Crea un palet nuevo.
 * Valida que el mismo código no se haya registrado ya HOY (Europe/Madrid).
 * Sella el timestamp en servidor usando hora de Madrid.
 */
export const createPalet = async (req, res) => {
  try {
    const { trabajadora, tipo, codigo, registradaPor } = req.body;

    if (!codigo) {
      return res.status(400).json({ msg: "Código requerido" });
    }

    // Hora oficial (día) en Madrid
    const nowMadrid = DateTime.now().setZone("Europe/Madrid");
    const start = nowMadrid.startOf("day").toJSDate();
    const end = nowMadrid.endOf("day").toJSDate();

    // ¿Ese código ya está hoy?
    const yaExiste = await Palet.exists({
      codigo,
      timestamp: { $gte: start, $lte: end },
    });

    if (yaExiste) {
      // 409 Conflict: duplicado en el mismo día
      return res.status(409).json({ msg: "YA_REGISTRADO_HOY" });
    }

    // Guardamos con timestamp del servidor (no confiar en el cliente)
    const nuevoPalet = new Palet({
      trabajadora,
      tipo,
      codigo,
      registradaPor,
      timestamp: nowMadrid.toJSDate(),
    });

    await nuevoPalet.save();

    // Emitimos evento a los clientes conectados
    const io = req.app.get("socketio");
    io.emit("nuevoPalet", nuevoPalet);

    res.status(201).json(nuevoPalet);
  } catch (err) {
    console.error("❌ Error al crear palet:", err);
    res.status(500).json({ msg: "Error al guardar el palet" });
  }
};

/**
 * Elimina todos los palets (solo admin).
 */
export const deleteAll = async (req, res) => {
  try {
    await Palet.deleteMany();
    res.json({ msg: "Todos los palets eliminados" });
  } catch (err) {
    console.error("❌ Error al eliminar todos los palets:", err);
    res.status(500).json({ msg: "Error al eliminar palets" });
  }
};

/**
 * Elimina todos los palets de una trabajadora concreta.
 */
export const deleteByTrabajadora = async (req, res) => {
  try {
    const { nombre } = req.params;
    await Palet.deleteMany({ trabajadora: nombre });
    res.json({ msg: `Palets de ${nombre} eliminados` });
  } catch (err) {
    console.error("❌ Error al eliminar por trabajadora:", err);
    res.status(500).json({ msg: "Error al eliminar palets de la trabajadora" });
  }
};

/**
 * Elimina un palet por ID.
 */
export const deletePaletPorId = async (req, res) => {
  try {
    await Palet.findByIdAndDelete(req.params.id);
    res.json({ msg: "Palet eliminado correctamente" });
  } catch (err) {
    console.error("❌ Error al eliminar palet por ID:", err);
    res.status(500).json({ msg: "Error al eliminar palet" });
  }
};

/**
 * Devuelve palets de un día concreto (yyyy-mm-dd) en Madrid.
 */
export const getPaletsPorFecha = async (req, res) => {
  try {
    const fecha = req.query.fecha;
    if (!fecha) return res.status(400).json({ msg: "Fecha requerida" });

    const inicio = DateTime.fromISO(fecha, {
      setZone: true,
      zone: "Europe/Madrid",
    })
      .startOf("day")
      .toJSDate();
    const fin = DateTime.fromISO(fecha, {
      setZone: true,
      zone: "Europe/Madrid",
    })
      .endOf("day")
      .toJSDate();

    const palets = await Palet.find({
      timestamp: { $gte: inicio, $lte: fin },
    });

    res.json(palets);
  } catch (err) {
    console.error("❌ Error al obtener palets por fecha:", err);
    res.status(500).json({ msg: "Error al obtener palets por fecha" });
  }
};

/**
 * Busca un palet por código + fecha (opcional: turno = 'yoana' | 'lidia')
 */
export const getPaletByCodeAndDate = async (req, res) => {
  try {
    const { code, date, turno } = req.query;
    if (!code || !date) {
      return res
        .status(400)
        .json({ msg: "Parámetros 'code' y 'date' requeridos" });
    }

    const start = DateTime.fromISO(date, {
      setZone: true,
      zone: "Europe/Madrid",
    })
      .startOf("day")
      .toJSDate();
    const end = DateTime.fromISO(date, { setZone: true, zone: "Europe/Madrid" })
      .endOf("day")
      .toJSDate();

    const q = { codigo: code, timestamp: { $gte: start, $lte: end } };
    if (turno) q.registradaPor = turno; // opcional

    const doc = await Palet.findOne(q).lean();
    return res.status(200).json(doc || null);
  } catch (err) {
    console.error("❌ Error en getPaletByCodeAndDate:", err);
    res.status(500).json({ msg: "Error al buscar palet" });
  }
};
