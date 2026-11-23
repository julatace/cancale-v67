// ════════════════════════════════════════════════════════════════════════════
//  COLIS ET VENTES TOUT DE SUITE — CE QUI EST RANGÉ (9 nov., soir ; Julien : « Colis
//  et Ventes s'ouvrent comme Ma journée », proposition 44, lot AE).
//
//  La règle commune (clé par uid, uid dans la valeur, âge, un seul compte sur
//  l'appareil, jamais dans le nuage) est src/instantaneEcran.js. Ici : ce que Colis
//  et Ventes RANGENT, relu dans l'écran vrai (texte et `data-*` rendus, rien n'est
//  recalculé, §11), sur LISTE BLANCHE — chaque champ est justifié dans
//  docs/passation/2026-11-09-colis-ventes-instantanes.md :
//    · Colis : l'onglet montré, les sites du filtre, la phrase « prochaine chose »
//      (compteurs et délai de VRM), la carte des chiffres, les trois onglets et leur
//      nombre, et — pour « À envoyer » seulement — les groupes par transporteur et,
//      par colis : N°, titre court (60 car.), montant, délai rendu, transporteur,
//      prêt / en attente.
//    · Ventes : les sites du filtre, la carte des chiffres, « À venir » (montant et
//      plateformes, SANS le nom du compte), les replis « pas encore lu », et par
//      vente : plateforme, N° s'il est montré, titre court, date rendue, état, montant.
//  JAMAIS : ni nom ou pseudo d'acheteur, ni adresse, ni point relais, ni n° de
//  suivi, ni code de retrait (ils ont leur mécanisme hors ligne : src/journeeHorsLigne.js, src/bordereauxHorsLigne.js),
//  ni photo, ni lien, ni n° de transaction, ni nom de compte (`.vrm-sensible`).
//  Les onglets « Envoyés » et « À retirer » ne rangent AUCUNE liste (suivis, points
//  relais, codes) : leurs nombres seulement.
//  Une valeur encore « lecture… » ⇒ rien n'est rangé (la prochaine relecture rangera).
// Exécuté par scripts/bancs/colis-ventes-instantanes.cjs et scripts/tests/colis-ventes-instantanes.test.mjs.
// ════════════════════════════════════════════════════════════════════════════
import {
  attr, txt, txtSansSensible, enLecture, propre, capturerCarte, enTeteInstantane,
  lireInstantaneEcran, ecrireInstantaneEcran, ageInstantane, carteMontrable,
} from './instantaneEcran.js';

const TITRE_MAX = 60;
const MAX_LIGNES = 30;
const SITES = /^(toutes|vinted|leboncoin|ebay|vestiaire)$/;

// Les sites du filtre (où qu'il soit : dans l'écran au téléphone, dans la barre du haut à l'ordinateur).
const lireFiltre = (doc, cle) => {
  const g = doc && doc.querySelector(`[data-filtre-site="${cle}"]`);
  if (!g) return { sites: null, site: null };
  const bs = [...g.querySelectorAll('button[data-site]')];
  const sites = bs.map((b) => attr(b, 'data-site')).filter((s) => SITES.test(String(s || '')));
  const p = bs.find((b) => attr(b, 'aria-pressed') === 'true');
  return { sites: sites.length ? sites : null, site: p ? attr(p, 'data-site') : null };
};
const titreCourt = (s) => propre(s, TITRE_MAX);

// (16 nov., lot ecrans-restes) La capture de COLIS est retirée (Colis vit dans Ventes « À expédier » depuis le
// 11 nov. ; plus rien ne la rangeait ni ne la montrait). Seule Ventes range encore son instantané.

