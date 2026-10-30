// ════════════════════════════════════════════════════════════════════════════
//  L'AGENT eBAY QUI DEMANDE — la règle pure (29 octobre)
//
//  Julien : « je veux un agent autonome, c'est-à-dire que je veux juste qu'il
//  demande s'il doit poster les articles, que tu puisses lui dire ce que tu veux
//  qu'il publie ».
//
//  ⇒ L'agent PRÉPARE et PROPOSE ; c'est Julien qui dit OUI. Rien ne se publie
//    sans son clic (§2 : publier engage une vente). Ce module ne fait AUCUN
//    appel : il dit, à partir de ce que l'app a LU, quelles paires proposer et
//    pourquoi les autres sont écartées. Un seul propriétaire (§11) : l'écran
//    eBay → À traiter (section « Agent eBay »), la ligne de Ma journée et le résumé publié pour la
//    notification du matin lisent TOUS cette règle.
//
//  Trois états partout : `undefined` = en cours de lecture · `null` = la lecture
//  a échoué (« pas su » — rien n'est proposé, et c'est dit) · une valeur = lu.
//  « Pas su » ne vaut jamais « rien à écarter » : une paire peut-être vendue ne
//  se propose pas.
// ════════════════════════════════════════════════════════════════════════════

export const AGENT_MAX_PAR_JOUR = 20;
export const AGENT_RESUME_MAX_AGE_MS = 48 * 3600000;   // au-delà, le résumé n'est plus une mesure

export const REGLES_AGENT_DEFAUT = Object.freeze({
  v: 1,
  actif: true,             // l'agent propose (il ne publie JAMAIS seul)
  comptesVinted: [],       // vide = tous ses comptes
  marques: [],             // vide = toutes
  tailles: [],             // vide = toutes
  prixMin: null,           // prix VINTED
  prixMax: null,
  joursMin: null,          // en ligne sur Vinted depuis au moins N jours
  seulementCochees: false, // seulement les paires cochées « eBay »
  parJour: 5,              // au plus N proposées (et publiées) par jour
  prixMode: 'meme',        // 'meme' · 'pct' · 'eur'
  prixValeur: 0,
  compteEbay: '',          // vide = le compte eBay par défaut
  jamais: [],              // N° (clé) à ne jamais proposer
  phrase: '',              // la dernière phrase tapée, gardée pour la lui remontrer
});

// La clé d'un N° — la MÊME règle que `cleNum` d'App.jsx (majuscules, sans
// espace ni tiret, « 007 » = « 7 »). L'app passe la sienne (`cle`) ; celle-ci ne
// sert qu'au banc. `audit-agent-ebay.cjs` compare leurs sorties.
export const cleNumAgent = (v) => {
  let s = String(v == null ? '' : v).trim().toUpperCase().replace(/[\s\-_.]/g, '');
  if (/^\d+$/.test(s)) s = String(parseInt(s, 10));
  return s;
};
export const normTexte = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const nombre = (v) => {
  if (v == null || v === '') return null;
  const n = Number(String(v).replace(',', '.').replace(/\s+/g, ''));
  return Number.isFinite(n) ? n : null;
};
const liste = (v) => (Array.isArray(v) ? v : []).map((x) => String(x == null ? '' : x).trim()).filter(Boolean);
const borne = (n, a, b) => Math.min(b, Math.max(a, n));

// Une taille comparable : « 42,5 » = « 42.5 » = « T42.5 » = « EU 42,5 » ; une
// lettre (« M ») reste une lettre. Rien ⇒ ''.
export function normTaille(s) {
  const t = String(s == null ? '' : s).trim();
  const m = /(\d{2})(?:[.,](5))?/.exec(t);
  if (m) { const n = Number(m[1]); if (n >= 16 && n <= 60) return m[2] ? `${n}.5` : String(n); }
  const l = /^(XXS|XS|S|M|L|XL|XXL|XXXL)$/i.exec(t.replace(/^taille\s*/i, '').trim());
  return l ? l[1].toUpperCase() : '';
}

