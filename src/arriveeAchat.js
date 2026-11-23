// ═══════════════════════════════════════════════════════════════════════════
// L'ARRIVÉE D'UN ACHAT (20 nov. 2026, lot arrivee-scan) — LA RÈGLE, PURE
// ═══════════════════════════════════════════════════════════════════════════
// Julien (20 nov., « fais 3 ») : « L'arrivée d'un achat guidée par le scan : tu scannes le code-barres de
// l'étiquette du colis reçu, la paire est reconnue par son n° de suivi, l'app lui donne son N°, te dit dans
// quelle case la ranger, et imprime l'étiquette si tu imprimes les tiennes. » — puis (précision) : « l'app reçoit
// les mails avec les codes de retrait et les n° de suivi, c'est là que l'app sait quel article est arrivé ».
// ⇒ LA PORTE PRINCIPALE est « J'ai retiré » (ou le retrait prouvé) : l'achat de CE colis, déjà relié par
// identité, ouvre l'écran d'arrivée. Le scan est un raccourci (« j'ai un colis en main, lequel est-ce ? »).
//
// Ce module ne lit rien et n'écrit rien : l'app (src/App.jsx, `ArriveeCoque`) lui passe ce qu'elle a LU et
// écrit ce qu'il rend par SON geste (un seul « Annuler » 10 s). Les règles intouchables (CLAUDE.md §5) :
//   • l'achat vient du n° de suivi SEULEMENT (égalité exacte, `retrouverParSuivi`) — jamais un titre ;
//     plusieurs achats ⇒ la question ; aucun ⇒ dit, jamais deviné ;
//   • un N° n'est jamais réattribué ni pris dans un trou (`numerosEnSerie` / `prochainLibre`, servis relus) ;
//   • un achat arrivé ne se range qu'UNE fois (une fiche porte déjà son n° de transaction ⇒ « déjà rangé ») ;
//   • une lecture ratée (`null` / `undefined`) ⇒ rien de proposé, rien d'écrit.
// ─────────────────────────────────────────────────────────────────────────────
import { retrouverParSuivi } from './scanColis.js';
import { lignesDeLAchat, caseChoisie, LOT_MAX } from './rangementArrivee.js';
import { casesProposees } from './ouRanger.js';

const str = (v) => (v == null ? '' : String(v)).trim();
const estObjet = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const txOk = (t) => /^\d+$/.test(str(t));
export const ORIGINE_ARRIVEE = 'arrivee';
export const DUREE_ANNULER_ARRIVEE = 10000;   // Julien : « annulable 10 s »

// ── 1. LE SCAN ⇒ L'ACHAT ─────────────────────────────────────────────────────
// `lu` : ce que `lireCodeColis` a lu ; `enregistrements` : ceux des sources du scanner (src/retrouverColis.js).
// Seuls les ACHATS comptent (une vente ou un retour au même n° ne sont pas « un colis reçu »). Un colis à retirer
// sans achat relié (sorte « colis ») est dit tel quel : « ce colis n'est relié à aucun achat » — jamais deviné.
// Rend { etat: 'pasReconnu' } · { etat: 'un', lu, trouve } · { etat: 'plusieurs', lu, trouves } ·
//      { etat: 'sansAchat', lu } · { etat: 'aucun', lu }.
export function achatDuScan(lu, enregistrements) {
  if (!lu || !lu.suivi) return { etat: 'pasReconnu' };
  const L = Array.isArray(enregistrements) ? enregistrements.filter((e) => e && e.cle != null) : [];
  const r = retrouverParSuivi(lu, L.filter((e) => e.sorte === 'achat'));
  if (r.etat === 'un' || r.etat === 'plusieurs') return r;
  const c = retrouverParSuivi(lu, L.filter((e) => e.sorte === 'colis'));
  if (c.etat === 'un' || c.etat === 'plusieurs') return { etat: 'sansAchat', lu };
  return { etat: 'aucun', lu };
}

