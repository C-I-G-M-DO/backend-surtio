import Sale from "../models/sale.js";
import Product from "../models/product.js";

export const crearVenta = async (req, res) => {
  try {
    const { items, subtotal, metodoPago } = req.body;

    //  VALIDACIONES
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        message: "No hay productos en la venta",
      });
    }

    if (subtotal === undefined || subtotal === null) {
      return res.status(400).json({
        message: "Subtotal requerido",
      });
    }

    //  BUSCAR ÚLTIMA ORDEN
    const ultimaVenta = await Sale.findOne().sort({
      numeroOrden: -1,
    });

    //  GENERAR NUEVO NÚMERO
    const numeroOrden = ultimaVenta
      ? ultimaVenta.numeroOrden + 1
      : 1000;

    //  CREAR VENTA
    const venta = await Sale.create({
      storeId: req.storeId, 
      numeroOrden,
      items,
      subtotal,
      metodoPago: metodoPago || "efectivo",
    });

    //  DESCONTAR STOCK
    for (const item of items) {
      let descuento = item.cantidad;

      // paquetes
      if (item.tipo === "paquete") {
        descuento =
          item.cantidad * (item.equivalencia || 1);
      }

      // libras
      if (item.tipo === "libra") {
        descuento = item.cantidad;
      }

      // unidad
      if (item.tipo === "unidad") {
        descuento = item.cantidad;
      }

      await Product.findByIdAndUpdate(
        item.productoId,
        {
          $inc: {
            stock: -descuento,
          },
        }
      );
    }

    res.status(201).json(venta);

  } catch (error) {
    console.log("ERROR CREANDO VENTA:", error);

    res.status(500).json({
      message: "Error creando venta",
      error: error.message,
    });
  }
};

export const obtenerVentas = async (req, res) => {
  try {
    const ventas = await Sale.find({
      storeId: req.storeId, 
    }).sort({ createdAt: -1 });

    res.json(ventas);

  } catch (error) {
    console.log("ERROR OBTENIENDO VENTAS:", error);

    res.status(500).json({
      message: "Error obteniendo ventas",
      error: error.message,
    });
  }
};