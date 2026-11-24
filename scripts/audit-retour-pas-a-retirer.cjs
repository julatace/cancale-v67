// ════════════════════════════════════════════════════════════════════════════
//  AUDIT « UN ACHAT EN RETOUR N'EST JAMAIS À RETIRER » (15 nov., audit de fiabilité)
//  Mesuré (lecture seule) : un achat « Autry » de Julien porte encore, dans la liste de
//  ses achats lue AVANT le retour, « La livraison n'a pas encore eu lieu - colis déposé
//  en bureau de Poste ou point relais » avec `needs_action` — la règle « au point relais »
//  (`isAtRelayStatus`) le compte ; le résumé de l'extension le range dans les achats au
//  point (`resume.txns`) ; son BORDEREAU DE RETOUR est arrivé par e-mail le 15 nov.
//  (`email_bordretour_{tx}`, sens « achat »). Vinted ne donne un bordereau de retour qu'à
//  l'acheteur qui A le colis : il n'est plus « à retirer », sa carte est « À renvoyer ».
//  Exécuté ici :
//   1. la règle partagée (api/_lib/suivi-colis.js : `txAchatsEnRetour`, `achatEnRetour`,
//      `finDeCommandeAchat`, `finDesTransactions`) sur la forme mesurée ;
//   2. l'étiquette de l'écran Achats (`etapeAchat`, App.jsx) : « À renvoyer », pas « À retirer » ;
//   3. LE WIDGET (api/widget.js, la route EXÉCUTÉE sur une fausse base cloisonnée, projections
//      `select=` appliquées) : sans publication de l'app, et après elle (un achat vu « au point »
//      après la publication) — l'achat en retour n'est jamais compté ; bordereaux pas lus ⇒ rien
//      écarté (« pas su ») ; un bordereau de sens « vente » n'écarte rien ;
//   4. l'app (Achats, Colis, Ma journée, la publication `vrm_colis_retirer`) et le rappel du matin
//      lisent la même règle (texte, commentaires retirés).
//  `--src <arbre>` · `--mutation=<nom>|toutes`.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
require('./_source-app.cjs').brancher();   // (22 nov., intégration finale) Comptabilite vit dans src/ecrans/ : la lecture d'App.jsx rend le texte entier
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'cle-service-audit';
const fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm');
const { spawnSync } = require('child_process');
const iSrc = process.argv.indexOf('--src');
const RACINE = iSrc > 0 ? path.resolve(process.argv[iSrc + 1]) : path.join(__dirname, '..');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').slice(11);

