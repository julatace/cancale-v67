// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : L'OBJECTIF DU MOIS — un réglage, la règle du « vendu »
//         node scripts/audit-objectif-mois.cjs [--mutation=type|zero|cache|defaut|arrondi|saisie|retirer]
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
//      la carte et Statistiques lisent la même valeur.
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
if (MUT === 'type') muter('carte', "const id = obj.type === 'ventes' ? 'ventes' : 'vendu';", "const id = 'vendu';");
else if (MUT === 'zero') muter('obj', "if (val == null) return { type: obj.type, objectif: obj.valeur, valeur: null, pct: null,", "if (val == null) return { type: obj.type, objectif: obj.valeur, valeur: 0, pct: 0,");
else if (MUT === 'cache') muter('obj', "  if (c === true) return false;\n", '');
else if (MUT === 'defaut') muter('obj', "export const PAGES_SANS_OBJECTIF = ['achats', 'colis'];", 'export const PAGES_SANS_OBJECTIF = [];');
else if (MUT === 'arrondi') muter('obj', 'Math.floor((val / obj.valeur) * 100)', 'Math.round((val / obj.valeur) * 100)');
else if (MUT === 'saisie') muter('obj', "if (!/^\\d+(?:\\.\\d{1,2})?$/.test(s)) return null;\n  const v = Number(s);", 'const v = parseFloat(s);');
else if (MUT === 'retirer') muter('obj', "  if (changement == null) return { v: 1 };\n", "  if (changement == null) return actuel;\n");
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

  console.log(`\n${ko ? '❌' : '✅'} objectif-mois : ${ko} rouge(s), ${ok} vert(s)${MUT ? ' [mutation ' + MUT + ']' : ''}`);
  process.exit(ko ? 1 : 0);
})();
