import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve as resoudreChemin } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const exiger = createRequire(import.meta.url);
const RACINE = fileURLToPath(new URL('.', import.meta.url));
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
// (22 nov., latence-totale) LA VERSION DE L'APP EN 60 OCTETS. La vérification de version (src/main.jsx, chaque minute,
// au retour sur l'app, et au démarrage) relisait index.html ENTIER sans cache (≈ 16 Ko compressés, 62 Ko) pour y lire
// le nom du morceau principal — au démarrage, en concurrence avec les morceaux de l'app sur la 4G. `/version-app.json`
// porte ce seul nom ; une page qui ne le trouve pas (ancien déploiement) relit index.html comme avant.
const versionApp = () => ({
  name: 'vrm-version-app',
  apply: 'build',
  generateBundle(o, bundle) {
    const entree = Object.values(bundle).find((c) => c && c.type === 'chunk' && c.isEntry && /^assets\/index-[A-Za-z0-9_-]+\.js$/.test(c.fileName));
    if (entree) this.emitFile({ type: 'asset', fileName: 'version-app.json', source: JSON.stringify({ index: '/' + entree.fileName }) });
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
    // (19 nov., capacite-3000) LA LANGUE DU VENDEUR SEULE. Les dictionnaires anglais, espagnol,
    // italien, allemand (≈ 670 Ko compressés à eux quatre) étaient rangés chez TOUT le monde à
    // chaque déploiement. Ils sont rangés à part (`langues`) : le service worker ne prend que
    // ceux de la langue que la page lui dit (public/sw.js, `langueHorsLigne`) ; en français, aucun.
    const langueDe = (c) => { const m = c && c.facadeModuleId && /[\\/]src[\\/]i18n[\\/]langues[\\/](en|es|it|de)(?:-accueil)?\.js$/.exec(c.facadeModuleId); return m ? m[1] : null; };
    // (24 nov., morceaux-perimes) Les polices du build (`polices`) : une page restée ouverte pendant une mise en
    // ligne les demande parfois plus tard (une graisse pas encore vue) ; src/reserveMorceaux.js les fait ranger.
    const fichiers = [], langues = {}, polices = [];
    for (const f of Object.keys(bundle).sort()) {
      if (/^assets\/[A-Za-z0-9._-]+\.woff2$/.test(f) && existsSync(join(dir, f))) { polices.push('/' + f); continue; }
      if (!/^assets\/[A-Za-z0-9._-]+\.(?:js|css)$/.test(f) || EXCLU_HORS_LIGNE.test(f) || !existsSync(join(dir, f))) continue;
      const l = langueDe(bundle[f]);
      if (l) (langues[l] = langues[l] || []).push('/' + f); else fichiers.push('/' + f);
    }
    writeFileSync(join(dir, 'hors-ligne-assets.json'), JSON.stringify({ v: 1, fichiers, langues, polices }));
  },
});

