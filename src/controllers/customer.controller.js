import Customer from "../models/customer.js";

// ============================================
// BUSCAR CLIENTE POR TELÉFONO
// ============================================

export const buscarClientePorTelefono = async (req, res) => {
  try {
    const { telefono } = req.params;

    if (!telefono) {
      return res.status(400).json({
        message: "Teléfono requerido",
      });
    }

    const cliente = await Customer.findOne({
      userId: req.userId,
      telefono: telefono.trim(),
    });

    if (!cliente) {
      return res.status(404).json({
        message: "Cliente no encontrado",
      });
    }

    res.json(cliente);
  } catch (error) {
    console.log("ERROR BUSCANDO CLIENTE:", error);

    res.status(500).json({
      message: "Error buscando cliente",
      error: error.message,
    });
  }
};

// ============================================
// CREAR CLIENTE
// ============================================

export const crearCliente = async (req, res) => {
  try {
    const { nombre, telefono } = req.body;

    if (!nombre || !telefono) {
      return res.status(400).json({
        message: "Nombre y teléfono son requeridos",
      });
    }

    const telefonoLimpio = telefono.trim();

    const existe = await Customer.findOne({
      userId: req.userId,
      telefono: telefonoLimpio,
    });

    if (existe) {
      return res.status(400).json({
        message: "Ya existe un cliente con ese teléfono",
      });
    }

    const cliente = new Customer({
      userId: req.userId,
      nombre: nombre.trim(),
      telefono: telefonoLimpio,
      puntos: 0,
    });

    await cliente.save();

    res.status(201).json(cliente);
  } catch (error) {
    console.log("ERROR CREANDO CLIENTE:", error);

    res.status(500).json({
      message: "Error creando cliente",
      error: error.message,
    });
  }
};