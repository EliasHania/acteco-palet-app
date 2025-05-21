import React from "react";

const Navbar = ({ encargada, vista, setVista, onLogout }) => {
  const nombre = encargada.charAt(0).toUpperCase() + encargada.slice(1);

  const botonBase =
    "px-4 py-2 rounded-xl font-medium transition cursor-pointer";
  const activo = "bg-white text-green-800 shadow font-bold";
  const inactivo = "bg-green-700 text-white hover:bg-green-600";

  return (
    <nav className="bg-green-800 text-white px-6 py-3 rounded-xl shadow mb-6 flex flex-col md:flex-row justify-between items-center gap-4 md:gap-0">
      <span className="font-semibold text-lg">Turno de {nombre}</span>

      <div className="flex gap-3 items-center">
        <button
          onClick={() => setVista("palets")}
          className={`${botonBase} ${vista === "palets" ? activo : inactivo}`}
        >
          📦 Palets
        </button>
        <button
          onClick={() => setVista("trabajadoras")}
          className={`${botonBase} ${
            vista === "trabajadoras" ? activo : inactivo
          }`}
        >
          👥 Trabajadoras
        </button>
        <button
          onClick={() => setVista("cajas")}
          className={`${botonBase} ${vista === "cajas" ? activo : inactivo}`}
        >
          📦 Cajas
        </button>
        <button
          onClick={onLogout}
          className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-xl font-medium transition cursor-pointer"
        >
          Cerrar Sesión
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
