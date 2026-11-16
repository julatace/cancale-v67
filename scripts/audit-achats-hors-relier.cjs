#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — UN ACHAT EN RETOUR / LITIGE / REMBOURSÉ N'EST JAMAIS PROPOSÉ À RELIER (16 nov.)
//        node scripts/audit-achats-hors-relier.cjs [--prouve]
// ════════════════════════════════════════════════════════════════════════════
// Julien (capture de la feuille « Relier » d'une vente) : « j'ai demandé un retour, donc j'ai fait
// un litige : ne me la propose pas, vu que je ne vais pas la mettre en vente ».
// EXÉCUTE src/achatsHorsRelier.js, src/suggestionsAchat.js, src/liaisonAchat.js et la règle partagée
// `txAchatsEnRetour` (api/_lib/suivi-colis.js), avec la marque, les couleurs et le modèle de l'APP :
//   B  un bordereau de retour reçu pour SON n° ⇒ absent de la feuille « Relier » (libres ET « déjà
//      reliés »), des propositions et des pistes ; l'avis « Retourne ta commande » par SA conversation aussi ;
//   C  litige CLOS sans retour (commande finalisée : il garde la paire) ⇒ de nouveau présent ;
//   R  remboursement prouvé (≥ payé) ⇒ absent ; partiel (il garde la paire) ⇒ présent ;
//   L  litige ouvert suivi par VRM (son n°) ⇒ absent ; statut « litige » ⇒ absent sans rien publier ;
//   P  « pas su » (bordereaux pas lus) ⇒ seul le statut écarte ; jamais par le titre ;
//   S  le branchement : l'écran qui lit les preuves PUBLIE la carte ; « Achetés, pas en ligne » et
//      l'atelier d'arrivée l'appliquent.
// Aucune donnée réelle : tout est inventé ici.
// --prouve : chaque mutation réaffaiblit une règle ⇒ l'audit DOIT rougir.
'use strict';
require('./_source-app.cjs').brancher();
const fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');
const R = path.join(__dirname, '..');
const MUTS = {
  'clos-ignore': ['src/achatsHorsRelier.js', '    if (closSansRetour(o)) continue;                       // clos sans retour : il garde la paire\n', ''],
  'bordereau-ignore': ['src/achatsHorsRelier.js', "    if (txRetour && typeof txRetour.has === 'function' && txRetour.has(tx)) { out.set(tx, 'retour'); continue; }\n", ''],
  'partiel-ecarte': ['src/achatsHorsRelier.js', '      if (!partiel) { out.set(tx, \'rembourse\'); continue; }', "      out.set(tx, 'rembourse'); continue;"],
  'litige-ignore': ['src/achatsHorsRelier.js', "    if (litigeTx.has(tx)) { out.set(tx, 'litige'); continue; }\n", ''],
  'statut-litige-ignore': ['src/achatsHorsRelier.js', "  if (/suspend/i.test(st) || RE_LITIGE_STATUT.test(st)) return 'litige';", "  if (/suspend/i.test(st)) return 'litige';"],
  'carte-pas-lue': ['src/suggestionsAchat.js', 'export const achatAnnule = (achat) => achatHorsRelier(achat);', "export const achatAnnule = (achat) => /annul|cancel|refus|rembours|retour|suspend|[ée]chou|failed/i.test(String((achat && achat.status) || ''));"],
  'liaison-cache': ['src/liaisonAchat.js', "  return { ...base, a, couleurs: coul.c, couleurSource: coul.source, couleursPhoto: coul.photo, annule: achatAnnule(a),", "  return { ...base, a, couleurs: coul.c, couleurSource: coul.source, couleursPhoto: coul.photo,"],
  'app-sans-publier': ['src/App.jsx', '    publierHorsRelier(m);\n', ''],
  'app-pas-en-ligne': ['src/App.jsx', 'achats: Array.isArray(buys.items) && !buys.error ? buysAJuger : null', 'achats: Array.isArray(buys.items) && !buys.error ? buysBase : null'],
  'app-atelier': ['src/App.jsx', 'annule: (o) => achatAnnule(o) || achatHorsRelier(o, achatsHorsRelierRes)', 'annule: achatAnnule'],
};
if (process.argv.includes('--prouve')) {
  let n = 0;
  for (const k of Object.keys(MUTS)) {
    let code = 0; try { execFileSync(process.execPath, [__filename, '--mutation=' + k], { stdio: 'pipe' }); } catch (e) { code = e.status; }
    console.log(`${code === 1 ? '✅' : '❌'} mutation « ${k} » ⇒ ${code === 1 ? 'ROUGE' : 'pas attrapée (' + code + ')'}`); if (code === 1) n++;
  }
  console.log(`${n}/${Object.keys(MUTS).length} mutations attrapées`); process.exit(n === Object.keys(MUTS).length ? 0 : 1);
}
let RACINE = R;
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1];
if (MUT) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'hors-relier-'));
  process.on('exit', () => { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {} });   // (disque partagé : rien ne reste)
  for (const x of ['src', 'api']) fs.cpSync(path.join(R, x), path.join(d, x), { recursive: true, filter: (s) => !/node_modules/.test(s) });
  try { fs.copyFileSync(path.join(R, 'package.json'), path.join(d, 'package.json')); } catch (_) {}
  const [f, ...paires] = MUTS[MUT];
  const p = path.join(d, f); let s = fs.readFileSync(p, 'utf8');
  for (let i = 0; i < paires.length; i += 2) { if (!s.includes(paires[i])) { console.log('motif introuvable : ' + MUT); process.exit(2); } s = s.replace(paires[i], paires[i + 1]); }
  fs.writeFileSync(p, s); RACINE = d;
  console.log('⚠️  MUTATION « ' + MUT + ' » — doit rougir');
}
const SRC = path.join(RACINE, 'src');
let ok = 0, ko = 0;
const dit = (c, m, d = '') => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (c || !d ? '' : ' — ' + d)); };

