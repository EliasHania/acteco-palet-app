import { useMemo, useState } from "react";
import { authFetch } from "../authFetch";

const hoyISO = () => new Date().toISOString().slice(0, 10);
const ahoraHM = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes()
  ).padStart(2, "0")}`;
};

export default function RegistroMovimiento({ tiposPalet = [], onSaved }) {
  // modo: "descarga" | "carga" | "carga-mixta"
  const [modo, setModo] = useState("descarga");

  // wizard step (1 = crear; 2 = completar)
  const [paso, setPaso] = useState(1);
  const [recordId, setRecordId] = useState(null);

  const [msg, setMsg] = useState(null); // {tipo:"ok"|"err", texto:string}
  const [guardando, setGuardando] = useState(false);

  // -------- Descarga
  const [fechaDesc, setFechaDesc] = useState(hoyISO());
  const [horaDesc, setHoraDesc] = useState(ahoraHM()); // llegada
  const [contenedor, setContenedor] = useState("");
  const [origen, setOrigen] = useState("");
  const [precinto, setPrecinto] = useState("");
  const [remolqueDesc, setRemolqueDesc] = useState(""); // opcional
  const [responsablesDesc, setResponsablesDesc] = useState("");
  // Paso 2 descarga
  const [paletsDentro, setPaletsDentro] = useState("");
  const [cajasDentro, setCajasDentro] = useState("");
  const [horaSalidaDesc, setHoraSalidaDesc] = useState("");

  // -------- Carga simple
  const [fechaCarga, setFechaCarga] = useState(hoyISO());
  const [empresa, setEmpresa] = useState("");
  const [tipoPalet, setTipoPalet] = useState("");
  const [numPalets, setNumPalets] = useState("");
  const [horaLlegada, setHoraLlegada] = useState(ahoraHM());
  const [horaSalida, setHoraSalida] = useState(""); // solo se completa en paso 2
  const [responsablesCarga, setResponsablesCarga] = useState("");
  // Opcionales/obligatorios según reglas
  const [contenedorCarga, setContenedorCarga] = useState(""); // opcional
  const [precintoCarga, setPrecintoCarga] = useState(""); // ✅ REQUERIDO
  const [tractoraCarga, setTractoraCarga] = useState(""); // opcional
  const [remolqueCarga, setRemolqueCarga] = useState(""); // ✅ REQUERIDO

  // -------- Carga mixta
  const [lineasMixtas, setLineasMixtas] = useState([
    { tipo: "", cantidad: "" },
  ]);
  const totalMixto = lineasMixtas.reduce(
    (a, l) => a + (parseInt(l.cantidad, 10) || 0),
    0
  );
  const setLineaMixta = (i, patch) =>
    setLineasMixtas((prev) =>
      prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l))
    );
  const addLineaMixta = () =>
    setLineasMixtas((prev) => [...prev, { tipo: "", cantidad: "" }]);
  const removeLineaMixta = (i) =>
    setLineasMixtas((prev) => prev.filter((_, idx) => idx !== i));

  // Opcionales/obligatorios mixta
  const [contenedorMixta, setContenedorMixta] = useState(""); // opcional
  const [precintoMixta, setPrecintoMixta] = useState(""); // ✅ REQUERIDO
  const [tractoraMixta, setTractoraMixta] = useState(""); // opcional
  const [remolqueMixta, setRemolqueMixta] = useState(""); // ✅ REQUERIDO
  const [horaSalidaMixta, setHoraSalidaMixta] = useState("");

  // -------- VALIDACIONES (dependen de paso + modo)
  const validoPaso1 = useMemo(() => {
    if (modo === "descarga") {
      // ✅ TODOS obligatorios en paso 1
      if (!fechaDesc || !horaDesc) return false;
      if (!contenedor.trim() || !origen.trim() || !precinto.trim())
        return false;
      if (!responsablesDesc.trim()) return false;
      return true;
    }
    if (modo === "carga") {
      // ✅ Opcionales solo: tractora y nº contenedor. Resto obligatorios (incluye remolque y nº precinto)
      if (
        !fechaCarga ||
        !empresa.trim() ||
        !tipoPalet.trim() ||
        !horaLlegada ||
        !precintoCarga.trim() ||
        !remolqueCarga.trim() ||
        !responsablesCarga.trim()
      )
        return false;
      const n = parseInt(numPalets, 10);
      return Number.isFinite(n) && n > 0;
    }
    // carga-mixta
    if (
      !fechaCarga ||
      !empresa.trim() ||
      !horaLlegada ||
      !precintoMixta.trim() || // ✅ requerido
      !remolqueMixta.trim() || // ✅ requerido
      !responsablesCarga.trim()
    )
      return false;
    if (lineasMixtas.length === 0) return false;
    let suma = 0;
    for (const l of lineasMixtas) {
      const n = parseInt(l.cantidad, 10);
      if (!l.tipo || !Number.isFinite(n) || n <= 0) return false;
      suma += n;
    }
    return suma > 0;
  }, [
    modo,
    // descarga
    fechaDesc,
    horaDesc,
    contenedor,
    origen,
    precinto,
    responsablesDesc,
    // carga simple
    fechaCarga,
    empresa,
    tipoPalet,
    numPalets,
    horaLlegada,
    precintoCarga,
    remolqueCarga,
    responsablesCarga,
    // mixta
    lineasMixtas,
    precintoMixta,
    remolqueMixta,
  ]);

  const validoPaso2 = useMemo(() => {
    if (modo === "descarga") {
      // ✅ TODOS obligatorios en paso 2
      const pal = parseInt(paletsDentro, 10);
      const caj = parseInt(cajasDentro, 10);
      if (!Number.isFinite(pal) || pal < 0) return false;
      if (!Number.isFinite(caj) || caj < 0) return false;
      if (!horaSalidaDesc) return false;
      return true;
    }
    if (modo === "carga") {
      // ✅ obligatorio solo salida
      return !!horaSalida;
    }
    // mixta
    return !!horaSalidaMixta;
  }, [
    modo,
    paletsDentro,
    cajasDentro,
    horaSalidaDesc,
    horaSalida,
    horaSalidaMixta,
  ]);

  // -------- Guardar paso 1: CREA el movimiento (POST)
  const guardarPaso1 = async () => {
    if (!validoPaso1) {
      // Mensaje más específico por modo
      const detalle =
        modo === "descarga"
          ? "Faltan: fecha, hora llegada, nº contenedor, origen, nº precinto y/o responsables."
          : modo === "carga"
          ? "Faltan: fecha, empresa, tipo palet, nº palets, hora llegada, nº precinto, remolque y/o responsables."
          : "Faltan: fecha, empresa, hora llegada, nº precinto, remolque, responsables y/o líneas válidas.";
      setMsg({ tipo: "err", texto: detalle });
      return;
    }
    setGuardando(true);
    setMsg(null);
    try {
      let payload;

      if (modo === "descarga") {
        // ✅ el backend espera "timestamp" (no timestampLlegada) y puede recibir "remolque" opcional
        const llegadaISO = new Date(
          `${fechaDesc}T${horaDesc}:00`
        ).toISOString();
        payload = {
          tipo: "descarga",
          numeroContenedor: contenedor.trim(),
          origen: origen.trim(),
          numeroPrecinto: precinto.trim(),
          remolque: remolqueDesc.trim() || undefined, // opcional
          personal: responsablesDesc.trim(),
          timestamp: llegadaISO, // ✅ nombre correcto
          registradaPor: "almacen",
          fecha: fechaDesc, // ✅ para índice por día
        };
      } else if (modo === "carga") {
        const llegadaISO = new Date(
          `${fechaCarga}T${horaLlegada}:00`
        ).toISOString();
        payload = {
          tipo: "carga",
          empresaTransportista: empresa.trim(),
          tipoPalet: tipoPalet.trim(),
          numeroPalets: parseInt(numPalets, 10),
          timestampLlegada: llegadaISO,
          personal: responsablesCarga.trim(),
          registradaPor: "almacen",
          fecha: fechaCarga,
          numeroContenedor: contenedorCarga.trim() || undefined, // opcional
          numeroPrecinto: precintoCarga.trim(), // ✅ requerido
          tractora: tractoraCarga.trim() || undefined, // opcional
          remolque: remolqueCarga.trim(), // ✅ requerido
          // horaSalida: se completa en paso 2
        };
      } else {
        // carga-mixta
        const llegadaISO = new Date(
          `${fechaCarga}T${horaLlegada}:00`
        ).toISOString();
        payload = {
          tipo: "carga-mixta",
          empresaTransportista: empresa.trim(),
          items: lineasMixtas.map((l) => ({
            tipoPalet: l.tipo,
            numeroPalets: parseInt(l.cantidad, 10),
          })),
          totalPalets: totalMixto,
          timestampLlegada: llegadaISO,
          personal: responsablesCarga.trim(),
          registradaPor: "almacen",
          fecha: fechaCarga,
          numeroContenedor: contenedorMixta.trim() || undefined, // opcional
          numeroPrecinto: precintoMixta.trim(), // ✅ requerido
          tractora: tractoraMixta.trim() || undefined, // opcional
          remolque: remolqueMixta.trim(), // ✅ requerido
          // horaSalida: se completa en paso 2
        };
      }

      const res = await authFetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/almacen/movimientos`,
        { method: "POST", body: JSON.stringify(payload) }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.msg || "No se pudo guardar (paso 1)");

      // Devuelve el objeto creado con _id
      const id = data?._id || data?.id;
      if (!id) throw new Error("El servidor no devolvió el ID del registro");

      setRecordId(id);
      setMsg({
        tipo: "ok",
        texto: "✅ Paso 1 guardado. Ahora completa el paso 2.",
      });
      setPaso(2);

      onSaved?.(); // para que Manuel lo vea al instante
    } catch (e) {
      setMsg({ tipo: "err", texto: e.message || "Error inesperado" });
    } finally {
      setGuardando(false);
      setTimeout(() => setMsg(null), 3500);
    }
  };

  // -------- Guardar paso 2: COMPLETA el movimiento (PATCH)
  const guardarPaso2 = async () => {
    if (!recordId) {
      setMsg({
        tipo: "err",
        texto: "No hay registro en curso. Repite el paso 1.",
      });
      return;
    }
    if (!validoPaso2) {
      const detalle =
        modo === "descarga"
          ? "Faltan: nº palets, nº cajas y/o hora de salida."
          : "Falta la hora de salida.";
      setMsg({ tipo: "err", texto: detalle });
      return;
    }
    setGuardando(true);
    setMsg(null);
    try {
      let patch = {};
      let url = "";

      if (modo === "descarga") {
        patch = {
          palets: parseInt(paletsDentro, 10),
          numeroCajas: parseInt(cajasDentro, 10),
          timestampSalida: new Date(
            `${fechaDesc}T${horaSalidaDesc}:00`
          ).toISOString(),
        };
        // ✅ endpoint específico de descarga
        url = `${
          import.meta.env.VITE_BACKEND_URL
        }/api/almacen/movimientos/${recordId}/descarga-final`;
      } else if (modo === "carga") {
        patch = {
          timestampSalida: new Date(
            `${fechaCarga}T${horaSalida}:00`
          ).toISOString(),
        };
        // ✅ endpoint específico de cargas
        url = `${
          import.meta.env.VITE_BACKEND_URL
        }/api/almacen/movimientos/${recordId}/cerrar-carga`;
      } else {
        patch = {
          timestampSalida: new Date(
            `${fechaCarga}T${horaSalidaMixta}:00`
          ).toISOString(),
        };
        // ✅ endpoint específico de cargas
        url = `${
          import.meta.env.VITE_BACKEND_URL
        }/api/almacen/movimientos/${recordId}/cerrar-carga`;
      }

      const res = await authFetch(url, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data?.msg || "No se pudo completar (paso 2)");

      setMsg({ tipo: "ok", texto: "✔️ Movimiento completado." });

      // Reset total para iniciar un nuevo registro
      resetTodo();
      onSaved?.();
    } catch (e) {
      setMsg({ tipo: "err", texto: e.message || "Error inesperado" });
    } finally {
      setGuardando(false);
      setTimeout(() => setMsg(null), 3500);
    }
  };

  const resetTodo = () => {
    setPaso(1);
    setRecordId(null);
    setMsg(null);

    // descarga
    setFechaDesc(hoyISO());
    setHoraDesc(ahoraHM());
    setContenedor("");
    setOrigen("");
    setPrecinto("");
    setRemolqueDesc("");
    setResponsablesDesc("");
    setPaletsDentro("");
    setCajasDentro("");
    setHoraSalidaDesc("");

    // carga
    setFechaCarga(hoyISO());
    setEmpresa("");
    setTipoPalet("");
    setNumPalets("");
    setHoraLlegada(ahoraHM());
    setHoraSalida("");
    setResponsablesCarga("");
    setContenedorCarga("");
    setPrecintoCarga("");
    setTractoraCarga("");
    setRemolqueCarga("");

    // mixta
    setLineasMixtas([{ tipo: "", cantidad: "" }]);
    setContenedorMixta("");
    setPrecintoMixta("");
    setTractoraMixta("");
    setRemolqueMixta("");
    setHoraSalidaMixta("");
  };

  return (
    <div className="rounded-2xl bg-white/95 text-emerald-900 border border-emerald-200 shadow p-5">
      <div className="flex items-center gap-3 mb-3">
        <h2 className="text-xl font-semibold">🚚 Registrar movimiento</h2>
        <select
          value={modo}
          onChange={(e) => {
            setModo(e.target.value);
            setPaso(1);
            setRecordId(null);
            setMsg(null);
          }}
          className="ml-auto border border-emerald-300 rounded-lg px-3 py-1.5 text-sm"
        >
          <option value="descarga">Descarga</option>
          <option value="carga">Carga</option>
          <option value="carga-mixta">Carga mixta</option>
        </select>
      </div>

      <div className="mb-4 text-sm text-emerald-700">
        <span className="font-semibold">Paso:</span> {paso} / 2
      </div>

      {msg && (
        <div
          className={`mb-3 px-3 py-2 rounded-lg text-white text-sm ${
            msg.tipo === "ok" ? "bg-green-600" : "bg-rose-600"
          }`}
        >
          {msg.texto}
        </div>
      )}

      {/* ===== DESCARGA ===== */}
      {modo === "descarga" && (
        <>
          {paso === 1 && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <TextField
                label="Fecha"
                type="date"
                value={fechaDesc}
                onChange={setFechaDesc}
              />
              <TextField
                label="Hora llegada"
                type="time"
                value={horaDesc}
                onChange={setHoraDesc}
              />
              <TextField
                label="Nº contenedor"
                placeholder="MSCU1234567"
                value={contenedor}
                onChange={setContenedor}
              />
              <TextField
                label="Origen"
                placeholder="Proveedor / País / Planta"
                value={origen}
                onChange={setOrigen}
              />
              <TextField
                label="Nº precinto"
                placeholder="Precinto"
                value={precinto}
                onChange={setPrecinto}
              />
              <TextField
                label="Remolque"
                placeholder="5678-DEF"
                value={remolqueDesc}
                onChange={setRemolqueDesc}
              />
              <TextField
                className="md:col-span-3"
                label="Responsables (3–4)"
                placeholder="Ej: Juan, María, Pedro"
                value={responsablesDesc}
                onChange={setResponsablesDesc}
              />
              <div className="md:col-span-4">
                <PrimaryButton onClick={guardarPaso1} disabled={guardando}>
                  {guardando ? "Guardando..." : "Guardar paso 1 y continuar"}
                </PrimaryButton>
              </div>
            </div>
          )}
          {paso === 2 && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <NumberField
                label="Nº de palets"
                min={0}
                value={paletsDentro}
                onChange={setPaletsDentro}
              />
              <NumberField
                label="Nº de cajas (total)"
                min={0}
                value={cajasDentro}
                onChange={setCajasDentro}
              />
              <TextField
                label="Hora de salida"
                type="time"
                value={horaSalidaDesc}
                onChange={setHoraSalidaDesc}
              />
              <div className="md:col-span-4 flex gap-2">
                <PrimaryButton onClick={guardarPaso2} disabled={guardando}>
                  {guardando ? "Guardando..." : "Finalizar movimiento"}
                </PrimaryButton>
                <button
                  className="px-4 py-2 rounded-lg border"
                  onClick={resetTodo}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ===== CARGA SIMPLE ===== */}
      {modo === "carga" && (
        <>
          {paso === 1 && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <TextField
                label="Fecha de llegada"
                type="date"
                value={fechaCarga}
                onChange={setFechaCarga}
              />
              <TextField
                className="md:col-span-2"
                label="Empresa transportista"
                placeholder="Transportes ACME"
                value={empresa}
                onChange={setEmpresa}
              />
              <SelectField
                label="Tipo de palets"
                value={tipoPalet}
                onChange={setTipoPalet}
                options={tiposPalet}
                placeholder="Selecciona tipo"
              />
              <NumberField
                label="Número de palets"
                min={1}
                value={numPalets}
                onChange={setNumPalets}
              />
              <TextField
                label="Hora de llegada"
                type="time"
                value={horaLlegada}
                onChange={setHoraLlegada}
              />
              {/* Opcionales y obligatorios según reglas */}
              <TextField
                label="Nº contenedor (opcional)"
                value={contenedorCarga}
                onChange={setContenedorCarga}
              />
              <TextField
                label="Nº precinto"
                value={precintoCarga}
                onChange={setPrecintoCarga}
              />
              <TextField
                label="Tractora (opcional)"
                value={tractoraCarga}
                onChange={setTractoraCarga}
              />
              <TextField
                label="Remolque"
                value={remolqueCarga}
                onChange={setRemolqueCarga}
              />
              <TextField
                className="md:col-span-4"
                label="Responsables (3–4)"
                placeholder="Ej: Juan, María, Pedro"
                value={responsablesCarga}
                onChange={setResponsablesCarga}
              />
              <div className="md:col-span-4">
                <PrimaryButton onClick={guardarPaso1} disabled={guardando}>
                  {guardando ? "Guardando..." : "Guardar paso 1 y continuar"}
                </PrimaryButton>
              </div>
            </div>
          )}
          {paso === 2 && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <TextField
                label="Hora de salida"
                type="time"
                value={horaSalida}
                onChange={setHoraSalida}
              />
              <div className="md:col-span-4 flex gap-2">
                <PrimaryButton onClick={guardarPaso2} disabled={guardando}>
                  {guardando ? "Guardando..." : "Finalizar movimiento"}
                </PrimaryButton>
                <button
                  className="px-4 py-2 rounded-lg border"
                  onClick={resetTodo}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ===== CARGA MIXTA ===== */}
      {modo === "carga-mixta" && (
        <>
          {paso === 1 && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <TextField
                label="Fecha de llegada"
                type="date"
                value={fechaCarga}
                onChange={setFechaCarga}
              />
              <TextField
                className="md:col-span-2"
                label="Empresa transportista"
                placeholder="Transportes ACME"
                value={empresa}
                onChange={setEmpresa}
              />
              <TextField
                label="Hora de llegada"
                type="time"
                value={horaLlegada}
                onChange={setHoraLlegada}
              />

              {/* Opcionales/obligatorios según reglas */}
              <TextField
                label="Nº contenedor (opcional)"
                value={contenedorMixta}
                onChange={setContenedorMixta}
              />
              <TextField
                label="Nº precinto"
                value={precintoMixta}
                onChange={setPrecintoMixta}
              />
              <TextField
                label="Tractora (opcional)"
                value={tractoraMixta}
                onChange={setTractoraMixta}
              />
              <TextField
                label="Remolque"
                value={remolqueMixta}
                onChange={setRemolqueMixta}
              />

              <div className="md:col-span-4 rounded-lg border border-emerald-200 p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium text-emerald-900">
                    Tipos de palet a cargar
                  </div>
                  <button
                    type="button"
                    onClick={addLineaMixta}
                    className="px-2 py-1 rounded-md bg-emerald-600 text-white text-sm hover:bg-emerald-700"
                  >
                    ➕ Añadir línea
                  </button>
                </div>

                <div className="space-y-2">
                  {lineasMixtas.map((l, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end"
                    >
                      <div className="md:col-span-8">
                        <SelectField
                          value={l.tipo}
                          onChange={(v) => setLineaMixta(idx, { tipo: v })}
                          options={tiposPalet}
                          placeholder="Selecciona tipo"
                        />
                      </div>
                      <div className="md:col-span-3">
                        <NumberField
                          value={l.cantidad}
                          onChange={(v) => setLineaMixta(idx, { cantidad: v })}
                          min={1}
                          placeholder="Cantidad"
                        />
                      </div>
                      <div className="md:col-span-1 flex items-center md:justify-end">
                        <button
                          type="button"
                          onClick={() => removeLineaMixta(idx)}
                          className="h-10 px-3 rounded-lg bg-rose-600 text-white text-sm hover:bg-rose-700 disabled:opacity-50"
                          title="Eliminar"
                          disabled={lineasMixtas.length === 1}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-3 text-sm text-emerald-800">
                  <span className="font-semibold">Total palets:</span>{" "}
                  {totalMixto}
                </div>
              </div>

              <TextField
                className="md:col-span-4"
                label="Responsables (3–4)"
                placeholder="Ej: Juan, María, Pedro"
                value={responsablesCarga}
                onChange={setResponsablesCarga}
              />
              <div className="md:col-span-4">
                <PrimaryButton onClick={guardarPaso1} disabled={guardando}>
                  {guardando ? "Guardando..." : "Guardar paso 1 y continuar"}
                </PrimaryButton>
              </div>
            </div>
          )}
          {paso === 2 && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <TextField
                label="Hora de salida"
                type="time"
                value={horaSalidaMixta}
                onChange={setHoraSalidaMixta}
              />
              <div className="md:col-span-4 flex gap-2">
                <PrimaryButton onClick={guardarPaso2} disabled={guardando}>
                  {guardando ? "Guardando..." : "Finalizar movimiento"}
                </PrimaryButton>
                <button
                  className="px-4 py-2 rounded-lg border"
                  onClick={resetTodo}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ------- Pequeños componentes UI reutilizables ------- */
function FieldWrapper({ label, children, className = "" }) {
  return (
    <div className={`flex flex-col ${className}`}>
      {label && (
        <label className="text-xs text-emerald-700 mb-1">{label}</label>
      )}
      {children}
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  className,
}) {
  return (
    <FieldWrapper label={label} className={className}>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 p-2.5 rounded-lg border border-emerald-300 w-full"
      />
    </FieldWrapper>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min = 0,
  placeholder,
  className,
}) {
  return (
    <FieldWrapper label={label} className={className}>
      <input
        type="number"
        min={min}
        inputMode="numeric"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 p-2.5 rounded-lg border border-emerald-300 w-full"
      />
    </FieldWrapper>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options = [],
  placeholder = "Selecciona",
  className,
}) {
  return (
    <FieldWrapper label={label} className={className}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 p-2.5 rounded-lg border border-emerald-300 w-full"
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </FieldWrapper>
  );
}

function PrimaryButton({ children, ...props }) {
  return (
    <button
      {...props}
      className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium disabled:opacity-60"
    >
      {children}
    </button>
  );
}
