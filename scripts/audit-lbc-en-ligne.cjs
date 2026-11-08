#!/usr/bin/env node
// ── audit-lbc-en-ligne — « EN LIGNE » SUR LEBONCOIN = LA RÈGLE DE VINTED (6 nov.) ──
// Julien : « les annonces qui sont captées ne sont plus en ligne, il faut
// absolument que tu améliores ça ». Mesuré chez lui (lecture seule) : 8 annonces
// dites « Actives », aucune lecture complète de « Mes annonces » jamais rangée,
// la dernière capture vieille de 7 jours.
// Exécute la VRAIE règle (src/enLigneLbc.js), avec la VRAIE règle partagée
// `<lbc-en-vente-regle>` extraite d'App.jsx, sur des données INVENTÉES :
//   · 50 annonces au MÊME titre, un compte : une absente de la dernière lecture
//     complète (ses `ids`, ou sa marque `plusVueAt` posée par l'extension) ⇒
//     plus en ligne ; les 49 autres en ligne ; le titre ne décide jamais ;
//   · une lecture PARTIELLE (n < total) ne retire rien et ne rafraîchit rien ;
//   · une lecture de plus de 24 h ⇒ « à confirmer » (aucune retirée, aucune
//     comptée) ; jamais lue ⇒ « à confirmer » ;
//   · revue APRÈS la lecture (publiée depuis) ⇒ pas « absente » ;
//   · vendue (preuve) ⇒ sortie, même `status: active` ;
//   · deux comptes : la lecture de l'un ne juge pas l'autre.
// Et ce que l'écran en fait (règles PURES exécutées, présentes aussi dans
// l'arbre d'avant — c'est là qu'il rougit) :
//   · `etatAnnonceLeboncoin(ad, …, aConfirmerDe)` ⇒ « À confirmer », pas « Active » ;
//   · le Stock (`annoncesActuelles`) : une annonce Leboncoin à confirmer n'est
//     pas comptée en ligne, son site est NOMMÉ ;
//   · App.jsx : le compteur de l'écran Leboncoin, le catalogue et
//     `lireLbcEnVente` (Stock) passent par la règle.
//   node scripts/audit-lbc-en-ligne.cjs                 la règle du dépôt
//   node scripts/audit-lbc-en-ligne.cjs --mutation=NOM  une règle réaffaiblie
//   node scripts/audit-lbc-en-ligne.cjs --prouve        toutes les mutations : chacune doit rougir
//   RACINE=<arbre> node …                               juger un autre arbre (l'arbre d'avant)
'use strict';
require('./_source-app.cjs').brancher(); // (8 nov.) App.jsx découpé : sa lecture texte rend aussi src/ecrans/*.jsx
const fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const RACINE = process.env.RACINE || path.join(__dirname, '..');
const REGLE = path.join(RACINE, 'src', 'enLigneLbc.js');
const APP = path.join(RACINE, 'src', 'App.jsx');

