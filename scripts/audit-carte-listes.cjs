#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  LA CARTE : FAVORIS · ANNONCES · VENTES DU COMPTE DE L'ONGLET (5.377, 14 nov.)
//  Julien : « voir les favoris du plus récent au plus vieux pour envoyer des
//  messages aux favoris, voir les annonces et ventes à chaque fois sur le compte
//  connecté ; les autres comptes sont floutés sauf si la personne met tous les
//  comptes sélectionnés, mais aucune action n'est possible dessus ».
//
//  Cet audit EXÉCUTE :
//   · le VRAI `background.js` (scripts/_fond-vm.cjs, fausse base à état, projections
//     `select=` appliquées, index de tableau compris) : `carteListes` et la garde de
//     `favorisCarte` ;
//   · la VRAIE règle du serveur `api/_lib/favoris-carte.js` (`apercuCarte`).
//  Il juge :
//   A. favoris : l'aperçu les rend du plus RÉCENT au plus ancien, avec la date ;
//   B. une commande d'envoi pour un compte ≠ celui de l'onglet ⇒ refusée, rien ne part
//      (aucun appel à vrm.center) ;
//   C. Annonces / Ventes = celles du compte de l'onglet SEULEMENT (même titre ailleurs :
//      jamais mélangées), ventes de la plus récente à la plus ancienne, état, bordereau
//      rangé par n° de transaction, l'annulée jamais « vendue », N° par identité ;
//   D. sans « Tous les comptes » les autres comptes ne sont pas lus ; avec, ils sont
//      rendus `lectureSeule` (aucune commande possible) ;
//   E. dressing lu il y a plus de 24 h ⇒ « à confirmer », jamais « en ligne » ;
//      lu il y a plus d'une heure ⇒ une relecture DANS le budget de lecture.
//  `--prouve` : rouge sur origin/main, puis chaque mutation rouge. Données inventées.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os'), cp = require('child_process');
const { pathToFileURL } = require('url');
const RACINE = process.env.LISTES_RACINE || path.join(__dirname, '..');
const { faireFond } = require(path.join(RACINE, 'scripts', '_fond-vm.cjs'));
const SRC = path.join(RACINE, 'vinted-sync-extension', 'background.js');

let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d ? '  → ' + String(d).slice(0, 300) : '')); } };
const essai = async (nom, fn) => { try { await fn(); } catch (e) { dit(false, nom + ' — a levé', e && (e.stack || e.message)); } };
const H = 3600000, J = 86400000, T0 = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const ONGLET = { tab: { id: 7, url: 'https://www.vinted.fr/catalog' } };

function base(capAnnonces) {
  const items = (uid, n) => Array.from({ length: n }, (_, i) => ({ id: Number(uid) * 1000 + i, title: 'Nike Air Max 90 blanc 42', price: { amount: String(50 + i) }, created_at_ts: Math.floor((T0 - (i + 1) * J) / 1000), favourite_count: i, is_closed: false, is_hidden: false, is_draft: false, photo: { url: 'https://images1.vinted.net/t/x.webp' } }));
  const ventes = (uid, etats) => etats.map((e, i) => ({ transaction_id: Number(uid) * 100000 + i, conversation_id: Number(uid) * 100000 + i + 5000000000, title: 'Nike Air Max 90 blanc 42', price: { amount: '60.0' }, item_id: Number(uid) * 1000 + i, date: iso(T0 - (etats.length - i) * H),
    status: e === 'a' ? 'Le paiement a été validé. Envoie le colis avant le 20/11/2026' : e === 'f' ? 'La commande est finalisée.' : e === 'x' ? 'Commande annulée' : 'Colis en route', transaction_user_status: e === 'a' ? 'needs_action' : e === 'f' ? 'completed' : e === 'x' ? 'failed' : 'waiting' }));
  return {
    main: { vinted_annonce_numeros: { 111000: { numero: '124', accountId: '111' }, 111001: { numero: '125', accountId: '111' }, 222000: { numero: '900', accountId: '222' } }, vinted_buyprice_by_num: {} },
    vinted_listing_dates: {},
    harvest_111_listings: { type: 'listings', capturedAt: iso(T0 - capAnnonces), nItems: 5, payload: { items: items('111', 5) } },
    harvest_222_listings: { type: 'listings', capturedAt: iso(T0 - H / 2), nItems: 7, payload: { items: items('222', 7) } },
    harvest_111_orders_sold: { type: 'orders_sold', capturedAt: iso(T0 - 600000), nItems: 4, payload: { my_orders: ventes('111', ['a', 'r', 'x', 'a']).reverse() } },
    harvest_222_orders_sold: { type: 'orders_sold', capturedAt: iso(T0 - 600000), nItems: 3, payload: { my_orders: ventes('222', ['f', 'f', 'a']) } },
    harvest_111_label_11100000: { uid: '111', tx: '11100000', _pdf: true },
  };
}
function monde(capAnnonces = 20 * 60000) {
  const lignes = base(capAnnonces);
  const f = faireFond({ src: SRC, connecte: '111', lignes, comptes: [{ vinted_user_id: '111', login: 'shop_sophie', domain: 'www.vinted.fr' }, { vinted_user_id: '222', login: 'julien_kicks', domain: 'www.vinted.fr' }] });
  f.ctx.compteConnecte = async () => '111';
  f.relectures = 0;
  f.ctx.retourSurVinted = async () => { f.relectures++; return { ok: true }; };
  return f;
}

