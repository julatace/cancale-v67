// ── STRIPE, SANS BIBLIOTHÈQUE ────────────────────────────────────────────────
// Trois appels et une signature : pas de dépendance npm de plus (moins de code
// tiers sur le chemin de l'argent). La version de l'API est FIGÉE : c'est elle
// qui décide de la forme des objets (où vit `current_period_end`, par exemple),
// et le webhook enregistré chez Stripe envoie la même.
import crypto from 'crypto';

export const STRIPE_VERSION = '2026-08-26.dahlia';
export const stripeCle = () => process.env.STRIPE_SECRET_KEY || '';
export const stripePret = () => /^(sk|rk)_(test|live)_/.test(stripeCle());
export const stripeModeTest = () => /^(sk|rk)_test_/.test(stripeCle());

// Encodage « formulaire » de Stripe : objets et tableaux en crochets.
export function formulaire(obj, prefixe = '', out = []) {
  for (const [k, v] of Object.entries(obj || {})) {
    if (v === undefined || v === null) continue;
    const cle = prefixe ? `${prefixe}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((x, i) => (x && typeof x === 'object') ? formulaire(x, `${cle}[${i}]`, out) : out.push(`${encodeURIComponent(`${cle}[${i}]`)}=${encodeURIComponent(String(x))}`));
    else if (typeof v === 'object') formulaire(v, cle, out);
    else out.push(`${encodeURIComponent(cle)}=${encodeURIComponent(String(v))}`);
  }
  return out;
}

// Un appel Stripe. Rend `{ ok, status, data }` — jamais d'exception.
export async function stripeApi(methode, chemin, params, idempotence) {
  const cle = stripeCle();
  if (!cle) return { ok: false, status: 0, data: { error: { message: 'STRIPE_SECRET_KEY absente' } } };
  const get = methode === 'GET';
  const corps = params ? formulaire(params).join('&') : '';
  const url = `https://api.stripe.com/v1/${chemin}${get && corps ? `?${corps}` : ''}`;
  const headers = { Authorization: `Bearer ${cle}`, 'Stripe-Version': STRIPE_VERSION };
  if (!get) headers['Content-Type'] = 'application/x-www-form-urlencoded';
  if (idempotence && !get) headers['Idempotency-Key'] = idempotence;
  try {
    const r = await fetch(url, { method: methode, headers, body: get ? undefined : corps });
    let data = null; try { data = await r.json(); } catch (_) {}
    return { ok: r.ok, status: r.status, data: data || {} };
  } catch (e) { return { ok: false, status: 0, data: { error: { message: String(e && e.message || e) } } }; }
}

// ── LA SIGNATURE DU WEBHOOK ─────────────────────────────────────────────────
// En-tête `Stripe-Signature: t=…,v1=…[,v1=…]`. On signe `${t}.${corps brut}` en
// HMAC-SHA256 avec le secret `whsec_…`, on compare en TEMPS CONSTANT, et on
// refuse un horodatage de plus de 5 minutes (rejeu d'un vieux message capturé).
// ⚠️ Le corps doit être l'octet près reçu : un JSON re-sérialisé ne correspond
//    plus — d'où la lecture brute dans la route.
export function signatureValide(brut, entete, secret, maintenantS = Math.floor(Date.now() / 1000), tolerance = 300) {
  if (!secret || !entete || brut == null) return false;
  const parts = String(entete).split(',').map((p) => p.trim().split('='));
  const t = Number((parts.find(([k]) => k === 't') || [])[1]);
  const sigs = parts.filter(([k]) => k === 'v1').map(([, v]) => v).filter(Boolean);
  if (!isFinite(t) || !sigs.length) return false;
  if (Math.abs(maintenantS - t) > tolerance) return false;
  const attendu = crypto.createHmac('sha256', secret).update(`${t}.`).update(Buffer.isBuffer(brut) ? brut : Buffer.from(String(brut), 'utf8')).digest();
  return sigs.some((s) => {
    let b; try { b = Buffer.from(s, 'hex'); } catch (_) { return false; }
    return b.length === attendu.length && crypto.timingSafeEqual(b, attendu);
  });
}

// Fin de la période en cours. Depuis l'API « basil » elle vit sur l'ARTICLE de
// l'abonnement, plus sur l'abonnement : on lit les deux.
export function finPeriode(sub) {
  if (!sub) return null;
  const items = (sub.items && Array.isArray(sub.items.data)) ? sub.items.data : [];
  const t = sub.current_period_end || (items[0] && items[0].current_period_end) || null;
  return t ? new Date(t * 1000).toISOString() : null;
}
