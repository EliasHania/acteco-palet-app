import Trabajadora from "../models/Trabajadora.js";

// Obtener todas
export const getTrabajadoras = async (req, res) => {
  const lista = await Trabajadora.find().sort({ nombre: 1 });
  res.json(lista.map((t) => t.nombre));
};

// Crear nueva
export const createTrabajadora = async (req, res) => {
  const { nombre } = req.body;
  if (!nombre) return res.status(400).json({ msg: "Nombre requerido" });

  try {
    const existe = await Trabajadora.findOne({ nombre });
    if (existe) return res.status(409).json({ msg: "Ya existe" });

    const nueva = new Trabajadora({ nombre });
    await nueva.save();
    res.status(201).json(nueva);
  } catch (err) {
    res.status(500).json({ msg: "Error en servidor" });
  }
};

// Eliminar por nombre
export const deleteTrabajadora = async (req, res) => {
  const { nombre } = req.params;
  try {
    await Trabajadora.deleteOne({ nombre });
    res.json({ msg: "Eliminada" });
  } catch (err) {
    res.status(500).json({ msg: "Error al eliminar" });
  }
};
