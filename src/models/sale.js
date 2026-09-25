import mongoose from "mongoose";

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
      enum: ["unidad", "libra", "paquete"],
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
      min: 1,
    },

    total: {
      type: Number,
      required: true,
      min: 0,
    },

    equivalencia: {
      type: Number,
      default: null,
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

    // ================================
    // CLIENTE / FIDELIDAD
    // ================================

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

    // ================================
    // VENTA
    // ================================

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

export default mongoose.models.Sale ||
  mongoose.model("Sale", saleSchema);