import { useEffect, useMemo, useState } from "react";
import { authFetch } from "../authFetch";
import * as XLSX from "xlsx";

const hoy = () => new Date().toLocaleDateString("sv-SE");
const fmtHM = (d) =>
  d
    ? new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";

/* ===================== Helpers de Excel ===================== */
// Filas “limpias” por tipo:
const buildRowsDescarga = (items) =>
  items
    .filter((m) => m.tipo === "descarga")
    .map((m) => ({
      Fecha: m.fecha,
      Contenedor: m.numeroContenedor || "",
      Precinto: m.numeroPrecinto || "",
      Origen: m.origen || "",
      "Palets (descarga)": m.palets ?? "",
      "Cajas (descarga)": m.numeroCajas ?? "",
      "Llegada/Registro": m.timestamp
        ? fmtHM(m.timestamp)
        : m.timestampLlegada
        ? fmtHM(m.timestampLlegada)
        : "",
      Salida: m.timestampSalida ? fmtHM(m.timestampSalida) : "",
      Remolque: m.remolque || "",
      Responsables: m.personal || "",
    }));

const buildRowsCarga = (items) =>
  items
    .filter((m) => m.tipo === "carga")
    .map((m) => ({
      Fecha: m.fecha,
      Empresa: m.empresaTransportista || "",
      Destino: m.destino || "",
      "Tipo palet": m.tipoPalet || "",
      "Nº palets": m.numeroPalets ?? "",
      Contenedor: m.numeroContenedor || "",
      Precinto: m.numeroPrecinto || "",
      Tractora: m.tractora || "",
      Remolque: m.remolque || "",
      Llegada: m.timestampLlegada ? fmtHM(m.timestampLlegada) : "",
      Salida: m.timestampSalida ? fmtHM(m.timestampSalida) : "",
      Responsables: m.personal || "",
    }));

const buildRowsMixta = (items) =>
  items
    .filter((m) => m.tipo === "carga-mixta")
    .map((m) => ({
      Fecha: m.fecha,
      Empresa: m.empresaTransportista || "",
      Destino: m.destino || "",
      "Mixta (detalle)": (m.items || [])
        .map((it) => `${it.tipoPalet}x${it.numeroPalets}`)
        .join(" | "),
      "Total palets": m.totalPalets ?? "",
      Contenedor: m.numeroContenedor || "",
      Precinto: m.numeroPrecinto || "",
      Tractora: m.tractora || "",
      Remolque: m.remolque || "",
      Llegada: m.timestampLlegada ? fmtHM(m.timestampLlegada) : "",
      Salida: m.timestampSalida ? fmtHM(m.timestampSalida) : "",
      Responsables: m.personal || "",
    }));

// Autoajusta anchuras en base al contenido
const autosizeSheet = (ws, rows) => {
  const headers = Object.keys(rows[0] || {});
  ws["!cols"] = headers.map((h) => {
    const maxLen = Math.max(
      h.length,
      ...rows.map((r) => (r[h] ? String(r[h]).length : 0))
    );
    return { wch: Math.min(Math.max(maxLen + 2, 12), 50) };
  });
};
/* =========================================================== */

