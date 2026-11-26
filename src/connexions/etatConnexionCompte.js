// ═══════════════════════════════════════════════════════════════════════════
// « CE COMPTE EST-IL CONNECTÉ ? » — la règle par compte, réutilisable (24 nov., lot connexions-extension)
// ═══════════════════════════════════════════════════════════════════════════
// Règle de Julien (24 nov.) : depuis l'app il fait TOUT (répondre, republier…) seulement si l'extension est connectée
// pour CE compte ; sinon lecture seule. La porte commune `peutAgir(plateforme, compte, capacite)` (branche
// `claude/agir-si-connecte`) lit ICI « connecté, par quel navigateur, à jour ? ». Règle PURE : aucune lecture, aucune langue.
//
// Entrée : les lignes `ext_appareil_*` lues par `requeteConnexions(owner)` (src/connexions/connexions.js, projection),
// `attendue` (EXT_ATTENDUE), `maintenant`. Sortie, pour un compte :
//   { connecte: true | false | null, raison, par: { id, nav, sys, ver, ici } | null, vuAt, aJour: true | false | null, installer }
//   · `connecte: true`  — un navigateur a vu CE compte ouvert dans son onglet il y a moins de CONNECTE_MS (30 min) ;
//   · `connecte: false` — aucun navigateur ne l'a vu depuis 30 min (`raison: 'pas-vu'`, `vuAt` = la dernière fois) ou
//                          jamais (`raison: 'jamais'`) ;
//   · `connecte: null`  — PAS SU (§5 : « pas su » ne vaut pas « oui » — une porte le traite comme NON) : lecture en cours
//                          (`'lecture'`), ratée (`'passu'`), ou site qui ne publie pas ses comptes (Leboncoin, Vestiaire :
//                          `'compte-non-publie'`, `siteVuAt` = le dernier envoi réussi de ce site, tout compte confondu).
//   · `aJour` : la version de l'extension qui l'a vu (`false` ⇒ `installer` = la version à installer ; `null` = pas su).
// Mesuré le 24 nov. : seul Vinted publie ses comptes vus (`vus.vinted = { uid: ms }`) ; Leboncoin/Vestiaire n'ont qu'un
// `flux.{site}.okAt` par navigateur — on n'invente pas le compte.
// ═══════════════════════════════════════════════════════════════════════════
import { navigateurDe, SANTE_DEPUIS } from './connexions.js';

export const CONNECTE_MS = 30 * 60000;   // même seuil que « ouvert ailleurs » de la page Extension (peutFaire.js LU_RECENT_MS)

export function etatConnexionCompte({ site = 'vinted', compte, rows, attendue = '', maintenant = Date.now(), ici = '', depuis = SANTE_DEPUIS } = {}) {
  const vide = (connecte, raison, plus = {}) => ({ connecte, raison, par: null, vuAt: null, aJour: null, installer: '', ...plus });
  if (rows === undefined) return vide(null, 'lecture');
  if (!Array.isArray(rows)) return vide(null, 'passu');
  const navs = rows.map((r) => navigateurDe(r || {}, { attendue, maintenant, ici, depuis })).filter(Boolean);
  if (site !== 'vinted') {
    const cle = site === 'lbc' ? 'leboncoin' : site === 'vc' ? 'vestiaire' : site;
    const at = navs.reduce((m, n) => Math.max(m, (n.sites[cle] && n.sites[cle].at) || 0), 0);
    return vide(null, 'compte-non-publie', { siteVuAt: at || null });
  }
  const uid = String(compte == null ? '' : (typeof compte === 'object' ? compte.id || compte.vinted_user_id || '' : compte));
  if (!/^\d{1,20}$/.test(uid)) return vide(null, 'passu');
  let best = null;
  for (const n of navs) { const x = n.sites.vinted.comptes.find((k) => k.uid === uid); if (x && (!best || x.at > best.at)) best = { n, at: x.at }; }
  if (!best) return vide(false, 'jamais');
  const v = best.n.version;
  const par = { id: best.n.id, nav: best.n.nav, sys: best.n.sys, ver: v.ver, ici: best.n.ici };
  const aJour = v.etat === 'a-jour' ? true : v.etat === 'ancienne' ? false : null;
  const recent = maintenant - best.at < CONNECTE_MS && best.at <= maintenant + 60000;
  return { connecte: recent, raison: recent ? (aJour === false ? 'ancienne' : 'ok') : 'pas-vu', par, vuAt: best.at, aJour, installer: aJour === false ? v.installer : '' };
}
