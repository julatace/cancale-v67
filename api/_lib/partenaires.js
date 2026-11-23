// ═══════════════════════════════════════════════════════════════════════════
// LE PROGRAMME PARTENAIRE — LECTURES, ÉCRITURES, ROUTES (15 nov.)
// ═══════════════════════════════════════════════════════════════════════════
// La règle (pure) : api/_lib/partenaires-regle.js. Les tables :
// supabase/migrations/043-partenaires.sql (clé de service seule).
//
// TROIS PORTES, toutes dans api/compte.js (aucune fonction `api/` de plus) :
//   · le webhook Stripe : `invoice.paid` ⇒ une commission ; `charge.refunded`,
//     `refund.created`, `charge.dispute.created`, `credit_note.created` ⇒ annulée
//     (litige, ou toute la facture rendue) ou RÉDUITE au prorata (rendu partiel, 16 nov.) ;
//   · `mode=partenaire` : POST { action:'rattacher', code } (SESSION : le compte
//     connecté, jamais un identifiant du corps) ; GET `?j=<jeton>` (SANS session :
//     la page du partenaire, des nombres seulement) ;
//   · `mode=partenaires` : Julien SEUL (le propriétaire de l'installation,
//     `proprietaireInstallation`) — créer, mettre en pause, l'avantage, le lien
//     privé, « Versé », l'export CSV.
// Le rattachement suit les règles du parrainage (api/_lib/parrainage.js, mêmes
// fonctions) : compte VRM de moins de 30 jours, jamais client Stripe, aucun essai
// déjà consommé, pas soi-même (même compte, même e-mail à un point ou un « + »
// près, un compte Vinted en commun ou déjà vu ailleurs), une fois. Un compte
// déjà parrainé n'est pas rattaché à un partenaire (et l'inverse) : une seule
// récompense par nouveau client.
// « Pas su » ne vaut jamais « oui » : une lecture ratée ⇒ 503 (Stripe rejoue le
// webhook), jamais une commission devinée ni une liste vide servie pour « rien ».
// Tables absentes (043 pas passée) ⇒ le programme se dit « pas installé », le
// webhook acquitte sans rien écrire, le reste de VRM ne change pas.
// ═══════════════════════════════════════════════════════════════════════════
import crypto from 'crypto';
import { sbCle } from './cle.js';
import { stripeApi, stripePret } from './stripe.js';
import { fetchAvecDelai } from './fetch-delai.js';
import { emailCanon, verdictVinted, FILLEUL_MAX_JOURS } from './parrainage.js';
import {
  codePartenaire, decisionCommission, factureReelle, paiementsDeFacture, annulationDeLEvenement, remboursementDe,
  chiffresPartenaire, csvPartenaire, RE_MOIS, COMMISSION_CENTIMES, DELAI_DUE_JOURS,
} from './partenaires-regle.js';

const SUPABASE_URL = () => process.env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NIL = '00000000-0000-0000-0000-000000000000';
const service = () => process.env.SUPABASE_SERVICE_KEY || '';
const h = () => ({ ...sbCle(service()), 'Content-Type': 'application/json' });
export const ORIGINE = 'https://vrm.center';
export const RE_JETON_PARTENAIRE = /^[A-Za-z0-9_-]{43}$/;
export const lienCode = (code) => `${ORIGINE}/p/${code}`;
export const lienPrive = (jeton) => `${ORIGINE}/pa/${jeton}`;
export const jetonNeuf = () => crypto.randomBytes(32).toString('base64url');
export const empreinteJeton = (j) => crypto.createHash('sha256').update('partenaire:' + String(j)).digest('hex');
const enc = encodeURIComponent;

