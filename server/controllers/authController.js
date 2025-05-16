// server/controllers/authController.js
import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// 🔧 Ahora el token incluye id, username y role
const generarToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      username: user.username,
      role: user.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );
};

export const login = async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ msg: "Usuario no encontrado" });
    }

    const esValido = await bcrypt.compare(password, user.password);
    if (!esValido) {
      return res.status(401).json({ msg: "Contraseña incorrecta" });
    }

    const token = generarToken(user);
    res.json({
      token,
      username: user.username,
      role: user.role,
    });
  } catch (error) {
    console.error("Error en login:", error);
    res.status(500).json({ msg: "Error de servidor" });
  }
};

export const register = async (req, res) => {
  const { username, password, role } = req.body;
  try {
    const yaExiste = await User.findOne({ username });
    if (yaExiste) {
      return res.status(400).json({ msg: "El usuario ya existe" });
    }

    const hash = await bcrypt.hash(password, 10);
    const nuevoUsuario = new User({ username, password: hash, role });
    await nuevoUsuario.save();

    const token = generarToken(nuevoUsuario);
    res.status(201).json({
      token,
      username: nuevoUsuario.username,
      role: nuevoUsuario.role,
    });
  } catch (error) {
    console.error("Error al registrar:", error);
    res.status(500).json({ msg: "Error de servidor" });
  }
};
