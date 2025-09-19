export const authFetch = async (url, options = {}) => {
  // Coge el token de donde ya lo guardas
  const token =
    localStorage.getItem("token") || sessionStorage.getItem("token");

  const hasBody = typeof options.body !== "undefined";

  const res = await fetch(url, {
    credentials: "include", // no estorba aunque hoy no uses cookies
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      // Solo añade Content-Type si realmente envías cuerpo
      ...(hasBody && !options.headers?.["Content-Type"]
        ? { "Content-Type": "application/json" }
        : {}),
    },
  });

  // Si la sesión está caída, limpiamos y redirigimos a /login
  if (res.status === 401 || res.status === 403) {
    try {
      localStorage.removeItem("token");
      localStorage.removeItem("encargada");
      localStorage.removeItem("esAdmin");
      sessionStorage.removeItem("token");
    } catch {}
    if (window.location.pathname !== "/login") {
      window.location.replace("/login?reason=expired");
    }
    // Cortamos el flujo para que el caller no siga usando esta respuesta
    throw new Error("unauthorized");
  }

  // Comportamiento normal: devuelve el Response como siempre
  return res;
};
