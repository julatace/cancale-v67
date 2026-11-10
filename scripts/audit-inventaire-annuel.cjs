#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : LOT W (10 nov.) — L'INVENTAIRE DE FIN D'ANNÉE
//         node scripts/audit-inventaire-annuel.cjs [--mutation=…] [--prouve]
// ═══════════════════════════════════════════════════════════════════════════
// EXÉCUTE src/inventaireAnnuel.js sur des données INVENTÉES (le dépôt est public) :
//   L. la liste = les paires données (`annoncesPresentes`), le TOTAL est celui de
//      `valeurStock` (Σ des lignes = total, « sans prix » = la même liste), un prix
//      absent ou illisible est « — » (jamais 0), aucun prix ⇒ « — » ;
//   V. la vérification se fait par le N° SEUL (`cleNum` : « 007 » = « 7 »,
//      « b125 » = « B125 », « B125 » ≠ « 125 ») — 50 paires au même titre n'en
//      cochent qu'une ; pas vérifié ⇒ RIEN n'est « pas trouvé » ; sans N° ⇒ nommée
//      à part, jamais « pas trouvée » ; une saisie annulée ne compte pas ; vu hors
//      liste ⇒ listé ; deux lignes au même N° ⇒ doublon ;
//   S. la caméra : un N° ou le SKU « VRM-125 » ; tout autre code ⇒ rien ;
//   D. la date choisie qui n'est pas le jour de la lecture est DITE ;
//   X. exports : CSV (BOM, « au moins », prix vide jamais 0, formule neutralisée),
//      PDF (pdf-lib, plusieurs pages, titre exotique sans planter) ;
//   E. les écrans : publié par le propriétaire d'`annoncesPresentes` (App.jsx) avec
//      la fiche de `valeurStock` ; l'écran ne recalcule rien et n'écrit rien ; le
//      scanner passe par la MÊME saisie que le clavier ; ambre = geste, rouge =
//      doublon seulement.
// `--mutation=…` réaffaiblit une règle dans une copie de src/ : rouge exigé.
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const R = process.env.VRM_RACINE || path.join(__dirname, '..');
const MUTS = {
  'sans-prix-zero': ["achat: beneficePaire(null, (ficheDe && ficheDe(it)) || {}).achat });", "achat: beneficePaire(null, (ficheDe && ficheDe(it)) || {}).achat ?? 0 });"],
  'identite-titre': ["    else if (vus.has(l.cle)) trouvees.push(l);", "    else if (vus.has(l.cle) || ls.some((x) => x.cle && vus.has(x.cle) && x.titre === l.titre)) trouvees.push(l);"],
  'pas-verifie-tout-manque': ["  if (!objet(session)) return null;\n  const vus", "  if (!objet(session)) session = {};\n  const vus"],
  'sans-numero-manque': ["    if (!l.cle) sansNumero.push(l);", "    if (!l.cle) pasTrouvees.push(l);"],
  'scan-tout-accepte': ["  const k = cle(t);\n  return k && NUM_OK.test(k) ? k : null;", "  const k = cle(t);\n  return k || null;"],
  'date-tue': ["return isoJour(at) === iso ? `Liste lue le ${heureFr(at)}` : `Liste lue le ${heureFr(at)}, pas le ${dateFr(iso)}`;", "return `Liste lue le ${heureFr(at)}`;"],
  'csv-formule': ["if (/^[=+\\-@\\t]/.test(t)) t = \"'\" + t;", ""],
  'au-moins-tu': ["const valeur = inv.v.centimes == null ? '-' : `${t.auMoins ? 'au moins ' : ''}${t.montant}`;", "const valeur = inv.v.centimes == null ? '-' : `${t.montant}`;"],
  'ecran-second-calcul': ["const nCochables =", "const v2 = inv && valeurStock(inv.lignes, () => ({})); const nCochables =", 'InventaireAnnuel.jsx'],
  'publication-autre-liste': ["publierInventaireAnnuel(listeInventaire(annoncesPresentes,", "publierInventaireAnnuel(listeInventaire(listings.items,", 'App.jsx'],
  'scan-hors-saisie': ["vibrer('illisible'); return false; } valider(n); return true; };", "vibrer('illisible'); return false; } setDernier({ s: n, j: { etat: 'attendu', k: n } }); return true; };", 'InventaireStock.jsx'],
  'ecart-rouge': [".vrm-ia-ecart h4 b[data-ia-ton=\"geste\"] { color: var(--vrm-warn, #B25000); }", ".vrm-ia-ecart h4 b[data-ia-ton=\"geste\"] { color: #D70015; }", 'styles-inventaire-annuel.css'],
};
if (process.argv.includes('--prouve')) {
  let n = 0;
  for (const k of Object.keys(MUTS)) {
    let code = 0; try { execFileSync(process.execPath, [__filename, '--mutation=' + k], { stdio: 'pipe' }); } catch (e) { code = e.status; }
    console.log(`${code === 1 ? '✅' : '❌'} mutation « ${k} » ⇒ ${code === 1 ? 'ROUGE' : 'pas attrapée (' + code + ')'}`); if (code === 1) n++;
  }
  console.log(`${n}/${Object.keys(MUTS).length} mutations attrapées`); process.exit(n === Object.keys(MUTS).length ? 0 : 1);
}
let SRC = path.join(R, 'src');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1];
if (MUT) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'inv-annuel-'));
  fs.cpSync(path.join(R, 'src'), path.join(d, 'src'), { recursive: true });
  fs.cpSync(path.join(R, 'api', '_lib'), path.join(d, 'api', '_lib'), { recursive: true });
  try { fs.copyFileSync(path.join(R, 'package.json'), path.join(d, 'package.json')); } catch (_) {}
  const f = path.join(d, 'src', MUTS[MUT][2] || 'inventaireAnnuel.js'); const s = fs.readFileSync(f, 'utf8');
  if (!s.includes(MUTS[MUT][0])) { console.log('motif introuvable : ' + MUT); process.exit(2); }
  fs.writeFileSync(f, s.replace(MUTS[MUT][0], MUTS[MUT][1]));
  SRC = path.join(d, 'src');
  console.log('⚠️  MUTATION « ' + MUT + ' » — doit rougir');
}
let ok = 0, ko = 0;
const dit = (c, m, d = '') => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (c || !d ? '' : ' — ' + d)); };
const lire = (f) => { try { return fs.readFileSync(path.join(SRC, f), 'utf8'); } catch (_) { return ''; } };
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');
const url = (f) => require('url').pathToFileURL(path.join(SRC, f)).href;

