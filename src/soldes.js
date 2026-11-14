// ═══════════════════════════════════════════════════════════════════════════
// SOLDES TEMPORAIRES (14 nov., lot argent-prix — proposition 114 validée par
// Julien : « une sélection de paires baissée jusqu'à une date, puis les prix
// d'origine remis sur son clic »)
// ═══════════════════════════════════════════════════════════════════════════
// AUCUN chemin d'envoi neuf : la baisse est la feuille « Baisser le prix »
// existante (src/BaissePrixSerie.jsx → `baisserPrixVinted` / `baisserPrixLbc`,
// une commande à la fois, 45/h, compte de l'onglet, prix lu avant et RELU après).
// Ce module ne fait que MÉMORISER et PROPOSER — il n'envoie jamais rien :
//   · `enregistrerSolde` : après la série, les seules baisses ACCEPTÉES ET RELUES
//     (`etape` 'fait') sont gardées, avec le prix d'ORIGINE = l'ancien prix que
//     l'extension a LU avant d'envoyer (`r.ancien`), jamais un prix supposé ; par
//     IDENTITÉ (site + compte + identifiant d'annonce, §5), jamais par titre ;
//     une paire déjà en solde garde son PREMIER prix d'origine (une seconde baisse
//     pendant le solde ne l'écrase pas) ;
//   · `soldesARemettre` : à partir du jour de fin (heure de Paris), la liste que
//     Ma journée PROPOSE (« Remettre les prix ») — une proposition, pas un geste ;
//   · `lignesRemise` : pour chaque paire, le prix ACTUEL lu dans ses annonces :
//     absente (vendue, retirée) ⇒ rien ; prix changé depuis le solde (par lui) ⇒
//     rien, dit ; sinon « remettre » de `solde` vers `origine`.
// ⚠️ La remise automatique serait une action qu'il n'a pas lancée (§3) : VRM ne
//    remet JAMAIS un prix seul. La commande part de « Remettre N prix », sur SON
//    clic, avec `remise: true` et le prix d'origine — l'extension (5.376) refuse
//    une hausse sans ces deux-là.
// Rangé dans `vrm_soldes` (SYNC_KEYS : le même sur tous ses appareils).
// Module PUR. Exécuté par scripts/audit-argent-prix.cjs (section 114).
// ═══════════════════════════════════════════════════════════════════════════

export const CLE_SOLDES = 'vrm_soldes';
export const SITES_SOLDE = ['vinted', 'leboncoin', 'vestiaire'];
export const SOLDE_MAX_J = 90;
const c = (v) => { const n = Number(String(v == null ? '' : v).replace(',', '.')); return Number.isFinite(n) ? Math.round(n * 100) : NaN; };
const RE_JOUR = /^\d{4}-\d{2}-\d{2}$/;