const { sourceApp } = require('./_source-app.cjs');
const APP = sourceApp(RACINE);
const bout = (debut, fin) => { const a = APP.indexOf(debut); const b = APP.indexOf(fin, a); if (a < 0 || b < 0) throw new Error('introuvable : ' + debut); return APP.slice(a, b + fin.length); };
const ctx = {};
vm.runInNewContext([bout('const KNOWN_BRANDS=[', '];'), bout('function extractBrand(text){', '\n}'), bout('const COULEURS = {', '\n};'),
  bout('function extractColors(text){', '\n}'), bout('const KNOWN_MODELS = [', '];'), bout('function extractModel(text){', '\n}'), bout('function contientModele(t,k){', '\n}'),
  'this.extractBrand=extractBrand; this.extractColors=extractColors; this.extractModel=extractModel;'].join('\n'), ctx);
const regles = { marqueDe: ctx.extractBrand, couleursDe: ctx.extractColors, modeleDe: ctx.extractModel };

const J = 86400e3, T0 = Date.parse('2026-09-01T10:00:00Z');
const iso = (t) => new Date(t).toISOString();
const achat = (tx, title, extra = {}) => ({ transaction_id: tx, title, date: iso(T0 - 12 * J), price: { amount: '24.63', currency_code: 'EUR' }, status: 'Colis livré', conversation_id: 'c' + tx, ...extra });
const paye = (o) => Number(o && o.price && o.price.amount);

