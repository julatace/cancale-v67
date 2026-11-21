// ════════════════════════════════════════════════════════════════════════════
//  « SES ACTIONS EMPÊCHENT D'ÊTRE BLOQUÉ » (19 nov., ext. 5.409) — TOUTE écriture
//  vers un site (Vinted, Leboncoin, Vestiaire) passe par les garde-fous.
//
//  On CHARGE le vrai `background.js` (scripts/_fond-vm.cjs) et on lit le texte
//  de CHAQUE fonction telle que le moteur l'a compilée (`fn.toString()`), puis :
//   1. on repère chaque ÉCRITURE : `vintedPage` / `vintedSend` avec une méthode
//      qui n'est pas GET, `vintedPagePhoto`, et les gestes confiés à un onglet
//      Leboncoin / Vestiaire (`lbcRepondre`, `lbcPauseAnnonce`, `lbcPrixAnnonce`,
//      `lbcSupprimeAnnonce`, `vcRepondre`, `vcOffre`, `vcPrix`) ou à la page
//      Vinted (`favoriPage`) ;
//   2. chaque écriture doit être PRÉCÉDÉE, dans sa fonction ou dans TOUS ses
//      appelants (en remontant jusqu'à la racine), de :
//        · un COMPTEUR (`compterAction` — 50/h, réserve 5, plafond du jour,
//          prudence, arrêt captcha, « Tout arrêter » pour les gestes auto) ;
//        · ET la SÉCURITÉ (`secuGeste` — repos, plafonds par type, « Tout
//          arrêter », anti-robot — ou `porteDiscretion` — rythme irrégulier,
//          un compte à la fois, ouverture de Vinted, séries décalées).
//      Une fonction qui porte les deux sans écrire elle-même (`gardeStricte`…)
//      compte comme les deux, sauf appelée avec `lecture: true`.
//   3. la pause 429/403 (`requeteVinted` → `vrmPauseVinted`) : `vintedPage` et
//      `vintedSend` passent par `requeteVinted` (vérifié sur leur texte).
//   4. EXÉCUTÉ : « Tout arrêter » posé et compteur plein ⇒ les commandes de
//      geste de l'app n'envoient AUCUNE requête d'écriture au faux Vinted.
//  Les EXCEPTIONS sont nommées ici, une par une, avec leur raison : une écriture
//  nouvelle qui n'est ni gardée ni nommée rend l'audit ROUGE.
//  `--src <ancien background.js>` : l'arbre d'avant (§6.1).
//  `--prouve` : chaque mutation (garde retirée) doit rendre l'audit ROUGE.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const { faireFond, cheminSource } = require('./_fond-vm.cjs');
const args = process.argv.slice(2);
const SRC0 = cheminSource();

