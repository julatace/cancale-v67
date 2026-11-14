// ══════════════════════════════════════════════════════════════════════════════
//  LE CARNET DES VENDEURS CHEZ QUI TU ACHÈTES (14 nov., lot messages-achats-plus, n° 125)
//  docs/passation/2026-11-14-messages-achats-plus.md
// ══════════════════════════════════════════════════════════════════════════════
// Pour chaque vendeur Vinted chez qui IL a acheté : combien d'achats, ce que leurs
// paires lui ont rapporté, en combien de temps elles sont arrivées, et les soucis
// (annulé, retour, suspendu, paiement échoué).
// ⚠️ Ce sont les vendeurs chez qui IL achète — PAS « les acheteurs fidèles » (refusé
// le 11 oct., §3) : aucune liste de ses acheteurs n'est faite ici.
//
// §5 — L'IDENTITÉ DU VENDEUR est son identifiant Vinted LU SUR LA TRANSACTION
// d'achat : `transaction.seller_id` du détail de la transaction (côté acheteur),
// sinon l'interlocuteur de la conversation attachée à CETTE transaction quand
// Vinted dit qu'il y est l'acheteur (`current_user_side = buyer`). JAMAIS un pseudo,
// un titre, une photo : deux vendeurs au même pseudo restent deux, un achat sans
// identifiant lu n'est rangé chez PERSONNE (il est compté à part, dit).
//
// §5 — LES CHIFFRES. Ce que les paires ont rapporté est le bénéfice de la règle
// unique, déjà calculé par « Tes meilleures sources » (src/meilleuresSources.js,
// achat relié à sa vente par identité) : il est relu, jamais refait. Chaque somme
// est « au moins » avec sa couverture (« bénéfice connu pour 2 sur 3 revendues »),
// un bénéfice aux frais pas confirmés se dit « au plus ».
// Module PUR : exécuté par scripts/audit-messages-achats-plus.cjs.
// ══════════════════════════════════════════════════════════════════════════════

const J = 86400000;
const str = (v) => String(v == null ? '' : v).trim();
const txOk = (v) => { const s = str(v); return /^\d{4,20}$/.test(s) ? s : ''; };
const vendeurOk = (v) => { const s = str(v); return /^\d{1,15}$/.test(s) ? s : ''; };

// Les codes MESURÉS de la transaction (App.jsx, `noterEtatsTxn`) : 220 paiement échoué ·
// 430 suspendue · 440 retour initié · 450 finalisée · 500/510/520 annulée.
export function souciDe(code) {
  const n = Number(code);
  if (!Number.isFinite(n)) return null;
  if (n === 220) return 'echec';
  if (n === 430) return 'suspendu';
  if (n === 440) return 'retour';
  if (n >= 500 && n <= 520) return 'annule';
  return null;
}

// Le vendeur de chaque transaction d'achat, par identité. Entrées :
//   txns : [{ tx, side: user_side, sid: seller_id, login }] (détail des transactions) ;
//   convs : [{ tx, side: current_user_side, opp: opposite_user.id, login }] (conversations).
// Rend Map tx → { id, login }. Une transaction où les deux sources se CONTREDISENT n'a
// pas de vendeur (mieux vaut un blanc qu'un faux).
export function vendeursDesAchats({ txns = [], convs = [] } = {}) {
  const parTx = new Map(), conflit = new Set();
  const poser = (tx, id, login) => {
    if (!tx || !id || conflit.has(tx)) return;
    const d = parTx.get(tx);
    if (d && d.id !== id) { parTx.delete(tx); conflit.add(tx); return; }
    if (!d) parTx.set(tx, { id, login: str(login).slice(0, 60) });
    else if (!d.login && login) d.login = str(login).slice(0, 60);
  };
  for (const t of (Array.isArray(txns) ? txns : [])) {
    if (!t || str(t.side) !== 'buyer') continue;
    poser(txOk(t.tx), vendeurOk(t.sid), t.login);
  }
  for (const c of (Array.isArray(convs) ? convs : [])) {
    if (!c || str(c.side) !== 'buyer') continue;
    poser(txOk(c.tx), vendeurOk(c.opp), c.login);
  }
  return parTx;
}

