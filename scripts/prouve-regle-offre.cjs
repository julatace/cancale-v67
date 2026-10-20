// ════════════════════════════════════════════════════════════════════════════
//  LA RÈGLE D'OFFRE eBAY — PREUVE PAR MUTATION (9 octobre)
//        node scripts/prouve-regle-offre.cjs [--avant dossier] [--seule nom]
//
//  « La fonction n'existait pas avant » ne prouve rien (CLAUDE.md §6) : il faut
//  montrer que les contrôles attrapent la RÈGLE fautive. Pour chaque mutation :
//    1. copie de l'arbre COURANT (api/, src/, scripts/ — fichiers non commités
//       compris ; jamais les fixtures `scripts/bancs/fx`) dans
//       os.tmpdir()/mut-regle-{nom} — le dépôt n'est JAMAIS touché ;
//    2. UN remplacement de texte (ancre exacte ; ancre introuvable ⇒ ROUGE
//       « mutation non appliquée » : une mutation qui ne mord rien ne prouve
//       rien) ;
//    3. `audit-ebay-route.cjs --src <copie>` doit sortir ≠ 0 ET montrer en
//       rouge les contrôles nommés.
//  Puis « le même XML qu'avant » (D7) : `_xml-publication.cjs` lancé sur la
//  base d'avant (`--avant`, sinon /tmp/avant-regle) et sur l'arbre courant —
//  sorties identiques au caractère près (et avec `offre: null` aussi).
//  Et `audit-offres-auto.cjs` doit passer au rouge sur une route qui appelle
//  `RespondToBestOffer` (c'est eBay qui accepte, jamais VRM).
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const os = require('os');
const cp = require('child_process');
const RACINE = path.join(__dirname, '..');
const iAv = process.argv.indexOf('--avant');
const AVANT = iAv > 0 ? path.resolve(process.argv[iAv + 1]) : path.join(os.tmpdir(), 'avant-regle');
const iSeule = process.argv.indexOf('--seule');
const SEULE = iSeule > 0 ? process.argv[iSeule + 1] : null;

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };

