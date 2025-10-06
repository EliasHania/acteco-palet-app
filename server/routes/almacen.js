import express from "express";
import { verifyToken } from "../middleware/verifyToken.js";
import {
  crearMovimiento,
  listarPorFecha,
  listarPorRango,
  completarDescarga, // 👈 nuevo
  cerrarCarga, // 👈 nuevo
} from "../controllers/almacenController.js";

const router = express.Router();

// Paso 1 (crear)
router.post("/movimientos", verifyToken, crearMovimiento);

// Listados
router.get("/movimientos/fecha", verifyToken, listarPorFecha);
router.get("/movimientos/rango", verifyToken, listarPorRango);

// Paso 2 (completar/cerrar)
router.patch("/movimientos/:id/descarga-final", verifyToken, completarDescarga); // palets + cajas + hora salida
router.patch("/movimientos/:id/cerrar-carga", verifyToken, cerrarCarga); // hora salida

export default router;
