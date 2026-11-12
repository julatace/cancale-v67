// ── « PAIRE » OU « ARTICLE » DANS CE QUE LE SERVEUR ÉCRIT (11 nov., lot vocabulaire-article) ──
// Les notifications, « Ma semaine », les erreurs d'eBay et les e-mails envoyés par VRM
// disent « paire » à un vendeur de sneakers (Julien) et « article » à tous les autres.
// Une source : la règle de l'app (src/profilVendeur.js, importée telle quelle, comme
// d'autres règles pures : src/enLigneLbc.js, src/favorisVinted.js…). Ce que le vendeur
// vend se lit dans SA ligne `main` (`vrm_je_vends`, synchronisée par l'app) ;
// « automatique » ⇒ Sneakers pour le propriétaire de l'installation (VRM_OWNER_UID),
// « article » pour les autres — la même règle que `jeVendsEffectif` côté app.
// Pas su (ligne illisible) ⇒ le défaut du vendeur (jamais une erreur, jamais un envoi bloqué).
import { motsArticle, jeVendsEffectif } from '../../src/profilVendeur.js';

export const MAIN_MOTS = 'vrm_je_vends';
// `owner` : l'uid du vendeur ; `env` : process.env (injectable par un banc).
export function vendServeur(jeVends, owner, env = process.env) {
  const proprio = String((env && env.VRM_OWNER_UID) || '').trim();
  // Sans vendeur nommé, une installation à UN vendeur parle au propriétaire (api/_lib/owner.js).
  const o = String(owner || proprio || '').trim();
  return jeVendsEffectif(jeVends, { proprietaire: proprio && o ? o === proprio : null }).vend;
}
export const motsServeur = (jeVends, owner, env) => motsArticle(vendServeur(jeVends, owner, env));

// Le mot de la REQUÊTE en cours (une route qui sert le vendeur connecté, ex. api/ebay.js) :
// posé une fois après la session (`poserMotsRequete`), lu par chaque phrase d'erreur.
// AsyncLocalStorage, comme le vendeur de la requête (api/_lib/owner.js) : une instance
// sert plusieurs requêtes en parallèle. Rien de posé ⇒ les mots de Sneakers (le texte d'avant).
import { AsyncLocalStorage } from 'node:async_hooks';
const motsRequete = new AsyncLocalStorage();
export const motsCourants = () => motsRequete.getStore() || motsArticle('sneakers');
// `texte` : la valeur brute de `data->>vrm_je_vends` (JSON en texte), `undefined`/'' = pas su / absente.
export function poserMotsRequete(texte, owner, env) {
  let jv = null;
  try { jv = texte ? JSON.parse(texte) : null; } catch (_) { jv = null; }
  const m = motsServeur(jv, owner, env);
  motsRequete.enterWith(m);
  return m;
}
