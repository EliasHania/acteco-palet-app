// server/routes/scans.js
import { Router } from "express";
import { verifyToken } from "../middleware/verifyToken.js";
import { scanQr } from "../controllers/scanController.js";

const router = Router();

// POST /api/scan
router.post("/scan", verifyToken, scanQr);

export default router;
