// ── LE PARCOURS D'ARRIVÉE (11 nov. ; trois étapes le 13 nov., lot 46) ───────
// Julien, 11 nov. : un NOUVEAU vendeur démarre en 10 minutes, « un vrai
// accompagnement ». (13 nov., lot 46) Le démarrage guidé tient en TROIS étapes,
// une à la fois, dans l'ordre où elles servent :
//   1. compte    — la session de CE compte VRM (écrans existants) ;
//   2. extension — installée ET connectée à CE compte VRM (le pont dit
//                  `connectee`), ou un compte Vinted déjà rangé dans SA base
//                  (seule son extension en écrit) ;
//   3. vinted    — Vinted ouvert une fois : un compte relié ET une première
//                  lecture rangée de CE compte — ses ventes (`harvest_{uid}_orders_*`),
//                  sinon son dressing (`harvest_{uid}_listings`) ; compteurs
//                  `nItems`, des scalaires. ⚠️ Le dressing compte aussi : un compte
//                  sans AUCUNE vente n'a jamais de ligne de ventes (l'extension ne
//                  range pas une liste vide, background.js `plein`) — sans lui, le
//                  guide ne finirait jamais pour un vendeur qui débute.
// « Ma configuration » s'ouvre seule avant (src/configurationDepart.js, sa carte
// « Reprendre » si elle est mise de côté) et les e-mails se relient depuis l'écran
// E-mails : ce ne sont plus des étapes comptées.
// Chaque étape se coche SEULE sur une preuve lue (jamais « j'ai fini » à cocher).
// Trois états partout : `undefined` en cours · `null` pas su · valeur lue.
// « Pas su » n'est jamais « fait ». Une étape bloquée dit le geste exact
// (`ligneEtape`). Les trois faites, la carte disparaît ; un vendeur déjà installé
// (un compte Vinted rangé sans avoir jamais ouvert le guide) ne la voit jamais.
// La position (étape montrée, écran ouvert, fin vue) est rangée dans la ligne
// `main` (`vrm_parcours`, synchronisée) : on reprend là où on s'est arrêté, sur
// n'importe quel appareil. « Plus tard » : `vrm_parcours_plus_tard` (7 jours).
// JS pur, sans React : `scripts/audit-parcours-arrivee.cjs` l'exécute.

export const CLE_PARCOURS = 'vrm_parcours';
export const CLE_PARCOURS_PLUS_TARD = 'vrm_parcours_plus_tard';
export const JOURS_REPORT = 7;

export const ETAPES_PARCOURS = [
  { cle: 'compte', titre: 'Ton compte VRM', court: 'Compte', pourquoi: 'Tout ce que VRM range est à toi seul.' },
  { cle: 'extension', titre: 'Installe l’extension', court: 'Extension', pourquoi: 'Elle lit tes ventes et tes colis, depuis ton navigateur.' },
  { cle: 'vinted', titre: 'Ouvre Vinted une fois', court: 'Vinted', geste: 'Ouvrir vinted.fr', pourquoi: 'Connecté à ton compte, l’extension lit tes ventes.' },
];
const CLES = ETAPES_PARCOURS.map((e) => e.cle);
const ETATS = new Set(['fait', 'afaire', 'attente', 'encours', 'passu']);

