import mongoose from "mongoose";

import Order from "../models/order.js";
import Counter from "../models/counter.js";
import Product from "../models/product.js";
import Sale from "../models/sale.js";
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

const METODOS_PAGO = [
  "efectivo",
  "tarjeta",
  "transferencia",
  "mixto",
];

/**
 * Calcula cuánto stock consume una presentación.
 *
 * unidad:
 *   unidad = 1
 *   docena = 12
 *   paquete = equivalencia
 *
 * libra:
 *   libra = 1
 *   media_libra = 0.5
 *   cuarta = 0.25
 *   onza = 0.0625
 */
function calcularConsumoStock({
  unidadStock,
  tipo,
  cantidad,
  equivalencia,
}) {
  if (unidadStock === "unidad") {
    if (tipo === "unidad") {
      return cantidad;
    }

    if (tipo === "docena") {
      return cantidad * 12;
    }

    if (tipo === "paquete") {
      if (
        !Number.isFinite(equivalencia) ||
        equivalencia <= 0 ||
        !Number.isInteger(equivalencia)
      ) {
        throw new Error(
          "El paquete necesita una equivalencia válida."
        );
      }

      return cantidad * equivalencia;
    }
  }

  if (unidadStock === "libra") {
    const factores = {
      libra: 1,
      media_libra: 0.5,
      cuarta: 0.25,
      onza: 0.0625,
    };

    const factor = factores[tipo];

    if (!factor) {
      throw new Error(
        "Presentación incompatible con un producto vendido por libra."
      );
    }

    return cantidad * factor;
  }

  throw new Error("Unidad de stock inválida.");
}

/**
 * Valida que la presentación pertenezca
 * al tipo de stock del producto.
 */
function validarPresentacionProducto(producto, tipo, equivalencia) {
  if (!TIPOS_PRESENTACION.includes(tipo)) {
    throw new Error("Presentación inválida.");
  }

  if (producto.unidadStock === "unidad") {
    if (!TIPOS_UNIDAD.includes(tipo)) {
      throw new Error(
        "Este producto se maneja por unidades."
      );
    }

    if (tipo === "paquete") {
      if (
        !Number.isFinite(equivalencia) ||
        equivalencia <= 0 ||
        !Number.isInteger(equivalencia)
      ) {
        throw new Error(
          "El paquete necesita una equivalencia entera positiva."
        );
      }
    } else if (
      equivalencia !== null &&
      equivalencia !== undefined
    ) {
      throw new Error(
        "Esta presentación no utiliza equivalencia."
      );
    }
  }

  if (producto.unidadStock === "libra") {
    if (!TIPOS_LIBRA.includes(tipo)) {
      throw new Error(
        "Este producto se maneja por libra."
      );
    }

    if (
      equivalencia !== null &&
      equivalencia !== undefined
    ) {
      throw new Error(
        "Las presentaciones por libra no utilizan equivalencia."
      );
    }
  }
}

/**
 * Busca el precio guardado en el producto.
 */
function obtenerPrecioPresentacion(producto, tipo) {
  const precio = producto.precios?.find(
    (item) => item.tipo === tipo
  );

  if (!precio) {
    throw new Error(
      `El producto "${producto.nombre}" no tiene precio para ${tipo}.`
    );
  }

  if (
    !Number.isFinite(precio.valor) ||
    precio.valor < 0
  ) {
    throw new Error(
      `El precio de "${producto.nombre}" no es válido.`
    );
  }

  return precio;
}

/**
 * Valida cantidades.
 */
function validarCantidad(cantidad, unidadStock) {
  if (
    !Number.isFinite(cantidad) ||
    cantidad <= 0
  ) {
    throw new Error(
      "La cantidad debe ser mayor que cero."
    );
  }

  if (
    unidadStock === "unidad" &&
    !Number.isInteger(cantidad)
  ) {
    throw new Error(
      "La cantidad de un producto por unidades debe ser entera."
    );
  }
}

/**
 * Obtiene el siguiente número de orden.
 *
 * El primer número será 1000.
 */
async function obtenerSiguienteNumeroOrden(
  userId,
  session
) {
  const counter = await Counter.findOneAndUpdate(
    {
      userId,
      name: "orders",
    },
    {
      $inc: {
        seq: 1,
      },
      $setOnInsert: {
        userId,
        name: "orders",
      },
    },
    {
      new: true,
      upsert: true,
      session,
    }
  );

  return counter.seq;
}

