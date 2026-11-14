// ═══════════════════════════════════════════════════════════════════════════
//  161 · « DIS SIRI… » — LE JETON PERSONNEL ET LA ROUTE (14 nov., idées argent)
// ═══════════════════════════════════════════════════════════════════════════
// AUCUNE fonction `api/` neuve (12 au plus) : `api/widget.js?mode=siri`, comme les SMS.
//
//   POST  (session du vendeur, `Authorization: Bearer <jwt>`) { action }
//         · 'creer'    : un jeton NEUF (32 octets aléatoires, `vs1_…`), rendu UNE fois ;
//                        l'ancien est coupé d'abord. Le serveur ne garde que son
//                        EMPREINTE (SHA-256) : dans SA ligne `vrm_siri` ({ h, at, debut,
//                        langue }) et l'index `jeton_siri_{h}` chez le propriétaire NEUTRE
//                        (aucune session ne peut l'écrire, api/_lib/jeton-index.js).
//         · 'revoquer' : l'index retiré PUIS la ligne vidée ; une suppression ratée ⇒ 503,
//                        jamais « coupé » dit à tort.
//   GET   `?mode=siri&q=vendu|retirer|envoyer|tout&k=<jeton>` (ou l'en-tête `x-vrm-key`)
//         ⇒ la phrase que Siri lit (text/plain ; `&format=json` pour un banc).
//         Mauvais jeton, jeton coupé ou remplacé ⇒ 401 SANS aucune lecture des données ;
//         base injoignable ⇒ 503 ; abonnement arrêté ⇒ 402.
//
// PORTÉE : LECTURE SEULE, ces trois réponses et rien d'autre. Les lectures sont des
// projections de scalaires sur DEUX petites lignes publiées par l'app (`widget_stats`,
// `siri_retrait`) : jamais `select=data`, jamais une ligne lourde (§4.4), jamais `main`.
// Tenu par scripts/audit-idees-argent.cjs (section S : la vraie fonction `api/widget.js`
// EXÉCUTÉE sur une base servie, §4.10).
// ═══════════════════════════════════════════════════════════════════════════
import crypto from 'node:crypto';
import { PROPRIETAIRE_NEUTRE } from './proprietaire-email.js';
import { utilisateurDe } from './session.js';
import { accesVendeur } from './abonnement.js';
import { prendreDebit, refuserTropVite } from './debit-vendeur.js';
import { fetchAvecDelai } from './fetch-delai.js';
import { sbCle } from './cle.js';
import { LIGNE_SIRI, LIGNE_SIRI_RETRAIT, QUESTIONS, LANGUES_SIRI, reponseSiri } from './siri-reponses.js';

export const RE_JETON_SIRI = /^vs1_[A-Za-z0-9_-]{43}$/;
export const nouveauJetonSiri = () => 'vs1_' + crypto.randomBytes(32).toString('base64url');
export const empreinteSiri = (j) => crypto.createHash('sha256').update(String(j || ''), 'utf8').digest('hex');
export const idIndexSiri = (h) => `jeton_siri_${h}`;
const RE_H = /^[0-9a-f]{64}$/;
const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Les colonnes LUES, rien d'autre (l'audit les compare à chaque requête servie).
export const SELECT_STATS_SIRI = 'jour:data->>jour,caJour:data->caJour,ventesJour:data->ventesJour,caJourNonComptees:data->caJourNonComptees,aExpedier:data->aExpedier,updatedAt:data->>updatedAt';
export const SELECT_RETRAIT_SIRI = 'at:data->at,total:data->total,prochains:data->prochains';

const egal = (a, b) => RE_H.test(String(a || '')) && RE_H.test(String(b || '')) && crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
const PAS_SU = { erreur: 'base-injoignable', message: "Je n'ai pas pu lire tes données — rien n'est perdu, c'est la lecture qui échoue." };

