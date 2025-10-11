// routes/almacen.js
import express from "express";
import { verifyToken } from "../middleware/verifyToken.js";
import {
  crearMovimiento,
  listarPorFecha,
  listarPorRango,
  completarDescarga,
  cerrarCarga,
} from "../controllers/almacenController.js";

// 👇 NUEVO: controladores de escaneos de almacén
import {
  crearEscaneoAlmacen,
  listarEscaneosPorFecha,
  listarEscaneosPorRango,
} from "../controllers/escaneosAlmacenController.js";

const router = express.Router();

// ===== MOVIMIENTOS (ya lo tenías) =====
router.post("/movimientos", verifyToken, crearMovimiento);
router.get("/movimientos/fecha", verifyToken, listarPorFecha);
router.get("/movimientos/rango", verifyToken, listarPorRango);
router.patch("/movimientos/:id/descarga-final", verifyToken, completarDescarga);
router.patch("/movimientos/:id/cerrar-carga", verifyToken, cerrarCarga);

// ===== ESCANEOS (nuevo) =====
router.post("/escaneos", verifyToken, crearEscaneoAlmacen);
router.get("/escaneos/fecha", verifyToken, listarEscaneosPorFecha);
router.get("/escaneos/rango", verifyToken, listarEscaneosPorRango);

export default router;
