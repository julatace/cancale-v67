// ════════════════════════════════════════════════════════════════════════════
//  LE GRAND PANNEAU, CE QUE LE FOND LUI SERT (19 nov., ext. 5.409) — sur le VRAI background.js (_fond-vm.cjs)
//   A. Annonces : le statut de CHAQUE annonce est LU dans la réponse de Vinted (brouillon, vendu, masqué, réservé),
//      « en vente » seulement si la règle <enligne-regle> la dit en ligne ; les compteurs sont la somme exacte ;
//   B. Ventes : le transporteur par IDENTITÉ (bordereau e-mail : n° de transaction → n° de suivi ; suivi du
//      transporteur : n° de suivi → transporteur) ; rien relié ou « autre » ⇒ pas de transporteur (jamais deviné) ;
//   C. Automatisations : l'état LU (offres auto, réglages des favoris, mode auto dans la file) ; rien n'est écrit ;
//   D. Notifications : le journal capté, 7 jours, le compte de l'onglet seulement, statut selon le marqueur ;
//   E. Répondre depuis le panneau : sur SON toucher (`confirme`), seulement une conversation de la boîte du compte
//      de l'onglet, par le MÊME chemin gardé que l'app (`executerPourAppCoeur` → garde stricte : sécurité, 50/h,
//      pause) — un compteur plein (50/50) l'arrête, rien ne part ; depuis un autre site : refusé.
//  `--prouve` : chaque mutation doit rendre l'audit ROUGE. Données inventées.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
const { execFileSync } = require('child_process');
const { faireFond, cheminSource } = require('./_fond-vm.cjs');
const args = process.argv.slice(2);
const BG0 = cheminSource();
const MUTATIONS = {
  statut: ["it.is_hidden === true ? 'masque' : ", ''],
  transporteur: ["if (tx && TRANSPORTEURS_CARTE[c] && !parTx.has(tx)) parTx.set(tx, TRANSPORTEURS_CARTE[c]);", "if (tx && !parTx.has(tx)) parTx.set(tx, c || 'inconnu');"],
  boite: ["if (!Object.values(r0).some((v) => String(v) === conv))", 'if (false)'],
  confirme: ["raison: 'La réponse part seulement de l’onglet vinted.fr.' };\n  if (msg.confirme !== true) return { ok: false, code: 'confirmation', raison: 'Rien n’est parti : touche « Envoyer ».' };", "raison: 'La réponse part seulement de l’onglet vinted.fr.' };"],
  siteCompte: ["if (c !== moi) continue;\n        const st = STATUT_LBC", "const st = STATUT_LBC"],
  masquerAppris: ["if (!masquerAppris(wr)) return { ok: false, code: 'pas-appris'", "if (false) return { ok: false, code: 'pas-appris'"],
  masquerDressing: ["if (ids.some((id) => !d.parId[id])) return { ok: false, code: 'autre-compte'", "if (false) return { ok: false, code: 'autre-compte'"],
  baisseLbcLien: ["if (!num) { raisons.sansLien = (raisons.sansLien || 0) + 1; continue; }", "if (!num) { }"],
  baisseLbcEteinte: ["  const regle = regleBaisseDe(m0[REGLE_BAISSE_CLE], cleRegle);\n  if (!regle) return { saute: 'eteinte' };", "  const regle = { pct: 10, jours: 7 };"],
  repondreVcCompte: ["if (!x || String(x.compte || '') !== moi) return { ok: false, code: 'autre-compte'", "if (false) return { ok: false, code: 'autre-compte'"],
  autreCompteNotif: ["if (e.p === 'vinted' && e.c !== u) continue;", ''],
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
let BG = BG0;
const mut = (args.find((a) => a.startsWith('--mutation=')) || '').slice(11);
if (mut) {
  const [a, b] = MUTATIONS[mut];
  const s = fs.readFileSync(BG0, 'utf8');
  if (!s.includes(a)) { console.log('mutation introuvable : ' + mut); process.exit(2); }
  BG = path.join(path.dirname(BG0), `.mut-${mut}-${process.pid}.js`);
  fs.writeFileSync(BG, s.replace(a, b));
  process.on('exit', () => { try { fs.unlinkSync(BG); } catch (_) {} });
}
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('✅ ' + m); } else { ko++; console.log('❌ ' + m + (d !== undefined ? '  → ' + String(d).slice(0, 400) : '')); } };
const H = 3600000, J = 864e5, T0 = Date.now(), iso = (t) => new Date(t).toISOString();
const ONGLET = { tab: { id: 7, url: 'https://www.vinted.fr/catalog' } };

