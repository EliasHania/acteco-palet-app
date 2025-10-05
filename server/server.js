import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import http from "http";
import { Server } from "socket.io";

import paletRoutes from "./routes/palets.js";
import authRoutes from "./routes/auth.js";
import trabajadoraRoutes from "./routes/trabajadoras.js";
import cajaRoutes from "./routes/cajas.js";
import scansRoutes from "./routes/scans.js";
import almacenRoutes from "./routes/almacen.js"; // 👈 NUEVO

dotenv.config();

const app = express();
const server = http.createServer(app);

// ✅ Lista de orígenes permitidos (local + Netlify)
const allowedOrigins = [
  "http://localhost:5173",
  "https://acteco-algeciras.netlify.app",
];

const io = new Server(server, {
  cors: { origin: allowedOrigins },
});

// ✅ Middleware CORS para Express
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) callback(null, true);
      else callback(new Error("CORS bloqueado para: " + origin));
    },
    credentials: true,
  })
);

app.use(express.json());

// Mongo
mongoose
  .connect(process.env.MONGO_URL)
  .then(() => console.log("✅ Conectado a MongoDB Atlas"))
  .catch((err) => console.error("❌ Error en MongoDB", err));

// ✅ Ruta raíz para evitar 404 con UptimeRobot
app.get("/", (req, res) => {
  res.status(200).send("Servidor Acteco operativo ✅");
});

// Compartir socket con la app
app.set("socketio", io);

// ====== RUTAS ======
app.use("/api/auth", authRoutes);
app.use("/api/palets", paletRoutes);
app.use("/api/trabajadoras", trabajadoraRoutes);
app.use("/api/cajas", cajaRoutes);
app.use("/api", scansRoutes); // /api/scan
app.use("/api/almacen", almacenRoutes); // 👈 NUEVA (movimientos)

// ====== LISTEN ======
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
});