export const jourParis = (ms) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
const plusJours = (jour, n) => { const [y, m, d] = jour.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
export const clePaire = (p) => `${p.site}|${String(p.uid || '')}|${String(p.id || '')}`;

// Le jour de fin tapé : demain au plus tôt, dans SOLDE_MAX_J jours au plus.
export function finValide(fin, maintenant = Date.now()) {
  const f = String(fin || '');
  if (!RE_JOUR.test(f)) return { ok: false, raison: 'date' };
  const auj = jourParis(maintenant);
  if (f <= auj) return { ok: false, raison: 'passee' };
  if (f > plusJours(auj, SOLDE_MAX_J)) return { ok: false, raison: 'loin' };
  return { ok: true, fin: f };
}

export const etatVide = () => ({ v: 1, soldes: [] });
const lisible = (e) => (e && typeof e === 'object' && Array.isArray(e.soldes) ? e : etatVide());

// Les paires EN SOLDE (pas encore remises ni gardées), par identité.
export function pairesEnSolde(etat) {
  const m = new Map();
  for (const s of lisible(etat).soldes) for (const p of s.paires || []) if (p && p.etat === 'baisse') m.set(clePaire(p), { ...p, soldeId: s.id, fin: s.fin });
  return m;
}

// `faites` : les réponses de la série [{ ligne:{ site?, uid, id, num, titre }, r:{ accepte, etape, ancien, prixVu } }].
// Rend { etat (nouveau), n (paires gardées), ecartees (pas relues ⇒ pas en solde) }.
export function enregistrerSolde(etat, { fin, site = 'vinted', faites = [], maintenant = Date.now(), id = null } = {}) {
  const v = finValide(fin, maintenant);
  if (!v.ok || !SITES_SOLDE.includes(site)) return { etat: lisible(etat), n: 0, ecartees: faites.length, refus: v.ok ? 'site' : v.raison };
  const E = lisible(etat);
  const deja = pairesEnSolde(E);
  const paires = []; let ecartees = 0;
  for (const f of faites) {
    const l = f && f.ligne, r = f && f.r;
    if (!l || !r || !r.accepte || r.etape !== 'fait' || l.id == null) { ecartees++; continue; }
    const origine = c(r.ancien), solde = c(r.prixVu);
    if (!(origine > 0) || !(solde > 0) || !(solde < origine)) { ecartees++; continue; }
    const p = { site, uid: String(l.uid || ''), id: String(l.id), num: String(l.num || ''), titre: String(l.titre || '').slice(0, 90), origine: origine / 100, solde: solde / 100, etat: 'baisse' };
    const avant = deja.get(clePaire(p));
    if (avant) p.origine = avant.origine;     // le PREMIER prix d'origine reste
    paires.push(p);
  }
  if (!paires.length) return { etat: E, n: 0, ecartees };
  const cles = new Set(paires.map(clePaire));
  // Une paire re-soldée quitte son ancien solde (elle ne peut pas être remise deux fois).
  const anciens = E.soldes.map((s) => ({ ...s, paires: (s.paires || []).map((p) => (p.etat === 'baisse' && cles.has(clePaire(p)) ? { ...p, etat: 'deplace' } : p)) }));
  const nouveau = { id: id || `s${maintenant.toString(36)}`, cree: new Date(maintenant).toISOString(), fin: v.fin, site, paires };
  return { etat: { v: 1, soldes: [...anciens, nouveau] }, n: paires.length, ecartees };
}

// Ce que Ma journée PROPOSE : les soldes finis (jour de fin atteint, heure de Paris)
// qui ont encore des paires à remettre. Une proposition seulement.
export function soldesARemettre(etat, maintenant = Date.now()) {
  const auj = jourParis(maintenant);
  return lisible(etat).soldes
    .filter((s) => s && RE_JOUR.test(String(s.fin || '')) && s.fin <= auj)
    .map((s) => ({ id: s.id, fin: s.fin, site: s.site, paires: (s.paires || []).filter((p) => p.etat === 'baisse') }))
    .filter((s) => s.paires.length > 0);
}
export function soldesEnCours(etat, maintenant = Date.now()) {
  const auj = jourParis(maintenant);
  return lisible(etat).soldes.filter((s) => s && String(s.fin || '') > auj && (s.paires || []).some((p) => p.etat === 'baisse'))
    .map((s) => ({ id: s.id, fin: s.fin, site: s.site, n: s.paires.filter((p) => p.etat === 'baisse').length }));
}

// La remise d'un solde. `prixActuel(p)` → le prix LU aujourd'hui dans ses annonces
// (€), `null` si l'annonce n'y est plus, `undefined` si les annonces ne sont pas lues.
export function lignesRemise(paires, prixActuel) {
  return (paires || []).map((p) => {
    const lu = typeof prixActuel === 'function' ? prixActuel(p) : undefined;
    if (lu === undefined) return { ...p, action: 'passu', de: null, vers: p.origine };
    if (lu === null) return { ...p, action: 'absente', de: null, vers: p.origine };
    const cl = c(lu);
    if (cl === c(p.origine)) return { ...p, action: 'deja', de: lu, vers: p.origine };
    if (cl !== c(p.solde)) return { ...p, action: 'change', de: lu, vers: p.origine };
    return { ...p, action: 'remettre', de: lu, vers: p.origine };
  });
}

// La commande d'une remise (partie SEULEMENT d'un clic sur « Remettre N prix ») :
// `prixAvant` = le prix lu, `prix` = l'origine, `remise: true`, `prixOrigine` = l'origine.
export function commandeRemise(l, uidOnglet) {
  if (!l || l.action !== 'remettre') return null;
  const base = { remise: true, confirme: true, prixOrigine: l.vers };
  if (l.site === 'vinted') return { cmd: 'baisserPrixVinted', uid: l.uid, id: l.id, prix: l.vers, prixAvant: l.de, ...base };
  if (l.site === 'leboncoin') return { cmd: 'lbcPrix', id: String(l.id), prix: Number(l.vers), prixAvant: Number(l.de), ...base };
  if (l.site === 'vestiaire') return { cmd: 'vcPrix', produit: String(l.id), avantCents: c(l.de), apresCents: c(l.vers), ...base };
  void uidOnglet;
  return null;
}

// Le sens d'une réponse : 'fait' (relu au prix d'origine) · 'ecart' · 'incertain' · 'refus'.
export function issueRemise(r, l) {
  if (!r || r.accepte !== true) return 'refus';
  if (r.etape === 'fait' && (r.prixVu == null || c(r.prixVu) === c(l.vers))) return r.prixVu == null ? 'incertain' : 'fait';
  if (r.etape === 'ecart') return 'ecart';
  if (r.etape === 'incertain') return 'incertain';
  return 'refus';
}

// Après la remise : 'fait' ⇒ la paire est remise ; 'absente'/'deja'/'change' ⇒ elle sort
// du solde (rien à remettre) ; un refus ou un « pas relu » la laisse en solde (reproposée).
export function noterRemise(etat, soldeId, issues) {
  const E = lisible(etat);
  const m = issues instanceof Map ? issues : new Map(Object.entries(issues || {}));
  return { v: 1, soldes: E.soldes.map((s) => (s.id !== soldeId ? s : { ...s, paires: (s.paires || []).map((p) => {
    const i = m.get(clePaire(p));
    if (p.etat !== 'baisse' || !i) return p;
    if (i === 'fait') return { ...p, etat: 'remis' };
    if (i === 'absente' || i === 'deja' || i === 'change') return { ...p, etat: i };
    return p;
  }) })) };
}
// « Garder les prix soldés » : SON choix, rien n'est envoyé ; le solde ne se repropose plus.
export const garderSolde = (etat, soldeId) => {
  const E = lisible(etat);
  return { v: 1, soldes: E.soldes.map((s) => (s.id !== soldeId ? s : { ...s, paires: (s.paires || []).map((p) => (p.etat === 'baisse' ? { ...p, etat: 'garde' } : p)) })) };
};
