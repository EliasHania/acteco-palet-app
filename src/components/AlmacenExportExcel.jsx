// AlmacenExportExcel.jsx
import React from "react";
import * as XLSX from "xlsx";

const perchasPorCaja = {
  "46x28": 45,
  "40x28": 65,
  "46x11": 125,
  "40x11": 175,
  "38x11": 175,
  "32x11": 225,
  "26x11": 325,
};

function cap(s = "") {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}

/**
 * props:
 * - turno: "yoana" | "lidia"
 * - responsable: string
 * - registros: array de escaneos guardados en /api/almacen/escaneos (del día y turno)
 *   cada item suele traer: { trabajadora, tipo, codigo, timestamp, turno, responsableEscaneo, ...copia del palet }
 * - filePrefix?: string (opcional, default "almacen")
 */
export default function AlmacenExportExcel({
  turno = "",
  responsable = "",
  registros = [],
  filePrefix = "almacen",
  className = "",
  children,
}) {
  const onExport = () => {
    // ---- Título y fecha
    const fecha = new Date();
    const fechaTexto = fecha.toLocaleDateString("es-ES", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    const titulo = `Resumen del turno de ${cap(turno)} – ${fechaTexto}`;
    const subtitulo = responsable
      ? `Responsable del escaneo: ${responsable}`
      : "";

    // ---- Resúmenes
    const resumenPorTrabajadora = {};
    const resumenPorTipo = {
      "46x28": 0,
      "40x28": 0,
      "46x11": 0,
      "40x11": 0,
      "38x11": 0,
      "32x11": 0,
      "26x11": 0,
    };

    registros.forEach((r) => {
      const trabajadora = r.trabajadora || "—";
      const tipo = r.tipo || "—";

      if (!resumenPorTrabajadora[trabajadora])
        resumenPorTrabajadora[trabajadora] = {};
      resumenPorTrabajadora[trabajadora][tipo] =
        (resumenPorTrabajadora[trabajadora][tipo] || 0) + 1;

      if (resumenPorTipo.hasOwnProperty(tipo)) resumenPorTipo[tipo]++;
    });

    // ---- Hoja 1: Resumen
    const wb = XLSX.utils.book_new();

    const sheetResumen = [[titulo]];
    if (subtitulo) sheetResumen.push([subtitulo]);
    sheetResumen.push([]);
    sheetResumen.push(["Resumen por trabajadora:"]);

    Object.entries(resumenPorTrabajadora).forEach(([nombre, tipos]) => {
      const detalles = Object.entries(tipos)
        .map(
          ([tipo, cantidad]) =>
            `${cantidad} palet${cantidad > 1 ? "s" : ""} de ${tipo}`
        )
        .join(", ");
      sheetResumen.push([`${nombre}:`, detalles]);
    });

    sheetResumen.push([]);
    sheetResumen.push(["Resumen por tipo de palet (y perchas estimadas):"]);

    let totalPerchas = 0;
    Object.entries(resumenPorTipo).forEach(([tipo, cantidad]) => {
      const perchas = cantidad * 20 * (perchasPorCaja[tipo] || 0);
      totalPerchas += perchas;
      sheetResumen.push([
        `Total palets de ${tipo}:`,
        cantidad,
        `Total perchas de ${tipo}:`,
        perchas,
      ]);
    });

    sheetResumen.push([]);
    sheetResumen.push(["Total palets registrados:", registros.length]);
    sheetResumen.push(["Total perchas estimadas:", totalPerchas]);

    const wsResumen = XLSX.utils.aoa_to_sheet(sheetResumen);
    // Estética básica
    wsResumen["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }, // título
    ];
    wsResumen["!cols"] = [{ wch: 36 }, { wch: 24 }, { wch: 36 }, { wch: 24 }];

    XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen");

    // ---- Hoja 2: Detalle
    const detalleHeaders = [
      "Fecha",
      "Hora",
      "Código",
      "Trabajadora",
      "Tipo",
      "Turno",
      "Responsable",
    ];

    const detalleRows = registros
      .slice()
      .sort(
        (a, b) =>
          new Date(a.timestamp || a.createdAt || 0) -
          new Date(b.timestamp || b.createdAt || 0)
      )
      .map((r) => {
        const d = r.timestamp ? new Date(r.timestamp) : null;
        const fecha = d
          ? d.toLocaleDateString("sv-SE")
          : new Date().toLocaleDateString("sv-SE");
        const hora = d
          ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          : "";
        return [
          fecha,
          hora,
          r.codigo || "",
          r.trabajadora || "—",
          r.tipo || "—",
          r.turno || "",
          r.responsableEscaneo || "",
        ];
      });

    const wsDetalle = XLSX.utils.aoa_to_sheet([detalleHeaders, ...detalleRows]);
    wsDetalle["!cols"] = [
      { wch: 12 }, // Fecha
      { wch: 8 }, // Hora
      { wch: 14 }, // Código
      { wch: 18 }, // Trabajadora
      { wch: 10 }, // Tipo
      { wch: 14 }, // Turno
      { wch: 18 }, // Responsable
    ];
    XLSX.utils.book_append_sheet(wb, wsDetalle, "Detalle");

    // ---- Guardar
    const fechaArchivo = new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD
    XLSX.writeFile(
      wb,
      `${filePrefix}_${fechaArchivo}_${turno || "todos"}.xlsx`
    );
  };

  return (
    <button
      onClick={onExport}
      className={
        className ||
        "flex-1 px-4 py-2.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-sm font-medium transition shadow-sm"
      }
    >
      {children || "📊 Descargar Excel"}
    </button>
  );
}
