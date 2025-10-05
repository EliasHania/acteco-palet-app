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
  // "descarga" | "carga" | "carga-mixta"
  const [modo, setModo] = useState("descarga");
  const [msg, setMsg] = useState(null); // {tipo:"ok"|"err", texto:string}
  const [guardando, setGuardando] = useState(false);

  // -------- Descarga
  const [fechaDesc, setFechaDesc] = useState(hoyISO());
  const [horaDesc, setHoraDesc] = useState(ahoraHM());
  const [contenedor, setContenedor] = useState("");
  const [origen, setOrigen] = useState("");
  const [paletsDentro, setPaletsDentro] = useState("");
  const [cajasDentro, setCajasDentro] = useState(""); // Nº de cajas total
  const [precinto, setPrecinto] = useState("");
  const [responsablesDesc, setResponsablesDesc] = useState("");

  // -------- Carga simple
  const [fechaCarga, setFechaCarga] = useState(hoyISO());
  const [empresa, setEmpresa] = useState("");
  const [tipoPalet, setTipoPalet] = useState("");
  const [numPalets, setNumPalets] = useState("");
  const [horaLlegada, setHoraLlegada] = useState(ahoraHM());
  const [horaSalida, setHoraSalida] = useState("");
  const [responsablesCarga, setResponsablesCarga] = useState("");

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

  const valido = useMemo(() => {
    if (modo === "descarga") {
      if (!fechaDesc || !horaDesc) return false;
      if (!contenedor.trim() || !origen.trim() || !precinto.trim())
        return false;
      if (!responsablesDesc.trim()) return false;
      const nPal = parseInt(paletsDentro, 10);
      const nCaj = parseInt(cajasDentro, 10);
      return (
        Number.isFinite(nPal) && nPal >= 0 && Number.isFinite(nCaj) && nCaj >= 0
      );
    }
    if (modo === "carga") {
      if (!fechaCarga || !empresa.trim() || !tipoPalet.trim() || !horaLlegada)
        return false;
      if (!responsablesCarga.trim()) return false;
      const n = parseInt(numPalets, 10);
      return Number.isFinite(n) && n > 0;
    }
    // carga-mixta
    if (
      !fechaCarga ||
      !empresa.trim() ||
      !horaLlegada ||
      !responsablesCarga.trim()
    )
      return false;
    if (lineasMixtas.length === 0) return false;
    for (const l of lineasMixtas) {
      const n = parseInt(l.cantidad, 10);
      if (!l.tipo || !Number.isFinite(n) || n <= 0) return false;
    }
    return true;
  }, [
    modo,
    // descarga
    fechaDesc,
    horaDesc,
    contenedor,
    origen,
    paletsDentro,
    cajasDentro,
    precinto,
    responsablesDesc,
    // carga simple
    fechaCarga,
    empresa,
    tipoPalet,
    numPalets,
    horaLlegada,
    responsablesCarga,
    // mixta
    lineasMixtas,
  ]);

  const guardar = async () => {
    if (!valido) {
      setMsg({ tipo: "err", texto: "Revisa los campos obligatorios." });
      return;
    }
    setGuardando(true);
    setMsg(null);
    try {
      let payload;
      if (modo === "descarga") {
        const timestamp = new Date(`${fechaDesc}T${horaDesc}:00`).toISOString();
        payload = {
          tipo: "descarga",
          numeroContenedor: contenedor.trim(),
          origen: origen.trim(),
          palets: parseInt(paletsDentro, 10),
          numeroCajas: parseInt(cajasDentro, 10),
          numeroPrecinto: precinto.trim(),
          personal: responsablesDesc.trim(),
          registradaPor: "almacen",
          timestamp,
        };
      } else if (modo === "carga") {
        const llegadaISO = new Date(
          `${fechaCarga}T${horaLlegada}:00`
        ).toISOString();
        const salidaISO =
          horaSalida && horaSalida.length >= 4
            ? new Date(`${fechaCarga}T${horaSalida}:00`).toISOString()
            : null;
        payload = {
          tipo: "carga",
          empresaTransportista: empresa.trim(),
          tipoPalet: tipoPalet.trim(),
          numeroPalets: parseInt(numPalets, 10),
          timestampLlegada: llegadaISO,
          timestampSalida: salidaISO,
          personal: responsablesCarga.trim(),
          registradaPor: "almacen",
          fecha: fechaCarga,
        };
      } else {
        // carga-mixta
        const llegadaISO = new Date(
          `${fechaCarga}T${horaLlegada}:00`
        ).toISOString();
        const salidaISO =
          horaSalida && horaSalida.length >= 4
            ? new Date(`${fechaCarga}T${horaSalida}:00`).toISOString()
            : null;
        payload = {
          tipo: "carga-mixta",
          empresaTransportista: empresa.trim(),
          items: lineasMixtas.map((l) => ({
            tipoPalet: l.tipo,
            numeroPalets: parseInt(l.cantidad, 10),
          })),
          totalPalets: totalMixto,
          timestampLlegada: llegadaISO,
          timestampSalida: salidaISO,
          personal: responsablesCarga.trim(),
          registradaPor: "almacen",
          fecha: fechaCarga,
        };
      }

      const res = await authFetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/almacen/movimientos`,
        { method: "POST", body: JSON.stringify(payload) }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.msg || "No se pudo guardar el movimiento");
      }

      setMsg({ tipo: "ok", texto: "✅ Registro guardado correctamente." });
      // reset “inteligente”
      if (modo === "descarga") {
        setContenedor("");
        setOrigen("");
        setPaletsDentro("");
        setCajasDentro("");
        setPrecinto("");
        setResponsablesDesc("");
      } else if (modo === "carga") {
        setEmpresa("");
        setTipoPalet("");
        setNumPalets("");
        setHoraSalida("");
        setResponsablesCarga("");
      } else {
        setEmpresa("");
        setLineasMixtas([{ tipo: "", cantidad: "" }]);
        setHoraSalida("");
        setResponsablesCarga("");
      }
      onSaved?.();
    } catch (e) {
      setMsg({ tipo: "err", texto: e.message || "Error inesperado" });
    } finally {
      setGuardando(false);
      setTimeout(() => setMsg(null), 3000);
    }
  };

  return (
    <div className="rounded-2xl bg-white/95 text-emerald-900 border border-emerald-200 shadow p-5">
      <div className="flex items-center gap-3 mb-3">
        <h2 className="text-xl font-semibold">🚚 Registrar movimiento</h2>
        <select
          value={modo}
          onChange={(e) => setModo(e.target.value)}
          className="ml-auto border border-emerald-300 rounded-lg px-3 py-1.5 text-sm"
        >
          <option value="descarga">Descarga</option>
          <option value="carga">Carga</option>
          <option value="carga-mixta">Carga mixta</option>
        </select>
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

      {/* DESCARGA */}
      {modo === "descarga" && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <TextField
            label="Fecha"
            type="date"
            value={fechaDesc}
            onChange={setFechaDesc}
          />
          <TextField
            label="Hora"
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
          <NumberField
            label="Palets"
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
            label="Nº precinto"
            placeholder="Precinto"
            value={precinto}
            onChange={setPrecinto}
          />
          <TextField
            className="md:col-span-3"
            label="Responsables (3–4)"
            placeholder="Ej: Juan, María, Pedro"
            value={responsablesDesc}
            onChange={setResponsablesDesc}
          />
          <div className="md:col-span-4">
            <PrimaryButton onClick={guardar} disabled={guardando}>
              {guardando ? "Guardando..." : "Guardar descarga"}
            </PrimaryButton>
          </div>
        </div>
      )}

      {/* CARGA SIMPLE */}
      {modo === "carga" && (
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
          <TextField
            label="Hora de salida (opcional)"
            type="time"
            value={horaSalida}
            onChange={setHoraSalida}
          />
          <TextField
            className="md:col-span-4"
            label="Responsables (3–4)"
            placeholder="Ej: Juan, María, Pedro"
            value={responsablesCarga}
            onChange={setResponsablesCarga}
          />
          <div className="md:col-span-4">
            <PrimaryButton onClick={guardar} disabled={guardando}>
              {guardando ? "Guardando..." : "Guardar carga"}
            </PrimaryButton>
          </div>
        </div>
      )}

      {/* CARGA MIXTA */}
      {modo === "carga-mixta" && (
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
                  {/* Select tipo (8/12) */}
                  <div className="md:col-span-8 ">
                    <SelectField
                      value={l.tipo}
                      onChange={(v) => setLineaMixta(idx, { tipo: v })}
                      options={tiposPalet}
                      placeholder="Selecciona tipo"
                    />
                  </div>

                  {/* Cantidad (3/12) – sin label visible, usamos placeholder */}
                  <div className="md:col-span-3">
                    <NumberField
                      value={l.cantidad}
                      onChange={(v) => setLineaMixta(idx, { cantidad: v })}
                      min={1}
                      placeholder="Cantidad"
                    />
                  </div>

                  {/* Botón borrar (1/12) */}
                  <div className="md:col-span-1 flex items-center md:justify-end">
                    <button
                      type="button"
                      onClick={() => removeLineaMixta(idx)}
                      className="h-10 px-3 rounded-lg bg-rose-600 text-white text-sm hover:bg-rose-700 disabled:opacity-50"
                      title="Eliminar línea"
                      disabled={lineasMixtas.length === 1}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 text-sm text-emerald-800">
              <span className="font-semibold">Total palets:</span> {totalMixto}
            </div>
          </div>

          <TextField
            label="Hora de salida (opcional)"
            type="time"
            value={horaSalida}
            onChange={setHoraSalida}
          />
          <TextField
            className="md:col-span-3"
            label="Responsables (3–4)"
            placeholder="Ej: Juan, María, Pedro"
            value={responsablesCarga}
            onChange={setResponsablesCarga}
          />

          <div className="md:col-span-4">
            <PrimaryButton onClick={guardar} disabled={guardando}>
              {guardando ? "Guardando..." : "Guardar carga mixta"}
            </PrimaryButton>
          </div>
        </div>
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
