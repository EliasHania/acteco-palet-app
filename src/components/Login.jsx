import React, { useState } from "react";

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

      localStorage.setItem("encargada", data.username);
      localStorage.setItem("esAdmin", data.role === "admin");

      onLogin(data.username, data.role === "admin");
    } catch (err) {
      setError("Error de conexión");
      console.error(err);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-green-300 via-green-900 to-neutral-900 p-4">
      <div className="login-border-effect max-w-md w-full">
        <div className="login-inner shadow-lg">
          <div className="flex justify-center mb-6">
            <img
              src="/logo.jpg"
              alt="Logo Acteco"
              className="w-32 h-auto rounded-lg shadow"
            />
          </div>

          <h1 className="text-3xl font-bold text-center text-green-700 mb-2">
            Bienvenido a Acteco Productos y Servicios S.L.
          </h1>
          <p className="text-center text-gray-600 mb-6">
            Accede a la plataforma interna de gestión de palets.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-gray-700">Usuario</label>
              <input
                type="text"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Usuario"
                required
              />
            </div>
            <div>
              <label className="block text-gray-700">Contraseña</label>
              <input
                type="password"
                value={contrasena}
                onChange={(e) => setContrasena(e.target.value)}
                className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
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
