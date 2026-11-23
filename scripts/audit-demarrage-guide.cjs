// ════════════════════════════════════════════════════════════════════════════
// AUDIT : LE DÉMARRAGE GUIDÉ — « Bien démarrer », un vrai accompagnement animé
//         node scripts/audit-demarrage-guide.cjs [--prouve]
// ════════════════════════════════════════════════════════════════════════════
// (23 nov., lot demarrage-guide) Julien (validé le 23 nov.) : un nouveau vendeur
// démarre en 5 min — relier ses comptes, installer l'extension (Chrome / Edge /
// Orion), voir ses premiers chiffres, coche verte par étape, reprise là où il
// s'est arrêté ; puis « un vrai accompagnement avec du motion design, animations
// courtes à chaque étape, passables, ton chaleureux et simple ». Cet audit EXÉCUTE
// src/bienDemarrer/regle.js et src/bienDemarrer/accompagnement.js, et lit
// l'écran, la feuille de style et les textes :
//   G1 un compte Leboncoin / Vestiaire / eBay relié fait l'étape « compte » ;
//      rien de lu ⇒ « pas su », jamais coché sur un silence ;
//   G2 la reprise : la feuille s'ouvre sur la 1re étape pas faite, sauf choix ;
//   G3 le navigateur : nommé seulement s'il est SU ; un iPhone hors Orion ⇒
//      « installe Orion », jamais une boutique Chrome ;
//   G4 une étape FAITE n'offre plus de geste ; « Étape suivante » saute les faites ;
//   G5 rien n'est coché par un toucher : la feuille n'écrit rien ;
//   G6 le mouvement : chaque animation ≤ 500 ms, tout fini avant 2 s, « Passer »
//      fige, `prefers-reduced-motion` ⇒ aucun mouvement ;
//   G7 la palette du jour : ni ambre, ni orange, ni rouge, ni capitales ;
//   G8 le branchement (Aujourd'hui) et les textes en 5 langues, toutes les clés.
// `--prouve` : chaque mutation doit rendre l'audit ROUGE.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
const R = process.env.VRM_RACINE || path.join(__dirname, '..');
const PROUVE = process.argv.includes('--prouve');
const lire = (f) => { try { return fs.readFileSync(path.join(R, f), 'utf8'); } catch (_) { return ''; } };
const sansCommentaires = (t) => t.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
const DOS = path.join(R, 'src', 'bienDemarrer');
async function charger(regle, acc) {
  const id = `${process.pid}-${Math.random().toString(36).slice(2)}`;
  const fr = path.join(DOS, `.audit-dg-r-${id}.mjs`), fa = path.join(DOS, `.audit-dg-a-${id}.mjs`);
  fs.writeFileSync(fr, regle); fs.writeFileSync(fa, acc.replace("from './regle.js'", `from './${path.basename(fr)}'`));
  try { return [await import('file://' + fr), await import('file://' + fa)]; } finally { try { fs.unlinkSync(fr); fs.unlinkSync(fa); } catch (_) {} }
}

