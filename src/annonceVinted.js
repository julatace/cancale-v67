// ── CRÉER SUR VINTED DEPUIS UNE FICHE VRM (11 nov., lot annonce-vinted, extension 5.367) ──
// Demande validée par Julien : les photos, le titre, la taille, l'état, la marque, la
// couleur, la catégorie, le prix et le N° sont déjà dans VRM ⇒ sur SON clic
// « Créer sur Vinted », l'extension prépare un BROUILLON sur vinted.fr (onglet ouvert,
// compte de l'onglet) ; c'est LUI qui clique « Publier » (sur Vinted, ou depuis VRM).
// Ce module est la RÈGLE de l'app (pur, sans React) : la feuille
// (src/CreerSurVinted.jsx) et `scripts/audit-annonce-vinted.cjs` l'EXÉCUTENT.
//
// ⚠️ LE N° (§5) : écrit dans le texte selon SES réglages, jamais ailleurs :
//    · l'étiquette « N° dans le texte » (`vrm_num_vinted`, src/etiquetteNumero.js) ;
//    · « Je numérote moi-même » (`vrm_numero_ecrit`, src/numeroEcrit.js) allumé avec
//      « à la fin de la description » ⇒ « N°41 » en dernière ligne (la forme que la
//      lecture de VRM relit), sauf s'il y est déjà.
//    Un AUTRE N° déjà écrit dans la fiche ⇒ refus nommé (jamais deux numéros).
// ⚠️ L'IDENTITÉ : la fiche est reliée à l'annonce par l'IDENTIFIANT que Vinted rend
//    pour le brouillon (`vinted.draftId`) — jamais par un titre semblable.
// ⚠️ LISTE BLANCHE : seuls les champs de l'annonce partent vers l'extension (ni prix
//    d'achat, ni identifiant d'une autre annonce).
import { poserEtiquette, lireReglageEtiquette, TITRE_MAX_VINTED } from './etiquetteNumero.js';
import { lireReglageNumeroEcrit, lireNumeroTexte, numerosMarques, cleNumero } from './numeroEcrit.js';

const str = (v) => String(v == null ? '' : v).trim();
export const DESCRIPTION_MIN = 5;
export const PHOTOS_MAX = 20;

// Le texte qui part : { ok, titre, description } ou { ok:false, raison }.
export function texteAnnonceVinted(fiche, { etiquette = null, numeroEcrit = null } = {}) {
  const f = fiche || {};
  const num = str(f.numero);
  let titre = str(f.titre).replace(/\s+/g, ' ');
  let description = String(f.description == null ? '' : f.description).replace(/\r/g, '').trim();
  if (!num) return { ok: false, raison: 'la fiche n’a pas de N°' };
  const c = cleNumero(num);
  // Un autre N° déjà écrit (titre ou description) : jamais deux numéros.
  const autre = [...numerosMarques(titre), ...numerosMarques(description)].find((x) => x.cle !== c);
  if (autre) return { ok: false, raison: `la fiche porte déjà un autre N° écrit (N°${autre.cle}) : corrige le texte avant de créer l’annonce` };
  const r = poserEtiquette({ titre, description }, num, lireReglageEtiquette(etiquette));
  if (r.refus && r.refus !== 'pas de numéro') return { ok: false, raison: r.refus };
  titre = r.titre; description = r.description;
  const nE = lireReglageNumeroEcrit(numeroEcrit);
  const ecritFin = nE.actif && nE.ou.includes('description');
  if (ecritFin) {
    const lu = lireNumeroTexte(description, 'description');
    if (!(lu && lu.etat === 'lu' && lu.cle === c)) description = poserEtiquette({ titre, description }, num, { place: 'desc_fin', forme: 'numero' }).description;
  }
  if (titre.length > TITRE_MAX_VINTED) return { ok: false, raison: `le titre dépasserait ${TITRE_MAX_VINTED} caractères (${titre.length}) : Vinted le refuserait` };
  if (!titre) return { ok: false, raison: 'le titre est vide' };
  return { ok: true, titre, description };
}

const prixDe = (p) => { const n = Number(String(p == null ? '' : (typeof p === 'object' ? p.amount : p)).replace(',', '.')); return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null; };

