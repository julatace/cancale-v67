#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — LE STOCK EN MEUBLES ET LA MÉTHODE D'ÉTIQUETAGE (19 nov. 2026, lot stock-etiquetage)
//  Récit : docs/passation/2026-11-19-stock-etiquetage.md. Données INVENTÉES (dépôt public).
//
//  EXÉCUTE la règle (src/etiquetage/methode.js, src/etiquetage/impression.js) et LIT le code (commentaires retirés) :
//    E · la méthode n'écrit QUE ses trois clés (`vrm_numero_ecrit`, `vrm_num_prefixe`, `vrm_etiquetage`), seulement ce
//        qui CHANGE ; jamais un numéro, jamais le pool ni les cases ; la lettre des anciens N° (archive 013) est
//        REFUSÉE (rien écrit) ; « je numérote moi-même » = le réglage de l'extension (`vrm_numero_ecrit.actif`, 5.382) ;
//    I · une étiquette imprimée porte le N° TEL QU'IL EST (aucun N° calculé), aucun QR (refusé le 11 oct.), un N° vide écarté ;
//    S · les écrans du lot (src/stockV2/StockV2.jsx, MeubleDessin.jsx, src/etiquetage/EtiquetageReglage.jsx) n'écrivent
//        AUCUN numéro : le Stock ne range que par `s.poser` (le chemin existant : lire-fusionner-réécrire `vrm_slots`,
//        la case prise DEMANDE) ; Paramètres filtre les écritures sur `CLES_METHODE` ;
//    A · on range un ARTICLE, jamais un achat : la séance ne reçoit que des clés de `aRanger` (les annonces actuelles,
//        src/ecrans/Stock.jsx) ; une rangée « Ranger » et « Ranger maintenant » sont gardées par `peutRanger` ;
//        la case proposée vient de src/ouRanger.js (aucune règle de case dans la vue) ;
//    C · Ma configuration (src/configurationDepart.js, étape « numero ») passe par la même règle.
//  `--mutation` (§6.1) : chaque mutation, une à la fois sur une copie, doit rendre l'audit ROUGE.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');
const { pathToFileURL } = require('url');
const RACINE = path.join(__dirname, '..');
const sansCommentaires = (t) => String(t || '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

// Les fichiers jugés (copiables dans un arbre temporaire pour les mutations).
const FICHIERS = ['src/etiquetage/methode.js', 'src/etiquetage/impression.js', 'src/stockV2/StockV2.jsx', 'src/stockV2/MeubleDessin.jsx',
  'src/etiquetage/EtiquetageReglage.jsx', 'src/ecrans/Reglages.jsx', 'src/ecrans/Stock.jsx', 'src/configurationDepart.js'];
const INTERDITES = /annonce_numeros|num_pool|used_numeros|numeros_pool|vrm_slots|vrm_meubles|vinted_pairs_lost/;

async function juger(racine) {
  const res = [];
  const dit = (ok, m, d) => res.push({ ok: !!ok, m, d: d == null ? '' : (typeof d === 'string' ? d : JSON.stringify(d)) });
  const lire = (f) => { try { return fs.readFileSync(path.join(racine, f), 'utf8'); } catch (_) { return ''; } };
  // ── E · la règle, exécutée ─────────────────────────────────────────────────
  let M = null, I = null;
  try { M = await import(pathToFileURL(path.join(racine, 'src/etiquetage/methode.js')).href + '?t=' + Date.now()); } catch (e) { dit(false, 'E0 · src/etiquetage/methode.js se charge', e.message); }
  try { I = await import(pathToFileURL(path.join(racine, 'src/etiquetage/impression.js')).href + '?t=' + Date.now()); } catch (e) { dit(false, 'I0 · src/etiquetage/impression.js se charge', e.message); }
  if (M) {
    const AT = '2026-11-19T10:00:00.000Z';
    const NE = { actif: false, depuis: '2026-11-07T00:00:00Z', choisi: '2026-11-07T00:00:00Z', ou: ['description'] };
    const avant = { numeroEcrit: NE, prefixe: '', etiquetage: null };
    // E1 : chaque combinaison de choix n'écrit QUE les clés de la méthode, jamais une clé de numéros.
    const choix = [];
    for (const qui of [undefined, 'vrm', 'moi']) for (const serie of [undefined, 'chiffres', 'lettre']) for (const lettre of ['', 'C', 'B', 'zz9']) for (const support of [undefined, 'main', 'imprimee']) for (const format of [undefined, '50x30', 'a4-24', 'x']) choix.push({ qui, serie, lettre, support, format });
    const toutes = choix.flatMap((c) => M.ecrituresMethode(avant, c, { archive: 'B', at: AT }).ecritures);
    const cles = [...new Set(toutes.map((w) => w.cle))].sort();
    dit(toutes.length > 0 && cles.every((k) => M.CLES_METHODE.includes(k)) && !toutes.some((w) => INTERDITES.test(w.cle) || INTERDITES.test(JSON.stringify(w.valeur))),
      `E1 · ${choix.length} choix : seules ${M.CLES_METHODE.join(', ')} sont écrites, jamais un numéro, le pool ni une case`, cles);
    // E2 : rien ne change ⇒ rien n'est écrit.
    const rien = M.ecrituresMethode({ numeroEcrit: NE, prefixe: 'C', etiquetage: { support: 'main', format: '50x30', titre: false } }, { qui: 'vrm', serie: 'lettre', lettre: 'C', support: 'main', format: '50x30', titre: false }, { archive: 'B', at: AT });
    dit(rien.ecritures.length === 0 && rien.refus === null, 'E2 · le même choix qu’enregistré n’écrit RIEN', rien);
    // E3 : la lettre des anciens numéros est refusée, rien n'est écrit pour la série.
    const arch = M.ecrituresMethode(avant, { serie: 'lettre', lettre: 'b' }, { archive: 'B', at: AT });
    dit(arch.refus === 'archive' && !arch.ecritures.some((w) => w.cle === M.CLE_PREFIXE), 'E3 · « B » (lettre des anciens N°, migration 013) refusée : aucune série écrite', arch);
    const vide = M.ecrituresMethode(avant, { serie: 'lettre', lettre: '' }, { archive: 'B', at: AT });
    dit(vide.refus === 'lettreVide' && vide.ecritures.length === 0, 'E3 · « Avec une lettre » sans lettre tapée n’enregistre rien', vide);
    const c = M.ecrituresMethode(avant, { serie: 'lettre', lettre: 'c' }, { archive: 'B', at: AT });
    dit(c.ecritures.length === 1 && c.ecritures[0].cle === 'vrm_num_prefixe' && c.ecritures[0].valeur === 'C', 'E3 · une autre lettre (« c » ⇒ « C ») s’écrit dans vrm_num_prefixe seulement', c.ecritures);
    // E4 : « je numérote moi-même » = `vrm_numero_ecrit.actif` (le réglage lu par l'extension 5.382), endroits gardés.
    const moi = M.ecrituresMethode(avant, { qui: 'moi' }, { at: AT });
    const w = moi.ecritures[0] || {};
    dit(moi.ecritures.length === 1 && w.cle === 'vrm_numero_ecrit' && w.valeur.actif === true && JSON.stringify(w.valeur.ou) === '["description"]' && w.valeur.depuis === AT && w.valeur.choisi === NE.choisi,
      'E4 · « Je numérote moi-même » ⇒ vrm_numero_ecrit allumé, ses endroits gardés, la date du changement', w);
    const neuf = M.ecrituresMethode({}, { qui: 'vrm' }, { at: AT });
    dit(neuf.ecritures.length === 1 && neuf.ecritures[0].valeur.actif === false && M.methodeDe({}).qui === null, 'E4 · un compte neuf n’a rien de choisi (null) ; « VRM numérote » l’écrit éteint', neuf.ecritures);
    // E5 : l'étiquette.
    const imp = M.ecrituresMethode(avant, { support: 'imprimee', format: 'a4-24' }, { at: AT });
    dit(imp.ecritures.length === 1 && imp.ecritures[0].cle === 'vrm_etiquetage' && imp.ecritures[0].valeur.support === 'imprimee' && imp.ecritures[0].valeur.format === 'a4-24', 'E5 · « Imprimée », planche A4 ⇒ vrm_etiquetage', imp.ecritures);
    dit(M.lireEtiquetage({ support: 'laser', format: '??' }).support === null && M.lireEtiquetage(null).format === M.FORMAT_DEFAUT, 'E5 · une valeur inconnue se lit « pas choisie », jamais devinée');
  }
  // ── I · l'impression ───────────────────────────────────────────────────────
  if (I) {
    const h = I.pageEtiquettes([{ num: '125', titre: 'Nike <b>' }, { num: ' ' }, { num: 'C12' }], { format: 'a4-24', titre: true });
    const nums = [...h.matchAll(/data-etiquette-num="([^"]*)"/g)].map((x) => x[1]);
    dit(nums.join() === '125,C12' && /N°125/.test(h) && /N°C12/.test(h) && !/<b>/.test(h.replace(/<b>N°/g, '')) && !/qr/i.test(h), 'I1 · une étiquette par N° TEL QU’IL EST, N° vide écarté, titre échappé, aucun QR', nums);
  }
  // ── S · les écrans n'écrivent aucun numéro ─────────────────────────────────
  const sv = sansCommentaires(lire('src/stockV2/StockV2.jsx')), md = sansCommentaires(lire('src/stockV2/MeubleDessin.jsx')), er = sansCommentaires(lire('src/etiquetage/EtiquetageReglage.jsx'));
  const ecritsLs = [...(sv + md + er).matchAll(/localStorage\.setItem\(\s*['"]([^'"]+)['"]/g)].map((x) => x[1]);
  dit(!/\bsave\s*\(/.test(sv + md + er) && ecritsLs.every((k) => k === 'vrm_stock_v2_vue') && !INTERDITES.test(sv + md + er), 'S1 · le Stock, le meuble dessiné et le réglage n’écrivent rien eux-mêmes (sauf la vue choisie de l’appareil)', ecritsLs);
  dit(/await s\.poser\(cle, mid, i, \{ muet: true \}\)/.test(sv) && !/s\.setSlots|ecrireSlots/.test(sv), 'S2 · une pose passe par `s.poser` (le chemin existant : lire-fusionner-réécrire, case prise ⇒ il demande)');
  const rg = sansCommentaires(lire('src/ecrans/Reglages.jsx'));
  const m = /const ecrireMethode = \(ecritures\) => Promise\.all\(\(ecritures \|\| \[\]\)\.filter\(\(w\) => CLES_METHODE\.includes\(w\.cle\)\)/.exec(rg);
  dit(!!m && /ecrire=\{ecrireMethode\}/.test(rg), 'S3 · Paramètres → Méthode d’étiquetage n’écrit que CLES_METHODE (un filtre, avant toute écriture)');
  const cfg = sansCommentaires(lire('src/configurationDepart.js'));
  dit(/ecrituresMethode\(\{ prefixe: lus\.prefixe, etiquetage: lus\.etiquetage \}/.test(cfg) && !/qui:/.test((/const m = ecrituresMethode\(([\s\S]*?)\}, \{ archive/.exec(cfg) || [])[1] || 'qui:'), 'C1 · Ma configuration écrit la série et l’étiquette par la MÊME règle (qui numérote reste `vrm_numero_ecrit`, inchangé)');
  // ── A · un article, jamais un achat ─────────────────────────────────────────
  const st = sansCommentaires(lire('src/ecrans/Stock.jsx'));
  dit(/const aRanger = unParArticle\(fiches\.filter\(\(f\) => \(\(f\.actuelle && f\.etatAnnonce === 'enligne'\) \|\| f\.remise\)/.test(st) && /peutRanger: \(k\) => aRanger\.some\(/.test(st),
    'A1 · « à ranger » = les annonces actuelles (et les paires remises) ; `peutRanger` = appartenir à cette liste');
  dit(/const peut = s\.peutRanger\(l\.cle\);/.test(sv) && /onClick=\{\(\) => \(peut \? rangerA\(l\.cle\) : ouvrirFiche\(l\)\)\}/.test(sv) && /!ou && !vendue && s\.peutRanger\(k\) \?/.test(sv),
    'A2 · « Ranger » d’une rangée et « Ranger maintenant » sont gardés par `peutRanger` (un achat n’y est jamais)');
  dit(/const aRangerCles = s\.aRanger\.map\(s\.cleDe\)/.test(sv) && /s\.caseProposee\(cle, meubleChoisi \|\| derniere\)/.test(sv) && !/casesProposees|premiereCaseLibre|caseLibreDans/.test(sv + md),
    'A3 · la séance range la file de `aRanger` ; la case proposée vient de src/ouRanger.js par l’écran (aucune règle de case dans la vue)');
  dit(/caseProposee: \(cle, derniere\) => \(derniere \? caseLibreDans\(/.test(st), 'A3 · `caseProposee` du Stock = `caseLibreDans` puis `premiereCaseLibre` (src/ouRanger.js)');
  return res;
}

const MUTATIONS = [
  ['M1 la lettre des anciens N° acceptée', 'src/etiquetage/methode.js', "else if (voulue && arch && voulue === arch) refus = 'archive';", "else if (false) refus = 'archive';"],
  ['M2 la méthode écrit un numéro', 'src/etiquetage/methode.js', "  return { ecritures: out, refus };\n}", "  if (support) out.push({ cle: 'vinted_annonce_numeros', valeur: {} });\n  return { ecritures: out, refus };\n}"],
  ['M3 rien ne change mais la série est réécrite', 'src/etiquetage/methode.js', 'else if (voulue !== m.lettre) out.push', 'else out.push'],
  ['M4 Paramètres sans filtre des clés', 'src/ecrans/Reglages.jsx', '.filter((w) => CLES_METHODE.includes(w.cle))', ''],
  ['M5 une rangée range sans `peutRanger`', 'src/stockV2/StockV2.jsx', 'const peut = s.peutRanger(l.cle);', 'const peut = true;'],
  ['M6 la vue choisit sa case elle-même', 'src/stockV2/StockV2.jsx', 's.caseProposee(cle, meubleChoisi || derniere)', 'premiereCaseLibre({ meubles: s.meubles, slots: {} })'],
  ['M7 le Stock écrit les cases lui-même', 'src/stockV2/StockV2.jsx', 'try { ok = await s.poser(cle, mid, i, { muet: true }); }', "try { save('vrm_slots', {}); ok = true; }"],
  ['M8 un QR sur l’étiquette', 'src/etiquetage/impression.js', '<b>N°${esc(String(e.num).trim())}</b>', '<b>N°${esc(String(e.num).trim())}</b><i class="qr"></i>'],
];

(async () => {
  const res = await juger(RACINE);
  let rouges = 0;
  for (const r of res) { if (!r.ok) rouges++; console.log(`${r.ok ? '✅' : '❌'} ${r.m}${r.d && !r.ok ? ' — ' + r.d : ''}`); }
  console.log(`\n${rouges ? '❌' : '✅'} audit-stock-etiquetage : ${res.length - rouges} vert(s), ${rouges} rouge(s)`);
  if (process.argv.includes('--mutation') || process.argv.includes('--prouve')) {
    let tenues = 0;
    for (const [nom, f, de, vers] of MUTATIONS) {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mut-etiq-'));
      for (const x of FICHIERS) { fs.mkdirSync(path.dirname(path.join(tmp, x)), { recursive: true }); fs.copyFileSync(path.join(RACINE, x), path.join(tmp, x)); }
      const p = path.join(tmp, f); const t = fs.readFileSync(p, 'utf8');
      if (!t.includes(de)) { console.log(`❌ ${nom} : le texte à muter n'existe plus`); rouges++; fs.rmSync(tmp, { recursive: true, force: true }); continue; }
      fs.writeFileSync(p, t.replace(de, vers));
      const r = await juger(tmp);
      const ko = r.filter((x) => !x.ok).map((x) => x.m.split(' · ')[0]);
      if (ko.length) { tenues++; console.log(`✅ ${nom} ⇒ rouge (${[...new Set(ko)].join(', ')})`); } else { rouges++; console.log(`❌ ${nom} ⇒ resté VERT`); }
      fs.rmSync(tmp, { recursive: true, force: true });
    }
    console.log(`\n${tenues === MUTATIONS.length ? '✅' : '❌'} mutations : ${tenues}/${MUTATIONS.length} rougissent l'audit`);
  }
  process.exit(rouges ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
