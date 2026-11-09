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
const ONGLETS_COLIS = ['envoyer', 'envoyes', 'retirer'];
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

// ── COLIS ───────────────────────────────────────────────────────────────────
// `racine` = l'écran Colis rendu (le contenu de son attente, prête).
export function capturerColis(racine, { uid, maintenant = Date.now(), largeur = 0, doc = (typeof document !== 'undefined' ? document : null) } = {}) {
  if (!racine || !uid) return null;
  const og = racine.querySelector('.vrm-colis-onglets[data-colis-onglet]');
  const carteEl = racine.querySelector('[data-carte-stats="colis"]');
  if (!og || !carteEl) return null;
  const onglet = attr(og, 'data-colis-onglet');
  if (!ONGLETS_COLIS.includes(onglet)) return null;
  // Le filtre des sites : seul « Tous » est rangé (l'écran s'ouvre sur « Tous »).
  const F = lireFiltre(doc || racine, 'colis');
  if (F.site && F.site !== 'toutes') return null;
  const carte = capturerCarte(carteEl);
  if (!carte) return null;
  const snap = enTeteInstantane('colis', uid, maintenant, largeur);
  snap.onglet = onglet;
  snap.sites = F.sites;
  snap.phrase = txt(racine.querySelector('[data-phrase-ecran="colis"]'), 120) || '';
  // La prochaine chose : sa phrase (compteurs et délai de VRM) et le mot de son geste.
  const pr = racine.querySelector('[data-colis-prochain]');
  if (pr) {
    const sous = txt(pr.querySelector('.vrm-colis-prochain-sous'));
    const t = pr.querySelector('.vrm-colis-prochain-txt');
    const tout = txt(t, 160);
    const texte = sous && tout.endsWith(sous) ? propre(tout.slice(0, tout.length - sous.length)) : tout;
    snap.prochain = texte && !enLecture(tout) ? { cle: attr(pr, 'data-colis-prochain') || '', texte: propre(texte, 120), sous: propre(sous.replace(/^·\s*/, ''), 60) } : null;
  } else snap.prochain = null;
  snap.carte = carte;
  // Les trois onglets et leur nombre.
  const ons = [...og.querySelectorAll('[data-colis-onglet-choix]')].map((b) => {
    const n = attr(b, 'data-colis-onglet-n');
    const l = (() => { try { const c = b.cloneNode(true); c.querySelectorAll('.vrm-seg-n').forEach((x) => x.remove()); return propre(c.textContent, 30); } catch (_) { return ''; } })();
    return { cle: attr(b, 'data-colis-onglet-choix'), l, n: n != null && /^\d+$/.test(n) ? Number(n) : null, presse: attr(b, 'aria-pressed') === 'true', urgent: attr(b, 'data-urgent') === '1' };
  }).filter((o) => ONGLETS_COLIS.includes(o.cle));
  if (ons.length !== 3 || ons.some((o) => enLecture(o.l))) return null;
  snap.onglets = ons;
  // La liste — « À envoyer » seulement : groupes par transporteur, puis les colis dans l'ordre rendu.
  const grille = racine.querySelector('.vrm-colis-grille');
  snap.liste = null;
  if (onglet === 'envoyer' && grille) {
    const liste = [];
    for (const el of grille.children) {
      if (liste.length >= MAX_LIGNES) break;
      if (el.hasAttribute('data-groupe-transp')) { liste.push({ g: txt(el.querySelector('h3'), 40), n: txt(el.querySelector(':scope > span:last-child'), 20) }); continue; }
      if (!el.hasAttribute('data-bord-card')) continue;
      const titreEl = el.querySelector('.vrm-colis-titre');
      const titre = (() => { if (!titreEl) return ''; try { const c = titreEl.cloneNode(true); c.querySelectorAll('.vrm-num').forEach((x) => x.remove()); return titreCourt(c.textContent); } catch (_) { return ''; } })();
      const num = attr(el, 'data-colis-num') || txt(el.querySelector('.vrm-colis-titre .vrm-num [aria-hidden="true"]:last-child'), 12);
      liste.push({
        num: /^[A-Za-z]{0,3}\d{1,6}$/.test(String(num || '')) ? String(num) : '',
        titre, prix: txt(el.querySelector('.vrm-colis-prix'), 20),
        limite: txt(el.querySelector('[data-colis-limite-texte]'), 40), attente: txt(el.querySelector('[data-colis-attente]'), 30),
        transp: txt(el.querySelector('[data-transporteur-nom]'), 30), groupe: attr(el, 'data-groupe-carte') === 'pret' ? 'pret' : 'attente',
      });
    }
    if (liste.some((l) => enLecture(l.titre) || enLecture(l.prix) || enLecture(l.limite))) return null;
    snap.liste = liste;
    // L'écart entre les onglets et la liste (outils, tournée : des gestes, jamais rangés) : sa hauteur seulement.
    // (les marges propres des onglets et de la grille se retrouvent dans l'instantané : elles sont retirées)
    try {
      const a = og.getBoundingClientRect(); const b = grille.getBoundingClientRect();
      const cs = (e) => (typeof getComputedStyle === 'function' ? getComputedStyle(e) : null);
      const m = (e, k) => { const c = cs(e); return c ? parseFloat(c[k]) || 0 : 0; };
      snap.ecart = Math.max(0, Math.min(400, Math.round(b.top - a.bottom - m(og, 'marginBottom') - m(grille, 'marginTop'))));
    } catch (_) { snap.ecart = 0; }
  }
  return snap;
}

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
export const lireInstantaneColis = (uid, opts) => lireInstantaneEcran('colis', uid, opts);
export const lireInstantaneVentes = (uid, opts) => lireInstantaneEcran('ventes', uid, opts);
export const ecrireInstantaneColis = (snap, opts) => ecrireInstantaneEcran('colis', snap, opts);
export const ecrireInstantaneVentes = (snap, opts) => ecrireInstantaneEcran('ventes', snap, opts);

// ── CE QUI SE MONTRE AUJOURD'HUI ────────────────────────────────────────────
// Un autre jour : ni la phrase de la prochaine chose, ni les délais (« 6 j pour l'envoyer »),
// ni les dates relatives (« hier ») ; la carte selon sa portée (jour / mois). Plus de 3 jours : rien.
export function colisMontrable(s, maintenant = Date.now()) {
  if (!s || s.ecran !== 'colis') return null;
  const A = ageInstantane(s, maintenant);
  return {
    ...A, onglet: s.onglet, sites: s.sites || null, phrase: s.phrase || '', largeur: s.largeur || 0, ecart: s.ecart || 0,
    prochain: A.memeJour ? s.prochain || null : null,
    carte: carteMontrable(s.carte, A),
    onglets: Array.isArray(s.onglets) ? s.onglets : null,
    liste: Array.isArray(s.liste) ? s.liste.map((l) => (l.g != null ? l : { ...l, limite: A.memeJour ? l.limite : '', attente: A.memeJour ? l.attente : '' })) : null,
  };
}
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