// ── LES PREUVES ─────────────────────────────────────────────────────────────
// Chacune rend { etat, detail? , n? } — etat ∈ fait · afaire · attente · encours · passu.
export function preuveCompte(uid) {
  if (uid === undefined) return { etat: 'encours' };
  return uid && String(uid).trim() ? { etat: 'fait' } : { etat: 'passu' };
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
// Le nombre lu dans une ligne `{ id, n }` (`n` = `data->>nItems`) ; illisible ⇒ NaN.
const nombreLu = (l) => (l && l.n != null && l.n !== '' && Number.isFinite(Number(l.n)) && Number(l.n) >= 0 ? Number(l.n) : NaN);
const uidDe = (id, suffixe) => { const m = new RegExp(`^harvest_(\\d+)_${suffixe}$`).exec(String(id || '')); return m ? m[1] : null; };
// La somme des compteurs lus des lignes `suffixe` de SES comptes : `undefined` aucune
// ligne · `null` des lignes au compteur illisible · un nombre. Un autre compte ne compte pas.
function somme(lignes, suffixe, uids) {
  let n = 0, vu = false, illisible = false;
  for (const l of lignes) {
    if (!uids.has(uidDe(l && l.id, suffixe))) continue;
    const v = nombreLu(l);
    if (Number.isFinite(v)) { n += v; vu = true; } else illisible = true;
  }
  return vu ? n : illisible ? null : undefined;
}
// `comptes` : la liste Vinted lue ; `annonces` : `harvest_*_listings` projetées `{ id, n }` ;
// `commandes` : `harvest_*_orders_*` projetées `{ id, n }`. Une lecture rangée d'un compte
// relié suffit : ses ventes, ses achats ou son dressing.
export function preuveVinted(comptes, annonces, commandes) {
  if (comptes === undefined) return { etat: 'encours' };
  if (!Array.isArray(comptes)) return { etat: 'passu' };
  if (!comptes.length) return { etat: 'afaire' };
  const uids = new Set(comptes.map((c) => String((c && c.vinted_user_id) || '')).filter(Boolean));
  const n = Array.isArray(annonces) ? somme(annonces, 'listings', uids) : annonces;
  const ventes = Array.isArray(commandes) ? somme(commandes, 'orders_sold', uids) : commandes;
  const achats = Array.isArray(commandes) ? somme(commandes, 'orders_purchased', uids) : commandes;
  const lu = (v) => typeof v === 'number';
  if (lu(n) || lu(ventes) || lu(achats)) return { etat: 'fait', ...(lu(n) ? { n } : {}), ...(lu(ventes) ? { ventes } : {}), ...(lu(achats) ? { achats } : {}) };
  if (n === null || ventes === null || achats === null) return { etat: 'passu' };
  if (annonces === undefined || commandes === undefined) return { etat: 'encours' };
  return { etat: 'attente', detail: 'lecture' };
}

// ── « PLUS TARD » ───────────────────────────────────────────────────────────
export function reportee(plusTard, cle, maintenant = Date.now()) {
  const t = Date.parse((plusTard && typeof plusTard === 'object' && plusTard[cle]) || '');
  return Number.isFinite(t) && t <= maintenant + 60000 && maintenant - t < JOURS_REPORT * 86400000;
}
// Relier Vinted suppose l'extension : l'extension de côté met Vinted de côté.
const reporteeParcours = (plusTard, cle, m) => reportee(plusTard, cle, m) || (cle === 'vinted' && reportee(plusTard, 'extension', m));

// ── LA POSITION RANGÉE (`vrm_parcours`) ─────────────────────────────────────
// { v: 1, etape, ouvert, fini, at } — tout champ inconnu est ignoré (une étape
// d'avant le 13 nov. — configuration, e-mails, première vente — ne vaut aucune).
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
// (tout ce qui reste est de côté). (13 nov., lot 46) Les trois faites ⇒ elle
// disparaît (« C'est prêt » ne se dit que dans l'écran plein, devant lui).
// `comptes` : la liste Vinted de la coque. Un parcours JAMAIS ouvert (aucune
// position rangée) ne s'affiche qu'à un compte SANS compte Vinted — un vendeur
// installé n'est jamais interrompu ; liste pas lue (pas su) ⇒ rien non plus.
export function carteParcours(etat, parcours, { masque = false, exemple = false, comptes } = {}) {
  if (!etat || exemple) return 'cachee';
  const p = lireParcours(parcours);
  if (p && p.fini) return 'cachee';
  if (etat.fini) return 'cachee';
  if (!p && !(Array.isArray(comptes) && comptes.length === 0)) return 'cachee';
  if (masque) return 'cachee';
  return etat.courante ? 'etape' : 'reprendre';
}
// La phrase de réussite d'une étape (le chiffre vient de la preuve, jamais inventé).
export function reussite(e) {
  if (!e || e.etat !== 'fait') return '';
  if (e.cle === 'vinted') {
    const v = e.ventes, n = e.n;
    if (typeof v === 'number' && v > 0) return v === 1 ? '1 vente lue' : `${v} ventes lues`;
    if (typeof n === 'number') return n === 1 ? '1 annonce lue' : n === 0 ? 'Dressing lu · aucune annonce en ligne' : `${n} annonces lues`;
    if (typeof v === 'number') return 'Ventes lues · aucune pour l’instant';
    return typeof e.achats === 'number' ? (e.achats === 1 ? '1 achat lu' : `${e.achats} achats lus`) : 'Compte relié';
  }
  if (e.cle === 'extension') return 'Connectée à ton compte';
  return 'Créé';
}
// Ce qu'une étape PAS faite dit, en une ligne (≤ 12 mots) : le geste exact quand elle
// est bloquée. `ou` : « dans Chrome » (le navigateur d'ici, `NAV.dansNu`), ou « sur ton
// ordinateur » sur un téléphone sans extension. '' ⇒ rien à ajouter.
export function ligneEtape(e, { ou = 'dans ton navigateur' } = {}) {
  if (!e || e.etat === 'fait') return '';
  if (e.etat === 'encours') return 'Je vérifie…';
  if (e.etat === 'passu') return e.detail === 'muette' ? 'L’extension ne répond pas. Recharge la page.' : 'Pas pu vérifier.';
  if (e.cle === 'extension') {
    if (e.detail === 'pasconnectee') return 'Installée. Connecte-la à ce compte VRM.';
    if (e.detail === 'autrecompte') return 'Reliée à un autre compte VRM. Reconnecte-la ici.';
    return `Télécharge-la, puis installe-la ${ou}.`;
  }
  if (e.cle === 'vinted') return e.etat === 'attente' ? 'Lecture de tes ventes…' : `Ouvre vinted.fr ${ou}, connecté à ton compte.`;
  return '';
}
