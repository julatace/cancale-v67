// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : L'OBJECTIF DU MOIS — un réglage, la règle du « vendu »
//         node scripts/audit-objectif-mois.cjs [--mutation=type|zero|cache|defaut|arrondi|saisie|retirer|benefice|retard|propose|couvert|histoire|bilanvu|perte]
// ═══════════════════════════════════════════════════════════════════════════
// Julien fixe un objectif (CA vendu OU nombre de ventes) ; une barre fine dans
// la carte sombre montre où il en est par la MÊME règle que le chiffre affiché
// (VENDU = `ventesFaites`, `resumeVendu` de Ma journée pour le mois). Aucun
// objectif ⇒ rien. Cet audit EXÉCUTE src/objectifMois.js, la lecture de la carte
// (src/design/carteChiffres.js) et les règles d'App.jsx (extraites, dans un vm)
// sur des ventes INVENTÉES (le dépôt est public) :
//   1. lecture du réglage : illisible / ≤ 0 / ventes non entières ⇒ aucun objectif ;
//   2. saisie : « 2 000 », « 1500,50 » lus ; « 2k », « -3 », « 0 » refusés ;
//   3. la valeur de la barre = `resumeVendu(...).mois` (eur ou n), tous sites ;
//      « pas su » ⇒ null (jamais 0 %) ; manque nommé ⇒ partiel ;
//   4. le pourcentage ne s'arrondit jamais vers le haut (99,6 % n'est pas 100 %) ;
//   5. par carte : montrée partout sauf Achats et Colis, son choix l'emporte ;
//   6. le branchement : réglage synchronisé, les deux anciennes clés plus écrites,
//      la carte et Statistiques lisent la même valeur ;
//   7. (11 nov., lot objectifs-mois) le bénéfice (= la case « Bénéfice brut »), le
//      rythme (en avance / en retard, jamais « en retard » sur un « au moins »), la
//      proposition (3 mois pleins, rien si un mois est troué), l'histoire par mois
//      et le bilan de fin de mois (une fois, sur l'objectif d'ALORS).
// `--mutation=…` réaffaiblit la règle dans une copie : rouge exigé.
const fs = require('fs'), path = require('path'), vm = require('vm'), os = require('os');
const R = process.env.VRM_RACINE || path.join(__dirname, '..');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; if (!c || process.env.BAVARD) console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const lire = (f) => { try { return fs.readFileSync(path.join(R, f), 'utf8'); } catch (_) { return ''; } };
let APP = require("./_source-app.cjs").sourceApp();
let OBJ = lire('src/objectifMois.js');
let CARTE = lire('src/design/carteChiffres.js');
const CARTE_JSX = lire('src/design/CarteStats.jsx');
const muter = (quoi, avant, apres) => {
  const src = quoi === 'obj' ? OBJ : CARTE;
  if (!src.includes(avant)) { console.log('❌ mutation impossible : motif absent — ' + avant.slice(0, 90)); process.exit(2); }
  if (quoi === 'obj') OBJ = OBJ.replace(avant, apres); else CARTE = CARTE.replace(avant, apres);
};
if (MUT === 'type') muter('carte', "const id = CHIFFRE_OBJECTIF[obj.type] || 'vendu';", "const id = obj.type === 'ventes' ? 'ventes' : 'vendu';");
else if (MUT === 'benefice') muter('carte', "{ ca: 'vendu', benefice: 'brut', ventes: 'ventes' }", "{ ca: 'vendu', benefice: 'vendu', ventes: 'ventes' }");
else if (MUT === 'retard') muter('obj', "  if (prog.partiel) return null;\n  return { etat: 'retard'", "  return { etat: 'retard'");
else if (MUT === 'propose') muter('obj', "|| m.partiel || m.couvert === false)", ")");
else if (MUT === 'couvert') muter('carte', "let couvert = L.some((l) => Number(l.ts) < bornes.de);", "let couvert = true;");
else if (MUT === 'histoire') muter('obj', ".filter((x) => x <= ym).sort().pop();", ".sort().pop();");
else if (MUT === 'bilanvu') muter('obj', "  if (brut && brut.bilanVu === mp.ym) return null;\n", "");
else if (MUT === 'perte') muter('obj', "out.parMois = garderSix({ ...(garde.parMois || {}), [ym]: { type: out.type, valeur: lireObjectif(out).valeur } });", "out.parMois = { [ym]: { type: out.type, valeur: lireObjectif(out).valeur } };");
else if (MUT === 'zero') muter('obj', "if (val == null) return { type: obj.type, objectif: obj.valeur, valeur: null, pct: null,", "if (val == null) return { type: obj.type, objectif: obj.valeur, valeur: 0, pct: 0,");
else if (MUT === 'cache') muter('obj', "  if (c === true) return false;\n", '');
else if (MUT === 'defaut') muter('obj', "export const PAGES_SANS_OBJECTIF = ['achats', 'colis'];", 'export const PAGES_SANS_OBJECTIF = [];');
else if (MUT === 'arrondi') muter('obj', 'Math.floor((val / obj.valeur) * 100)', 'Math.round((val / obj.valeur) * 100)');
else if (MUT === 'saisie') muter('obj', "if (!/^\\d+(?:\\.\\d{1,2})?$/.test(s)) return null;\n  const v = Number(s);", 'const v = parseFloat(s);');
else if (MUT === 'retirer') muter('obj', "  if (changement == null) return { v: 1, ...garde,", "  if (changement == null) return actuel; if (0) return { v: 1, ...garde,");
else if (MUT) { console.log('❌ mutation inconnue : ' + MUT); process.exit(2); }