// Les réglages lus, quels qu'ils soient : chaque champ borné, rien d'autre.
export function normaliserReglesAgent(v) {
  const r = v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  const D = REGLES_AGENT_DEFAUT;
  const pmin = nombre(r.prixMin), pmax = nombre(r.prixMax), jm = nombre(r.joursMin), pj = nombre(r.parJour), pv = nombre(r.prixValeur);
  const mode = ['meme', 'pct', 'eur'].includes(r.prixMode) ? r.prixMode : 'meme';
  return {
    v: 1,
    actif: r.actif === false ? false : true,
    comptesVinted: liste(r.comptesVinted).filter((u) => /^\d+$/.test(u)),
    marques: [...new Set(liste(r.marques))].slice(0, 30),
    tailles: [...new Set(liste(r.tailles).map(normTaille).filter(Boolean))].slice(0, 40),
    prixMin: pmin != null && pmin >= 0 ? pmin : null,
    prixMax: pmax != null && pmax > 0 ? pmax : null,
    joursMin: jm != null && jm >= 1 ? Math.round(borne(jm, 1, 365)) : null,
    seulementCochees: r.seulementCochees === true,
    parJour: pj != null && pj >= 1 ? Math.round(borne(pj, 1, AGENT_MAX_PAR_JOUR)) : D.parJour,
    prixMode: mode,
    prixValeur: mode === 'meme' ? 0 : (pv == null ? 0 : (mode === 'pct' ? borne(pv, -50, 200) : borne(pv, -500, 500))),
    compteEbay: typeof r.compteEbay === 'string' ? r.compteEbay : '',
    jamais: [...new Set(liste(r.jamais).map(cleNumAgent).filter(Boolean))].slice(0, 2000),
    phrase: typeof r.phrase === 'string' ? r.phrase.slice(0, 300) : '',
  };
}

// ── LE PRIX SUR eBAY ────────────────────────────────────────────────────────
// Le prix Vinted, le même ou majoré (en % ou en €), arrondi au centime. JAMAIS
// sous le prix d'achat connu : la paire est alors écartée (on ne remonte pas le
// prix en douce — il le voit et décide).
export function prixEbayAgent(prixVinted, regles, achat) {
  const p0 = nombre(prixVinted);
  if (!(p0 > 0)) return { prix: null, raison: 'sans-prix' };
  const r = regles || REGLES_AGENT_DEFAUT;
  const v = Number(r.prixValeur) || 0;
  let p = r.prixMode === 'pct' ? p0 * (1 + v / 100) : r.prixMode === 'eur' ? p0 + v : p0;
  p = Math.round(p * 100) / 100;
  if (!(p >= 0.01)) return { prix: null, raison: 'sans-prix' };
  const a = typeof achat === 'number' && Number.isFinite(achat) ? achat : null;
  if (a != null && Math.round(p * 100) < Math.round(a * 100)) return { prix: null, raison: 'sous-achat', achat: a, propose: p };
  return { prix: p };
}

// ── POURQUOI UNE PAIRE N'EST PAS PROPOSÉE (dit une fois, §7) ─────────────────
// [singulier, pluriel] : « 1 déjà vendue ailleurs », « 2 déjà vendues ailleurs ».
export const RAISONS_AGENT = {
  'pas-en-ligne': ['plus en vente sur Vinted', 'plus en vente sur Vinted'],
  'numero-double': ['dont le N° est porté par deux paires — à régler dans Colis ou Annonces', 'dont le N° est porté par deux paires — à régler dans Colis ou Annonces'],
  vendue: ['déjà vendue ailleurs', 'déjà vendues ailleurs'],
  'deja-ebay': ['déjà en vente ou programmée sur eBay', 'déjà en vente ou programmées sur eBay'],
  brouillon: ['déjà en brouillon eBay, à programmer ou publier depuis Annonces', 'déjà en brouillon eBay, à programmer ou publier depuis Annonces'],
  jumelle: ['à la même photo qu’une autre paire (une paire, une annonce)', 'à la même photo qu’une autre paire (une paire, une annonce)'],
  incertain: ['à la publication incertaine, en attente d’une relecture chez eBay', 'à la publication incertaine, en attente d’une relecture chez eBay'],
  jamais: ['mise dans « jamais sur eBay »', 'mises dans « jamais sur eBay »'],
  'hors-regles': ['hors de tes règles', 'hors de tes règles'],
  'marque-inconnue': ['à la marque inconnue (je ne la devine pas)', 'à la marque inconnue (je ne la devine pas)'],
  'taille-inconnue': ['à la taille inconnue (je ne la devine pas)', 'à la taille inconnue (je ne la devine pas)'],
  'anciennete-inconnue': ['sans date de mise en ligne connue', 'sans date de mise en ligne connue'],
  'pas-cochee': ['pas cochée pour eBay', 'pas cochées pour eBay'],
  'sans-prix': ['sans prix Vinted lisible', 'sans prix Vinted lisible'],
  'sous-achat': ['dont le prix eBay serait sous ton prix d’achat', 'dont le prix eBay serait sous ton prix d’achat'],
  'sans-photo': ['sans photo captée', 'sans photo captée'],
  quota: ['au-delà de ton maximum du jour', 'au-delà de ton maximum du jour'],
};
const ORDRE_RAISONS = Object.keys(RAISONS_AGENT);
export function phraseEcartees(ecartees) {
  const e = ecartees || {};
  const parts = ORDRE_RAISONS.filter((k) => e[k] > 0).map((k) => `${e[k]} ${RAISONS_AGENT[k][e[k] > 1 ? 1 : 0]}`);
  const n = ORDRE_RAISONS.reduce((s, k) => s + (e[k] > 0 ? e[k] : 0), 0);
  return n ? `${n} écartée${n > 1 ? 's' : ''} : ${parts.join(' · ')}.` : '';
}

