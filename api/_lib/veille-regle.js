// api/_lib/veille-regle.js — LA RÈGLE DE LA VEILLE D'ACHAT, en un seul endroit.
//
// Julien (15 octobre) : « un assistant de veille d'achat — chaque personne
// enregistre ses recherches (marque, modèle et autres noms, tailles, états,
// prix maximum livraison comprise, mots exclus, lots oui/non) ; VRM montre les
// annonces qui correspondent, dit POURQUOI, et ce qui n'est pas vérifiable ».
//
// Ce module est PUR (aucun import, aucun réseau) : la route serveur
// (`api/_lib/veille.js`) l'exécute pour juger les annonces lues chez eBay, l'app
// (`src/VeilleAchat.jsx`) l'importe pour la rentabilité avant achat, et
// `scripts/audit-veille.cjs` l'exécute tel quel. Une notion, une règle (§11).
//
// ⚠️ CE QUE CETTE RÈGLE NE FAIT JAMAIS :
//   · aucun achat, aucun paiement, aucune offre — elle juge, elle n'agit pas ;
//   · aucun rapprochement par ressemblance pour relier une annonce à une paire
//     (§5) : elle dit si un TITRE porte les mots demandés, rien de plus ;
//   · « livraison inconnue » ne vaut jamais 0 : le total est alors « non
//     confirmé », et c'est écrit (§5, un total partiel n'est pas un total).

// ── BORNES (le prototype reste petit et lisible) ─────────────────────────────
export const VEILLE_MAX_RECHERCHES = 8;
export const VEILLE_MAX_NOMS = 3;          // chaque autre nom = UNE recherche de plus chez eBay
export const VEILLE_MAX_TAILLES = 6;
export const VEILLE_MAX_EXCLUS = 10;
export const VEILLE_ANNONCES_MAX = 40;     // annonces gardées par recherche (décidées comprises)
export const VEILLE_REFUSEES_MAX = 150;    // mémoire compacte des refus (pour ne pas les reproposer)
export const VEILLE_HISTO_MAX = 200;
export const VEILLE_QUOTA_JOUR = 30;       // vérifications à la demande, par vendeur et par jour (heure de Paris)
export const VEILLE_DELAI_MS = 2 * 60 * 1000;   // pas deux vérifications de la même recherche en 2 min
export const VEILLE_LIMITE_EBAY = 100;     // annonces lues par appel (les plus récentes)
export const VEILLE_MATIN_MAX_APPELS = 6;  // appels eBay du passage du matin, par vendeur
export const COMPARABLES_MIN = 3;          // en dessous, une fourchette est un hasard présenté comme un repère
export const COMPARABLES_ANCIENS_J = 180;  // la plus récente a plus de 6 mois ⇒ on le dit

// Plateformes : seule eBay est interrogeable (API Browse, recherche publique
// avec le jeton de l'APPLICATION). Vinted et Leboncoin n'ont AUCUN accès
// autorisé : une recherche automatisée chez eux est le comportement de robot
// qui a fait bloquer `vanessa5723` (CLAUDE.md §3). On le dit, on ne simule rien.
export const PLATEFORMES_VEILLE = [
  { id: 'ebay', nom: 'eBay', disponible: true },
  { id: 'vinted', nom: 'Vinted', disponible: false, pourquoi: 'aucun accès autorisé' },
  { id: 'leboncoin', nom: 'Leboncoin', disponible: false, pourquoi: 'aucun accès autorisé' },
];

// États acceptés ⇒ identifiants d'état eBay. Deux familles seulement : eBay
// n'emploie pas les mêmes nuances d'occasion d'une catégorie à l'autre, et un
// « très bon état » deviné serait faux. Le texte d'eBay est montré tel quel.
// ⚠️ Hors des deux familles (neuf avec défauts, reconditionné, pour pièces) :
//    l'annonce est écartée et le DIT, jamais rangée en « neuf » par défaut.
export const ETATS_VEILLE = {
  neuf: { nom: 'Neuf', ids: ['1000', '1500'] },
  occasion: { nom: 'Occasion', ids: ['2750', '2990', '3000', '3010', '4000', '5000', '6000'] },
};
export const MOTIFS_REFUS = {
  'trop-cher': 'Trop cher',
  taille: 'Mauvaise pointure',
  etat: 'État',
  photos: 'Photos insuffisantes',
  vendeur: 'Vendeur',
  doute: 'Doute sur l\'authenticité',
  autre: 'Autre',
};
export const STATUTS_VEILLE = ['nouvelle', 'a-examiner', 'achetee', 'refusee'];

