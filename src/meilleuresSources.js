// ════════════════════════════════════════════════════════════════════════════
//  TES MEILLEURES SOURCES (11 nov., lot « meilleurs fournisseurs »)
//  « Savoir où acheter ce qui se revend le mieux. »
//
//  « D'où viennent mes achats » (src/sourceAchats.js) part des VENTES ; ce module
//  part des ACHATS : par source (Vinted, Leboncoin, eBay, Vestiaire, brocante,
//  vide-grenier, magasin, un fournisseur QU'IL a créé, nommé…), combien
//  d'articles achetés, combien investi, combien revendus, le bénéfice et la marge
//  des revendus, le délai de revente, ce qui n'est pas encore revendu et depuis
//  quand. Chaque ligne rend la liste de SES achats.
//
//  §5 — L'IDENTITÉ, JAMAIS LA RESSEMBLANCE. Une vente n'est rattachée à un achat
//  QUE par :
//    · `buyFromId` = n° de transaction de l'achat Vinted (SON clic « Relier ») ;
//    · `buyGros.id` = un achat en gros chez un fournisseur QU'IL a créé (SON clic) ;
//    · le N° QU'IL a écrit sur un achat hors plateforme, s'il ne désigne qu'UN
//      achat hors plateforme (`horsParNumero`, la règle de `sourceDeVente`).
//  Jamais le titre, la marque, la taille, la photo. Une vente sans achat relié
//  n'entre dans le bénéfice d'AUCUNE source : elle est comptée à part, dite.
//
//  §5 — LES CHIFFRES. Le bénéfice d'une vente est celui de la règle unique
//  (`beneficeLigneVente` / `ventesAutresBenefice`), calculé par l'écran Ventes et
//  passé ici ; jamais refait. Chaque total dit sa couverture (« 12 revendus sur
//  30 achetés · 4 sans prix d'achat ») ; un prix illisible n'est pas un 0 ; un
//  bénéfice partiel (frais pas confirmés) se dit « au plus ». « Pas revendu »
//  veut dire « aucune vente RELIÉE » : une vente pas reliée à son achat laisse
//  l'achat ici — c'est dit à côté (jamais « en stock » affirmé sans preuve).
//
//  Module PUR (sauf la publication, sur l'appareil). Exécuté par
//  scripts/audit-meilleures-sources.cjs.
// ════════════════════════════════════════════════════════════════════════════
import { sourceSaisie, horsParNumero } from './sourceAchats.js';
import { motsVendeur } from './profilVendeur.js';

const J = 86400000;
const str = (v) => String(v == null ? '' : v).trim();
const txLien = (v) => { const t = str(v); return /^\d{4,20}$/.test(t) ? t : ''; };
const objet = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
// Une date lue ⇒ ms ; « 2026-11-03 » est lu à midi (jamais décalé d'un jour) ; illisible ⇒ null.
export function msDate(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? (v < 1e12 ? v * 1000 : v) : null;
  const s = str(v);
  const t = /^\d{4}-\d{2}-\d{2}$/.test(s) ? Date.parse(s + 'T12:00:00') : Date.parse(s);
  return Number.isFinite(t) ? t : null;
}
// Un montant en euros (nombre ou texte « 42,5 ») ⇒ centimes entiers, ou null.
export function centimes(v) {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(str(v).replace(/[\s €]/g, '').replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) return null;
  const c = Math.round(n * 100);
  return Number.isSafeInteger(c) ? c : null;
}

