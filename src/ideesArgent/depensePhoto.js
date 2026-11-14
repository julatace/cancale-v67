// ═══════════════════════════════════════════════════════════════════════════
//  159 · LES DÉPENSES DU MOIS EN PHOTO (14 nov., idées argent)
// ═══════════════════════════════════════════════════════════════════════════
// Julien : photographier un ticket (cartons, essence, scotch…) ⇒ le montant et la
// date sont lus SUR LE TÉLÉPHONE, il confirme ou corrige, choisit une catégorie.
//
// ⚠️ UNE SEULE RÈGLE PAR NOTION (§5) : la boîte à dépenses existe déjà (Compta,
//    3 nov.) — `vrm_compta.depenses` (synchronisée avec `main`), la photo dans SA
//    ligne `depense_ticket_{id}` (jamais `main`, §4.4), comptée dans le bénéfice
//    par `comptaChargesMois` / `comptaChargesAnnee` (App.jsx), JAMAIS dans le CA
//    (aucune règle de vente ne lit `vrm_compta`). Une liste `vrm_depenses` à part
//    aurait été une seconde liste de charges (comptée deux fois, ou pas du tout) :
//    ce module écrit la MÊME dépense, de la même forme { id, date, libelle, cat,
//    montant, ticket? }.
// ⚠️ §2.9 : la lecture est celle de src/depensesTicket.js — le détecteur de texte du
//    navigateur, sinon Tesseract exécuté DANS la page (aucune IA, aucune clé, aucun
//    service distant). Ici : ce qu'on en fait (montant + date LUS, jamais devinés).
// ⚠️ JAMAIS RANGÉE SANS SON CLIC : `depenseAEnregistrer` n'est appelée que par
//    « Enregistrer » ; une lecture n'écrit rien, une lecture ratée propose la saisie
//    à la main (le champ vide, la raison dite).
// Module PUR. Exécuté par scripts/audit-idees-argent.cjs.
// ═══════════════════════════════════════════════════════════════════════════
import { CATEGORIES_DEPENSE, montantDuTicket, dateDuTicket } from '../depensesTicket.js';

export { CATEGORIES_DEPENSE };
export const CATEGORIES = CATEGORIES_DEPENSE.map((c) => c.k);
// La photo garde sa place seulement si elle reste légère une fois réduite : au-delà,
// la dépense est rangée SANS photo (et c'est dit) — jamais une ligne de plusieurs Mo.
export const PHOTO_MAX_OCTETS = 450 * 1024;
const str = (v) => String(v == null ? '' : v).trim();

// La taille réelle (octets) d'une image en dataURL base64.
export function octetsDataUrl(d) {
  const s = str(d); const i = s.indexOf(',');
  if (!/^data:image\//.test(s) || i < 0) return 0;
  const b = s.slice(i + 1).replace(/\s/g, '');
  return Math.floor(b.length * 3 / 4) - (b.endsWith('==') ? 2 : b.endsWith('=') ? 1 : 0);
}
// 'garder' (la photo part avec la dépense) · 'trop-lourde' (rangée sans photo) · 'aucune'
export const sortDeLaPhoto = (dataUrl) => {
  const n = octetsDataUrl(dataUrl);
  return !n ? 'aucune' : n <= PHOTO_MAX_OCTETS ? 'garder' : 'trop-lourde';
};

// Ce que la lecture du ticket a donné : { montant (centimes|null), date (ISO|null), etat }
//   etat 'lu' (montant ET date) · 'partiel' (l'un des deux) · 'rien' (lecture faite, rien de sûr)
//   · 'rate' (la lecture n'a pas pu se faire : hors ligne, délai, chargement) — raison gardée.
export function lectureTicket({ texte = '', raison = null } = {}, aujourdhuiD = new Date()) {
  if (!str(texte)) return { montant: null, date: null, etat: raison ? 'rate' : 'rien', raison: raison || null };
  const montant = montantDuTicket(texte);
  const date = dateDuTicket(texte, aujourdhuiD);
  const etat = montant != null && date ? 'lu' : (montant != null || date) ? 'partiel' : 'rien';
  return { montant, date, etat, raison: null };
}

// « 12,50 », « 12.50 € », « 12 » ⇒ euros (nombre) ; sinon null (rien de deviné).
export function montantTape(t) {
  const s = str(t).replace(/[\s€  ]/g, '').replace(',', '.');
  if (!/^\d{1,6}(?:\.\d{1,2})?$/.test(s)) return null;
  const n = Number(s);
  return n > 0 && n < 100000 ? Math.round(n * 100) / 100 : null;
}
export const texteCentimes = (c) => (c == null ? '' : `${Math.floor(c / 100)},${String(c % 100).padStart(2, '0')}`);

const jourValide = (s, maintenant) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str(s))) return false;
  const t = Date.parse(str(s) + 'T12:00:00');
  return Number.isFinite(t) && t <= maintenant + 36 * 3600000 && t >= Date.parse('2000-01-01T00:00:00');
};

// LA dépense à ranger, sur SON « Enregistrer » seulement.
//   saisie { montant (texte tapé ou pré-rempli), date, cat, libelle }
//   id     un identifiant neuf ; ticket : la photo a-t-elle été rangée (true/false)
// Rend { depense } ou { erreur: 'montant'|'date'|'cat' } (rien n'est écrit).
export function depenseAEnregistrer({ saisie = {}, id, ticket = false, maintenant = Date.now() } = {}) {
  const m = montantTape(saisie.montant);
  if (m == null) return { erreur: 'montant' };
  if (!jourValide(saisie.date, maintenant)) return { erreur: 'date' };
  if (!CATEGORIES.includes(saisie.cat)) return { erreur: 'cat' };
  if (!/^[A-Za-z0-9_-]{4,40}$/.test(str(id))) return { erreur: 'id' };
  const libelle = str(saisie.libelle).slice(0, 80) || saisie.cat;
  return { depense: { id: str(id), date: str(saisie.date), libelle, cat: saisie.cat, montant: m, ...(ticket ? { ticket: true } : {}) } };
}

// La liste `vrm_compta` après l'ajout (la dépense en tête), sans rien perdre d'autre.
// `compta` illisible (null, pas un objet) ⇒ null : une lecture ratée n'écrit RIEN.
export function comptaAvecDepense(compta, depense) {
  if (!compta || typeof compta !== 'object' || Array.isArray(compta) || !depense || !depense.id) return null;
  const l = Array.isArray(compta.depenses) ? compta.depenses : [];
  if (l.some((x) => x && x.id === depense.id)) return compta;
  return { ...compta, depenses: [depense, ...l] };
}

// Les dépenses d'un mois (« AAAA-MM »), pour la ligne de la feuille : { n, total }.
// Ce que la feuille appelle « au moins » : seulement les dépenses NOTÉES (le reste n'existe pas pour VRM).
export function depensesDuMois(compta, ym) {
  const l = (compta && Array.isArray(compta.depenses) ? compta.depenses : []).filter((x) => x && str(x.date).slice(0, 7) === ym);
  return { n: l.length, total: Math.round(l.reduce((s, x) => s + (Number(x.montant) || 0), 0) * 100) / 100 };
}
