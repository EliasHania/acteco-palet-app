"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { DateTime } from "luxon";

// ===== Helpers con Luxon (zona Europe/Madrid)
const ZONA = "Europe/Madrid";
const dt = (iso) => (iso ? DateTime.fromISO(iso).setZone(ZONA) : null);
const hoyMadrid = () => DateTime.now().setZone(ZONA);
const fmtDateISO = (dtv = hoyMadrid()) => dtv.toISODate(); // YYYY-MM-DD
const toHumanDate = (iso) => (dt(iso) ? dt(iso).toFormat("yyyy-MM-dd") : "");
const toHumanTime = (iso) => (dt(iso) ? dt(iso).toFormat("HH:mm") : "");

// Normalizador robusto para "tipo"
const normalizeTipo = (s) =>
  (s ?? "")
    .toString()
    .trim()
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[_\s]+/g, "-");

// === Helpers para Excel de Escaneos (misma estructura que Almacén)
const perchasPorCaja = {
  "46x28": 45,
  "40x28": 65,
  "46x11": 125,
  "40x11": 175,
  "38x11": 175,
  "32x11": 225,
  "26x11": 325,
};
const cap = (s = "") => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");

// API helper
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

// Fallback común de nº palets: numeroPalets | totalPalets | palets
const getNumeroPalets = (m) => {
  if (typeof m?.numeroPalets === "number") return m.numeroPalets;
  if (typeof m?.totalPalets === "number") return m.totalPalets; // cargas mixtas
  if (typeof m?.palets === "number") return m.palets; // descargas (paso 2)
  return "";
};

