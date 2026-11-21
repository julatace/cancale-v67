// ════════════════════════════════════════════════════════════════════════════
//  SCANNER POUR DÉPOSER (3 nov., choix de Julien n° 1)
//  Au relais, il scanne le code-barres du bordereau : VRM retrouve le colis PAR
//  SON N° DE SUIVI, exactement (§5 : jamais un titre, jamais une ressemblance),
//  et pose « Déposé » — le geste existant (`marquerColisFait`, annulable 5 s).
//
//  Ce que contient un code-barres de bordereau — MESURÉ (lecture seule, deux
//  vrais bordereaux de sa base, lus par zbar, 3 nov.) :
//   · InPost / Mondial Relay : Code 128 à 26 chiffres « 56 82579787 0101… »,
//     le n° d'expédition imprimé (« N° Expédition V2 82579787 ») est aux
//     chiffres 3 à 10 ;
//   · Vinted (Hermes) : Code 128 à 26 chiffres « 55 15193563 0101… », le n°
//     imprimé (« V1 15193563 ») aux chiffres 3 à 10 ; un 2ᵉ code « H1004… ».
//   · Chronopost (2 lettres + 9 chiffres + 2 lettres) : PAS mesuré — le n° lui-
//     même, ou le n° posé dans un code plus long (une seule occurrence).
//  Chaque lecture donne une LISTE FERMÉE de n° possibles (la valeur brute, et
//  ce que la FORME ci-dessus désigne) ; un colis n'est trouvé que si UN SEUL
//  colis porte exactement l'un d'eux. Deux colis ⇒ rien n'est écrit.
// ════════════════════════════════════════════════════════════════════════════

// Un n° de suivi sous sa forme comparable : majuscules, lettres et chiffres.
export const normaliserN = (s) => String(s == null ? '' : s).toUpperCase().replace(/[^A-Z0-9]/g, '');

// Les n° qu'une lecture DÉSIGNE (jamais une approximation : des formes fixes).
export function candidatsDuScan(brut) {
  const s = normaliserN(brut);
  const out = [];
  const ajoute = (x) => { if (x && x.length >= 8 && !out.includes(x)) out.push(x); };
  if (!s) return out;
  ajoute(s);
  // 26 chiffres (InPost, Mondial Relay, Vinted/Hermes) : le n° d'expédition imprimé.
  if (/^\d{26}$/.test(s)) ajoute(s.slice(2, 10));
  // Un n° Chronopost posé dans un code plus long : retenu s'il n'y en a qu'UN.
  const chrono = s.match(/[A-Z]{2}\d{9}[A-Z]{2}/g) || [];
  if (chrono.length === 1) ajoute(chrono[0]);
  return out;
}

// (9 nov., lot V) AU RETRAIT d'un ACHAT, l'étiquette peut porter le n° de suivi OU le
// code de retrait (souvent 6 caractères) : la valeur brute est retenue dès 4 caractères,
// en plus des formes ci-dessus. Toujours une égalité EXACTE ensuite (un code de retrait
// n'existe que pour UN colis, §5).
export function candidatsRetrait(brut) {
  const out = candidatsDuScan(brut);
  const s = normaliserN(brut);
  if (s && s.length >= 4 && !out.includes(s)) out.push(s);
  return out;
}

// `colis` : [{ cle, suivis: [n°…], deja: bool, sansVente?: bool, … }]. Rend
//  · { etat: 'trouve', colis }   un seul colis, pas encore déposé ;
//  · { etat: 'deja', colis }     un seul colis, déjà déposé / parti ;
//  · { etat: 'ambigu', colis: [..] }  plusieurs colis portent ce n° ⇒ rien ;
//  · { etat: 'inconnu' }         aucun colis ne porte ce n° ⇒ rien ;
//  · { etat: 'sansVente', colis } un seul colis, mais son bordereau n'est relié à
//                                 AUCUNE vente (pas de paire à montrer) ⇒ rien ;
//  · { etat: 'vide' }            lecture vide.
// `candidats` : la règle des n° qu'une lecture désigne (`candidatsRetrait` aux achats).
export function trouverParScan(brut, colis, { candidats = candidatsDuScan } = {}) {
  const cands = candidats(brut);
  if (!cands.length) return { etat: 'vide', candidats: cands };
  const parCle = new Map();
  for (const c of (Array.isArray(colis) ? colis : [])) {
    if (!c || c.cle == null) continue;
    const ns = (Array.isArray(c.suivis) ? c.suivis : []).map(normaliserN).filter(Boolean);
    if (ns.some((n) => cands.includes(n))) parCle.set(String(c.cle), c);
  }
  const L = [...parCle.values()];
  if (!L.length) return { etat: 'inconnu', candidats: cands };
  if (L.length > 1) return { etat: 'ambigu', colis: L, candidats: cands };
  if (L[0].deja) return { etat: 'deja', colis: L[0], candidats: cands };
  if (L[0].sansVente) return { etat: 'sansVente', colis: L[0], candidats: cands };
  return { etat: 'trouve', colis: L[0], candidats: cands };
}

