import React, { useEffect, useState } from "react";
import Login from "./components/Login";
import PaletForm from "./components/PaletForm";
import PaletTable from "./components/PaletTable";
import TrabajadorasManager from "./components/TrabajadorasManager";
import AdminDashboard from "./components/AdminDashboard";
import CajasForm from "./components/CajasForm";
import CajasTable from "./components/CajasTable";
import Navbar from "./components/Navbar";
import { io } from "socket.io-client";
import AlmacenScan from "./components/AlmacenScan";
import SupervisorMovimientos from "./components/SupervisorMovimientos"; // 👈 NUEVO

const socket = io(import.meta.env.VITE_BACKEND_URL);

function App() {
  const [encargada, setEncargada] = useState(() =>
    (localStorage.getItem("encargada") || "").trim().toLowerCase()
  );
  const [esAdmin, setEsAdmin] = useState(
    () => localStorage.getItem("esAdmin") === "true"
  );
  const [role, setRole] = useState(() => localStorage.getItem("role") || "");

  const [palets, setPalets] = useState([]);
  const [nuevosIds, setNuevosIds] = useState([]);
  const [fechaSeleccionada, setFechaSeleccionada] = useState(() =>
    new Date().toLocaleDateString("sv-SE")
  );
  const [vista, setVista] = useState("palets");

  // 👇 estado para cajas
  const [cajas, setCajas] = useState([]);

  // Decodificador seguro para base64url del JWT
  const b64urlToJson = (b64url) => {
    try {
      const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
      const pad = b64.length % 4 === 2 ? "==" : b64.length % 4 === 3 ? "=" : "";
      return JSON.parse(atob(b64 + pad));
    } catch {
      return {};
    }
  };

  const getRoleFromToken = () => {
    const t = localStorage.getItem("token");
    if (!t) return "";
    const parts = t.split(".");
    if (parts.length < 2) return "";
    const payload = b64urlToJson(parts[1]);
    return payload?.role || "";
  };

  const refrescarPalets = async (fecha = fechaSeleccionada) => {
    try {
      // si es almacen o manuel, no refrescamos listados aquí
      if (role === "almacen" || role === "manuel") return;

      const token = localStorage.getItem("token");
      const res = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/palets/fecha?fecha=${fecha}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!res.ok) throw new Error("No autorizado");

      const data = await res.json();

      const visibles = esAdmin
        ? data
        : data.filter((p) => {
            const limpiado = (p.registradaPor || "")
              .trim()
              .toLowerCase()
              .replace(/[^a-z]/gi, "");
            const encargadaLimpia = encargada
              .trim()
              .toLowerCase()
              .replace(/[^a-z]/gi, "");
            return limpiado === encargadaLimpia;
          });

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

  // 👇 refrescar cajas (mismo criterio de filtrado que palets)
  const refrescarCajas = async (fecha = fechaSeleccionada) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/cajas/fecha?fecha=${fecha}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!res.ok) throw new Error("No autorizado");

      const data = await res.json();

      const visibles = esAdmin
        ? data
        : data.filter((c) => {
            const limpiado = (c.registradaPor || "")
              .trim()
              .toLowerCase()
              .replace(/[^a-z]/gi, "");
            const encargadaLimpia = encargada
              .trim()
              .toLowerCase()
              .replace(/[^a-z]/gi, "");
            return limpiado === encargadaLimpia;
          });

      setCajas(visibles);
    } catch (error) {
      console.error("Error cargando cajas:", error);
    }
  };

  // Solo escucha socket y refresca si NO es rol almacen ni manuel (palets)
  useEffect(() => {
    if (encargada && role !== "almacen" && role !== "manuel") {
      const handleNuevoPalet = () => refrescarPalets(fechaSeleccionada);
      refrescarPalets(fechaSeleccionada);
      socket.on("nuevoPalet", handleNuevoPalet);
      return () => socket.off("nuevoPalet", handleNuevoPalet);
    }
  }, [encargada, fechaSeleccionada, role]);

  // 👇 refrescar cajas al entrar en "cajas"
  useEffect(() => {
    if (
      encargada &&
      role !== "almacen" &&
      role !== "manuel" &&
      vista === "cajas"
    ) {
      refrescarCajas(fechaSeleccionada);
    }
  }, [encargada, fechaSeleccionada, role, esAdmin, vista]);

  // Al montar, intenta leer el rol actual del token
  useEffect(() => {
    const r = getRoleFromToken();
    if (r) {
      setRole(r);
      localStorage.setItem("role", r);
    }
  }, []);

  const handleLogin = (nombre, isAdmin) => {
    const nombreLimpio = nombre.trim().toLowerCase();
    setEncargada(nombreLimpio);
    setEsAdmin(isAdmin);
    localStorage.setItem("encargada", nombreLimpio);
    localStorage.setItem("esAdmin", isAdmin);

    const r = getRoleFromToken();
    setRole(r);
    localStorage.setItem("role", r);

    refrescarPalets(fechaSeleccionada);
    refrescarCajas(fechaSeleccionada);
  };

  const handleLogout = () => {
    setEncargada("");
    setEsAdmin(false);
    setRole("");
    setPalets([]);
    setCajas([]);
    localStorage.removeItem("encargada");
    localStorage.removeItem("esAdmin");
    localStorage.removeItem("token");
    localStorage.removeItem("role");
  };

  if (!encargada) return <Login onLogin={handleLogin} />;

  // Vista exclusiva para el rol "almacen"
  if (role === "almacen") {
    return <AlmacenScan onLogout={handleLogout} />;
  }

  // Vista exclusiva para el rol "manuel" (Supervisor)
  if (role === "manuel") {
    return <SupervisorMovimientos onLogout={handleLogout} />;
  }

  // Admin
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

  // Vista encargada (palets/cajas)
  return (
    <div className="min-h-screen bg-gray-100 text-gray-800 p-4">
      <Navbar
        encargada={encargada}
        vista={vista}
        setVista={(v) => {
          setVista(v);
          if (v === "cajas") refrescarCajas(fechaSeleccionada);
        }}
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

        {vista === "cajas" && (
          <>
            <CajasForm encargada={encargada} refrescarCajas={refrescarCajas} />
            <CajasTable
              encargada={encargada}
              cajas={cajas}
              setCajas={setCajas}
              refrescarCajas={refrescarCajas}
            />
          </>
        )}

        {vista === "trabajadoras" && <TrabajadorasManager />}
      </main>
    </div>
  );
}

export default App;
