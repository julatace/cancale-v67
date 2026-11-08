#!/usr/bin/env node
// Exécute la VRAIE règle de src/notesRecues.js (3 nov.) sur des profils de la
// FORME mesurée en base (`harvest_{uid}_profile` : feedback_reputation 0…1,
// feedback_count, positive/neutral/negative_feedback_count, capturedAt),
// valeurs inventées. Contrôles : note Vinted ×5 jamais présentée comme une
// moyenne d'étoiles calculée, profil absent ⇒ « pas lu » (jamais 0),
// moyenne pondérée, la plus fraîche de deux lignes, liste des avis `null`
// tant qu'elle n'est pas captée (jamais « aucun avis »), avis illisible ignoré.
// Vérifie aussi qu'AUCUN rappel d'évaluation n'est rendu par l'app (refusé le 11 oct.).
// `--mutation=X` : passu-zero · moyenne-simple · vieille-gagne · liste-vide · note-brute
require('./_source-app.cjs').brancher(); // (8 nov.) App.jsx découpé : sa lecture texte rend aussi src/ecrans/*.jsx
const fs = require('fs'), path = require('path');
const ICI = path.join(__dirname, '..');
const mut = (process.argv.find((a) => a.startsWith('--mutation=')) || '').slice(11);
let src = fs.readFileSync(path.join(ICI, 'src', 'notesRecues.js'), 'utf8');
const muter = (a, b) => { if (!src.includes(a)) { console.error('ancre absente :', a); process.exit(2); } src = src.replace(a, b); };
if (mut === 'passu-zero') muter("etat: 'pasLu', note: null, n: null,", "etat: 'lu', note: 0, n: 0,");
if (mut === 'moyenne-simple') muter('avecNote.reduce((s, x) => s + x.note * x.n, 0) / avecNote.reduce((s, x) => s + x.n, 0)', 'avecNote.reduce((s, x) => s + x.note, 0) / avecNote.length');
if (mut === 'vieille-gagne') muter('if (parUid[uid] && !(isFinite(at) && at > parUid[uid].atMs)) continue;', '');
if (mut === 'liste-vide') muter('const brut = Array.isArray(p.avis) ? p.avis : null;', 'const brut = Array.isArray(p.avis) ? p.avis : [];');
if (mut === 'note-brute') muter('Math.round(rep * 50) / 10', 'rep');
const tmp = path.join(ICI, 'src', `.audit-notes-${process.pid}.mjs`);
fs.writeFileSync(tmp, src);
let ko = 0, n = 0;
const dit = (ok, l, d) => { n++; if (!ok) ko++; console.log(`${ok ? '✅' : '❌'} ${l}${!ok && d !== undefined ? ' — ' + d : ''}`); };
(async () => {
  try {
    const M = await import(tmp);
    const maintenant = new Date(2026, 10, 3, 12).getTime();
    const iso = (j) => new Date(maintenant - j * 86400000).toISOString();
    const comptes = [{ uid: '111', nom: 'atelier' }, { uid: '222', nom: 'paris' }, { uid: '333', nom: 'neuf' }, { uid: '444', nom: 'jamais' }];
    const profils = [
      { uid: '111', at: iso(1), rep: '0.98', n: '100', pos: '98', neu: '0', neg: '2' },
      { uid: '111', at: iso(30), rep: '1', n: '10', pos: '10', neu: '0', neg: '0' },          // plus ancienne : perd
      { uid: '222', at: iso(20), rep: '1', n: '10', pos: '10', neu: '0', neg: '0' },
      { uid: '333', at: iso(2), rep: '0', n: '0', pos: '0', neu: '0', neg: '0' },
    ];
    const R = M.notesParCompte({ profils, comptes, maintenant });
    const C = (u) => R.comptes.find((x) => x.uid === u) || {};
    dit(C('111').etat === 'lu' && C('111').note === 4.9 && C('111').n === 100 && C('111').neg === 2, 'atelier : note Vinted 0,98 ⇒ 4,9/5, 100 avis, 2 négatifs (la ligne la plus fraîche)', JSON.stringify(C('111')));
    dit(C('222').vieux === true && C('111').vieux === false, 'profil lu il y a 20 jours ⇒ « ancien » ; hier ⇒ frais');
    dit(C('333').etat === 'lu' && C('333').note === null && C('333').n === 0, 'compte sans avis : 0 avis, AUCUNE note (pas « 0/5 »)', JSON.stringify(C('333')));
    dit(C('444').etat === 'pasLu' && C('444').n === null && C('444').note === null, 'compte jamais capté : « pas lu » (n null), jamais 0', JSON.stringify(C('444')));
    dit(R.partiel && R.manquants.join() === 'jamais', 'le compte pas lu est NOMMÉ', JSON.stringify(R.manquants));
    dit(R.total === 110 && R.moyenne === 4.9, 'moyenne pondérée par le nombre d\'avis : (4,9×100 + 5×10)/110 = 4,9 ; 110 avis', JSON.stringify({ t: R.total, m: R.moyenne }));
    dit(C('111').liste === null && !R.listeLue, 'la liste des avis n\'est pas captée ⇒ null (« pas encore lu »), jamais « aucun »');
    const R2 = M.notesParCompte({ maintenant, comptes: [{ uid: '111', nom: 'a' }], profils: [{ uid: '111', at: iso(1), rep: '0.9', n: '3', avis: [
      { id: 1, rating: 5, created_at_ts: (maintenant / 1000) - 3600 }, { id: 2, rating: 3, created_at_ts: (maintenant / 1000) - 60 }, { id: 3, rating: 'x' }, { id: 4, rating: 4.5, created_at_ts: 1 } ] }] });
    const L = R2.comptes[0].liste;
    dit(L && L.lus === 2 && L.dernieres[0].id === '2' && L.sousCinq.length === 1 && L.sousCinq[0].note === 3, 'avis captés : 2 lisibles (note entière 1-5, date), le plus récent d\'abord, 1 sous 5 étoiles', JSON.stringify(L));
    dit(M.notesParCompte({ profils: null, comptes }).etat === 'passu' && M.notesParCompte({ profils: undefined, comptes }).etat === 'encours', 'lecture ratée ⇒ « — » ; en cours ⇒ en cours');
    // Aucun rappel d'évaluation (refusé le 11 oct.) : rien dans le module ni dans l'écran.
    const app = fs.readFileSync(path.join(ICI, 'src', 'App.jsx'), 'utf8').replace(/\/\/.*$/gm, '');
    dit(!/rappel[^\n]{0,40}[ée]valuation|[ée]valuations? [àa] laisser|laisse(r)? (une|ton) avis/i.test(src.replace(/\/\/.*$/gm, '') + app), 'aucun rappel d\'évaluation (refusé le 11 octobre)');
  } catch (e) { dit(false, 'la règle s\'exécute', String(e && e.stack || e).slice(0, 300)); }
  finally { try { fs.unlinkSync(tmp); } catch (_) {} }
  console.log(ko ? `\n❌ audit-notes-recues${mut ? ' [' + mut + ']' : ''} : ${ko} rouge(s) sur ${n}` : `\n✅ audit-notes-recues : ${n} verts`);
  process.exit(ko ? 1 : 0);
})();
