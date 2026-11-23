// ═══════════════════════════════════════════════════════════════════════════
// BANC : AUCUNE CLÉ DE TRADUCTION BRUTE À L'ÉCRAN (le français des écrans chargé avec eux)
//        npm run build && node scripts/bancs/francais-differe.cjs [--prouve]
// ═══════════════════════════════════════════════════════════════════════════
// (17 nov., lot vitesse-poids — docs/passation/2026-11-17-vitesse-poids.md)
// Depuis le 17 nov., le français des écrans à la demande (fr-reste) n'est plus dans le
// morceau App : il arrive avec l'écran qui le lit (vite.config.js `francaisDiffere`).
// Une clé mal rangée s'afficherait BRUTE (« stats.titre »). Ce banc rend le VRAI build
// (base INVENTÉE de vitesse.cjs, aucune fx/, 390 px tactile) : Ma journée, Ventes,
// Bordereaux, Annonces, Achats, Messages, Tableau, Stock, Comptabilité, eBay, Republier, E-mails, Factures,
// Réglages, et sur chacun :
//   1. l'écran s'affiche (ni garde-fou ni erreur) ;
//   2. aucun mot du texte rendu n'est une clé du dictionnaire français complet (fr.js) ;
//   3. Ma journée seule : le fichier fr-reste n'est PAS téléchargé (le gain de poids).
// `--prouve` : le même build, mais fr-reste servi VIDE (copie de dist/ dans /tmp) ⇒ les
// écrans à la demande montrent des clés brutes ⇒ le banc doit rougir.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const R = path.join(__dirname, '..', '..');
const PROUVE = process.argv.includes('--prouve');
let copie = null;
if (PROUVE) {
  copie = fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-fr-mut-'));
  fs.cpSync(path.join(R, 'dist'), copie, { recursive: true, filter: (s) => !/\.(png|jpe?g|webp|zip|xpi|wasm|mp4|pdf)$/i.test(s) || /icon/.test(s) });
  const f = fs.readdirSync(path.join(copie, 'assets')).find((x) => /^fr-reste-.*\.js$/.test(x));
  if (!f) { console.log('❌ pas de fr-reste dans le build'); process.exit(2); }
  const src = fs.readFileSync(path.join(copie, 'assets', f), 'utf8');
  // garder l'import et l'appel, vider l'objet
  const vide = src.replace(/\(\{[\s\S]*\}\)/, '({})');
  fs.writeFileSync(path.join(copie, 'assets', f), vide);
  process.env.VITESSE_DIST = copie;
}
if (!process.env.BANC_PORT) process.env.BANC_PORT = '4879';
const V = require('./vitesse.cjs');

const TOUS = [
  ['journee', V.ECRANS[0][1]],
  ...['cat_ventes', 'cat_bord', 'cat_annonces', 'cat_achats', 'cat_msg', 'dashboard', 'garage', 'compta', 'plat_ebay', 'republier', 'emails', 'invoices', 'settings']
    .map((t) => [t, () => document.body && document.body.innerText.length > 300 && !document.querySelector('[data-chargement-ecran]')]),
];
const ECRANS = process.env.ECRANS ? TOUS.filter(([t]) => process.env.ECRANS.split(',').includes(t)) : TOUS;

(async () => {
  const fr = (await import(path.join(R, 'src', 'i18n', 'langues', 'fr.js'))).default;
  const cles = new Set(Object.keys(fr).filter((k) => /\./.test(k)));
  await V.demarrer();
  const b = await V.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server', '--explicitly-allowed-ports=' + V.PORT] });
  let ko = 0, bruts = 0;
  const dit = (c, m, d) => { if (!c) ko++; if (!PROUVE) console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
  try {
    for (const [tab, attendre] of ECRANS) {
      const r = await V.ouvrir(b, { width: 390, height: 844 }, tab, attendre, null, { memoire: false, capture: process.env.CAPTURES ? path.join(process.env.CAPTURES, tab + '.png') : null });
      const texte = (r.lu && r.lu.texte) || '';
      dit(!!texte && !(r.lu && r.lu.tombe) && !(r.errs || []).length, `${tab} : l'écran s'affiche`, (r.errs || []).slice(0, 2).join(' | '));
      const trouves = [...new Set((texte.match(/[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)+/g) || []).filter((w) => cles.has(w)))];
      bruts += trouves.length;
      dit(!trouves.length, `${tab} : aucune clé de traduction brute à l'écran`, trouves.slice(0, 5).join(', '));
      if (tab === 'journee') {
        const reste = (r.fichiers || []).filter((x) => /fr-reste-/.test(x.f) && !x.rechauffe);   // (le réchauffage du service worker, après l'ouverture, ne compte pas)
        dit(!reste.length, 'journee : le français des écrans à la demande n\'est pas téléchargé au démarrage', reste.map((x) => x.f).join(', '));
      }
    }
  } finally { await b.close(); await V.fermer(); if (copie) fs.rmSync(copie, { recursive: true, force: true }); }
  if (PROUVE) {
    const ok = bruts > 0;
    console.log(ok ? `✅ francais-differe --prouve : fr-reste vidé ⇒ ${bruts} clé(s) brute(s) vue(s), rouge` : '❌ francais-differe --prouve : fr-reste vidé et aucune clé brute vue (le banc ne regarde pas)');
    process.exit(ok ? 0 : 1);
  }
  console.log(ko ? `\n❌ francais-differe : ${ko} rouge(s)` : '\n✅ francais-differe : aucune clé brute, le reste arrive avec ses écrans');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); if (copie) fs.rmSync(copie, { recursive: true, force: true }); process.exit(2); });
