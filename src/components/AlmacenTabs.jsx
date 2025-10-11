import { useEffect, useState } from "react";
import EscanerTurnoAlmacen from "./EscanerTurnoAlmacen";
import RegistroMovimiento from "./RegistroMovimiento";

export default function AlmacenTabs({ onLogout }) {
  const [tab, setTab] = useState(
    () => localStorage.getItem("almacenTab") || "scan"
  ); // "scan" | "movs"

  useEffect(() => {
    localStorage.setItem("almacenTab", tab);
  }, [tab]);

  return (
    <div className="min-h-screen bg-emerald-50 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Tabs */}
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setTab("scan")}
            className={`px-3 py-1.5 rounded-lg border transition ${
              tab === "scan"
                ? "bg-emerald-600 text-white border-emerald-700"
                : "bg-white text-emerald-800 border-emerald-200 hover:bg-emerald-50"
            }`}
          >
            Escanear palets
          </button>
          <button
            onClick={() => setTab("movs")}
            className={`px-3 py-1.5 rounded-lg border transition ${
              tab === "movs"
                ? "bg-emerald-600 text-white border-emerald-700"
                : "bg-white text-emerald-800 border-emerald-200 hover:bg-emerald-50"
            }`}
          >
            Movimientos (descarga/carga)
          </button>
        </div>

        {/* Contenido */}
        <div className="rounded-xl border border-emerald-200 bg-white overflow-hidden">
          {tab === "scan" ? (
            // El escáner ya incluye su propio header con botón de “Cerrar sesión”
            <EscanerTurnoAlmacen onLogout={onLogout} />
          ) : (
            <div className="p-4">
              {/* Pásale tus tipos reales si los tienes en un array desde arriba */}
              <RegistroMovimiento
                tiposPalet={[]}
                onSaved={() => {
                  /* opcional: refrescar algo */
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
