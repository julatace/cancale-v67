// ══════════════════════════════════════════════════════════════════════════════
//  « SANTÉ DE TES DONNÉES » (11 nov., lot sante-donnees)
//  Julien : « surtout PRATIQUE : gagner du temps ». UN écran (Paramètres → Santé de
//  tes données, et une ligne dans « Tout va bien ? ») qui liste, par ordre de
//  gravité, ce qui cloche — chaque ligne = un nombre, une phrase, UN bouton qui
//  ouvre le parcours où IL corrige.
// ══════════════════════════════════════════════════════════════════════════════
//  Ce module NE COMPTE RIEN LUI-MÊME (§5, « une seule règle par notion, un seul
//  propriétaire ») : il range des nombres déjà comptés ailleurs.
//    · `lignesATrancher` (src/aTrancher.js) : N° portés par deux paires, N° à
//      écrire, colis cochés « posté » pas vus partir, annonces sans prix d'achat,
//      ventes à dater — publiés par Colis, Annonces, Ventes ;
//    · `beneficeParSource(lireSources()).sansAchat` (src/sourceAchats.js) : les
//      ventes finalisées sans achat relié, publiées par l'écran Ventes ;
//    · `aVoirCapture` (ci-dessous, la règle de « Tout va bien ? », qui l'appelle
//      aussi) : comptes à relire (`lignesFraicheur`), extension en retard
//      (`etatVersion`, api/_lib/garde-capture.js) ;
//    · `vrm_sante` (cet appareil, ce compte VRM) : ce qui ne vivait qu'en mémoire
//      d'un écran, publié PAR CET ÉCRAN au moment où il le compte — Annonces
//      (`annAConfirmer` : annonces d'un compte pas relu depuis 24 h), Achats
//      (`aConfirmerVisibles` : « Tout est OK » à confirmer avant la date limite) ;
//    · les e-mails mis de côté (`useMisDeCote`, la route `email-rattacher?mode=liste`)
//      et le compteur « à vérifier » du journal (`compteurs.aVerifier`).
//  Trois états par ligne : `undefined` lecture… · `null` pas su (« — · pas lu »,
//  jamais 0) · un entier. « Tout est à jour ✓ » seulement si TOUTES les lignes
//  sont lues et à 0. Rien n'est corrigé ici : un bouton n'OUVRE qu'un écran.
//  Pur (le stockage est passé en paramètre) : scripts/audit-sante-donnees.cjs l'exécute.
// ══════════════════════════════════════════════════════════════════════════════
import { FRAIS_MS } from './aTrancher.js';
import { beneficeParSource } from './sourceAchats.js';

export const CLE_SANTE = 'vrm_sante';
export const SOURCES_SANTE = ['annonces-a-confirmer', 'colis-a-confirmer'];

const pl = (n, s, p) => (n > 1 ? p : s);