/**
 * Crear orden.
 *
 * IMPORTANTE:
 * Aquí NO se descuenta inventario.
 */
export const crearOrden = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const userId = req.userId;

    const {
      clientRequestId,
      items,
      clienteId = null,
      puntosCanjeados = 0,
    } = req.body;

    if (
      !clientRequestId ||
      typeof clientRequestId !== "string"
    ) {
      return res.status(400).json({
        message: "clientRequestId es requerido.",
      });
    }

    if (
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return res.status(400).json({
        message: "La orden debe contener productos.",
      });
    }

    if (
      !Number.isInteger(Number(puntosCanjeados)) ||
      Number(puntosCanjeados) < 0
    ) {
      return res.status(400).json({
        message: "Los puntos a canjear no son válidos.",
      });
    }

    // Si el dispositivo repite exactamente la misma solicitud,
    // devolvemos la orden existente.
    const ordenExistente = await Order.findOne({
      userId,
      clientRequestId: clientRequestId.trim(),
    });

    if (ordenExistente) {
      return res.status(200).json(ordenExistente);
    }

    session.startTransaction();

    let cliente = null;

    if (clienteId) {
      if (!mongoose.isValidObjectId(clienteId)) {
        await session.abortTransaction();

        return res.status(400).json({
          message: "El cliente no es válido.",
        });
      }

      cliente = await Customer.findOne({
        _id: clienteId,
        userId,
      }).session(session);

      if (!cliente) {
        await session.abortTransaction();

        return res.status(404).json({
          message: "Cliente no encontrado.",
        });
      }

      if (Number(puntosCanjeados) > cliente.puntos) {
        await session.abortTransaction();

        return res.status(400).json({
          message: `El cliente solo tiene ${cliente.puntos} puntos disponibles.`,
        });
      }
    } else if (Number(puntosCanjeados) > 0) {
      await session.abortTransaction();

      return res.status(400).json({
        message:
          "No puedes canjear puntos sin seleccionar un cliente.",
      });
    }

    const itemsVenta = [];
    let subtotal = 0;

    for (const item of items) {
      if (
        !item?.productoId ||
        !mongoose.isValidObjectId(item.productoId)
      ) {
        throw new Error(
          "Uno de los productos de la orden no es válido."
        );
      }

      const producto = await Product.findOne({
        _id: item.productoId,
        userId,
      }).session(session);

      if (!producto) {
        throw new Error(
          "Uno de los productos ya no existe o no pertenece a este negocio."
        );
      }

      const tipo = item.tipo;

      const cantidad = Number(item.cantidad);

      validarCantidad(
        cantidad,
        producto.unidadStock
      );

      const precioProducto =
        obtenerPrecioPresentacion(
          producto,
          tipo
        );

      const equivalencia =
        precioProducto.equivalencia ?? null;

      validarPresentacionProducto(
        producto,
        tipo,
        equivalencia
      );

      const consumo = calcularConsumoStock({
        unidadStock: producto.unidadStock,
        tipo,
        cantidad,
        equivalencia,
      });

      const totalItem =
        precioProducto.valor * cantidad;

      subtotal += totalItem;

      itemsVenta.push({
        productoId: producto._id,
        nombre: producto.nombre,
        tipo,
        cantidad,
        precio: precioProducto.valor,
        total: totalItem,
        equivalencia,
        unidadesStockConsumidas: consumo,
      });
    }

    const numeroOrden =
      await obtenerSiguienteNumeroOrden(
        userId,
        session
      );

    // Intentamos obtener el nombre del usuario
    // sin depender de que authMiddleware lo coloque en req.user.
    let createdByName = "";

    if (req.user?.name) {
      createdByName = req.user.name;
    } else if (req.user?.nombre) {
      createdByName = req.user.nombre;
    } else if (req.user?.businessName) {
      createdByName = req.user.businessName;
    }

    const orden = await Order.create(
      [
        {
          userId,
          clientRequestId:
            clientRequestId.trim(),
          numeroOrden,
          estado: "pendiente",
          createdByName,

          clienteId: cliente?._id ?? null,
          clienteNombre: cliente?.nombre ?? null,
          telefonoCliente:
            cliente?.telefono ?? null,

          puntosCanjeados:
            Number(puntosCanjeados),

          subtotal,
          items: itemsVenta,
          saleId: null,
        },
      ],
      {
        session,
      }
    );

    await session.commitTransaction();

    return res.status(201).json(orden[0]);
  } catch (error) {
    try {
      await session.abortTransaction();
    } catch {}

    // Protección adicional frente a doble solicitud.
    if (error?.code === 11000) {
      const existente = await Order.findOne({
        userId: req.userId,
        clientRequestId:
          req.body?.clientRequestId?.trim(),
      });

      if (existente) {
        return res.status(200).json(existente);
      }
    }

    console.error(
      "ERROR CREANDO ORDEN:",
      error
    );

    return res.status(400).json({
      message:
        error?.message ||
        "No se pudo crear la orden.",
    });
  } finally {
    await session.endSession();
  }
};