function monde() {
  const it = (i, x) => Object.assign({ id: 111000 + i, title: 'Paire ' + i, price: { amount: String(50 + i) }, created_at_ts: Math.floor((T0 - (i + 1) * J) / 1000), favourite_count: i, view_count: 10 + i, is_closed: false, is_hidden: false, is_draft: false, is_reserved: false }, x || {});
  const items = [it(0), it(1), it(2, { is_draft: true }), it(3, { is_hidden: true }), it(4, { is_reserved: true }), it(5, { is_closed: true, item_closing_action: 'sold' })];
  const lignes = {
    main: { vinted_annonce_numeros: { 111000: { numero: '124', accountId: '111', min: 45 } }, vinted_buyprice_by_num: {}, vinted_offres_auto: true, vrm_capte_vu: { at: T0 - 2 * H } },
    vinted_listing_dates: {},
    harvest_111_listings: { type: 'listings', capturedAt: iso(T0 - 20 * 60000), nItems: 6, payload: { items } },
    harvest_111_orders_sold: { type: 'orders_sold', capturedAt: iso(T0 - 600000), nItems: 3, payload: { my_orders: [0, 1, 2].map((i) => ({ transaction_id: 7000 + i, conversation_id: 9000 + i, title: 'Vente ' + i, price: { amount: '60.0' }, item_id: 111000 + i, date: iso(T0 - i * H), status: 'Colis en route', transaction_user_status: 'waiting' })) } },
    harvest_111_inbox: { type: 'inbox', capturedAt: iso(T0 - 300000), payload: { conversations: [{ id: 55501, unread: true, updated_at: iso(T0 - H), description: 'Bonjour', item_photos: [], opposite_user: { id: 1, login: 'acheteuse' } }] } },
    email_bord_a: { transaction: '7000', suivi: 'SUIVI1' }, email_bord_b: { transaction: '7001', suivi: 'SUIVI2' },
    email_track_chronopost_SUIVI1: { suivi: 'SUIVI1', carrier: 'chronopost' }, email_track_autre_SUIVI2: { suivi: 'SUIVI2', carrier: 'autre' },
    vrm_favoris_reglages_111: { message: 'Bonjour {pseudo}', variantes: ['Salut {pseudo}'], rythme: 'prudent' },
    capte_journal_aaaaaaaaaaaaaaaa: { e: [{ p: 'vinted', c: '111', s: 'ventes', id: '7000', t: T0 - H }, { p: 'vinted', c: '111', s: 'codes', id: '7001:AB', t: T0 - 5 * H }, { p: 'vinted', c: '222', s: 'ventes', id: '8000', t: T0 - H }, { p: 'vinted', c: '111', s: 'ventes', id: '6000', t: T0 - 9 * J }] },
  };
  const f = faireFond({ src: BG, connecte: '111', lignes, comptes: [{ vinted_user_id: '111', login: 'shop_sophie', domain: 'www.vinted.fr' }], vinted: (r) => (r.methode || r.method) === 'POST' ? { status: 200, body: { code: 0 } } : { status: 200, body: {} } });
  f.ctx.compteConnecte = async () => '111';
  f.ctx.retourSurVinted = async () => ({ ok: true });
  return f;
}

