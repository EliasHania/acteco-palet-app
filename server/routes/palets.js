import express from "express";
import {
  getPalets,
  createPalet,
  deletePaletPorId,
  getPaletsPorFecha,
  getPaletByCodeAndDate, // 👈 añade esta importación
} from "../controllers/paletController.js";
import { verifyToken } from "../middleware/verifyToken.js";

const router = express.Router();

// Obtener todos los palets (limitado por frontend al día actual)
router.get("/", verifyToken, getPalets);

// Obtener palets por fecha (usado por el panel admin)
router.get("/fecha", verifyToken, getPaletsPorFecha);

// 🔎 NUEVO: obtener un palet por código + fecha (opcional: turno)
router.get("/by-code", verifyToken, getPaletByCodeAndDate);

// Crear nuevo palet
router.post("/", verifyToken, createPalet);

// Eliminar un palet por ID (solo permitido a Yoana y Lidia)
router.delete("/:id", verifyToken, deletePaletPorId);

export default router;
