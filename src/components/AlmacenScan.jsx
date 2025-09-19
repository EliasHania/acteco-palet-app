import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { authFetch } from "../authFetch";

export default function AlmacenScan({ onLogout }) {
  const readerId = "almacen-qr-reader";
  const qrRef = useRef(null);
  const mediaTrackRef = useRef(null);

  const initializedRef = useRef(false);
  const startedRef = useRef(false);
  const wantStartRef = useRef(false); // <- marca intención de iniciar tras render

  const [cameraActive, setCameraActive] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [status, setStatus] = useState({
    text: "Apunta al código…",
    type: "idle",
  });
  const lastCodeRef = useRef({ code: "", ts: 0 });
  const [manualQR, setManualQR] = useState("");

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

  const handleCheck = async (decodedText) => {
    const now = Date.now();
    if (
      lastCodeRef.current.code === decodedText &&
      now - lastCodeRef.current.ts < 1500
    )
      return;
    lastCodeRef.current = { code: decodedText, ts: now };

    setStatus({ text: "Comprobando…", type: "loading" });
    try {
      const res = await authFetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/scan`,
        {
          method: "POST",
          body: JSON.stringify({ qr: decodedText }),
        }
      );
      const data = await res.json();
      if (data?.registered) {
        setStatus({ text: "✅ Palet registrado", type: "ok" });
        beep();
      } else {
        setStatus({ text: "⚠️ Palet sin registrar", type: "warn" });
        navigator.vibrate?.(200);
      }
    } catch {
      setStatus({ text: "Error al comprobar", type: "error" });
    }
  };

  // Inicia la cámara (requiere que el contenedor ya exista en el DOM)
  const startCamera = async () => {
    setCameraError(null);
    setStatus({ text: "Inicializando cámara…", type: "loading" });
    if (initializedRef.current) return;
    initializedRef.current = true;

    const container = document.getElementById(readerId);
    if (!container) {
      // Si por lo que sea aún no está en el DOM, cancela y reintenta después
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
      const stream = video?.srcObject;
      const track = stream?.getVideoTracks?.()[0];
      mediaTrackRef.current = track || null;

      setStatus({ text: "Apunta al código…", type: "idle" });
    } catch (err) {
      setCameraError({
        name: err?.name || "Error",
        message: err?.message || String(err),
      });
      setStatus({ text: "No se pudo abrir la cámara", type: "error" });
      // deja listo para reintentar
      initializedRef.current = false;
      startedRef.current = false;
      setCameraActive(false);
    }
  };

  // Cierra la cámara y limpia
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

  // CTA: marcar intención y activar la vista; el efecto arrancará la cámara
  const handleOpen = () => {
    navigator.vibrate?.(20);
    setCameraError(null);
    setStatus({ text: "Inicializando cámara…", type: "loading" });
    wantStartRef.current = true;
    setCameraActive(true); // esto hace que se renderice el <div id=...>
  };

  // Cuando el visor ya está montado, inicia la cámara
  useEffect(() => {
    if (!cameraActive || !wantStartRef.current) return;

    const el = document.getElementById(readerId);
    if (!el) {
      // Asegura que el DOM está listo
      requestAnimationFrame(() => setCameraActive((x) => x));
      return;
    }
    wantStartRef.current = false;
    startCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraActive]);

  // Limpieza al desmontar
  useEffect(() => {
    return () => {
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const borderByType =
    status.type === "ok"
      ? "ring-4 ring-emerald-500"
      : status.type === "warn"
      ? "ring-4 ring-amber-500"
      : status.type === "error"
      ? "ring-4 ring-rose-500"
      : status.type === "loading"
      ? "ring-4 ring-emerald-400"
      : "ring-2 ring-emerald-300";

  const badgeClasses =
    status.type === "ok"
      ? "bg-emerald-600/90"
      : status.type === "warn"
      ? "bg-amber-600/90"
      : status.type === "error"
      ? "bg-rose-600/90"
      : status.type === "loading"
      ? "bg-emerald-700/90"
      : "bg-emerald-800/80";

  const showTorch = !!mediaTrackRef.current?.getCapabilities?.()?.torch;

  return (
    <div
      className="min-h-screen relative overflow-hidden text-emerald-950 flex flex-col items-center"
      style={{
        background:
          "radial-gradient(1200px 600px at 20% -10%, #d1fae5 0%, rgba(209,250,229,0) 60%), radial-gradient(1200px 600px at 120% 110%, #bbf7d0 0%, rgba(187,247,208,0) 60%), linear-gradient(180deg,#ecfdf5 0%, #e6f7ee 60%, #eafaf3 100%)",
      }}
    >
      {/* Header */}
      <header className="w-full max-w-5xl mx-auto px-6 pt-10 pb-4 flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">
          Escáner — <span className="text-emerald-700">Turno de Almacén</span>
        </h1>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full text-sm bg-emerald-100 text-emerald-800 border border-emerald-200">
            Modo almacén
          </span>
          <button
            onClick={onLogout}
            className="ml-2 px-3 py-1.5 rounded-lg text-sm bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100"
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      <main className="w-full max-w-5xl mx-auto px-6 pb-10">
        <div className="mx-auto flex flex-col items-center gap-6">
          {/* ===== INACTIVO: Botón circular con pulso ===== */}
          {!cameraActive && !cameraError && (
            <div className="flex flex-col items-center gap-5">
              <div className="relative">
                <span className="absolute inset-0 rounded-full animate-ping bg-emerald-400/30"></span>
                <button
                  onClick={handleOpen}
                  className="relative w-24 h-24 rounded-full bg-emerald-600 text-white shadow-xl active:scale-95 transition flex items-center justify-center"
                  style={{ boxShadow: "0 12px 30px rgba(16,185,129,.45)" }}
                >
                  <span className="text-2xl">🎥</span>
                </button>
              </div>
              <div className="text-sm text-emerald-900/70 font-medium">
                Toca para abrir la cámara
              </div>
            </div>
          )}

          {/* ===== ACTIVO: Visor + Cerrar ===== */}
          {cameraActive && (
            <div
              className={`relative ${borderByType} rounded-2xl overflow-hidden shadow-[0_20px_80px_-30px_rgba(16,185,129,.35)]`}
              style={{ width: 360, height: 360 }}
            >
              {/* Cerrar cámara */}
              <button
                onClick={stopCamera}
                className="absolute right-3 top-3 z-20 px-3 py-1.5 rounded-lg text-sm bg-white/90 hover:bg-white border border-slate-200 shadow"
              >
                Cerrar cámara
              </button>

              {/* Visor */}
              <div
                id={readerId}
                className="relative w-[360px] h-[360px] bg-black"
              />

              {/* Esquinas */}
              {[
                "top-0 left-0",
                "top-0 right-0",
                "bottom-0 left-0",
                "bottom-0 right-0",
              ].map((pos, i) => (
                <span
                  key={i}
                  className={`pointer-events-none absolute ${pos} w-12 h-12 border-4 border-emerald-400/90 rounded-md
                    ${pos.includes("left") ? "border-r-0" : "border-l-0"}
                    ${pos.includes("top") ? "border-b-0" : "border-t-0"}`}
                />
              ))}

              {/* Estado */}
              <div className="pointer-events-none absolute inset-0 flex items-end justify-center p-3">
                <div
                  className={`px-3 py-2 rounded-lg text-white text-sm font-semibold ${badgeClasses} backdrop-blur shadow`}
                >
                  {status.text}
                </div>
              </div>
            </div>
          )}

          {/* Controles bajo visor */}
          {cameraActive && (
            <div className="mt-1 flex items-center gap-3">
              {showTorch && (
                <button
                  onClick={toggleTorch}
                  className="px-3 py-2 rounded-lg bg-white hover:bg-emerald-50 text-sm font-medium border border-emerald-300 shadow-sm"
                  title="Linterna (si el dispositivo lo soporta)"
                >
                  {torchOn ? "Apagar linterna" : "Encender linterna"}
                </button>
              )}
              <span className="text-xs text-emerald-900/60">
                Conexión segura requerida (https) salvo en{" "}
                <span className="font-mono">localhost</span>.
              </span>
            </div>
          )}

          {/* Fallback sin cámara */}
          {cameraError && !cameraActive && (
            <div className="w-full max-w-sm mx-auto bg-white/80 border border-emerald-200 rounded-xl p-4 backdrop-blur shadow">
              <div className="text-sm font-medium mb-2 text-emerald-900">
                Probar sin cámara
              </div>
              <div className="flex gap-2">
                <input
                  value={manualQR}
                  onChange={(e) => setManualQR(e.target.value)}
                  placeholder="Pega/teclea un código QR"
                  className="flex-1 rounded-lg border border-emerald-200 focus:border-emerald-400 outline-none px-3 py-2 text-sm bg-white"
                />
                <button
                  onClick={() => manualQR && handleCheck(manualQR)}
                  className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium shadow-sm"
                >
                  Probar
                </button>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => {
                    initializedRef.current = false;
                    handleOpen();
                  }}
                  className="px-3 py-2 rounded-lg border border-emerald-300 bg-white hover:bg-emerald-50 text-sm font-medium"
                >
                  Reintentar
                </button>
                <button
                  onClick={() => window.open("app-settings:", "_blank")}
                  className="px-3 py-2 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-900 text-sm font-medium border border-emerald-200"
                >
                  Ajustes de cámara
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="w-full max-w-5xl mx-auto px-6 pb-8 text-xs text-emerald-900/60">
        <div className="border-t border-emerald-200/60 pt-3">
          Acteco • Escáner de palets · Feedback visual en tiempo real
        </div>
      </footer>
    </div>
  );
}