// [fichier relatif, ancre, remplacement]
const MUTATIONS = {
  // La fraîcheur n'est plus jugée : une lecture vieille d'une semaine fait foi.
  'sans-24h': ['src/enLigneLbc.js', "  if (!(Number(maintenant) - L.at <= LBC_FRAIS_MS)) return { etat: 'aconfirmer', compte, lu: L.at, raison: 'vieille' };\n", ''],
  // Jamais lue = en ligne (le dernier `status` capté fait foi : le défaut mesuré).
  'jamais-en-ligne': ['src/enLigneLbc.js', "  if (!L) return { etat: 'aconfirmer', compte, lu: null, raison: 'jamais' };", "  if (!L) return { etat: 'enligne', compte, lu: null, raison: null };"],
  // L'absence d'une lecture complète ne retire plus rien.
  'absence-ignoree': ['src/enLigneLbc.js', "  if (L.ids && !L.ids.has(String(ad.id)) && !revueApres) return { etat: 'sortie', compte, lu: L.at, raison: 'absente' };\n", ''],
  // Une lecture partielle compte comme complète.
  'partielle-complete': ['src/enLigneLbc.js', "    if (Number.isFinite(total) && Number.isFinite(n) && n < total) continue;\n", ''],
  // La donnée la plus récente ne gagne plus : une annonce publiée après la lecture est dite absente.
  'revue-apres-ignoree': ['src/enLigneLbc.js', "const revueApres = Number.isFinite(vu) && vu > L.at;", "const revueApres = false;"],
  // La règle partagée (vente, plus vue, pause) n'est plus consultée.
  'sans-regle-partagee': ['src/enLigneLbc.js', "  if (typeof enVente !== 'function' || !enVente(ad)) return { etat: 'sortie', compte, lu: null, raison: 'regle' };\n", ''],
  // La lecture d'un compte juge les annonces d'un autre.
  'tous-comptes': ['src/enLigneLbc.js', "  for (const k of [id, 'lbc-account:' + id]) {\n    const l = lectures[k];", "  for (const k of Object.keys(lectures)) {\n    const l = lectures[k];"],
  // Le catalogue ne dit plus « À confirmer ».
  'catalogue-actif': ['src/etatAnnonceLeboncoin.js', " if (etat==='active' && typeof aConfirmerDe==='function' && aConfirmerDe(ad)) {etat='aconfirmer';label='À confirmer';}\n", ''],
  // Le Stock compte une annonce Leboncoin à confirmer comme en ligne.
  'stock-en-ligne': ['src/stockAnnonces.js', "const etat = a && a.etat === 'aconfirmer' ? 'aconfirmer' : 'enligne';", "const etat = 'enligne';"],
};

const arg = (k) => { const a = process.argv.find((x) => x.startsWith(k + '=')); return a ? a.slice(k.length + 1) : null; };

if (process.argv.includes('--prouve')) {
  let tous = true;
  for (const nom of Object.keys(MUTATIONS)) {
    const r = spawnSync(process.execPath, [__filename, `--mutation=${nom}`], { encoding: 'utf8', env: process.env });
    const rouge = r.status !== 0;
    console.log(`${rouge ? '✅ rougit' : '❌ reste vert'} — mutation ${nom}${rouge ? '' : ' (le contrôle ne la voit pas)'}`);
    if (!rouge) tous = false;
  }
  process.exit(tous ? 0 : 1);
}

let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('✅ ' + m); } else { ko++; console.log('❌ ' + m + (d !== undefined ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 300) : '')); } };

// Une copie de l'arbre des fichiers jugés (mutée si demandé).
const mut = arg('--mutation');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-lbc-en-ligne-'));
fs.mkdirSync(path.join(tmp, 'src'), { recursive: true });
fs.mkdirSync(path.join(tmp, 'api', '_lib'), { recursive: true });
fs.writeFileSync(path.join(tmp, 'package.json'), '{"type":"module"}');
for (const f of ['src/enLigneLbc.js', 'src/etatAnnonceLeboncoin.js', 'src/stockAnnonces.js']) {
  const src = path.join(RACINE, f);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(tmp, f));
}
// Le Stock importe les règles du serveur (api/_lib) : copiées telles quelles.
fs.cpSync(path.join(RACINE, 'api', '_lib'), path.join(tmp, 'api', '_lib'), { recursive: true });
if (mut) {
  const M = MUTATIONS[mut]; if (!M) { console.log('mutation inconnue : ' + mut); process.exit(2); }
  const p = path.join(tmp, M[0]); const s = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
  if (!s.includes(M[1])) { console.log('❌ ancre de mutation introuvable : ' + mut); process.exit(3); }
  fs.writeFileSync(p, s.replace(M[1], M[2]));
  console.log('── mutation : ' + mut);
}

const APPSRC = fs.readFileSync(APP, 'utf8');
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

