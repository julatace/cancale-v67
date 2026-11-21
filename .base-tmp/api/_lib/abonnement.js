// ── CE VENDEUR A-T-IL ENCORE ACCÈS ? ─────────────────────────────────────────
// Julien (4 octobre) : « la personne ne doit plus recevoir de notifications,
// voir ses données, etc. lorsqu'elle ne paye plus ».
//
// ⚠️ LA RÈGLE N'EST PAS ICI : elle vit dans la base (`vrm_regle_acces`,
//    supabase/migrations/006-acces-abonnement.sql), et c'est la MÊME qui ferme
//    les lignes du vendeur (RLS) et qui décide de l'écran de l'app (`vrm_acces`).
//    Une seconde copie en JavaScript finirait par ne plus dire la même chose
//    (§11) — un vendeur coupé à l'écran mais encore notifié, ou l'inverse.
//
// Rend `true` (accès), `false` (coupé), ou `null` (pas su : base injoignable,
// clé de service absente). ⚠️ « Pas su » NE COUPE PAS : couper un vendeur qui
// paie parce que la base a hoqueté lui ferait rater une vente. Le verrou qui
// compte — ses données — est tenu par la base elle-même, pas par cette lecture.
import { sbCle } from './cle.js';
import { fetchAvecDelai } from './fetch-delai.js';   // (11 nov.) chaque appel sortant a un délai

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Une minute de mémoire par instance : un rappel d'expédition qui pousse trois
// notifications ne pose pas trois fois la question. Un abonnement qui change
// est vu au plus une minute plus tard.
// (11 nov., B136) un « oui » ne se garde que 15 s : un abonnement coupé ne garde
// pas l'accès une minute par instance. Un « non » se garde la minute.
const TTL_MS = 60 * 1000;
const TTL_OUI_MS = 15 * 1000;
const memo = new Map();

export async function accesVendeur(owner) {
  if (!owner || !UUID.test(String(owner))) return null;
  const SERVICE = process.env.SUPABASE_SERVICE_KEY || '';
  if (!SERVICE) return null;
  const vu = memo.get(owner);
  if (vu && Date.now() - vu.t < (vu.v ? TTL_OUI_MS : TTL_MS)) return vu.v;
  try {
    const r = await fetchAvecDelai(`${SUPABASE_URL}/rest/v1/rpc/vrm_acces_pour`, {
      method: 'POST',
      headers: { ...sbCle(SERVICE), 'Content-Type': 'application/json' },
      body: JSON.stringify({ u: owner }),
    }, 5000);   // (11 nov., M45) appelée à CHAQUE notification : 5 s au plus
    if (!r.ok) return null;
    const v = await r.json();
    if (typeof v !== 'boolean') return null;          // un 522 renvoie du HTML
    // (11 nov., M90) éviction de la PLUS ANCIENNE entrée, jamais tout le cache d'un coup
    // (toutes les requêtes suivantes refaisaient la RPC en même temps).
    memo.delete(owner);
    if (memo.size >= 1000) memo.delete(memo.keys().next().value);
    memo.set(owner, { v, t: Date.now() });
    return v;
  } catch (_) { return null; }
}

// Pour les bancs : repartir d'une mémoire vide entre deux scénarios.
export const oublierAcces = () => memo.clear();
