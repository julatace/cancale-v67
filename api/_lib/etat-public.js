// ── LA PAGE D'ÉTAT PUBLIQUE (vrm.center/etat) : CE QUE LE SERVEUR EN DIT (6 nov.) ──
// Julien (6 nov.) : une page publique qui dit « Tout fonctionne » ou « Panne en
// cours sur … » — la base, la réception des e-mails, les notifications.
// `/api/sante` (api/compte.js) porte cet état dans `etat`, à côté de ses oui/non.
//
// Ce qu'il dit, pour chaque morceau : 'ok' · 'panne' · 'inconnu'.
//   ⚠️ « Pas su » n'est NI une panne NI un feu vert (CLAUDE.md, panneau Sécurité) :
//      une sonde qui n'a pas répondu à cause d'un AUTRE morceau (la base tombée ⇒
//      les e-mails ne se lisent pas) rend 'inconnu', jamais 'ok'.
// Ce qu'il ne dit JAMAIS : une donnée d'un vendeur. Il lit DEUX scalaires de la
// ligne du collecteur (`at`, `etat`, propriétaire NEUTRE : l'installation, pas
// un vendeur) et des variables d'environnement présentes ou non.
//
// LÉGER : une requête courte (deux lignes, deux scalaires projetés, 4 s au plus),
// et la réponse est gardée 30 s en mémoire par instance (`MEMO_MS`) — la page se
// rafraîchit toutes les 60 s chez chaque visiteur, la base n'en voit qu'une par
// 30 s et par instance. La route ajoute `Cache-Control: s-maxage=30`.
import { sbCle } from './cle.js';
import { fetchAvecDelai } from './fetch-delai.js';   // (11 nov.) chaque appel sortant a un délai

export const MEMO_MS = 30 * 1000;
export const SONDE_MS = 4000;
// Le collecteur Gmail passe chaque minute (scripts/gmail-forwarder.gs) : plus de
// 30 min sans passage, il est arrêté. Plus de 7 jours : il n'est plus utilisé
// (la réception passe par le Worker, docs/email-pipeline.md) — on ne sait pas, on
// ne crie pas « panne » sur un outil retiré.
export const COLLECTEUR_ARRETE_MS = 30 * 60 * 1000;
export const COLLECTEUR_RETIRE_MS = 7 * 86400 * 1000;
export const ERREUR_TOLEREE_MS = 15 * 60 * 1000;
const NEUTRE = '00000000-0000-0000-0000-000000000000';
const ms = (v) => { const t = Date.parse(String(v || '')); return Number.isFinite(t) ? t : null; };

// La règle des e-mails, pure : `lignes` = ce que la base a rendu (null = pas lu).
export function etatEmails({ secret, lignes, maintenant = Date.now() }) {
  // Sans la clé de réception, la route refuse TOUT e-mail (api/email-inbound.js,
  // `cleValide` ⇒ 503) : c'est une panne sûre, pas une supposition.
  if (!secret) return 'panne';
  if (!Array.isArray(lignes)) return 'inconnu';
  const passage = lignes.find((l) => l && l.id === 'vrm_email_collecteur_passage') || null;
  const succes = lignes.find((l) => l && l.id === 'vrm_email_collecteur_succes') || null;
  const tP = passage ? ms(passage.at) : null, tS = succes ? ms(succes.at) : null;
  const dernier = Math.max(tP || 0, tS || 0) || null;
  if (!dernier) return 'inconnu';
  const age = maintenant - dernier;
  if (age > COLLECTEUR_RETIRE_MS) return 'inconnu';
  if (age > COLLECTEUR_ARRETE_MS) return 'panne';
  if (passage && passage.etat === 'erreur' && tP && (!tS || tS < tP) && maintenant - (tS || 0) > ERREUR_TOLEREE_MS) return 'panne';
  return 'ok';
}

// L'état complet, sondé. `env` et `fetcher` sont injectés (audit).
export async function sonderEtat({ env = process.env, fetcher = fetchAvecDelai, pushPret = false, anon: anonDefaut = '', maintenant = Date.now() } = {}) {
  const url = env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
  const service = env.SUPABASE_SERVICE_KEY || '';
  const anon = env.SUPABASE_KEY || anonDefaut || '';
  let base = 'inconnu', lignes = null;
  try {
    const chemin = service
      ? `app_data?owner=eq.${NEUTRE}&id=in.(vrm_email_collecteur_passage,vrm_email_collecteur_succes)&select=id,at:data->>at,etat:data->>etat&limit=2`
      : 'app_data?select=id&limit=1';
    const cle = service || anon;
    const r = await fetcher(`${url}/rest/v1/${chemin}`, { headers: cle ? sbCle(cle) : {}, signal: AbortSignal.timeout(SONDE_MS) });
    const j = r.ok ? await r.json().catch(() => null) : null;
    base = r.ok && Array.isArray(j) ? 'ok' : 'panne';
    if (service && Array.isArray(j)) lignes = j;
  } catch (_) { base = 'panne'; }
  const emails = base === 'ok' ? etatEmails({ secret: !!env.EMAIL_INBOUND_SECRET, lignes: service ? lignes : null, maintenant }) : (env.EMAIL_INBOUND_SECRET ? 'inconnu' : 'panne');
  // Les notifications : la clé privée (VAPID) posée ET lisible, et la clé de
  // service (sans elle, la liste des appareils ne se lit pas : rien ne part).
  const notifications = pushPret && service ? 'ok' : 'panne';
  return { base, emails, notifications, verifieA: new Date(maintenant).toISOString() };
}

// La mémoire de 30 s (par instance). `oublierEtat` : pour l'audit.
let memo = null;
export async function etatPublic(opts = {}) {
  const t = opts.maintenant || Date.now();
  if (memo && t - memo.t < MEMO_MS) return memo.v;
  const v = await sonderEtat({ ...opts, maintenant: t });
  memo = { t, v };
  return v;
}
export const oublierEtat = () => { memo = null; };
