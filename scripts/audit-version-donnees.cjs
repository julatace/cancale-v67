// ════════════════════════════════════════════════════════════════════════════
//  UN CALCUL MÉMORISÉ VOIT TOUTE ÉCRITURE DU STOCKAGE QU'IL A LU (18 nov., moteur-rapide)
//  node scripts/audit-version-donnees.cjs            → exécute src/versionDonnees.js (vrai module)
//  node scripts/audit-version-donnees.cjs --prouve   → les mêmes contrôles sur des copies affaiblies ⇒ rouges
//
//  `commandesAVerifier` (Ma journée) n'est refait que si sa clé change ET qu'aucune clé du
//  stockage qu'il a lue n'a été écrite (`suivreStockage` / `stockageInchange`). Un suivi qui
//  raterait une écriture montrerait un résultat PÉRIMÉ sans rien dire : cet audit EXÉCUTE le
//  module dans un faux navigateur (un `Storage` à la forme du vrai : localStorage et
//  sessionStorage, deux instances du même prototype) et joue chaque cas.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const os = require('os');
const { pathToFileURL } = require('url');
const R = path.join(__dirname, '..');
const SOURCE = path.join(R, 'src', 'versionDonnees.js');

function fauxNavigateur() {
  class Storage { constructor() { this._m = new Map(); } getItem(k) { return this._m.has(String(k)) ? this._m.get(String(k)) : null; }
    setItem(k, v) { this._m.set(String(k), String(v)); } removeItem(k) { this._m.delete(String(k)); } clear() { this._m.clear(); } }
  const ecouteurs = {};
  const w = { Storage, localStorage: new Storage(), sessionStorage: new Storage(),
    addEventListener: (t, f) => { (ecouteurs[t] = ecouteurs[t] || []).push(f); },
    emettre: (t, e) => { for (const f of ecouteurs[t] || []) f(e); } };
  return w;
}

async function controler(fichier) {
  const w = fauxNavigateur();
  global.window = w;
  const tmp = path.join(os.tmpdir(), `version-donnees-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(tmp, fs.readFileSync(fichier, 'utf8'));
  let m;
  try { m = await import(pathToFileURL(tmp).href); } finally { fs.unlinkSync(tmp); }
  const L = w.localStorage, Ss = w.sessionStorage;
  const res = [];
  const ok = (nom, v) => res.push([nom, !!v]);
  const lireA = () => L.getItem('a');
  L.setItem('a', '1'); L.setItem('b', '1');
  let s = m.suivreStockage(() => { lireA(); return 42; });
  ok('le résultat du calcul est rendu', s.r === 42);
  ok('rien écrit depuis le calcul ⇒ inchangé', m.stockageInchange(s.lu));
  L.setItem('b', '2');
  ok('une clé NON lue écrite ⇒ toujours inchangé (le calcul n\'est pas refait pour rien)', m.stockageInchange(s.lu));
  Ss.setItem('a', 'x');
  ok('sessionStorage écrit sous le même nom ⇒ inchangé (ce n\'est pas ce qu\'il a lu)', m.stockageInchange(s.lu));
  L.setItem('a', '1');
  ok('la clé LUE réécrite (même valeur) ⇒ changé', !m.stockageInchange(s.lu));
  s = m.suivreStockage(lireA); L.removeItem('a');
  ok('la clé lue retirée ⇒ changé', !m.stockageInchange(s.lu));
  s = m.suivreStockage(lireA); L.clear();
  ok('localStorage vidé ⇒ changé', !m.stockageInchange(s.lu));
  s = m.suivreStockage(lireA); w.emettre('storage', { key: 'a' });
  ok('la clé lue écrite par un AUTRE onglet ⇒ changé', !m.stockageInchange(s.lu));
  s = m.suivreStockage(lireA); w.emettre('storage', { key: null });
  ok('un autre onglet a tout vidé ⇒ changé', !m.stockageInchange(s.lu));
  s = m.suivreStockage(() => m.suivreStockage(lireA).r);
  L.setItem('a', '3');
  ok('une clé lue par un calcul IMBRIQUÉ compte pour le calcul qui l\'appelle', !m.stockageInchange(s.lu));
  let leve = false; try { m.suivreStockage(() => { throw new Error('x'); }); } catch (_) { leve = true; }
  s = m.suivreStockage(() => 1); L.getItem('a');
  ok('un calcul qui lève ne laisse pas le suivi allumé (une lecture d\'après n\'y entre pas)', leve && s.lu.cles.length === 0);
  ok('un `null` (aucun calcul gardé) n\'est jamais « inchangé »', !m.stockageInchange(null));
  const v0 = m.versionMemoire(); m.toucherMemoire();
  ok('toucherMemoire monte la version de la mémoire', m.versionMemoire() === v0 + 1);
  delete global.window;
  return res;
}

const MUTANTS = [
  ['setItem ne compte plus', (t) => t.replace("S.setItem = function (k, v) { if (local.call(this)) ecrite(k);", "S.setItem = function (k, v) {")],
  ['getItem ne note plus la clé', (t) => t.replace('if (notees && local.call(this)) notees.add(String(k)); ', '')],
  ['removeItem ne compte plus', (t) => t.replace("S.removeItem = function (k) { if (local.call(this)) ecrite(k);", "S.removeItem = function (k) {")],
  ['l\'évènement storage ignoré', (t) => t.replace("if (e && e.key != null) ecrite(e.key); else epoque += 1;", '')],
  ['imbriqué non remonté', (t) => t.replace('if (avant) for (const k of ici) avant.add(k);', '')],
  ['inchangé sans comparer les versions', (t) => t.replace('if (versionCle(k) !== v) return false;', '')],
];

(async () => {
  if (process.argv.includes('--prouve')) {
    const src = fs.readFileSync(SOURCE, 'utf8');
    let rouges = 0;
    for (const [nom, f] of MUTANTS) {
      const t = f(src);
      if (t === src) { console.log(`  ✗ mutant « ${nom} » : texte introuvable`); continue; }
      const tmp = path.join(os.tmpdir(), `vd-mutant-${process.pid}.js`); fs.writeFileSync(tmp, t);
      const r = await controler(tmp); fs.unlinkSync(tmp);
      const ko = r.filter(([, v]) => !v).map(([n]) => n);
      if (ko.length) { rouges++; console.log(`  ✓ mutant « ${nom} » ⇒ rouge (${ko[0]})`); } else console.log(`  ✗ mutant « ${nom} » reste VERT`);
    }
    console.log(`\naudit-version-donnees --prouve : ${rouges}/${MUTANTS.length} mutants rouges`);
    process.exit(rouges === MUTANTS.length ? 0 : 1);
  }
  const r = await controler(SOURCE);
  for (const [n, v] of r) console.log(`  ${v ? '✅' : '❌'} ${n}`);
  const ko = r.filter(([, v]) => !v).length;
  console.log(`\naudit-version-donnees : ${r.length - ko} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
