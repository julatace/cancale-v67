import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// __BUILD__ = horodatage du build, injecté à la compilation. Sert de « version »
// visible dans l'app pour diagnostiquer les problèmes de cache/mise à jour.
const BUILD = new Date().toISOString().slice(0, 16).replace('T', ' ');
export default defineConfig({
  plugins: [react()],
  define: { __BUILD__: JSON.stringify(BUILD) },
});
