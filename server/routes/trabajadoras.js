import express from "express";
import {
  getTrabajadoras,
  createTrabajadora,
  deleteTrabajadora,
} from "../controllers/trabajadoraController.js";
import { verifyToken } from "../middleware/verifyToken.js";

const router = express.Router();

router.get("/", verifyToken, getTrabajadoras);
router.post("/", verifyToken, createTrabajadora);
router.delete("/:nombre", verifyToken, deleteTrabajadora);

export default router;
