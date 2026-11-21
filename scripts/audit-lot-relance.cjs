#!/usr/bin/env node
// audit-lot-relance (21 nov., ext. 5.421, `lotfavoris` `relanceoffres`) — OFFRE LOT AUX FAVORIS, RELANCE DES OFFRES RATÉES.
// Exécute la règle <lot-relance-regle> TELLE QU'ELLE EST DANS background.js, puis le fond lui-même :
//  L1. copies identiques (src/lotRelance.js ⇄ background.js ; --recopie) ;
//  L2. le lot : somme × (1 − taux), arrondi à l'euro inférieur, JAMAIS sous la somme des planchers (prix mini, sinon
//      achat + 10 %) — 2 000 lots tirés au hasard ; un article sans plancher ⇒ pas de lot (dit) ; < 2 articles ⇒ rien ;
//  L3. les groupes : par IDENTITÉ de la personne (receiver_id), articles DISTINCTS, seulement prouvés en vente ;
//  L4. l'offre ratée : refusée (30) ou expirée ; acceptée / en attente ⇒ rien ; une offre du vendeur APRÈS ⇒ « déjà relancée » ;
//  L5. la relance : prix ≥ plancher, ≥ son offre, < prix de l'annonce ; N jours après ; une par acheteur ET par article ;
//      article pas prouvé en vente ⇒ écartée ; sans plancher ⇒ écartée ; 2 000 cas au hasard : jamais sous le plancher ;
//  L6. le FOND (vrai background.js, fausse base, gestes de l'interface comptés) : `relancesOffres · envoyer` exige SON
//      toucher (`confirme`) — sans lui RIEN ne part ; deux touchers ⇒ UNE relance ; « Relancer seul » éteint ⇒ aucun geste ;
//      allumé ⇒ un geste, au plus une fois ; le lot : sans `confirme` rien, liste changée rien, deux touchers ⇒ un seul.
// --prouve : chaque règle affaiblie dans une copie ⇒ au moins un rouge.
const fs = require('fs'), path = require('path'), vm = require('vm'), os = require('os'), cp = require('child_process');
const R = path.join(__dirname, '..');
const F_SRC = path.join(R, 'src/lotRelance.js'), F_BG = path.join(R, 'vinted-sync-extension/background.js');
const DEB = '// <lot-relance-regle>', FIN = '// </lot-relance-regle>';
const bloc = (t, a = DEB, b = FIN) => { const i = t.indexOf(a), j = t.indexOf(b); return i < 0 || j < 0 ? null : t.slice(i, j + b.length); };
if (process.argv.includes('--recopie')) {
  const b = bloc(fs.readFileSync(F_SRC, 'utf8')); let bg = fs.readFileSync(F_BG, 'utf8'); const vieux = bloc(bg);
  if (!b || !vieux) { console.log('❌ bloc introuvable'); process.exit(1); }
  fs.writeFileSync(F_BG, bg.replace(vieux, () => b)); console.log('✅ bloc <lot-relance-regle> recopié dans background.js'); process.exit(0);
}
const argSrc = (() => { const i = process.argv.indexOf('--src'); return i > 0 ? path.resolve(process.argv[i + 1]) : F_BG; })();
const BG = fs.readFileSync(argSrc, 'utf8');
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('✅ ' + m); } else { ko++; console.log('❌ ' + m + (d ? '  → ' + d : '')); } };
const ctx0 = {}; try { vm.runInNewContext(bloc(BG) + '\n;globalThis.__f = { lrOffreLot, lrGroupesLot, lrOffreRatee, lrRelances, lrPlancher };', ctx0); } catch (e) { console.log('❌ L0 bloc absent ou cassé : ' + e.message); process.exit(1); }
const F = ctx0.__f;
dit(argSrc !== F_BG || bloc(fs.readFileSync(F_SRC, 'utf8')) === bloc(BG), 'L1 les deux copies du bloc sont identiques');

