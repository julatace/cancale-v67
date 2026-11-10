// ═══════════════════════════════════════════════════════════════════════════
// SIRI / RACCOURCIS (10 novembre, lot AH) — deux liens profonds, rien d'autre.
// ═══════════════════════════════════════════════════════════════════════════
// Une PWA ne peut pas déclarer d'intention Siri : l'app Raccourcis de l'iPhone
// « Ouvre l'URL » d'un lien de VRM, et Siri lance le raccourci par son nom.
//   · « Ajouter un achat » : `?tab=achats&achat=1` (+ `titre`, `prix`, `ou` si le
//     raccourci les DEMANDE) ⇒ Achats, le formulaire « Nouvel achat » ouvert et
//     pré-rempli de ce qu'il a dit. RIEN n'est enregistré sans son « Ajouter l'achat ».
//   · « Où est le N° … ? » : `?tab=journee&q=124` ⇒ la recherche (la loupe) ouverte
//     sur ce N° (le bloc « Tout sur le N° » de la recherche universelle). La dictée
//     (« cent vingt-quatre », « B 125 ») passe par la MÊME règle que le micro de la
//     loupe (`requeteDeLaVoix`, src/rechercheVocale.js).
// Aucune donnée dans le lien au-delà de ce qu'il tape ; l'app efface l'adresse dès
// qu'elle l'a lue (`goto`, App.jsx). Un champ illisible reste VIDE (jamais deviné).
// Exécuté par scripts/audit-raccourcis-siri.cjs ; rendu : scripts/bancs/raccourcis-siri.cjs.
import { requeteDeLaVoix } from './rechercheVocale.js';

export const ORIGINE_VRM = 'https://vrm.center';
export const TITRE_MAX = 80;
export const LIEU_MAX = 40;
export const RECHERCHE_MAX = 64; // la loupe refuse au-delà (`vrm:fiche-article`)

const propre = (v, max) => String(v == null ? '' : v)
  .replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, ' ')
  .replace(/\s+/g, ' ').trim().slice(0, max).trim();

// « 45 », « 45,5 », « 45.50 », « 45 € » ⇒ « 45 », « 45,5 », « 45,50 », « 45 » ;
// autre chose (« quarante », « 12,345 », « -3 ») ⇒ '' : le champ reste vide.
export const prixDuLien = (v) => {
  const s = String(v == null ? '' : v).replace(/[\s  €]/g, '');
  if (!/^\d{1,5}(?:[.,]\d{1,2})?$/.test(s)) return '';
  return s.replace('.', ',');
};

// Les paramètres d'un lien (URLSearchParams) ⇒ le brouillon d'achat, ou null.
// `achat=1` est exigé : un `titre=` seul (un autre lien) n'ouvre rien.
export const lireDemandeAchat = (p) => {
  if (!p || typeof p.get !== 'function' || p.get('achat') !== '1') return null;
  // (10 nov., lot J) `photo=partage` : une photo partagée depuis l'app Photos attend dans
  // l'appareil (public/sw.js, src/partagePhoto.js) — rien d'autre ne passe par le lien.
  const d = { titre: propre(p.get('titre'), TITRE_MAX), prix: prixDuLien(p.get('prix')), lieu: propre(p.get('ou'), LIEU_MAX) };
  if (p.get('photo') === 'partage') d.photoPartagee = true;
  return d;
};

// `q` ⇒ la requête de la loupe ('' = rien). « numéro 124 », « cent vingt-quatre » ⇒ « 124 ».
export const lireRechercheLien = (p) => {
  if (!p || typeof p.get !== 'function') return '';
  const brut = propre(p.get('q'), 200);
  if (!brut) return '';
  const r = requeteDeLaVoix(brut);
  const q = propre(r.requete, RECHERCHE_MAX + 1);
  return q && q.length <= RECHERCHE_MAX ? q : '';
};

// La demande d'achat, consommée UNE fois par le formulaire (même motif que DEMANDE_VUE) ;
// au-delà de 2 minutes (écran jamais ouvert), elle est oubliée.
const DEMANDE = { brouillon: null, at: 0 };
export const EVT_ACHAT_LIEN = 'vrm:achat-lien';
export const poserDemandeAchat = (b) => {
  DEMANDE.brouillon = b || null; DEMANDE.at = Date.now();
  try { window.dispatchEvent(new Event(EVT_ACHAT_LIEN)); } catch (_) {}
};
export const prendreDemandeAchat = () => {
  const b = DEMANDE.brouillon; DEMANDE.brouillon = null;
  return b && Date.now() - DEMANDE.at < 120000 ? b : null;
};

// Les deux raccourcis, tels que l'aide de Paramètres les montre (src/RaccourcisSiri.jsx).
// `lien` : à coller dans « Ouvrir les URL » ; `variable` : ce qu'on ajoute à la fin.
export const RACCOURCIS_SIRI = [
  {
    cle: 'achat', nom: 'Ajouter un achat', dire: '« Dis Siri, ajouter un achat »',
    lien: (o = ORIGINE_VRM) => `${o}/?tab=achats&achat=1`,
    etapes: [
      'Raccourcis → + → « Ouvrir les URL ».',
      'Colle le lien copié.',
      'Nomme-le « Ajouter un achat ».',
    ],
    plus: 'Pour le pré-remplir : ajoute « Demander une entrée » avant, puis colle « &titre= » à la fin du lien et touche l’entrée fournie. Même chose avec « &prix= ». Rien n’est enregistré sans ton « Ajouter l’achat ».',
  },
  {
    cle: 'numero', nom: 'Où est le N°', dire: '« Dis Siri, où est le N° »',
    lien: (o = ORIGINE_VRM) => `${o}/?tab=journee&q=`,
    etapes: [
      'Raccourcis → + → « Demander une entrée » (Texte).',
      'Puis « Ouvrir les URL » : le lien, puis l’entrée fournie.',
      'Nomme-le « Où est le N° ».',
    ],
    plus: 'Siri demande le N°, tu le dis (« cent vingt-quatre », « B 125 ») : VRM s’ouvre sur la recherche de ce N°.',
  },
];