// L'ordre = la gravité : ce qui envoie la mauvaise paire, puis ce qui a une date
// limite, puis ce qui fausse un chiffre, puis ce qui empêche de lire.
// `geste` : ce que le bouton ouvre — `tab`, `onglet` de Colis, `vue` d'Annonces,
// `cible`/`clic` (un bloc de l'écran propriétaire), `saisiePrix` (la saisie en
// série, DEMANDE_SAISIE_PRIX), `reglage` (un panneau de Paramètres), `emails`
// (la rubrique de l'écran E-mails, `ouvrirEmailsRelier`).
export const LIGNES = [
  { cle: 'numeros-double', ton: 'rouge', de: 'trancher', nom: 'Deux articles sous le même N°',
    phrase: (n) => `${n} N° ${pl(n, 'porté', 'portés')} par deux articles : au moment d’expédier, le mauvais peut partir`,
    geste: { libelle: 'Corriger', tab: 'cat_bord', onglet: 'envoyer', cible: '[data-numeros-double]' } },
  { cle: 'numeros-a-ecrire', de: 'trancher', nom: 'Nouveaux N° à écrire',
    phrase: (n) => `${n} ${pl(n, 'nouveau N°', 'nouveaux N°')} à écrire là où ${pl(n, 'l’article est rangé', 'les articles sont rangés')} — puis « C’est écrit »`,
    geste: { libelle: 'C’est écrit ?', tab: 'cat_bord', onglet: 'envoyer', cible: '[data-numeros-a-ecrire]' } },
  { cle: 'colis-a-confirmer', de: 'sante', ecran: 'Achats', nom: 'Colis à confirmer (« Tout est OK »)',
    phrase: (n) => `${n} ${pl(n, 'colis', 'colis')} à confirmer sur Vinted avant la date limite — passé la date, Vinted conclut sans toi`,
    geste: { libelle: 'Voir', tab: 'achats', cible: '[data-a-confirmer]' } },
  { cle: 'colis-postes', de: 'trancher', nom: 'Colis « posté » pas vus partir',
    phrase: (n) => `${n} colis ${pl(n, 'coché', 'cochés')} « posté » que Vinted n’a pas ${pl(n, 'vu', 'vus')} partir`,
    geste: { libelle: 'Vérifier', tab: 'cat_bord', onglet: 'envoyes' } },
  { cle: 'emails-mis-de-cote', de: 'emails', nom: 'E-mails mis de côté',
    phrase: (n) => `${n} ${pl(n, 'e-mail mis', 'e-mails mis')} de côté : aucun compte ne ${pl(n, 'le', 'les')} réclame`,
    geste: { libelle: 'Rattacher', tab: 'emails', emails: 'a-traiter', clic: '[data-boite-vue="relier"]', cible: '[data-emails-mis-de-cote]' } },
  { cle: 'emails-a-verifier', de: 'emails', nom: 'E-mails à vérifier',
    phrase: (n) => `${n} ${pl(n, 'e-mail', 'e-mails')} que VRM n’a pas su ranger sûrement`,
    geste: { libelle: 'Vérifier', tab: 'emails', emails: 'journal', filtre: 'a-verifier', clic: '[data-boite-vue="relier"]' } },
  { cle: 'achats-sans-prix', de: 'trancher', nom: 'Articles sans prix d’achat',
    phrase: (n) => `${n} ${pl(n, 'annonce numérotée', 'annonces numérotées')} sans prix d’achat : le bénéfice ne les compte pas`,
    geste: { libelle: 'Saisir en série', tab: 'vinted_annonces', saisiePrix: true } },
  { cle: 'ventes-sans-achat', de: 'ventes', ecran: 'Ventes', nom: 'Ventes non reliées à un achat',
    phrase: (n) => `${n} ${pl(n, 'vente', 'ventes')} sans achat relié : leur bénéfice n’est pas sûr`,
    geste: { libelle: 'Relier', tab: 'vinted_annonces', saisiePrix: true } },
  { cle: 'ventes-a-dater', de: 'trancher', nom: 'Ventes sans date de versement',
    phrase: (n) => `${n} ${pl(n, 'vente', 'ventes')} sans date de versement : dans aucun mois déclaré`,
    geste: { libelle: 'Voir pourquoi', tab: 'compta', clic: '[data-urssaf-dater]' } },
  { cle: 'comptes-a-relire', de: 'capture', nom: 'Comptes pas relus',
    phrase: (n) => `${n} ${pl(n, 'compte pas relu', 'comptes pas relus')} depuis plus d’un jour (ou bloqué)`,
    geste: { libelle: 'Voir', reglage: 'toutvabien' } },
  { cle: 'extension-en-retard', de: 'capture', nom: 'Extension en retard',
    phrase: (n) => `${n} ${pl(n, 'navigateur a', 'navigateurs ont')} une extension VRM plus ancienne que celle servie`,
    geste: { libelle: 'Mettre à jour', reglage: 'toutvabien' } },
  { cle: 'annonces-a-confirmer', de: 'sante', ecran: 'Annonces', nom: 'Annonces « à confirmer »',
    phrase: (n) => `${n} ${pl(n, 'annonce', 'annonces')} d’un compte pas relu depuis 24 h : en ligne ou pas, on ne sait pas`,
    geste: { libelle: 'Voir', tab: 'cat_annonces' } },
];
export const CLES_LIGNES = LIGNES.map((l) => l.cle);

// ── la publication `vrm_sante` (un nombre par source, local, jamais synchronisé) ──
const lireBrut = (storage) => { try { const t = storage.getItem(CLE_SANTE); const v = t ? JSON.parse(t) : null; return v && typeof v === 'object' ? v : null; } catch (_) { return null; } };
// Rend true si la ligne a changé. `n` non entier ⇒ rien n'est écrit (pas su ne s'écrit jamais).
export function publierSante(storage, uid, cle, n, maintenant = Date.now()) {
  if (!storage || !uid || !SOURCES_SANTE.includes(cle)) return false;
  if (!(Number.isInteger(n) && n >= 0)) return false;
  const brut = lireBrut(storage);
  const s = brut && brut.uid === String(uid) && brut.s && typeof brut.s === 'object' ? { ...brut.s } : {};
  const avant = s[cle];
  if (avant && avant.n === n && maintenant - Number(avant.at) < 3600e3) return false;
  s[cle] = { n, at: maintenant };
  try { storage.setItem(CLE_SANTE, JSON.stringify({ uid: String(uid), s })); } catch (_) { return false; }
  return true;
}
export function lirePubsSante(storage, uid) {
  const brut = lireBrut(storage);
  return brut && uid && brut.uid === String(uid) && brut.s && typeof brut.s === 'object' ? brut.s : {};
}

