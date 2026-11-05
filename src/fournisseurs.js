// ════════════════════════════════════════════════════════════════════════════
//  FOURNISSEURS : LES PERSONNES À QUI IL ACHÈTE EN GROS (5 nov.)
// ════════════════════════════════════════════════════════════════════════════
// Julien, 5 nov., mot pour mot : « le fournisseur dans achat, c'est pas du tout
// ça c'est une personne à qui tu achètes en gros pas des vendeurs particuliers
// sur vinted ». La feuille du 4 nov. faisait un fournisseur de CHAQUE vendeur
// Vinted chez qui il avait acheté : retiré.
//
// Un fournisseur est une personne qu'IL crée (nom ; téléphone, e-mail, note en
// option). Il le modifie ou le retire. Rien d'autre n'en crée : ce module ne
// reçoit JAMAIS les achats Vinted (aucun paramètre ne les porte) — la liste ne
// peut venir que du registre qu'il a rempli.
//
// Rangé dans la ligne `main`, clé synchronisée `vrm_fournisseurs` (fusion clé par
// clé, comme les autres réglages) :
//   { personnes: { [id]: { nom, tel, email, note, creeLe } },
//     achats:    { [id]: { fournisseur, date: 'AAAA-MM-JJ', paires, total, frais,
//                          repartition: { mode: 'egal' | 'main', base: 'prix' | 'frais' | '' },
//                          parts: { [clé de fiche]: centimes },
//                          gardes: { [clé de fiche]: centimes }, creeLe } },   // ses « Garder ce prix »
//     hors:      { [id d'un achat hors plateforme]: { fournisseur, at } } }
// Montants en CENTIMES entiers.
//
// §5 « l'identité d'une paire » — une paire n'est reliée à un achat en gros QUE
// par SON clic : le champ `buyGros: { id, at, part, avant }` posé sur SA fiche
// (`vinted_annonce_numeros`). Jamais le titre, la marque, la taille, la photo.
// `part` = le prix que CE lot a écrit ; `avant` = le prix d'avant, s'il a
// accepté de le remplacer (rendu en déliant).
//
// §2.5 « il saisit ses prix d'achat lui-même » — la part d'une paire vient de
// la répartition QU'IL a choisie (part égale, ou paire par paire). Un prix déjà
// saisi à la main n'est JAMAIS remplacé sans qu'il le demande (`remplacer`).
//
// §5 « les chiffres » — trois états : valeur lue · `null` « — » · couverture dite.
//   · « Dépensé » = ses achats en gros (prix + frais) et les achats hors
//     plateforme qu'il a rattachés ; un prix illisible ⇒ « au moins » + combien ;
//   · « Bénéfice » = la règle propriétaire (`beneficeLigneVente`,
//     `ventesAutresBenefice`, calculée par l'appelant) sur les paires reliées ET
//     vendues ; seulement les ventes au bénéfice connu, avec la couverture
//     « sur 12 vendues, prix d'achat connu pour 9 ». JAMAIS « au moins » sur un
//     bénéfice (une paire au prix inconnu peut être vendue à perte :
//     src/beneficeNoms.js) ; « au plus » quand des frais ne sont pas confirmés.
// Module PUR : aucune lecture, aucune écriture. Exécuté par
// scripts/audit-fournisseurs.cjs ; rendu par src/AchatsOutils.jsx.
// ─────────────────────────────────────────────────────────────────────────────
import { centimesDe, partsEgales } from './achatsSourcing.js';

export const CLE_FOURNISSEURS = 'vrm_fournisseurs';
export const SOURCE_FOURNISSEUR = 'Fournisseur';
const MAX_NOM = 60, MAX_NOTE = 500, MAX_PAIRES = 9999;

const str = (v) => String(v == null ? '' : v).trim();
const objet = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const entier = (v) => (Number.isSafeInteger(v) ? v : null);
const jourOk = (d) => /^\d{4}-\d{2}-\d{2}$/.test(str(d)) && Number.isFinite(Date.parse(str(d) + 'T12:00:00Z'));

