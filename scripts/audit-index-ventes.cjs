// ════════════════════════════════════════════════════════════════════════════
//  INDEX DES VENTES (16 nov., lot vitesse-moteur) — src/indexVentes.js
//  node scripts/audit-index-ventes.cjs [--prouve]
//
//  L'index ne décide rien : il rend un SUR-ENSEMBLE, dans l'ordre de la liste, sur lequel l'appelant
//  applique SA règle. Ce contrôle EXÉCUTE les règles telles qu'elles sont écrites dans App.jsx
//  (fenêtre des 45 jours de « Envoyés » et des cartes « Partis », ventes à expédier, preuve de départ)
//  sur 20 000 ventes inventées — dates lues, illisibles, absentes, futures, au bord de la fenêtre,
//  lignes vides, n° en double — et exige le MÊME résultat, dans le MÊME ordre, qu'avec la liste entière.
//  Il vérifie aussi qu'App.jsx passe bien par l'index aux endroits prévus.
//  --prouve : mutations (fenêtre trop étroite, spéciales oubliées, ordre de la liste perdu, version
//  ignorée) ⇒ chacune doit faire rougir le contrôle.
// ════════════════════════════════════════════════════════════════════════════
const path = require('path');
const fs = require('fs');
const R = path.join(__dirname, '..');
let ko = 0;
const dit = (c, m) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m); };
const JOUR = 86400000;

function base(n, graine) {
  let x = graine; const rnd = () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; };
  const now = Date.now(); const out = [];
  for (let i = 0; i < n; i++) {
    const r = rnd();
    let date;
    if (r < 0.03) date = undefined;
    else if (r < 0.05) date = 'pas une date';
    else if (r < 0.06) date = new Date(now + rnd() * 5 * JOUR).toISOString();          // futur
    else if (r < 0.12) date = new Date(now - (44 + rnd() * 4) * JOUR).toISOString();   // bord de la fenêtre
    else date = new Date(now - rnd() * 900 * JOUR).toISOString();
    const tx = r > 0.995 && i > 0 ? out[i - 1] && out[i - 1].transaction_id : 1000000 + i;   // quelques n° en double
    out.push(rnd() < 0.002 ? null : { transaction_id: tx, date, aExp: rnd() < 0.05 });
  }
  return out;
}