// ── la règle de « Tout va bien ? » (src/ToutVaBien.jsx l'appelle pour son « N choses à voir ») ──
// `etat` : celui de `useEtatCapture` ; `etatVersion`/`attendue` passés (api/_lib/garde-capture.js).
// Rend { comptes, extensions } — chacun undefined (lecture) · null (pas su) · un entier.
export function aVoirCapture(etat, { etatVersion, attendue } = {}) {
  if (!etat || !etat.comptesPrets) return { comptes: undefined, extensions: undefined, comptesPasSu: false, extensionsPasSu: false, ancienInconnu: null, anciens: [] };
  const passu = Array.isArray(etat.passu) ? etat.passu : [];
  const panneDe = new Set((etat.pannes || []).map((p) => `${p.plateforme}:${p.id}`));
  // Ce qui EST lu est compté ; ce qui ne l'est pas est dit à côté (`…PasSu`) — jamais 0 à sa place.
  const comptes = (etat.lignes || []).filter((l) => l.geste || panneDe.has(`${l.plateforme}:${l.id}`)).length;
  const comptesPasSu = passu.some((p) => p !== 'tes appareils');
  const appareils = Array.isArray(etat.appareils) ? etat.appareils : [];
  const vers = typeof etatVersion === 'function' ? etatVersion : () => 'pas-su';
  const anciens = appareils.filter((a) => vers(a, attendue) === 'ancienne');
  // Une extension d'avant la 5.327 qui a écrit en dernier, sans dire son appareil.
  const ancien = etat.ancien;
  const ancienInconnu = ancien && ancien.ver && vers({ ver: ancien.ver, code: ancien.code }, attendue) === 'ancienne'
    && !appareils.some((a) => a.at >= ancien.at - 60000) ? ancien : null;
  return { comptes, extensions: anciens.length + (ancienInconnu ? 1 : 0), comptesPasSu, extensionsPasSu: !Array.isArray(etat.appareils) || typeof etatVersion !== 'function', ancienInconnu, anciens };
}