// ── LE REGISTRE ─────────────────────────────────────────────────────────────
// Ce qui est rangé, nettoyé. Un achat dont le fournisseur n'existe plus, une
// ligne illisible : écartés (jamais réparés au hasard).
export function lireRegistre(v) {
  const o = objet(v);
  const personnes = {}, achats = {}, hors = {};
  for (const [id, p] of Object.entries(objet(o.personnes))) {
    if (!p || typeof p !== 'object' || !str(p.nom)) continue;
    personnes[id] = { nom: str(p.nom).slice(0, MAX_NOM), tel: str(p.tel).slice(0, 40), email: str(p.email).slice(0, 120), note: String(p.note == null ? '' : p.note).slice(0, MAX_NOTE), creeLe: str(p.creeLe) };
  }
  for (const [id, a] of Object.entries(objet(o.achats))) {
    if (!a || typeof a !== 'object' || !personnes[a.fournisseur]) continue;
    const paires = entier(a.paires), total = entier(a.total);
    if (paires == null || paires < 1 || paires > MAX_PAIRES || total == null || total < 0) continue;
    const frais = entier(a.frais);
    const r = objet(a.repartition);
    const parts = {};
    for (const [k, c] of Object.entries(objet(a.parts))) if (Number.isSafeInteger(c) && c >= 0) parts[k] = c;
    const gardes = {};
    for (const [k, c] of Object.entries(objet(a.gardes))) if (Number.isSafeInteger(c) && c >= 0) gardes[k] = c;
    achats[id] = { fournisseur: a.fournisseur, date: jourOk(a.date) ? str(a.date) : '', paires, total, frais: frais != null && frais > 0 ? frais : 0,
      repartition: { mode: r.mode === 'main' ? 'main' : 'egal', base: r.base === 'frais' || r.base === 'prix' ? r.base : '' }, parts, gardes, creeLe: str(a.creeLe) };
  }
  for (const [bid, h] of Object.entries(objet(o.hors))) {
    if (!h || !personnes[h.fournisseur]) continue;
    hors[bid] = { fournisseur: h.fournisseur, at: str(h.at) };
  }
  return { personnes, achats, hors };
}

// ── UN FOURNISSEUR : créer, modifier, retirer (SON geste) ───────────────────
const TEL = /^[+\d][\d\s.()+-]{3,}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Rend { fournisseur } ou { erreur } (le mot qui dit quoi corriger).
export function champsFournisseur({ nom, tel, email, note } = {}) {
  const n = str(nom);
  if (!n) return { erreur: 'Écris son nom' };
  const t = str(tel), e = str(email);
  if (t && !TEL.test(t)) return { erreur: 'Ce numéro de téléphone n’est pas lisible' };
  if (e && !EMAIL.test(e)) return { erreur: 'Cette adresse e-mail n’est pas lisible' };
  return { fournisseur: { nom: n.slice(0, MAX_NOM), tel: t.slice(0, 40), email: e.slice(0, 120), note: String(note == null ? '' : note).slice(0, MAX_NOTE) } };
}
export function avecFournisseur(registre, id, champs, at = '') {
  const reg = lireRegistre(registre);
  const c = champsFournisseur(champs);
  if (c.erreur || !str(id)) return { erreur: c.erreur || 'id' };
  const avant = reg.personnes[id];
  return { registre: { ...reg, personnes: { ...reg.personnes, [id]: { ...c.fournisseur, creeLe: avant ? avant.creeLe : str(at) } } } };
}
// Retirer : ses achats en gros et ses rattachements partent avec lui. Rend aussi
// la liste des achats retirés (l'appelant délie leurs paires : leurs prix restent).
export function sansFournisseur(registre, id) {
  const reg = lireRegistre(registre);
  const personnes = { ...reg.personnes }; delete personnes[id];
  const achats = {}, retires = [];
  for (const [k, a] of Object.entries(reg.achats)) { if (a.fournisseur === id) retires.push(k); else achats[k] = a; }
  const hors = {};
  for (const [k, h] of Object.entries(reg.hors)) if (h.fournisseur !== id) hors[k] = h;
  return { registre: { personnes, achats, hors }, achatsRetires: retires };
}