// ── TEXTE ────────────────────────────────────────────────────────────────────
const sansAccents = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '');
export const normTexte = (s) => sansAccents(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
const compact = (s) => normTexte(s).replace(/ /g, '');
// Le titre porte-t-il ce mot / cette expression ? Expression entière (« dunk »
// ne trouve pas « dunkerque ») ; et, pour un nom d'au moins 4 caractères, la
// forme collée (« xt6 » pour « XT-6 »).
export function titrePorte(titre, mot) {
  const m = normTexte(mot);
  if (!m) return false;
  const t = ' ' + normTexte(titre) + ' ';
  if (t.includes(' ' + m + ' ')) return true;
  // Forme collée, seulement pour un nom en plusieurs morceaux (« XT-6 » ⇒ xt6),
  // et jamais suivie d'un chiffre : « air max 1 » ne trouve pas « Air Max 100 ».
  const c = compact(mot);
  if (c.length < 3 || !m.includes(' ')) return false;
  const ct = compact(titre);
  for (let i = ct.indexOf(c); i >= 0; i = ct.indexOf(c, i + 1)) {
    const apres = ct[i + c.length] || '';
    if (!(/\d$/.test(c) && /\d/.test(apres))) return true;
  }
  return false;
}
const propre = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);

// ── POINTURES ÉCRITES DANS UN TITRE (fractions comprises) ────────────────────
// ⚠️ Plus stricte que `extractSize` de l'app (statistiques du « prix qui
//    marche ») : elle rend TOUTES les pointures du titre, et garde les tiers
//    d'Adidas — « 42 2/3 » n'est PAS du 42. Une pointure d'un tiers à côté, c'est
//    une paire qui ne va pas.
const FRACTION = { '1/2': '.5', '1/3': ' 1/3', '2/3': ' 2/3' };
export function normPointure(s) {
  const t = String(s == null ? '' : s).trim().toLowerCase()
    .replace(/½/g, ' 1/2').replace(/⅓/g, ' 1/3').replace(/⅔/g, ' 2/3').replace(',', '.').replace(/\s+/g, ' ');
  const m = /^(3[4-9]|4[0-9]|5[0-2])(?:(\.5)|\s?(1\/2|1\/3|2\/3))?$/.exec(t);
  if (!m) return '';
  return m[1] + (m[2] ? '.5' : (m[3] ? FRACTION[m[3]] : ''));
}
export function taillesDuTitre(titre) {
  const t = ' ' + sansAccents(titre).toLowerCase()
    .replace(/½/g, ' 1/2').replace(/⅓/g, ' 1/3').replace(/⅔/g, ' 2/3')
    .replace(/(\d),(5)(?![0-9])/g, '$1.$2') + ' ';
  const eu = new Set(), autres = new Set();
  // UK / US : une autre échelle. Pas de table de conversion (une table fausse
  // ferait acheter la mauvaise taille) : elle est NOMMÉE, jamais comparée.
  const reUs = /(^|[^a-z])(uk|us)\s*[:.]?\s*(\d{1,2}(?:\.5)?)(?![0-9])/g;
  let m;
  while ((m = reUs.exec(t))) autres.add(m[2].toUpperCase() + ' ' + m[3]);
  const sansUs = t.replace(reUs, '$1 ');
  // Avant le nombre : ni chiffre ni lettre (« art42 » n'est pas du 42) — une
  // virgule ou un point seulement s'ils ne suivent pas un chiffre (« 1,42 »).
  // Après : ni chiffre, ni décimale, ni « / », ni une unité (€, cm, ans…).
  const reEu = /(^|[^0-9a-z.,]|[^0-9][.,])(?:(?:taille|pointure|size|t|eu|eur|fr)\s*[:.]?\s*)?(3[4-9]|4[0-9]|5[0-2])(?:(\.5)|\s(1\/2|1\/3|2\/3)(?![0-9]))?(?![0-9]|[.,][0-9]|\/[0-9]|\s*(?:€|eur\b|euros?\b|cm\b|mm\b|%|ans\b))/g;
  while ((m = reEu.exec(sansUs))) eu.add(m[2] + (m[3] ? '.5' : (m[4] ? FRACTION[m[4]] : '')));
  return { eu: [...eu], autres: [...autres] };
}

// ── LOTS ─────────────────────────────────────────────────────────────────────
const RE_LOT = /(^|[^a-z])(lot|lots|pack|bundle)([^a-z]|$)|(^|[^0-9])[2-9]\s*(paires|pairs|pares)([^a-z]|$)|(^|[^a-z0-9])x\s?[2-9]([^0-9]|$)|(^|[^0-9])[2-9]\s?x([^a-z0-9]|$)/;
export const estUnLot = (titre) => RE_LOT.test(' ' + sansAccents(titre).toLowerCase() + ' ');

// ── MONTANTS (centimes entiers ; `null` = inconnu, jamais 0) ─────────────────
export function centimesDe(v) {
  if (v == null || (typeof v === 'string' && !v.trim())) return null;
  const s = String(typeof v === 'object' ? (v.value ?? v.amount ?? '') : v).trim().replace(',', '.');
  if (!/^\d{1,7}(?:\.\d{1,2})?$/.test(s)) return null;
  const [a, b = ''] = s.split('.');
  return Number(a) * 100 + Number(b.padEnd(2, '0'));
}
export const eurosTexte = (c) => (c == null ? '—' : (c / 100).toFixed(2).replace('.', ',') + ' €');

