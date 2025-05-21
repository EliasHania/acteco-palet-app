import React, { useEffect, useState } from "react";
import Login from "./components/Login";
import PaletForm from "./components/PaletForm";
import PaletTable from "./components/PaletTable";
import TrabajadorasManager from "./components/TrabajadorasManager";
import AdminDashboard from "./components/AdminDashboard";
import Navbar from "./components/Navbar";
import { io } from "socket.io-client";

const socket = io(import.meta.env.VITE_BACKEND_URL);

function App() {
  const [encargada, setEncargada] = useState(() =>
    (localStorage.getItem("encargada") || "").trim().toLowerCase()
  );
  const [esAdmin, setEsAdmin] = useState(
    () => localStorage.getItem("esAdmin") === "true"
  );
  const [palets, setPalets] = useState([]);
  const [nuevosIds, setNuevosIds] = useState([]);
  const [fechaSeleccionada, setFechaSeleccionada] = useState(() =>
    new Date().toLocaleDateString("sv-SE")
  );

  const [vista, setVista] = useState("palets");

  const refrescarPalets = async (fecha = fechaSeleccionada) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/palets/fecha?fecha=${fecha}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!res.ok) throw new Error("No autorizado");

      const data = await res.json();
      console.log("🟢 Datos recibidos de la API:", data);

      const filtrados = data;
      console.log("🔵 Palets filtrados por fecha:", filtrados);

      if (!esAdmin) {
        console.log("👀 Comparando registros:");
        data.forEach((p) => {
          console.log(
            "↪️",
            p.registradaPor?.trim().toLowerCase(),
            "==?",
            encargada
          );
        });
      }

      const visibles = esAdmin
        ? data
        : data.filter(
            (p) =>
              typeof p.registradaPor === "string" &&
              p.registradaPor.trim().toLowerCase() === encargada
          );

      console.log("🟠 Palets visibles para", encargada, ":", visibles);

      const nuevos = visibles.filter(
        (p) => !palets.some((x) => x._id === p._id)
      );
      setNuevosIds(nuevos.map((p) => p._id));
      setPalets(visibles);

      if (nuevos.length > 0) setTimeout(() => setNuevosIds([]), 5000);
    } catch (error) {
      console.error("Error cargando palets:", error);
    }
  };

  useEffect(() => {
    if (encargada) {
      const handleNuevoPalet = () => refrescarPalets(fechaSeleccionada);

      refrescarPalets(fechaSeleccionada);
      socket.on("nuevoPalet", handleNuevoPalet);
      return () => socket.off("nuevoPalet", handleNuevoPalet);
    }
  }, [encargada, fechaSeleccionada]);

  const handleLogin = (nombre, isAdmin) => {
    const nombreLimpio = nombre.trim().toLowerCase();
    setEncargada(nombreLimpio);
    setEsAdmin(isAdmin);
    console.log("🔐 Encargada establecida:", nombreLimpio);
    localStorage.setItem("encargada", nombreLimpio);
    localStorage.setItem("esAdmin", isAdmin);
    refrescarPalets(fechaSeleccionada);
  };

  const handleLogout = () => {
    setEncargada("");
    setEsAdmin(false);
    setPalets([]);
    localStorage.removeItem("encargada");
    localStorage.removeItem("esAdmin");
    localStorage.removeItem("token");
  };

  if (!encargada) return <Login onLogin={handleLogin} />;

  if (esAdmin) {
    return (
      <AdminDashboard
        palets={palets}
        refrescarPalets={refrescarPalets}
        nuevosIds={nuevosIds}
        onLogout={handleLogout}
        fechaSeleccionada={fechaSeleccionada}
        setFechaSeleccionada={setFechaSeleccionada}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 text-gray-800 p-4">
      <Navbar
        encargada={encargada}
        vista={vista}
        setVista={setVista}
        onLogout={handleLogout}
      />

      <main className="max-w-4xl mx-auto space-y-6">
        {vista === "palets" && (
          <>
            <PaletForm
              setPalets={setPalets}
              encargada={encargada}
              refrescarPalets={refrescarPalets}
              palets={palets}
              fechaSeleccionada={fechaSeleccionada}
            />
            <PaletTable
              palets={palets}
              encargada={encargada}
              setPalets={setPalets}
              refrescarPalets={refrescarPalets}
              nuevosIds={nuevosIds}
            />
          </>
        )}
        {vista === "trabajadoras" && <TrabajadorasManager />}
      </main>
    </div>
  );
}

export default App;