const estSet = (s) => !!(s && typeof s.has === 'function');
const estMap = (m) => !!(m && typeof m.get === 'function');
const marqueOk = (marque, marques) => {
  const m = normTexte(marque);
  if (!m) return null;
  return marques.some((x) => { const n = normTexte(x); return n && (m === n || m.startsWith(n + ' ')); });
};

// ── LA PROPOSITION ──────────────────────────────────────────────────────────
//  regles          : réglages normalisés (undefined = pas encore lus)
//  paires          : [{ id, num, title, marque, taille, tailleVinted, prix, uid, photos, cover, cree }]
//  enLigne         : Set des annonces Vinted EN VENTE (null = pas su)
//  ventes          : le verdict `numerosDejaVendus` (vendus, pasSu, enCours)
//  dejaSurEbay     : Map N° → { etat } (en vente / programmée, jumelles comprises ; null = pas su)
//  jumelles        : Map id → { gardeId } (`jumellesParPhoto`)
//  achatDe(p)      : prix d'achat connu (nombre) ou null
//  cochee(p)       : la paire est-elle cochée « eBay » ?
//  incertains      : Set de N° dont une publication est incertaine (relecture attendue)
//  doubles         : Map clé du N° → nombre de paires EN LIGNE qui le portent (la
//                    liste `paires` peut n'en garder qu'une : l'autre est comptée)
//  brouillons      : Set de N° qui ont déjà un brouillon eBay (undefined = en cours · null = pas su ;
//                    clé absente de l'appel = non jugé)
//  publieesAujourdhui : ce que l'agent a déjà publié aujourd'hui (le maximum du jour en tient compte)
export function propositionAgent(o) {
  const x = o || {};
  const cle = typeof x.cle === 'function' ? x.cle : cleNumAgent;
  const maintenant = Number.isFinite(x.maintenant) ? x.maintenant : Date.now();
  const r = x.regles;
  if (r === undefined) return { etat: 'en-cours', attend: 'tes réglages' };
  if (r === null) return { etat: 'pas-su', pasSu: ['tes réglages de l’agent'] };
  if (r.actif === false) return { etat: 'eteint' };
  const pasSu = [];
  if (x.paires === undefined || x.enLigne === undefined || x.ventes === undefined || x.dejaSurEbay === undefined) return { etat: 'en-cours' };
  if (!Array.isArray(x.paires)) pasSu.push('tes paires numérotées');
  if (!estSet(x.enLigne)) pasSu.push('tes annonces Vinted en ligne');
  if (x.ventes && x.ventes.enCours) return { etat: 'en-cours' };
  if (!x.ventes || !estMap(x.ventes.vendus)) pasSu.push('tes ventes (Vinted, eBay, Leboncoin)');
  else if (Array.isArray(x.ventes.pasSu)) pasSu.push(...x.ventes.pasSu);
  if (!estMap(x.dejaSurEbay)) pasSu.push('tes annonces eBay');
  const jugeBrouillons = Object.prototype.hasOwnProperty.call(x, 'brouillons');
  if (jugeBrouillons && x.brouillons === undefined) return { etat: 'en-cours' };
  if (jugeBrouillons && !estSet(x.brouillons)) pasSu.push('tes brouillons eBay');
  if (pasSu.length) return { etat: 'pas-su', pasSu };

  const jamais = new Set((r.jamais || []).map(cle));
  const comptes = new Set(r.comptesVinted || []);
  const marques = r.marques || [];
  const tailles = new Set((r.tailles || []).map(normTaille).filter(Boolean));
  const ecartees = {};
  const ecarte = (k) => { ecartees[k] = (ecartees[k] || 0) + 1; };
  const candidates = [];
  // ⚠️ Un N° porté par DEUX paires en vente (§5 : deux paires sous un même
  // numéro) : aucune n'est proposée — choisir l'une des deux enverrait les
  // photos de l'une sous un SKU qui en désigne deux. Comptées, et dites.
  const parCle = new Map();
  for (const p of x.paires) {
    if (!p || p.num == null || !x.enLigne.has(String(p.id))) continue;
    const k = cle(p.num); if (!k) continue;
    const s = parCle.get(k) || new Set(); s.add(String(p.id)); parCle.set(k, s);
  }
  const vus = new Set(), doublesVus = new Set();
  for (const p of x.paires) {
    if (!p || p.num == null) continue;
    const k = cle(p.num);
    const id = String(p.id);
    if (!k || vus.has(id)) continue;
    vus.add(id);
    if (!x.enLigne.has(id)) { ecarte('pas-en-ligne'); continue; }
    const nDouble = Math.max((parCle.get(k) || new Set()).size, estMap(x.doubles) ? Number(x.doubles.get(k)) || 0 : 0);
    if (nDouble > 1) { if (!doublesVus.has(k)) { doublesVus.add(k); ecartees['numero-double'] = (ecartees['numero-double'] || 0) + nDouble; } continue; }
    if (x.ventes.vendus.get(k)) { ecarte('vendue'); continue; }
    if (x.dejaSurEbay.get(k)) { ecarte('deja-ebay'); continue; }
    if (jugeBrouillons && x.brouillons.has(k)) { ecarte('brouillon'); continue; }
    const j = estMap(x.jumelles) ? x.jumelles.get(id) : null;
    if (j && j.gardeId && String(j.gardeId) !== id) { ecarte('jumelle'); continue; }
    if (estSet(x.incertains) && x.incertains.has(k)) { ecarte('incertain'); continue; }
    if (jamais.has(k)) { ecarte('jamais'); continue; }
    if (comptes.size && !comptes.has(String(p.uid || ''))) { ecarte('hors-regles'); continue; }
    if (marques.length) { const ok = marqueOk(p.marque, marques); if (ok === null) { ecarte('marque-inconnue'); continue; } if (!ok) { ecarte('hors-regles'); continue; } }
    if (tailles.size) { const t = normTaille(p.tailleVinted || p.taille); if (!t) { ecarte('taille-inconnue'); continue; } if (!tailles.has(t)) { ecarte('hors-regles'); continue; } }
    const pv = nombre(p.prix);
    if (r.prixMin != null || r.prixMax != null) {
      if (!(pv > 0)) { ecarte('sans-prix'); continue; }
      if ((r.prixMin != null && pv < r.prixMin) || (r.prixMax != null && pv > r.prixMax)) { ecarte('hors-regles'); continue; }
    }
    if (r.joursMin != null) {
      const c = Number(p.cree);
      if (!(c > 0)) { ecarte('anciennete-inconnue'); continue; }
      if ((maintenant - c) / 86400000 < r.joursMin) { ecarte('hors-regles'); continue; }
    }
    if (r.seulementCochees && !(typeof x.cochee === 'function' && x.cochee(p) === true)) { ecarte('pas-cochee'); continue; }
    if (!((Array.isArray(p.photos) && p.photos.length) || p.cover)) { ecarte('sans-photo'); continue; }
    const achat = typeof x.achatDe === 'function' ? x.achatDe(p) : null;
    const px = prixEbayAgent(pv, r, achat);
    if (px.prix == null) { ecarte(px.raison); continue; }
    candidates.push({ id, num: String(p.num), cle: k, prix: px.prix, prixVinted: pv, achat: typeof achat === 'number' ? achat : null, paire: p });
  }
  const reste = Math.max(0, (Number(r.parJour) || REGLES_AGENT_DEFAUT.parJour) - Math.max(0, Number(x.publieesAujourdhui) || 0));
  const proposees = candidates.slice(0, reste);
  if (candidates.length > reste) ecartees.quota = candidates.length - reste;
  return { etat: 'lu', proposees, ecartees, reste, candidates: candidates.length };
}

