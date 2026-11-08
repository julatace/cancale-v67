#!/usr/bin/env node
// Exécute la VRAIE règle de src/previsionUrssaf.js (3 nov.) avec les VRAIES
// règles d'argent de l'app — celles de api/_lib/urssaf-regle.js, qu'
// audit-rappel-urssaf.cjs juge identiques au jeton près à src/App.jsx :
// période, mois, montant de la ligne publiée, registre « déclaré ».
// Contrôles : statut et rythme jamais devinés, échéance déjà notée ⇒ la
// suivante, mois déjà déclaré pas recompté, « au moins » + ventes à dater.
// `--mutation=X` : rythme-devine · recompte-declare · pas-de-saut · adater-cache · registre-passu
require('./_source-app.cjs').brancher(); // (8 nov.) App.jsx découpé : sa lecture texte rend aussi src/ecrans/*.jsx
const fs = require('fs'), path = require('path');
const ICI = path.join(__dirname, '..');
const mut = (process.argv.find((a) => a.startsWith('--mutation=')) || '').slice(11);
let src = fs.readFileSync(path.join(ICI, 'src', 'previsionUrssaf.js'), 'utf8');
const muter = (a, b) => { if (!src.includes(a)) { console.error('ancre absente :', a); process.exit(2); } src = src.replace(a, b); };
if (mut === 'rythme-devine') muter("if (!RYTHMES.includes(rythme)) return { etat: 'rythme' };", "if (!RYTHMES.includes(rythme)) rythme = 'trimestriel';");
if (mut === 'recompte-declare') muter('montantPeriodeUrssaf(due, ligneSansMois(ligne, declares), taux)', 'montantPeriodeUrssaf(due, ligne, taux)');
if (mut === 'pas-de-saut') muter('for (let i = 0; due && i < 3; i++) {', 'for (let i = 0; due && i < 0; i++) {');
if (mut === 'adater-cache') muter('aDater: partiel ? aDater : 0', 'aDater: 0');
if (mut === 'registre-passu') muter("if (declare === undefined || declare === null) return { etat: 'encours', rythme };", 'declare = declare || {};');
const tmp = path.join(ICI, 'src', `.audit-prevision-${process.pid}.mjs`);
fs.writeFileSync(tmp, src);
let ko = 0, n = 0;
const dit = (ok, l, d) => { n++; if (!ok) ko++; console.log(`${ok ? '✅' : '❌'} ${l}${!ok && d !== undefined ? ' — ' + d : ''}`); };
(async () => {
  try {
    const M = await import(tmp);
    const R = await import(path.join(ICI, 'api', '_lib', 'urssaf-regle.js'));
    const regle = { nextUrssafDeadline: R.nextUrssafDeadline, moisPeriodeUrssaf: R.moisPeriodeUrssaf, montantPeriodeUrssaf: R.montantPeriodeUrssaf, moisDeclare: R.moisDeclare };
    const P = (o) => M.previsionUrssaf({ regle, taux: 12.4, ...o });
    const now = new Date(2026, 10, 3, 12);       // 3 novembre 2026
    const publie = new Date(2026, 10, 3, 11).getTime();
    const L = (mois, extra = {}) => ({ mois: mois.map(([ym, ca]) => ({ ym, ca })), at: publie, ...extra });
    const decl = (yms) => Object.fromEntries(yms.map((ym) => [ym, { ids: ['x'], ca: 1 }]));
    dit(P({ regime: undefined, rythme: 'mensuel', now, declare: {} }).etat === 'encours', 'statut pas encore lu ⇒ en cours');
    dit(P({ regime: null, rythme: 'mensuel', now, declare: {} }).etat === 'statut', 'statut jamais choisi ⇒ la question (aucun montant)');
    dit(P({ regime: 'societe', rythme: 'mensuel', now, declare: {} }).etat === 'horsMicro', 'société ⇒ aucune prévision URSSAF');
    let r = P({ regime: 'micro', rythme: null, now, declare: {}, ligne: L([['2026-10', 1000]]) });
    dit(r.etat === 'rythme' && r.ca === undefined, 'rythme jamais choisi ⇒ « — » + geste, jamais « trimestriel » deviné', JSON.stringify(r));
    r = P({ regime: 'micro', rythme: 'mensuel', now, declare: null, ligne: L([['2026-10', 1000]]) });
    dit(r.etat === 'encours', 'registre « déclaré » pas encore lu ⇒ en cours (rien affirmé)', JSON.stringify(r));
    // Mensuel, le 3 nov. : octobre se déclare avant le 30 novembre ; ligne publiée après la fin d'octobre.
    r = P({ regime: 'micro', rythme: 'mensuel', now, declare: {}, ligne: L([['2026-10', 1000], ['2026-11', 300]]) });
    dit(r.etat === 'lu' && r.label === 'octobre 2026' && r.ca === 1000 && r.apayer === 124 && !r.partiel && !r.enCours, 'mensuel : octobre 1 000 € reçus ⇒ 124,00 € à payer (12,4 %), complet', JSON.stringify(r));
    // Octobre déjà noté ⇒ novembre (en cours) : « au moins », ligne publiée avant la fin.
    r = P({ regime: 'micro', rythme: 'mensuel', now, declare: decl(['2026-10']), ligne: L([['2026-10', 1000], ['2026-11', 300]]) });
    dit(r.etat === 'lu' && r.label === 'novembre 2026' && r.ca === 300 && r.partiel && r.enCours && r.sautees.join() === 'octobre 2026' && r.daysLeft === 58,
      'octobre déjà déclaré ⇒ prévision de novembre : au moins 300 € (période en cours), échéance dans 58 j', JSON.stringify(r));
    // Trimestriel : T4 (oct.–déc.) ; octobre déjà noté ⇒ pas recompté.
    r = P({ regime: 'micro', rythme: 'trimestriel', now, declare: decl(['2026-10']), ligne: L([['2026-10', 1000], ['2026-11', 300]]) });
    dit(r.etat === 'lu' && r.label === 'T4 2026' && r.ca === 300 && r.declares.join() === '2026-10', 'trimestre à moitié noté : octobre (déclaré) PAS recompté ⇒ au moins 300 €', JSON.stringify(r));
    // Ventes sans date de versement ⇒ « au moins » + leur nombre.
    r = P({ regime: 'micro', rythme: 'mensuel', now, declare: {}, ligne: L([['2026-10', 1000]], { aDater: { n: 4, ca: 220 } }) });
    dit(r.etat === 'lu' && r.partiel && r.aDater === 4 && r.ca === 1000, '4 ventes à dater ⇒ « au moins » 1 000 € + « 4 à dater »', JSON.stringify(r));
    // Ligne publiée avant la période ⇒ pas su.
    r = P({ regime: 'micro', rythme: 'mensuel', now, declare: {}, ligne: { ...L([['2026-10', 1000]]), at: new Date(2026, 8, 1).getTime() } });
    dit(r.etat === 'passu' && r.ca === null && r.apayer === null, 'ligne publiée avant la période ⇒ « — », jamais 0', JSON.stringify(r));
    r = P({ regime: 'micro', rythme: 'mensuel', now, declare: {}, ligne: null });
    dit(r.etat === 'passu' && r.ca === null, 'aucune ligne publiée ⇒ « — »', JSON.stringify(r));
  } catch (e) { dit(false, 'la règle s\'exécute', String(e && e.stack || e).slice(0, 300)); }
  finally { try { fs.unlinkSync(tmp); } catch (_) {} }
  console.log(ko ? `\n❌ audit-prevision-urssaf${mut ? ' [' + mut + ']' : ''} : ${ko} rouge(s) sur ${n}` : `\n✅ audit-prevision-urssaf : ${n} verts`);
  process.exit(ko ? 1 : 0);
})();