// ── UN ACHAT EN GROS ────────────────────────────────────────────────────────
// { fournisseur, date, paires, total (« 300 », « 300,50 »), frais (option) } —
// rend { achat } ou { erreur }.
export function champsAchatGros({ fournisseur, date, paires, total, frais } = {}, registre = null) {
  const reg = lireRegistre(registre);
  if (!reg.personnes[fournisseur]) return { erreur: 'fournisseur' };
  if (!jourOk(date)) return { erreur: 'Choisis la date' };
  const n = Number(str(paires));
  if (!Number.isInteger(n) || n < 1 || n > MAX_PAIRES) return { erreur: 'Écris le nombre de paires' };
  const t = centimesDe(total);
  if (t == null || t <= 0) return { erreur: 'Écris le montant total' };
  let f = 0;
  if (str(frais)) { const c = centimesDe(frais); if (c == null || c < 0) return { erreur: 'Les frais ne sont pas lisibles' }; f = c; }
  return { achat: { fournisseur, date: str(date), paires: n, total: t, frais: f } };
}
export function avecAchatGros(registre, id, champs, at = '') {
  const reg = lireRegistre(registre);
  const c = champsAchatGros(champs, reg);
  if (c.erreur || !str(id)) return { erreur: c.erreur || 'id' };
  const avant = reg.achats[id];
  const achat = { ...c.achat, repartition: avant ? avant.repartition : { mode: 'egal', base: '' }, parts: avant ? avant.parts : {}, gardes: avant ? avant.gardes : {}, creeLe: avant ? avant.creeLe : str(at) };
  return { registre: { ...reg, achats: { ...reg.achats, [id]: achat } } };
}
export function sansAchatGros(registre, id) {
  const reg = lireRegistre(registre);
  const achats = { ...reg.achats }; delete achats[id];
  return { ...reg, achats };
}
// L'achat avec son id (ce que les règles ci-dessous attendent), ou null.
export function achatGros(registre, id) {
  const a = lireRegistre(registre).achats[id];
  return a ? { ...a, id } : null;
}
// SA réponse « Garder » à la question d'un prix saisi à la main : { [clé]: le
// prix gardé, en centimes }. Tant que ce prix ne change pas, la question n'est
// plus reposée ; s'il le retape autrement, elle revient.
export function avecGardes(registre, id, gardes) {
  const reg = lireRegistre(registre);
  const a = reg.achats[id]; if (!a) return reg;
  const g = { ...a.gardes };
  for (const [k, c] of Object.entries(objet(gardes))) if (Number.isSafeInteger(c) && c >= 0) g[k] = c;
  return { ...reg, achats: { ...reg.achats, [id]: { ...a, gardes: g } } };
}
// SON choix de répartition (mode, base) et, paire par paire, SES saisies.
export function avecRepartition(registre, id, { mode, base, parts } = {}) {
  const reg = lireRegistre(registre);
  const a = reg.achats[id]; if (!a) return reg;
  const r = { mode: mode === 'main' || mode === 'egal' ? mode : a.repartition.mode, base: base === 'prix' || base === 'frais' ? base : a.repartition.base };
  const p = parts && typeof parts === 'object' ? Object.fromEntries(Object.entries(parts).filter(([, c]) => Number.isSafeInteger(c) && c >= 0)) : a.parts;
  return { ...reg, achats: { ...reg.achats, [id]: { ...a, repartition: r, parts: p } } };
}

