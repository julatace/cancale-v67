#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — LE PRIX D'ACHAT AU NUMÉROTAGE, UNE SEULE ÉCRITURE (6 nov.)
//        node scripts/audit-prix-numerotage.cjs [--prouve]
// ════════════════════════════════════════════════════════════════════════════
// EXÉCUTE src/prixAuNumerotage.js :
//   E  l'écriture d'un prix TAPÉ : vide ⇒ RIEN (ni « 0 », ni lien effacé) ;
//      illisible ⇒ rien (« 25 € env. », « 2x30 », « -5 » : jamais une devinette) ;
//      sinon { buyPrice en centimes exacts, buyFromId: null, buyFrom: null } ;
//   D  quand le demander : ni prix connu (fiche ou miroir par N°) ni achat relié ;
//      50 fiches identiques ⇒ chacune jugée seule, aucune écriture ;
//   P  la suggestion PROPOSÉE (« Relier · 32,90 € ») : un bouton, jamais une
//      valeur pour le champ ; un lot ⇒ « Relier » (son prix sera demandé) ;
// puis LIT src/App.jsx (commentaires retirés) :
//   S  le branchement : toutes les saisies tapées (feuille du numérotage, saisie en
//      série, « Saisir » de la file, champ « achat » de la carte, ligne « mise en
//      ligne numérotée par VRM ») passent par `ecrirePrixTape` → `ecriturePrixSaisi` ;
//      la feuille n'est jamais pré-remplie ; « Relier » passe par `relierAchatAnnonce`
//      (l'écriture de « Relier un achat ») ; chaque N° posé à la main demande le prix ;
//      aucun effet n'écrit un prix ; UNE carte Ma journée (fusionnée).
// --prouve : chaque mutation réaffaiblit une règle ⇒ l'audit DOIT rougir.
'use strict';
require('./_source-app.cjs').brancher(); // (8 nov.) App.jsx découpé : sa lecture texte rend aussi src/ecrans/*.jsx
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const R = path.join(__dirname, '..');
const MUTS = {
  'vide-ecrit': ['src/prixAuNumerotage.js', "  if (p === undefined) return { etat: 'vide', patch: null };", "  if (p === undefined) return { etat: 'ok', patch: { buyPrice: '', buyFromId: null, buyFrom: null } };"],
  'devine-parsefloat': ['src/prixAuNumerotage.js', "  const c = centimes(t.replace(/\\s|€/g, ''));", "  const c = Math.round(parseFloat(t.replace(',', '.')) * 100);"],
  'lien-garde': ['src/prixAuNumerotage.js', "patch: { buyPrice: p, buyFromId: null, buyFrom: null } };", "patch: { buyPrice: p } };"],
  'relie-redemande': ['src/prixAuNumerotage.js', "  if (e.buyFromId != null && String(e.buyFromId).trim() !== '') return false;\n", ''],
  'suggestion-dans-champ': ['src/prixAuNumerotage.js', "    bouton: prop ? `Relier · ${f(prop.centimes / 100)}` : 'Relier',", "    bouton: prop ? `Relier · ${f(prop.centimes / 100)}` : 'Relier', valeur: prop ? String(prop.centimes / 100) : '',"],
  'serie-brute': ['src/App.jsx', '  const setBuyForKey = (key, val) => { ecrirePrixTape(key, val); };', "  const setBuyForKey = (key, val) => { setNumeros(prev => { const u = { ...prev, [key]: { ...(prev[key] || {}), buyPrice: String(val || '').trim(), buyFromId: null, buyFrom: null } }; save('vinted_annonce_numeros', u); return u; }); };"],
  'numerotage-seconde-regle': ['src/App.jsx', '    const w = ecrirePrixTape(item, rep, numeroPose);', "    const w = { etat: 'ok', patch: { buyPrice: String(parseFloat(String(rep).replace(',', '.'))) } }; updatePair(item, w.patch);"],
  'numerotage-prerempli': ['src/App.jsx', "      value: '', placeholder: 'ex : 25 ou 12,50', decimal: true,", "      value: sugg ? sugg.aff.bouton.replace(/[^0-9,]/g, '') : '', placeholder: 'ex : 25 ou 12,50', decimal: true,"],
  'numerotage-oublie': ['src/App.jsx', 'if (!autres.length) { updatePair(item, { numero: n, manuelAt, ...changeAMain(item, avant, n, manuelAt, opts) }); recordUsed(n); await demanderPrixAchat(item, n); return; }', 'if (!autres.length) { updatePair(item, { numero: n, manuelAt, ...changeAMain(item, avant, n, manuelAt, opts) }); recordUsed(n); return; }'],
  'neuf-sans-champ': ['src/App.jsx', 'onCommit={(v) => ecrirePrixTape(it, v, f.numero)}', 'onCommit={(v) => updatePair(it, { buyPrice: v })}'],
  'journee-doublee': ['src/App.jsx', "        jobs.sort((a,b)=>a.prio-b.prio);", "        { const nS = fileAchat ? fileAchat.length : 0; if (nS > 0) jobs.push({ id: 'prix-a-saisir', n: nS, court: `${nS} paires numérotées sans prix d’achat`, prio: 3.5 }); }\n        jobs.sort((a,b)=>a.prio-b.prio);"],
};
if (process.argv.includes('--prouve')) {
  let n = 0;
  for (const k of Object.keys(MUTS)) {
    let code = 0; try { execFileSync(process.execPath, [__filename, '--mutation=' + k], { stdio: 'pipe' }); } catch (e) { code = e.status; }
    console.log(`${code === 1 ? '✅' : '❌'} mutation « ${k} » ⇒ ${code === 1 ? 'ROUGE' : 'pas attrapée (' + code + ')'}`); if (code === 1) n++;
  }
  console.log(`${n}/${Object.keys(MUTS).length} mutations attrapées`); process.exit(n === Object.keys(MUTS).length ? 0 : 1);
}
let SRC = path.join(R, 'src');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1];
if (MUT) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'prix-numerotage-'));
  fs.cpSync(path.join(R, 'src'), path.join(d, 'src'), { recursive: true });
  const [f, de, vers] = MUTS[MUT];
  const p = path.join(d, f); const s = fs.readFileSync(p, 'utf8');
  if (!s.includes(de)) { console.log('motif introuvable : ' + MUT); process.exit(2); }
  fs.writeFileSync(p, s.replace(de, vers)); SRC = path.join(d, 'src');
  console.log('⚠️  MUTATION « ' + MUT + ' » — doit rougir');
}
let ok = 0, ko = 0;
const dit = (c, m, d = '') => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (c || !d ? '' : ' — ' + String(d).slice(0, 300))); };
const sansCommentaires = (t) => t.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