// (17 nov., lot vitesse-poids) LE FRANÇAIS DES ÉCRANS À LA DEMANDE, CHARGÉ AVEC EUX.
// Le fr.js qu'importe src/App.jsx devient, au build, la part que le démarrage peut lire ;
// le reste remplit src/i18n/langues/fr-reste.js, importé EN PREMIER par chaque module chargé
// à la demande qui peut en lire une clé. Règle et prudences : scripts/_francais-differe.cjs ;
// garde : scripts/audit-francais-differe.cjs. Le dépôt garde fr.js complet.
const francaisSections = new Map();   // morceau d'une section de Comptabilite -> son français (sectionsDifferees)
const francaisDiffere = () => {
  const FR = resoudreChemin(RACINE, 'src/i18n/langues/fr.js');
  const RESTE = resoudreChemin(RACINE, 'src/i18n/langues/fr-reste.js');
  const APP = resoudreChemin(RACINE, 'src/App.jsx');
  const INDEX = resoudreChemin(RACINE, 'src/i18n/index.js');
  const BASE = '\0vrm-fr-demarrage';
  let a = null;
  return {
    name: 'vrm-francais-differe',
    apply: 'build',
    enforce: 'pre',
    async buildStart() {
      const F = exiger('./scripts/_francais-differe.cjs');
      const dico = await F.dictionnaire(RACINE);
      // (27 nov., budget-vitesse) Le démarrage se juge sur le Comptabilite LIVRÉ (ses sections découpées,
      // `sectionsDifferees`) : le français que seules les sections lisent part avec elles (`francaisSections`).
      const COMPTA = resoudreChemin(RACINE, 'src/ecrans/Comptabilite.jsx');
      const S = process.env.VRM_SANS_SECTIONS === '1' ? null : exiger('./scripts/_sections-differees.cjs');
      const rs = S ? S.decouperUneFois(RACINE, COMPTA, readFileSync(COMPTA, 'utf8')) : null;
      a = F.analyser(RACINE, dico, rs && rs.faites.length ? { [COMPTA]: rs.code } : undefined);
      francaisSections.clear();
      if (rs && rs.faites.length) for (const [f, d] of Object.entries(S.francaisDesMorceaux(RACINE, rs, dico, a.base))) francaisSections.set(f, d);
    },
    async resolveId(source, importer) {
      if (!a || !importer || resoudreChemin(importer.split('?')[0]) !== APP) return null;
      const r = await this.resolve(source, importer, { skipSelf: true });
      return r && r.id === FR ? BASE : null;
    },
    load(id) {
      if (!a) return null;
      if (id === BASE) return 'export default ' + JSON.stringify(a.base) + ';\n';
      if (id === RESTE) return 'import { ajouterSourceDifferee } from ' + JSON.stringify(INDEX) + ';\najouterSourceDifferee(' + JSON.stringify(a.reste) + ');\nexport default true;\n';
      return null;
    },
    transform(code, id) {
      if (!a || !a.injecter.has(id.split('?')[0])) return null;
      return { code: 'import ' + JSON.stringify(RESTE) + ';\n' + code, map: null };
    },
  };
};
// (27 nov., budget-vitesse) LES SECTIONS DE `Comptabilite`, CHARGÉES AVEC LEUR ÉCRAN. Au build seulement, le
// fichier livré de src/ecrans/Comptabilite.jsx rend ses sections Ventes / Achats / Annonces / Messages / Rapport
// par des morceaux à la demande (le même JSX) : Aujourd'hui ne les télécharge plus. Le dépôt ne change pas.
// Règle, refus et preuves : scripts/_sections-differees.cjs ; garde : scripts/audit-sections-differees.cjs.
// `VRM_SANS_SECTIONS=1` livre Comptabilite d'un seul tenant (mesure avant/après).
const sectionsOuverture = new Map();   // morceau d'une section -> l'écran qui la montre à l'ouverture (prechargerApp)
const sectionsDifferees = () => {
  const COMPTA = resoudreChemin(RACINE, 'src/ecrans/Comptabilite.jsx');
  const morceaux = new Map();
  return {
    name: 'vrm-sections-differees',
    apply: 'build',
    enforce: 'pre',
    transform(code, id) {
      if (process.env.VRM_SANS_SECTIONS === '1' || resoudreChemin(id.split('?')[0]) !== COMPTA) return null;
      const r = exiger('./scripts/_sections-differees.cjs').decouperUneFois(RACINE, COMPTA, code);
      for (const x of r.refus) this.warn(`section « ${x.nom} » gardée dans Comptabilite : ${x.raison}`);
      for (const [f, c] of Object.entries(r.morceaux)) morceaux.set(join(r.dirMorceau, f), c);
      // l'écran d'ouverture de chaque section (Aujourd'hui, Ventes) : index.html la précharge quand il s'ouvre sur lui
      for (const f of r.faites) if (f.ouverture) sectionsOuverture.set(join(r.dirMorceau, f.fichier), f.ouverture);
      return { code: r.code, map: null };
    },
    resolveId(source, importer) {
      if (!importer || !source.startsWith('.')) return null;
      const abs = resoudreChemin(importer.split('?')[0], '..', source);
      return morceaux.has(abs) ? abs : null;
    },
    load(id) {
      if (!morceaux.has(id)) return null;
      const d = francaisSections.get(id);
      // son français d'abord (avant que le morceau ne s'évalue), comme fr-reste pour un écran à la demande
      return d ? `import { ajouterSourceSection as __vrmFr } from ${JSON.stringify(resoudreChemin(RACINE, 'src/i18n/index.js'))};\n__vrmFr(${JSON.stringify(d)});\n` + morceaux.get(id) : morceaux.get(id);
    },
  };
};
// (17 nov., lot vitesse-poids) LES NOMS COURTS, DONNÉS PAR FRÉQUENCE. esbuild minifie bien
// mais nomme les variables locales sans regarder leur usage ; terser (`mangle` SEUL : aucune
// réécriture du code, seulement les noms locaux) les nomme par fréquence, ce que gzip compresse
// mieux. Mesuré sur le morceau App : 1 640 → 1 589 Ko compressés (−3 %). Seuls les morceaux de
// l'app (src/) ; les bibliothèques déjà minifiées (maplibre, three…) ne sont pas touchées.
const nomsCourts = () => ({
  name: 'vrm-noms-courts',
  apply: 'build',
  async generateBundle(o, bundle) {
    // (28 nov., vitesse-fluide) `VRM_SANS_NOMS=1` (avec `--minify false`) : un build lisible pour les profils des bancs.
    if (process.env.VRM_SANS_NOMS === '1') return;
    const { minify } = exiger('terser');
    for (const c of Object.values(bundle)) {
      if (c.type !== 'chunk' || c.code.length < 20000) continue;
      const ids = c.moduleIds || Object.keys(c.modules || {});
      if (!ids.some((m) => /[\\/]src[\\/]/.test(m) && !/node_modules/.test(m))) continue;
      const r = await minify(c.code, { module: c.fileName.endsWith('.js') && o.format === 'es', ecma: 2020, compress: false, mangle: true });
      if (r && typeof r.code === 'string' && r.code.length) c.code = r.code;
    }
  },
});
// (20 nov., iphone-rapide) LES SÉLECTEURS RANGÉS : `X :is(.a, .b)` devient `X .a, X .b` dans chaque feuille (même
// sélection, même spécificité, même ordre) — le moteur de style range enfin ces règles par classe au lieu de les essayer
// sur chaque élément. Greffon PostCSS (avant le paquet : le nom du fichier livré suit son contenu). Règle et prudences :
// scripts/_selecteurs-ranges.cjs ; preuve : scripts/bancs/styles-identiques.cjs. Le dépôt garde les feuilles telles
// qu'écrites. `VRM_SANS_RANGER=1` livre les feuilles sans la réécriture (mesure avant/après).
const greffonsCss = process.env.VRM_SANS_RANGER === '1' ? [] : [exiger('./scripts/_selecteurs-ranges.cjs').greffonPostcss()];
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
      // (21 nov., lot personnel-compta) Le morceau de `Comptabilite` (src/ecrans/Comptabilite.jsx, rendu par Aujourd'hui) :
      // préchargé lui aussi, mais en BASSE priorité (`data-js-ensuite`) — le morceau App passe d'abord.
      const compta = Object.values(bundle).find((c) => c.type === 'chunk' && (c.moduleIds || Object.keys(c.modules || {})).some((m) => /[\\/]src[\\/]ecrans[\\/]Comptabilite\.jsx$/.test(m)));
      const ensuite = compta ? [compta.fileName, ...(compta.imports || [])].filter((f) => !deja.has(f) && !js.includes(f)) : [];
      // (27 nov., budget-vitesse) Les sections de Comptabilite que l'écran d'OUVERTURE montre (Aujourd'hui : sa section ;
      // Ventes : « À envoyer ») : préchargées comme Comptabilite, en basse priorité, seulement quand l'app s'ouvre sur cet
      // écran (demarrage-app.js lit `?tab=`, Aujourd'hui sans lien) — jamais un aller-retour de plus au premier écran.
      const parEcran = {};
      for (const c of Object.values(bundle)) {
        const e = c.type === 'chunk' && c.facadeModuleId && sectionsOuverture.get(c.facadeModuleId);
        if (!e) continue;
        const l = (parEcran[e] = parEcran[e] || []);
        for (const f of [c.fileName, ...(c.imports || [])]) if (!deja.has(f) && !js.includes(f) && !ensuite.includes(f) && !l.includes(f)) l.push(f);
      }
      const ouverture = Object.entries(parEcran).map(([e, l]) => e + '=' + l.map(base).join(',')).join(';');
      const attrs = { src: '/demarrage-app.js', 'data-js': js.map(base).join(','), 'data-css': css.filter((f) => !deja.has(f)).map(base).join(','), 'data-js-ensuite': ensuite.map(base).join(','), 'data-js-ouverture': ouverture };
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
  plugins: [francaisDiffere(), sectionsDifferees(), react(), allegerIndex(), versionEtat(), versionApp(), prechargerApp(), listeHorsLigne(), nomsCourts()],
  // (20 nov., affichage instantané) `VRM_COPIE_MUTATION=compte|panne` : la MUTATION des bancs copie-ecran (rouge attendu) ;
  // vide en production (le code mutant disparaît au build).
  define: { __BUILD__: JSON.stringify(BUILD), __VRM_COPIE_MUTATION__: JSON.stringify(process.env.VRM_COPIE_MUTATION || '') },
  css: { postcss: { plugins: greffonsCss } },
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
