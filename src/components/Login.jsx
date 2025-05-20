import { useState } from "react";

const Login = ({ onLogin }) => {
  const [usuario, setUsuario] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setCargando(true);
    setError("");

    try {
      const res = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/auth/login`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: usuario, password: contrasena }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setError(data.msg || "Error al iniciar sesión");
        setCargando(false);
        return;
      }

      localStorage.setItem("token", data.token);

      sessionStorage.setItem("token", data.token);

      const encargadaLimpia = data.username.trim().toLowerCase();
      localStorage.setItem("encargada", encargadaLimpia);
      onLogin(encargadaLimpia, data.role === "admin");

      localStorage.setItem("esAdmin", data.role === "admin");
    } catch (err) {
      setError("Error de conexión");
      console.error(err);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-green-200 via-green-800 to-neutral-900 p-4">
      <div className="conic-border w-full max-w-md rounded-2xl">
        <div className="p-6 bg-emerald-900/40 backdrop-blur-sm rounded-2xl">
          <div className="flex justify-center mb-6">
            <img
              src="/logo.jpg"
              alt="Logo Acteco"
              className="w-32 h-auto rounded-lg drop-shadow-md"
            />
          </div>

          <h1 className="text-3xl font-bold text-center text-green-300 mb-2">
            Bienvenido a Acteco Productos y Servicios S.L.
          </h1>
          <p className="text-center text-green-100 mb-6">
            Plataforma interna de gestión de palets en la planta de Algeciras.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="usuario" className="block text-green-100 mb-1">
                Usuario
              </label>
              <input
                id="usuario"
                name="usuario"
                type="text"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                className="w-full px-4 py-2 border border-green-700/40 rounded-md bg-emerald-800/20 text-green-100 placeholder-white/80 focus:outline-none focus:ring-2 focus:ring-green-400"
                placeholder="Usuario"
                required
              />
            </div>
            <div>
              <label htmlFor="contrasena" className="block text-green-100 mb-1">
                Contraseña
              </label>
              <input
                id="contrasena"
                name="contrasena"
                type="password"
                value={contrasena}
                onChange={(e) => setContrasena(e.target.value)}
                className="w-full px-4 py-2 border border-green-700/40 rounded-md bg-emerald-800/20 text-green-100 placeholder-white/80 focus:outline-none focus:ring-2 focus:ring-green-400"
                placeholder="Contraseña"
                required
              />
            </div>

            {error && (
              <p className="text-red-500 text-sm text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={cargando}
              className="w-full bg-green-600 text-white py-2 rounded-md hover:bg-green-700 transition duration-300 cursor-pointer"
            >
              {cargando ? "Cargando..." : "Iniciar Sesión"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