export default function SupervisorMovimientos({ onLogout }) {
  const [from, setFrom] = useState(hoy());
  const [to, setTo] = useState(hoy());
  const [tipo, setTipo] = useState("todos");
  const [loading, setLoading] = useState(false);
  const [lista, setLista] = useState([]);
  const [error, setError] = useState("");

  const cargar = async () => {
    setLoading(true);
    setError("");
    try {
      const url = new URL(
        `${import.meta.env.VITE_BACKEND_URL}/api/almacen/movimientos/rango`
      );
      url.searchParams.set("from", from);
      url.searchParams.set("to", to);
      if (tipo) url.searchParams.set("tipo", tipo);

      const res = await authFetch(url.toString());
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.msg || "No se pudo obtener el historial");
      }
      const data = await res.json();
      setLista(data || []);
    } catch (e) {
      setError(e.message || "Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Exportación Excel SEGÚN tipo (o 3 pestañas si es “todos”)
  const exportExcel = () => {
    if (!lista.length) return;

    const wb = XLSX.utils.book_new();

    if (tipo === "descarga") {
      const rows = buildRowsDescarga(lista);
      if (!rows.length) return;
      const ws = XLSX.utils.json_to_sheet(rows);
      autosizeSheet(ws, rows);
      XLSX.utils.book_append_sheet(wb, ws, "Descargas");
      XLSX.writeFile(wb, `historial_descargas_${from}_a_${to}.xlsx`);
      return;
    }

    if (tipo === "carga") {
      const rows = buildRowsCarga(lista);
      if (!rows.length) return;
      const ws = XLSX.utils.json_to_sheet(rows);
      autosizeSheet(ws, rows);
      XLSX.utils.book_append_sheet(wb, ws, "Cargas");
      XLSX.writeFile(wb, `historial_cargas_${from}_a_${to}.xlsx`);
      return;
    }

    if (tipo === "carga-mixta") {
      const rows = buildRowsMixta(lista);
      if (!rows.length) return;
      const ws = XLSX.utils.json_to_sheet(rows);
      autosizeSheet(ws, rows);
      XLSX.utils.book_append_sheet(wb, ws, "Cargas mixtas");
      XLSX.writeFile(wb, `historial_cargas_mixtas_${from}_a_${to}.xlsx`);
      return;
    }

    // tipo === "todos" -> 3 hojas
    const rowsD = buildRowsDescarga(lista);
    const rowsC = buildRowsCarga(lista);
    const rowsM = buildRowsMixta(lista);

    if (rowsD.length) {
      const wsD = XLSX.utils.json_to_sheet(rowsD);
      autosizeSheet(wsD, rowsD);
      XLSX.utils.book_append_sheet(wb, wsD, "Descargas");
    }
    if (rowsC.length) {
      const wsC = XLSX.utils.json_to_sheet(rowsC);
      autosizeSheet(wsC, rowsC);
      XLSX.utils.book_append_sheet(wb, wsC, "Cargas");
    }
    if (rowsM.length) {
      const wsM = XLSX.utils.json_to_sheet(rowsM);
      autosizeSheet(wsM, rowsM);
      XLSX.utils.book_append_sheet(wb, wsM, "Cargas mixtas");
    }

    if (!rowsD.length && !rowsC.length && !rowsM.length) return;

    XLSX.writeFile(wb, `historial_${from}_a_${to}.xlsx`);
  };

  // Agrupar pantalla por fecha para la tabla
  const grouped = useMemo(() => {
    const g = {};
    for (const m of lista) {
      if (!g[m.fecha]) g[m.fecha] = [];
      g[m.fecha].push(m);
    }
    for (const k of Object.keys(g))
      g[k].sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
    return g;
  }, [lista]);

  return (
    <div className="min-h-screen bg-gray-100 text-gray-800">
      <div className="bg-emerald-700 text-white">
        <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-semibold">
            📋 Supervisor — Historial de movimientos
          </h1>
          <button
            onClick={onLogout}
            className="px-3 py-1 rounded-full text-sm font-medium bg-rose-600 hover:bg-rose-700 border border-rose-300"
          >
            Cerrar sesión
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="max-w-5xl mx-auto px-4 py-4">
        <div className="rounded-xl bg-white border border-gray-200 p-4 flex flex-col md:flex-row gap-3 md:items-end">
          <div className="flex-1">
            <label className="block text-xs text-gray-600 mb-1">Desde</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full border rounded-lg p-2"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-600 mb-1">Hasta</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full border rounded-lg p-2"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-600 mb-1">Tipo</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="w-full border rounded-lg p-2"
            >
              <option value="todos">Todos</option>
              <option value="descarga">Descarga</option>
              <option value="carga">Carga</option>
              <option value="carga-mixta">Carga mixta</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setFrom(hoy());
                setTo(hoy());
                setTipo("todos");
              }}
              className="px-3 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50"
            >
              Hoy
            </button>
            <button
              onClick={cargar}
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {loading ? "Buscando..." : "Buscar"}
            </button>
            <button
              onClick={cargar}
              disabled={loading}
              className="px-3 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-60"
              title="Volver a consultar"
            >
              🔄 Refrescar
            </button>
            <button
              onClick={exportExcel}
              disabled={!lista.length}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              Exportar Excel
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-3 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 p-3 text-sm">
            {error}
          </div>
        )}
      </div>

      {/* Tabla */}
      <div className="max-w-5xl mx-auto px-4 pb-10">
        {Object.keys(grouped).length === 0 && !loading && (
          <div className="text-sm text-gray-600">No hay resultados.</div>
        )}

        {Object.entries(grouped).map(([fecha, items]) => (
          <div key={fecha} className="mb-6">
            <div className="text-sm font-semibold text-gray-700 mb-2">
              {fecha}
            </div>
            <div className="overflow-x-auto bg-white border border-gray-200 rounded-xl">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <Th>Tipo</Th>
                    <Th>Empresa / Contenedor</Th>
                    <Th>Origen</Th>
                    <Th>Destino</Th>
                    <Th>Detalle</Th>
                    <Th>Horas</Th>
                    <Th>Resp.</Th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((m) => {
                    const empresaOCt = m.numeroContenedor
                      ? m.numeroContenedor
                      : m.empresaTransportista || "—";

                    const detalleBase =
                      m.tipo === "descarga"
                        ? `Palets: ${m.palets ?? 0} · Cajas: ${
                            m.numeroCajas ?? 0
                          }`
                        : m.tipo === "carga"
                        ? `Tipo: ${m.tipoPalet} · Palets: ${m.numeroPalets}`
                        : `Mixta: ${(m.items || [])
                            .map((it) => `${it.tipoPalet}x${it.numeroPalets}`)
                            .join(" | ")} · Total: ${m.totalPalets}`;

                    const extra = [
                      m.numeroPrecinto ? `Precinto: ${m.numeroPrecinto}` : "",
                      m.tractora ? `Tractora: ${m.tractora}` : "",
                      m.remolque ? `Remolque: ${m.remolque}` : "",
                    ]
                      .filter(Boolean)
                      .join(" · ");

                    const detalle = extra
                      ? `${detalleBase} · ${extra}`
                      : detalleBase;

                    const horas =
                      m.tipo === "descarga"
                        ? `${fmtHM(m.timestamp)}${
                            m.timestampSalida
                              ? " → " + fmtHM(m.timestampSalida)
                              : ""
                          }`
                        : `${fmtHM(m.timestampLlegada)}${
                            m.timestampSalida
                              ? " → " + fmtHM(m.timestampSalida)
                              : ""
                          }`;

                    const destino =
                      m.tipo === "descarga" ? "—" : m.destino || "—";

                    return (
                      <tr key={m._id} className="border-t last:border-b">
                        <Td className="font-medium capitalize">{m.tipo}</Td>
                        <Td>{empresaOCt}</Td>
                        <Td>{m.origen || "—"}</Td>
                        <Td>{destino}</Td>
                        <Td>{detalle}</Td>
                        <Td>{horas}</Td>
                        <Td>{m.personal || "—"}</Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Th({ children }) {
  return (
    <th className="text-left px-3 py-2 font-semibold text-gray-700">
      {children}
    </th>
  );
}
function Td({ children, className = "" }) {
  return <td className={`px-3 py-2 align-top ${className}`}>{children}</td>;
}