// Le montant à répartir : le prix seul, ou prix + frais — SON choix. Des frais
// sans choix ⇒ null (rien n'est proposé : on ne devine pas).
export function baseRepartition(achat) {
  if (!achat) return null;
  if (!achat.frais) return achat.total;
  if (achat.repartition && achat.repartition.base === 'frais') return achat.total + achat.frais;
  if (achat.repartition && achat.repartition.base === 'prix') return achat.total;
  return null;
}

// ── LES PAIRES RELIÉES (SON clic, posé sur la fiche) ────────────────────────
const lienGros = (e) => (e && e.buyGros && typeof e.buyGros === 'object' && str(e.buyGros.id) ? e.buyGros : null);
// [{ cle, numero, titre, entree, at }] — triées par heure du lien (puis clé) :
// l'ordre qui donne les centimes du reste d'une part égale, stable.
export function reliesDuLot(fiches, achatId) {
  const out = [];
  for (const [cle, e] of Object.entries(objet(fiches))) {
    const g = lienGros(e); if (!g || g.id !== achatId) continue;
    out.push({ cle, numero: str(e.numero), titre: str(e.title), entree: e, at: str(g.at) });
  }
  return out.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.cle < b.cle ? -1 : a.cle > b.cle ? 1 : 0));
}
// La part de chaque paire reliée (centimes | null), alignée sur `relies`.
//   egal : la part égale au centime de l'achat ENTIER (N paires), le reste des
//          centimes aux premières — la somme des N parts = le total, au centime ;
//   main : ce qu'il a saisi pour CETTE paire, sinon null.
export function partsDuLot(achat, relies) {
  const base = baseRepartition(achat);
  if (!achat || base == null) return (relies || []).map(() => null);
  if (achat.repartition && achat.repartition.mode === 'main') return (relies || []).map((r) => (Number.isSafeInteger(achat.parts[r.cle]) ? achat.parts[r.cle] : null));
  const eg = partsEgales(base, achat.paires);
  return (relies || []).map((_, i) => (i < eg.length ? eg[i] : null));
}
// L'état d'une saisie paire par paire : chaque case lue, la somme, ce qui reste.
// Tant que toutes les paires ne sont pas reliées, la somme peut rester sous le
// total (le reste appartient aux paires pas encore reliées) ; elle ne le dépasse
// jamais. Toutes reliées : juste au centime.
export function etatSaisieGros(achat, relies, saisies) {
  const base = baseRepartition(achat);
  const parts = (saisies || []).map((s) => { const c = centimesDe(s); return c != null && c >= 0 ? c : null; });
  const illisibles = parts.filter((c) => c == null).length;
  const somme = parts.reduce((t, c) => t + (c || 0), 0);
  const reste = base == null ? null : base - somme;
  const toutes = !!achat && (relies || []).length >= achat.paires;
  const ok = base != null && parts.length > 0 && illisibles === 0 && reste != null && (toutes ? reste === 0 : reste >= 0);
  return { parts, somme, reste, illisibles, toutes, ok, depasse: reste != null && reste < 0 };
}

