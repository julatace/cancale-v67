// ── LE PARCOURS D'ARRIVÉE (11 nov.) ─────────────────────────────────────────
// Julien, 11 nov. : un NOUVEAU vendeur démarre en 10 minutes, « un vrai
// accompagnement ». Six étapes, UNE à la fois, dans l'ordre où elles servent :
//   1. compte        — la session de CE compte VRM (écrans existants) ;
//   2. configuration — « Tu vends quoi ? » : Ma configuration (src/configurationDepart.js)
//                      terminée, ou le choix des plateformes fait avant le 9 nov. ;
//   3. extension     — installée ET connectée à CE compte VRM (le pont dit
//                      `connectee`), ou un compte Vinted déjà rangé dans SA base
//                      (seule son extension en écrit) ;
//   4. emails        — un e-mail rangé chez lui (`email_reception_*`) : l'essai
//                      « Reçu ✓ » de « Ton adresse VRM » en crée un ;
//   5. vinted        — un compte Vinted relié ET son dressing LU : « N annonces lues »
//                      (le compteur `nItems` de `harvest_{uid}_listings`, un scalaire) ;
//   6. premiere      — une vente ou un achat LU (compteurs `nItems` des commandes) ⇒
//                      « C'est prêt ».
// Chaque étape se coche SEULE sur une preuve lue (jamais « j'ai fini » à cocher).
// Trois états partout : `undefined` en cours · `null` pas su · valeur lue.
// « Pas su » n'est jamais « fait ».
// La position (étape montrée, écran ouvert, fin vue) est rangée dans la ligne
// `main` (`vrm_parcours`, synchronisée) : on reprend là où on s'est arrêté, sur
// n'importe quel appareil. « Plus tard » : `vrm_parcours_plus_tard` (7 jours).
// JS pur, sans React : `scripts/audit-parcours-arrivee.cjs` l'exécute.

export const CLE_PARCOURS = 'vrm_parcours';
export const CLE_PARCOURS_PLUS_TARD = 'vrm_parcours_plus_tard';
export const JOURS_REPORT = 7;

export const ETAPES_PARCOURS = [
  { cle: 'compte', titre: 'Ton compte VRM', court: 'Compte', pourquoi: 'Tout ce que VRM range est à toi seul.' },
  { cle: 'configuration', titre: 'Tu vends quoi ?', court: 'Configuration', geste: 'Commencer', pourquoi: 'VRM prend tes mots, tes plateformes et ton statut.' },
  { cle: 'extension', titre: 'Installe l’extension', court: 'Extension', pourquoi: 'Elle lit tes ventes et tes colis, depuis ton navigateur.' },
  { cle: 'emails', titre: 'Relie tes e-mails', court: 'E-mails', geste: 'Relier mes e-mails', pourquoi: 'Bordereaux, codes de retrait et suivis se rangent seuls.' },
  { cle: 'vinted', titre: 'Ouvre Vinted une fois', court: 'Vinted', geste: 'Ouvrir vinted.fr', pourquoi: 'Connecté à ton compte, l’extension lit tes annonces.' },
  { cle: 'premiere', titre: 'Ta première vente', court: 'Première vente', attente: true, pourquoi: 'Rien à faire : elle arrive seule, avec son colis.' },
];
const CLES = ETAPES_PARCOURS.map((e) => e.cle);
const ETATS = new Set(['fait', 'afaire', 'attente', 'encours', 'passu']);

