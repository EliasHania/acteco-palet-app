"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { DateTime } from "luxon";

/* =========================
 *  Luxon helpers (Madrid)
 * ========================= */
const ZONA = "Europe/Madrid";
const hoyMadrid = () => DateTime.now().setZone(ZONA);
const fmtDateISO = (dt = hoyMadrid()) => dt.toISODate(); // YYYY-MM-DD
const toHumanDate = (iso) =>
  iso ? DateTime.fromISO(iso).setZone(ZONA).toFormat("yyyy-MM-dd") : "";
const toHumanTime = (iso) =>
  iso ? DateTime.fromISO(iso).setZone(ZONA).toFormat("HH:mm") : "";

/* =========================
 *  API helper
 * ========================= */
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

/* =========================
 *  Excel builder (igual que Almacén)
 * ========================= */
const PERCHAS_POR_CAJA = {
  "46x28": 45,
  "40x28": 65,
  "46x11": 125,
  "40x11": 175,
  "38x11": 175,
  "32x11": 225,
  "26x11": 325,
};
const cap = (s = "") => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");

function buildWorkbookEscaneos({
  registros = [],
  turno = "",
  responsable = "",
}) {
  const wb = XLSX.utils.book_new();

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
  const hoyTexto = DateTime.now().setZone(ZONA).toLocaleString({
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const titulo = `Resumen del turno de ${cap(turno)} – ${hoyTexto}`;
  const subtitulo = responsable
    ? `Responsable del escaneo: ${responsable}`
    : "";

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
    const perchas = cantidad * 20 * (PERCHAS_POR_CAJA[tipo] || 0);
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
  wsResumen["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }];
  wsResumen["!cols"] = [{ wch: 36 }, { wch: 24 }, { wch: 36 }, { wch: 24 }];
  XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen");

  // ---- Hoja 2: Detalle
  const headers = [
    "Fecha",
    "Hora",
    "Código",
    "Trabajadora",
    "Tipo",
    "Turno",
    "Responsable",
  ];

  const rows = registros
    .slice()
    .sort(
      (a, b) =>
        new Date(a.timestamp || a.createdAt || 0) -
        new Date(b.timestamp || b.createdAt || 0)
    )
    .map((r) => [
      toHumanDate(r.timestamp || r.createdAt),
      toHumanTime(r.timestamp || r.createdAt),
      r.codigo || "",
      r.trabajadora || "—",
      r.tipo || "—",
      r.turno || "",
      r.responsableEscaneo || "",
    ]);

  const wsDetalle = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  wsDetalle["!cols"] = [
    { wch: 12 },
    { wch: 8 },
    { wch: 14 },
    { wch: 18 },
    { wch: 10 },
    { wch: 14 },
    { wch: 18 },
  ];
  XLSX.utils.book_append_sheet(wb, wsDetalle, "Detalle");

  return wb;
}

/* =========================
 *  Componente
 * ========================= */
export default function SupervisorMovimientos({ onLogout }) {
  const [tab, setTab] = useState("movimientos"); // "movimientos" | "escaneos"

  /* ========== MOVIMIENTOS ========== */
  const [movFrom, setMovFrom] = useState(fmtDateISO());
  const [movTo, setMovTo] = useState(fmtDateISO());
  const [movimientos, setMovimientos] = useState([]);
  const [loadingMov, setLoadingMov] = useState(false);
  const [opBusyId, setOpBusyId] = useState(null);

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
        o["Fecha (humana)"] = toHumanDate(row.timestamp);
        o["Hora (humana)"] = toHumanTime(row.timestamp);
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

  /* ========== ESCANEOS ========== */
  const [from, setFrom] = useState(fmtDateISO());
  const [to, setTo] = useState(fmtDateISO());
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

  // === Exportador con el MISMO formato (Resumen + Detalle) que Almacén
  const exportEscaneosExcel = () => {
    if (!escaneos.length) return;
    const wb = buildWorkbookEscaneos({
      registros: escaneos,
      turno, // filtro seleccionado (si quieres puedes dejar string vacío para "Todos")
      responsable: "Supervisor",
    });
    const nombre = `escaneos_almacen_${from}_a_${to}.xlsx`;
    XLSX.writeFile(wb, nombre);
  };

  useEffect(() => {
    if (tab === "escaneos") cargarEscaneos();
  }, [tab]);

  /* =========================
   *  UI
   * ========================= */
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
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

      {/* ====== Movimientos ====== */}
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

      {/* ====== Escaneos ====== */}
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
