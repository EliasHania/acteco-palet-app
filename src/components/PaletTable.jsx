import React, { useRef, useState } from "react";
import * as XLSX from "xlsx";

const PaletTable = ({
  encargada,
  palets,
  setPalets,
  refrescarPalets,
  nuevosIds = [],
}) => {
  const tablaRef = useRef();
  const [abiertos, setAbiertos] = useState({});
  const [trabajadoraFiltrada, setTrabajadoraFiltrada] = useState("");

  const toggleTrabajadora = (nombre) => {
    setAbiertos((prev) => ({ ...prev, [nombre]: !prev[nombre] }));
  };

  const handleEliminar = async (id) => {
    const confirmar = window.confirm("¿Eliminar este palet?");
    if (!confirmar) return;
    try {
      const token =
        localStorage.getItem("token") || sessionStorage.getItem("token");

      const res = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/palets/${id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!res.ok) throw new Error("Error al eliminar palet");
      await refrescarPalets();
    } catch (err) {
      console.error("Error eliminando:", err.message);
    }
  };

  const formatearHora = (timestamp) => new Date(timestamp).toLocaleTimeString();

  const exportarExcel = () => {
    const workbook = XLSX.utils.book_new();
    const fecha = new Date();
    const fechaTexto = fecha.toLocaleDateString("es-ES");
    const titulo = `Resumen del turno de ${
      encargada.charAt(0).toUpperCase() + encargada.slice(1)
    } – ${fechaTexto}`;

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
    const perchasPorCaja = {
      "46x28": 45,
      "40x28": 65,
      "46x11": 125,
      "40x11": 175,
      "38x11": 175,
      "32x11": 225,
      "26x11": 325,
    };

    palets.forEach((p) => {
      if (!resumenPorTrabajadora[p.trabajadora])
        resumenPorTrabajadora[p.trabajadora] = {};
      resumenPorTrabajadora[p.trabajadora][p.tipo] =
        (resumenPorTrabajadora[p.trabajadora][p.tipo] || 0) + 1;

      if (resumenPorTipo.hasOwnProperty(p.tipo)) resumenPorTipo[p.tipo]++;
    });

    const sheetData = [[titulo], [], ["Resumen por trabajadora:"]];
    Object.entries(resumenPorTrabajadora).forEach(([nombre, tipos]) => {
      const detalles = Object.entries(tipos)
        .map(
          ([tipo, cantidad]) =>
            `${cantidad} palet${cantidad > 1 ? "s" : ""} de ${tipo}`
        )
        .join(", ");
      sheetData.push([`${nombre}:`, detalles]);
    });

    sheetData.push([], ["Resumen por tipo de palet (y perchas estimadas):"]);
    let totalPerchas = 0;
    Object.entries(resumenPorTipo).forEach(([tipo, cantidad]) => {
      const perchas = cantidad * 20 * (perchasPorCaja[tipo] || 0);
      totalPerchas += perchas;
      sheetData.push([
        `Total palets de ${tipo}:`,
        cantidad,
        `Total perchas de ${tipo}:`,
        perchas,
      ]);
    });

    sheetData.push([], ["Total palets registrados:", palets.length]);
    sheetData.push(["Total perchas estimadas:", totalPerchas]);

    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }];
    ws["!cols"] = [{ wch: 30 }, { wch: 12 }, { wch: 30 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(workbook, ws, "Palets");

    const fechaArchivo = fecha.toLocaleDateString().replace(/\//g, "-");
    XLSX.writeFile(
      workbook,
      `resumen-palets-${encargada}-${fechaArchivo}.xlsx`
    );
  };

  const agrupado = palets
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .reduce((acc, p) => {
      if (!acc[p.trabajadora]) acc[p.trabajadora] = [];
      acc[p.trabajadora].push(p);
      return acc;
    }, {});

  const nombresTrabajadoras = Object.keys(agrupado).sort();

  return (
    <div className="shadow-md rounded-2xl p-6 border border-green-100 bg-white">
      <h2 className="text-xl font-semibold mb-2 text-green-600">
        Resumen por trabajadora
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
          .map(([nombre, lista]) => (
            <div
              key={nombre}
              onClick={() => toggleTrabajadora(nombre)}
              className="rounded-xl border bg-green-50 p-4 cursor-pointer hover:bg-green-100 transition border-green-200"
            >
              <div className="font-semibold text-green-800 text-base">
                {nombre} – {lista.length} palet{lista.length > 1 ? "s" : ""}{" "}
                registrados
              </div>
              {abiertos[nombre] && (
                <ul className="mt-3 space-y-2 text-sm text-green-700">
                  {lista.map((p) => (
                    <li
                      key={p._id}
                      className={`flex items-center justify-between bg-white p-2 rounded-md border border-green-100 ${
                        nuevosIds.includes(p._id) ? "animate-pulse-slow" : ""
                      }`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div>
                        <div className="font-semibold">{p.tipo}</div>
                        <div className="text-green-500 text-xs italic">
                          QR: {p.codigo || "No disponible"}
                        </div>
                        <div className="text-green-400 text-xs">
                          {formatearHora(p.timestamp)}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEliminar(p._id);
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
          ))}
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

export default PaletTable;