// Garde retirée d'une route ⇒ ROUGE. (Chaque texte est cherché tel quel.)
const MUTATIONS = {
  reponseLbcSecu: ["const secuR = await secuGeste('leboncoin', compte, 'reponse', 'clic');", 'const secuR = null;'],
  pauseLbcSecu: ["const secuP = await secuGeste('leboncoin', compte, 'autre', 'clic');", 'const secuP = null;'],
  favoriReprise: ['const non = await arretAvantMessageFavori(e.uid, acc);', 'const non = "";'],
  gardeAuto: ["if (opts && opts.compter === false) return null;\n  const c = await compterAction(String(uid), ACTIONS_MAX_HEURE - RESERVE_GESTES);", "if (opts && opts.compter === false) return null;\n  const c = { ok: true };"],
  bordereauFile: ["const ri = await interfaceVinted(acc, 'bordereau',", "const ri = await etapeFormulaire(acc, 0, 'bordereau',"],
  interfaceFile: ["  return requeteVinted('page', async () => {\n    const pg = await pageVintedPour(acc);\n    if (pg.refus) { noterDiag('interface_' + pg.refus);", "  return (async (_k, f) => f())('page', async () => {\n    const pg = await pageVintedPour(acc);\n    if (pg.refus) { noterDiag('interface_' + pg.refus);"],
  baisseVc: ["const secuBp = await secuGeste('vestiaire', ot.compte, 'baisse', 'serie');", 'const secuBp = null;'],
  repondreLbc: ["const cpt = await compterAction('lbc:' + compte, ACTIONS_MAX_HEURE);\n    if (!cpt.ok && cpt.code === 'stockage')", "const cpt = { ok: true };\n    if (!cpt.ok && cpt.code === 'stockage')"],
  favoriVc: ["const sg = await secuGeste('vestiaire', ot.compte, 'favori', 'serie');", 'const sg = null;'],
  stricte: ["const secuC = await secuGeste('vinted', uid, opts.secu ? opts.secu.sorte : 'autre'", "const secuC = await Promise.resolve(null) && ('vinted', uid, opts.secu ? opts.secu.sorte : 'autre'"],
  pauseFile: ["async function vintedPage(acc, method, endpoint, body, options = {}) {\n  const domain = acc.domain || 'www.vinted.fr';\n  return requeteVinted('api', async () => {", "async function vintedPage(acc, method, endpoint, body, options = {}) {\n  const domain = acc.domain || 'www.vinted.fr';\n  return (async (_k, f) => f())('api', async () => {"],
};
if (args.includes('--prouve')) {
  let rates = 0;
  for (const m of Object.keys(MUTATIONS)) {
    let rouge = false;
    try { execFileSync(process.execPath, [__filename, `--mutation=${m}`], { stdio: 'pipe', timeout: 300000 }); } catch (e) { rouge = e.status === 1; }
    console.log(`${rouge ? '✅' : '❌'} mutation ${m} ⇒ ${rouge ? 'rouge' : 'RESTE VERT'}`);
    if (!rouge) rates++;
  }
  console.log(rates ? `\n❌ ${rates} mutation(s) non détectée(s)` : `\n✅ ${Object.keys(MUTATIONS).length}/${Object.keys(MUTATIONS).length} mutations détectées`);
  process.exit(rates ? 1 : 0);
}
let SRC = SRC0;
const mut = (args.find((a) => a.startsWith('--mutation=')) || '').slice(11);
if (mut) {
  const [a, b] = MUTATIONS[mut] || [];
  const s = fs.readFileSync(SRC0, 'utf8');
  if (!a || !s.includes(a)) { console.log('mutation introuvable : ' + mut); process.exit(2); }
  SRC = path.join(os.tmpdir(), `bg-gardees-${mut}-${process.pid}.js`);
  fs.writeFileSync(SRC, s.replace(a, b));
}

let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('✅ ' + m); } else { ko++; console.log('❌ ' + m + (d !== undefined ? '  → ' + String(d).slice(0, 600) : '')); } };

// Écritures qui ne prennent pas leur garde AU MOMENT d'écrire — chacune nommée, avec sa raison
// (CLAUDE.md §3) et ce qu'elle DOIT faire avant d'écrire (`avant` : appels exigés avant l'écriture,
// `mots` : présents dans la fonction). Une exception qui ne le fait plus ⇒ ROUGE.
const EXCEPTIONS = {
  // « Ce qui EST autorisé et automatique : générer un bordereau » (§3) — pas un geste vers un
  // acheteur ; il garde la file une-à-la-fois et la pause 429/403 (`vintedSend` → `requeteVinted`).
  genererBordereau: { raison: 'bordereau : autorisé et automatique (§3), par l’interface (file Vinted + pause 429/403)', avant: [], mots: ['interfaceVinted'] },
  // (5.414) `grilleTailles` n'écrit plus rien : la grille est LUE par la page « Vendre » (`grilleParPage`, aucun POST du fond).
  // La mise en ligne d'une republication : sa place a été RÉSERVÉE au départ de la paire (3 gestes
  // d'un coup, `tRes`), rendue si rien ne part ; « Tout arrêter » / vérification revus juste avant.
  finRepubBrouillon: { raison: 'place réservée au départ de la paire, rendue si rien ne part', avant: ['secuGeste', 'gardeStricte'], mots: ['tRes', 'rendreActions'] },
  // Le message au favori après l'offre acceptée, repris par un worker neuf : place réservée à l'offre
  // (`tRes`), rendue s'il ne part pas ; « Tout arrêter », captcha, pause, autre compte revus juste avant.
  reprendreMessagesFavoris: { raison: 'place réservée à l’offre, rendue si le message ne part pas', avant: ['arretAvantMessageFavori', 'tenirAttenteFavori'], mots: ['tRes', 'rendreActions'] },
};

