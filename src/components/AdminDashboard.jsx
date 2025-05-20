import React, { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";

const AdminDashboard = ({ onLogout, palets, refrescarPalets, nuevosIds }) => {
  const [abiertos, setAbiertos] = useState({});
  const [cargando, setCargando] = useState(false);
  const [fechaSeleccionada, setFechaSeleccionada] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [trabajadoraFiltradaYoana, setTrabajadoraFiltradaYoana] = useState("");
  const [trabajadoraFiltradaLidia, setTrabajadoraFiltradaLidia] = useState("");
  const anteriores = useRef([]);

  useEffect(() => {
    refrescarPalets(fechaSeleccionada);
  }, [fechaSeleccionada]);

  useEffect(() => {
    anteriores.current = palets.map((p) => p._id);
  }, [palets]);

  const manejarRefresco = async () => {
    setCargando(true);
    await refrescarPalets(fechaSeleccionada);
    setTimeout(() => setCargando(false), 500);
  };

  const normalizarFecha = (fecha) => {
    const f = new Date(fecha);
    f.setHours(0, 0, 0, 0);
    return f.getTime();
  };

  const filtrarPorFecha = (lista) => {
    const ref = normalizarFecha(fechaSeleccionada);
    return lista.filter((p) => normalizarFecha(p.timestamp) === ref);
  };

  const calcularRecuento = (lista) => {
    const conteo = {};
    lista.forEach((p) => {
      conteo[p.tipo] = (conteo[p.tipo] || 0) + 1;
    });
    return conteo;
  };

  const renderRecuento = (titulo, recuento, total) => (
    <div className="bg-white rounded-xl shadow p-6 w-full">
      <h3 className="text-lg font-bold text-indigo-700 mb-4">📊 {titulo}</h3>
      <ul className="space-y-2">
        {Object.entries(recuento).map(([tipo, cantidad]) => (
          <li key={tipo} className="text-gray-700">
            Total palets de <strong>{tipo}</strong>: {cantidad}
          </li>
        ))}
        <li className="mt-2 text-black font-bold">
          Total palets registrados: {total}
        </li>
      </ul>
    </div>
  );

  const renderResumen = (
    turno,
    registros,
    trabajadoraFiltrada,
    setTrabajadoraFiltrada
  ) => {
    const agrupado = registros.reduce((acc, p) => {
      if (!acc[p.trabajadora]) acc[p.trabajadora] = [];
      acc[p.trabajadora].push(p);
      return acc;
    }, {});

    const nombresTrabajadoras = Object.keys(agrupado).sort((a, b) => {
      const ultimaA = Math.max(
        ...agrupado[a].map((p) => new Date(p.timestamp).getTime())
      );
      const ultimaB = Math.max(
        ...agrupado[b].map((p) => new Date(p.timestamp).getTime())
      );
      return ultimaB - ultimaA;
    });

    return (
      <div className="bg-white rounded-xl shadow p-4 overflow-x-auto w-full">
        <h3 className="text-lg font-bold mb-3 text-indigo-700">
          Turno de {turno}
        </h3>

        <div className="mb-4">
          <label className="text-sm text-gray-700 mr-2">
            Filtrar por trabajadora:
          </label>
          <select
            value={trabajadoraFiltrada}
            onChange={(e) => setTrabajadoraFiltrada(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          >
            <option value="">Todas</option>
            {nombresTrabajadoras.map((nombre) => (
              <option key={nombre} value={nombre}>
                {nombre}
              </option>
            ))}
          </select>
        </div>

        {nombresTrabajadoras
          .filter(
            (nombre) => !trabajadoraFiltrada || nombre === trabajadoraFiltrada
          )
          .map((nombre) => (
            <div
              key={nombre}
              onClick={() =>
                setAbiertos((prev) => ({ ...prev, [nombre]: !prev[nombre] }))
              }
              className="rounded-xl border bg-gray-50 p-4 mb-3 cursor-pointer hover:bg-gray-100 transition"
              style={{ borderColor: "#e5e7eb" }}
            >
              <div className="w-full text-left font-semibold text-gray-800">
                {nombre} – {agrupado[nombre].length} palet
                {agrupado[nombre].length !== 1 && "s"} registrados
              </div>
              {abiertos[nombre] && (
                <ul className="mt-3 space-y-2 text-sm text-gray-700">
                  {agrupado[nombre]
                    .sort(
                      (a, b) =>
                        new Date(b.timestamp).getTime() -
                        new Date(a.timestamp).getTime()
                    )
                    .map((p) => (
                      <li
                        key={p._id}
                        className={`bg-white p-2 rounded-md border text-sm flex justify-between ${
                          nuevosIds.includes(p._id) &&
                          !anteriores.current.includes(p._id)
                            ? "animate-pulse-slow border-green-500"
                            : ""
                        }`}
                      >
                        <span>{p.codigo}</span>
                        <span>{p.tipo}</span>
                        <span>
                          {new Date(p.timestamp).toLocaleTimeString()}
                        </span>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          ))}
      </div>
    );
  };

  const paletsFiltrados = filtrarPorFecha(palets);

  // Separar palets según quién los registró
  const yoana = paletsFiltrados.filter((p) => p.registradaPor === "yoana");
  const lidia = paletsFiltrados.filter((p) => p.registradaPor === "lidia");

  const recuentoYoana = calcularRecuento(yoana);
  const recuentoLidia = calcularRecuento(lidia);

  const recuentoTotal = calcularRecuento(paletsFiltrados);

  const exportarExcelAvanzado = () => {
    const workbook = XLSX.utils.book_new();
    const fechaHoy = new Date().toLocaleDateString("es-ES");

    const generarHoja = (nombreHoja, listaPalets) => {
      const sheetData = [
        [`Resumen del turno de ${nombreHoja} – ${fechaHoy}`],
        [],
        ["Trabajadora", "Código QR", "Tipo", "Hora"],
      ];

      const resumenTipos = {};
      listaPalets.forEach((p) => {
        sheetData.push([
          p.trabajadora,
          p.codigo || "No disponible",
          p.tipo,
          new Date(p.timestamp).toLocaleTimeString(),
        ]);
        resumenTipos[p.tipo] = (resumenTipos[p.tipo] || 0) + 1;
      });

      sheetData.push([], ["Resumen por tipo:"]);
      Object.entries(resumenTipos).forEach(([tipo, count]) => {
        sheetData.push([`Total palets de ${tipo}:`, count]);
      });

      sheetData.push([], ["Total palets registrados:", listaPalets.length]);

      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }];
      ws["!cols"] = [{ wch: 20 }, { wch: 20 }, { wch: 12 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(workbook, ws, nombreHoja);
    };

    generarHoja("Yoana", yoana);
    generarHoja("Lidia", lidia);
    generarHoja("General", paletsFiltrados);

    XLSX.writeFile(workbook, `admin-palets-${fechaSeleccionada}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-gray-100 text-gray-800 p-6">
      <header className="text-center text-3xl font-bold text-indigo-700 mb-6">
        Panel de Administración – Acteco Productos y Servicios S.L.
      </header>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 gap-4">
        <div className="flex gap-2 items-center">
          <label htmlFor="fecha" className="font-semibold text-gray-700">
            📅 Selecciona fecha:
          </label>
          <input
            type="date"
            id="fecha"
            value={fechaSeleccionada}
            onChange={(e) => setFechaSeleccionada(e.target.value)}
            className="border rounded-md px-3 py-1 text-sm"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={manejarRefresco}
            className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition cursor-pointer"
            disabled={cargando}
          >
            {cargando ? "⏳ Cargando..." : "🔄 Actualizar"}
          </button>

          <button
            onClick={onLogout}
            className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition cursor-pointer"
          >
            Cerrar sesión
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="space-y-6">
          {renderResumen(
            "Yoana",
            yoana,
            trabajadoraFiltradaYoana,
            setTrabajadoraFiltradaYoana
          )}
          {renderRecuento(
            "Recuento turno de Yoana",
            recuentoYoana,
            yoana.length
          )}
        </div>
        <div className="space-y-6">
          {renderResumen(
            "Lidia",
            lidia,
            trabajadoraFiltradaLidia,
            setTrabajadoraFiltradaLidia
          )}
          {renderRecuento(
            "Recuento turno de Lidia",
            recuentoLidia,
            lidia.length
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto mb-10">
        {renderRecuento(
          "📊 Recuento general",
          recuentoTotal,
          paletsFiltrados.length
        )}
      </div>

      <div className="mt-8 flex justify-center">
        <button
          onClick={exportarExcelAvanzado}
          className="bg-emerald-500 text-white px-6 py-2 rounded-xl font-semibold hover:bg-emerald-600 transition cursor-pointer shadow-md"
        >
          📤 Exportar Excel ({fechaSeleccionada})
        </button>
      </div>
    </div>
  );
};

export default AdminDashboard;