// Une ligne projetée : objet · null (absente) · undefined (pas su).
async function lireUne(ctx, chemin) {
  try {
    const r = await ctx.fetcher(`${ctx.url}/rest/v1/${chemin}`, { headers: ctx.h });
    if (!r || !r.ok) return undefined;
    const j = await r.json();
    return Array.isArray(j) ? (j[0] || null) : undefined;
  } catch (_) { return undefined; }
}
async function ecrire(ctx, lignes) {
  try {
    const r = await ctx.fetcher(`${ctx.url}/rest/v1/app_data?on_conflict=owner,id`, {
      method: 'POST', headers: { ...ctx.h, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(lignes),
    });
    return !!(r && r.ok);
  } catch (_) { return false; }
}
async function supprimerIndex(ctx, h) {
  if (!RE_H.test(String(h || ''))) return true;
  try {
    const r = await ctx.fetcher(`${ctx.url}/rest/v1/app_data?owner=eq.${PROPRIETAIRE_NEUTRE}&id=eq.${idIndexSiri(h)}`, { method: 'DELETE', headers: { ...ctx.h, Prefer: 'return=minimal' } });
    return !!(r && r.ok);
  } catch (_) { return false; }
}
const ligneSiriDe = (ctx, owner) => lireUne(ctx, `app_data?owner=eq.${encodeURIComponent(owner)}&id=eq.${LIGNE_SIRI}&select=h:data->>h,at:data->>at,debut:data->>debut,langue:data->>langue&limit=1`);

// ── Créer / couper (la session du vendeur) ──────────────────────────────────
async function gerer(req, res, ctx) {
  const u = await ctx.utilisateur(req);
  if (u === undefined) return res.status(503).json({ erreur: 'connexion-injoignable', message: 'Le service de connexion ne répond pas : réessaie dans un instant.' });
  if (!u || !RE_UUID.test(String(u.id || ''))) return res.status(401).json({ erreur: 'session', message: 'Reconnecte-toi à VRM, puis réessaie.' });
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (_) { b = null; } }
  const action = b && typeof b === 'object' ? String(b.action || '') : '';
  const langue = b && LANGUES_SIRI.includes(b.langue) ? b.langue : 'fr';
  const avant = await ligneSiriDe(ctx, u.id);
  if (avant === undefined) return res.status(503).json(PAS_SU);
  const hAvant = avant && RE_H.test(String(avant.h || '')) ? String(avant.h) : '';
  const maint = new Date(ctx.maintenant()).toISOString();
  if (action === 'revoquer') {
    if (hAvant && !(await supprimerIndex(ctx, hAvant))) return res.status(503).json(PAS_SU);
    if (!(await ecrire(ctx, [{ owner: u.id, id: LIGNE_SIRI, data: { h: null, coupeAt: maint }, updated_at: maint }]))) return res.status(503).json(PAS_SU);
    return res.status(200).json({ ok: true, actif: false });
  }
  if (action !== 'creer') return res.status(400).json({ erreur: 'action', message: 'Action inconnue.' });
  if (hAvant && !(await supprimerIndex(ctx, hAvant))) return res.status(503).json(PAS_SU);   // l'ancien est coupé d'abord
  const jeton = nouveauJetonSiri(), h = empreinteSiri(jeton);
  const debut = jeton.slice(4, 8);
  // La ligne du vendeur d'abord (empreinte seule), puis l'index : un index sans ligne n'ouvre rien.
  if (!(await ecrire(ctx, [{ owner: u.id, id: LIGNE_SIRI, data: { h, at: maint, debut, langue }, updated_at: maint }]))) return res.status(503).json(PAS_SU);
  if (!(await ecrire(ctx, [{ owner: PROPRIETAIRE_NEUTRE, id: idIndexSiri(h), data: { owner: u.id, genre: 'siri', at: maint }, updated_at: maint }]))) return res.status(503).json(PAS_SU);
  return res.status(200).json({ ok: true, actif: true, jeton, debut, at: maint });
}

// ── Répondre (le jeton du Raccourci) ────────────────────────────────────────
async function repondre(req, res, ctx) {
  const k = String((req.query && req.query.k) || (req.headers && req.headers['x-vrm-key']) || '');
  const json = String((req.query && req.query.format) || '') === 'json';
  const refus = () => res.status(401).json({ erreur: 'jeton', message: 'Ce raccourci n’est plus valable : crée un nouveau jeton dans VRM (Paramètres → Siri).' });
  if (!RE_JETON_SIRI.test(k)) return refus();   // aucune lecture pour un jeton mal formé
  const h = empreinteSiri(k);
  const idx = await lireUne(ctx, `app_data?owner=eq.${PROPRIETAIRE_NEUTRE}&id=eq.${idIndexSiri(h)}&select=o:data->>owner&limit=1`);
  if (idx === undefined) return res.status(503).json(PAS_SU);
  const owner = idx && RE_UUID.test(String(idx.o || '')) ? String(idx.o) : '';
  if (!owner) return refus();
  const ligne = await ligneSiriDe(ctx, owner);
  if (ligne === undefined) return res.status(503).json(PAS_SU);
  if (!ligne || !egal(h, ligne.h)) { await supprimerIndex(ctx, h); return refus(); }   // remplacé ou coupé : l'index périmé part
  { const d = ctx.debit('siri', owner); if (!d.ok) return refuserTropVite(res, d); }
  if ((await ctx.acces(owner)) === false) return res.status(402).json({ erreur: 'abonnement', message: "Ton abonnement VRM n'est plus actif." });
  const q = QUESTIONS.includes(String((req.query && req.query.q) || '')) ? String(req.query.q) : 'tout';
  const langue = LANGUES_SIRI.includes(String((req.query && req.query.l) || '')) ? String(req.query.l) : (LANGUES_SIRI.includes(ligne.langue) ? ligne.langue : 'fr');
  const o = `owner=eq.${encodeURIComponent(owner)}`;
  const [stats, retrait] = await Promise.all([
    q === 'retirer' ? Promise.resolve(null) : lireUne(ctx, `app_data?${o}&id=eq.widget_stats&select=${SELECT_STATS_SIRI}&limit=1`),
    q === 'vendu' || q === 'envoyer' ? Promise.resolve(null) : lireUne(ctx, `app_data?${o}&id=eq.${LIGNE_SIRI_RETRAIT}&select=${SELECT_RETRAIT_SIRI}&limit=1`),
  ]);
  if (stats === undefined || retrait === undefined) return res.status(503).json(PAS_SU);
  const r = reponseSiri(q, { stats, retrait, maintenant: ctx.maintenant(), langue });
  if (json) return res.status(200).json({ texte: r.texte, etat: r.etat, q });
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  return res.status(200).send(r.texte);
}

export async function routeSiri(req, res, { url, key, fetcher = fetchAvecDelai, utilisateur = utilisateurDe, acces = accesVendeur, debit = prendreDebit, maintenant = () => Date.now() } = {}) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Robots-Tag', 'noindex');
  const ctx = { url, h: { ...sbCle(key) }, fetcher, utilisateur, acces, debit, maintenant };
  try {
    if (req.method === 'POST') return await gerer(req, res, ctx);
    if (req.method === 'GET') return await repondre(req, res, ctx);
    return res.status(405).json({ erreur: 'methode' });
  } catch (_) {
    return res.status(500).json({ erreur: 'panne', message: "Je n'ai pas pu répondre — ce n'est pas « rien »." });
  }
}
