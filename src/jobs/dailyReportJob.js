import cron from "node-cron";
import Sale from "../models/sale.js";
import { generarReporteDiario } from "../controllers/reportController.js";

/**
 * Devuelve la fecha de ayer en República Dominicana.
 *
 * El proceso corre a las 11:59 PM.
 * En ese momento generamos el reporte del día que
 * está terminando.
 */
function obtenerFechaActualRD() {
  const ahora = new Date();

  const formatter = new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: "America/Santo_Domingo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  );

  const partes = formatter.formatToParts(ahora);

  const valores = {};

  for (const parte of partes) {
    if (parte.type !== "literal") {
      valores[parte.type] = parte.value;
    }
  }

  return `${valores.year}-${valores.month}-${valores.day}`;
}

/**
 * Ejecutar todos los días a las 11:59 PM.
 *
 * America/Santo_Domingo = República Dominicana
 */
export const iniciarReporteDiario = () => {
  cron.schedule(
    "59 23 * * *",
    async () => {
      console.log(
        "===================================="
      );

      console.log(
        "INICIANDO CIERRE DIARIO DE REPORTES"
      );

      try {
        const fecha =
          obtenerFechaActualRD();

        console.log(
          `Generando reporte del día: ${fecha}`
        );

        // Buscar los usuarios que tuvieron ventas ese día
        const inicio = new Date(
          `${fecha}T00:00:00-04:00`
        );

        const fin = new Date(
          `${fecha}T23:59:59.999-04:00`
        );

        const usuarios =
          await Sale.distinct(
            "userId",
            {
              createdAt: {
                $gte: inicio,
                $lte: fin,
              },
            }
          );

        console.log(
          `Usuarios con ventas: ${usuarios.length}`
        );

        for (const userId of usuarios) {
          try {
            await generarReporteDiario(
              fecha,
              userId
            );

            console.log(
              `Reporte generado para usuario ${userId}`
            );
          } catch (error) {
            console.error(
              `Error generando reporte para usuario ${userId}:`,
              error
            );
          }
        }

        console.log(
          "CIERRE DIARIO COMPLETADO"
        );
      } catch (error) {
        console.error(
          "ERROR EN CIERRE DIARIO:",
          error
        );
      }

      console.log(
        "===================================="
      );
    },
    {
      timezone: "America/Santo_Domingo",
    }
  );

  console.log(
    "Programador de reportes diarios iniciado."
  );

  console.log(
    "Los reportes se generarán todos los días a las 11:59 PM."
  );
};