// Une même lecture répétée par la caméra (le code reste dans le cadre) ne
// compte qu'une fois pendant `ms`.
export function filtreRepetition(ms = 2500) {
  let dernier = '', at = 0;
  return (brut, maintenant = Date.now()) => {
    const s = normaliserN(brut);
    if (!s) return false;
    if (s === dernier && maintenant - at < ms) return false;
    dernier = s; at = maintenant; return true;
  };
}

// ════════════════════════════════════════════════════════════════════════════
//  SCANNER POUR RETROUVER (15 nov., Julien : « tu scannes le code-barres d'un
//  colis reçu ou d'un bordereau, et VRM ouvre directement la bonne vente ou le
//  bon achat, grâce au numéro de suivi. Zéro recherche. »)
//  Récit, sources et mesures : docs/passation/2026-11-15-scanner-colis.md.
//
//  `lireCodeColis(brut)` : CE QUE CONTIENT un code-barres ⇒ { transporteur, nom,
//  suivi, forme, sansCle? } — le n° de suivi CANONIQUE (lettres et chiffres,
//  majuscules : la forme de `normaliserSuivi`) — ou null (« pas reconnu »).
//  Chaque forme est DOCUMENTÉE (spécification publique) ou MESURÉE (lecture seule de
//  la base, formes des n° rangés, jamais une valeur) ; une forme ni documentée ni
//  mesurée n'est pas reconnue. Aucune approximation : un code désigne UN n°, par
//  position fixe ou par une clé de contrôle vérifiée.
//
//  `retrouverParSuivi(lu, enregistrements)` : les enregistrements (ventes, achats,
//  retours, colis des autres sites) qui portent EXACTEMENT ce n° (§5 : « même avec
//  50 articles identiques, tu ne dois pas pouvoir te tromper »). Un ⇒ sa fiche ;
//  plusieurs ⇒ la liste courte (il choisit) ; aucun ⇒ dit. Jamais un titre, jamais
//  un n° « voisin », jamais un n° qui CONTIENT l'autre.
// ════════════════════════════════════════════════════════════════════════════

// Les transporteurs que le scanner sait nommer (le nom est une donnée : jamais traduit).
export const NOMS_TRANSPORTEURS = Object.freeze({
  mondialrelay: 'Mondial Relay', vinted: 'Vinted Go', chronopost: 'Chronopost', colissimo: 'Colissimo',
  postal: 'Envoi postal (S10)', dpd: 'DPD · Pickup', ups: 'UPS',
});

// UPU S10 (n° postal international, 13 caractères : 2 lettres de service, 8 chiffres,
// 1 chiffre de contrôle, 2 lettres de pays). Poids 8 6 4 2 3 5 9 7, 11 − (somme mod 11),
// 10 ⇒ 0, 11 ⇒ 5. MESURÉ (15 nov.) : 187 n° Chronopost rangés sur 187 la vérifient.
const POIDS_S10 = [8, 6, 4, 2, 3, 5, 9, 7];
export function cleS10(huit) {
  const s = String(huit || '');
  if (!/^\d{8}$/.test(s)) return null;
  let t = 0; for (let i = 0; i < 8; i++) t += Number(s[i]) * POIDS_S10[i];
  const c = 11 - (t % 11);
  return c === 10 ? 0 : c === 11 ? 5 : c;
}
export const s10Valide = (n) => {
  const m = /^[A-Z]{2}(\d{8})(\d)[A-Z]{2}$/.exec(String(n || ''));
  return !!m && cleS10(m[1]) === Number(m[2]);
};
// Chronopost : préfixes et suffixes MESURÉS sur ses n° rangés (XW…TS, ZW…TS, XW…SP, XU…JF, ZU…JF, XW…JF).
const FORME_CHRONO_S10 = /^[XZ][WU]\d{9}(?:TS|SP|JF)$/;
const transporteurS10 = (n) => (FORME_CHRONO_S10.test(n) ? 'chronopost' : 'postal');