const MUTATIONS = {
  regle: ['api/_lib/suivi-colis.js', "  if (retour === true) return 'retire';\n", ''],
  sens: ['api/_lib/suivi-colis.js', "if (!b || String(b.sens || '').toLowerCase() === 'vente') continue;", 'if (!b) continue;'],
  widget: ['api/widget.js', "txBuy.filter(t => !pickupDone[String(t)] && pasEnRetour(t)).length", 'txBuy.filter(t => !pickupDone[String(t)]).length'],
  widgetApres: ['api/widget.js', '    if (enRetour && enRetour.has(t)) continue;                        // (15 nov.) en retour : jamais à retirer\n', ''],
  app: ['src/App.jsx', 'const vintedToPickup = useMemo(() => auRelaisVus.filter(o => !achatEnRetour(o, txRetourAchat)), [auRelaisVus, txRetourAchat]);', 'const vintedToPickup = auRelaisVus;'],
  etiquette: ['src/App.jsx', "  if (retour) return { label: 'À renvoyer', step: 1, color: C.warn, retour: true };\n", ''],
  avis: ['api/_lib/suivi-colis.js', '      if (txs && txs.size === 1) out.add([...txs][0]);', ''],
  avisWidget: ['api/widget.js', 'return txAchatsEnRetour(j, { demandes: dm, achats });', 'return txAchatsEnRetour(j);'],
  cron: ['api/ship-reminders.js', 'finDesTransactions(txDuColis({ suivi, code }, relais, liens), achats, etats, retours)', 'finDesTransactions(txDuColis({ suivi, code }, relais, liens), achats, etats)'],
};
if (MUT) {
  const noms = MUT === 'toutes' ? Object.keys(MUTATIONS) : [MUT];
  let attrapees = 0;
  for (const nom of noms) {
    const m = MUTATIONS[nom]; if (!m) { console.log(`❌ mutation inconnue : ${nom}`); continue; }
    const t = fs.mkdtempSync(path.join(os.tmpdir(), 'mut-rr-'));
    for (const d of ['src', 'api']) fs.cpSync(path.join(RACINE, d), path.join(t, d), { recursive: true, filter: (f) => !/node_modules|\.zip$|\.png$|\.woff2?$|\.jpg$/.test(f) });
    try { fs.symlinkSync(path.join(__dirname, '..', 'node_modules'), path.join(t, 'node_modules')); } catch (_) {}
    try { fs.copyFileSync(path.join(RACINE, 'package.json'), path.join(t, 'package.json')); } catch (_) {}
    const p = path.join(t, m[0]); const src = fs.readFileSync(p, 'utf8');
    if (!src.includes(m[1])) { console.log(`❌ mutation ${nom} : ancre introuvable dans ${m[0]}`); fs.rmSync(t, { recursive: true, force: true }); continue; }
    fs.writeFileSync(p, src.replace(m[1], m[2]));
    const r = spawnSync(process.execPath, [__filename, '--src', t], { encoding: 'utf8', timeout: 180000 });
    const rouges = ((r.stdout || '').match(/^❌/gm) || []).length;
    const ok = r.status !== 0 && rouges > 0; if (ok) attrapees++;
    console.log(`${ok ? '✅' : '❌'} mutation « ${nom} » ⇒ ${ok ? rouges + ' rouge(s)' : 'VERTE (le contrôle ne la voit pas)'}`);
    fs.rmSync(t, { recursive: true, force: true });
  }
  console.log(attrapees === noms.length ? `\n✅ ${attrapees}/${noms.length} mutations attrapées` : `\n❌ ${noms.length - attrapees} mutation(s) non attrapée(s)`);
  process.exit(attrapees === noms.length ? 0 : 1);
}

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log(`${c ? '✅' : '❌'} ${m}${!c && d ? ' — ' + d : ''}`); };
const essaie = async (m, f) => { try { await f(); } catch (e) { dit(false, m + ' — le contrôle a pu s’exécuter', String((e && e.stack) || e).split('\n').slice(0, 2).join(' ')); } };
const sansCommentaires = (t) => t.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
const lire = (f) => { try { return fs.readFileSync(path.join(RACINE, f), 'utf8'); } catch (_) { return ''; } };
function constante(app, nom) {
  let i = app.indexOf(`\nconst ${nom} = `); if (i < 0) i = app.indexOf(`\nfunction ${nom}(`); if (i < 0) return null;
  const lignes = app.slice(i + 1).split('\n');
  if (/;\s*$/.test(lignes[0]) && (lignes[0].match(/\{/g) || []).length === (lignes[0].match(/\}/g) || []).length) return lignes[0];
  const out = []; for (const l of lignes) { out.push(l); if (l === '};' || l === '}') break; } return out.join('\n');
}

// La forme mesurée (inventée : n° et titre ne sont pas les siens).
const TX = '23800000001', TX_AUTRE = '23800000002', UID = '199000001';
const STATUT = "La livraison n'a pas encore eu lieu - colis déposé en bureau de Poste ou point relais";
const achat = (tx) => ({ transaction_id: Number(tx), conversation_id: 'conv-' + tx, title: tx === TX ? 'Baskets en retour' : 'Baskets au point', status: STATUT, transaction_user_status: 'needs_action', date: '2026-11-03T10:00:00Z', price: { amount: '32.28' } });