(async () => {
  try {
    const f = monde();
    const r = await f.ctx.carteListes({ action: 'carteListes' }, ONGLET);
    const a = r && r.annonces;
    const st = (id) => ((a && a.toutes) || []).find((x) => x.id === String(id)) || {};
    dit(a && a.statuts && a.statuts.brouillon === 1 && a.statuts.masque === 1 && a.statuts.reserve === 1 && a.statuts.vendu === 1 && a.statuts.en_vente === 2, 'A. compteurs : 2 en vente, 1 brouillon, 1 masqué, 1 réservé, 1 vendu — lus dans la réponse de Vinted', JSON.stringify(a && a.statuts));
    dit(st(111002).statut === 'brouillon' && st(111003).statut === 'masque' && st(111004).statut === 'reserve' && st(111005).statut === 'vendu' && st(111000).statut === 'en_vente', 'A. chaque annonce porte SON statut', JSON.stringify((a && a.toutes || []).map((x) => x.id + ':' + x.statut)));
    dit(st(111000).mini === 45 && st(111000).num === '124' && st(111000).vues === 10, 'A. la fiche porte N°, prix mini posé et vues', JSON.stringify(st(111000)));
    const v = (r && r.ventes && r.ventes.liste) || [];
    const vt = (tx) => (v.find((x) => x.tx === String(tx)) || {}).transporteur;
    dit(vt(7000) === 'Chronopost' && vt(7001) === undefined && vt(7002) === undefined, 'B. transporteur par identité (transaction → suivi → transporteur) ; « autre » ou rien relié ⇒ aucun', JSON.stringify(v.map((x) => x.tx + ':' + x.transporteur)));
    const au = r && r.automatisations;
    dit(au && au.offres && au.offres.actif === true && au.offres.minis === 1 && au.favoris && au.favoris.versions === 2 && au.favoris.rythme === 'prudent' && au.baisse && au.baisse.actif === false && au.paliers && au.paliers.actif === false, 'C. automatisations : offres auto activées (1 prix mini), favoris 2 versions au rythme « prudent », baisse auto et paliers éteints (défaut) — lus', JSON.stringify(au));
    const n = r && r.notifications;
    dit(n && n.liste.length === 2 && n.liste.every((e) => e.c === '111') && !n.liste.some((e) => e.id === '6000') && n.vu === T0 - 2 * H, 'D. notifications : 7 jours, le compte de l’onglet seulement, le marqueur « vu » lu', JSON.stringify(n));
    const ecr = () => f.j.vinted.filter((x) => String(x.methode || x.method || 'GET').toUpperCase() !== 'GET').length;
    const r1 = await f.ctx.repondreCarte({ conv: '55501', texte: 'Oui, toujours dispo' }, ONGLET);
    dit(r1 && r1.ok === false && r1.code === 'confirmation' && ecr() === 0, 'E. sans son toucher (`confirme`) : rien ne part', JSON.stringify(r1));
    const r2 = await f.ctx.repondreCarte({ conv: '99999', texte: 'Oui', confirme: true }, ONGLET);
    dit(r2 && r2.ok === false && ecr() === 0, 'E. une conversation hors de la boîte du compte de l’onglet : refusée, rien ne part', JSON.stringify(r2));
    const r3 = await f.ctx.repondreCarte({ conv: '55501', texte: 'Oui, toujours dispo', confirme: true }, { tab: { id: 7, url: 'https://www.leboncoin.fr/' } });
    dit(r3 && r3.ok === false && ecr() === 0, 'E. depuis un autre site : refusée', JSON.stringify(r3));
    const g = faireFond({ src: BG, connecte: '111', lignes: monde().lignes, store: { vrmActions: { 111: Array.from({ length: 50 }, (_, i) => T0 - i * 1000) } }, comptes: [{ vinted_user_id: '111', login: 'shop_sophie', domain: 'www.vinted.fr' }] });
    g.ctx.compteConnecte = async () => '111';
    const r4 = await Promise.race([g.ctx.repondreCarte({ conv: '55501', texte: 'Oui', confirme: true }, ONGLET), new Promise((ok2) => setTimeout(() => ok2({ ok: 'timeout' }), 4000))]);
    dit(r4 && r4.ok === false && g.j.vinted.filter((x) => String(x.methode || x.method || 'GET').toUpperCase() !== 'GET').length === 0, 'E. 50 actions dans l’heure : la garde stricte arrête la réponse, rien ne part', JSON.stringify(r4));
    const r5 = await Promise.race([f.ctx.repondreCarte({ conv: '55501', texte: 'Oui, toujours dispo', confirme: true }, ONGLET), new Promise((ok2) => setTimeout(() => ok2({ ok: 'timeout' }), 4000))]);
    const post = f.j.vinted.find((x) => /\/conversations\/55501\/replies$/.test(String(x.chemin || x.url || x.path || '')));
    dit(r5 && r5.ok === true && !!post, 'E. son toucher, sa conversation : la réponse part par le chemin gardé (POST …/replies)', JSON.stringify({ r5, n: f.j.vinted.length, d: f.j.vinted.slice(-2) }));
    // F. Leboncoin et Vestiaire : le compte de L'ONGLET de ce site, jamais un autre, rien attribué au hasard.
    const lignesSites = {
      lbc_listings: { updatedAt: iso(T0 - H), items: { a1: { id: 'a1', subject: 'Paire A', price: 80, status: 'active', account: 'lbc-account:moi' }, a2: { id: 'a2', subject: 'Paire B', price: 60, status: 'inactive', account: 'lbc-account:moi' }, a3: { id: 'a3', subject: 'Autre compte', price: 50, status: 'active', account: 'lbc-account:autre' }, a4: { id: 'a4', subject: 'Sans compte', price: 40, status: 'active' } } },
      // 5.445 : une vente Leboncoin se PROUVE par `isSeller` (la ligne mêle ventes et achats, mesuré le 23 nov.) ; T2 est une vente aussi :
      //    seul son compte l'écarte.
      lbc_ventes: { ventes: { v1: { txId: 'T1', isSeller: true, title: 'Paire A', price: 80, account: 'lbc-account:moi', stepStatus: 'validation', dateVente: iso(T0 - H) }, v2: { txId: 'T2', isSeller: true, title: 'Autre', price: 50, account: 'lbc-account:autre', stepStatus: 'validation' } } },
      vc_listings: { capturedAt: iso(T0 - H), items: { p1: { ref: 'p1', titre: 'Sac', prix: 300, statut: 'published', compte: '42', favoris: 7 } } },
      vc_ventes: { ventes: { s1: { productId: 'p9', titre: 'Sac vendu', prixVente: 250, compte: '42', etat: 'ACTION_NEEDED', aExpedier: true, transporteur: 'Chronopost', date: iso(T0 - H) }, s2: { productId: 'p8', titre: 'Pas à moi', compte: '43', etat: 'IN_PROGRESS' } } },
    };
    const h = faireFond({ src: BG, connecte: '111', lignes: lignesSites });
    h.ctx.compteOngletCapte = async (url) => (/leboncoin/.test(url) ? { p: 'leboncoin', id: 'lbc-account:moi' } : { p: 'vestiaire', id: '42' });
    const rl = await h.ctx.carteListes({ action: 'carteListes' }, { tab: { id: 8, url: 'https://www.leboncoin.fr/mes-annonces' } });
    const ids = (rl && rl.annonces && rl.annonces.toutes || []).map((x) => x.id + ':' + x.statut).join(',');
    dit(rl && ids === 'a1:en_vente,a2:masque' && rl.annonces.sansCompte === 1 && rl.annonces.statuts.en_vente === 1 && rl.annonces.statuts.masque === 1, 'F. Leboncoin : les annonces du compte de l’onglet seulement (statut lu), celles sans compte comptées et dites, jamais montrées', JSON.stringify(rl && rl.annonces));
    dit(rl && rl.ventes && rl.ventes.liste.length === 1 && rl.ventes.liste[0].tx === 'T1' && rl.ventes.liste[0].etat === 'a_expedier', 'F. Leboncoin : les ventes du compte de l’onglet seulement', JSON.stringify(rl && rl.ventes));
    const rv = await h.ctx.carteListes({ action: 'carteListes' }, { tab: { id: 9, url: 'https://www.vestiairecollective.com/' } });
    dit(rv && rv.annonces && rv.annonces.toutes.length === 1 && rv.annonces.toutes[0].favoris === 7 && rv.ventes && rv.ventes.liste.length === 1 && rv.ventes.liste[0].transporteur === 'Chronopost' && rv.ventes.liste[0].etat === 'a_expedier', 'F. Vestiaire : annonces (favoris lus) et ventes (état, transporteur) du compte de l’onglet seulement', JSON.stringify(rv && { a: rv.annonces, v: rv.ventes }));
    // G. Masquer / afficher depuis le panneau (le geste APPRIS de la règle « vendue ailleurs »).
    const m1 = monde();
    const ecrM = (f) => f.j.vinted.filter((x) => String(x.methode || x.method || '').toUpperCase() === 'PUT' && /\/is_hidden$/.test(String(x.chemin || x.url || x.path || '')));
    const g1 = await m1.ctx.masquerCarte({ ids: ['111000'], voulu: true, confirme: true }, ONGLET);
    dit(g1 && g1.ok === false && g1.code === 'pas-appris' && ecrM(m1).length === 0, 'G. geste pas encore appris ⇒ rien ne part, dit', JSON.stringify(g1));
    const appris = { harvest_111_wreq_api_v2_items_id_is_hidden: { method: 'PUT', path: '/api/v2/items/123456/is_hidden', body: '{"is_hidden":true}' } };
    const m2 = faireFond({ src: BG, connecte: '111', lignes: Object.assign(monde().lignes, appris), comptes: [{ vinted_user_id: '111', login: 'shop_sophie', domain: 'www.vinted.fr' }], vinted: () => ({ status: 200, body: { item: { is_hidden: true } } }) });
    m2.ctx.compteConnecte = async () => '111';
    const g2 = await m2.ctx.masquerCarte({ ids: ['111000'], voulu: true }, ONGLET);
    dit(g2 && g2.code === 'confirmation' && ecrM(m2).length === 0, 'G. sans confirmation : rien ne part', JSON.stringify(g2));
    const g3 = await m2.ctx.masquerCarte({ ids: ['999999'], voulu: true, confirme: true }, ONGLET);
    dit(g3 && g3.ok === false && g3.code === 'autre-compte' && ecrM(m2).length === 0, 'G. une annonce hors du dressing de CE compte : rien ne part', JSON.stringify(g3));
    const g4 = await Promise.race([m2.ctx.masquerCarte({ ids: ['111000', '111001'], voulu: true, confirme: true }, ONGLET), new Promise((r9) => setTimeout(() => r9({ to: 1 }), 6000))]);
    dit(g4 && g4.ok === true && ecrM(m2).length === 2 && g4.faits.every((x) => x.relu === true), 'G. confirmé, appris, de CE compte : deux PUT is_hidden, l’état RELU dans la réponse', JSON.stringify(g4));
    dit(!Object.keys(m2.lignes).some((k) => k === 'vinted_masquees_vrm'), 'G. un masquage à la main n’entre PAS au registre de la règle automatique');
    const m3 = faireFond({ src: BG, connecte: '111', lignes: Object.assign(monde().lignes, appris), store: { vrmActions: { 111: Array.from({ length: 50 }, (_, i) => T0 - i * 1000) } }, comptes: [{ vinted_user_id: '111', login: 'shop_sophie', domain: 'www.vinted.fr' }] });
    m3.ctx.compteConnecte = async () => '111';
    const g5 = await m3.ctx.masquerCarte({ ids: ['111000'], voulu: true, confirme: true }, ONGLET);
    dit(g5 && g5.ok === false && ecrM(m3).length === 0, 'G. 50 actions dans l’heure : la garde stricte arrête, rien ne part', JSON.stringify(g5));
    // H. Messages et réponses Vestiaire / Leboncoin.
    const lh = Object.assign({}, lignesSites, { vc_messages: { capturedAt: iso(T0 - H), conversations: { c1: { ref: 'conv-1', titre: 'Sac', apercu: 'Bonjour', date: iso(T0 - H), nonLu: true, compte: '42' }, c2: { ref: 'conv-2', titre: 'Autre', apercu: 'x', compte: '43' } } }, lbc_messages: { compteurs: { moi: { unread: 3 } } } });
    const hh = faireFond({ src: BG, connecte: '111', lignes: lh });
    hh.ctx.compteOngletCapte = async (url) => (/leboncoin/.test(url) ? { p: 'leboncoin', id: 'lbc-account:moi' } : { p: 'vestiaire', id: '42' });
    let appelVc = 0; hh.ctx.repondreVestiaire = async () => { appelVc++; return { accepte: true, etape: 'fait' }; };
    const rv2 = await hh.ctx.carteListes({ action: 'carteListes' }, { tab: { id: 9, url: 'https://www.vestiairecollective.com/' } });
    dit(rv2 && rv2.messages && rv2.messages.liste.length === 1 && rv2.messages.liste[0].conv === 'conv-1' && rv2.messages.liste[0].nonlu === true, 'H. Vestiaire : les conversations RANGÉES du compte de l’onglet seulement', JSON.stringify(rv2 && rv2.messages));
    const rl2 = await hh.ctx.carteListes({ action: 'carteListes' }, { tab: { id: 8, url: 'https://www.leboncoin.fr/' } });
    dit(rl2 && rl2.messages && rl2.messages.nonlusSite === 3, 'H. Leboncoin : le nombre de non lus de CE compte (les fils se rangent à l’ouverture)', JSON.stringify(rl2 && rl2.messages));
    const h1 = await hh.ctx.repondreCarte({ conv: 'conv-2', texte: 'Oui', confirme: true }, { tab: { id: 9, url: 'https://www.vestiairecollective.com/' } });
    const h2 = await hh.ctx.repondreCarte({ conv: 'conv-1', texte: 'Oui', confirme: true }, { tab: { id: 9, url: 'https://www.vestiairecollective.com/' } });
    dit(h1 && h1.ok === false && h1.code === 'autre-compte' && h2 && h2.ok === true && appelVc === 1, 'H. répondre sur Vestiaire : seulement une conversation de CE compte, par `repondreVestiaire` (son chemin gardé)', JSON.stringify({ h1, h2, appelVc }));
    // I. La baisse par règle sur Leboncoin.
    const li = (regleOn, lien) => faireFond({ src: BG, connecte: '111', lignes: {
      main: { vinted_baisse_regle: { v: 1, comptes: regleOn ? { 'lbc:moi': { actif: true, pct: 10, jours: 7 } } : {} }, vrm_lbc_liens: lien ? { 2222222: '12' } : {}, vinted_annonce_numeros: { 4242: { numero: '12', accountId: '111', min: 60 } }, vinted_buyprice_by_num: {} },
      lbc_listings: { items: { x: { id: '2222222', subject: 'Paire', price: [100], status: 'active', account: 'lbc-account:moi', publieeLe: iso(T0 - 20 * 864e5) } } } }, store: { vrmLbcCompte: { v: 2, id: 'lbc-account:moi', name: 'Sophie' } } });
    const liS = (on, lien) => { const f = li(on, lien); f.ctx.relaisSessionOwner = async () => 'owner-banc'; return f; };
    const cmdsDe = (f) => Object.keys(f.lignes).filter((k) => /^cmd_prix_/.test(k)).map((k) => f.lignes[k]);
    const i0 = liS(false, true); const ri0 = await i0.ctx.regleBaisseLbcTick('audit');
    dit(cmdsDe(i0).length === 0 && ri0 && ri0.saute === 'eteinte', 'I. règle Leboncoin ÉTEINTE (défaut) ⇒ aucune baisse', JSON.stringify(ri0));
    const i1 = liS(true, false); const ri1 = await i1.ctx.regleBaisseLbcTick('audit');
    dit(cmdsDe(i1).length === 0 && ri1 && ri1.raisons && ri1.raisons.sansLien === 1, 'I. sans lien posé par lui (annonce → N°) ⇒ pas de plancher ⇒ aucune baisse');
    const i2 = liS(true, true); const ri = await i2.ctx.regleBaisseLbcTick('audit');
    const c2 = cmdsDe(i2);
    dit(c2.length === 1 && c2[0].site === 'leboncoin' && c2[0].prix === 90 && c2[0].prixAvant === 100 && c2[0].source === 'regle' && c2[0].uidRegle === 'lbc:moi', 'I. allumée, reliée, 20 j sans vente : une baisse de 10 % DÉPOSÉE (100 → 90, plancher 60), exécutée ensuite par `baisserPrixLbc`', JSON.stringify({ ri, c2 }));
    // J. La place au stock.
    const pj = faireFond({ src: BG, connecte: '111', lignes: Object.assign(monde().lignes, {}) });
    pj.lignes.main.vrm_slots = { 124: { m: 'm1', i: 5 } }; pj.lignes.main.vrm_meubles = [{ id: 'm1', name: 'Étagère', cols: 4, rows: 3 }];
    pj.ctx.compteConnecte = async () => '111'; pj.ctx.retourSurVinted = async () => ({ ok: true });
    const rj = await pj.ctx.carteListes({ action: 'carteListes' }, ONGLET);
    const aj = ((rj && rj.annonces && rj.annonces.toutes) || []).find((x) => x.num === '124');
    dit(aj && aj.place === 'Étagère · 2-2', 'J. la place au stock du N° (meuble · rangée-colonne), lue comme dans l’app', JSON.stringify(aj && aj.place));
  } catch (e) { dit(false, 'exception', e && e.stack); }
  console.log(`\n${ko ? '❌' : '✅'} audit-panneau-carte : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