// ── L'ACHAT D'UNE VENTE (par identité seulement) ────────────────────────────
// entree : la fiche fusionnée de LA vente. ctx : { hors: horsParNumero(...), registre, cleNum }.
// Rend { genre: 'vinted'|'gros'|'hors', id } | null. Même ordre que `sourceDeVente`.
export function achatDeVente(entree, { hors = null, registre = null, cleNum = null } = {}) {
  const e = entree || {};
  const tx = txLien(e.buyFromId);
  if (tx) return { genre: 'vinted', id: tx };
  const reg = objet(registre);
  const g = e.buyGros && typeof e.buyGros === 'object' ? str(e.buyGros.id) : '';
  if (g && objet(reg.achats)[g]) return { genre: 'gros', id: g };
  const cn = typeof cleNum === 'function' ? cleNum : (x) => str(x).toUpperCase();
  const k = e.numero != null && str(e.numero) ? cn(e.numero) : '';
  const b = k && hors instanceof Map ? hors.get(k) : null;
  if (!b || b === 'ambigu' || b.id == null) return null;
  return { genre: 'hors', id: str(b.id) };
}

// La source d'un achat hors plateforme : rattaché à un fournisseur ⇒ ce fournisseur
// (par son NOM) ; sinon « Où » tel qu'il l'a saisi ; rien ⇒ « source pas saisie ».
function sourceHors(b, reg) {
  const h = objet(reg.hors)[str(b.id)];
  const p = h ? objet(reg.personnes)[h.fournisseur] : null;
  if (p) return { cle: 'fournisseur:' + h.fournisseur, libelle: p.nom, genre: 'Fournisseur' };
  const s = sourceSaisie(b.source);
  return s ? { cle: s.cle, libelle: s.libelle, genre: '' } : { cle: 'non-saisie', libelle: 'Source pas saisie', genre: '' };
}

