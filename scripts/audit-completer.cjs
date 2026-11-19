#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — L'ATELIER « COMPLÉTER » (19 nov. 2026, lot completer-infos)
//        node scripts/audit-completer.cjs [--prouve]
// ════════════════════════════════════════════════════════════════════════════
// EXÉCUTE src/completer/regles.js (et le moteur des gestes, src/gesteAnnulable.js) :
//   F  la file : les vendues d'abord (la plus récente en tête), puis en ligne avec des favoris,
//      puis le reste (le plus d'argent en jeu), puis « À publier » ; une question SEULEMENT si
//      l'info manque ; « pas su » ≠ 0 ; « Je ne sais plus » retire UNE question ; le prix mini
//      n'est pas demandé dans « tout » quand l'acceptation automatique est éteinte ;
//   P  les puces du prix mini : exactes au centime (85 € ⇒ 76 / 72 / 68, achat 52 € ⇒ 62),
//      jamais sous l'achat sans le dire, jamais « au prix ou plus » ;
//   L  la règle en lot : l'aperçu EST ce qui est écrit, décoché = pas écrit, écartées NOMMÉES,
//      « Annuler » = l'état d'avant (par le vrai moteur) ;
//   R  relier : l'achat de la carte touchée et SON prix, jamais un autre parmi 50 achats au
//      même titre ; un achat relié n'est pas reproposé, un lot l'est jusqu'à N fois ;
//   E  les écritures : par identité (fiche, vente), une lecture ratée ⇒ rien d'écrit ; « Je ne
//      sais plus » n'écrit aucun prix ; ce qui est CERTAIN (achat qu'il a relié) se remplit,
//      jamais un lot, jamais une ressemblance ;
//   C  le pavé : une virgule, deux décimales ;
//   S  le branchement : une seule porte, l'écran à la demande, 10 s d'« Annuler », aucune
//      confirmation, les cartes « N sans … » de Ma journée retirées (décision du 19 nov.).
// --prouve : chaque mutation réaffaiblit une règle ⇒ l'audit DOIT rougir. Les copies de
// mutation ne prennent que les modules lus (pas tout src/) et sont effacées à la sortie.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');
const R = path.join(__dirname, '..');
const REG = 'src/completer/regles.js';
const MUTS = {
  'ordre-vendues': [REG, 'return { file: [...recentes, ...chaudes, ...calmes, ...neuves],', 'return { file: [...calmes, ...chaudes, ...recentes, ...neuves],'],
  'ordre-favoris': [REG, '(art.favoris > 0 || art.offres > 0 ? chaudes : calmes).push(art);', 'calmes.push(art);'],
  'question-sans-manque': [REG, "if (sansAchatRelie(f, prixAchat)) bruts.push('achat');", "bruts.push('achat');"],
  'mini-toujours': [REG, "if (sansMini.has(id)) bruts.push('mini');", "bruts.push('mini');"],
  'pas-su-zero': [REG, 'articles: lu && luV ? tout.filter(Boolean).length : null,', 'articles: tout.filter(Boolean).length,'],
  'anciennes-melees': [REG, 'if (art.ts != null && maintenant - art.ts <= joursVentes * J) recentes.push(art); else anciennes.push(art);', 'recentes.push(art);'],
  'sans-ignore': [REG, 'const garde = (cle, manques) => manques.filter((m) => { if (S[cleSans(cle, m)] == null) return true; mis.push({ cle, sujet: m }); return false; });', 'const garde = (cle, manques) => manques;'],
  'genre-ignore': [REG, "return { ...res, file: (res.file || []).filter(g), anciennes: (res.anciennes || []).filter(g) };", "return res;"],
  'mini-eteint-demande': [REG, "(q !== 'mini' || miniActif !== false)", 'true'],
  'puce-flottante': [REG, 'const c = Math.floor((cts(p) * Math.round((100 - q) * 100)) / 1000000) * 100;', 'const c = Math.round(p * (1 - q / 100)) * 100;'],
  'sous-achat-tu': [REG, 'out.push({ id, sorte, v, valeur, sousAchat: j.sousAchat, cout: j.cout });', 'out.push({ id, sorte, v, valeur, sousAchat: false, cout: j.cout });'],
  'puce-au-prix': [REG, 'if (j.valeur == null || j.auPrix || vues.has(cts(valeur))) return;', 'if (j.valeur == null || vues.has(cts(valeur))) return;'],
  'lot-apercu-autre': [REG, "if (c) out.push({ cle: l.cle, id: l.id, numero: l.numero, min: montantSeuil(String(l.mini)), valeur: l.mini });", "if (c) out.push({ cle: l.cle, id: l.id, numero: l.numero, min: montantSeuil(String(Math.round(l.mini))), valeur: l.mini });"],
  'lot-decoche-ecrit': [REG, "if (c) out.push({ cle: l.cle, id: l.id, numero: l.numero, min:", "out.push({ cle: l.cle, id: l.id, numero: l.numero, min:"],
  'lot-sous-achat-coche': [REG, 'cochable, coche: !ecartee });', 'cochable, coche: cochable });'],
  'lot-prix-invente': [REG, "if (a.prix == null) ecartee = 'prix'; else mini = miniPourcent(a.prix, r.v);", 'mini = miniPourcent(a.prix == null ? 50 : a.prix, r.v);'],
  'annuler-faux': [REG, "apres: { min: String(w.min) }, avant: { min: f.min } });", "apres: { min: String(w.min) }, avant: { min: String(w.min) } });"],
  'relie-repropose': [REG, '    if (!achatDisponible(achat, liens || new Map())) return;\n', ''],
  'lot-jamais-repropose': ['src/suggestionsAchat.js', 'return l.lot && (l.n == null || n < l.n);', 'return false;'],
  'hors-relier-propose': [REG, "    if (typeof horsRelier === 'function' && horsRelier(achat)) return;\n", ''],
  'ecriture-qui-ecrase': [REG, "return [{ k, type: 'fusion', id, apres: champs, avant:", "return [{ k, type: 'cle', id, apres: champs, avant_: 0, avant_2:"],
  'sans-ecrit-un-prix': [REG, "return [{ k: CLE_SANS, type: 'cle', id, apres: at, avant: (sans || {})[id] }];", "return [{ k: CLE_SANS, type: 'cle', id, apres: at, avant: (sans || {})[id] }, { k: 'vinted_annonce_numeros', type: 'champs', id: String(article.idf), apres: { buyPrice: '0' }, avant: {} }];"],
  'certain-lot': [REG, "if (!a || String(a.transaction_id) !== String(e.buyFromId) || lotDe(a).lot) continue;", "if (!a || String(a.transaction_id) !== String(e.buyFromId)) continue;"],
  'certain-autre-achat': [REG, "if (!a || String(a.transaction_id) !== String(e.buyFromId) || lotDe(a).lot) continue;", "if (!a || lotDe(a).lot) continue;",
    "|| String(p.tx) !== String(e.buyFromId)) continue;", ") continue;"],
  'certain-ecrase': [REG, "    if (e.buyPrice != null && String(e.buyPrice).trim() !== '') continue;\n    if (e.buyFrom && e.buyFrom.aSaisir) continue;", "    if (e.buyFrom && e.buyFrom.aSaisir) continue;"],
  'lecture-ratee-ecrit': ['src/gesteAnnulable.js', "    if (v === undefined) return { ok: false, definitif: true, ecrit: false, raison: 'lecture' };", ''],
  'pave-trois-decimales': [REG, 'if (d !== undefined) return d.length >= 2 ? t : t + touche;', 'if (d !== undefined) return t + touche;'],
  'ecran-relie-le-premier': ['src/completer/Completer.jsx', "apresPeinture(async () => { let ok = false; try { ok = await onRelier(a, c.achat); }", "apresPeinture(async () => { let ok = false; try { ok = await onRelier(a, cand.liste[0].achat); }"],
  'ecran-confirme': ['src/completer/Completer.jsx', "    ecrire(r, ops); noter(a, 'mini', r); return true;", "    if (!window.confirm('?')) return false; ecrire(r, ops); noter(a, 'mini', r); return true;"],
  'ecran-deux-ecritures': ['src/completer/Completer.jsx', "    ecrire(r, ops); noter(a, 'achat', r, {", "    ecrire(r, ops); ecrire(r, ops); noter(a, 'achat', r, {"],
  'ecran-attend-l-app': ['src/completer/Completer.jsx', "    setRepondues((r) => new Set(r).add(a.cle + '|' + q));\n", ''],
  'ecran-annuler-sans-retour': ['src/completer/Completer.jsx', "if (e === 'annulation' || e === 'annule' || e === 'echec' || e === 'echec-annulation') {", "if (e === 'jamais') {"],
  'ecran-style-en-ligne': ['src/completer/Completer.jsx', '<header className="vrm-cp-barre">', '<header className="vrm-cp-barre" style={{ height: 44 }}>'],
  'app-carte-revenue': ['src/App.jsx', "jobs.push({ id: 'completer', n: nC,", "jobs.push({ id: 'prix-mini-manquants', n: nC,"],
  'app-ecran-au-demarrage': ['src/App.jsx', "const Completer = aLaDemande(() => import('./completer/Completer.jsx'), true);", "import Completer from './completer/Completer.jsx';"],
  'app-annuler-5s': ['src/App.jsx', "'completer', null, null, 10000);", "'completer', null, null, 0);"],
  'app-numero-redemande': ['src/App.jsx', "if (it) await poserNumero(it, v, '', { sansPrix: true });", "if (it) await poserNumero(it, v, '');"],
};
if (process.argv.includes('--prouve')) {
  let n = 0;
  for (const k of Object.keys(MUTS)) {
    let code = 0; try { execFileSync(process.execPath, [__filename, '--mutation=' + k], { stdio: 'pipe' }); } catch (e) { code = e.status; }
    console.log(`${code === 1 ? '✅' : '❌'} mutation « ${k} » ⇒ ${code === 1 ? 'ROUGE' : 'pas attrapée (' + code + ')'}`); if (code === 1) n++;
  }
  console.log(`${n}/${Object.keys(MUTS).length} mutations attrapées`); process.exit(n === Object.keys(MUTS).length ? 0 : 1);
}

