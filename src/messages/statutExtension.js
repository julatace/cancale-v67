// ═══════════════════════════════════════════════════════════════════════════
// LE STATUT DE L'EXTENSION, VRAI ET DATÉ — dans Messages (28 nov., messages-parfaits)
// ═══════════════════════════════════════════════════════════════════════════
// Julien (28 nov.) : le statut « connectée / pas connectée / compte de l'onglet » est « parfois faux ». Causes trouvées :
//   1. l'état du pont n'avait PAS DE DATE : un battement sauté (onglet caché, service worker endormi, un raté isolé que
//      `battementExt` ne compte pas encore) laissait l'app redire le DERNIER état comme s'il était actuel — « compte de
//      l'onglet » sur un onglet Vinted fermé depuis des minutes ;
//   2. deux règles disaient la même chose : l'intertitre « Compte de l'onglet » lisait le pont (cookie de l'onglet), la
//      pastille « Lecture seule » lisait la porte (`peutAgir`, présences en base relues toutes les 45 s) — le même compte
//      pouvait porter les deux à la fois ;
//   3. l'ouverture de Messages ne revérifiait rien : elle croyait le battement d'il y a 20 s (ou plus).
// La règle ci-dessous, PURE (aucune lecture, aucun rendu, aucune langue), tire de LA même source que la porte (les faits
// de src/agir/porte.js, `etatNavigateur` de la page Extension — §11) et de l'heure de la dernière réponse du pont, TROIS
// états, plus « on vérifie » :
//   · 'ok'          — connectée, à jour, branchée à CE compte VRM, et un compte Vinted relié ouvert dans son onglet ;
//   · 'ecart'       — elle répond, mais quelque chose diffère : version (plus ancienne que celle que VRM sert), autre compte
//                     VRM, deux extensions, code périmé, aucun onglet Vinted / un compte non relié / cookie pas lu ;
//   · 'injoignable' — rien ne répond ici (absente, muette, autre navigateur, téléphone sans ordinateur) ou la dernière
//                     réponse a plus de `VIEUX_MS` ;
//   · 'verif'       — la première réponse n'est pas encore là (« pas su » ne vaut ni oui ni non, §5).
// Rend { etat, code, cle, vars, at, compte } ; `cle` : une phrase traduite (`ext.nav.*` existantes, `mparf.statut.*`).
// Exécuté par scripts/audit-statut-extension.cjs et le banc messages-parfaits.
import { etatNavigateur } from '../extension/peutFaire.js';

export const VIEUX_MS = 75000;   // trois battements manqués (20 s chacun) + la marge d'une revérification

const ECART_NAV = new Set(['maj', 'retard', 'plusieurs', 'perime', 'vrm', 'vrm-passu', 'autre-vrm', 'telephone-retard']);
const INJOIGNABLE_NAV = new Set(['absente', 'ailleurs', 'muette', 'telephone', 'telephone-eteint']);

export function statutExtension({ faits = null, at = 0, essai = 0, maintenant = Date.now(), comptes = {} } = {}) {
  if (!faits || typeof faits !== 'object') return { etat: 'verif', code: 'verif', cle: 'ext.nav.verif', vars: {}, at: 0, compte: '' };
  let nav;
  try { nav = etatNavigateur({ ...faits, maintenant }); } catch (_) { nav = { code: 'verif', cle: 'ext.nav.verif', vars: {} }; }
  const datee = Number(at) > 0 ? Number(at) : 0;
  const base = { at: datee, compte: '' };
  if (nav.code === 'telephone-relais') {
    const rl = faits.relais || {}; const v = rl.vinted || null;
    const nom = v && v.uid != null ? (comptes[String(v.uid)] || v.login || '') : '';
    return { ...base, etat: 'ok', code: 'relais', cle: nom ? 'mparf.statut.relais' : 'ext.nav.telephoneRelais', vars: { compte: nom, ou: rl.ou || '' }, compte: v && v.uid != null ? String(v.uid) : '' };
  }
  if (nav.code === 'verif' || nav.code === 'vrm-encours') {
    // Une première réponse jamais venue après un essai de plus de 10 s n'est plus « on vérifie » : rien ne répond.
    if (Number(essai) > 0 && !datee && maintenant - Number(essai) > 10000 && nav.code === 'verif') return { ...base, etat: 'injoignable', code: 'sans-reponse', cle: 'mparf.statut.sansReponse', vars: {} };
    return { ...base, etat: 'verif', code: nav.code, cle: nav.cle, vars: nav.vars || {} };
  }
  if (INJOIGNABLE_NAV.has(nav.code)) return { ...base, etat: 'injoignable', code: nav.code, cle: nav.cle, vars: nav.vars || {} };
  // Elle a répondu : depuis quand ? Une réponse trop vieille ne dit plus rien de l'onglet.
  if (!datee || maintenant - datee > VIEUX_MS) return { ...base, etat: 'injoignable', code: 'ancien', cle: 'mparf.statut.ancien', vars: { s: datee ? Math.round((maintenant - datee) / 1000) : 0 } };
  if (ECART_NAV.has(nav.code)) return { ...base, etat: 'ecart', code: nav.code, cle: nav.cle, vars: nav.vars || {} };
  if (nav.code !== 'ok') return { ...base, etat: 'ecart', code: nav.code || 'autre', cle: nav.cle || 'mparf.statut.autre', vars: nav.vars || {} };
  const et = (faits.ext && faits.ext.etat) || {};
  if (et.vintedPasSu) return { ...base, etat: 'ecart', code: 'onglet-passu', cle: 'mparf.statut.ongletPasSu', vars: {} };
  const v = et.vinted || null;
  if (!v || !v.uid) return { ...base, etat: 'ecart', code: 'sans-onglet', cle: 'mparf.statut.sansOnglet', vars: {} };
  const uid = String(v.uid);
  if (!Object.prototype.hasOwnProperty.call(comptes || {}, uid)) return { ...base, etat: 'ecart', code: 'compte-non-relie', cle: 'mparf.statut.nonRelie', vars: { autre: String(v.login || '') }, compte: uid };
  return { ...base, etat: 'ok', code: 'ok', cle: 'mparf.statut.ok', vars: { compte: comptes[uid] || String(v.login || ''), version: String((faits.ext && faits.ext.version) || '') }, compte: uid };
}
export default statutExtension;
