// routes/product.routes.js
import express from "express";
import { crearProducto, obtenerProductos } from "../controllers/product.controller.js";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();

router.post("/", authMiddleware, crearProducto);
router.get("/", authMiddleware, obtenerProductos);

export default router;