// ── UNE RECHERCHE ENREGISTRÉE, VALIDÉE (le serveur ne croit pas le navigateur)
const ID_RECHERCHE = /^r[0-9a-f]{10}$/;
const liste = (v, max, n) => {
  const brut = Array.isArray(v) ? v : String(v == null ? '' : v).split(/[,;\n]/);
  const out = [];
  for (const x of brut) { const p = propre(x, n); if (p && !out.some((y) => normTexte(y) === normTexte(p))) out.push(p); }
  return out.slice(0, max);
};
export function normaliserRecherche(b, opts = {}) {
  const r = b && typeof b === 'object' ? b : {};
  const noms = liste(r.noms != null ? r.noms : r.modele, VEILLE_MAX_NOMS, 40);
  if (!noms.length || !noms.some((x) => normTexte(x).length >= 2)) return { ok: false, champ: 'noms', erreur: 'Indique au moins le modèle cherché.' };
  const tailles = [];
  for (const x of liste(r.tailles, VEILLE_MAX_TAILLES + 4, 12)) {
    const p = normPointure(x);
    if (!p) return { ok: false, champ: 'tailles', erreur: `« ${x} » n'est pas une pointure (34 à 52, ex. 42, 42,5 ou 42 2/3).` };
    if (!tailles.includes(p)) tailles.push(p);
  }
  if (tailles.length > VEILLE_MAX_TAILLES) return { ok: false, champ: 'tailles', erreur: `${VEILLE_MAX_TAILLES} pointures au plus.` };
  // Le prix arrive en EUROS du formulaire (`prixMaxEuros`) ou en centimes d'une
  // recherche déjà rangée (`prixMax`, entier) : deux noms, jamais une unité devinée.
  const prixMax = r.prixMaxEuros != null ? centimesDe(r.prixMaxEuros) : (Number.isSafeInteger(r.prixMax) ? r.prixMax : null);
  if (prixMax == null || prixMax < 100 || prixMax > 1000000) return { ok: false, champ: 'prixMax', erreur: 'Indique un prix maximum, livraison comprise (entre 1 € et 10 000 €).' };
  const etats = (Array.isArray(r.etats) ? r.etats : []).filter((e) => ETATS_VEILLE[e]);
  const lots = ['exclure', 'accepter', 'seulement'].includes(r.lots) ? r.lots : 'exclure';
  const encheres = r.encheres === 'aussi' ? 'aussi' : 'non';
  const pays = /^[A-Z]{2}$/.test(String(r.pays || '')) ? String(r.pays) : '';
  const marque = propre(r.marque, 40);
  const id = ID_RECHERCHE.test(String(r.id || '')) ? String(r.id) : (opts.nouvelId || '');
  const maintenant = opts.maintenant || Date.now();
  const nom = propre(r.nom, 60) || [marque, noms[0], tailles.length ? tailles.join('/') : ''].filter(Boolean).join(' ');
  return {
    ok: true,
    recherche: {
      id, nom, marque, noms, tailles,
      etats: [...new Set(etats)],
      prixMax,
      motsExclus: liste(r.motsExclus, VEILLE_MAX_EXCLUS, 30),
      lots, encheres, pays,
      alerte: r.alerte === true,
      pause: r.pause === true,
      arreterQuandAchetee: r.arreterQuandAchetee === true,
      creeLe: Number.isFinite(r.creeLe) ? r.creeLe : maintenant,
      majLe: maintenant,
    },
  };
}

// ── LA REQUÊTE eBAY (Browse, item_summary/search) ────────────────────────────
// Une requête PAR NOM (le modèle et ses autres noms) : la syntaxe « OU » de
// `q` n'a pas été mesurée ici ; une requête par nom est sûre, et chaque annonce
// est de toute façon REJUGÉE ici sur son titre (le moteur d'eBay élargit).
// La pointure n'entre PAS dans `q` (« EU42 », « 42 2/3 »… ne se cherchent pas
// tous pareil) : on lit les plus récentes et on juge le titre.
export function requetesEbay(r) {
  const filtres = [
    r.encheres === 'aussi' ? 'buyingOptions:{FIXED_PRICE|AUCTION}' : 'buyingOptions:{FIXED_PRICE}',
    `price:[..${(r.prixMax / 100).toFixed(2)}]`, 'priceCurrency:EUR',
    'deliveryCountry:FR',
  ];
  const ids = (r.etats || []).flatMap((e) => (ETATS_VEILLE[e] ? ETATS_VEILLE[e].ids : []));
  if (ids.length) filtres.push(`conditionIds:{${ids.join('|')}}`);
  if (r.pays) filtres.push(`itemLocationCountry:${r.pays}`);
  return (r.noms || []).slice(0, VEILLE_MAX_NOMS).map((n) => ({
    q: [r.marque, n].filter(Boolean).join(' ').slice(0, 100),
    filter: filtres.join(','),
    sort: 'newlyListed',
    limit: VEILLE_LIMITE_EBAY,
  }));
}

