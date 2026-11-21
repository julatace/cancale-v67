// ─────────────────────────────────────────────────────────────────────────────
// LES ACHATS LUS DANS LES E-MAILS, CÔTÉ APP (11 nov., lot achats-auto)
//
// Le serveur range UNE ligne par achat (`achat_email_{site}_{n° de commande}`,
// api/_lib/achats-email.js) et une ligne par e-mail « à vérifier »
// (`achat_email_verif_*`). Il n'écrit JAMAIS `main` : un achat lu n'entre dans
// « dépensé » qu'une fois dans `vinted_offvinted_buys`, par SON clic (§2.5 : il
// saisit ses prix lui-même ; le prix lu est PROPOSÉ, marqué « lu dans l'e-mail »).
//
// L'IDENTITÉ entre un achat lu et un achat saisi à la main : le n° de commande
// (`refAchat`, la règle des achats en double, src/achatsDoubles.js) — jamais le
// titre, le prix ou la date (§5). Un achat à la main de même référence est
// COMPLÉTÉ (ses champs vides seulement ; son prix gagne toujours).
// Pur : exécuté par scripts/audit-achats-email.cjs.
// ─────────────────────────────────────────────────────────────────────────────
import { refAchat } from './achatsDoubles.js';

export const PREFIXE_ACHAT_EMAIL = 'achat_email_';
export const PREFIXE_A_VERIFIER = 'achat_email_verif_';
// Lignes légères (aucun texte brut, aucune pièce jointe) : projetées quand même.
export const SELECT_ACHATS_EMAIL = 'id,site:data->>site,commande:data->>commande,titre:data->>titre,date:data->>date,prix:data->prix,photo:data->>photo,suivi:data->>suivi,annule:data->>annule,rembourse:data->>rembourse,desaccords:data->desaccords,raison:data->>raison,famille:data->>famille,lecture:data->lecture,emailAt:data->>emailAt,aVerifier:data->>aVerifier';

const SITES = ['leboncoin', 'ebay', 'vestiaire'];
const NOM_SITE = { leboncoin: 'Leboncoin', ebay: 'eBay', vestiaire: 'Vestiaire Collective' };
export const nomSiteAchat = (s) => NOM_SITE[s] || '';

// rows ⇒ { achats, aVerifier } ; `null` (lecture ratée) ⇒ `null` (pas su, jamais []).
export function lignesAchatsEmail(rows) {
  if (!Array.isArray(rows)) return null;
  const achats = [], aVerifier = [];
  for (const r of rows) {
    if (!r || typeof r.id !== 'string' || !SITES.includes(r.site)) continue;
    if (r.id.startsWith(PREFIXE_A_VERIFIER)) { aVerifier.push({ id: r.id, site: r.site, famille: r.famille || '', raison: r.raison || '', lecture: r.lecture && typeof r.lecture === 'object' ? r.lecture : {}, emailAt: r.emailAt || '' }); continue; }
    if (!r.commande) continue;
    const p = r.prix && typeof r.prix === 'object' ? r.prix : {};
    const n = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
    achats.push({ id: r.id, site: r.site, commande: String(r.commande), titre: r.titre || '', date: r.date || '', photo: r.photo || '', suivi: r.suivi || '',
      prix: { article: n(p.article), port: n(p.port), protection: n(p.protection), total: n(p.total) },
      annule: !!r.annule, rembourse: !!r.rembourse, desaccords: Array.isArray(r.desaccords) ? r.desaccords : [] });
  }
  const t = (x) => Date.parse(x.date || x.emailAt || '') || 0;
  achats.sort((a, b) => t(b) - t(a));
  aVerifier.sort((a, b) => t(b) - t(a));
  return { achats, aVerifier };
}

// Le prix en texte « 51,50 » (la forme de `vinted_offvinted_buys`), ou '' (pas su).
const prixTexte = (v) => (typeof v === 'number' && Number.isFinite(v) ? v.toFixed(2).replace('.', ',') : '');
const jour = (d) => { const s = String(d || ''); if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; const t = Date.parse(s); if (!Number.isFinite(t)) return ''; return new Date(t).toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' }); };

// L'entrée `vinted_offvinted_buys` créée par SON clic « Ajouter à mes achats ».
export function entreeDepuisEmail(a) {
  return { title: a.titre || `${nomSiteAchat(a.site)} · commande ${a.commande}`, price: prixTexte(a.prix.total), date: jour(a.date), source: nomSiteAchat(a.site),
    ref: String(a.commande).slice(0, 40), prixSource: 'email', site: a.site, achatEmail: a.id,
    ...(a.prix.port != null ? { port: prixTexte(a.prix.port) } : {}), ...(a.prix.protection != null ? { protection: prixTexte(a.prix.protection) } : {}) };
}

// Ce qu'un achat saisi à la main recevrait : ses champs VIDES seulement.
export function completion(manuel, a) {
  const e = entreeDepuisEmail(a);
  const patch = {};
  if (!String(manuel.title || '').trim() && a.titre) patch.title = e.title;
  if (!String(manuel.price || '').trim() && e.price) { patch.price = e.price; patch.prixSource = 'email'; }
  if (!String(manuel.date || '').trim() && e.date) patch.date = e.date;
  if (!String(manuel.source || '').trim()) patch.source = e.source;
  if (!manuel.port && e.port) patch.port = e.port;
  if (!manuel.protection && e.protection) patch.protection = e.protection;
  if (!manuel.achatEmail) patch.achatEmail = a.id;
  return patch;
}

// Chaque achat lu, avec son jumeau saisi à la main (même référence) s'il existe.
// `etat` : 'annule' (annulé ou remboursé : jamais un coût) · 'relie' (déjà dans
// ses achats) · 'nouveau'. `patch` : ce que « Compléter » écrirait (vide ⇒ rien).
export function fusionAchatsAuto(manuels, autos) {
  const parRef = new Map();
  for (const b of Array.isArray(manuels) ? manuels : []) {
    const r = b && refAchat(b.ref);
    if (r && !parRef.has(r)) parRef.set(r, b);
  }
  return (Array.isArray(autos) ? autos : []).map((a) => {
    const r = refAchat(a.commande);
    const manuel = r ? parRef.get(r) || null : null;
    const fini = a.annule || a.rembourse;
    const patch = manuel ? completion(manuel, a) : null;
    const utile = patch ? Object.keys(patch).filter((k) => k !== 'achatEmail') : [];
    return { a, manuel, etat: fini ? 'annule' : manuel ? 'relie' : 'nouveau', patch: utile.length ? patch : null };
  });
}
