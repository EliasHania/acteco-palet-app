import React, { useEffect, useState } from "react";

const perchasPorCaja = {
  "40x28": 65,
  "40x11": 175,
  "46x28": 45,
  "46x11": 125,
  "38x11": 175,
  "32x11": 225,
  "26x11": 325,
};

const tiposDisponibles = Object.keys(perchasPorCaja);

const CajasForm = ({ encargada, refrescarCajas }) => {
  const [cantidad, setCantidad] = useState("");
  const [tipoSeleccionado, setTipoSeleccionado] = useState("");
  const [trabajadora, setTrabajadora] = useState("");
  const [listaTrabajadoras, setListaTrabajadoras] = useState([]);

  useEffect(() => {
    const cargarTrabajadoras = async () => {
      try {
        const token =
          localStorage.getItem("token") || sessionStorage.getItem("token");
        const res = await fetch(
          `${import.meta.env.VITE_BACKEND_URL}/api/trabajadoras`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await res.json();
        setListaTrabajadoras(data);
      } catch (err) {
        console.error("Error al cargar trabajadoras:", err);
      }
    };
    cargarTrabajadoras();
  }, []);

  const handleAddCaja = async () => {
    if (!cantidad || !tipoSeleccionado || !trabajadora) return;
    const nuevaCantidad = parseInt(cantidad, 10);
    if (isNaN(nuevaCantidad) || nuevaCantidad <= 0) return;

    try {
      const token =
        localStorage.getItem("token") || sessionStorage.getItem("token");
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/cajas`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tipo: tipoSeleccionado,
          cantidad: nuevaCantidad,
          trabajadora,
          registradaPor: (encargada || "").trim().toLowerCase(),
        }),
      });
      if (!res.ok) throw new Error("Error al guardar caja");
      // Opcional: const nueva = await res.json();
      setCantidad("");
      setTipoSeleccionado("");
      setTrabajadora("");
      // Refresca datos en el padre (mismo patrón que PaletTable)
      await refrescarCajas?.();
    } catch (err) {
      console.error("Error al guardar caja:", err);
    }
  };

  return (
    <div className="bg-white shadow-md rounded-2xl p-6 border border-green-100">
      <h2 className="text-xl font-semibold text-green-600 mb-4">
        Registrar nueva caja
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        <input
          type="number"
          placeholder="Cantidad"
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
          className="p-3 rounded-xl border border-green-300 focus:ring-2 focus:ring-green-400"
          required
        />

        <select
          value={tipoSeleccionado}
          onChange={(e) => setTipoSeleccionado(e.target.value)}
          className="p-3 rounded-xl border border-green-300 focus:ring-2 focus:ring-green-400"
          required
        >
          <option value="">Selecciona tipo de caja</option>
          {tiposDisponibles.map((tipo) => (
            <option key={tipo} value={tipo}>
              {tipo} ({perchasPorCaja[tipo]} perchas)
            </option>
          ))}
        </select>

        <select
          value={trabajadora}
          onChange={(e) => setTrabajadora(e.target.value)}
          className="p-3 rounded-xl border border-green-300 focus:ring-2 focus:ring-green-400"
          required
        >
          <option value="">Selecciona trabajadora</option>
          {listaTrabajadoras.map((nombre, i) => (
            <option key={i} value={nombre}>
              {nombre}
            </option>
          ))}
        </select>

        <button
          onClick={handleAddCaja}
          className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-xl transition-all cursor-pointer"
        >
          Registrar caja
        </button>
      </div>
    </div>
  );
};

export default CajasForm;
