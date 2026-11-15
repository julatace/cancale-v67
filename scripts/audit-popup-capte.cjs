#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  « L'EXTENSION A CAPTÉ ÇA » (5.377, 14 nov.) — Julien : « quand on se connecte
//  dans un compte par exemple, l'extension capte des nouvelles choses, on a un
//  petit popup qui dit que l'extension a capté ça ».
//
//  Cet audit EXÉCUTE le VRAI `background.js` (scripts/_fond-vm.cjs, fausse base à
//  état) : les captures passent par `storeHarvest` / `storeLabel` comme dans le
//  navigateur, puis la carte demande son lot (`capteLot`, `capteVu`) au nom de
//  l'onglet. Il juge :
//   A. une lecture avec 2 ventes nouvelles + 1 déjà connue ⇒ « 2 ventes » (par
//      n° de transaction, jamais par titre — les trois ont le MÊME titre) ;
//   B. la même lecture rejouée (et une fenêtre plus courte) ⇒ aucun lot ;
//   C. une lecture dont l'écriture RATE ⇒ aucun lot, aucun « 0 » ; la vente sera
//      dite quand elle sera vraiment rangée ;
//   D. un autre compte dans l'onglet ⇒ « Compte relié · 3 ventes lues » au nom
//      de CE compte, jamais montré dans un onglet connecté à l'autre ;
//   E. réglage coupé ⇒ rien (ni lot, ni message à l'app) ; rallumé ⇒ ce qui a été
//      vu pendant n'est pas redit ;
//   F. un lot montré une fois ne revient pas ; « Voir » = la page du SITE ;
//   G. bordereau rangé ⇒ « 1 bordereau » ; même bordereau rangé de nouveau ⇒ rien ;
//      première lecture d'une sorte après la mise à jour ⇒ silence (pas su).
//  `--prouve` : rouge sur origin/main (ou `--avant <ref>`), puis chaque mutation rouge.
//  Aucune donnée réelle (dépôt public).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os'), cp = require('child_process');
const RACINE = process.env.CAPTE_RACINE || path.join(__dirname, '..');
const { faireFond } = require(path.join(RACINE, 'scripts', '_fond-vm.cjs'));
const SRC = path.join(RACINE, 'vinted-sync-extension', 'background.js');

let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d ? '  → ' + String(d).slice(0, 300) : '')); } };
const essai = async (nom, fn) => { try { await fn(); } catch (e) { dit(false, nom + ' — a levé', e && (e.stack || e.message)); } };

const H = 3600000;
const iso = (ms) => new Date(ms).toISOString();
const vente = (tx, ilYa) => ({ transaction_id: tx, title: 'Nike Air Max 90 blanc 42', price: { amount: '60.0', currency_code: 'EUR' }, status: 'Le paiement a été validé.', transaction_user_status: 'needs_action', date: iso(Date.now() - ilYa), item_id: tx + 5000 });
const corps = (liste) => JSON.stringify({ my_orders: liste, pagination: { current_page: 1, per_page: 20, total_entries: 900 } });
const ONGLET = (url, id = 7) => ({ tab: { id, url } });

function monde(opts = {}) {
  const f = faireFond(Object.assign({ src: SRC, connecte: '111' }, opts));
  let cur = '111';
  f.ctx.activeAccountId = async () => cur;
  f.ctx.compteConnecte = async () => cur;
  f.changer = (u) => { cur = u; };
  f.lot = (url = 'https://www.vinted.fr/') => f.envoyer({ from: 'vrm-badge', action: 'capteLot' }, ONGLET(url));
  f.vu = (lot, url = 'https://www.vinted.fr/') => f.envoyer({ from: 'vrm-badge', action: 'capteVu', lot }, ONGLET(url));
  f.capteEvts = () => f.j.evts.filter((e) => e && e.type === 'capte');
  f.attendre = () => new Promise((r) => setTimeout(r, 30));
  return f;
}
const zero = (lot) => !!(lot && lot.n && Object.values(lot.n).some((v) => !(Number(v) > 0)));