// ── Lire : { ok:true, lignes } · { ok:false, absent } (absent = table inconnue : 043 pas passée)
async function lireT(chemin) {
  if (!service()) return { ok: false, absent: false };
  try {
    const r = await fetchAvecDelai(`${SUPABASE_URL()}/rest/v1/${chemin}`, { headers: sbCle(service()) });
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      // PostgREST ne répond 404 que pour une table inconnue (PGRST205) : la 043 pas passée.
      return { ok: false, absent: r.status === 404 || (r.status === 400 && /PGRST205|42P01|does not exist|schema cache/i.test(t)) };
    }
    const j = await r.json().catch(() => null);
    return Array.isArray(j) ? { ok: true, lignes: j } : { ok: false, absent: false };
  } catch (_) { return { ok: false, absent: false }; }
}
// Tout, par pages de 1 000 (Supabase coupe à 1 000 lignes sans le dire, §4.5).
async function lireTout(chemin, ordre) {
  const tout = [];
  for (let page = 0; page < 200; page++) {
    const r = await lireT(`${chemin}&order=${ordre}&limit=1000&offset=${page * 1000}`);
    if (!r.ok) return r;
    tout.push(...r.lignes);
    if (r.lignes.length < 1000) return { ok: true, lignes: tout };
  }
  return { ok: false, absent: false };
}
async function ecrire(methode, chemin, corps, prefer) {
  try {
    const r = await fetchAvecDelai(`${SUPABASE_URL()}/rest/v1/${chemin}`, { method: methode, headers: { ...h(), Prefer: prefer || 'return=minimal' }, body: JSON.stringify(corps) });
    const t = await r.text().catch(() => '');
    let j = null; try { j = t ? JSON.parse(t) : null; } catch (_) {}
    return { ok: r.ok, status: r.status, texte: t, json: j };
  } catch (_) { return { ok: false, status: 0, texte: '', json: null }; }
}

// ── Les lectures du programme ───────────────────────────────────────────────
const CHAMPS_PARTENAIRE = 'id,code,nom,contact,compte,pause_le,coupon,cree';
async function partenaireDeCode(code) {
  const r = await lireT(`partenaires?code=eq.${enc(code)}&select=${CHAMPS_PARTENAIRE}&limit=1`);
  return r.ok ? { ok: true, p: r.lignes[0] || null } : r;
}
async function partenaireDId(id) {
  if (!UUID.test(String(id || ''))) return { ok: true, p: null };
  const r = await lireT(`partenaires?id=eq.${enc(id)}&select=${CHAMPS_PARTENAIRE}&limit=1`);
  return r.ok ? { ok: true, p: r.lignes[0] || null } : r;
}
// Le compte est-il rattaché à un partenaire ? true · false · null (pas su). Table absente ⇒ false.
export async function rattacheAUnPartenaire(owner) {
  if (!UUID.test(String(owner || ''))) return false;
  const r = await lireT(`partenaire_filleuls?filleul=eq.${enc(owner)}&select=partenaire&limit=1`);
  if (!r.ok) return r.absent ? false : null;
  return r.lignes.length > 0;
}
// L'adresse d'un compte VRM (pas soi-même par l'e-mail) · '' aucune · undefined pas su.
async function emailDe(owner) {
  if (!UUID.test(String(owner || ''))) return '';
  try {
    const r = await fetchAvecDelai(`${SUPABASE_URL()}/auth/v1/admin/users/${enc(owner)}`, { headers: sbCle(service()) });
    if (r.status === 404) return '';
    if (!r.ok) return undefined;
    const j = await r.json();
    return j && typeof j.email === 'string' ? j.email : '';
  } catch (_) { return undefined; }
}
const RE_EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[a-z]{2,}$/i;
// Le compte VRM qui porte cette adresse (à un point ou un « + » près) · null aucun · undefined pas su.
// Lu par pages (admin GoTrue), une fois, à la création du partenaire : sert « pas soi-même ».
async function compteDeLEmail(email) {
  const cible = emailCanon(email);
  for (let page = 1; page <= 50; page++) {
    let r;
    try { r = await fetchAvecDelai(`${SUPABASE_URL()}/auth/v1/admin/users?page=${page}&per_page=1000`, { headers: sbCle(service()) }); } catch (_) { return undefined; }
    if (!r.ok) return undefined;
    const j = await r.json().catch(() => null);
    const users = j && Array.isArray(j.users) ? j.users : null;
    if (!users) return undefined;
    const u = users.find((x) => x && typeof x.email === 'string' && emailCanon(x.email) === cible && UUID.test(String(x.id || '')));
    if (u) return String(u.id);
    if (users.length < 1000) return null;
  }
  return undefined;
}

