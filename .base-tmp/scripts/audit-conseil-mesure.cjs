// ════════════════════════════════════════════════════════════════════════════
//  LE CONSEIL DE BAISSE MESURÉ (12 nov. 2026, Julien : « on le garde, mais ça ne
//  doit pas être abusif ») — EXÉCUTÉ
//
//  La règle PURE (src/conseilPrix.js) tourne sur des paires INVENTÉES (dépôt public) :
//    A  10 j en ligne ⇒ rien ; âge pas lu ⇒ rien ; vendue ⇒ rien ;
//    B  45 j ⇒ une proposition, −10 % au plus, à l'euro, sous le prix actuel ;
//       balayage (prix à centimes 5–600 €, achats variés) : jamais plus de −10 %,
//       jamais sous l'achat + 10 %, toujours un entier ;
//    C  prix d'achat absent (null, '', 0, texte) ⇒ rien (jamais deviné, §2.5) ;
//    D  plancher : achat 85 € sur 100 € ⇒ 94 € (achat + 10 %) ; achat 95 € ⇒ rien ;
//    E  14 jours entre deux : baisse LUE il y a 5 j ⇒ rien, 15 j ⇒ oui ; proposition
//       faite il y a 3 j ⇒ la MÊME (jamais une autre), prix changé ⇒ rien ; 15 j ⇒ une
//       nouvelle ; un vendeur qui accepte TOUT sur 200 jours : écart ≥ 14 j, −10 % max ;
//    F  la phrase : « Baisser à 92 € ? » · « en ligne depuis 45 j · 3 favoris » ;
//    G  la baisse lue (journal des prix lus, prix changés par VRM) ; eBay en proportion ;
//       le registre ne note que les propositions NOUVELLES ;
//    H  l'app : la fiche ET le repricing lisent la même carte (`conseilsPrix`), plus de
//       « −15 % » ni de 12–30 %, aucun prix conseillé à la mise en ligne, jamais rouge.
//  `--prouve` : chaque mutation de la règle doit faire rougir au moins un contrôle.
//  `--racine <dir>` : jouer l'audit sur un autre arbre (git archive de la branche de départ).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { pathToFileURL } = require('url');
const iR = process.argv.indexOf('--racine');
const R = iR > 0 ? path.resolve(process.argv[iR + 1]) : path.join(__dirname, '..');
const PROUVE = process.argv.includes('--prouve');
const { sourceApp } = require(fs.existsSync(path.join(R, 'scripts', '_source-app.cjs')) ? path.join(R, 'scripts', '_source-app.cjs') : './_source-app.cjs');

const J = 86400000, T0 = Date.UTC(2026, 10, 12, 10);