// ── UNE ANNONCE eBAY (ItemSummary) RAMENÉE À CE QUE VRM GARDE ────────────────
// Rien de personnel : ni pseudo du vendeur ni adresse — seulement son pays et
// son évaluation (avec sa source : eBay). L'adresse de l'annonce est refaite à
// partir de son numéro (jamais l'URL d'eBay avec ses paramètres de suivi).
const ID_EBAY = /^\d{6,19}$/;
export function lireItemEbay(it) {
  if (!it || typeof it !== 'object') return null;
  const brut = String(it.legacyItemId || '') || String((/^v1\|(\d+)\|/.exec(String(it.itemId || '')) || [])[1] || '');
  if (!ID_EBAY.test(brut)) return null;
  const opts = Array.isArray(it.buyingOptions) ? it.buyingOptions : [];
  const achat = opts.includes('FIXED_PRICE') ? 'fixe' : (opts.includes('AUCTION') ? 'encheres' : 'autre');
  const prixSrc = achat === 'encheres' && it.currentBidPrice ? it.currentBidPrice : it.price;
  const devise = String((prixSrc && prixSrc.currency) || '');
  let livraison = null, livraisonDevise = '';
  for (const o of (Array.isArray(it.shippingOptions) ? it.shippingOptions : [])) {
    const c = centimesDe(o && o.shippingCost);
    const d = String((o && o.shippingCost && o.shippingCost.currency) || '');
    if (c == null || (d && d !== 'EUR')) continue;
    if (livraison == null || c < livraison) { livraison = c; livraisonDevise = d || 'EUR'; }
  }
  const img = String((it.image && it.image.imageUrl) || '');
  const image = /^https:\/\/[a-z0-9.-]*ebayimg\.com\//i.test(img) ? img.slice(0, 300) : '';
  const pct = Number(it.seller && it.seller.feedbackPercentage), score = Number(it.seller && it.seller.feedbackScore);
  const cree = Date.parse(it.itemCreationDate || '');
  return {
    id: brut,
    titre: propre(it.title, 160),
    url: `https://www.ebay.fr/itm/${brut}`,
    image,
    prix: centimesDe(prixSrc), devise,
    livraison, livraisonDevise,
    etatId: it.conditionId != null ? String(it.conditionId) : '',
    etat: propre(it.condition, 60),
    achat, offre: opts.includes('BEST_OFFER'),
    pays: /^[A-Z]{2}$/.test(String((it.itemLocation && it.itemLocation.country) || '')) ? it.itemLocation.country : '',
    vendeur: (Number.isFinite(pct) || Number.isFinite(score)) ? { pct: Number.isFinite(pct) ? pct : null, score: Number.isFinite(score) ? score : null, source: 'eBay' } : null,
    cree: Number.isFinite(cree) ? new Date(cree).toISOString() : null,
  };
}