// Les formes d'un n° SEUL (la valeur entière du code), de la plus sûre à la moins sûre.
// `transporteur: null` : la forme est mesurée chez plusieurs transporteurs (on ne devine pas lequel).
const FORMES_SEULES = [
  // S10, clé vérifiée (Chronopost, La Poste international…).
  { forme: 's10', re: /^[A-Z]{2}\d{9}[A-Z]{2}$/, ok: s10Valide, tr: transporteurS10 },
  // Colissimo national : « un chiffre de 6 à 9, une lettre, 11 chiffres » (CDC WebService Tracking Colissimo).
  { forme: 'colissimo', re: /^[6-9][A-Z]\d{11}$/, tr: () => 'colissimo' },
  // UPS : « 1Z » + 16 lettres ou chiffres (n° de suivi UPS, forme publique).
  { forme: 'ups', re: /^1Z[0-9A-Z]{16}$/, tr: () => 'ups' },
  // Vinted Go, MESURÉS : « VGS » + 13 chiffres ; « 1UW1T3 » + 7 (n° Vinted Go international).
  { forme: 'vinted-vgs', re: /^VGS\d{13}$/, tr: () => 'vinted' },
  { forme: 'vinted-1uw', re: /^1UW1T3[A-Z0-9]{7}$/, tr: () => 'vinted' },
  // Mondial Relay, MESURÉ : 8 chiffres (316 n° rangés).
  { forme: 'mondialrelay', re: /^\d{8}$/, tr: () => 'mondialrelay' },
  // MESURÉS sans transporteur certain : 12, 14, 15, 16 chiffres (Vinted Go, Chronopost Pickup, DPD,
  // SEUR, BRT).
  { forme: 'chiffres', re: /^(?:\d{12}|\d{14}|\d{15}|\d{16})$/, tr: () => null },
  // MESURÉS chez Chronopost : 14 chiffres + 1 lettre ; 2 lettres + 12 chiffres + 1 lettre (lien Leboncoin).
  { forme: 'chrono-15', re: /^(?:\d{14}[A-Z]|[A-Z]{2}\d{12}[A-Z])$/, tr: () => 'chronopost' },
];
function formeSeule(s) {
  for (const f of FORMES_SEULES) if (f.re.test(s) && (!f.ok || f.ok(s))) return { forme: f.forme, transporteur: f.tr(s) };
  return null;
}
const resultat = (transporteur, suivi, forme, extra = {}) => ({ transporteur: transporteur || null, nom: transporteur ? NOMS_TRANSPORTEURS[transporteur] || null : null, suivi, forme, ...extra });

// Le contenu d'un code-barres ⇒ { transporteur, nom, suivi, forme, sansCle? } ou null.
export function lireCodeColis(brut) {
  const texte = String(brut == null ? '' : brut).trim();
  if (!texte || texte.length > 600) return null;
  // 1. UN LIEN (QR) : seulement les liens de suivi MESURÉS (lbc_ventes, 15 nov.), le n° dans SON paramètre.
  if (/^https?:\/\//i.test(texte)) {
    let u = null; try { u = new URL(texte); } catch (_) { return null; }
    const h = u.hostname.toLowerCase();
    const q = (k) => { for (const [a, b] of u.searchParams) if (a.toLowerCase() === k) return b; return null; };
    if (/(^|\.)mondialrelay\.(?:com|fr)$/.test(h)) { const n = normaliserN(q('exp')); return /^\d{8}$/.test(n) ? resultat('mondialrelay', n, 'lien-mondialrelay') : null; }
    if (/(^|\.)chronopost\.fr$/.test(h)) {
      const v = String(q('listenumeroslt') || ''); if (/[,;]/.test(v)) return null;
      const n = normaliserN(v); return n && formeSeule(n) ? resultat('chronopost', n, 'lien-chronopost') : null;
    }
    return null;
  }
  // 2. UN MESSAGE NORME ISO/IEC 15434 (« [)> », QR / DataMatrix / PDF417 / MaxiCode) : ses champs sont
  //    séparés par GS (0x1D). UN SEUL champ d'une forme distinctive (S10 à clé juste, Colissimo, UPS,
  //    Vinted Go) ⇒ ce n°. Aucun, ou deux ⇒ rien (un champ de chiffres seuls ne se devine pas).
  if (texte.startsWith('[)>')) {
    const vus = new Map();
    for (const champ of texte.split(/[\x1d\x1e\x04]/)) {
      const n = normaliserN(champ); const f = n.length >= 8 ? formeSeule(n) : null;
      if (f && f.forme !== 'chiffres' && f.forme !== 'mondialrelay') vus.set(n, f);
    }
    if (vus.size !== 1) return null;
    const [[n, f]] = [...vus];
    return resultat(f.transporteur, n, 'iso15434-' + f.forme);
  }
  const compact = texte.toUpperCase().replace(/[\s ]+/g, '');
  // 3. GEOLABEL (DPD, Colissimo, réseau Pickup) : Code 128 de 28 caractères, « % » + code postal de
  //    destination (7) + n° de colis (14) + code service (3) + pays ISO 3166 numérique (3).
  //    Colissimo : chiffres 9-10 = « 11 », 11-12 = code produit (1 chiffre + 1 lettre), 13-22 = identifiant ;
  //    l'ID13 imprimé = code produit + identifiant + SA clé de contrôle (note GeoLabel national, La Poste) :
  //    on le compare sans sa clé (`sansCle`), jamais autre chose.
  const geo = /^%([0-9A-Z]{7})([0-9A-Z]{14})(\d{3})(\d{3})$/.exec(compact);
  if (geo) {
    const p = geo[2];
    if (/^11\d[A-Z]\d{10}$/.test(p)) return resultat('colissimo', p.slice(2), 'geolabel-colissimo', { sansCle: true });
    if (/^\d{14}$/.test(p)) return resultat('dpd', p, 'geolabel');
    return null;
  }
  // Au-delà : seulement des lettres et des chiffres (espaces, tirets et points d'une saisie à la main
  // ôtés). Un autre signe (« % » d'un GeoLabel mal lu, « / », « : »…) ⇒ pas reconnu, jamais « nettoyé ».
  const s = compact.replace(/[-.]/g, '');
  if (!/^[A-Z0-9]+$/.test(s)) return null;
  // 4. MONDIAL RELAY (et InPost, Vinted sur son réseau) : Code 128 (ou ITF) de 26 chiffres (spécification
  //    des étiquettes Mondial Relay v2.4 : 26 caractères, 2 de marque en tête) ; le n° d'expédition imprimé
  //    = chiffres 3 à 10 (MESURÉ : bordereaux InPost « 56… » et Vinted « 55… », le n° de l'e-mail).
  //    (17 nov., lot scan-bordereau-vente) MESURÉ sur son bordereau Mondial Relay du 16 nov. : « 55… » aussi
  //    (l'e-mail et l'étiquette disent Mondial Relay) — « 55 » n'est pas « Vinted Go ». Le n° est celui de Mondial Relay.
  if (/^\d{26}$/.test(s)) return resultat('mondialrelay', s.slice(2, 10), 'mr26');
  // 5. LE N° SEUL.
  const f = formeSeule(s);
  if (f) return resultat(f.transporteur, s, f.forme);
  // 6. UN S10 POSÉ DANS UN CODE PLUS LONG (étiquette Chronopost : forme du code pas mesurée) : retenu
  //    seulement s'il y en a UN, clé de contrôle vérifiée. Deux, ou une clé fausse ⇒ rien.
  if (s.length > 13 && s.length <= 64) {
    const trouves = new Set();
    for (let i = 0; i + 13 <= s.length; i++) { const x = s.slice(i, i + 13); if (/^[A-Z]{2}\d{9}[A-Z]{2}$/.test(x) && s10Valide(x)) trouves.add(x); }
    if (trouves.size === 1) { const [x] = [...trouves]; return resultat(transporteurS10(x), x, 's10-dans-code'); }
  }
  return null;
}

