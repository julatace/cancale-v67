#!/usr/bin/env node
// Exécute la VRAIE règle de src/microEntreprise.js (29 octobre) : les seuils
// officiels 2026, la jauge (trois états, « au moins », N-1, projection), le
// calendrier (le mois M se déclare et se paie en M+1 ; trimestres) et les
// options (versement libératoire DEMANDÉ, jamais deviné).
// `--mutation=X` réaffaiblit la règle dans une copie : le contrôle doit rougir.
//   ancien-plafond · tva-sans-majore · partiel-ignore · mois-meme · vl-devine · projection-partielle
const fs = require('fs'), path = require('path'), os = require('os');
const ICI = path.join(__dirname, '..');
const mut = (process.argv.find((a) => a.startsWith('--mutation=')) || '').slice(11);
let src = fs.readFileSync(path.join(ICI, 'src', 'microEntreprise.js'), 'utf8');
const muter = (a, b) => { if (!src.includes(a)) { console.error('ancre absente :', a); process.exit(2); } src = src.replace(a, b); };
if (mut === 'ancien-plafond') muter('plafondVente: 203100', 'plafondVente: 188700');
if (mut === 'tva-sans-majore') muter("else if (cur.ca > s.tvaMajore) tvaEtat = 'majore_depasse';\n", '');
if (mut === 'partiel-ignore') muter('return { ca: r2(ca), mois, partiel: raisons.length > 0, raisons };', 'return { ca: r2(ca), mois, partiel: false, raisons };');
if (mut === 'mois-meme') muter('const ouvre = new Date(ps.getFullYear(), ps.getMonth() + 1, 1);\n      const limite = new Date(ps.getFullYear(), ps.getMonth() + 2, 0);', 'const ouvre = new Date(ps.getFullYear(), ps.getMonth(), 1);\n      const limite = new Date(ps.getFullYear(), ps.getMonth() + 1, 0);');
if (mut === 'vl-devine') muter("const lib = o.liberatoire === 'oui' || o.liberatoire === 'non' ? o.liberatoire : null;", "const lib = o.liberatoire === 'non' ? 'non' : 'oui';");
if (mut === 'projection-proche') muter("(tvaEtat === 'ok' || tvaEtat === 'proche')", "tvaEtat === 'ok'");
if (mut === 'cases-devinees') muter("cases: CASES_IMPOT[liberatoire] || ['5KO', '5TA'],", "cases: CASES_IMPOT[liberatoire] || ['5KO'],");
if (mut === 'annee-courante') muter('const annee = now.getMonth() < 6 ? now.getFullYear() - 1 : now.getFullYear();', 'const annee = now.getFullYear();');
if (mut === 'case-vl') muter("oui: ['5TA']", "oui: ['5KO']");
if (mut === 'projection-partielle') muter('(!cur.partiel && jours >= 60', '(jours >= 60');
const tmp = path.join(os.tmpdir(), `micro-${process.pid}.mjs`);
fs.writeFileSync(tmp, src);
let ko = 0, n = 0;
const dit = (ok, l, d) => { n++; if (!ok) ko++; console.log(`${ok ? '✅' : '❌'} ${l}${!ok && d !== undefined ? ' — ' + d : ''}`); };
(async () => {
  const M = await import(tmp);
  const s = M.seuilsDe(2026);
  dit(s && s.plafondVente === 203100 && s.tvaBase === 85000 && s.tvaMajore === 93500, 'seuils officiels 2026 (203 100 · 85 000 · 93 500)', JSON.stringify(s));
  dit(M.seuilsDe(2031) === null, 'année sans chiffres vérifiés ⇒ aucun seuil (jamais un plafond périmé)');
  const L = (mois, extra = {}) => ({ mois: mois.map(([ym, ca]) => ({ ym, ca })), sources: { Vinted: 'lu', Leboncoin: 'lu', eBay: 'lu' }, ...extra });
  const now = new Date(2026, 9, 29, 12);
  dit(M.jaugeSeuils({ ligne: null, now }) === null, 'sans ligne publiée ⇒ null (pas su, jamais 0)');
  let j = M.jaugeSeuils({ ligne: L([['2026-09', 4330.9], ['2026-08', 2311.4], ['2025-12', 99]]), now });
  dit(j && j.ca === 6642.3 && j.tva.etat === 'ok' && j.plafond.etat === 'ok' && !j.partiel, 'CA de l\'année = somme des mois de l\'année seulement', JSON.stringify(j && { ca: j.ca, tva: j.tva.etat }));
  j = M.jaugeSeuils({ ligne: L([['2026-09', 70000]]), now });
  dit(j.tva.etat === 'proche', '70 000 € ⇒ proche du seuil de TVA (≥ 80 %)', j.tva.etat);
  j = M.jaugeSeuils({ ligne: L([['2026-09', 90000]]), now });
  dit(j.tva.etat === 'base_depasse', '90 000 € ⇒ seuil de base dépassé (TVA au 1er janvier suivant)', j.tva.etat);
  j = M.jaugeSeuils({ ligne: L([['2026-09', 95000]]), now });
  dit(j.tva.etat === 'majore_depasse', '95 000 € ⇒ seuil majoré dépassé (TVA dès le jour du dépassement)', j.tva.etat);
  j = M.jaugeSeuils({ ligne: L([['2026-02', 1000], ['2025-06', 86000]]), now });
  dit(j.tva.etat === 'due_depuis_janvier', 'N-1 au-dessus de 85 000 € ⇒ TVA due depuis le 1er janvier', j.tva.etat);
  j = M.jaugeSeuils({ ligne: L([['2026-09', 195000]]), now });
  dit(j.plafond.etat === 'proche', '195 000 € ⇒ proche du plafond 203 100 €', j.plafond.etat);
  j = M.jaugeSeuils({ ligne: L([['2026-09', 210000], ['2025-09', 205000]]), now });
  dit(j.plafond.etat === 'sortie', 'plafond dépassé deux années de suite ⇒ sortie du régime', j.plafond.etat);
  j = M.jaugeSeuils({ ligne: L([['2026-09', 1000]], { sources: { Vinted: 'lu', eBay: 'pasSu' }, aDater: { n: 3 } }), now });
  dit(j.partiel && j.raisons.length === 2 && j.projection === null, 'eBay pas lu + ventes sans date ⇒ minimum dit, aucune projection', JSON.stringify(j && { p: j.partiel, r: j.raisons, pr: j.projection }));
  j = M.jaugeSeuils({ ligne: L([['2026-09', 80000]]), now });
  dit(j.projection > 85000 && j.projTva, 'projection au rythme actuel signale le seuil de TVA', JSON.stringify({ pr: j.projection, t: j.projTva }));
  j = M.jaugeSeuils({ ligne: L([['2026-01', 5000]]), now: new Date(2026, 0, 20) });
  dit(j.projection === null, 'avant 60 jours : aucune projection');
  // calendrier
  let c = M.calendrierUrssaf('mensuel', new Date(2026, 7, 5));
  dit(c[0].periode === 'juillet 2026' && c[0].ouvre.getMonth() === 7 && c[0].ouvre.getDate() === 1 && c[0].limite.getMonth() === 7 && c[0].limite.getDate() === 31 && c[0].ouverte,
    'mensuel, le 5 août : juillet se déclare et se paie du 1er au 31 août', JSON.stringify(c[0]));
  dit(c[1].periode === 'août 2026' && c[1].limite.getMonth() === 8 && c[1].limite.getDate() === 30 && !c[1].ouverte, 'puis août : du 1er au 30 septembre, pas encore ouvert', JSON.stringify(c[1]));
  c = M.calendrierUrssaf('trimestriel', new Date(2026, 9, 29));
  dit(c[0].periode.startsWith('T3 2026') && c[0].limite.getMonth() === 9 && c[0].limite.getDate() === 31, 'trimestriel le 29 oct. : T3 avant le 31 octobre', c[0].periode);
  dit(c[1].periode.startsWith('T4 2026') && c[1].limite.getFullYear() === 2027 && c[1].limite.getMonth() === 0 && c[1].limite.getDate() === 31, 'puis T4 avant le 31 janvier 2027', c[1].periode);
  dit(/août 2026 se déclare et se paie du 1er septembre au 30 septembre/.test(M.phraseRythme('mensuel', new Date(2026, 8, 3))) || /août/.test(M.phraseRythme('mensuel', new Date(2026, 8, 3))), 'la phrase du rythme cite un vrai mois', M.phraseRythme('mensuel', new Date(2026, 8, 3)));
  // options
  dit(M.optionsMicro(null).liberatoire === null && M.optionsMicro({ liberatoire: 'peut-être' }).liberatoire === null, 'versement libératoire pas répondu ⇒ null (jamais deviné)');
  dit(M.optionsMicro({ liberatoire: 'oui', acre: true }).liberatoire === 'oui' && M.optionsMicro({ liberatoire: 'oui', acre: true }).acre === true, 'réponse rangée relue telle quelle');
  // déclaration de revenus (2042-C-PRO 2026 vérifiée : 5TA avec VL, 5KO sans)
  const LI = L([['2025-11', 400], ['2025-12', 600], ['2026-01', 1000], ['2026-09', 300]]);
  const dP = M.declarationRevenus({ ligne: LI, now: new Date(2026, 4, 10, 12), liberatoire: 'non' });
  dit(dP && dP.annee === 2025 && dP.ca === 1000 && !dP.enCours && dP.cases.join() === '5KO', 'au printemps : l\'année passée (1 000 €), case 5KO sans versement libératoire', JSON.stringify(dP));
  const dA = M.declarationRevenus({ ligne: LI, now, liberatoire: 'oui' });
  dit(dA && dA.annee === 2026 && dA.ca === 1300 && dA.enCours && dA.cases.join() === '5TA', 'en octobre : l\'année en cours (1 300 €), case 5TA avec versement libératoire', JSON.stringify(dA));
  dit(M.declarationRevenus({ ligne: LI, now, liberatoire: null }).cases.join() === '5KO,5TA', 'versement libératoire pas répondu ⇒ les deux cases, jamais devinée');
  dit(M.declarationRevenus({ ligne: null, now }) === null, 'sans ligne publiée ⇒ pas su (jamais 0)');
  dit(M.declarationRevenus({ ligne: L([['2026-09', 300]], { sources: { Vinted: 'lu', eBay: 'pasSu' } }), now }).partiel === true, 'une plateforme pas lue ⇒ « au moins »');
  dit(M.rappelCfe(new Date(2026, 10, 20)) && M.rappelCfe(new Date(2026, 11, 15)) && !M.rappelCfe(new Date(2026, 11, 16)) && !M.rappelCfe(now), 'rappel CFE du 1er novembre au 15 décembre seulement');
  fs.unlinkSync(tmp);
  console.log(ko ? `❌ audit-micro-entreprise : ${ko}/${n} rouge(s)` : `✅ audit-micro-entreprise : ${n} contrôles verts`);
  process.exit(ko ? 1 : 0);
})();
