// ═══════════════════════════════════════════════════════════════════════════
// LE PORTE-MONNAIE VINTED, COMPTE PAR COMPTE — la règle (4 nov.)
// ═══════════════════════════════════════════════════════════════════════════
// Le solde de chaque compte est LU par l'extension, jamais déduit des ventes :
// `harvest_{uid}_billing` (deux formes mesurées en base le 4 nov. :
// `{ main, escrow }` — la page « porte-monnaie » — et `{ balance,
// pending_balance, invoice_lines }` — `/users/{id}/payouts`, lu à chaque visite) ;
//   disponible = `main` sinon `balance` · en attente = `escrow` sinon `pending_balance`.
// Les VIREMENTS vers la banque : les lignes `entity_type: "payout"` du relevé
// (`harvest_{uid}_releve_{mois}`, `lignes[].quoi === 'payout'`) et du mois
// courant (`invoice_lines` de la forme versement). Un compte jamais lu ⇒ « — »,
// jamais 0. Une lecture de plus de 24 h ⇒ « à confirmer » (l'argent bouge).
// Un compte écarté (comptes sélectionnés) n'entre pas dans le total : il est
// NOMMÉ à part. Fonctions PURES (scripts/audit-porte-monnaie.cjs).
export const PM_FRAIS_MS = 24 * 60 * 60 * 1000;
const montant = (x) => {
  const v = x && typeof x === 'object' ? x.amount : x;
  if (v == null || v === '') return null;
  const f = parseFloat(String(v).replace(',', '.'));
  return isFinite(f) ? f : null;
};
const uidDe = (id, re) => { const m = re.exec(String(id || '')); return m ? m[1] : ''; };

// billing : [{ id, cap, main, escrow, balance, pending, lignes }] (projection) | null (pas su) | undefined (en cours)
// releves : [{ id, lignes }] | null ; comptes : [{ uid, nom }] (comptes vivants) ; ecarte(uid) → vrai si exclu.
export function porteMonnaieParCompte({ billing, releves, comptes = [], ecarte = () => false, maintenant = Date.now() } = {}) {
  if (billing === undefined) return { etat: 'encours' };
  if (billing === null) return { etat: 'passu' };
  const parUid = {};
  for (const r of billing) {
    const uid = uidDe(r && r.id, /^harvest_(\d+)_billing$/);
    if (!uid) continue;
    const dispo = montant(r.main) != null ? montant(r.main) : montant(r.balance);
    const attente = montant(r.escrow) != null ? montant(r.escrow) : montant(r.pending);
    if (dispo == null && attente == null) continue;         // pas un porte-monnaie (« pas lu »)
    const at = Date.parse(r.cap || '') || null;
    parUid[uid] = { dispo, attente, at, lignesMois: Array.isArray(r.lignes) ? r.lignes : [] };
  }
  const lignes = comptes.map((c) => {
    const uid = String(c.uid);
    const p = parUid[uid];
    const exclu = !!ecarte(uid);
    if (!p) return { uid, nom: c.nom || uid, dispo: null, attente: null, at: null, vieux: false, jamais: true, exclu };
    return { uid, nom: c.nom || uid, dispo: p.dispo, attente: p.attente, at: p.at, vieux: !(p.at && maintenant - p.at <= PM_FRAIS_MS), jamais: false, exclu };
  });
  const dedans = lignes.filter((l) => !l.exclu);
  const lus = dedans.filter((l) => !l.jamais);
  const somme = (k) => (lus.some((l) => l[k] != null) ? Math.round(lus.reduce((s, l) => s + (l[k] || 0), 0) * 100) / 100 : null);
  const total = { dispo: somme('dispo'), attente: somme('attente'), lus: lus.length, sur: dedans.length,
    manque: dedans.filter((l) => l.jamais).map((l) => l.nom), vieux: lus.filter((l) => l.vieux).map((l) => l.nom),
    exclus: lignes.filter((l) => l.exclu).map((l) => l.nom) };
  // Les virements : par compte, dédoublonnés par identifiant de ligne.
  const nomDe = Object.fromEntries(comptes.map((c) => [String(c.uid), c.nom || String(c.uid)]));
  const vus = new Set(), virements = [];
  const ajouter = (uid, l, quoi) => {
    if (!l || typeof l !== 'object' || !(uid in nomDe)) return;
    const estVirement = quoi === 'releve' ? l.quoi === 'payout' : l.entity_type === 'payout';
    if (!estVirement) return;
    const m = quoi === 'releve' ? (typeof l.montant === 'number' ? l.montant : null) : montant(l.amount);
    const d = Date.parse(l.date || '');
    if (m == null || !isFinite(d)) return;
    const k = uid + '|' + (l.id != null ? String(l.id) : d + '|' + m);
    if (vus.has(k)) return; vus.add(k);
    virements.push({ uid, nom: nomDe[uid], date: d, montant: Math.abs(m), enCours: quoi === 'releve' ? l.attente === true : l.pending === true, exclu: !!ecarte(uid) });
  };
  for (const r of (Array.isArray(releves) ? releves : [])) {
    const uid = uidDe(r && r.id, /^harvest_(\d+)_releve_/);
    for (const l of (Array.isArray(r && r.lignes) ? r.lignes : [])) ajouter(uid, l, 'releve');
  }
  for (const uid of Object.keys(parUid)) for (const l of parUid[uid].lignesMois) ajouter(uid, l, 'mois');
  virements.sort((a, b) => b.date - a.date);
  return { etat: 'lu', lignes, total, virements, virementsPasSu: releves === null };
}