// ── RATTACHER UN NOUVEAU COMPTE À UN CODE ───────────────────────────────────
// `ctx` = ce que la route sait du compte CONNECTÉ (jamais du corps) :
//   { u: {id,email,created_at}, ligne (sa ligne d'abonnement), idsVinted, essaiDeja, proprio }.
const pasSu = { ok: false, http: 503, raison: 'pas-su', message: 'Pas vérifié. Réessaie dans un instant.' };
const soiMeme = { ok: false, http: 400, raison: 'soi-meme', message: 'Ce code est le tien : il sert à tes abonnés, pas à ton compte.' };
export async function rattacherPartenaire(brut, ctx, maintenant = Date.now()) {
  const code = codePartenaire(brut);
  if (!code) return { ok: false, http: 400, raison: 'code', message: 'Ce code partenaire est incomplet.' };
  const u = ctx && ctx.u;
  if (!u || !UUID.test(String(u.id || ''))) return { ok: false, http: 401, raison: 'session' };
  if (!service()) return pasSu;
  const lu = await partenaireDeCode(code);
  if (!lu.ok) return lu.absent ? { ok: false, http: 409, raison: 'ferme', message: "Le programme partenaire n'est pas encore ouvert." } : pasSu;
  const p = lu.p;
  if (!p) return { ok: false, http: 404, raison: 'inconnu', message: "Ce code partenaire n'existe pas." };
  if (p.pause_le) return { ok: false, http: 409, raison: 'pause', message: "Ce code partenaire n'est plus actif." };
  // (Le propriétaire est de toute façon un compte ancien : « pas su » ici ne bloque rien, la règle des 30 jours tient.)
  if (ctx.proprio && String(ctx.proprio) === String(u.id)) return { ok: false, http: 400, raison: 'proprietaire', message: 'Le compte propriétaire de VRM ne se rattache à aucun code.' };
  if (p.compte && String(p.compte) === String(u.id)) return soiMeme;
  const cree = Date.parse(u.created_at || '');
  if (!Number.isFinite(cree) || maintenant - cree > FILLEUL_MAX_JOURS * 86400000) return { ok: false, http: 409, raison: 'ancien', message: 'Un code partenaire est réservé aux comptes VRM créés depuis moins de 30 jours.' };
  if (ctx.ligne === undefined || ctx.essaiDeja === null || ctx.essaiDeja === undefined) return pasSu;
  if (ctx.ligne && ctx.ligne.client_stripe) return { ok: false, http: 409, raison: 'deja-client', message: 'Un code partenaire est réservé à un premier abonnement.' };
  if (ctx.essaiDeja === true) return { ok: false, http: 409, raison: 'deja-essaye', message: 'Un code partenaire est réservé à un premier abonnement.' };
  // Pas soi-même par l'e-mail : le contact du partenaire, et l'adresse de son compte VRM.
  const moi = emailCanon(u.email);
  if (p.contact && RE_EMAIL.test(String(p.contact).trim()) && emailCanon(p.contact) === moi) return soiMeme;
  if (p.compte) {
    const e = await emailDe(p.compte);
    if (e === undefined) return pasSu;
    if (e && emailCanon(e) === moi) return soiMeme;
  }
  // Pas soi-même par Vinted : un compte en commun avec le partenaire, ou déjà vu ailleurs dans VRM.
  if ((ctx.idsVinted || []).length) {
    const v = await verdictVinted(u.id, p.compte && UUID.test(String(p.compte)) ? p.compte : NIL, ctx.idsVinted);
    if (v === null) return pasSu;
    if (v === 'soi-meme') return soiMeme;
    if (v === 'vinted-deja-vu') return { ok: false, http: 409, raison: 'vinted-deja-vu', message: 'Ce compte Vinted est déjà connu de VRM : un code partenaire est réservé à un nouveau vendeur.' };
  }
  // Une seule récompense par nouveau client : déjà parrainé ⇒ pas de partenaire.
  const parr = await lireT(`parrainages?filleul=eq.${enc(u.id)}&select=filleul&limit=1`);
  if (!parr.ok && !parr.absent) return pasSu;
  if (parr.ok && parr.lignes.length) return { ok: false, http: 409, raison: 'deja-parraine', message: 'Ton compte a déjà un parrain.' };
  const w = await ecrire('POST', 'partenaire_filleuls?on_conflict=filleul', [{ filleul: u.id, partenaire: p.id, code, inscrit: new Date(maintenant).toISOString() }], 'resolution=ignore-duplicates,return=representation');
  if (!w.ok) return { ok: false, http: 503, raison: 'ecriture', message: 'Pas enregistré. Réessaie dans un instant.' };
  if (!Array.isArray(w.json) || !w.json.length) return { ok: false, http: 409, raison: 'deja-rattache', message: 'Ton compte est déjà rattaché à un code.' };
  return { ok: true, http: 200, code };
}

