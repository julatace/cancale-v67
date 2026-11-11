import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
// __BUILD__ = horodatage du build, injecté à la compilation. Sert de « version »
// visible dans l'app pour diagnostiquer les problèmes de cache/mise à jour.
// ⚠️ ON INJECTE L'ISO COMPLET, PAS UNE CHAÎNE DÉJÀ MISE EN FORME. La version
// tronquée était en UTC : affichée telle quelle elle aurait annoncé 12:32 pour
// un déploiement de 14:32 — deux heures d'écart sur le seul chiffre censé lui
// dire « oui, tu as bien la dernière version ». L'app la formate dans SON
// fuseau, au moment de l'afficher.
const BUILD = new Date().toISOString();
// index.html porte des pages d'explications (pourquoi le thème est posé avant le
// premier rendu, etc.) : mesuré le 3 octobre, les deux tiers de ses octets
// compressés — envoyés en PREMIER à chaque visite, avant tout le reste. On les
// garde dans le source, on les retire du fichier livré. Uniquement les
// commentaires HTML et ceux des <style> : le contenu des <script> n'est pas
// touché (le script de thème doit tourner tel quel avant le premier rendu).
const allegerIndex = () => ({
  name: 'vrm-alleger-index',
  apply: 'build',
  transformIndexHtml: {
    order: 'post',
    handler: (html) => html
      .replace(/<!--(?!\[)[\s\S]*?-->/g, '')
      .replace(/(<style[^>]*>)([\s\S]*?)(<\/style>)/g, (m, a, css, b) => a + css.replace(/\/\*[\s\S]*?\*\//g, '') + b)
      .replace(/\n[ \t]*(?=\n)/g, ''),
  },
});
// (6 nov.) La page d'état publique (public/etat.html) dit la version de
// l'extension SERVIE. Elle est lue au build dans le manifeste du dossier que le
// zip publié contient (audit-extension-zip tient zip = dossier), et posée à côté
// de la page : `/etat-version.json`. Rien à tenir à la main à chaque version.
const versionEtat = () => ({
  name: 'vrm-etat-version',
  apply: 'build',
  generateBundle() {
    let extension = null;
    try { const v = JSON.parse(readFileSync(new URL('./vinted-sync-extension/manifest.json', import.meta.url), 'utf8')).version; if (/^\d+\.\d+\.\d+$/.test(v)) extension = v; } catch (_) {}
    this.emitFile({ type: 'asset', fileName: 'etat-version.json', source: JSON.stringify({ extension }) });
  },
});
// (8 nov., démarrage léger) Le morceau App (et sa feuille de style) demandé dès la
// lecture d'index.html quand l'app va s'ouvrir : public/demarrage-app.js pose les
// `modulepreload` / `preload`. Ici on lui donne les VRAIS noms du build (empreintes),
// dans les attributs de sa balise — index.html n'est jamais mis en cache, il vise
// donc toujours les fichiers du déploiement en cours.
// (11 nov., lot hors-ligne) TOUTE L'APP HORS LIGNE : la liste des morceaux de CE build
// (`/hors-ligne-assets.json`). Le service worker (public/sw.js, `rechaufferMorceaux`) les
// range en ligne, une fois par déploiement : un écran jamais ouvert s'ouvre ensuite sans
// réseau. Ni la carte (maplibre : ses tuiles viennent du réseau), ni la 3D, ni le film
// d'accueil : lourds et inutiles hors ligne (≈ 3,5 Mo gardés au lieu de 6).
const EXCLU_HORS_LIGNE = /maplibre|three\.module|Room3D|OrbitControls|AccueilFilm/;
const listeHorsLigne = () => ({
  name: 'vrm-liste-hors-ligne',
  apply: 'build',
  // Après l'écriture : seulement les fichiers VRAIMENT livrés (un morceau qui ne portait que du CSS
  // est retiré par Vite après `generateBundle` — le nommer ferait un 404 au rangement).
  writeBundle(o, bundle) {
    const dir = o.dir || 'dist';
    const fichiers = Object.keys(bundle).filter((f) => /^assets\/[A-Za-z0-9._-]+\.(?:js|css)$/.test(f) && !EXCLU_HORS_LIGNE.test(f) && existsSync(join(dir, f))).map((f) => '/' + f).sort();
    writeFileSync(join(dir, 'hors-ligne-assets.json'), JSON.stringify({ v: 1, fichiers }));
  },
});
const prechargerApp = () => ({
  name: 'vrm-precharger-app',
  apply: 'build',
  transformIndexHtml: {
    order: 'post',
    handler: (html, ctx) => {
      const bundle = ctx && ctx.bundle;
      if (!bundle) return html;
      // (App.jsx exporte ce que les écrans à la demande lui empruntent : son morceau n'a pas
      // de « façade », on le reconnaît au module qu'il contient.)
      const app = Object.values(bundle).find((c) => c.type === 'chunk' && (c.moduleIds || Object.keys(c.modules || {})).some((m) => /[\\/]src[\\/]App\.jsx$/.test(m)));
      if (!app) return html;
      const base = (f) => '/' + f;
      // le morceau App et ce qu'il importe statiquement (sauf ce qu'index.html précharge déjà)
      const deja = new Set([...html.matchAll(/(?:href|src)="\/([^"]+)"/g)].map((m) => m[1]));
      const js = [app.fileName, ...(app.imports || [])].filter((f) => !deja.has(f));
      const css = [...((app.viteMetadata && app.viteMetadata.importedCss) || [])];
      for (const f of app.imports || []) { const c = bundle[f]; if (c && c.viteMetadata) for (const x of c.viteMetadata.importedCss) if (!css.includes(x)) css.push(x); }
      const attrs = { src: '/demarrage-app.js', 'data-js': js.map(base).join(','), 'data-css': css.filter((f) => !deja.has(f)).map(base).join(',') };
      // ⚠️ (8 nov., CI verte) JAMAIS avant `<meta name="referrer">` : posée en
      // `head-prepend`, cette balise (et les préchargements qu'elle pose) partait
      // avant que la page ait lu sa politique de référent — avec l'en-tête de Vercel
      // (strict-origin-when-cross-origin), ces requêtes emportaient l'URL COMPLÈTE,
      // donc le `?code=` / `#access_token` d'un lien de récupération
      // (banc recuperation-retour). On la pose juste après la meta.
      const meta = html.match(/<meta\s+name="referrer"[^>]*>/i);
      if (meta) {
        const balise = '<script ' + Object.entries(attrs).map(([k, v]) => `${k}="${String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`).join(' ') + '></script>';
        const i = meta.index + meta[0].length;
        return html.slice(0, i) + '\n  ' + balise + html.slice(i);
      }
      return [{ tag: 'script', attrs, injectTo: 'head-prepend' }];
    },
  },
});
export default defineConfig({
  plugins: [react(), allegerIndex(), versionEtat(), prechargerApp(), listeHorsLigne()],
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
