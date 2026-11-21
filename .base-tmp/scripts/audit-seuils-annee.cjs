#!/usr/bin/env node
// Exécute la VRAIE règle de src/seuilsAnnee.js (3 nov.) : « vers quel mois »
// (projection linéaire sur les mois FINIS, jamais sur un partiel, jamais avant
// 2 mois) et DAC7 par plateforme (30 ventes OU plus de 2 000 €, centimes,
// « atteint si », jamais « sous » quand il manque des ventes).
// Vérifie aussi que les seuils DAC7 sont ceux de l'app (SEUIL_VINTED_*).
// `--mutation=X` réaffaiblit la règle dans une copie : le contrôle doit rougir.
//   partiel-projete · un-mois · mois-en-cours · dac7-egal · dac7-ou · passu-zero · sous-partiel · seuil-depasse
require('./_source-app.cjs').brancher(); // (8 nov.) App.jsx découpé : sa lecture texte rend aussi src/ecrans/*.jsx
const fs = require('fs'), path = require('path'), os = require('os');
const ICI = path.join(__dirname, '..');
const mut = (process.argv.find((a) => a.startsWith('--mutation=')) || '').slice(11);
let src = fs.readFileSync(path.join(ICI, 'src', 'seuilsAnnee.js'), 'utf8');
const muter = (a, b) => { if (!src.includes(a)) { console.error('ancre absente :', a); process.exit(2); } src = src.replace(a, b); };
if (mut === 'partiel-projete') muter('if (!cur || cur.partiel) return null;', 'if (!cur) return null;');
if (mut === 'un-mois') muter('export const MOIS_MIN_PROJECTION = 2;', 'export const MOIS_MIN_PROJECTION = 1;');
if (mut === 'mois-en-cours') muter('.filter((x) => isFinite(x.ca) && x.k >= 0 && x.k < m);', '.filter((x) => isFinite(x.ca) && x.k >= 0 && x.k <= m);');
if (mut === 'dac7-egal') muter('c > DAC7.centimes', 'c >= DAC7.centimes');
if (mut === 'dac7-ou') muter('n >= DAC7.ventes || c > DAC7.centimes', 'n >= DAC7.ventes && c > DAC7.centimes');
if (mut === 'passu-zero') muter("if (src[p] === 'pasSu') return", "if (false) return");
if (mut === 'sous-partiel') muter(": manque ? null : 'sous';", ": 'sous';");
if (mut === 'seuil-depasse') muter('if (cur.ca > seuil) return null;', '');
// La copie importe microEntreprise.js par chemin relatif : on la pose à côté.
const tmp = path.join(ICI, 'src', `.audit-seuils-${process.pid}.mjs`);
fs.writeFileSync(tmp, src);
let ko = 0, n = 0;
const dit = (ok, l, d) => { n++; if (!ok) ko++; console.log(`${ok ? '✅' : '❌'} ${l}${!ok && d !== undefined ? ' — ' + d : ''}`); };
(async () => {
  try {
    const M = await import(tmp);
    // Seuils DAC7 = ceux de l'app (une notion, une valeur).
    const app = fs.readFileSync(path.join(ICI, 'src', 'App.jsx'), 'utf8');
    const v = Number((/const SEUIL_VINTED_VENTES = (\d+);/.exec(app) || [])[1]), e = Number((/const SEUIL_VINTED_EUR = (\d+);/.exec(app) || [])[1]);
    dit(M.DAC7.ventes === v && M.DAC7.centimes === e * 100, `DAC7 = les seuils de l'app (${v} ventes, ${e} €)`, JSON.stringify(M.DAC7));
    const S = { Vinted: 'lu', Leboncoin: 'lu', eBay: 'lu', Vestiaire: 'lu' };
    const L = (mois, extra = {}) => ({ mois: mois.map(([ym, ca, par]) => ({ ym, ca, par: par || { Vinted: { n: 1, ca } } })), sources: S, ...extra });
    const now = new Date(2026, 10, 3, 12);                 // 3 novembre : 10 mois finis
    // ── Mois d'atteinte ──
    const dix = Array.from({ length: 10 }, (_, i) => [`2026-${String(i + 1).padStart(2, '0')}`, 8000]);
    let r = M.moisAtteinte({ ligne: L(dix), now, seuil: 85000 });
    // 80 000 € sur 10 mois ⇒ 8 000/mois ; fin novembre 88 000 ≥ 85 000 ⇒ novembre.
    dit(r && r.mois === 10 && r.nom === 'novembre' && r.base === 10 && r.rythme === 8000, '8 000 €/mois sur 10 mois finis ⇒ seuil de TVA vers novembre', JSON.stringify(r));
    r = M.moisAtteinte({ ligne: L(dix), now, seuil: 203100 });
    dit(r && r.mois === null && r.nom === '', 'plafond 203 100 € pas atteint cette année à ce rythme ⇒ mois null (rien d\'affirmé)', JSON.stringify(r));
    // Données seulement depuis septembre : 2 mois finis (sept., oct.).
    r = M.moisAtteinte({ ligne: L([['2026-09', 40000], ['2026-10', 40000]]), now, seuil: 85000 });
    dit(r && r.base === 2 && r.mois === 10, 'publié depuis septembre : rythme sur 2 mois (40 000 €) ⇒ 120 000 € fin novembre ≥ 85 000 ⇒ novembre ; base 2', JSON.stringify(r));
    r = M.moisAtteinte({ ligne: L([['2026-10', 60000]]), now, seuil: 85000 });
    dit(r === null, 'un seul mois fini de données ⇒ aucune projection', JSON.stringify(r));
    // Le mois en cours (pas fini) n'entre pas dans le rythme.
    r = M.moisAtteinte({ ligne: L([['2026-09', 1000], ['2026-10', 1000], ['2026-11', 82000]]), now, seuil: 85000 });
    dit(r && r.rythme === 1000 && r.mois === null, 'novembre en cours (82 000 €) exclu du rythme : 1 000 €/mois ⇒ pas cette année', JSON.stringify(r));
    r = M.moisAtteinte({ ligne: L(dix, { aDater: { n: 2 } }), now, seuil: 85000 });
    dit(r === null, 'ventes sans date de versement ⇒ total partiel ⇒ aucune projection', JSON.stringify(r));
    r = M.moisAtteinte({ ligne: L(dix, { sources: { ...S, eBay: 'pasSu' } }), now, seuil: 85000 });
    dit(r === null, 'eBay pas lu ⇒ aucune projection', JSON.stringify(r));
    r = M.moisAtteinte({ ligne: L([['2026-01', 50000], ['2026-02', 50000]]), now, seuil: 85000 });
    dit(r === null, 'seuil déjà dépassé ⇒ rien (la jauge le dit)', JSON.stringify(r));
    dit(M.moisAtteinte({ ligne: null, now, seuil: 85000 }) === null, 'sans ligne publiée ⇒ null');
    dit(M.moisAtteinte({ ligne: L(dix), now: new Date(2031, 5, 1), seuil: 85000 }) === null, 'année sans seuils vérifiés ⇒ null');
    // ── DAC7 ──
    const par = (o) => o;
    let d = M.dac7ParPlateforme({ annee: 2026, ligne: { sources: S, mois: [
      { ym: '2026-03', ca: 0, par: par({ Vinted: { n: 20, ca: 1200 }, Leboncoin: { n: 2, ca: 2000 }, eBay: { n: 29, ca: 300 } }) },
      { ym: '2026-04', ca: 0, par: par({ Vinted: { n: 10, ca: 300 }, eBay: { n: 0, ca: 0 }, Vestiaire: { n: 1, ca: 2000.01 } }) },
      { ym: '2025-12', ca: 0, par: par({ Leboncoin: { n: 50, ca: 9000 } }) },
    ] } });
    const P = (k) => d.plateformes.find((x) => x.plateforme === k) || {};
    dit(P('Vinted').n === 30 && P('Vinted').verdict === 'atteint', 'Vinted : 30 ventes ⇒ atteint (au moins 30)', JSON.stringify(P('Vinted')));
    dit(P('Leboncoin').n === 2 && P('Leboncoin').centimes === 200000 && P('Leboncoin').verdict === 'sous', 'Leboncoin : 2 000,00 € pile ⇒ PAS atteint (« plus de ») ; 2025 ignorée', JSON.stringify(P('Leboncoin')));
    dit(P('Leboncoin').reste && P('Leboncoin').reste.centimes === 1 && P('Leboncoin').reste.n === 28, 'Leboncoin : il reste 28 ventes ou 0,01 €', JSON.stringify(P('Leboncoin').reste));
    dit(P('eBay').verdict === 'sous' && P('eBay').n === 29, 'eBay : 29 ventes, 300 € ⇒ sous', JSON.stringify(P('eBay')));
    dit(P('Vestiaire').verdict === 'atteint', 'Vestiaire : 2 000,01 € ⇒ atteint', JSON.stringify(P('Vestiaire')));
    d = M.dac7ParPlateforme({ annee: 2026, ligne: { sources: { ...S, eBay: 'pasSu' }, mois: [{ ym: '2026-03', ca: 0, par: { Vinted: { n: 25, ca: 1500 } } }],
      aDater: { n: 6, ca: 600, par: { Vinted: { n: 6, ca: 600 } } }, nonComptees: { n: 1, par: { 'Vestiaire|montant': 1 } } } });
    dit(P('eBay').etat === 'passu' && P('eBay').n === null && P('eBay').verdict === null, 'eBay pas lu ⇒ « — » (n null), jamais 0 ni « sous »', JSON.stringify(P('eBay')));
    dit(P('Vinted').verdict === 'atteintSi' && P('Vinted').nAd === 6 && P('Vinted').ctsAd === 60000, 'Vinted 25 + 6 à dater ⇒ « atteint si » (estimation)', JSON.stringify(P('Vinted')));
    dit(P('Vestiaire').verdict === null && P('Vestiaire').nNc === 1 && P('Vestiaire').partiel, 'Vestiaire : une vente au montant pas sûr ⇒ ni « sous » ni « atteint » (au moins)', JSON.stringify(P('Vestiaire')));
    dit(M.dac7ParPlateforme({ ligne: null, annee: 2026 }) === null, 'sans ligne publiée ⇒ null');
  } catch (e) { dit(false, 'la règle s\'exécute', String(e && e.stack || e).slice(0, 300)); }
  finally { try { fs.unlinkSync(tmp); } catch (_) {} }
  console.log(ko ? `\n❌ audit-seuils-annee${mut ? ' [' + mut + ']' : ''} : ${ko} rouge(s) sur ${n}` : `\n✅ audit-seuils-annee : ${n} verts`);
  process.exit(ko ? 1 : 0);
})();
