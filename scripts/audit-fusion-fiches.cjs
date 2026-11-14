// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : FUSIONNER DEUX FICHES (14 nov., proposition 107) — node scripts/audit-fusion-fiches.cjs
// ═══════════════════════════════════════════════════════════════════════════
// EXÉCUTE la vraie règle (src/fusionFiches.js) ET les vraies opérations
// (src/gesteAnnulable.js : `appliquerOps`, sens « après » puis « avant ») sur
// 50 paires INVENTÉES au même titre :
//   A. ⚠️ JAMAIS UN N° PERDU NI RÉATTRIBUÉ : après une fusion, après « Annuler », après
//      « Défaire » — chaque fiche garde EXACTEMENT son N° ; aucune opération ne touche
//      `numero` (ni `auto`, `numberedAt`, `manuelAt`, `reattribue`) ; la clé des numéros
//      n'est jamais écrite en entier ; deux N° différents restent visibles (alias),
//      celui du carton est SON choix (obligatoire), jamais deviné ;
//   B. compléter sans écraser : un prix d'achat manquant est recopié, une valeur présente
//      n'est jamais remplacée, deux valeurs différentes sont un désaccord (rien ne change) ;
//   C. refus PROUVÉS : la même fiche, une fiche absente, déjà la même paire (`recreeDe`),
//      déjà fusionnée, deux ventes prouvées, deux cases du Stock ;
//   D. défaire : 30 jours (au-delà, refusé) ; un champ qu'il a modifié depuis reste le sien ;
//      la fusion reste dans l'historique, marquée défaite ;
//   E. l'identité : une fusion relie les deux annonces dans « en ligne deux fois »
//      (src/enLigneDeuxFois.js), dans les N° ambigus des notes (src/notePaire.js) et dans
//      `doublonsAReattribuer` (App.jsx, exécuté) ; sans fusion, 50 paires au même titre
//      restent 50 paires ; rien ne fusionne seul (aucun appel hors de SON clic dans l'app).
// AUDIT_MUTATION=numero | ecrase | carton | doublons : la règle réaffaiblie ⇒ rouge.
'use strict';
require('./_source-app.cjs').brancher();
const fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm');
const RACINE = path.join(__dirname, '..');
const MUT = process.env.AUDIT_MUTATION || '';
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const SRC = path.join(RACINE, 'src', 'fusionFiches.js');
const MUTATIONS = {
  // Une fusion « range » le N° de l'autre fiche sur celle du carton (ce que §5 interdit).
  numero: ["export const CHAMPS_FUSION = Object.freeze(['buyPrice', 'fees', 'buyFrom', 'buyFromId', 'size']);\nconst INTERDITS = new Set(['numero', 'auto', 'numberedAt', 'manuelAt', 'reattribue', 'repriseDe', 'recreeDe']);", "export const CHAMPS_FUSION = Object.freeze(['buyPrice', 'fees', 'buyFrom', 'buyFromId', 'size', 'numero']);\nconst INTERDITS = new Set([]);"],
  // Une valeur présente est écrasée par l'autre.
  ecrase: ["if (!vide(va) && !vide(vb)) { champs.push({ champ: c, va, vb, action: egal(va, vb) ? 'egal' : 'conflit' }); continue; }", "if (!vide(va) && !vide(vb)) { champs.push({ champ: c, va, vb, action: 'copier', vers: A, valeur: vb }); continue; }"],
  // Le N° du carton est deviné (le premier) au lieu d'être SON choix.
  carton: ["if (!c) return { ok: false, raison: 'carton' };", "if (!c) c = apercu.nums[0];"],
};
const lire = (f) => { try { return fs.readFileSync(path.join(RACINE, f), 'utf8'); } catch (_) { return ''; } };
(async () => {
  if (!fs.existsSync(SRC)) { dit(false, 'src/fusionFiches.js existe', 'absent : la fusion n’existe pas sur cet arbre'); return fin(); }
  let chemin = SRC;
  if (MUT && MUTATIONS[MUT]) {
    const m = MUTATIONS[MUT]; let s = fs.readFileSync(SRC, 'utf8');
    if (!s.includes(m[0])) { console.log('KO  mutation plus applicable : ' + MUT); process.exit(2); }
    chemin = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mut-fusion-')), 'fusionFiches.mjs');
    fs.writeFileSync(chemin, s.replace(m[0], m[1]));
    console.log('── mutation : ' + MUT);
  } else if (MUT && MUT !== 'doublons') { console.log('KO  mutation inconnue : ' + MUT); process.exit(2); }
  const F = await import(chemin);
  const G = await import(path.join(RACINE, 'src', 'gesteAnnulable.js'));
  const T0 = '2026-11-14T10:00:00.000Z';
  // 50 paires inventées, même titre ; N°201..250 ; quelques prix d'achat.
  const fiches0 = {};
  for (let i = 0; i < 50; i++) fiches0[String(9000000 + i)] = { numero: String(201 + i), title: 'Nike Dunk Low Panda 42', photo: `https://images1.vinted.net/t/x/f800/${5000 + i}.jpeg`, ...(i % 3 === 0 ? { buyPrice: '60' } : {}), ...(i % 5 === 0 ? { size: '42' } : {}) };
  const nums = (f) => JSON.stringify(Object.fromEntries(Object.entries(f).map(([id, x]) => [id, [x.numero, x.auto, x.numberedAt, x.manuelAt, x.reattribue]])));
  const base0 = nums(fiches0);
  const appliquer = (store, ops, sens) => { const out = { ...store }; for (const k of G.clesDe(ops)) out[k] = G.appliquerOps(out[k], ops, sens, k); return out; };

  // ── A + B : fusion de 9000001 (N°202, pas de prix) avec 9000003 (N°204, prix 60) ──
  const A = '9000001', B = '9000003';
  const ap = F.apercuFusion({ a: A, b: B, fiches: fiches0, cleNum: undefined });
  dit(ap.ok && ap.choixCarton && ap.nums.join(',') === '202,204', 'A. deux N° différents : le N° du carton est À CHOISIR', JSON.stringify(ap.nums));
  const sansCarton = F.opsFusion(ap, { fiches: fiches0 });
  dit(!sansCarton.ok && sansCarton.raison === 'carton', 'A. sans SON choix du carton : rien ne se fusionne (jamais deviné)');
  const res = F.opsFusion(ap, { carton: '204', fiches: fiches0, maintenant: T0 });
  dit(res.ok, 'A. avec le carton choisi : la fusion se prépare');
  const touche = (res.ops || []).filter((o) => o.k === 'vinted_annonce_numeros');
  dit(touche.every((o) => o.type === 'champs') && touche.every((o) => !Object.keys(o.apres || {}).some((c) => ['numero', 'auto', 'numberedAt', 'manuelAt', 'reattribue'].includes(c))), 'A. aucune opération ne touche un N° (que des champs, jamais `numero`)', JSON.stringify(touche.map((o) => Object.keys(o.apres))));
  let st = { vinted_annonce_numeros: fiches0, vrm_fusions_fiches: {} };
  st = appliquer(st, res.ops, 'apres');
  dit(nums(st.vinted_annonce_numeros) === base0, 'A. après la fusion : chaque fiche garde EXACTEMENT son N°');
  dit(Object.keys(st.vinted_annonce_numeros).length === 50, 'A. aucune fiche supprimée');
  dit(st.vinted_annonce_numeros[A].buyPrice === '60' && fiches0[A].buyPrice === undefined, 'B. le prix d’achat manquant est recopié');
  const al = F.aliasDuNumero(st.vrm_fusions_fiches, '202');
  dit(al && al.carton === '204' && al.autres.join() === '204' && !al.estCarton, 'A. le N°202 reste visible : alias du N°204, qui est sur le carton');
  const al2 = F.aliasDuNumero(st.vrm_fusions_fiches, '204');
  dit(al2 && al2.estCarton && al2.autres.join() === '202', 'A. le N°204 dit qu’il est sur le carton, et nomme le N°202');
  const annule = appliquer(st, res.ops, 'avant');
  dit(nums(annule.vinted_annonce_numeros) === base0 && annule.vinted_annonce_numeros[A].buyPrice === undefined && !annule.vrm_fusions_fiches[res.id], '« Annuler » (5 s) : tout revient, aucun N° touché');

  // B. valeurs présentes jamais écrasées
  const fx = { ...fiches0, [A]: { ...fiches0[A], buyPrice: '55' } };
  const apx = F.apercuFusion({ a: A, b: B, fiches: fx });
  const c = apx.champs.find((x) => x.champ === 'buyPrice');
  const rx = F.opsFusion(apx, { carton: '202', fiches: fx });
  const apres = appliquer({ vinted_annonce_numeros: fx, vrm_fusions_fiches: {} }, rx.ops, 'apres');
  dit(c && c.action === 'conflit' && apres.vinted_annonce_numeros[A].buyPrice === '55' && apres.vinted_annonce_numeros[B].buyPrice === '60', 'B. deux prix différents : un désaccord montré, aucun n’est changé');
  const apEg = F.apercuFusion({ a: '9000000', b: '9000003', fiches: fiches0 });
  dit(apEg.champs.find((x) => x.champ === 'buyPrice').action === 'egal', 'B. deux prix égaux : rien à faire');

  // C. refus
  dit(F.apercuFusion({ a: A, b: A, fiches: fiches0 }).raison === 'meme', 'C. la même fiche : refusé');
  dit(F.apercuFusion({ a: A, b: '1', fiches: fiches0 }).raison === 'absente', 'C. une fiche absente : refusé');
  dit(F.apercuFusion({ a: A, b: B, fiches: { ...fiches0, [B]: { ...fiches0[B], recreeDe: A } } }).raison === 'dejaMeme', 'C. déjà la même paire (republiée) : refusé');
  dit(F.apercuFusion({ a: A, b: '9000007', fiches: st.vinted_annonce_numeros, registre: st.vrm_fusions_fiches }).raison === 'deja', 'C. une fiche déjà fusionnée : refusé');
  dit(F.apercuFusion({ a: A, b: B, fiches: fiches0, vendus: new Set([A, B]) }).raison === 'deuxVentes', 'C. deux ventes prouvées : refusé (deux paires)');
  dit(F.apercuFusion({ a: A, b: B, fiches: fiches0, vendus: null }).ok, 'C. ventes pas sues : rien n’est refusé là-dessus (pas su ≠ oui)');
  const cases = { 202: 'Étagère · A-1', 204: 'Étagère · B-3' };
  dit(F.apercuFusion({ a: A, b: B, fiches: fiches0, caseDe: (k) => cases[k] || '' }).raison === 'deuxCases', 'C. rangées dans deux cases du Stock : refusé (deux cartons)');

  // A (suite). Une fiche SANS N° fusionnée avec la N°210 : elle ne reçoit AUCUN N° (la fusion
  // ne numérote jamais ; un N° se donne par la règle des numéros, pas par une fusion).
  const SN = '9000009', fsn = { ...fiches0, [SN]: { ...fiches0[SN], numero: undefined, buyPrice: undefined } };
  const apSn = F.apercuFusion({ a: SN, b: '9000006', fiches: fsn });
  const rSn = apSn.ok ? F.opsFusion(apSn, { fiches: fsn }) : null;
  const stSn = rSn && rSn.ok ? appliquer({ vinted_annonce_numeros: fsn, vrm_fusions_fiches: {} }, rSn.ops, 'apres') : null;
  dit(!!stSn && stSn.vinted_annonce_numeros[SN].numero === undefined && stSn.vinted_annonce_numeros['9000006'].numero === '207' && stSn.vinted_annonce_numeros[SN].buyPrice === '60', 'A. une fiche sans N° fusionnée : elle ne reçoit aucun N° (le prix, lui, est recopié)');

  // D. défaire
  const t10 = '2026-11-24T10:00:00.000Z', t40 = '2026-12-24T10:00:00.000Z';
  const modifie = { ...st, vinted_annonce_numeros: { ...st.vinted_annonce_numeros } };
  const d1 = F.opsDefaire(res.id, { registre: st.vrm_fusions_fiches, fiches: st.vinted_annonce_numeros, maintenant: t10 });
  const defait = appliquer(st, d1.ops, 'apres');
  dit(d1.ok && defait.vinted_annonce_numeros[A].buyPrice === undefined && nums(defait.vinted_annonce_numeros) === base0, 'D. « Défaire » (10 jours) : le champ recopié est retiré, aucun N° touché');
  dit(defait.vrm_fusions_fiches[res.id] && defait.vrm_fusions_fiches[res.id].annuleeAt === t10 && F.historiqueFusions(defait.vrm_fusions_fiches).length === 1 && !F.aliasDuNumero(defait.vrm_fusions_fiches, '202'), 'D. la fusion reste dans l’historique, marquée défaite ; plus d’alias');
  modifie.vinted_annonce_numeros[A] = { ...modifie.vinted_annonce_numeros[A], buyPrice: '58' };
  const d2 = F.opsDefaire(res.id, { registre: st.vrm_fusions_fiches, fiches: modifie.vinted_annonce_numeros, maintenant: t10 });
  dit(appliquer(modifie, d2.ops, 'apres').vinted_annonce_numeros[A].buyPrice === '58', 'D. un prix qu’il a changé depuis reste le sien');
  dit(F.opsDefaire(res.id, { registre: st.vrm_fusions_fiches, fiches: st.vinted_annonce_numeros, maintenant: t40 }).raison === 'tropVieille', 'D. au-delà de 30 jours : refusé');
  dit(F.opsDefaire(res.id, { registre: defait.vrm_fusions_fiches, fiches: defait.vinted_annonce_numeros, maintenant: t10 }).raison === 'dejaDefaite', 'D. défaire deux fois : refusé');

  // E. l'identité
  const E2 = await import(path.join(RACINE, 'src', 'enLigneDeuxFois.js'));
  const enLigne = Object.entries(fiches0).map(([id, f]) => ({ id, title: f.title, photo: f.photo }));
  const vinted = [{ uid: '1', nom: 'compte', ok: true, lu: Date.parse(T0), enLigne }];
  const sans = E2.enLigneDeuxFois({ vinted, fiches: fiches0, maintenant: Date.parse(T0) });
  const avec = E2.enLigneDeuxFois({ vinted, fiches: fiches0, maintenant: Date.parse(T0), memes: F.pairesFusionnees(st.vrm_fusions_fiches) });
  dit(sans.vinted.length === 0, 'E. sans fusion : 50 paires au même titre restent 50 paires (aucun groupe)');
  dit(avec.vinted.length === 1 && avec.vinted[0].annonces.map((x) => x.id).sort().join() === [A, B].sort().join() && avec.vinted[0].preuves.includes('fusion'), 'E. la fusion relie EXACTEMENT ces deux annonces (« en ligne deux fois », preuve « fusion »)');
  const N = await import(path.join(RACINE, 'src', 'notePaire.js'));
  const fm = { ...fiches0, [B]: { ...fiches0[B], numero: '202' } };
  dit(N.numerosAmbigus(fm).has('202') && !N.numerosAmbigus(fm, { memes: F.pairesFusionnees(st.vrm_fusions_fiches) }).has('202'), 'E. notes : un N° porté par deux fiches FUSIONNÉES n’est plus « ambigu »');
  // doublonsAReattribuer, exécuté (bloc d'App.jsx)
  const app = fs.readFileSync(path.join(RACINE, 'src', 'App.jsx'), 'utf8');
  const a0 = app.indexOf('// <doublons-reattribuer-regle>'), b0 = app.indexOf('// </doublons-reattribuer-regle>');
  let bloc = app.slice(a0, b0);
  if (MUT === 'doublons') { bloc = bloc.replace(/if \(annonces\.length === 2 && Array\.isArray\(memes\)[^\n]*\n/, ''); console.log('── mutation : doublons'); }
  const ctx = vm.createContext({});
  vm.runInContext('const cleNum = (v) => { let s = String(v == null ? "" : v).trim().toUpperCase().replace(/[\\s\\-_.]/g, ""); if (/^\\d+$/.test(s)) s = String(parseInt(s, 10)); return s; };\n' + bloc + '\nthis.d = doublonsAReattribuer;', ctx);
  const conflits = [{ numero: '202', porteurs: [{ type: 'annonce', id: A }, { type: 'annonce', id: B }] }];
  const r0 = ctx.d(conflits, fm), r1 = ctx.d(conflits, fm, F.pairesFusionnees(st.vrm_fusions_fiches));
  dit(r0.length === 1 && r1.length === 0, 'E. doublons : deux fiches FUSIONNÉES sous un N° ne sont pas renumérotées (sans fusion : l’une l’est, la règle du 20 oct.)', `${r0.length} → ${r1.length}`);
  const appel = app.match(/doublonsAReattribuer\(conflitsNum, numeros, pairesFusionnees\(load\(CLE_FUSIONS/);
  dit(!!appel, 'E. l’app passe les fusions à `doublonsAReattribuer`');
  const appels = (app.match(/opsFusion\(/g) || []).length + (lire('src/AtelierPaire.jsx').match(/opsFusion\(/g) || []).length;
  dit(appels === 1 && /onClick=\{\(\) => \{ if \(res && res\.ok\) onFusionner\(res, ap\); \}\}/.test(lire('src/AtelierPaire.jsx')), 'E. une fusion ne part que de SON clic (« Fusionner », après l’aperçu)', String(appels));
  dit(!/opsFusion|apercuFusion/.test(app.replace(/\/\/.*$/gm, '')), 'E. aucun calcul de l’app ne fusionne de lui-même');
  const sc = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  dit(!/prochainLibre|recordUsed|nextNumero/.test(sc(fs.readFileSync(SRC, 'utf8'))) && !/prochainLibre|recordUsed|nextNumero/.test(sc(lire('src/AtelierPaire.jsx'))), 'A. la fusion n’appelle jamais le pool des N°');
  fin();
})().catch((e) => { console.log('KO  exception : ' + (e && e.stack || e)); process.exit(1); });
function fin() { console.log(ko ? `\n${ko} contrôle(s) en échec` : '\nTout est vert'); process.exit(ko ? 1 : 0); }
