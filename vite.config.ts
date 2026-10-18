import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Sin `define` de secretos: el navegador nunca ve credenciales.
// Todas las llamadas al modelo pasan por el servidor.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: { outDir: 'dist', sourcemap: false },
});
