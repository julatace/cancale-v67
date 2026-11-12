#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  LE N° DE SUIVI DE CHAQUE ACHAT EN COURS (12 nov., ext. 5.372)
//  Julien : « tous les achats doivent avoir leur numéro de suivi comme ça on peut
//  voir quand ils arrivent » ; le n° est dans le panneau « Détails » de la
//  conversation (vinted.fr : transporteur, point de destination, « Informations
//  de suivi »). MESURÉ : 22 achats en cours sur 64 avaient un n° ; 25 expédiés ou
//  au point n'en avaient aucun.
//  Le VRAI background.js (scripts/_fond-vm.cjs), réponses synthétiques :
//   A. « En attente de livraison » (statut que la 5.371 ne relisait pas), bordereau
//      téléchargé : le détail de la transaction donne n° + transporteur ⇒ rangé ;
//   B. expédié, le suivi a des étapes mais pas de n° ⇒ le détail le complète et la
//      ligne est RÉÉCRITE (étapes inchangées) ;
//   C. arrivé/livré SANS n° ⇒ encore relu ; AVEC son n° ⇒ plus relu ;
//   D. forme inconnue (aucun objet d'expédition) ⇒ rien d'écrit pour l'achat, la
//      FORME est rangée (`panel_formes_suivi.transaction`) ;
//   E. l'ordre : expédiés sans n° d'abord ;
//   F. lecture seule (aucun POST/PUT chez Vinted), ≤ 6 lectures de suivi/h, compte
//      connecté seulement, une forme sans nom ni adresse de personne.
//  `BG_SRC=chemin` : la preuve sur le code d'avant (5.371 ⇒ rouge).
// ════════════════════════════════════════════════════════════════════════════
const path = require('path');
const { faireFond } = require('./_fond-vm.cjs');
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('✅ ' + m); } else { ko++; console.log('❌ ' + m + (d ? '  → ' + String(d).slice(0, 500) : '')); } };
const BG = process.env.BG_SRC ? path.resolve(process.env.BG_SRC) : path.join(__dirname, '..', 'vinted-sync-extension', 'background.js');
const H = (h) => new Date(Date.now() - h * 3600000).toISOString();
const commande = (tx, status, tus = 'waiting', h = 48) => ({ transaction_id: Number(tx), title: `Achat banc ${String(tx).slice(-3)}`, status, transaction_user_status: tus, date: H(h) });
const NUM = '089287805085360';
const detail = (tx, numero = NUM) => ({ transaction: { id: Number(tx), item_id: 4242, status: 'shipped',
  shipment: { id: 77, status: 'in_transit', tracking_code: numero, carrier: { name: 'Shop2Shop by Chronopost', code: 'shop2shop' },
    pickup_point: { name: 'TABAC BANC', address: '1 rue Inventée, 35000 Rennes' }, recipient: { name: 'Jeanne Inventée' } },
  buyer: { login: 'pseudo_banc' } } });
const journey = (tx) => ({ journey_summary: { steps: [{ title: 'Commande expédiée', status: 'shipped', date: H(30) }, { title: 'Colis en transit', status: 'in_transit', date: H(20) }] } });
const lus = (f, re) => f.j.vinted.filter((v) => re.test(v.chemin));

function monter(lignes, { formeInconnue = [], connecte = '111' } = {}) {
  return faireFond({ src: BG, lignes, connecte, vinted: (req) => {
    const m = /\/transactions\/(\d+)(\/shipment\/journey_summary)?$/.exec(req.chemin);
    if (!m) return { status: 200, body: { user: { id: 111 } } };
    if (m[2]) return { status: 200, body: journey(m[1]) };
    if (formeInconnue.includes(m[1])) return { status: 200, body: { transaction: { id: Number(m[1]), item_id: 1, status: 'x' } } };
    return { status: 200, body: detail(m[1]) };
  } });
}
const TXA = '32000000001', TXB = '32000000002', TXC = '32000000003', TXD = '32000000004', TXE = '32000000005', TXF = '32000000006';