// Les mutations : [nom, fichier, ancre, remplacement, contrôles qui doivent rougir]
const API = 'api/ebay.js';
const LIB = 'api/_lib/ebay.js';
const APP = 'src/App.jsx';
const MUTATIONS = [
  ['seuil-prix', API, "  if (!v2.ok) return { status: 409, body: { ok: false, reason: v2.code, prix: pre.annonce.prix, error: v2.err } };", '', ['R-prix']],
  ['confirme', API, "  if (b.confirme !== true) return { status: 400, body: { ok: false, reason: 'confirmation', error: 'Confirme la règle d\\'offre", "  if (false) return { status: 400, body: { ok: false, reason: 'confirmation', error: 'Confirme la règle d\\'offre", ['R-conf']],
  ['prix-vu', API, '  if (pose && cents(prixVu) !== cents(pre.annonce.prix)) {', '  if (false) {', ['R-prixvu']],
  ['sous-moitie', API, [
    ['    if (seuilTropBas(accepte, prixVu) && b.sousMoitie !== true) return', '    if (false) return'],
    ['  if (v.accepte != null && seuilTropBas(v.accepte, prix) && o.sousMoitie !== true) return', '  if (false) return'],
  ], null, ['R-sous-moitie', 'R-crea']],
  ['attendu', API, [
    ["    if (a && typeof a === 'object' && (cents(a.accepte) !== cents(P.accepte) || cents(a.refuse) !== cents(P.refuse))) {", '    if (false) {'],
    ["    if (a === 'inconnu' && (P.accepte != null || P.refuse != null)) {", '    if (false) {'],
  ], null, ['R-attendu']],
  ['sans-marque', API, "  const m = await rangerReglesOffre(ctx, { [itemId]: { lu: false, raison: 'en-cours', lueA: Date.now(), par: 'regle', _force: true } });", '  const m = true;', ['R-marque', 'R-range']],
  ['sans-ack', API, "  if (sansAck(r) || classeEchec(r) === 'incertain') {", '  if (r.status === 0) {', ['R-ack']],
  ['systeme-refus', API, "  return errs.length && errs.every((e) => e.classe === 'RequestError') ? 'refus' : 'incertain';", "  return 'refus';", ['R-systeme']],
  ['offres-actives', API, [
    ['  if (lu.offresActives === true) return true;\n  return lu.offresActives === false ? false : null;', '  return true;'],
    ['    ? (P.offresActives === true && cents(P.accepte) === cents(accepte)', '    ? (cents(P.accepte) === cents(accepte)'],
  ], null, ['R-partiel', 'R-idem', 'R-offres-inconnues']],
  ['refus-non-renvoye', API, '    const yRefus = refuse != null ? refuse : (refuse === undefined && P.refuse != null ? P.refuse : null);', '    const yRefus = refuse != null ? refuse : null;', ['R-garde-refus']],
  ['ordre-luea', API, '    if (!_force && avant && (Number(avant.lueA) || 0) > (Number(v.lueA) || 0)) continue;\n', '', ['R-ordre']],
  ['compte', API, '  if (!L.actives.some((x) => x.itemId === itemId)) {\n    if (L.complet) return { status: 409, body: { ok: false, reason: \'pas-sur-ce-compte\'', '  if (false) {\n    if (L.complet) return { status: 409, body: { ok: false, reason: \'pas-sur-ce-compte\'', ['R-compte']],
  // La lecture de la ligne ratée ⇒ on n'écrit RIEN (repartir de vide effacerait
  // les autres annonces). Depuis le 11 octobre, cette lecture vit dans
  // `modifierDonnee` (compare-et-échange) : c'est là qu'on la réaffaiblit.
  ['rangement', LIB, "      if (!r.ok) return null;\n      rows = await r.json();\n    } catch (_) { return null; }\n    if (!Array.isArray(rows)) return null;\n    const present", "      rows = r.ok ? await r.json() : [{ data: {} }];\n    } catch (_) { return null; }\n    if (!Array.isArray(rows)) return null;\n    const present", ['R-marque']],
  // (11 octobre) L'écriture SANS comparer la version (l'upsert d'avant) : deux
  // gestes sur deux cartes du même compte s'effacent.
  ['sans-cas', LIB, "      const w = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.${id}${p.filtre}&${cond}&select=id`, {", "      const w = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.${id}${p.filtre}&select=id`, {", ['R-concurrence']],
  ['relu-aucune', API, "{lu:false,raison,lueA:Date.now(),observee:post.ok?post.lecture:null}", "{lu:true,offresActives:null,accepte:null,refuse:null,lueA:Date.now()}", ['R-relu-ko']],
  ['tombee-pas-su', API, ': null) : ((avant && avant.lu === true) ? false : null),', ': null) : false,', ['R-prix-change']],
  ['sync-detail', API, '      const { _regle, ...detail } = d;', '      const detail = d; const _regle = d._regle;', ['R-sync']],
  // ── (11 octobre, revue — tour 2) ──
  // une lecture RATÉE remplace de nouveau une règle connue (ou une écriture incertaine).
  ['lecture-ratee-remplace', API, "      if (!_force && avant && v.lu !== true && v.raison === 'lecture-ratee') continue;\n", '', ['R-lecture-ratee']],
  // la lecture datée à l'ARRIVÉE de la réponse (et non au départ de la question).
  ['luea-arrivee', API, 'lueA:Number.isFinite(t0)?t0:Date.now()}', 'lueA:Date.now()}', ['R-course']],
  // la liste d'une synchro efface une entrée sans regarder si elle est plus récente qu'elle.
  ['garder-sans-age', API, ' && (Number(items[k] && items[k].lueA) || 0) < garder.a) delete items[k];', ') delete items[k];', ['R-course']],
  // un montant qui s'arrondit à 0 redevient « valable » (« > 0 »).
  ['montant-zero', LIB, '  return typeof v === \'number\' && Number.isFinite(v) && v <= MONTANT_MAX && Math.round(v * 100) >= 1', '  return typeof v === \'number\' && Number.isFinite(v) && v <= MONTANT_MAX && v > 0', ['R-mont', 'R-crea']],
  // ── (11 octobre, revue — tour 3) ──
  // une annonce programmée avec sa règle n'est de nouveau ni rangée ni relue.
  ['prog-non-rangee', API, '  if (it.regleOffre) corps.offre = await rangerRegleProgrammee(ctx, at.token, corps, it, quand);', '  if (it.regleOffre) corps.offre = { envoyee: { accepte: it.regleOffre.accepte, refuse: it.regleOffre.refuse } };', ['R-prog-regle']],
  // retirer une annonce laisse sa règle rangée (la déconnexion la compte encore).
  ['retirer-garde-regle', API, "  // n'a plus de règle qu'eBay applique.\n  const regles = await sortirDesRegles(itemId, ctx);", "  // n'a plus de règle qu'eBay applique.\n  const regles = true;", ['R-retire-regle']],
  // « Relire chez eBay » ne sort plus la règle d'une annonce qu'eBay ne montre plus.
  ['lire-sans-garder', API, '  const garder = L.complet ? { ids: aMoi, a: tListe } : null;', '  const garder = null;', ['R-lire-absente']],
  // (app) « règle active » redevient « connue » seule (le filtre brut d'avant).
  ['engage-connue-seule', APP, "const regleEngage = (e) => (!e ? null : (e.engagement==='oui'?'oui':e.etat === 'connue' ? 'oui' : (e.etat === 'pas-su' && e.risque === true ? 'peut-etre' : null)));", "const regleEngage = (e) => (!e ? null : (e.engagement==='oui'?'oui':e.etat === 'connue' ? 'oui' : null));", ['R-engage']],
  // (app) une règle d'annonce terminée compte de nouveau (la liste n'est plus lue).
  ['engage-sans-liste', APP, '      if (filtre && !prix.has(id) && (Number(e.lueA) || 0) < Number(c.cap) - 10 * 60000) continue;\n', '', ['R-engage']],
  // (app) « ✓ … reste à » sur un seuil relu, offres activées ou non pas montré.
  ['apres-prix-brut', APP, "    const etL = etatRegleOffre({ itemId: 'x', price: l.prix }", "    const etL = { etat: 'connue' } || etatRegleOffre({ itemId: 'x', price: l.prix }", ['R-apres-prix']],
  // (app) la publication ignore la lecture : « pas encore relue » sur un seuil relu.
  ['publie-sans-lecture', APP, "  const res = resultatRegleOffre({ code: 200, j: { ok: true, verifie: o.verifie, lecture: o.lecture || null,", "  const res = resultatRegleOffre({ code: 200, j: { ok: true, verifie: o.verifie, lecture: null,", ['R-publie-offre']],
];