// ── VENTES ──────────────────────────────────────────────────────────────────
// `racine` = la section `[data-tache="ventes"]` rendue, sur « Tous ».
export function capturerVentes(racine, { uid, maintenant = Date.now(), largeur = 0, doc = (typeof document !== 'undefined' ? document : null) } = {}) {
  if (!racine || !uid) return null;
  if (attr(racine, 'data-tache-site') !== 'toutes') return null;
  const vt = racine.querySelector('[data-ventes-toutes]');
  const carteEl = racine.querySelector('[data-carte-stats="ventes-toutes"]');
  if (!vt || !carteEl || attr(vt, 'data-ventes-toutes') !== 'lu') return null;
  const carte = capturerCarte(carteEl);
  if (!carte) return null;
  const F = lireFiltre(doc || racine, 'ventes');
  const snap = enTeteInstantane('ventes', uid, maintenant, largeur);
  snap.sites = F.sites;
  snap.phrase = txt(racine.querySelector('[data-phrase-ecran="ventes"]'), 120) || '';
  snap.carte = carte;
  // « À venir » : le montant et les plateformes rendus, SANS le nom du compte (`.vrm-sensible`).
  const av = racine.querySelector('section.vrm-a-venir');
  snap.aVenir = av ? {
    titre: txt(av.querySelector(':scope > div > div > div:first-child'), 30) || 'À venir',
    lignes: [...av.querySelectorAll('[data-a-venir-ligne]')].slice(0, 6).map((l) => txtSansSensible(l, 80)).filter(Boolean),
    total: txt(av.querySelector('[data-a-venir-total]'), 24),
  } : null;
  if (snap.aVenir && (enLecture(snap.aVenir.total) || snap.aVenir.lignes.some(enLecture))) return null;
  // Les replis « Vestiaire : pas encore lu » : des phrases de VRM.
  snap.replis = [...vt.querySelectorAll('details.vrm-toutes-repli .vrm-toutes-repli-txt')].slice(0, 4).map((s) => txt(s, 60)).filter(Boolean);
  // Les ventes, dans l'ordre rendu.
  const lignes = [...vt.querySelectorAll('.vrm-toutes-liste [data-toutes-vente]')].slice(0, MAX_LIGNES).map((el) => {
    const titreEl = el.querySelector('.vrm-toutes-titre > span:first-child');
    const etat = el.querySelector('.vrm-toutes-etat');
    const num = txt(el.querySelector('[data-toutes-num]'), 12);
    return {
      site: SITES.test(String(attr(el, 'data-toutes-vente') || '')) ? attr(el, 'data-toutes-vente') : '',
      siteNom: txt(el.querySelector('[data-toutes-site]'), 20),
      num: /^(N°\s*)?[A-Za-z]{0,3}\d{1,6}$/.test(num) ? num.replace(/^N°\s*/, '') : '',
      titre: titreEl ? titreCourt((() => { try { const c = titreEl.cloneNode(true); c.querySelectorAll('[data-toutes-num], .vrm-num, .vrm-sensible').forEach((x) => x.remove()); return c.textContent; } catch (_) { return ''; } })()) : '',
      date: txt(el.querySelector('.vrm-toutes-bureau > span:nth-child(2)'), 20),
      etat: txt(etat, 30), ton: attr(etat, 'data-ton') || '', prix: txt(el.querySelector('[data-toutes-prix]'), 20),
    };
  });
  if (lignes.some((l) => enLecture(l.etat) || enLecture(l.prix) || enLecture(l.titre))) return null;
  snap.lignes = lignes;
  snap.n = Number(attr(vt, 'data-n')) || lignes.length;
  return snap;
}

// ── LECTURE / ÉCRITURE (la règle commune) ───────────────────────────────────
export const lireInstantaneVentes = (uid, opts) => lireInstantaneEcran('ventes', uid, opts);
export const ecrireInstantaneVentes = (snap, opts) => ecrireInstantaneEcran('ventes', snap, opts);

// ── CE QUI SE MONTRE AUJOURD'HUI ────────────────────────────────────────────
// Un autre jour : ni la phrase de la prochaine chose, ni les délais (« 6 j pour l'envoyer »),
// ni les dates relatives (« hier ») ; la carte selon sa portée (jour / mois). Plus de 3 jours : rien.
export function ventesMontrable(s, maintenant = Date.now()) {
  if (!s || s.ecran !== 'ventes') return null;
  const A = ageInstantane(s, maintenant);
  return {
    ...A, sites: s.sites || null, phrase: s.phrase || '', largeur: s.largeur || 0,
    carte: carteMontrable(s.carte, A),
    aVenir: s.aVenir || null, replis: Array.isArray(s.replis) ? s.replis : [],
    lignes: Array.isArray(s.lignes) ? s.lignes.map((l) => ({ ...l, date: A.memeJour ? l.date : '' })) : [],
  };
}
