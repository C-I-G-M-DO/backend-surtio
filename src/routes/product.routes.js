import express from "express";

import {
  crearProducto,
  obtenerProductos,
  actualizarStock,
  eliminarProducto,
} from "../controllers/product.controller.js";

import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();

router.post("/", authMiddleware, crearProducto);

router.get("/", authMiddleware, obtenerProductos);

// Actualizar stock de un producto
router.patch("/:id/stock", authMiddleware, actualizarStock);

// Eliminar producto
router.delete("/:id", authMiddleware, eliminarProducto);

export default router;