(async () => {
  let M = null;
  try { M = await import(require('url').pathToFileURL(path.join(SRC, 'prixAuNumerotage.js')).href); }
  catch (e) { dit(false, 'src/prixAuNumerotage.js se charge', e.message); }
  if (M) {
    console.log('\n── E. L’écriture d’un prix tapé');
    for (const v of ['', '   ', null, undefined]) {
      const w = M.ecriturePrixSaisi(v);
      dit(w.etat === 'vide' && w.patch === null, `E1 vide (${JSON.stringify(v)}) ⇒ rien n’est écrit`, JSON.stringify(w));
    }
    const ok25 = M.ecriturePrixSaisi('25');
    dit(ok25.etat === 'ok' && JSON.stringify(ok25.patch) === JSON.stringify({ buyPrice: '25,00', buyFromId: null, buyFrom: null }), 'E2 « 25 » ⇒ { buyPrice: "25,00", buyFromId: null, buyFrom: null } (un prix tapé n’est pas relié)', JSON.stringify(ok25));
    for (const [t, attendu] of [['12,5', '12,50'], ['12.5', '12,50'], ['25 €', '25,00'], ['1 200', '1200,00'], ['0', '0,00'], ['32,90', '32,90']]) {
      const w = M.ecriturePrixSaisi(t);
      dit(w.etat === 'ok' && w.patch.buyPrice === attendu, `E3 « ${t} » ⇒ ${attendu} (centimes exacts)`, JSON.stringify(w));
    }
    for (const t of ['25 € env.', '2x30', 'abc', '-5', '25,999', '25-30', 'environ 25']) {
      const w = M.ecriturePrixSaisi(t);
      dit(w.etat === 'illisible' && w.patch === null, `E4 « ${t} » ⇒ illisible, rien n’est écrit (jamais deviné)`, JSON.stringify(w));
    }
    dit(M.prixAchatSaisi('') === undefined && M.prixAchatSaisi('x') === null && M.prixAchatSaisi('7') === '7,00', 'E5 `prixAchatSaisi` : undefined vide · null illisible · le montant');

    console.log('\n── D. Quand le demander');
    dit(M.prixADemander({ numero: '12' }, null) === true, 'D1 numérotée, ni prix ni achat ⇒ on demande');
    dit(M.prixADemander({ numero: '12', buyPrice: '25,00' }, 25) === false, 'D2 prix saisi ⇒ on ne demande pas');
    dit(M.prixADemander({ numero: '12', buyPrice: '0' }, 0) === false, 'D3 « 0 » saisi (paire offerte) est un prix connu');
    dit(M.prixADemander({ numero: '12', buyFromId: '777' }, null) === false, 'D4 achat relié (même sans prix lu) ⇒ on ne demande pas');
    dit(M.prixADemander({ numero: '12' }, 30) === false, 'D5 prix connu par le miroir du N° ⇒ on ne demande pas');
    dit(M.prixADemander(null, null) === true && M.prixADemander({ buyFromId: '  ' }, null) === true, 'D6 fiche absente ou lien vide ⇒ on demande');
    const cinquante = Array.from({ length: 50 }, (_, i) => ({ numero: String(100 + i), title: 'Nike Air Max 90 blanche 42' }));
    const avant = JSON.stringify(cinquante);
    const dem = cinquante.map((e) => M.prixADemander(e, null));
    dit(dem.every(Boolean) && JSON.stringify(cinquante) === avant, 'D7 50 paires identiques : chacune jugée seule, aucune fiche modifiée');

    console.log('\n── P. La suggestion proposée');
    const p1 = M.suggestionNumerotage({ titre: 'Nike Air Max 90', proposition: { centimes: 3290, source: 'recu' }, lot: false, prixLu: 35 }, null);
    dit(p1 && String(p1.bouton).replace(/\u00a0/g, ' ') === 'Relier · 32,90 €' && /prix du reçu/.test(p1.detail), 'P1 « Relier · 32,90 € » (le prix du reçu), détail dit d’où vient le montant', JSON.stringify(p1));
    dit(p1 && Object.keys(p1).sort().join(',') === 'bouton,detail', 'P2 un bouton et une ligne — aucune valeur à mettre dans le champ', JSON.stringify(p1 && Object.keys(p1)));
    const p2 = M.suggestionNumerotage({ titre: 'Lot 3 paires', proposition: { centimes: 9000, source: 'achat' }, lot: true, prixLu: 90 }, null);
    dit(p2 && p2.bouton === 'Relier' && /lot/.test(p2.detail), 'P3 un LOT ⇒ « Relier » sans montant (le prix de CET article sera demandé)', JSON.stringify(p2));
    dit(M.suggestionNumerotage(null) === null, 'P4 pas de suggestion ⇒ rien');
    const srcM = fs.readFileSync(path.join(SRC, 'prixAuNumerotage.js'), 'utf8').replace(/\/\/.*$/gm, '');
    dit(!/fetch\(|localStorage|save\(|setNumeros|updatePair|parseFloat/.test(srcM), 'P5 le module n’écrit nulle part et ne lit aucun prix au parseFloat');
  }

  console.log('\n── S. Le branchement dans l’app');
  const APP = sansCommentaires(fs.readFileSync(path.join(SRC, 'App.jsx'), 'utf8'));
  const corps = (debut) => { const i = APP.indexOf(debut); if (i < 0) return ''; const j = APP.indexOf('\n  };', i); return APP.slice(i, j < 0 ? i + 4000 : j); };
  const ecr = corps('const ecrirePrixTape = (cible, texte, numero) => {');
  const iW = ecr.indexOf('ecriturePrixSaisi(texte)'), iRet = ecr.indexOf("if (w.etat !== 'ok') return w;"), iSet = Math.min(...['setNumeros', 'updatePair'].map((x) => { const k = ecr.indexOf(x); return k < 0 ? Infinity : k; }));
  dit(ecr && iW >= 0 && iRet > iW && iSet > iRet, 'S1 `ecrirePrixTape` : la règle d’abord, rien d’écrit si vide ou illisible', ecr.slice(0, 200));
  dit(/import \{[^}]*\bprixAchatSaisi\b[^}]*\} from "\.\/prixAuNumerotage\.js"/.test(APP) && !/const prixAchatSaisi = /.test(APP), 'S2 une seule lecture du prix tapé (`prixAchatSaisi` importée, plus de copie locale)');
  dit(/const setBuyForKey = \(key, val\) => \{ ecrirePrixTape\(key, val\); \};/.test(APP), 'S3 la saisie en série écrit par `ecrirePrixTape`');
  const dem = corps('const demanderPrixAchat = async (item, numeroPose) => {');
  dit(/prixADemander\(effEntry\(item\), buyOf\(item\)\)/.test(dem) && /const w = ecrirePrixTape\(item, rep, numeroPose\);/.test(dem) && !/parseFloat/.test(dem), 'S4 la feuille du numérotage : `prixADemander`, puis la MÊME écriture (plus de parseFloat)', dem.slice(0, 160));
  dit(/value: '', placeholder: 'ex : 25 ou 12,50', decimal: true,/.test(dem) && /cancel: 'Plus tard'/.test(dem), 'S5 la feuille n’est jamais pré-remplie ; « Plus tard » n’écrit rien');
  dit(/suggestion: sugg \? sugg\.aff : null/.test(dem) && /if \(rep\.relier && sugg\) await relierAchatAnnonce\(item, sugg\.achat\);/.test(dem) && /meilleureSuggestion\(/.test(dem), 'S6 une suggestion est PROPOSÉE (« Relier · … ») et SON tap relie par `relierAchatAnnonce`');
  const nDem = (APP.match(/await demanderPrixAchat\(item, /g) || []).length;
  dit(nDem >= 4, `S7 chaque N° posé à la main (libre, déjà servi, pris ⇒ suivant, « non — N° neuf ») demande le prix (${nDem} appels)`);
  dit(/const saisirPrixAnnonce = async \(it\) => \{[\s\S]{0,400}ecrirePrixTape\(it, t\);/.test(APP), 'S8 « Saisir » (file Sans achat relié) : la même écriture');
  dit(/<EnLigne data="achat" value=\{buy\} onCommit=\{v=>String\(v\?\?''\)\.trim\(\) \? ecrirePrixTape\(item, v\)/.test(APP) && !/onCommit=\{v=>updatePair\(item,\{buyPrice:v,/.test(APP), 'S9 le champ « achat » de la carte : la même écriture (le vider retire le prix, comme avant)');
  const bn = corps('const blocNouveaux = () =>');
  dit(/<ChampSaisie value="" data-prix-neuf=\{String\(it\.id\)\} onCommit=\{\(v\) => ecrirePrixTape\(it, v, f\.numero\)\}/.test(bn) && /prixADemander\(f, prixAchatDe\(f, buyByNum\)\)/.test(bn), 'S10 « mise en ligne numérotée par VRM » : un champ prix vide par ligne, la même écriture');
  dit(/onClick=\{\(\) => relierAchatAnnonce\(it, sg\.achat\)\}/.test(bn) && /meilleureSuggestion\(\{ item: it, achats: fillBuyAchats\.items/.test(bn), 'S11 … et la suggestion y est proposée, SON tap relie');
  dit(!/useEffect\([^;]*ecrirePrixTape/.test(APP) && !/useEffect\([^\n]*setBuyForKey/.test(APP), 'S12 aucun effet n’écrit un prix (rien sans son geste)');
  // (11 nov., traduction) La phrase vit dans src/i18n/langues/fr.js (pluriel « une ¦ plusieurs ») : la carte l'appelle par sa clé.
  const FRD = fs.readFileSync(path.join(R, 'src', 'i18n', 'langues', 'fr', 'journee.js'), 'utf8');
  const clesPrix = [...FRD.matchAll(/^\s*"([\w.-]+)": [^\n]*prix d’achat/gm)].map((m) => m[1]);
  const jobsPrix = (APP.match(/jobs\.push\(\{ id: '[^']+'[^\n]*/g) || []).filter((j) => /prix d’achat/.test(j) || clesPrix.some((k) => j.includes(`tr('${k}'`)));
  const phrasePrix = (j) => /numérotée\$\{nR > 1 \? 's' : ''\} sans prix d’achat/.test(j) || (/tr\('journee\.annoncesNumeroteesSans', \{ n: String\(nR\) \}\)/.test(j) && /"journee\.annoncesNumeroteesSans": \{ one: "\{n\} annonce numérotée sans prix d’achat", other: "\{n\} annonces numérotées sans prix d’achat" \}/.test(FRD));
  dit(jobsPrix.length === 1 && /id: 'achat-a-relier'/.test(jobsPrix[0]) && phrasePrix(jobsPrix[0]), 'S13 Ma journée : UNE carte (« N annonces numérotées sans prix d’achat »), fusionnée avec « Sans achat relié »', JSON.stringify(jobsPrix.map((x) => x.slice(0, 80))));
  dit(/onSerie=\{\(\)=>setFillBuyOpen\(true\)\}/.test(APP) && /data-ar-serie=""/.test(APP), 'S14 la file porte « Saisie en série » (la porte du chiffre faux)');

  console.log(`\n${ok} contrôle(s) OK, ${ko} en échec`);
  process.exit(ko ? 1 : 0);
})();
