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

const precioSchema = new mongoose.Schema(
  {
    tipo: {
      type: String,
      enum: TIPOS_PRESENTACION,
      required: true,
    },

    valor: {
      type: Number,
      required: true,
      min: 0,
    },

    // Solo aplica para paquete
    equivalencia: {
      type: Number,
      default: null,
      min: 1,
    },
  },
  { _id: false }
);

/**
 * Lote de inventario.
 *
 * Cada lote representa una entrada de mercancía
 * con su propia fecha de vencimiento.
 */
const loteSchema = new mongoose.Schema(
  {
    cantidadInicial: {
      type: Number,
      required: true,
      min: 0,
    },

    cantidadDisponible: {
      type: Number,
      required: true,
      min: 0,
    },

    fechaVencimiento: {
      type: Date,
      required: true,
    },
  },
  {
    _id: true,
  }
);

const productSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: true,
      trim: true,
    },

    /**
     * Indica cómo se almacena físicamente el inventario.
     *
     * unidad -> stock entero
     * libra  -> stock decimal
     */
    unidadStock: {
      type: String,
      enum: ["unidad", "libra"],
      required: true,
    },

    precios: {
      type: [precioSchema],
      default: [],
    },

    stock: {
      type: Number,
      required: true,
      min: 0,
    },

    /**
     * Indica si este producto maneja fecha de vencimiento.
     */
    vence: {
      type: Boolean,
      default: false,
    },

    /**
     * Inventario dividido por lotes.
     *
     * Un producto que no vence tendrá normalmente:
     * lotes: []
     *
     * Un producto que vence tendrá uno o varios lotes,
     * cada uno con su propia fecha de vencimiento.
     */
    lotes: {
      type: [loteSchema],
      default: [],
    },

    imagen: {
      type: String,
      default: null,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export { TIPOS_PRESENTACION };

export default mongoose.models.Product ||
  mongoose.model("Product", productSchema);