// Copie de l'arbre courant (api/, src/, scripts/ sans fixtures), node_modules en lien.
function copier(nom) {
  const dest = path.join(os.tmpdir(), 'mut-regle-' + nom);
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  for (const d of ['api', 'src', 'scripts']) {
    fs.cpSync(path.join(RACINE, d), path.join(dest, d), { recursive: true, filter: (s) => !/[\\/]scripts[\\/]bancs[\\/]fx([\\/]|$)/.test(s) });
  }
  for (const f of ['package.json', 'vite.config.js']) { try { fs.copyFileSync(path.join(RACINE, f), path.join(dest, f)); } catch (_) {} }
  try { fs.symlinkSync(path.join(RACINE, 'node_modules'), path.join(dest, 'node_modules')); } catch (_) {}
  return dest;
}
function appliquer(dest, fichier, rempl) {
  const p = path.join(dest, fichier);
  let s = fs.readFileSync(p, 'utf8');
  for (const [a, b] of rempl) {
    const n = s.split(a).length - 1;
    if (n !== 1) return `ancre trouvée ${n} fois : ${a.slice(0, 70)}`;
    s = s.replace(a, () => b);
  }
  fs.writeFileSync(p, s);
  return '';
}
const lancer = (script, args, cwd) => cp.spawnSync(process.execPath, [script, ...args], { cwd: cwd || RACINE, encoding: 'utf8', timeout: 900000, maxBuffer: 64 * 1024 * 1024 });