(async () => {
  console.log('A. Favoris du plus récent au plus ancien (règle du serveur)');
  await essai('A', async () => {
    const m = await import(pathToFileURL(path.join(RACINE, 'api', '_lib', 'favoris-carte.js')).href);
    // Huit favoris rangés dans le DÉSORDRE (la forme réelle des notifications Vinted).
    const notifs = Array.from({ length: 8 }, (_, i) => ({ id: 'n' + i, user_id: 900 + i, body: `acheteur_${i} a ajouté ton article à ses favoris.`, link: `/items/${5000 + i}/conversation/new?from_notification=true`, created_at: iso(T0 - ((i * 5) % 8 + 1) * H) }));
    const items = Array.from({ length: 8 }, (_, i) => ({ id: 5000 + i, title: 'Nike ' + i, price: { amount: '50.0', currency_code: 'EUR' } }));
    const r = m.apercuCarte({ prefs: { version: 1, message: 'Bonjour {pseudo}', pourcentage: 10, offreMode: 'pct', offreValeur: null, arrondi: false, intervalleMinutes: 0, intervalleMaxMinutes: null }, capture: { payload: { notifications: notifs }, domain: 'www.vinted.fr' }, vue: { jobs: [] },
      dressing: { cap: iso(T0 - H / 2), pg: { total_entries: 8 }, items }, prouve: () => true });
    const dates = (r.liste || []).map((x) => Date.parse(x.date));
    dit(r.etat === 'pret' && dates.length > 1 && dates.every((d, i) => isFinite(d) && (i === 0 || dates[i - 1] >= d)), 'l’aperçu rend les favoris du plus récent au plus ancien, chacun avec sa date', JSON.stringify({ e: r.etat, raison: r.raison, d: dates.slice(0, 4) }));
    // 5.379 (capture de Julien : l'onglet Favoris n'avait qu'une phrase) : sans message écrit pour ce compte, la LISTE lue est rendue quand même.
    const r0 = m.apercuCarte({ prefs: null, capture: { payload: { notifications: notifs }, domain: 'www.vinted.fr' }, dressing: { cap: iso(T0 - H / 2), pg: { total_entries: 8 }, items }, prouve: () => true });
    const d0 = (r0.lus || []).map((x) => Date.parse(x.date));
    dit(r0.etat === 'bloque' && r0.raison === 'reglages' && d0.length === 8 && r0.totalLus === 8 && d0.every((d, i) => isFinite(d) && (i === 0 || d0[i - 1] >= d)) && !(r0.lus || []).some((x) => 'texte' in x), 'sans message écrit : les 8 favoris LUS rendus (du plus récent), sans aucun message préparé', JSON.stringify({ e: r0.etat, r: r0.raison, n: d0.length }));
  });

  console.log('B. Une commande pour un autre compte que celui de l’onglet');
  await essai('B', async () => {
    const f = monde();
    const r = await f.envoyer({ from: 'vrm-badge', action: 'favorisCarte', quoi: 'lancer', uid: '222', confirme: true, selection: ['n1'], reglages: { message: 'x' } }, ONGLET);
    dit(r && r.ok === false && r.code === 'compte' && f.j.vrmApi.length === 0, 'compte 222 demandé, onglet sur 111 ⇒ refusé, rien ne part (aucun appel)', JSON.stringify({ r, api: f.j.vrmApi.length }));
    const r2 = await f.envoyer({ from: 'vrm-badge', action: 'favorisCarte', quoi: 'lancer', uid: '111', selection: ['n1'], reglages: { message: 'x' } }, ONGLET);
    dit(r2 && r2.ok === false && r2.code === 'confirmation', 'sans SON clic (`confirme`) ⇒ refusé', JSON.stringify(r2));
  });

  console.log('C–D. Annonces et ventes du compte de l’onglet ; autres comptes en lecture seule');
  await essai('C', async () => {
    const f = monde();
    if (typeof f.ctx.carteListes !== 'function') dit(false, '`carteListes` existe dans le vrai background.js');
    const r = await f.envoyer({ from: 'vrm-badge', action: 'carteListes' }, ONGLET);
    dit(r && r.ok && r.compte && r.compte.id === '111' && r.compte.nom === 'shop_sophie', 'le compte de l’onglet (cookie), nommé', JSON.stringify(r && r.compte));
    const ann = (r && r.annonces && r.annonces.liste) || [];
    dit(ann.length === 5 && ann.every((x) => /^111\d{3}$/.test(x.id)), 'Annonces : les 5 de 111, aucune de 222 (même titre partout)', JSON.stringify(ann.map((x) => x.id)));
    dit(ann.find((x) => x.id === '111000') && ann.find((x) => x.id === '111000').num === '124' && !ann.some((x) => x.num === '900'), 'N° par identité d’annonce (124), jamais celui d’un autre compte', JSON.stringify(ann.map((x) => [x.id, x.num])));
    dit(r.annonces && r.annonces.aConfirmer === false && r.annonces.lu > 0, 'dressing lu il y a 20 min ⇒ en ligne', JSON.stringify(r.annonces && { a: r.annonces.aConfirmer, lu: r.annonces.lu }));
    const v = (r && r.ventes && r.ventes.liste) || [];
    dit(v.length === 4 && v.every((x) => /^111\d{5}$/.test(x.tx)), 'Ventes : les 4 de 111, aucune de 222', JSON.stringify(v.map((x) => x.tx)));
    dit(v.every((x, i) => i === 0 || v[i - 1].date >= x.date), 'Ventes de la plus récente à la plus ancienne', JSON.stringify(v.map((x) => x.date)));
    const parTx = Object.fromEntries(v.map((x) => [x.tx, x]));
    dit(parTx['11100000'] && parTx['11100000'].etat === 'a_expedier' && parTx['11100000'].bordereau === true && parTx['11100003'].bordereau === false, 'à expédier : bordereau rangé (par n° de transaction) / pas encore', JSON.stringify(v.map((x) => [x.tx, x.etat, x.bordereau])));
    dit(v.every((x) => /^[1-9]\d*$/.test(x.conv) && x.conv === String(Number(x.tx) + 5000000000)), '5.379 : chaque vente porte SON n° de conversation (ouvre /inbox/{n°} sur Vinted)', JSON.stringify(v.map((x) => [x.tx, x.conv])));
    dit(parTx['11100002'] && parTx['11100002'].etat === 'annulee' && parTx['11100002'].vendue === false, 'l’annulée n’est jamais « vendue »', JSON.stringify(parTx['11100002']));
    dit(r.autres === null && !f.j.vinted.length, 'sans « Tous les comptes » : les autres comptes ne sont pas lus ; aucune requête Vinted', JSON.stringify({ a: r.autres, v: f.j.vinted.length }));
    const r2 = await f.envoyer({ from: 'vrm-badge', action: 'carteListes', tous: true }, ONGLET);
    const a2 = (r2 && r2.autres) || [];
    dit(a2.length === 1 && a2[0].id === '222' && a2[0].lectureSeule === true && a2[0].nom === 'julien_kicks', '« Tous les comptes » : 222 rendu en LECTURE SEULE', JSON.stringify(a2));
    dit(r2.compte.id === '111' && (r2.ventes.liste || []).every((x) => /^111/.test(x.tx)), 'avec « Tous les comptes », les listes actives restent celles de l’onglet', JSON.stringify(r2.compte));
    // Un message forgé qui nomme un autre compte ne change rien : le cookie décide.
    const r3 = await f.envoyer({ from: 'vrm-badge', action: 'carteListes', uid: '222', compte: '222' }, ONGLET);
    dit(r3.compte.id === '111' && (r3.annonces.liste || []).every((x) => /^111/.test(x.id)), 'un compte nommé par le message est ignoré (le cookie de l’onglet décide)', JSON.stringify(r3.compte));
  });

  console.log('E. Lecture ancienne');
  await essai('E', async () => {
    const f = monde(30 * H);
    const r = await f.envoyer({ from: 'vrm-badge', action: 'carteListes' }, ONGLET);
    dit(r.annonces && r.annonces.aConfirmer === true, 'dressing lu il y a 30 h ⇒ « à confirmer », jamais « en ligne »', JSON.stringify(r.annonces && r.annonces.aConfirmer));
    dit(f.relectures === 1 && r.annonces.relecture === true, 'lu il y a plus d’une heure ⇒ une relecture (budget de lecture : `retourSurVinted`)', String(f.relectures));
    const f2 = monde();
    await f2.envoyer({ from: 'vrm-badge', action: 'carteListes' }, ONGLET);
    dit(f2.relectures === 0, 'lu il y a 20 min ⇒ pas de relecture', String(f2.relectures));
  });

  console.log(`\n${ok} ✅  ${ko} ❌`);
  if (process.argv.includes('--prouve')) await prouver();
  process.exit(ko ? 1 : 0);
})();

