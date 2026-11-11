// ════════════════════════════════════════════════════════════════════════════
//  « PAS À PAS » D'UN RETOUR OU D'UN LITIGE SUR UNE VENTE (11 nov., lot retours-litiges)
// ════════════════════════════════════════════════════════════════════════════
// Ce que la feuille dit, en codes (l'écran les dit par tr()). Rien n'est redécidé :
//   · la carte vient de src/litigesEcran.js (la vente est en retour / litige seulement si
//     PROUVÉ : transaction 440/430 ou e-mail relié par SA conversation, src/litiges.js) ;
//   · l'étape du colis de retour vient de src/retoursStock.js (`retoursEnCours`).
// Les délais portent TOUJOURS leur source : la date limite LUE (e-mail Vinted, eBay
// `respondByDate`), sinon « pas écrite » ; la règle des 2 jours est le texte de Vinted
// mesuré dans ses e-mails de retour (« dans les 2 jours qui suivent la réception de la
// commande par le vendeur, à moins qu'il ne signale un problème »). Jamais une date
// calculée présentée comme lue.
// « Paire revenue » : SON clic ⇒ la remise en stock existante (`remiseEnStock`, SON N°,
// jamais un nouveau) — possible seulement quand le retour est relié à un N° par identité.
// « Pas la bonne paire / abîmée » : le lien vers la conversation (signaler AVANT le
// remboursement). Module PUR, exécuté par scripts/audit-retours-litiges.cjs.

const str = (v) => String(v == null ? '' : v);
export const SIGNALER_JOURS_VINTED = 2;

export function pasAPasVente(c, { retour = null } = {}) {
  if (!c) return null;
  const vinted = (c.plateforme || 'vinted') === 'vinted';
  const src = str(c.source);
  const preuve = c.plateforme === 'ebay' ? 'ebay'
    : src === 'email' ? 'email' : src === 'commande+email' ? 'commande+email' : 'transaction';
  const delais = [];
  delais.push(c.limiteTexte
    ? { quoi: 'repondre', quand: c.limiteTexte, source: c.plateforme === 'ebay' ? 'ebay' : 'email' }
    : { quoi: 'repondre', quand: null, source: 'non-ecrite' });
  if (vinted && (c.genre === 'retour' || retour)) delais.push({ quoi: 'verifier', quand: null, jours: SIGNALER_JOURS_VINTED, source: 'regle-vinted' });
  let etape = 'attendre';
  if (retour && retour.remis) etape = 'fait';
  else if (retour && retour.recu) etape = 'recu';
  else if (retour && retour.etape === 'rembourse') etape = 'rembourse';
  else if (retour && retour.etape === 'en-route') etape = 'recevoir';
  else if (!retour) etape = 'repondre';
  // « Paire revenue » : un retour suivi, relié à un N° par identité, pas déjà remis.
  let revenue;
  if (!retour) revenue = { possible: false, raison: 'pas-de-colis' };
  else if (retour.remis) revenue = { possible: false, raison: 'deja-remise', num: str(retour.remis.num || retour.num) };
  else if (!str(retour.num).trim()) revenue = { possible: false, raison: 'sans-numero' };
  else revenue = { possible: true, num: str(retour.num).trim() };
  const url = c.geste && c.geste.url ? c.geste.url : '';
  return { preuve, delais, etape, revenue, contester: url ? { url } : null,
    preuves: { carton: (c.preuves && c.preuves.carton && c.preuves.carton.etat) || 'aucun', bordereau: (c.preuves && c.preuves.bordereau && c.preuves.bordereau.etat) || 'aucun' } };
}
