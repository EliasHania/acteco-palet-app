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

// ✅ Lista de orígenes permitidos (local + Netlify)
const allowedOrigins = ["http://localhost:5173", "https://acteco.netlify.app"];

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
  },
});

// ✅ Middleware CORS para Express
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

// Compartir socket con la app
app.set("socketio", io);

// 🔧 Puerto dinámico (Render usa uno aleatorio)
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
});
