// ════════════════════════════════════════════════════════════════════════════
//  LA LOUPE QUI TROUVE TOUT — STOCK, RETOURS, LE PLUS PROBABLE D'ABORD, LA VITESSE
//  (15 nov. 2026, « vendre plus », validé par Julien) — EXÉCUTÉ
//
//  La VRAIE règle (src/rechercheUnique.js) sur des données INVENTÉES (aucune donnée réelle) :
//    A  STOCK : un N° rangé sans fiche ⇒ un résultat « Stock » trouvé par son N° (cleNum : « 007 » = « 7 »),
//       qui ouvre le Stock sur CE N° ; une paire rangée ⇒ son lieu s'ajoute à CETTE paire (jamais une
//       seconde ligne) ; le lieu se cherche (« etagere b ») ;
//    B  RETOURS : trouvés par le n° de suivi du bordereau de retour (correspondance EXACTE, en tête), par
//       le n° de transaction, par les mots de l'article ; ouvrent SON achat ;
//    C  IDENTITÉ : 50 paires au MÊME titre, chacune dans un lieu ⇒ le lieu de la 17e ne ramène QUE la 17e ;
//       50 résultats distincts sur le titre ;
//    D  LE PLUS PROBABLE D'ABORD : des mots entiers avant un morceau de mot ; une paire en ligne avant une
//       paire qui ne l'est plus ; les GROUPES rangés par leur meilleur résultat ;
//    E  « pas lu » : le stock ou les retours DEMANDÉS et pas lus ⇒ dits ; absents ⇒ rien n'est dit ;
//    F  VITESSE : 1 000 articles + 3 000 ventes (+ achats, colis, stock, retours) : index + recherche
//       < 100 ms, une frappe < 16 ms (le meilleur de 7 essais : la machine du banc est partagée).
//  `--prouve` : chaque mutation doit faire rougir au moins un contrôle. `--racine <dir>` : un autre arbre.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { pathToFileURL } = require('url');
const { performance } = require('perf_hooks');
const iR = process.argv.indexOf('--racine');
const R = iR > 0 ? path.resolve(process.argv[iR + 1]) : path.join(__dirname, '..');
const PROUVE = process.argv.includes('--prouve');

function volume() {
  const fiches = {}, annonces = [], ventes = [], achats = [], colis = [], stock = [], retours = [];
  const modeles = ['Nike Dunk Low', 'Adidas Samba OG', 'New Balance 550', 'Asics Gel Kayano 14', 'Nike Air Max 90', 'Salomon XT-6'];
  for (let i = 0; i < 1000; i++) {
    const id = String(100000 + i), titre = `${modeles[i % 6]} taille ${38 + (i % 9)}`;
    if (i < 700) fiches[id] = { numero: String(i + 1), title: titre, brand: modeles[i % 6].split(' ')[0], size: String(38 + (i % 9)), price: 50 + (i % 80) };
    annonces.push({ id, title: titre, brand: modeles[i % 6].split(' ')[0], size: String(38 + (i % 9)), price: 50 + (i % 80), uid: 'u1' });
    if (i < 600) stock.push({ numero: String(i + 1), lieu: `Garage · Étagère ${String.fromCharCode(65 + (i % 8))} · case ${i % 12}` });
  }
  for (let i = 0; i < 40; i++) stock.push({ numero: String(5000 + i), lieu: 'Cave · carton ' + i });
  for (let i = 0; i < 3000; i++) ventes.push({ transaction_id: String(70000000 + i), title: `${modeles[i % 6]} vendue ${i}`, price: { amount: String(40 + (i % 90)) }, date: new Date(Date.UTC(2026, 0, 1) + i * 3600000).toISOString(), user_login: 'acheteur' + (i % 400) });
  for (let i = 0; i < 1000; i++) achats.push({ transaction_id: String(80000000 + i), title: `${modeles[i % 6]} achat ${i}`, price: { amount: '30' }, date: new Date(Date.UTC(2026, 0, 1) + i * 3600000).toISOString(), user_login: 'vendeuse' + (i % 300) });
  for (let i = 0; i < 300; i++) colis.push({ id: 'c' + i, suivi: 'XW' + String(300000000 + i) + 'FR', code: 'C' + (1000 + i), status: 'available', sens: '', at: '2026-11-01', art: modeles[i % 6] });
  for (let i = 0; i < 30; i++) retours.push({ tx: String(80000000 + i), suivi: 'RT' + String(900000000 + i) + 'FR', titre: `${modeles[i % 6]} achat ${i}`, limite: '2026-11-20' });
  return { fiches, annonces, ventes, achats, colis, stock, retours, pseudos: [], bordereaux: [], factures: [], messages: [], autres: [] };
}

