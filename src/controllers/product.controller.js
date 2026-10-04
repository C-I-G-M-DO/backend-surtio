import Product from "../models/product.js";

const TIPOS_UNIDAD = [
  "unidad",
  "paquete",
  "docena",
];

const TIPOS_LIBRA = [
  "libra",
  "media_libra",
  "cuarta",
  "onza",
];

const TODOS_LOS_TIPOS = [
  ...TIPOS_UNIDAD,
  ...TIPOS_LIBRA,
];

/**
 * Valida un precio según la unidad de stock del producto.
 */
const validarPrecio = (precio, unidadStock) => {
  const {
    tipo,
    valor,
    equivalencia,
  } = precio;

  // -----------------------------------------
  // VALIDAR TIPO
  // -----------------------------------------
  if (!TODOS_LOS_TIPOS.includes(tipo)) {
    return `Tipo de precio inválido: ${tipo}`;
  }

  // -----------------------------------------
  // VALIDAR PRECIO
  // -----------------------------------------
  if (
    valor === undefined ||
    valor === null ||
    !Number.isFinite(Number(valor)) ||
    Number(valor) <= 0
  ) {
    return `El precio para ${tipo} debe ser mayor que cero`;
  }

  // -----------------------------------------
  // PRODUCTO CON STOCK POR UNIDAD
  // -----------------------------------------
  if (unidadStock === "unidad") {
    if (!TIPOS_UNIDAD.includes(tipo)) {
      return (
        `El producto tiene stock por unidad y ` +
        `no puede utilizar la presentación "${tipo}"`
      );
    }

    // ---------------------------------------
    // PAQUETE
    // ---------------------------------------
    if (tipo === "paquete") {
      if (
        equivalencia === undefined ||
        equivalencia === null ||
        !Number.isFinite(Number(equivalencia)) ||
        Number(equivalencia) <= 0 ||
        !Number.isInteger(Number(equivalencia))
      ) {
        return (
          "La equivalencia del paquete debe ser " +
          "un número entero mayor que cero"
        );
      }
    }

    // ---------------------------------------
    // UNIDAD / DOCENA
    // No necesitan equivalencia
    // ---------------------------------------
    if (
      (tipo === "unidad" || tipo === "docena") &&
      equivalencia !== undefined &&
      equivalencia !== null
    ) {
      return `La presentación "${tipo}" no utiliza equivalencia`;
    }
  }

  // -----------------------------------------
  // PRODUCTO CON STOCK POR LIBRA
  // -----------------------------------------
  if (unidadStock === "libra") {
    if (!TIPOS_LIBRA.includes(tipo)) {
      return (
        `El producto tiene stock por libra y ` +
        `no puede utilizar la presentación "${tipo}"`
      );
    }

    // Las presentaciones por libra NO utilizan
    // equivalencia.
    if (
      equivalencia !== undefined &&
      equivalencia !== null
    ) {
      return `La presentación "${tipo}" no utiliza equivalencia`;
    }
  }

  return null;
};

/**
 * CREAR PRODUCTO
 */
export const crearProducto = async (req, res) => {
  try {
    const {
      nombre,
      unidadStock,
      precios,
      stock,
      imagen,
    } = req.body;

    // -----------------------------------------
    // VALIDAR NOMBRE
    // -----------------------------------------
    if (
      !nombre ||
      typeof nombre !== "string" ||
      !nombre.trim()
    ) {
      return res.status(400).json({
        message: "El nombre del producto es obligatorio",
      });
    }

    // -----------------------------------------
    // VALIDAR UNIDAD DE STOCK
    // -----------------------------------------
    if (!["unidad", "libra"].includes(unidadStock)) {
      return res.status(400).json({
        message:
          "unidadStock debe ser 'unidad' o 'libra'",
      });
    }

    // -----------------------------------------
    // VALIDAR STOCK
    // -----------------------------------------
    if (
      stock === undefined ||
      stock === null ||
      !Number.isFinite(Number(stock)) ||
      Number(stock) < 0
    ) {
      return res.status(400).json({
        message:
          "El stock debe ser un número mayor o igual a cero",
      });
    }

    const stockNumerico = Number(stock);

    // Stock por unidad debe ser entero
    if (
      unidadStock === "unidad" &&
      !Number.isInteger(stockNumerico)
    ) {
      return res.status(400).json({
        message:
          "El stock de un producto por unidad debe ser un número entero",
      });
    }

    // -----------------------------------------
    // VALIDAR PRECIOS
    // -----------------------------------------
    if (!Array.isArray(precios) || precios.length === 0) {
      return res.status(400).json({
        message:
          "Debe existir al menos un precio para el producto",
      });
    }

    for (const precio of precios) {
      const errorPrecio = validarPrecio(
        precio,
        unidadStock
      );

      if (errorPrecio) {
        return res.status(400).json({
          message: errorPrecio,
        });
      }
    }

    // -----------------------------------------
    // CREAR PRODUCTO
    // -----------------------------------------
    const nuevoProducto = new Product({
      nombre: nombre.trim(),
      unidadStock,
      precios,
      stock: stockNumerico,
      imagen: imagen || null,
      userId: req.userId,
    });

    await nuevoProducto.save();

    res.status(201).json(nuevoProducto);

  } catch (error) {
    console.error(
      "Error creando producto:",
      error
    );

    res.status(500).json({
      message: "Error creando producto",
      error: error.message,
    });
  }
};


