// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — L'OUVERTURE (15 nov., chantier « ouverture »)
//  Julien : « L'app bug quand je l'ouvre. » Récit : docs/passation/2026-11-15-ouverture.md.
//  Le banc (scripts/bancs/ouverture.cjs) rend l'app ; ici les RÈGLES, exécutées :
//   1. aucun `React.lazy` / `lazy` de React nu dans src/ : tout morceau à la demande passe
//      par `lazySur` (src/chargementSur.js) ;
//   2. `chargerSur` ne rend JAMAIS un module sans écran (`undefined` ⇒ React lirait
//      `undefined.default`) ; deux échecs + nouvelle version ⇒ promesse en attente
//      (rechargement), sinon erreur MARQUÉE (« Mettre à jour VRM ») ;
//   3. la garde des rechargements : une fois par version cible, trois en dix minutes au plus ;
//   4. `estErreurMorceau` reconnaît les messages relevés dans le journal des plantages ;
//   5. le rechargement OUBLIE la coquille du service worker (sinon A ▸ A ▸ B, mesuré) ;
//   6. l'écran de démarrage : le dégradé EXACT de la proposition 9 (`.d9`), la barre d'état
//      assortie (demarrage-theme.js), le manifeste, aucun script en ligne.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
const { pathToFileURL } = require('url');
const R = path.join(__dirname, '..');
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (!c && d !== undefined ? ' — ' + String(d).slice(0, 240) : '')); };
const sansCommentaires = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