// ── LE BILAN ────────────────────────────────────────────────────────────────
//   achatsVinted : les achats Vinted LUS (déjà sans compte écarté ni masqué) ;
//   estAnnule(o) : la règle de « Dépensé » (annulé, remboursé : pas un achat) ;
//   montantVinted(o) : le montant payé en euros | null (illisible, autre devise) ;
//   hors : achats hors plateforme ({ id, title, price, date, source, numero }) ;
//   prixHors(b) : € | null ; registre : `vrm_fournisseurs` (lireRegistre) ;
//   fiches, saleOv : `vinted_annonce_numeros` et les corrections de vente (le
//   NOMBRE d'articles d'un achat Vinted = ses articles reliés par `buyFromId`) ;
//   ventes : [{ id, ts, entree, prix: centimes | null, benefice: centimes | null,
//              partiel }] — les ventes prouvées, pas annulées, bénéfice de la règle ;
//   cleNum ; maintenant.
// Rend { sources: [...], sansAchat, ventesReliees, n } — `sources` dans l'ordre du
// bénéfice réalisé ; `classer(sources, 'vitesse')` pour l'autre ordre.
export function bilanSources({ achatsVinted = null, estAnnule = null, montantVinted = null, hors = [], prixHors = null,
  registre = null, fiches = {}, saleOv = {}, ventes = [], cleNum = null, maintenant = Date.now() } = {}) {
  const reg = { personnes: objet(objet(registre).personnes), achats: objet(objet(registre).achats), hors: objet(objet(registre).hors) };
  const achats = new Map();   // 'genre:id' → achat
  const groupe = new Map();   // cle → { cle, libelle, genre, achats: [] }
  const ajouterAchat = (a, src) => {
    achats.set(a.genre + ':' + a.id, a);
    a.source = src.cle;
    if (!groupe.has(src.cle)) groupe.set(src.cle, { cle: src.cle, libelle: src.libelle, genre: src.genre || '', achats: [] });
    groupe.get(src.cle).achats.push(a);
  };
  // Le nombre d'articles d'un achat Vinted : ses articles reliés (fiches + ventes), 1 au moins.
  const reliesVinted = new Map();
  const noter = (tx, k) => { if (!tx) return; if (!reliesVinted.has(tx)) reliesVinted.set(tx, new Set()); reliesVinted.get(tx).add(k); };
  for (const [k, e] of Object.entries(objet(fiches))) noter(txLien(e && e.buyFromId), 'f:' + k);
  for (const [k, e] of Object.entries(objet(saleOv))) noter(txLien(e && e.buyFromId), 'v:' + k);

  const vintedLus = Array.isArray(achatsVinted);
  for (const o of (vintedLus ? achatsVinted : [])) {
    const tx = txLien(o && o.transaction_id); if (!tx || achats.has('vinted:' + tx)) continue;
    if (typeof estAnnule === 'function' && estAnnule(o)) continue;
    const m = typeof montantVinted === 'function' ? montantVinted(o) : null;
    ajouterAchat({ genre: 'vinted', id: tx, titre: str(o.title).slice(0, 80), ts: msDate(o.date), investi: centimes(m),
      articles: Math.max(1, (reliesVinted.get(tx) || new Set()).size), ventes: [] }, { cle: 'vinted', libelle: 'Vinted' });
  }
  for (const [id, a] of Object.entries(reg.achats)) {
    const p = reg.personnes[a.fournisseur]; if (!p) continue;
    ajouterAchat({ genre: 'gros', id: str(id), titre: `Achat en gros · ${a.paires} ${a.paires > 1 ? motsVendeur().noms : motsVendeur().nom}`, ts: msDate(a.date),
      investi: Number.isSafeInteger(a.total) ? a.total + (a.frais || 0) : null, articles: a.paires, ventes: [] },
    { cle: 'fournisseur:' + a.fournisseur, libelle: p.nom, genre: 'Fournisseur' });
  }
  for (const b of (Array.isArray(hors) ? hors : [])) {
    if (!b || b.id == null || achats.has('hors:' + str(b.id))) continue;
    const p = typeof prixHors === 'function' ? prixHors(b) : null;
    ajouterAchat({ genre: 'hors', id: str(b.id), titre: str(b.title).slice(0, 80), ts: msDate(b.date), investi: centimes(p),
      articles: 1, numero: b.numero != null ? str(b.numero) : '', ventes: [] }, sourceHors(b, reg));
  }

  // Les ventes, rattachées par identité. Une vente déjà vue ne compte qu'une fois.
  const ctx = { hors: horsParNumero(hors, cleNum), registre: reg, cleNum };
  let sansAchat = 0, ventesReliees = 0, achatPasLu = 0;
  const vues = new Set();
  for (const v of (Array.isArray(ventes) ? ventes : [])) {
    if (!v || v.id == null || vues.has(str(v.id))) continue; vues.add(str(v.id));
    const id = v.entree ? achatDeVente(v.entree, ctx) : null;
    const a = id ? achats.get(id.genre + ':' + id.id) : null;
    if (!a) { if (id) achatPasLu++; else sansAchat++; continue; }
    ventesReliees++;
    a.ventes.push({ id: str(v.id), ts: Number.isFinite(v.ts) ? v.ts : null, prix: Number.isSafeInteger(v.prix) ? v.prix : null,
      benefice: Number.isSafeInteger(v.benefice) ? v.benefice : null, partiel: !!v.partiel });
  }

  const sources = [...groupe.values()].map((g) => resumer(g, maintenant));
  return { sources: classer(sources, 'benefice'), sansAchat, achatPasLu, ventesReliees, vintedLus, n: sources.length };
}