const texteEur = (c) => (c / 100).toFixed(2).replace('.', ',');
// D'où vient le prix d'une fiche, vu de CET achat :
//   'vide' — aucun prix (ni sur la fiche, ni saisi par N°) ;
//   'lot'  — le prix que CE lot a écrit (`buyGros.part`) ;
//   'main' — un prix saisi par lui (fiche ou par N°) : jamais remplacé sans lui.
export function origineDuPrix(entree, achatId, prixParNum = null) {
  const e = entree || {};
  const surFiche = str(e.buyPrice);
  const parNum = !surFiche && e.numero != null && typeof prixParNum === 'function' ? str(prixParNum(e.numero)) : '';
  const prix = surFiche || parNum;
  if (!prix) return { etat: 'vide', prix: '', centimes: null };
  const g = lienGros(e);
  const c = centimesDe(prix);
  if (surFiche && g && g.id === achatId && Number.isSafeInteger(g.part) && c === g.part) return { etat: 'lot', prix, centimes: c };
  return { etat: 'main', prix, centimes: c };
}
// Le plan : ce qui s'écrirait, ce qu'il faut lui DEMANDER (prix saisi à la main
// différent de la part), ce qui est déjà juste, ce qui n'a pas de part.
export function planPrixGros({ achat, relies, prixParNum = null } = {}) {
  const parts = partsDuLot(achat, relies);
  const aEcrire = [], aDemander = [], identiques = [], sansPart = [], gardes = [];
  (relies || []).forEach((r, i) => {
    const part = parts[i];
    if (part == null) { sansPart.push(r.cle); return; }
    const o = origineDuPrix(r.entree, achat && achat.id, prixParNum);
    if (o.centimes === part && o.etat !== 'main') { identiques.push(r.cle); return; }
    if (o.etat === 'main') {
      if (o.centimes === part) identiques.push(r.cle);
      else if (achat && achat.gardes && o.centimes != null && achat.gardes[r.cle] === o.centimes) gardes.push(r.cle);   // déjà répondu « Garder » pour CE prix
      else aDemander.push({ cle: r.cle, numero: r.numero, prix: o.prix, centimes: o.centimes, part });
      return;
    }
    aEcrire.push({ cle: r.cle, numero: r.numero, part });
  });
  return { parts, aEcrire, aDemander, identiques, sansPart, gardes };
}
// LES ÉCRITURES — seulement sur SON clic (`confirme === true`). Un prix saisi à
// la main n'est remplacé que si SA clé est dans `remplacer` (sa réponse à la
// question) ; le prix d'avant est gardé (`avant`) pour être rendu en déliant.
export function ecrituresPrixGros({ achat, relies, prixParNum = null, remplacer = [], confirme = false } = {}) {
  if (confirme !== true || !achat || !achat.id) return null;
  const plan = planPrixGros({ achat, relies, prixParNum });
  const oui = new Set(remplacer || []);
  const par = new Map((relies || []).map((r) => [r.cle, r]));
  const ecritures = [], gardes = [];
  const ecrire = (cle, part, avant) => {
    const g = lienGros(par.get(cle).entree) || { id: achat.id, at: '' };
    ecritures.push({ cle, patch: { buyPrice: texteEur(part), buyGros: { ...g, part, ...(avant != null ? { avant } : {}) } } });
  };
  for (const x of plan.aEcrire) ecrire(x.cle, x.part, null);
  for (const x of plan.aDemander) { if (oui.has(x.cle)) ecrire(x.cle, x.part, x.prix); else gardes.push(x); }
  return { ecritures, gardes, sansPart: plan.sansPart.length };
}
// Relier une fiche à CET achat (son clic). null si la fiche n'a pas de N°, est
// déjà reliée (à un achat Vinted ou à un autre achat en gros), ou si l'achat a
// déjà toutes ses paires.
export function ecritureLienGros(entree, achat, { at = '', nRelies = 0 } = {}) {
  const e = entree || {};
  if (!achat || !achat.id || !str(e.numero)) return null;
  if (str(e.buyFromId) || lienGros(e)) return null;
  if (nRelies >= achat.paires) return null;
  return { buyGros: { id: achat.id, at: str(at) } };
}
// Délier : le lien part ; le prix que CE lot avait écrit aussi (le prix d'avant
// revient, s'il en avait un) ; un prix saisi à la main reste.
export function ecritureDelierGros(entree, achatId, prixParNum = null) {
  const g = lienGros(entree);
  if (!g || g.id !== achatId) return null;
  const o = origineDuPrix(entree, achatId, prixParNum);
  const patch = { buyGros: null };
  if (o.etat === 'lot') patch.buyPrice = g.avant != null ? str(g.avant) : '';
  return patch;
}