// ── L2 ──
let r = F.lrOffreLot([{ itemId: '1', prix: 60, mini: 40 }, { itemId: '2', prix: 40, achat: 20 }], 10);
dit(r.ok && r.somme === 10000 && r.prix === 9000 && r.plancher === 4000 + 2200 && !r.remontee, 'L2 lot de 60 + 40 à −10 % = 90 € (planchers 40 + 22)', JSON.stringify(r));
r = F.lrOffreLot([{ itemId: '1', prix: 60, mini: 58 }, { itemId: '2', prix: 40, mini: 38 }], 20);
dit(r.ok && r.prix === 9600 && r.remontee, 'L2 sous la somme des planchers ⇒ REMONTÉ à 96 €', JSON.stringify(r));
r = F.lrOffreLot([{ itemId: '1', prix: 60, mini: 60 }, { itemId: '2', prix: 40, mini: 40 }], 20);
dit(!r.ok && r.raison === 'plancher_au_prix', 'L2 planchers = somme ⇒ pas de lot');
r = F.lrOffreLot([{ itemId: '1', prix: 60, mini: 40 }, { itemId: '2', prix: 40 }], 10);
dit(!r.ok && r.raison === 'plancher_inconnu' && r.items.includes('2'), 'L2 un article sans prix mini ni achat ⇒ pas de lot, l’article nommé');
dit(!F.lrOffreLot([{ itemId: '1', prix: 60, mini: 40 }, { itemId: '1', prix: 60, mini: 40 }], 10).ok, 'L2 deux fois le même article n’est pas un lot');
let sous = 0, pire = '';
for (let k = 0; k < 2000; k++) {
  const n = 2 + (k % 5), arts = Array.from({ length: n }, (_, i) => { const p = 5 + Math.round(Math.random() * 30000) / 100; const m = Math.random() < 0.5 ? Math.round(p * (0.3 + Math.random() * 0.75) * 100) / 100 : null; return { itemId: String(i + 1), prix: p, mini: m, achat: m ? null : Math.round(p * Math.random() * 100) / 100 + 0.01 }; });
  const t = 1 + (k % 50), o = F.lrOffreLot(arts, t);
  if (o.ok) { const pl = arts.reduce((s, a) => s + F.lrPlancher(a.mini, a.achat).c, 0); if (o.prix < pl || o.prix >= o.somme) { sous++; pire = JSON.stringify({ arts, t, o }); } }
}
dit(sous === 0, 'L2 2 000 lots au hasard : jamais sous la somme des planchers, toujours sous la somme', pire);

// ── L3 ──
const g = F.lrGroupesLot([{ receiver: '5', pseudo: 'a', itemId: '1', enVente: true }, { receiver: '5', itemId: '2', enVente: true }, { receiver: '5', itemId: '2', enVente: true },
  { receiver: '6', pseudo: 'a', itemId: '3', enVente: true }, { receiver: '7', itemId: '1', enVente: true }, { receiver: '7', itemId: '4', enVente: false }, { receiver: '', pseudo: 'a', itemId: '9', enVente: true }]);
dit(g.length === 1 && g[0].receiver === '5' && g[0].items.length === 2, 'L3 regroupé par identité (receiver_id), articles distincts, prouvés en vente — jamais par pseudo', JSON.stringify(g));

// ── L4 ──
const off = (st, titre, user = 999, extra = {}) => ({ entity_type: 'offer_request_message', created_at_ts: 1700000000, entity: Object.assign({ user_id: user, status: st, status_title: titre, price: { amount: '40.0' }, transaction_id: 55, offer_request_id: 66 }, extra) });
const conv = (msgs) => ({ conv: '87001', opp: 999, login: 'b', item: '7001', tx: '55', cap: '2023-11-20T00:00:00Z', messages: msgs });
dit(F.lrOffreRatee(conv([off(30, 'Refusée')])).etat === 'refusee' && F.lrOffreRatee(conv([off(10, 'Expirée')])).etat === 'expiree', 'L4 refusée (30) et expirée sont des offres ratées');
dit(F.lrOffreRatee(conv([off(20, 'Acceptée')])) === null && F.lrOffreRatee(conv([off(10, 'En attente')])) === null && F.lrOffreRatee(conv([off(30, 'Refusée', 111)])) === null, 'L4 acceptée, en attente, ou offre d’un autre que l’acheteur ⇒ rien');
dit(F.lrOffreRatee(conv([off(30, 'Refusée'), { entity_type: 'offer_message', entity: { user_id: 111 } }])).relanceVue === true, 'L4 une offre du vendeur après ⇒ déjà relancée');
dit(F.lrOffreRatee(conv([off(30, 'Refusée'), off(10, 'En attente')])) === null, 'L4 une nouvelle offre de l’acheteur en attente ⇒ plus rien à relancer');

