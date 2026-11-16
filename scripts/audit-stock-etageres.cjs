#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — LE STOCK EN ÉTAGÈRES : LA RÈGLE DES PILES ET LA REPRISE DE L'ANCIEN
//  RANGEMENT (15 nov. 2026 ; récit : docs/passation/2026-11-15-stock-etageres.md)
//
//  Julien : « une pile de boîtes : si on enlève celle tout en bas, celles du dessus
//  descendent toutes seules » ; « il faut que les numéros soient bien attribués ».
//  Exécute les VRAIES règles (src/stockEtageres.js, src/stockSortie.js,
//  src/cycleArticle.js, src/gesteAnnulable.js) sur des données INVENTÉES de la forme
//  mesurée en base (`vrm_meubles` = [{ id, name, cols, rows, gravite?, planches? }],
//  `vrm_slots` = { [N°]: { m, i } }), et lit l'écran Stock pour vérifier qu'il passe
//  par elles.
//
//   P  LA RÈGLE DES PILES
//     P1 sortie PROUVÉE (colis parti : `libererCasesPartis`) au bas d'une pile ⇒ ceux
//        du dessus descendent d'UN cran, dans l'ordre ; les N° (clés) sont les mêmes ;
//        seul `i` change ; la descente est rendue (`descentes`) pour être dite ;
//     P2 sortie NON prouvée ⇒ rien : aucun candidat (vendue pas partie), paire remise à
//        la main (`garder`), paire PAS MONTRÉE (compte écarté, lecture en cours) que
//        l'écran tasse ⇒ elle garde sa case, rien ne passe à travers ;
//     P3 deux sorties simultanées dans une pile ⇒ chacun descend du nombre de cases
//        vidées SOUS lui ; une autre colonne, un autre meuble ne bougent pas ;
//     P4 pile pleine : retirer le haut ⇒ rien ne bouge ; le bas ⇒ tout descend d'un ;
//     P5 ordre conservé, planche jamais traversée, colonne non empilée intacte ;
//     P6 « Enlever du stock » (`opsChezToi` + `sortieCase`) : la case ET la descente en
//        un geste ; « Annuler » rend tout (les cases d'avant, exactement) ;
//     P7 colonnes en pile choisies une par une (`piles`) : seules elles se tassent ;
//     P8 poser en haut d'une pile : la paire tombe sur la pile ; elle n'est pas dite « descendue ».
//   M  LA REPRISE (« migration » sans drapeau) : l'ancienne forme est lue telle quelle
//     M1 les deux meubles mesurés (4×8 sans gravité ; 7×10 `gravite: false`, `planches: []`)
//        et leur case ⇒ mêmes places (rangée, colonne), rien ne bouge à la lecture ;
//     M2 l'ordre des meubles d'hier (sans `ordre`) est celui de la liste ; un meuble
//        ajouté va à la fin ; monter / descendre garde TOUS les champs d'origine ;
//     M3 une valeur abîmée se lit (jamais d'exception) ; les couleurs suivent leur
//        rangée:colonne quand le nombre de colonnes change ;
//     M4 l'écran : la gravité n'est appliquée qu'à une écriture (`tasserApres` dans
//        `ecrireSlots`), jamais au montage ; le geste réécrit le meuble d'ORIGINE augmenté.
//
//  Sur le code d'avant (`git archive`, le banc copié DEDANS) : P1, P2 (paire pas
//  montrée), P3, P6, P7, M rougissent. `--prouve` : chaque mutation réaffaiblit la
//  règle ; l'audit DOIT rougir.
//    node scripts/audit-stock-etageres.cjs [--mutation=NOM | --prouve]
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const R = path.join(__dirname, '..');