// ── LES ACHATS HORS PLATEFORME D'AVANT (source « Fournisseur ») ─────────────
// Proposés à SON clic seulement ; rien n'est rattaché tout seul.
export function horsRattachables(hors, registre, sourceDe = null) {
  const reg = lireRegistre(registre);
  return (Array.isArray(hors) ? hors : []).filter((b) => b && str(b.id) && !reg.hors[b.id]
    && str(typeof sourceDe === 'function' ? sourceDe(b) : b.source).toLowerCase() === SOURCE_FOURNISSEUR.toLowerCase());
}
export function avecHors(registre, bid, fournisseur, at = '') {
  const reg = lireRegistre(registre);
  if (!reg.personnes[fournisseur] || !str(bid)) return reg;
  return { ...reg, hors: { ...reg.hors, [bid]: { fournisseur, at: str(at) } } };
}
export function sansHors(registre, bid) {
  const reg = lireRegistre(registre);
  const hors = { ...reg.hors }; delete hors[bid];
  return { ...reg, hors };
}

// ── LA FICHE D'UN FOURNISSEUR ───────────────────────────────────────────────
//   registre : `vrm_fournisseurs` · fiches : `vinted_annonce_numeros`
//   ventes   : [{ id, entree, benefice: { valeur: € | null, partiel } }] —
//              `entree` = la fiche fusionnée de LA vente (effEntry, ou la fiche
//              unique du N° pour Leboncoin/eBay/Vestiaire) ; `benefice` = la
//              règle propriétaire (beneficeLigneVente / ventesAutresBenefice).
//   hors     : achats hors plateforme ({ id, price, numero, source })
//   prixHors(b) → € | null ; cleNum(n) → identité d'un N°.
// Rend { lignes: [une par fournisseur QU'IL a créé], parAchat: { [id]: { relies, sur } } }.
export function bilanFournisseurs({ registre, fiches = {}, ventes = [], hors = [], prixHors = null, cleNum = null } = {}) {
  const reg = lireRegistre(registre);
  const cn = typeof cleNum === 'function' ? cleNum : (x) => str(x).toUpperCase();
  const lignes = new Map();
  for (const [id, p] of Object.entries(reg.personnes)) {
    lignes.set(id, { id, nom: p.nom, tel: p.tel, email: p.email, note: p.note, achatsGros: 0, achatsHors: 0, paires: 0, pairesPrixConnu: 0,
      depense: 0, sansPrix: 0, relies: 0, revendues: 0, achatConnu: 0, benefice: 0, beneficesConnus: 0, partiel: false });
  }
  const parAchat = {};
  for (const [id, a] of Object.entries(reg.achats)) {
    const l = lignes.get(a.fournisseur); if (!l) continue;
    l.achatsGros++; l.paires += a.paires; l.pairesPrixConnu += a.paires; l.depense += a.total + (a.frais || 0);
    parAchat[id] = { relies: 0, sur: a.paires };
  }
  for (const e of Object.values(objet(fiches))) {
    const g = lienGros(e); if (!g) continue;
    const a = reg.achats[g.id]; if (!a) continue;
    parAchat[g.id].relies++; lignes.get(a.fournisseur).relies++;
  }
  // Un N° hors plateforme ne relie que s'il ne désigne qu'UN achat hors plateforme.
  const horsParNum = new Map();
  for (const b of (Array.isArray(hors) ? hors : [])) {
    const k = b && b.numero != null ? cn(b.numero) : '';
    if (k) horsParNum.set(k, horsParNum.has(k) ? 'ambigu' : b);
  }
  const fichesParNum = new Set(Object.values(objet(fiches)).map((e) => (e && e.numero != null ? cn(e.numero) : '')).filter(Boolean));
  for (const b of (Array.isArray(hors) ? hors : [])) {
    const h = b && reg.hors[b.id]; if (!h) continue;
    const l = lignes.get(h.fournisseur); if (!l) continue;
    l.achatsHors++; l.paires++;
    const p = typeof prixHors === 'function' ? prixHors(b) : (centimesDe(b.price) == null ? null : centimesDe(b.price) / 100);
    const c = p == null || !Number.isFinite(Number(p)) ? null : Math.round(Number(p) * 100);
    if (c == null) l.sansPrix++; else { l.depense += c; l.pairesPrixConnu++; }
    const k = b.numero != null ? cn(b.numero) : '';
    if (k && horsParNum.get(k) === b && fichesParNum.has(k)) l.relies++;
  }
  const vues = new Set();
  for (const v of (Array.isArray(ventes) ? ventes : [])) {
    if (!v || vues.has(v.id)) continue; vues.add(v.id);
    const e = v.entree || null; if (!e) continue;
    let l = null;
    const g = lienGros(e);
    if (g) { const a = reg.achats[g.id]; l = a ? lignes.get(a.fournisseur) : null; }
    else if (!str(e.buyFromId) && e.numero != null && str(e.numero)) {
      const b = horsParNum.get(cn(e.numero));
      const h = b && b !== 'ambigu' ? reg.hors[b.id] : null;
      l = h ? lignes.get(h.fournisseur) : null;
    }
    if (!l) continue;
    l.revendues++;
    if (centimesDe(e.buyPrice) != null) l.achatConnu++;
    const bn = v.benefice || {};
    if (bn.valeur != null && Number.isFinite(Number(bn.valeur))) { l.benefice += Math.round(Number(bn.valeur) * 100); l.beneficesConnus++; if (bn.partiel) l.partiel = true; }
  }
  const out = [...lignes.values()].map((l) => ({ ...l,
    prixMoyen: l.pairesPrixConnu ? Math.round((l.depense) / l.pairesPrixConnu) : null,
    benefice: l.beneficesConnus ? l.benefice : null }));
  out.sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' }));
  return { lignes: out, parAchat };
}