async function controles(fichierRegle, APP, CSS, parler) {
  let ko = 0;
  const dit = (c, m, d) => { if (!c) ko++; if (parler) console.log((c ? 'OK  ' : 'KO  ') + m + (d && !c ? ' — ' + d : '')); };
  let M = null;
  try { M = await import(pathToFileURL(fichierRegle).href + '?v=' + Math.random()); } catch (e) { dit(false, 'src/conseilPrix.js se charge', e.message); }
  if (M) {
  const C = (o) => { try { return M.conseilBaisse({ maintenant: T0, ...o }); } catch (e) { return { sugg: null, pourquoi: 'leve:' + e.message }; } };
  const base = { prix: 100, ageJours: 45, achat: 40, favoris: 3 };

  // A
  dit(C({ ...base, ageJours: 10 }).sugg == null, 'A1 10 j en ligne ⇒ rien');
  dit(C({ ...base, ageJours: 29 }).sugg == null, 'A2 29 j ⇒ rien (30 j au moins)');
  dit(C({ ...base, ageJours: null }).sugg == null && C({ ...base, ageJours: undefined }).sugg == null, 'A3 âge pas lu ⇒ rien');
  dit(C({ ...base, vendue: true }).sugg == null, 'A4 vendue (bordereau) ⇒ rien');
  dit(C({ ...base, prix: null }).sugg == null, 'A5 prix pas lu ⇒ rien');

  // B
  const b = C(base);
  dit(b.sugg === 90 && b.nouveau === true, 'B1 45 j, 100 € ⇒ « Baisser à 90 € ? » (−10 %)', JSON.stringify(b));
  dit(C({ ...base, prix: { amount: '49.90', currency_code: 'EUR' } }).sugg === 45, 'B2 49,90 € (forme Vinted) ⇒ 45 € (−9,8 %, arrondi à l\'euro sans dépasser 10 %)', JSON.stringify(C({ ...base, prix: { amount: '49.90' } })));
  const fautes = [];
  let n = 0;
  for (let pc = 500; pc <= 60000; pc += 137) {
    for (const achatR of [0.1, 0.3, 0.6, 0.8, 0.9, 1.2]) {
      const prix = pc / 100, achat = Math.round(prix * achatR * 100) / 100;
      const c = C({ prix, ageJours: 30 + (pc % 300), achat });
      if (c.sugg == null) continue;
      n++;
      if (!Number.isInteger(c.sugg)) fautes.push(`${prix}: ${c.sugg} pas entier`);
      if (c.sugg * 100 >= pc) fautes.push(`${prix}: ${c.sugg} pas une baisse`);
      if ((pc - c.sugg * 100) > pc * 0.10 + 1e-9) fautes.push(`${prix}: ${c.sugg} plus de −10 %`);
      if (c.sugg * 100 < Math.round(achat * 100) * 1.10 - 1e-9) fautes.push(`${prix} (achat ${achat}): ${c.sugg} sous achat + 10 %`);
    }
  }
  dit(n > 1000 && !fautes.length, `B3 balayage (${n} propositions) : entier, sous le prix, −10 % au plus, jamais sous l'achat + 10 %`, fautes.slice(0, 4).join(' | '));

  // C
  const sansAchat = [null, undefined, '', '  ', 0, '0', 'abc'].filter((a) => C({ ...base, achat: a }).sugg != null);
  dit(!sansAchat.length, 'C1 prix d\'achat absent (null, vide, 0, texte) ⇒ rien, jamais deviné', JSON.stringify(sansAchat));

  // D
  const d1 = C({ ...base, achat: 85 });
  dit(d1.sugg === 94 && d1.auPlancher === true, 'D1 achat 85 € sur 100 € ⇒ 94 € (achat + 10 %, plancher)', JSON.stringify(d1));
  dit(C({ ...base, achat: 95 }).sugg == null, 'D2 achat 95 € sur 100 € ⇒ rien (le plancher 105 € est au-dessus)');
  dit(C({ ...base, achat: '90,91' }).sugg == null, 'D3 achat 90,91 € ⇒ plancher 101 € ⇒ rien');

  // E
  dit(C({ ...base, derniereBaisse: T0 - 5 * J }).sugg == null, 'E1 baisse LUE il y a 5 j ⇒ rien');
  dit(C({ ...base, derniereBaisse: T0 - 15 * J }).sugg === 90, 'E2 baisse lue il y a 15 j ⇒ une proposition');
  const e3 = C({ ...base, memo: { at: T0 - 3 * J, prix: 100, sugg: 90 } });
  dit(e3.sugg === 90 && e3.nouveau === false, 'E3 proposée il y a 3 j, prix inchangé ⇒ la MÊME, pas une nouvelle', JSON.stringify(e3));
  dit(C({ ...base, prix: 95, memo: { at: T0 - 3 * J, prix: 100, sugg: 90 } }).sugg == null, 'E4 proposée il y a 3 j, prix changé depuis ⇒ rien avant 14 j');
  const e5 = C({ ...base, prix: 90, memo: { at: T0 - 15 * J, prix: 100, sugg: 90 } });
  dit(e5.sugg === 81 && e5.nouveau === true, 'E5 proposée il y a 15 j ⇒ une nouvelle (90 → 81)', JSON.stringify(e5));
  // Un vendeur qui accepte chaque proposition le jour même, 200 jours durant.
  {
    let prix = 120, memo = null; const histo = []; const props = []; const fautesE = [];
    for (let j = 0; j <= 200; j++) {
      const t = T0 + j * J;
      const c = M.conseilBaisse({ prix, ageJours: j, achat: 30, derniereBaisse: M.derniereBaisseLue('1', null, histo), memo: memo && memo.a['1'], maintenant: t });
      if (c.sugg == null) continue;
      if (c.nouveau) {
        props.push({ j, de: prix, a: c.sugg });
        memo = M.noterConseils(memo, new Map([['1', c]]), t);
        histo.push({ item: '1', avant: prix, apres: c.sugg, at: new Date(t + 3600000).toISOString() });
        if ((prix - c.sugg) > prix * 0.10 + 1e-9) fautesE.push(`j${j} ${prix}→${c.sugg}`);
        prix = c.sugg;
      }
    }
    for (let i = 1; i < props.length; i++) if (props[i].j - props[i - 1].j < 14) fautesE.push(`j${props[i - 1].j}→j${props[i].j}`);
    dit(props.length >= 3 && props[0].j === 30 && !fautesE.length && props.every((p) => p.a >= 33), `E6 tout accepté sur 200 j : ${props.length} propositions, ≥ 14 j d'écart, −10 % max, jamais sous 33 €`, (fautesE.join(' | ') || JSON.stringify(props)).slice(0, 200));
  }

  // F
  dit(b.phrase === 'Baisser à 90\u00a0€\u00a0?', 'F1 « Baisser à 90 € ? » (une question)', JSON.stringify(b.phrase));
  dit(b.raison === 'en ligne depuis 45 j · 3 favoris', 'F2 « en ligne depuis 45 j · 3 favoris »', b.raison);
  dit(C({ ...base, favoris: null }).raison === 'en ligne depuis 45 j' && C({ ...base, favoris: 1 }).raison === 'en ligne depuis 45 j · 1 favori', 'F3 favoris pas lus ⇒ pas dits ; 1 favori au singulier');

  // G
  const journal = { v: 1, a: { '7': [[T0 - 40 * J, 10000], [T0 - 20 * J, 9000], [T0 - 10 * J, 9500]] } };
  dit(M.derniereBaisseLue('7', journal, []) === T0 - 20 * J, 'G1 journal des prix lus : la baisse est le point plus bas que le précédent (une hausse n\'en est pas une)');
  dit(M.derniereBaisseLue('7', null, [{ item: '7', avant: 100, apres: 90, at: new Date(T0 - 2 * J).toISOString() }, { item: '8', avant: 100, apres: 50, at: new Date(T0).toISOString() }]) === T0 - 2 * J, 'G2 prix changés par VRM : par l\'identifiant de l\'annonce seulement');
  const eb = M.baisseProportion(60, { sugg: 45, prix: 49 }, 25);
  dit(eb === 55, 'G3 eBay en proportion : 49 → 45 sur Vinted ⇒ 60 → 55 sur eBay', String(eb));
  dit(M.baisseProportion(60, { sugg: 45, prix: 49 }, null) == null && M.baisseProportion(60, { sugg: 45, prix: 49 }, 56) == null, 'G4 eBay : sans achat ⇒ rien ; plancher au-dessus ⇒ rien');
  const m0 = { v: 1, a: {} };
  dit(M.noterConseils(m0, new Map([['1', { ...b, nouveau: false }]]), T0) === m0, 'G5 une proposition déjà notée n\'écrit rien');
  const m1 = M.noterConseils(m0, new Map([['1', b]]), T0);
  dit(m1 !== m0 && m1.a['1'] && m1.a['1'].at === T0 && m1.a['1'].sugg === 90, 'G6 une proposition nouvelle est notée avec sa date');

  }
  // H — l'app (jouée même sans la règle : sur la branche de départ, elle dit ce qui manquait)
  const sans = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');
  const A = sans(APP);
  dit(/from "\.\/conseilPrix\.js"/.test(APP) && /conseilBaisse\(\{/.test(A), 'H1 l\'app calcule le conseil par src/conseilPrix.js');
  dit(/const conseil = soldBord \? null : conseilsPrix\.get\(String\(it\.id\)\)/.test(A), 'H2 la fiche lit la carte `conseilsPrix` (vendue ⇒ rien)');
  dit(/const c = conseilsPrix\.get\(String\(it\.id\)\); if \(!c\) continue;/.test(A), 'H3 le repricing lit la MÊME carte');
  dit(!/0\.85\)/.test(A.slice(A.indexOf('const conseil = soldBord'), A.indexOf('const conseil = soldBord') + 600)) && !/age >= 90 \? 0\.30/.test(A), 'H4 plus de « −15 % » ni de 12–30 %');
  dit(/\{conseil\.phrase\}/.test(A) && !/\{montant\(sugg\)\} conseillé/.test(A), 'H5 la fiche dit « Baisser à X € ? », plus « X € conseillé »');
  dit(!/>Prix conseillé</.test(A) && !/lister\.reco\b/.test(A), 'H6 aucun prix conseillé à la mise en ligne (refusé le 11 oct.)');
  const regleCss = (CSS.match(/\.vrm-fiche-geste-sous[^{]*\{[^}]*\}/g) || []).join(' ');
  dit(regleCss && !/#(?:e|f|d)[0-9a-f]{2}[0-9a-f]{0,3}\b|red|danger|--vrm-rouge/i.test(regleCss), 'H7 la suggestion n\'est jamais rouge (CSS)', regleCss.slice(0, 160));
  return ko;
}

const MUTATIONS = [
  ['−15 % au lieu de −10 %', 'export const BAISSE_MAX_PCT = 10;', 'export const BAISSE_MAX_PCT = 15;'],
  ['dès 7 jours', 'export const AGE_MIN_J = 30;', 'export const AGE_MIN_J = 7;'],
  ['pas d\'écart de 14 j', 'export const ECART_J = 14;', 'export const ECART_J = 0;'],
  ['plancher = achat', 'export const MARGE_PLANCHER_PCT = 10;', 'export const MARGE_PLANCHER_PCT = 0;'],
  ['achat deviné', "if (plancher == null) return { sugg: null, pourquoi: 'achat' };", ''],
  ['âge inconnu = 30 j', "const age = ageJours == null || ageJours === '' ? NaN : Number(ageJours);", "const age = ageJours == null || ageJours === '' ? 30 : Number(ageJours);"],
  ['arrondi au plus proche', 'return Math.ceil(p * (100 - BAISSE_MAX_PCT) / 10000);', 'return Math.round(p * (100 - BAISSE_MAX_PCT) / 10000);'],
  ['mémo ignoré', 'if (memo && Number.isFinite(Number(memo.at))', 'if (false && memo && Number.isFinite(Number(memo.at))'],
  ['baisse lue ignorée', 'if (derniereBaisse != null && Number.isFinite', 'if (false && derniereBaisse != null && Number.isFinite'],
  ['vendue ignorée', "if (vendue) return { sugg: null, pourquoi: 'vendue' };", ''],
];

(async () => {
  const REGLE = path.join(R, 'src', 'conseilPrix.js');
  let APP = '', CSS = '';
  try { APP = sourceApp(R); } catch (_) { APP = fs.existsSync(path.join(R, 'src', 'App.jsx')) ? fs.readFileSync(path.join(R, 'src', 'App.jsx'), 'utf8') : ''; }
  try { CSS = fs.readFileSync(path.join(R, 'src', 'styles-annonces-coherence.css'), 'utf8'); } catch (_) {}
  const ko = await controles(REGLE, APP, CSS, true);
  let koM = 0;
  if (PROUVE && fs.existsSync(REGLE)) {
    const src = fs.readFileSync(REGLE, 'utf8');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'conseil-mesure-'));
    for (const [nom, a, bb] of MUTATIONS) {
      if (!src.includes(a)) { console.log(`KO  mutation « ${nom} » : texte introuvable`); koM++; continue; }
      const f = path.join(dir, `m${MUTATIONS.findIndex((m) => m[0] === nom)}.mjs`);
      fs.writeFileSync(f, src.replace(a, bb));
      const k = await controles(f, APP, CSS, false);
      console.log((k > 0 ? 'OK  ' : 'KO  ') + `mutation « ${nom} » ⇒ ${k} contrôle(s) rouge(s)`);
      if (!k) koM++;
    }
    fs.rmSync(dir, { recursive: true, force: true });
  }
  console.log(ko || koM ? `\n${ko} contrôle(s) rouge(s)${PROUVE ? `, ${koM} mutation(s) non vue(s)` : ''}` : '\nTout est vert.');
  process.exit(ko || koM ? 1 : 0);
})();