(async () => {
  const src = fs.readFileSync(path.join(R, 'src', 'indexVentes.js'), 'utf8');
  const prouve = process.argv.includes('--prouve');
  const mutations = [
    ['fenêtre sans marge', (s) => s.replace('(jours + 2) * JOUR', '(jours - 1) * JOUR')],
    ['lignes sans date oubliées', (s) => s.replace('const idx = e.speciales.slice();', 'const idx = [];')],
    ['ordre de la liste perdu', (s) => s.replace('idx.sort((a, b) => a - b);', '')],
    ['version ignorée', (s) => s.replace('f.ver === ver && ', '')],
  ];
  const essais = prouve ? mutations : [['code tel quel', (s) => s]];
  for (const [nom, muter] of essais) {
    const f = path.join(require('os').tmpdir(), `indexVentes-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
    fs.writeFileSync(f, muter(src));
    const M = await import('file://' + f);
    fs.unlinkSync(f);
    const avant = ko;
    const msMemo = new WeakMap();
    const msDe = (o) => { let v = msMemo.get(o); if (v === undefined) { v = new Date(o.date).getTime(); msMemo.set(o, v); } return v; };
    for (const graine of [7, 42, 2026]) {
      const items = base(20000, graine);
      const cache = new Set(items.filter((o, i) => o && i % 37 === 0).map((o) => String(o.transaction_id)));
      // 1) « Envoyés » (listeEnvoyes) : `j != null && j > 45` ⇒ écartée (NaN passe).
      const regleEnv = (liste) => { const out = []; for (const o of liste) { if (!o || cache.has(String(o.transaction_id))) continue; const j = o.date ? Math.floor((Date.now() - msDe(o)) / JOUR) : null; if (j != null && j > 45) continue; out.push([o.transaction_id, j]); } return JSON.stringify(out); };
      // 2) cartes « Partis » (cartesColis) : `j == null || j <= 45` (NaN écartée).
      const reglePartis = (liste) => JSON.stringify(liste.filter((o) => o && !cache.has(String(o.transaction_id))).map((o) => ({ o, j: o.date ? Math.floor((Date.now() - msDe(o)) / JOUR) : null })).filter((x) => x.j == null || x.j <= 45).map((x) => [x.o.transaction_id, x.j]));
      const plein = items, idx = M.recentesOuSansDate(items, 45, msDe);
      dit(regleEnv(idx) === regleEnv(plein), `[${nom}] graine ${graine} · « Envoyés » : mêmes ventes, même ordre (${idx.length} lues au lieu de ${items.length})`);
      dit(reglePartis(idx) === reglePartis(plein), `[${nom}] graine ${graine} · cartes « Partis » : mêmes ventes, même ordre`);
      // 3) ventes à expédier : filtre pur, gardé par version.
      let ver = 1; const etat = new Map();
      const aE = (o) => !!(o && o.aExp) && !etat.has(o.transaction_id);
      const expPlein = () => JSON.stringify(items.filter((o) => o && !cache.has(String(o.transaction_id))).filter((o) => aE(o)).map((o) => o.transaction_id));
      const expIdx = () => JSON.stringify(M.filtreParVersion(items, 'aE', aE, ver).filter((o) => o && !cache.has(String(o.transaction_id))).map((o) => o.transaction_id));
      dit(expIdx() === expPlein(), `[${nom}] graine ${graine} · ventes à expédier : mêmes ventes, même ordre`);
      const une = items.find((o) => o && o.aExp); etat.set(une.transaction_id, 1); ver = 2;   // la transaction change d'état ⇒ version neuve
      dit(expIdx() === expPlein(), `[${nom}] graine ${graine} · ventes à expédier : une transaction relue (version neuve) est prise en compte`);
      // 4) preuve de départ : les positions par n°, dans l'ordre de la liste.
      const partis = new Map(items.filter((o, i) => o && i % 53 === 0).map((o) => [String(o.transaction_id), { type: 'email' }]));
      const reglePreuve = (liste) => JSON.stringify(liste.filter((o) => { const tx = o && o.transaction_id != null ? String(o.transaction_id) : ''; return tx && partis.get(tx); }).map((o) => items.indexOf(o)));
      const pos = []; { const ix = M.parTransaction(items); for (const tx of partis.keys()) { const l = ix.get(String(tx)); if (l) pos.push(...l); } }
      pos.sort((a, b) => a - b);
      const parIdx = pos.filter((p, k) => k === 0 || pos[k - 1] !== p).map((p) => items[p]);
      dit(reglePreuve(parIdx) === reglePreuve(plein), `[${nom}] graine ${graine} · preuve de départ : mêmes ventes, même ordre`);
    }
    if (prouve) { const rouge = ko > avant; ko = avant; dit(rouge, `mutation « ${nom} » ⇒ rouge`); }
  }
  // App.jsx passe par l'index (un retour en arrière ne passerait pas inaperçu).
  const app = fs.readFileSync(path.join(R, 'src', 'App.jsx'), 'utf8');
  dit((app.match(/recentesOuSansDate\(sales\.items, /g) || []).length === 2, 'App.jsx : « Envoyés » et les cartes « Partis » lisent la fenêtre par l\'index');
  dit(/filtreParVersion\(sales\.items \|\| \[\], 'aExpedier', aExpedier, TXN_ETATS\.ver \|\| 0\)/.test(app), 'App.jsx : les ventes à expédier gardées par version de TXN_ETATS');
  dit(/parTransaction\(sales\.items\)/.test(app), 'App.jsx : la preuve de départ lue par n° de transaction');
  console.log(ko ? `\n❌ ${ko} rouge(s)` : '\n✅ index des ventes : mêmes lignes, même ordre');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