// ── LE WEBHOOK : UNE FACTURE PAYÉE ──────────────────────────────────────────
// `owner` = le compte VRM du client Stripe (lu dans NOTRE table, jamais dans la facture).
// Rend { ok } (ok:false ⇒ 503, Stripe rejoue) et, pour les bancs, `cree` / `rien`.
export async function commissionFacturePayee(owner, facture, maintenant = Date.now()) {
  if (!service() || !UUID.test(String(owner || ''))) return { ok: true, rien: 'sans-config' };
  const reelle = factureReelle(facture);
  if (!reelle.ok) return { ok: true, rien: reelle.raison };
  const ratt = await lireT(`partenaire_filleuls?filleul=eq.${enc(owner)}&select=filleul,partenaire,inscrit&limit=1`);
  if (!ratt.ok) return ratt.absent ? { ok: true, rien: 'non-installe' } : { ok: false };
  const rattachement = ratt.lignes[0] || null;
  if (!rattachement) return { ok: true, rien: 'pas-rattache' };
  const [lp, ex] = await Promise.all([
    partenaireDId(rattachement.partenaire),
    lireT(`partenaire_commissions?filleul=eq.${enc(owner)}&select=facture,mois,annulee_le`),
  ]);
  if (!lp.ok || !ex.ok) return { ok: false };
  // Les identifiants du paiement : dans la facture (anciennes formes), sinon chez Stripe.
  let fac = facture;
  const p0 = paiementsDeFacture(facture);
  if (!p0.charge && !p0.payment_intent && stripePret()) {
    const r = await stripeApi('GET', 'invoice_payments', { invoice: facture.id, limit: 10 });
    if (!r.ok || !r.data || !Array.isArray(r.data.data)) return { ok: false };
    fac = { ...facture, payments: { data: r.data.data } };
  }
  const p = paiementsDeFacture(fac);
  const cles = [facture.id, p.charge, p.payment_intent].filter(Boolean);
  const an = await lireSignaux(cles);
  if (!an.ok && !an.absent) return { ok: false };
  // (16 nov.) TOUS les signaux reçus avant (remboursements partiels compris) : la commission
  // naît annulée (toute la facture rendue, litige) ou réduite au prorata.
  const d = decisionCommission({ facture: fac, rattachement, partenaire: lp.p, existantes: ex.lignes, signaux: an.ok ? an.lignes : [] });
  if (!d.creer) return { ok: true, rien: d.rien };
  const w = await ecrire('POST', 'partenaire_commissions?on_conflict=facture', [d.creer], 'resolution=ignore-duplicates,return=minimal');
  if (w.ok) return { ok: true, cree: d.creer };
  // Deux webhooks du même mois en même temps : l'index unique a tranché (le second ne compte pas).
  if (w.status === 409 && /23505/.test(w.texte)) return { ok: true, rien: 'mois-deja' };
  return { ok: false };
}

// Les signaux (remboursement, litige, avoir) rangés pour ces clés Stripe.
const lireSignaux = (cles) => lireT(`partenaire_annulations?cle=in.(${cles.filter(Boolean).map((c) => '%22' + enc(c) + '%22').join(',')})&select=cle,signal,raison,centimes,le`);

