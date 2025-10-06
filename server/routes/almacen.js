import express from "express";
import { verifyToken } from "../middleware/verifyToken.js";
import {
  crearMovimiento,
  listarPorFecha,
  listarPorRango,
  completarDescarga,
  cerrarCarga,
} from "../controllers/almacenController.js";

const router = express.Router();

router.post("/movimientos", verifyToken, crearMovimiento);
router.get("/movimientos/fecha", verifyToken, listarPorFecha);
router.get("/movimientos/rango", verifyToken, listarPorRango);

// PASO 2
router.patch("/movimientos/:id/descarga-final", verifyToken, completarDescarga);
router.patch("/movimientos/:id/cerrar-carga", verifyToken, cerrarCarga);

export default router;
