// ── SOLO / PRO CÔTÉ SERVEUR : LA VENTE D'UN COMPTE HORS OFFRE SONNE-T-ELLE ? ──
// (9 nov.) En Solo, seules les ventes du compte vendeur CHOISI comptent ; les
// notifications de vente des autres comptes ne partent pas. La RÈGLE est celle
// de l'app (api/_lib/plan-regle.js, importée telle quelle — jamais une copie) ;
// ici on lit seulement ce que le webhook Stripe a rangé dans la ligne
// `abonnements` du vendeur (colonnes `plan` et `compte_vendeur`, migration 028).
//
// ⚠️ « PAS SU » NE COUPE RIEN : clé de service absente, base injoignable,
//    migration 028 pas passée (colonne absente), abonnement pas vivant ⇒ la
//    notification part, comme avant. Couper une vente du compte vendeur parce
//    que la base a hoqueté lui ferait rater une vente.
// ⚠️ (9 nov., suites serveur) LE PROPRIÉTAIRE DE L'INSTALLATION est Pro, toujours
//    (comme l'app : `regleVentes({ proprietaire: true })`, `api/compte.js` mode
//    abonnement) — même si une ligne `abonnements` disait Solo. Sa désignation
//    (`proprietaireInstallation`, api/_lib/signalement.js) illisible ⇒ on lit la
//    ligne comme pour tout vendeur (elle seule peut brider).
// Lecteurs : notifications de vente (api/email-inbound.js), bilans de la semaine
// et du mois, rappel des offres au prix mini (api/ship-reminders.js), widget
// (api/widget.js) — la RÈGLE appliquée est `compteEcarte` (api/_lib/ventes-regle.js,
// copie refabriquée d'App.jsx) ou `venteHorsPlan` (api/_lib/plan-regle.js).
import { sbCle } from './cle.js';
import { regleVentes, venteHorsPlan } from './plan-regle.js';
import { proprietaireInstallation } from './signalement.js';
import { fetchAvecDelai } from './fetch-delai.js';   // (11 nov.) chaque appel sortant a un délai

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VIVANTS = new Set(['active', 'trialing', 'past_due']);
const TTL_MS = 60 * 1000;
const memo = new Map();

// La règle des ventes du vendeur (`regleVentes`), ou `null` (pas su).
export async function regleDuVendeur(owner) {
  if (!owner || !UUID.test(String(owner))) return null;
  const SERVICE = process.env.SUPABASE_SERVICE_KEY || '';
  if (!SERVICE) return null;
  const vu = memo.get(owner);
  if (vu && Date.now() - vu.t < TTL_MS) return vu.v;
  let v = null;
  try {
    const proprio = await proprietaireInstallation();
    if (proprio && proprio === String(owner).toLowerCase()) {
      v = regleVentes({ proprietaire: true });
      if (memo.size > 1000) memo.clear();
      memo.set(owner, { v, t: Date.now() });
      return v;
    }
    // (9 nov., Solo par plateforme) + `comptes_vendeurs` (migration 030) : le compte vendeur
    // de Leboncoin, eBay, Vestiaire. 030 absente (colonne inconnue) ⇒ relu SANS elle : la règle
    // Vinted s'applique comme avant, les autres plateformes sont « pas su » (rien bridé).
    const lire = (cols) => fetchAvecDelai(`${SUPABASE_URL}/rest/v1/abonnements?owner=eq.${encodeURIComponent(owner)}&select=${cols}&limit=1`, { headers: sbCle(SERVICE) });
    let r = await lire('statut,plan,compte_vendeur,comptes_vendeurs');
    if (!r.ok && r.status === 400) r = await lire('statut,plan,compte_vendeur');
    if (!r.ok) return null;                          // 028 absente : colonne inconnue ⇒ pas su
    const j = await r.json();
    if (!Array.isArray(j)) return null;
    const l = j[0];
    v = l && VIVANTS.has(String(l.statut || '')) ? regleVentes({ plan: l.plan, compteVendeur: l.compte_vendeur, comptesVendeurs: l.comptes_vendeurs }) : regleVentes(null);
  } catch (_) { return null; }
  if (memo.size > 1000) memo.clear();
  memo.set(owner, { v, t: Date.now() });
  return v;
}

// Vrai seulement quand c'est SÛR : Solo, compte vendeur choisi, et ce compte
// (son `vinted_user_id`) n'est pas le compte vendeur.
export async function venteHorsPlanServeur(owner, uid) {
  const r = await regleDuVendeur(owner);
  return venteHorsPlan(r, uid);
}

export const oublierPlans = () => memo.clear();