// ── 2. LE N° DE L'ARRIVÉE ────────────────────────────────────────────────────
// fiches : `vrm_fiches_neuves` (LUES) · numsAchat : les N° déjà portés par CET achat (relié par identité :
// `buyNumByTxn`) · tx : son n° de transaction.
// Rend { su: false } · { su: true, etat: 'range', fiches } (déjà rangé : rien ne se refait) ·
//      { su: true, etat: 'attribue', numeros } (le N° existe : on le garde, seule la case reste) ·
//      { su: true, etat: 'nouveau' } (le prochain N° selon la méthode d'étiquetage).
export function numeroArrivee({ tx, fiches, numsAchat = [] } = {}) {
  if (!estObjet(fiches)) return { su: false };
  const t = str(tx);
  if (txOk(t)) {
    const deja = Object.values(fiches).filter((f) => f && !f.retireeAt && f.origine === ORIGINE_ARRIVEE && f.achat && str(f.achat.tx) === t && str(f.numero));
    if (deja.length) return { su: true, etat: 'range', fiches: deja.sort((a, b) => (Number(a.achat.ligne) || 0) - (Number(b.achat.ligne) || 0)) };
  }
  const nums = (Array.isArray(numsAchat) ? numsAchat : []).map(str).filter(Boolean);
  if (nums.length) return { su: true, etat: 'attribue', numeros: [...new Set(nums)] };
  return { su: true, etat: 'nouveau' };
}

// Combien de paires : 1 pour un achat simple ; un lot ⇒ le nombre LU (articles de SA transaction, `items_count`),
// sinon null (il le dit : « combien de paires ? »). `choisi` : SON nombre, borné 1..LOT_MAX.
export function pairesDansLeColis(entree, { articles = null, choisi = null } = {}) {
  const e = entree || {};
  const c = Number(choisi);
  if (Number.isInteger(c) && c >= 1) return Math.min(LOT_MAX, c);
  const nA = Array.isArray(articles) ? articles.length : 0;
  if (nA > 1) return Math.min(LOT_MAX, nA);
  const n = Number(e.n);
  if (e.lot || n > 1) return n > 1 ? Math.min(LOT_MAX, n) : null;
  return 1;
}

// ── 3. LES CASES : UNE PAR PAIRE, JAMAIS LA MÊME À DEUX ─────────────────────
// La règle du Stock (`casesProposees`, src/ouRanger.js) pour les N° de ce colis, dans l'ordre. Rend
// { su: false } · { su: true, cases: [case|null…], aucunMeuble? }.
export function casesArrivee({ meubles, slots, numeros, cleNum } = {}) {
  if (!Array.isArray(meubles) || !estObjet(slots) || !Array.isArray(numeros) || typeof cleNum !== 'function') return { su: false };
  const cles = numeros.map((n) => cleNum(n));
  if (cles.some((c) => !c)) return { su: false };
  const r = casesProposees({ meubles, slots, cles });
  if (!r) return { su: false };
  const aucunMeuble = !meubles.some((m) => m && m.id != null);
  return { su: true, cases: cles.map((c) => r[c] || null), ...(aucunMeuble ? { aucunMeuble: true } : {}) };
}
// SON toucher sur une autre case pour la paire k : acceptée seulement si elle est libre et qu'aucune autre paire du
// colis ne l'a. Rend la case, ou null (refusée : rien ne change).
export function autreCase({ meubles, slots, cases, k, m, i } = {}) {
  const autres = (Array.isArray(cases) ? cases : []).filter((c, j) => j !== k && c);
  return caseChoisie({ meubles, slots, m, i, autres });
}