// Le carnet.
//   achats : les achats Vinted LUS ({ transaction_id, date, status }) — comptes écartés et
//            achats masqués déjà retirés par l'écran ;
//   vendeurs : Map tx → { id, login } (`vendeursDesAchats`) ;
//   etats : { [tx]: { s: code, su: date } } (le détail des transactions) ;
//   bilan : la publication de « Tes meilleures sources » (`lireMeilleures`) — sa source
//           `vinted` porte, par achat, ce qui est revendu et le bénéfice de la règle ;
//   estAnnule(o) : la règle de « Dépensé » ; montant(o) : € payés | null.
// Rend { vendeurs: [...], total, avecVendeur, sansVendeur, bilanLu }.
export function carnetVendeurs({ achats = [], vendeurs = new Map(), etats = {}, bilan = null, estAnnule = null, montant = null } = {}) {
  const parAchat = new Map();
  const srcVinted = bilan && Array.isArray(bilan.sources) ? bilan.sources.find((s) => s && s.cle === 'vinted') : null;
  for (const a of ((srcVinted && Array.isArray(srcVinted.liste)) ? srcVinted.liste : [])) if (a && a.genre === 'vinted') parAchat.set(str(a.id), a);
  const groupes = new Map();
  let total = 0, avecVendeur = 0;
  const vus = new Set();
  for (const o of (Array.isArray(achats) ? achats : [])) {
    const tx = txOk(o && o.transaction_id); if (!tx || vus.has(tx)) continue;
    vus.add(tx); total++;
    const v = vendeurs instanceof Map ? vendeurs.get(tx) : null;
    if (!v || !vendeurOk(v.id)) continue;
    avecVendeur++;
    if (!groupes.has(v.id)) groupes.set(v.id, { id: v.id, login: '', achats: 0, investi: 0, sansPrix: 0, revendus: 0, nBenef: 0, benefice: 0, partiel: false,
      delaiSomme: 0, nDelai: 0, soucis: { annule: 0, retour: 0, suspendu: 0, echec: 0 }, derniere: null, txs: [] });
    const g = groupes.get(v.id);
    if (!g.login && v.login) g.login = v.login;
    g.achats++; g.txs.push(tx);
    const ts = Date.parse(o.date || '');
    if (Number.isFinite(ts) && (g.derniere == null || ts > g.derniere)) g.derniere = ts;
    const e = etats && etats[tx] ? etats[tx] : null;
    const souci = e ? souciDe(e.s) : null;
    const annule = souci === 'annule' || souci === 'echec' || (!souci && typeof estAnnule === 'function' && estAnnule(o));
    if (souci) g.soucis[souci]++; else if (annule) g.soucis.annule++;
    if (annule) continue;   // un achat annulé n'a rien coûté ni rapporté
    const m = typeof montant === 'function' ? montant(o) : null;
    if (m == null || !Number.isFinite(m)) g.sansPrix++; else g.investi += Math.round(m * 100);
    // Le délai : de l'achat à la commande finalisée (450, la date que Vinted pose).
    if (e && Number(e.s) === 450 && Number.isFinite(ts)) { const f = Date.parse(e.su || ''); if (Number.isFinite(f) && f >= ts) { g.delaiSomme += f - ts; g.nDelai++; } }
    const b = parAchat.get(tx);
    if (b) {
      g.revendus += Number.isSafeInteger(b.revendus) ? b.revendus : 0;
      if (b.benefice != null && Number.isFinite(b.benefice)) { g.benefice += b.benefice; g.nBenef += b.revendus || 1; if (b.partiel) g.partiel = true; }
    }
  }
  const liste = [...groupes.values()].map((g) => {
    const payes = g.achats - g.soucis.annule - g.soucis.echec;
    return {
      id: g.id, login: g.login, achats: g.achats, txs: g.txs, derniere: g.derniere,
      investi: g.sansPrix >= payes ? null : g.investi, sansPrix: g.sansPrix, auMoins: g.sansPrix > 0,
      revendus: g.revendus, benefice: g.nBenef ? g.benefice : null, nBenef: g.nBenef, partiel: g.partiel,
      delaiJours: g.nDelai ? Math.round(g.delaiSomme / g.nDelai / J) : null, nDelai: g.nDelai,
      soucis: g.soucis, nSoucis: g.soucis.annule + g.soucis.retour + g.soucis.suspendu + g.soucis.echec,
    };
  });
  liste.sort((a, b) => b.achats - a.achats || (a.benefice == null) - (b.benefice == null) || (b.benefice || 0) - (a.benefice || 0) || a.id.localeCompare(b.id));
  return { vendeurs: liste, total, avecVendeur, sansVendeur: total - avecVendeur, bilanLu: !!srcVinted };
}
