// api/_lib/appel-bienvenue.js
// ════════════════════════════════════════════════════════════════════════════
// L'APPEL DE BIENVENUE DE 15 MIN (14 nov., idée d'accueil 147) — côté serveur.
// Julien range son lien de réservation dans SA ligne `main` (Paramètres → Aide,
// `vrm_appel_bienvenue` = { lien, at }). Un autre vendeur ne peut pas lire cette
// ligne (RLS) : la route `mode=abonnement` la relit ICI, avec la clé de service, en
// PROJETANT le seul champ (`data->vrm_appel_bienvenue->>lien`, jamais `select=data`),
// et ne rend le lien qu'à un compte dont le plan LU chez Stripe est « pro ».
// Trois états : '' (rien à montrer : pas Pro, pas de lien, lien refusé) · le lien ·
// jamais d'erreur visible (« pas su » ⇒ '' : un appel en moins ne coûte rien).
// Aucun service payant : un lien, c'est tout.
// ════════════════════════════════════════════════════════════════════════════
import { sbCle } from './cle.js';
import { fetchAvecDelai } from './fetch-delai.js';

const LIEN_MAX = 300;
// <appel-lien-regle> — recopié TEL QUEL depuis src/accueilReste/appelBienvenue.js.
// Un lien https:// vers un hôte public (pas d'adresse IP, pas de localhost, pas
// d'identifiants dans l'adresse), 300 caractères au plus ; sinon '' (rien n'apparaît).
export function lienReservation(v) {
  const s = String(v == null ? '' : v).trim();
  if (!s || s.length > LIEN_MAX || /[\s"'<>\\]/.test(s)) return '';
  let u;
  try { u = new URL(s); } catch (_) { return ''; }
  if (u.protocol !== 'https:' || u.username || u.password || u.port) return '';
  const h = u.hostname.toLowerCase();
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(h) || /^\d+(\.\d+)+$/.test(h) || h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) return '';
  return u.href;
}
// </appel-lien-regle>

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Le lien à rendre à CE compte. `plan` : le plan lu chez Stripe ('pro' seulement) ;
// `proprio` : l'uid du propriétaire de l'installation (`proprietaireInstallation`) ;
// `proprietaire` : le compte qui demande EST le propriétaire (il n'en a pas besoin).
export async function lienAppelPour({ plan, proprietaire = false, proprio, env = process.env, fetcher = fetchAvecDelai } = {}) {
  if (plan !== 'pro' || proprietaire === true) return '';
  const owner = String(proprio || '').toLowerCase();
  if (!UUID.test(owner)) return '';
  const url = env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
  const service = env.SUPABASE_SERVICE_KEY || '';
  if (!service) return '';
  try {
    const r = await fetcher(`${url}/rest/v1/app_data?owner=eq.${encodeURIComponent(owner)}&id=eq.main&select=l:data->vrm_appel_bienvenue->>lien&limit=1`, { headers: sbCle(service) });
    if (!r.ok) return '';
    const j = await r.json().catch(() => null);
    return Array.isArray(j) && j[0] ? lienReservation(j[0].l) : '';
  } catch (_) { return ''; }
}