// ── LES PREUVES ─────────────────────────────────────────────────────────────
// Chacune rend { etat, detail? , n? } — etat ∈ fait · afaire · attente · encours · passu.
export function preuveCompte(uid) {
  if (uid === undefined) return { etat: 'encours' };
  return uid && String(uid).trim() ? { etat: 'fait' } : { etat: 'passu' };
}
// `pret` : le nuage est arrivé ; `etat` : 'fait' | 'plusTard' | null (vrm_configuration lue) ;
// `plateformes` : le choix des plateformes (avant le 9 nov.) existe.
export function preuveConfiguration({ pret, etat, plateformes } = {}) {
  if (!pret) return { etat: 'encours' };
  if (etat === 'fait') return { etat: 'fait' };
  if (!etat && plateformes === true) return { etat: 'fait' };
  return { etat: 'afaire', detail: etat === 'plusTard' ? 'reprendre' : 'commencer' };
}
// `pont` : 'absente' · 'demande' · 'muette' · 'pasconnectee' · 'autrecompte' · 'connectee'
// (`useEtapePont`). Une extension qui répond mais range ailleurs n'est PAS faite.
export function preuveExtension(pont, comptes) {
  if (Array.isArray(comptes) && comptes.length > 0) return { etat: 'fait' };
  if (pont === 'connectee') return { etat: 'fait' };
  if (pont === 'demande' || pont === undefined) return { etat: 'encours' };
  if (pont === 'muette') return { etat: 'passu', detail: 'muette' };
  if (pont === 'pasconnectee') return { etat: 'afaire', detail: 'pasconnectee' };
  if (pont === 'autrecompte') return { etat: 'afaire', detail: 'autrecompte' };
  return { etat: 'afaire', detail: 'absente' };
}
// Lignes `email_reception_*` lues (`select=id`).
export function preuveEmails(lignes) {
  if (lignes === undefined) return { etat: 'encours' };
  if (!Array.isArray(lignes)) return { etat: 'passu' };
  return lignes.length > 0 ? { etat: 'fait' } : { etat: 'afaire' };
}
// Le nombre lu dans une ligne `{ id, n }` (`n` = `data->>nItems`) ; illisible ⇒ NaN.
const nombreLu = (l) => (l && l.n != null && l.n !== '' && Number.isFinite(Number(l.n)) && Number(l.n) >= 0 ? Number(l.n) : NaN);
const uidDe = (id, suffixe) => { const m = new RegExp(`^harvest_(\\d+)_${suffixe}$`).exec(String(id || '')); return m ? m[1] : null; };
// `comptes` : la liste Vinted lue ; `lignes` : `harvest_*_listings` projetées `{ id, n }`.
// Seuls les dressings des comptes reliés comptent (identité : le n° du compte).
export function preuveVinted(comptes, lignes) {
  if (comptes === undefined) return { etat: 'encours' };
  if (!Array.isArray(comptes)) return { etat: 'passu' };
  if (!comptes.length) return { etat: 'afaire' };
  if (lignes === undefined) return { etat: 'encours' };
  if (!Array.isArray(lignes)) return { etat: 'passu' };
  const uids = new Set(comptes.map((c) => String((c && c.vinted_user_id) || '')).filter(Boolean));
  const siennes = lignes.filter((l) => uids.has(uidDe(l && l.id, 'listings')));
  if (!siennes.length) return { etat: 'attente', detail: 'lecture' };
  const lus = siennes.map(nombreLu).filter((v) => Number.isFinite(v));
  if (!lus.length) return { etat: 'passu' };
  return { etat: 'fait', n: lus.reduce((a, b) => a + b, 0) };
}
// Ventes et achats : `harvest_*_orders_sold` / `_orders_purchased` projetées `{ id, n }`.
// Une vente OU un achat lu suffit ; un compteur illisible n'est jamais 0.
function compter(lignes, suffixe) {
  if (lignes === undefined) return undefined;
  if (!Array.isArray(lignes)) return null;
  let n = 0, illisible = false;
  for (const l of lignes) {
    if (!uidDe(l && l.id, suffixe)) continue;
    const v = nombreLu(l);
    if (Number.isFinite(v)) n += v; else illisible = true;
  }
  if (n > 0) return n;
  return illisible ? null : 0;
}
export function preuvePremiere(lignes) {
  const ventes = compter(lignes, 'orders_sold');
  const achats = compter(lignes, 'orders_purchased');
  if ((ventes || 0) > 0 || (achats || 0) > 0) return { etat: 'fait', ventes: ventes || 0, achats: achats || 0 };
  if (ventes === undefined) return { etat: 'encours' };
  if (ventes === null || achats === null) return { etat: 'passu' };
  return { etat: 'attente' };
}

// ── « PLUS TARD » ───────────────────────────────────────────────────────────
export function reportee(plusTard, cle, maintenant = Date.now()) {
  const t = Date.parse((plusTard && typeof plusTard === 'object' && plusTard[cle]) || '');
  return Number.isFinite(t) && t <= maintenant + 60000 && maintenant - t < JOURS_REPORT * 86400000;
}
// Relier Vinted suppose l'extension : l'extension de côté met Vinted de côté.
const reporteeParcours = (plusTard, cle, m) => reportee(plusTard, cle, m) || (cle === 'vinted' && reportee(plusTard, 'extension', m));

