#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  LA PREUVE DE VENTE QUI MANQUAIT À L'ANTI DOUBLE VENTE eBAY (11 octobre)
//  node scripts/audit-preuve-vente.cjs           (le contrôle)
//  node scripts/audit-preuve-vente.cjs --prouve  (chaque règle réaffaiblie doit
//                                                 faire passer l'audit au rouge)
//
//  Julien : « J'ai fait une vente hier. J'avais relié les deux paires. Ça n'a
//  pas retiré la paire sur eBay. Ça ne m'a même pas proposé. » Mesuré en lecture
//  seule : la vente (N°553) n'avait AUCUNE ligne `harvest_*_txn_*` — elle
//  n'arrive que quand la conversation est ouverte sur vinted.fr. Son BORDEREAU,
//  capté à 21:55, portait pourtant l'annonce (lue dans la transaction, puis
//  jetée). Sur 18 ventes en cours, 6 seulement étaient prouvées.
//
//  On EXÉCUTE les vraies règles, sur des données INVENTÉES (dépôt public) :
//   1. app et extension : le même bloc `<preuve-vente-regle>` (texte) et les
//      mêmes SORTIES sur la même base (§11) ;
//   2. la preuve par le bordereau — et les trois autres sens : vente annulée,
//      remboursée ou en retour, vente pas lue, bordereau d'un AUTRE compte,
//      `label_latest`, identifiant contredit, dressing « sold » seul ⇒ rien ;
//   3. « pas su » (transactions, bordereaux, ventes illisibles) ⇒ `null`, et
//      les ventes ne sont lues que si un bordereau reste à juger ;
//   4. la vente d'hier rejouée jusqu'à `doublesVenteEbay` : « à retirer » ;
//   5. extension : `recupererLabel` range la transaction qu'il lit — aucune
//      requête Vinted de plus, une seule écriture par appel, jamais sous un
//      autre numéro ;
//   6. extension : `capterPreuvesVente` — seulement les ventes en cours sans
//      preuve, 3 par visite, compte connecté, pause, 6 h, « pas su » ;
//   7. (revue du 11 octobre) la transaction rangée est un INSTANTANÉ : une
//      vente remboursée ensuite ne reste pas « prouvée vendue » (label + txn
//      « Le paiement a été validé » + vente « Remboursement effectué/failed »,
//      la forme que la 5.167 écrit, mesurée 5 fois en production), des deux
//      côtés, jusqu'à `doublesVenteEbay` ;
//   8. (revue du 11 octobre) la lecture des ventes des AUTRES comptes (ligne
//      « pas reliées ») ne fait jamais tomber la preuve ;
//   9. (revue du 11 octobre) la capacité `preuves` n'est promise qu'à une
//      extension qui A `capterPreuvesVente` : la 5.167.0 et la 5.168.0 PUBLIÉES
//      (PR #471, #472) ne l'ont pas — elles rendent « retard » ; et le rythme
//      que l'écran annonce (« 3 par visite ») est celui de l'extension.
//  10. (relecture croisée de la 5.174, 12 octobre) un échec PASSAGER ne bloque
//      pas 6 h : une écriture refusée par NOTRE base, un 429 de Vinted, un 401
//      ou une coupure ⇒ la vente est relue à la visite suivante (après la
//      pause) et reste comptée dans la réserve de lecture ; un 5xx ⇒ 30 min ;
//      un refus de Vinted (404) ⇒ 6 h. Même règle pour `capterRetraits` (6 h)
//      et `capterDatesVersement` (24 h).
//  ⚠️ Un audit ne meurt pas, il rapporte : chaque bloc passe par `essaie`.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), vm = require('vm'), os = require('os');
const { spawnSync } = require('child_process');
const { faireFond, projette } = require('./_fond-vm.cjs');
const { metaVersData } = require('./bancs/_meta.cjs');
const RACINE = path.join(__dirname, '..');
const args = process.argv.slice(2);
const MUTATION = (args.find((a) => a.startsWith('--mutation=')) || '').slice('--mutation='.length);
const PROUVE = args.includes('--prouve');

let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { return await f(); } catch (e) { dit(false, nom, 'a levé : ' + String((e && e.message) || e).slice(0, 300)); return undefined; } };

