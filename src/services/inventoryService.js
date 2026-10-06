import Product from "../models/product.js";

/**
 * ============================================================
 * CALCULAR CUÁNTO STOCK FÍSICO CONSUME UNA PRESENTACIÓN
 * ============================================================
 *
 * Ejemplos:
 *
 * unidad x 3       = 3 unidades
 * paquete x 2      = 2 * equivalencia
 * docena x 1       = 12 unidades
 *
 * libra x 2        = 2 libras
 * media_libra x 2  = 1 libra
 * cuarta x 4       = 1 libra
 * onza x 16        = 1 libra
 */
export const calcularConsumoStock = (item) => {
  const cantidad = Number(item.cantidad);

  if (
    !Number.isFinite(cantidad) ||
    cantidad <= 0
  ) {
    throw new Error(
      "Cantidad inválida en uno de los productos"
    );
  }

  switch (item.tipo) {
    case "unidad":
      return cantidad;

    case "paquete": {
      const equivalencia = Number(item.equivalencia);

      if (
        !Number.isFinite(equivalencia) ||
        equivalencia <= 0
      ) {
        throw new Error(
          "La equivalencia del paquete no es válida"
        );
      }

      return cantidad * equivalencia;
    }

    case "docena":
      return cantidad * 12;

    case "libra":
      return cantidad;

    case "media_libra":
      return cantidad * 0.5;

    case "cuarta":
      return cantidad * 0.25;

    case "onza":
      return cantidad * 0.0625;

    default:
      throw new Error(
        `Tipo de presentación inválido: ${item.tipo}`
      );
  }
};


/**
 * ============================================================
 * DESCONTAR STOCK DE UN PRODUCTO
 * ============================================================
 *
 * Esta función DEBE ejecutarse dentro de una transacción.
 *
 * session = sesión MongoDB de la transacción.
 */
export const descontarStockProducto = async ({
  productoId,
  userId,
  cantidad,
  tipo,
  equivalencia,
  session,
}) => {
  const consumo = calcularConsumoStock({
    cantidad,
    tipo,
    equivalencia,
  });

  // ==========================================================
  // BUSCAR PRODUCTO
  // ==========================================================

  const producto = await Product.findOne({
    _id: productoId,
    userId,
  }).session(session);

  if (!producto) {
    throw new Error(
      `El producto ${productoId} no existe`
    );
  }

  // ==========================================================
  // VALIDAR STOCK GENERAL
  // ==========================================================

  const stockActual = Number(producto.stock) || 0;

  if (stockActual < consumo) {
    throw new Error(
      `Stock insuficiente para ${producto.nombre}. ` +
      `Stock disponible: ${stockActual}`
    );
  }

  // ==========================================================
  // PRODUCTO SIN VENCIMIENTO
  // ==========================================================

  if (
    !producto.vence ||
    !Array.isArray(producto.lotes) ||
    producto.lotes.length === 0
  ) {
    producto.stock = stockActual - consumo;

    await producto.save({
      session,
    });

    return producto;
  }

  // ==========================================================
  // PRODUCTO CON VENCIMIENTO
  // ==========================================================

  const ahora = new Date();

  /**
   * Solo utilizamos lotes:
   *
   * - con cantidad disponible
   * - cuya fecha todavía no haya vencido
   */
  const lotesDisponibles = producto.lotes
    .filter((lote) => {
      if (!lote) return false;

      const disponible =
        Number(lote.cantidadDisponible) || 0;

      if (disponible <= 0) {
        return false;
      }

      const fecha =
        new Date(lote.fechaVencimiento);

      if (Number.isNaN(fecha.getTime())) {
        return false;
      }

      return fecha >= ahora;
    })
    .sort(
      (a, b) =>
        new Date(a.fechaVencimiento).getTime() -
        new Date(b.fechaVencimiento).getTime()
    );

  // ==========================================================
  // VALIDAR QUE LOS LOTES TIENEN SUFICIENTE INVENTARIO
  // ==========================================================

  const stockPorLotes = lotesDisponibles.reduce(
    (total, lote) =>
      total +
      (Number(lote.cantidadDisponible) || 0),
    0
  );

  if (stockPorLotes < consumo) {
    throw new Error(
      `Stock insuficiente para ${producto.nombre}. ` +
      `El inventario disponible en lotes vigentes es ` +
      `${stockPorLotes}`
    );
  }

  // ==========================================================
  // CONSUMIR FEFO
  // ==========================================================
  //
  // FEFO = First Expired, First Out
  //
  // Primero sale el lote que vence primero.
  // ==========================================================

  let pendiente = consumo;

  for (const lote of lotesDisponibles) {
    if (pendiente <= 0) {
      break;
    }

    const disponible =
      Number(lote.cantidadDisponible) || 0;

    if (disponible <= 0) {
      continue;
    }

    const descontar = Math.min(
      disponible,
      pendiente
    );

    lote.cantidadDisponible =
      disponible - descontar;

    pendiente -= descontar;
  }

  // ==========================================================
  // SEGURIDAD
  // ==========================================================

  if (pendiente > 0.000001) {
    throw new Error(
      `No fue posible completar el descuento de ` +
      `stock de ${producto.nombre}`
    );
  }

  // ==========================================================
  // ACTUALIZAR STOCK GENERAL
  // ==========================================================

  producto.stock =
    stockActual - consumo;

  // Evitar errores pequeños de coma flotante
  if (Math.abs(producto.stock) < 0.000001) {
    producto.stock = 0;
  }

  // ==========================================================
  // GUARDAR PRODUCTO
  // ==========================================================

  await producto.save({
    session,
  });

  return producto;
};