// ── La fausse base (cloisonnée, `select=` appliqué) ─────────────────────────────
let V, pannes;
const rep = (o, status = 200) => new Response(typeof o === 'string' ? o : JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });
const chemin = (obj, p) => p.reduce((o, k) => (o == null ? undefined : o[k]), obj);
function projette(ligne, select) {
  if (!select || select === '*') return ligne;
  const out = {};
  for (const item of select.split(',')) {
    const [alias, expr] = item.includes(':') ? item.split(/:(.+)/) : [item, item];
    const morceaux = expr.split(/->>?/); const b = morceaux.shift();
    let v = b === 'meta' ? (ligne.meta || ligne.data) : b === 'data' ? ligne.data : ligne[b];
    if (morceaux.length) v = chemin(v, morceaux);
    if (/->>/.test(expr) && v != null) v = typeof v === 'object' ? JSON.stringify(v) : String(v);
    out[alias] = v === undefined ? null : v;
  }
  return out;
}
const filtreId = (id, q) => {
  const eq = /(?:^|&)id=eq\.([^&]+)/.exec(q), like = /(?:^|&)id=like\.([^&]+)/.exec(q), dans = /(?:^|&)id=in\.\(([^)]*)\)/.exec(q);
  if (eq) return id === eq[1];
  if (dans) return dans[1].split(',').map((x) => x.replace(/^"|"$/g, '')).includes(id);
  if (like) { const re = new RegExp('^' + like[1].replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/[%*]/g, '\u0000').replace(/_/g, '.').replace(/\u0000/g, '.*') + '$'); return re.test(id); }
  return true;
};
global.fetch = async (url, opts = {}) => {
  const u = decodeURIComponent(String(url)), m = opts.method || 'GET';
  if (!u.includes('/rest/v1/')) return rep({}, 404);
  const [table, q = ''] = u.split('/rest/v1/')[1].split('?');
  const own = (/(?:^|&)owner=eq\.([^&]+)/.exec(q) || [])[1] || null;
  if (m !== 'GET') return rep('', 201);
  const select = (/(?:^|&)select=([^&]+)/.exec(q) || [])[1] || '';
  if (table === 'app_data' && /select=owner&limit=1/.test(q)) return rep([{ owner: 'A' }]);
  if (table === 'app_data' && /id=eq\.main/.test(q) && !own) return rep([projette({ owner: 'A', id: 'main', data: V.main }, select)]);
  if (!own) return rep({ message: 'lecture sans vendeur' }, 400);
  for (const p of pannes) if ((table + '?' + q).includes(p)) return rep('<html>522</html>', 522);
  if (table === 'vinted_accounts') return rep([projette({ vinted_user_id: UID, login: 'compte_a' }, select)]);
  if (table !== 'app_data') return rep([]);
  const L = [{ id: 'main', data: V.main }, ...V.lignes];
  return rep(L.filter((l) => filtreId(l.id, q)).map((l) => projette({ ...l, owner: own }, select)));
};
const res = () => ({ code: null, corps: null, status(n) { this.code = n; return this; }, json(o) { this.corps = o; return this; }, setHeader() {}, end() { return this; } });

