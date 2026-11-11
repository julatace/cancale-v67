// ═══════════════════════════════════════════════════════════════════════════
// LE PARRAINAGE (8 nov., « abonnement propre ») — un mois offert au filleul ET
// au parrain quand le filleul paie son premier mois.
// ═══════════════════════════════════════════════════════════════════════════
// LA RÈGLE (écrite aussi dans les CGV, article 2 bis) :
//   · un lien personnel `https://vrm.center/r/CODE` (8 signes ; redirigé vers
//     `/?parrain=CODE`, vercel.json — l'ancienne forme reste lue) ;
//   · le filleul est un compte VRM NEUF : inscrit depuis moins de 30 jours,
//     jamais client Stripe, n'ayant jamais consommé d'essai gratuit (même
//     registre que l'essai, 022 : par e-mail ET par compte Vinted) ;
//   · pas soi-même (même compte, ou un compte Vinted en commun ; et, au premier
//     paiement, la même CARTE chez Stripe — empreinte `card.fingerprint`, 11 nov.) ;
//   · UNE fois par filleul (clé primaire) ; au plus 12 mois offerts par
//     parrain sur 365 jours ;
//   · la récompense part au PREMIER paiement réel du filleul (facture payée,
//     montant > 0 — jamais la facture à 0 € de l'essai) : un crédit de
//     16,99 € (le prix d'un mois des CGV) sur le solde client Stripe de chacun,
//     déduit automatiquement de sa prochaine facture. Un parrain sans client
//     Stripe (jamais abonné) garde son mois EN ATTENTE, crédité dès qu'il en a un.
//   · ÉTEINT par défaut : `vrm_reglages.parrainage` = '1' l'ouvre (geste de
//     Julien). Éteint : le lien et le suivi existent, rien n'est rattaché ni
//     crédité, et l'écran le dit.
// ⚠️ Idempotent deux fois : la ligne garde la date de chaque crédit, ET chaque
//    crédit Stripe porte `metadata[vrm_parrainage]` (relu avant d'en créer un),
//    plus une clé d'idempotence. Un webhook rejoué ne double rien.
// ⚠️ Rien ne sort sur les filleuls : l'écran reçoit des NOMBRES.
// Tables : supabase/migrations/027-abonnement-lecture-et-parrainage.sql.
// ═══════════════════════════════════════════════════════════════════════════
import crypto from 'crypto';
import { sbCle } from './cle.js';
import { stripeApi, stripePret } from './stripe.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const ALPHABET_CODE = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_RE = /^[A-HJ-NP-Z2-9]{8}$/;
export const FILLEUL_MAX_JOURS = 30;
export const PARRAIN_MAX_AN = 12;
const service = () => process.env.SUPABASE_SERVICE_KEY || '';
const h = () => ({ ...sbCle(service()), 'Content-Type': 'application/json' });

export function nouveauCode(octets = crypto.randomBytes(8)) {
  let c = '';
  for (let i = 0; i < 8; i++) c += ALPHABET_CODE[octets[i] % ALPHABET_CODE.length];
  return c;
}

async function lireJson(url) {
  try {
    const r = await fetch(url, { headers: sbCle(service()) });
    if (!r.ok) return undefined;
    const j = await r.json();
    return Array.isArray(j) ? j : undefined;
  } catch (_) { return undefined; }
}

// '1' ouvert · '0' fermé · `null` pas su (table de réglages illisible).
export async function parrainageOuvert() {
  if (!service()) return null;
  const j = await lireJson(`${SUPABASE_URL}/rest/v1/vrm_reglages?cle=eq.parrainage&select=valeur`);
  if (!j) return null;
  return !!(j[0] && j[0].valeur === '1');
}

