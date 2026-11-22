#!/usr/bin/env node
require('./_source-app.cjs').brancher();   // (22 nov., intégration finale) Comptabilite vit dans src/ecrans/ : la lecture d'App.jsx rend le texte entier
// Audit (19 nov.) : « À RETIRER » SOUS UN FILTRE DE SITE — LES NOMBRES ET LA LISTE, UNE SEULE RÈGLE.
// Capture iPhone de Julien (Achats · Leboncoin) : « À retirer · 15 · 2 d'ici demain · 15 avec code · 5 à vérifier »,
// et aucun colis dessous (les nombres de TOUS les sites, la liste de Leboncoin). La règle : src/retirerSite.js.
// Exécute la vraie règle (pas son orthographe) puis vérifie que l'écran la branche.
// `--prouve` : chaque mutation de la règle doit rendre l'audit rouge.
const fs = require('fs'), path = require('path'), os = require('os');
const RACINE = process.env.AUDIT_RACINE || path.join(__dirname, '..');
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; if (!process.env.MUET) console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };

async function charger(src) {
  const f = path.join(os.tmpdir(), `retirer-site-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(f, src);
  try { return await import('file://' + f); } finally { try { fs.unlinkSync(f); } catch (_) {} }
}

async function juger(src, app) {
  ko = 0; ok = 0;
  let R;
  try { R = await charger(src); } catch (e) { dit(false, 'la règle se charge', String(e.message).slice(0, 120)); return ko; }
  const { chiffresRetirer, siteDuColisSorti } = R;
  if (typeof chiffresRetirer !== 'function') { dit(false, 'chiffresRetirer existe'); return ko; }
  const pub = { total: 15, urgents: 2 };
  const union = { prets: 15, aVerifier: [1, 2, 3], aConfirmer: [4, 5] };
  // Les colis Vinted de Julien : la colonne filtrée sur Leboncoin est VIDE.
  const vide = { cartes: [] };
  const l = chiffresRetirer({ site: 'leboncoin', pub, union, colRet: vide, lu: true });
  dit(l.filtre === true && l.n === 0 && l.urgents === 0 && l.prets === 0 && l.aVerifier === 0, 'Leboncoin sans colis : 0 partout (pas 15 · 2 · 15 · 5)', JSON.stringify(l));
  dit(l.vide === true, 'Leboncoin sans colis : « vide » (l’écran le dit)');
  const t = chiffresRetirer({ site: 'toutes', pub, union, colRet: { cartes: [{ cle: 'a' }] }, lu: true });
  dit(t.filtre === false && t.n === 15 && t.urgents === 2 && t.prets === 15 && t.aVerifier === 5, 'Toutes (Achats · Vinted) : la publication, inchangée', JSON.stringify(t));
  // Une colonne de site : compter les MÊMES cartes que la liste ; un « horsCompte » est visible, jamais compté.
  const col = { cartes: [
    { cle: 'r:e:1', jours: 0, code: '111111' },
    { cle: 'r:e:2', jours: 5, qr: true },
    { cle: 'r:e:3', jours: null },
    { cle: 'r:e:5', jours: 2 },
    { cle: 'r:e:4', jours: 1, code: '222222', horsCompte: true },
  ] };
  const e = chiffresRetirer({ site: 'ebay', pub, union, colRet: col, lu: true });
  dit(e.n === 4 && e.urgents === 1 && e.prets === 2 && e.aVerifier === 1 && e.vide === false, 'un site : les nombres de SA colonne (4 · 1 d’ici demain · 2 avec code · 1 à vérifier)', JSON.stringify(e));
  const p = chiffresRetirer({ site: 'leboncoin', pub, union, colRet: vide, lu: false });
  dit(p.n === null && p.vide === false, 'pas lu ⇒ « — » (null), jamais « aucun colis »', JSON.stringify(p));
  if (typeof siteDuColisSorti === 'function') {
    const aa = new Map([['ABC', { site: 'leboncoin' }]]);
    const su = (x) => x.suivi;
    dit(siteDuColisSorti({ t: { suivi: 'ABC' } }, { achatsAutres: aa, suiviDe: su }) === 'leboncoin' && siteDuColisSorti({ t: { suivi: 'XYZ' } }, { achatsAutres: aa, suiviDe: su }) === 'vinted'
      && siteDuColisSorti({ o: { transaction_id: 1 }, t: { suivi: 'ABC' } }, { achatsAutres: aa, suiviDe: su }) === 'vinted', 'un colis sorti : son site par identité (n° de suivi d’un achat d’un autre site), sinon Vinted');
  } else dit(false, 'siteDuColisSorti existe');
  // Le branchement : l'écran lit la règle pour le grand chiffre, « d'ici demain », le résumé, et dit le vide.
  if (app != null) {
    const a = app.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, '');
    dit(/chiffresRetirer\(\{\s*site:\s*siteColis/.test(a), 'App : la règle reçoit le site choisi');
    dit(/const nTete = achatsSec \? chRet\.n/.test(a) && /achatsSec \? chRet\.urgents/.test(a), 'App : le grand chiffre et « d’ici demain » d’Achats viennent de la règle');
    dit(/\['code', chRet\.prets/.test(a) && /\['verifier', chRet\.aVerifier/.test(a), 'App : « avec code » et « à vérifier » viennent de la règle');
    dit(/achats\.retirer\.aucunSite/.test(a), 'App : « Aucun colis {site} à retirer » est dit');
  }
  return ko;
}

(async () => {
  const src = fs.readFileSync(path.join(RACINE, 'src', 'retirerSite.js'), 'utf8');
  const app = fs.readFileSync(path.join(RACINE, 'src', 'App.jsx'), 'utf8');
  if (process.argv.includes('--prouve')) {
    process.env.MUET = '1';
    const temoin = await juger(src, null);
    console.log(temoin ? `❌ témoin rouge (${temoin})` : '✅ témoin vert');
    const mutations = [
      ['le site ignoré (toujours la publication)', (s) => s.replace("if (!site || site === 'toutes') {", 'if (true) {')],
      ['le horsCompte compté', (s) => s.replace('const cpt = cartes.filter((c) => !c.horsCompte);', 'const cpt = cartes;')],
      ['« pas lu » rendu 0', (s) => s.replace("if (!lu) return { filtre: true, site, n: null", "if (!lu) return { filtre: true, site, n: 0")],
      ['« d’ici demain » à 2 jours', (s) => s.replace('c.jours <= 1).length', 'c.jours <= 2).length')],
      ['le sorti toujours Vinted', (s) => s.replace("return aa && aa.site ? aa.site : 'vinted';", "return 'vinted';")],
    ];
    let rate = 0;
    for (const [nom, f] of mutations) { const m = f(src); if (m === src) { console.log(`❌ mutation « ${nom} » ne s'applique pas`); rate++; continue; } const r = await juger(m, null); console.log(r ? `✅ mutation « ${nom} » : rouge (${r})` : `❌ mutation « ${nom} » : reste verte`); if (!r) rate++; }
    process.exit(temoin || rate ? 1 : 0);
  }
  const r = await juger(src, app);
  console.log(r ? `\n❌ ${ko} rouge(s), ${ok} vert(s)` : `\n✅ À retirer sous un filtre de site : ${ok} verts`);
  process.exit(r ? 1 : 0);
})().catch((e) => { console.log('❌ ' + e.message); process.exit(1); });
