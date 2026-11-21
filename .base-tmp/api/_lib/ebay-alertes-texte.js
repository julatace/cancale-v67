// Le texte de la notification des alertes d'achat eBay (11 nov., lot alertes-ebay).
// Pur, sans import : le passage (api/_lib/ebay-alertes.js) l'envoie, l'aperçu de
// Paramètres → Notifications (api/_lib/notif-apercus.js) le montre — une source.
export const CAT_NOTIF = 'alerteebay';
export const URL_NOTIF = '/?tab=plat_ebay&section=achats';
// Une notification par vendeur et par passage, quel que soit le nombre d'annonces.
const eur = (c) => (Number.isFinite(c) ? (c / 100).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' €' : '');
export function notifAlertes(nv) {
  const n = nv.length;
  const ligne = (x) => `${String(x.titre || '').slice(0, 60)} · ${x.total != null ? eur(x.total) + ' port compris' : eur(x.prix) + ' + port'}`;
  const recherches = [...new Set(nv.map((x) => x.recherche).filter(Boolean))];
  return {
    cat: CAT_NOTIF, tag: 'ebay-alerte', url: URL_NOTIF,
    cle: 'ebay-alerte-' + nv.map((x) => x.itemId).sort().join('.').slice(0, 200),
    title: n === 1 ? `Nouvelle annonce eBay · ${String(nv[0].recherche || '').slice(0, 50)}` : `${n} nouvelles annonces eBay`,
    body: (n === 1 ? ligne(nv[0]) : `${nv.slice(0, 2).map(ligne).join('\n')}${n > 2 ? `\net ${n - 2} autre${n - 2 > 1 ? 's' : ''}` : ''}${recherches.length > 1 ? ` · ${recherches.length} recherches` : ''}`).slice(0, 240),
  };
}