// ── L5 ──
const J = 86400000, T0 = 1700000000000;
const base = { conv: '87001', acheteur: '999', item: '7001', tx: '55', offre: 4000, etat: 'refusee', at: T0, atSur: true };
const ctx = (x) => Object.assign({ maintenant: T0 + 4 * J, jours: 3, taux: 10, deja: new Set(), etatArticle: () => 'en_vente', prixArticle: () => 60, planchers: () => ({ mini: 50 }) }, x);
let L = F.lrRelances([base], ctx());
dit(L[0].etat === 'pret' && L[0].prix === 5400, 'L5 prix = max(plancher 50, offre 40, 60 − 10 % = 54) = 54 €, prête après 3 j', JSON.stringify(L[0]));
dit(F.lrRelances([base], ctx({ maintenant: T0 + 2 * J }))[0].etat === 'attente', 'L5 avant N jours ⇒ en attente');
dit(F.lrRelances([base], ctx({ deja: new Set(['999|7001']) }))[0].raison === 'deja', 'L5 déjà relancé (acheteur + article) ⇒ écartée');
dit(F.lrRelances([base, Object.assign({}, base, { conv: '87009', at: T0 + 1 })], ctx()).length === 1, 'L5 une seule ligne par acheteur et par article');
dit(F.lrRelances([base], ctx({ etatArticle: () => 'pas_su' }))[0].etat === 'ecarte' && F.lrRelances([base], ctx({ etatArticle: () => 'vendu' }))[0].raison === 'plus_en_vente', 'L5 article pas PROUVÉ en vente ⇒ écartée');
dit(F.lrRelances([base], ctx({ planchers: () => ({}) }))[0].raison === 'plancher_inconnu', 'L5 sans prix mini ni achat ⇒ écartée (jamais une offre sous ce qu’il a payé)');
dit(F.lrRelances([base], ctx({ planchers: () => ({ mini: 60 }) }))[0].raison === 'plancher_au_prix', 'L5 plancher au prix ⇒ écartée');
let mal = 0, ex = '';
for (let k = 0; k < 2000; k++) {
  const p = 10 + Math.round(Math.random() * 30000) / 100, mi = Math.random() < 0.5 ? Math.round(p * Math.random() * 110) / 100 : null, ac = Math.round(p * Math.random() * 100) / 100 + 0.01, of = Math.round(p * Math.random() * 100);
  const l = F.lrRelances([Object.assign({}, base, { offre: of })], ctx({ prixArticle: () => p, planchers: () => ({ mini: mi, achat: ac }), taux: k % 51 }))[0];
  if (l.prix != null) { const pl = F.lrPlancher(mi, ac).c; if (l.prix < pl || l.prix < of || l.prix >= Math.round(p * 100)) { mal++; ex = JSON.stringify({ p, mi, ac, of, l }); } }
}
dit(mal === 0, 'L5 2 000 relances au hasard : jamais sous le plancher ni sous son offre, toujours sous le prix', ex);