// ── La copie de travail : seulement les modules lus (fermeture des imports relatifs) ──
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1];
const ENTREES = [REG, 'src/gesteAnnulable.js', 'src/prixAuNumerotage.js', 'src/prixAchatPropose.js', 'src/relierGlisser.js'];
const TEXTES = ['src/completer/Completer.jsx', 'src/completer/completer.css', 'src/completer/porte.js', 'src/App.jsx'];
let BASE = R, TMP = null;
const fermeture = () => {
  const vus = new Set(); const pile = [...ENTREES];
  while (pile.length) {
    const rel = pile.pop(); if (vus.has(rel)) continue;
    const abs = path.join(R, rel); if (!fs.existsSync(abs)) continue;
    vus.add(rel);
    const src = fs.readFileSync(abs, 'utf8');
    for (const m of src.matchAll(/(?:from|import)\s*\(?\s*['"](\.{1,2}\/[^'"]+)['"]/g)) { const cible = path.relative(R, path.resolve(path.dirname(abs), m[1])); if (/\.(js|mjs)$/.test(cible)) pile.push(cible); }
  }
  return [...vus];
};
if (MUT) {
  if (!MUTS[MUT]) { console.log('mutation inconnue : ' + MUT); process.exit(2); }
  TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-completer-'));
  for (const rel of [...fermeture(), ...TEXTES]) { const de = path.join(R, rel); if (!fs.existsSync(de)) continue; fs.mkdirSync(path.dirname(path.join(TMP, rel)), { recursive: true }); fs.copyFileSync(de, path.join(TMP, rel)); }
  fs.writeFileSync(path.join(TMP, 'package.json'), '{"type":"module"}');
  const [f, ...paires] = MUTS[MUT];
  const p = path.join(TMP, f); let s = fs.readFileSync(p, 'utf8');
  for (let i = 0; i < paires.length; i += 2) {
    if (!s.includes(paires[i])) { console.log(`mutation « ${MUT} » : le texte visé n'est plus dans ${f}`); fs.rmSync(TMP, { recursive: true, force: true }); process.exit(3); }
    s = s.replace(paires[i], paires[i + 1]);
  }
  fs.writeFileSync(p, s);
  BASE = TMP;
}
process.on('exit', () => { if (TMP) { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_) {} } });

