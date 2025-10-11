import React, { useState, useEffect } from "react";
import QrScanner from "./QrScanner";
import { motion, AnimatePresence } from "framer-motion";
import { DateTime } from "luxon";

const PaletForm = ({
  setPalets,
  encargada,
  refrescarPalets, // espera una fecha 'YYYY-MM-DD' (día en Madrid)
  palets,
  fechaSeleccionada, // si lo usas externamente, no es imprescindible aquí
}) => {
  const [codigo, setCodigo] = useState("");
  const [trabajadora, setTrabajadora] = useState("");
  const [tipo, setTipo] = useState("");
  const [mostrarScanner, setMostrarScanner] = useState(false);
  const [scannerKey, setScannerKey] = useState(0);
  const [loading, setLoading] = useState(false);

  const [mostrarAlerta, setMostrarAlerta] = useState(false);
  const [mensajeError, setMensajeError] = useState("");

  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false);
  const [mensajeConfirmacion, setMensajeConfirmacion] = useState("");

  const [listaTrabajadoras, setListaTrabajadoras] = useState([]);

  // Autocierre de toasts
  useEffect(() => {
    if (mostrarAlerta || mostrarConfirmacion) {
      const t = setTimeout(() => {
        setMostrarAlerta(false);
        setMostrarConfirmacion(false);
      }, 3000);
      return () => clearTimeout(t);
    }
  }, [mostrarAlerta, mostrarConfirmacion]);

  // Carga de trabajadoras
  useEffect(() => {
    const cargarTrabajadoras = async () => {
      try {
        const token =
          localStorage.getItem("token") || sessionStorage.getItem("token");
        const res = await fetch(
          `${import.meta.env.VITE_BACKEND_URL}/api/trabajadoras`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        const data = await res.json();
        setListaTrabajadoras(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Error al cargar trabajadoras:", err);
      }
    };

    cargarTrabajadoras();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    // El servidor sellará el timestamp (y valida la ventana del día en Europe/Madrid)
    const nuevoPalet = {
      codigo,
      trabajadora,
      tipo,
      registradaPor: (encargada || "").trim().toLowerCase(), // 'yoana' | 'lidia'
    };

    try {
      const token =
        localStorage.getItem("token") || sessionStorage.getItem("token");

      const resPost = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/palets`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(nuevoPalet),
        }
      );

      if (resPost.status === 409) {
        // Duplicado en el día (según Europe/Madrid)
        setMensajeError("⚠️ Este código QR ya ha sido registrado hoy.");
        setMostrarAlerta(true);
        return;
      }

      if (!resPost.ok) {
        throw new Error("Error al guardar palet");
      }

      // Limpiar formulario
      setCodigo("");
      setTrabajadora("");
      setTipo("");

      // Refrescar listado de HOY en Madrid
      const hoyMadrid = DateTime.now().setZone("Europe/Madrid").toISODate(); // YYYY-MM-DD
      if (typeof refrescarPalets === "function") {
        await refrescarPalets(hoyMadrid);
      }

      setMensajeConfirmacion("✅ Palet guardado correctamente.");
      setMostrarConfirmacion(true);
    } catch (err) {
      console.error("Error:", err);
      setMensajeError("Error inesperado al guardar palet.");
      setMostrarAlerta(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.form
      onSubmit={handleSubmit}
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="bg-white shadow-md rounded-2xl p-6 space-y-4 border border-green-100 relative"
    >
      <h2 className="text-xl font-semibold text-green-600">
        Registrar nuevo palet
      </h2>

      <AnimatePresence>
        {mostrarAlerta && (
          <motion.div
            key="alerta"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-xl shadow-lg flex items-center gap-3 z-50"
          >
            <span>{mensajeError}</span>
            <button
              type="button"
              onClick={() => setMostrarAlerta(false)}
              className="text-white font-bold hover:text-gray-200 focus:outline-none cursor-pointer"
            >
              ✖
            </button>
          </motion.div>
        )}

        {mostrarConfirmacion && (
          <motion.div
            key="confirmacion"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-xl shadow-lg flex items-center gap-3 z-50"
          >
            <span>{mensajeConfirmacion}</span>
            <button
              type="button"
              onClick={() => setMostrarConfirmacion(false)}
              className="text-white font-bold hover:text-gray-200 focus:outline-none cursor-pointer"
            >
              ✖
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scanner QR */}
      {mostrarScanner && (
        <div className="col-span-full relative">
          <QrScanner
            key={scannerKey}
            onScan={(codigoEscaneado) => {
              setCodigo(codigoEscaneado);
              setMostrarScanner(false);
              setScannerKey((prev) => prev + 1);
            }}
            onClose={() => {
              setMostrarScanner(false);
              setScannerKey((prev) => prev + 1);
            }}
          />
          <button
            type="button"
            onClick={() => {
              setMostrarScanner(false);
              setScannerKey((prev) => prev + 1);
            }}
            className="absolute top-4 right-4 bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-xl text-sm shadow-md transition cursor-pointer"
          >
            Cerrar cámara
          </button>
        </div>
      )}
      {!mostrarScanner && (
        <div className="col-span-full">
          <button
            type="button"
            onClick={() => setMostrarScanner(true)}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl font-medium shadow transition duration-300 cursor-pointer"
          >
            📷 Escanear código QR
          </button>
        </div>
      )}

      {/* Campos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <input
          type="text"
          placeholder="Código QR"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          className="p-3 rounded-xl border border-green-300 focus:ring-2 focus:ring-green-400"
          required
        />

        <select
          value={trabajadora}
          onChange={(e) => setTrabajadora(e.target.value)}
          className="p-3 rounded-xl border border-green-300 focus:ring-2 focus:ring-green-400"
          required
        >
          <option value="">Selecciona trabajadora</option>
          {listaTrabajadoras.map((nombre, idx) => (
            <option key={idx} value={nombre}>
              {nombre}
            </option>
          ))}
        </select>

        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
          className="p-3 rounded-xl border border-green-300 focus:ring-2 focus:ring-green-400"
          required
        >
          <option value="">Selecciona tipo de palet</option>
          <option value="26x11">26x11</option>
          <option value="32x11">32x11</option>
          <option value="38x11">38x11</option>
          <option value="40x11">40x11</option>
          <option value="46x11">46x11</option>
          <option value="40x28">40x28</option>
          <option value="46x28">46x28</option>
        </select>
      </div>

      <button
        type="submit"
        disabled={loading || !codigo || !trabajadora || !tipo}
        className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-xl transition-all cursor-pointer"
      >
        {loading ? "Guardando..." : "Registrar palet"}
      </button>
    </motion.form>
  );
};

export default PaletForm;
