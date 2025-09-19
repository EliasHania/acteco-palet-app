import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { authFetch } from "../authFetch";

export default function AlmacenScan() {
  const readerId = "almacen-qr-reader";
  const qrRef = useRef(null);
  const mediaTrackRef = useRef(null);

  const initializedRef = useRef(false);
  const startedRef = useRef(false);

  const [torchOn, setTorchOn] = useState(false);
  const [cameraError, setCameraError] = useState(null); // {name, message} | null
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
    } catch (e) {
      console.error(e);
      setStatus({ text: "Error al comprobar", type: "error" });
    }
  };

  const startCamera = async () => {
    setCameraError(null);
    setStatus({ text: "Inicializando cámara…", type: "loading" });
    if (initializedRef.current) return;
    initializedRef.current = true;

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
      console.warn("No se pudo abrir la cámara", err);
      setCameraError({
        name: err?.name || "Error",
        message: err?.message || String(err),
      });
      setStatus({ text: "No se pudo abrir la cámara", type: "error" });
    }
  };

  useEffect(() => {
    startCamera();
    return () => {
      (async () => {
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
      })();
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
    } catch (e) {
      console.warn("Torch no soportado o no disponible", e);
    }
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
      className="
        min-h-screen relative overflow-hidden
        text-emerald-950
        flex flex-col items-center
      "
      // Fondo: degradado + grano + trama sutil
      style={{
        background:
          "radial-gradient(1200px 600px at 20% -10%, #d1fae5 0%, rgba(209,250,229,0) 60%), radial-gradient(1200px 600px at 120% 110%, #bbf7d0 0%, rgba(187,247,208,0) 60%), linear-gradient(180deg,#ecfdf5 0%, #e6f7ee 60%, #eafaf3 100%)",
      }}
    >
      {/* ruido sutil */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.08] mix-blend-multiply"
        style={{
          backgroundImage:
            "url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22><filter id=%22n%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%222%22 stitchTiles=%22stitch%22/></filter><rect width=%2240%22 height=%2240%22 filter=%22url(%23n)%22 opacity=%220.25%22/></svg>')",
        }}
      />

      {/* cabecera */}
      <header className="w-full max-w-5xl mx-auto px-6 pt-10 pb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-semibold tracking-tight">
            Escáner — <span className="text-emerald-700">Turno de Almacén</span>
          </h1>
          <span className="px-3 py-1 rounded-full text-sm bg-emerald-100 text-emerald-800 border border-emerald-200">
            Modo almacén
          </span>
        </div>
      </header>

      {/* contenedor visor */}
      <main className="w-full max-w-5xl mx-auto px-6 pb-10">
        <div className="mx-auto flex flex-col items-center gap-5">
          <div
            className={`relative ${borderByType} rounded-2xl overflow-hidden shadow-[0_20px_80px_-30px_rgba(16,185,129,.35)]`}
            style={{
              width: 360,
              height: 360,
              background:
                "linear-gradient(180deg,#ecfdf5 0%,#d1fae5 60%,#10b981 60%,#0f172a 60%)",
            }}
          >
            {/* capa glass */}
            <div className="absolute inset-0 backdrop-blur-[2px]" />
            {/* visor */}
            <div
              id={readerId}
              className="relative w-[360px] h-[360px] bg-black/50"
            />

            {/* esquinas neon */}
            {[
              "top-0 left-0",
              "top-0 right-0",
              "bottom-0 left-0",
              "bottom-0 right-0",
            ].map((pos, i) => (
              <span
                key={i}
                className={`pointer-events-none absolute ${pos} w-12 h-12 border-4 border-emerald-400/90 rounded-md animate-pulse
                  ${pos.includes("left") ? "border-r-0" : "border-l-0"}
                  ${pos.includes("top") ? "border-b-0" : "border-t-0"}`}
              />
            ))}

            {/* overlay estado */}
            <div className="pointer-events-none absolute inset-0 flex items-end justify-center p-3">
              <div
                className={`px-3 py-2 rounded-lg text-white text-sm font-semibold ${badgeClasses} backdrop-blur shadow`}
              >
                {status.text}
              </div>
            </div>

            {/* error cámara */}
            {cameraError && (
              <div className="absolute inset-0 bg-emerald-950/70 flex items-center justify-center p-4">
                <div className="bg-white/95 backdrop-blur rounded-xl shadow-2xl max-w-sm w-full p-4 text-center space-y-3 border border-emerald-200">
                  <div className="text-lg font-semibold text-rose-700">
                    No se pudo abrir la cámara
                  </div>
                  <p className="text-sm text-emerald-800/80">
                    {cameraError.name === "NotAllowedError"
                      ? "Permiso denegado por el navegador o política del sitio."
                      : cameraError.name === "NotFoundError"
                      ? "No se encontró ninguna cámara conectada."
                      : cameraError.message}
                  </p>

                  {/* input manual */}
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

                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={() => {
                        initializedRef.current = false;
                        startCamera();
                      }}
                      className="px-3 py-2 rounded-lg border border-emerald-300 bg-white hover:bg-emerald-50 text-sm font-medium"
                    >
                      Reintentar
                    </button>
                    <button
                      onClick={() =>
                        window.open(
                          "chrome://settings/content/camera",
                          "_blank"
                        )
                      }
                      className="px-3 py-2 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-900 text-sm font-medium border border-emerald-200"
                      title="Abrir ajustes del navegador"
                    >
                      Ajustes de cámara
                    </button>
                  </div>

                  <div className="text-[11px] text-emerald-900/70">
                    En escritorio sin cámara, usa el campo manual para validar
                    códigos.
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* controles bajo visor */}
          <div className="mt-1 flex items-center gap-3">
            {!!mediaTrackRef.current?.getCapabilities?.()?.torch ? (
              <button
                onClick={toggleTorch}
                className="px-3 py-2 rounded-lg bg-white hover:bg-emerald-50 text-sm font-medium border border-emerald-300 shadow-sm"
                title="Linterna (si el dispositivo lo soporta)"
              >
                {torchOn ? "Apagar linterna" : "Encender linterna"}
              </button>
            ) : (
              <button
                onClick={() => {
                  initializedRef.current = false;
                  startCamera();
                }}
                className="px-3 py-2 rounded-lg bg-white hover:bg-emerald-50 text-sm font-medium border border-emerald-300 shadow-sm"
              >
                Reintentar cámara
              </button>
            )}
            <span className="text-xs text-emerald-900/60">
              Conexión segura requerida (https) salvo en{" "}
              <span className="font-mono">localhost</span>.
            </span>
          </div>
        </div>
      </main>

      {/* pie minimal */}
      <footer className="w-full max-w-5xl mx-auto px-6 pb-8 text-xs text-emerald-900/60">
        <div className="border-t border-emerald-200/60 pt-3">
          Acteco • Escáner de palets · Feedback visual en tiempo real
        </div>
      </footer>
    </div>
  );
}