// ── 1. LES MUTATIONS DE LA ROUTE ─────────────────────────────────────────────
for (const [nom, fichier, ancre, rempl, attendus] of MUTATIONS) {
  if (SEULE && SEULE !== nom) continue;
  const dest = copier(nom);
  const err = appliquer(dest, fichier, Array.isArray(ancre) ? ancre : [[ancre, rempl]]);
  if (err) { dit(false, `mutation « ${nom} » non appliquée`, err); continue; }
  const r = lancer(path.join(RACINE, 'scripts', 'audit-ebay-route.cjs'), ['--src', dest]);
  const sortie = (r.stdout || '') + (r.stderr || '');
  const rouges = attendus.map((c) => [c, (sortie.match(new RegExp('^\\s*❌ \\[' + c.replace(/[.*+?^${}()|[\]\\§]/g, '\\$&') + '\\]', 'gm')) || []).length]);
  const tous = rouges.every(([, n]) => n > 0);
  dit(r.status !== 0 && tous, `mutation « ${nom} » : l'audit de la route passe au ROUGE`, `sortie ${r.status} · ${rouges.map(([c, n]) => `${c} ×${n}`).join(', ')}`);
  fs.rmSync(dest, { recursive: true, force: true });
}

if (!SEULE) {
  // ── 2. LE MÊME XML QU'AVANT, SANS RÈGLE (D7) ──────────────────────────────
  const xml = path.join(RACINE, 'scripts', '_xml-publication.cjs');
  if (!fs.existsSync(path.join(AVANT, 'api', 'ebay.js'))) dit(false, 'la base d\'avant est introuvable', AVANT + ' — git archive worktree-wf_d62e1db4-b5c-1 | tar -x -C ' + AVANT);
  else {
    const av = lancer(xml, ['--src', AVANT]);
    const ap = lancer(xml, []);
    const apNull = lancer(xml, ['--offre-null']);
    const nCorps = ((ap.stdout || '').match(/^(Verify)?AddFixedPriceItem$/gm) || []).length;
    dit(av.status === 0 && ap.status === 0 && nCorps >= 6, 'les deux arbres publient (pubverify, publish, programmer sur 3 annonces)', `avant ${av.status} · après ${ap.status} · ${nCorps} corps envoyés`);
    dit(av.stdout === ap.stdout, 'SANS règle, le XML envoyé à eBay est identique à celui d\'avant, caractère pour caractère', `${(av.stdout || '').length} / ${(ap.stdout || '').length} caractères`);
    dit(ap.stdout === apNull.stdout, 'avec `offre: null`, toujours le même XML', `${(apNull.stdout || '').length} caractères`);
  }
  // ── 3. AUDIT-OFFRES-AUTO : une route qui accepte une offre est attrapée ────
  const dest = copier('respond');
  const err = appliquer(dest, API, [["async function handleRegleOffreLire(b, ctx) {", "async function accepterOffreEbay(token, itemId) { return tradingCall(token, 'RespondToBestOffer', `<ItemID>${itemId}</ItemID><Action>Accept</Action>`); }\nasync function handleRegleOffreLire(b, ctx) {"]]);
  if (err) dit(false, 'mutation « respond » non appliquée', err);
  else {
    const r = lancer(path.join(RACINE, 'scripts', 'audit-offres-auto.cjs'), ['--src', dest]);
    const s = (r.stdout || '') + (r.stderr || '');
    dit(r.status !== 0 && /❌[^\n]*aucune acceptation programmée/.test(s), 'une route qui appelle RespondToBestOffer fait passer audit-offres-auto au ROUGE', `sortie ${r.status}`);
    const r0 = lancer(path.join(RACINE, 'scripts', 'audit-offres-auto.cjs'), []);
    dit(r0.status === 0, 'et l\'arbre courant le laisse vert', `sortie ${r0.status}`);
  }
  fs.rmSync(dest, { recursive: true, force: true });
}

console.log(`\n${ko ? '❌' : '✅'} prouve-regle-offre : ${ok} vert(s), ${ko} rouge(s)${ko ? '' : ' — chaque garde de la règle d\'offre est attrapée quand on la réaffaiblit, et le XML sans règle est celui d\'avant'}`);
process.exit(ko ? 1 : 0);
