import express from "express";

import {
  crearOrden,
  listarOrdenes,
  despacharOrden,
  eliminarOrden,
} from "../controllers/orderController.js";

import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();

// =========================================================
// CREAR PEDIDO
// POST /api/orders
// =========================================================
router.post("/", authMiddleware, crearOrden);

// =========================================================
// OBTENER PEDIDOS
// GET /api/orders
// GET /api/orders?estado=pendiente
// GET /api/orders?estado=despachada
// GET /api/orders?estado=cancelada
// =========================================================
router.get("/", authMiddleware, listarOrdenes);

// =========================================================
// DESPACHAR PEDIDO
// POST /api/orders/:id/dispatch
// =========================================================
router.post("/:id/dispatch", authMiddleware, despacharOrden);

// =========================================================
// ELIMINAR PEDIDO PENDIENTE
// DELETE /api/orders/:id
// =========================================================
router.delete("/:id", authMiddleware, eliminarOrden);

export default router;