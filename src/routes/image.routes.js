import express from "express";
import { obtenerImagenes } from "../controllers/image.controller.js";

const router = express.Router();

router.get("/imagenes", obtenerImagenes);

export default router;