// ── LA POSITION RANGÉE (`vrm_parcours`) ─────────────────────────────────────
// { v: 1, etape, ouvert, fini, at } — tout champ inconnu est ignoré.
export function lireParcours(brut) {
  const o = brut && typeof brut === 'object' && !Array.isArray(brut) ? brut : null;
  if (!o) return null;
  return {
    etape: CLES.includes(o.etape) ? o.etape : null,
    ouvert: o.ouvert === true,
    fini: typeof o.fini === 'string' && o.fini ? o.fini : null,
    at: typeof o.at === 'string' ? o.at : null,
  };
}
// Ce qu'il faut écrire pour un changement — `null` si rien ne change (on n'écrit pas pour rien).
export function ecritureParcours(brut, changement = {}, at = new Date().toISOString()) {
  const avant = lireParcours(brut) || { etape: null, ouvert: false, fini: null };
  const apres = { ...avant, ...changement };
  if (avant.etape === apres.etape && avant.ouvert === apres.ouvert && avant.fini === apres.fini && lireParcours(brut)) return null;
  return { v: 1, etape: apres.etape || null, ouvert: apres.ouvert === true, fini: apres.fini || null, at };
}

// ── L'ÉTAT DU PARCOURS ──────────────────────────────────────────────────────
// `preuves` : { [cle]: { etat, … } }. Rend les étapes avec leur état, `faites`,
// `courante` (la première pas faite ni mise de côté ; `null` si tout ce qui reste
// est de côté), et `fini` (toutes faites — sur des preuves LUES).
export function etatParcours(preuves = {}, { plusTard = null, maintenant = Date.now() } = {}) {
  const etapes = ETAPES_PARCOURS.map((e) => {
    const p = preuves[e.cle] && typeof preuves[e.cle] === 'object' ? preuves[e.cle] : {};
    const etat = ETATS.has(p.etat) ? p.etat : 'passu';
    return { ...e, ...p, etat, reportee: etat !== 'fait' && reporteeParcours(plusTard, e.cle, maintenant) };
  });
  const faites = etapes.filter((e) => e.etat === 'fait').length;
  const courante = (etapes.find((e) => e.etat !== 'fait' && !e.reportee) || {}).cle || null;
  return { etapes, faites, total: etapes.length, courante, fini: faites === etapes.length };
}
// L'étape que l'écran plein montre : celle où il s'est arrêté (`voulue`) si elle
// n'est pas faite, sinon la courante, sinon la première pas faite (même de côté) ;
// 'pret' quand tout est fait.
export function etapeAMontrer(etat, voulue) {
  if (!etat) return null;
  if (etat.fini) return 'pret';
  const e = etat.etapes.find((x) => x.cle === voulue);
  if (e && e.etat !== 'fait') return e.cle;
  if (etat.courante) return etat.courante;
  return (etat.etapes.find((x) => x.etat !== 'fait') || {}).cle || 'pret';
}
// Après « Plus tard » sur `cle` : la suivante à faire, ni faite ni de côté ; `null` ⇒ on ferme.
export function suivanteApres(etat, cle, plusTard = null, maintenant = Date.now()) {
  if (!etat) return null;
  const i = CLES.indexOf(cle);
  const reste = etat.etapes.slice(i + 1).concat(etat.etapes.slice(0, Math.max(0, i)));
  const n = reste.find((x) => x.etat !== 'fait' && x.cle !== cle && !reporteeParcours(plusTard, x.cle, maintenant) && !(cle === 'extension' && x.cle === 'vinted'));
  return n ? n.cle : null;
}
// La carte de Ma journée : 'cachee' · 'etape' (une étape à faire) · 'reprendre'
// (tout ce qui reste est de côté) · 'pret' (tout est fait, à dire UNE fois).
// Un vendeur installé qui n'a jamais ouvert le parcours n'est jamais interrompu
// par « C'est prêt » ; « pas su » ne finit rien.
export function carteParcours(etat, parcours, { masque = false, exemple = false } = {}) {
  if (!etat || exemple) return 'cachee';
  const p = lireParcours(parcours);
  if (p && p.fini) return 'cachee';
  if (etat.fini) return p ? 'pret' : 'cachee';
  if (masque) return 'cachee';
  return etat.courante ? 'etape' : 'reprendre';
}
// La phrase de réussite d'une étape (le chiffre vient de la preuve, jamais inventé).
export function reussite(e) {
  if (!e || e.etat !== 'fait') return '';
  if (e.cle === 'vinted') return typeof e.n === 'number' ? (e.n === 1 ? '1 annonce lue' : e.n === 0 ? 'Dressing lu · aucune annonce en ligne' : `${e.n} annonces lues`) : 'Compte relié';
  if (e.cle === 'premiere') {
    const v = e.ventes || 0, a = e.achats || 0;
    return [v ? (v === 1 ? '1 vente lue' : `${v} ventes lues`) : '', a ? (a === 1 ? '1 achat lu' : `${a} achats lus`) : ''].filter(Boolean).join(' · ');
  }
  if (e.cle === 'emails') return 'Reçu ✓';
  if (e.cle === 'extension') return 'Connectée à ton compte';
  if (e.cle === 'configuration') return 'Configuration enregistrée';
  return 'C’est fait';
}