let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log(`${c ? '✅' : '❌'} ${m}${!c && d !== undefined ? '  → ' + String(typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 600) : ''}`); };
const imp = (rel) => import(pathToFileURL(path.join(BASE, rel)).href + '?v=' + Date.now() + Math.random());
const lire = (rel) => { try { return fs.readFileSync(path.join(BASE, rel), 'utf8'); } catch (_) { return ''; } };
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
const gel = (o) => { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); for (const v of Object.values(o)) gel(v); } return o; };
const egal = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ── Le jeu inventé (les nombres de la demande : 51 sans prix mini, 33 sans prix d'achat, 4 ventes) ──
const MAINTENANT = Date.parse('2026-11-19T09:00:00Z'), J = 86400e3;
function jeu() {
  const annonces = [], numeros = {};
  // 60 annonces en ligne : 1..51 sans prix mini ; 1..33 sans prix d'achat (les 33 premières) ; 52..60 complètes.
  for (let i = 1; i <= 60; i++) {
    const id = String(9000 + i), prix = 40 + i;
    const achat = i <= 33 ? null : 20 + i;
    numeros[id] = { numero: String(100 + i), title: `Adidas Spezial ${i}`, ...(achat != null ? { buyPrice: String(achat) } : {}), ...(i > 51 ? { min: String(prix - 10) } : {}) };
    annonces.push({ id, uid: 'u1', etat: 'en-ligne', compte: 'compte_a', titre: `Adidas Spezial ${i}`, prix, photo: `https://images.exemple/a${i}.jpg`, numero: String(100 + i), taille: '42', favoris: i % 10 === 0 ? i : 0, createdTs: MAINTENANT - i * J, verif: { achat } });
  }
  annonces.push({ id: '9999', uid: 'u1', etat: 'brouillon', titre: 'Brouillon', prix: 30, numero: '', verif: { achat: null } });
  numeros['9999'] = { numero: '999' };
  const ventes = [];
  for (let i = 1; i <= 4; i++) ventes.push({ tx: String(7100000 + i), idf: null, titre: `Nike Dunk vendue ${i}`, prix: 70 + i, photo: `https://images.exemple/v${i}.jpg`, taille: '43', numero: String(200 + i), ts: MAINTENANT - i * 2 * J });
  for (let i = 1; i <= 6; i++) ventes.push({ tx: String(7200000 + i), idf: null, titre: `Ancienne ${i}`, prix: 50, ts: MAINTENANT - (40 + i) * J });
  const prixAchat = (e) => { const n = e && e.buyPrice != null && String(e.buyPrice).trim() !== '' ? Number(String(e.buyPrice).replace(',', '.')) : null; return Number.isFinite(n) ? n : null; };
  return { annonces, numeros, prixAchat, ventes, fichesNeuves: [{ id: 'fn1', numero: '301', titre: 'Fiche à publier', prix: null }, { id: 'fn2', numero: '302', titre: 'Fiche avec prix', prix: 45 }], sansNumero: [], sans: {}, virgule: false, miniActif: true, maintenant: MAINTENANT };
}

async function principal() {
  let M, G, PN, PP, RG;
  try { M = await imp(REG); G = await imp('src/gesteAnnulable.js'); PN = await imp('src/prixAuNumerotage.js'); PP = await imp('src/prixAchatPropose.js'); RG = await imp('src/relierGlisser.js'); }
  catch (e) { dit(false, 'les modules de l’atelier se chargent (src/completer/regles.js)', e.message); console.log(`\n${ok} verts, ${ko} rouges`); process.exit(1); }

  // ── F. la file ──
  console.log('── F. la file');
  const E = jeu(); gel(E.annonces); gel(E.numeros); gel(E.ventes);
  const res = M.fileCompleter(E), C = M.compteurs(res), f = res.file;
  dit(C.mini === 51 && C.achatAnnonces === 33 && C.achatVentes === 4 && C.prix === 1 && C.anciennes === 6, 'F1 les compteurs par sorte : 51 sans prix mini, 33 annonces sans prix d’achat, 4 ventes, 1 prix, 6 ventes plus anciennes', C);
  dit(C.articles === 56 && C.questions === 51 + 33 + 4 + 1, 'F2 56 articles, 89 questions (une par info manquante)', C);
  dit(f.slice(0, 4).every((a) => a.genre === 'vente') && f[0].ts > f[1].ts && f[1].ts > f[2].ts, 'F3 les vendues d’abord, la plus récente en tête', f.slice(0, 5).map((a) => a.cle));
  const iFav = f.findIndex((a) => a.genre === 'annonce' && a.favoris > 0), iCalme = f.findIndex((a) => a.genre === 'annonce' && a.favoris === 0);
  const favs = f.filter((a) => a.genre === 'annonce' && a.favoris > 0);
  dit(iFav === 4 && iCalme > iFav && favs.length === 5 && f.slice(4, 9).every((a) => a.favoris > 0) && favs[0].favoris >= favs[1].favoris, 'F4 puis les annonces regardées (favoris), les plus regardées d’abord', { iFav, iCalme, favs: favs.map((a) => a.favoris) });
  const calmes = f.filter((a) => a.genre === 'annonce' && a.favoris === 0);
  dit(calmes.every((a, i) => i === 0 || calmes[i - 1].prix >= a.prix) && f[f.length - 1].genre === 'fiche', 'F5 puis le reste, le plus d’argent en jeu d’abord ; « À publier » en dernier');
  dit(!f.some((a) => ['9052', '9060', '9999'].includes(a.id)) && !f.some((a) => a.cle === 'f:fn2'), 'F6 un article complet, un brouillon, une fiche qui a son prix : hors de la file');
  const a40 = f.find((a) => a.id === '9040'), a10 = f.find((a) => a.id === '9010');
  dit(egal(a40.manques, ['mini']) && egal(M.questionsDe(a10), ['achat', 'mini']) && egal(M.questionsDe(a10, 'mini'), ['mini']), 'F7 une question seulement si l’info manque ; l’achat avant le prix mini', { a40: a40.manques, a10: a10.manques });
  const avecNum = M.fileCompleter({ ...jeu(), sansNumero: ['9010'], numeros: { ...jeu().numeros, 9010: { title: 'x' } } }).file.find((a) => a.id === '9010');
  dit(avecNum && M.questionsDe(avecNum)[0] === 'numero', 'F8 le N° d’abord quand il manque', avecNum && avecNum.manques);
  const pasLu = M.compteurs(M.fileCompleter({ ...jeu(), annonces: null }));
  dit(pasLu.articles === null && pasLu.mini === null && pasLu.achatVentes === 4, 'F9 annonces pas lues ⇒ « pas su » (null), jamais 0', pasLu);
  const sans = { [M.cleSans('a:9010', 'achat')]: '2026-11-19T08:00:00Z' };
  const r2 = M.fileCompleter({ ...jeu(), sans }), b10 = r2.file.find((a) => a.id === '9010');
  dit(b10 && egal(b10.manques, ['mini']) && M.compteurs(r2).mis === 1 && M.compteurs(r2).achatAnnonces === 32, 'F10 « Je ne sais plus » retire CETTE question de CET article, et se compte', b10 && b10.manques);
  const r3 = M.fileCompleter({ ...jeu(), miniActif: false }), C3 = M.compteurs(r3);
  dit(C3.questions === 33 + 4 + 1 && C3.mini === 51 && M.filtrer(r3, 'tout').every((a) => !M.questionsDe(a, 'tout', false).includes('mini')) && M.filtrer(r3, 'mini').length === 51,
    'F11 acceptation automatique éteinte : le prix mini n’est pas demandé dans « tout », il reste dans « prix mini »', C3);
  dit(M.filtrer(res, 'anciennes').length === 6 && !f.some((a) => a.tx && a.tx.startsWith('72')), 'F12 les ventes de plus de 30 jours : comptées à part, jamais mêlées, jamais cachées');
  dit(M.indexNumero(f, 'N°110') === f.findIndex((a) => a.numero === '110') && M.indexNumero(f, '99999') === -1 && M.indexReprise(f, { sujet: 'tout', cle: 'a:9020' }, 'tout') === f.findIndex((a) => a.cle === 'a:9020') && M.indexReprise(f, { sujet: 'mini', cle: 'a:9020' }, 'tout') === 0,
    'F13 il reprend où il s’est arrêté ; ouvert sur un N°, il arrive sur cet article');

  const gV = M.parGenre(res, 'vente'), gA = M.parGenre(res, 'annonce');
  dit(gV.file.length === 4 && gV.file.every((a) => a.genre === 'vente') && gV.anciennes.length === 6 && gA.file.length === 51 && gA.anciennes.length === 0 && M.parGenre(res, 'tous') === res && M.compteurs(gA).achat === 33,
    'F14 le filtre « En ligne · Vendues » : la file d’un genre, rien d’autre ; « Toutes » la rend telle quelle', { v: gV.file.length, a: gA.file.length });

  // ── P. les puces du prix mini ──
  console.log('\n── P. les puces du prix mini');
  const p85 = M.pucesMini({ prix: 85, achat: 52, frais: 0 });
  dit(egal(p85.map((p) => [p.id, p.valeur]), [['p10', 76], ['p15', 72], ['p20', 68], ['a10', 62]]), 'P1 85 € ⇒ −10 % 76 €, −15 % 72 €, −20 % 68 € ; achat 52 € + 10 ⇒ 62 €', p85.map((p) => [p.id, p.valeur]));
  let faux = [];
  for (let c = 100; c <= 60000; c += 37) for (const q of [10, 15, 20, 7, 33]) {
    const att = Number((BigInt(c) * BigInt(100 - q) / 10000n) * 100n);
    const v = M.miniPourcent(c / 100, q);
    if ((att > 0 && att < c ? att / 100 : null) !== v) faux.push([c, q, v, att]);
  }
  dit(!faux.length, 'P2 exact au centime sur 1 620 prix × 5 réductions (entiers, à l’euro du dessous)', faux.slice(0, 5));
  dit(M.miniAchatPlus(52.55, 10) === 62.55 && M.miniAchatPlus('19,99', 10) === 29.99 && M.miniAchatPlus(null, 10) === null && M.miniPourcent(null, 10) === null, 'P3 achat + 10 € au centime ; achat ou prix inconnu ⇒ aucune puce (jamais inventée)');
  const pSous = M.pucesMini({ prix: 60, achat: 55, frais: 0 });
  const pFrais = M.pucesMini({ prix: 60, achat: 50, frais: 3 });
  dit(pSous.filter((p) => p.sorte === 'pct').every((p) => p.sousAchat && p.cout === 55) && pFrais.find((p) => p.id === 'p15').sousAchat === true && pFrais.find((p) => p.id === 'p10').sousAchat === false,
    'P4 sous SON coût (achat + frais saisis) ⇒ la puce le DIT', { pSous, pFrais });
  let tu = 0; for (let prix = 20; prix <= 200; prix += 7) for (let achat = 5; achat < prix; achat += 6) for (const p of M.pucesMini({ prix, achat, frais: 0 })) if (p.valeur < achat && !p.sousAchat) tu++;
  dit(tu === 0, 'P5 jamais une puce sous l’achat sans l’avertissement (balayage prix × achat)', tu);
  const pHaut = M.pucesMini({ prix: 60, achat: 55, frais: 0 }).find((p) => p.sorte === 'achat');
  dit(!pHaut && M.jugerMini({ prix: 60, achat: 20, frais: 0 }, 60).auPrix === true && M.pucesMini({ prix: 100, achat: 80, frais: 0 }).filter((p) => p.valeur === 90).length === 1,
    'P6 « au prix ou plus » n’est jamais une puce (achat 55 + 10 ≥ prix 60) ; deux puces de même valeur : une seule');

  // ── L. la règle en lot ──
  console.log('\n── L. la règle en lot');
  const arts = M.filtrer(res, 'mini');
  const ap = M.apercuLot(arts, { sorte: 'pct', v: 15 });
  const ecr = M.ecrituresLot(ap);
  dit(ap.length === 51 && ecr.length === ap.filter((l) => l.coche).length && ecr.every((w) => { const l = ap.find((x) => x.cle === w.cle); return String(l.mini) === w.min && l.mini === M.miniPourcent(l.prix, 15); }),
    'L1 l’aperçu EST l’écriture : chaque ligne cochée écrit exactement le prix mini montré', { n: ap.length, ecr: ecr.length });
  const choix = { [ap[0].cle]: false, [ap[1].cle]: false };
  const ecr2 = M.ecrituresLot(ap, choix);
  dit(ecr2.length === ecr.length - 2 && !ecr2.some((w) => w.cle === ap[0].cle || w.cle === ap[1].cle), 'L2 décoché = pas écrit');
  const mixte = [
    { cle: 'a:1', genre: 'annonce', id: '1', numero: '1', prix: 80, achat: 30, frais: 0, manques: ['mini'] },
    { cle: 'a:2', genre: 'annonce', id: '2', numero: '2', prix: null, achat: 30, frais: 0, manques: ['mini'] },
    { cle: 'a:3', genre: 'annonce', id: '3', numero: '3', prix: 50, achat: 48, frais: 0, manques: ['mini'] },
    { cle: 'a:4', genre: 'annonce', id: '4', numero: '4', prix: 50, achat: null, frais: null, manques: ['mini'] },
    { cle: 'a:5', genre: 'annonce', id: '5', numero: '5', prix: 55, achat: 52.5, frais: 0, manques: ['mini'] },
    { cle: 'a:6', genre: 'annonce', id: '6', numero: '6', prix: 90, achat: 40, frais: 0, manques: ['achat'] },
  ];
  const apM = M.apercuLot(mixte, { sorte: 'pct', v: 10 });
  const parId = (l, id) => l.find((x) => x.id === id);
  dit(apM.length === 5 && parId(apM, '1').mini === 72 && parId(apM, '1').coche && parId(apM, '2').ecartee === 'prix' && parId(apM, '2').mini === null && !parId(apM, '2').cochable
    && parId(apM, '3').ecartee === 'sous-achat' && !parId(apM, '3').coche && parId(apM, '3').cochable && parId(apM, '4').coche,
    'L3 écartées NOMMÉES : prix pas lu (rien à poser) ; sous son achat (dite, décochée, il peut la cocher)', apM);
  dit(M.ecrituresLot(apM).length === 2 && M.ecrituresLot(apM, { 'a:3': true }).some((w) => w.cle === 'a:3' && w.min === '45') && !M.ecrituresLot(apM, { 'a:2': true }).some((w) => w.cle === 'a:2'),
    'L4 sous l’achat : jamais écrite d’office, seulement s’il la coche ; une ligne sans prix ne s’écrit jamais');
  const apA = M.apercuLot(mixte, { sorte: 'achat', v: 10 });
  dit(parId(apA, '1').mini === 40 && parId(apA, '4').ecartee === 'achat' && parId(apA, '3').ecartee === 'au-prix' && !parId(apA, '3').cochable && parId(apA, '5').ecartee === 'au-prix'
    && M.ecrituresLot(M.apercuLot([{ ...mixte[4], prix: 80 }], { sorte: 'achat', v: 10 }))[0].min === '62.5',
    'L5 « achat + 10 € » : achat pas connu ⇒ écartée ; au prix ou plus ⇒ écartée ; les centimes sont écrits tels que montrés (62,50 ⇒ « 62.5 »)', apA);
  // « Annuler » en bloc, par le VRAI moteur : l'état d'avant, exactement.
  const magasin = { vinted_annonce_numeros: JSON.parse(JSON.stringify(E.numeros)) };
  delete magasin.vinted_annonce_numeros['9003'];                         // une annonce sans fiche : la fiche est créée, puis retirée par « Annuler »
  const avant = JSON.stringify(magasin);
  const ops = M.opsMini(ecr, { fiches: magasin.vinted_annonce_numeros, ficheNeuveDe: (id) => ({ title: 'neuve ' + id, price: 43 }) });
  const moteur = G.creerGestes({ minuterie: () => 0, arreter: () => {} });
  const ecrivain = { lire: async (k) => magasin[k], ecrire: async (k, v) => { magasin[k] = v; return { ok: true }; } };
  const id = moteur.lancer({ texte: 'lot', cles: G.clesDe(ops), vue: () => {}, ecrire: (sens) => G.ecrireOps({ ops, sens, ...ecrivain }) });
  await moteur.vider(); await new Promise((r) => setTimeout(r, 5));
  const pose = magasin.vinted_annonce_numeros;
  const tousPoses = ecr.every((w) => pose[w.id] && pose[w.id].min === w.min);
  dit(tousPoses && pose['9003'] && pose['9003'].title === 'neuve 9003' && pose['9052'].min === E.numeros['9052'].min, 'L6 « Poser » écrit les lignes cochées (une fiche absente est créée avec SON annonce), rien d’autre', { n: ecr.length });
  moteur.annuler(id); await moteur.vider(); await new Promise((r) => setTimeout(r, 5));
  dit(JSON.stringify(magasin) === avant, 'L7 « Annuler » en bloc = l’état d’avant, exactement (par le moteur des gestes)');

  // ── R. relier ──
  console.log('\n── R. relier');
  const achats50 = []; for (let i = 1; i <= 50; i++) achats50.push({ transaction_id: 8000000 + i, title: 'Adidas Spezial noire', price: { amount: String(30 + i) + '.' + String(i % 10) + '0', currency_code: 'EUR' }, date: '2026-10-0' + (1 + (i % 9)), status: 'Commande finalisée' });
  const art = f.find((a) => a.id === '9010');
  const liaison = { parArticle: { 'a:9010': [] }, pistes: { 'a:9010': achats50.map((a) => ({ achat: a, niveau: 'piste', score: 5 })) } };
  const cand = M.candidatsAchat({ article: art, liaison, liens: new Map() });
  dit(cand.liste.length === 3 && cand.autres === 47 && new Set(cand.liste.map((c) => c.tx)).size === 3, 'R1 50 achats au même titre : 3 cartes au plus, chacune SON n° de transaction ; « Autre achat · 47 de plus »', cand.liste.map((c) => c.tx));
  // Toucher la 2e carte : l'écriture de « Relier » porte CET achat et SON prix, jamais un voisin.
  let mauvais = 0;
  for (const c of cand.liste) {
    const p = PP.propositionPrixAchat({ identite: { achat: c.achat, par: 'choix' } });
    const w = PP.ecritureProposition(p, {});
    const opsR = RG.opsRelierGlisse({ cible: { genre: 'annonce', id: art.id }, w, fiches: E.numeros, ventes: {}, prixParNum: {} });
    const apres = G.appliquerOps(E.numeros, opsR, 'apres', 'vinted_annonce_numeros')[art.id];
    if (String(apres.buyFromId) !== c.tx || Number(String(apres.buyPrice).replace(',', '.')) !== Number(c.achat.price.amount)) mauvais++;
  }
  dit(mauvais === 0, 'R2 relier = l’achat de la carte touchée et SON prix payé (les 3 cartes rejouées)', mauvais);
  const liens = new Map([[String(8000001), 1], [String(8000003), 1]]);
  const cand2 = M.candidatsAchat({ article: art, liaison, liens });
  dit(!cand2.liste.some((c) => c.tx === '8000001' || c.tx === '8000003') && cand2.liste[0].tx === '8000002' && cand2.autres === 45, 'R3 un achat déjà relié n’est pas reproposé', cand2.liste.map((c) => c.tx));
  const lot = { transaction_id: 8100001, title: 'Lot de 3 paires Nike', price: { amount: '90.00', currency_code: 'EUR' } };
  const lL = { parArticle: { 'a:9010': [{ achat: lot, niveau: 'tres-probable' }] }, pistes: {} };
  const n = (k) => M.candidatsAchat({ article: art, liaison: lL, liens: new Map(k ? [['8100001', k]] : []) }).liste.length;
  dit(n(0) === 1 && n(1) === 1 && n(2) === 1 && n(3) === 0 && M.candidatsAchat({ article: art, liaison: lL, liens: new Map() }).liste[0].lot === true, 'R4 un lot de 3 est proposé jusqu’à 3 fois, pas une de plus', [n(0), n(1), n(2), n(3)]);
  const cand3 = M.candidatsAchat({ article: art, liaison, liens: new Map(), horsRelier: (a) => a.transaction_id === 8000001, identite: { achat: achats50[9] } });
  dit(cand3.liste[0].tx === '8000010' && cand3.liste[0].niveau === 'identite' && !cand3.liste.some((c) => c.tx === '8000001'), 'R5 l’identité (même fichier photo) en tête ; un achat annulé / en retour jamais proposé', cand3.liste.map((c) => [c.tx, c.niveau]));
  dit(M.candidatsAchat({ article: art, liaison: null, liens: new Map() }).liste.length === 0, 'R6 sans proposition : rien n’est inventé (le pavé, « Autre achat »)');

  // ── E. les écritures ──
  console.log('\n── E. les écritures');
  const w52 = PN.ecriturePrixSaisi('52,5').patch;
  const oA = M.opsPrixAchat({ article: art, patch: w52, fiches: E.numeros, ventes: {}, prixParNum: { 110: '9' } });
  dit(oA.length === 2 && oA[0].k === 'vinted_annonce_numeros' && oA[0].id === '9010' && oA[0].apres.buyPrice === '52,50' && oA[0].apres.buyFromId === null && oA[1].k === 'vinted_buyprice_by_num' && oA[1].id === '110' && oA[1].avant === '9',
    'E1 un prix tapé : sur la fiche de CETTE annonce (son identifiant) et le miroir de SON N°', oA);
  const vente = f.find((a) => a.genre === 'vente');
  const oV = M.opsPrixAchat({ article: vente, patch: w52, fiches: E.numeros, ventes: { [vente.tx]: { numero: '201', fees: '2' } }, prixParNum: {} });
  const oVf = M.opsPrixAchat({ article: { ...vente, idf: '9010' }, patch: w52, fiches: E.numeros, ventes: {}, prixParNum: {} });
  const lv = (v, sens) => G.appliquerOps(v, oV, sens, 'vinted_sale_overrides')[vente.tx];
  dit(oV.length === 1 && oV[0].k === 'vinted_sale_overrides' && oV[0].id === vente.tx && egal(lv({ [vente.tx]: { numero: '201', fees: '2' } }, 'apres'), { numero: '201', fees: '2', buyPrice: '52,50' })
    && oVf[0].k === 'vinted_annonce_numeros' && oVf[0].id === '9010',
    'E2 une vente : sur la fiche de SON annonce (par identité) quand elle existe, sinon sur la ligne de la vente (ses autres champs gardés)', { oV, oVf });
  // La ligne d'une vente qui n'existait pas au toucher, et qui reçoit SON N° entre-temps (donné tout seul) : rien n'est écrasé.
  const oV0 = M.opsPrixAchat({ article: vente, patch: w52, fiches: E.numeros, ventes: {}, prixParNum: {} });
  const entreTemps = { [vente.tx]: { numero: '201', autoAssigned: true } };
  const apV = G.appliquerOps(entreTemps, oV0, 'apres', 'vinted_sale_overrides'), avV = G.appliquerOps(apV, oV0, 'avant', 'vinted_sale_overrides');
  dit(egal(apV[vente.tx], { numero: '201', autoAssigned: true, buyPrice: '52,50' }) && egal(avV, entreTemps) && egal(G.appliquerOps(G.appliquerOps({}, oV0, 'apres', 'vinted_sale_overrides'), oV0, 'avant', 'vinted_sale_overrides'), {}),
    'E2b une entrée à créer passe par « fusion » : ce qu’un autre geste y a posé entre-temps (un N°) reste ; « Annuler » ne retire que SON prix', { apV, avV });
  dit(M.opsPrixAchat({ article: { cle: 'x', genre: 'vente', tx: null, idf: null }, patch: w52 }).length === 0 && M.opsPrixAchat({ article: art, patch: PN.ecriturePrixSaisi('abc').patch }).length === 0 && M.opsMini([{ id: '1', min: '' }], { fiches: {} }).length === 0,
    'E3 sans identité, ou montant illisible ⇒ aucune écriture');
  const oS = M.opsSans({ article: art, sujet: 'achat', sans: {}, at: 'T' });
  const apresS = G.appliquerOps(E.numeros, oS, 'apres', 'vinted_annonce_numeros');
  dit(oS.length === 1 && oS[0].k === M.CLE_SANS && oS[0].id === 'a:9010|achat' && egal(apresS, E.numeros) && !JSON.stringify(oS).includes('buyPrice'), 'E4 « Je ne sais plus » : une note, AUCUN prix écrit, aucune fiche touchée', oS);
  dit(egal(M.opsRevoir({ 'a:1|achat': 'T' }), [{ k: M.CLE_SANS, type: 'cle', id: 'a:1|achat', avant: 'T' }]), 'E5 « Les revoir » retire les notes, rien d’autre');
  // Une lecture ratée n'écrit RIEN (le moteur réel).
  let ecrites = 0;
  const rate = await G.ecrireOps({ ops: [...oA], sens: 'apres', lire: async (k) => (k === 'vinted_buyprice_by_num' ? undefined : E.numeros), ecrire: async () => { ecrites++; return { ok: true }; } });
  dit(rate.ok === false && rate.ecrit === false && ecrites === 0, 'E6 une lecture ratée ⇒ AUCUNE écriture (pas même la clé déjà lue)', { rate, ecrites });
  const oM = M.opsMini([{ id: '9010', min: '45.5' }], { fiches: E.numeros });
  const Off = await imp('src/offresSures.js');
  dit(oM.length === 1 && oM[0].apres.min === '45.5' && Off.seuilMoteur(oM[0].apres.min, false) === 45.5 && oM[0].avant.min === undefined, 'E7 le prix mini est écrit « 45.5 » : lisible par le moteur de toutes les versions');
  dit(M.opsPrixFiche({ article: { genre: 'fiche', id: 'fn1' }, prix: 45, fichesNeuves: { fn1: { id: 'fn1', prix: null } } })[0].apres.prix === 45 && M.opsPrixFiche({ article: { genre: 'annonce', id: '9010' }, prix: 45, fichesNeuves: {} }).length === 0,
    'E8 « Son prix ? » n’écrit que sur une fiche « À publier » (rien ne part chez Vinted)');
  // Ce qui est certain se remplit ; rien d'autre.
  const simple = { transaction_id: 8200001, title: 'Nike Dunk Low', price: { amount: '41.30', currency_code: 'EUR' } };
  const propositionDe = (a) => PP.propositionPrixAchat({ identite: { achat: a, par: 'lien' }, estLot: () => false });
  // Un appelant négligent qui rendrait « un achat qui ressemble » : la règle exige le n° de transaction du lien.
  const achatDe = (tx) => ({ 8200001: simple, 8100001: lot }[tx] || simple);
  const entrees = [
    { ou: 'fiche', cle: 'A', entree: { numero: '1', buyFromId: '8200001', buyPrice: '' } },
    { ou: 'fiche', cle: 'B', entree: { numero: '2', buyFromId: '8200001', buyPrice: '39' } },
    { ou: 'fiche', cle: 'C', entree: { numero: '3', buyFromId: '8100001', buyPrice: '' } },
    { ou: 'fiche', cle: 'D', entree: { numero: '4', title: 'Nike Dunk Low', buyPrice: '' } },
    { ou: 'vente', cle: 'E', entree: { buyFromId: '8299999' } },
    { ou: 'fiche', cle: 'F', entree: { numero: '6', buyFromId: '8200001', buyPrice: '', buyFrom: { aSaisir: true } } },
  ];
  const cer = M.prixCertains({ entrees, achatDe, propositionDe });
  dit(cer.length === 1 && cer[0].cle === 'A' && cer[0].centimes === 4130, 'E9 certain = un achat qu’IL a relié, prix resté vide ⇒ ce qu’il a payé ; jamais un lot, jamais un titre qui ressemble, jamais un prix déjà là', cer);
  const oC = M.opsPrixCertains(cer, { fiches: { A: { numero: '1', buyFromId: '8200001', buyPrice: '' } }, ventes: {}, prixParNum: {} });
  dit(oC.length === 2 && oC[0].apres.buyPrice === '41,30' && !('buyFromId' in oC[0].apres) && oC[1].id === '1', 'E10 il n’écrit que le prix (le lien, posé par lui, ne change pas)', oC);

  // ── C. le pavé ──
  console.log('\n── C. le pavé');
  const tape = (s) => [...s].reduce((t, c) => M.toucheSuivante(t, c === '<' ? 'efface' : c), '');
  dit(tape('52,5') === '52,5' && tape('5,,5') === '5,5' && tape('1,234') === '1,23' && tape(',5') === '0,5' && tape('007') === '7' && tape('12<') === '1' && tape('1234567') === '123456',
    'C1 chiffres, UNE virgule, deux décimales au plus, pas de zéro devant', [tape('1,234'), tape(',5'), tape('007')]);
  dit(M.montantTape('52,5') === 52.5 && M.montantTape('52,') === 52 && M.montantTape('') === null && M.montantTape('0') === null && M.montantTape('abc') === null, 'C2 le montant lu ; vide, zéro ou illisible ⇒ rien');

  // ── S. le branchement ──
  console.log('\n── S. le branchement');
  const app = sansCommentaires(lire('src/App.jsx')), ecran = sansCommentaires(lire('src/completer/Completer.jsx')), porte = sansCommentaires(lire('src/completer/porte.js'));
  dit(/const Completer = aLaDemande\(\(\) => import\('\.\/completer\/Completer\.jsx'\)/.test(app) && !/import\s+\w+\s+from\s+['"]\.\/completer\/(Completer\.jsx|regles\.js)['"]/.test(app) && /import\('\.\/completer\/regles\.js'\)/.test(app),
    'S1 l’écran et ses règles sont chargés à la demande (seule la porte est au démarrage)');
  dit(/export function ouvrirCompleter\(/.test(porte) && /EVT_COMPLETER/.test(app) && /only="completer"/.test(app) && /poserCompteursCpl\(m\.compteurs\(m\.fileCompleter\(entreesCompleter\)\)\)/.test(app),
    'S2 une seule porte (`ouvrirCompleter`) ; les compteurs publiés par la MÊME règle que la file');
  const cartes = ["id: 'prix-mini-manquants'", "id: 'achat-a-relier'", "id: 'numeros-a-donner'", "id: 'prix-achat-vente'"].filter((x) => app.includes(x));
  dit(!cartes.length && (app.match(/id: 'completer'/g) || []).length === 1 && /avant: \(\) => \{ ouvrirCompleter\(\); \}/.test(app), 'S3 Ma journée : les quatre cartes « N sans … » retirées (décision du 19 nov.), UNE entrée « à compléter »', cartes);
  dit(/'completer', null, null, 10000\)/.test(app) && /only === 'completer' \? 10000 : 0\)/.test(app) && /duree: Number\(duree\) > 0/.test(sansCommentaires(lire('src/gesteAnnulable.js'))) && M.DUREE_ANNULER === 10000,
    'S4 chaque réponse (et chaque liaison) est annulable 10 s, par le moteur des gestes');
  const nRelier = (ecran.match(/\bonRelier\(/g) || []).length, nRelierCarte = (ecran.match(/\bonRelier\(a, c\.achat\)/g) || []).length;
  dit(nRelier === 2 && nRelierCarte === 2 && /relierGlisse\(a, art\.genre === 'vente' \? \{ genre: 'vente', tx: art\.tx, idf: art\.idf/.test(app), 'S5 relier = SON toucher sur UNE rangée : l’achat de cette rangée, l’identité de l’article (l’écriture de « Relier »)', { nRelier, nRelierCarte });
  dit(!/askConfirm|window\.confirm|\bconfirm\(/.test(ecran), 'S6 aucune confirmation dans l’atelier (« Annuler » suffit)');
  dit(!/\bstyle=\{/.test(ecran) && !/!important/.test(sansCommentaires(lire('src/completer/completer.css'))) && !/:has\(/.test(lire('src/completer/completer.css')), 'S10 design natif : aucun style en ligne, aucun `!important`, aucun `:has()`');
  const gestesParReponse = ['poserPrixAchat', 'poserMini', 'poserPrix', 'neSaitPlus'].map((nom) => { const m = new RegExp('const ' + nom + ' = \\([^)]*\\) => \\{([\\s\\S]*?)\\n  \\};').exec(ecran); return m ? (m[1].match(/\becrire\(/g) || []).length + (m[1].match(/\bgeste\(/g) || []).length : -1; });
  dit(gestesParReponse.every((x) => x === 1) && /const ecrire = \(texte, ops\) => apresPeinture\(\(\) => geste\(texte, ops\)\);/.test(ecran), 'S7 une réponse = UNE écriture (un seul geste par réponse)', gestesParReponse);
  dit(/setRepondues\(\(r\) => new Set\(r\)\.add\(a\.cle \+ '\|' \+ q\)\);/.test(ecran) && /!repondues\.has\(a\.cle \+ '\|' \+ q\)/.test(ecran) && /if \(e === 'annulation' \|\| e === 'annule' \|\| e === 'echec' \|\| e === 'echec-annulation'\) \{ setRepondues\(/.test(ecran),
    'S11 aucune attente : la réponse fait avancer tout de suite, l’écriture part après la carte suivante ; « Annuler » ou un refus ⇒ l’article revient');
  dit(/'vrm_completer_sans',/.test(app) && /poserNumero\(it, v, '', \{ sansPrix: true \}\)/.test(app) && (app.match(/if \(!opts\.sansPrix\) await demanderPrixAchat\(/g) || []).length === 4,
    'S8 « Je ne sais plus » est synchronisé ; le N° passe par `poserNumero` (ses garde-fous), sans redemander le prix d’achat');
  dit(/prixCertains\(\{ entrees: liees/.test(ecran) && /par: 'lien'/.test(app), 'S9 le prix certain vient de l’achat qu’il a relié (`par: \'lien\'`), jamais d’une proposition');

  console.log(`\n${ko ? '❌' : '✅'} audit-completer : ${ok} verts, ${ko} rouges`);
  process.exit(ko ? 1 : 0);
}
principal().catch((e) => { console.log('❌ audit-completer : ' + (e && e.stack || e)); process.exit(1); });