// Une source : ses chiffres, et la couverture de chacun.
function resumer(g, maintenant) {
  let articles = 0, investi = 0, sansPrix = 0, revendus = 0, benefice = 0, nBenef = 0, caBenef = 0, partiel = false;
  let delaiSomme = 0, nDelai = 0, attenteSomme = 0, nAttente = 0, plusVieux = null, pasRevendus = 0, sansDate = 0;
  const liste = [];
  for (const a of g.achats) {
    articles += a.articles;
    if (a.investi == null) sansPrix++; else investi += a.investi;
    // Un achat de N articles ne peut pas avoir plus de N revendus comptés (un lien en trop n'invente rien).
    const vs = a.ventes.slice().sort((x, y) => (x.ts || 0) - (y.ts || 0)).slice(0, a.articles);
    revendus += vs.length;
    for (const v of vs) {
      if (v.benefice != null) { benefice += v.benefice; nBenef++; if (v.prix != null && v.prix > 0) caBenef += v.prix; else caBenef = NaN; if (v.partiel) partiel = true; }
      if (a.ts != null && v.ts != null && v.ts >= a.ts) { delaiSomme += v.ts - a.ts; nDelai++; }
    }
    const reste = a.articles - vs.length;
    if (reste > 0) {
      pasRevendus += reste;
      if (a.ts != null && a.ts <= maintenant) { const age = maintenant - a.ts; attenteSomme += age * reste; nAttente += reste; if (plusVieux == null || age > plusVieux) plusVieux = age; }
      else sansDate += reste;
    }
    liste.push({ genre: a.genre, id: a.id, titre: a.titre, ts: a.ts, investi: a.investi, articles: a.articles, numero: a.numero || '',
      revendus: vs.length, benefice: vs.some((v) => v.benefice != null) ? vs.reduce((s, v) => s + (v.benefice || 0), 0) : null,
      partiel: vs.some((v) => v.partiel), venduLe: vs.length ? vs[vs.length - 1].ts : null });
  }
  liste.sort((x, y) => (y.ts || 0) - (x.ts || 0) || x.id.localeCompare(y.id));
  return {
    cle: g.cle, libelle: g.libelle, genre: g.genre,
    achats: g.achats.length, articles, investi: sansPrix === g.achats.length ? null : investi, sansPrix,
    revendus, benefice: nBenef ? benefice : null, nBenef, partiel,
    beneficeMoyen: nBenef ? Math.round(benefice / nBenef) : null,
    // La marge sur ce que les ventes au bénéfice connu ont rapporté ; un prix de vente inconnu ⇒ pas de marge.
    marge: nBenef && Number.isFinite(caBenef) && caBenef > 0 ? Math.round((benefice / caBenef) * 1000) / 10 : null,
    delaiMoyen: nDelai ? Math.round(delaiSomme / nDelai / J) : null, nDelai,
    pasRevendus, attenteMoyenne: nAttente ? Math.round(attenteSomme / nAttente / J) : null, plusVieux: plusVieux == null ? null : Math.floor(plusVieux / J), sansDate,
    liste,
  };
}

// L'ordre du classement. « benefice » : le bénéfice réalisé (connu) d'abord ;
// « vitesse » : le délai moyen de revente le plus court d'abord. Une source sans
// la mesure va à la fin (jamais classée sur un chiffre qu'elle n'a pas) ;
// « source pas saisie » toujours en dernier (ce n'est pas une source).
export function classer(sources, par = 'benefice') {
  const l = (Array.isArray(sources) ? sources : []).slice();
  const v = par === 'vitesse' ? (s) => s.delaiMoyen : (s) => s.benefice;
  l.sort((a, b) => (a.cle === 'non-saisie') - (b.cle === 'non-saisie')
    || (v(a) == null) - (v(b) == null)
    || (par === 'vitesse' ? (v(a) - v(b)) : (v(b) - v(a)))
    || b.revendus - a.revendus || a.libelle.localeCompare(b.libelle, 'fr'));
  return l;
}