// ── LES MUTATIONS : chacune réaffaiblit UNE règle ────────────────────────────
// `regle` s'applique au bloc partagé, des DEUX côtés (il doit rester identique).
const remplace = (s, avant, apres, nom) => { if (!s.includes(avant)) throw new Error('mutation ' + nom + ' : ancre introuvable'); return s.split(avant).join(apres); };
const MUTATIONS = {
  'sans-bordereau-app': { app: (s) => remplace(s, '    for (const it of preuvesParBordereau(bords, parCompte).items) vendus.add(it);\n', '', 'sans-bordereau-app') },
  'sans-bordereau-ext': { ext: (s) => remplace(s, '  for (const it of preuvesParBordereau(bords, parCompte).items) vendus.add(it);\n  return { echec: false, vendus };', '  return { echec: false, vendus };', 'sans-bordereau-ext') },
  'vente-non-lue': { regle: (s) => remplace(s, '    if (!o || !venteVivante(o)) continue;', '    if (o && !venteVivante(o)) continue;', 'vente-non-lue') },
  'revenue-acceptee': { regle: (s) => remplace(s, "  if (PAS_UNE_VENTE.test(String(o.status || ''))) return false;\n  return String(o.transaction_user_status || '') !== 'failed';", '  return true;', 'revenue-acceptee') },
  'autre-compte': { regle: (s) => remplace(s, '    const ventes = ventesParCompte ? ventesParCompte[m[1]] : null;', '    const ventes = ventesParCompte ? [].concat(...Object.values(ventesParCompte)) : null;', 'autre-compte') },
  'tx-contredit': { regle: (s) => remplace(s, "    if (b.tx != null && String(b.tx).trim() !== '' && String(b.tx).trim() !== t) continue;\n", '', 'tx-contredit') },
  'latest-lu': { regle: (s) => remplace(s, "    const m = /^harvest_(\\d+)_label_(\\d+)$/.exec(String((b && b.id) || ''));\n    if (!m) continue;\n    const t = m[2];", "    const m = /^harvest_(\\d+)_label_(\\w+)$/.exec(String((b && b.id) || ''));\n    if (!m) continue;\n    const t = m[2] === 'latest' ? String(b.tx || '') : m[2];", 'latest-lu') },
  'pas-su-avale-app': { app: (s) => remplace(s, '    if (bords === null) return null;\n', '    if (bords === null) return { vendus: preuvesParTransaction(rows).items, sansPreuve: null };\n', 'pas-su-avale-app') },
  'pas-su-avale-ext': { ext: (s) => remplace(s, '  if (bords === null) return { echec: true, vendus: new Set() };', '  if (bords === null) return { echec: false, vendus };', 'pas-su-avale-ext') },
  'ventes-toujours-lues': { app: (s) => remplace(s, '    if (juger.length) {\n      const lignes = await ordres(juger);', '    if (true) {\n      const lignes = await ordres([...new Set([...juger, ...(comptes || [])])]);', 'ventes-toujours-lues') },
  'sans-preuve-compte-tout': { app: (s) => remplace(s, '          if (vus.has(tx) || parTx.tx.has(tx) || bordTx.has(tx)) continue;', '          if (vus.has(tx)) continue;', 'sans-preuve-compte-tout') },
  // (revue du 11 octobre) L'instantané de la transaction ignore la vente relue.
  'instantane-prime': { regle: (s) => remplace(s, '      if (o && !venteVivante(o)) continue;\n    }\n    items.add(String(r.it));', '    }\n    items.add(String(r.it));', 'instantane-prime') },
  // Les comptes dont une transaction ne prouve qu'un instantané ne sont pas lus.
  'txn-pas-a-juger': { regle: (s) => remplace(s, "    if (m && r.it && etat && !PAS_UNE_VENTE.test(etat) && !ETAT_TXN_TERMINAL.test(etat) && !out.includes(m[1])) out.push(m[1]);", "    if (false) out.push(m[1]);", 'txn-pas-a-juger') },
  // Toute transaction relue, même finalisée (la règle « terminal » oubliée) : les ventes de tous les comptes sont lues.
  'terminal-oublie': { regle: (s) => remplace(s, "    if (m && r.it && etat && !PAS_UNE_VENTE.test(etat) && !ETAT_TXN_TERMINAL.test(etat) && !out.includes(m[1])) out.push(m[1]);", "    if (m && r.it && etat && !PAS_UNE_VENTE.test(etat) && !out.includes(m[1])) out.push(m[1]);", 'terminal-oublie') },
  // (revue du 11 octobre) La lecture des autres comptes (ligne « pas reliées ») fait tomber la preuve.
  'autres-comptes-stricts': { app: (s) => remplace(s, '      if (l2 !== null) {', '      if (l2 === null) return null;\n      if (l2 !== null) {', 'autres-comptes-stricts') },
  'txn-jetee': { ext: (s) => remplace(s, "      const range = await rangerTransaction(uid, acc, tx, t.json, 'label');", '      const range = false;', 'txn-jetee') },
  'txn-chaque-essai': { ext: (s) => remplace(s, 'if (t && t.ok && t.json && t.json.transaction && !(connu && connu.txnRangee)) {', 'if (t && t.ok && t.json && t.json.transaction) {', 'txn-chaque-essai') },
  'txn-autre-rangee': { ext: (s) => remplace(s, '    if (t.id != null && String(t.id) !== String(tx)) { await noterDiag(`${quoi}_txn_autre`); return false; }\n', '', 'txn-autre-rangee') },
  'preuve-sans-garde': { ext: (s) => remplace(s, "      const refus = await gardeLecture(uid, acc, 'colis');\n      if (refus) { if (refus.code !== 'vinted-pause') logActivity(`⚠️ Preuve", "      const refus = null;\n      if (refus) { if (refus.code !== 'vinted-pause') logActivity(`⚠️ Preuve", 'preuve-sans-garde') },
  'preuve-sans-memo': { ext: (s) => remplace(s, '      return !(memo[tx] && Date.now() - Number(memo[tx]) < PREUVE_RETRY_MS);', '      return true;', 'preuve-sans-memo') },
  'preuve-sans-borne': { ext: (s) => remplace(s, 'const PREUVE_MAX_PAR_VISITE = 3;', 'const PREUVE_MAX_PAR_VISITE = 99;', 'preuve-sans-borne') },
  'preuve-relit-prouvees': { ext: (s) => remplace(s, '      if (prouvees.has(tx) || parBord.has(tx)) return false;\n', '', 'preuve-relit-prouvees') },
  'preuve-pas-su-lue': { ext: (s) => remplace(s, '    if (det === null) return 0;                                           // pas su\n    const bords', '    const bords', 'preuve-pas-su-lue') },
  'regle-divergente': { ext: (s) => remplace(s, 'const PREUVE_RECENTE_MS = 30 * 86400000;', 'const PREUVE_RECENTE_MS = 31 * 86400000;', 'regle-divergente') },
  // (revue du 11 octobre, défaut 3) L'écran Leboncoin reprend SA boucle sur les transactions (la forme de 6729407).
  'lecteur-lbc-hors-bloc': { app: (s) => remplace(s, "    const preuveLue = preuveP ? preuveP.vendus : null;\n", "    const txnRows = await sbGet('app_data?id=like.harvest_*_txn_*&select=it:meta->>item_id,ti:meta->>status_title');\n    const preuveLue = txnRows === null ? null : new Set(txnRows.filter((r) => r && r.it && String(r.ti || '').trim() && !PAS_UNE_VENTE.test(String(r.ti))).map((r) => String(r.it)));\n", 'lecteur-lbc-hors-bloc') },
  // (revue du 11 octobre) La capacité promise à une version PUBLIÉE qui ne l'a pas.
  'capacite-publiee': { app: (s) => remplace(s, "preuves: '5.172.0' };", "preuves: '5.170.0' };", 'capacite-publiee') },
  // L'écran annonce un autre rythme que celui de l'extension.
  'rythme-different': { app: (s) => remplace(s, 'const PREUVE_PAR_VISITE = 3;', 'const PREUVE_PAR_VISITE = 5;', 'rythme-different') },
  // (relecture croisée de la 5.174) Le mémo reste posé quand l'échec n'est pas celui de la vente.
  'memo-echec-garde': { ext: (s) => remplace(s, 'function memoApresEchec(memo, cle, rep, delaiMs) {\n', 'function memoApresEchec(memo, cle, rep, delaiMs) {\n  return !!(rep && (rep.pause || freinVinted(Number(rep.status) || 0)));\n', 'memo-echec-garde') },
  'memo-ecriture-preuve': { ext: (s) => remplace(s, '      if (range === null) { delete memo[tx]; break; }', '      if (range === null) break;', 'memo-ecriture-preuve') },
  'memo-ecriture-versement': { ext: (s) => remplace(s, "if (ok === false) { noterDiag('versement_ecriture_ratee'); delete memo[tx]; break; }", "if (ok === false) { noterDiag('versement_ecriture_ratee'); continue; }", 'memo-ecriture-versement') },
  'memo-ecriture-retrait': { ext: (s) => remplace(s, '      if (ecrit === null) { delete memo[cid]; break; }', '', 'memo-ecriture-retrait') },
  'cinq-cents-six-heures': { ext: (s) => remplace(s, "  if (s >= 500) return 'bref';\n", '', 'cinq-cents-six-heures') },
};
if (PROUVE) {
  let rouges = 0; const noms = Object.keys(MUTATIONS);
  for (const nom of noms) {
    const r = spawnSync(process.execPath, [__filename, '--mutation=' + nom], { encoding: 'utf8', maxBuffer: 64 << 20 });
    const n = (r.stdout.match(/^❌ /mg) || []).length;
    const sautee = /ancre introuvable/.test(r.stdout + r.stderr);
    const bon = r.status !== 0 && n > 0 && !sautee;
    if (bon) rouges++;
    console.log(`${bon ? '✅' : '❌'} mutation « ${nom} » → ${bon ? n + ' contrôle(s) au rouge' : (sautee ? 'ancre introuvable' : 'RESTE VERTE')}`);
    if (bon) for (const l of r.stdout.split('\n').filter((x) => x.startsWith('❌ ')).slice(0, 2)) console.log('      ' + l.slice(0, 220));
  }
  console.log(`\n${rouges}/${noms.length} mutations attrapées.`);
  process.exit(rouges === noms.length ? 0 : 1);
}
const M = MUTATION ? MUTATIONS[MUTATION] : null;
if (MUTATION && !M) { console.log('❌ mutation inconnue : ' + MUTATION); process.exit(1); }

// ── LES SOURCES (éventuellement mutées) ─────────────────────────────────────
let APP = require('./_source-app.cjs')(path.join(RACINE, 'src/App.jsx'));
let EXT = fs.readFileSync(path.join(RACINE, 'vinted-sync-extension/background.js'), 'utf8');
try {
  if (M && M.regle) { APP = M.regle(APP); EXT = M.regle(EXT); }
  if (M && M.app) APP = M.app(APP);
  if (M && M.ext) EXT = M.ext(EXT);
} catch (e) { console.log('❌ ' + e.message); process.exit(1); }
const EXT_FICHIER = path.join(os.tmpdir(), `vrm-preuve-bg-${process.pid}.js`);
fs.writeFileSync(EXT_FICHIER, EXT);
process.on('exit', () => { try { fs.unlinkSync(EXT_FICHIER); } catch (_) {} });

// Extrait `const NOM = …;` ou `function NOM(…) {…}` d'App.jsx.
function extraire(src, nom) {
  const re = new RegExp(`^(?:async )?function ${nom}\\(|^const ${nom} = `, 'm');
  const m = re.exec(src);
  if (!m) throw new Error(`\`${nom}\` introuvable`);
  let i = m.index, prof = 0, vuCorps = false;
  const estFn = /function/.test(m[0]);
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === '(' || c === '[' || c === '{') { prof++; if (c === '{') vuCorps = true; }
    else if (c === ')' || c === ']' || c === '}') {
      prof--;
      if (estFn && vuCorps && prof === 0 && c === '}') return src.slice(m.index, i + 1);
    } else if (!estFn && c === ';' && prof === 0) return src.slice(m.index, i + 1);
  }
  throw new Error(`fin de \`${nom}\` introuvable`);
}
const BLOC_RE = /\/\/ <preuve-vente-regle>[^\n]*\n([\s\S]*?)\/\/ <\/preuve-vente-regle>/;