// ── POURQUOI ELLE CORRESPOND (ou pas) ────────────────────────────────────────
// Rend { garde, exclusion:{code,texte}|null, raisons[], inverifiables[],
// drapeaux[], total, totalConfirme }. Chaque phrase dit un FAIT lu sur
// l'annonce ; ce qui ne peut pas être lu est « non vérifiable », jamais « ok ».
export function analyserAnnonce(a, r) {
  const raisons = [], inverifiables = [], drapeaux = [];
  let exclusion = null;
  const exclure = (code, texte) => { if (!exclusion) exclusion = { code, texte }; };
  const titre = a.titre || '';
  // Le modèle (ou un de ses autres noms) DOIT être dans le titre.
  const nom = (r.noms || []).find((n) => titrePorte(titre, n));
  if (nom) raisons.push(`« ${nom} » dans le titre`); else exclure('nom', 'modèle absent du titre');
  if (r.marque) { if (titrePorte(titre, r.marque)) raisons.push(`marque ${r.marque}`); else inverifiables.push('marque absente du titre'); }
  const mot = (r.motsExclus || []).find((m) => titrePorte(titre, m));
  if (mot) exclure('mot', `mot exclu « ${mot} »`);
  const lot = estUnLot(titre);
  if (r.lots === 'exclure' && lot) exclure('lot', 'un lot');
  else if (r.lots === 'seulement' && !lot) exclure('pas-lot', 'pas un lot');
  else if (lot) drapeaux.push('lot');
  if ((r.tailles || []).length) {
    const { eu, autres } = taillesDuTitre(titre);
    const voulue = eu.find((p) => r.tailles.includes(p));
    if (!eu.length) inverifiables.push(autres.length ? `pointure en ${autres.join(', ')} : non comparée` : 'pointure absente du titre');
    else if (!voulue) exclure('taille', `pointure ${eu.join(', ')} dans le titre`);
    else raisons.push(`pointure ${voulue}`);
    if (eu.length > 1 && voulue) drapeaux.push('plusieurs-pointures');
  }
  if ((r.etats || []).length) {
    const permis = r.etats.flatMap((e) => (ETATS_VEILLE[e] ? ETATS_VEILLE[e].ids : []));
    if (!a.etatId) inverifiables.push('état non indiqué');
    else if (permis.includes(a.etatId)) raisons.push(`état : ${a.etat || a.etatId}`);
    else exclure('etat', `état « ${a.etat || a.etatId} »`);
  }
  if (a.achat === 'encheres') { if (r.encheres === 'aussi') drapeaux.push('encheres'); else exclure('encheres', 'une enchère'); }
  if (r.pays) { if (!a.pays) inverifiables.push('pays du vendeur non indiqué'); else if (a.pays !== r.pays) exclure('pays', `vendeur en ${a.pays}`); }
  // Le prix : l'article, puis le total quand la livraison est CONNUE.
  let total = null, totalConfirme = false;
  if (a.prix == null) exclure('prix', 'prix illisible');
  else if (a.devise && a.devise !== 'EUR') exclure('devise', `prix en ${a.devise}`);
  else if (a.prix > r.prixMax) exclure('prix', `article à ${eurosTexte(a.prix)}`);
  else if (a.livraison == null) {
    total = a.prix;
    inverifiables.push('livraison inconnue : total non confirmé');
  } else {
    total = a.prix + a.livraison; totalConfirme = true;
    if (total > r.prixMax) exclure('prix', `${eurosTexte(total)} livraison comprise`);
    else raisons.push(`${eurosTexte(total)} livraison comprise ≤ ${eurosTexte(r.prixMax)}`);
  }
  if (!a.image) drapeaux.push('sans-photo');
  return { garde: !exclusion, exclusion, raisons, inverifiables, drapeaux, total, totalConfirme };
}

// Les écartées, comptées par cause : « 62 autre pointure, 20 lots » dit comment
// resserrer ou élargir une recherche (COMPLEMENT-02) sans montrer 80 annonces.
export const LIBELLES_EXCLUSION = { nom: 'modèle absent', mot: 'mot exclu', lot: 'lots', 'pas-lot': 'pas des lots', taille: 'autre pointure', etat: 'autre état', encheres: 'enchères', pays: 'autre pays', prix: 'trop cher', devise: 'autre devise' };

// ── UNE VÉRIFICATION ─────────────────────────────────────────────────────────
// `lectures` : ce qu'eBay a rendu pour chaque requête : { ok, items[], total,
// erreur }. Dédoublonné par numéro d'annonce (deux noms qui trouvent la même).
export function jugerLectures(lectures, r) {
  const vues = new Map(), ecartees = {}, exemples = [];
  let lus = 0, totalEbay = 0, complet = true, echecs = 0;
  for (const l of (lectures || [])) {
    if (!l || !l.ok) { echecs++; complet = false; continue; }
    const items = Array.isArray(l.items) ? l.items : [];
    lus += items.length;
    if (Number.isFinite(l.total)) { totalEbay += l.total; if (l.total > items.length) complet = false; } else complet = false;
    for (const it of items) {
      const a = lireItemEbay(it);
      if (!a || vues.has(a.id)) continue;
      const an = analyserAnnonce(a, r);
      vues.set(a.id, { ...a, analyse: an });
      if (!an.garde) {
        ecartees[an.exclusion.code] = (ecartees[an.exclusion.code] || 0) + 1;
        if (exemples.length < 8) exemples.push({ titre: a.titre, motif: an.exclusion.texte, url: a.url });
      }
    }
  }
  const retenues = [...vues.values()].filter((x) => x.analyse.garde);
  return {
    ok: echecs < (lectures || []).length,          // au moins une requête a répondu
    partiel: echecs > 0,
    lus, totalEbay, complet,
    retenues, ecartees, exemples,
    nbEcartees: Object.values(ecartees).reduce((s, n) => s + n, 0),
  };
}

// ── LES RÉSULTATS GARDÉS (ligne `veille_resultats` du vendeur) ───────────────
export const resultatsVides = () => ({ v: 1, parRecherche: {}, historique: [], quota: null, matin: null });
const parisJour = (ms) => new Date(ms).toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' });
export const heureParis = (ms) => Number(new Date(ms).toLocaleString('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', hourCycle: 'h23' }));

