// ═══════════════════════════════════════════════════════════════════════════
// « PARTAGER » UNE FICHE D'ANNONCE (11 nov., lot partage-fiche) — LA RÈGLE
// ═══════════════════════════════════════════════════════════════════════════
// Depuis une annonce (Annonces, Stock), « Partager » crée un lien propre
// (vrm.center/p/<jeton>) pour envoyer l'article à un client hors Vinted.
//
// Module PUR, UN propriétaire (§11) : l'app (src/composants/PartageFiche.jsx)
// et le serveur (api/_lib/partage-fiche.js) importent CE fichier. Le serveur
// RE-NETTOIE toujours ce que le navigateur envoie (`nettoyerFiche`) : rien de
// ce qui n'est pas ci-dessous ne peut arriver sur la page publique.
//
// CE QUI EST PUBLIC (et rien d'autre) : titre, marque, taille, état, prix en
// euros, photos (hôtes connus), liens des annonces EN LIGNE (sites connus),
// le pseudo SEULEMENT s'il l'a voulu. JAMAIS : prix d'achat, N° de rangement,
// compte VRM, adresse, description (elle peut porter un N°), acheteur.
// L'identité de la paire (`ident` : annonce Vinted, compte, N°) reste dans SA
// ligne privée : elle sert à dire « Vendu » par la preuve de l'app (§5),
// jamais servie à la page.
// Tenu par scripts/audit-partage-fiche.cjs (EXÉCUTE api/compte.js).
// ═══════════════════════════════════════════════════════════════════════════

export const LIGNE_PREFIXE = 'vrm_partage_';
export const RE_LIGNE = /^vrm_partage_[A-Za-z0-9_-]{16}$/;
// 32 octets aléatoires en base64url (43 caractères) : imprévisible.
export const RE_JETON_PARTAGE = /^[A-Za-z0-9_-]{43}$/;
export const DUREES_JOURS = [1, 7, 30];
export const DUREE_DEFAUT = 7;
export const MAX_ACTIFS = 100;          // liens actifs par vendeur
export const MAX_PHOTOS = 8;
export const MAX_OCTETS_FICHE = 8000;   // la fiche publique, sérialisée
export const PERIME_MS = 72 * 3600000;  // au-delà : « à confirmer avec le vendeur »
export const VERIF_MIN_MS = 3600000;    // « toujours en ligne » au plus une fois par heure

export const urlPartage = (jeton, origine = 'https://vrm.center') => (RE_JETON_PARTAGE.test(String(jeton || '')) ? `${origine}/p/${jeton}` : '');
export const jetonDeChemin = (p) => { const s = String(p == null ? '' : p).trim(); return RE_JETON_PARTAGE.test(s) ? s : ''; };
export const dureeValide = (d) => (DUREES_JOURS.includes(Number(d)) ? Number(d) : DUREE_DEFAUT);

const str = (v, max) => {
  const s = String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f\u200b-\u200f\u2028-\u202e\u2066-\u2069]/g, ' ').replace(/\s+/g, ' ').trim();
  return max && s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s;
};

// Les photos : https, hôte d'image connu, sans identifiant ni mot de passe.
const HOTES_PHOTO = [/(^|\.)vinted\.net$/i, /^img\.leboncoin\.fr$/i, /^i\.ebayimg\.com$/i, /^images\.vestiairecollective\.com$/i];
export function photoPublique(u) {
  const s = String(u == null ? '' : u).trim();
  if (!s || s.length > 600) return '';
  let x; try { x = new URL(s); } catch (_) { return ''; }
  if (x.protocol !== 'https:' || x.username || x.password || x.port) return '';
  if (!HOTES_PHOTO.some((re) => re.test(x.hostname))) return '';
  return x.href;
}