// ── LA BASE INVENTÉE (la forme mesurée : `payload.my_orders`, `meta` des bordereaux)
const J = 86400000;
const iso = (dj) => new Date(Date.now() + dj * J).toISOString();
const vente = (tx, status, tus, dj = -1) => ({ transaction_id: tx, status, transaction_user_status: tus, date: iso(dj), title: 'Paire ' + tx });
const A = '111', B = '222', C = '333';
function base() {
  const ventesA = [
    vente(7000000553, 'Bordereau envoyé au vendeur', 'needs_action'),        // bordereau seul ⇒ PROUVÉE (le cas du 10 octobre)
    vente(7000000554, 'Commande annulée', 'failed'),                        // bordereau, annulée ⇒ rien
    vente(7000000555, 'Remboursement effectué', 'failed'),                  // bordereau, remboursée ⇒ rien
    vente(7000000556, 'Retour initié', 'waiting'),                          // bordereau, en retour ⇒ rien
    vente(7000000557, 'Le paiement a été validé', 'needs_action'),          // rien (seul `label_latest` la cite) ⇒ pas reliée
    vente(7000000558, "Commande finalisée - l'acheteur a validé la commande", 'completed'), // finalisée : hors « en cours »
    vente(7000000559, 'Le paiement a été validé', 'needs_action', -40),     // trop vieille : hors « en cours »
    vente(7000000560, 'Bordereau envoyé au vendeur', 'needs_action'),       // ligne de transaction ⇒ PROUVÉE
    vente(7000000562, 'Bordereau envoyé au vendeur', 'needs_action'),       // bordereau dont la méta contredit l'identifiant ⇒ pas reliée
    vente(7000000563, 'Bordereau envoyé au vendeur', 'needs_action'),       // bordereau d'un AUTRE compte ⇒ pas reliée
  ];
  const ventesB = [vente(7000000561, 'Le paiement a été validé', 'needs_action')];
  const lab = (uid, tx, item, txMeta) => ({ uid, url: 'https://s3.test/l.pdf', tx: txMeta != null ? txMeta : String(tx), item: String(item), items: [String(item)], capturedAt: iso(0), pdfB64: 'JVBERi0x' });
  const txn = (tx, item, status, titre) => ({ type: 'transaction', uid: A, capturedAt: iso(0), payload: { transaction: { id: tx, item_id: item, status, status_title: titre } } });
  return {
    [`harvest_${A}_orders_sold`]: { capturedAt: iso(0), payload: { my_orders: ventesA } },
    [`harvest_${B}_orders_sold`]: { capturedAt: iso(0), payload: { my_orders: ventesB } },
    [`harvest_${A}_label_7000000553`]: lab(A, 7000000553, 9000000553),
    [`harvest_${A}_label_7000000554`]: lab(A, 7000000554, 9000000554),
    [`harvest_${A}_label_7000000555`]: lab(A, 7000000555, 9000000555),
    [`harvest_${A}_label_7000000556`]: lab(A, 7000000556, 9000000556),
    [`harvest_${A}_label_latest`]: lab(A, 7000000557, 9000000557),                  // une copie : jamais lue
    [`harvest_${A}_label_7000000562`]: lab(A, 7000000562, 9000000562, '7000000999'), // méta contredite
    [`harvest_${B}_label_7000000563`]: lab(B, 7000000563, 9000000563),              // la vente est chez A, pas chez B
    [`harvest_${C}_label_7000000564`]: lab(C, 7000000564, 9000000564),              // compte sans aucune vente captée
    [`harvest_${A}_txn_7000000560`]: txn(7000000560, 9000000560, 200, 'Bordereau envoyé au vendeur'),
    [`harvest_${A}_txn_7000000570`]: txn(7000000570, 9000000570, 1, ''),            // une conversation
    [`harvest_${A}_txn_7000000571`]: txn(7000000571, 9000000571, 300, 'Commande annulée'),
    [`harvest_${A}_listings`]: { capturedAt: iso(0), payload: { items: [{ id: 9000000580, is_closed: true, item_closing_action: 'sold', title: 'fermée « vendue », aucune preuve' }] } },
  };
}
const ATTENDU_VENDUS = ['9000000553', '9000000560'];
const ATTENDU_SANS = ['7000000557', '7000000561', '7000000562', '7000000563'];
const trie = (it) => [...(it || [])].map(String).sort();

// ── L'APP : les vraies fonctions d'App.jsx, contre une fausse base (vm) ──────
function chargeApp(lignes, ko = () => false) {
  const lus = [];
  const rep = (status, body) => ({ ok: status < 400, status, json: async () => body });
  const fetch = async (url, opts = {}) => {
    const u0 = String(url); lus.push(decodeURIComponent(u0));
    const u = decodeURIComponent(metaVersData(u0));
    if (ko(u)) return rep(522, null);
    const range = opts.headers && (opts.headers.Range || opts.headers.range);
    if (range && !/^0-/.test(range)) return rep(200, []);
    const sel = (/[?&]select=([^&]+)/.exec(u) || [])[1] || '';
    const eq = /[?&]id=eq\.([^&]+)/.exec(u), like = /[?&]id=like\.([^&]+)/.exec(u), dans = /[?&]id=in\.\(([^)]*)\)/.exec(u);
    let rows = [];
    if (eq) rows = lignes[eq[1]] !== undefined ? [{ id: eq[1], data: lignes[eq[1]] }] : [];
    else if (dans) rows = dans[1].split(',').filter((k) => lignes[k] !== undefined).map((k) => ({ id: k, data: lignes[k] }));
    else if (like) { const re = new RegExp('^' + like[1].replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/[*%]/g, '.*') + '$'); rows = Object.keys(lignes).filter((k) => re.test(k)).map((k) => ({ id: k, data: lignes[k] })); }
    return rep(200, rows.map((r) => projette(r, sel)));
  };
  const ctx = { console: { log() {}, warn() {}, error() {} }, Date, JSON, Set, Map, Array, Object, String, Number, isFinite, isNaN, Promise, RegExp,
    SUPABASE_URL: 'https://base.test', sbAuth: (h) => ({ ...(h || {}) }), fetch };
  vm.createContext(ctx);
  let src = ['PAGE_SB', 'lireTout', 'PAS_UNE_VENTE'].map((n) => extraire(APP, n)).join('\n');
  const bloc = BLOC_RE.exec(APP);
  if (bloc) src += '\n' + bloc[1];
  for (const n of ['lirePreuvesVenteVinted', 'lireVentesVintedProuvees']) { try { src += '\n' + extraire(APP, n); } catch (_) {} }
  src += '\n;this.R = { lirePreuves: typeof lirePreuvesVenteVinted === "function" ? lirePreuvesVenteVinted : null, lireVendus: typeof lireVentesVintedProuvees === "function" ? lireVentesVintedProuvees : null };';
  vm.runInContext(src, ctx);
  const R = ctx.R;
  // Sur le code d'AVANT, seule l'ancienne lecture existe : on mesure ce qu'ELLE rend.
  const lire = R.lirePreuves || (async () => { const v = R.lireVendus ? await R.lireVendus() : null; return v ? { vendus: v, sansPreuve: null } : null; });
  return { lire, lus };
}

