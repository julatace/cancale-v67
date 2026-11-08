// ════════════════════════════════════════════════════════════════════════════
//  LA FUSION DE LA LIGNE `main` (src/fusionNuage.js) — EXÉCUTÉE (1er nov.)
//
//  La règle qui remplace « le dernier appareil qui enregistre réécrit tout ».
//  On exécute le VRAI module (import dynamique), jamais une copie :
//   · deux appareils, deux clés ⇒ les deux restent ;
//   · la même carte (prix d'achat par N°, colis cochés, mois déclarés, liens
//     eBay/Leboncoin) ⇒ chaque sous-clé de chaque côté reste ; une suppression
//     faite d'un côté reste faite ; une liste garde ajouts et retraits ;
//   · une clé que personne n'a touchée garde la valeur du nuage ;
//   · les NUMÉROS (§5) : pool = union, jamais rétréci ; une fiche renumérotée
//     des deux côtés, deux paires sous un N° que personne n'y mettait, un N°
//     neuf donné des deux côtés à deux paires ⇒ REFUS (`conflit`), rien écrit ;
//     un doublon déjà présent d'un côté n'est pas inventé par la fusion ;
//     `vrm_numerotation` = celui du nuage, toujours.
//   · App.jsx : `cloudPush` passe par `fusionnerLigne` et un PATCH conditionnel
//     sur `data->>rev` ; la relecture au premier plan existe.
//  `--prouve` : chaque mutation de la règle doit rendre au moins un rouge.
// ════════════════════════════════════════════════════════════════════════════
require('./_source-app.cjs').brancher(); // (8 nov.) App.jsx découpé : sa lecture texte rend aussi src/ecrans/*.jsx
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { pathToFileURL } = require('node:url');
const racine = path.join(__dirname, '..');
const SRC = path.join(racine, 'src', 'fusionNuage.js');
const cleNum = (v) => { const s = String(v == null ? '' : v).toUpperCase().replace(/\s+/g, ''); const m = /^([A-Z]*)0*(\d+)$/.exec(s); return m ? m[1] + m[2] : s; };

