import mongoose from "mongoose";

const productoReporteSchema = new mongoose.Schema(
  {
    productoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },

    nombre: {
      type: String,
      required: true,
    },

    cantidadVendida: {
      type: Number,
      default: 0,
    },

    unidadesStockConsumidas: {
      type: Number,
      default: 0,
    },

    totalVendido: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

const dailyReportSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Ejemplo: 2026-10-02
    fecha: {
      type: String,
      required: true,
    },

    cantidadVentas: {
      type: Number,
      default: 0,
    },

    ingresos: {
      type: Number,
      default: 0,
    },

    subtotal: {
      type: Number,
      default: 0,
    },

    descuentosPuntos: {
      type: Number,
      default: 0,
    },

    puntosCanjeados: {
      type: Number,
      default: 0,
    },

    puntosGanados: {
      type: Number,
      default: 0,
    },

    ticketPromedio: {
      type: Number,
      default: 0,
    },

    productosVendidos: {
      type: [productoReporteSchema],
      default: [],
    },

    ventasPorMetodoPago: {
      efectivo: {
        type: Number,
        default: 0,
      },

      tarjeta: {
        type: Number,
        default: 0,
      },

      transferencia: {
        type: Number,
        default: 0,
      },

      mixto: {
        type: Number,
        default: 0,
      },
    },

    generadoAutomaticamente: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Un reporte diario por usuario y fecha
dailyReportSchema.index(
  { userId: 1, fecha: 1 },
  { unique: true }
);

export default mongoose.models.DailyReport ||
  mongoose.model("DailyReport", dailyReportSchema);