// Les liens : l'ANNONCE elle-même sur un site connu, jamais une autre page.
export const SITES = ['vinted', 'leboncoin', 'ebay', 'vestiaire'];
export const NOM_SITE = { vinted: 'Vinted', leboncoin: 'Leboncoin', ebay: 'eBay', vestiaire: 'Vestiaire Collective' };
const REGLE_LIEN = {
  vinted: (x) => /^(www\.)?vinted\.(fr|be|es|it|de|nl|lu|pt|at|pl|cz|lt|sk|hu|ro|se|fi|dk|hr|gr|ie|com|co\.uk)$/i.test(x.hostname) && /^\/items\/\d+/.test(x.pathname),
  leboncoin: (x) => /^(www\.)?leboncoin\.fr$/i.test(x.hostname) && /^\/(ad\/[a-z_]+\/\d+|[a-z_]+\/\d+(\.htm)?|vi\/\d+)/i.test(x.pathname),
  ebay: (x) => /^(www\.)?ebay\.(fr|com|co\.uk|de|es|it|be)$/i.test(x.hostname) && /^\/itm\/(?:[^/]+\/)?\d+/.test(x.pathname),
  vestiaire: (x) => /^(fr\.|www\.)?vestiairecollective\.com$/i.test(x.hostname) && /\d+\.shtml$/.test(x.pathname),
};
export function lienPublic(site, u) {
  if (!REGLE_LIEN[site]) return '';
  const s = String(u == null ? '' : u).trim();
  if (!s || s.length > 400) return '';
  let x; try { x = new URL(s); } catch (_) { return ''; }
  if (x.protocol !== 'https:' || x.username || x.password || x.port) return '';
  if (!REGLE_LIEN[site](x)) return '';
  // Ni paramètre ni ancre : un lien de suivi ou de parrainage n'a rien à faire ici.
  return `https://${x.hostname}${x.pathname}`;
}

// Le prix : des euros (VRM reste en France, §3), > 0, < 100 000. Autre devise ⇒ rien.
export function prixPublic(p, devise) {
  const d = String(devise || 'EUR').toUpperCase();
  if (d !== 'EUR') return null;
  const n = Number(typeof p === 'object' && p ? p.amount : String(p == null ? '' : p).replace(',', '.'));
  return Number.isFinite(n) && n > 0 && n < 100000 ? Math.round(n * 100) / 100 : null;
}

// LA fiche publique, nettoyée. Rend null si elle n'a rien de montrable (ni
// titre ni photo) ou si elle est trop lourde. Tout champ inconnu est perdu.
export function nettoyerFiche(brut) {
  const b = brut && typeof brut === 'object' && !Array.isArray(brut) ? brut : {};
  const photos = [];
  for (const u of (Array.isArray(b.photos) ? b.photos : []).slice(0, 30)) { const p = photoPublique(u); if (p && !photos.includes(p)) photos.push(p); if (photos.length >= MAX_PHOTOS) break; }
  const liens = [];
  for (const l of (Array.isArray(b.liens) ? b.liens : []).slice(0, 12)) {
    const site = l && SITES.includes(l.site) ? l.site : '';
    const url = site ? lienPublic(site, l.url) : '';
    if (url && !liens.some((x) => x.url === url) && liens.filter((x) => x.site === site).length < 2) liens.push({ site, url });
  }
  liens.sort((a, c) => SITES.indexOf(a.site) - SITES.indexOf(c.site));
  const f = {
    titre: str(b.titre, 120), marque: str(b.marque, 60), taille: str(b.taille, 40), etat: str(b.etat, 60),
    prix: prixPublic(b.prix, b.devise), photos, liens,
  };
  const pseudo = str(b.pseudo, 40);
  if (pseudo && /^[\p{L}\p{N}._ -]+$/u.test(pseudo)) f.pseudo = pseudo;
  if (!f.titre && !photos.length) return null;
  if (JSON.stringify(f).length > MAX_OCTETS_FICHE) return null;
  return f;
}

// L'identité PRIVÉE (jamais servie) : l'annonce Vinted, son compte, le N°.
export function nettoyerIdent(brut) {
  const b = brut && typeof brut === 'object' ? brut : {};
  const o = {};
  if (/^\d{1,15}$/.test(String(b.itemId || ''))) o.itemId = String(b.itemId);
  if (/^\d{1,15}$/.test(String(b.compte || ''))) o.compte = String(b.compte);
  const n = str(b.num, 12);
  if (/^[A-Za-z]?\d{1,6}$/.test(n)) o.num = n;
  return o;
}

// La fiche depuis une annonce Vinted de l'app (forme de `mapWardrobeItem`).
// `photos` : la galerie déjà connue (src/visionneuse.js) ; `liens` : les autres
// sites où CE N° est en ligne, PAR IDENTITÉ (`sitesDuNumero`) ; `pseudo` : le
// login du compte, envoyé seulement si `montrerPseudo`.
export function ficheDepuisAnnonce(it, { photos = [], liens = [], pseudo = '', montrerPseudo = false, sitesVoulus = null } = {}) {
  const a = it && typeof it === 'object' ? it : {};
  const ph = [...(Array.isArray(photos) ? photos : []), typeof a.photo === 'string' ? a.photo : (a.photo && a.photo.url) || ''];
  const tous = [];
  if (a.id != null && /^\d+$/.test(String(a.id))) tous.push({ site: 'vinted', url: lienPublic('vinted', a.url) || `https://www.vinted.fr/items/${a.id}` });
  for (const l of (Array.isArray(liens) ? liens : [])) if (l && l.site !== 'vinted') tous.push({ site: l.site, url: l.lien || l.url });
  return {
    titre: a.title || a.brand || '', marque: a.brand || '', taille: a.size || '', etat: a.condition || '',
    prix: a.price, devise: a.currency || 'EUR',
    photos: ph.filter(Boolean),
    liens: tous.filter((l) => !sitesVoulus || sitesVoulus.has(l.site)),
    pseudo: montrerPseudo ? pseudo : '',
  };
}