// Le n° d'un enregistrement porte-t-il CE qui a été lu ? Égalité exacte ; l'ID13 Colissimo
// lu sur un GeoLabel (sans sa clé) répond à l'ID13 rangé dont il est le début EXACT
// (12 caractères fixes + 1 clé calculée sur eux : jamais deux ID13 au même début).
export function suiviCorrespond(lu, n) {
  if (!lu || !lu.suivi) return false;
  const s = normaliserN(n);
  if (!s) return false;
  // Lu sans sa clé : seul un ID13 complet répond (le début lu n'est pas, à lui seul, un n° de suivi).
  if (lu.sansCle) return /^[6-9][A-Z]\d{11}$/.test(s) && s.slice(0, 12) === lu.suivi;
  return s === lu.suivi;
}

// `enregistrements` : [{ sorte: 'vente'|'achat'|'retour'|'colis'…, cle, suivis: [n°…], … }].
// Rend { etat: 'pasReconnu' } · { etat: 'aucun', lu } · { etat: 'un', lu, trouve } ·
// { etat: 'plusieurs', lu, trouves } — un même enregistrement (sorte + clé) ne compte qu'une fois.
export function retrouverParSuivi(lu, enregistrements) {
  if (!lu || !lu.suivi) return { etat: 'pasReconnu' };
  const parCle = new Map();
  for (const r of (Array.isArray(enregistrements) ? enregistrements : [])) {
    if (!r || r.cle == null) continue;
    const ns = Array.isArray(r.suivis) ? r.suivis : [];
    if (ns.some((n) => suiviCorrespond(lu, n))) { const k = `${r.sorte || ''}:${r.cle}`; if (!parCle.has(k)) parCle.set(k, r); }
  }
  const L = [...parCle.values()];
  if (!L.length) return { etat: 'aucun', lu };
  if (L.length > 1) return { etat: 'plusieurs', lu, trouves: L };
  return { etat: 'un', lu, trouve: L[0] };
}

// Lu au scan ⇒ le résultat (la lecture et la recherche, une fois).
export const retrouverColis = (brut, enregistrements) => retrouverParSuivi(lireCodeColis(brut), enregistrements);
