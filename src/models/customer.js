import mongoose from "mongoose";

const customerSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    nombre: {
      type: String,
      required: true,
      trim: true,
    },

    telefono: {
      type: String,
      required: true,
      trim: true,
    },

    puntos: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Un mismo teléfono no puede tener dos clientes
// dentro del mismo colmado.
customerSchema.index(
  { userId: 1, telefono: 1 },
  { unique: true }
);

export default mongoose.models.Customer ||
  mongoose.model("Customer", customerSchema);