// Quota des vérifications À LA DEMANDE : réservé AVANT d'appeler eBay.
export function reserverQuota(d, maintenant, n = 1) {
  const base = d || resultatsVides();
  const jour = parisJour(maintenant);
  const q = base.quota && base.quota.jour === jour ? base.quota : { jour, n: 0 };
  if (q.n + n > VEILLE_QUOTA_JOUR) return { ok: false, quota: q };
  return { ok: true, quota: { jour, n: q.n + n }, data: { ...base, quota: { jour, n: q.n + n } } };
}

// Rejuge les annonces encore « nouvelles » avec les critères d'AUJOURD'HUI :
// une recherche resserrée (prix plus bas, pointure retirée) ne garde pas ce
// qu'elle n'aurait pas retenu. Ses décisions (à examiner, achetée, refusée)
// ne bougent jamais : c'est lui qui les a prises.
export function rejuger(d, rid, r) {
  const pr = { ...((d && d.parRecherche) || {}) };
  const rr = pr[rid];
  if (!rr || !r) return d;
  const annonces = { ...(rr.annonces || {}) };
  let retirees = 0;
  for (const [k, a] of Object.entries(annonces)) {
    if (a.statut !== 'nouvelle') continue;
    const an = analyserAnnonce(a, r);
    if (!an.garde) { delete annonces[k]; retirees++; }
    else annonces[k] = { ...a, raisons: an.raisons, inverifiables: an.inverifiables, drapeaux: an.drapeaux, total: an.total, totalConfirme: an.totalConfirme };
  }
  if (!retirees && !Object.keys(annonces).length) return d;
  pr[rid] = { ...rr, annonces };
  return { ...d, parRecherche: pr };
}

// Fusionne une vérification réussie dans les résultats d'UNE recherche :
//   · une annonce déjà vue garde sa date de première vue, sa décision, sa note
//     (on met à jour son prix et sa livraison : c'est ce qui bouge) ;
//   · une annonce REFUSÉE ne revient jamais en « nouvelle » (dédoublonnage) ;
//   · une annonce absente de cette lecture N'EST PAS dite vendue : elle garde sa
//     dernière date de lecture (« pas revue à la dernière vérification ») ;
//   · au-delà de la borne, on retire d'abord les nouvelles les plus anciennes
//     jamais revues, puis le détail des refus les plus anciens (leur numéro
//     reste dans `refusees`) — jamais une « à examiner » ni une « achetée ».
export function fusionnerVerification(d, rid, jugement, maintenant, source, r) {
  const base0 = d && typeof d === 'object' ? { ...resultatsVides(), ...d } : resultatsVides();
  const base = r ? rejuger(base0, rid, r) : base0;
  const pr = { ...(base.parRecherche || {}) };
  const avant = pr[rid] || { annonces: {}, refusees: {} };
  const annonces = { ...(avant.annonces || {}) };
  const refusees = { ...(avant.refusees || {}) };
  const nouvelles = [];
  for (const a of (jugement.retenues || [])) {
    if (refusees[a.id]) continue;
    const ex = annonces[a.id];
    const { analyse, ...donnees } = a;
    const fiche = { ...donnees, raisons: analyse.raisons, inverifiables: analyse.inverifiables, drapeaux: analyse.drapeaux, total: analyse.total, totalConfirme: analyse.totalConfirme, revuLe: maintenant };
    if (ex) annonces[a.id] = { ...ex, ...fiche, vuLe: ex.vuLe, statut: ex.statut, note: ex.note, motif: ex.motif, decideLe: ex.decideLe, alerteLe: ex.alerteLe };
    else { annonces[a.id] = { ...fiche, vuLe: maintenant, statut: 'nouvelle' }; nouvelles.push(a.id); }
  }
  const ids = Object.keys(annonces);
  if (ids.length > VEILLE_ANNONCES_MAX) {
    const vieux = (k) => annonces[k].revuLe || annonces[k].vuLe || 0;
    const jetables = [
      ...ids.filter((k) => annonces[k].statut === 'nouvelle' && !nouvelles.includes(k)).sort((x, y) => vieux(x) - vieux(y)),
      ...ids.filter((k) => annonces[k].statut === 'refusee').sort((x, y) => (annonces[x].decideLe || 0) - (annonces[y].decideLe || 0)),
    ];
    for (const k of jetables.slice(0, ids.length - VEILLE_ANNONCES_MAX)) delete annonces[k];
  }
  pr[rid] = {
    annonces, refusees,
    verif: { at: maintenant, ok: true, partiel: !!jugement.partiel, lus: jugement.lus, totalEbay: jugement.totalEbay, complet: !!jugement.complet, retenues: (jugement.retenues || []).length, ecartees: jugement.ecartees || {}, source: source || 'clic' },
  };
  return { data: { ...base, parRecherche: pr }, nouvelles };
}
export function noterEchec(d, rid, erreur, maintenant, source) {
  const base = d && typeof d === 'object' ? { ...resultatsVides(), ...d } : resultatsVides();
  const pr = { ...(base.parRecherche || {}) };
  const avant = pr[rid] || { annonces: {}, refusees: {} };
  pr[rid] = { ...avant, verif: { ...(avant.verif || {}), at: maintenant, ok: false, erreur: String(erreur || '').slice(0, 200), source: source || 'clic', derniereReussie: avant.verif && avant.verif.ok ? avant.verif.at : (avant.verif && avant.verif.derniereReussie) || null } };
  return { ...base, parRecherche: pr };
}