// Le code du vendeur (créé à la première demande). `undefined` = pas su / pas installé.
export async function codeDe(owner) {
  if (!service() || !UUID.test(String(owner || ''))) return undefined;
  const j = await lireJson(`${SUPABASE_URL}/rest/v1/parrainage_codes?owner=eq.${encodeURIComponent(owner)}&select=code`);
  if (!j) return undefined;
  if (j[0] && CODE_RE.test(j[0].code)) return j[0].code;
  for (let essai = 0; essai < 4; essai++) {
    const code = nouveauCode();
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/parrainage_codes?on_conflict=owner`, {
        method: 'POST', headers: { ...h(), Prefer: 'resolution=ignore-duplicates,return=minimal' },
        body: JSON.stringify([{ owner, code }]),
      });
      if (r.ok) {
        const relu = await lireJson(`${SUPABASE_URL}/rest/v1/parrainage_codes?owner=eq.${encodeURIComponent(owner)}&select=code`);
        return relu && relu[0] && CODE_RE.test(relu[0].code) ? relu[0].code : undefined;
      }
      // 23505 sur `code` : collision (une chance sur 10¹²) ⇒ un autre tirage.
    } catch (_) { return undefined; }
  }
  return undefined;
}

// Le suivi du parrain : des NOMBRES, jamais qui.
// (11 nov.) `refus` (037) : lu s'il existe ; la 037 pas passée ⇒ relu sans (jamais « pas installé » pour ça).
async function lireLignes(filtre, champs) {
  const avec = await lireJson(`${SUPABASE_URL}/rest/v1/parrainages?${filtre}&select=${champs},refus`);
  if (avec) return avec;
  return lireJson(`${SUPABASE_URL}/rest/v1/parrainages?${filtre}&select=${champs}`);
}
export async function suiviDe(owner) {
  const j = await lireLignes(`parrain=eq.${encodeURIComponent(owner)}`, 'paye_le,credit_parrain_le');
  if (!j) return undefined;
  return {
    inscrits: j.length,
    payes: j.filter((x) => x.paye_le).length,
    moisOfferts: j.filter((x) => x.credit_parrain_le).length,
    enAttente: j.filter((x) => x.paye_le && !x.credit_parrain_le && !x.refus).length,
  };
}
export async function filleulDe(owner) {
  const j = await lireJson(`${SUPABASE_URL}/rest/v1/parrainages?filleul=eq.${encodeURIComponent(owner)}&select=paye_le,credit_filleul_le`);
  if (!j) return undefined;
  return j[0] ? { parraine: true, moisOffert: !!j[0].credit_filleul_le } : { parraine: false, moisOffert: false };
}

// ── RATTACHER UN FILLEUL ────────────────────────────────────────────────────
// `ctx` = ce que la route sait du VENDEUR CONNECTÉ (jamais du corps) :
//   { u: {id, email, created_at}, ligne (sa ligne d'abonnement), idsVinted,
//     essaiDeja (true/false/null) }.
// Rend { ok, code?, raison?, message? } — la raison est un mot (les bancs la lisent).
export async function rattacher(code, ctx, maintenant = Date.now()) {
  const c = String(code || '').trim().toUpperCase();
  if (!CODE_RE.test(c)) return { ok: false, http: 400, raison: 'code', message: 'Ce lien de parrainage est incomplet.' };
  const ouvert = await parrainageOuvert();
  if (ouvert === null) return { ok: false, http: 503, raison: 'pas-su', message: 'Parrainage pas vérifié. Réessaie dans un instant.' };
  if (!ouvert) return { ok: false, http: 409, raison: 'ferme', message: "Le parrainage n'est pas encore ouvert." };
  const u = ctx && ctx.u;
  if (!u || !UUID.test(String(u.id || ''))) return { ok: false, http: 401, raison: 'session' };
  const proprio = await lireJson(`${SUPABASE_URL}/rest/v1/parrainage_codes?code=eq.${encodeURIComponent(c)}&select=owner`);
  if (!proprio) return { ok: false, http: 503, raison: 'pas-su', message: 'Parrainage pas vérifié. Réessaie dans un instant.' };
  const parrain = proprio[0] && proprio[0].owner;
  if (!parrain) return { ok: false, http: 404, raison: 'inconnu', message: "Ce lien de parrainage n'existe pas." };
  if (String(parrain) === String(u.id)) return { ok: false, http: 400, raison: 'soi-meme', message: 'Tu ne peux pas être ton propre parrain.' };
  const cree = Date.parse(u.created_at || '');
  if (!Number.isFinite(cree) || maintenant - cree > FILLEUL_MAX_JOURS * 86400000) return { ok: false, http: 409, raison: 'ancien', message: 'Le parrainage est réservé aux comptes VRM créés depuis moins de 30 jours.' };
  if (ctx.ligne === undefined || ctx.essaiDeja === null || ctx.essaiDeja === undefined) return { ok: false, http: 503, raison: 'pas-su', message: 'Parrainage pas vérifié. Réessaie dans un instant.' };
  if (ctx.ligne && ctx.ligne.client_stripe) return { ok: false, http: 409, raison: 'deja-client', message: 'Le parrainage est réservé à un premier abonnement.' };
  if (ctx.essaiDeja === true) return { ok: false, http: 409, raison: 'deja-essaye', message: 'Le parrainage est réservé à un premier abonnement.' };
  // Un compte Vinted en commun avec le parrain : c'est la même personne.
  const idsParrain = await lireJson(`${SUPABASE_URL}/rest/v1/vinted_accounts?owner=eq.${encodeURIComponent(parrain)}&select=vinted_user_id`);
  if (!idsParrain) return { ok: false, http: 503, raison: 'pas-su', message: 'Parrainage pas vérifié. Réessaie dans un instant.' };
  const communs = new Set(idsParrain.map((x) => String(x && x.vinted_user_id)));
  if ((ctx.idsVinted || []).some((v) => communs.has(String(v)))) return { ok: false, http: 400, raison: 'soi-meme', message: 'Tu ne peux pas être ton propre parrain.' };
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/parrainages?on_conflict=filleul`, {
      method: 'POST', headers: { ...h(), Prefer: 'resolution=ignore-duplicates,return=representation' },
      body: JSON.stringify([{ filleul: u.id, parrain, code: c, inscrit: new Date(maintenant).toISOString() }]),
    });
    if (!r.ok) return { ok: false, http: 503, raison: 'ecriture', message: 'Parrainage pas enregistré. Réessaie dans un instant.' };
    const j = await r.json().catch(() => null);
    // Ligne déjà là (ignore-duplicates ne rend rien) : déjà parrainé — UNE fois.
    if (!Array.isArray(j) || !j.length) return { ok: false, http: 409, raison: 'deja-parraine', message: 'Ton compte a déjà un parrain.' };
    return { ok: true, http: 200 };
  } catch (_) { return { ok: false, http: 503, raison: 'ecriture', message: 'Parrainage pas enregistré. Réessaie dans un instant.' }; }
}

