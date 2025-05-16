import React, { useEffect, useState } from "react";
import Login from "./components/Login";
import PaletForm from "./components/PaletForm";
import PaletTable from "./components/PaletTable";
import AdminDashboard from "./components/AdminDashboard";
import { io } from "socket.io-client";

// 🔧 Usar backend dinámico
const socket = io(import.meta.env.VITE_BACKEND_URL);

function App() {
  const [encargada, setEncargada] = useState(
    () => localStorage.getItem("encargada") || ""
  );
  const [esAdmin, setEsAdmin] = useState(
    () => localStorage.getItem("esAdmin") === "true"
  );
  const [palets, setPalets] = useState([]);
  const [nuevosIds, setNuevosIds] = useState([]);
  const [fechaSeleccionada, setFechaSeleccionada] = useState(() =>
    new Date().toLocaleDateString("sv-SE")
  );

  const refrescarPalets = async (fecha = fechaSeleccionada) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/palets`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!res.ok) throw new Error("No autorizado");

      const data = await res.json();

      const normalizar = (f) => {
        const d = new Date(f);
        d.setHours(0, 0, 0, 0);
        return d.getTime();
      };

      const filtrados = data.filter(
        (p) => normalizar(p.timestamp) === normalizar(fecha)
      );

      let visibles = [];
      if (encargada === "yoana") {
        visibles = filtrados.filter(
          (p) => parseInt(p.trabajadora?.split(" ")[1]) <= 20
        );
      } else if (encargada === "lidia") {
        visibles = filtrados.filter(
          (p) => parseInt(p.trabajadora?.split(" ")[1]) >= 21
        );
      } else {
        visibles = filtrados;
      }

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
      const handleNuevoPalet = () =>
        refrescarPalets(new Date().toISOString().split("T")[0]);

      refrescarPalets();
      socket.on("nuevoPalet", handleNuevoPalet);
      return () => socket.off("nuevoPalet", handleNuevoPalet);
    }
  }, [encargada, fechaSeleccionada]);

  const handleLogin = (nombre, isAdmin) => {
    setEncargada(nombre);
    setEsAdmin(isAdmin);
    localStorage.setItem("encargada", nombre);
    localStorage.setItem("esAdmin", isAdmin);
    refrescarPalets();
  };

  const handleLogout = () => {
    setEncargada("");
    setEsAdmin(false);
    setPalets([]);
    localStorage.removeItem("encargada");
    localStorage.removeItem("esAdmin");
    localStorage.removeItem("token");
  };

  const handleEliminarTodos = async () => {
    if (!window.confirm("¿Seguro que deseas eliminar los palets?")) return;
    try {
      const token = localStorage.getItem("token");
      if (esAdmin) {
        await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/palets/all`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
      } else {
        const inicio = encargada === "yoana" ? 1 : 21;
        const fin = encargada === "yoana" ? 20 : 40;
        const trabajadoras = Array.from(
          { length: fin - inicio + 1 },
          (_, i) => `Trabajadora ${i + inicio}`
        );
        await Promise.all(
          trabajadoras.map((nombre) =>
            fetch(
              `${
                import.meta.env.VITE_BACKEND_URL
              }/api/palets/trabajadora/${encodeURIComponent(nombre)}`,
              {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
              }
            )
          )
        );
      }
      refrescarPalets();
      alert("Palets eliminados correctamente.");
    } catch (error) {
      console.error("Error al eliminar palets:", error);
    }
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
      <header className="text-center text-3xl font-bold mb-8 text-green-700">
        Web Acteco – Registro de Palets
      </header>
      <div className="text-right mb-4">
        <span className="mr-4">
          Turno de {encargada.charAt(0).toUpperCase() + encargada.slice(1)}
        </span>
        <button
          onClick={handleLogout}
          className="bg-red-500 text-white px-4 py-1 rounded-md hover:bg-red-600"
        >
          Cerrar Sesión
        </button>
      </div>
      <main className="max-w-4xl mx-auto space-y-6">
        <PaletForm
          setPalets={setPalets}
          encargada={encargada}
          refrescarPalets={refrescarPalets}
          palets={palets}
        />
        <PaletTable
          palets={palets}
          encargada={encargada}
          setPalets={setPalets}
          refrescarPalets={refrescarPalets}
          nuevosIds={nuevosIds}
        />
      </main>
    </div>
  );
}

export default App;
