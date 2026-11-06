// ═══════════════════════════════════════════════════════════════════════════
// RELIER L'ACHAT AUX ANNONCES NUMÉROTÉES (6 nov., vague 2 · point 4)
// ═══════════════════════════════════════════════════════════════════════════
// Mesuré en lecture seule sur sa base (5 nov.) : 0 annonce en ligne sur 56 a un
// coût ; 504 fiches sur 522 ont été numérotées AUTOMATIQUEMENT par VRM — leur
// achat n'est jamais relié. Le filtre Annonces « Sans achat relié » les met en
// file, une par une, avec LA meilleure suggestion de `suggestionsAchat` (marque
// et taille obligatoires, achat antérieur à la mise en ligne, lots jusqu'à leur
// nombre) ; Ma journée en dit le nombre, une fois.
//
// §2.5 « il saisit les prix d'achat lui-même » et §5 « c'est toujours SON clic
// qui relie » : rien ici n'écrit. « Relier » écrit au prix du reçu
// (`propositionPrixAchat`, l'écriture de « Relier un achat »), « Saisir » le prix
// qu'il tape, « Plus tard » ne fait que ranger l'annonce en fin de file (et hors
// du nombre de Ma journée) — jamais une écriture de prix.
//
// Règles PURES, exécutées par scripts/audit-achats-a-relier.cjs.
// ─────────────────────────────────────────────────────────────────────────────
import { suggestionsAchat, lotDe } from './suggestionsAchat.js';

const prixNum = (p) => { const v = p && typeof p === 'object' ? p.amount : p; const n = Number(String(v == null ? '' : v).replace(',', '.')); return Number.isFinite(n) && n > 0 ? n : null; };

// Une annonce est « sans achat relié » : en ligne, numérotée, aucun achat relié
// (`buyFromId`) et aucun prix d'achat connu (`prixAchat(fiche)` → nombre | null :
// la règle de l'app, `prixAchatDe`). Un prix saisi à la main (paire de brocante,
// sans achat Vinted) n'est PAS dans la file : il n'y a rien à relier.
export function sansAchatRelie(fiche, prixAchat) {
  const e = fiche && typeof fiche === 'object' ? fiche : null;
  if (!e || !String(e.numero || '').trim()) return false;
  if (e.buyFromId != null && String(e.buyFromId).trim() !== '') return false;
  const p = typeof prixAchat === 'function' ? prixAchat(e) : null;
  return !(p != null && Number.isFinite(Number(p)));
}

// (6 nov., finitions) « PLUS TARD » REVIENT AU BOUT DE 7 JOURS. La date est posée à
// SON clic (`vrm_achat_plus_tard`, synchronisé) : pendant 7 jours l'annonce reste en
// fin de file et hors du nombre de Ma journée ; ensuite elle revient (nombre et
// place), et la ligne dit « reportée le … ». Une date illisible ne garde rien de
// côté (« pas su » ne vaut pas « reportée ») : l'annonce est comptée.
export const PLUS_TARD_JOURS = 7;
export function etatPlusTard(v, maintenant = Date.now()) {
  if (v == null || v === false || v === '') return null;
  const t = Date.parse(typeof v === 'string' ? v : String((v && v.at) || ''));
  if (!Number.isFinite(t)) return { reporte: false, le: null, revient: null };
  const revient = t + PLUS_TARD_JOURS * 86400e3;
  return { reporte: Number(maintenant) < revient, le: new Date(t).toISOString(), revient: new Date(revient).toISOString() };
}

// La file : [{ id, item, fiche, plusTard, reporteLe, revientLe }] — ses annonces en
// ligne (`annonces`, la liste de la grille), celles qu'il a remises « plus tard »
// (depuis moins de 7 jours) à la fin, chaque groupe dans l'ordre de mise en ligne
// (la plus ancienne d'abord : celle qui dort le plus). `plusTard` = { [id]: at }.
export function fileSansAchat({ annonces, numeros, prixAchat, plusTard = null, maintenant = Date.now() } = {}) {
  const out = [];
  const vus = new Set();
  for (const it of (Array.isArray(annonces) ? annonces : [])) {
    if (!it || it.id == null) continue;
    const id = String(it.id); if (vus.has(id)) continue; vus.add(id);
    const e = numeros && numeros[id];
    if (!sansAchatRelie(e, prixAchat)) continue;
    const t = Number(it.createdTs); const ts = Number.isFinite(t) && t > 0 ? (t < 1e12 ? t * 1000 : t) : null;
    const pt = etatPlusTard(plusTard && plusTard[id], maintenant);
    out.push({ id, item: it, fiche: e, plusTard: !!(pt && pt.reporte), reporteLe: pt ? pt.le : null, revientLe: pt && pt.reporte ? pt.revient : null, ts });
  }
  return out.sort((a, b) => (Number(a.plusTard) - Number(b.plusTard)) || ((a.ts ?? Infinity) - (b.ts ?? Infinity)));
}
// Le nombre que Ma journée dit : la file, sans les « plus tard » (de moins de 7 jours).
export const aRelierJournee = (file) => (Array.isArray(file) ? file.filter((x) => !x.plusTard).length : 0);

// La cible d'une annonce pour `suggestionsAchat` : ses CHAMPS d'abord (marque,
// taille, couleur du dressing), son titre sinon ; la date de mise en ligne
// (un achat postérieur n'est jamais proposé). `curTx` vide : rien n'est relié.
export function cibleAnnonce(it) {
  const x = it && typeof it === 'object' ? it : {};
  const t = Number(x.createdTs ?? x.created_at_ts);
  const ms = Number.isFinite(t) && t > 0 ? (t < 1e12 ? t * 1000 : t) : null;
  return { titre: String(x.title || ''), marque: x.brand || x.brand_title || '', taille: x.size || x.size_title || '',
    couleur: x.color1 || x.couleur || '', dateRef: ms != null ? new Date(ms).toISOString() : null, curTx: '' };
}

// LA meilleure suggestion (ou null) : la première de `suggestionsAchat`, la même
// règle que « Relier un achat ». Rien n'est proposé sans marque ET taille.
export function meilleureSuggestion({ item, achats, liens, marqueDe, couleursDe, modeleDe = null } = {}) {
  const s = suggestionsAchat({ cible: cibleAnnonce(item), achats, liens, marqueDe, couleursDe, modeleDe, max: 1 });
  return s.length ? s[0] : null;
}

// Ce que montre la ligne de la suggestion : le prix PROPOSÉ (reçu juste, sinon
// l'article seul) quand il y en a un ; un LOT n'a jamais de prix proposé (le
// prix de CET article est demandé à son tap, `ecritureLot`).
export function texteSuggestion(sugg, proposition) {
  if (!sugg || !sugg.achat) return null;
  const a = sugg.achat;
  return {
    titre: String(a.title || ''), date: a.date || '', prixLu: prixNum(a.price),
    proposition: proposition && Number.isSafeInteger(proposition.centimes) ? proposition : null,
    lot: lotDe(a).lot,
    rang: sugg.rang,
  };
}
