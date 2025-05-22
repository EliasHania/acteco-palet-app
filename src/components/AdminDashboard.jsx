// AdminDashboard.jsx completo con pestañas + funciones auxiliares
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
  const [cajas, setCajas] = useState([]);
  const [seccionActiva, setSeccionActiva] = useState("yoana");
  const anteriores = useRef([]);

  useEffect(() => {
    refrescarPalets(fechaSeleccionada);
    cargarCajas();
  }, [fechaSeleccionada]);

  const cargarCajas = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${
          import.meta.env.VITE_BACKEND_URL
        }/api/cajas/fecha?fecha=${fechaSeleccionada}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      setCajas(data);
    } catch (err) {
      console.error("Error cargando cajas:", err);
    }
  };

  useEffect(() => {
    anteriores.current = palets.map((p) => p._id);
  }, [palets]);

  const manejarRefresco = async () => {
    setCargando(true);
    await refrescarPalets(fechaSeleccionada);
    await cargarCajas();
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
      const cantidad = p.cantidad || 1;
      conteo[p.tipo] = (conteo[p.tipo] || 0) + cantidad;
    });
    return conteo;
  };

  const renderRecuento = (titulo, recuento, total, esCaja = false) => (
    <div className="bg-white rounded-xl shadow p-6 w-full">
      <h3 className="text-lg font-bold text-indigo-700 mb-4">
        {esCaja ? "📦" : "📊"} {titulo}
      </h3>
      <ul className="space-y-2">
        {Object.entries(recuento).map(([tipo, cantidad]) => (
          <li key={tipo} className="text-gray-700">
            Total {esCaja ? "cajas" : "palets"} de <strong>{tipo}</strong>:{" "}
            {cantidad}
          </li>
        ))}
        <li className="mt-2 text-black font-bold">
          Total {esCaja ? "cajas" : "palets"} registrados: {total}
        </li>
      </ul>
    </div>
  );

  const renderCajasPorTurno = (titulo, listaCajas) => (
    <div className="bg-white rounded-xl shadow p-4 w-full">
      <h3 className="text-lg font-bold text-green-700 mb-3">{titulo}</h3>
      <ul className="space-y-2 text-gray-800">
        {listaCajas.length === 0 ? (
          <li className="text-gray-500">Sin cajas registradas.</li>
        ) : (
          listaCajas
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .map((caja, index) => (
              <li key={index} className="flex justify-between border-b pb-1">
                <span>{caja.tipo}</span>
                <span>{caja.cantidad} cajas</span>
                <span>{new Date(caja.timestamp).toLocaleTimeString()}</span>
              </li>
            ))
        )}
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
      <div className="shadow-md rounded-2xl p-6 border border-green-100 bg-white">
        <h2 className="text-xl font-semibold mb-2 text-green-600">
          Resumen por trabajadora
        </h2>
        <p className="mb-1 text-green-700 font-medium text-lg">
          Turno de {turno}
        </p>
        <p className="mb-4 text-green-500 text-sm">
          {new Date(fechaSeleccionada).toLocaleDateString("es-ES", {
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

        <div className="space-y-4">
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
                className="rounded-xl border bg-green-50 p-4 cursor-pointer hover:bg-green-100 transition border-green-200"
              >
                <div className="font-semibold text-green-800 text-base">
                  {nombre} – {agrupado[nombre].length} palet
                  {agrupado[nombre].length > 1 ? "s" : ""} registrados
                </div>
                {abiertos[nombre] && (
                  <ul className="mt-3 space-y-2 text-sm text-green-700">
                    {agrupado[nombre]
                      .sort(
                        (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
                      )
                      .map((p) => (
                        <li
                          key={p._id}
                          className={`bg-white p-3 rounded-xl border border-green-100 shadow-sm flex flex-col sm:flex-row sm:justify-between items-center sm:items-start gap-1 ${
                            nuevosIds.includes(p._id) &&
                            !anteriores.current.includes(p._id)
                              ? "animate-pulse-slow border-green-500"
                              : ""
                          }`}
                        >
                          <div className="font-semibold text-green-800 text-sm">
                            QR: {p.codigo || "No disponible"}
                          </div>
                          <div className="text-green-600 text-sm">
                            Tipo: {p.tipo}
                          </div>
                          <div className="text-green-500 text-xs italic">
                            {new Date(p.timestamp).toLocaleTimeString()}
                          </div>
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            ))}
        </div>
      </div>
    );
  };

  const paletsFiltrados = filtrarPorFecha(palets);
  const cajasFiltradas = filtrarPorFecha(cajas);

  const yoana = paletsFiltrados.filter((p) => p.registradaPor === "yoana");
  const lidia = paletsFiltrados.filter((p) => p.registradaPor === "lidia");
  const cajasYoana = cajasFiltradas.filter((p) => p.registradaPor === "yoana");
  const cajasLidia = cajasFiltradas.filter((p) => p.registradaPor === "lidia");

  const recuentoYoana = calcularRecuento(yoana);
  const recuentoLidia = calcularRecuento(lidia);
  const recuentoCajasYoana = calcularRecuento(cajasYoana);
  const recuentoCajasLidia = calcularRecuento(cajasLidia);
  const recuentoTotal = calcularRecuento(paletsFiltrados);
  const recuentoTotalCajas = calcularRecuento(cajasFiltradas);

  const exportarExcelAvanzado = () => {
    const workbook = XLSX.utils.book_new();
    const fechaHoy = new Date().toLocaleDateString("es-ES");

    const perchasPorCaja = {
      "40x28": 65,
      "40x11": 175,
      "46x28": 45,
      "46x11": 125,
      "38x11": 175,
      "32x11": 225,
      "26x11": 325,
    };

    const generarHojaPalets = (nombreHoja, listaPalets, esGeneral = false) => {
      const sheetData = [
        [
          esGeneral
            ? `Resumen General Ambos Turnos – ${fechaHoy}`
            : `Resumen del turno de ${nombreHoja} – ${fechaHoy}`,
        ],
        [],
        ["Trabajadora", "Código QR", "Tipo", "Hora"],
      ];

      const resumenTipos = {};
      let totalPerchas = 0;

      listaPalets.forEach((p) => {
        sheetData.push([
          p.trabajadora,
          p.codigo || "No disponible",
          p.tipo,
          new Date(p.timestamp).toLocaleTimeString(),
        ]);
        resumenTipos[p.tipo] = (resumenTipos[p.tipo] || 0) + 1;
      });

      sheetData.push([], ["Resumen por tipo de palet (y perchas estimadas):"]);
      Object.entries(resumenTipos).forEach(([tipo, count]) => {
        const perchas = perchasPorCaja[tipo] || 0;
        const totalTipo = count * 20 * perchas; // 20 cajas por palet
        totalPerchas += totalTipo;
        sheetData.push([
          `Total palets de ${tipo}:`,
          count,
          `Total perchas de ${tipo}:`,
          totalTipo,
        ]);
      });

      sheetData.push([], ["Total palets registrados:", listaPalets.length]);
      sheetData.push(["Total de perchas estimadas:", totalPerchas]);

      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }];
      ws["!cols"] = [{ wch: 22 }, { wch: 18 }, { wch: 24 }, { wch: 16 }];
      XLSX.utils.book_append_sheet(workbook, ws, nombreHoja);
    };

    const generarHojaCajas = () => {
      const sheetData = [
        [`Resumen de cajas sueltas – ${fechaHoy}`],
        [],
        [
          "Turno",
          "Tipo de caja",
          "Cantidad",
          "Perchas por caja",
          "Total perchas",
          "Hora",
        ],
      ];

      const resumenTipos = {};
      let totalPerchas = 0;

      cajasFiltradas.forEach((caja) => {
        const tipo = caja.tipo;
        const cantidad = caja.cantidad;
        const perchasPorUnidad = perchasPorCaja[tipo] || 0;
        const totalTipo = cantidad * perchasPorUnidad;
        totalPerchas += totalTipo;
        const turno = caja.registradaPor === "yoana" ? "Yoana" : "Lidia";

        sheetData.push([
          turno,
          tipo,
          cantidad,
          perchasPorUnidad,
          totalTipo,
          new Date(caja.timestamp).toLocaleTimeString(),
        ]);

        resumenTipos[tipo] = (resumenTipos[tipo] || 0) + cantidad;
      });

      sheetData.push(
        [],
        [],
        ["Resumen por tipo de caja (cantidades y perchas):"]
      );
      Object.entries(resumenTipos).forEach(([tipo, total]) => {
        const perchas = perchasPorCaja[tipo] || 0;
        sheetData.push([
          `Total cajas de ${tipo}:`,
          total,
          `Total perchas de ${tipo}:`,
          total * perchas,
        ]);
      });

      const totalCajas = cajasFiltradas.reduce(
        (acc, caja) => acc + caja.cantidad,
        0
      );
      sheetData.push([], ["Total de cajas registradas:", totalCajas]);
      sheetData.push(["Total de perchas registradas:", totalPerchas]);

      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }];
      ws["!cols"] = [
        { wch: 12 },
        { wch: 14 },
        { wch: 10 },
        { wch: 16 },
        { wch: 16 },
        { wch: 12 },
      ];
      XLSX.utils.book_append_sheet(workbook, ws, "Resumen de cajas");
    };

    generarHojaPalets("Yoana", yoana);
    generarHojaPalets("Lidia", lidia);
    generarHojaPalets("General", paletsFiltrados, true);
    generarHojaCajas();

    XLSX.writeFile(workbook, `admin-palets-${fechaSeleccionada}.xlsx`);
  };
  const renderContenidoTurno = (
    nombre,
    palets,
    trabajadoraFiltrada,
    setTrabajadoraFiltrada,
    recuentoPalets,
    cajas,
    recuentoCajas
  ) => (
    <div className="space-y-6 max-w-5xl mx-auto">
      {renderResumen(
        nombre,
        palets,
        trabajadoraFiltrada,
        setTrabajadoraFiltrada
      )}
      {renderRecuento(
        `Recuento turno de ${nombre} (palets)`,
        recuentoPalets,
        palets.length
      )}
      {renderRecuento(
        `Recuento turno de ${nombre} (cajas)`,
        recuentoCajas,
        cajas.length,
        true
      )}
      {renderCajasPorTurno(`Detalles de cajas turno ${nombre}`, cajas)}
    </div>
  );
  return (
    <div className="min-h-screen bg-gray-100 text-gray-800 p-6">
      <header className="text-center text-3xl font-bold text-indigo-700 mb-6">
        Panel de Administración – Acteco Productos y Servicios S.L.
      </header>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 gap-4 max-w-5xl mx-auto">
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

      <div className="flex justify-center gap-4 my-6 max-w-5xl mx-auto">
        <button
          onClick={() => setSeccionActiva("yoana")}
          className={`px-4 py-2 rounded cursor-pointer transition duration-200 ${
            seccionActiva === "yoana"
              ? "bg-indigo-600 text-white"
              : "bg-white border border-indigo-200 hover:bg-indigo-100 hover:border-indigo-400"
          }`}
        >
          Turno Yoana
        </button>
        <button
          onClick={() => setSeccionActiva("lidia")}
          className={`px-4 py-2 rounded cursor-pointer transition duration-200 ${
            seccionActiva === "lidia"
              ? "bg-indigo-600 text-white"
              : "bg-white border border-indigo-200 hover:bg-indigo-100 hover:border-indigo-400"
          }`}
        >
          Turno Lidia
        </button>
        <button
          onClick={() => setSeccionActiva("general")}
          className={`px-4 py-2 rounded cursor-pointer transition duration-200 ${
            seccionActiva === "general"
              ? "bg-indigo-600 text-white"
              : "bg-white border border-indigo-200 hover:bg-indigo-100 hover:border-indigo-400"
          }`}
        >
          Resumen General
        </button>
      </div>

      {seccionActiva === "yoana" &&
        renderContenidoTurno(
          "Yoana",
          yoana,
          trabajadoraFiltradaYoana,
          setTrabajadoraFiltradaYoana,
          recuentoYoana,
          cajasYoana,
          recuentoCajasYoana
        )}

      {seccionActiva === "lidia" &&
        renderContenidoTurno(
          "Lidia",
          lidia,
          trabajadoraFiltradaLidia,
          setTrabajadoraFiltradaLidia,
          recuentoLidia,
          cajasLidia,
          recuentoCajasLidia
        )}

      {seccionActiva === "general" && (
        <div className="max-w-5xl mx-auto">
          <div className="mb-10 grid grid-cols-1 md:grid-cols-2 gap-6">
            {renderRecuento(
              "📊 Recuento general (palets)",
              recuentoTotal,
              paletsFiltrados.length
            )}
            {renderRecuento(
              "📦 Recuento general (cajas)",
              recuentoTotalCajas,
              cajasFiltradas.reduce((acc, caja) => acc + caja.cantidad, 0),
              true
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
      )}
    </div>
  );
};
export default AdminDashboard;
