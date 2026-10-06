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
 * =========================================================
 * CALCULAR CONSUMO DE STOCK
 * =========================================================
 *
 * Productos con stock por unidad:
 *
 * unidad  -> 1
 * paquete -> equivalencia
 * docena  -> 12
 *
 * Productos con stock por libra:
 *
 * libra       -> 1 lb
 * media_libra -> 0.5 lb
 * cuarta      -> 0.25 lb
 * onza        -> 0.0625 lb
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
 * =========================================================
 * VALIDAR PRESENTACIÓN
 * =========================================================
 */
function validarPresentacionProducto(
  producto,
  tipo,
  equivalencia
) {
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
 * =========================================================
 * OBTENER PRECIO
 * =========================================================
 */
function obtenerPrecioPresentacion(
  producto,
  tipo
) {
  const precio = producto.precios?.find(
    (item) => item.tipo === tipo
  );

  if (!precio) {
    throw new Error(
      `El producto "${producto.nombre}" no tiene precio para ${tipo}.`
    );
  }

  const valor = Number(precio.valor);

  if (
    !Number.isFinite(valor) ||
    valor < 0
  ) {
    throw new Error(
      `El precio de "${producto.nombre}" no es válido.`
    );
  }

  return {
    ...precio.toObject?.() ?? precio,
    valor,
    equivalencia:
      precio.equivalencia ?? null,
  };
}

/**
 * =========================================================
 * VALIDAR CANTIDAD
 * =========================================================
 */
function validarCantidad(
  cantidad,
  unidadStock
) {
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
 * =========================================================
 * OBTENER SIGUIENTE NÚMERO DE ORDEN
 * =========================================================
 */
async function obtenerSiguienteNumeroOrden(
  userId,
  session
) {
  const counter =
    await Counter.findOneAndUpdate(
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
 * =========================================================
 * OBTENER NOMBRE DEL USUARIO
 * =========================================================
 */
function obtenerNombreUsuario(req) {
  if (req.user?.name) {
    return req.user.name;
  }

  if (req.user?.nombre) {
    return req.user.nombre;
  }

  if (req.user?.businessName) {
    return req.user.businessName;
  }

  return "";
}

/**
 * =========================================================
 * FECHA DE VENCIMIENTO
 * =========================================================
 *
 * Se compara por día y no por hora.
 *
 * Por ejemplo:
 *
 * 06/10/2026
 *
 * sigue siendo válido durante todo ese día.
 */
function inicioDelDia(fecha) {
  const resultado = new Date(fecha);

  resultado.setHours(
    0,
    0,
    0,
    0
  );

  return resultado;
}

/**
 * =========================================================
 * DESCONTAR STOCK NORMAL
 * =========================================================
 *
 * Para productos SIN vencimiento.
 */
async function descontarStockNormal({
  producto,
  consumo,
  userId,
  session,
}) {
  if (
    !Number.isFinite(consumo) ||
    consumo <= 0
  ) {
    throw new Error(
      `El consumo de stock de "${producto.nombre}" no es válido.`
    );
  }

  if (producto.stock < consumo) {
    throw new Error(
      `Stock insuficiente para "${producto.nombre}". ` +
        `Stock disponible: ${producto.stock}`
    );
  }

  producto.stock =
    producto.stock - consumo;

  await producto.save({
    session,
  });

  return producto;
}

/**
 * =========================================================
 * DESCONTAR STOCK FEFO
 * =========================================================
 *
 * FEFO =
 * First Expired, First Out
 *
 * Se utiliza primero el lote que vence más pronto.
 *
 * IMPORTANTE:
 * - Actualiza cantidadDisponible del lote.
 * - Actualiza stock general.
 * - Todo ocurre dentro de la misma transacción.
 */
async function descontarStockFEFO({
  producto,
  consumo,
  session,
}) {
  if (
    !Number.isFinite(consumo) ||
    consumo <= 0
  ) {
    throw new Error(
      `El consumo de stock de "${producto.nombre}" no es válido.`
    );
  }

  if (
    !Array.isArray(producto.lotes) ||
    producto.lotes.length === 0
  ) {
    throw new Error(
      `El producto "${producto.nombre}" está configurado con vencimiento pero no tiene lotes disponibles.`
    );
  }

  /**
   * Fecha de hoy.
   *
   * Un producto que vence hoy todavía se considera válido.
   */
  const hoy = inicioDelDia(
    new Date()
  );

  /**
   * Solo utilizamos lotes:
   *
   * - con cantidad disponible
   * - que no estén vencidos
   */
  const lotesDisponibles =
    producto.lotes
      .filter((lote) => {
        const cantidadDisponible =
          Number(
            lote.cantidadDisponible
          );

        if (
          !Number.isFinite(
            cantidadDisponible
          ) ||
          cantidadDisponible <= 0
        ) {
          return false;
        }

        if (
          !lote.fechaVencimiento
        ) {
          return false;
        }

        const vencimiento =
          inicioDelDia(
            lote.fechaVencimiento
          );

        return vencimiento >= hoy;
      })
      .sort(
        (a, b) =>
          new Date(
            a.fechaVencimiento
          ).getTime() -
          new Date(
            b.fechaVencimiento
          ).getTime()
      );

  /**
   * Cuánto stock válido tenemos realmente
   * en los lotes.
   */
  const stockDisponibleEnLotes =
    lotesDisponibles.reduce(
      (total, lote) =>
        total +
        Number(
          lote.cantidadDisponible
        ),
      0
    );

  if (
    stockDisponibleEnLotes < consumo
  ) {
    throw new Error(
      `Stock vigente insuficiente para "${producto.nombre}". ` +
        `Disponible en lotes no vencidos: ${stockDisponibleEnLotes}. ` +
        `Necesario: ${consumo}.`
    );
  }

  let restante = consumo;

  /**
   * FEFO
   *
   * Comenzamos por el lote que vence primero.
   */
  for (const lote of lotesDisponibles) {
    if (restante <= 0) {
      break;
    }

    const disponible =
      Number(
        lote.cantidadDisponible
      );

    const descontar =
      Math.min(
        disponible,
        restante
      );

    lote.cantidadDisponible =
      disponible - descontar;

    restante -= descontar;

    /**
     * Evitamos pequeños errores
     * de punto flotante.
     */
    lote.cantidadDisponible =
      Math.round(
        (
          lote.cantidadDisponible +
          Number.EPSILON
        ) * 1000000
      ) / 1000000;

    restante =
      Math.round(
        (
          restante +
          Number.EPSILON
        ) * 1000000
      ) / 1000000;
  }

  if (restante > 0) {
    throw new Error(
      `No fue posible completar el consumo de stock de "${producto.nombre}".`
    );
  }

  /**
   * El stock general siempre representa
   * el total del producto.
   */
  producto.stock =
    Math.max(
      0,
      Number(producto.stock) -
        consumo
    );

  await producto.save({
    session,
  });

  return producto;
}

/**
 * =========================================================
 * DESCONTAR STOCK
 * =========================================================
 *
 * Decide automáticamente:
 *
 * vence = true
 *      -> FEFO
 *
 * vence = false
 *      -> stock normal
 */
async function descontarStockProducto({
  productoId,
  userId,
  consumo,
  session,
}) {
  const producto =
    await Product.findOne({
      _id: productoId,
      userId,
    }).session(session);

  if (!producto) {
    throw new Error(
      "Producto no encontrado."
    );
  }

  if (producto.vence === true) {
    await descontarStockFEFO({
      producto,
      consumo,
      session,
    });
  } else {
    await descontarStockNormal({
      producto,
      consumo,
      userId,
      session,
    });
  }

  return producto;
}

/**
 * =========================================================
 * CREAR ORDEN
 * =========================================================
 *
 * IMPORTANTE:
 *
 * AQUÍ NO SE DESCUENTA INVENTARIO.
 *
 * El inventario solamente se descuenta
 * cuando la orden es despachada.
 */
export const crearOrden = async (
  req,
  res
) => {
  const session =
    await mongoose.startSession();

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
      typeof clientRequestId !== "string" ||
      !clientRequestId.trim()
    ) {
      return res.status(400).json({
        message:
          "clientRequestId es requerido.",
      });
    }

    if (
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return res.status(400).json({
        message:
          "La orden debe contener productos.",
      });
    }

    const puntos =
      Number(puntosCanjeados);

    if (
      !Number.isInteger(puntos) ||
      puntos < 0
    ) {
      return res.status(400).json({
        message:
          "Los puntos a canjear no son válidos.",
      });
    }

    const clientRequestIdLimpio =
      clientRequestId.trim();

    /**
     * Idempotencia:
     *
     * Si el teléfono vuelve a enviar
     * exactamente la misma orden,
     * devolvemos la orden anterior.
     */
    const ordenExistente =
      await Order.findOne({
        userId,
        clientRequestId:
          clientRequestIdLimpio,
      });

    if (ordenExistente) {
      return res.status(200).json(
        ordenExistente
      );
    }

    session.startTransaction();

    let cliente = null;

    /**
     * =====================================================
     * CLIENTE
     * =====================================================
     */
    if (clienteId) {
      if (
        !mongoose.isValidObjectId(
          clienteId
        )
      ) {
        throw new Error(
          "El cliente no es válido."
        );
      }

      cliente =
        await Customer.findOne({
          _id: clienteId,
          userId,
        }).session(session);

      if (!cliente) {
        throw new Error(
          "Cliente no encontrado."
        );
      }

      if (
        puntos > cliente.puntos
      ) {
        throw new Error(
          `El cliente solo tiene ${cliente.puntos} puntos disponibles.`
        );
      }
    } else if (puntos > 0) {
      throw new Error(
        "No puedes canjear puntos sin seleccionar un cliente."
      );
    }

    /**
     * =====================================================
     * PRODUCTOS
     * =====================================================
     */
    const itemsVenta = [];

    let subtotal = 0;

    for (const item of items) {
      if (
        !item?.productoId ||
        !mongoose.isValidObjectId(
          item.productoId
        )
      ) {
        throw new Error(
          "Uno de los productos de la orden no es válido."
        );
      }

      const producto =
        await Product.findOne({
          _id: item.productoId,
          userId,
        }).session(session);

      if (!producto) {
        throw new Error(
          "Uno de los productos ya no existe o no pertenece a este negocio."
        );
      }

      const tipo = item.tipo;

      const cantidad =
        Number(item.cantidad);

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
        precioProducto.equivalencia ??
        null;

      validarPresentacionProducto(
        producto,
        tipo,
        equivalencia
      );

      const consumo =
        calcularConsumoStock({
          unidadStock:
            producto.unidadStock,
          tipo,
          cantidad,
          equivalencia,
        });

      const totalItem =
        Math.round(
          (
            precioProducto.valor *
              cantidad +
            Number.EPSILON
          ) * 100
        ) / 100;

      subtotal += totalItem;

      itemsVenta.push({
        productoId:
          producto._id,
        nombre:
          producto.nombre,
        tipo,
        cantidad,
        precio:
          precioProducto.valor,
        total:
          totalItem,
        equivalencia,
        unidadesStockConsumidas:
          consumo,
      });
    }

    subtotal =
      Math.round(
        (
          subtotal +
          Number.EPSILON
        ) * 100
      ) / 100;

    /**
     * =====================================================
     * NÚMERO DE ORDEN
     * =====================================================
     */
    const numeroOrden =
      await obtenerSiguienteNumeroOrden(
        userId,
        session
      );

    /**
     * =====================================================
     * CREAR ORDEN
     * =====================================================
     */
    const orden =
      await Order.create(
        [
          {
            userId,

            clientRequestId:
              clientRequestIdLimpio,

            numeroOrden,

            estado: "pendiente",

            createdByName:
              obtenerNombreUsuario(req),

            clienteId:
              cliente?._id ?? null,

            clienteNombre:
              cliente?.nombre ?? null,

            telefonoCliente:
              cliente?.telefono ?? null,

            puntosCanjeados:
              puntos,

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

    return res.status(201).json(
      orden[0]
    );
  } catch (error) {
    try {
      await session.abortTransaction();
    } catch {}

    /**
     * Protección adicional
     * contra doble solicitud.
     */
    if (error?.code === 11000) {
      const existente =
        await Order.findOne({
          userId: req.userId,
          clientRequestId:
            req.body?.clientRequestId?.trim(),
        });

      if (existente) {
        return res.status(200).json(
          existente
        );
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
 * =========================================================
 * LISTAR ÓRDENES
 * =========================================================
 */
export const listarOrdenes = async (
  req,
  res
) => {
  try {
    const filtro = {
      userId: req.userId,
    };

    if (req.query.estado) {
      filtro.estado =
        req.query.estado;
    }

    const ordenes =
      await Order.find(filtro)
        .sort({
          createdAt: -1,
        })
        .lean();

    return res.json(
      ordenes
    );
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
 * =========================================================
 * DESPACHAR ORDEN
 * =========================================================
 *
 * AQUÍ SE REALIZA LA VENTA REAL.
 *
 * Flujo:
 *
 * 1. Buscar orden.
 * 2. Verificar que esté pendiente.
 * 3. Validar método de pago.
 * 4. Obtener cliente.
 * 5. Validar puntos.
 * 6. Calcular subtotal.
 * 7. Descontar inventario FEFO.
 * 8. Calcular total.
 * 9. Calcular puntos ganados.
 * 10. Crear venta.
 * 11. Actualizar puntos.
 * 12. Marcar orden despachada.
 * 13. Commit.
 */
export const despacharOrden = async (
  req,
  res
) => {
  const session =
    await mongoose.startSession();

  try {
    const userId = req.userId;

    const { id } =
      req.params;

    /**
     * El método de pago se confirma
     * en despacho.
     */
    const {
      metodoPago = "efectivo",
    } = req.body;

    if (
      !mongoose.isValidObjectId(id)
    ) {
      return res.status(400).json({
        message:
          "ID de orden inválido.",
      });
    }

    if (
      !METODOS_PAGO.includes(
        metodoPago
      )
    ) {
      return res.status(400).json({
        message:
          "Método de pago inválido.",
      });
    }

    session.startTransaction();

    /**
     * =====================================================
     * BUSCAR ORDEN
     * =====================================================
     */
    const orden =
      await Order.findOne({
        _id: id,
        userId,
      }).session(session);

    if (!orden) {
      throw new Error(
        "Orden no encontrada."
      );
    }

    /**
     * Protección contra doble despacho.
     */
    if (
      orden.estado ===
      "despachada"
    ) {
      await session.abortTransaction();

      return res.status(409).json({
        message:
          "Esta orden ya fue despachada.",
        orden,
      });
    }

    if (
      orden.estado ===
      "cancelada"
    ) {
      throw new Error(
        "Esta orden está cancelada."
      );
    }

    /**
     * =====================================================
     * CLIENTE
     * =====================================================
     *
     * El cliente guardado en la orden
     * es la fuente de verdad.
     */
    let cliente = null;

    if (orden.clienteId) {
      cliente =
        await Customer.findOne({
          _id:
            orden.clienteId,
          userId,
        }).session(session);

      if (!cliente) {
        throw new Error(
          "El cliente asociado a la orden ya no existe."
        );
      }
    }

    /**
     * =====================================================
     * PUNTOS
     * =====================================================
     */
    const puntosCanjeados =
      Number(
        orden.puntosCanjeados ||
          0
      );

    if (
      !Number.isInteger(
        puntosCanjeados
      ) ||
      puntosCanjeados < 0
    ) {
      throw new Error(
        "Los puntos guardados en la orden no son válidos."
      );
    }

    if (
      puntosCanjeados > 0 &&
      !cliente
    ) {
      throw new Error(
        "La orden tiene puntos para canjear pero no tiene un cliente asociado."
      );
    }

    if (
      cliente &&
      puntosCanjeados >
        cliente.puntos
    ) {
      throw new Error(
        `El cliente solo tiene ${cliente.puntos} puntos disponibles.`
      );
    }

    /**
     * =====================================================
     * RECALCULAR SUBTOTAL
     * =====================================================
     *
     * No confiamos en un subtotal
     * enviado por el teléfono.
     */
    let subtotal = 0;

    for (const item of orden.items) {
      const totalItem =
        Number(item.precio) *
        Number(item.cantidad);

      subtotal += totalItem;
    }

    subtotal =
      Math.round(
        (
          subtotal +
          Number.EPSILON
        ) * 100
      ) / 100;

    /**
     * =====================================================
     * DESCUENTO POR PUNTOS
     * =====================================================
     *
     * 1 punto = RD$1
     */
    if (
      puntosCanjeados >
      subtotal
    ) {
      throw new Error(
        "Los puntos a canjear no pueden superar el subtotal de la venta."
      );
    }

    const descuentoPuntos =
      puntosCanjeados;

    const total =
      Math.round(
        (
          subtotal -
          descuentoPuntos +
          Number.EPSILON
        ) * 100
      ) / 100;

    /**
     * =====================================================
     * DESCONTAR INVENTARIO
     * =====================================================
     *
     * IMPORTANTE:
     *
     * Aquí es donde ocurre el FEFO.
     *
     * Si el producto:
     *
     * vence = true
     *
     * se utiliza primero el lote con
     * fecha de vencimiento más cercana.
     */
    for (const item of orden.items) {
      const consumo =
        Number(
          item.unidadesStockConsumidas
        );

      if (
        !Number.isFinite(
          consumo
        ) ||
        consumo <= 0
      ) {
        throw new Error(
          `El consumo de stock de "${item.nombre}" no es válido.`
        );
      }

      await descontarStockProducto({
        productoId:
          item.productoId,
        userId,
        consumo,
        session,
      });
    }

    /**
     * =====================================================
     * PUNTOS GANADOS
     * =====================================================
     *
     * RD$100 = 1 punto
     */
    const puntosGanados =
      Math.floor(
        total / 100
      );

    /**
     * =====================================================
     * CREAR VENTA
     * =====================================================
     */
    const venta =
      await Sale.create(
        [
          {
            userId,

            numeroOrden:
              orden.numeroOrden,

            items:
              orden.items.map(
                (item) => ({
                  productoId:
                    item.productoId,

                  nombre:
                    item.nombre,

                  tipo:
                    item.tipo,

                  precio:
                    item.precio,

                  cantidad:
                    item.cantidad,

                  total:
                    item.total,

                  equivalencia:
                    item.equivalencia ??
                    null,

                  unidadesStockConsumidas:
                    item.unidadesStockConsumidas,
                })
              ),

            subtotal,

            total,

            metodoPago,

            clienteId:
              cliente?._id ??
              null,

            telefonoCliente:
              cliente?.telefono ??
              orden.telefonoCliente ??
              null,

            puntosCanjeados,

            descuentoPuntos,

            puntosGanados,
          },
        ],
        {
          session,
        }
      );

    /**
     * =====================================================
     * ACTUALIZAR PUNTOS DEL CLIENTE
     * =====================================================
     */
    if (cliente) {
      const puntosFinales =
        Number(cliente.puntos) -
        puntosCanjeados +
        puntosGanados;

      cliente.puntos =
        Math.max(
          0,
          puntosFinales
        );

      await cliente.save({
        session,
      });
    }

    /**
     * =====================================================
     * MARCAR ORDEN COMO DESPACHADA
     * =====================================================
     */
    orden.estado =
      "despachada";

    orden.saleId =
      venta[0]._id;

    orden.subtotal =
      subtotal;

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
      puntosCanjeados;

    await orden.save({
      session,
    });

    /**
     * =====================================================
     * CONFIRMAR TRANSACCIÓN
     * =====================================================
     */
    await session.commitTransaction();

    /**
     * Obtenemos la orden definitiva.
     */
    const ordenFinal =
      await Order.findOne({
        _id: orden._id,
        userId,
      }).lean();

    return res.status(200).json({
      ...ordenFinal,

      venta:
        venta[0],

      fidelidad:
        cliente
          ? {
              clienteId:
                cliente._id,

              nombre:
                cliente.nombre,

              telefono:
                cliente.telefono,

              puntosCanjeados,

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

    const mensajeLower =
      mensaje.toLowerCase();

    const esStock =
      mensajeLower.includes(
        "stock insuficiente"
      ) ||
      mensajeLower.includes(
        "stock vigente insuficiente"
      ) ||
      mensajeLower.includes(
        "lotes no vencidos"
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