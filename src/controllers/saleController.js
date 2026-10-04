import Sale from "../models/sale.js";
import Product from "../models/product.js";
import Customer from "../models/customer.js";

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

const TIPOS_PRESENTACION = [
  ...TIPOS_UNIDAD,
  ...TIPOS_LIBRA,
];

/**
 * Devuelve cuánto stock consume una presentación.
 *
 * PRODUCTOS CON STOCK EN UNIDADES:
 *
 * unidad  -> 1
 * paquete -> equivalencia
 * docena  -> 12
 *
 * PRODUCTOS CON STOCK EN LIBRAS:
 *
 * libra       -> 1 lb
 * media_libra -> 0.5 lb
 * cuarta      -> 0.25 lb
 * onza        -> 0.0625 lb
 */
const calcularConsumoStock = ({
  tipo,
  cantidad,
  equivalencia,
}) => {
  const cantidadNumero = Number(cantidad);

  if (
    !Number.isFinite(cantidadNumero) ||
    cantidadNumero <= 0
  ) {
    throw new Error(
      "Cantidad inválida en uno de los productos"
    );
  }

  switch (tipo) {
    case "unidad":
      return cantidadNumero;

    case "paquete": {
      const equivalenciaNumero = Number(equivalencia);

      if (
        !Number.isFinite(equivalenciaNumero) ||
        equivalenciaNumero <= 0 ||
        !Number.isInteger(equivalenciaNumero)
      ) {
        throw new Error(
          "La equivalencia del paquete es inválida"
        );
      }

      return cantidadNumero * equivalenciaNumero;
    }

    case "docena":
      return cantidadNumero * 12;

    case "libra":
      return cantidadNumero;

    case "media_libra":
      return cantidadNumero * 0.5;

    case "cuarta":
      return cantidadNumero * 0.25;

    case "onza":
      return cantidadNumero * 0.0625;

    default:
      throw new Error(
        `Tipo de presentación inválido: ${tipo}`
      );
  }
};

/**
 * Valida que la presentación utilizada sea compatible
 * con la unidad de stock del producto.
 */
const validarPresentacionProducto = (
  producto,
  tipo
) => {
  if (!TIPOS_PRESENTACION.includes(tipo)) {
    throw new Error(
      `Tipo de presentación inválido: ${tipo}`
    );
  }

  if (
    producto.unidadStock === "unidad" &&
    !TIPOS_UNIDAD.includes(tipo)
  ) {
    throw new Error(
      `El producto ${producto.nombre} maneja stock por unidad y no puede venderse por ${tipo}`
    );
  }

  if (
    producto.unidadStock === "libra" &&
    !TIPOS_LIBRA.includes(tipo)
  ) {
    throw new Error(
      `El producto ${producto.nombre} maneja stock por libra y no puede venderse por ${tipo}`
    );
  }
};

/**
 * Busca el precio configurado en el producto.
 */
const obtenerPrecioPresentacion = (
  producto,
  tipo
) => {
  const precioEncontrado = producto.precios?.find(
    (precio) => precio.tipo === tipo
  );

  if (!precioEncontrado) {
    throw new Error(
      `El producto ${producto.nombre} no tiene un precio configurado para ${tipo}`
    );
  }

  const precio = Number(precioEncontrado.valor);

  if (!Number.isFinite(precio) || precio < 0) {
    throw new Error(
      `El precio configurado para ${producto.nombre} es inválido`
    );
  }

  return {
    precio,
    equivalencia:
      precioEncontrado.equivalencia ?? null,
  };
};

/**
 * Valida la cantidad según el tipo de presentación.
 *
 * Para unidad, paquete y docena:
 * solamente se pueden vender cantidades enteras.
 *
 * Para presentaciones por peso:
 * se permiten cantidades decimales.
 */