// Le résumé publié pour Ma journée et la notification du matin (`vrm_agent_ebay_resume`) :
// seulement sur une proposition LUE — « pas su » ne publie rien (le dernier
// résumé, daté, reste ; le serveur l'ignore au-delà de 48 h).
//  `n`      : les paires PROPOSÉES (elles suivent ses règles) ;
//  `pretes` : celles que l'écran a PRÉPARÉES chez eBay et qui peuvent partir
//             telles quelles — absent tant que personne n'a préparé. Jamais
//             « prêtes » sans préparation (revue du 29 oct.).
// ⚠️ (dernier tour du 29 oct.) « Arrêter l'agent » doit le faire TAIRE : un
// agent éteint, sans compte eBay relié, ou sur un compte eBay qui ne vend pas en
// euros publie un résumé NEUTRE ({ n: 0, raison }) — sinon l'ancien « 3 paires
// prêtes » restait 48 h dans Ma journée et la notification du matin.
// « Pas su » (une lecture ratée) ne publie toujours rien : un hoquet n'efface pas.
export const ETATS_AGENT_MUET = Object.freeze(['eteint', 'sans-ebay', 'devise']);
export function resumeAgent(prop, maintenant = Date.now(), pause = null, pretes) {
  if (prop && ETATS_AGENT_MUET.includes(prop.etat)) return { v: 1, n: 0, at: maintenant, raison: prop.etat };
  if (!prop || prop.etat !== 'lu') return null;
  const p = Number.isFinite(pretes) && pretes >= 0 ? Math.min(Math.round(pretes), prop.proposees.length) : null;
  return { v: 1, n: prop.proposees.length, ...(p != null ? { pretes: p } : {}), at: maintenant, ...(pause ? { pause } : {}) };
}
// LA phrase du résumé — une seule règle pour la question de l'écran, Ma journée
// et la notification du matin (§11, le serveur l'importe).
export function phraseResumeAgent(n0, pretes0) {
  const n = Math.round(Number(n0)), s = (k) => (k > 1 ? 's' : '');
  if (!(n > 0)) return '';
  const p = Number.isFinite(Number(pretes0)) && pretes0 !== null && pretes0 !== undefined && pretes0 !== '' ? Math.round(Number(pretes0)) : null;
  if (p != null && p >= n) return `${n} paire${s(n)} prête${s(n)} pour eBay — je ${n > 1 ? 'les' : 'la'} publie ?`;
  if (p != null && p > 0) return `${n} paire${s(n)} proposée${s(n)} pour eBay · ${p} prête${s(p)} à publier`;
  return `${n} paire${s(n)} à regarder pour eBay`;
}
// La ligne de Ma journée : seulement un résumé frais, non nul, et pas mis de côté aujourd'hui.
// L'agent est-il ARRÊTÉ par Julien ? — une règle pour Ma journée et le serveur
// (§11). Réglages absents ou illisibles ⇒ non (le défaut est « actif »).
export const agentArrete = (regles) => !!(regles && typeof regles === 'object' && regles.actif === false);
export function ligneJourneeAgent(resume, today, maintenant = Date.now(), regles = null) {
  if (agentArrete(regles)) return null;
  const r = resume && typeof resume === 'object' ? resume : null;
  if (!r || !(Number(r.n) > 0)) return null;
  const at = Number(r.at);
  if (!(at > 0) || maintenant - at > AGENT_RESUME_MAX_AGE_MS || at - maintenant > 600000) return null;
  if (r.pause && r.pause === today) return null;
  const n = Math.round(Number(r.n));
  return { n, pretes: Number.isFinite(Number(r.pretes)) && r.pretes != null ? Number(r.pretes) : null, text: phraseResumeAgent(n, r.pretes) };
}

