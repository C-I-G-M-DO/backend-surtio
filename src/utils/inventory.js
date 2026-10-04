export const TIPOS_UNIDAD = [
  "unidad",
  "paquete",
  "docena",
];

export const TIPOS_LIBRA = [
  "libra",
  "media_libra",
  "cuarta",
  "onza",
];

export function esTipoDeUnidad(tipo) {
  return TIPOS_UNIDAD.includes(tipo);
}

export function esTipoDeLibra(tipo) {
  return TIPOS_LIBRA.includes(tipo);
}

export function validarPresentacion(producto, precio) {
  const { unidadStock } = producto;
  const { tipo, valor, equivalencia } = precio;

  if (!Number.isFinite(Number(valor)) || Number(valor) <= 0) {
    throw new Error(`El precio para ${tipo} debe ser mayor que 0`);
  }

  // Producto vendido por unidades
  if (unidadStock === "unidad") {
    if (!esTipoDeUnidad(tipo)) {
      throw new Error(
        `El producto ${producto.nombre} usa stock por unidad y no puede venderse como ${tipo}`
      );
    }

    if (tipo === "paquete") {
      if (
        equivalencia === null ||
        equivalencia === undefined ||
        !Number.isInteger(Number(equivalencia)) ||
        Number(equivalencia) <= 0
      ) {
        throw new Error(
          "La equivalencia del paquete debe ser un entero mayor que 0"
        );
      }
    }

    if (tipo === "unidad" || tipo === "docena") {
      if (equivalencia !== null && equivalencia !== undefined) {
        // No necesitamos equivalencia para estas presentaciones
      }
    }

    return true;
  }

  // Producto vendido por libras
  if (unidadStock === "libra") {
    if (!esTipoDeLibra(tipo)) {
      throw new Error(
        `El producto ${producto.nombre} usa stock por libra y no puede venderse como ${tipo}`
      );
    }

    if (equivalencia !== null && equivalencia !== undefined) {
      throw new Error(
        `La presentación ${tipo} no utiliza equivalencia`
      );
    }

    return true;
  }

  throw new Error(`unidadStock inválida: ${unidadStock}`);
}

export function calcularConsumoStock(producto, tipo, cantidad, equivalencia = null) {
  const cantidadNumerica = Number(cantidad);

  if (!Number.isFinite(cantidadNumerica) || cantidadNumerica <= 0) {
    throw new Error("La cantidad debe ser mayor que 0");
  }

  if (producto.unidadStock === "unidad") {
    if (tipo === "unidad") {
      return cantidadNumerica;
    }

    if (tipo === "docena") {
      return cantidadNumerica * 12;
    }

    if (tipo === "paquete") {
      const eq = Number(equivalencia);

      if (
        !Number.isInteger(eq) ||
        eq <= 0
      ) {
        throw new Error(
          "La equivalencia del paquete debe ser un entero mayor que 0"
        );
      }

      return cantidadNumerica * eq;
    }
  }

  if (producto.unidadStock === "libra") {
    if (tipo === "libra") {
      return cantidadNumerica;
    }

    if (tipo === "media_libra") {
      return cantidadNumerica * 0.5;
    }

    if (tipo === "cuarta") {
      return cantidadNumerica * 0.25;
    }

    if (tipo === "onza") {
      return cantidadNumerica * 0.0625;
    }
  }

  throw new Error(
    `La presentación ${tipo} no es compatible con el stock de ${producto.unidadStock}`
  );
}