async function juger(fichier, bavard) {
  const M = await import(pathToFileURL(fichier).href + '?t=' + Date.now() + Math.random());
  let ko = 0;
  const dit = (c, m, d) => { if (!c) ko++; if (bavard) console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
  const F = (base, local, nuage, cles) => M.fusionnerLigne({ cles: cles || [...new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(nuage)])], base, local, nuage, cleNum });
  // 1. Deux clés.
  { const r = F({ vrm_prenom: '', vinted_dark: false }, { vrm_prenom: '', vinted_dark: true }, { vrm_prenom: 'Julien', vinted_dark: false });
    dit(r.data && r.data.vrm_prenom === 'Julien' && r.data.vinted_dark === true, 'deux appareils, deux clés : les deux restent', JSON.stringify(r)); }
  // 2. La même carte (prix d'achat par N°).
  { const r = F({ vinted_buyprice_by_num: { 1: '10' } }, { vinted_buyprice_by_num: { 1: '10', 6: '60' } }, { vinted_buyprice_by_num: { 1: '10', 5: '50' } });
    dit(r.data && r.data.vinted_buyprice_by_num['5'] === '50' && r.data.vinted_buyprice_by_num['6'] === '60', 'prix d\'achat : N°5 d\'un côté, N°6 de l\'autre ⇒ les deux', JSON.stringify(r.data)); }
  { const r = F({ vinted_buyprice_by_num: { 1: '10', 2: '20' } }, { vinted_buyprice_by_num: { 1: '10' } }, { vinted_buyprice_by_num: { 1: '10', 2: '20', 3: '30' } });
    dit(r.data && !('2' in r.data.vinted_buyprice_by_num) && r.data.vinted_buyprice_by_num['3'] === '30', 'un prix effacé ici reste effacé, celui ajouté là-bas reste', JSON.stringify(r.data)); }
  // 3. Colis cochés (objet) et retirés (liste).
  { const r = F({ vinted_ship_done: {}, vrm_colis_collected: ['a'] }, { vinted_ship_done: { t1: true }, vrm_colis_collected: ['a', 'b'] }, { vinted_ship_done: { t2: true }, vrm_colis_collected: ['c'] });
    dit(r.data && r.data.vinted_ship_done.t1 && r.data.vinted_ship_done.t2, 'colis cochés des deux côtés ⇒ les deux', JSON.stringify(r.data && r.data.vinted_ship_done));
    dit(r.data && JSON.stringify([...r.data.vrm_colis_collected].sort()) === '["b","c"]', 'liste : « a » retiré là-bas, « b » ajouté ici ⇒ b, c', JSON.stringify(r.data && r.data.vrm_colis_collected)); }
  // 4. URSSAF déclaré, liens eBay et Leboncoin (sous-clés profondes).
  { const r = F({ vrm_urssaf_declare: { '2026-09': { tx: ['1'] } } }, { vrm_urssaf_declare: { '2026-09': { tx: ['1'] }, '2026-10': { tx: ['2'] } } }, { vrm_urssaf_declare: { '2026-09': { tx: ['1'], at: 'x' } } });
    dit(r.data && r.data.vrm_urssaf_declare['2026-10'] && r.data.vrm_urssaf_declare['2026-09'].at === 'x', 'mois déclarés : chacun garde le sien', JSON.stringify(r.data)); }
  { const r = F({ vrm_ebay_liens: {}, vrm_lbc_liens: { a: '1' } }, { vrm_ebay_liens: { e1: { n: '3' } }, vrm_lbc_liens: { a: '1', b: '2' } }, { vrm_ebay_liens: { e2: { n: '4' } }, vrm_lbc_liens: { a: '', c: '5' } });
    dit(r.data && r.data.vrm_ebay_liens.e1 && r.data.vrm_ebay_liens.e2 && r.data.vrm_lbc_liens.b === '2' && r.data.vrm_lbc_liens.c === '5' && r.data.vrm_lbc_liens.a === '', 'liens eBay et Leboncoin : rien ne s\'efface, un lien défait là-bas reste défait', JSON.stringify(r.data)); }
  // 5. Personne n'a touché ⇒ le nuage.
  { const r = F({ vinted_goal: 100 }, { vinted_goal: 100 }, { vinted_goal: 300 });
    dit(r.data && r.data.vinted_goal === 300, 'une clé intacte ici prend la valeur du nuage'); }
  // 6. L'ordre des clés ne compte pas.
  { const r = F({ vinted_buyprice_by_num: { 1: '1', 2: '2' } }, { vinted_buyprice_by_num: { 2: '2', 1: '1' } }, { vinted_buyprice_by_num: { 1: '1', 2: '2', 3: '3' } });
    dit(r.data && r.data.vinted_buyprice_by_num['3'] === '3', 'une carte réécrite dans un autre ordre n\'est pas un changement'); }
  { const r = F({ vinted_offvinted_buys: [{ a: 1, b: 2 }] }, { vinted_offvinted_buys: [{ b: 2, a: 1 }] }, { vinted_offvinted_buys: [{ a: 1, b: 2 }, { c: 3 }] });
    dit(r.data && r.data.vinted_offvinted_buys.length === 2, 'une liste d\'objets réécrits dans un autre ordre : pas de doublon', JSON.stringify(r.data)); }
  { const r = F({ vinted_offvinted_buys: [{ a: 1, b: 2 }] }, { vinted_offvinted_buys: [{ b: 2, a: 1 }] }, { vinted_offvinted_buys: [] });
    dit(r.data && r.data.vinted_offvinted_buys.length === 0, 'un achat retiré là-bas ne ressuscite pas parce qu\'il est réécrit ici', JSON.stringify(r.data)); }
  // 7 bis. (5 nov.) Une fiche numérotée du nuage ne disparaît jamais par la fusion
  //    (règle de la base `vrm_fiche_perdue`) : l'appareil qui l'a perdue de son côté
  //    l'envoie quand même.
  { const r = F({ vinted_annonce_numeros: { a: { numero: '50' }, b: { numero: '51' } } }, { vinted_annonce_numeros: { b: { numero: '51' } } }, { vinted_annonce_numeros: { a: { numero: '50' }, b: { numero: '51' } } });
    dit(r.data && r.data.vinted_annonce_numeros && r.data.vinted_annonce_numeros.a && r.data.vinted_annonce_numeros.a.numero === '50', 'une fiche numérotée retirée ici reste dans le nuage (la base la refuserait)', JSON.stringify(r.data)); }
  { const r = F({ vinted_annonce_numeros: { a: { numero: '50' } } }, { vinted_annonce_numeros: { c: { numero: '50', repriseDe: 'a' } } }, { vinted_annonce_numeros: { a: { numero: '50' } } });
    dit(r.data && r.data.vinted_annonce_numeros && !r.data.vinted_annonce_numeros.a && r.data.vinted_annonce_numeros.c, 'une fiche REPRISE ailleurs (repriseDe) part bien (l\'autre sens)', JSON.stringify(r.data)); }
  { const r = F({ vinted_annonce_numeros: { a: { title: 'x' } } }, { vinted_annonce_numeros: {} }, { vinted_annonce_numeros: { a: { title: 'x' } } });
    dit(r.data && r.data.vinted_annonce_numeros && !r.data.vinted_annonce_numeros.a, 'une fiche SANS numéro retirée ici reste retirée (rien de plus que la règle de la base)', JSON.stringify(r.data)); }
  // 7. Les numéros.
  const fiche = (n, extra) => ({ numero: n, ...extra });
  { const r = F({ vinted_used_numeros: ['1', '2'] }, { vinted_used_numeros: ['1'] }, { vinted_used_numeros: ['1', '2', '3'] });
    dit(r.data && ['1', '2', '3'].every((x) => r.data.vinted_used_numeros.includes(x)), 'pool : jamais rétréci, même retiré ici', JSON.stringify(r.data)); }
  { const r = F({ vinted_used_numeros: ['1'] }, { vinted_used_numeros: ['1', '4'] }, { vinted_used_numeros: ['1', 'B7'] });
    dit(r.data && ['1', '4', 'B7'].every((x) => r.data.vinted_used_numeros.includes(x)), 'pool : l\'union des deux côtés'); }
  { const r = F({ vinted_annonce_numeros: { a: fiche('1') } }, { vinted_annonce_numeros: { a: fiche('1', { buyPrice: '40' }) } }, { vinted_annonce_numeros: { a: fiche('1', { title: 'Samba' }) } });
    dit(r.data && r.data.vinted_annonce_numeros.a.buyPrice === '40' && r.data.vinted_annonce_numeros.a.title === 'Samba' && r.data.vinted_annonce_numeros.a.numero === '1', 'fiche : prix ici, titre là-bas ⇒ les deux, N° inchangé', JSON.stringify(r.data)); }
  { const r = F({ vinted_annonce_numeros: { a: fiche('1') } }, { vinted_annonce_numeros: { a: fiche('7') } }, { vinted_annonce_numeros: { a: fiche('8') } });
    dit(!!r.conflit && !r.data, 'la même fiche renumérotée des deux côtés ⇒ refus', JSON.stringify(r)); }
  { const r = F({ vinted_annonce_numeros: { a: fiche('1') }, vinted_used_numeros: ['1'] }, { vinted_annonce_numeros: { a: fiche('1'), b: fiche('2') }, vinted_used_numeros: ['1', '2'] }, { vinted_annonce_numeros: { a: fiche('1'), c: fiche('2') }, vinted_used_numeros: ['1', '2'] });
    dit(!!r.conflit, 'deux paires différentes sous le même N° neuf ⇒ refus', JSON.stringify(r)); }
  { const r = F({ vinted_annonce_numeros: { a: fiche('1') } }, { vinted_annonce_numeros: { a: fiche('1'), b: fiche('2') } }, { vinted_annonce_numeros: { a: fiche('1'), c: fiche('2') } });
    dit(!!r.conflit, 'deux paires sous un N° que personne n\'y mettait (sans pool) ⇒ refus', JSON.stringify(r)); }
  { const r = F({ vinted_annonce_numeros: { a: fiche('1') }, vinted_used_numeros: ['1'] }, { vinted_annonce_numeros: { a: fiche('1') }, vinted_used_numeros: ['1', '2'] }, { vinted_annonce_numeros: { a: fiche('1'), c: fiche('2') }, vinted_used_numeros: ['1', '2'] });
    dit(!!r.conflit, 'un N° neuf pris ailleurs et réservé ici aussi (pool) ⇒ refus', JSON.stringify(r)); }
  { const r = F({ vinted_annonce_numeros: { a: fiche('1') }, vinted_used_numeros: ['1'] }, { vinted_annonce_numeros: { a: fiche('1'), b: fiche('2') }, vinted_used_numeros: ['1', '2'] }, { vinted_annonce_numeros: { a: fiche('1'), b: fiche('2') }, vinted_used_numeros: ['1', '2'] });
    dit(!r.conflit && r.data.vinted_annonce_numeros.b.numero === '2', 'la même paire numérotée pareil des deux côtés ⇒ pas un conflit'); }
  { const r = F({ vinted_annonce_numeros: { a: fiche('1'), b: fiche('1') } }, { vinted_annonce_numeros: { a: fiche('1'), b: fiche('1', { buyPrice: '9' }) } }, { vinted_annonce_numeros: { a: fiche('1'), b: fiche('1') } });
    dit(!r.conflit && r.data.vinted_annonce_numeros.b.buyPrice === '9', 'un doublon déjà là (règlé ailleurs, §5) n\'empêche pas un prix'); }
  { const r = F({ vinted_sale_overrides: { t: { numero: '3' } } }, { vinted_sale_overrides: { t: { numero: '4' } } }, { vinted_sale_overrides: { t: { numero: '5' } } });
    dit(!!r.conflit, 'une vente renumérotée des deux côtés ⇒ refus'); }
  { const r = F({ vrm_numerotation: { version: 2 } }, { vrm_numerotation: { version: 1 } }, { vrm_numerotation: { version: 2 } });
    dit(r.data && r.data.vrm_numerotation.version === 2, 'le marqueur des numéros : celui du nuage, toujours'); }
  { const r = M.fusionnerLigne({ cles: ['vinted_accounts'], base: { vinted_accounts: [{ id: 1 }] }, local: { vinted_accounts: [{ id: 1 }, { id: 2 }] }, nuage: { vinted_accounts: [{ id: 3 }] }, cleNum, localGagne: ['vinted_accounts'] });
    dit(r.data && JSON.stringify(r.data.vinted_accounts) === '[{"id":1},{"id":2}]', 'la copie des comptes : celle de l\'appareil (la table fait foi)'); }
  return ko;
}