const MUTATIONS = {
  'sans-gravite': ['src/stockEtageres.js', "    const piles = colonnesEnPile(m); if (!piles.size) continue;", "    const piles = new Set(); if (!piles.size) continue;"],
  'ordre-inverse': ['src/stockEtageres.js', "        tas.forEach(([ks, r0], j) => {", "        tas.reverse(); tas.forEach(([ks, r0], j) => {"],
  'un-cran-max': ['src/stockEtageres.js', "          const r1 = bas - j; if (r1 === r0) return;", "          const r1 = Math.min(bas - j, r0 + 1); if (r1 === r0) return;"],
  'planche-traversee': ['src/stockEtageres.js', "      for (let r = 1; r < rows; r++) if (pl.has(r + ':' + c)) bornes.push(r);", ""],
  'sortie-sans-tasser': ['src/stockSortie.js', "  const t = tasserPiles(out, seulement(ms, sortis.map((x) => x.meubleId)));", "  const t = { slots: out, descentes: [] };"],
  'garder-ignore': ['src/stockSortie.js', "    if (garder && garder[k]) continue;\n", ""],
  'tout-le-meuble': ['src/stockEtageres.js', "  for (const x of (Array.isArray(m.piles) ? m.piles : [])) { const c = Math.floor(Number(x)); if (c >= 1 && c <= cols) out.add(c); }", "  if (Array.isArray(m.piles) && m.piles.length) for (let c = 1; c <= cols; c++) out.add(c);"],
  'pose-dite-descente': ['src/stockEtageres.js', "descentes: r.descentes.filter((d) => !pose(d.cle)),", "descentes: r.descentes,"],
  'sites-par-titre': ['src/stockAnnonces.js', "    if (p.cle) cles.push('n:' + p.cle);", "    if (p.cle) cles.push('n:' + p.cle); if (p.titre) cles.push('t:' + p.titre);"],
  'pseudo-identifiant': ['src/stockAnnonces.js', "return t && !/^(#|n°\\s)/i.test(t) && !/^\\d{5,}$/.test(t) ? t.slice(0, 40) : '';", "return t;"],
  'pseudo-uid': ['src/ecrans/Stock.jsx', "pseudo: String(acc.login || acc.username || ''),", "pseudo: String(acc.login || acc.username || uid),"],
  'ebay-vieux-en-ligne': ['src/stockAnnonces.js', "const etat = p.frais === false && p.etat === 'enligne' ? 'aconfirmer' : p.etat;", "const etat = p.etat;"],
  'annuler-partiel': ['src/stockEtageres.js', "  for (const d of r.descentes) ops.push(", "  for (const d of []) ops.push("],
  'placer-echange': ['src/stockEtageres.js', "  const tri = l.slice(); const [x] = tri.splice(k, 1); tri.splice(j, 0, x);", "  const tri = l.slice(); const x = tri[k]; tri[k] = tri[j]; tri[j] = x;"],
  'ordre-ignore': ['src/stockEtageres.js', "    .sort((a, b) => (a[1] - b[1]) || (a[2] - b[2])).map((x) => x[0]);", "    .map((x) => x[0]);"],
  'deplacer-recopie': ['src/stockEtageres.js', "place.has(String(m.id)) ? { ...m, ordre: place.get(String(m.id)) } : m));", "place.has(String(m.id)) ? { id: m.id, name: m.name, cols: m.cols, rows: m.rows, ordre: place.get(String(m.id)) } : m));"],
  'couleurs-par-index': ['src/stockEtageres.js', "export const cleCase = (i, m) => { const { cols } = dims(m); return `${Math.floor(i / cols) + 1}:${(i % cols) + 1}`; };", "export const cleCase = (i, m) => `${Math.floor(i / 4) + 1}:${(i % 4) + 1}`;"],
  'ecran-montrees': ['src/ecrans/Stock.jsx', "const r = tasserApres(slots, u, ms || meubles, ids);", "const r = tasserApres(slots, Object.fromEntries(Object.entries(u).filter(([k]) => ficheParCle[k])), ms || meubles, ids);"],
  'ecran-au-montage': ['src/ecrans/Stock.jsx', "  const meublesVus = ordonner(meubles);", "  const meublesVus = ordonner(meubles); React.useEffect(() => { const t = tasserApres({}, slots, meubles, meubles.map((x) => x.id)); if (t.descentes.length) ecrireSlotsBrut(t.slots); }, []);"],
};