// Ce qui mérite une alerte : une annonce retenue, jamais signalée, ni décidée
// (« à examiner », « achetée », « refusée » : il l'a déjà vue). Marquée AVANT
// l'envoi, dans la même écriture : une annonce n'est jamais signalée deux fois.
export function marquerAlertes(d, rid, maintenant) {
  const pr = { ...((d && d.parRecherche) || {}) };
  const rr = pr[rid];
  if (!rr) return { data: d, alertees: [] };
  const annonces = { ...(rr.annonces || {}) };
  const alertees = [];
  for (const [k, a] of Object.entries(annonces)) {
    if (a.statut !== 'nouvelle' || a.alerteLe) continue;
    annonces[k] = { ...a, alerteLe: maintenant };
    alertees.push(k);
  }
  pr[rid] = { ...rr, annonces };
  return { data: { ...d, parRecherche: pr }, alertees };
}

// Sa décision sur une annonce, gardée dans l'historique (VEILLE-50-48).
export function appliquerDecision(d, rid, itemId, dec, maintenant) {
  const base = d && typeof d === 'object' ? { ...resultatsVides(), ...d } : resultatsVides();
  const pr = { ...(base.parRecherche || {}) };
  const rr = pr[rid];
  const a = rr && rr.annonces && rr.annonces[itemId];
  if (!a && !(rr && rr.refusees && rr.refusees[itemId])) return { ok: false, erreur: 'Cette annonce n\'est plus dans la veille.' };
  const statut = dec.statut;
  if (statut != null && !STATUTS_VEILLE.includes(statut)) return { ok: false, erreur: 'Décision inconnue.' };
  const motif = statut === 'refusee' ? (MOTIFS_REFUS[dec.motif] ? dec.motif : 'autre') : null;
  const note = dec.note != null ? propre(dec.note, 300) : undefined;
  const annonces = { ...(rr.annonces || {}) }, refusees = { ...(rr.refusees || {}) };
  const avant = a || { titre: (rr.refusees[itemId] || {}).titre || '', statut: 'refusee' };
  const apres = { ...avant, ...(statut ? { statut, motif, decideLe: maintenant } : {}), ...(note !== undefined ? { note } : {}) };
  if (statut === 'refusee') refusees[itemId] = { at: maintenant, motif, titre: propre(avant.titre, 80) };
  else if (statut && refusees[itemId]) delete refusees[itemId];
  annonces[itemId] = apres;
  // La mémoire des refus reste bornée (les plus anciens partent).
  const rk = Object.keys(refusees);
  if (rk.length > VEILLE_REFUSEES_MAX) for (const k of rk.sort((x, y) => refusees[x].at - refusees[y].at).slice(0, rk.length - VEILLE_REFUSEES_MAX)) delete refusees[k];
  pr[rid] = { ...rr, annonces, refusees };
  const historique = [{ at: maintenant, rid, itemId, titre: propre(avant.titre, 80), de: avant.statut || null, a: statut || avant.statut || null, motif, ...(note !== undefined ? { note: true } : {}) }, ...(base.historique || [])].slice(0, VEILLE_HISTO_MAX);
  return { ok: true, data: { ...base, parRecherche: pr, historique }, annonce: apres };
}

// Ce qu'une recherche a donné (VEILLE-50-50) : compté sur SES décisions.
export function bilanRecherche(rr) {
  const n = { nouvelle: 0, 'a-examiner': 0, achetee: 0, refusee: 0 };
  for (const a of Object.values((rr && rr.annonces) || {})) if (n[a.statut] != null) n[a.statut]++;
  n.refusee = Math.max(n.refusee, Object.keys((rr && rr.refusees) || {}).length);
  return n;
}

// Horaires silencieux : `{de, a}` en heures de Paris (22 → 8 traverse minuit).
export function dansSilence(silence, maintenant) {
  if (!silence || !Number.isInteger(silence.de) || !Number.isInteger(silence.a) || silence.de === silence.a) return false;
  const h = heureParis(maintenant);
  return silence.de < silence.a ? (h >= silence.de && h < silence.a) : (h >= silence.de || h < silence.a);
}