/**
 * ACTUALIZAR PRECIOS DEL PRODUCTO
 */
export const actualizarPrecios = async (req, res) => {
  try {
    const { id } = req.params;
    const { precios } = req.body;

    // -----------------------------------------
    // VALIDAR ARRAY
    // -----------------------------------------
    if (!Array.isArray(precios)) {
      return res.status(400).json({
        message:
          "Los precios deben enviarse como un arreglo",
      });
    }

    if (precios.length === 0) {
      return res.status(400).json({
        message:
          "Debe existir al menos un precio",
      });
    }

    // -----------------------------------------
    // BUSCAR PRODUCTO
    // -----------------------------------------
    const producto = await Product.findOne({
      _id: id,
      userId: req.userId,
    });

    if (!producto) {
      return res.status(404).json({
        message: "Producto no encontrado",
      });
    }

    // -----------------------------------------
    // VALIDAR CADA PRECIO
    // -----------------------------------------
    for (const precio of precios) {
      const errorPrecio = validarPrecio(
        precio,
        producto.unidadStock
      );

      if (errorPrecio) {
        return res.status(400).json({
          message: errorPrecio,
        });
      }
    }

    // -----------------------------------------
    // GUARDAR PRECIOS
    // -----------------------------------------
    producto.precios = precios;

    await producto.save();

    res.json(producto);

  } catch (error) {
    console.error(
      "Error actualizando precios:",
      error
    );

    res.status(500).json({
      message: "Error actualizando precios",
      error: error.message,
    });
  }
};


/**
 * ELIMINAR PRODUCTO
 */
export const eliminarProducto = async (req, res) => {
  try {
    const { id } = req.params;

    const producto =
      await Product.findOneAndDelete({
        _id: id,
        userId: req.userId,
      });

    if (!producto) {
      return res.status(404).json({
        message: "Producto no encontrado",
      });
    }

    res.json({
      message:
        "Producto eliminado correctamente",
      producto,
    });

  } catch (error) {
    console.error(
      "Error eliminando producto:",
      error
    );

    res.status(500).json({
      message: "Error eliminando producto",
      error: error.message,
    });
  }
};


/**
 * OBTENER PRODUCTOS
 */
export const obtenerProductos = async (req, res) => {
  try {
    const productos = await Product.find({
      userId: req.userId,
    });

    res.json(productos);

  } catch (error) {
    console.error(
      "Error obteniendo productos:",
      error
    );

    res.status(500).json({
      message: "Error obteniendo productos",
    });
  }
};


/**
 * ACTUALIZAR / REPONER STOCK
 */
export const actualizarStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { cantidad } = req.body;

    // -----------------------------------------
    // VALIDAR CANTIDAD
    // -----------------------------------------
    if (
      cantidad === undefined ||
      cantidad === null ||
      !Number.isFinite(Number(cantidad)) ||
      Number(cantidad) <= 0
    ) {
      return res.status(400).json({
        message:
          "La cantidad debe ser un número mayor que cero",
      });
    }

    // -----------------------------------------
    // BUSCAR PRODUCTO
    // -----------------------------------------
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

    // -----------------------------------------
    // STOCK POR UNIDAD
    // -----------------------------------------
    if (
      producto.unidadStock === "unidad" &&
      !Number.isInteger(cantidadAgregar)
    ) {
      return res.status(400).json({
        message:
          "La cantidad de reposición para productos por unidad debe ser un número entero",
      });
    }

    // -----------------------------------------
    // STOCK POR LIBRA
    // -----------------------------------------
    // En productos por libra sí permitimos:
    // 0.5
    // 0.25
    // 1.75
    // etc.
    const stockActual =
      Number(producto.stock) || 0;

    producto.stock =
      stockActual + cantidadAgregar;

    await producto.save();

    res.json(producto);

  } catch (error) {
    console.error(
      "Error actualizando stock:",
      error
    );

    res.status(500).json({
      message: "Error actualizando stock",
      error: error.message,
    });
  }
};