import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import http from "http";
import { Server } from "socket.io";

import paletRoutes from "./routes/palets.js";
import authRoutes from "./routes/auth.js";

dotenv.config();

const app = express();
const server = http.createServer(app);

// Detectar origen permitido dinámicamente para CORS
const allowedOrigins = [
  "http://localhost:5173",
  "https://tudominio.netlify.app", // <-- cámbialo cuando tengas la URL de Netlify
];

const io = new Server(server, {
  cors: { origin: allowedOrigins },
});

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("CORS bloqueado para: " + origin));
      }
    },
    credentials: true,
  })
);

app.use(express.json());

mongoose
  .connect(process.env.MONGO_URL)
  .then(() => console.log("✅ Conectado a MongoDB Atlas"))
  .catch((err) => console.error("❌ Error en MongoDB", err));

app.use("/api/palets", paletRoutes);
app.use("/api/auth", authRoutes);

app.set("socketio", io);

// 🔧 Escuchar en puerto dinámico para producción
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
});
