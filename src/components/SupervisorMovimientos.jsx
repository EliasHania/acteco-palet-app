"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";

// Utilidad
const fmtDate = (d = new Date()) => new Date(d).toLocaleDateString("sv-SE"); // YYYY-MM-DD

const api = (path, opts = {}) => {
  const token =
    localStorage.getItem("token") || sessionStorage.getItem("token");
  return fetch(`${import.meta.env.VITE_BACKEND_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...opts,
  });
};

export default function SupervisorMovimientos({ onLogout }) {
  const [tab, setTab] = useState("movimientos"); // "movimientos" | "escaneos"

  /* =========================
   *       MOVIMIENTOS
   * ========================= */
  const [movFrom, setMovFrom] = useState(fmtDate());
  const [movTo, setMovTo] = useState(fmtDate());
  const [movimientos, setMovimientos] = useState([]);
  const [loadingMov, setLoadingMov] = useState(false);
  const [opBusyId, setOpBusyId] = useState(null); // deshabilitar acciones por fila

  const cargarMovimientos = async () => {
    setLoadingMov(true);
    try {
      const qs = new URLSearchParams({ from: movFrom, to: movTo }).toString();
      const res = await api(`/api/almacen/movimientos/rango?${qs}`);
      if (!res.ok) throw new Error("No se pudieron cargar los movimientos");
      const data = await res.json();
      setMovimientos(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setMovimientos([]);
    } finally {
      setLoadingMov(false);
    }
  };

  const columnasMov = useMemo(() => {
    const keys = new Set();
    (movimientos || []).forEach((r) =>
      Object.keys(r || {}).forEach((k) => k !== "__v" && keys.add(k))
    );
    const prefer = [
      "_id",
      "fecha",
      "createdAt",
      "timestamp",
      "codigo",
      "turno",
      "operacion",
      "matricula",
      "estado",
      "descargaFinal",
      "cerrada",
    ];
    const tail = [...keys].filter((k) => !prefer.includes(k));
    return [...prefer.filter((k) => keys.has(k)), ...tail];
  }, [movimientos]);

  const exportMovimientosExcel = () => {
    if (!movimientos.length) return;
    const rows = movimientos.map((row) => {
      const o = {};
      columnasMov.forEach((k) => {
        const v = row[k];
        o[k] =
          typeof v === "object" && v !== null
            ? JSON.stringify(v)
            : String(v ?? "");
      });
      if (row.timestamp) {
        o["Fecha (humana)"] = new Date(row.timestamp).toLocaleDateString(
          "sv-SE"
        );
        o["Hora (humana)"] = new Date(row.timestamp).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
      }
      return o;
    });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    const headers = Object.keys(rows[0] || {});
    ws["!cols"] = headers.map((h) => {
      const maxLen = Math.max(
        h.length,
        ...rows.map((r) => (r[h] ? String(r[h]).length : 0))
      );
      return { wch: Math.min(Math.max(maxLen + 2, 12), 60) };
    });
    XLSX.utils.book_append_sheet(wb, ws, "Movimientos");
    XLSX.writeFile(wb, `movimientos_${movFrom}_a_${movTo}.xlsx`);
  };

  const patchFila = async (id, tipo) => {
    try {
      setOpBusyId(id);
      const url =
        tipo === "descarga"
          ? `/api/almacen/movimientos/${id}/descarga-final`
          : `/api/almacen/movimientos/${id}/cerrar-carga`;
      const res = await api(url, { method: "PATCH", body: JSON.stringify({}) });
      if (!res.ok) throw new Error("No se pudo actualizar el movimiento");
      await cargarMovimientos();
    } catch (e) {
      console.error(e);
      alert("No se pudo actualizar el movimiento.");
    } finally {
      setOpBusyId(null);
    }
  };

  useEffect(() => {
    if (tab === "movimientos") cargarMovimientos();
  }, [tab]);

  /* =========================
   *        ESCANEOS
   * ========================= */
  const [from, setFrom] = useState(fmtDate());
  const [to, setTo] = useState(fmtDate());
  const [turno, setTurno] = useState("");
  const [escaneos, setEscaneos] = useState([]);
  const [loadingEscaneos, setLoadingEscaneos] = useState(false);

  const cargarEscaneos = async () => {
    setLoadingEscaneos(true);
    try {
      const qs = new URLSearchParams({
        from,
        to,
        ...(turno ? { turno } : {}),
      }).toString();
      const res = await api(`/api/almacen/escaneos/rango?${qs}`);
      if (!res.ok) throw new Error("No se pudieron cargar los escaneos");
      const data = await res.json();
      setEscaneos(data || []);
    } catch (e) {
      console.error(e);
      setEscaneos([]);
    } finally {
      setLoadingEscaneos(false);
    }
  };

  const columnasEscaneos = useMemo(() => {
    const set = new Set();
    escaneos.forEach((row) =>
      Object.keys(row || {}).forEach((k) => k !== "__v" && set.add(k))
    );
    const prefer = [
      "fecha",
      "timestamp",
      "codigo",
      "turno",
      "responsableEscaneo",
      "origen",
      "_id",
      "createdAt",
    ];
    const tail = [...set].filter((k) => !prefer.includes(k));
    return [...prefer.filter((k) => set.has(k)), ...tail];
  }, [escaneos]);

  const exportEscaneosExcel = () => {
    if (!escaneos.length) return;
    const rows = escaneos.map((row) => {
      const o = {};
      columnasEscaneos.forEach((k) => {
        const v = row[k];
        o[k] =
          typeof v === "object" && v !== null
            ? JSON.stringify(v)
            : String(v ?? "");
      });
      if (row.timestamp) {
        o["Fecha (humana)"] = new Date(row.timestamp).toLocaleDateString(
          "sv-SE"
        );
        o["Hora (humana)"] = new Date(row.timestamp).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
      }
      return o;
    });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    const headers = Object.keys(rows[0] || {});
    ws["!cols"] = headers.map((h) => {
      const maxLen = Math.max(
        h.length,
        ...rows.map((r) => (r[h] ? String(r[h]).length : 0))
      );
      return { wch: Math.min(Math.max(maxLen + 2, 12), 60) };
    });
    XLSX.utils.book_append_sheet(wb, ws, "Escaneos");
    XLSX.writeFile(wb, `escaneos_almacen_${from}_a_${to}.xlsx`);
  };

  useEffect(() => {
    if (tab === "escaneos") cargarEscaneos();
  }, [tab]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      {/* Header con Cerrar sesión */}
      <div className="mb-4 rounded-2xl border border-emerald-200 bg-white p-3 flex items-center gap-3">
        <h2 className="text-emerald-900 font-semibold">Panel del Supervisor</h2>
        <div className="ml-auto">
          <button
            onClick={onLogout}
            className="px-3 py-1 rounded-full text-sm font-medium bg-rose-600 text-white border border-rose-400/40 hover:bg-rose-700"
          >
            🔒 Cerrar sesión
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab("movimientos")}
          className={`px-3 py-1.5 rounded-lg text-sm ${
            tab === "movimientos"
              ? "bg-emerald-600 text-white"
              : "bg-white border border-emerald-200 text-emerald-800"
          }`}
        >
          Movimientos
        </button>
        <button
          onClick={() => setTab("escaneos")}
          className={`px-3 py-1.5 rounded-lg text-sm ${
            tab === "escaneos"
              ? "bg-emerald-600 text-white"
              : "bg-white border border-emerald-200 text-emerald-800"
          }`}
        >
          Escaneos
        </button>
      </div>

      {/* ====== Pestaña MOVIMIENTOS ====== */}
      {tab === "movimientos" && (
        <div className="bg-white rounded-2xl border border-emerald-200 p-4 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
            <div className="flex flex-col">
              <label className="text-xs text-emerald-700/80 mb-1">Desde</label>
              <input
                type="date"
                value={movFrom}
                onChange={(e) => setMovFrom(e.target.value)}
                className="px-2 py-1.5 border rounded"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs text-emerald-700/80 mb-1">Hasta</label>
              <input
                type="date"
                value={movTo}
                onChange={(e) => setMovTo(e.target.value)}
                className="px-2 py-1.5 border rounded"
              />
            </div>
            <div className="flex items-end gap-2 sm:col-span-3">
              <button
                onClick={cargarMovimientos}
                className="px-3 py-1.5 rounded bg-emerald-600 text-white text-sm"
              >
                {loadingMov ? "Cargando…" : "Cargar"}
              </button>
              <button
                onClick={exportMovimientosExcel}
                disabled={!movimientos.length}
                className="px-3 py-1.5 rounded bg-emerald-700 text-white text-sm disabled:opacity-50"
              >
                Exportar Excel
              </button>
              <div className="ml-auto text-sm text-emerald-800">
                Total: <b>{movimientos.length}</b>
              </div>
            </div>
          </div>

          <div className="mt-3 border rounded overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-emerald-50">
                <tr>
                  {columnasMov.map((c) => (
                    <th key={c} className="px-2 py-2 text-left border-b">
                      {c}
                    </th>
                  ))}
                  <th className="px-2 py-2 text-left border-b">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {movimientos.map((row) => (
                  <tr
                    key={row._id}
                    className="odd:bg-white even:bg-emerald-50/40"
                  >
                    {columnasMov.map((c) => (
                      <td key={c} className="px-2 py-1 border-b align-top">
                        {typeof row[c] === "object" && row[c] !== null
                          ? JSON.stringify(row[c])
                          : String(row[c] ?? "")}
                      </td>
                    ))}
                    <td className="px-2 py-1 border-b">
                      <div className="flex gap-2">
                        <button
                          onClick={() => patchFila(row._id, "descarga")}
                          disabled={opBusyId === row._id}
                          className="px-2 py-1 rounded bg-amber-600 text-white text-xs disabled:opacity-50"
                          title="Marcar descarga final"
                        >
                          Descarga final
                        </button>
                        <button
                          onClick={() => patchFila(row._id, "cerrar")}
                          disabled={opBusyId === row._id}
                          className="px-2 py-1 rounded bg-sky-700 text-white text-xs disabled:opacity-50"
                          title="Cerrar carga"
                        >
                          Cerrar carga
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!movimientos.length && (
                  <tr>
                    <td
                      className="px-2 py-3 text-center text-emerald-700"
                      colSpan={columnasMov.length + 1}
                    >
                      Sin resultados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ====== Pestaña ESCANEOS ====== */}
      {tab === "escaneos" && (
        <div className="bg-white rounded-2xl border border-emerald-200 p-4 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <div className="flex flex-col">
              <label className="text-xs text-emerald-700/80 mb-1">Desde</label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="px-2 py-1.5 border rounded"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs text-emerald-700/80 mb-1">Hasta</label>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="px-2 py-1.5 border rounded"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs text-emerald-700/80 mb-1">Turno</label>
              <select
                value={turno}
                onChange={(e) => setTurno(e.target.value)}
                className="px-2 py-1.5 border rounded"
              >
                <option value="">Todos</option>
                <option value="yoana">Yoana</option>
                <option value="lidia">Lidia</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={cargarEscaneos}
                className="px-3 py-1.5 rounded bg-emerald-600 text-white text-sm"
              >
                {loadingEscaneos ? "Cargando…" : "Cargar"}
              </button>
            </div>
          </div>

          <div className="mt-3 flex gap-2">
            <button
              onClick={exportEscaneosExcel}
              disabled={!escaneos.length}
              className="px-3 py-1.5 rounded bg-emerald-700 text-white text-sm disabled:opacity-50"
            >
              Exportar Excel
            </button>
            <div className="ml-auto text-sm text-emerald-800">
              Total: <b>{escaneos.length}</b>
            </div>
          </div>

          <div className="mt-3 border rounded overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-emerald-50">
                <tr>
                  {columnasEscaneos.map((c) => (
                    <th key={c} className="px-2 py-2 text-left border-b">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {escaneos.map((row) => (
                  <tr
                    key={row._id}
                    className="odd:bg-white even:bg-emerald-50/40"
                  >
                    {columnasEscaneos.map((c) => (
                      <td key={c} className="px-2 py-1 border-b align-top">
                        {typeof row[c] === "object" && row[c] !== null
                          ? JSON.stringify(row[c])
                          : String(row[c] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
                {!escaneos.length && (
                  <tr>
                    <td
                      className="px-2 py-3 text-center text-emerald-700"
                      colSpan={columnasEscaneos.length}
                    >
                      Sin resultados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
