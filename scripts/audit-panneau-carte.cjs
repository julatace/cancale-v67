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
  confirme: ["if (msg.confirme !== true) return { ok: false, code: 'confirmation', raison: 'Rien n’est parti : touche « Envoyer ».' };", ''],
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
    dit(au && au.offres && au.offres.actif === true && au.offres.minis === 1 && au.favoris && au.favoris.versions === 2 && au.favoris.rythme === 'prudent' && au.baisse === null, 'C. automatisations : offres auto activées (1 prix mini), favoris 2 versions au rythme « prudent », baisse auto pas livrée (null)', JSON.stringify(au));
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
  } catch (e) { dit(false, 'exception', e && e.stack); }
  console.log(`\n${ko ? '❌' : '✅'} audit-panneau-carte : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
