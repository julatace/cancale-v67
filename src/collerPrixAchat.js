// ═══════════════════════════════════════════════════════════════════════════
// COLLER UN TABLEAU DE PRIX D'ACHAT (14 nov., proposition 75 choisie par Julien)
// « Coller un tableau de prix d'achat (N° ; prix) depuis Notes ou Excel : 184 prix
// entrés en 10 secondes. » docs/passation/2026-11-14-argent-choix.md
// ═══════════════════════════════════════════════════════════════════════════
// Il colle un texte (une ligne par paire : « 12 ; 60 », « B125	45,50 », « 7, 60 € »).
// On montre CHAQUE ligne avant tout, et RIEN n'est écrit sans « Enregistrer N prix »
// (SON clic). C'est lui qui saisit (CLAUDE.md §2.5) : aucun prix n'est deviné.
// Règles (§5) :
//   · le N° se lit par la clé des numéros (`cleNumero` : majuscules, sans espace,
//     « 007 » = « 7 », « b125 » = « B125 ») — la même que l'app (`cleNum`) ;
//   · le prix se lit par la règle de l'import tableur (`prixDuFichier`) : « 60 »,
//     « 60,50 », « 60 € », « 1 250,00 » ; vide ⇒ rien (jamais 0) ; illisible ⇒ dit ;
//   · une ligne à plusieurs colonnes (N° ; titre ; prix) est REFUSÉE : un titre
//     « Air Max 90 » se lirait comme un prix — mieux vaut un blanc qu'un faux ;
//   · un N° qui ne désigne AUCUNE fiche, ou DEUX fiches, est refusé (le second cas
//     est le seul risque irréversible de l'app : jamais « la première ») ;
//   · un N° collé deux fois : même prix ⇒ une seule écriture ; deux prix ⇒ refusé ;
//   · une fiche qui a DÉJÀ un prix : le même ⇒ rien à faire ; un autre ⇒ refusé,
//     sauf s'il coche « Remplacer aussi » (l'ancien et le nouveau dits ligne par ligne) ;
//   · ses fiches pas lues (base pas chargée, lecture ratée) ⇒ AUCUNE écriture.
// Module PUR : exécuté par scripts/audit-argent-choix.cjs.
// ═══════════════════════════════════════════════════════════════════════════
import { cleNumero } from './rechercheUnique.js';
import { prixDuFichier } from './importAchats.js';

export const LIGNES_MAX_COLLAGE = 2000;
// Les états d'une ligne. `ok` (et `different` quand il l'accepte) s'écrivent ; le reste non.
export const ETATS_COLLAGE = ['ok', 'different', 'identique', 'doublon', 'conflit', 'inconnu', 'deux', 'vide', 'illisible', 'colonnes', 'entete'];