const validarCantidad = (
  tipo,
  cantidad
) => {
  const cantidadNumero = Number(cantidad);

  if (
    !Number.isFinite(cantidadNumero) ||
    cantidadNumero <= 0
  ) {
    throw new Error(
      "Cantidad inválida en uno de los productos"
    );
  }

  if (
    TIPOS_UNIDAD.includes(tipo) &&
    !Number.isInteger(cantidadNumero)
  ) {
    throw new Error(
      `La cantidad para ${tipo} debe ser un número entero`
    );
  }

  return cantidadNumero;
};

// =========================================================
// CREAR VENTA
// =========================================================

export const crearVenta = async (req, res) => {
  const session = await Product.startSession();

  try {
    const {
      items,
      clienteId,
      puntosCanjeados = 0,
      metodoPago = "efectivo",
    } = req.body;

    // =====================================================
    // VALIDACIONES BÁSICAS
    // =====================================================

    if (
      !items ||
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return res.status(400).json({
        message: "No hay productos en la venta",
      });
    }

    // =====================================================
    // VALIDAR PUNTOS
    // =====================================================

    const puntosSolicitados = Number(
      puntosCanjeados
    );

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

      if (
        puntosSolicitados > cliente.puntos
      ) {
        throw new Error(
          `El cliente solo tiene ${cliente.puntos} puntos disponibles`
        );
      }
    } else if (puntosSolicitados > 0) {
      throw new Error(
        "No se pueden canjear puntos sin seleccionar un cliente"
      );
    }

    // =====================================================
    // PROCESAR PRODUCTOS
    // =====================================================

    const itemsVenta = [];

    let subtotalCalculado = 0;

    for (const item of items) {
      if (!item.productoId) {
        throw new Error(
          "Producto inválido en la venta"
        );
      }

      if (!item.tipo) {
        throw new Error(
          "Tipo de presentación requerido"
        );
      }

      // ===================================================
      // BUSCAR PRODUCTO
      // ===================================================

      const producto = await Product.findOne({
        _id: item.productoId,
        userId: req.userId,
      }).session(session);

      if (!producto) {
        throw new Error(
          `El producto ${item.productoId} no existe`
        );
      }

      // ===================================================
      // VALIDAR PRESENTACIÓN
      // ===================================================

      validarPresentacionProducto(
        producto,
        item.tipo
      );

      // ===================================================
      // VALIDAR CANTIDAD
      // ===================================================

      const cantidad = validarCantidad(
        item.tipo,
        item.cantidad
      );

      // ===================================================
      // OBTENER PRECIO REAL DESDE MONGODB
      // ===================================================

      const {
        precio,
        equivalencia,
      } = obtenerPrecioPresentacion(
        producto,
        item.tipo
      );

      // ===================================================
      // CALCULAR CONSUMO DE STOCK
      // ===================================================

      const unidadesStockConsumidas =
        calcularConsumoStock({
          tipo: item.tipo,
          cantidad,
          equivalencia,
        });

      // ===================================================
      // CALCULAR TOTAL DE LA LÍNEA
      // ===================================================

      const totalLinea =
        precio * cantidad;

      // Evitar pequeños errores de punto flotante
      const totalLineaRedondeado =
        Math.round(
          (totalLinea + Number.EPSILON) * 100
        ) / 100;

      subtotalCalculado +=
        totalLineaRedondeado;

      // ===================================================
      // DESCONTAR STOCK
      // ===================================================

      const productoActualizado =
        await Product.findOneAndUpdate(
          {
            _id: producto._id,
            userId: req.userId,

            // Protección contra stock negativo
            stock: {
              $gte: unidadesStockConsumidas,
            },
          },
          {
            $inc: {
              stock: -unidadesStockConsumidas,
            },
          },
          {
            new: true,
            session,
          }
        );

      // ===================================================
      // STOCK INSUFICIENTE
      // ===================================================

      if (!productoActualizado) {
        const productoExiste =
          await Product.findOne({
            _id: producto._id,
            userId: req.userId,
          }).session(session);

        if (!productoExiste) {
          throw new Error(
            `El producto ${producto._id} no existe`
          );
        }

        throw new Error(
          `Stock insuficiente para ${productoExiste.nombre}. ` +
          `Stock disponible: ${productoExiste.stock}`
        );
      }

      // ===================================================
      // GUARDAR SNAPSHOT DE LA VENTA
      // ===================================================

      itemsVenta.push({
        productoId: producto._id,
        nombre: producto.nombre,
        tipo: item.tipo,
        precio,
        cantidad,
        total: totalLineaRedondeado,
        equivalencia,
        unidadesStockConsumidas,
      });
    }

    // =====================================================
    // REDONDEAR SUBTOTAL
    // =====================================================

    subtotalCalculado =
      Math.round(
        (subtotalCalculado + Number.EPSILON) * 100
      ) / 100;

    // =====================================================
    // DESCUENTO POR PUNTOS
    //
    // 1 PUNTO = RD$1
    // =====================================================

    const descuentoPuntos =
      puntosSolicitados;

    // =====================================================
    // VALIDAR DESCUENTO
    // =====================================================

    if (
      descuentoPuntos >
      subtotalCalculado
    ) {
      throw new Error(
        "Los puntos a canjear no pueden superar el subtotal de la venta"
      );
    }

    // =====================================================
    // CALCULAR TOTAL
    // =====================================================

    const total =
      Math.round(
        (
          subtotalCalculado -
          descuentoPuntos +
          Number.EPSILON
        ) * 100
      ) / 100;

    // =====================================================
    // CALCULAR PUNTOS GANADOS
    //
    // RD$100 gastados = 1 punto
    // =====================================================

    const puntosGanados =
      Math.floor(total / 100);

    // =====================================================
    // BUSCAR ÚLTIMA ORDEN
    //
    // TEMPORALMENTE MANTENEMOS TU SISTEMA ACTUAL.
    // Cuando integremos Order + Counter, esto se reemplaza.
    // =====================================================

    const ultimaVenta =
      await Sale.findOne()
        .sort({
          numeroOrden: -1,
        })
        .session(session);

    const numeroOrden =
      ultimaVenta
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

      items: itemsVenta,

      subtotal: subtotalCalculado,

      total,

      metodoPago,

      // Cliente
      clienteId:
        cliente
          ? cliente._id
          : null,

      telefonoCliente:
        cliente
          ? cliente.telefono
          : null,

      // Fidelidad
      puntosCanjeados:
        puntosSolicitados,

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

    return res.status(201).json({
      message:
        "Venta realizada correctamente",

      venta,

      fidelidad: cliente
        ? {
            clienteId: cliente._id,
            nombre: cliente.nombre,
            telefono: cliente.telefono,
            puntosCanjeados:
              puntosSolicitados,
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

    const erroresControlados = [
      "Stock insuficiente",
      "Cantidad inválida",
      "no existe",
      "Cliente no encontrado",
      "puntos disponibles",
      "puntos a canjear",
      "Cantidad de puntos inválida",
      "Tipo de presentación inválido",
      "no tiene un precio configurado",
      "maneja stock por unidad",
      "maneja stock por libra",
      "equivalencia del paquete",
      "debe ser un número entero",
      "sin seleccionar un cliente",
      "Producto inválido",
      "Tipo de presentación requerido",
    ];

    const esErrorControlado =
      erroresControlados.some(
        (texto) =>
          error.message.includes(texto)
      );

    if (esErrorControlado) {
      return res.status(400).json({
        message: error.message,
      });
    }

    // =====================================================
    // ERROR GENERAL
    // =====================================================

    return res.status(500).json({
      message: "Error creando venta",
      error: error.message,
    });
  } finally {
    // =====================================================
    // CERRAR SESIÓN
    // =====================================================

    await session.endSession();
  }
};

// =========================================================
// OBTENER VENTAS
// =========================================================

export const obtenerVentas = async (
  req,
  res
) => {
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

    return res.json(ventas);
  } catch (error) {
    console.log(
      "ERROR OBTENIENDO VENTAS:",
      error
    );

    return res.status(500).json({
      message: "Error obteniendo ventas",
      error: error.message,
    });
  }
};