// ── L'EXTENSION : le vrai background.js (vm, banc commun) ────────────────────
const ACC = (uid) => ({ vinted_user_id: uid, login: 'compte_' + uid, domain: 'www.vinted.fr', access_token: 'jeton' });
function chargeExt({ lignes, vinted, ko, connecte = A, store = {} } = {}) {
  const f = faireFond({ src: EXT_FICHIER, lignes, vinted: vinted || (() => ({ status: 404, body: {} })), lectureKO: ko || (() => false), connecte, comptes: [ACC(A), ACC(B)], store });
  const lus = [];
  const f0 = f.ctx.fetch;
  f.ctx.fetch = async (url, opts = {}) => {
    const u = String(url);
    if (/\/rest\/v1\//.test(u) && (opts.method || 'GET') === 'GET') lus.push(decodeURIComponent(u));
    // Le PDF du bordereau (S3) : de vrais octets `%PDF`.
    if (/amazonaws\.com/.test(u)) { const b = Buffer.from('%PDF-1.4\n% banc\n'); return { ok: true, status: 200, headers: { get: () => 'application/pdf' }, arrayBuffer: async () => new Uint8Array(b).buffer }; }
    return f0(url, opts);
  };
  return { ...f, lus };
}

// Les versions PUBLIÉES sans `capterPreuvesVente`. ⚠️ (revue du 11 octobre)
// Cette liste était RECOPIÉE à la main (['5.164.0', '5.167.0', '5.168.0']) : la
// 5.170.0 partie en production (PR #473) n'y était pas — sans la fonction, elle
// rendait « ok » et l'app lui promettait « elle lit toute seule ». Elle se LIT
// maintenant dans l'historique de main (`_versions-publiees.cjs`, la même
// lecture qu'audit-coherence) ; « pas su » est rouge, jamais une liste vide.
// Les numéros RÉSERVÉS par d'autres chantiers pas encore publiés ne se lisent
// nulle part : ils sont nommés ici (deux contenus ne portent jamais un numéro).
const { versionsPubliees, versionsSans } = require('./_versions-publiees.cjs');
const PUB = versionsPubliees({ racine: RACINE });
const PUBLIEES_SANS_PREUVE = PUB ? versionsSans(PUB, 'capterPreuvesVente') : null;
const RESERVEES = ['5.169.0', '5.171.0'];   // chantier extension (wf_4d08d5c8-e7b-1)
(async () => {
  console.log('0. LA CAPACITÉ N\'EST PROMISE QU\'À UNE EXTENSION QUI L\'A (revue du 11 octobre)');
  await essaie('capacité', () => {
    const pick = (re) => { const m = re.exec(APP); if (!m) throw new Error('introuvable ' + re); return m[0]; };
    const src = [pick(/^const cmpVersion = [\s\S]*?\n};\n/m), pick(/^const EXT_ATTENDUE = .*$/m), pick(/^const EXT_CAPACITES = .*$/m), pick(/^const extSait = [\s\S]*?\n};\n/m)].join('\n');
    const sait = (v) => { const ctx = { vmrExtPresent: () => true, vmrExtVersion: () => v }; vm.createContext(ctx); vm.runInContext(src + '\n;this.r = extSait("preuves");', ctx); return ctx.r; };
    const att = (/const EXT_ATTENDUE = '([^']+)'/.exec(APP) || [])[1];
    const vManif = JSON.parse(fs.readFileSync(path.join(RACINE, 'vinted-sync-extension/manifest.json'), 'utf8')).version;
    dit(!!PUBLIEES_SANS_PREUVE, 'les versions PUBLIÉES se lisent dans l\'historique de main', PUB ? '' : 'historique illisible ici — relance avec VRM_GIT=<chemin du dépôt> (§6.1)');
    const lst = PUBLIEES_SANS_PREUVE || [];
    const recentes = lst.filter((v) => /^5\.1[6-9]\d\./.test(v)).sort().join(', ');
    const r = lst.filter((v) => sait(v) !== 'retard').map((v) => `${v}→${sait(v)}`);
    dit(!!PUBLIEES_SANS_PREUVE && lst.includes('5.170.0') && !r.length, `les ${lst.length} versions PUBLIÉES sans \`capterPreuvesVente\` (dont ${recentes}) rendent « retard » — l'app ne leur promet pas « elle va lire la transaction toute seule »`, r.join(' · ') || (lst.includes('5.170.0') ? '' : 'la 5.170.0 de production manque à la liste'));
    dit(sait(att) === 'ok' && sait(vManif) === 'ok', `et l'extension livrée (${vManif}, EXT_ATTENDUE ${att}) rend « ok »`, `${att}→${sait(att)} · ${vManif}→${sait(vManif)}`);
    dit(/async function capterPreuvesVente\(/.test(EXT), 'et elle a bien `capterPreuvesVente`');
    const BG = fs.readFileSync(path.join(RACINE, 'vinted-sync-extension/background.js'), 'utf8');
    const autreContenu = PUB ? PUB.commits.filter((c) => c.version === vManif && c.bg !== BG).map((c) => c.sha.slice(0, 7)) : ['pas su'];
    dit(!autreContenu.length && !RESERVEES.includes(vManif), 'et elle ne porte ni le numéro d\'une version déjà publiée avec un autre contenu, ni un numéro réservé par un autre chantier', `${vManif}${autreContenu.length ? ' publiée par ' + autreContenu.join(', ') : ''}${RESERVEES.includes(vManif) ? ' (réservée)' : ''}`);
    const pApp = (/const PREUVE_PAR_VISITE = (\d+);/.exec(APP) || [])[1], pExt = (/const PREUVE_MAX_PAR_VISITE = (\d+);/.exec(EXT) || [])[1];
    dit(!!pApp && pApp === pExt, 'le rythme dit par l\'écran eBay (« N par visite ») est celui de l\'extension', `app ${pApp} · extension ${pExt}`);
  });

  console.log('\n1. UNE RÈGLE, DEUX CÔTÉS (§11)');
  await essaie('bloc partagé', () => {
    const a = BLOC_RE.exec(APP), e = BLOC_RE.exec(EXT);
    dit(!!a && !!e, 'le bloc <preuve-vente-regle> existe dans l\'app ET dans l\'extension');
    dit(!!a && !!e && a[1] === e[1], 'et il est IDENTIQUE au caractère près (une notion, une règle)', a && e && a[1] !== e[1] ? 'les deux textes divergent' : '');
  });

  // ⚠️⚠️ (revue du 11 octobre, défaut 3) UN TROISIÈME LECTEUR. L'écran Leboncoin
  //    de l'app gardait SA boucle sur `harvest_*_txn_*` (transactions seules,
  //    sans bordereau, sans les ventes relues) : « 2 à publier » dans l'app, « 1 »
  //    dans l'extension, et « Publier » refusé. Le bloc partagé ne protège que
  //    ceux qui le lisent. ⇒ Toute lecture de la famille qui demande l'ÉTAT DE
  //    COMMANDE (`status_title` : c'est lui qui fait dire « vendue ») vit dans
  //    un des lecteurs autorisés — jamais ailleurs. On juge le CODE (commentaires
  //    neutralisés) et on nomme la fonction fautive.
  console.log('\n1 bis. PERSONNE D\'AUTRE NE JUGE « VENDUE » SUR LES TRANSACTIONS (§11)');
  await essaie('lecteurs', () => {
    const sansCom = (src) => src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(Math.max(0, m.length - p1.length)));
    const fautes = (src, permis) => {
      const code = sansCom(src), lignes = code.split('\n'), out = [];
      lignes.forEach((l, i) => {
        if (!/_txn_/.test(l) || !/(^|[^_\w])status_title/.test(l)) return;   // `ship_status_title` est l'état du COLIS, pas de la commande
        let fn = '?';
        for (let k = i; k >= 0; k--) { const m = /^(?:async\s+)?function\s+(\w+)\s*\(|^const\s+(\w+)\s*=/.exec(lignes[k]); if (m) { fn = m[1] || m[2]; break; } }
        if (!permis.includes(fn)) out.push(`${fn} (ligne ${i + 1})`);
      });
      return out;
    };
    const fa = fautes(APP, ['lirePreuvesVenteVinted']), fe = fautes(EXT, ['lireVentesProuvees', 'capterPreuvesVente']);
    dit(!fa.length, 'dans l\'app, seul `lirePreuvesVenteVinted` lit l\'état des transactions pour dire « vendue »', fa.join(' · '));
    dit(!fe.length, 'dans l\'extension, seuls `lireVentesProuvees` et `capterPreuvesVente` le lisent', fe.join(' · '));
  });

  console.log('\n2. LA PREUVE PAR LE BORDEREAU — ET LES AUTRES SENS (app)');
  let vendusApp = null;
  await essaie('app', async () => {
    const { lire, lus } = chargeApp(base());
    const p = await lire({ comptes: [A, B] });
    dit(!!p && !!p.vendus, 'la lecture rend une preuve (pas « pas su ») quand tout se lit');
    if (!p) return;
    vendusApp = trie(p.vendus);
    dit(p.vendus.has('9000000553'), 'la vente qui n\'a QU\'UN bordereau (le cas du 10 octobre) est PROUVÉE', JSON.stringify(vendusApp));
    dit(p.vendus.has('9000000560'), 'la preuve par la transaction tient toujours');
    dit(!p.vendus.has('9000000554') && !p.vendus.has('9000000555') && !p.vendus.has('9000000556'), 'bordereau d\'une vente annulée, remboursée ou en retour ⇒ rien (la paire revient)', JSON.stringify(vendusApp));
    dit(!p.vendus.has('9000000557'), '`label_latest` (une copie) ne prouve rien');
    dit(!p.vendus.has('9000000562'), 'un bordereau dont la méta contredit l\'identifiant ⇒ doute ⇒ rien');
    dit(!p.vendus.has('9000000563'), 'un bordereau ne se juge que sur les ventes de SON compte');
    dit(!p.vendus.has('9000000564'), 'un compte sans aucune vente captée ⇒ ses bordereaux ne prouvent rien');
    dit(!p.vendus.has('9000000570') && !p.vendus.has('9000000571'), 'une conversation (état vide) ou une transaction annulée ne prouvent rien');
    dit(!p.vendus.has('9000000580') && !lus.some((u) => /_listings/.test(u)), '« fermée, sold » au dressing n\'est JAMAIS une preuve (le dressing n\'est même pas lu)');
    dit(JSON.stringify(vendusApp) === JSON.stringify(ATTENDU_VENDUS), 'exactement les deux ventes prouvées', JSON.stringify(vendusApp));
    dit(!lus.some((u) => /select=data(&|$)/.test(u) || /pdfB64/.test(u)), 'aucune ligne lue entière, aucun PDF rapatrié (§4.4)', lus.filter((u) => /select=data(&|$)|pdfB64/.test(u)).join(' · '));
    const sans = trie((p.sansPreuve || []).map((x) => x.tx));
    dit(JSON.stringify(sans) === JSON.stringify(ATTENDU_SANS), 'les ventes EN COURS qu\'aucune preuve ne relie : comptées (ni finalisée, ni trop vieille, ni revenue, ni prouvée)', JSON.stringify(sans));
    dit(Array.isArray(p.sansPreuve) && p.sansPreuve.every((x) => x.uid === (x.tx === '7000000561' ? B : A)), 'chacune porte SON compte (le geste se fait compte par compte)');
  });
  await essaie('app sans comptes', async () => {
    const { lire } = chargeApp(base());
    const p = await lire();
    dit(!!p && p.sansPreuve === null, 'sans comptes demandés, la liste « pas reliées » vaut null (pas calculée), jamais []');
  });

  console.log('\n3. « PAS SU » ET CE QUE ÇA COÛTE (app)');
  await essaie('pas su', async () => {
    for (const [quoi, re] of [['les transactions', /_txn_/], ['les bordereaux', /_label_/], ['les ventes', /orders_sold/]]) {
      const { lire } = chargeApp(base(), (u) => re.test(u));
      const p = await lire({ comptes: [A] });
      dit(p === null, `${quoi} illisibles ⇒ null (« pas su »), jamais une demi-preuve`, p ? JSON.stringify(trie(p.vendus)) : '');
    }
    // Tout est déjà prouvé par une transaction FINALISÉE (un état terminal) :
    // les ventes ne sont PAS lues.
    const l = base();
    for (const k of Object.keys(l)) if (/_label_|_txn_/.test(k)) delete l[k];
    l[`harvest_${A}_txn_7000000558`] = { type: 'transaction', uid: A, capturedAt: iso(0), payload: { transaction: { id: 7000000558, item_id: 9000000558, status: 450, status_title: "Commande finalisée - l'acheteur a validé la commande" } } };
    l[`harvest_${A}_label_7000000558`] = { tx: '7000000558', item: '9000000558', capturedAt: iso(0) };
    const { lire, lus } = chargeApp(l, (u) => /orders_sold/.test(u));
    const p = await lire();
    dit(!!p && p.vendus.has('9000000558') && !lus.some((u) => /orders_sold/.test(u)), 'tout prouvé par une transaction FINALISÉE, aucun bordereau à juger ⇒ les ventes ne sont pas lues (et leur panne ne compte pas)', lus.filter((u) => /orders_sold/.test(u)).join(' · '));
    dit(lus.length === 2, 'deux lectures en tout (transactions, bordereaux) — pas une de plus', `${lus.length} : ${lus.map((u) => (/id=([^&]*)/.exec(u) || [])[1]).join(' · ')}`);
    // Une transaction à un état NON terminal ne prouve qu'un instantané : sa
    // vente est lue, et si elle ne se lit pas, c'est « pas su ».
    const l3 = base();
    for (const k of Object.keys(l3)) if (/_label_/.test(k)) delete l3[k];
    const r3 = chargeApp(l3, (u) => /orders_sold/.test(u));
    const p3 = await r3.lire();
    dit(p3 === null && r3.lus.some((u) => /orders_sold/.test(u)), 'une transaction « Bordereau envoyé au vendeur » (instantané) ⇒ sa vente EST lue, et sa panne vaut « pas su »', p3 ? JSON.stringify(trie(p3.vendus)) : '');
  });

  console.log('\n3 bis. LA TRANSACTION RANGÉE EST UN INSTANTANÉ : UNE VENTE REMBOURSÉE ENSUITE N\'EST PAS VENDUE (revue du 11 octobre)');
  // La forme EXACTE que la 5.167 écrit (mesurée 5 fois en production) : le
  // bordereau + la transaction « Le paiement a été validé », puis la vente
  // passe « Remboursement effectué » (failed). L'annonce revient en ligne.
  const instantane = () => {
    const l = base();
    const va = l[`harvest_${A}_orders_sold`].payload.my_orders;
    va.push(vente(7000000572, 'Remboursement effectué', 'failed'),             // txn + bordereau ⇒ la paire est REVENUE
      vente(7000000573, 'Le paiement a été validé', 'needs_action'),           // txn « payée », vente vivante ⇒ PROUVÉE
      vente(7000000575, 'Commande annulée', 'failed'));                        // txn seule (pas de bordereau) ⇒ REVENUE
    const tx = (t, it, titre) => ({ type: 'transaction', uid: A, capturedAt: iso(-2), payload: { transaction: { id: t, item_id: it, status: 230, status_title: titre } } });
    l[`harvest_${A}_txn_7000000572`] = tx(7000000572, 9000000572, 'Le paiement a été validé');
    l[`harvest_${A}_label_7000000572`] = { uid: A, tx: '7000000572', item: '9000000572', capturedAt: iso(-2) };
    l[`harvest_${A}_txn_7000000573`] = tx(7000000573, 9000000573, 'Le paiement a été validé');
    l[`harvest_${A}_txn_7000000574`] = tx(7000000574, 9000000574, 'Le paiement a été validé'); // vente plus dans la liste captée ⇒ l'instantané tient
    l[`harvest_${A}_txn_7000000575`] = tx(7000000575, 9000000575, 'Bordereau envoyé au vendeur');
    return l;
  };
  await essaie('instantané app', async () => {
    const { lire } = chargeApp(instantane());
    const p = await lire({ comptes: [A, B] });
    const v = p ? trie(p.vendus) : null;
    dit(!!p && !p.vendus.has('9000000572'), 'bordereau + transaction « Le paiement a été validé » + vente « Remboursement effectué » ⇒ PAS vendue (la vente relue prime sur l\'instantané)', JSON.stringify(v));
    dit(!!p && !p.vendus.has('9000000575'), 'transaction seule « Bordereau envoyé au vendeur » + vente « Commande annulée » ⇒ PAS vendue', JSON.stringify(v));
    dit(!!p && p.vendus.has('9000000573'), 'l\'autre sens : transaction « payée » + vente vivante ⇒ PROUVÉE', JSON.stringify(v));
    dit(!!p && p.vendus.has('9000000574'), 'et une vente qu\'on ne retrouve pas dans les ventes lues : l\'instantané est la seule information, il tient', JSON.stringify(v));
    dit(!!p && p.vendus.has('9000000553') && p.vendus.has('9000000560'), 'les preuves d\'avant tiennent (bordereau seul, transaction + vente vivante)', JSON.stringify(v));
  });
  await essaie('instantané extension', async () => {
    const e = chargeExt({ lignes: instantane() });
    const r = await e.ctx.lireVentesProuvees();
    const v = trie(r && r.vendus);
    const { lire } = chargeApp(instantane());
    const p = await lire();
    dit(!!r && r.echec === false && !r.vendus.has('9000000572') && !r.vendus.has('9000000575') && r.vendus.has('9000000573') && r.vendus.has('9000000574'), 'la MÊME règle dans les files Leboncoin et eBay de l\'extension', JSON.stringify(v));
    dit(!!p && JSON.stringify(v) === JSON.stringify(trie(p.vendus)), 'app et extension rendent la MÊME sortie (§11)', `app=${JSON.stringify(p && trie(p.vendus))} · ext=${JSON.stringify(v)}`);
  });
  await essaie('instantané rejoué de bout en bout', async () => {
    // Le geste réel : « Générer le bordereau » (le vrai `recupererLabel`), puis la vente est remboursée.
    const vinted = (r) => {
      if (/\/api\/v2\/transactions\/7000000700$/.test(r.chemin)) return { status: 200, body: { transaction: { id: 7000000700, item_id: 9000000700, status: 200, status_title: 'Bordereau envoyé au vendeur', shipment: { id: 55501 } } } };
      if (/\/api\/v2\/shipments\/55501\/label_url$/.test(r.chemin)) return { status: 200, body: { url: 'https://svc-shipping-labels.s3.eu-central-1.amazonaws.com/l.pdf' } };
      return { status: 404, body: {} };
    };
    const e = chargeExt({ lignes: { [`harvest_${A}_orders_sold`]: { capturedAt: iso(0), payload: { my_orders: [vente(7000000700, 'Le paiement a été validé', 'needs_action')] } } }, vinted });
    const r = await e.ctx.recupererLabel(ACC(A), A, '7000000700');
    dit(!!r && r.ok && !!e.lignes[`harvest_${A}_txn_7000000700`], 'le bordereau part et range sa transaction (la forme de la 5.167)');
    e.lignes[`harvest_${A}_orders_sold`] = { capturedAt: iso(0), payload: { my_orders: [vente(7000000700, 'Commande annulée', 'failed', -3)] } };
    const x = await e.ctx.lireVentesProuvees();
    const { lire } = chargeApp(e.lignes);
    const p = await lire();
    dit(!!x && !x.vendus.has('9000000700') && !!p && !p.vendus.has('9000000700'), 'vente annulée ensuite ⇒ la paire n\'est plus « vendue », ni pour l\'extension ni pour l\'app', `ext=${JSON.stringify(trie(x && x.vendus))} · app=${JSON.stringify(trie(p && p.vendus))}`);
    const noms = ['cleNum', 'NUM_OK', 'marqueurNumerotation', 'archiveNumeros', 'coupureNumerotation', 'numDeSkuEbay', 'skuEbayDe', 'traductionAnnonce', 'numeroExterne', 'PANNE_NUMEROS', 'ficheAVerifier', 'normTitle', 'LIENS_EBAY', '_depuisEbay', '_fichesEbayMemo', 'fichesPourEbay', 'lienEbay', 'numEbayLu', 'numLigneEbay', 'commandeEbayEngagee', 'doublesVenteEbay'];
    const ctx = { console }; vm.createContext(ctx);
    vm.runInContext('const load = (k, d) => d;\n' + noms.map((n) => { try { return extraire(APP, n); } catch (_) { return ''; } }).join('\n') + '\n;this.D = doublesVenteEbay;', ctx);
    const d = ctx.D({ annonces: [{ itemId: '128000000040', sku: 'VRM-40', title: 'paire 40' }], commandes: [], numeros: { 9000000700: { numero: '40' } }, enLigne: new Set(['9000000700']), vendusVinted: p ? p.vendus : null, programmees: [] });
    dit(d.aRetirerEbay.length === 0, 'et RIEN n\'est proposé au retrait d\'eBay (ni retiré tout seul) : la paire est revenue en ligne', JSON.stringify(d.aRetirerEbay.map((y) => y.numero)));
  });

  console.log('\n3 ter. LA LECTURE DES AUTRES COMPTES NE FAIT PAS TOMBER LA PREUVE (revue du 11 octobre)');
  await essaie('autres comptes', async () => {
    // Le compte A n'a rien à juger (transaction finalisée) ; l'écran eBay demande A et B
    // pour la ligne « pas reliées », et les ventes ne répondent pas.
    const l = base();
    for (const k of Object.keys(l)) if (/_label_|_txn_/.test(k)) delete l[k];
    l[`harvest_${A}_txn_7000000558`] = { type: 'transaction', uid: A, capturedAt: iso(0), payload: { transaction: { id: 7000000558, item_id: 9000000558, status: 450, status_title: 'Commande finalisée' } } };
    const { lire } = chargeApp(l, (u) => /orders_sold/.test(u));
    const p = await lire({ comptes: [A, B] });
    dit(!!p && p.vendus.has('9000000558'), 'ventes des comptes demandés illisibles ⇒ la vente prouvée par sa transaction reste « vendue » (pas « pas su »)', p ? JSON.stringify(trie(p.vendus)) : 'null');
    dit(!!p && p.sansPreuve === null, 'et c\'est la ligne « pas reliées » qui vaut null (pas su), jamais []', p ? JSON.stringify(p.sansPreuve) : 'null');
    const ok = chargeApp(l);
    const q = await ok.lire({ comptes: [A, B] });
    dit(!!q && Array.isArray(q.sansPreuve) && q.sansPreuve.length > 0, 'l\'autre sens : quand elles se lisent, la ligne est calculée', q ? JSON.stringify((q.sansPreuve || []).map((x) => x.tx)) : 'null');
    dit(!!q && (q.sansPreuve || []).every((x) => typeof x.titre === 'string' && x.titre), 'et chaque vente porte son TITRE (l\'écran la nomme)', q ? JSON.stringify((q.sansPreuve || []).map((x) => x.titre)) : '');
  });

  console.log('\n4. LA VENTE D\'HIER, REJOUÉE JUSQU\'À L\'ALERTE (app)');
  await essaie('doublesVenteEbay', async () => {
    const { lire } = chargeApp(base());
    const p = await lire({ comptes: [A] });
    const noms = ['cleNum', 'NUM_OK', 'marqueurNumerotation', 'archiveNumeros', 'coupureNumerotation', 'numDeSkuEbay', 'skuEbayDe', 'numeroExterne', 'PANNE_NUMEROS', 'ficheAVerifier', 'normTitle', 'LIENS_EBAY', '_depuisEbay', '_fichesEbayMemo', 'fichesPourEbay', 'lienEbay', 'numEbayLu', 'numLigneEbay', 'commandeEbayEngagee', 'doublesVenteEbay'];
    const ctx = { console }; vm.createContext(ctx);
    vm.runInContext('const load = (k, d) => d;\n' + noms.map((n) => extraire(APP, n)).join('\n') + '\n;this.D = doublesVenteEbay;', ctx);
    const r = ctx.D({ annonces: [{ itemId: '128000000553', sku: 'VRM-553', title: 'Autry reelwind beige 36' }, { itemId: '128000000559', sku: 'VRM-559', title: 'autre paire' }],
      commandes: [], numeros: { 9000000553: { numero: '553' }, 9000000559: { numero: '559' } }, enLigne: new Set(['9000000559']), vendusVinted: p ? p.vendus : null, programmees: [] });
    dit(r.aRetirerEbay.length === 1 && r.aRetirerEbay[0].numero === '553' && r.aRetirerEbay[0].annonce.itemId === '128000000553', 'N°553 vendue (bordereau seul) ⇒ son annonce eBay « VRM-553 » est « à retirer » — et elle seule', JSON.stringify(r.aRetirerEbay.map((d) => d.numero)));
  });

  console.log('\n5. LA MÊME RÈGLE DANS L\'EXTENSION (files Leboncoin et eBay)');
  await essaie('extension lireVentesProuvees', async () => {
    const e = chargeExt({ lignes: base() });
    const r = await e.ctx.lireVentesProuvees();
    const v = trie(r && r.vendus);
    dit(!!r && r.echec === false, 'elle se lit (pas d\'échec) quand tout se lit');
    dit(JSON.stringify(v) === JSON.stringify(ATTENDU_VENDUS), 'exactement les mêmes ventes prouvées que l\'app (§11)', JSON.stringify(v));
    dit(vendusApp === null || JSON.stringify(v) === JSON.stringify(vendusApp), 'app et extension rendent la MÊME sortie sur la même base', `app=${JSON.stringify(vendusApp)} · ext=${JSON.stringify(v)}`);
    dit(!e.lus.some((u) => /select=data(&|$)/.test(u) || /pdfB64/.test(u) || /_listings/.test(u)), 'ni ligne entière, ni PDF, ni dressing lus');
    for (const [quoi, re] of [['bordereaux', /_label_/], ['ventes', /orders_sold/]]) {
      const k = chargeExt({ lignes: base(), ko: (u) => re.test(u) });
      const x = await k.ctx.lireVentesProuvees();
      dit(!!x && x.echec === true, `${quoi} illisibles ⇒ l'échec est PORTÉ (la file dit « je n'ai pas pu vérifier »)`, JSON.stringify(x && { echec: x.echec, n: x.vendus && x.vendus.size }));
    }
  });

  console.log('\n6. LE BORDEREAU RANGE LA TRANSACTION QU\'IL LIT (extension)');
  const TXT = (tx, avecExp) => ({ transaction: { id: tx, item_id: 9000000600, status: 200, status_title: 'Bordereau envoyé au vendeur', ...(avecExp ? { shipment: { id: 55501 } } : {}) } });
  await essaie('recupererLabel', async () => {
    const vinted = (r) => {
      if (/\/api\/v2\/transactions\/7000000600$/.test(r.chemin)) return { status: 200, body: TXT(7000000600, true) };
      if (/\/api\/v2\/shipments\/55501\/label_url$/.test(r.chemin)) return { status: 200, body: { url: 'https://svc-shipping-labels.s3.eu-central-1.amazonaws.com/l.pdf' } };
      return { status: 404, body: {} };
    };
    const e = chargeExt({ lignes: {}, vinted });
    const r = await e.ctx.recupererLabel(ACC(A), A, '7000000600');
    const req = e.j.vinted.map((x) => `${x.methode} ${x.chemin}`);
    dit(!!r && r.ok === true, 'le bordereau part toujours (rien de cassé)', JSON.stringify(r));
    dit(JSON.stringify(req) === JSON.stringify(['GET /api/v2/transactions/7000000600', 'GET /api/v2/shipments/55501/label_url']), 'AUCUNE requête Vinted de plus que la 5.164 (la transaction était déjà lue)', JSON.stringify(req));
    const t = e.lignes[`harvest_${A}_txn_7000000600`];
    dit(!!t && t.type === 'transaction' && t.payload && t.payload.transaction && String(t.payload.transaction.item_id) === '9000000600' && t.payload.transaction.status_title === 'Bordereau envoyé au vendeur',
      'la transaction lue est RANGÉE sous harvest_{uid}_txn_{tx}, la forme de `capterDatesVersement`', String(JSON.stringify(t && t.payload) || 'aucune ligne').slice(0, 160));
    const v = await e.ctx.lireVentesProuvees();
    dit(!!v && v.vendus.has('9000000600'), 'et la vente est aussitôt PROUVÉE pour les files Leboncoin et eBay');
    const { lire } = chargeApp(e.lignes);
    const p = await lire();
    dit(!!p && p.vendus.has('9000000600'), 'et pour l\'app (anti double vente eBay), sans rien changer chez elle');
  });
  await essaie('recupererLabelInsiste', async () => {
    let n = 0;
    const vinted = (r) => {
      if (/\/api\/v2\/transactions\/7000000601$/.test(r.chemin)) { n++; return { status: 200, body: { transaction: { ...TXT(7000000601, n >= 3).transaction, id: 7000000601 } } }; }
      if (/\/api\/v2\/shipments\/55501\/label_url$/.test(r.chemin)) return { status: 200, body: {} };   // pas encore d'URL : il insiste
      return { status: 404, body: {} };
    };
    const e = chargeExt({ lignes: {}, vinted });
    await e.ctx.recupererLabelInsiste(ACC(A), A, '7000000601');
    const ecritures = e.j.posts.flat().filter((id) => id === `harvest_${A}_txn_7000000601`).length;
    dit(n >= 2, 'le scénario insiste bien (la transaction est relue tant que l\'expédition manque)', `${n} lecture(s)`);
    dit(ecritures === 1, 'UNE seule écriture de la transaction par appel, même quand il insiste', `${ecritures} écriture(s)`);
  });
  await essaie('autre transaction', async () => {
    const vinted = (r) => (/\/api\/v2\/transactions\/7000000602$/.test(r.chemin) ? { status: 200, body: TXT(7000000699, false) } : { status: 404, body: {} });
    const e = chargeExt({ lignes: {}, vinted });
    await e.ctx.recupererLabel(ACC(A), A, '7000000602');
    dit(!e.lignes[`harvest_${A}_txn_7000000602`] && !e.lignes[`harvest_${A}_txn_7000000699`], 'une réponse qui porte une AUTRE transaction n\'est pas rangée (pas de preuve pour la mauvaise vente)');
  });

  console.log('\n7. LES VENTES EN COURS SANS PREUVE : capterPreuvesVente (extension)');
  const lignesP = () => {
    const l = base();
    const v = l[`harvest_${A}_orders_sold`].payload.my_orders;
    v.push(vente(7000000565, 'Le paiement a été validé', 'needs_action'), vente(7000000566, 'Le paiement a été validé', 'needs_action'));
    return l;
  };
  const vintedP = (statut = 200) => (r) => {
    const m = /\/api\/v2\/transactions\/(\d+)$/.exec(r.chemin);
    return m ? (statut === 200 ? { status: 200, body: { transaction: { id: Number(m[1]), item_id: Number(m[1]) + 2000000000, status: 200, status_title: 'Le paiement a été validé' } } } : { status: statut, body: {} }) : { status: 404, body: {} };
  };
  const lusTx = (e) => e.j.vinted.filter((x) => /\/api\/v2\/transactions\/\d+$/.test(x.chemin)).map((x) => /(\d+)$/.exec(x.chemin)[1]);
  await essaie('capterPreuvesVente', async () => {
    const e = chargeExt({ lignes: lignesP(), vinted: vintedP() });
    await e.ctx.capterPreuvesVente(A);
    const l1 = lusTx(e);
    const candidates = ['7000000557', '7000000562', '7000000563', '7000000565', '7000000566'];
    dit(l1.length === 3, 'au plus 3 transactions lues par visite', `${l1.length} : ${l1.join(', ')}`);
    dit(l1.every((t) => candidates.includes(t)), 'et seulement des ventes EN COURS sans preuve (jamais la prouvée par bordereau ou transaction, ni la finalisée, la revenue, la vieille)', l1.join(', '));
    dit(l1.every((t) => !!e.lignes[`harvest_${A}_txn_${t}`]), 'chaque transaction lue est rangée (la preuve existe désormais)');
    dit(!((e.store.vrmActions || {})[A] || []).length && ((e.store.vrmLectures || {})[A] || []).length === 3, 'une LECTURE : budget de lecture, aucune action consommée', JSON.stringify({ actions: ((e.store.vrmActions || {})[A] || []).length, lectures: ((e.store.vrmLectures || {})[A] || []).length }));
    await e.ctx.capterPreuvesVente(A);
    const l2 = lusTx(e).slice(l1.length);
    dit(l2.length === 2 && l2.every((t) => candidates.includes(t) && !l1.includes(t)), 'la visite suivante lit les deux restantes, jamais deux fois la même', l2.join(', '));
    await e.ctx.capterPreuvesVente(A);
    dit(lusTx(e).length === 5, 'puis plus rien : tout est prouvé', `${lusTx(e).length} lecture(s) en tout`);
    dit(e.j.evts.some((x) => x && x.type === 'maj' && x.quoi === 'preuves'), 'et l\'app est prévenue (elle relit la preuve)');
  });
  await essaie('memo 6 h', async () => {
    // Un REFUS de Vinted (404 : il a jugé cette transaction) — pas un échec
    // passager (voir le §10 pour ceux-là).
    const e = chargeExt({ lignes: lignesP(), vinted: vintedP(404) });
    await e.ctx.capterPreuvesVente(A);
    const n1 = lusTx(e).length;
    await e.ctx.capterPreuvesVente(A);
    dit(n1 === 3 && lusTx(e).length === 5, 'une lecture REFUSÉE par Vinted (404) ne se retente pas avant 6 h (les deux autres passent)', `${n1} puis ${lusTx(e).length}`);
    await e.ctx.capterPreuvesVente(A);
    dit(lusTx(e).length === 5, 'et rien n\'est relu dans les 6 h', `${lusTx(e).length}`);
    const memo = e.store.vrmPreuveFaits || {};
    for (const k of Object.keys(memo)) memo[k] = Date.now() - 7 * 3600000;
    e.store.vrmPreuveFaits = memo;
    await e.ctx.capterPreuvesVente(A);
    dit(lusTx(e).length === 8, 'passé 6 h, on réessaie (3 par visite)', `${lusTx(e).length}`);
  });
  await essaie('garde', async () => {
    const e = chargeExt({ lignes: lignesP(), vinted: vintedP(), connecte: '999' });
    await e.ctx.capterPreuvesVente(A);
    dit(lusTx(e).length === 0, 'Chrome connecté sur un AUTRE compte ⇒ aucune requête (on ne lit jamais au nom d\'un autre, §3)', `${lusTx(e).length}`);
    const p = chargeExt({ lignes: lignesP(), vinted: vintedP(), store: { vrmPauseVinted: { jusqua: Date.now() + 3600000, niveau: 1 } } });
    await p.ctx.capterPreuvesVente(A);
    dit(lusTx(p).length === 0, 'Vinted a demandé de ralentir ⇒ aucune requête', `${lusTx(p).length}`);
  });
  await essaie('pas su', async () => {
    for (const [quoi, re] of [['ventes', /orders_sold/], ['transactions', /_txn_/], ['bordereaux', /_label_/]]) {
      const e = chargeExt({ lignes: lignesP(), vinted: vintedP(), ko: (u) => re.test(u) });
      await e.ctx.capterPreuvesVente(A);
      dit(lusTx(e).length === 0, `${quoi} illisibles ⇒ on ne lit RIEN chez Vinted (« pas su » ne relance pas tout)`, `${lusTx(e).length}`);
    }
  });
  await essaie('visite', () => {
    const corps = (/async function visiteVinted\(\) \{([\s\S]*?)\n\}\n/.exec(EXT) || [])[1] || '';
    const i = corps.indexOf('await capterPreuvesVente(uid);'), j = corps.indexOf('await capterRetraits(uid);'), k = corps.indexOf('const r = await runActive();');
    dit(i > 0 && k > 0 && k < i && i < j, 'la visite lit les preuves APRÈS la moisson (les ventes viennent d\'être captées) et AVANT le reste');
    dit(/preuve: PREUVE_MAX_PAR_VISITE/.test(EXT), 'et leur place est gardée dans la réserve des lectures prioritaires (les photos ne la mangent pas)');
  });

  // ══ 10. UN ÉCHEC PASSAGER NE BLOQUE PAS 6 H (relecture croisée de la 5.174) ══
  // Mesuré sur 0caff0d : le mémo était posé AVANT la requête et jamais ôté — une
  // écriture refusée par notre base (recul d'une minute) ou un 429 (pause de
  // 15 min) cachaient la vente à l'anti double vente pendant 6 h, alors que
  // l'écran eBay promettait « à ta prochaine visite ».
  console.log('\n10. UN ÉCHEC PASSAGER NE BLOQUE PAS 6 H (preuves, codes de retrait, versements)');
  // L'horloge du service worker, pilotée (`__dec` ms de plus).
  const horloge = (e) => { vm.runInContext('(function(){ var r = Date.now; Date.now = function(){ return r() + (globalThis.__dec || 0); }; })();', e.ctx); e.ctx.__dec = 0; return (ms) => { e.ctx.__dec = ms; }; };
  // Notre base REFUSE les écritures qui répondent à `re` tant que `etat.ko`.
  const ecritureKO = (e, re, etat) => { const f0 = e.ctx.fetch; e.ctx.fetch = async (u, o = {}) => (etat.ko && /\/rest\/v1\//.test(String(u)) && String(o.method || 'GET') === 'POST' && re.test(String(o.body || '')) ? { ok: false, status: 503, headers: { get: () => 'text/html' }, json: async () => null, text: async () => '<html>503</html>', clone() { return this; } } : f0(u, o)); };
  const dues = (e, quoi) => (((e.store.vrmLecturesDues || {})[A] || {})[quoi] || {}).reste;
  const rangees = (e) => Object.keys(e.lignes).filter((k) => /_txn_70000005(57|62|63|65|66)$/.test(k)).map((k) => k.split('_').pop()).sort();
  await essaie('preuve : écriture refusée', async () => {
    const etat = { ko: true };
    const e = chargeExt({ lignes: lignesP(), vinted: vintedP() });
    const temps = horloge(e); ecritureKO(e, /_txn_/, etat);
    await e.ctx.capterPreuvesVente(A);
    const l1 = lusTx(e);
    dit(l1.length === 1 && rangees(e).length === 0, 'notre base refuse l\'écriture : on s\'arrête à la première (la suivante échouerait aussi)', `${l1.length} lue(s), ${rangees(e).length} rangée(s)`);
    dit(dues(e, 'preuve') === 5, 'et les 5 ventes restent comptées dans la réserve de lecture (les photos ne la mangent pas)', String(dues(e, 'preuve')));
    etat.ko = false; temps(2 * 60000);                      // la base est revenue
    await e.ctx.capterPreuvesVente(A);
    dit(lusTx(e).slice(l1.length).includes(l1[0]) && rangees(e).includes(l1[0]), 'base revenue ⇒ à la visite suivante (2 min), la vente est RELUE et prouvée — pas dans 6 h', `relues : ${lusTx(e).slice(l1.length).join(', ')} · rangées : ${rangees(e).join(', ')}`);
  });
  await essaie('preuve : 429 puis fin de pause', async () => {
    const etat = { frein: 1 };
    const e = chargeExt({ lignes: lignesP(), vinted: (r) => (/\/transactions\//.test(r.chemin) && etat.frein > 0 ? (etat.frein--, { status: 429, body: {} }) : vintedP()(r)) });
    const temps = horloge(e);
    await e.ctx.capterPreuvesVente(A);
    const l1 = lusTx(e);
    dit(l1.length === 1 && !!(e.store.vrmPauseVinted && e.store.vrmPauseVinted.jusqua), 'un 429 : la pause s\'ouvre, plus rien ne part', `${l1.length} lue(s)`);
    dit(dues(e, 'preuve') === 5, 'la vente freinée reste comptée dans la réserve', String(dues(e, 'preuve')));
    temps(16 * 60000);                                      // la pause (15 min) est finie
    await e.ctx.capterPreuvesVente(A);
    dit(lusTx(e).slice(1).includes(l1[0]) && rangees(e).includes(l1[0]), 'pause finie ⇒ la vente freinée est RELUE et prouvée (pas dans 6 h)', `relues : ${lusTx(e).slice(1).join(', ')}`);
  });
  await essaie('preuve : 401, réseau', async () => {
    for (const st of [401, 0]) {
      const etat = { n: 1 };
      const e = chargeExt({ lignes: lignesP(), vinted: (r) => (/\/transactions\//.test(r.chemin) && etat.n > 0 ? (etat.n--, { status: st, body: {} }) : vintedP()(r)) });
      await e.ctx.capterPreuvesVente(A);
      const l1 = lusTx(e);
      await e.ctx.capterPreuvesVente(A);
      dit(lusTx(e).slice(l1.length).includes(l1[0]), `${st === 0 ? 'une coupure réseau' : 'un 401'} : la vente est relue à la visite suivante`, `${l1.join(', ')} → ${lusTx(e).slice(l1.length).join(', ')}`);
    }
  });
  await essaie('preuve : 5xx', async () => {
    const e = chargeExt({ lignes: lignesP(), vinted: vintedP(503) });
    const temps = horloge(e);
    await e.ctx.capterPreuvesVente(A);
    await e.ctx.capterPreuvesVente(A);
    const n = lusTx(e).length;
    temps(20 * 60000); await e.ctx.capterPreuvesVente(A);
    dit(lusTx(e).length === n, 'Vinted en panne (5xx) : pas relu dans les 30 min (une transaction cassée ne mange pas le budget à chaque visite)', `${n} → ${lusTx(e).length}`);
    temps(31 * 60000); await e.ctx.capterPreuvesVente(A);
    dit(lusTx(e).length > n, '… mais relu après 30 min, pas 6 h', `${n} → ${lusTx(e).length}`);
  });
  await essaie('versement : écriture refusée, 429', async () => {
    const finalisee = (tx) => vente(tx, "Commande finalisée - l'acheteur a validé la commande", 'completed');
    const lignesV = () => ({ [`harvest_${A}_orders_sold`]: { capturedAt: iso(0), payload: { my_orders: [finalisee(7000000801), finalisee(7000000802)] } } });
    const vintedV = (etat) => (r) => {
      const m = /\/api\/v2\/transactions\/(\d+)$/.exec(r.chemin);
      if (!m) return { status: 404, body: {} };
      if (etat.frein > 0) { etat.frein--; return { status: 429, body: {} }; }
      return { status: 200, body: { transaction: { id: Number(m[1]), item_id: 1, status: 450, status_title: 'Commande finalisée', status_updated_at: '2026-10-01T08:00:00+02:00' } } };
    };
    const datees = (e) => Object.keys(e.lignes).filter((k) => /_txn_700000080/.test(k)).length;
    { const etat = { ko: true, frein: 0 };
      const e = chargeExt({ lignes: lignesV(), vinted: vintedV(etat) });
      const temps = horloge(e); ecritureKO(e, /_txn_/, etat);
      await e.ctx.capterDatesVersement(A);
      const n1 = lusTx(e).length;
      etat.ko = false; temps(2 * 60000);
      await e.ctx.capterDatesVersement(A);
      dit(n1 === 1 && datees(e) === 2, 'versement : notre base refuse ⇒ on s\'arrête, puis la date est relue et rangée à la visite suivante (pas dans 24 h)', `${n1} lue(s) puis ${datees(e)} datée(s)`); }
    { const etat = { ko: false, frein: 1 };
      const e = chargeExt({ lignes: lignesV(), vinted: vintedV(etat) });
      const temps = horloge(e);
      await e.ctx.capterDatesVersement(A);
      temps(16 * 60000);
      await e.ctx.capterDatesVersement(A);
      dit(datees(e) === 2, 'versement : un 429 ⇒ relue après la pause, pas dans 24 h', `${datees(e)} datée(s)`); }
  });
  await essaie('retrait : écriture refusée, 429', async () => {
    const achat = { transaction_id: 7000000901, conversation_id: 7000000911, status: 'Colis déposé au point relais', title: 'Paire achetée' };
    const lignesR = () => ({ [`harvest_${A}_orders_purchased`]: { capturedAt: iso(0), payload: { my_orders: [achat] } } });
    const conv = { conversation: { id: 7000000911, transaction: { id: 7000000901, item_id: 1, current_user_side: 'buyer' }, messages: [{ entity_type: 'action_message', entity: { title: 'Ton colis est arrivé !', subtitle: "Il t'attend à l'adresse suivante : Kusmi Tea, 13 Rue Saint-Vincent, 56000 Vannes, France. Saisis le code C65735 pour le récupérer." } }] } };
    const vintedR = (etat) => (r) => (/\/api\/v2\/conversations\/7000000911$/.test(r.chemin) ? (etat.frein > 0 ? (etat.frein--, { status: 429, body: {} }) : { status: 200, body: conv }) : { status: 404, body: {} });
    const code = (e) => ((e.lignes.panel_colis_relais || {})['7000000901'] || {}).code || '';
    const lusC = (e) => e.j.vinted.filter((x) => /\/conversations\//.test(x.chemin)).length;
    { const etat = { ko: true, frein: 0 };
      const e = chargeExt({ lignes: lignesR(), vinted: vintedR(etat) });
      const temps = horloge(e); ecritureKO(e, /panel_colis_relais/, etat);
      await e.ctx.capterRetraits(A);
      dit(lusC(e) === 1 && !code(e), 'retrait : le code est lu mais notre base refuse l\'écriture', `${lusC(e)} lecture(s), code « ${code(e)} »`);
      etat.ko = false; temps(2 * 60000);
      await e.ctx.capterRetraits(A);
      dit(code(e) === 'C65735', 'base revenue ⇒ relu et RANGÉ à la visite suivante (pas dans 6 h : un code manqué, c\'est un colis qui repart)', `code « ${code(e)} », ${lusC(e)} lecture(s)`); }
    { const etat = { ko: false, frein: 1 };
      const e = chargeExt({ lignes: lignesR(), vinted: vintedR(etat) });
      const temps = horloge(e);
      await e.ctx.capterRetraits(A);
      temps(16 * 60000);
      await e.ctx.capterRetraits(A);
      dit(code(e) === 'C65735', 'retrait : un 429 ⇒ relu après la pause, pas dans 6 h', `code « ${code(e)} »`); }
  });

  console.log(`\n${ok} vert(s), ${ko} rouge(s).`);
  process.exit(ko ? 1 : 0);
})();