export default function SupervisorMovimientos({ onLogout }) {
  const [tab, setTab] = useState("movimientos"); // "movimientos" | "escaneos"

  /* =========================
   *       MOVIMIENTOS
   * ========================= */
  const [movFrom, setMovFrom] = useState(fmtDateISO());
  const [movTo, setMovTo] = useState(fmtDateISO());
  const [movimientos, setMovimientos] = useState([]);
  const [loadingMov, setLoadingMov] = useState(false);

  // Filtro por tipo para la VISTA y exportación
  const [tipoFiltro, setTipoFiltro] = useState(""); // "" | "descarga" | "carga" | "carga-mixta"
  const [exportKind, setExportKind] = useState("todo"); // "todo" | "descarga" | "carga" | "carga-mixta"

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

  // Para DESCARGA usamos "timestamp". Para CARGA/MIXTA usamos "timestampLlegada".
  const movimientosFiltrados = useMemo(() => {
    const base = Array.isArray(movimientos) ? movimientos : [];
    if (!tipoFiltro) return base;
    return base.filter((m) => normalizeTipo(m?.tipo) === tipoFiltro);
  }, [movimientos, tipoFiltro]);

  // Vista plana
  const filasVista = useMemo(() => {
    return movimientosFiltrados.map((m) => {
      const llegadaISO =
        normalizeTipo(m?.tipo) === "descarga"
          ? m?.timestamp
          : m?.timestampLlegada;

      return {
        fecha: m?.fecha || toHumanDate(llegadaISO),
        Hora: toHumanTime(llegadaISO),
        tipo: m?.tipo || "",
        personal: m?.personal || "",
        empresaTransportista: m?.empresaTransportista || "",
        destino: m?.destino || "",
        origen: m?.origen || "",
        numeroContenedor: m?.numeroContenedor || "",
        numeroPrecinto: m?.numeroPrecinto || "",
        remolque: m?.remolque || "",
        tractora: m?.tractora || "",
        tipoPalet: m?.tipoPalet || "",
        numeroPalets: getNumeroPalets(m),
        numeroCajas: typeof m?.numeroCajas === "number" ? m.numeroCajas : "",
      };
    });
  }, [movimientosFiltrados]);

  const columnasMov = useMemo(() => {
    const order = [
      "fecha",
      "Hora",
      "tipo",
      "personal",
      "empresaTransportista",
      "destino",
      "origen",
      "numeroContenedor",
      "numeroPrecinto",
      "remolque",
      "tractora",
      "tipoPalet",
      "numeroPalets",
      "numeroCajas",
    ];
    const present = new Set();
    filasVista.forEach((r) =>
      order.forEach((k) => {
        if (r[k] !== undefined) present.add(k);
      })
    );
    return order.filter((k) => present.has(k));
  }, [filasVista]);

  // ====== Excel de movimientos
  const exportMovimientosExcel = () => {
    if (!movimientos.length) return;

    const makeSheet = (lista, nombreHoja) => {
      const rows = lista.map((m) => {
        const isDescarga = normalizeTipo(m?.tipo) === "descarga";
        const llegadaISO = isDescarga ? m?.timestamp : m?.timestampLlegada;
        const base = {
          fecha: m?.fecha || toHumanDate(llegadaISO),
          Hora: toHumanTime(llegadaISO),
          tipo: m?.tipo || "",
          personal: m?.personal || "",
          empresaTransportista: m?.empresaTransportista || "",
          destino: m?.destino || "",
          origen: m?.origen || "",
          numeroContenedor: m?.numeroContenedor || "",
          numeroPrecinto: m?.numeroPrecinto || "",
          remolque: m?.remolque || "",
          tractora: m?.tractora || "",
          tipoPalet: m?.tipoPalet || "",
          numeroPalets: getNumeroPalets(m),
          numeroCajas: typeof m?.numeroCajas === "number" ? m.numeroCajas : "",
        };
        Object.keys(base).forEach(
          (k) => (base[k] === "" || base[k] === undefined) && delete base[k]
        );
        return base;
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      const headers = Object.keys(rows[0] || {});
      ws["!cols"] = headers.map((h) => {
        const maxLen = Math.max(
          h.length,
          ...rows.map((r) => (r[h] ? String(r[h]).length : 0))
        );
        return { wch: Math.min(Math.max(maxLen + 2, 12), 60) };
      });
      return { ws, nombreHoja };
    };

    const wb = XLSX.utils.book_new();
    const dsc = movimientos.filter(
      (m) => normalizeTipo(m?.tipo) === "descarga"
    );
    const crg = movimientos.filter((m) => normalizeTipo(m?.tipo) === "carga");
    const mix = movimientos.filter(
      (m) => normalizeTipo(m?.tipo) === "carga-mixta"
    );

    if (exportKind === "todo") {
      [
        makeSheet(dsc, "Descargas"),
        makeSheet(crg, "Cargas"),
        makeSheet(mix, "CargasMixtas"),
      ].forEach(({ ws, nombreHoja }) =>
        XLSX.utils.book_append_sheet(wb, ws, nombreHoja)
      );
    } else if (exportKind === "descarga") {
      XLSX.utils.book_append_sheet(
        wb,
        makeSheet(dsc, "Descargas").ws,
        "Descargas"
      );
    } else if (exportKind === "carga") {
      XLSX.utils.book_append_sheet(wb, makeSheet(crg, "Cargas").ws, "Cargas");
    } else if (exportKind === "carga-mixta") {
      XLSX.utils.book_append_sheet(
        wb,
        makeSheet(mix, "CargasMixtas").ws,
        "CargasMixtas"
      );
    }

    XLSX.writeFile(wb, `movimientos_${movFrom}_a_${movTo}.xlsx`);
  };

  useEffect(() => {
    if (tab === "movimientos") cargarMovimientos();
  }, [tab]);

  /* =========================
   *        ESCANEOS
   * ========================= */
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

  // ===== Excel de escaneos con estructura de Almacén (Resumen + Detalle)
  const exportEscaneosExcel = () => {
    if (!escaneos.length) return;

    const ahora = DateTime.now().setZone(ZONA).setLocale("es");
    const fechaTexto = ahora.toFormat("cccc dd 'de' LLLL 'de' yyyy");
    const titulo = `Resumen del turno de ${cap(
      turno || "todos"
    )} – ${fechaTexto}`;

    const responsable =
      escaneos.find((e) => e?.responsableEscaneo)?.responsableEscaneo || "";
    const subtitulo = responsable
      ? `Responsable del escaneo: ${responsable}`
      : "";

    // Resúmenes
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

    escaneos.forEach((r) => {
      const trabajadora = r.trabajadora || "—";
      const tipo = r.tipo || "—";

      if (!resumenPorTrabajadora[trabajadora])
        resumenPorTrabajadora[trabajadora] = {};
      resumenPorTrabajadora[trabajadora][tipo] =
        (resumenPorTrabajadora[trabajadora][tipo] || 0) + 1;

      if (Object.prototype.hasOwnProperty.call(resumenPorTipo, tipo))
        resumenPorTipo[tipo]++;
    });

    const wb = XLSX.utils.book_new();

    // Hoja 1: Resumen
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
    sheetResumen.push(["Total palets registrados:", escaneos.length]);
    sheetResumen.push(["Total perchas estimadas:", totalPerchas]);

    const wsResumen = XLSX.utils.aoa_to_sheet(sheetResumen);
    wsResumen["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }];
    wsResumen["!cols"] = [{ wch: 36 }, { wch: 24 }, { wch: 36 }, { wch: 24 }];
    XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen");

    // Hoja 2: Detalle
    const detalleHeaders = [
      "Fecha",
      "Hora",
      "Código",
      "Trabajadora",
      "Tipo",
      "Turno",
      "Responsable",
    ];

    const detalleRows = escaneos
      .slice()
      .sort((a, b) => {
        const da = DateTime.fromISO(a.timestamp || a.createdAt || 0)
          .setZone(ZONA)
          .toMillis();
        const db = DateTime.fromISO(b.timestamp || b.createdAt || 0)
          .setZone(ZONA)
          .toMillis();
        return da - db;
      })
      .map((r) => {
        const d = r.timestamp
          ? DateTime.fromISO(r.timestamp).setZone(ZONA)
          : null;
        const fecha = d ? d.toISODate() : ahora.toISODate();
        const hora = d ? d.toFormat("HH:mm") : "";
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

    // Guardar
    const fechaArchivo = ahora.toISODate(); // YYYY-MM-DD
    XLSX.writeFile(wb, `escaneos_${fechaArchivo}_${turno || "todos"}.xlsx`);
  };

  useEffect(() => {
    if (tab === "escaneos") cargarEscaneos();
  }, [tab]);

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

      {/* ====== Pestaña MOVIMIENTOS ====== */}
      {tab === "movimientos" && (
        <div className="bg-white rounded-2xl border border-emerald-200 p-4 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
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

            {/* Filtro de tipo para la VISTA */}
            <div className="flex flex-col">
              <label className="text-xs text-emerald-700/80 mb-1">Tipo</label>
              <select
                value={tipoFiltro}
                onChange={(e) => setTipoFiltro(e.target.value)}
                className="px-2 py-1.5 border rounded"
              >
                <option value="">Todos</option>
                <option value="descarga">Descargas</option>
                <option value="carga">Cargas</option>
                <option value="carga-mixta">Cargas mixtas</option>
              </select>
            </div>

            {/* Qué exportar al Excel */}
            <div className="flex flex-col">
              <label className="text-xs text-emerald-700/80 mb-1">
                Exportar
              </label>
              <select
                value={exportKind}
                onChange={(e) => setExportKind(e.target.value)}
                className="px-2 py-1.5 border rounded"
              >
                <option value="todo">Todo (3 pestañas)</option>
                <option value="descarga">Solo Descargas</option>
                <option value="carga">Solo Cargas</option>
                <option value="carga-mixta">Solo Cargas Mixtas</option>
              </select>
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
                Total: <b>{movimientosFiltrados.length}</b>
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
                </tr>
              </thead>
              <tbody>
                {filasVista.map((row, idx) => (
                  <tr
                    key={movimientosFiltrados[idx]?._id || idx}
                    className="odd:bg-white even:bg-emerald-50/40"
                  >
                    {columnasMov.map((c) => (
                      <td key={c} className="px-2 py-1 border-b align-top">
                        {String(row[c] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
                {!filasVista.length && (
                  <tr>
                    <td
                      className="px-2 py-3 text-center text-emerald-700"
                      colSpan={columnasMov.length}
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