/**
 * Listar órdenes.
 */
export const listarOrdenes = async (req, res) => {
  try {
    const filtro = {
      userId: req.userId,
    };

    if (req.query.estado) {
      filtro.estado = req.query.estado;
    }

    const ordenes = await Order.find(filtro)
      .sort({
        createdAt: -1,
      })
      .lean();

    return res.json(ordenes);
  } catch (error) {
    console.error(
      "ERROR LISTANDO ORDENES:",
      error
    );

    return res.status(500).json({
      message:
        "No se pudieron obtener las órdenes.",
    });
  }
};

/**
 * Despachar orden.
 *
 * Aquí ocurre TODO en una sola transacción:
 *
 * 1. Validar orden.
 * 2. Validar cliente.
 * 3. Validar puntos.
 * 4. Verificar stock.
 * 5. Descontar stock.
 * 6. Crear venta.
 * 7. Actualizar puntos.
 * 8. Marcar orden despachada.
 */
export const despacharOrden = async (
  req,
  res
) => {
  const session = await mongoose.startSession();

  try {
    const userId = req.userId;

    const { id } = req.params;

    const {
      clienteId,
      puntosCanjeados,
      metodoPago = "efectivo",
    } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        message: "ID de orden inválido.",
      });
    }

    if (!METODOS_PAGO.includes(metodoPago)) {
      return res.status(400).json({
        message: "Método de pago inválido.",
      });
    }

    const puntosSolicitados = Number(
      puntosCanjeados ?? 0
    );

    if (
      !Number.isInteger(puntosSolicitados) ||
      puntosSolicitados < 0
    ) {
      return res.status(400).json({
        message: "Los puntos a canjear no son válidos.",
      });
    }

    session.startTransaction();

    const orden = await Order.findOne({
      _id: id,
      userId,
    }).session(session);

    if (!orden) {
      await session.abortTransaction();

      return res.status(404).json({
        message: "Orden no encontrada.",
      });
    }

    if (orden.estado === "despachada") {
      await session.abortTransaction();

      return res.status(409).json({
        message: "Esta orden ya fue despachada.",
        orden,
      });
    }

    if (orden.estado === "cancelada") {
      await session.abortTransaction();

      return res.status(409).json({
        message: "Esta orden está cancelada.",
      });
    }

    /*
     * Si el cliente viene desde la orden,
     * usamos ese cliente.
     *
     * Si viene en el request, también lo aceptamos,
     * pero siempre verificamos que pertenezca al usuario.
     */
    const clienteOrdenId =
      clienteId ||
      orden.clienteId ||
      null;

    let cliente = null;

    if (clienteOrdenId) {
      if (
        !mongoose.isValidObjectId(
          clienteOrdenId
        )
      ) {
        await session.abortTransaction();

        return res.status(400).json({
          message: "El cliente no es válido.",
        });
      }

      cliente = await Customer.findOne({
        _id: clienteOrdenId,
        userId,
      }).session(session);

      if (!cliente) {
        await session.abortTransaction();

        return res.status(404).json({
          message: "Cliente no encontrado.",
        });
      }
    }

    /*
     * Si no mandamos puntos explícitamente,
     * utilizamos los puntos que quedaron guardados
     * en la orden.
     */
    const puntosCanjeadosFinal =
      Number.isInteger(puntosSolicitados) &&
      puntosSolicitados > 0
        ? puntosSolicitados
        : Number(orden.puntosCanjeados || 0);

    if (
      puntosCanjeadosFinal > 0 &&
      !cliente
    ) {
      await session.abortTransaction();

      return res.status(400).json({
        message:
          "No se pueden canjear puntos sin un cliente.",
      });
    }

    if (
      cliente &&
      puntosCanjeadosFinal > cliente.puntos
    ) {
      await session.abortTransaction();

      return res.status(409).json({
        message: `El cliente solo tiene ${cliente.puntos} puntos disponibles.`,
      });
    }

    /*
     * Recalculamos el subtotal a partir de la orden.
     * No aceptamos subtotal enviado por el teléfono.
     */
    let subtotal = 0;

    for (const item of orden.items) {
      subtotal +=
        Number(item.precio) *
        Number(item.cantidad);
    }

    const descuentoPuntos =
      Math.min(
        puntosCanjeadosFinal,
        subtotal
      );

    const total = Math.max(
      0,
      subtotal - descuentoPuntos
    );

    /*
     * Verificamos y descontamos stock
     * de manera atómica.
     */
    for (const item of orden.items) {
      const consumo =
        Number(
          item.unidadesStockConsumidas
        );

      if (
        !Number.isFinite(consumo) ||
        consumo <= 0
      ) {
        throw new Error(
          `El consumo de stock de "${item.nombre}" no es válido.`
        );
      }

      const producto =
        await Product.findOneAndUpdate(
          {
            _id: item.productoId,
            userId,
            stock: {
              $gte: consumo,
            },
          },
          {
            $inc: {
              stock: -consumo,
            },
          },
          {
            new: true,
            session,
          }
        );

      if (!producto) {
        throw new Error(
          `Stock insuficiente para "${item.nombre}".`
        );
      }
    }

    /*
     * Puntos ganados:
     * RD$100 = 1 punto.
     */
    const puntosGanados =
      Math.floor(total / 100);

    /*
     * Creamos el snapshot definitivo de la venta.
     */
    const venta = await Sale.create(
      [
        {
          userId,

          clienteId:
            cliente?._id ?? null,

          telefonoCliente:
            cliente?.telefono ??
            orden.telefonoCliente ??
            null,

          puntosCanjeados:
            puntosCanjeadosFinal,

          descuentoPuntos,

          puntosGanados,

          items: orden.items.map(
            (item) => ({
              productoId: item.productoId,
              nombre: item.nombre,
              tipo: item.tipo,
              precio: item.precio,
              cantidad: item.cantidad,
              total: item.total,
              equivalencia:
                item.equivalencia,
              unidadesStockConsumidas:
                item.unidadesStockConsumidas,
            })
          ),

          subtotal,
          total,

          metodoPago,

          numeroOrden:
            orden.numeroOrden,
        },
      ],
      {
        session,
      }
    );

    /*
     * Actualizamos los puntos del cliente
     * dentro de la misma transacción.
     */
    if (cliente) {
      const puntosFinales =
        cliente.puntos -
        puntosCanjeadosFinal +
        puntosGanados;

      cliente.puntos = Math.max(
        0,
        puntosFinales
      );

      await cliente.save({
        session,
      });
    }

    /*
     * Marcamos la orden como despachada.
     */
    orden.estado = "despachada";
    orden.saleId = venta[0]._id;
    orden.subtotal = subtotal;

    orden.clienteId =
      cliente?._id ??
      orden.clienteId ??
      null;

    orden.clienteNombre =
      cliente?.nombre ??
      orden.clienteNombre ??
      null;

    orden.telefonoCliente =
      cliente?.telefono ??
      orden.telefonoCliente ??
      null;

    orden.puntosCanjeados =
      puntosCanjeadosFinal;

    await orden.save({
      session,
    });

    await session.commitTransaction();

    const ordenFinal = await Order.findOne({
      _id: orden._id,
      userId,
    }).lean();

    return res.status(200).json({
      ...ordenFinal,

      venta: venta[0],

      fidelidad: cliente
        ? {
            nombre: cliente.nombre,
            telefono: cliente.telefono,
            puntosCanjeados:
              puntosCanjeadosFinal,
            descuentoPuntos,
            puntosGanados,
            puntosDisponibles:
              cliente.puntos,
          }
        : null,
    });
  } catch (error) {
    try {
      await session.abortTransaction();
    } catch {}

    console.error(
      "ERROR DESPACHANDO ORDEN:",
      error
    );

    const mensaje =
      error?.message ||
      "No se pudo despachar la orden.";

    const esStock =
      mensaje.toLowerCase().includes(
        "stock insuficiente"
      );

    return res.status(
      esStock ? 409 : 400
    ).json({
      message: mensaje,
    });
  } finally {
    await session.endSession();
  }
};