// ════════════════════════════════════════════════════════════════════════════
// « SYNCHRONISER LES VENTES » DE L'INVENTAIRE — PAR IDENTITÉ SEULEMENT (11 nov.)
// ════════════════════════════════════════════════════════════════════════════
// Revue de robustesse (métier, critique n° 1 et haute n° 4) : la synchro reliait
// chaque commande Vinted à une paire de l'inventaire PAR TITRE et la passait
// « vendue » sans clic. Deux paires au même titre ⇒ la dernière de la liste était
// marquée vendue (§5 : jamais par titre). Et une commande ANNULÉE au même titre
// remettait « en ligne » la paire d'une autre vente.
//
// La règle, maintenant :
//   • une commande est reliée à UNE paire par son IDENTITÉ : le n° de transaction
//     déjà posé sur la paire, ou l'identifiant d'annonce que Vinted donne pour
//     cette transaction (`itemDeTx`, transaction → item_id) = `vintedItemId` de la
//     paire. Deux paires sous la même identité ⇒ rien (on ne devine pas) ;
//   • plusieurs commandes pour la même paire ⇒ la plus FRAÎCHE décide ;
//   • finalisée ⇒ « vendue » ; en cours ⇒ « vente en cours » (si elle était en
//     ligne ou en stock) ; ANNULÉE ⇒ seulement si la paire porte CETTE transaction
//     (vendue / en cours) : elle revient « en stock » (chez lui) — jamais « en
//     ligne » (rien ne le prouve ici), et une vente annulée ne reste pas vendue ;
//   • sans identité, un titre identique n'est qu'une PROPOSITION : c'est SON clic
//     qui relie (`relierProposition`). Rien n'est écrit sans lui.
// Règle PURE, exécutée par scripts/audit-robustesse-metier.cjs.
// ─────────────────────────────────────────────────────────────────────────────

const quand = (o) => { const t = Date.parse((o && (o.status_updated_at || o.updated_at || o.date)) || ''); return Number.isFinite(t) ? t : 0; };
const normDefaut = (t) => String(t || '').toLowerCase().replace(/\s+/g, ' ').trim();

// `inventaire` : [{ id, numero, title, status, vintedItemId, transactionId, … }]
// `commandes`  : [{ transaction_id, title, status, date, price, … , _uid }]
// `itemDeTx`   : { [tx]: itemId } (Vinted) — peut être vide.
// `classer(status)` → 'completed' | 'cancelled' | autre.
// Rend { maj: Map(id → patch), propositions: [{ tx, titre, paires: [id…], uid }], sold, pending, annulees }.
export function planSynchroInventaire({ inventaire, commandes, itemDeTx = {}, classer, normTitre = normDefaut, photoDe = () => null } = {}) {
  const inv = Array.isArray(inventaire) ? inventaire : [];
  const parTx = new Map(), parItem = new Map();
  const poser = (m, k, p) => { if (k == null || k === '') return; const c = String(k); m.set(c, m.has(c) ? null : p); };   // null = deux paires ⇒ ambigu
  for (const p of inv) { if (!p) continue; poser(parTx, p.transactionId, p); poser(parItem, p.vintedItemId, p); }
  const paireDe = (o) => {
    const tx = o && o.transaction_id != null ? String(o.transaction_id) : '';
    const parT = tx && parTx.has(tx) ? parTx.get(tx) : undefined;
    const item = tx && itemDeTx && itemDeTx[tx] != null ? String(itemDeTx[tx]) : '';
    const parI = item && parItem.has(item) ? parItem.get(item) : undefined;
    if (parT === null || parI === null) return null;                 // deux paires sous la même identité
    if (parT && parI && parT.id !== parI.id) return null;            // les deux voies se contredisent
    return parT || parI || null;
  };
  // La commande la plus fraîche de chaque paire.
  const derniere = new Map();
  const sansIdentite = [];
  for (const o of (Array.isArray(commandes) ? commandes : [])) {
    if (!o) continue;
    const p = paireDe(o);
    if (!p) { sansIdentite.push(o); continue; }
    const avant = derniere.get(p.id);
    if (!avant || quand(o) >= quand(avant.o)) derniere.set(p.id, { p, o, uid: o._uid });
  }
  const maj = new Map();
  let sold = 0, pending = 0, annulees = 0;
  for (const { p, o, uid } of derniere.values()) {
    const cls = classer ? classer(o.status) : '';
    const tx = o.transaction_id != null ? String(o.transaction_id) : null;
    const base = {
      transactionId: tx || p.transactionId || null,
      photo: p.photo || photoDe(o) || null,
      price: p.price ?? (o.price && o.price.amount != null ? Number(o.price.amount) : null),
      vintedAccountId: p.vintedAccountId || uid || null,
    };
    if (cls === 'completed') {
      if (p.status !== 'sold') { maj.set(p.id, { ...base, status: 'sold', soldAt: o.date ? new Date(o.date).toLocaleDateString('fr-FR') : null }); sold++; }
    } else if (cls === 'cancelled') {
      // Seulement la paire qui porte CETTE transaction : elle revient chez lui.
      if (tx && String(p.transactionId || '') === tx && (p.status === 'sold' || p.status === 'pending_sale')) { maj.set(p.id, { status: 'stock', soldAt: null }); annulees++; }
    } else if (p.status === 'online' || p.status === 'stock') { maj.set(p.id, { ...base, status: 'pending_sale' }); pending++; }
  }
  // Propositions : une commande finalisée ou en cours, sans identité, au titre d'une
  // ou plusieurs paires pas encore vendues. Jamais appliquée sans son clic.
  const parTitre = new Map();
  for (const p of inv) { if (!p || p.status === 'sold') continue; const k = normTitre(p.title); if (!k) continue; if (!parTitre.has(k)) parTitre.set(k, []); parTitre.get(k).push(p.id); }
  const propositions = [], vues = new Set();
  for (const o of sansIdentite) {
    const cls = classer ? classer(o.status) : '';
    if (cls === 'cancelled') continue;
    const tx = o.transaction_id != null ? String(o.transaction_id) : '';
    if (!tx || vues.has(tx)) continue;
    const ids = parTitre.get(normTitre(o.title));
    if (!ids || !ids.length) continue;
    vues.add(tx);
    propositions.push({ tx, titre: o.title || '', paires: ids.slice(), uid: o._uid || null, finalisee: cls === 'completed', date: o.date || null, price: o.price && o.price.amount != null ? Number(o.price.amount) : null });
  }
  return { maj, propositions, sold, pending, annulees };
}

// SON clic sur une proposition : la paire `pairId` reçoit la transaction (identité
// posée par lui), et l'état que dit la commande. Rend le patch (ou null).
export function relierProposition(prop, paire) {
  if (!prop || !paire || !prop.tx) return null;
  if (paire.status === 'sold') return null;
  return {
    transactionId: prop.tx,
    vintedAccountId: paire.vintedAccountId || prop.uid || null,
    price: paire.price ?? prop.price ?? null,
    status: prop.finalisee ? 'sold' : 'pending_sale',
    ...(prop.finalisee ? { soldAt: prop.date ? new Date(prop.date).toLocaleDateString('fr-FR') : null } : {}),
  };
}