(async () => {
  // ── A + B + D ──
  { const lignes = {
      harvest_111_orders_purchased: { type: 'orders_purchased', payload: { my_orders: [
        commande(TXA, 'En attente de livraison', 'waiting', 30),
        commande(TXB, 'Colis expédié', 'waiting', 50),
        commande(TXD, 'En attente de livraison', 'waiting', 10),
        commande(TXF, 'Commande finalisée', 'completed', 60),
      ] } },
      [`harvest_111_suivi_${TXB}`]: { v: 1, tx: TXB, source: 'journey', capturedAt: H(5), etapes: [{ t: 'Colis en transit', at: H(20), code: 'in_transit' }, { t: 'Commande expédiée', at: H(30), code: 'shipped' }], dernier: { t: 'Colis en transit', at: H(20), code: 'in_transit' }, transporteur: null, suivi: null, forme: {} },
    };
    const f = monter(lignes, { formeInconnue: [TXD] });
    await f.ctx.capterSuivisAchats('111');
    await f.ctx.capterSuivisAchats('111');
    const a = lignes[`harvest_111_suivi_${TXA}`], b = lignes[`harvest_111_suivi_${TXB}`];
    dit(a && a.suivi === NUM && /Chronopost/.test(String(a.transporteur || '')), 'A. « En attente de livraison » : n° et transporteur lus dans le détail de la transaction, rangés', JSON.stringify(a));
    dit(b && b.suivi === NUM && b.etapes && b.etapes.length === 2, 'B. expédié, suivi sans n° : le n° du détail complète la ligne (étapes gardées)', JSON.stringify(b));
    dit(!lignes[`harvest_111_suivi_${TXD}`], 'D. forme inconnue : rien d’écrit pour cet achat', JSON.stringify(lignes[`harvest_111_suivi_${TXD}`]));
    const formes = (lignes.panel_formes_suivi || {});
    const ft = formes.transaction || (formes.formes && formes.formes.transaction) || null;
    dit(!!ft, 'D. la FORME du détail est rangée pour qu’on l’apprenne (panel_formes_suivi)', JSON.stringify(formes).slice(0, 300));
    const tout = JSON.stringify(lignes);
    if (process.env.VOIR) console.log(JSON.stringify(a), JSON.stringify(formes));
    dit(a && a.relaisNom === "TABAC BANC", "le point de destination (un commerce) est rangé avec l’achat", JSON.stringify(a));
    dit(!/Jeanne|pseudo_banc/.test(JSON.stringify(a) + JSON.stringify(b)) && !/Jeanne|pseudo_banc/.test(JSON.stringify(formes)), 'F. aucun nom ni pseudo de personne rangé avec le suivi', tout.match(/Jeanne|pseudo_banc/g));
    dit(!lus(f, new RegExp(TXF)).length, 'jamais une commande finalisée', lus(f, new RegExp(TXF)).length);
    dit(f.j.vinted.every((v) => v.methode === 'GET'), 'F. lecture seule : aucun POST/PUT chez Vinted', f.j.vinted.filter((v) => v.methode !== 'GET').map((v) => v.methode + ' ' + v.chemin).join(' '));
    dit(((f.store.vrmSuiviLus || {})['111'] || []).length <= 6, 'F. 6 lectures de suivi par heure au plus', ((f.store.vrmSuiviLus || {})['111'] || []).length);
  }
  // ── C ──
  { const lignes = {
      harvest_111_orders_purchased: { type: 'orders_purchased', payload: { my_orders: [commande(TXC, 'Commande livrée ! ', 'waiting', 100), commande(TXE, 'Commande livrée ! ', 'waiting', 100)] } },
      [`harvest_111_suivi_${TXC}`]: { v: 1, tx: TXC, source: 'journey', capturedAt: H(48), etapes: [], dernier: { t: 'Colis livré', at: H(48), code: 'delivered' }, transporteur: null, suivi: null, forme: {} },
      [`harvest_111_suivi_${TXE}`]: { v: 1, tx: TXE, source: 'journey', capturedAt: H(48), etapes: [], dernier: { t: 'Colis livré', at: H(48), code: 'delivered' }, transporteur: 'Mondial Relay', suivi: 'AB123456', forme: {} },
    };
    const f = monter(lignes);
    await f.ctx.capterSuivisAchats('111');
    dit(lus(f, new RegExp(TXC)).length >= 1, 'C. livré SANS n° : encore relu', lus(f, new RegExp(TXC)).length);
    dit(lus(f, new RegExp(TXE)).length === 0, 'C. livré AVEC son n° : plus relu', lus(f, new RegExp(TXE)).length);
  }
  // ── E : l'ordre ──
  { const lignes = { harvest_111_orders_purchased: { type: 'orders_purchased', payload: { my_orders: [
      commande('32000000101', 'En attente de livraison', 'waiting', 5),
      commande('32000000102', 'Colis expédié', 'waiting', 2),
      commande('32000000103', 'Colis disponible au point relais', 'needs_action', 1),
    ] } } };
    const f = monter(lignes);
    await f.ctx.capterSuivisAchats('111');
    const ordre = f.j.vinted.map((v) => (/transactions\/(\d+)/.exec(v.chemin) || [])[1]).filter(Boolean);
    const uniq = ordre.filter((x, i) => ordre.indexOf(x) === i);
    dit(uniq[0] === '32000000103' && uniq[1] === '32000000102', 'E. d’abord les achats expédiés sans n° (au point relais, puis en route), puis les autres', uniq.join(' '));
  }
  // ── compte pas connecté ──
  { const lignes = { harvest_111_orders_purchased: { type: 'orders_purchased', payload: { my_orders: [commande(TXA, 'En attente de livraison')] } } };
    const f = monter(lignes, { connecte: '999' });
    await f.ctx.capterSuivisAchats('111');
    dit(lus(f, /transactions/).length === 0, 'F. un autre compte connecté dans l’onglet : rien n’est lu', lus(f, /transactions/).length);
  }
  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