(async () => {
  const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' : a levé', String(e && e.message || e).split('\n')[0]); } };
  // La règle partagée de l'app (<lbc-en-vente-regle>), exécutée telle quelle.
  const bloc = (/\/\/ <lbc-en-vente-regle>[\s\S]*?\/\/ <\/lbc-en-vente-regle>/.exec(APPSRC) || [])[0];
  dit(!!bloc, 'la règle partagée <lbc-en-vente-regle> est dans App.jsx');
  const c = {}; vm.createContext(c); vm.runInContext((bloc || '') + '\n;this.enVente=typeof annonceLbcEnVente==="function"?annonceLbcEnVente:null;this.vendues=typeof annoncesLbcVendues==="function"?annoncesLbcVendues:null;', c);

  const MAINT = Date.parse('2026-11-06T12:00:00Z');
  const H = 3600e3;
  const iso = (t) => new Date(t).toISOString();
  const CPT = '8442c3e8-0000-4000-8000-000000000001', CPT2 = 'faf3fbba-0000-4000-8000-000000000002';
  const mk = (i, o = {}) => Object.assign({ id: String(3300000000 + i), subject: 'Nike Air Max 90 blanc taille 42', status: 'active', account: 'lbc-account:' + CPT, ref: String(i), seenAt: iso(MAINT - 10 * 24 * H) }, o);
  const ads50 = Array.from({ length: 50 }, (_, i) => mk(i + 1));
  const ids49 = ads50.slice(0, 49).map((a) => a.id);
  const ABS = ads50[49].id;

  let R = null;
  await essaie('import de la règle', async () => { R = await import(pathToFileURL(path.join(tmp, 'src/enLigneLbc.js')).href); });
  if (!R || typeof R.bilanEnLigneLbc !== 'function') {
    dit(false, 'src/enLigneLbc.js : la règle « en ligne » de Leboncoin existe (bilanEnLigneLbc)');
  } else {
    const vd = c.vendues ? c.vendues({}) : new Set();
    const ctx = (lectures, extra = {}) => Object.assign({ enVente: (ad) => !!(c.enVente && c.enVente(ad, vd)), lectures, maintenant: MAINT }, extra);

    console.log('\n── 1. 50 ANNONCES AU MÊME TITRE : L’ABSENTE DE LA DERNIÈRE LECTURE COMPLÈTE SORT');
    {
      const b = R.bilanEnLigneLbc(ads50, ctx({ [CPT]: { at: iso(MAINT - 2 * H), total: 49, n: 49, ids: ids49 } }));
      dit(b.enLigne.length === 49 && b.sorties.length === 1 && b.sorties[0].id === ABS && b.aConfirmer.length === 0, 'lecture fraîche avec ses ids : 49 en ligne, l’absente sortie (par son identifiant, jamais le titre)', { en: b.enLigne.length, so: b.sorties.map((a) => a.id), ac: b.aConfirmer.length });
      // Sans ids : l'extension a posé `plusVueAt` sur l'absente (noterListeLbcComplete).
      const marques = ads50.map((a) => (a.id === ABS ? Object.assign({}, a, { plusVueAt: iso(MAINT - 2 * H) }) : a));
      const b2 = R.bilanEnLigneLbc(marques, ctx({ [CPT]: { at: iso(MAINT - 2 * H), total: 49, n: 49 } }));
      dit(b2.enLigne.length === 49 && b2.sorties.length === 1 && b2.sorties[0].id === ABS, 'lecture fraîche sans ids : l’absente marquée « plus vue » par l’extension sort, les 49 restent', { en: b2.enLigne.length, so: b2.sorties.map((a) => a.id) });
      // Une annonce publiée APRÈS la lecture n'est pas « absente » : la donnée la plus récente gagne.
      const neuve = mk(77, { seenAt: iso(MAINT - 1 * H) });
      const b3 = R.bilanEnLigneLbc([...ads50.slice(0, 49), neuve], ctx({ [CPT]: { at: iso(MAINT - 2 * H), total: 49, n: 49, ids: ids49 } }));
      dit(b3.enLigne.some((a) => a.id === neuve.id), 'revue APRÈS la lecture complète (publiée depuis) ⇒ en ligne, pas « absente »');
      // Vendue (preuve) ⇒ sortie, même `status: active`.
      const vd2 = c.vendues ? c.vendues({ t1: { isSeller: true, itemId: ads50[3].id, stepStatus: 'validation' } }) : new Set();
      const b4 = R.bilanEnLigneLbc(ads50.slice(0, 49), Object.assign(ctx({ [CPT]: { at: iso(MAINT - 2 * H), total: 49, n: 49, ids: ids49 } }), { enVente: (ad) => !!(c.enVente && c.enVente(ad, vd2)) }));
      dit(b4.sorties.length === 1 && b4.sorties[0].id === ads50[3].id && b4.enLigne.length === 48, 'vendue (preuve de la vente) ⇒ sortie, même `status: active` ; ses 48 jumelles de titre restent', { so: b4.sorties.map((a) => a.id), en: b4.enLigne.length });
    }

    console.log('\n── 2. UNE LECTURE PARTIELLE NE RETIRE RIEN');
    {
      const partielle = { [CPT]: { at: iso(MAINT - 1 * H), total: 50, n: 20, ids: ids49.slice(0, 20) } };
      const b = R.bilanEnLigneLbc(ads50, ctx(partielle));
      dit(b.sorties.length === 0, 'lecture partielle (20 sur 50) : aucune annonce sortie', { so: b.sorties.length });
      dit(b.enLigne.length === 0 && b.aConfirmer.length === 50, 'lecture partielle : elle ne rafraîchit rien non plus (jamais lue en entier ⇒ 50 à confirmer)', { en: b.enLigne.length, ac: b.aConfirmer.length });
      const deux = { [CPT]: { at: iso(MAINT - 30 * H), total: 50, n: 50, ids: ads50.map((a) => a.id) }, ['lbc-account:' + CPT]: { at: iso(MAINT - 1 * H), total: 50, n: 3, ids: ids49.slice(0, 3) } };
      const b2 = R.bilanEnLigneLbc(ads50, ctx(deux));
      dit(b2.sorties.length === 0 && b2.aConfirmer.length === 50, 'une lecture partielle plus récente ne remplace pas la complète (vieille ⇒ toutes à confirmer, aucune retirée)', { so: b2.sorties.length, ac: b2.aConfirmer.length });
    }

    console.log('\n── 3. UNE LECTURE DE PLUS DE 24 H, OU JAMAIS FAITE ⇒ « À CONFIRMER »');
    {
      const vieille = { [CPT]: { at: iso(MAINT - 7 * 24 * H), total: 49, n: 49, ids: ids49 } };
      const b = R.bilanEnLigneLbc(ads50.slice(0, 49), ctx(vieille));
      dit(b.enLigne.length === 0 && b.aConfirmer.length === 49 && b.sorties.length === 0, 'lecture de 7 j : 49 à confirmer, aucune comptée en ligne, aucune retirée', { en: b.enLigne.length, ac: b.aConfirmer.length, so: b.sorties.length });
      dit(b.comptes.length === 1 && b.comptes[0].lu === MAINT - 7 * 24 * H && b.comptes[0].n === 49, 'le compte à confirmer est nommé, avec la date de sa dernière lecture complète', b.comptes);
      const b2 = R.bilanEnLigneLbc(ads50.slice(0, 5), ctx(null));
      dit(b2.aConfirmer.length === 5 && b2.enLigne.length === 0 && b2.comptes[0] && b2.comptes[0].lu === null, 'jamais lue en entier ⇒ à confirmer (« pas su » ne vaut pas « oui »)', { ac: b2.aConfirmer.length, c: b2.comptes });
      const b3 = R.bilanEnLigneLbc(ads50.slice(0, 5), ctx({ [CPT]: { at: iso(MAINT - 23 * H), total: 5, n: 5 } }));
      dit(b3.enLigne.length === 5, 'lecture de 23 h : en ligne');
      dit(R.quandLectureLbc(null, MAINT) === 'jamais lue en entier' && /il y a 7 j$/.test(R.quandLectureLbc(MAINT - 7 * 24 * H, MAINT)), 'la phrase vient de la même date (« jamais lue en entier », « lue en entier il y a 7 j »)');
    }

    console.log('\n── 4. DEUX COMPTES : LA LECTURE DE L’UN NE JUGE PAS L’AUTRE');
    {
      const autre = mk(90, { account: CPT2 });
      const b = R.bilanEnLigneLbc([...ads50.slice(0, 49), autre], ctx({ [CPT]: { at: iso(MAINT - 2 * H), total: 49, n: 49, ids: ids49 } }));
      dit(b.aConfirmer.length === 1 && b.aConfirmer[0].id === autre.id && b.enLigne.length === 49, 'l’annonce du second compte (jamais lu) est à confirmer — jamais « absente » de la liste du premier', { ac: b.aConfirmer.map((a) => a.id), en: b.enLigne.length });
    }
  }

  console.log('\n── 5. CE QUE L’ÉCRAN EN FAIT (règles pures, présentes aussi dans l’arbre d’avant)');
  await essaie('catalogue', async () => {
    const E = await import(pathToFileURL(path.join(tmp, 'src/etatAnnonceLeboncoin.js')).href);
    const r = E.etatAnnonceLeboncoin({ id: '1', status: 'active' }, [], null, () => true);
    dit(r.etat === 'aconfirmer' && r.label === 'À confirmer', 'catalogue « Mes annonces » : une annonce que la règle ne confirme pas est « À confirmer », pas « Active »', r);
    const r2 = E.etatAnnonceLeboncoin({ id: '1', status: 'active' }, [], null, () => false);
    dit(r2.etat === 'active', 'catalogue : confirmée ⇒ « Active »', r2);
    const r3 = E.etatAnnonceLeboncoin({ id: '1', status: 'deleted' }, [], null, () => true);
    dit(r3.etat === 'retiree', 'catalogue : une retirée reste retirée (« à confirmer » ne ressuscite rien)', r3);
  });
  await essaie('stock', async () => {
    const S = await import(pathToFileURL(path.join(tmp, 'src/stockAnnonces.js')).href);
    const r = S.annoncesActuelles({ vinted: [], numeros: {}, ebay: { liste: [] }, lbc: [{ numero: '12', title: 'Nike', etat: 'aconfirmer', lu: MAINT - 7 * 24 * H }, { numero: '13', title: 'Nike', etat: 'enligne' }], vestiaire: undefined });
    const a12 = r.articles.find((a) => a.cle === '12'), a13 = r.articles.find((a) => a.cle === '13');
    dit(a12 && a12.etat === 'aconfirmer' && a13 && a13.etat === 'enligne' && r.nAConfirmer === 1, 'Stock : l’annonce Leboncoin à confirmer reste présente mais n’est pas comptée en ligne', { a12: a12 && a12.etat, a13: a13 && a13.etat, nAc: r.nAConfirmer });
    const c0 = (r.aConfirmerComptes || []).find((x) => x.plateforme === 'leboncoin');
    dit(!!c0 && c0.n === 1, 'Stock : Leboncoin est NOMMÉ parmi les lectures à confirmer', r.aConfirmerComptes);
  });

  console.log('\n── 6. APP.JSX PASSE PAR LA RÈGLE (une règle, un propriétaire — §11)');
  const A = sansCommentaires(APPSRC);
  dit(/from ['"]\.\/enLigneLbc\.js['"]/.test(A), 'App.jsx importe src/enLigneLbc.js');
  dit(/bilanLbc\s*=\s*bilanEnLigneLbc\(/.test(A) && /lbcCount:\s*bilanLbc\.enLigne\.length/.test(A), 'écran Leboncoin : le nombre « en ligne » est celui de la règle (pas `liveAds`)');
  dit(/<AnnoncesLeboncoin\b[\s\S]{0,800}?aConfirmerDe=/.test(A), 'catalogue « Mes annonces » : l’état « à confirmer » lui est passé');
  const lire = (/async function lireLbcEnVente\(\)[\s\S]*?\n}\n/.exec(A) || [''])[0];
  dit(/etatEnLigneLbc\(/.test(lire) && /etat:/.test(lire), 'Stock (`lireLbcEnVente`) : chaque annonce porte son état de la règle');
  dit(/data-lbc-a-confirmer=/.test(A) && /LIEN_MES_ANNONCES_LBC/.test(A), 'l’écran dit « à confirmer » UNE fois, avec le geste « Mes annonces »');

  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})();
