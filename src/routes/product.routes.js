import express from "express";

import {
  crearProducto,
  obtenerProductos,
  actualizarStock,
  eliminarProducto,
  actualizarPrecios,
  retirarLoteVencido,
  actualizarStockMinimo,
} from "../controllers/product.controller.js";

import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();

router.post("/", authMiddleware, crearProducto);

router.get("/", authMiddleware, obtenerProductos);

// Actualizar stock de un producto
router.patch("/:id/stock", authMiddleware, actualizarStock);

// Actualizar stock mínimo de un producto
router.patch(
  "/:id/stock-minimo",
  authMiddleware,
  actualizarStockMinimo
);

// Eliminar producto
router.delete("/:id", authMiddleware, eliminarProducto);

// Actualizar precio
router.patch("/:id/precios", authMiddleware, actualizarPrecios);

router.patch(
  "/:id/lotes/:loteId/retirar-vencido",
  authMiddleware,
  retirarLoteVencido
);

export default router;