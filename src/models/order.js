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

const orderItemSchema = new mongoose.Schema(
  {
    productoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
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

    cantidad: {
      type: Number,
      required: true,
      min: 0.01,
    },

    precio: {
      type: Number,
      required: true,
      min: 0,
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

    unidadesStockConsumidas: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    clientRequestId: {
      type: String,
      required: true,
      trim: true,
    },

    numeroOrden: {
      type: Number,
      required: true,
    },

    estado: {
      type: String,
      enum: ["pendiente", "despachada", "cancelada"],
      default: "pendiente",
    },

    createdByName: {
      type: String,
      default: "",
      trim: true,
    },

    clienteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
    },

    clienteNombre: {
      type: String,
      default: null,
      trim: true,
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

    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },

    items: {
      type: [orderItemSchema],
      default: [],
    },

    saleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sale",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Evita crear dos órdenes por el mismo intento del dispositivo.
orderSchema.index(
  {
    userId: 1,
    clientRequestId: 1,
  },
  {
    unique: true,
  }
);

// Hace eficiente la pantalla de despacho.
orderSchema.index({
  userId: 1,
  estado: 1,
  createdAt: -1,
});

export default mongoose.models.Order ||
  mongoose.model("Order", orderSchema);