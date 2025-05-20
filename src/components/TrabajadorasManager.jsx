import React, { useEffect, useState } from "react";
import { authFetch } from "../authFetch.js";

const TrabajadorasManager = () => {
  const [trabajadoras, setTrabajadoras] = useState([]);
  const [nueva, setNueva] = useState("");

  const cargarTrabajadoras = async () => {
    try {
      const res = await authFetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/trabajadoras`
      );
      const data = await res.json();
      setTrabajadoras(data);
    } catch (err) {
      console.error("Error al cargar trabajadoras:", err);
    }
  };

  const agregarTrabajadora = async () => {
    if (!nueva.trim()) return;
    try {
      const res = await authFetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/trabajadoras`,
        {
          method: "POST",
          body: JSON.stringify({ nombre: nueva.trim() }),
        }
      );
      if (!res.ok) throw new Error("Error al agregar");
      setNueva("");
      cargarTrabajadoras();
    } catch (err) {
      console.error("Error al agregar trabajadora:", err);
    }
  };

  const eliminarTrabajadora = async (nombre) => {
    if (!confirm(`¿Eliminar a ${nombre}?`)) return;
    try {
      const res = await authFetch(
        `${
          import.meta.env.VITE_BACKEND_URL
        }/api/trabajadoras/${encodeURIComponent(nombre)}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Error al eliminar");
      cargarTrabajadoras();
    } catch (err) {
      console.error("Error al eliminar trabajadora:", err);
    }
  };

  useEffect(() => {
    cargarTrabajadoras();
  }, []);

  return (
    <div className="bg-white rounded-xl shadow p-6 mt-8 border">
      <h3 className="text-lg font-bold text-indigo-700 mb-4">
        👥 Gestión de Trabajadoras
      </h3>

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          placeholder="Nueva trabajadora"
          value={nueva}
          onChange={(e) => setNueva(e.target.value)}
          className="border px-3 py-2 rounded w-full"
        />
        <button
          onClick={agregarTrabajadora}
          className="bg-green-600 text-white px-4 rounded hover:bg-green-700 cursor-pointer"
        >
          Agregar
        </button>
      </div>

      <ul className="space-y-2 max-h-60 overflow-y-auto">
        {trabajadoras.map((nombre, i) => (
          <li
            key={i}
            className="flex justify-between items-center border-b pb-1"
          >
            <span>{nombre}</span>
            <button
              onClick={() => eliminarTrabajadora(nombre)}
              className="bg-red-500 hover:bg-red-600 text-white text-sm px-3 py-1 rounded-lg transition cursor-pointer"
            >
              Eliminar
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TrabajadorasManager;