// Ce que dit la page. `p` = la ligne projetée { jeton, fiche, expire, vendu, maj, verifie }.
//   { etat: 'absent' }   — inconnu, arrêté, expiré : la MÊME réponse (aucune énumération)
//   { etat: 'vendu', fiche, date }
//   { etat: 'actif', fiche, date, perime }
// `date` = la dernière fois que l'app a CONFIRMÉ l'état (jamais l'heure de la page).
export function etatPage(p, maintenant = Date.now()) {
  if (!p || !p.fiche || typeof p.fiche !== 'object') return { etat: 'absent' };
  const exp = Date.parse(p.expire || '');
  if (!Number.isFinite(exp) || exp <= maintenant) return { etat: 'absent' };
  const fiche = nettoyerFiche(p.fiche);
  if (!fiche) return { etat: 'absent' };
  const dates = [Date.parse(p.maj || ''), Date.parse(p.verifie || '')].filter(Number.isFinite);
  const date = dates.length ? Math.max(...dates) : null;
  if (p.vendu === true || p.vendu === 'true') return { etat: 'vendu', fiche, date };
  return { etat: 'actif', fiche, date, perime: date == null || maintenant - date > PERIME_MS };
}

// LA SYNCHRO, sur ce que l'app SAIT (§5) : jamais une vente déduite d'une absence.
//   partages   [{ ligne, ident, vendu, venduPar, verifie, expire, prix }]
//   vendusIds  Set des annonces Vinted PROUVÉES vendues (`annoncesVendues`) — null = pas su
//   vendusNums Set des N° (cleNum) prouvés vendus — null = pas su
//   enLigne    Map id → { price, currency } des annonces EN LIGNE (lecture complète) — null = pas su
// Rend [{ ligne, etat: 'vendu'|'dispo', prix? }].
export function decisionsSynchro(partages, { vendusIds = null, vendusNums = null, enLigne = null, cleNum = (x) => String(x || '').toUpperCase() } = {}, maintenant = Date.now()) {
  const out = [];
  if (!vendusIds && !vendusNums) return out;   // ventes pas lues : rien à dire
  for (const p of Array.isArray(partages) ? partages : []) {
    if (!p || !RE_LIGNE.test(String(p.ligne || '')) || !(Date.parse(p.expire || '') > maintenant)) continue;
    const id = p.ident && p.ident.itemId ? String(p.ident.itemId) : '';
    const num = p.ident && p.ident.num ? cleNum(p.ident.num) : '';
    const vendu = (id && vendusIds && vendusIds.has(id)) || (num && vendusNums && vendusNums.has(num));
    const enL = id && enLigne ? enLigne.get(id) : null;
    if (vendu) { if (!p.vendu) out.push({ ligne: p.ligne, etat: 'vendu' }); continue; }
    if (!enL) continue;                                       // pas en ligne, ou pas su : on ne dit rien
    // Une vente annulée revenue en ligne : la preuve était la nôtre, on la retire.
    if (p.vendu && p.venduPar !== 'preuve') continue;
    const prix = prixPublic(enL.price, enL.currency);
    const vieux = !(Date.parse(p.verifie || '') > maintenant - VERIF_MIN_MS);
    const prixChange = prix != null && p.prix != null && Math.round(prix * 100) !== Math.round(Number(p.prix) * 100);
    if (p.vendu || vieux || prixChange) out.push({ ligne: p.ligne, etat: 'dispo', ...(prix != null ? { prix } : {}) });
  }
  return out;
}

// Une date à la française, à Paris : « 11 nov. à 14 h 05 ».
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
export function dateCourte(ms, avecHeure = true) {
  if (!Number.isFinite(ms)) return '';
  const f = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const o = Object.fromEntries(f.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  const j = `${Number(o.day)} ${MOIS[Number(o.month) - 1]}`;
  return avecHeure ? `${j} à ${Number(o.hour)} h ${o.minute}` : j;
}
export const prixTexte = (n) => (n == null ? '' : new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: Number.isInteger(n) ? 0 : 2 }).format(n));