// ── LE WEBHOOK : REMBOURSEMENT, LITIGE, AVOIR ───────────────────────────────
// Le SIGNAL est rangé d'abord (une ligne par clé et par geste de Stripe, jamais deux fois
// le même — si la facture payée arrive APRÈS, elle en tient compte), puis chaque
// commission de cette facture / de ce paiement est REJUGÉE sur tous ses signaux
// (`remboursementDe`, la règle) : litige ou toute la facture rendue ⇒ annulée (gardée,
// dite) ; rendu partiel ⇒ `rembourse_centimes` posé (il ne fait que monter : deux
// webhooks en même temps ne le font jamais redescendre) et la commission vaut
// `commissionNette` (3 € au prorata de ce qui reste payé).
export async function annulerCommissions(type, obj, maintenant = Date.now()) {
  const a = annulationDeLEvenement(type, obj);
  if (!a || !service()) return { ok: true, rien: 'sans-objet' };
  const le = new Date(maintenant).toISOString();
  const cles = Object.values(a.cles).filter(Boolean);
  const m = await ecrire('POST', 'partenaire_annulations?on_conflict=cle,signal', cles.map((cle) => ({ cle, signal: a.signal, raison: a.raison, centimes: a.centimes, le })), 'resolution=ignore-duplicates,return=minimal');
  if (!m.ok) {
    if (m.status === 404 || /PGRST205|42P01|does not exist|schema cache/i.test(m.texte)) return { ok: true, rien: 'non-installe' };
    return { ok: false };
  }
  // Les commissions touchées (encore vivantes), relues par chacune de leurs clés.
  const touchees = new Map();
  for (const [col, val] of Object.entries(a.cles)) {
    if (!val) continue;
    const r = await lireT(`partenaire_commissions?${col}=eq.${enc(val)}&annulee_le=is.null&select=facture,facture_centimes,rembourse_centimes,charge,payment_intent`);
    if (!r.ok) return { ok: false };
    for (const c of r.lignes) if (c && c.facture) touchees.set(c.facture, c);
  }
  let n = 0, reduites = 0;
  for (const c of touchees.values()) {
    const sg = await lireSignaux([c.facture, c.charge, c.payment_intent]);
    if (!sg.ok) return { ok: false };                      // pas su ⇒ 503, Stripe rejoue (rien deviné)
    const rb = remboursementDe(sg.lignes, c.facture_centimes);
    if (rb.total) {
      const w = await ecrire('PATCH', `partenaire_commissions?facture=eq.${enc(c.facture)}&annulee_le=is.null`, { annulee_le: le, annulee_raison: rb.raison }, 'return=representation');
      if (!w.ok) return { ok: false };
      n += Array.isArray(w.json) ? w.json.length : 0;
    } else if (rb.centimes > (Number(c.rembourse_centimes) || 0)) {
      const w = await ecrire('PATCH', `partenaire_commissions?facture=eq.${enc(c.facture)}&annulee_le=is.null&rembourse_centimes=lt.${rb.centimes}`, { rembourse_centimes: rb.centimes }, 'return=representation');
      if (!w.ok) return { ok: false };
      reduites += Array.isArray(w.json) ? w.json.length : 0;
    }
  }
  return { ok: true, annulees: n, reduites, raison: a.raison };
}