// ── les lignes ──────────────────────────────────────────────────────────────────
// trancher   : le résultat de `lignesATrancher(...)` (ou undefined)
// pubsSante  : `lirePubsSante(...)`
// sources    : `lireSources(owner)` (src/sourceAchats.js) — null = jamais publiée ; undefined = lecture
// capture    : `aVoirCapture(...)`
// misDeCote  : `useMisDeCote()` (undefined · null · { emails: [] })
// aVerifier  : le compteur du journal (undefined · null · entier)
const ilYa = (ms) => { const h = Math.round(ms / 3600e3); return h < 48 ? `${h} h` : `${Math.round(h / 24)} j`; };
function etatPub(p, maintenant, ecran) {
  if (!p || !Number.isFinite(Number(p.at))) return { n: null, raison: `pas encore compté sur cet appareil : ouvre ${ecran}` };
  const age = maintenant - Number(p.at);
  if (age > FRAIS_MS) return { n: null, raison: `compté il y a ${ilYa(age)} : ouvre ${ecran} pour le recompter` };
  return Number.isInteger(Number(p.n)) ? { n: Number(p.n), raison: '' } : { n: null, raison: 'pas lu' };
}
export function lignesSante({ trancher, pubsSante = {}, sources, capture = {}, misDeCote, aVerifier, maintenant = Date.now() } = {}) {
  const tr = trancher && Array.isArray(trancher.lignes) ? new Map(trancher.lignes.map((l) => [l.cle, l])) : null;
  const lignes = LIGNES.map((L, ordre) => {
    let e;
    if (L.de === 'trancher') {
      const t = tr ? tr.get(L.cle) : undefined;
      e = !tr ? { n: undefined, raison: 'lecture…' } : !t ? { n: null, raison: 'pas lu' }
        : Number.isInteger(t.n) ? { n: t.n, raison: '' } : { n: t.n === undefined ? undefined : null, raison: t.raison || 'pas lu' };
    } else if (L.de === 'sante') {
      e = etatPub(pubsSante[L.cle], maintenant, L.ecran);
    } else if (L.de === 'ventes') {
      if (sources === undefined) e = { n: undefined, raison: 'lecture…' };
      else if (!sources || !Array.isArray(sources.lignes)) e = { n: null, raison: `pas encore compté sur cet appareil : ouvre ${L.ecran}` };
      else if (!(maintenant - Number(sources.at) <= FRAIS_MS)) e = { n: null, raison: `compté il y a ${ilYa(maintenant - Number(sources.at) || 0)} : ouvre ${L.ecran} pour le recompter` };
      else e = { n: beneficeParSource(sources.lignes).sansAchat, raison: sources.partiel ? 'une plateforme pas lue : au moins' : '' };
    } else if (L.cle === 'comptes-a-relire' || L.cle === 'extension-en-retard') {
      const [v, ps, quoi] = L.cle === 'comptes-a-relire' ? [capture.comptes, capture.comptesPasSu, 'la relecture de certains comptes'] : [capture.extensions, capture.extensionsPasSu, 'la liste des appareils'];
      // Un nombre lu > 0 se dit (« au moins » si une partie manque) ; 0 avec une partie pas lue = pas su.
      e = v === undefined ? { n: undefined, raison: 'lecture…' }
        : !Number.isInteger(v) || (ps && v === 0) ? { n: null, raison: `${quoi} n’a pas pu être lue` }
        : { n: v, raison: ps ? `au moins : ${quoi} n’a pas pu être lue` : '' };
    } else if (L.cle === 'emails-mis-de-cote') {
      e = misDeCote === undefined ? { n: undefined, raison: 'lecture…' }
        : misDeCote && Array.isArray(misDeCote.emails) ? { n: misDeCote.emails.length, raison: '' } : { n: null, raison: 'la boîte VRM n’a pas répondu' };
    } else if (L.cle === 'emails-a-verifier') {
      e = aVerifier === undefined ? { n: undefined, raison: 'lecture…' } : Number.isInteger(aVerifier) && aVerifier >= 0 ? { n: aVerifier, raison: '' } : { n: null, raison: 'le journal des e-mails n’a pas répondu' };
    } else e = { n: null, raison: 'pas lu' };
    const n = e.n;
    const etat = Number.isInteger(n) ? (n > 0 ? (L.ton === 'rouge' ? 'rouge' : 'geste') : 'ok') : n === null ? 'passu' : 'lecture';
    return { cle: L.cle, ordre, nom: L.nom, n, etat, raison: e.raison, phrase: Number.isInteger(n) && n > 0 ? L.phrase(n) : '', geste: L.geste };
  });
  // Par gravité : rouge, puis un geste (dans l'ordre de LIGNES), puis « pas lu », puis lecture, puis à jour.
  const rang = { rouge: 0, geste: 1, passu: 2, lecture: 3, ok: 4 };
  lignes.sort((a, b) => rang[a.etat] - rang[b.etat] || a.ordre - b.ordre);
  const aFaire = lignes.filter((l) => l.etat === 'rouge' || l.etat === 'geste');
  const total = aFaire.reduce((t, l) => t + l.n, 0);
  const passu = lignes.filter((l) => l.etat === 'passu');
  const enLecture = lignes.some((l) => l.etat === 'lecture');
  const toutAJour = !aFaire.length && !passu.length && !enLecture;
  return { lignes, aFaire, total, nAFaire: aFaire.length, passu, enLecture, toutAJour, rouge: lignes.some((l) => l.etat === 'rouge') };
}

// Le résumé : jamais « à jour » sur un « pas su ».
export function resumeSante(r) {
  if (!r) return { titre: 'Je vérifie…', sous: '', ton: 'passu' };
  if (r.nAFaire) {
    const titre = r.nAFaire === 1 ? '1 chose à corriger' : `${r.nAFaire} choses à corriger`;
    const sous = r.passu.length ? `Et ${r.passu.length} ${pl(r.passu.length, 'vérification', 'vérifications')} pas ${pl(r.passu.length, 'lue', 'lues')} : rien n’est affirmé pour ${pl(r.passu.length, 'elle', 'elles')}.` : 'Un bouton par ligne ouvre l’endroit où corriger.';
    return { titre, sous, ton: r.rouge ? 'rouge' : 'geste' };
  }
  if (r.passu.length) return { titre: 'Je n’ai pas pu tout vérifier', sous: `Pas lu : ${r.passu.map((l) => l.nom).join(', ')}.`, ton: 'passu' };
  if (r.enLecture) return { titre: 'Je vérifie…', sous: '', ton: 'passu' };
  return { titre: 'Tout est à jour ✓', sous: 'Chaque vérification a été lue.', ton: 'ok' };
}
