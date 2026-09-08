import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// __BUILD__ = horodatage du build, injecté à la compilation. Sert de « version »
// visible dans l'app pour diagnostiquer les problèmes de cache/mise à jour.
// ⚠️ ON INJECTE L'ISO COMPLET, PAS UNE CHAÎNE DÉJÀ MISE EN FORME. La version
// tronquée était en UTC : affichée telle quelle elle aurait annoncé 12:32 pour
// un déploiement de 14:32 — deux heures d'écart sur le seul chiffre censé lui
// dire « oui, tu as bien la dernière version ». L'app la formate dans SON
// fuseau, au moment de l'afficher.
const BUILD = new Date().toISOString();
export default defineConfig({
  plugins: [react()],
  define: { __BUILD__: JSON.stringify(BUILD) },
  build: {
    // Cible moderne : moins de transformations/polyfills → bundle plus léger et
    // plus rapide à parser sur les téléphones récents (tous compatibles).
    target: 'es2020',
    rollupOptions: {
      output: {
        // React/React-DOM dans un chunk séparé : il ne change quasi jamais, donc
        // le navigateur le garde en cache d'un déploiement à l'autre. À chaque
        // mise à jour de l'app (rechargements fréquents), seul le code applicatif
        // est re-téléchargé, pas les ~130 Ko de React.
        manualChunks: { react: ['react', 'react-dom'] },
      },
    },
  },
});
