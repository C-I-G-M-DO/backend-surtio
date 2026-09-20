import Sale from "../models/sale.js";
import Product from "../models/product.js";

export const crearVenta = async (req, res) => {
  // Iniciar sesión/transacción de MongoDB
  const session = await Product.startSession();

  try {
    const { items, subtotal, metodoPago } = req.body;

    // =====================================================
    // VALIDACIONES
    // =====================================================

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

    // =====================================================
    // INICIAR TRANSACCIÓN
    // =====================================================

    session.startTransaction();

    // =====================================================
    // VALIDAR Y DESCONTAR STOCK DE TODOS LOS PRODUCTOS
    // =====================================================

    for (const item of items) {
      let descuento = Number(item.cantidad);

      // Validar cantidad
      if (!Number.isFinite(descuento) || descuento <= 0) {
        throw new Error("Cantidad inválida en uno de los productos");
      }

      // PAQUETE
      if (item.tipo === "paquete") {
        const equivalencia = Number(item.equivalencia) || 1;

        descuento = Number(item.cantidad) * equivalencia;
      }

      // LIBRA
      if (item.tipo === "libra") {
        descuento = Number(item.cantidad);
      }

      // UNIDAD
      if (item.tipo === "unidad") {
        descuento = Number(item.cantidad);
      }

      // ===================================================
      // DESCONTAR STOCK
      // ===================================================
      //
      // Solo se realiza si:
      //
      // stock >= cantidad a descontar
      //
      // Esto evita que el stock pueda quedar negativo.
      //

      const producto = await Product.findOneAndUpdate(
        {
          _id: item.productoId,
          userId: req.userId,

          // Protección contra stock negativo
          stock: {
            $gte: descuento,
          },
        },
        {
          $inc: {
            stock: -descuento,
          },
        },
        {
          new: true,
          session,
        }
      );

      // ===================================================
      // NO HAY SUFICIENTE STOCK
      // ===================================================

      if (!producto) {
        const productoExiste = await Product.findOne({
          _id: item.productoId,
          userId: req.userId,
        }).session(session);

        if (!productoExiste) {
          throw new Error(
            `El producto ${item.productoId} no existe`
          );
        }

        throw new Error(
          `Stock insuficiente para ${productoExiste.nombre}. ` +
          `Stock disponible: ${productoExiste.stock}`
        );
      }
    }

    // =====================================================
    // BUSCAR ÚLTIMA ORDEN
    // =====================================================

    const ultimaVenta = await Sale.findOne()
      .sort({
        numeroOrden: -1,
      })
      .session(session);

    // =====================================================
    // GENERAR NÚMERO DE ORDEN
    // =====================================================

    const numeroOrden = ultimaVenta
      ? ultimaVenta.numeroOrden + 1
      : 1000;

    // =====================================================
    // CREAR VENTA
    // =====================================================

    const venta = new Sale({
      userId: req.userId,
      numeroOrden,
      items,
      subtotal,
      metodoPago: metodoPago || "efectivo",
    });

    await venta.save({ session });

    // =====================================================
    // CONFIRMAR TRANSACCIÓN
    // =====================================================

    await session.commitTransaction();

    res.status(201).json(venta);

  } catch (error) {
    // =====================================================
    // CANCELAR TODO
    // =====================================================

    await session.abortTransaction();

    console.log("ERROR CREANDO VENTA:", error);

    // Errores relacionados con stock
    if (
      error.message.includes("Stock insuficiente") ||
      error.message.includes("Cantidad inválida") ||
      error.message.includes("no existe")
    ) {
      return res.status(400).json({
        message: error.message,
      });
    }

    res.status(500).json({
      message: "Error creando venta",
      error: error.message,
    });

  } finally {
    // Cerrar sesión
    await session.endSession();
  }
};

// =========================================================
// OBTENER VENTAS
// =========================================================

export const obtenerVentas = async (req, res) => {
  try {
    const ventas = await Sale.find({
      userId: req.userId,
    }).sort({
      createdAt: -1,
    });

    res.json(ventas);

  } catch (error) {
    console.log("ERROR OBTENIENDO VENTAS:", error);

    res.status(500).json({
      message: "Error obteniendo ventas",
      error: error.message,
    });
  }
};