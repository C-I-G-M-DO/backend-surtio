import Product from "../models/product.js";

export const crearProducto = async (req, res) => {
  try {
    const { nombre, precios, stock, imagen } = req.body;

    const nuevoProducto = new Product({
      nombre,
      precios,
      stock,
      imagen,
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

// ACTUALIZAR PRECIOS DEL PRODUCTO
export const actualizarPrecios = async (req, res) => {
  try {
    const { id } = req.params;
    const { precios } = req.body;

    // Validar que precios sea un arreglo
    if (!Array.isArray(precios)) {
      return res.status(400).json({
        message: "Los precios deben enviarse como un arreglo",
      });
    }

    // Validar cada precio
    for (const precio of precios) {
      if (!["unidad", "libra", "paquete"].includes(precio.tipo)) {
        return res.status(400).json({
          message: `Tipo de precio inválido: ${precio.tipo}`,
        });
      }

      if (
        precio.valor === undefined ||
        precio.valor === null ||
        !Number.isFinite(Number(precio.valor)) ||
        Number(precio.valor) < 0
      ) {
        return res.status(400).json({
          message: `Precio inválido para ${precio.tipo}`,
        });
      }

      // Si existe equivalencia, también debe ser válida
      if (
        precio.equivalencia !== undefined &&
        precio.equivalencia !== null &&
        (
          !Number.isFinite(Number(precio.equivalencia)) ||
          Number(precio.equivalencia) <= 0
        )
      ) {
        return res.status(400).json({
          message: `Equivalencia inválida para ${precio.tipo}`,
        });
      }
    }

    // Buscar solamente productos pertenecientes al usuario
    const producto = await Product.findOne({
      _id: id,
      userId: req.userId,
    });

    if (!producto) {
      return res.status(404).json({
        message: "Producto no encontrado",
      });
    }

    // Actualizar precios
    producto.precios = precios;

    await producto.save();

    res.json(producto);
  } catch (error) {
    console.error("Error actualizando precios:", error);

    res.status(500).json({
      message: "Error actualizando precios",
      error: error.message,
    });
  }
};


// ELIMINAR PRODUCTO
export const eliminarProducto = async (req, res) => {
  try {
    const { id } = req.params;

    // Solo permite eliminar productos pertenecientes
    // al usuario autenticado
    const producto = await Product.findOneAndDelete({
      _id: id,
      userId: req.userId,
    });

    if (!producto) {
      return res.status(404).json({
        message: "Producto no encontrado",
      });
    }

    res.json({
      message: "Producto eliminado correctamente",
      producto,
    });
  } catch (error) {
    console.error("Error eliminando producto:", error);

    res.status(500).json({
      message: "Error eliminando producto",
      error: error.message,
    });
  }
};

export const obtenerProductos = async (req, res) => {
  try {
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

// ACTUALIZAR / REPONER STOCK
export const actualizarStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { cantidad } = req.body;

    // Validar cantidad
    if (
      cantidad === undefined ||
      cantidad === null ||
      !Number.isFinite(Number(cantidad)) ||
      Number(cantidad) <= 0
    ) {
      return res.status(400).json({
        message: "La cantidad debe ser un número mayor que cero",
      });
    }

    // Buscar el producto del usuario autenticado
    const producto = await Product.findOne({
      _id: id,
      userId: req.userId,
    });

    if (!producto) {
      return res.status(404).json({
        message: "Producto no encontrado",
      });
    }

    const cantidadAgregar = Number(cantidad);

    // Si stock todavía no existe, comenzar desde 0
    const stockActual = Number(producto.stock) || 0;

    producto.stock = stockActual + cantidadAgregar;

    await producto.save();

    res.json(producto);
  } catch (error) {
    console.error("Error actualizando stock:", error);

    res.status(500).json({
      message: "Error actualizando stock",
      error: error.message,
    });
  }
};