import express from "express";
import { crearVenta, obtenerVentas } from "../controllers/saleController.js";
import { authMiddleware } from "../middleware/auth.js";
const router = express.Router();

//  Crear nueva venta
router.post("/", authMiddleware, crearVenta);

//  Obtener historial de ventas del colmado logueado
router.get("/", authMiddleware, obtenerVentas);

export default router;