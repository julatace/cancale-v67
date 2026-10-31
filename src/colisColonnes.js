// ── COLIS EN QUATRE COLONNES (31 oct., maquette choisie par Julien) ──────────
// « Prêts à imprimer » · « En attente » · « À retirer » · « Partis ».
//
// ⚠️ CE MODULE NE CLASSE RIEN LUI-MÊME. Chaque colis arrive avec la place que
// lui donnent DÉJÀ les règles de l'app (§11) :
//   · une vente à envoyer porte `pret` (la ligne de `expeditions()`, PDF reçu
//     ou capté) ou est cochée postée (`isShipDone`) — groupe `pret` · `attente`
//     · `fait`, le même que les intertitres de la liste ;
//   · eBay : `colisEbay` (à poster · à vérifier · ne pas poster) ;
//   · Vestiaire : `colisVestiaire` (ventes à envoyer) ;
//   · à retirer : `pickupUnion` (e-mails · conversations Vinted · à vérifier ·
//     à confirmer) ;
//   · partis : les ventes que `venteStage` dit en transit, au relais, livrées
//     ou qui reviennent.
// Il range chaque entrée dans UNE colonne, par son `groupe`, et ne jette rien :
// un groupe inconnu (ou absent) part dans « En attente », marqué « à vérifier »
// — « un colis caché est un colis perdu ».
export const COLONNES_COLIS = [
  { cle: 'prets', titre: 'Prêts à imprimer' },
  { cle: 'attente', titre: 'En attente' },
  { cle: 'retirer', titre: 'À retirer' },
  { cle: 'partis', titre: 'Partis' },
];
const COLONNE_DU_GROUPE = {
  pret: 'prets',
  attente: 'attente', ebay: 'attente', vestiaire: 'attente',
  retirer: 'retirer',
  fait: 'partis', parti: 'partis',
};
export const SITES_COLIS = ['vinted', 'leboncoin', 'ebay', 'vestiaire'];

// cartes : [{ cle, groupe, site, ... }] → { colonnes: [{cle, titre, cartes}], total, parSite }
// `site` : 'toutes' ou l'un de SITES_COLIS (choisi par lui : un filtre visible,
// jamais un tri silencieux — le total « sur N » reste dit à côté).
export function colonnesColis(cartes, site = 'toutes') {
  const vues = new Set();
  const colonnes = COLONNES_COLIS.map((c) => ({ ...c, cartes: [] }));
  const par = Object.fromEntries(colonnes.map((c) => [c.cle, c]));
  const parSite = {};
  let total = 0;
  for (const x of (Array.isArray(cartes) ? cartes : [])) {
    if (!x) continue;
    const cle = String(x.cle || '');
    // La même ligne vue deux fois (même identité) n'est comptée qu'une fois.
    if (cle && vues.has(cle)) continue;
    if (cle) vues.add(cle);
    total++;
    const s = SITES_COLIS.includes(x.site) ? x.site : 'vinted';
    parSite[s] = (parSite[s] || 0) + 1;
    if (site !== 'toutes' && s !== site) continue;
    const col = COLONNE_DU_GROUPE[x.groupe];
    if (col) par[col].cartes.push(x);
    else par.attente.cartes.push({ ...x, aVerifier: true, etat: x.etat || 'à vérifier' });
  }
  return { colonnes, total, parSite };
}
