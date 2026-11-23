// ════════════════════════════════════════════════════════════════════════════
//  LA FRISE D'UNE VENTE ET LE TRANSPORTEUR (17 nov.) — Julien : « ça met livré il y a deux jours mais à côté la barre de
//  progression avance pas ». La frise (Déposé · En transit · Livré · Validé) ne lisait que Vinted, la phrase dessous
//  (`dernierStatut`, api/_lib/suivi-commandes.js) lisait le transporteur : deux sources, deux réponses.
//  RÈGLE (décidée les 12–13 nov. : « le transporteur tranche les contradictions ») — module pur, la même pour les deux designs :
//    · une preuve n'est JAMAIS retirée : chaque étape = Vinted OU le transporteur OU l'e-mail du MÊME n° de suivi (on ne
//      recule pas sur une lecture plus vieille) ;
//    · « En transit » : le transporteur l'a pris en charge (en_route, sauf une étiquette seulement créée) ou plus loin ;
//    · « Livré » : déposé au relais de l'acheteur (`disponible`), retiré ou livré — lu chez le transporteur, ou l'e-mail
//      « arrivé au relais » / « livré » du même n° ;
//    · « Validé » : SEULEMENT Vinted (la commande finalisée) — jamais déduit du transporteur ;
//    · un retour ou un incident ne fait avancer aucune étape.
//  Le mot et la date de l'étape viennent de `dernierStatut` (la MÊME source que la phrase sous la frise).
// ════════════════════════════════════════════════════════════════════════════
const ms = (v) => { if (v == null || v === '') return null; if (typeof v === 'number') return Number.isFinite(v) ? v : null; const t = Date.parse(String(v)); return Number.isFinite(t) ? t : null; };
const LIVRE_T = new Set(['disponible', 'retire', 'livre']);
const LIVRE_E = new Set(['available', 'delivered']);

// `transporteur` : la ligne lue chez le transporteur (`etat`, `detail`, `lu`, `derAt`) ; `email` : { status, receivedAt }.
export function preuvesTransporteur({ transporteur = null, email = null } = {}) {
  const t = transporteur && typeof transporteur === 'object' && ms(transporteur.lu) != null ? transporteur : null;
  const e = email && typeof email === 'object' && ms(email.receivedAt) != null ? email : null;
  const livreT = !!(t && LIVRE_T.has(t.etat));
  const livreE = !!(e && LIVRE_E.has(e.status));
  const bougeT = livreT || !!(t && t.etat === 'en_route' && t.detail !== 'prepare');
  const bougeE = livreE || !!(e && e.status === 'transit');
  return {
    bouge: bougeT || bougeE,
    livre: livreT || livreE,
    livreAt: livreT ? (ms(t.derAt) ?? ms(t.etatAt)) : livreE ? ms(e.receivedAt) : null,
    source: livreT || bougeT ? 'transporteur' : (livreE || bougeE) ? 'email' : null,
  };
}

// Fusionne les preuves de Vinted et du transporteur, sans jamais reculer.
export function fusionnerPreuves(vinted = {}, tr = {}) {
  const livre = !!(vinted.livre || tr.livre);
  return { bouge: !!(vinted.bouge || tr.bouge || livre), livre, valide: !!vinted.valide, livreAt: vinted.livre ? (vinted.livreAt ?? null) : (tr.livreAt ?? null),
    parTransporteur: !vinted.livre && !!tr.livre };
}