// Ce qui manque pour partir : 'photos' · 'titre' · 'prix' · 'numero' · 'description'.
export function manquesFiche(fiche, photos) {
  const f = fiche || {}; const m = [];
  if (!(Array.isArray(photos) && photos.length)) m.push('photos');
  if (!str(f.titre)) m.push('titre');
  if (prixDe(f.prix) == null) m.push('prix');
  if (!str(f.numero)) m.push('numero');
  if (str(f.description).length < DESCRIPTION_MIN) m.push('description');
  return m;
}

// Ce qui part vers l'extension (liste blanche).
export function payloadFiche(fiche, texte, photos) {
  const f = fiche || {};
  const BLANCHE = ['id', 'numero', 'marque', 'taille', 'etat', 'couleur', 'categorie'];
  const out = {};
  for (const k of BLANCHE) out[k] = str(f[k]);
  out.titre = str(texte && texte.titre);
  out.description = String((texte && texte.description) || '');
  out.prix = prixDe(f.prix);
  out.photos = (Array.isArray(photos) ? photos : []).filter((u) => typeof u === 'string').slice(0, PHOTOS_MAX);
  return out;
}

// L'état de la fiche côté Vinted, par l'IDENTIFIANT rendu : 'a-creer' · 'brouillon' · 'en-ligne'.
// `items` : les annonces lues de ses dressings (avec `is_draft`).
export function etatFicheVinted(fiche, items) {
  const f = fiche || {};
  const d = f.vinted && f.vinted.draftId ? String(f.vinted.draftId) : '';
  if (!d) return 'a-creer';
  if (f.vinted.publieAt) return 'en-ligne';   // SA mise en ligne depuis VRM, acceptée par Vinted
  const it = (Array.isArray(items) ? items : []).find((x) => String(x && x.id) === String(d));
  return it && !it.is_draft ? 'en-ligne' : 'brouillon';
}

// Les refus qui valent pour toute la série (le compte, l'onglet, le plafond).
const ARRET = new Set(['plafond', 'plafond-bordereaux', 'vinted-pause', 'frein-refus', 'onglet-vinted', 'vinted-absent', 'vinted-autre', 'stockage', 'catalogue-absent', 'absente']);
// La réponse de l'extension ⇒ l'issue du suivi (`lancerTravail`).
export function issueCreation(r) {
  if (!r || r.sansReponse) return { etat: 'main', raison: 'l’extension n’a pas répondu à temps : elle a peut-être fini', geste: 'Regarde tes brouillons Vinted avant de relancer' };
  if (r.envoye === false) return { etat: 'refus', raison: str(r.raison) || 'l’extension ne répond pas', geste: 'Ouvre VRM dans le navigateur où l’extension est installée', arreterTout: true };
  if (r.accepte === true && r.etape === 'fait') return { etat: 'ok', raison: Array.isArray(r.aFinir) && r.aFinir.length ? `à choisir sur Vinted : ${r.aFinir.join(', ')}` : '' };
  if (r.accepte === true && r.etape === 'incertain') return { etat: 'main', raison: str(r.raison) || 'issue pas claire', geste: 'Regarde tes brouillons Vinted' };
  if (ARRET.has(String(r.code || ''))) return { etat: 'refus', raison: str(r.raison) || 'refusé', geste: 'Attends, puis relance', arreterTout: true };
  return { etat: 'refus', raison: str(r.raison) || 'refusé', geste: r.code === 'deja' ? 'Ouvre le brouillon sur Vinted' : 'Corrige la fiche, puis relance' };
}

// Une réponse à une question de l'extension est-elle utilisable (un champ, des valeurs de Vinted) ?
export const questionOk = (q) => !!(q && typeof q === 'object' && q.champ && Array.isArray(q.options) && q.options.length && q.options.every((o) => Array.isArray(o) && /^\d{1,12}$/.test(String(o[0])) && o[1]));
// La recherche dans une longue liste (catalogue) : chaque mot doit y être (casse et accents mis à part).
const plat = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export function filtrerOptions(options, texte, max = 60) {
  const mots = plat(texte).split(/\s+/).filter(Boolean);
  const l = (Array.isArray(options) ? options : []).filter(([, t]) => mots.every((m) => plat(t).includes(m)));
  return l.slice(0, max);
}
