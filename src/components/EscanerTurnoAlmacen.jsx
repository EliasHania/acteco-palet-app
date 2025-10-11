"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import * as XLSX from "xlsx";

export default function EscanerTurnoAlmacen({ onLogout }) {
  const readerId = "almacen-qr-reader";

  // ===== LocalStorage keys
  const LS_KEYS = {
    turno: "almacen.turno",
    responsable: "almacen.responsable",
  };

  // ===== Refs cámara / html5-qrcode
  const qrRef = useRef(null);
  const mediaTrackRef = useRef(null);
  const initializedRef = useRef(false);
  const startedRef = useRef(false);
  const wantStartRef = useRef(false);

  // ===== UI
  const [cameraActive, setCameraActive] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [status, setStatus] = useState({
    text: "Apunta al código…",
    type: "idle",
  });

  // ===== Datos de usuario / sesión
  const [turno, setTurno] = useState(""); // "yoana" | "lidia"
  const [responsable, setResponsable] = useState(""); // nombre
  const [incidents, setIncidents] = useState(0); // contador de incidencias

  // Lista mostrada a la derecha: SIEMPRE lo guardado en BD hoy+turno
  const [okScans, setOkScans] = useState([]); // documentos de /almacen/escaneos (día+turno)

  // Modal de confirmación
  const [pendingPalet, setPendingPalet] = useState(null);
  const [saving, setSaving] = useState(false);

  // Fondo radial
  const pageRef = useRef(null);
  const anchorRef = useRef(null);

  // Antirebote lector
  const lastCodeRef = useRef({ code: "", ts: 0 });

  const todayStr = () => new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD

  const getAuthHeader = () => {
    const token =
      localStorage.getItem("token") || sessionStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const api = async (path, opts = {}) => {
    const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}${path}`, {
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      ...opts,
    });
    return res;
  };

  const beep = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.type = "sine";
      o.frequency.setValueAtTime(880, ctx.currentTime);
      g.gain.setValueAtTime(0.1, ctx.currentTime);
      o.start();
      o.stop(ctx.currentTime + 0.08);
    } catch {}
  };

  // ====== Autocargar / Autoguardar turno + responsable
  useEffect(() => {
    try {
      const t = localStorage.getItem(LS_KEYS.turno);
      const r = localStorage.getItem(LS_KEYS.responsable);
      if (t) setTurno(t);
      if (r) setResponsable(r);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      if (turno) localStorage.setItem(LS_KEYS.turno, turno);
      else localStorage.removeItem(LS_KEYS.turno);
    } catch {}
  }, [turno]);

  useEffect(() => {
    try {
      const val = (responsable || "").trim();
      if (val) localStorage.setItem(LS_KEYS.responsable, val);
      else localStorage.removeItem(LS_KEYS.responsable);
    } catch {}
  }, [responsable]);

  // ====== Helpers de datos
  const fetchPaletByCode = async (codigo) => {
    const url = `/api/palets/by-code?code=${encodeURIComponent(
      codigo
    )}&date=${todayStr()}${turno ? `&turno=${turno}` : ""}`;
    const res = await api(url);
    if (!res.ok) throw new Error("No se pudo consultar el palet");
    return await res.json();
  };

  const fetchEscaneosHoyTurno = async () => {
    if (!turno) return setOkScans([]);
    const qs = new URLSearchParams({ fecha: todayStr(), turno }).toString();
    const res = await api(`/api/almacen/escaneos/fecha?${qs}`);
    if (!res.ok) throw new Error("No se pudieron cargar escaneos");
    const datos = await res.json();
    setOkScans(Array.isArray(datos) ? datos : []);
  };

  const savePaletToAlmacen = async (paletObj) => {
    const payload = {
      ...paletObj,
      origen: "almacen",
      turno,
      responsableEscaneo: responsable,
      fecha: todayStr(),
      timestamp: new Date().toISOString(),
      codigo: paletObj?.codigo || paletObj?.qr || "",
    };
    const res = await api(`/api/almacen/escaneos`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.msg || "No se pudo guardar el escaneo de almacén");
    }
    return await res.json();
  };

  // ====== Arranque / cambios de turno
  useEffect(() => {
    // cada vez que haya turno (y al cargar), trae lo guardado en BD
    if (turno) fetchEscaneosHoyTurno().catch(() => {});
  }, [turno]);

  // ====== Lector
  const startCamera = async () => {
    setCameraError(null);
    setStatus({ text: "Inicializando cámara…", type: "loading" });
    if (initializedRef.current) return;
    initializedRef.current = true;

    const container = document.getElementById(readerId);
    if (!container) {
      initializedRef.current = false;
      return;
    }

    const html5 = new Html5Qrcode(readerId);
    qrRef.current = html5;

    try {
      await html5.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 280 },
        handleCheck,
        () => {}
      );
      startedRef.current = true;

      const video = document.querySelector(`#${readerId} video`);
      if (video) {
        video.style.display = "block";
        video.style.objectFit = "cover";
        video.setAttribute("playsinline", "true");
      }

      const stream = video?.srcObject;
      mediaTrackRef.current = stream?.getVideoTracks?.()[0] || null;
      setStatus({ text: "Apunta al código…", type: "idle" });
    } catch (err) {
      setCameraError({
        name: err?.name || "Error",
        message: err?.message || String(err),
      });
      setStatus({ text: "No se pudo abrir la cámara", type: "error" });
      initializedRef.current = false;
      startedRef.current = false;
      setCameraActive(false);
    }
  };

  const stopCamera = async () => {
    setTorchOn(false);
    try {
      mediaTrackRef.current?.stop?.();
    } catch {}
    if (qrRef.current && startedRef.current) {
      try {
        await qrRef.current.stop();
      } catch {}
      try {
        await qrRef.current.clear();
      } catch {}
    }
    mediaTrackRef.current = null;
    startedRef.current = false;
    initializedRef.current = false;
    setCameraActive(false);
    setStatus({ text: "Apunta al código…", type: "idle" });
  };

  const handleOpen = () => {
    if (!turno || !responsable.trim()) {
      setStatus({ text: "Selecciona turno y responsable", type: "warn" });
      return;
    }
    navigator.vibrate?.(20);
    setCameraError(null);
    setStatus({ text: "Inicializando cámara…", type: "loading" });
    wantStartRef.current = true;
    setCameraActive(true);
  };

  useEffect(() => {
    if (!cameraActive || !wantStartRef.current) return;
    const el = document.getElementById(readerId);
    if (!el) {
      requestAnimationFrame(() => setCameraActive((x) => x));
      return;
    }
    wantStartRef.current = false;
    startCamera();
  }, [cameraActive]);

  useEffect(() => () => void stopCamera(), []);

  const toggleTorch = async () => {
    const track = mediaTrackRef.current;
    if (!track) return;
    try {
      const caps = track.getCapabilities?.();
      if (!caps || !caps.torch) return;
      const next = !torchOn;
      await track.applyConstraints({ advanced: [{ torch: next }] });
      setTorchOn(next);
    } catch {}
  };

  // ====== Lógica al leer un QR (cámara)
  const handleCheck = async (decodedText) => {
    const now = Date.now();
    if (
      lastCodeRef.current.code === decodedText &&
      now - lastCodeRef.current.ts < 1200
    )
      return;
    lastCodeRef.current = { code: decodedText, ts: now };

    setStatus({ text: "Comprobando…", type: "loading" });

    try {
      // 1) ¿Existe palet en Encargadas hoy?
      const palet = await fetchPaletByCode(decodedText);

      if (!palet) {
        // sólo informar; NO se añade a la lista (como pediste)
        setIncidents((n) => n + 1);
        setStatus({ text: "⚠️ Palet sin alta hoy", type: "warn" });
        navigator.vibrate?.(120);
        return;
      }

      // 2) ¿Ya está guardado en Almacén hoy para este turno?
      const ya = okScans.some(
        (e) =>
          String(e.codigo || "").toLowerCase() ===
          String(decodedText).toLowerCase()
      );

      if (ya) {
        setStatus({
          text: "⚠️ Palet ya guardado hoy en Almacén",
          type: "warn",
        });
        // Asegura que la lista esté actualizada desde BD (por si lo guardó otro dispositivo)
        fetchEscaneosHoyTurno().catch(() => {});
        return;
      }

      // 3) Abrir modal de confirmación
      setPendingPalet(palet);
      setStatus({ text: "Palet encontrado. Revisa y añade.", type: "ok" });
      beep();
    } catch {
      setStatus({ text: "Error consultando la BD", type: "error" });
    } finally {
      setTimeout(
        () => setStatus({ text: "Apunta al código…", type: "idle" }),
        900
      );
    }
  };

  // ====== Excel (lista derecha, con lo que hay en BD)
  const exportExcel = () => {
    if (!okScans.length) return;
    const rows = okScans
      .slice()
      .sort(
        (a, b) =>
          new Date(a.timestamp || a.createdAt || 0) -
          new Date(b.timestamp || b.createdAt || 0)
      )
      .map((s) => ({
        Fecha: s.timestamp
          ? new Date(s.timestamp).toLocaleDateString("sv-SE")
          : todayStr(),
        Hora: s.timestamp
          ? new Date(s.timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "",
        Código: s.codigo || "",
        Turno: s.turno || "",
        Responsable: s.responsableEscaneo || "",
      }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    const headers = Object.keys(rows[0] || {});
    ws["!cols"] = headers.map((h) => {
      const maxLen = Math.max(
        h.length,
        ...rows.map((r) => (r[h] ? String(r[h]).length : 0))
      );
      return { wch: Math.min(Math.max(maxLen + 2, 12), 50) };
    });
    XLSX.utils.book_append_sheet(wb, ws, "Escaneos Almacén");
    XLSX.writeFile(wb, `almacen_${todayStr()}_${turno || "todos"}.xlsx`);
  };

  // ====== Fondo radial (cosmético)
  const updateRadialCenter = () => {
    const root = pageRef.current;
    const anchor = anchorRef.current;
    if (!root || !anchor) return;
    const r = root.getBoundingClientRect();
    const a = anchor.getBoundingClientRect();
    const cx = ((a.left + a.width / 2 - r.left) / r.width) * 100;
    const cy = ((a.top + a.height / 2 - r.top) / r.height) * 100;
    root.style.setProperty("--cx", `${cx}%`);
    root.style.setProperty("--cy", `${cy}%`);
  };

  useLayoutEffect(() => {
    updateRadialCenter();
    const onResize = () => updateRadialCenter();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, [cameraActive]);

  const showTorch = !!mediaTrackRef.current?.getCapabilities?.()?.torch;

  // ====== Contadores (lista derecha = sólo OK)
  const totalOK = okScans.length;
  const warnCount = incidents;

  // ====== Búsqueda manual (sin cámara)
  const [manualCode, setManualCode] = useState("");
  const handleManualSearch = async () => {
    const code = manualCode.trim();
    if (!code) return;
    setStatus({ text: "Buscando palet…", type: "loading" });
    try {
      const palet = await fetchPaletByCode(code);
      if (!palet) {
        setIncidents((n) => n + 1);
        setStatus({ text: "⚠️ Palet sin alta hoy", type: "warn" });
        return;
      }
      const ya = okScans.some(
        (e) =>
          String(e.codigo || "").toLowerCase() === String(code).toLowerCase()
      );
      if (ya) {
        setStatus({
          text: "⚠️ Palet ya guardado hoy en Almacén",
          type: "warn",
        });
        fetchEscaneosHoyTurno().catch(() => {});
        return;
      }
      setPendingPalet(palet);
      setStatus({ text: "Palet encontrado. Revisa y añade.", type: "ok" });
      beep();
    } catch {
      setStatus({ text: "Error consultando la BD", type: "error" });
    } finally {
      setTimeout(
        () => setStatus({ text: "Apunta al código…", type: "idle" }),
        900
      );
    }
  };

  return (
    <div
      ref={pageRef}
      className="min-h-[70vh] relative overflow-hidden text-emerald-50 flex flex-col"
      style={{
        background: `
          radial-gradient(circle at var(--cx,50%) var(--cy,40%), rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.10) 35%, rgba(255,255,255,0.02) 65%, transparent 75%),
          radial-gradient(circle at var(--cx,50%) var(--cy,40%), rgba(16,185,129,0.45) 0%, rgba(16,185,129,0.28) 30%, rgba(16,185,129,0.12) 55%, transparent 70%),
          linear-gradient(180deg, rgba(5,150,105,0.98) 0%, rgba(22,163,74,0.94) 35%, rgba(34,197,94,0.90) 75%, rgba(240,253,244,0.88) 100%)
        `,
      }}
    >
      {/* Header */}
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 pt-4">
        <div className="rounded-2xl border border-white/20 bg-white/15 backdrop-blur-md shadow-lg px-5 py-3 flex flex-col md:flex-row md:items-center gap-3">
          <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-white">
            Escáner — Turno de Almacén
          </h2>

          <div className="flex-1 flex flex-col sm:flex-row gap-2 sm:items-center sm:ml-auto">
            <select
              value={turno}
              onChange={(e) => setTurno(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-sm bg-white/90 text-emerald-900 border border-emerald-200"
            >
              <option value="">Selecciona turno…</option>
              <option value="yoana">Turno de Yoana</option>
              <option value="lidia">Turno de Lidia</option>
            </select>

            <input
              type="text"
              value={responsable}
              onChange={(e) => setResponsable(e.target.value)}
              placeholder="Responsable del escaneo (nombre)"
              className="flex-1 px-3 py-1.5 rounded-lg text-sm bg-white/90 text-emerald-900 border border-emerald-200 placeholder-emerald-700/70"
            />
          </div>

          <button
            onClick={onLogout}
            className="md:ml-2 px-3 py-1 rounded-full text-sm font-medium bg-rose-700/60 text-white border border-rose-400/40 hover:bg-rose-700/80"
          >
            🔒 Cerrar sesión
          </button>
        </div>
      </div>

      {/* CONTENIDO */}
      <main className="w-full max-w-6xl mx-auto px-4 sm:px-6 pb-8 mt-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* BOX 1: Cámara + búsqueda manual */}
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-white/30 shadow-xl p-6">
            <h3 className="text-lg font-semibold text-emerald-900 mb-4">
              📷 Escáner QR
            </h3>

            <div className="flex flex-col items-center">
              {(!turno || !responsable.trim()) && (
                <div className="py-8 text-center">
                  <div className="mx-auto mb-3 w-20 h-20 rounded-full bg-emerald-100 text-green-600 flex items-center justify-center shadow">
                    <svg
                      width="32"
                      height="32"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M9.5 7 11 5h2l1.5 2H18a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V10a3 3 0 0 1 3-3h3.5zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0-2.2A1.8 1.8 0 1 1 12 11a1.8 1.8 0 0 1 0 3.8z" />
                    </svg>
                  </div>
                  <div className="text-emerald-800 font-medium">
                    Selecciona turno y escribe el responsable para empezar
                  </div>
                </div>
              )}

              {turno && responsable.trim() && !cameraActive && !cameraError && (
                <div
                  ref={anchorRef}
                  className="flex flex-col items-center gap-5 py-6"
                >
                  <div className="relative">
                    <span className="absolute inset-0 rounded-full animate-ping bg-emerald-400/30" />
                    <button
                      onClick={handleOpen}
                      className="relative w-28 h-28 rounded-full bg-emerald-600 text-white shadow-2xl hover:bg-emerald-700 active:scale-95 transition flex items-center justify-center"
                      aria-label="Abrir cámara"
                      style={{ boxShadow: "0 18px 40px rgba(16,185,129,.35)" }}
                    >
                      <svg
                        width="36"
                        height="36"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M9.5 7 11 5h2l1.5 2H18a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V10a3 3 0 0 1 3-3h3.5zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0-2.2A1.8 1.8 0 1 1 12 11a1.8 1.8 0 0 1 0 3.8z" />
                      </svg>
                    </button>
                  </div>
                  <div className="text-[15px] text-emerald-800 font-medium">
                    Toca para abrir la cámara
                  </div>
                </div>
              )}

              {turno && responsable.trim() && cameraActive && (
                <>
                  <div className="w-full flex justify-center">
                    <div
                      ref={anchorRef}
                      className={`relative ${
                        status.type === "ok"
                          ? "ring-4 ring-green-500"
                          : status.type === "warn"
                          ? "ring-4 ring-amber-500"
                          : status.type === "error"
                          ? "ring-4 ring-rose-500"
                          : status.type === "loading"
                          ? "ring-4 ring-green-400"
                          : "ring-2 ring-green-300"
                      } rounded-2xl overflow-hidden shadow-[0_25px_100px_-30px_rgba(16,185,129,.55)] bg-white`}
                      style={{ width: 340, height: 340 }}
                    >
                      <button
                        onClick={stopCamera}
                        className="absolute right-3 top-3 z-20 px-3 py-1.5 rounded-lg text-sm bg-rose-600 hover:bg-rose-700 text-white font-medium shadow-md border border-rose-700/30"
                      >
                        Cerrar cámara
                      </button>
                      <div
                        id={readerId}
                        className="relative w-[340px] h-[340px] bg-black rounded-2xl"
                      />
                      {[
                        "top-0 left-0",
                        "top-0 right-0",
                        "bottom-0 left-0",
                        "bottom-0 right-0",
                      ].map((pos, i) => (
                        <span
                          key={i}
                          className={`pointer-events-none absolute ${pos} w-12 h-12 border-4 border-white rounded-md ${
                            pos.includes("left") ? "border-r-0" : "border-l-0"
                          } ${
                            pos.includes("top") ? "border-b-0" : "border-t-0"
                          }`}
                        />
                      ))}
                      <div className="pointer-events-none absolute inset-0 flex items-end justify-center p-3">
                        <div
                          className={`px-3 py-2 rounded-lg text-white text-sm font-semibold ${
                            status.type === "ok"
                              ? "bg-green-600/90"
                              : status.type === "warn"
                              ? "bg-amber-600/90"
                              : status.type === "error"
                              ? "bg-rose-600/90"
                              : status.type === "loading"
                              ? "bg-green-700/90"
                              : "bg-green-800/80"
                          } backdrop-blur shadow`}
                        >
                          {status.text}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col items-center gap-2">
                    {showTorch && (
                      <button
                        onClick={toggleTorch}
                        className="px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-sm font-medium shadow-sm"
                      >
                        {torchOn
                          ? "🔦 Apagar linterna"
                          : "🔦 Encender linterna"}
                      </button>
                    )}
                    <span className="text-xs text-emerald-700/80 text-center">
                      Requiere conexión segura (https) salvo en{" "}
                      <span className="font-mono">localhost</span>.
                    </span>
                  </div>
                </>
              )}

              {turno && responsable.trim() && cameraError && !cameraActive && (
                <div className="w-full max-w-md mt-4 mx-auto bg-rose-50 border border-rose-200 rounded-xl p-4 shadow">
                  <div className="text-sm font-medium mb-2 text-rose-800">
                    Error al abrir la cámara
                  </div>
                  <button
                    onClick={() => {
                      initializedRef.current = false;
                      handleOpen();
                    }}
                    className="px-3 py-2 rounded-lg border border-emerald-300 bg-emerald-600 hover:bg-emerald-700 text-sm font-medium text-white"
                  >
                    Reintentar
                  </button>
                </div>
              )}
            </div>

            {/* BÚSQUEDA MANUAL */}
            <div className="mt-6 border-t border-emerald-200 pt-4 w-full">
              <div className="text-emerald-900 font-semibold mb-2">
                ⌨️ Búsqueda manual (sin cámara)
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="Pega o escribe el código/QR"
                  autoComplete="off"
                  className="flex-1 px-3 py-2 rounded-lg border bg-white text-emerald-900 placeholder-emerald-500 border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-500"
                  style={{ WebkitTextFillColor: "#064e3b" }}
                />

                <button
                  onClick={handleManualSearch}
                  className="px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-sm font-medium"
                >
                  Buscar manual
                </button>
              </div>
            </div>

            {/* MODAL: confirmar y guardar */}
            {pendingPalet && (
              <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
                <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-emerald-200 overflow-hidden">
                  <div className="px-5 py-3 border-b border-emerald-100 bg-emerald-50 flex items-center">
                    <h4 className="text-emerald-900 font-semibold">
                      Confirmar palet —{" "}
                      {(
                        pendingPalet?.codigo ||
                        pendingPalet?.qr ||
                        ""
                      ).toString()}
                    </h4>
                    <button
                      onClick={() => setPendingPalet(null)}
                      className="ml-auto text-emerald-700 hover:text-emerald-900 px-3 py-1"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="p-5 max-h-[60vh] overflow-y-auto">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                      {Object.entries(pendingPalet).map(([k, v]) => (
                        <div key={k} className="py-1.5">
                          <div className="text-xs uppercase tracking-wide text-emerald-700/70">
                            {k}
                          </div>
                          <div className="text-emerald-900 break-words text-sm mt-0.5">
                            {typeof v === "object"
                              ? JSON.stringify(v)
                              : String(v)}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 text-xs text-emerald-700/70">
                      *Se guardará una copia íntegra en Almacén con turno “
                      {turno}”, responsable “{responsable}”, y fecha{" "}
                      {todayStr()}.
                    </div>
                  </div>

                  <div className="px-5 py-4 border-t border-emerald-100 bg-emerald-50 flex gap-3">
                    <button
                      onClick={async () => {
                        try {
                          setSaving(true);
                          await savePaletToAlmacen(pendingPalet);
                          setSaving(false);
                          setPendingPalet(null);
                          setStatus({
                            text: "✅ Añadido a Almacén",
                            type: "ok",
                          });
                          beep();
                          // refresca lista desde BD para que aparezca a la derecha
                          fetchEscaneosHoyTurno().catch(() => {});
                        } catch (e) {
                          setSaving(false);
                          setStatus({
                            text: e?.message || "No se pudo añadir",
                            type: "error",
                          });
                        } finally {
                          setTimeout(
                            () =>
                              setStatus({
                                text: "Apunta al código…",
                                type: "idle",
                              }),
                            1000
                          );
                        }
                      }}
                      disabled={saving}
                      className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 font-medium disabled:opacity-50"
                    >
                      {saving ? "Guardando…" : "➕ Añadir a Almacén"}
                    </button>
                    <button
                      onClick={() => setPendingPalet(null)}
                      disabled={saving}
                      className="px-4 py-2 rounded-lg border border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-50"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* BOX 2: Lista (ahora SIEMPRE lo de BD) */}
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-white/30 shadow-xl p-6 flex flex-col">
            <div className="flex items-center gap-3 mb-4">
              <h3 className="text-lg font-semibold text-emerald-900">
                📦 Palets Registrados
              </h3>
              <div className="ml-auto text-xs flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 border border-emerald-200 font-medium">
                  Total: {totalOK}
                </span>
                <span className="px-2 py-0.5 rounded bg-green-100 text-green-700 border border-green-200 font-medium">
                  ✓ {totalOK}
                </span>
                <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200 font-medium">
                  ⚠ {warnCount}
                </span>
              </div>
            </div>

            <div className="flex-1 min-h-[400px] rounded-lg border border-emerald-200 bg-white overflow-hidden flex flex-col">
              <div className="flex-1 overflow-y-auto">
                {!okScans.length && (
                  <div className="p-6 text-center text-sm text-emerald-700/70">
                    Aún no hay lecturas OK en esta sesión.
                  </div>
                )}
                {!!okScans.length && (
                  <ul className="divide-y divide-emerald-100">
                    {okScans
                      .slice()
                      .sort(
                        (a, b) =>
                          new Date(b.timestamp || b.createdAt || 0) -
                          new Date(a.timestamp || a.createdAt || 0)
                      )
                      .map((s) => (
                        <li
                          key={s._id}
                          className="px-4 py-3 flex items-center gap-3 text-sm hover:bg-emerald-50/50 transition"
                        >
                          <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500" />
                          <span className="font-mono text-emerald-900 font-medium">
                            {s.codigo}
                          </span>
                          <span className="ml-auto text-xs text-emerald-700/70 flex items-center gap-2">
                            <span>
                              {s.timestamp
                                ? new Date(s.timestamp).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : ""}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-green-100 text-green-700">
                              OK
                            </span>
                          </span>
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={exportExcel}
                disabled={!okScans.length}
                className="flex-1 px-4 py-2.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
              >
                📊 Descargar Excel
              </button>
              <button
                onClick={() => setIncidents(0)}
                className="px-4 py-2.5 rounded-lg bg-white text-emerald-800 border border-emerald-300 hover:bg-emerald-50 text-sm font-medium transition"
              >
                🧹 Limpiar incidencias
              </button>
            </div>
          </div>
        </div>

        <div className="w-full mt-6 border-t border-white/25" />
        <div className="pt-2 text-xs text-white/90 text-center">
          Acteco • Escáner de palets · Feedback visual en tiempo real
        </div>
      </main>
    </div>
  );
}