(async () => {
  // ── 1. La règle partagée ───────────────────────────────────────────────────
  let S = null;
  try { S = await import('file://' + path.join(RACINE, 'api', '_lib', 'suivi-colis.js')); } catch (e) { dit(false, 'api/_lib/suivi-colis.js se charge', e.message); }
  const APP_BRUT = lire('src/App.jsx'), APP = sansCommentaires(APP_BRUT);
  const relaisT = constante(APP_BRUT, 'isAtRelayStatus');
  const ctxR = vm.createContext({}); if (relaisT) vm.runInContext(relaisT + ';globalThis.r = isAtRelayStatus;', ctxR);
  const auRelais = ctxR.r || (() => false);
  console.log('— 1. La règle (api/_lib/suivi-colis.js)');
  await essaie('règle', async () => {
    dit(auRelais(STATUT) === true, 'la forme mesurée est « au point relais » pour `isAtRelayStatus` (c’est elle qui le comptait)');
    const txs = S.txAchatsEnRetour ? S.txAchatsEnRetour([{ transaction: TX, sens: 'achat' }, { transaction: '23899999999', sens: 'vente' }, { tx: 'abc' }]) : null;
    dit(!!txs && txs.has(TX) && !txs.has('23899999999') && txs.size === 1, 'le bordereau de retour d’un ACHAT (par SON n°) fait un achat en retour ; un bordereau de sens « vente » non', JSON.stringify(txs ? [...txs] : null));
    dit(S.txAchatsEnRetour && S.txAchatsEnRetour(null) === null, 'bordereaux pas lus ⇒ `null` (pas su : rien n’est écarté)');
    dit(S.achatEnRetour && S.achatEnRetour(achat(TX), txs) && !S.achatEnRetour(achat(TX_AUTRE), txs) && S.achatEnRetour({ transaction_id: 1, status: 'Retour initié' }, null), 'achat en retour : par SON n° de transaction ou son propre statut « Retour initié »');
    dit(S.finDeCommandeAchat({ statut: STATUT, auRelais: true, retour: true }) === 'retire' && S.finDeCommandeAchat({ statut: STATUT, auRelais: true }) === null, 'la commande au point MAIS en retour ⇒ « il l’a » (fin), sans retour ⇒ rien de terminal');
    // L'avis « Retourne ta commande » SANS bordereau : par SA conversation seulement (une identité).
    const parAvis = S.txAchatsEnRetour([], { demandes: [{ conv: 'conv-' + TX, sens: 'achat' }], achats: [achat(TX), achat(TX_AUTRE)] });
    dit(!!parAvis && parAvis.has(TX) && parAvis.size === 1, 'un avis « Retourne ta commande » relié à SA conversation fait un achat en retour (sans bordereau)', JSON.stringify(parAvis ? [...parAvis] : null));
    const sansConv = S.txAchatsEnRetour([], { demandes: [{ conv: '', sens: 'achat' }], achats: [achat(TX)] });
    dit(!!sansConv && sansConv.size === 0, 'un avis SANS conversation (les 3 avis mesurés) n’écarte rien — jamais par le titre ni la date');
    const deux = S.txAchatsEnRetour([], { demandes: [{ conv: 'conv-x', sens: 'achat' }], achats: [{ ...achat(TX), conversation_id: 'conv-x' }, { ...achat(TX_AUTRE), conversation_id: 'conv-x' }] });
    dit(!!deux && deux.size === 0, 'deux achats à la même conversation : on ne choisit pas (rien écarté)');
    const pasLus = S.txAchatsEnRetour([], { demandes: [{ conv: 'conv-' + TX, sens: 'achat' }], achats: null });
    dit(!!pasLus && pasLus.size === 0, 'achats pas lus : les avis ne comptent pas (pas su)');
    const achats = [{ orders: [achat(TX), achat(TX_AUTRE)], txns: [TX, TX_AUTRE] }];
    dit(S.finDesTransactions(new Set([TX]), achats, new Map(), txs) === 'retire' && S.finDesTransactions(new Set([TX_AUTRE]), achats, new Map(), txs) === null, 'le rappel du matin (`finDesTransactions`) : le colis de l’achat en retour est fini, l’autre reste à retirer');
  });

  // ── 2. L'étiquette de l'écran Achats ───────────────────────────────────────
  console.log('— 2. L’écran Achats');
  await essaie('étiquette', async () => {
    const t = ['tusDe', 'phaseAchat', 'etapeAchat'].map((n) => constante(APP_BRUT, n));
    const c = vm.createContext({ C: { warn: '#B25000', muted: '#888', danger: '#c00', blue: '#06c', accent: '#06c' }, ACHAT_A_RENVOYER: /retour\s*initi|retour\s+en\s+cours|retour\s+demand/i, isAtRelayStatus: auRelais });
    vm.runInContext(t.filter(Boolean).join('\n') + ';globalThis.e = etapeAchat;', c);
    const e1 = c.e(achat(TX), null, { retour: true }), e2 = c.e(achat(TX_AUTRE), null, {});
    dit(e1.label === 'À renvoyer' && e1.retour === true, 'l’achat en retour se lit « À renvoyer », jamais « À retirer »', JSON.stringify(e1));
    dit(e2.label === 'À retirer', 'un achat au point sans retour reste « À retirer »', JSON.stringify(e2));
    dit(/const achatStage = \(o, tk\) => etapeAchat\([\s\S]{0,260}retour: achatEnRetour\(o, txRetourAchat\)/.test(APP), 'Achats passe « en retour » à l’étiquette (la même règle)');
  });

  // ── 3. Le widget, exécuté ──────────────────────────────────────────────────
  console.log('— 3. Le widget (api/widget.js, exécuté)');
  let widget = null;
  try { widget = (await import('file://' + path.join(RACINE, 'api', 'widget.js'))).default; } catch (e) { dit(false, 'api/widget.js se charge', e.message); }
  const NOW = Date.parse('2026-11-15T14:00:00Z');
  const vraiNow = Date.now;
  const appeler = async () => { Date.now = () => NOW; try { const r = res(); await widget({ method: 'GET', headers: {}, query: { k: 'tokA' } }, r); return r; } finally { Date.now = vraiNow; } };
  const iso = (t) => new Date(t).toISOString();
  const baseW = ({ pub = null, bordRetour = { transaction: TX, sens: 'achat' }, avis = null } = {}) => {
    V = {
      main: { vrm_widget_token: 'tokA', vinted_pickup_done: {}, vinted_ship_done: {}, vinted_bords_shipped: {}, vinted_bords_hidden: {}, vinted_accounts_hidden: [], vrm_colis_collected: [], ...(pub ? { vrm_colis_retirer: pub } : {}) },
      lignes: [
        { id: `harvest_${UID}_orders_purchased`, data: { capturedAt: iso(NOW - 3600e3), payload: { my_orders: [achat(TX), achat(TX_AUTRE)] }, resume: { txns: [TX, TX_AUTRE], at: NOW - 3600e3 } } },
        { id: `harvest_${UID}_orders_sold`, data: { capturedAt: iso(NOW - 3600e3), payload: { my_orders: [] }, resume: { txns: [], at: NOW - 3600e3 } } },
        ...(avis ? [{ id: 'email_retourdemande_0123456789abcdef', data: { type: 'retour-demande', ...avis, receivedAt: iso(NOW - 3600e3) } }] : []),
        ...(bordRetour ? [{ id: `email_bordretour_${TX}`, data: { type: 'bordereau-retour', ...bordRetour, pdfB64: 'JVBERi0x'.repeat(4000), dateLimiteIso: iso(NOW + 8 * 86400e3), receivedAt: iso(NOW - 2 * 3600e3) } }] : []),
      ],
    };
    pannes = new Set();
  };
  await essaie('widget sans publication', async () => {
    baseW();
    const r = await appeler();
    dit(r.corps && r.corps.pickup === 1, 'sans publication de l’app : 1 à retirer (l’achat en retour n’est pas compté)', JSON.stringify(r.corps && { pickup: r.corps.pickup, code: r.code }));
    baseW({ bordRetour: { transaction: TX, sens: 'vente' } });
    const r2 = await appeler();
    dit(r2.corps && r2.corps.pickup === 2, 'un bordereau de sens « vente » n’écarte rien (2)', JSON.stringify(r2.corps && r2.corps.pickup));
    baseW({ bordRetour: null, avis: { conv: 'conv-' + TX, sens: 'achat' } });
    const r4 = await appeler();
    dit(r4.corps && r4.corps.pickup === 1, 'l’avis « Retourne ta commande » (sans bordereau) relié par SA conversation : 1 à retirer', JSON.stringify(r4.corps && r4.corps.pickup));
    baseW({ bordRetour: null, avis: { conv: '', sens: 'achat' } });
    const r5 = await appeler();
    dit(r5.corps && r5.corps.pickup === 2, 'un avis sans conversation n’écarte rien (2)', JSON.stringify(r5.corps && r5.corps.pickup));
    baseW(); pannes.add('email_bordretour');
    const r3 = await appeler();
    dit(r3.corps && r3.corps.pickup === 2, 'bordereaux de retour pas lus ⇒ rien n’est écarté (2, « pas su » ne vaut pas « en retour »)', JSON.stringify(r3.corps && r3.corps.pickup));
  });
  await essaie('widget après publication', async () => {
    // L'app a publié AVANT la capture (sans ces deux achats) : le widget ajoute ceux vus « au point » depuis.
    const pub = { at: NOW - 5 * 3600e3, total: 0, prets: 0, sansCode: 0, aVerifier: 0, urgents: 0, enVerification: 0, colis: [], verif: [], vus: [], vusTx: [], finis: [] };
    baseW({ pub });
    const r = await appeler();
    dit(r.corps && r.corps.pickup === 1, 'après la publication : l’achat vu « au point » depuis compte (1), pas celui en retour', JSON.stringify(r.corps && { pickup: r.corps.pickup }));
  });

  // ── 4. L'app et le rappel du matin lisent la même règle ───────────────────
  console.log('— 4. L’app et le rappel du matin');
  await essaie('textes', async () => {
    dit(/const txRetourAchat = useMemo\(\(\) => txAchatsEnRetour\(retoursAchatLus \? retoursAchatLus\.bords : null[,)]/.test(APP) && /const vintedToPickup = (useMemeContenu\()?useMemo\(\(\) => auRelaisVus\.filter\(o => !achatEnRetour\(o, txRetourAchat\)\)/.test(APP), 'Achats / Colis / Ma journée : les achats « à retirer » écartent l’achat en retour (bordereaux lus, par SON n°)');
    dit(/finDeCommandeAchat\(\{ statut: o\.status, etat: etatTxn\(o\.transaction_id\), auRelais: isAtRelayStatus\(String\(o\.status \|\| ''\)\), retour: achatEnRetour\(o, txRetourAchat\) \}\)/.test(APP), '… et un colis d’e-mail relié à cet achat est fini (la même règle que le matin)');
    dit(/const vusTx = \[\.\.\.new Set\(auRelaisVus\.map/.test(APP), 'la publication garde l’achat en retour dans `vusTx` (le widget ne l’ajoute jamais)');
    dit(/txAchatsEnRetour\(retoursAchatLus \? retoursAchatLus\.bords : null, \{ demandes: retoursAchatLus \? retoursAchatLus\.demandes : null, achats: buysBase \}\)/.test(APP) && /id=like\.email_retourdemande_\*&select=id,conv:meta->>conv,sens:meta->>sens/.test(APP), 'l’app lit les avis (conversation, sens) et les passe à la règle avec ses achats');
    dit(/'transaction', 'suivi', 'dateLimite', 'dateLimiteIso', 'article', 'uid', 'account', 'receivedAt',(?: 'transporteurPdf',)? 'sens'\]/.test(APP) || /const lireRetoursAchat = async[\s\S]{0,200}const champs = \[[^\]]*'sens'[^\]]*\]\.map\(\(k\) => `\$\{k\}:meta->>\$\{k\}`\)/.test(APP), 'l’app lit le SENS du bordereau (projection `meta->>sens`)');
    const cron = sansCommentaires(lire('api/ship-reminders.js'));
    dit(/id=like\.email_bordretour_%25&select=transaction:meta->>transaction,sens:meta->>sens/.test(cron) && /retours = txAchatsEnRetour\(br, \{ demandes: dm, achats: /.test(cron) && /email_retourdemande_%25&select=conv:meta->>conv,sens:meta->>sens/.test(cron) && /finDesTransactions\(txDuColis\(\{ suivi, code \}, relais, liens\), achats, etats, retours\)/.test(cron), 'le rappel du matin lit les bordereaux de retour (scalaires seulement) et ne rappelle pas un achat en retour ; lecture ratée ⇒ rien envoyé');
  });

  console.log(ko ? `\n❌ Retour pas à retirer : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ Retour pas à retirer : ${ok} contrôles verts`);
  process.exit(ko ? 1 : 0);
})();
