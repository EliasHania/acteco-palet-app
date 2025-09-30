import React, { useRef, useState } from "react";
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

const CajasTable = ({
  encargada,
  cajas = [],
  setCajas,
  refrescarCajas,
  nuevosIds = [],
}) => {
  const tablaRef = useRef();
  const [abiertos, setAbiertos] = useState({});
  const [trabajadoraFiltrada, setTrabajadoraFiltrada] = useState("");

  const toggleTrabajadora = (nombre) => {
    setAbiertos((prev) => ({ ...prev, [nombre]: !prev[nombre] }));
  };

  const formatearHora = (timestamp) => new Date(timestamp).toLocaleTimeString();

  const handleEliminar = async (id) => {
    const confirmar = window.confirm("¿Eliminar este registro de cajas?");
    if (!confirmar) return;
    try {
      const token =
        localStorage.getItem("token") || sessionStorage.getItem("token");
      const res = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/cajas/${id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!res.ok) throw new Error("Error al eliminar caja");
      await refrescarCajas();
    } catch (err) {
      console.error("Error eliminando caja:", err.message);
    }
  };

  const exportarExcel = () => {
    const workbook = XLSX.utils.book_new();
    const fecha = new Date();
    const fechaTexto = fecha.toLocaleDateString("es-ES");
    const titulo = `Resumen del turno de ${
      encargada.charAt(0).toUpperCase() + encargada.slice(1)
    } – ${fechaTexto}`;

    // Detalle fila a fila con trabajadora
    const sheetData = [
      [titulo],
      [],
      [
        "Trabajadora",
        "Turno",
        "Tipo de caja",
        "Cantidad",
        "Perchas/caja",
        "Total perchas",
        "Hora",
      ],
    ];

    const resumenPorTipo = {
      "46x28": 0,
      "40x28": 0,
      "46x11": 0,
      "40x11": 0,
      "38x11": 0,
      "32x11": 0,
      "26x11": 0,
    };

    let totalPerchas = 0;
    const ordenadas = [...cajas].sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    );

    ordenadas.forEach((c) => {
      const perCaja = perchasPorCaja[c.tipo] || 0;
      const total = (c.cantidad || 0) * perCaja;
      const turno =
        (c.registradaPor || "").toLowerCase() === "yoana"
          ? "Yoana"
          : (c.registradaPor || "").toLowerCase() === "lidia"
          ? "Lidia"
          : c.registradaPor || "—";

      sheetData.push([
        c.trabajadora || "No asignada",
        turno,
        c.tipo,
        c.cantidad,
        perCaja,
        total,
        new Date(c.timestamp).toLocaleTimeString(),
      ]);

      if (resumenPorTipo.hasOwnProperty(c.tipo)) {
        resumenPorTipo[c.tipo] += c.cantidad || 0;
      }
      totalPerchas += total;
    });

    sheetData.push([], ["Resumen por tipo de caja (cantidades y perchas):"]);
    Object.entries(resumenPorTipo).forEach(([tipo, cantidad]) => {
      const perCaja = perchasPorCaja[tipo] || 0;
      sheetData.push([
        `Total cajas de ${tipo}:`,
        cantidad,
        `Total perchas de ${tipo}:`,
        cantidad * perCaja,
      ]);
    });

    const totalCajas = cajas.reduce((acc, c) => acc + (c.cantidad || 0), 0);
    sheetData.push([], ["Total de cajas registradas:", totalCajas]);
    sheetData.push(["Total de perchas registradas:", totalPerchas]);

    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }];
    ws["!cols"] = [
      { wch: 20 },
      { wch: 10 },
      { wch: 14 },
      { wch: 10 },
      { wch: 14 },
      { wch: 16 },
      { wch: 12 },
    ];
    XLSX.utils.book_append_sheet(workbook, ws, "Cajas");

    const fechaArchivo = fecha.toLocaleDateString().replace(/\//g, "-");
    XLSX.writeFile(workbook, `resumen-cajas-${encargada}-${fechaArchivo}.xlsx`);
  };

  // Agrupado por trabajadora
  const agrupado = [...cajas]
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .reduce((acc, c) => {
      const nombre = c.trabajadora || "No asignada";
      if (!acc[nombre]) acc[nombre] = [];
      acc[nombre].push(c);
      return acc;
    }, {});

  const nombresTrabajadoras = Object.keys(agrupado).sort();

  return (
    <div className="shadow-md rounded-2xl p-6 border border-green-100 bg-white">
      <h2 className="text-xl font-semibold mb-2 text-green-600">
        Cajas por trabajadora
      </h2>
      <p className="mb-1 text-green-700 font-medium text-lg">
        Turno de {encargada.charAt(0).toUpperCase() + encargada.slice(1)}
      </p>
      <p className="mb-4 text-green-500 text-sm">
        {new Date().toLocaleDateString("es-ES", {
          weekday: "long",
          day: "2-digit",
          month: "long",
          year: "numeric",
        })}
      </p>

      <div className="mb-4">
        <label className="text-sm text-green-700 mr-2">
          Filtrar por trabajadora:
        </label>
        <select
          value={trabajadoraFiltrada}
          onChange={(e) => setTrabajadoraFiltrada(e.target.value)}
          className="border border-green-300 rounded px-2 py-1 text-sm"
        >
          <option value="">Todas</option>
          {nombresTrabajadoras.map((nombre) => (
            <option key={nombre} value={nombre}>
              {nombre}
            </option>
          ))}
        </select>
      </div>

      <div ref={tablaRef} className="space-y-4">
        {Object.entries(agrupado)
          .filter(
            ([nombre]) => !trabajadoraFiltrada || nombre === trabajadoraFiltrada
          )
          .map(([nombre, lista]) => {
            const totalCajas = lista.reduce((a, c) => a + (c.cantidad || 0), 0);
            const totalPerchas = lista.reduce(
              (a, c) => a + (c.cantidad || 0) * (perchasPorCaja[c.tipo] || 0),
              0
            );
            return (
              <div
                key={nombre}
                onClick={() => toggleTrabajadora(nombre)}
                className="rounded-xl border bg-green-50 p-4 cursor-pointer hover:bg-green-100 transition border-green-200"
              >
                <div className="font-semibold text-green-800 text-base">
                  {nombre} – {totalCajas} caja
                  {totalCajas !== 1 ? "s" : ""} ({totalPerchas} perchas)
                </div>

                {abiertos[nombre] && (
                  <ul className="mt-3 space-y-2 text-sm text-green-700">
                    {lista.map((c) => (
                      <li
                        key={c._id}
                        className={`flex items-center justify-between bg-white p-2 rounded-md border border-green-100 ${
                          nuevosIds.includes(c._id) ? "animate-pulse-slow" : ""
                        }`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div>
                          <div className="font-semibold">
                            {c.tipo} — {c.cantidad} caja
                            {c.cantidad !== 1 ? "s" : ""} (
                            {(perchasPorCaja[c.tipo] || 0) * (c.cantidad || 0)}{" "}
                            perchas)
                          </div>
                          <div className="text-green-400 text-xs">
                            {formatearHora(c.timestamp)} · Turno:{" "}
                            {(c.registradaPor || "").toLowerCase() === "yoana"
                              ? "Yoana"
                              : (c.registradaPor || "").toLowerCase() ===
                                "lidia"
                              ? "Lidia"
                              : c.registradaPor || "—"}
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEliminar(c._id);
                          }}
                          className="bg-red-500 text-white px-2 py-1 rounded-md text-sm cursor-pointer"
                        >
                          Eliminar
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
      </div>

      <div className="mt-6 flex flex-col items-center gap-4">
        <button
          onClick={exportarExcel}
          className="bg-emerald-500 hover:bg-emerald-600 text-white py-3 px-6 rounded-xl font-bold text-lg w-full max-w-md cursor-pointer"
        >
          Exportar como Excel
        </button>
      </div>
    </div>
  );
};

export default CajasTable;