const arg = process.argv.slice(2);
const mut = (arg.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';
if (arg.includes('--prouve')) {
  let ok = 0;
  for (const m of Object.keys(MUTATIONS)) {
    const r = spawnSync(process.execPath, [__filename, '--mutation=' + m], { encoding: 'utf8' });
    const rouges = ((r.stdout || '').match(/^❌/gm) || []).length;
    const bon = r.status !== 0 && rouges > 0;
    console.log(`${bon ? '✅' : '❌'} mutation « ${m} » : ${rouges} rouge(s)`);
    if (bon) ok++;
  }
  console.log(`\n${ok}/${Object.keys(MUTATIONS).length} mutations attrapées.`);
  process.exit(ok === Object.keys(MUTATIONS).length ? 0 : 1);
}

let ko = 0, n = 0;
const dit = (c, msg, det) => { n++; if (c) console.log('✅ ' + msg); else { ko++; console.log('❌ ' + msg + (det !== undefined ? ' — ' + JSON.stringify(det).slice(0, 500) : '')); } };
const essaie = async (nom, f) => { try { await f(); } catch (e) { ko++; n++; console.log('❌ ' + nom + ' a levé : ' + String(e && e.message || e).slice(0, 300)); } };

(async () => {
  // Les règles, copiées dans un dossier (la mutation y est posée).
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'etag-'));
  fs.mkdirSync(path.join(dir, 'src', 'ecrans'), { recursive: true });
  const FICHIERS = ['src/stockEtageres.js', 'src/stockRegles.js', 'src/stockSortie.js', 'src/cycleArticle.js', 'src/gesteAnnulable.js', 'src/ecrans/Stock.jsx', 'src/stockAnnonces.js'];
  // (15 nov., sites sur la case) La règle de Vestiaire importée par stockAnnonces.js : api/_lib copié tel quel.
  fs.mkdirSync(path.join(dir, 'api', '_lib'), { recursive: true });
  for (const f of fs.readdirSync(path.join(R, 'api', '_lib'))) if (f.endsWith('.js')) fs.copyFileSync(path.join(R, 'api', '_lib', f), path.join(dir, 'api', '_lib', f));
  const texte = {};
  for (const f of FICHIERS) { const p = path.join(R, f); texte[f] = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null; }
  if (mut) {
    const m = MUTATIONS[mut]; if (!m) { console.log('mutation inconnue : ' + mut); process.exit(2); }
    if (!texte[m[0]] || !texte[m[0]].includes(m[1])) { console.log('❌ ancre de mutation introuvable : ' + mut); process.exit(1); }
    texte[m[0]] = texte[m[0]].replace(m[1], m[2]);
  }
  // (16 nov.) api/_lib (copié tel quel) importe des règles de src/ (argent-notif.js → alertesSeuils.js → …) : les modules
  // purs de src/ (premier niveau) sont copiés tels quels, sous les fichiers jugés (qui gardent leur texte, mutations comprises).
  for (const f of fs.readdirSync(path.join(R, 'src'))) if (f.endsWith('.js') && !FICHIERS.includes('src/' + f)) fs.copyFileSync(path.join(R, 'src', f), path.join(dir, 'src', f));
  for (const f of FICHIERS) if (texte[f] != null && f.endsWith('.js')) fs.writeFileSync(path.join(dir, f), texte[f]);
  const imp = async (f) => { if (texte[f] == null) return { __absent: true }; try { return await import(pathToFileURL(path.join(dir, f)).href); } catch (e) { return { __erreur: String(e && e.message || e) }; } };
  const E = await imp('src/stockEtageres.js'), S = await imp('src/stockSortie.js'), Y = await imp('src/cycleArticle.js'), G = await imp('src/gesteAnnulable.js');
  const A = await imp('src/stockAnnonces.js');
  dit(!E.__absent && !E.__erreur && typeof E.tasserPiles === 'function', 'la règle des étagères existe et se charge (src/stockEtageres.js)', E.__erreur || (E.__absent ? 'absente' : undefined));
  dit(typeof S.libererCasesPartis === 'function', 'la sortie automatique se charge (src/stockSortie.js)', S.__erreur);
  const stock = texte['src/ecrans/Stock.jsx'] || '';
  const sansCom = stock.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/[^\n]*$/gm, '');

  // LA RÈGLE DE L'ÉCRAN, telle qu'il l'appelle à chaque écriture des cases :
  //   nouveau : `tasserApres(avant, apres, meubles)` (il ne sait rien des paires montrées) ;
  //   avant   : `tasserMeuble(slots, m, presents)` de l'écran, extrait et exécuté (presents = les paires MONTRÉES).
  let regleEcran = null, origineRegle = '';
  if (typeof E.tasserApres === 'function') {
    const appel = /const r = tasserApres\(slots, ([^,]+(?:\([^)]*\)[^,]*)*), ms \|\| meubles, ids\);/.exec(sansCom);
    // Un écran qui filtrerait les cases par paire montrée avant de tasser (le défaut d'avant) est jugé comme tel.
    const filtreMontrees = !appel || /ficheParCle/.test(appel[1]);
    regleEcran = (avant, apres, meubles, montres) => E.tasserApres(avant, filtreMontrees ? Object.fromEntries(Object.entries(apres).filter(([k]) => montres.includes(k))) : apres, meubles).slots;
    origineRegle = filtreMontrees ? 'écran : tasse les seules paires montrées' : 'tasserApres';
  } else {
    const i = stock.indexOf('function tasserMeuble(');
    if (i >= 0) {
      const j = stock.indexOf('\n}\n', i);
      const R0 = await imp('src/stockRegles.js');
      // eslint-disable-next-line no-new-func
      const tm = new Function('planchesCases', stock.slice(i, j + 2) + '\nreturn tasserMeuble;')(R0.planchesCases);
      regleEcran = (avant, apres, meubles, montres) => meubles.reduce((cur, m) => tm(cur, m, new Set(montres)).slots, apres);
      origineRegle = 'tasserMeuble (écran d’avant)';
    }
  }
  console.log('   (règle de l’écran jugée : ' + (origineRegle || 'aucune') + ')');

  const PILE = { id: 'p1', name: 'Pile de boîtes', cols: 1, rows: 5, type: 'pile', gravite: true };
  // Une pile pleine, du bas (i 4) vers le haut (i 0) : 31, 32, 33, 34, 35.
  const pleine = () => ({ '31': { m: 'p1', i: 4 }, '32': { m: 'p1', i: 3 }, '33': { m: 'p1', i: 2 }, '34': { m: 'p1', i: 1 }, '35': { m: 'p1', i: 0 } });
  const cles = (o) => Object.keys(o).sort().join(',');

  // ── P1 ─────────────────────────────────────────────────────────────────────
  await essaie('P1', async () => {
    const sl = pleine(); const avant = JSON.stringify(sl);
    const r = S.libererCasesPartis({ slots: sl, meubles: [PILE], candidats: [{ cle: '31', num: '31', plateforme: 'Vinted' }] });
    dit(!r.slots['31'] && r.slots['32'].i === 4 && r.slots['33'].i === 3 && r.slots['34'].i === 2 && r.slots['35'].i === 1, 'P1 · colis de N°31 parti (bas de la pile) ⇒ N°32…N°35 descendent d’UN cran', r.slots);
    dit(cles(r.slots) === '32,33,34,35' && Object.values(r.slots).every((v) => v.m === 'p1'), 'P1 · les N° restent les mêmes (seule la case change, jamais le numéro)', cles(r.slots));
    dit(Array.isArray(r.descentes) && r.descentes.map((d) => d.cle).join(',') === '32,33,34,35' && r.descentes.every((d) => d.crans === 1), 'P1 · la descente est rendue pour être DITE (N°32, 33, 34, 35 · un cran)', r.descentes);
    dit(r.sortis[0] && Array.isArray(r.sortis[0].descendus) && r.sortis[0].descendus.join(',') === '32,33,34,35', 'P1 · le journal de la sortie dit qui est descendu', r.sortis[0]);
    dit(JSON.stringify(sl) === avant, 'P1 · l’objet d’entrée n’est jamais modifié');
  });

  // ── P2 ─────────────────────────────────────────────────────────────────────
  await essaie('P2', async () => {
    const sl = pleine();
    const r0 = S.libererCasesPartis({ slots: sl, meubles: [PILE], candidats: [] });
    dit(r0.slots === sl && (!r0.descentes || r0.descentes.length === 0), 'P2 · vendue mais colis pas parti (aucun candidat) ⇒ rien ne bouge');
    const r1 = S.libererCasesPartis({ slots: sl, meubles: [PILE], candidats: [{ cle: '31', num: '31' }], garder: { '31': 1 } });
    dit(r1.slots === sl, 'P2 · paire remise à la main (garder) ⇒ jamais sortie toute seule, rien ne bouge');
    const r2 = S.libererCasesPartis({ slots: sl, meubles: [PILE], candidats: [{ cle: '3', num: '3' }] });
    dit(r2.slots === sl, 'P2 · « 3 » ne sort pas N°31 ni N°33 (identité de numéro)');
    // L'écran : N°31 (en bas) appartient à un compte écarté — pas montrée. Il retire N°35 (en haut) par son clic.
    dit(typeof regleEcran === 'function', 'P2 · la règle de l’écran est lisible');
    if (regleEcran) {
      const apres = pleine(); delete apres['35'];
      const t = regleEcran(pleine(), apres, [PILE], ['32', '33', '34', '35']);
      dit(t['31'] && t['31'].i === 4 && t['32'].i === 3 && t['33'].i === 2 && t['34'].i === 1, 'P2 · une paire PAS MONTRÉE (compte écarté) garde sa case : rien ne descend à travers son carton', t);
      // Pendant le chargement (aucune paire montrée), poser N°36 en haut ne fait rien tomber à travers les autres.
      const a2 = { ...pleine() }; delete a2['35']; const p2 = { ...a2, '36': { m: 'p1', i: 0 } };
      const t2 = regleEcran(a2, p2, [PILE], ['36']);
      dit(t2['31'].i === 4 && t2['34'].i === 1 && t2['36'].i === 0, 'P2 · lecture pas arrivée : poser en haut ne fait passer personne à travers les cartons notés', t2);
    }
  });

  // ── P3 ─────────────────────────────────────────────────────────────────────
  await essaie('P3', async () => {
    const DEUX = { id: 'e2', name: 'Étagère', cols: 2, rows: 4, gravite: true };
    const AUTRE = { id: 'p2', name: 'Autre pile', cols: 1, rows: 3, type: 'pile' };
    const sl = { '41': { m: 'e2', i: 6 }, '42': { m: 'e2', i: 4 }, '43': { m: 'e2', i: 2 }, '44': { m: 'e2', i: 0 }, '51': { m: 'e2', i: 7 }, '52': { m: 'e2', i: 5 }, '61': { m: 'p2', i: 2 }, '62': { m: 'p2', i: 1 } };
    const r = S.libererCasesPartis({ slots: sl, meubles: [DEUX, AUTRE], candidats: [{ cle: '41', num: '41' }, { cle: '43', num: '43' }] });
    dit(r.slots['42'].i === 6 && r.slots['44'].i === 4, 'P3 · deux sorties dans la même colonne ⇒ N°42 descend d’un cran, N°44 de deux (les cases vidées SOUS lui)', r.slots);
    dit(r.slots['51'].i === 7 && r.slots['52'].i === 5 && r.slots['61'].i === 2 && r.slots['62'].i === 1, 'P3 · l’autre colonne et l’autre meuble ne bougent pas');
    const d44 = (r.descentes || []).find((d) => d.cle === '44');
    dit(!!d44 && d44.crans === 2, 'P3 · la descente de deux crans est dite (crans = 2)', r.descentes);
  });

  // ── P4 ─────────────────────────────────────────────────────────────────────
  await essaie('P4', async () => {
    const h = E.sortirDeCases({ slots: pleine(), meubles: [PILE], cles: ['35'] });
    dit(h.descentes.length === 0 && h.slots['31'].i === 4 && h.slots['34'].i === 1, 'P4 · pile pleine, celle du HAUT sort ⇒ rien ne bouge', h);
    const b = E.sortirDeCases({ slots: pleine(), meubles: [PILE], cles: ['31'] });
    dit(b.descentes.length === 4 && b.descentes.every((d) => d.crans === 1), 'P4 · pile pleine, celle du BAS sort ⇒ les quatre descendent d’un cran', b.descentes);
    const t = E.tasserPiles(pleine(), [PILE]);
    dit(t.descentes.length === 0, 'P4 · une pile déjà tassée ne bouge pas (idempotent)');
  });

  // ── P5 ─────────────────────────────────────────────────────────────────────
  await essaie('P5', async () => {
    const r = E.sortirDeCases({ slots: pleine(), meubles: [PILE], cles: ['33'] });
    const ordre = Object.entries(r.slots).sort((a, b) => b[1].i - a[1].i).map((x) => x[0]).join(',');
    dit(ordre === '31,32,34,35' && r.slots['31'].i === 4 && r.slots['32'].i === 3, 'P5 · N°33 (au milieu) sort ⇒ ceux du DESSOUS restent, ceux du dessus descendent, ordre gardé', r.slots);
    const PL = { id: 'pl', name: 'Étagère à planche', cols: 1, rows: 4, gravite: true, planches: [2] };
    const s2 = { '71': { m: 'pl', i: 3 }, '72': { m: 'pl', i: 2 }, '73': { m: 'pl', i: 1 }, '74': { m: 'pl', i: 0 } };
    const r2 = E.sortirDeCases({ slots: s2, meubles: [PL], cles: ['71'] });
    dit(r2.slots['72'].i === 3 && r2.slots['73'].i === 1 && r2.slots['74'].i === 0, 'P5 · une planche n’est jamais traversée (N°73, N°74 restent au-dessus)', r2.slots);
    const FIXE = { id: 'fx', name: 'Casier', cols: 1, rows: 3 };
    const r3 = E.sortirDeCases({ slots: { '81': { m: 'fx', i: 2 }, '82': { m: 'fx', i: 1 } }, meubles: [FIXE], cles: ['81'] });
    dit(r3.descentes.length === 0 && r3.slots['82'].i === 1, 'P5 · un meuble pas empilé garde son trou');
  });

  // ── P6 ─────────────────────────────────────────────────────────────────────
  await essaie('P6', async () => {
    const S0 = pleine();
    const sortieCase = typeof E.opsSortieCases === 'function' ? (k) => E.opsSortieCases({ slots: S0, meubles: [PILE], cles: [k] }).ops : null;
    const r = Y.opsChezToi({ carte: { id: 'a31', numero: '31', title: 'Paire inventée' }, reponse: 'enleve', decisions: {}, perdues: {}, slots: S0, plusTard: {}, sortieCase, cle: (x) => String(x) });
    const opsS = (r && r.ops || []).filter((o) => o.k === 'vrm_slots');
    const apres = G.appliquerOps(S0, opsS, 'apres');
    dit(!apres['31'] && apres['32'] && apres['32'].i === 4 && apres['35'].i === 1, '« Enlever du stock » N°31 ⇒ sa case ET la descente, en UN geste', apres);
    const retour = G.appliquerOps(apres, opsS, 'avant');
    dit(JSON.stringify(Object.entries(retour).sort()) === JSON.stringify(Object.entries(S0).sort()), 'P6 · « Annuler » rend toutes les cases d’avant, exactement', retour);
    const r2 = Y.opsChezToi({ carte: { id: 'a99', numero: '99', title: 'Sans case' }, reponse: 'enleve', decisions: {}, perdues: {}, slots: S0, plusTard: {}, sortieCase, cle: (x) => String(x) });
    dit(!(r2.ops || []).some((o) => o.k === 'vrm_slots'), 'P6 · un N° sans case : aucune case touchée');
  });

  // ── P8 : poser en haut d'une pile n'est pas une « descente » des autres ─────────
  await essaie('P8', async () => {
    const av = { '31': { m: 'p1', i: 4 } }; const ap = { ...av, '32': { m: 'p1', i: 0 } };
    const r = E.tasserApres(av, ap, [PILE]);
    dit(r.slots['32'].i === 3 && r.slots['31'].i === 4, 'P8 · N°32 posée en haut tombe sur N°31 (rangée 4)', r.slots);
    dit(r.descentes.length === 0 && (r.chutes || []).length === 1, 'P8 · la paire posée n’est pas dite « descendue » (sa case finale est dite par la pose) ; N°31 ne bouge pas', r);
  });

  // ── P7 ─────────────────────────────────────────────────────────────────────
  await essaie('P7', async () => {
    const M = { id: 'mx', name: 'Mixte', cols: 3, rows: 3, piles: [2] };
    const sl = { 'a': { m: 'mx', i: 6 }, 'b': { m: 'mx', i: 3 }, 'c': { m: 'mx', i: 7 }, 'd': { m: 'mx', i: 4 }, 'e': { m: 'mx', i: 1 } };
    const r = E.sortirDeCases({ slots: sl, meubles: [M], cles: ['a', 'c'] });
    dit(r.slots['b'].i === 3 && r.slots['d'].i === 7 && r.slots['e'].i === 4, 'P7 · seule la colonne 2 (en pile) se tasse ; la colonne 1 garde son trou', r.slots);
  });

  // ── S : LES SITES ET LE COMPTE SUR LA CASE, PAR IDENTITÉ ────────────────────
  await essaie('S', async () => {
    dit(typeof A.annoncesActuelles === 'function' && typeof A.sitesDe === 'function', 'S · la règle des sites d’une paire existe (src/stockAnnonces.js `sitesDe`)', A.__erreur);
    const numeros = { '501': { numero: '12', title: 'Air Max 90 blanche 42' }, '502': { numero: '13', title: 'Air Max 90 blanche 42' } };
    const r = A.annoncesActuelles({
      vinted: [{ uid: '111', nom: 'boutique_nord', pseudo: 'boutique_nord', ok: true, enLigne: [{ id: '501', title: 'Air Max 90 blanche 42', price: { amount: '80.0' } }], aConfirmer: [], masquees: [] },
               { uid: '222', nom: '222', pseudo: '', ok: true, enLigne: [], aConfirmer: [], masquees: [{ id: '502', title: 'Air Max 90 blanche 42' }] }],
      numeros, cle: (x) => String(x),
      // Leboncoin : une annonce au MÊME titre que N°12, mais portant le N°13 (sa référence) ; eBay : N°12 par SKU, lu il y a 3 jours.
      lbc: [{ numero: '13', title: 'Air Max 90 blanche 42', etat: 'enligne', pseudo: 'nord_lbc' }],
      ebay: { liste: [{ numero: '12', title: 'Autre titre', pseudo: 'nord_ebay', frais: false }], illisibles: [] },
      vestiaire: undefined,
    });
    const a12 = r.articles.find((x) => x.cle === '12') || {}, a13 = r.articles.find((x) => x.cle === '13') || {};
    const s12 = (a12.sites || []).map((x) => x.plat + ':' + x.etat + ':' + x.pseudo).join(',');
    const s13 = (a13.sites || []).map((x) => x.plat + ':' + x.etat + ':' + x.pseudo).join(',');
    dit(s12 === 'vinted:enligne:boutique_nord,ebay:aconfirmer:nord_ebay', 'S1 · N°12 : Vinted en ligne (boutique_nord) et eBay par son SKU — lu il y a plus de 24 h ⇒ « à confirmer »', s12);
    dit(!/leboncoin/.test(s12), 'S2 · une annonce Leboncoin au MÊME titre mais d’une autre paire (N°13) ne s’ajoute pas à N°12', s12);
    dit(/leboncoin:enligne:nord_lbc/.test(s13) && /vinted:masquee:/.test(s13), 'S2 · N°13 : Leboncoin (sa référence) et Vinted « masquée par Vinted » (présente, pas en ligne)', s13);
    const v13 = (a13.sites || []).find((x) => x.plat === 'vinted') || {};
    dit(v13.pseudo === '', 'S3 · pseudo inconnu (compte sans login) ⇒ rien, jamais l’identifiant « 222 »', v13);
    dit(a12.etat === 'enligne' && (a12.sites || []).find((x) => x.plat === 'vinted').prix === 80, 'S4 · l’état de l’article ne change pas ; le prix lu est rendu (80)', a12);
    const r2 = A.annoncesActuelles({ vinted: [{ uid: '9', nom: '#9', pseudo: '#123456', ok: true, enLigne: [{ id: '501' }], aConfirmer: [], masquees: [] }], numeros, cle: (x) => String(x), lbc: [], ebay: { liste: [], illisibles: [] } });
    dit(((r2.articles[0] || {}).sites || [])[0] && r2.articles[0].sites[0].pseudo === '', 'S3 · un « pseudo » qui est un identifiant (« #123456 ») n’est jamais écrit', r2.articles[0]);
    const lit = /pseudo: String\(acc\.login \|\| acc\.username \|\| ''\)/.test(sansCom);
    dit(lit, 'S3 · l’écran prend le login du compte Vinted, jamais son uid, comme pseudo');
  });

  // ── M : LA REPRISE DE L'ANCIENNE FORME ──────────────────────────────────────
  await essaie('M1', async () => {
    // La forme MESURÉE en base (15 nov., lecture seule) — noms et identifiants inventés.
    const anciens = [{ id: 'mA', name: 'Garage', cols: 4, rows: 8 }, { id: 'mB', name: 'Bureau', cols: 7, rows: 10, gravite: false, planches: [] }];
    const slots = { '12': { m: 'mB', i: 22 } };
    const lu = anciens.map((m) => E.lireMeuble(m));
    dit(lu[0].cols === 4 && lu[0].rows === 8 && lu[1].cols === 7 && lu[1].rows === 10, 'M1 · les dimensions d’hier sont lues telles quelles (4×8, 7×10)', lu);
    dit(E.colonnesEnPile(anciens[0]).size === 0 && E.colonnesEnPile(anciens[1]).size === 0, 'M1 · aucun meuble d’hier ne devient une pile');
    dit(E.colonnesEnPile({ id: 'g', cols: 3, rows: 2, gravite: true }).size === 3, 'M1 · un meuble d’hier « empilé » (gravite) reste empilé, toutes ses colonnes');
    const t = E.tasserPiles(slots, anciens);
    dit(t.slots === slots && t.descentes.length === 0, 'M1 · la lecture ne déplace rien (même objet)');
    const p = E.cleCase(22, anciens[1]);
    dit(p === '4:2', 'M1 · la case 22 du meuble 7×10 reste « rangée 4, colonne 2 »', p);
    const trous = { '1': { m: 'mA', i: 31 }, '2': { m: 'mA', i: 0 } };
    dit(E.tasserPiles(trous, anciens).slots === trous, 'M1 · un meuble pas empilé garde ses trous à la lecture');
  });
  await essaie('M2', async () => {
    const anciens = [{ id: 'mA', name: 'Garage', cols: 4, rows: 8 }, { id: 'mB', name: 'Bureau', cols: 7, rows: 10, gravite: false, planches: [] }];
    dit(E.ordonner(anciens).map((m) => m.id).join(',') === 'mA,mB', 'M2 · l’ordre d’hier (sans `ordre`) est celui de la liste');
    dit(E.ordonner([...anciens, { id: 'mC', name: 'Neuf', cols: 1, rows: 5, ordre: 2 }]).map((m) => m.id).join(',') === 'mA,mB,mC', 'M2 · un meuble ajouté va à la fin');
    const u = E.deplacerMeuble(anciens, 'mB', -1);
    dit(u && E.ordonner(u).map((m) => m.id).join(',') === 'mB,mA', 'M2 · « monter » le Bureau le met en premier');
    dit(u && u[1].gravite === false && Array.isArray(u[1].planches) && u[1].cols === 7 && u[1].rows === 10 && u[1].name === 'Bureau', 'M2 · un déplacement garde TOUS les champs d’origine', u && u[1]);
    dit(E.deplacerMeuble(anciens, 'mA', -1) === null, 'M2 · le premier ne monte pas plus haut (rien n’est écrit)');
    // (16 nov., design-restes) Glisser au doigt : poser un meuble au rang voulu, les autres gardent leur ordre relatif.
    const trois = [...anciens, { id: 'mC', name: 'Cave', cols: 2, rows: 2, ordre: 2 }];
    const g = typeof E.placerMeuble === 'function' ? E.placerMeuble(trois, 'mA', 2) : null;
    dit(g && E.ordonner(g).map((m) => m.id).join(',') === 'mB,mC,mA', 'M2 · glisser le Garage tout en bas : Bureau, Cave, Garage', g && E.ordonner(g).map((m) => m.id));
    const g2 = typeof E.placerMeuble === 'function' ? E.placerMeuble(trois, 'mC', 0) : null;
    dit(g2 && E.ordonner(g2).map((m) => m.id).join(',') === 'mC,mA,mB' && g2[1].gravite === false && g2[1].cols === 7, 'M2 · glisser la Cave en haut garde l’ordre des autres et TOUS leurs champs', g2 && E.ordonner(g2).map((m) => m.id));
    dit(typeof E.placerMeuble === 'function' && E.placerMeuble(trois, 'mB', 1) === null, 'M2 · posé à sa place : rien n’est écrit');
  });
  await essaie('M3', async () => {
    let ok = true, l = null;
    try { l = E.lireMeuble({ id: 'z', name: '', cols: 'abc', rows: -3, couleur: 'violet', couleurs: { '1:1': 'rouge', 'x': 'ciel', '2:1': 'sauge' }, piles: ['a', 9] }); } catch (_) { ok = false; }
    dit(ok && l && l.cols === 1 && l.rows === 1 && l.couleur === null && l.piles.length === 0 && Object.keys(l.couleurs).length === 0, 'M3 · une valeur abîmée se lit (≥ 1 × 1, couleur inconnue ⇒ aucune, jamais d’exception)', l);
    const m = { id: 'c', cols: 3, rows: 2, couleurs: { '1:3': 'sable' } };
    dit(E.couleurCase(m, 2).couleur === 'sable', 'M3 · la couleur de la case rangée 1, colonne 3');
    const m4 = { ...m, cols: 5 };
    dit(E.couleurCase(m4, 2).couleur === 'sable' && E.couleurCase(m4, 3).couleur === null, 'M3 · 5 colonnes au lieu de 3 : la couleur reste sur rangée 1, colonne 3', [E.couleurCase(m4, 2), E.couleurCase(m4, 3)]);
    dit(!E.COULEURS.some((c) => /rouge|red|violet|purple|magenta|rose/i.test(c)), 'M3 · la palette n’a ni rouge (doublon) ni violet');
  });
  await essaie('M4', async () => {
    dit(/const r = tasserApres\(slots, u, ms \|\| meubles, ids\);/.test(sansCom), 'M4 · l’écran tasse à l’écriture, par la règle partagée, avec TOUTES les cases (pas seulement celles montrées)');
    const corps = sansCom.slice(sansCom.indexOf('function StockMeubles('), sansCom.indexOf('function EditeurMeuble('));
    const appels = (corps.match(/tasser(Apres|Piles)\(/g) || []).length;
    dit(appels === 1, 'M4 · aucune autre gravité dans l’écran (rien au montage, rien à la lecture)', appels);
    dit(/\{ \.\.\.x, name: nom, cols, rows, planches, gravite, \.\.\.plus \}/.test(corps), 'M4 · « Enregistrer » réécrit le meuble d’ORIGINE augmenté (`{ ...x, … }`)');
    dit(!/save\('vrm_meubles'[^)]*\)\s*;?\s*\}\s*,\s*\[\]\)/.test(corps), 'M4 · aucun meuble réécrit au montage');
    dit(/askConfirm\(\{ title: tr\('etag\.retrecir'/.test(corps), 'M4 · un meuble rétréci DEMANDE avant de faire sortir des paires de leur case');
  });

  console.log(`\n${n - ko}/${n} contrôles verts${ko ? ` — ${ko} rouge(s)` : ''}.`);
  process.exit(ko ? 1 : 0);
})();