// ── 4. CE QUI S'ÉCRIT SUR « RANGER ICI » ────────────────────────────────────
// Les lignes passées à `opsRanger` (src/rangementArrivee.js : relit tout, refuse plutôt qu'écraser).
//   prixRecu : le prix PAYÉ quand il vient du REÇU de CET achat (décision « 2 oui » du 19 nov.) — sinon aucun prix
//   n'est écrit (l'article seul n'est pas ce qu'il a payé ; un lot ne se divise jamais).
export function lignesArrivee({ entree, numeros, cases, n, prixRecu = null, marqueDe = null } = {}) {
  const nums = Array.isArray(numeros) ? numeros.map(str) : [];
  if (!nums.length || nums.some((x) => !x)) return null;
  const base = lignesDeLAchat({ ...(entree || {}), ...(nums.length > 1 ? { lot: true } : {}) }, { n: nums.length, marqueDe });
  if (!Array.isArray(base) || base.length !== nums.length) return null;
  const recu = nums.length === 1 && Number(n || 1) === 1 && prixRecu && prixRecu.source === 'recu' && Number.isSafeInteger(prixRecu.centimes) && prixRecu.centimes > 0
    ? (prixRecu.centimes / 100).toFixed(2).replace('.', ',') : '';
  return base.map((l, k) => {
    const c = Array.isArray(cases) ? cases[k] : null;
    return { numero: nums[k], titre: l.titre || (entree && entree.titre) || '', marque: l.marque || '', taille: l.taille || '', prix: k === 0 ? recu : '', photo: l.photo || null,
      case: c && c.meubleId != null ? { meubleId: String(c.meubleId), i: Number(c.i) } : null };
  });
}

// La case d'un N° DÉJÀ attribué (une paire de cet achat qui a déjà son N°) : seulement si ce N° n'est dans
// aucune case. Rend l'opération de `vrm_slots`, ou null.
export function opCaseNumero({ slots, numero, place, meubles, cleNum } = {}) {
  if (!estObjet(slots) || typeof cleNum !== 'function') return null;
  const c = cleNum(numero);
  if (!c || slots[c] || !place || place.meubleId == null) return null;
  const ok = caseChoisie({ meubles, slots, m: place.meubleId, i: Number(place.i) });
  if (!ok) return null;
  return { k: 'vrm_slots', type: 'cle', id: c, apres: { m: String(ok.meubleId), i: Number(ok.i) }, avant: undefined };
}

// ── 5. L'ÉTIQUETTE ───────────────────────────────────────────────────────────
// La méthode d'étiquetage (src/etiquetage/methode.js `methodeDe`) : « Imprimer l'étiquette » seulement quand il
// imprime les siennes ; les N° imprimés sont ceux de CE colis, tels quels (aucun N° calculé ici).
export function etiquettesArrivee(methode, lignes) {
  if (!methode || methode.support !== 'imprimee') return null;
  const l = (Array.isArray(lignes) ? lignes : []).filter((x) => x && str(x.numero));
  if (!l.length) return null;
  return { format: methode.format, titre: !!methode.titre, etiquettes: l.map((x) => ({ num: str(x.numero), titre: str(x.titre) })) };
}

// ── 6. LES ARRIVÉS À RANGER (Stock, Aujourd'hui) ────────────────────────────
// `notes` : les achats arrivés notés (« J'ai retiré », le scan — `vrm_arrivees_a_numeroter`) ; `fiches` LUES.
// Un achat déjà rangé (une fiche d'arrivée porte SON n° de transaction) n'y est plus : jamais deux fois.
export function arrivesARanger({ notes, fiches, maintenant = Date.now(), jours = 14 } = {}) {
  if (!estObjet(notes) || !estObjet(fiches)) return [];
  const ranges = new Set();
  for (const f of Object.values(fiches)) if (f && f.origine === ORIGINE_ARRIVEE && f.achat && txOk(f.achat.tx)) ranges.add(str(f.achat.tx));
  const vus = new Set();
  return Object.values(notes)
    .filter((p) => p && txOk(p.tx) && !p.fait && !ranges.has(str(p.tx)) && maintenant - (Number(p.at) || 0) < jours * 864e5)
    .filter((p) => { const t = str(p.tx); if (vus.has(t)) return false; vus.add(t); return true; })
    .sort((a, b) => (Number(b.at) || 0) - (Number(a.at) || 0));
}
