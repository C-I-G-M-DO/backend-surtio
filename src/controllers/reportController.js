import Sale from "../models/sale.js";
import DailyReport from "../models/dailyReport.js";

/**
 * Convierte una fecha YYYY-MM-DD
 * al inicio del día en República Dominicana.
 */
function inicioDelDia(fecha) {
  return new Date(`${fecha}T00:00:00-04:00`);
}

/**
 * Devuelve el inicio del día siguiente.
 */
function finDelDiaExclusivo(fecha) {
  const inicio = inicioDelDia(fecha);

  inicio.setUTCDate(inicio.getUTCDate() + 1);

  return inicio;
}

/**
 * Calcula las estadísticas de un conjunto de ventas.
 */
function calcularReporte(ventas) {
  let ingresos = 0;
  let subtotal = 0;
  let descuentosPuntos = 0;
  let puntosCanjeados = 0;
  let puntosGanados = 0;

  const productosMap = new Map();

  const ventasPorMetodoPago = {
    efectivo: 0,
    tarjeta: 0,
    transferencia: 0,
    mixto: 0,
  };

  for (const venta of ventas) {
    const totalVenta = Number(venta.total) || 0;
    const subtotalVenta = Number(venta.subtotal) || 0;

    ingresos += totalVenta;
    subtotal += subtotalVenta;

    descuentosPuntos += Number(venta.descuentoPuntos) || 0;
    puntosCanjeados += Number(venta.puntosCanjeados) || 0;
    puntosGanados += Number(venta.puntosGanados) || 0;

    const metodo = venta.metodoPago || "efectivo";

    if (ventasPorMetodoPago[metodo] !== undefined) {
      ventasPorMetodoPago[metodo] += totalVenta;
    }

    for (const item of venta.items || []) {
      const productoId = item.productoId
        ? String(item.productoId)
        : `sin-id-${item.nombre}`;

      if (!productosMap.has(productoId)) {
        productosMap.set(productoId, {
          productoId: item.productoId || null,
          nombre: item.nombre,
          cantidadVendida: 0,
          unidadesStockConsumidas: 0,
          totalVendido: 0,
        });
      }

      const producto = productosMap.get(productoId);

      const cantidad = Number(item.cantidad) || 0;

      let unidadesStock = cantidad;

      if (item.tipo === "paquete") {
        const equivalencia =
          Number(item.equivalencia) || 1;

        unidadesStock = cantidad * equivalencia;
      }

      producto.cantidadVendida += cantidad;
      producto.unidadesStockConsumidas += unidadesStock;
      producto.totalVendido += Number(item.total) || 0;
    }
  }

  const cantidadVentas = ventas.length;

  const ticketPromedio =
    cantidadVentas > 0
      ? ingresos / cantidadVentas
      : 0;

  return {
    cantidadVentas,

    ingresos,

    subtotal,

    descuentosPuntos,

    puntosCanjeados,

    puntosGanados,

    ticketPromedio,

    productosVendidos: Array.from(
      productosMap.values()
    ).sort(
      (a, b) =>
        b.totalVendido - a.totalVendido
    ),

    ventasPorMetodoPago,
  };
}

/**
 * GENERAR REPORTE POR RANGO DE FECHAS
 *
 * GET
 * /api/reports?desde=2026-10-01&hasta=2026-10-02
 */
export const obtenerReportePorRango = async (
  req,
  res
) => {
  try {
    const { desde, hasta } = req.query;

    if (!desde || !hasta) {
      return res.status(400).json({
        message:
          "Debes especificar las fechas desde y hasta",
      });
    }

    const fechaInicio = inicioDelDia(desde);
    const fechaFin = finDelDiaExclusivo(hasta);

    if (
      Number.isNaN(fechaInicio.getTime()) ||
      Number.isNaN(fechaFin.getTime())
    ) {
      return res.status(400).json({
        message: "Formato de fecha inválido",
      });
    }

    if (fechaInicio >= fechaFin) {
      return res.status(400).json({
        message:
          "La fecha inicial debe ser anterior o igual a la fecha final",
      });
    }

    const ventas = await Sale.find({
      userId: req.userId,

      createdAt: {
        $gte: fechaInicio,
        $lt: fechaFin,
      },
    }).sort({
      createdAt: 1,
    });

    const reporte = calcularReporte(ventas);

    res.json({
      desde,
      hasta,

      ...reporte,

      ventas: ventas.map((venta) => ({
        numeroOrden: venta.numeroOrden,
        fecha: venta.createdAt,
        subtotal: venta.subtotal,
        total: venta.total,
        metodoPago: venta.metodoPago,
        clienteId: venta.clienteId,
        telefonoCliente: venta.telefonoCliente,
        puntosCanjeados: venta.puntosCanjeados,
        puntosGanados: venta.puntosGanados,
      })),
    });
  } catch (error) {
    console.error(
      "ERROR OBTENIENDO REPORTE:",
      error
    );

    res.status(500).json({
      message: "Error obteniendo reporte",
      error: error.message,
    });
  }
};

/**
 * OBTENER REPORTE DIARIO GUARDADO
 *
 * GET
 * /api/reports/daily?fecha=2026-10-02
 */
export const obtenerReporteDiario = async (
  req,
  res
) => {
  try {
    const { fecha } = req.query;

    if (!fecha) {
      return res.status(400).json({
        message: "Debes especificar la fecha",
      });
    }

    const reporte = await DailyReport.findOne({
      userId: req.userId,
      fecha,
    });

    if (!reporte) {
      return res.status(404).json({
        message:
          "No existe un reporte diario para esta fecha",
      });
    }

    res.json(reporte);
  } catch (error) {
    console.error(
      "ERROR OBTENIENDO REPORTE DIARIO:",
      error
    );

    res.status(500).json({
      message: "Error obteniendo reporte diario",
      error: error.message,
    });
  }
};

/**
 * OBTENER LISTA DE REPORTES DIARIOS
 *
 * GET
 * /api/reports/daily
 */
export const listarReportesDiarios = async (
  req,
  res
) => {
  try {
    const reportes = await DailyReport.find({
      userId: req.userId,
    }).sort({
      fecha: -1,
    });

    res.json(reportes);
  } catch (error) {
    console.error(
      "ERROR LISTANDO REPORTES:",
      error
    );

    res.status(500).json({
      message: "Error listando reportes",
      error: error.message,
    });
  }
};

/**
 * GENERAR Y GUARDAR REPORTE DIARIO
 *
 * Esta función será utilizada por el proceso automático.
 */
export const generarReporteDiario = async (
  fecha,
  userId
) => {
  const fechaInicio = inicioDelDia(fecha);
  const fechaFin = finDelDiaExclusivo(fecha);

  const ventas = await Sale.find({
    userId,

    createdAt: {
      $gte: fechaInicio,
      $lt: fechaFin,
    },
  });

  const reporteCalculado =
    calcularReporte(ventas);

  const reporte =
    await DailyReport.findOneAndUpdate(
      {
        userId,
        fecha,
      },
      {
        userId,
        fecha,

        ...reporteCalculado,

        generadoAutomaticamente: true,
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    );

  return reporte;
};