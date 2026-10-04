import mongoose from "mongoose";

const TIPOS_PRESENTACION = [
  "unidad",
  "paquete",
  "docena",
  "libra",
  "media_libra",
  "cuarta",
  "onza",
];

const itemSchema = new mongoose.Schema(
  {
    productoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },

    nombre: {
      type: String,
      required: true,
      trim: true,
    },

    tipo: {
      type: String,
      enum: TIPOS_PRESENTACION,
      required: true,
    },

    precio: {
      type: Number,
      required: true,
      min: 0,
    },

    cantidad: {
      type: Number,
      required: true,
      min: 0.01,
    },

    total: {
      type: Number,
      required: true,
      min: 0,
    },

    equivalencia: {
      type: Number,
      default: null,
      min: 1,
    },

    // Cantidad real descontada del inventario.
    //
    // Ejemplos:
    // unidad       -> 2
    // paquete x 6  -> 12 si se venden 2 paquetes
    // docena x 12  -> 24 si se venden 2 docenas
    // libra        -> 2
    // media_libra  -> 1
    // cuarta       -> 0.5
    // onza         -> 0.125
    unidadesStockConsumidas: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const saleSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // =================================
    // CLIENTE / FIDELIDAD
    // =================================

    clienteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
    },

    telefonoCliente: {
      type: String,
      default: null,
      trim: true,
    },

    puntosCanjeados: {
      type: Number,
      default: 0,
      min: 0,
    },

    descuentoPuntos: {
      type: Number,
      default: 0,
      min: 0,
    },

    puntosGanados: {
      type: Number,
      default: 0,
      min: 0,
    },

    // =================================
    // VENTA
    // =================================

    items: {
      type: [itemSchema],
      default: [],
    },

    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },

    total: {
      type: Number,
      required: true,
      min: 0,
    },

    metodoPago: {
      type: String,
      enum: [
        "efectivo",
        "tarjeta",
        "transferencia",
        "mixto",
      ],
      default: "efectivo",
    },

    numeroOrden: {
      type: Number,
      unique: true,
    },
  },
  {
    timestamps: true,
  }
);

export { TIPOS_PRESENTACION };

export default mongoose.models.Sale ||
  mongoose.model("Sale", saleSchema);