// Un N° tel qu'il s'écrit sur un carton : des chiffres, ou 1 à 3 lettres puis des chiffres.
const RE_NUM = /^(?:n\s*°|no\.?|num(?:[ée]ro)?\.?|#)?\s*([a-z]{1,3}[\s\-_.]?\d{1,6}|\d{1,6})$/i;
// Sans tabulation ni « ; » : le N°, puis « , » « : » « = » ou des espaces, puis le prix.
const RE_LIGNE = /^\s*((?:n\s*°|no\.?|num(?:[ée]ro)?\.?|#)?\s*(?:[a-z]{1,3}[\s\-_.]?\d{1,6}|\d{1,6}))(?:\s*[,:=]\s*|\s+)(.*)$/i;
// La FORME d'un prix, avant de le lire : « 60 », « 60,50 », « 1 250,00 », « 60 € ». Deux nombres
// séparés par une espace (« 60 70 ») ne sont PAS un prix : `prixDuFichier` ôte les espaces et y
// lirait 6 070 € — refusé ici.
const formePrix = (t) => {
  const s = String(t).replace(/€|eur(?:os?)?/gi, '').replace(/\u00a0|\u202f/g, ' ').trim();
  return s === '' || /^\d+(?:[.,]\d{1,2})?$/.test(s) || /^\d{1,3}(?:[ .]\d{3})+(?:,\d{1,2})?$/.test(s) || /^\d{1,3}(?:[ ,]\d{3})+(?:\.\d{1,2})?$/.test(s);
};
const RE_ENTETE = /\b(n\s*°|num(?:[ée]ro)?|prix|price|co[uû]t|montant|achat)\b/i;

const centimes = (p) => { const n = Math.round(Number(String(p).replace(',', '.')) * 100); return Number.isFinite(n) ? n : null; };
const prixLu = (cellule) => {
  if (!formePrix(cellule)) return { etat: 'illisible' };
  const r = prixDuFichier(cellule);
  if (!r.ok) return { etat: 'illisible' };
  if (!r.prix) return { etat: 'vide' };
  return { etat: 'ok', prix: r.prix, centimes: centimes(r.prix) };
};

// UNE ligne collée ⇒ { brut, etat, numero, cle, prix ('60,00'), centimes }.
export function lireLigneCollee(brut) {
  const texte = String(brut == null ? '' : brut).replace(/[​﻿]/g, '').trim();
  const base = { brut: texte.slice(0, 120) };
  if (!texte) return null;
  // Un tableur (tabulation) ou un « ; » : des cellules ; sinon N° puis « , » ou espaces.
  const sep = texte.includes('\t') ? '\t' : texte.includes(';') ? ';' : texte.includes('|') ? '|' : null;
  let numTxt, prixTxt;
  if (sep) {
    const cellules = texte.split(sep).map((c) => c.trim());
    while (cellules.length && cellules[cellules.length - 1] === '') cellules.pop();
    const pleines = cellules.filter((c) => c !== '');
    if (pleines.length > 2) return { ...base, etat: 'colonnes' };
    numTxt = cellules[0] || '';
    prixTxt = cellules.length > 1 ? cellules.slice(1).join('').trim() : '';
  } else {
    const m = RE_LIGNE.exec(texte);
    if (m) { numTxt = m[1].trim(); prixTxt = m[2].trim(); }
    else if (RE_NUM.test(texte)) { numTxt = texte; prixTxt = ''; }   // un N° seul : prix vide
    else return { ...base, etat: RE_ENTETE.test(texte) ? 'entete' : 'illisible' };
  }
  const mn = RE_NUM.exec(numTxt.trim());
  if (!mn) return { ...base, etat: RE_ENTETE.test(texte) ? 'entete' : 'illisible' };
  const numero = mn[1].replace(/\s+/g, '');
  const cle = cleNumero(numero);
  if (!cle) return { ...base, etat: 'illisible' };
  const p = prixLu(prixTxt);
  if (p.etat !== 'ok') return { ...base, etat: p.etat, numero, cle };
  return { ...base, etat: 'ok', numero, cle, prix: p.prix, centimes: p.centimes };
}

// Le texte entier ⇒ { lignes, trop } (au plus LIGNES_MAX_COLLAGE lignes non vides).
export function lireCollage(texte) {
  const out = [];
  let trop = 0;
  for (const l of String(texte == null ? '' : texte).split(/\r\n|\r|\n/)) {
    const r = lireLigneCollee(l);
    if (!r) continue;
    if (out.length >= LIGNES_MAX_COLLAGE) { trop += 1; continue; }
    // Seule la PREMIÈRE ligne peut être un en-tête (« N° ; Prix ») ; plus bas, c'est une ligne illisible.
    if (r.etat === 'entete' && out.length) r.etat = 'illisible';
    out.push({ ...r, n: out.length + 1 });
  }
  return { lignes: out, trop };
}

// L'APERÇU. `fichesDe(cle)` ⇒ les fiches de ce N° : [{ key, numero, prix (nombre | null),
// titre, photo }] — la règle de l'app (`fichesDuNumero` + `prixAchatDe`). `lu` : ses fiches
// sont-elles lues (base chargée) ? Faux ⇒ rien n'est écrivable, c'est dit.
// Chaque ligne : { ...lecture, etat, fiche?, avant? (centimes) }.
export function apercuCollage({ texte, fichesDe, lu = true } = {}) {
  const { lignes, trop } = lireCollage(texte);
  if (!lu || typeof fichesDe !== 'function') return { lu: false, lignes, trop, resume: resumeCollage(lignes) };
  // Les N° collés plusieurs fois.
  const parCle = new Map();
  for (const l of lignes) if (l.etat === 'ok') { const a = parCle.get(l.cle) || []; a.push(l); parCle.set(l.cle, a); }
  const vu = new Set();
  const sortie = lignes.map((l) => {
    if (l.etat !== 'ok') return l;
    const memes = parCle.get(l.cle);
    if (memes.length > 1) {
      if (new Set(memes.map((x) => x.centimes)).size > 1) return { ...l, etat: 'conflit' };
      if (vu.has(l.cle)) return { ...l, etat: 'doublon' };
    }
    vu.add(l.cle);
    let f = [];
    try { f = fichesDe(l.cle) || []; } catch (_) { f = []; }
    if (!f.length) return { ...l, etat: 'inconnu' };
    if (f.length > 1) return { ...l, etat: 'deux', nFiches: f.length };
    const fiche = f[0];
    const avant = fiche.prix == null || !Number.isFinite(Number(fiche.prix)) ? null : Math.round(Number(fiche.prix) * 100);
    const ff = { key: String(fiche.key), numero: String(fiche.numero == null ? l.numero : fiche.numero), titre: String(fiche.titre || ''), photo: fiche.photo || '' };
    if (avant == null) return { ...l, etat: 'ok', fiche: ff, avant: null };
    if (avant === l.centimes) return { ...l, etat: 'identique', fiche: ff, avant };
    return { ...l, etat: 'different', fiche: ff, avant };
  });
  return { lu: true, lignes: sortie, trop, resume: resumeCollage(sortie) };
}

// Le compte de chaque état (les lignes refusées sont NOMMÉES, jamais perdues).
export function resumeCollage(lignes) {
  const r = Object.fromEntries(ETATS_COLLAGE.map((e) => [e, 0]));
  for (const l of (lignes || [])) if (l && r[l.etat] != null) r[l.etat] += 1;
  r.total = (lignes || []).filter((l) => l && l.etat !== 'entete').length;
  return r;
}

// Ce qui part à l'écriture : les lignes `ok`, et les `different` seulement s'il les a acceptées.
// [{ key, numero, prix ('60,00'), avant (centimes | null) }]. Une base pas lue ⇒ [].
export function ecrituresCollage(apercu, { remplacer = false } = {}) {
  if (!apercu || !apercu.lu) return [];
  return apercu.lignes
    .filter((l) => l.fiche && (l.etat === 'ok' || (remplacer && l.etat === 'different')))
    .map((l) => ({ key: l.fiche.key, numero: l.fiche.numero, prix: l.prix, avant: l.avant }));
}

// AU MOMENT D'ÉCRIRE (comparer-et-échanger) : `fichesDe` relu sur les fiches DU MOMENT.
// Une fiche qui a changé depuis l'aperçu (un prix posé ailleurs, une 2e fiche au même N°)
// n'est pas écrite : { garder: [...], changees: n }.
export function verifierAvantEcriture(ecritures, fichesDe) {
  const garder = [];
  let changees = 0;
  for (const w of (ecritures || [])) {
    let f = [];
    try { f = fichesDe(cleNumero(w.numero)) || []; } catch (_) { f = []; }
    const fiche = f.length === 1 && String(f[0].key) === String(w.key) ? f[0] : null;
    const maintenant = fiche ? (fiche.prix == null || !Number.isFinite(Number(fiche.prix)) ? null : Math.round(Number(fiche.prix) * 100)) : undefined;
    if (!fiche || maintenant !== w.avant) { changees += 1; continue; }
    garder.push(w);
  }
  return { garder, changees };
}