// ── L6 : le fond ──
(async () => {
  const { faireFond } = require('./_fond-vm.cjs');
  const UID = '111', CONV = '87001';
  const now = Date.now();
  const lignes = () => ({
    main: { vinted_annonce_numeros: { '7001': { min: '50' } } }, vinted_listing_dates: {},
    ['harvest_' + UID + '_listings']: { payload: { items: [{ id: 7001, title: 'Nike Dunk', price: { amount: '60.0' } }] } },
    ['harvest_' + UID + '_conv_' + CONV]: { capturedAt: new Date(now).toISOString(), payload: { conversation: { id: Number(CONV), opposite_user: { id: 999, login: 'acheteur_9' }, transaction: { id: 55, item_id: 7001 },
      messages: [{ entity_type: 'offer_request_message', created_at_ts: Math.floor((now - 5 * J) / 1000), entity: { user_id: 999, status: 30, status_title: 'Refusée', price: { amount: '40.0' }, transaction_id: 55, offer_request_id: 66 } }] } } },
  });
  const sender = { tab: { id: 7, url: 'https://www.vinted.fr/' }, url: 'https://www.vinted.fr/' };
  const monter = (auto) => {
    const L = lignes(); if (auto) L.vrm_reglages_auto = { v: 1, cles: { vinted_bleam: { v: 1, comptes: { [UID]: { relanceOffres: { actif: true, jours: 3, taux: 10 } } } } } };
    const Fd = faireFond({ src: argSrc, lignes: L, connecte: UID });
    const gestes = [];
    Fd.ctx.compteConnecte = async () => UID;
    Fd.ctx.compteVintedDeLOnglet = async () => ({ uid: UID, dom: 'www.vinted.fr' });
    Fd.ctx.executerPourAppCoeur = async (req) => { gestes.push(req); return { ok: true, status: 200, data: { code: 0 } }; };
    Fd.ctx.interfaceVinted = async (acc, geste, d) => { gestes.push({ geste, d }); return geste === 'favoriOuvrir' ? { ok: true, conv: '87100', status: 200 } : { ok: true, status: 200, data: { code: 0 }, vu: true }; };
    Fd.ctx.garde = async () => null; Fd.ctx.annonceIndisponibleLue = async () => ''; Fd.ctx.delaiOffreMs = () => 0; Fd.ctx.facteurPrudence = async () => 1;
    return { Fd, gestes };
  };
  let { Fd, gestes } = monter(false);
  const lu = await Fd.ctx.relancesCarte({ quoi: 'lire' }, sender);
  dit(lu && lu.ok && lu.liste.length === 1 && lu.liste[0].etat === 'pret' && lu.liste[0].prix === 5400, 'L6 la liste « À relancer » du fond : 54 €, prête', JSON.stringify(lu && (lu.liste || lu.raison)));
  let e = await Fd.ctx.relancesCarte({ quoi: 'envoyer', conv: CONV, item: '7001', prix: 54 }, sender);
  dit(!e.ok && e.code === 'confirmation' && gestes.length === 0, 'L6 sans SON toucher (confirme) : rien ne part');
  const [e1, e2] = await Promise.all([Fd.ctx.relancesCarte({ quoi: 'envoyer', conv: CONV, item: '7001', prix: 54, confirme: true }, sender), Fd.ctx.relancesCarte({ quoi: 'envoyer', conv: CONV, item: '7001', prix: 54, confirme: true }, sender)]);
  const e3 = await Fd.ctx.relancesCarte({ quoi: 'envoyer', conv: CONV, item: '7001', prix: 54, confirme: true }, sender);
  const offres = gestes.filter((x) => /\/offers$/.test(String(x.endpoint || '')));
  dit(offres.length === 1 && offres[0].body.offer.price === '54.00' && offres[0].conv === CONV && !e3.ok, 'L6 trois touchers ⇒ UNE seule relance (54 €, dans SA conversation)', JSON.stringify({ n: offres.length, e1, e2, e3 }));
  ({ Fd, gestes } = monter(false));
  await Fd.ctx.relanceOffresAuto(UID);
  dit(gestes.length === 0, 'L6 « Relancer seul » éteint (par défaut) ⇒ aucun geste');
  ({ Fd, gestes } = monter(true));
  await Fd.ctx.relanceOffresAuto(UID); await Fd.ctx.relanceOffresAuto(UID); await Fd.ctx.relanceOffresAuto(UID);
  dit(gestes.filter((x) => /\/offers$/.test(String(x.endpoint || ''))).length === 1, 'L6 « Relancer seul » allumé ⇒ une relance, jamais deux', JSON.stringify(gestes));
  // ── L7 : le lot, par le fond ──
  ({ Fd, gestes } = monter(false));
  const lien = (it, rc) => `https://www.vinted.fr/items/${it}/want_it/new?receiver_id=${rc}`;
  Fd.ctx.apercuCarteFrais = async () => ({ ok: true, apercu: { etat: 'pret', tous: [
    { id: 'n1', itemId: '7001', pseudo: 'fan_1', prix: 60, date: '2026-11-20' }, { id: 'n2', itemId: '7002', pseudo: 'fan_1', prix: 40, date: '2026-11-20' },
    { id: 'n3', itemId: '7001', pseudo: 'fan_1', prix: 60, date: '2026-11-20' } ] } });
  Fd.ctx.liensFavorisNotif = async () => new Map([['n1', lien(7001, 501)], ['n2', lien(7002, 501)], ['n3', lien(7001, 777)]]);
  Fd.ctx.offreAutoReglages = async () => ({ mins: { '7001': 50, '7002': 30 }, achats: {}, refuses: {} });
  const lots = await Fd.ctx.lotsFavorisCarte({ quoi: 'lire' }, sender);
  const l0 = lots && lots.lots && lots.lots[0];
  dit(lots && lots.ok && lots.lots.length === 1 && l0.receiver === '501' && l0.offre.prix === 9000, 'L7 un lot pour la personne aux DEUX favoris (receiver_id 501), 90 € ; le même pseudo sous un autre id n’y entre pas', JSON.stringify(lots));
  let le = await Fd.ctx.lotsFavorisCarte({ quoi: 'envoyer', receiver: '501', items: ['7001', '7002'], prix: 90 }, sender);
  dit(!le.ok && le.code === 'confirmation' && !gestes.length, 'L7 lot sans SON toucher : rien ne part');
  le = await Fd.ctx.lotsFavorisCarte({ quoi: 'envoyer', receiver: '501', items: ['7001'], prix: 90, confirme: true }, sender);
  dit(!le.ok && le.code === 'change' && !gestes.length, 'L7 liste du lot changée : rien ne part');
  const [la, lb] = await Promise.all([Fd.ctx.lotsFavorisCarte({ quoi: 'envoyer', receiver: '501', items: ['7001', '7002'], prix: 90, confirme: true }, sender), Fd.ctx.lotsFavorisCarte({ quoi: 'envoyer', receiver: '501', items: ['7001', '7002'], prix: 90, confirme: true }, sender)]);
  const msgs = gestes.filter((x) => x.geste === 'message');
  dit(msgs.length === 1 && /90 €/.test(msgs[0].d.texte) && /100 €/.test(msgs[0].d.texte) && gestes.some((x) => x.geste === 'favoriOuvrir' && x.d.receiverId === '501'), 'L7 deux touchers ⇒ UN message de lot (90 € au lieu de 100 €), conversation ouverte pour CETTE personne', JSON.stringify({ gestes, la, lb }));
  const n0 = gestes.length;
  const lc = await Fd.ctx.lotsFavorisCarte({ quoi: 'envoyer', receiver: '501', items: ['7001', '7002'], prix: 90, confirme: true }, sender);
  dit(!lc.ok && lc.code === 'deja' && gestes.length === n0, 'L7 un lot déjà proposé (30 j) ne repart jamais', JSON.stringify(lc));
  console.log(`\n${ko ? '❌' : '✅'} audit-lot-relance : ${ok} verts, ${ko} rouges`);
  if (process.argv.includes('--prouve')) prouver();
  process.exitCode = ko ? 1 : 0;
})().catch((e) => { console.log('❌ L6 ' + (e && e.stack)); process.exitCode = 1; });