async function verifier(S) {
  let ko = 0;
  const dit = (c, m) => { if (!c) { ko++; if (!PROUVE) console.log('  ❌ ' + m); } else if (process.env.BAVARD) console.log('  ✅ ' + m); };
  let Rg, A; try { [Rg, A] = await charger(S.regle, S.acc); } catch (e) { dit(false, 'modules illisibles : ' + e.message); return ko; }
  if (typeof A.pageAccompagnement !== 'function') { dit(false, 'G0 accompagnement.js existe'); return ko; }
  const etat = (p, cle) => (Rg.etapesBienDemarrer(p).find((e) => e.cle === cle) || {}).etat;
  dit(etat({ comptes: false, autres: true }, 'compte') === 'fait', 'G1 un compte Leboncoin/Vestiaire/eBay relié ⇒ « compte » fait');
  dit(etat({ comptes: false, autres: false }, 'compte') === 'afaire', 'G1b rien relié (lu) ⇒ à faire');
  dit(etat({ comptes: false, autres: null }, 'compte') === 'passu', 'G1c un site pas lu ⇒ « pas su », jamais « à faire » ni coché');
  dit(etat({ comptes: true }, 'compte') === 'fait' && etat({ comptes: false }, 'compte') === 'afaire', 'G1d sans les autres sites : la règle d’avant');
  const E = [{ cle: 'extension', etat: 'fait' }, { cle: 'compte', etat: 'afaire' }, { cle: 'lecture', etat: 'fait' }, { cle: 'numeros', etat: 'afaire' }, { cle: 'fiscal', etat: 'passu' }];
  dit(A.etapeDeReprise(E) === 'compte', 'G2 reprise : la 1re étape pas faite');
  dit(A.etapeDeReprise(E, 'fiscal') === 'fiscal', 'G2b son choix l’emporte');
  dit(A.etapeSuivante(E, 'compte') === 'numeros', 'G4 « Étape suivante » saute l’étape déjà faite');
  const fam = (nav, mob) => A.familleNavigateur(nav, mob);
  dit(fam('edge', 'autre') === 'chromium' && A.nomSu('edge', 'autre') === 'Edge', 'G3 Edge sur ordinateur : la boutique Chromium, nommé « Edge »');
  dit(fam('chrome', 'autre') === 'chromium' && A.nomSu('chrome', 'autre') === 'Chrome', 'G3b Chrome nommé');
  dit(fam('safari', 'ios') === 'iphone' && fam('chrome', 'ios') === 'iphone', 'G3c iPhone hors Orion ⇒ « installe Orion », jamais une boutique Chrome');
  dit(fam('orion', 'ios-orion') === 'orion' && A.nomSu('safari', 'ios-orion') === 'Orion', 'G3d Orion sur iPhone reconnu');
  dit(fam('chrome', 'android') === 'inconnu' && fam('firefox', 'firefox-android') === 'firefox', 'G3e Android : Firefox seul, sinon l’ordinateur');
  dit(fam('safari', 'autre') === 'inconnu' && A.nomSu('safari', 'autre') === '', 'G3f Safari d’ordinateur : rien nommé au hasard');
  const pEdge = A.pageAccompagnement(E.map((x) => x.cle === 'extension' ? { ...x, etat: 'afaire' } : x), 'extension', { nav: 'edge', mobile: 'autre' });
  dit(pEdge && pEdge.marches.length === 3 && pEdge.marches[0] === 'acc.ext.chromium.1' && pEdge.geste.cle === 'acc.geste.extension.chromium' && pEdge.geste.nom === 'Edge', 'G3g les marches et le geste d’Edge');
  const pFait = A.pageAccompagnement(E, 'extension', { nav: 'edge', mobile: 'autre' });
  dit(pFait && pFait.fait === true, 'G4b une étape faite est dite faite');
  const J = sansCommentaires(S.jsx);
  dit(/\{!p\.fait \? <Bouton variante="plein"/.test(J), 'G4c une étape faite n’offre plus de geste');
  dit(!/\bsave\(|ecrire|localStorage|fetch\(/.test(J), 'G5 la feuille n’écrit rien (la coche vient d’une preuve lue)');
  // G6 le mouvement
  const C = S.css;
  const durees = [...C.matchAll(/animation(?:-name)?:\s*acc-[a-z]+\s+(\d+)ms/g)].map((m) => +m[1]);
  const delais = [...C.matchAll(/animation-delay:\s*(\d+)ms/g)].map((m) => +m[1]);
  dit(durees.length >= 3 && durees.every((d) => d <= 500), `G6 chaque animation ≤ 500 ms (${durees.join(', ')})`);
  dit(delais.length >= 4 && Math.max(...delais) + 500 <= 2000, `G6b tout est posé avant 2 s (dernier départ ${Math.max(...delais)} ms)`);
  dit(/@media \(prefers-reduced-motion: reduce\)\s*\{[^}]*\.acc-scene \*[^}]*animation:\s*none/.test(C), 'G6c mouvement réduit ⇒ aucune animation');
  dit(/\.acc-scene\.is-figee \*[^{]*\{\s*animation:\s*none/.test(C) && /data-acc-passer/.test(J) && /setFigee\(true\)/.test(J), 'G6d « Passer » fige la scène');
  dit(/data-acc-revoir/.test(J), 'G6e « Revoir » la rejoue');
  dit(!/ambre|orange|#F59E0B|#D97706|#FF9|#E8590C|--n-doublon|rouge|text-transform:\s*uppercase/i.test(sansCommentaires(C)), 'G7 ni ambre, ni orange, ni rouge, ni capitales');
  // G8 branchement + textes
  const App = sansCommentaires(S.app), BD = sansCommentaires(S.bd);
  dit(/nouveauCompte = proprio === false && String\(\(AUTH\.user && AUTH\.user\.created_at\) \|\| ''\)\.slice\(0, 10\) >= DEBUT_BIEN_DEMARRER/.test(App) && /useComptesAutresSites\(nouveauCompte\)/.test(App) && /comptes: comptesLus \? nComptes > 0 : null, autres,/.test(App), 'G8 Aujourd’hui passe les comptes des autres sites (jamais lus pour le propriétaire)');
  dit(/onGuider=\{setGuide\}/.test(App) && /<Accompagnement ouverte etapes=\{etapes\}/.test(App), 'G8b toucher une étape ouvre l’accompagnement');
  dit(/onGuider\(courante\)/.test(BD), 'G8c « Reprendre où tu t’es arrêté » ouvre la 1re étape pas faite');
  const cles = ['acc.rang', 'acc.continuer', 'acc.commencer', 'acc.suivante', 'acc.passer', 'acc.revoir', 'acc.dejaFait'];
  for (const c of Rg.ETAPES_BIEN_DEMARRER) { cles.push(`acc.${c}.titre`, `acc.${c}.phrase`); if (c !== 'extension') cles.push(`acc.${c}.1`, `acc.${c}.2`, `acc.geste.${c}`); }
  for (const [f, n] of Object.entries(A.MARCHES_EXTENSION)) { cles.push(`acc.geste.extension.${f}`); for (let i = 1; i <= n; i++) cles.push(`acc.ext.${f}.${i}`); }
  for (const l of ['fr', 'en', 'es', 'it', 'de']) {
    const t = lire(`src/i18n/langues/${l}/accompagnementDemarrage.js`);
    const manque = cles.filter((k) => !t.includes(`"${k}"`));
    dit(!manque.length && /ecran_accompagnement_demarrage/.test(lire(`src/i18n/langues/${l}.js`)), `G8d textes ${l} : toutes les clés (${manque.slice(0, 3).join(', ')})`);
  }
  return ko;
}

(async () => {
  const S = { regle: lire('src/bienDemarrer/regle.js'), acc: lire('src/bienDemarrer/accompagnement.js'), jsx: lire('src/bienDemarrer/Accompagnement.jsx'),
    css: lire('src/bienDemarrer/accompagnement.css'), app: lire('src/App.jsx'), bd: lire('src/bienDemarrer/BienDemarrer.jsx') };
  const ko = await verifier(S);
  if (!PROUVE) { console.log(ko ? `❌ audit-demarrage-guide : ${ko} contrôle(s) rouge(s)` : '✅ audit-demarrage-guide : vert'); process.exit(ko ? 1 : 0); }
  if (ko) { console.log(`❌ --prouve : le code actuel n'est pas vert (${ko})`); process.exit(1); }
  const MUT = [
    ['autres sites ignorés', 'regle', "p = { ...p, comptes: p.autres === undefined ? p.comptes : ouLu(p.comptes, p.autres) };", ''],
    ['silence coché', 'regle', "const ouLu = (a, b) => (a === true || b === true ? true : a === false && b === false ? false : null);", "const ouLu = (a, b) => (a === true || b === true ? true : false);"],
    ['iPhone ⇒ Chrome', 'acc', "if (mobile === 'ios') return 'iphone';", "if (mobile === 'ios') return 'chromium';"],
    ['reprise au début', 'acc', "const c = L.find((e) => e && e.etat !== 'fait');", 'const c = L[0];'],
    ['suivante faite', 'acc', "const r = L.slice(i + 1).find((e) => e && e.etat !== 'fait');", 'const r = L[i + 1];'],
    ['mouvement réduit oublié', 'css', '.acc-scene *, .acc-marche { animation: none; }', '.acc-marche { animation: none; }'],
    ['animation trop longue', 'css', 'animation: acc-entre 420ms', 'animation: acc-entre 1200ms'],
    ['ambre ajouté', 'css', '.acc-coche { color: var(--n-vert, #0F6B4C); }', '.acc-coche { color: var(--n-ambre); }'],
    ['geste sur une étape faite', 'jsx', '{!p.fait ? <Bouton variante="plein"', '{true ? <Bouton variante="plein"'],
  ];
  let rouges = 0;
  for (const [nom, ou, a, b] of MUT) {
    if (!S[ou].includes(a)) { console.log('❌ mutation impossible (motif absent) : ' + nom); process.exit(2); }
    const k = await verifier({ ...S, [ou]: S[ou].replace(a, b) });
    console.log((k ? '  ✅ rouge : ' : '  ❌ RESTE VERT : ') + nom); if (k) rouges++;
  }
  console.log(rouges === MUT.length ? `✅ --prouve : ${rouges}/${MUT.length} mutations rougissent` : `❌ --prouve : ${MUT.length - rouges} mutation(s) restent vertes`);
  process.exit(rouges === MUT.length ? 0 : 1);
})();
