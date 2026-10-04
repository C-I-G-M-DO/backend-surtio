import mongoose from "mongoose";

const counterSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    seq: {
      type: Number,
      default: 999,
    },
  },
  {
    timestamps: true,
  }
);

counterSchema.index(
  {
    userId: 1,
    name: 1,
  },
  {
    unique: true,
  }
);

export default mongoose.models.Counter ||
  mongoose.model("Counter", counterSchema);