// ══ RENTABILITÉ AVANT ACHAT ═══════════════════════════════════════════════════
// Toutes les entrées en CENTIMES, `null` = pas saisi / pas connu.
//   achat (article) · livraison (à l'achat) · remise (remise en état) ·
//   frais (frais de vente prévus) · revente (prix de revente envisagé) ·
//   marge (bénéfice voulu, pour le prix d'achat maximum).
// ⚠️ On ne somme que ce qu'on CONNAÎT, et on dit ce qui manque à côté (§5) :
//    `manquants` nomme chaque coût non saisi ; le bénéfice reste calculé, mais
//    n'est jamais présenté comme complet.
export function rentabilite({ achat, livraison, remise, frais, revente, marge } = {}) {
  const manquants = [];
  if (livraison == null) manquants.push('livraison');
  if (remise == null) manquants.push('remise en état');
  if (frais == null) manquants.push('frais de vente');
  const coutAchat = achat == null ? null : achat + (livraison || 0) + (remise || 0);
  const benefice = (coutAchat == null || revente == null) ? null : revente - (frais || 0) - coutAchat;
  const margePct = (benefice == null || !revente) ? null : Math.round((benefice / revente) * 1000) / 10;
  // Le prix d'achat maximum pour garder `marge` : sur le COÛT TOTAL (article +
  // livraison) quand la livraison n'est pas connue, sur l'article sinon.
  let prixMax = null, prixMaxPorte = null;
  if (revente != null && marge != null) {
    const plafond = revente - (frais || 0) - (remise || 0) - marge;
    if (livraison != null) { prixMax = plafond - livraison; prixMaxPorte = 'article'; }
    else { prixMax = plafond; prixMaxPorte = 'total'; }
  }
  return { coutAchat, benefice, margePct, prixMax, prixMaxPorte, manquants, complet: !manquants.length };
}

// Les ventes comparables : MÊME modèle, MÊME pointure (exacte, tiers compris),
// tirées de SES ventes finalisées. Le modèle est lu par la règle de l'app
// (`extractModel`, passée en paramètre : une seule liste de modèles connus).
// Rend la liste ET ce qui la date : une fourchette sans sa source ne vaut rien.
export function ventesComparables(ventes, cle, modeleDe) {
  if (!cle || !cle.modele || !cle.taille || typeof modeleDe !== 'function') return [];
  const out = [];
  for (const v of (ventes || [])) {
    if (!v || v.prix == null || !(v.prix > 0)) continue;
    if (modeleDe(v.titre) !== cle.modele) continue;
    const { eu } = taillesDuTitre(v.titre);
    if (eu.length !== 1 || eu[0] !== cle.taille) continue;
    out.push(v);
  }
  return out.sort((a, b) => (b.date || 0) - (a.date || 0));
}
// Prudente · moyenne · ambitieuse = 1er quartile · médiane · 3e quartile
// (rang le plus proche) — seulement avec au moins COMPARABLES_MIN ventes.
export function fourchetteRevente(comparables, maintenant) {
  const prix = (comparables || []).map((v) => v.prix).filter((p) => p > 0).sort((a, b) => a - b);
  const n = prix.length;
  const dates = (comparables || []).map((v) => v.date).filter((d) => Number.isFinite(d) && d > 0);
  const recente = dates.length ? Math.max(...dates) : null, ancienne = dates.length ? Math.min(...dates) : null;
  const age = (d) => (d == null ? null : Math.max(0, Math.floor((maintenant - d) / 86400000)));
  const base = { n, plusRecenteJ: age(recente), plusAncienneJ: age(ancienne) };
  if (n < COMPARABLES_MIN) return { ...base, assez: false };
  const rang = (p) => prix[Math.min(n - 1, Math.max(0, Math.ceil(p * n) - 1))];
  const mediane = n % 2 ? prix[(n - 1) / 2] : Math.round((prix[n / 2 - 1] + prix[n / 2]) / 2);
  return { ...base, assez: true, prudente: rang(0.25), moyenne: mediane, ambitieuse: rang(0.75), anciennes: base.plusRecenteJ != null && base.plusRecenteJ > COMPARABLES_ANCIENS_J };
}

// ── BUDGET D'ACHAT DU MOIS ───────────────────────────────────────────────────
// `publication` : ce que l'écran Achats a PUBLIÉ (`vrm_achats_mois`, §11 —
// l'écran qui lit les achats est le seul à les compter). Absente, d'un autre
// mois ou partielle ⇒ on le dit, jamais un « reste » inventé.
export function budgetDuMois(budget, publication, maintenant) {
  if (budget == null) return { etat: 'sans-budget' };
  const mois = parisJour(maintenant).slice(0, 7);
  if (!publication || publication.mois !== mois || !Number.isFinite(publication.depense)) return { etat: 'pas-su', budget, mois };
  const reste = budget - publication.depense;
  return { etat: publication.complet ? 'lu' : 'partiel', budget, mois, depense: publication.depense, n: publication.n, reste, depasse: reste < 0, manque: publication.manque || [] };
}