// Un localStorage d'appareil, inventé.
const memoire = new Map();
global.localStorage = { getItem: (k) => (memoire.has(k) ? memoire.get(k) : null), setItem: (k, v) => memoire.set(k, String(v)), removeItem: (k) => memoire.delete(k) };
global.window = { dispatchEvent: () => true };
global.Event = class { constructor(t) { this.type = t; } };

(async () => {
  let IA, INV, NUM;
  try { IA = await import(url('inventaireAnnuel.js')); INV = await import(url('inventaire.js')); NUM = await import(require('url').pathToFileURL(path.join(SRC, '..', 'api', '_lib', 'numerotation.js')).href); }
  catch (e) { dit(false, 'src/inventaireAnnuel.js existe et se charge', e.message); console.log(`\n${ok} verts, ${ko} rouges`); process.exit(1); }
  const cle = NUM.cleNum;
  const fiches = {};
  const mk = (id, numero, buyPrice, titre = 'Nike Air Max 90 blanche 42', compte = 'compte_a') => { fiches[id] = buyPrice == null ? {} : { buyPrice }; return { id, title: titre, numero, _acc: { login: compte } }; };
  const opts = { ficheDe: (it) => fiches[it.id] || {}, numeroDe: (it) => it.numero, compteDe: (it) => it._acc.login, cle };

  console.log('\n── L. La liste et sa valeur (la règle de `valeurStock`)');
  const P = [mk('a1', '12', '60'), mk('a2', '007', '45,50'), mk('a3', 'B125', null), mk('a4', '', '30'), mk('a5', '40', 'soixante')];
  const L1 = IA.listeInventaire(P, opts);
  const somme = L1.lignes.reduce((t, l) => t + (l.achat || 0), 0);
  dit(L1.v.centimes === somme && somme === 13550, 'L1 Σ des lignes = le total de `valeurStock` (60 + 45,50 + 30)', `${somme} / ${L1.v.centimes}`);
  const sansL = L1.lignes.filter((l) => l.achat == null).map((l) => l.id).sort().join(',');
  dit(sansL === [...L1.v.sans].sort().join(',') && sansL === 'a3,a5', 'L2 « sans prix » : la même liste des deux côtés (absent ET illisible)', sansL);
  dit(L1.lignes.find((l) => l.id === 'a3').achat === null && L1.lignes.find((l) => l.id === 'a5').achat === null, 'L3 un prix absent ou illisible vaut `null` (« — »), jamais 0');
  dit(L1.lignes.map((l) => l.numero).join(',') === '007,12,40,B125,', 'L4 rangée par N° (7, 12, 40, l’archive B, sans N° à la fin)', L1.lignes.map((l) => l.numero).join(','));
  const L0 = IA.listeInventaire([mk('z1', '1', null), mk('z2', '2', '')], opts);
  dit(L0.v.centimes === null && IA.enTeteExport({ ...L0, partiel: false, at: 1 }, { date: '2026-12-31' }).valeur === '-', 'L5 aucun prix ⇒ « — », jamais 0 €', JSON.stringify(L0.v));
  const e1 = IA.enTeteExport({ ...L1, partiel: false, at: 1 }, { date: '2026-12-31' });
  dit(/^au moins /.test(e1.valeur) && /sur 5 paires/.test(e1.sur) && /2 sans prix/.test(e1.sans), 'L6 couverture dite : « au moins … · sur 5 paires · 2 sans prix »', JSON.stringify(e1));
  const e2 = IA.enTeteExport({ v: IA.listeInventaire([mk('p1', '1', '10')], opts).v, lignes: [], partiel: true, at: 1 }, { date: '2026-12-31' });
  dit(/^au moins /.test(e2.valeur), 'L7 une lecture d’annonces manque ⇒ « au moins » même tout au prix', e2.valeur);

  console.log('\n── V. La vérification : le N° seul');
  let s = INV.nouvelleSession({ maintenant: 1000, id: 'inv1' });
  s = INV.ajouterSaisie(s, { k: '7', s: '7', at: 1001, sid: 's1' });
  s = INV.ajouterSaisie(s, { k: 'B125', s: 'b125', at: 1002, sid: 's2' });
  s = INV.ajouterSaisie(s, { k: '999', s: '999', at: 1003, sid: 's3' });
  s = INV.ajouterSaisie(s, { k: '40', s: '40', at: 1004, sid: 's4' });
  s = INV.annulerDerniere(s, 1005).session;
  const E1 = IA.ecartsInventaire(L1.lignes, s, cle);
  dit(E1.trouvees.map((l) => l.id).sort().join(',') === 'a2,a3', 'V1 « 7 » coche N°007, « B125 » coche B125 (cleNum)', E1.trouvees.map((l) => l.id).join(','));
  dit(E1.pasTrouvees.map((l) => l.id).sort().join(',') === 'a1,a5', 'V2 pas trouvées : N°12 et N°40 (la saisie annulée ne compte pas)', E1.pasTrouvees.map((l) => l.id).join(','));
  dit(E1.horsListe.join(',') === '999', 'V3 vu dans un carton, absent de la liste ⇒ listé', E1.horsListe.join(','));
  dit(E1.sansNumero.map((l) => l.id).join(',') === 'a4' && !E1.pasTrouvees.some((l) => l.id === 'a4'), 'V4 une paire sans N° est nommée à part, jamais « pas trouvée »');
  const P50 = Array.from({ length: 50 }, (_, i) => mk('m' + i, String(i + 1), '50'));
  let s50 = INV.ajouterSaisie(INV.nouvelleSession({ maintenant: 1, id: 'x' }), { k: '7', s: '7', at: 2, sid: 'q' });
  const E50 = IA.ecartsInventaire(IA.listeInventaire(P50, opts).lignes, s50, cle);
  dit(E50.trouvees.length === 1 && E50.trouvees[0].id === 'm6' && E50.pasTrouvees.length === 49, 'V5 50 paires au même titre : UN N° vu coche UNE paire', `${E50.trouvees.length} trouvée(s)`);
  dit(IA.ecartsInventaire(L1.lignes, null, cle) === null, 'V6 pas encore vérifié ⇒ `null` : rien n’est dit « pas trouvé »');
  const sB = INV.ajouterSaisie(INV.nouvelleSession({ maintenant: 1, id: 'y' }), { k: '125', s: '125', at: 2, sid: 'r' });
  const EB = IA.ecartsInventaire(L1.lignes, sB, cle);
  dit(!EB.trouvees.some((l) => l.id === 'a3') && EB.horsListe.includes('125'), 'V7 « 125 » ne coche pas B125 (un ancien N° n’est jamais l’autre)');
  const Ld = IA.listeInventaire([mk('d1', '5', '10'), mk('d2', '05', '12')], opts);
  dit(IA.ecartsInventaire(Ld.lignes, sB, cle).doublons.join(',') === '5', 'V8 deux paires sous le même N° ⇒ doublon (le seul rouge)');
  dit(IA.sessionAComparer({ courant: null, anciens: [s] }) === s && IA.sessionAComparer({ courant: sB, anciens: [s] }) === sB && IA.sessionAComparer(null) === null, 'V9 la session comparée : la courante, sinon la dernière gardée');

  console.log('\n── S. La caméra');
  const sc = (x) => IA.numeroDuScan(x, cle);
  dit(sc('VRM-125') === '125' && sc('N°B12') === 'B12' && sc(' 007 ') === '7' && sc('b125') === 'B125', 'S1 un N°, « N°B12 », le SKU « VRM-125 » ⇒ le N°');
  dit(sc('3017620422003') === null && sc('XK123456789FR') === null && sc('https://vrm.center') === null && sc('') === null, 'S2 code-barres de boîte, n° de suivi, lien ⇒ rien (« Pas un N° »)');

  console.log('\n── D. La date');
  const at = new Date(2026, 10, 10, 14, 5).getTime();
  dit(IA.phraseDate('2026-11-10', at) === 'Liste lue le 10/11/2026 à 14h05', 'D1 le jour de la lecture : « Liste lue le … »', IA.phraseDate('2026-11-10', at));
  dit(/pas le 31\/12\/2026$/.test(IA.phraseDate('2026-12-31', at)), 'D2 une autre date est DITE (« … pas le 31/12/2026 »)', IA.phraseDate('2026-12-31', at));
  dit(IA.phraseDate('2026-12-31', 0) === 'Liste pas encore lue', 'D3 jamais lue ⇒ dit');
  dit(IA.dateParDefaut(new Date(2026, 10, 10).getTime()) === '2026-12-31' && IA.dateParDefaut(new Date(2027, 0, 5).getTime()) === '2026-12-31', 'D4 par défaut : le 31 décembre (début janvier : celui qui vient de passer)');

  console.log('\n── P. La publication (un propriétaire, des lecteurs)');
  IA.publierInventaireAnnuel(L1, { owner: 'u1', partiel: false, maintenant: at });
  const lu = IA.lireInventaireAnnuel('u1', cle);
  dit(lu && lu.v.centimes === L1.v.centimes && lu.lignes.length === 5 && lu.lignes.find((l) => l.id === 'a3').achat === null && lu.at === at, 'P1 relue telle quelle (prix absent toujours `null`)');
  dit(IA.lireInventaireAnnuel('u2', cle) === null, 'P2 un autre compte VRM ne la lit pas (`null`, « — »)');
  memoire.clear();
  dit(IA.lireInventaireAnnuel('u1', cle) === null, 'P3 jamais publiée ⇒ `null` (pas su), jamais une liste vide');

  console.log('\n── X. Les exports');
  const inv = { ...L1, partiel: false, at };
  const csv = IA.csvInventaire({ ...inv, lignes: [...inv.lignes, { id: 'f', numero: '77', cle: '77', titre: '=HYPERLINK("x")', compte: 'c', achat: 1000 }] }, { date: '2026-12-31', ecarts: E1 });
  dit(csv.charCodeAt(0) === 0xFEFF && /Inventaire au 31\/12\/2026/.test(csv), 'X1 CSV : BOM et titre daté');
  dit(/;au moins 135,50 €;sur 5 paires;2 sans prix/.test(csv), 'X2 CSV : « au moins » et la couverture', csv.split('\r\n')[2]);
  const lB = csv.split('\r\n').find((x) => x.startsWith('B125;'));
  dit(lB && lB.split(';')[3] === '' && lB.split(';')[4] === 'trouvée', 'X3 CSV : prix absent = cellule VIDE (jamais 0) ; vérification dite', lB);
  dit(csv.includes(`'=HYPERLINK`) && !/;=HYPERLINK/.test(csv), 'X4 CSV : une formule dans un titre est neutralisée');
  dit(/\r\n999;;;;hors liste\r\n/.test(csv), 'X5 CSV : les N° trouvés hors liste sont listés');
  let PL = null; try { PL = require(path.join(R, 'node_modules', 'pdf-lib')); } catch (_) { try { PL = require('pdf-lib'); } catch (_) {} }
  if (PL) {
    const P120 = Array.from({ length: 120 }, (_, i) => mk('k' + i, String(i + 1), i % 7 ? '20' : null, i === 3 ? 'Air Jordan 1 🔥 « Chicago » — 44,5' : 'Paire ' + i));
    const L120 = IA.listeInventaire(P120, opts);
    const octets = await IA.pdfInventaire({ ...L120, partiel: false, at }, { date: '2026-12-31', ecarts: IA.ecartsInventaire(L120.lignes, s, cle), PDFLib: PL });
    const doc = await PL.PDFDocument.load(octets);
    dit(Buffer.from(octets.slice(0, 5)).toString() === '%PDF-' && doc.getPageCount() >= 3 && doc.getTitle() === 'Inventaire au 31/12/2026', 'X6 PDF : 120 paires sur plusieurs pages, titre daté, un emoji ne le casse pas', `${doc.getPageCount()} pages`);
  } else dit(false, 'X6 pdf-lib introuvable');

  console.log('\n── E. Les écrans');
  const app = sansCommentaires(lire('App.jsx'));
  dit(/publierInventaireAnnuel\(listeInventaire\(annoncesPresentes, \{ ficheDe: \(it\) => fusionEntreeVente\(numeros\[it\.id\] \|\| \{\}, null, buyByNum\)/.test(app)
    && /valeurStock\(annoncesPresentes, \(it\) => fusionEntreeVente\(numeros\[it\.id\] \|\| \{\}, null, buyByNum\)\)/.test(app),
    'E1 publiée par le propriétaire d’`annoncesPresentes`, avec la fiche même de `valeurStock`');
  const ecr = sansCommentaires(lire('InventaireAnnuel.jsx'));
  dit(ecr.length > 0 && !/\b(valeurStock|beneficePaire|listeInventaire|fusionEntreeVente)\(/.test(ecr), 'E2 l’écran ne recalcule ni la liste ni la valeur');
  dit(ecr.length > 0 && !/\b(save|saveTout|fetch)\(|localStorage\.setItem|ecrire[A-Z]\w*\(/.test(ecr), 'E3 l’écran n’écrit rien (aucun numéro, aucune fiche)');
  const stk = sansCommentaires(lire('InventaireStock.jsx'));
  dit(/useLectureCamera\(video, traiter\)/.test(stk) && /const n = numeroDuScan\(brut, cle\);[^\n]*valider\(n\); return true;/.test(stk), 'E4 le scanner (caméra du lot V) passe par la MÊME saisie que le clavier');
  const st = sansCommentaires(lire('ecrans/Stock.jsx'));
  dit(/<InventaireAnnuel /.test(st) && /onVerifier=\{\(\) => \{ retourAnnuel\.current = true; setAnnuel\(false\); setInventaire\(true\); \}\}/.test(st) && /data-ia-ouvrir/.test(st), 'E5 le Stock l’ouvre (« Inventaire de fin d’année ») et « Je vérifie » ouvre l’inventaire');
  const css = lire('styles-inventaire-annuel.css');
  const rouges = css.split('}').filter((r) => /#D70015|--vrm-doublon/i.test(r));
  dit(rouges.length >= 1 && rouges.every((r) => /doublon/.test(r.split('{')[0])) && /data-ia-ton="geste"\] \{ color: var\(--vrm-warn/.test(css), 'E6 ambre pour un écart (geste), rouge seulement pour deux paires sous un N°');

  console.log(`\n${ok} verts, ${ko} rouges`);
  process.exit(ko ? 1 : 0);
})();
