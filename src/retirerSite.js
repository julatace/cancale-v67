// ── « À RETIRER » SOUS UN FILTRE DE SITE : LES NOMBRES ET LA LISTE, UNE SEULE RÈGLE (19 nov.) ─────────────────
// Julien, capture iPhone du 19 nov. (Achats · Leboncoin) : « À retirer · 15 · 2 d'ici demain · 15 avec code ·
// 5 à vérifier », et AUCUN colis dessous. Les nombres venaient de la publication de TOUS les sites
// (`vrm_colis_retirer` = `pickupUnion`, ses colis Vinted), la liste de la colonne FILTRÉE par le site
// (`colonnesColis(cartes, site)`). Deux règles pour une notion (§5 « une seule règle par notion ») : le chiffre
// annonçait 15 colis qu'aucune ligne ne montrait.
//
// La règle, maintenant : sans filtre (« toutes » — Achats · Vinted, l'écran d'arrivée qui montre tout), les
// nombres sont ceux de la publication (inchangés : ceux de Ma journée, de la cloche, du widget) ; sous un site,
// les nombres se COMPTENT sur les cartes de la colonne de CE site — les mêmes que la liste, de la même façon
// que `colonnesColis` (une carte `horsCompte` est visible, jamais comptée) et que la carte d'une ville (même
// « d'ici demain » : `jours ≤ 1` ; même « avec code » : un code ou un QR).
// Pas lu (e-mails de suivi pas lus) ⇒ `n: null` (« — »), jamais un 0 inventé ; lu et rien ⇒ `vide: true`, que
// l'écran dit sobrement (« Aucun colis Leboncoin à retirer. »).

export function chiffresRetirer({ site = 'toutes', pub = null, union = null, colRet = null, lu = true } = {}) {
  if (!site || site === 'toutes') {
    const n = pub && Number.isFinite(pub.total) ? pub.total : null;
    const aV = ((union && union.aVerifier) || []).length + ((union && union.aConfirmer) || []).length;
    return { filtre: false, site: 'toutes', n, urgents: pub && Number.isFinite(pub.urgents) ? pub.urgents : 0,
      prets: (union && union.prets) || 0, aVerifier: aV, vide: false };
  }
  const cartes = ((colRet && colRet.cartes) || []).filter(Boolean);
  const cpt = cartes.filter((c) => !c.horsCompte);
  if (!lu) return { filtre: true, site, n: null, urgents: 0, prets: 0, aVerifier: 0, vide: false };
  return {
    filtre: true, site,
    n: cpt.length,
    urgents: cpt.filter((c) => c.jours != null && Number.isFinite(c.jours) && c.jours <= 1).length,
    prets: cpt.filter((c) => !!(c.code || c.qr)).length,
    aVerifier: cartes.length - cpt.length,
    vide: cartes.length === 0,
  };
}

// Un colis « sorti de à retirer » appartient-il au site choisi ? Le site d'un colis est celui que lui donne
// `cartesColis` : un achat Vinted (commande `o`, ou e-mail relié à une commande) ⇒ « vinted » ; un e-mail dont
// le n° de suivi est celui d'un achat d'un autre site (`achatsAutres`, index par n°) ⇒ ce site ; sinon « vinted »
// (la même valeur par défaut que la carte). Jamais par titre ni par lieu.
export function siteDuColisSorti(x, { achatsAutres = null, suiviDe = null } = {}) {
  if (!x) return 'vinted';
  if (x.o) return 'vinted';
  const su = x.t && typeof suiviDe === 'function' ? suiviDe(x.t) : '';
  const aa = su && achatsAutres && typeof achatsAutres.get === 'function' ? achatsAutres.get(su) : null;
  return aa && aa.site ? aa.site : 'vinted';
}