async function prouver() {
  const iA = process.argv.indexOf('--avant'); const ref = iA > 0 ? process.argv[iA + 1] : 'origin/main';
  const lancer = (racine) => { try { cp.execFileSync(process.execPath, [path.join(racine, 'scripts', 'audit-carte-listes.cjs')], { env: Object.assign({}, process.env, { LISTES_RACINE: racine }), stdio: 'pipe' }); return 0; } catch (e) { return e.status || 1; } };
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'listes-'));
  cp.execSync(`git -C "${RACINE}" archive ${ref} | tar -x -C "${tmp}"`);
  fs.copyFileSync(__filename, path.join(tmp, 'scripts', 'audit-carte-listes.cjs'));
  const avant = lancer(tmp);
  console.log(avant ? `🔴 sur ${ref} : rouge (attendu)` : `⚠️ sur ${ref} : VERT — l’audit ne prouve rien`);
  let rate = avant ? 0 : 1;
  const MUT = [
    ['vente/annonce de tous les comptes', ['vinted-sync-extension/background.js', "  const uid = await compteConnecte(dom);\n  if (!uid) return { ok: true, plateforme, compte: null };", "  const uid = (msg && msg.uid) || await compteConnecte(dom);\n  if (!uid) return { ok: true, plateforme, compte: null };"]],
    ['autres comptes actionnables', ['vinted-sync-extension/background.js', "autres.push({ id, nom: String(a.login || ''), lectureSeule: true,", "autres.push({ id, nom: String(a.login || ''), lectureSeule: false,"]],
    ['autres comptes toujours lus', ['vinted-sync-extension/background.js', "if (msg && msg.tous === true) {", "if (true) {"]],
    ['annulée dite vendue', ['vinted-sync-extension/background.js', "  if (PAS_UNE_VENTE.test(s)) return 'annulee';\n", ""]],
    ['favoris non triés (date absente)', ['api/_lib/favoris-carte.js', "date: l.date || null,", "date: null,"]],
    ['garde de compte retirée', ['vinted-sync-extension/background.js', "  if (String((msg && msg.uid) || '') !== o.uid) return { ok: false, code: 'compte',", "  if (false) return { ok: false, code: 'compte',"]],
    ['favoris lus cachés sans message (5.379)', ['api/_lib/favoris-carte.js', "  if (!prefs) return { etat: 'bloque', raison: 'reglages', lus, totalLus: lignes.length, file };", "  if (!prefs) return { etat: 'bloque', raison: 'reglages', file };"]],
    ['ventes sans n° de conversation (5.379)', ['vinted-sync-extension/background.js', "conv: /^[1-9]\\d{0,19}$/.test(String(x.conversation_id == null ? '' : x.conversation_id)) ? String(x.conversation_id) : '',", "conv: '',"]],
    ['relecture hors budget (jamais)', ['vinted-sync-extension/background.js', "annonces.relecture = true; retourSurVinted(sender).catch(() => {});", "annonces.relecture = true;"]],
  ];
  for (const [nom, [fic, de, vers]] of MUT) {
    const t2 = fs.mkdtempSync(path.join(os.tmpdir(), 'listes-m-'));
    for (const d of ['scripts', 'vinted-sync-extension', 'api', 'src', 'package.json']) cp.execSync(`cp -r "${path.join(RACINE, d)}" "${t2}/${d}"`);
    const f = path.join(t2, fic), s = fs.readFileSync(f, 'utf8'), s2 = s.replace(de, vers);
    if (s2 === s) { console.log(`⚠️ mutation « ${nom} » : motif introuvable`); rate++; continue; }
    fs.writeFileSync(f, s2);
    const r = lancer(t2);
    console.log(r ? `🔴 mutation « ${nom} » : rouge (attendu)` : `⚠️ mutation « ${nom} » : VERTE`);
    if (!r) rate++;
  }
  if (rate) process.exit(1);
}