// ── LE MOIS OFFERT, CHEZ STRIPE ─────────────────────────────────────────────
// Un crédit sur le solde client (montant NÉGATIF = crédit), avec sa marque.
// Rend true (crédité, ou déjà crédité) · false (Stripe a refusé / muet).
async function crediter(client, cle, centimes) {
  if (!/^cus_/.test(String(client || ''))) return false;
  const lu = await stripeApi('GET', `customers/${encodeURIComponent(client)}/balance_transactions`, { limit: 100 });
  if (!lu.ok || !lu.data || !Array.isArray(lu.data.data)) return false;
  if (lu.data.data.some((t) => t && t.metadata && t.metadata.vrm_parrainage === cle)) return true;
  const r = await stripeApi('POST', `customers/${encodeURIComponent(client)}/balance_transactions`,
    { amount: -Math.abs(centimes), currency: 'eur', description: 'VRM — un mois offert (parrainage)', metadata: { vrm_parrainage: cle } },
    `vrm-parrainage-${cle}`);
  return !!(r.ok && r.data && r.data.id);
}
async function patch(filleul, champs) {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/parrainages?filleul=eq.${encodeURIComponent(filleul)}`, {
      method: 'PATCH', headers: { ...h(), Prefer: 'return=minimal' }, body: JSON.stringify(champs),
    });
    return r.ok;
  } catch (_) { return false; }
}
async function clientDe(owner) {
  const j = await lireJson(`${SUPABASE_URL}/rest/v1/abonnements?owner=eq.${encodeURIComponent(owner)}&select=client_stripe`);
  if (!j) return undefined;
  return (j[0] && j[0].client_stripe) || null;
}

// ── PAS SOI-MÊME, PAR LA CARTE (11 nov.) ─────────────────────────────────────
// Stripe donne à une même carte la même empreinte (`card.fingerprint`) chez tous
// les clients du compte : une carte en commun entre filleul et parrain, c'est la
// même personne ⇒ aucun mois offert. Rend un Set · `null` (Stripe muet : pas su).
async function empreintesCartes(client) {
  if (!/^cus_/.test(String(client || ''))) return new Set();
  const r = await stripeApi('GET', 'payment_methods', { customer: client, type: 'card', limit: 100 });
  if (!r.ok || !r.data || !Array.isArray(r.data.data)) return null;
  return new Set(r.data.data.map((pm) => pm && pm.card && pm.card.fingerprint).filter((x) => typeof x === 'string' && x));
}
// true (même carte) · false · null (pas su ⇒ on ne crédite pas, Stripe rejouera).
export async function memeCarte(clientA, clientB) {
  if (!/^cus_/.test(String(clientA || '')) || !/^cus_/.test(String(clientB || ''))) return false;
  const [a, b] = await Promise.all([empreintesCartes(clientA), empreintesCartes(clientB)]);
  if (!a || !b) return null;
  for (const x of a) if (b.has(x)) return true;
  return false;
}
async function refuser(filleul, raison) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/parrainages?filleul=eq.${encodeURIComponent(filleul)}`, {
      method: 'PATCH', headers: { ...h(), Prefer: 'return=minimal' }, body: JSON.stringify({ refus: raison }),
    });
  } catch (_) { /* 037 pas passée : la comparaison sera refaite, rien n'est crédité */ }
}

