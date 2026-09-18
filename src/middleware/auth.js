
// middleware/auth.js

import jwt from "jsonwebtoken";

export const authMiddleware = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        message: "No autorizado",
      });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    // Guardar el payload completo del usuario
    req.user = decoded;

    // 🔥 ID del usuario autenticado
    req.userId = decoded.userId;

    next();
  } catch (error) {
    console.error("Error autenticando:", error.message);

    return res.status(401).json({
      message: "Token inválido",
    });
  }
};