(async () => {
  // 1. aucun lazy nu
  const fichiers = [];
  const parcourir = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) parcourir(p); else if (/\.(jsx?|mjs)$/.test(f.name)) fichiers.push(p); } };
  parcourir(path.join(R, 'src'));
  const nus = [];
  for (const f of fichiers) {
    if (/chargementSur\.js$/.test(f)) continue;
    const t = sansCommentaires(fs.readFileSync(f, 'utf8'));
    if (/React\.lazy\s*\(/.test(t) || /(^|[^\w.$])lazy\s*\(/.test(t) || /import\s*(React\s*,\s*)?\{[^}]*\blazy\b[^}]*\}\s*from\s*['"]react['"]/.test(t)) nus.push(path.relative(R, f));
  }
  dit(nus.length === 0, 'aucun React.lazy nu dans src/ (tout passe par lazySur)', nus.join(', '));
  const usages = fichiers.reduce((n, f) => n + (fs.readFileSync(f, 'utf8').match(/lazySur\(/g) || []).length, 0);
  dit(usages >= 30, 'lazySur sert les morceaux à la demande (' + usages + ' usages)');

  // 2. chargerSur, exécuté
  global.window = { dispatchEvent() {}, location: { reload() {} } };
  const cs = await import(pathToFileURL(path.join(R, 'src', 'chargementSur.js')).href);
  const ecran = { default: () => null };
  const rate = () => Promise.reject(new TypeError('Failed to fetch dynamically imported module: /assets/Reglages-x.js'));
  const jamaisVrai = async () => false, toujoursVrai = async () => true;
  dit(await cs.chargerSur(() => Promise.resolve(ecran), { relance: 1, verifier: jamaisVrai }) === ecran, 'un morceau qui arrive est rendu tel quel');
  { let n = 0; const m = await cs.chargerSur(() => (++n === 1 ? rate() : Promise.resolve(ecran)), { relance: 1, verifier: jamaisVrai }); dit(m === ecran && n === 2, 'raté une fois puis arrivé : relancé UNE fois, rendu'); }
  { let e = null; let n = 0; try { await cs.chargerSur(() => { n++; return rate(); }, { relance: 1, verifier: jamaisVrai }); } catch (x) { e = x; } dit(!!e && e.vrmMorceau === true && n === 2 && cs.estErreurMorceau(e), 'raté deux fois, même version : erreur MARQUÉE « morceau » (Mettre à jour VRM)', e && e.message); }
  { let e = null, rendu = 'rien'; try { rendu = await cs.chargerSur(() => Promise.resolve(undefined), { relance: 1, verifier: jamaisVrai }); } catch (x) { e = x; } dit(rendu === 'rien' && !!e && e.vrmMorceau === true, 'un module VIDE (undefined) n\'est jamais rendu à React.lazy (« reading \'default\' »)', String(rendu)); }
  { let e = null; try { await cs.chargerSur(() => Promise.resolve({ FactureVente: () => null }), { relance: 1, verifier: jamaisVrai }); } catch (x) { e = x; } dit(!!e && e.vrmMorceau === true, 'un module sans `default` (export renommé) n\'est jamais rendu'); }
  { let fini = false; cs.chargerSur(rate, { relance: 1, verifier: toujoursVrai }).then(() => { fini = true; }, () => { fini = true; }); await new Promise((r) => setTimeout(r, 60)); dit(!fini, 'raté deux fois, nouvelle version en ligne : la promesse RESTE en attente (l\'écran garde son attente, la page se recharge)'); }

  // 3. la garde
  const T = 1e12;
  dit(cs.rechargementPermis(null, 'b.js', T) === true, 'garde : un premier rechargement vers b.js est permis');
  dit(cs.rechargementPermis({ l: [{ cible: 'b.js', at: T - 1000 }] }, 'b.js', T) === false, 'garde : pas deux fois vers la MÊME version en dix minutes (jamais une boucle)');
  dit(cs.rechargementPermis({ l: [{ cible: 'b.js', at: T - 11 * 60e3 }] }, 'b.js', T) === true, 'garde : au-delà de dix minutes, de nouveau permis');
  dit(cs.rechargementPermis({ l: [{ cible: 'b.js', at: T - 1000 }] }, 'c.js', T) === true, 'garde : une AUTRE nouvelle version est permise');
  dit(cs.rechargementPermis({ l: [{ cible: 'a', at: T - 1 }, { cible: 'b', at: T - 2 }, { cible: 'c', at: T - 3 }] }, 'd', T) === false, 'garde : trois en dix minutes au plus');

  // 4. les messages relevés dans le journal des plantages (iOS Safari, Chrome)
  for (const m of ["Cannot read properties of undefined (reading 'default')", "undefined is not an object (evaluating 'f._result.default')", 'Unable to preload CSS for /assets/App-CqlTqPbu.css', 'Failed to fetch dynamically imported module: https://vrm.center/assets/Reglages-x.js', 'Importing a module script failed.'])
    dit(cs.estErreurMorceau(new Error(m)), 'reconnu comme morceau introuvable : « ' + m.slice(0, 60) + ' »');
  dit(!cs.estErreurMorceau(new Error("Cannot read properties of undefined (reading 'title')")), 'une vraie erreur d\'écran reste une erreur d\'écran');

  // 5. le rechargement oublie la coquille ; les rechargements de version passent par lui
  const src = sansCommentaires(fs.readFileSync(path.join(R, 'src', 'chargementSur.js'), 'utf8'));
  const corps = (/export async function rechargerVersNouvelle[\s\S]*?\n}\n/.exec(src) || [''])[0];
  dit(/oublierCoquille\(\)/.test(corps) && corps.indexOf('oublierCoquille()') < corps.indexOf('location.reload()'), 'rechargerVersNouvelle oublie la coquille AVANT de relire la page');
  const sw = fs.readFileSync(path.join(R, 'public', 'sw.js'), 'utf8');
  const nomCache = (/const CACHE = '([^']+)'/.exec(sw) || [])[1] || '';
  dit(/^vrm-shell/.test(nomCache), 'la coquille du service worker vit dans une réserve « vrm-shell* » (celle qu\'on oublie)', nomCache);
  const main = sansCommentaires(fs.readFileSync(path.join(R, 'src', 'main.jsx'), 'utf8'));
  const ecoute = (/addEventListener\('vite:preloadError'[\s\S]*?\}\);/.exec(main) || [''])[0];
  dit(!/location\.reload\(/.test(ecoute) && /verifierMorceauPerime\(/.test(ecoute) && !/preventDefault\(/.test(ecoute), 'vite:preloadError : plus de rechargement aveugle, jamais preventDefault, la version est relue');
  dit(/rechargerVersNouvelle\(\{ cible: fp/.test(main), 'la vérification de version recharge par rechargerVersNouvelle (coquille oubliée, garde)');
  dit(/estErreurMorceau\(this\.state\.err\)/.test(main) && /estErreurMorceau\(this\.state\.err\)/.test(fs.readFileSync(path.join(R, 'src', 'composants', 'GardeEcran.jsx'), 'utf8')), 'le dernier filet et chaque garde-fou montrent « Mettre à jour VRM » pour un morceau');

  // 6. l'écran de démarrage
  const html = fs.readFileSync(path.join(R, 'index.html'), 'utf8');
  const D9 = ['radial-gradient(120% 60% at 15% 0%,#9CC8F2 0%,rgba(156,200,242,0) 55%)', 'radial-gradient(70% 45% at 100% 38%,#3D8BE0 0%,rgba(61,139,224,0) 70%)', 'radial-gradient(80% 50% at 0% 78%,#6FAEEB 0%,rgba(111,174,235,0) 70%)', 'linear-gradient(170deg,#2C71BE 0%,#174C88 45%,#0F2F57 100%)'];
  const fond = (/--vrm-verre-fond:([^;]+);/.exec(html) || [])[1] || '';
  dit(fond === D9.join(','), 'le dégradé de l\'écran de démarrage = la proposition 9 « Verre dépoli », valeur pour valeur', fond.slice(0, 120));
  dit(/--vrm-verre-fond-nuit:radial-gradient/.test(html) && /html\[data-theme="dark"\] #vrm-demarrage\{background:var\(--vrm-verre-fond-nuit\)/.test(html), 'le bleu-nuit en sombre');
  dit(/#vrm-demarrage \.vrm-boot-rail>span\{[^}]*width:calc\(var\(--vrm-boot-p\) \* 100%\)/.test(html) && !/%<\/|\d+ ?%\s*<\/span/.test((/<div id="vrm-demarrage"[\s\S]*?\n<\/div>/.exec(html) || [''])[0]), 'la progression suit les jalons (--vrm-boot-p), aucun pourcentage écrit');
  dit(/animation:vrmBootLent \.4s ease 8s forwards/.test(html), 'la phrase « lente » et « Recharger » au-delà de 8 s');
  const boot = (/<div id="vrm-demarrage"[\s\S]*?\n<\/div>/.exec(html) || [''])[0];
  dit(!/<script(?![^>]*type="application\/ld\+json")[^>]*>[^<]+<\/script>/.test(html) && !/\son[a-z]+=/.test(boot), 'aucun script en ligne, aucun gestionnaire en ligne (CSP)');
  const theme = fs.readFileSync(path.join(R, 'public', 'demarrage-theme.js'), 'utf8');
  const clair = (/BOOT_CLAIR = '(#[0-9A-F]{6})'/.exec(theme) || [])[1], nuit = (/BOOT_NUIT = '(#[0-9A-F]{6})'/.exec(theme) || [])[1];
  dit(!!clair && !!nuit && /data-vrm-boot/.test(theme), 'la barre d\'état prend le haut du dégradé pendant le démarrage', clair + ' / ' + nuit);
  dit(new RegExp('<meta name="theme-color" content="' + clair + '"').test(html), 'la balise theme-color d\'index.html part déjà de ce bleu (avant tout script)');
  const man = JSON.parse(fs.readFileSync(path.join(R, 'public', 'manifest.webmanifest'), 'utf8'));
  const bleuFonce = (c) => { const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(c || ''); return !!m && parseInt(m[3], 16) - parseInt(m[1], 16) >= 60; };
  dit(bleuFonce(man.background_color) && man.theme_color === clair, 'manifeste : fond de lancement bleu, couleur du thème = haut du dégradé', man.background_color + ' / ' + man.theme_color);

  console.log(ko ? `\n❌ audit-ouverture : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ audit-ouverture : ${ok} vert(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ ' + (e && e.stack || e)); process.exit(1); });