function extraire(src, nom) {
  const m = new RegExp(`^(?:export )?(?:async )?function ${nom}\\(|^(?:export )?const ${nom}\\s*=\\s*`, 'm').exec(src);
  if (!m) return '';
  const estFn = /function/.test(m[0]); let prof = 0, vuCorps = false;
  for (let i = m.index; i < src.length; i++) {
    const c = src[i];
    if (c === '(' || c === '[' || c === '{') { prof++; if (c === '{') vuCorps = true; }
    else if (c === ')' || c === ']' || c === '}') { prof--; if (estFn && vuCorps && prof === 0 && c === '}') return src.slice(m.index, i + 1); }
    else if (!estFn && c === ';' && prof === 0) return src.slice(m.index, i + 1);
  }
  return '';
}
const charger = async (texte, nom) => {
  const tmp = path.join(os.tmpdir(), `${nom}-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
  const dossier = path.join(R, nom === 'carte-chiffres' ? 'src/design' : 'src');
  const executable = texte.replace(/from (['"])(\.{1,2}\/[^'"]+)\1/g, (_, q, spec) => 'from ' + q + require('url').pathToFileURL(path.resolve(dossier, spec)).href + q);
  fs.writeFileSync(tmp, executable);
  try { return await import('file://' + tmp); } finally { try { fs.unlinkSync(tmp); } catch (_) {} }
};
const sansCommentaires = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

(async () => {
  let O = null, K = null;
  if (OBJ) { try { O = await charger(OBJ, 'objectif-mois'); } catch (e) { dit(false, 'src/objectifMois.js se charge', e.message); } }
  dit(!!O && typeof O.lireObjectif === 'function' && typeof O.progressionObjectif === 'function', 'le module de l’objectif existe (src/objectifMois.js)');
  try { K = await charger(CARTE, 'carte-chiffres'); } catch (e) { dit(false, 'carteChiffres se charge', e.message); }
  dit(!!K && typeof K.valeurObjectif === 'function', 'la carte lit la valeur de l’objectif (valeurObjectif)');
  const ctx = { Date, Math, Number, String, Object, Array, JSON, Set, isFinite, console };
  vm.createContext(ctx);
  const absents = [];
  for (const n of ['bilanLignes', 'resumeVendu', 'debutPeriode', 'decalerPeriode']) { const t = extraire(APP, n); if (!t) { absents.push(n); continue; } try { vm.runInContext(t.replace(/^const /, 'var ') + `\n;this.${n} = ${n};`, ctx); } catch (e) { absents.push(n + ' (' + e.message + ')'); } }
  dit(!absents.length, 'les règles propriétaires se lisent dans App.jsx', absents.join(', '));
  if (!O || !K || absents.length) { console.log(`\n❌ objectif-mois : ${ko} rouge(s), ${ok} vert(s)`); process.exit(1); }

  console.log('── 1. Le réglage');
  dit(O.lireObjectif(null) === null && O.lireObjectif({ v: 1 }) === null && O.lireObjectif({ type: 'ca', valeur: 0 }) === null && O.lireObjectif({ type: 'ca', valeur: -5 }) === null, 'absent, retiré, 0 ou négatif ⇒ aucun objectif');
  dit(O.lireObjectif({ type: 'ventes', valeur: 12.5 }) === null && O.lireObjectif({ type: 'marge', valeur: 10 }) === null && O.lireObjectif([1]) === null, 'ventes non entières, type inconnu, forme illisible ⇒ aucun objectif');
  const A = O.lireObjectif({ type: 'ca', valeur: '2000.456' });
  dit(A && A.type === 'ca' && A.valeur === 2000.46, 'un CA se lit au centime', JSON.stringify(A));

  console.log('── 2. La saisie');
  dit(O.lireSaisieObjectif('ca', '2 000') === 2000 && O.lireSaisieObjectif('ca', '1500,50') === 1500.5 && O.lireSaisieObjectif('ca', '1 200 €') === 1200, '« 2 000 », « 1500,50 », « 1 200 € » lus');
  dit(O.lireSaisieObjectif('ca', '2k') === null && O.lireSaisieObjectif('ca', '-3') === null && O.lireSaisieObjectif('ca', '0') === null && O.lireSaisieObjectif('ca', '') === null && O.lireSaisieObjectif('ca', '12abc') === null, '« 2k », « -3 », « 0 », vide, « 12abc » refusés (jamais devinés)');
  dit(O.lireSaisieObjectif('ventes', '40') === 40 && O.lireSaisieObjectif('ventes', '4,5') === null, 'un nombre de ventes est entier');

  console.log('── 3. Enregistrer, retirer, par carte');
  const pose = O.objectifAEnregistrer(null, { type: 'ventes', valeur: 40 });
  dit(pose && pose.type === 'ventes' && pose.valeur === 40 && O.lireObjectif(pose).valeur === 40, 'poser un objectif de ventes');
  const retire = O.objectifAEnregistrer(pose, null);
  dit(retire && O.lireObjectif(retire) === null, 'retirer ⇒ une ligne qui se lit « aucun objectif » (la suppression se synchronise)', JSON.stringify(retire));
  const lu = O.lireObjectif(pose);
  dit(O.objectifSurPage(lu, 'journee') && O.objectifSurPage(lu, 'ventes') && O.objectifSurPage(lu, 'compta'), 'montrée par défaut sur les cartes de ventes');
  dit(!O.objectifSurPage(lu, 'achats') && !O.objectifSurPage(lu, 'colis'), 'absente par défaut sur Achats et Colis (aucun chiffre de vente)');
  const cache = O.lireObjectif(O.objectifAEnregistrer(pose, { page: 'ventes', cacher: true }));
  const montre = O.lireObjectif(O.objectifAEnregistrer(pose, { page: 'colis', cacher: false }));
  dit(cache && !O.objectifSurPage(cache, 'ventes') && O.objectifSurPage(cache, 'journee'), 'masquée sur UNE carte, les autres gardent la barre');
  dit(montre && O.objectifSurPage(montre, 'colis'), 'son choix l’emporte : montrée sur Colis s’il l’y met');
  dit(O.objectifSurPage(null, 'journee') === false, 'aucun objectif ⇒ aucune barre');

  console.log('── 4. La valeur de la barre = la règle du « vendu » du mois');
  const MAINT = new Date(2026, 10, 18, 15).getTime();
  const T = (m, j, h = 12) => new Date(2026, m, j, h).getTime();
  const LIGNES = [
    { plateforme: 'Vinted', ts: T(10, 18, 9), eur: 45.5, compte: 'alice' },
    { plateforme: 'Vinted', ts: T(10, 1, 0, 30), eur: 70, compte: 'bruno' },
    { plateforme: 'Vinted', ts: T(9, 31, 23), eur: 25, compte: 'alice' },
    { plateforme: 'Leboncoin', ts: T(10, 3), eur: 55, compte: 'lbc1' },
    { plateforme: 'eBay', ts: T(10, 12), eur: 80.25, compte: 'x' },
    { plateforme: 'Vestiaire', ts: T(10, 9), eur: 120, compte: '' },
  ];
  const REGLES = { bilanLignes: ctx.bilanLignes, rythmeVendu: () => null, chiffreBenefice: () => ({}), chiffreBrut: () => ({}), beneficeDesJours: () => ({}), debutPeriode: ctx.debutPeriode, decalerPeriode: ctx.decalerPeriode, fmt: String };
  const src = (o = {}) => ({ vendu: { lignes: LIGNES, manque: [], enAttente: false, nonComptees: [] }, ...o });
  const attendu = ctx.resumeVendu(LIGNES, MAINT).mois;
  const vCa = K.valeurObjectif({ type: 'ca', valeur: 1000 }, src(), REGLES, MAINT);
  const vN = K.valeurObjectif({ type: 'ventes', valeur: 10 }, src(), REGLES, MAINT);
  dit(vCa && Math.abs(vCa.valeur - attendu.eur) < 0.005 && !vCa.partiel, 'CA : le « vendu ce mois » de Ma journée (resumeVendu), tous les sites', `${vCa && vCa.valeur} / ${attendu.eur}`);
  dit(vN && vN.valeur === attendu.n, 'ventes : le nombre de ventes du mois de Ma journée', `${vN && vN.valeur} / ${attendu.n}`);
  dit(Math.abs(attendu.eur - 370.75) < 0.005 && attendu.n === 5, 'le mois est celui de l’appareil (le 1er à 00 h 30 compte, le 31 octobre non)', `${attendu.eur} · ${attendu.n}`);
  const P = O.progressionObjectif(O.lireObjectif({ type: 'ca', valeur: 1000 }), vCa);
  dit(P.pct === 37 && !P.atteint && P.valeur === vCa.valeur, '370,75 € sur 1 000 € ⇒ 37 %', JSON.stringify(P));
  const presque = O.progressionObjectif(O.lireObjectif({ type: 'ca', valeur: 372 }), vCa);
  dit(presque.pct === 99 && !presque.atteint, '370,75 € sur 372 € ⇒ 99 %, pas atteint (jamais arrondi vers le haut)', `${presque.pct}`);
  const atteint = O.progressionObjectif(O.lireObjectif({ type: 'ventes', valeur: 5 }), vN);
  dit(atteint.pct === 100 && atteint.atteint, '5 ventes sur 5 ⇒ atteint');
  const vPasSu = K.valeurObjectif({ type: 'ca', valeur: 1000 }, { vendu: null }, REGLES, MAINT);
  const Pps = O.progressionObjectif(O.lireObjectif({ type: 'ca', valeur: 1000 }), vPasSu);
  dit(Pps.valeur === null && Pps.pct === null, 'ventes pas lues ⇒ « — » (jamais 0 %)', JSON.stringify(Pps));
  const vPart = K.valeurObjectif({ type: 'ca', valeur: 1000 }, src({ vendu: { lignes: LIGNES, manque: ['eBay'], enAttente: false, nonComptees: [] } }), REGLES, MAINT);
  const Pp = O.progressionObjectif(O.lireObjectif({ type: 'ca', valeur: 1000 }), vPart);
  dit(Pp.partiel && Pp.manque.includes('eBay'), 'un site pas lu ⇒ « au moins », le manque NOMMÉ');
  const sel = { site: 'vinted', compte: { login: 'alice' }, periode: null };
  const grand = K.valeurChiffre('vendu', { id: 'vendu', p: 'mois' }, src(), K.SEL_OBJECTIF, REGLES, MAINT);
  dit(grand.valeur === vCa.valeur && K.valeurChiffre('vendu', { id: 'vendu', p: 'mois' }, src(), sel, REGLES, MAINT).valeur !== vCa.valeur, 'la barre suit TOUS les sites et comptes (l’objectif est celui du mois), pas le filtre de la page');

  console.log('── 5. Le branchement (lu dans le code, commentaires retirés)');
  const APPs = sansCommentaires(APP);
  const sync = /const SYNC_KEYS = \[([\s\S]*?)\];/.exec(APPs);
  dit(!!sync && sync[1].includes("'vrm_objectif_mois'"), 'le réglage est synchronisé (SYNC_KEYS)');
  dit(!/save\(\s*'vrm_ca_objectif'/.test(APPs) && !/save\(\s*'vinted_goal'/.test(APPs) && !/load\(\s*'vrm_ca_objectif'/.test(APPs) && !/load\(\s*'vinted_goal'/.test(APPs), 'les deux anciennes clés ne sont plus ni lues ni écrites');
  const carteApp = extraire(APPs, 'CarteStatsApp');
  dit(/useObjectifMois\(\)/.test(carteApp) && /objectif=\{objectif\}/.test(carteApp) && /poserObjectif=\{poserObjectif\}/.test(carteApp), 'chaque carte reçoit l’objectif et son geste');
  const bloc = extraire(APPs, 'ObjectifDuMois');
  dit(/useObjectifMois\(\)/.test(bloc) && /valeurObjectif\(obj, sources, REGLES_CARTE\)/.test(bloc) && /useSourcesCarte\(/.test(bloc), 'Statistiques lit le MÊME réglage et la MÊME valeur que la carte');
  const crochet = extraire(APPs, 'useObjectifMois');
  dit(/onCloudReady\(/.test(crochet) && /cur == null \? lireObjectifRange\(\) : cur/.test(crochet), 'rattrapage nuage seulement si rien n’est rangé (onCloudReady)');
  const jsx = sansCommentaires(CARTE_JSX);
  dit(/objectifSurPage\(objectif, page\) \? progressionObjectif\(objectif, valeurObjectif\(objectif, sources, regles\)\) : null/.test(jsx) && /\{prog \? <BarreObjectif/.test(jsx), 'la carte ne dessine la barre que s’il y a un objectif pour CETTE page');
  dit(/data-carte-objectif-ouvrir/.test(jsx) && />Objectif</.test(jsx), '« Objectif » se fixe dans « Modifier »');
  dit(!/Fixe un montant/.test(APPs) && !/Viser \{prop\}/.test(APPs), 'aucune phrase d’invitation ni proposition calculée sur l’archive Vinted seule');

  console.log('── 7. Bénéfice, rythme, proposition, histoire, bilan (11 nov.)');
  try {
  // Le bénéfice = la case « Bénéfice brut » du mois (mêmes sources, mêmes règles).
  const JOURS = { '2026-11-03': 1, '2026-11-12': 1 };
  const Rb = (n, nCout, brut) => ({ n, nCout, brut });
  const REGLES_B = { ...REGLES, beneficeDesJours: (j, de, a) => (j === JOURS ? Rb(4, 3, 210) : Rb(0, 0, 0)), chiffreBrut: (R) => ({ valeur: R.nCout > 0 ? R.brut : (R.n === 0 ? 0 : null), partiel: R.nCout < R.n, n: R.n, nCout: R.nCout }) };
  const srcB = src({ joursBenef: { jours: JOURS } });
  const vB = K.valeurObjectif({ type: 'benefice', valeur: 500 }, srcB, REGLES_B, MAINT);
  const caseB = K.valeurChiffre('brut', { id: 'brut', p: 'mois' }, srcB, K.SEL_OBJECTIF, REGLES_B, MAINT);
  dit(vB && vB.valeur === 210 && vB.valeur === caseB.valeur && vB.partiel && vB.couverture === '3 sur 4', 'bénéfice : la case « Bénéfice brut » du mois, « au moins … · sur N »', JSON.stringify(vB && { v: vB.valeur, p: vB.partiel, c: vB.couverture }));
  const PB = O.progressionObjectif(O.lireObjectif({ type: 'benefice', valeur: 500 }), vB);
  dit(PB && PB.partiel && PB.couverture === '3 sur 4' && O.estEuros('benefice') && !O.estEuros('ventes'), 'la couverture (prix d’achat connus) suit la barre');
  dit(O.lireObjectif({ type: 'benefice', valeur: '600.5' }).valeur === 600.5 && O.lireSaisieObjectif('benefice', '600') === 600, 'un bénéfice se pose en euros');
  // Le rythme : le 18 nov. à 15 h, 17 j 15 h écoulés sur 30 ⇒ 2 000 € × 0,5875 = 1 175 € attendus.
  const prog = (v, partiel = false) => O.progressionObjectif(O.lireObjectif({ type: 'ca', valeur: 2000 }), { valeur: v, partiel, manque: partiel ? ['eBay'] : [] });
  const ryA = O.rythmeObjectif(prog(1340), MAINT), ryR = O.rythmeObjectif(prog(700), MAINT), ryD = O.rythmeObjectif(prog(1200), MAINT);
  dit(ryA && ryA.etat === 'avance' && ryA.ecart === 165, '1 340 € le 18 à 15 h ⇒ en avance de 165 €', JSON.stringify(ryA));
  dit(ryR && ryR.etat === 'retard' && ryR.ecart === 475, '700 € ⇒ en retard de 475 €', JSON.stringify(ryR));
  dit(ryD && ryD.etat === 'dans', '1 200 € (à 5 % près) ⇒ dans ton rythme', JSON.stringify(ryD));
  dit(O.rythmeObjectif(prog(700, true), MAINT) === null, '« au moins 700 € » ⇒ jamais « en retard » (le manque peut combler)');
  dit(O.rythmeObjectif(prog(1340, true), MAINT).etat === 'avance', '« au moins 1 340 € » ⇒ en avance (le minimum y est)');
  dit(O.rythmeObjectif(prog(null), MAINT) === null && O.rythmeObjectif(prog(2100), MAINT) === null, 'pas su ou atteint ⇒ rien sur le rythme');
  dit(O.phraseRythme(ryR, 'ca', (v) => v + ' €') === 'En retard de 475 € sur ton rythme', 'la phrase du retard', O.phraseRythme(ryR, 'ca', (v) => v + ' €'));
  const ph = O.phraseResteObjectif(prog(1340), (v) => v + ' €', MAINT);
  dit(ph === 'encore 660 € en 13 jours · ≈ 51 €/jour', '« encore 660 € en 13 jours · ≈ 51 €/jour »', ph);
  // La proposition : 3 mois pleins, par la MÊME règle (valeurObjectifMois).
  const L3 = [
    { plateforme: 'Vinted', ts: T(6, 20), eur: 10, compte: 'a' },
    { plateforme: 'Vinted', ts: T(7, 5), eur: 1800, compte: 'a' },
    { plateforme: 'eBay', ts: T(8, 5), eur: 2000, compte: 'x' },
    { plateforme: 'Leboncoin', ts: T(9, 5), eur: 1700, compte: 'l' },
    { plateforme: 'Vinted', ts: T(10, 5), eur: 999, compte: 'a' },
  ];
  const s3 = (o = {}) => ({ vendu: { lignes: L3, manque: [], enAttente: false, nonComptees: [] }, ...o });
  const mois3 = O.moisPleinsAvant(MAINT, 3);
  dit(mois3.map((m) => m.ym).join(',') === '2026-08,2026-09,2026-10', 'les 3 mois pleins d’avant (août, sept., oct.)', mois3.map((m) => m.ym).join(','));
  const vals = mois3.map((b) => K.valeurObjectifMois('ca', s3(), REGLES, b, MAINT));
  dit(vals.map((v) => v.valeur).join(',') === '1800,2000,1700' && vals.every((v) => v.couvert && !v.partiel), 'chaque mois par la règle du « vendu » (tous sites)', vals.map((v) => v.valeur).join(','));
  const pr = O.propositionObjectif('ca', vals);
  dit(pr && pr.valeur === 1830 && Math.abs(pr.moyenne - 1833.33) < 0.01, 'moyenne 1 833 € ⇒ « Viser 1 830 € »', JSON.stringify(pr));
  const sansJuillet = { vendu: { lignes: L3.slice(1), manque: [], enAttente: false, nonComptees: [] } };
  const valsTrou = mois3.map((b) => K.valeurObjectifMois('ca', sansJuillet, REGLES, b, MAINT));
  dit(valsTrou[0].couvert === false && O.propositionObjectif('ca', valsTrou) === null, 'aucune vente lue avant août ⇒ aucune proposition (historique pas prouvé)');
  const valsPart = mois3.map((b) => K.valeurObjectifMois('ca', s3({ vendu: { lignes: L3, manque: ['eBay'], enAttente: false, nonComptees: [] } }), REGLES, b, MAINT));
  dit(O.propositionObjectif('ca', valsPart) === null, 'un site pas lu ⇒ aucune proposition (jamais une moyenne trouée)');
  dit(O.propositionObjectif('ventes', [{ valeur: 10 }, { valeur: 12 }, { valeur: 13 }]).valeur === 12 && O.propositionObjectif('ca', [{ valeur: 0 }, { valeur: 0 }, { valeur: 0 }]) === null, 'ventes à l’unité ; trois mois à 0 ⇒ rien à proposer');
  dit(O.propositionObjectif('benefice', [{ valeur: 300 }, { valeur: 280, partiel: true }, { valeur: 310 }]) === null, 'bénéfice : un mois aux prix d’achat incomplets ⇒ aucune proposition');
  // L'histoire par mois et le bilan.
  const valDe = (o) => (o ? o.valeur : undefined);
  const OCT = T(9, 10), NOV1 = T(10, 1, 9), NOV3 = T(10, 3, 9), NOV8 = T(10, 8, 9);
  let r = O.objectifAEnregistrer(null, { type: 'ca', valeur: 2000 }, OCT);
  r = O.objectifAEnregistrer(r, { page: 'ventes', cacher: true }, NOV1);
  dit(valDe(O.objectifDuMoisYm(r, '2026-10')) === 2000 && valDe(O.objectifDuMoisYm(r, '2026-11')) === 2000 && O.objectifDuMoisYm(r, '2026-09') === null, 'un objectif tient jusqu’à ce qu’il le change (masquer une carte n’y touche pas)');
  r = O.objectifAEnregistrer(r, { type: 'ca', valeur: 3000 }, NOV3);
  dit(valDe(O.objectifDuMoisYm(r, '2026-10')) === 2000 && valDe(O.objectifDuMoisYm(r, '2026-11')) === 3000, 'le changer en novembre ne réécrit pas octobre');
  const ret = O.objectifAEnregistrer(r, null, NOV3);
  dit(O.lireObjectif(ret) === null && valDe(O.objectifDuMoisYm(ret, '2026-10')) === 2000 && O.objectifDuMoisYm(ret, '2026-11') === null, 'le retirer garde l’histoire (octobre reste jugeable)');
  const xOct = (v, partiel = false) => ({ valeur: v, partiel, manque: partiel ? ['eBay'] : [] });
  const bA = O.bilanMoisPasse(r, xOct(2050), NOV3), bE = O.bilanMoisPasse(r, xOct(1640), NOV3), bP = O.bilanMoisPasse(r, xOct(1640, true), NOV3);
  const eu = (v) => v + ' €';
  dit(bA && bA.prog.atteint && O.phraseBilan(bA, eu) === 'Octobre : objectif atteint ✓', '« Octobre : objectif atteint ✓ »', bA && O.phraseBilan(bA, eu));
  dit(bE && bE.ecart === 360 && O.phraseBilan(bE, eu) === 'Octobre : 1640 € sur 2000 € · il a manqué 360 €', 'sinon l’écart, sur l’objectif d’ALORS (2 000, pas 3 000)', bE && O.phraseBilan(bE, eu));
  dit(bP && bP.ecart === null && /au moins/.test(O.phraseBilan(bP, eu)), '« au moins » sous l’objectif ⇒ aucun écart dit');
  const vu = O.objectifAEnregistrer(r, { bilanVu: '2026-10' }, NOV3);
  dit(O.bilanMoisPasse(vu, xOct(2050), NOV3) === null && valDe(O.lireObjectif(vu)) === 3000 && valDe(O.objectifDuMoisYm(vu, '2026-10')) === 2000, '« OK » ⇒ plus jamais dit (et rien d’autre ne change)');
  dit(O.bilanMoisPasse(r, xOct(2050), NOV8) === null, 'après le 7 ⇒ plus de bilan');
  dit(O.bilanMoisPasse({ v: 1, type: 'ca', valeur: 2000 }, xOct(2050), NOV3) === null, 'objectif sans date (d’avant ce jour) ⇒ aucun bilan supposé');
  // Le branchement : la feuille, Argent et Réglages écrivent sur le réglage RANGÉ (l'histoire gardée).
  dit(/objectifBrut=\{objectifBrut\}/.test(carteApp) && /objectifAEnregistrer\(base, \{ type, valeur: v \}\)/.test(jsx) && /const base = objectifBrut \|\| objectif;/.test(jsx), 'la feuille de la carte écrit sur le réglage rangé (histoire gardée)');
  dit(/page === 'journee' && poserObjectif \? bilanObjectif\(objectifBrut, sources, regles\)/.test(jsx) && /<BilanObjectif bilan=\{bilan\}/.test(jsx), 'le bilan vit dans la carte de Ma journée');
  const STATS = sansCommentaires(lire('src/ecrans/Stats.jsx'));
  dit(/objectifAEnregistrer\(brut, \{ type, valeur: v \}\)/.test(STATS) && /valeurObjectifMois\(obj\.type, sources, REGLES_CARTE, b\)/.test(STATS) && /<PropositionObjectif/.test(STATS), 'Argent : le détail par la même règle, et « Viser … »');
  const REG = sansCommentaires(lire('src/ecrans/Reglages.jsx'));
  dit(/objectifAEnregistrer\(brut, \{ type, valeur: lu \}\)/.test(REG) && !/type: 'ca', valeur: lu/.test(REG), 'Réglages garde le type et l’histoire');
  } catch (e) { dit(false, 'les règles du 11 nov. s’exécutent', e.message); }

  console.log(`\n${ko ? '❌' : '✅'} objectif-mois : ${ko} rouge(s), ${ok} vert(s)${MUT ? ' [mutation ' + MUT + ']' : ''}`);
  process.exit(ko ? 1 : 0);
})();