async function controles(fichier, parler) {
  let ko = 0;
  const dit = (c, m, d) => { if (!c) ko++; if (parler) console.log((c ? 'OK  ' : 'KO  ') + m + (d && !c ? ' — ' + d : '')); };
  let M = null;
  try { M = await import(pathToFileURL(fichier).href + '?v=' + Math.random()); } catch (e) { dit(false, 'src/rechercheUnique.js se charge', e.message); return ko; }
  const cherche = (S, q, o = {}) => M.chercherPartout(M.indexRecherche(S), q, { max: 500, ...o });

  // A — le stock
  const S1 = { fiches: { 11: { numero: '7', title: 'Nike Dunk Low', brand: 'Nike' } }, annonces: [], stock: [{ numero: '7', lieu: 'Garage · Étagère B · case 3' }, { numero: '42', lieu: 'Cave · carton rouge' }] };
  const r42 = cherche(S1, '042', { numero: '42' });
  const st = ((r42.groupes && r42.groupes.stock) || []).concat(r42.exactes || []).find((r) => r.e.type === 'stock');
  dit(st && st.e.numero === '42' && M.destinationResultat(st) && M.destinationResultat(st).stock === '42', 'A1 un N° rangé sans fiche (« 042 » = 42) ⇒ un résultat Stock qui ouvre le Stock sur CE N°', JSON.stringify(st && st.e));
  const idx1 = M.indexRecherche(S1);
  dit(idx1.entrees.filter((e) => e.numK === '7').length === 1 && (idx1.entrees.find((e) => e.type === 'paire').lieuxAff || [])[0] === 'Garage · Étagère B · case 3', 'A2 une paire rangée : son lieu va sur CETTE paire, jamais une seconde ligne');
  const rL = cherche(S1, 'etagere b');
  dit(rL.groupes.paire.length === 1 && rL.groupes.paire[0].par === 'rangement', 'A3 le lieu se cherche : « etagere b » ⇒ la paire, trouvée par son rangement', JSON.stringify(rL.groupes.paire.map((r) => r.par)));
  // B — les retours
  const S2 = { achats: [{ transaction_id: '80012345', title: 'Adidas Samba achat' }], retours: [{ tx: '80012345', suivi: 'RT900000123FR', titre: 'Adidas Samba achat', limite: '2026-11-20' }] };
  const rS = cherche(S2, 'rt 900 000 123 fr');
  const ex = (rS.exactes || []).find((r) => r.e.type === 'retour');
  dit(ex && ex.par === 'suivi' && M.destinationResultat(ex).tab === 'achats' && M.destinationResultat(ex).cible.tx === '80012345', 'B1 le n° de suivi du retour (recopié par blocs) ⇒ correspondance EXACTE, ouvre SON achat', JSON.stringify(rS.exactes && rS.exactes.map((r) => [r.e.type, r.par])));
  const rT = cherche(S2, '80012345');
  dit(((rT.groupes && rT.groupes.retour) || []).length + (rT.exactes || []).filter((r) => r.e.type === 'retour').length >= 1, 'B2 le n° de transaction trouve aussi le retour');
  // C — identité
  const fi = {}, sto = [];
  for (let i = 1; i <= 50; i++) { fi[String(900 + i)] = { numero: String(i), title: 'Nike Dunk Low Panda 42', brand: 'Nike' }; sto.push({ numero: String(i), lieu: `Carton ${i}` }); }
  const S3 = { fiches: fi, annonces: [], stock: sto };
  const r17 = cherche(S3, 'carton 17');
  dit(r17.groupes.paire.length === 1 && r17.groupes.paire[0].e.numero === '17', 'C1 50 paires au même titre : « carton 17 » ne ramène QUE la 17e', r17.groupes.paire.map((r) => r.e.numero).join(','));
  const rTit = cherche(S3, 'dunk panda');
  dit(rTit.groupes.paire.length === 50 && new Set(rTit.groupes.paire.map((r) => r.e.cle)).size === 50, 'C2 sur le titre : 50 résultats distincts (50 clés)');
  // D — le plus probable d'abord
  const S4 = { fiches: { 1: { numero: '1', title: 'Dunkerque sweat' }, 2: { numero: '2', title: 'Nike Dunk Low' } }, annonces: [{ id: '2', title: 'Nike Dunk Low' }], stock: [] };
  const rD = cherche(S4, 'dunk');
  dit(rD.groupes.paire.map((r) => r.e.numero).join(',') === '2,1', 'D1 « dunk » : le mot entier (Nike Dunk) avant le morceau de mot (Dunkerque)', rD.groupes.paire.map((r) => r.e.numero).join(','));
  const S5 = { fiches: { 1: { numero: '1', title: 'Nike Dunk Low' }, 2: { numero: '2', title: 'Nike Dunk Low' } }, annonces: [{ id: '2', title: 'Nike Dunk Low' }] };
  dit(cherche(S5, 'dunk low').groupes.paire[0].e.numero === '2', 'D2 à égalité, la paire EN LIGNE d\'abord');
  const S6 = { ventes: [{ transaction_id: '1', title: 'Samba noire' }], achats: [], stock: [{ numero: '99', lieu: 'Samba box' }] };
  const rO = cherche(S6, 'samba');
  dit(Array.isArray(rO.ordre) && rO.ordre[0] === 'stock' && rO.ordre.includes('vente'), 'D3 les groupes se rangent par leur meilleur résultat (le lieu avant le titre)', JSON.stringify(rO.ordre));
  // E — pas lu
  dit(M.sourcesNonLues({ ventes: [], achats: [], colis: [], pseudos: [], bordereaux: [], annonces: [], messages: [], stock: null, retours: null }).join(',') === 'stock,retours', 'E1 stock et retours demandés et pas lus ⇒ dits');
  dit(M.sourcesNonLues({ ventes: [], achats: [], colis: [], pseudos: [], bordereaux: [], annonces: [], messages: [] }).length === 0, 'E2 pas demandés ⇒ rien n\'est dit');
  // F — vitesse
  const V = volume();
  // Le temps de CALCUL (process.cpuUsage : ce que ce processus a vraiment dépensé), le meilleur de 7 :
  // la machine du banc est partagée (charge > 50 mesurée), l'horloge murale y compte l'attente des autres.
  const cpu = (f) => { const a0 = process.cpuUsage(); const w0 = performance.now(); const r = f(); const d = process.cpuUsage(a0); return { r, ms: Math.min((d.user + d.system) / 1000, performance.now() - w0) }; };
  let best = Infinity, bestFrappe = Infinity, nE = 0;
  for (let k = 0; k < 7; k++) {
    const a = cpu(() => { const idx = M.indexRecherche(V); M.chercherPartout(idx, 'dunk 42'); return idx; });
    const b = cpu(() => { for (const q of ['etagere c', 'acheteur12', 'XW300000123FR']) M.chercherPartout(a.r, q); return 0; });
    best = Math.min(best, a.ms); bestFrappe = Math.min(bestFrappe, b.ms / 3); nE = a.r.n;
  }
  dit(best < 100, `F1 ${nE} entrées (1 000 articles, 3 000 ventes, 1 000 achats, colis, stock, retours) : index + recherche ${best.toFixed(1)} ms < 100 ms`);
  dit(bestFrappe < 16, `F2 une frappe ${bestFrappe.toFixed(1)} ms < 16 ms`);
  return ko;
}