// ── LES CHIFFRES D'UN OU DE PLUSIEURS PARTENAIRES ───────────────────────────
// Les abonnements vivants de ces comptes (Set) · null pas su.
async function abonnementsVivants(owners) {
  const vivants = new Set();
  for (let i = 0; i < owners.length; i += 100) {
    const lot = owners.slice(i, i + 100);
    const r = await lireT(`abonnements?owner=in.(${lot.map(enc).join(',')})&select=owner,statut`);
    if (!r.ok) return null;
    for (const x of r.lignes) if (x && ['active', 'past_due'].includes(String(x.statut))) vivants.add(String(x.owner));
  }
  return vivants;
}
// Pour UN partenaire (sa page) ou TOUS (`id` absent, Julien). Rend { ok, parPartenaire: Map } · { ok:false, absent }.
async function lireChiffres(id, maintenant) {
  const f = id ? `partenaire=eq.${enc(id)}` : 'partenaire=not.is.null';
  const [fil, com, ver] = await Promise.all([
    lireTout(`partenaire_filleuls?${f}&select=partenaire,filleul`, 'filleul.asc'),
    lireTout(`partenaire_commissions?${f}&select=facture,partenaire,filleul,mois,montant_centimes,facture_centimes,rembourse_centimes,paye_le,due_le,annulee_le,annulee_raison`, 'facture.asc'),
    lireTout(`partenaire_versements?${f}&select=id,partenaire,mois,montant_centimes,verse_le`, 'id.asc'),
  ]);
  if (!fil.ok || !com.ok || !ver.ok) return { ok: false, absent: fil.absent || com.absent || ver.absent };
  const owners = [...new Set(com.lignes.map((c) => c.filleul).filter((x) => UUID.test(String(x || ''))))];
  const actifs = owners.length ? await abonnementsVivants(owners) : new Set();
  const par = new Map();
  const de = (pid) => { if (!par.has(pid)) par.set(pid, { inscrits: 0, commissions: [], versements: [] }); return par.get(pid); };
  for (const x of fil.lignes) de(String(x.partenaire)).inscrits++;
  for (const x of com.lignes) de(String(x.partenaire)).commissions.push(x);
  for (const x of ver.lignes) de(String(x.partenaire)).versements.push(x);
  const chiffres = new Map();
  for (const [pid, d] of par) chiffres.set(pid, { ...d, chiffres: chiffresPartenaire({ ...d, actifs, maintenant }) });
  return { ok: true, chiffres };
}
const vide = (maintenant) => ({ inscrits: 0, commissions: [], versements: [], chiffres: chiffresPartenaire({ maintenant, actifs: new Set() }) });

// ── LA PAGE DU PARTENAIRE (lecture seule, sans session) ─────────────────────
// Rend { http, corps }. Jamais : un nom de client, un e-mail, un pseudo, un
// identifiant, le contact du partenaire, son coupon.
export async function vuePartenaire(jeton, maintenant = Date.now()) {
  const j = String(jeton || '');
  if (!RE_JETON_PARTENAIRE.test(j)) return { http: 404, corps: { ok: false, raison: 'lien' } };
  if (!service()) return { http: 503, corps: { ok: false, raison: 'pas-su' } };
  const e = empreinteJeton(j);
  const r = await lireT(`partenaires?jeton_empreinte=eq.${e}&select=id,code,nom,pause_le,jeton_empreinte&limit=1`);
  if (!r.ok) return r.absent ? { http: 404, corps: { ok: false, raison: 'lien' } } : { http: 503, corps: { ok: false, raison: 'pas-su' } };
  const p = r.lignes[0];
  // Re-comparé à durée constante (la base a filtré, on ne se fie pas qu'à elle).
  if (!p || typeof p.jeton_empreinte !== 'string' || p.jeton_empreinte.length !== e.length
    || !crypto.timingSafeEqual(Buffer.from(p.jeton_empreinte), Buffer.from(e))) return { http: 404, corps: { ok: false, raison: 'lien' } };
  const c = await lireChiffres(p.id, maintenant);
  if (!c.ok) return { http: 503, corps: { ok: false, raison: 'pas-su' } };
  const d = c.chiffres.get(String(p.id)) || vide(maintenant);
  return { http: 200, corps: {
    ok: true, nom: p.nom, code: p.code, lien: lienCode(p.code), pause: !!p.pause_le,
    commissionCentimes: COMMISSION_CENTIMES, delaiJours: DELAI_DUE_JOURS, au: new Date(maintenant).toISOString(),
    chiffres: d.chiffres,
  } };
}

