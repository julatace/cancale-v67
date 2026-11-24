// ════════════════════════════════════════════════════════════════════════════
// AUDIT : « TA PREMIÈRE SEMAINE » — la carte du débutant sur Aujourd'hui
//         node scripts/audit-premiere-semaine.cjs [--prouve]
// ════════════════════════════════════════════════════════════════════════════
// (24 nov., lot debutant) Julien : « imagine un débutant achat-revente qui ne
// connaît pas du tout le site ». Cet audit EXÉCUTE src/premiereSemaine/regle.js :
//   S1 trois étapes, dans l'ordre (compte, prix, numéro) ; la première pas faite
//      est la seule « courante » (le seul geste plein) ;
//   S2 « pas su » (null) n'est jamais « fait » ; rien n'est coché sur un silence ;
//   S3 qui la voit : un compte NEUF (≤ 30 j), jamais le propriétaire (pas su
//      compris), jamais en mode exemple, plus après « × » ou les trois faites ;
//   S4 les visites en bulles attendent pendant la semaine (`semaineEnCours`) ;
//   S5 les preuves des tables : un N° posé, un prix saisi (fiche ou table par N°) ;
//      nuage pas arrivé ⇒ pas su ;
//   S6 le branchement : la carte remplace les autres cartes de démarrage, la
//      visite lit `semaineEnCours`, la clé est synchronisée, textes en 5 langues
//      (mêmes clés), phrase de l'étape ≤ 8 mots, aucun ambre.
// `--prouve` : chaque mutation doit rendre l'audit ROUGE.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
const R = process.env.VRM_RACINE || path.join(__dirname, '..');
const PROUVE = process.argv.includes('--prouve');
const lire = (f) => { try { return fs.readFileSync(path.join(R, f), 'utf8'); } catch (_) { return ''; } };
const sansCommentaires = (t) => t.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
const DOS = path.join(R, 'src', 'premiereSemaine');
async function charger(src) {
  const f = path.join(DOS, `.audit-ps-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(f, src);
  try { return await import('file://' + f); } finally { try { fs.unlinkSync(f); } catch (_) {} }
}
async function chargerDico(l) {
  const src = lire(`src/i18n/langues/${l}/debutant.js`);
  const f = path.join(R, 'src', 'i18n', 'langues', l, `.audit-ps-${process.pid}.mjs`);
  fs.writeFileSync(f, src);
  try { return (await import('file://' + f)).default; } finally { try { fs.unlinkSync(f); } catch (_) {} }
}

async function verifier(S) {
  let ko = 0;
  const dit = (bon, quoi, det) => { if (!bon) ko++; if (!PROUVE || !bon) console.log(`${bon ? 'OK ' : 'KO '} ${quoi}${!bon && det ? ' — ' + det : ''}`); };
  let M;
  try { M = await charger(S.regle); } catch (e) { dit(false, 'la règle se charge', String(e.message).slice(0, 200)); return ko; }
  const J = 86400e3, T0 = Date.parse('2026-11-24T10:00:00Z');
  // S1
  const e0 = M.etapesPremiereSemaine({ compte: false, prix: false, numero: false });
  dit(e0.map((e) => e.cle).join(',') === 'compte,prix,numero', 'S1 trois étapes, dans l’ordre');
  dit(e0.filter((e) => e.courante).length === 1 && e0[0].courante, 'S1 une seule étape courante, la première pas faite');
  const e1 = M.etapesPremiereSemaine({ compte: true, prix: false, numero: true });
  dit(e1.find((e) => e.courante) && e1.find((e) => e.courante).cle === 'prix', 'S1 la courante saute les faites');
  const e3 = M.etapesPremiereSemaine({ compte: true, prix: true, numero: true });
  dit(!e3.some((e) => e.courante) && M.nombreFaitesSemaine(e3) === 3, 'S1 tout fait ⇒ aucune courante');
  // S2
  const ep = M.etapesPremiereSemaine({ compte: null, prix: null, numero: null });
  dit(ep.every((e) => e.etat === 'passu') && M.nombreFaitesSemaine(ep) === 0, 'S2 pas su ⇒ jamais fait');
  // S3
  const neuf = new Date(T0 - 2 * J).toISOString(), vieux = new Date(T0 - 60 * J).toISOString();
  const base = { etapes: e0, proprietaire: false, creeLe: neuf, maintenant: T0 };
  dit(M.premiereSemaineAMontrer(base) === true, 'S3 compte neuf : montrée');
  dit(M.premiereSemaineAMontrer({ ...base, creeLe: vieux }) === false, 'S3 compte de plus de 30 jours : jamais');
  dit(M.premiereSemaineAMontrer({ ...base, creeLe: '' }) === false, 'S3 date de création pas sue : jamais');
  dit(M.premiereSemaineAMontrer({ ...base, proprietaire: null }) === false && M.premiereSemaineAMontrer({ ...base, proprietaire: true }) === false, 'S3 propriétaire (ou pas su) : jamais');
  dit(M.premiereSemaineAMontrer({ ...base, exemple: true }) === false, 'S3 mode exemple : jamais');
  dit(M.premiereSemaineAMontrer({ ...base, reglage: M.reglageMasqueSemaine(T0) }) === false, 'S3 « × » : plus jamais');
  dit(M.premiereSemaineAMontrer({ ...base, reglage: M.reglageFinSemaine(T0) }) === false, 'S3 finie : plus jamais');
  dit(M.premiereSemaineAMontrer({ ...base, etapes: e3 }) === false, 'S3 les trois faites : disparaît');
  // S4
  dit(M.semaineEnCours({ creeLe: neuf, maintenant: T0 }) === true, 'S4 la semaine court : les bulles attendent');
  dit(M.semaineEnCours({ creeLe: neuf, reglage: M.reglageFinSemaine(T0), maintenant: T0 }) === false, 'S4 finie : les bulles reprennent');
  dit(M.semaineEnCours({ creeLe: vieux, maintenant: T0 }) === false, 'S4 ancien compte : rien ne change');
  // S5
  dit(JSON.stringify(M.preuvesTables({})) === JSON.stringify({ prix: null, numero: null }), 'S5 nuage pas arrivé ⇒ pas su');
  dit(M.preuvesTables({ fiches: {} }).numero === false && M.preuvesTables({ fiches: {} }).prix === false, 'S5 tables vides ⇒ pas fait');
  dit(M.preuvesTables({ fiches: { 1: { numero: '12' } } }).numero === true, 'S5 un N° posé ⇒ fait');
  dit(M.preuvesTables({ fiches: { 1: { buyPrice: '35' } } }).prix === true && M.preuvesTables({ fiches: {}, parNum: { 12: '40' } }).prix === true, 'S5 un prix saisi (fiche ou par N°) ⇒ fait');
  dit(M.preuvesTables({ fiches: { 1: { buyPrice: '' } } }).prix === false, 'S5 un prix vide n’est pas un prix');
  // S6
  const app = sansCommentaires(S.app), cpt = sansCommentaires(S.compta), ar = sansCommentaires(S.accueil);
  dit(/GuideDemarrageApp[^\n]*sansParcours=\{actif\}/.test(cpt), 'S6 premier jour : la carte remplace « Configure VRM » / « Démarrer avec VRM »');
  dit(/sinon=\{\(actif\) => actif \? null : <BienDemarrerApp/.test(cpt), 'S6 « Bien démarrer » s’efface derrière elle');
  dit(/debutant=\{actif\}/.test(cpt) && /c && !debutant \?/.test(ar), 'S6 pas de conseil du jour en plus');
  dit(/semaineEnCours\(/.test(ar), 'S6 la visite en bulles lit `semaineEnCours`');
  dit(/CLE_PREMIERE_SEMAINE,/.test(app.slice(app.indexOf('const SYNC_KEYS'), app.indexOf('const SYNC_KEYS') + 40000)), 'S6 la clé est synchronisée (même choix sur tous ses appareils)');
  const css = sansCommentaires(S.css);
  dit(!/#f5a623|#ff9500|orange|ambre|#ff3b30/i.test(css), 'S6 aucune couleur d’alerte dans la carte');
  try {
    const d = {}; for (const l of ['fr', 'en', 'es', 'it', 'de']) d[l] = await chargerDico(l);
    const cles = Object.keys(d.fr);
    for (const l of ['en', 'es', 'it', 'de']) dit(cles.every((k) => typeof d[l][k] === 'string' && d[l][k].trim()) && Object.keys(d[l]).length === cles.length, `S6 textes ${l} : les mêmes clés`);
    for (const k of ['compte', 'prix', 'numero']) { const n = String(S.phrase(d.fr, k)).trim().split(/\s+/).length; dit(n <= 8, `S6 « ${k} » : une phrase de 8 mots au plus (${n})`); }
  } catch (e) { dit(false, 'S6 les dictionnaires se chargent', String(e.message).slice(0, 200)); }
  return ko;
}

(async () => {
  const S = {
    regle: lire('src/premiereSemaine/regle.js'), app: lire('src/App.jsx'), compta: lire('src/ecrans/Comptabilite.jsx'),
    accueil: lire('src/accueilReste/AccueilReste.jsx'), css: lire('src/premiereSemaine/premiere-semaine.css'),
    phrase: (d, k) => d[`ps.${k}.p`],
  };
  const ko = await verifier(S);
  if (!PROUVE) { console.log(ko ? `\n❌ première semaine : ${ko} défaut(s)` : '\n✅ première semaine : tout est en place'); process.exit(ko ? 1 : 0); }
  const MUT = [
    ['pas su compté fait', (s) => ({ ...s, regle: s.regle.replace("preuves[cle] === true ? 'fait'", "preuves[cle] !== false ? 'fait'") })],
    ['deux étapes courantes', (s) => ({ ...s, regle: s.regle.replace("courante: !!courante && e.cle === courante.cle", "courante: e.etat !== 'fait'") })],
    ['propriétaire pas su montré', (s) => ({ ...s, regle: s.regle.replace("if (exemple || proprietaire !== false) return false;", "if (exemple || proprietaire === true) return false;") })],
    ['ancien compte montré', (s) => ({ ...s, regle: s.regle.replace("maintenant - t <= JOURS_SEMAINE * 86400e3", "true") })],
    ['« × » oublié', (s) => ({ ...s, regle: s.regle.replace("if (lireReglageSemaine(reglage)) return false;", "") })],
    ['bulles pendant la semaine', (s) => ({ ...s, accueil: s.accueil.replace('semaineEnCours(', 'Boolean(0&&') })],
    ['prix vide compté', (s) => ({ ...s, regle: s.regle.replace("String(v).trim() !== '' &&", '') })],
    ['« Bien démarrer » en plus', (s) => ({ ...s, compta: s.compta.replace('sinon={(actif) => actif ? null : <BienDemarrerApp', 'sinon={(actif) => <BienDemarrerApp') })],
    ['phrase trop longue', (s) => ({ ...s, phrase: (d, k) => d[`ps.${k}.pourquoi`] })],
  ];
  let rouges = 0;
  for (const [nom, f] of MUT) { const k = await verifier(f(S)); console.log(`${k ? 'ROUGE' : 'VERT ✗'}  mutation : ${nom}`); if (k) rouges++; }
  console.log(rouges === MUT.length ? `\n✅ ${rouges}/${MUT.length} mutations rougissent` : `\n❌ ${MUT.length - rouges} mutation(s) passent`);
  process.exit(rouges === MUT.length ? 0 : 1);
})();