const MUTATIONS = [
  ['le lieu fait une seconde ligne', "if (ps) { for (const e of ps) { e.lieux = e.lieux || []; e.lieuxAff = e.lieuxAff || []; if (lieu && !e.lieuxAff.includes(lieu)) { e.lieux.push(normaliser(lieu)); e.lieuxAff.push(lieu); } } continue; }", ''],
  ['le lieu ne se cherche pas', "if (!par && qn.length >= 2 && e.lieux && e.lieux.length) {", 'if (false) {'],
  ['mots entiers ignorés', "bonus = (motsEntiers(e.t, mots) ? 0 : 0.2) + (e.enLigne === false ? 0.1 : 0);", 'bonus = 0;'],
  ['groupes dans l\'ordre fixe', '.sort((a, b) => meilleur[a] - meilleur[b] || TYPES.indexOf(a) - TYPES.indexOf(b));', ';'],
  ['suivi du retour pas indexé', "suivis: s.length >= 6 ? [s] : [], codes: [], montants: [], date: str(r.limite || r.at || '') });", "suivis: [], codes: [], montants: [], date: str(r.limite || r.at || '') });"],
  ['stock sans destination', "if (e.type === 'stock') return { stock: e.numero };", ''],
  ['stock pas lu = rien', ".concat(SOURCES_DEMANDEES.filter(([k]) => Object.prototype.hasOwnProperty.call(S, k) && S[k] === null).map(([k]) => k));", ';'],
];

