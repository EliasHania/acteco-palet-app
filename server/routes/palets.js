import express from "express";
import {
  getPalets,
  createPalet,
  deleteAll,
  deleteByTrabajadora,
  deletePaletPorId,
} from "../controllers/paletController.js";
import { verifyToken } from "../middleware/verifyToken.js";
import { getPaletsPorFecha } from "../controllers/paletController.js";

const router = express.Router();

router.get("/", verifyToken, getPalets);
router.post("/", verifyToken, createPalet);
router.delete("/all", verifyToken, deleteAll);
router.delete("/trabajadora/:nombre", verifyToken, deleteByTrabajadora);
router.delete("/:id", verifyToken, deletePaletPorId);
router.get("/fecha", verifyToken, getPaletsPorFecha);

export default router;