const source = fs.readFileSync(SRC, 'utf8');
const F = faireFond({ src: SRC });
const C = F.ctx;
const noms = [...new Set([...source.matchAll(/^(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(/gm)].map((m) => m[1]))];
const corps = new Map();
for (const n of noms) { const f = C[n]; if (typeof f === 'function') corps.set(n, String(f)); }
dit(corps.size > 1000 && corps.size >= noms.length - 5, `les fonctions du vrai background.js sont chargées (${corps.size}/${noms.length})`);
// Le code hors des fonctions déclarées (écouteurs, constantes à flèches) : une racine.
let horsFonctions = source;
for (const b of corps.values()) horsFonctions = horsFonctions.split(b).join(' ');
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
for (const [n, b] of corps) corps.set(n, sansCommentaires(b));
horsFonctions = sansCommentaires(horsFonctions);

// 1. Les écritures.
const RE_ECRITURE = [
  { re: /\bvintedPage\s*\(\s*[\w.]+\s*,\s*([^,]+),/g, filtre: (m) => !/^\s*'GET'\s*$/.test(m[1]) },
  { re: /\bvintedSend\s*\(\s*[\w.]+\s*,\s*([^,]+),/g, filtre: (m) => !/^\s*'GET'\s*$/.test(m[1]) },
  { re: /\bvintedPagePhoto\s*\(/g, filtre: () => true },
  { re: /action\s*:\s*'(lbcRepondre|lbcPauseAnnonce|lbcPrixAnnonce|lbcSupprimeAnnonce|vcRepondre|vcOffre|vcPrix)'/g, filtre: () => true },
  { re: /vrm\s*:\s*'favoriPage'/g, filtre: () => true },
  // 5.414 (`toutinterface`) : les écritures passent par l'INTERFACE de vinted.fr — un geste de page qui écrit
  // (`interfaceVinted(acc, '<geste>'`, sauf l'ouverture d'une conversation), une étape d'écriture du formulaire
  // (`etapeFormulaire(…, 'brouillon' | 'supprimer' | 'publier')`), ou la mise en ligne d'un brouillon par sa page.
  { re: /\binterfaceVinted\s*\(\s*[\w.]+\s*,\s*'([a-zA-Z]+)'/g, filtre: (m) => m[1] !== 'ouvrir' },
  { re: /\betapeFormulaire\s*\([^)]*?'(brouillon|supprimer|publier)'/g, filtre: () => true },
  { re: /\bmiseEnLigneParPage\s*\(/g, filtre: () => true },
];
const PRIMITIVES = new Set(['vintedPage', 'vintedSend', 'vintedPagePhoto', 'interfaceVinted', 'etapeFormulaire', 'miseEnLigneParPage']);
const ecritures = [];
for (const [n, b] of corps) {
  if (PRIMITIVES.has(n)) continue;
  for (const { re, filtre } of RE_ECRITURE) { re.lastIndex = 0; let m; while ((m = re.exec(b))) if (filtre(m)) ecritures.push({ f: n, pos: m.index, quoi: m[0].slice(0, 60) }); }
}
dit(ecritures.length >= 25, `écritures repérées : ${ecritures.length} (dans ${new Set(ecritures.map((e) => e.f)).size} fonctions)`);

// 2. Les gardes.
const appels = (b, nom) => { const re = new RegExp(`(?<![\\w$.])${nom}\\s*\\(`, 'g'); const out = []; let m; while ((m = re.exec(b))) out.push(m.index); return out; };
const argsAppel = (b, pos) => { let i = b.indexOf('(', pos), p = 0, j = i; for (; j < b.length; j++) { if (b[j] === '(') p++; else if (b[j] === ')' && --p === 0) break; } return b.slice(i, j + 1); };
const ecrit = new Set(ecritures.map((e) => e.f));
// Un appel « sans engagement » (`lecture: true`, `compter: false`) ne garde rien.
const engage = (b, p) => !/lecture\s*:\s*true|compter\s*:\s*false/.test(argsAppel(b, p));
// Les enveloppes, calculées : une fonction qui N'ÉCRIT PAS et appelle (avec engagement) une garde
// est elle-même cette garde (`gardeStricte` → secuGeste + compterAction ; `garde` → compterAction).
const fermeture = (base) => {
  const g = new Set(base);
  for (let tour = 0; tour < 6; tour++) {
    let neuf = false;
    for (const [n, b] of corps) {
      if (g.has(n) || ecrit.has(n)) continue;
      if ([...g].some((x) => appels(b, x).some((p) => engage(b, p)))) { g.add(n); neuf = true; }
    }
    if (!neuf) break;
  }
  return g;
};
// ⚠️ Une enveloppe trop large rendrait l'audit aveugle : seules celles-ci sont admises (une
//    nouvelle doit être lue et ajoutée ici à la main).
const ADMISES_COMPTEUR = new Set(['compterAction', 'compterActionUn', 'gardeStricte', 'garde', 'gardeAction', 'autoriserGeste']);
const ADMISES_SECU = new Set(['secuGeste', 'gardeStricte']);
const COMPTEUR = [...fermeture(['compterAction'])].filter((n) => ADMISES_COMPTEUR.has(n));
const SECU = [...fermeture(['secuGeste'])].filter((n) => ADMISES_SECU.has(n));
dit(COMPTEUR.includes('gardeStricte') && COMPTEUR.includes('garde') && SECU.includes('gardeStricte'), `enveloppes : compteur ${COMPTEUR.join(', ')} · sécurité ${SECU.join(', ')}`);
const premiereGarde = (b, liste) => {
  let min = Infinity;
  for (const g of liste) for (const p of appels(b, g)) { if (!engage(b, p)) continue; if (p < min) min = p; }
  return min;
};
const garde = (b, pos) => ({ compteur: premiereGarde(b, COMPTEUR) < pos, secu: premiereGarde(b, SECU) < pos });
// Les appelants d'une fonction (appel direct, ou la fonction passée par référence).
const appelants = (nom) => {
  const out = [];
  const re = new RegExp(`(?<![\\w$.'"\`])${nom}(?![\\w$'"\`])`, 'g');
  for (const [n, b] of corps) { if (n === nom) continue; re.lastIndex = 0; let m; while ((m = re.exec(b))) { if (/function\s*\*?\s*$/.test(b.slice(Math.max(0, m.index - 12), m.index))) continue; out.push({ f: n, pos: m.index }); } }
  re.lastIndex = 0; if (re.test(horsFonctions)) out.push({ f: '(hors fonction)', pos: 0 });
  return out;
};
// Remonte : vrai si CHAQUE chemin jusqu'à une racine a sa garde avant l'appel.
const memo = new Map();
function gardeeDepuis(nom, besoin, vus = new Set()) {
  const cle = nom + '|' + besoin.compteur + besoin.secu;
  if (memo.has(cle)) return memo.get(cle);
  if (vus.has(nom)) return { ok: true };            // cycle : jugé sur les autres chemins
  vus.add(nom);
  const ap = appelants(nom);
  if (!ap.length) return { ok: false, chemin: [nom + ' (racine non gardée)'] };
  for (const a of ap) {
    if (a.f === '(hors fonction)') { memo.set(cle, { ok: false, chemin: [nom, 'appelée hors fonction'] }); return memo.get(cle); }
    const g = garde(corps.get(a.f), a.pos);
    const reste = { compteur: besoin.compteur && !g.compteur, secu: besoin.secu && !g.secu };
    if (!reste.compteur && !reste.secu) continue;
    const r = gardeeDepuis(a.f, reste, new Set(vus));
    if (!r.ok) { memo.set(cle, { ok: false, chemin: [nom, ...r.chemin] }); return memo.get(cle); }
  }
  memo.set(cle, { ok: true });
  return { ok: true };
}
const fautes = [];
const parFonction = new Map();
for (const e of ecritures) {
  if (EXCEPTIONS[e.f]) continue;
  const g = garde(corps.get(e.f), e.pos);
  const besoin = { compteur: !g.compteur, secu: !g.secu };
  if (!besoin.compteur && !besoin.secu) { parFonction.set(e.f, 'gardée dans la fonction'); continue; }
  const r = gardeeDepuis(e.f, besoin);
  if (r.ok) parFonction.set(e.f, 'gardée par ses appelants'); else fautes.push(`${e.f} · ${e.quoi} · manque ${besoin.compteur ? 'compteur ' : ''}${besoin.secu ? 'sécurité' : ''} · ${r.chemin.join(' ← ')}`);
}
dit(fautes.length === 0, `chaque écriture passe le compteur ET la sécurité avant de partir (${parFonction.size} fonctions gardées)`, '\n   ' + fautes.join('\n   '));
for (const [n, x] of Object.entries(EXCEPTIONS)) {
  const b = corps.get(n) || '';
  const pos = Math.min(...ecritures.filter((e) => e.f === n).map((e) => e.pos));
  const manque = [...x.avant.filter((g) => !(appels(b, g).some((p) => p < pos))), ...x.mots.filter((m) => !new RegExp(`\\b${m}\\b`).test(b))];
  dit(ecrit.has(n) && !manque.length, `exception ${n} — ${x.raison}`, ecrit.has(n) ? 'manque : ' + manque.join(', ') : 'plus d’écriture ici');
}
// L'exception « bordereau » garde quand même la file et la pause : `vintedSend` → `requeteVinted`.
// 3. Pause 429/403 et file une-à-la-fois.
for (const p of ['vintedPage', 'vintedSend', 'interfaceVinted']) dit(/requeteVinted\s*\(/.test(corps.get(p) || ''), `${p} passe par requeteVinted (une requête / un geste à la fois, pause 429/403)`);
dit(/pauseVinted|vrmPauseVinted/.test(corps.get('requeteVinted') || '') || /vrmPauseVinted/.test(source), 'requeteVinted connaît la pause posée sur un 429/403');

// 4. EXÉCUTÉ : « Tout arrêter » + compteur plein ⇒ aucune écriture.
(async () => {
  try {
    const t = Date.now();
    const f = faireFond({ src: SRC, store: { vrmActions: { 111: Array.from({ length: 50 }, (_, i) => t - i * 1000) } }, vinted: () => ({ status: 200, body: { item: { id: 9, price: { amount: '50' } } } }) });
    if (f.lignes.main === undefined) f.lignes.main = {};
    try { await f.ctx.poserToutArrete(true); } catch (_) {}
    const cmds = [
      { cmd: 'baisserPrixVinted', uid: '111', id: '9', nouveau: 40, prixVu: 50, confirme: true },
      { cmd: 'vacancesVinted', uid: '111', on: true, confirme: true },
      { cmd: 'republierVinted', uid: '111', id: '9', confirme: true },
      { cmd: 'recreerVinted', uid: '111', id: '9', confirme: true },
      { cmd: 'publierBrouillon', uid: '111', id: '9', confirme: true },
    ];
    for (const m of cmds) { try { await Promise.race([f.ctx.executerCommande(m), new Promise((r) => setTimeout(r, 3000))]); } catch (_) {} }
    try { await Promise.race([f.ctx.executerPourAppCoeur({ uid: '111', method: 'POST', endpoint: '/api/v2/conversations/5/replies', body: { reply: { body: 'x' } } }), new Promise((r) => setTimeout(r, 3000))]); } catch (_) {}
    const ecr = f.j.vinted.filter((r) => String(r.methode || r.method || 'GET').toUpperCase() !== 'GET');
    dit(ecr.length === 0, `exécuté : « Tout arrêter » + 50/50 ⇒ 0 écriture vers Vinted (${f.j.vinted.length} requêtes vues)`, JSON.stringify(ecr.slice(0, 3)));
  } catch (e) { dit(false, 'exécution des commandes — exception', e && e.stack); }
  console.log(`\n${ko ? '❌' : '✅'} audit-actions-gardees : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
