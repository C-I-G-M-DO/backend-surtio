
import mongoose from "mongoose";

const precioSchema = new mongoose.Schema({
  tipo: {
    type: String,
    enum: ["unidad", "libra", "paquete"],
    required: true,
  },

  valor: Number,

  equivalencia: Number, // para paquetes
});

const productSchema = new mongoose.Schema({
  nombre: String,

  precios: [precioSchema],

  stock: Number,

  imagen: String, // URL de la imagen

  // 🔥 Usuario propietario del producto
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
});

export default mongoose.models.Product ||
  mongoose.model("Product", productSchema);