// ── LES MOTS (une seule source pour l'écran et l'audit) ─────────────────────
const pl = (n, s, p) => `${n} ${n > 1 ? (p || s + 's') : s}`;
export function euros(c, { signe = false } = {}) {
  if (c == null || !Number.isFinite(c)) return '—';
  const e = Math.round(Math.abs(c) / 100);
  const t = String(e).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' €';
  return (c < 0 ? '−' : (signe && c > 0 ? '+' : '')) + t;
}
export const jours = (n) => (n == null ? '—' : n < 1 ? 'moins d’un jour' : pl(n, 'jour'));
// « 12 revendus sur 30 achetés · 4 sans prix d'achat »
export function texteCouvertureSource(s) {
  if (!s) return '';
  let t = `${s.revendus} revendu${s.revendus > 1 ? 's' : ''} sur ${s.articles} acheté${s.articles > 1 ? 's' : ''}`;
  if (s.sansPrix) t += ` · ${s.sansPrix} sans prix d’achat`;
  if (s.revendus && s.nBenef < s.revendus) t += ` · bénéfice connu pour ${s.nBenef}`;
  return t;
}
// « +420 € » · « au plus +420 € » · « — »
export function texteBenefice(s) {
  if (!s || s.benefice == null) return '—';
  return (s.partiel ? 'au plus ' : '') + euros(s.benefice, { signe: true });
}
// « 300 € » · « au moins 300 € » (un achat au prix illisible) · « — »
export function texteInvesti(s) {
  if (!s || s.investi == null) return '—';
  return (s.sansPrix ? 'au moins ' : '') + euros(s.investi);
}
export const texteMarge = (s) => (s && s.marge != null ? `${String(s.marge).replace('.', ',')} %` : '—');
// « revendu en 18 jours en moyenne · sur 9 » ; rien de mesurable ⇒ « — »
export function texteDelai(s) {
  if (!s || s.delaiMoyen == null) return '—';
  return `${jours(s.delaiMoyen)}${s.nDelai < s.revendus ? ` · sur ${s.nDelai}` : ''}`;
}
// « 18 pas encore revendus · depuis 41 jours en moyenne (le plus ancien : 94) »
export function texteAttente(s) {
  if (!s || !s.pasRevendus) return 'tout est revendu';
  let t = `${pl(s.pasRevendus, 'article')} pas encore revendu${s.pasRevendus > 1 ? 's' : ''}`;
  if (s.attenteMoyenne != null) t += ` · depuis ${jours(s.attenteMoyenne)} en moyenne`;
  if (s.plusVieux != null && s.plusVieux > (s.attenteMoyenne || 0)) t += ` (le plus ancien : ${jours(s.plusVieux)})`;
  if (s.sansDate) t += ` · ${s.sansDate} sans date d’achat`;
  return t;
}
// La phrase du bas de la carte : ce qui n'est compté dans AUCUNE source.
export function texteHorsSources(r) {
  if (!r) return [];
  const l = [];
  if (r.sansAchat) l.push(`${pl(r.sansAchat, 'vente')} sans achat relié : comptée${r.sansAchat > 1 ? 's' : ''} dans aucune source (Ventes → la vente → « Relier un achat »).`);
  if (r.achatPasLu) l.push(`${pl(r.achatPasLu, 'vente')} reliée${r.achatPasLu > 1 ? 's' : ''} à un achat Vinted pas lu ici (compte écarté ou achat masqué).`);
  if (r.vintedLus === false) l.push('Achats Vinted pas lus : ouvre Achats pour les compter.');
  return l;
}

// ── LA PUBLICATION (un propriétaire : l'écran Ventes/Achats ; lecteurs : Argent, Achats) ──
export const CLE_MEILLEURES = 'vrm_meilleures_sources';
export const EVT_MEILLEURES = 'vrm:meilleures-sources';
export function publierMeilleures(r, { owner = '' } = {}) {
  if (!r || !Array.isArray(r.sources)) return;
  const p = { v: 1, owner: str(owner), r };
  try {
    const neuf = JSON.stringify(p);
    const avant = localStorage.getItem(CLE_MEILLEURES);
    if (avant && avant.replace(/,"at":\d+}$/, '}') === neuf) return;
    localStorage.setItem(CLE_MEILLEURES, neuf.replace(/}$/, `,"at":${Date.now()}}`));
  } catch (_) { /* stockage refusé : la carte dit « — » */ }
  try { window.dispatchEvent(new CustomEvent(EVT_MEILLEURES)); } catch (_) {}
}
// null = jamais publiée pour CE compte VRM (pas su ⇒ « — »).
export function lireMeilleures(owner = '') {
  try {
    const p = JSON.parse(localStorage.getItem(CLE_MEILLEURES) || 'null');
    if (!p || p.v !== 1 || str(p.owner) !== str(owner) || !p.r || !Array.isArray(p.r.sources)) return null;
    return { ...p.r, at: p.at || null };
  } catch (_) { return null; }
}
