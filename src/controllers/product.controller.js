// controllers/product.controller.js

import Product from "../models/product.js";

export const crearProducto = async (req, res) => {
  try {
    const { nombre, precios, stock, imagen } = req.body;

    const nuevoProducto = new Product({
      nombre,
      precios,
      stock,
      imagen,

      //  Se relaciona automáticamente con el usuario autenticado
      userId: req.userId,
    });

    await nuevoProducto.save();

    res.status(201).json(nuevoProducto);
  } catch (error) {
    console.error("Error creando producto:", error);

    res.status(500).json({
      message: "Error creando producto",
      error: error.message,
    });
  }
};

export const obtenerProductos = async (req, res) => {
  try {
    // 🔥 Solo obtiene los productos del usuario autenticado
    const productos = await Product.find({
      userId: req.userId,
    });

    res.json(productos);
  } catch (error) {
    console.error("Error obteniendo productos:", error);

    res.status(500).json({
      message: "Error obteniendo productos",
    });
  }
};

