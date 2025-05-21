// Nuevo componente: CajasForm.jsx
import React, { useEffect, useState } from "react";
import * as XLSX from "xlsx";

const perchasPorCaja = {
  "40x28": 65,
  "40x11": 175,
  "46x28": 45,
  "46x11": 125,
  "38x11": 175,
  "32x11": 225,
  "26x11": 325,
};

const tiposDisponibles = Object.keys(perchasPorCaja);

const CajasForm = ({ fechaSeleccionada }) => {
  const [cajas, setCajas] = useState([]);
  const [cantidad, setCantidad] = useState("");
  const [tipoSeleccionado, setTipoSeleccionado] = useState("");
  const [cantidadEliminar, setCantidadEliminar] = useState({});

  const encargada = localStorage.getItem("encargada") || "";
  const fechaHoyISO = fechaSeleccionada;

  useEffect(() => {
    const cargarCajas = async () => {
      try {
        const token =
          localStorage.getItem("token") || sessionStorage.getItem("token");
        const res = await fetch(
          `${
            import.meta.env.VITE_BACKEND_URL
          }/api/cajas/fecha?fecha=${fechaHoyISO}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        const data = await res.json();
        setCajas(data);
      } catch (err) {
        console.error("Error al cargar cajas:", err);
      }
    };

    cargarCajas();
  }, []);

  const handleAddCaja = async () => {
    if (!cantidad || !tipoSeleccionado) return;
    const nuevaCantidad = parseInt(cantidad);
    if (isNaN(nuevaCantidad) || nuevaCantidad <= 0) return;

    try {
      const token =
        localStorage.getItem("token") || sessionStorage.getItem("token");
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/cajas`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tipo: tipoSeleccionado,
          cantidad: nuevaCantidad,
        }),
      });
      const nueva = await res.json();
      setCajas((prev) => [...prev, nueva]);
      setCantidad("");
      setTipoSeleccionado("");
    } catch (err) {
      console.error("Error al guardar caja:", err);
    }
  };

  const handleEliminarCaja = async (tipo) => {
    const eliminarCantidad = parseInt(cantidadEliminar[tipo]) || 0;
    if (eliminarCantidad <= 0) return;

    try {
      const token =
        localStorage.getItem("token") || sessionStorage.getItem("token");
      const cajasFiltradas = cajas.filter((c) => c.tipo === tipo);

      let restantes = eliminarCantidad;
      const idsAEliminar = [];

      for (const caja of cajasFiltradas) {
        if (restantes <= 0) break;
        if (caja.cantidad <= restantes) {
          idsAEliminar.push(caja._id);
          restantes -= caja.cantidad;
        } else {
          await fetch(
            `${import.meta.env.VITE_BACKEND_URL}/api/cajas/${caja._id}`,
            {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ cantidad: caja.cantidad - restantes }),
            }
          );
          restantes = 0;
        }
      }

      for (const id of idsAEliminar) {
        await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/cajas/${id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
      }

      const res = await fetch(
        `${
          import.meta.env.VITE_BACKEND_URL
        }/api/cajas/fecha?fecha=${fechaHoyISO}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await res.json();
      setCajas(data);
      setCantidadEliminar((prev) => ({ ...prev, [tipo]: "" }));
    } catch (err) {
      console.error("Error al eliminar cajas:", err);
    }
  };

  const exportarExcelCajas = () => {
    const workbook = XLSX.utils.book_new();
    const fechaHoy = new Date().toLocaleDateString("es-ES");
    const titulo = `Resumen de cajas sueltas – Turno ${
      encargada.charAt(0).toUpperCase() + encargada.slice(1)
    } – ${fechaHoy}`;

    const sheetData = [
      [titulo],
      [],
      ["Tipo de caja", "Cantidad", "Perchas por caja", "Total de perchas"],
    ];

    const resumenAgrupado = cajas.reduce((acc, { tipo, cantidad }) => {
      acc[tipo] = (acc[tipo] || 0) + cantidad;
      return acc;
    }, {});

    Object.entries(resumenAgrupado).forEach(([tipo, cantidad]) => {
      sheetData.push([
        tipo,
        cantidad,
        perchasPorCaja[tipo],
        cantidad * perchasPorCaja[tipo],
      ]);
    });

    const totalPerchas = Object.entries(resumenAgrupado).reduce(
      (acc, [tipo, cantidad]) => acc + cantidad * perchasPorCaja[tipo],
      0
    );

    sheetData.push([], ["Total de perchas:", totalPerchas]);

    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
    worksheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }];
    worksheet["!cols"] = [{ wch: 20 }, { wch: 15 }, { wch: 20 }, { wch: 25 }];

    XLSX.utils.book_append_sheet(workbook, worksheet, "Cajas");

    const fecha = new Date().toLocaleDateString().replace(/\//g, "-");
    XLSX.writeFile(workbook, `resumen-cajas-${encargada}-${fecha}.xlsx`);
  };

  const resumenAgrupado = cajas.reduce((acc, { tipo, cantidad }) => {
    if (!acc[tipo]) acc[tipo] = 0;
    acc[tipo] += cantidad;
    return acc;
  }, {});

  const totalPerchas = Object.entries(resumenAgrupado).reduce(
    (acc, [tipo, cantidad]) => acc + cantidad * perchasPorCaja[tipo],
    0
  );

  return (
    <div className="bg-white shadow-md rounded-2xl p-6 border border-green-100">
      <h2 className="text-xl font-semibold text-green-600 mb-4">
        Registrar nueva caja
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <input
          type="number"
          placeholder="Cantidad"
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
          className="p-3 rounded-xl border border-green-300 focus:ring-2 focus:ring-green-400"
        />

        <select
          value={tipoSeleccionado}
          onChange={(e) => setTipoSeleccionado(e.target.value)}
          className="p-3 rounded-xl border border-green-300 focus:ring-2 focus:ring-green-400"
        >
          <option value="">Selecciona tipo de caja</option>
          {tiposDisponibles.map((tipo) => (
            <option key={tipo} value={tipo}>
              {tipo} ({perchasPorCaja[tipo]} perchas)
            </option>
          ))}
        </select>

        <button
          onClick={handleAddCaja}
          className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-xl transition-all cursor-pointer"
        >
          Registrar caja
        </button>
      </div>

      <div className="border-t pt-4 mt-6">
        <h3 className="text-lg font-semibold text-indigo-700 mb-2">Resumen:</h3>
        <ul className="space-y-4 text-gray-800">
          {Object.entries(resumenAgrupado).map(([tipo, cantidad]) => (
            <li
              key={tipo}
              className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gray-50 p-3 rounded-xl border"
            >
              <span>
                {tipo}: {cantidad} caja(s) → {cantidad * perchasPorCaja[tipo]}{" "}
                perchas
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Eliminar"
                  min={1}
                  max={cantidad}
                  value={cantidadEliminar[tipo] || ""}
                  onChange={(e) =>
                    setCantidadEliminar({
                      ...cantidadEliminar,
                      [tipo]: e.target.value,
                    })
                  }
                  className="w-20 p-2 rounded border border-red-300"
                />
                <button
                  onClick={() => handleEliminarCaja(tipo)}
                  className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded"
                >
                  Eliminar
                </button>
              </div>
            </li>
          ))}
          <li className="font-bold text-black mt-4">
            🎯 Total de perchas: {totalPerchas}
          </li>
        </ul>
      </div>

      {Object.keys(resumenAgrupado).length > 0 && (
        <div className="mt-6 flex justify-center">
          <button
            onClick={exportarExcelCajas}
            className="bg-emerald-500 hover:bg-emerald-600 text-white py-3 px-6 rounded-xl font-bold text-lg w-full max-w-md cursor-pointer"
          >
            Exportar como Excel
          </button>
        </div>
      )}
    </div>
  );
};

export default CajasForm;
