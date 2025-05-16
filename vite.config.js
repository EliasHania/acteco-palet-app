import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0", // para hacerlo accesible desde la red
    port: 5173, // o el puerto que uses
    strictPort: true,
    allowedHosts: true, // ✅ permite cualquier subdominio, como loca.lt
  },
});
