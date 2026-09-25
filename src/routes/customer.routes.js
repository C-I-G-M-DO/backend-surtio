import express from "express";

import {
  buscarClientePorTelefono,
  crearCliente,
} from "../controllers/customer.controller.js";

import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();

// Buscar cliente por teléfono
router.get(
  "/telefono/:telefono",
  authMiddleware,
  buscarClientePorTelefono
);

// Crear cliente
router.post(
  "/",
  authMiddleware,
  crearCliente
);

export default router;