function texteApp() {
  const app = fs.readFileSync(path.join(racine, 'src', 'App.jsx'), 'utf8');
  let ko = 0;
  const dit = (c, m) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m); };
  const push = app.slice(app.indexOf('const cloudPush = () => {'), app.indexOf('const relireNuage'));
  dit(/fusionnerLigne\(/.test(push), 'App.jsx : cloudPush fusionne (fusionnerLigne)');
  dit(/method: 'PATCH'/.test(push) && /data->>rev=eq\.\$\{rev0\}/.test(push) && /data->>rev=is\.null/.test(push), 'App.jsx : cloudPush écrit par PATCH conditionnel sur data->>rev');
  dit(!/resolution=merge-duplicates/.test(push), 'App.jsx : cloudPush ne réécrit plus la ligne par une fusion aveugle');
  dit(/lireNuageComplet\(owner\)[\s\S]{0,80}c === undefined[\s\S]{0,120}return/.test(push), 'App.jsx : une relecture ratée n\'écrit rien');
  dit(/addEventListener\('visibilitychange'[\s\S]{0,120}relireNuage/.test(app), 'App.jsx : le nuage se relit au retour au premier plan');
  dit(/addEventListener\('storage'[\s\S]{0,200}emettreClesRelues/.test(app), 'App.jsx : un autre onglet réveille les écrans (storage)');
  dit((app.match(/useStateCle\('vinted_buyprice_by_num'/g) || []).length >= 1 && (app.match(/useStateCle\('vinted_annonce_numeros'/g) || []).length >= 1, 'App.jsx : prix d\'achat et fiches relus quand ils changent ailleurs');
  return ko;
}

const MUTATIONS = [
  ['fiche numérotée perdue par la fusion', (s) => s.replace("if (k === 'vinted_annonce_numeros') v = garderFichesNumerotees(v, N[k], cleNum);", '')],
  ['local gagne toujours', (s) => s.replace("if (egal(l, b)) return n;", "if (egal(l, b)) return l;")],
  ['pas de fusion des objets', (s) => s.replace("if (estObjet(l) && estObjet(n) &&", "if (false &&")],
  ['liste : le nuage seul', (s) => s.replace("return fusionListe(b, l, n);", "return l;")],
  ['pool : plus d\'union', (s) => s.replace("v = (L[k] === undefined && N[k] === undefined) ? undefined : unionPool(L[k], N[k], cleNum);", "v = fusion3(B[k], L[k], N[k]);")],
  ['refus 1 retiré', (s) => s.replace("if (nl !== nb && nn !== nb && nl !== nn) return", "if (false) return")],
  ['refus 2 retiré', (s) => s.replace("if (dl.get(c) !== ids && dn.get(c) !== ids) return", "if (false) return")],
  ['refus 3 retiré', (s) => s.replace("if (porteur(lo, c) !== porteur(no, c)) return", "if (false) return")],
  ['marqueur du navigateur', (s) => s.replace("if (k === CLE_SERVEUR) v = N[k] !== undefined ? N[k] : L[k];", "if (k === CLE_SERVEUR) v = L[k];")],
  ['ordre des clés compté', (s) => s.replace("return '{' + Object.keys(v).sort()", "return '{' + Object.keys(v)")],
];

(async () => {
  if (process.argv.includes('--prouve')) {
    const src = fs.readFileSync(SRC, 'utf8');
    let vertes = 0;
    for (const [nom, mut] of MUTATIONS) {
      const m = mut(src);
      if (m === src) { console.log('KO  mutation sans effet (le texte a changé) : ' + nom); vertes++; continue; }
      const f = path.join(os.tmpdir(), `fusionNuage-mut-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
      fs.writeFileSync(f, m);
      const ko = await juger(f, false);
      fs.unlinkSync(f);
      console.log((ko ? 'OK  ' : 'KO  ') + `mutation « ${nom} » ⇒ ${ko} rouge(s)`);
      if (!ko) vertes++;
    }
    console.log(vertes ? `\n${vertes} mutation(s) passent : le contrôle ne la voit pas` : '\nchaque mutation est vue');
    process.exit(vertes ? 1 : 0);
  }
  const f = path.join(os.tmpdir(), `fusionNuage-${process.pid}.mjs`);
  fs.copyFileSync(SRC, f);
  const ko1 = await juger(f, true);
  fs.unlinkSync(f);
  const ko2 = texteApp();
  console.log(ko1 + ko2 ? `\n${ko1 + ko2} KO` : '\nTout est vert');
  process.exit(ko1 + ko2 ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
