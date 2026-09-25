import Sale from "../models/sale.js";
import Product from "../models/product.js";
import Customer from "../models/customer.js";

export const crearVenta = async (req, res) => {
  // Iniciar sesión/transacción de MongoDB
  const session = await Product.startSession();

  try {
    const {
      items,
      subtotal,
      metodoPago,
      clienteId,
      puntosCanjeados = 0,
    } = req.body;

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

    const subtotalNumero = Number(subtotal);

    if (!Number.isFinite(subtotalNumero) || subtotalNumero < 0) {
      return res.status(400).json({
        message: "Subtotal inválido",
      });
    }

    // =====================================================
    // VALIDAR PUNTOS
    // =====================================================

    const puntosSolicitados = Number(puntosCanjeados);

    if (
      !Number.isFinite(puntosSolicitados) ||
      puntosSolicitados < 0 ||
      !Number.isInteger(puntosSolicitados)
    ) {
      return res.status(400).json({
        message: "Cantidad de puntos inválida",
      });
    }

    // =====================================================
    // INICIAR TRANSACCIÓN
    // =====================================================

    session.startTransaction();

    // =====================================================
    // BUSCAR CLIENTE
    // =====================================================

    let cliente = null;

    if (clienteId) {
      cliente = await Customer.findOne({
        _id: clienteId,
        userId: req.userId,
      }).session(session);

      if (!cliente) {
        throw new Error("Cliente no encontrado");
      }

      // ===================================================
      // VALIDAR PUNTOS DEL CLIENTE
      // ===================================================

      if (puntosSolicitados > cliente.puntos) {
        throw new Error(
          `El cliente solo tiene ${cliente.puntos} puntos disponibles`
        );
      }
    }

    // =====================================================
    // CALCULAR DESCUENTO POR PUNTOS
    // 1 PUNTO = RD$1
    // =====================================================

    const descuentoPuntos = puntosSolicitados;

    // =====================================================
    // VALIDAR QUE EL DESCUENTO NO SUPERE LA COMPRA
    // =====================================================

    if (descuentoPuntos > subtotalNumero) {
      throw new Error(
        "Los puntos a canjear no pueden superar el subtotal de la venta"
      );
    }

    // =====================================================
    // CALCULAR TOTAL
    // =====================================================

    const total = subtotalNumero - descuentoPuntos;

    // =====================================================
    // CALCULAR PUNTOS GANADOS
    //
    // RD$100 gastados = 1 punto
    //
    // Se calculan sobre el total realmente pagado.
    // =====================================================

    const puntosGanados = Math.floor(total / 100);

    // =====================================================
    // VALIDAR Y DESCONTAR STOCK DE TODOS LOS PRODUCTOS
    // =====================================================

    for (const item of items) {
      let descuento = Number(item.cantidad);

      // Validar cantidad
      if (!Number.isFinite(descuento) || descuento <= 0) {
        throw new Error(
          "Cantidad inválida en uno de los productos"
        );
      }

      // PAQUETE
      if (item.tipo === "paquete") {
        const equivalencia = Number(item.equivalencia) || 1;

        descuento =
          Number(item.cantidad) * equivalencia;
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
    // ACTUALIZAR PUNTOS DEL CLIENTE
    // =====================================================

    if (cliente) {
      const nuevosPuntos =
        cliente.puntos -
        puntosSolicitados +
        puntosGanados;

      cliente.puntos = nuevosPuntos;

      await cliente.save({
        session,
      });
    }

    // =====================================================
    // CREAR VENTA
    // =====================================================

    const venta = new Sale({
      userId: req.userId,

      numeroOrden,

      items,

      subtotal: subtotalNumero,

      total,

      metodoPago: metodoPago || "efectivo",

      // Cliente
      clienteId: cliente ? cliente._id : null,

      telefonoCliente: cliente
        ? cliente.telefono
        : null,

      // Fidelidad
      puntosCanjeados: puntosSolicitados,

      descuentoPuntos,

      puntosGanados,
    });

    await venta.save({
      session,
    });

    // =====================================================
    // CONFIRMAR TRANSACCIÓN
    // =====================================================

    await session.commitTransaction();

    // =====================================================
    // RESPUESTA
    // =====================================================

    res.status(201).json({
      message: "Venta realizada correctamente",

      venta,

      fidelidad: cliente
        ? {
            clienteId: cliente._id,
            nombre: cliente.nombre,
            telefono: cliente.telefono,
            puntosCanjeados: puntosSolicitados,
            descuentoPuntos,
            puntosGanados,
            puntosDisponibles:
              cliente.puntos,
          }
        : null,
    });
  } catch (error) {
    // =====================================================
    // CANCELAR TODO
    // =====================================================

    await session.abortTransaction();

    console.log(
      "ERROR CREANDO VENTA:",
      error
    );

    // =====================================================
    // ERRORES CONTROLADOS
    // =====================================================

    if (
      error.message.includes(
        "Stock insuficiente"
      ) ||
      error.message.includes(
        "Cantidad inválida"
      ) ||
      error.message.includes(
        "no existe"
      ) ||
      error.message.includes(
        "Cliente no encontrado"
      ) ||
      error.message.includes(
        "puntos disponibles"
      ) ||
      error.message.includes(
        "puntos a canjear"
      ) ||
      error.message.includes(
        "Cantidad de puntos inválida"
      )
    ) {
      return res.status(400).json({
        message: error.message,
      });
    }

    // =====================================================
    // ERROR GENERAL
    // =====================================================

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
    })
      .populate(
        "clienteId",
        "nombre telefono puntos"
      )
      .sort({
        createdAt: -1,
      });

    res.json(ventas);
  } catch (error) {
    console.log(
      "ERROR OBTENIENDO VENTAS:",
      error
    );

    res.status(500).json({
      message: "Error obteniendo ventas",
      error: error.message,
    });
  }
};