(async () => {
  const F = path.join(R, 'src', 'rechercheUnique.js');
  let ko = await controles(F, true);
  const sans = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');
  let APP = ''; try { APP = sans(fs.readFileSync(path.join(R, 'src', 'App.jsx'), 'utf8')); } catch (_) {}
  const dit = (c, m) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m); };
  dit(/stock: stockGs, retours:/.test(APP) && /stockPourRecherche\(brutPlan, garageGrid\)/.test(APP), 'G1 l\'app donne à la loupe le stock (plan + garage) et les retours (lecture partagée d\'Achats)');
  dit(/trouve\.ordre\.map/.test(APP) && /if \(d\.stock\) \{ setGarageLocate/.test(APP), 'G2 l\'app suit l\'ordre des groupes et ouvre le Stock sur le N° trouvé');
  let koM = 0;
  if (PROUVE && fs.existsSync(F)) {
    const src = fs.readFileSync(F, 'utf8');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'loupe-vp-'));
    for (const [nom, x, y] of MUTATIONS) {
      if (!src.includes(x)) { console.log(`KO  mutation « ${nom} » : texte introuvable`); koM++; continue; }
      const f = path.join(dir, `m${MUTATIONS.findIndex((m) => m[0] === nom)}.mjs`);
      fs.writeFileSync(f, src.replace(x, y));
      const k = await controles(f, false);
      console.log((k > 0 ? 'OK  ' : 'KO  ') + `mutation « ${nom} » ⇒ ${k} contrôle(s) rouge(s)`);
      if (!k) koM++;
    }
    fs.rmSync(dir, { recursive: true, force: true });
  }
  console.log(ko || koM ? `\n${ko} contrôle(s) rouge(s)${PROUVE ? `, ${koM} mutation(s) non vue(s)` : ''}` : '\nTout est vert.');
  process.exit(ko || koM ? 1 : 0);
})();
