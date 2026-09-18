import cloudinary from "../config/cloudinary.js";

export const obtenerImagenes = async (req, res) => {
  try {
    const result = await cloudinary.search
      .expression("folder:productos")
      .sort_by("created_at", "desc")
      .max_results(50)
      .execute();

    const imagenes = result.resources.map((img) => ({
      public_id: img.public_id,
      url: img.secure_url,
    }));

    res.json(imagenes);
  } catch (error) {
    console.log("ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};