// ── L'ADMINISTRATION (Julien seul) ──────────────────────────────────────────
const nomValide = (n) => { const t = String(n == null ? '' : n).normalize('NFC').replace(/\s+/g, ' ').trim(); return t.length >= 2 && t.length <= 40 && !/[<>{}\\]/.test(t) ? t : ''; };
const contactValide = (c) => { const t = String(c == null ? '' : c).replace(/\s+/g, ' ').trim(); if (!t) return null; return t.length <= 120 && !/[<>{}\\]/.test(t) ? t : undefined; };
const jourValide = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(String(d || '')) && Number.isFinite(Date.parse(d + 'T12:00:00Z')) ? String(d) : '');
const ligneAdmin = (p, d) => ({
  id: p.id, nom: p.nom, code: p.code, contact: p.contact || null, pause: !!p.pause_le, pauseLe: p.pause_le || null,
  coupon: p.coupon || null, lienPrivePose: !!p.jeton_pose, cree: p.cree || null, lien: lienCode(p.code), chiffres: d.chiffres,
});
export async function listeAdmin(maintenant = Date.now()) {
  const r = await lireTout('partenaires?id=not.is.null&select=id,code,nom,contact,pause_le,coupon,cree,jeton_empreinte', 'cree.asc');
  if (!r.ok) return r.absent ? { http: 200, corps: { ok: true, installe: false } } : { http: 503, corps: { ok: false, raison: 'pas-su' } };
  const c = await lireChiffres(null, maintenant);
  if (!c.ok) return { http: 503, corps: { ok: false, raison: 'pas-su' } };
  const liste = r.lignes.map((p) => ligneAdmin({ ...p, jeton_pose: !!p.jeton_empreinte }, c.chiffres.get(String(p.id)) || vide(maintenant)));
  return { http: 200, corps: { ok: true, installe: true, au: new Date(maintenant).toISOString(), commissionCentimes: COMMISSION_CENTIMES, delaiJours: DELAI_DUE_JOURS, stripe: stripePret(), partenaires: liste } };
}
export async function csvAdmin(id, maintenant = Date.now()) {
  const lp = await partenaireDId(id);
  if (!lp.ok) return { http: 503, texte: null };
  if (!lp.p) return { http: 404, texte: null };
  const c = await lireChiffres(lp.p.id, maintenant);
  if (!c.ok) return { http: 503, texte: null };
  const d = c.chiffres.get(String(lp.p.id)) || vide(maintenant);
  return { http: 200, texte: csvPartenaire({ partenaire: lp.p, commissions: d.commissions, versements: d.versements, maintenant }), nom: `partenaire-${lp.p.code}.csv` };
}
// Une action de Julien. Rend { http, corps }.
export async function actionAdmin(corps, maintenant = Date.now()) {
  const a = corps && corps.action;
  if (a === 'creer') {
    const nom = nomValide(corps.nom), code = codePartenaire(corps.code), contact = contactValide(corps.contact);
    if (!nom) return { http: 400, corps: { ok: false, raison: 'nom' } };
    if (!code) return { http: 400, corps: { ok: false, raison: 'code' } };
    if (contact === undefined) return { http: 400, corps: { ok: false, raison: 'contact' } };
    // Son compte VRM, s'il en a un à l'adresse du contact : « pas soi-même » (même compte, même compte Vinted).
    const compte = contact && RE_EMAIL.test(contact) ? await compteDeLEmail(contact) : null;
    if (compte === undefined) return { http: 503, corps: { ok: false, raison: 'pas-su' } };
    const jeton = jetonNeuf();
    const w = await ecrire('POST', 'partenaires', [{ nom, code, contact, compte, jeton_empreinte: empreinteJeton(jeton), cree: new Date(maintenant).toISOString() }], 'return=representation');
    if (w.status === 409 && /23505/.test(w.texte)) return { http: 409, corps: { ok: false, raison: 'code-pris' } };
    if (!w.ok || !Array.isArray(w.json) || !w.json[0]) return { http: 503, corps: { ok: false, raison: /PGRST205|42P01/.test(w.texte) ? 'non-installe' : 'ecriture' } };
    // Le lien privé n'est rendu qu'ICI (et par « Nouveau lien ») : la base n'en garde que l'empreinte.
    return { http: 200, corps: { ok: true, id: w.json[0].id, code, lien: lienCode(code), lienPrive: lienPrive(jeton) } };
  }
  const lp = await partenaireDId(corps && corps.id);
  if (!lp.ok) return { http: 503, corps: { ok: false, raison: 'pas-su' } };
  if (!lp.p) return { http: 404, corps: { ok: false, raison: 'inconnu' } };
  const id = lp.p.id;
  const patch = async (champs) => {
    const w = await ecrire('PATCH', `partenaires?id=eq.${enc(id)}`, champs, 'return=representation');
    return w.ok && Array.isArray(w.json) && w.json.length === 1;
  };
  if (a === 'pause') {
    const ok = await patch({ pause_le: corps.pause === true ? new Date(maintenant).toISOString() : null });
    return ok ? { http: 200, corps: { ok: true, pause: corps.pause === true } } : { http: 503, corps: { ok: false, raison: 'ecriture' } };
  }
  if (a === 'lien') {
    const jeton = jetonNeuf();
    const ok = await patch({ jeton_empreinte: empreinteJeton(jeton) });
    return ok ? { http: 200, corps: { ok: true, lienPrive: lienPrive(jeton) } } : { http: 503, corps: { ok: false, raison: 'ecriture' } };
  }
  if (a === 'coupon') {
    // L'AVANTAGE DU FILLEUL (éteint par défaut) : un coupon que Julien a créé chez Stripe,
    // vérifié chez Stripe avant d'être posé. `null` l'éteint.
    const brut = corps.coupon == null ? '' : String(corps.coupon).trim();
    if (!brut) { const ok = await patch({ coupon: null }); return ok ? { http: 200, corps: { ok: true, coupon: null } } : { http: 503, corps: { ok: false, raison: 'ecriture' } }; }
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(brut)) return { http: 400, corps: { ok: false, raison: 'coupon' } };
    if (!stripePret()) return { http: 409, corps: { ok: false, raison: 'stripe' } };
    const r = await stripeApi('GET', `coupons/${enc(brut)}`);
    if (!r.ok || !r.data || r.data.id !== brut || r.data.valid === false) return { http: 409, corps: { ok: false, raison: 'coupon-inconnu' } };
    const ok = await patch({ coupon: brut });
    return ok ? { http: 200, corps: { ok: true, coupon: brut } } : { http: 503, corps: { ok: false, raison: 'ecriture' } };
  }
  if (a === 'verse') {
    // « Versé » : NOTÉ sur son clic. VRM ne verse rien.
    const mois = String(corps.mois || ''), le = jourValide(corps.le), cts = Number(corps.centimes);
    if (!RE_MOIS.test(mois)) return { http: 400, corps: { ok: false, raison: 'mois' } };
    if (!le || Date.parse(le + 'T00:00:00Z') > maintenant + 86400000) return { http: 400, corps: { ok: false, raison: 'date' } };
    if (!Number.isInteger(cts) || cts <= 0 || cts > 10000000) return { http: 400, corps: { ok: false, raison: 'montant' } };
    const w = await ecrire('POST', 'partenaire_versements', [{ partenaire: id, mois, montant_centimes: cts, verse_le: le, cree: new Date(maintenant).toISOString() }], 'return=minimal');
    return w.ok ? { http: 200, corps: { ok: true } } : { http: 503, corps: { ok: false, raison: 'ecriture' } };
  }
  return { http: 400, corps: { ok: false, raison: 'action' } };
}

// ── LE PAIEMENT : L'AVANTAGE DU FILLEUL (éteint par défaut) ─────────────────
// Le coupon du partenaire de ce compte, s'il en a un et n'est pas en pause.
// '' aucun · undefined pas su. Table absente ⇒ ''.
export async function couponDuFilleul(owner) {
  if (!service() || !UUID.test(String(owner || ''))) return '';
  const r = await lireT(`partenaire_filleuls?filleul=eq.${enc(owner)}&select=partenaire&limit=1`);
  if (!r.ok) return r.absent ? '' : undefined;
  if (!r.lignes[0]) return '';
  const lp = await partenaireDId(r.lignes[0].partenaire);
  if (!lp.ok) return undefined;
  return lp.p && lp.p.coupon && !lp.p.pause_le ? String(lp.p.coupon) : '';
}
