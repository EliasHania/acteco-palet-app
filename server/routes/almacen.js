import express from "express";
import { verifyToken } from "../middleware/verifyToken.js";
import {
  crearMovimiento,
  listarPorFecha,
  listarPorRango,
} from "../controllers/almacenController.js";

const router = express.Router();

router.post("/movimientos", verifyToken, crearMovimiento);
router.get("/movimientos/fecha", verifyToken, listarPorFecha);
router.get("/movimientos/rango", verifyToken, listarPorRango);

export default router;
