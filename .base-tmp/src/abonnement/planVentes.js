// ═══════════════════════════════════════════════════════════════════════════
// SOLO / PRO DANS L'APP (9 nov.) — l'état partagé de LA règle des ventes.
// ═══════════════════════════════════════════════════════════════════════════
// La règle vit dans api/_lib/plan-regle.js (la même que le serveur). Ici :
//   · la règle COURANTE, tirée de la dernière réponse du serveur
//     (`publierAbonnement`, src/abonnement/etatAbonnement.js) ;
//   · gardée sur l'appareil (par compte VRM) pour être juste dès l'ouverture
//     suivante (sans « tout compté » une seconde puis retiré) ;
//   · `signaturePlan()` : change QUAND la règle change — la coque remonte l'app
//     sur ce changement (rare : un choix de compte, un passage à Pro), pour que
//     chaque total se recalcule d'un coup (aucun mémo oublié).
// ⚠️ « Pas su » ne bride jamais : réponse illisible ⇒ règle libre.
// ═══════════════════════════════════════════════════════════════════════════
import { regleVentes, venteHorsPlan, signatureRegle, brideAutres } from '../../api/_lib/plan-regle.js';
import { suivreAbonnement, abonnementPublie } from './etatAbonnement.js';

const LIBRE = regleVentes(null);
const cle = (uid) => `vrm_plan_regle_${uid}`;
let _regle = LIBRE, _uid = '';
const _ecoutes = new Set();

// (9 nov., Solo par plateforme) La signature compte AUSSI le compte vendeur de
// Leboncoin, eBay et Vestiaire (`signatureRegle`) : un choix sur l'une d'elles
// remonte l'app comme un choix Vinted.
export const signatureDe = (r) => signatureRegle(r);
export const reglePlanCourante = () => _regle;
export const signaturePlan = () => signatureDe(_regle);
// Le prédicat qu'appellent `compteEcarte` (App.jsx) et les écrans : vrai
// seulement quand c'est SÛR (Solo, compte vendeur choisi, autre compte).
export const venteHorsPlanUid = (uid) => venteHorsPlan(_regle, uid);

function poser(r) {
  const avant = signatureDe(_regle);
  _regle = r && (r.bride || brideAutres(r)) ? r : (r ? { ...LIBRE, plan: r.plan || null } : LIBRE);
  const garde = _regle.bride || brideAutres(_regle);
  if (_uid) { try { garde ? localStorage.setItem(cle(_uid), JSON.stringify({ plan: _regle.plan, compteVendeur: _regle.bride ? _regle.vendeur : null, comptesVendeurs: _regle.autres, comptesSup: _regle.bride ? { liste: _regle.vendeursSup || [] } : null })) : localStorage.removeItem(cle(_uid)); } catch (_) {} }
  if (signatureDe(_regle) !== avant) _ecoutes.forEach((f) => { try { f(_regle); } catch (_) {} });
}

// À l'ouverture (compte VRM connu) : la dernière règle de CET appareil.
export function demarrerPlan(uid) {
  _uid = String(uid || '');
  let lu = null;
  try { lu = JSON.parse(localStorage.getItem(cle(_uid)) || 'null'); } catch (_) { lu = null; }
  poser(lu ? regleVentes(lu) : LIBRE);
  const x = abonnementPublie();
  if (x && typeof x === 'object') poser(regleVentes(x));
}

// Chaque réponse du serveur (une réponse illisible ne change rien : on garde
// la dernière règle sûre plutôt que de « débrider » ou brider sur un hoquet).
suivreAbonnement((x) => { if (x && typeof x === 'object' && x.ok !== false) poser(regleVentes(x)); });

export function suivrePlan(f) { _ecoutes.add(f); return () => _ecoutes.delete(f); }