(async () => {
  console.log('A–C. Nouveau par identité, rejoué, lecture ratée');
  await essai('A', async () => {
    const f = monde();
    if (typeof f.ctx.annoncerCapte !== 'function') dit(false, 'la fonction `annoncerCapte` existe dans le vrai background.js');
    // Point de départ : la première lecture des ventes de ce compte ne dit RIEN (on ne sait pas ce qui est nouveau).
    await f.ctx.storeHarvest('www.vinted.fr', 'orders_sold', '', corps([vente(91000000001, 30 * 24 * H), vente(91000000002, 20 * 24 * H)]));
    await f.attendre();
    let r = await f.lot();
    dit(r && r.ok && !r.lot, 'première lecture des ventes après la mise à jour : aucun popup (point de départ, pas su)', JSON.stringify(r));
    // Deux ventes NOUVELLES + une déjà rangée, le MÊME titre partout.
    await f.ctx.storeHarvest('www.vinted.fr', 'orders_sold', '', corps([vente(91000000004, 60000), vente(91000000003, 120000), vente(91000000002, 20 * 24 * H)]));
    await f.attendre();
    r = await f.lot();
    dit(r && r.lot && r.lot.n && r.lot.n.ventes === 2 && Object.keys(r.lot.n).length === 1, '2 ventes nouvelles + 1 connue ⇒ « 2 ventes » (par n° de transaction)', JSON.stringify(r && r.lot));
    dit(r && r.lot && r.lot.compte === '111' && r.lot.nom === 'compte_banc', 'au nom du compte de l’onglet (shop : compte_banc)', JSON.stringify(r && r.lot));
    // 5.379 : « Mes ventes » (/my_orders/sold) est une adresse que Vinted ne sert pas (404, capture de Julien) : pas de « Voir » plutôt qu'un faux lien.
    dit(r && r.lot && r.lot.voir === '', '« Voir » : aucune adresse attestée pour les ventes Vinted ⇒ pas de lien (jamais VRM, jamais une page 404)', r && r.lot && r.lot.voir);
    const ev = f.capteEvts();
    dit(ev.length === 1 && ev[0].lot && ev[0].lot.n.ventes === 2, 'l’app ouverte reçoit le même lot une fois (`capte`)', JSON.stringify(ev));
    // F. vu une fois ⇒ ne revient pas.
    const v = await f.vu(r && r.lot && r.lot.lot);
    dit(v && v.ok, 'la carte note le lot vu');
    r = await f.lot();
    dit(r && r.ok && !r.lot, 'un lot montré une fois ne revient pas', JSON.stringify(r));
    // B. rejouée : une fenêtre plus courte (aucune vente nouvelle), puis la même.
    await f.ctx.storeHarvest('www.vinted.fr', 'orders_sold', '', corps([vente(91000000004, 60000), vente(91000000003, 120000)]));
    await f.ctx.storeHarvest('www.vinted.fr', 'orders_sold', '', corps([vente(91000000004, 60000), vente(91000000003, 120000), vente(91000000002, 20 * 24 * H)]));
    await f.attendre();
    r = await f.lot();
    dit(r && r.ok && !r.lot && f.capteEvts().length === 1, 'la même lecture rejouée ⇒ aucun popup, rien de plus pour l’app', JSON.stringify(r));
    // C. une vente nouvelle dont l'ÉCRITURE rate ⇒ rien ; rangée ensuite ⇒ dite.
    const f2 = monde({ ecritureKO: (id) => id === 'harvest_111_orders_sold' && f2.koActif });
    f2.koActif = false;
    await f2.ctx.storeHarvest('www.vinted.fr', 'orders_sold', '', corps([vente(92000000001, 9 * 24 * H)]));
    f2.koActif = true;
    await f2.ctx.storeHarvest('www.vinted.fr', 'orders_sold', '', corps([vente(92000000002, 60000), vente(92000000001, 9 * 24 * H)]));
    await f2.attendre();
    r = await f2.lot();
    dit(r && r.ok && !r.lot && !f2.capteEvts().length, 'écriture ratée ⇒ aucun popup, aucun « 0 »', JSON.stringify(r));
    dit(!f2.capteEvts().some(zero), 'jamais un nombre nul dans un lot');
    f2.koActif = false;
    await f2.ctx.storeHarvest('www.vinted.fr', 'orders_sold', '', corps([vente(92000000002, 60000), vente(92000000001, 9 * 24 * H)]));
    await f2.attendre();
    r = await f2.lot();
    dit(r && r.lot && r.lot.n.ventes === 1, 'rangée ensuite pour de vrai ⇒ « 1 vente » (rien perdu)', JSON.stringify(r && r.lot));
    // Une lecture PARTIELLE d'annonces (plus pauvre que la base) n'est pas rangée ⇒ rien.
    f2.lignes.harvest_111_listings = { type: 'listings', uid: '111', capturedAt: iso(Date.now() - H), nItems: 50, payload: { items: [] } };
    f2.ctx.profilIdRange = async () => '111';
    await f2.ctx.storeHarvest('www.vinted.fr', 'listings', '111', JSON.stringify({ items: [{ id: 1, title: 'x', created_at_ts: Math.floor(Date.now() / 1000) }], pagination: { total_entries: 50 } }));
    await f2.attendre();
    const av = f2.capteEvts().filter((e) => e.lot && e.lot.n && e.lot.n.annonces);
    dit(!av.length, 'dressing partiel (refusé par `listePlusRiche`) ⇒ rien d’annoncé', JSON.stringify(av));
  });

  console.log('D. Autre compte dans l’onglet');
  await essai('D', async () => {
    const f = monde();
    await f.ctx.storeHarvest('www.vinted.fr', 'orders_sold', '', corps([vente(93000000001, 5 * 24 * H)]));
    f.changer('222');
    await f.ctx.storeHarvest('www.vinted.fr', 'orders_sold', '', corps([vente(94000000001, 3 * 24 * H), vente(94000000002, 4 * 24 * H), vente(94000000003, 50 * 24 * H)]));
    await f.attendre();
    let r = await f.lot();
    dit(r && r.lot && r.lot.compte === '222' && r.lot.relie === true && r.lot.n.ventes === 3, 'changement de compte ⇒ « Compte relié · 3 ventes lues » au nom de 222', JSON.stringify(r && r.lot));
    f.changer('111');
    r = await f.lot();
    dit(r && r.ok && !r.lot, 'l’onglet revenu sur 111 ne montre jamais le lot de 222', JSON.stringify(r && r.lot));
    // 111 de retour : « Compte relié » pour la première lecture, puis plus rien sur la même lecture.
    await f.ctx.storeHarvest('www.vinted.fr', 'orders_sold', '', corps([vente(93000000001, 5 * 24 * H)]));
    await f.attendre();
    r = await f.lot();
    dit(r && r.lot && r.lot.compte === '111' && r.lot.relie === true && r.lot.n.ventes === 1, 'retour sur 111 ⇒ « Compte relié · 1 vente lue »', JSON.stringify(r && r.lot));
    await f.vu(r && r.lot && r.lot.lot);
    await f.ctx.storeHarvest('www.vinted.fr', 'orders_sold', '', corps([vente(93000000001, 5 * 24 * H), vente(93000000000, 6 * 24 * H)]));
    await f.attendre();
    r = await f.lot();
    dit(r && r.ok && !r.lot, 'la lecture suivante du même compte (rien de nouveau) ⇒ rien', JSON.stringify(r && r.lot));
  });

  console.log('E. Réglage coupé');
  await essai('E', async () => {
    const f = monde();
    await f.ctx.storeHarvest('www.vinted.fr', 'orders_sold', '', corps([vente(95000000001, 5 * 24 * H)]));
    const c = await f.envoyer({ from: 'vrm-badge', action: 'capteReglage', coupe: true }, ONGLET('https://www.vinted.fr/'));
    dit(c && c.ok && c.coupe === true, 'la carte coupe le réglage');
    const etat = await f.envoyer({ from: 'vrm-badge', action: 'etat' }, ONGLET('https://www.vinted.fr/'));
    dit(etat && etat.capteCoupe === true, 'l’état de la carte dit « coupé »', etat && etat.capteCoupe);
    await f.ctx.storeHarvest('www.vinted.fr', 'orders_sold', '', corps([vente(95000000002, 60000), vente(95000000001, 5 * 24 * H)]));
    await f.attendre();
    let r = await f.lot();
    dit(r && r.ok && r.coupe === true && !r.lot && !f.capteEvts().length, 'coupé ⇒ ni popup, ni message à l’app', JSON.stringify(r));
    await f.envoyer({ from: 'vrm-badge', action: 'capteReglage', coupe: false }, ONGLET('https://www.vinted.fr/'));
    await f.ctx.storeHarvest('www.vinted.fr', 'orders_sold', '', corps([vente(95000000002, 60000), vente(95000000001, 5 * 24 * H), vente(95000000000, 9 * 24 * H)]));
    await f.attendre();
    r = await f.lot();
    dit(r && r.ok && !r.lot, 'rallumé : la vente vue pendant la coupure n’est pas redite', JSON.stringify(r && r.lot));
    // L'app règle la même chose (canal adressé).
    const e2 = await f.envoyer({ from: 'vmr-bridge', action: 'adresse', msg: { type: 'reglageCapte', coupe: true } }, { origin: 'https://vrm.center', url: 'https://vrm.center/' });
    dit(e2 && e2.ok && e2.coupe === true, 'l’app peut couper le même réglage (pont adressé)', JSON.stringify(e2));
  });

  console.log('G. Bordereau, conversation non lue');
  await essai('G', async () => {
    const f = monde();
    await f.ctx.storeHarvest('www.vinted.fr', 'orders_sold', '', corps([vente(96000000001, 5 * 24 * H)]));
    f.ctx.bordereauAttendu = async () => '96000000001';
    const pdf = Buffer.from('%PDF-1.4\n' + 'x'.repeat(400)).toString('base64');
    const r1 = await f.ctx.storeLabel('www.vinted.fr', 'https://example.invalid/label.pdf', pdf);
    await f.attendre();
    let r = await f.lot();
    dit(r1 === true && r && r.lot && r.lot.n.bordereaux === 1, 'bordereau rangé ⇒ « 1 bordereau »', JSON.stringify(r && r.lot));
    await f.vu(r && r.lot && r.lot.lot);
    await f.ctx.storeLabel('www.vinted.fr', 'https://example.invalid/label.pdf', pdf);
    await f.attendre();
    r = await f.lot();
    dit(r && r.ok && !r.lot, 'le même bordereau rangé de nouveau ⇒ rien', JSON.stringify(r && r.lot));
    // Messages : la première boîte = point de départ ; une conversation non lue plus récente ⇒ « 1 message ».
    const conv = (id, ilYa, unread) => ({ id, description: 'Bonjour', unread, updated_at: iso(Date.now() - ilYa), opposite_user: { id: 5, login: 'acheteur' } });
    await f.ctx.storeHarvest('www.vinted.fr', 'inbox', '', JSON.stringify({ conversations: [conv(10, 9 * H, true), conv(11, 9 * H, false)], pagination: {} }));
    await f.ctx.storeHarvest('www.vinted.fr', 'inbox', '', JSON.stringify({ conversations: [conv(12, 60000, true), conv(10, 9 * H, true), conv(13, 60000, false)], pagination: {} }));
    await f.attendre();
    r = await f.lot();
    dit(r && r.lot && r.lot.n.messages === 1 && r.lot.voir === 'https://www.vinted.fr/inbox', 'une conversation NON LUE plus récente ⇒ « 1 message », « Voir » = Messages', JSON.stringify(r && r.lot));
  });

  console.log(`\n${ok} ✅  ${ko} ❌`);
  if (process.argv.includes('--prouve')) await prouver();
  process.exit(ko ? 1 : 0);
})();

