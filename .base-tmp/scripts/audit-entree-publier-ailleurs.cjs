// ════════════════════════════════════════════════════════════════════════════
//  AUDIT « L'ENTRÉE « PUBLIER AILLEURS » TIENT DANS L'ÉCRAN » (5 nov.)
//
//  Mesuré au banc double-vente (390 px tactile, capture regardée) : la carte
//  « Publier une annonce Vinted sur Leboncoin » d'Annonces · Leboncoin sortait de
//  l'écran à droite. Cause : `styles-mineral.css` pose `width:100%` sur chaque
//  `div` enfant de `.vrm-market-space[aria-label="Leboncoin"|"eBay"]`, et
//  `.vrm-pa-entree` a 16 px de marge de chaque côté ⇒ 390 px de large posés à
//  16 px du bord.
//
//  Cet audit EXÉCUTE la vraie feuille de style compilée (`dist/assets/*.css`, la
//  cascade de production) sur le DOM de l'entrée, à 390 et 1512 px, pour les trois
//  sites où elle vit, et exige : la carte entière dans l'écran, 16 px de marge à
//  droite comme à gauche. Lancer après `npm run build` (BANC_DIST pour un autre
//  build). Aucune donnée.
// ════════════════════════════════════════════════════════════════════════════
const path = require('path'), fs = require('fs');
const { chromium } = require(path.join(__dirname, '..', 'node_modules', 'playwright'));
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', 'dist');

let ko = 0;
const dit = (bon, quoi, detail) => { if (!bon) ko++; console.log(`  ${bon ? '✅' : '❌'} ${quoi}${detail ? ' — ' + detail : ''}`); };

(async () => {
  const dossier = path.join(DIST, 'assets');
  if (!fs.existsSync(dossier)) { console.log('  ❌ pas de build : lance `npm run build` d\'abord'); process.exit(1); }
  // L'ordre de la page : la feuille liée par index.html, puis celles des morceaux.
  const index = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
  const liees = [...index.matchAll(/href="\/assets\/([^"]+\.css)"/g)].map((m) => m[1]);
  const toutes = fs.readdirSync(dossier).filter((f) => f.endsWith('.css'));
  const ordre = [...liees, ...toutes.filter((f) => !liees.includes(f))];
  const css = ordre.map((f) => fs.readFileSync(path.join(dossier, f), 'utf8')).join('\n');
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  try {
    for (const largeur of [390, 1512]) {
      const pg = await nav.newPage({ viewport: { width: largeur, height: 900 } });
      const sites = [['leboncoin', 'Leboncoin'], ['ebay', 'eBay'], ['vestiaire', 'Vestiaire Collective']];
      const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body style="margin:0"><div class="vrm-app-shell"><main class="vrm-main"><section class="vrm-tache">${
        sites.map(([s, nom]) => `<section class="vrm-market-space" aria-label="${nom}"><div class="vrm-pa-entree" data-pa-entree="${s}"><button type="button"><span>V</span><span>Publier une annonce Vinted sur ${nom}<small>Vérifier · ce qui part · publier · suivi</small></span><span aria-hidden="true">›</span></button></div></section>`).join('')
      }</section></main></div></body></html>`;
      await pg.setContent(html);
      const mesures = await pg.evaluate(() => [...document.querySelectorAll('[data-pa-entree]')].map((d) => { const r = d.querySelector('button').getBoundingClientRect(); return { site: d.getAttribute('data-pa-entree'), g: Math.round(r.left), d: Math.round(r.right), cw: document.documentElement.clientWidth }; }));
      for (const m of mesures) {
        dit(m.d <= m.cw && m.g >= 0, `${largeur} px · ${m.site} : la carte tient dans l'écran`, `de ${m.g} à ${m.d} (écran ${m.cw})`);
        dit(Math.abs((m.cw - m.d) - m.g) <= 1, `${largeur} px · ${m.site} : même marge à gauche et à droite`, `${m.g} / ${m.cw - m.d}`);
      }
      await pg.close();
    }
  } catch (e) { dit(false, 'l\'audit a tourné jusqu\'au bout', String(e && e.message).slice(0, 160)); }
  finally { await nav.close(); }
  console.log(ko ? `\n❌ entrée « Publier ailleurs » : ${ko} rouge(s)` : '\n✅ entrée « Publier ailleurs » : tout est vert');
  process.exit(ko ? 1 : 0);
})();