// Le parrain d'une ligne : crédité s'il a un client Stripe et n'a pas dépassé
// 12 mois offerts sur 365 jours. `true` fait / rien à faire · `false` à réessayer.
async function crediterParrain(ligne, centimes, maintenant) {
  if (!ligne.paye_le || ligne.credit_parrain_le || ligne.refus) return true;
  const client = await clientDe(ligne.parrain);
  if (client === undefined) return false;
  if (!client) return true;                               // en attente : crédité à son premier abonnement
  // (11 nov.) Une carte en commun avec le filleul : la même personne ⇒ rien.
  const clientFilleul = await clientDe(ligne.filleul);
  if (clientFilleul === undefined) return false;
  const meme = await memeCarte(client, clientFilleul);
  if (meme === null) return false;
  if (meme) { await refuser(ligne.filleul, 'meme-carte'); return true; }
  const recents = await lireJson(`${SUPABASE_URL}/rest/v1/parrainages?parrain=eq.${encodeURIComponent(ligne.parrain)}&select=credit_parrain_le`);
  if (!recents) return false;
  const an = recents.filter((x) => x.credit_parrain_le && Date.parse(x.credit_parrain_le) > maintenant - 365 * 86400000).length;
  if (an >= PARRAIN_MAX_AN) return true;                  // plafond : rien de plus, dit dans les CGV
  if (!(await crediter(client, `${ligne.filleul}:parrain`, centimes))) return false;
  await patch(ligne.filleul, { credit_parrain_le: new Date(maintenant).toISOString() });
  return true;
}

// Facture PAYÉE d'un vendeur (webhook `invoice.paid`). `owner` = le vendeur de
// ce client Stripe (lu dans NOTRE table, jamais dans la facture).
export async function factureFilleulPayee(owner, client, facture, centimes, maintenant = Date.now()) {
  if (!stripePret() || !service() || !UUID.test(String(owner || ''))) return { ok: true, ignore: 'sans-config' };
  // La facture à 0 € de l'essai ne fait pas « payer son premier mois ».
  const paye = Number(facture && facture.amount_paid) > 0;
  const ouvert = await parrainageOuvert();
  if (ouvert === null) return { ok: false };
  if (!ouvert) return { ok: true, ignore: 'ferme' };        // éteint : rien n'est crédité (ni noté)
  const lignes = await lireLignes(`filleul=eq.${encodeURIComponent(owner)}`, 'filleul,parrain,paye_le,credit_filleul_le,credit_parrain_le');
  if (!lignes) return { ok: false };
  const l = lignes[0];
  let ok = true;
  if (l && paye && !l.refus) {
    if (!l.paye_le) { l.paye_le = new Date(maintenant).toISOString(); if (!(await patch(owner, { paye_le: l.paye_le }))) return { ok: false }; }
    // (11 nov.) PAS SOI-MÊME, PAR LA CARTE : avant tout crédit, la carte du filleul
    // comparée à celles du parrain (s'il a un client Stripe). Pas su ⇒ 503, Stripe rejoue.
    if (!l.credit_filleul_le || !l.credit_parrain_le) {
      const clientParrain = await clientDe(l.parrain);
      if (clientParrain === undefined) return { ok: false };
      const meme = clientParrain ? await memeCarte(client, clientParrain) : false;
      if (meme === null) return { ok: false };
      if (meme) { await refuser(owner, 'meme-carte'); return { ok: true, refus: 'meme-carte' }; }
    }
    if (!l.credit_filleul_le) {
      if (await crediter(client, `${owner}:filleul`, centimes)) await patch(owner, { credit_filleul_le: new Date(maintenant).toISOString() });
      else ok = false;
    }
    if (!(await crediterParrain(l, centimes, maintenant))) ok = false;
  }
  // Ce vendeur est peut-être AUSSI un parrain dont des mois attendaient un client Stripe.
  {
    const attente = await lireLignes(`parrain=eq.${encodeURIComponent(owner)}&paye_le=not.is.null&credit_parrain_le=is.null`, 'filleul,parrain,paye_le,credit_parrain_le');
    if (!attente) ok = false;
    else for (const x of attente) if (!(await crediterParrain(x, centimes, maintenant))) ok = false;
  }
  return { ok };
}
