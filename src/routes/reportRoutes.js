import express from "express";

import {
  obtenerReportePorRango,
  obtenerReporteDiario,
  listarReportesDiarios,
} from "../controllers/reportController.js";

import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();

// Reporte personalizado por rango
router.get(
  "/",
  authMiddleware,
  obtenerReportePorRango
);

// Lista de reportes diarios
router.get(
  "/daily",
  authMiddleware,
  listarReportesDiarios
);

// Reporte diario específico
router.get(
  "/daily/detail",
  authMiddleware,
  obtenerReporteDiario
);

export default router;