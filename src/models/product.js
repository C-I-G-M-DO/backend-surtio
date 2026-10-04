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

    // Solo obligatorio para paquete
    equivalencia: {
      type: Number,
      default: null,
      min: 1,
    },
  },
  { _id: false }
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