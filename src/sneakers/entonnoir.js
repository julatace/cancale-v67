// ═════════════════════════════════════════════════════════════════════════════
//  L'ENTONNOIR VUES → FAVORIS → VENTE, PAR MODÈLE (28 nov. 2026, lot sneakers-cote)
// ═════════════════════════════════════════════════════════════════════════════
// Une LECTURE de ce qui existe déjà : les annonces de ses dressings (vues `view_count`, favoris `favourite_count`,
// fermée `is_closed`) et ses ventes reliées à l'annonce PAR IDENTITÉ (`item_id` de la vente = `id` de l'annonce,
// §5). Regroupé par référence fabricant (posée sur le N°, sinon l'unique du titre) ; sans référence ⇒ un groupe
// « sans référence » compté à part (jamais réparti par ressemblance).
// « Pas su ne vaut pas 0 » : une annonce aux vues pas lues n'entre pas dans la somme des vues, et la couverture
// le dit (« vues lues sur 12 annonces sur 15 »). Module PUR. Exécuté par scripts/audit-sneakers.cjs.
// ═════════════════════════════════════════════════════════════════════════════
import { refEffective } from './reference.js';

const nb = (v) => (Number.isFinite(v) && v >= 0 ? v : null);

// annonces : [{ id, titre, vues, favoris, fermee, ref (posée, par son N°) }]
// idsVendus : Set des id d'annonce dont une VENTE est prouvée (par identité)
// Rend [{ ref, annonces, vues, nVues, favoris, nFavoris, ventes, tauxFavoris, tauxVente }] trié par annonces,
// plus le groupe '' (sans référence) en dernier.
export function entonnoirParModele(annonces, idsVendus) {
  const g = new Map();
  for (const a of annonces || []) {
    if (!a || a.id == null) continue;
    const r = refEffective(a.ref, a.titre).ref;
    const x = g.get(r) || { ref: r, annonces: 0, vues: 0, nVues: 0, favoris: 0, nFavoris: 0, ventes: 0 };
    x.annonces++;
    const v = nb(a.vues), f = nb(a.favoris);
    if (v != null) { x.vues += v; x.nVues++; }
    if (f != null) { x.favoris += f; x.nFavoris++; }
    if (idsVendus && idsVendus.has(String(a.id))) x.ventes++;
    g.set(r, x);
  }
  const l = [...g.values()].map((x) => ({ ...x,
    // Les taux ne se calculent que sur une couverture COMPLÈTE de l'étape d'avant (sinon « — »).
    tauxFavoris: x.nVues === x.annonces && x.nFavoris === x.annonces && x.vues > 0 ? x.favoris / x.vues : null,
    tauxVente: x.annonces > 0 ? x.ventes / x.annonces : null }));
  return l.sort((a, b) => (a.ref === '') - (b.ref === '') || b.annonces - a.annonces || a.ref.localeCompare(b.ref));
}
