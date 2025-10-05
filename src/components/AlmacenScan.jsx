import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import RegistroMovimiento from "./RegistroMovimiento";

const TIPOS_PALET = [
  "46x28",
  "40x28",
  "46x11",
  "40x11",
  "38x11",
  "32x11",
  "26x11",
];

export default function AlmacenScan({ onLogout }) {
  const readerId = "almacen-qr-reader";

  // Refs de cámara / QR
  const qrRef = useRef(null);
  const mediaTrackRef = useRef(null);
  const initializedRef = useRef(false);
  const startedRef = useRef(false);
  const wantStartRef = useRef(false);

  // Estado de escáner
  const [cameraActive, setCameraActive] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [status, setStatus] = useState({
    text: "Apunta al código…",
    type: "idle",
  });
  const lastCodeRef = useRef({ code: "", ts: 0 });
  const [manualQR, setManualQR] = useState("");

  // Refs para el fondo radial y el “ancla” visual (DECLARAR SOLO UNA VEZ)
  const pageRef = useRef(null);
  const anchorRef = useRef(null);

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
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qr: decodedText }),
      });
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
    setTimeout(
      () => setStatus({ text: "Apunta al código…", type: "idle" }),
      1000
    );
  };

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
      const track = stream?.getVideoTracks?.()[0];
      mediaTrackRef.current = track || null;

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

  useEffect(
    () => () => {
      stopCamera();
    },
    []
  );

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

  const borderByType =
    status.type === "ok"
      ? "ring-4 ring-green-500"
      : status.type === "warn"
      ? "ring-4 ring-amber-500"
      : status.type === "error"
      ? "ring-4 ring-rose-500"
      : status.type === "loading"
      ? "ring-4 ring-green-400"
      : "ring-2 ring-green-300";

  const badgeClasses =
    status.type === "ok"
      ? "bg-green-600/90"
      : status.type === "warn"
      ? "bg-amber-600/90"
      : status.type === "error"
      ? "bg-rose-600/90"
      : status.type === "loading"
      ? "bg-green-700/90"
      : "bg-green-800/80";

  const showTorch = !!mediaTrackRef.current?.getCapabilities?.()?.torch;

  return (
    <div
      ref={pageRef}
      className="min-h-screen relative overflow-hidden text-emerald-50 flex flex-col"
      style={{
        background: `
          radial-gradient(circle at var(--cx,50%) var(--cy,40%), rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.10) 35%, rgba(255,255,255,0.02) 65%, transparent 75%),
          radial-gradient(circle at var(--cx,50%) var(--cy,40%), rgba(16,185,129,0.45) 0%, rgba(16,185,129,0.28) 30%, rgba(16,185,129,0.12) 55%, transparent 70%),
          linear-gradient(180deg, rgba(5,150,105,0.98) 0%, rgba(22,163,74,0.94) 35%, rgba(34,197,94,0.90) 75%, rgba(240,253,244,0.88) 100%)
        `,
      }}
    >
      {/* HEADER */}
      <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 pt-6">
        <div className="rounded-2xl border border-white/20 bg-white/15 backdrop-blur-md shadow-lg px-5 sm:px-7 py-4 flex items-center justify-between">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
            <span className="mr-1 opacity-90">Escáner —</span>
            <span className="text-lime-200">Turno de Almacén</span>
          </h1>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-sm bg-white/20 text-white border border-white/25">
              Modo almacén
            </span>
            <button
              onClick={onLogout}
              className="px-3 py-1 rounded-full text-sm font-medium bg-rose-700/60 text-white border border-rose-400/40 backdrop-blur-sm hover:bg-rose-700/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300/60 transition-colors shadow-sm"
            >
              <span className="mr-1">🔒</span> Cerrar sesión
            </button>
          </div>
        </div>
      </div>

      {/* FORMULARIO componetizado */}
      <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 mt-6">
        <RegistroMovimiento tiposPalet={TIPOS_PALET} />
      </div>

      {/* ESCÁNER */}
      <main className="w-full max-w-3xl mx-auto px-4 sm:px-6 pb-12 grow grid place-items-center">
        <div className="w-full flex flex-col items-center">
          {!cameraActive && !cameraError && (
            <div ref={anchorRef} className="flex flex-col items-center gap-5">
              <div className="relative">
                <span className="absolute inset-0 rounded-full animate-ping bg-white/30"></span>
                <button
                  onClick={handleOpen}
                  className="relative w-28 h-28 rounded-full bg-white text-green-600 shadow-2xl active:scale-95 transition flex items-center justify-center"
                  aria-label="Abrir cámara"
                  style={{ boxShadow: "0 18px 40px rgba(255,255,255,.20)" }}
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
              <div className="text-[15px] text-white/90 font-medium">
                Toca para abrir la cámara
              </div>
            </div>
          )}

          {cameraActive && (
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
                    className={`pointer-events-none absolute ${pos} w-12 h-12 border-4 border-white rounded-md
                    ${pos.includes("left") ? "border-r-0" : "border-l-0"}
                    ${pos.includes("top") ? "border-b-0" : "border-t-0"}`}
                  />
                ))}

                <div className="pointer-events-none absolute inset-0 flex items/end justify-center p-3">
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
          )}

          {cameraActive && (
            <div className="mt-4 flex items-center justify-center gap-3">
              {showTorch && (
                <button
                  onClick={toggleTorch}
                  className="px-3 py-2 rounded-lg bg-white text-green-700 hover:bg-green-50 text-sm font-medium border border-green-200 shadow-sm"
                >
                  {torchOn ? "Apagar linterna" : "Encender linterna"}
                </button>
              )}
              <span className="text-xs text-white/85">
                Conexión segura requerida (https) salvo en{" "}
                <span className="font-mono">localhost</span>.
              </span>
            </div>
          )}

          {cameraError && !cameraActive && (
            <div className="w-full max-w-md mt-8 mx-auto bg-white/90 border border-white/30 rounded-xl p-4 backdrop-blur shadow">
              <div className="text-sm font-medium mb-2 text-green-800">
                Probar sin cámara
              </div>
              <div className="flex gap-2">
                <input
                  value={manualQR}
                  onChange={(e) => setManualQR(e.target.value)}
                  placeholder="Pega/teclea un código QR"
                  className="flex-1 rounded-lg border border-green-200 focus:border-green-400 outline-none px-3 py-2 text-sm bg-white text-green-900"
                />
                <button
                  onClick={() => manualQR && handleCheck(manualQR)}
                  className="px-3 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium shadow-sm"
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
                  className="px-3 py-2 rounded-lg border border-green-200 bg-white hover:bg-green-50 text-sm font-medium text-green-800"
                >
                  Reintentar
                </button>
                <button
                  onClick={() => window.open("app-settings:", "_blank")}
                  className="px-3 py-2 rounded-lg bg-green-50 hover:bg-green-100 text-green-900 text-sm font-medium border border-green-200"
                >
                  Ajustes de cámara
                </button>
              </div>
            </div>
          )}

          <div className="w-full mt-10 border-t border-white/25" />
          <div className="pt-3 text-xs text-white/90 text-center">
            Acteco • Escáner de palets · Feedback visual en tiempo real
          </div>
        </div>
      </main>
    </div>
  );
}