// ── §6.1 : rouge sur l'arbre d'avant, puis par mutation ─────────────────────
async function prouver() {
  const iA = process.argv.indexOf('--avant'); const ref = iA > 0 ? process.argv[iA + 1] : 'origin/main';
  const lancer = (racine) => { try { cp.execFileSync(process.execPath, [path.join(racine, 'scripts', 'audit-popup-capte.cjs')], { env: Object.assign({}, process.env, { CAPTE_RACINE: racine }), stdio: 'pipe' }); return 0; } catch (e) { return e.status || 1; } };
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'capte-'));
  cp.execSync(`git -C "${RACINE}" archive ${ref} | tar -x -C "${tmp}"`);
  fs.copyFileSync(__filename, path.join(tmp, 'scripts', 'audit-popup-capte.cjs'));
  const avant = lancer(tmp);
  console.log(avant ? `🔴 sur ${ref} : rouge (attendu)` : `⚠️ sur ${ref} : VERT — l’audit ne prouve rien`);
  let rate = avant ? 0 : 1;
  const MUT = [
    ['identité ignorée (toute identité lue compte)', /if \(vus\.has\(id\)\) continue;\n/, ''],
    ['annonce avant l’écriture', "if (ecrit === true) await capteVinted(uid, type, lusCapte);", "await capteVinted(uid, type, lusCapte);"],
    ['compte de l’onglet ignoré', "const l = lots[o.p + ':' + o.id];\n  if (!l || l.vu", "const l = Object.values(lots).sort((a, b) => b.maj - a.maj)[0];\n  if (!l || l.vu"],
    ['réglage ignoré', "if (n > 0 && !coupe) {", "if (n > 0) {"],
    ['lot vu qui revient', "if (!l || l.vu || !(Date.now()", "if (!l || !(Date.now()"],
    ['point de départ dit (« pas su » annoncé)', "if (evenement || (connu && depart > 0 && t != null && t >= depart - CAPTE_MARGE_MS)) nouveaux.push(id);", "nouveaux.push(id);"],
  ];
  for (const [nom, de, vers] of MUT) {
    const t2 = fs.mkdtempSync(path.join(os.tmpdir(), 'capte-m-'));
    cp.execSync(`cp -r "${path.join(RACINE, 'scripts')}" "${t2}/scripts" && cp -r "${path.join(RACINE, 'vinted-sync-extension')}" "${t2}/vinted-sync-extension"`);
    const f = path.join(t2, 'vinted-sync-extension', 'background.js');
    const s = fs.readFileSync(f, 'utf8');
    const s2 = typeof de === 'string' ? s.replace(de, vers) : s.replace(de, vers);
    if (s2 === s) { console.log(`⚠️ mutation « ${nom} » : motif introuvable`); rate++; continue; }
    fs.writeFileSync(f, s2);
    const r = lancer(t2);
    console.log(r ? `🔴 mutation « ${nom} » : rouge (attendu)` : `⚠️ mutation « ${nom} » : VERTE`);
    if (!r) rate++;
  }
  if (rate) process.exit(1);
}