// ── LES MOTS (une seule source pour l'écran et l'audit) ─────────────────────
export function eurosC(c) {
  if (c == null || !Number.isFinite(c)) return '—';
  const n = Math.abs(Math.round(c)), e = Math.floor(n / 100), r = n % 100;
  const ent = String(e).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return (c < 0 ? '−' : '') + ent + (r ? ',' + String(r).padStart(2, '0') : '') + ' €';
}
// « 300 € » · « au moins 300 € » (un prix illisible) · « — » (rien de lisible).
export function texteDepense(l) {
  if (!l) return '—';
  if (l.sansPrix && !l.pairesPrixConnu) return '—';
  return (l.sansPrix ? 'au moins ' : '') + eurosC(l.depense);
}
export const texteMoyen = (l) => (l && l.prixMoyen != null ? eurosC(l.prixMoyen) : '—');
// « +40 € » · « au plus +40 € » (frais pas confirmés) · « — » (aucun connu).
// JAMAIS « au moins » : la couverture se dit à côté (`texteCouverture`).
export function texteBeneficeFournisseur(l) {
  if (!l || l.benefice == null) return '—';
  const s = (l.benefice >= 0 ? '+' : '') + eurosC(l.benefice);
  return l.partiel ? 'au plus ' + s : s;
}
const pl = (n, s, p) => `${n} ${n > 1 ? (p || s + 's') : s}`;
// « sur 12 vendues, prix d'achat connu pour 9 » (+ « bénéfice connu pour 8 »
// quand un prix de vente manque) ; rien quand aucune paire n'est revendue.
export function texteCouverture(l) {
  if (!l || !l.revendues) return '';
  let t = `sur ${pl(l.revendues, 'vendue')}, prix d’achat connu pour ${l.achatConnu}`;
  if (l.beneficesConnus < l.achatConnu) t += `, bénéfice connu pour ${l.beneficesConnus}`;
  return t;
}
export const texteRelies = (r) => (r ? `${r.relies} sur ${r.sur} reliée${r.relies > 1 ? 's' : ''}` : '');