function prouver() {
  const M = {
    plancherLot: ['if (prix < plancher) { prix = plancher; remontee = true; }', 'if (false) {}'],
    sansPlancher: ["if (sansPlancher.length) return { ok: false, raison: 'plancher_inconnu', items: sansPlancher };", ''],
    identite: ["if (!f || f.enVente !== true) continue;", 'if (!f) continue;'],
    relancePlancher: ['const prix = Math.max(pl.c, r.offre, cible);', 'const prix = cible;'],
    deja: ["if (deja.has(k) || r.relanceVue) { ligne.raison = 'deja'; out.push(ligne); continue; }", ''],
    enVente: ["if (ea !== 'en_vente') {", "if (ea === 'vendu') {"],
    confirme: ["if (msg.confirme !== true) return { ok: false, code: 'confirmation', raison: 'Rien n’est parti : confirme d’abord la relance.' };", ''],
    noteAvant: ["if (!(await noterRelance(uid, cle))) return", "if (false) return"],
    lotConfirme: ["if (msg.confirme !== true) return { ok: false, code: 'confirmation', raison: 'Rien n’est parti : confirme d’abord « Envoyer le lot ».' };", ''],
    lotDeja: ['if (g.deja) return', 'if (false) return'],
    autoEteint: ["if (!B || !B.relanceOffres || B.relanceOffres.actif !== true) return 0;", 'if (!B) return 0;'],
  };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lr-mut-'));
  let rouges = 0;
  for (const [k, [a, b]] of Object.entries(M)) {
    const t = BG.replace(a, b); if (t === BG) { console.log('❌ mutation ' + k + ' : motif introuvable'); continue; }
    const f = path.join(dir, k + '.js'); fs.writeFileSync(f, t);
    let code = 0; try { cp.execFileSync(process.execPath, [__filename, '--src', f], { stdio: 'pipe' }); } catch (e) { code = e.status || 1; }
    console.log((code ? '✅' : '❌') + ` mutation « ${k} » ⇒ ${code ? 'rouge' : 'reste vert'}`); if (code) rouges++;
  }
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`--prouve : ${rouges}/${Object.keys(M).length} mutations rouges`);
  if (rouges !== Object.keys(M).length) process.exitCode = 1;
}
