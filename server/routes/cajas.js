import express from "express";
import { verifyToken } from "../middleware/verifyToken.js";
import {
  createCaja,
  getCajasPorFecha,
  updateCajaCantidad,
  deleteCaja,
} from "../controllers/cajaController.js";

const router = express.Router();

router.post("/", verifyToken, createCaja);
router.get("/fecha", verifyToken, getCajasPorFecha);
router.patch("/:id", verifyToken, updateCajaCantidad);
router.delete("/:id", verifyToken, deleteCaja);

export default router;