(async () => {
  let H = null, S = null, L = null, SC = null;
  try { H = await import(pathToFileURL(path.join(SRC, 'achatsHorsRelier.js')).href); } catch (e) { dit(false, 'src/achatsHorsRelier.js se charge', e.message.split('\n')[0]); }
  try { S = await import(pathToFileURL(path.join(SRC, 'suggestionsAchat.js')).href); } catch (e) { dit(false, 'src/suggestionsAchat.js se charge', e.message.split('\n')[0]); }
  try { L = await import(pathToFileURL(path.join(SRC, 'liaisonAchat.js')).href); } catch (e) { dit(false, 'src/liaisonAchat.js se charge', e.message.split('\n')[0]); }
  try { SC = await import(pathToFileURL(path.join(RACINE, 'api/_lib/suivi-colis.js')).href); } catch (e) { dit(false, 'api/_lib/suivi-colis.js se charge', e.message.split('\n')[0]); }
  if (!S || !L || !SC) { console.log(`\n${ok} ✅ · ${ko} ❌`); process.exit(1); }
  // Sur l'arbre d'avant le module n'existe pas : la règle « rien n'est publié » ; chaque contrôle rapporte (un banc ne meurt pas).
  if (!H) H = { achatsHorsRelier: () => new Map(), publierHorsRelier: () => {}, achatHorsRelier: () => false };

  // La scène : une vente « Nike Dunk Low noir 42 » sans achat ; QUATRE achats identiques par le titre.
  const A = [
    achat(9001, 'Nike Dunk Low noir 42'),                               // retour : bordereau reçu
    achat(9002, 'Nike Dunk Low noir 42', { status: 'Commande finalisée', transaction_user_status: 'completed' }), // bordereau, mais clos sans retour
    achat(9003, 'Nike Dunk Low noir 42'),                               // remboursé en entier (e-mail)
    achat(9004, 'Nike Dunk Low noir 42'),                               // remboursé en partie (il garde la paire)
    achat(9005, 'Nike Dunk Low noir 42'),                               // litige ouvert suivi par VRM
    achat(9006, 'Nike Dunk Low noir 42'),                               // avis « Retourne ta commande » par SA conversation
    achat(9007, 'Nike Dunk Low noir 42', { status: 'Litige en cours' }), // statut litige
    achat(9008, 'Nike Dunk Low noir 42'),                               // libre
  ];
  const bords = [{ transaction: '9001', sens: 'achat' }, { transaction: '9002', sens: 'achat' }, { transaction: '9010', sens: 'vente' }];
  const demandes = [{ conv: 'c9006', sens: 'achat' }];
  const txRetour = SC.txAchatsEnRetour(bords, { demandes, achats: A });
  const remb = new Map([['9003', { tx: '9003', montant: 24.63 }], ['9004', { tx: '9004', montant: 5 }]]);
  const litiges = [{ sens: 'achat', plateforme: 'vinted', tx: '9005', genre: 'probleme' }, { sens: 'vente', plateforme: 'vinted', tx: '9008', genre: 'probleme' }];
  const carte = H.achatsHorsRelier({ achats: A, txRetour, remb, litiges, montantDe: paye });
  H.publierHorsRelier(carte);

  const cible = { key: 'v:777', titre: 'Nike Dunk Low noir 42', taille: '42', dateRef: iso(T0), dateRefSource: 'vente', prix: { amount: '60' } };
  const feuille = S.tousAchatsLibresDetail({ achats: A, liens: new Map(), ...regles });
  const ids = (l) => l.map((a) => String(a.transaction_id)).sort();
  const libres = ids(feuille.liste);
  // Même scène, mais les deux premiers sont déjà reliés ailleurs (« Déjà relié à N°… ») : la feuille ne les montre pas non plus.
  const liens2 = new Map([['9001', 1], ['9002', 1]]);
  const feuille2 = S.tousAchatsLibresDetail({ achats: A, liens: liens2, ...regles });
  const props = L.affecterPropositions({ cibles: [cible], achats: A, liens: new Map(), ...regles });
  const vusProps = new Set([...(props.parArticle['v:777'] || []), ...((props.pistes || {})['v:777'] || [])].map((p) => String(p.achat.transaction_id)));
  const pistes = L.pistesArticle({ cible, achats: A, liens: new Map(), ...regles }).map((p) => String(p.achat.transaction_id));

  // ── B · le bordereau de retour ──
  dit(!libres.includes('9001'), 'B1 bordereau de retour reçu pour SON n° ⇒ absent de la feuille « Relier »', libres.join(','));
  dit(!ids(feuille2.pris).includes('9001'), 'B2 …ni parmi « Déjà relié à N°… » (pas de « Déplacer ici »)', ids(feuille2.pris).join(','));
  dit(!vusProps.has('9001') && !pistes.includes('9001'), 'B3 …ni proposé, ni en piste', [...vusProps].join(','));
  dit(pistes.includes('9008') || vusProps.has('9008'), 'B3b (témoin) un achat libre du même titre, lui, arrive bien aux propositions / pistes', pistes.join(','));
  dit(!libres.includes('9006'), 'B4 avis « Retourne ta commande » désigné par SA conversation ⇒ absent', libres.join(','));
  dit(carte.get('9001') === 'retour', 'B5 la raison dite : « retour »', String(carte.get('9001')));
  // ── C · clos sans retour ──
  dit(libres.includes('9002'), 'C1 litige clos sans retour (commande finalisée, il garde la paire) ⇒ de nouveau présent', libres.join(','));
  dit(ids(feuille2.pris).includes('9002'), 'C2 …et proposable au déplacement s’il est relié ailleurs', ids(feuille2.pris).join(','));
  // ── R · remboursement ──
  dit(!libres.includes('9003'), 'R1 remboursé en entier (e-mail, même n°) ⇒ absent', libres.join(','));
  dit(libres.includes('9004'), 'R2 remboursé en PARTIE (il garde la paire) ⇒ présent', libres.join(','));
  // ── L · litige ──
  dit(!libres.includes('9005'), 'L1 litige ouvert suivi par VRM (son n°) ⇒ absent', libres.join(','));
  dit(!libres.includes('9007'), 'L2 statut « Litige en cours » ⇒ absent', libres.join(','));
  dit(H.achatHorsRelier(A[6], null) === true, 'L3 …même sans aucune carte publiée (le statut suffit)');
  dit(libres.includes('9008'), 'L4 un litige sur une VENTE du même n° n’écarte pas l’achat', libres.join(','));
  // ── P · pas su ──
  const pasSu = H.achatsHorsRelier({ achats: A, txRetour: SC.txAchatsEnRetour(null, {}), remb: null, litiges: null, montantDe: paye });
  dit(!pasSu.has('9001') && !pasSu.has('9003') && pasSu.has('9007'), 'P1 bordereaux, remboursements et litiges pas lus ⇒ seul le statut écarte', JSON.stringify([...pasSu]));
  // Jamais par le titre : un achat du même titre qu'un achat en retour reste libre.
  dit(libres.includes('9008') && libres.length === 3, 'P2 jamais par le titre : 8 achats au même titre, exactement 3 libres (9002, 9004, 9008)', libres.join(','));
  // La carte arrive APRÈS une première affectation, sur les MÊMES objets d'achat (un cache par achat ne doit pas la manquer).
  {
    const A2 = [achat(9101, 'Nike Dunk Low noir 42'), achat(9102, 'Nike Dunk Low noir 42')];
    H.publierHorsRelier(null);
    const vus = () => { const r = L.affecterPropositions({ cibles: [cible], achats: A2, liens: new Map(), ...regles }); return [...(r.parArticle['v:777'] || []), ...((r.pistes || {})['v:777'] || [])].map((p) => String(p.achat.transaction_id)); };
    const avant = vus();
    H.publierHorsRelier(H.achatsHorsRelier({ achats: A2, txRetour: new Set(['9101']), montantDe: paye }));
    const apres = vus();
    dit(avant.includes('9101') && !apres.includes('9101') && apres.includes('9102'), 'B6 la carte publiée APRÈS un premier calcul s’applique aux mêmes achats (rien de gardé en cache)', `${avant} → ${apres}`);
  }
  H.publierHorsRelier(null);
  const sansCarte = ids(S.tousAchatsLibresDetail({ achats: A, liens: new Map(), ...regles }).liste);
  dit(sansCarte.includes('9001') && !sansCarte.includes('9007'), 'P3 carte retirée ⇒ les preuves ne s’appliquent plus, le statut oui', sansCarte.join(','));

  // ── S · le branchement dans l'app ──
  const sans = (s) => s.replace(/\/\/[^\n]*/g, '');
  const app = sans(APP);
  dit(/achatsHorsRelier\(\{\s*achats:[^}]*txRetour:\s*txRetourAchat[^}]*remb:[^}]*litiges:/.test(app), 'S1 Comptabilité calcule la carte avec les bordereaux, remboursements et litiges lus');
  dit(/achatsHorsRelier\(\{[\s\S]{0,400}?publierHorsRelier\(m\)/.test(app), 'S2 …et la PUBLIE pour les règles de liaison');
  dit(/usePasEnLigne\(\{[^\n]*achats:[^\n]*buysAJuger/.test(app) && /buysAJuger = useMemo\(\(\) => buysBase\.filter\(\(o\) => !achatHorsRelier\(o, achatsHorsRelierRes\)\)/.test(app), 'S3 « Achetés, pas en ligne » ne juge pas un achat en retour / litige');
  dit(/achatsPourAtelier\(\{[^\n]*annule: \(o\) => achatAnnule\(o\) \|\| achatHorsRelier\(o, achatsHorsRelierRes\)/.test(app), 'S4 l’atelier d’arrivée ne propose pas un achat en retour / litige');
  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})();