// ── « CE QUE TU VEUX QU'IL PUBLIE », EN UNE PHRASE (sans IA, §2.9) ───────────
// Des règles simples : des mots-clés et des nombres. Ce qui n'est pas compris est
// DIT (jamais deviné), et la règle comprise lui est montrée AVANT d'être gardée.
export const MARQUES_CONNUES = ['Nike', 'Jordan', 'Adidas', 'New Balance', 'Asics', 'Salomon', 'Puma', 'Reebok', 'Converse', 'Vans', 'Autry', 'Veja', 'On', 'Hoka', 'Saucony', 'Mizuno', 'Onitsuka Tiger', 'Diadora', 'Le Coq Sportif', 'Timberland', 'Dr. Martens', 'Birkenstock', 'Ralph Lauren', 'Lacoste', 'The North Face', 'Carhartt', 'Stone Island', 'Moncler', 'Balenciaga', 'Gucci', 'Louis Vuitton', 'Dior', 'Prada', 'Golden Goose', 'Common Projects', 'Yeezy', 'Arc\'teryx', 'Patagonia', 'Levi\'s', 'Supreme', 'Palace', 'Stüssy'];
const MOT_NB = '(\\d+(?:[.,]\\d+)?)';
const EUR = '\\s*(?:€|euros?|eur|e)?';   // « euros » AVANT « e » : sinon « 80 euros » laissait « uros »
const TAILLE_TXT = '(?:\\d{2}(?:[.,]5)?|xxs|xs|s|m|l|xl|xxl)';
// Une taille n'est JAMAIS un nombre suivi d'une unité de prix (« en 41 à 50 € » :
// 41 est la pointure, 50 € n'est pas une pointure — avant, 41 → 50 en 19 tailles).
const PRIX_SUIT = '(?!\\d|[.,]\\d)(?!\\s*(?:€|euros?\\b|eur\\b|e\\b))';
const TAILLE_SEULE = `${TAILLE_TXT}${PRIX_SUIT}`;
// Un nombre suivi de « jours » / « j » n'est JAMAIS un prix (« depuis moins de 10 jours »).
const PAS_JOURS = '(?!\\d|[.,]\\d)(?!\\s*(?:€|euros?|eur|e)?\\s*(?:jours?|j)\\b)';
// Ponctuation qui n'est pas une décimale : « Nike, Adidas » · « les Adidas. »
const sansPonctuation = (s) => String(s).replace(/(?<!\d)[,.;!?:]|[,.;!?:](?!\d)/g, ' ');
const normMarque = (s) => sansPonctuation(normTexte(s).replace(/[’'"«»]/g, ' ')).replace(/\s+/g, ' ').trim();
const VIDES = new Set(['publie', 'publier', 'publies', 'poste', 'poster', 'mets', 'met', 'mettre', 'les', 'des', 'mes', 'mon', 'ma', 'ta', 'tes', 'en', 'a', 'au', 'aux', 'de', 'du', 'd', 'l', 'la', 'le', 'plus', 'moins', 'paire', 'paires', 'article', 'articles', 'toutes', 'tous', 'tout', 'sur', 'ebay', 'celles', 'ceux', 'qui', 'et', 'ou', 'que', 'je', 'veux', 'voudrais', 'chaussures', 'baskets', 'basket', 'sneakers', 'prix', 'euros', 'euro', 'eur', 'stp', 'merci', 'uniquement', 'seulement', 'avec', 'pour', 'mais', 'pas', 'les', 'une', 'un', 'cher', 'cheres', 'chers', 'vinted', 'compte', 'comptes', 'annonce', 'annonces', 'en', 'ligne', 'depuis', 'jours', 'jour', 'par', 'maximum', 'max', 'minimum', 'min', 'taille', 'tailles', 'pointure', 'pointures', 'entre', 'dessus', 'dessous', 'partir', 'jusqu', 'sous', 'meme', 'cochees', 'cochee', 'qu', 's', 'y', 'il', 'elle', 'on', 'ne']);

function etendreTailles(txt) {
  const out = [];
  const t = normTexte(txt);
  const r = new RegExp(`(\\d{2}(?:[.,]5)?)\\s*(?:-|a|au)\\s*(\\d{2}(?:[.,]5)?)${PRIX_SUIT}`).exec(t);
  if (r) {
    const a = Number(r[1].replace(',', '.')), b = Number(r[2].replace(',', '.'));
    if (a >= 16 && b <= 60 && b >= a && b - a <= 12) for (let v = a; v <= b + 1e-9; v += 0.5) out.push(Number.isInteger(v) ? String(v) : `${Math.floor(v)}.5`);
  }
  const reste = r ? t.replace(r[0], ' ') : t;
  for (const m of reste.matchAll(new RegExp(`\\b${TAILLE_SEULE}\\b`, 'g'))) { const n = normTaille(m[0]); if (n) out.push(n); }
  return [...new Set(out)];
}

export function comprendrePhrase(texte, opts = {}) {
  const brut = String(texte == null ? '' : texte).slice(0, 300);
  let t = ' ' + normTexte(brut).replace(/[’'"«»]/g, ' ').replace(/(\d)\s*€/g, '$1 €') + ' ';
  const regles = {};
  const compris = [];
  // ⚠️ UNE NÉGATION N'EST JAMAIS APPLIQUÉE (revue du 29 oct.) : « ne publie pas
  // les Adidas » devenait « Paires : Adidas » — l'inverse, sans un mot. VRM ne
  // sait pas encore EXCLURE par une phrase : il ne garde rien et le dit.
  const neg = /(?:^|\s)(pas|sauf|sans|hors|aucune?s?|jamais|excepte|exclus?|exclure|ni)(?=\s)/.exec(t);
  if (neg) return { regles: {}, compris: [], pasCompris: [], vide: true, negation: neg[1] };
  const ote = (m) => { if (m) t = t.replace(m[0], ' '); };
  let m;
  if ((m = /\bseulement (?:celles |ceux |les paires )?cochees?\b|\bcochees? (?:pour )?ebay\b/.exec(t))) { regles.seulementCochees = true; compris.push('seulement les paires cochées « eBay »'); ote(m); }
  if ((m = /\bqui dorment\b/.exec(t))) { regles.joursMin = 30; compris.push('en ligne sur Vinted depuis au moins 30 jours'); ote(m); }
  if ((m = new RegExp(`(?:en ligne )?depuis (?:plus de |au moins )?(\\d{1,3})\\s*(?:jours?|j)\\b|(?:plus de|au moins) (\\d{1,3})\\s*(?:jours?|j)\\b`).exec(t))) {
    const n = Number(m[1] || m[2]); if (n >= 1 && n <= 365) { regles.joursMin = n; compris.push(`en ligne sur Vinted depuis au moins ${n} jour${n > 1 ? 's' : ''}`); } ote(m);
  }
  // « depuis moins de N jours » : l'agent ne sait pas filtrer les annonces RÉCENTES
  // — dit, jamais lu comme un prix (avant : « prix jusqu'à 10 € »).
  const nonCompris = [];
  if ((m = /(?:en ligne )?depuis moins de (\d{1,3})\s*(?:jours?|j)\b|(?:il y a )?moins de (\d{1,3})\s*(?:jours?|j)\b/.exec(t))) { nonCompris.push(m[0].trim()); ote(m); }
  if ((m = /(?:max(?:imum)? |au plus )?(\d{1,2})\s*(?:paires? |annonces? |articles? )?(?:par|\/)\s*jour\b/.exec(t))) {
    const n = Number(m[1]); if (n >= 1) { regles.parJour = Math.min(AGENT_MAX_PAR_JOUR, n); compris.push(`au plus ${regles.parJour} par jour`); } ote(m);
  }
  if ((m = new RegExp(`\\+\\s*${MOT_NB}\\s*%|${MOT_NB}\\s*%\\s*(?:de plus|plus cher)`).exec(t))) {
    const n = nombre(m[1] || m[2]); if (n != null) { regles.prixMode = 'pct'; regles.prixValeur = n; compris.push(`prix sur eBay : celui de Vinted + ${String(n).replace('.', ',')} %`); } ote(m);
  } else if ((m = new RegExp(`\\+\\s*${MOT_NB}\\s*(?:€|euros?|eur|e)(?=\\s|,|$)|${MOT_NB}\\s*(?:€|euros?|eur|e)\\s*(?:de plus|plus cher)`).exec(t))) {
    const n = nombre(m[1] || m[2]); if (n != null) { regles.prixMode = 'eur'; regles.prixValeur = n; compris.push(`prix sur eBay : celui de Vinted + ${String(n).replace('.', ',')} €`); } ote(m);
  } else if ((m = /\b(?:au )?meme prix\b/.exec(t))) { regles.prixMode = 'meme'; regles.prixValeur = 0; compris.push('prix sur eBay : le même que sur Vinted'); ote(m); }
  if ((m = new RegExp(`(?:\\ben|\\btailles?|\\bpointures?|\\bdu)\\s+(${TAILLE_SEULE}(?:\\s*(?:,|et|ou|-|a|au|\\/)\\s*${TAILLE_SEULE})*)\\b`).exec(t))) {
    const tl = etendreTailles(m[1]);
    // Une lettre seule (« en s ») n'est une taille qu'après « taille ».
    const garde = /^\s*(?:\btailles?|\bpointures?)/.test(m[0]) ? tl : tl.filter((x) => /^\d/.test(x));
    if (garde.length) { regles.tailles = garde; compris.push(`taille${garde.length > 1 ? 's' : ''} ${garde.map((x) => x.replace('.', ',')).join(', ')}`); ote(m); }
  }
  if ((m = new RegExp(`entre\\s+${MOT_NB}${EUR}\\s+et\\s+${MOT_NB}${EUR}`).exec(t))) {
    const a = nombre(m[1]), b = nombre(m[2]); if (a != null && b != null) { regles.prixMin = Math.min(a, b); regles.prixMax = Math.max(a, b); } ote(m);
  }
  if ((m = new RegExp(`(?:a plus de|plus de|au[- ]dessus de|a partir de|minimum|min|superieure? a|plus cher que|>=?)\\s*${MOT_NB}${PAS_JOURS}${EUR}`).exec(t))) { const n = nombre(m[1]); if (n != null) regles.prixMin = n; ote(m); }
  if ((m = new RegExp(`(?:a moins de|moins de|en dessous de|au[- ]dessous de|sous|jusqu a|maximum|max|inferieure? a|<=?)\\s*${MOT_NB}${PAS_JOURS}${EUR}`).exec(t))) { const n = nombre(m[1]); if (n != null) regles.prixMax = n; ote(m); }
  if (regles.prixMin != null || regles.prixMax != null) {
    const f = (n) => String(n).replace('.', ',') + ' €';
    compris.push(regles.prixMin != null && regles.prixMax != null ? `prix Vinted entre ${f(regles.prixMin)} et ${f(regles.prixMax)}` : regles.prixMin != null ? `prix Vinted à partir de ${f(regles.prixMin)}` : `prix Vinted jusqu’à ${f(regles.prixMax)}`);
  }
  const comptes = Array.isArray(opts.comptes) ? opts.comptes : [];
  const cs = [];
  for (const c of comptes) {
    const l = normTexte(c && c.login);
    if (l && l.length >= 3 && t.includes(' ' + l + ' ')) { cs.push(String(c.uid)); t = t.replace(' ' + l + ' ', ' '); }
  }
  if (cs.length) { regles.comptesVinted = cs; compris.push(`compte${cs.length > 1 ? 's' : ''} Vinted ${comptes.filter((c) => cs.includes(String(c.uid))).map((c) => c.login).join(', ')}`); }
  // La ponctuation (« Nike, Adidas et Puma », « les Adidas. ») ne colle plus une
  // marque à sa virgule : ôtée ici (les tailles et les prix sont déjà lus, une
  // décimale « 41,5 » ne passe jamais par là).
  t = ' ' + sansPonctuation(t) + ' ';
  const toutes = [...new Set([...(Array.isArray(opts.marques) ? opts.marques : []), ...MARQUES_CONNUES])].filter((x) => normMarque(x).length >= 2);
  toutes.sort((a, b) => normMarque(b).length - normMarque(a).length);   // « new balance » avant « on »
  const mq = [];
  for (const b of toutes) {
    const n = normMarque(b);
    // « On » (la marque) n'est pris qu'écrit avec sa majuscule dans la phrase.
    if (n === 'on' && !/\bOn\b/.test(brut)) continue;
    const re = new RegExp(`(^|\\s)${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+')}(?=\\s)`);
    if (re.test(t)) { if (!mq.some((x) => normMarque(x) === n)) mq.push(b); t = t.replace(re, ' '); }
  }
  if (mq.length) { regles.marques = mq; compris.push(`marque${mq.length > 1 ? 's' : ''} ${mq.join(', ')}`); }
  // Un nombre resté sans règle (« Nike 42 43 44 », « taille 9 US », « -10 % »)
  // est DIT, jamais ignoré en silence.
  const signes = [...t.matchAll(/-\s*\d+(?:[.,]\d+)?\s*(?:%|€)/g)].map((x) => x[0].replace(/\s+/g, ' ').trim());
  for (const x of signes) t = t.replace(x, ' ');
  const pasCompris = [...nonCompris, ...signes, ...t.split(/[^a-z0-9]+/).filter((w) => (/^\d+$/.test(w) ? true : w.length >= 3 && !VIDES.has(w)))];
  return { regles, compris, pasCompris: [...new Set(pasCompris)].slice(0, 8), vide: !compris.length };
}

// Appliquer une phrase comprise : les FILTRES sont remplacés par ceux de la
// phrase (une phrase dit tout ce qu'il veut) ; le prix et le maximum du jour ne
// changent que s'ils y sont dits ; « jamais », le compte eBay et l'interrupteur
// restent.
export function appliquerPhrase(regles, compris, phrase) {
  const r = normaliserReglesAgent(regles);
  const c = (compris && compris.regles) || {};
  return normaliserReglesAgent({
    ...r,
    comptesVinted: c.comptesVinted || [], marques: c.marques || [], tailles: c.tailles || [],
    prixMin: c.prixMin != null ? c.prixMin : null, prixMax: c.prixMax != null ? c.prixMax : null,
    joursMin: c.joursMin != null ? c.joursMin : null, seulementCochees: c.seulementCochees === true,
    ...(c.parJour != null ? { parJour: c.parJour } : {}),
    ...(c.prixMode ? { prixMode: c.prixMode, prixValeur: c.prixValeur } : {}),
    phrase: String(phrase || ''),
  });
}

// Les règles en clair (ce qu'on lui MONTRE, avant et après l'avoir gardé).
export function texteRegles(regles, opts = {}) {
  const r = normaliserReglesAgent(regles);
  const f = (n) => String(Math.round(n * 100) / 100).replace('.', ',') + ' €';
  const l = [];
  const quoi = [];
  if (r.marques.length) quoi.push(r.marques.join(', '));
  if (r.tailles.length) quoi.push(`taille${r.tailles.length > 1 ? 's' : ''} ${r.tailles.map((x) => x.replace('.', ',')).join(', ')}`);
  if (r.prixMin != null && r.prixMax != null) quoi.push(`prix Vinted entre ${f(r.prixMin)} et ${f(r.prixMax)}`);
  else if (r.prixMin != null) quoi.push(`prix Vinted à partir de ${f(r.prixMin)}`);
  else if (r.prixMax != null) quoi.push(`prix Vinted jusqu’à ${f(r.prixMax)}`);
  if (r.joursMin != null) quoi.push(`en ligne sur Vinted depuis au moins ${r.joursMin} jour${r.joursMin > 1 ? 's' : ''}`);
  if (r.seulementCochees) quoi.push('seulement celles cochées « eBay »');
  const noms = Array.isArray(opts.comptes) ? opts.comptes : [];
  if (r.comptesVinted.length) quoi.push(`compte${r.comptesVinted.length > 1 ? 's' : ''} ${r.comptesVinted.map((u) => (noms.find((c) => String(c.uid) === u) || {}).login || u).join(', ')}`);
  l.push(quoi.length ? `Paires : ${quoi.join(' · ')}` : 'Paires : toutes tes paires en ligne sur Vinted');
  const v = String(r.prixValeur).replace('.', ',');
  l.push(r.prixMode === 'pct' ? `Prix sur eBay : celui de Vinted ${r.prixValeur >= 0 ? '+' : '−'} ${v.replace('-', '')} % — jamais sous ton prix d’achat`
    : r.prixMode === 'eur' ? `Prix sur eBay : celui de Vinted ${r.prixValeur >= 0 ? '+' : '−'} ${v.replace('-', '')} € — jamais sous ton prix d’achat`
      : 'Prix sur eBay : le même que sur Vinted — jamais sous ton prix d’achat');
  l.push(`Au plus ${r.parJour} par jour`);
  if (r.jamais.length) l.push(`Jamais sur eBay : N°${r.jamais.slice(0, 12).join(', N°')}${r.jamais.length > 12 ? ` et ${r.jamais.length - 12} autres` : ''}`);
  return l;
}
