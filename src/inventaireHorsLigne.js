// ════════════════════════════════════════════════════════════════════════════
//  L'INVENTAIRE HORS CONNEXION (9 nov. 2026, demande de Julien : « fais tout »)
// ════════════════════════════════════════════════════════════════════════════
// Dans sa cave, son garage, sans réseau : il fait le tour de ses cartons quand
// même. L'attendu (les paires que VRM croit chez lui) ne peut pas être relu
// sans réseau — on garde donc, PAR VENDEUR et sur l'appareil, la DERNIÈRE liste
// que le Stock a calculée en ligne (`figerAttendu`), avec son heure. Hors
// connexion, l'inventaire juge les N° contre CETTE liste et le dit
// (« liste des paires du 9 nov. à 14:02 ») — jamais une liste présentée comme
// fraîche (§5).
//
// Trois règles, comme la photo de Ma journée (src/journeeHorsLigne.js) :
//   · la liste n'est figée que quand le Stock l'a LUE (`stock.su`) : une liste
//     « pas su » n'est pas gardée (elle dirait « manque » à tort, ou rien) ;
//     ce que le Stock dit « pas lu » (`manque`, NOMMÉ) est gardé tel quel ;
//   · elle appartient à UN vendeur : la clé porte son identifiant ET la liste le
//     répète ; un autre n'est jamais servi. Elle part avec la déconnexion
//     (`wipeLocalData` efface tout `vrm_*`) ;
//   · AUCUN NUMÉRO N'EST CHANGÉ : ce module ne lit et n'écrit que sa clé.
//     L'inventaire fait hors connexion est une suite de SAISIES gardées sur
//     l'appareil (`vrm_inventaire_local_{uid}`), envoyées par la règle normale
//     (lire-fusionner-réécrire sur `rev`, src/inventaire.js) au retour du réseau.
//
// Pur (aucun React, aucun réseau) : `scripts/audit-inventaire-hors-ligne.cjs`
// l'exécute.

export const VERSION_ATTENDU = 1;
export const PREFIXE_ATTENDU = 'vrm_hl_inventaire_';
// Le drapeau « des saisies attendent d'être envoyées » (posé par l'écran quand
// l'écriture n'a pas abouti, retiré quand la ligne a accepté) : l'app le relit
// au retour du réseau pour envoyer l'inventaire même si la feuille est fermée.
export const PREFIXE_ATTENTE = 'vrm_inventaire_attente_';
const MAX_ARTICLES = 3000;

export const cleAttendu = (uid) => PREFIXE_ATTENDU + String(uid || '');
export const cleAttente = (uid) => PREFIXE_ATTENTE + String(uid || '');
const uidValide = (uid) => typeof uid === 'string' && uid.length > 0 && uid.length <= 80 && !/\s/.test(uid);
const estObjet = (o) => !!o && typeof o === 'object' && !Array.isArray(o);
const txt = (v, n = 90) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);
const liste = (s) => (s && typeof s.has === 'function' && typeof s[Symbol.iterator] === 'function' ? [...s].map(String) : null);

// Fige l'attendu du Stock (la forme que reçoit `InventaireStock`, src/inventaire.js §1).
//   `fichesCles` : les N° qui ont une fiche numérotée (la question `jugeable` dépend
//   de leur compte) ; `jugeable` est rejouée ICI, pour chacun d'eux, et une fois pour
//   un N° inconnu — la liste figée ne garde que les réponses, jamais une règle.
//   `meubles` : la forme des meubles (case par case hors connexion).
//   `noms` : { [uid de compte]: nom } — pour nommer « pas lu : X ».
export function figerAttendu({ uid, at, stock, fichesCles = [], meubles = [], noms = {} } = {}) {
  if (!uidValide(uid) || !Number.isFinite(at) || !estObjet(stock) || !stock.su) return null;
  const jug = typeof stock.jugeable === 'function' ? stock.jugeable : () => false;
  const fiches = {};
  for (const k of new Set((Array.isArray(fichesCles) ? fichesCles : []).map(String))) { if (k) { let v = false; try { v = !!jug(k); } catch (_) {} fiches[k] = v ? 1 : 0; } }
  let jugeableInconnu = false; try { jugeableInconnu = !!jug('\u0000inconnu'); } catch (_) {}
  const articles = (Array.isArray(stock.articles) ? stock.articles : []).slice(0, MAX_ARTICLES).map((a) => ({
    cle: txt(a && a.cle, 16), numero: txt(a && a.numero, 16), titre: txt(a && a.titre),
    etat: a && (a.etat === 'aconfirmer' || a.etat === 'masquee') ? a.etat : 'enligne',
    plateformes: (Array.isArray(a && a.plateformes) ? a.plateformes : []).map((x) => txt(x, 16)).slice(0, 4),
    comptes: (Array.isArray(a && a.comptes) ? a.comptes : []).map((x) => txt(x, 40)).slice(0, 6),
    ...(Array.isArray(a && a.aussi) && a.aussi.length ? { aussi: a.aussi.map((x) => txt(x, 16)).slice(0, 6) } : {}),
  }));
  const gardees = {};
  for (const [k, g] of Object.entries(estObjet(stock.gardees) ? stock.gardees : {})) gardees[k] = { numero: txt(g && g.numero, 16), titre: txt(g && g.titre) };
  const slots = {};
  for (const [k, sl] of Object.entries(estObjet(stock.slots) ? stock.slots : {})) if (sl && sl.m != null) slots[k] = { m: String(sl.m), i: Number(sl.i) || 0 };
  const garder = {};
  for (const [k, v] of Object.entries(estObjet(stock.garder) ? stock.garder : {})) if (v) garder[k] = Number(v) || 1;
  return {
    v: VERSION_ATTENDU, uid, at, su: true,
    articles, nArticles: Array.isArray(stock.articles) ? stock.articles.length : 0,
    manque: (Array.isArray(stock.manque) ? stock.manque : []).map((m) => ({ nom: txt(m && m.nom, 60), plateforme: txt(m && m.plateforme, 16), raison: txt(m && m.raison, 80) })).slice(0, 20),
    vendus: liste(stock.vendus), physiques: liste(stock.physiques), connues: liste(stock.connues), doublons: liste(stock.doublons),
    garder, gardees, slots, fiches, jugeableInconnu, archive: txt(stock.archive, 3),
    meubles: (Array.isArray(meubles) ? meubles : []).slice(0, 40).map((m) => ({ id: String(m && m.id), name: txt(m && m.name, 40), cols: Number(m && m.cols) || 1, rows: Number(m && m.rows) || 1 })),
    noms: Object.fromEntries(Object.entries(estObjet(noms) ? noms : {}).slice(0, 40).map(([k, v]) => [String(k), txt(v, 40)])),
  };
}

// Rend la liste figée sous la forme de l'attendu (Sets, `jugeable`) : la même
// entrée que l'inventaire en ligne — aucune règle recopiée.
export function degelerAttendu(f) {
  if (!estObjet(f) || f.v !== VERSION_ATTENDU || !f.su) return null;
  const ens = (l) => (Array.isArray(l) ? new Set(l.map(String)) : null);
  const fiches = estObjet(f.fiches) ? f.fiches : {};
  return {
    su: true, articles: Array.isArray(f.articles) ? f.articles : [], manque: Array.isArray(f.manque) ? f.manque : [],
    vendus: ens(f.vendus), physiques: ens(f.physiques), connues: ens(f.connues), doublons: ens(f.doublons),
    garder: estObjet(f.garder) ? f.garder : {}, gardees: estObjet(f.gardees) ? f.gardees : {}, slots: estObjet(f.slots) ? f.slots : {},
    archive: typeof f.archive === 'string' ? f.archive : '',
    jugeable: (k) => (Object.prototype.hasOwnProperty.call(fiches, String(k)) ? fiches[String(k)] === 1 : f.jugeableInconnu === true),
  };
}

// Même contenu (hors heure) : rien à réécrire, sauf si la liste a plus de 10 min
// (« liste des paires du … » doit suivre la dernière lecture réussie).
const sansHeure = (f) => JSON.stringify({ ...f, at: 0 });
export function ecrireAttendu(uid, f, stockage, maintenant = Date.now()) {
  try {
    if (!uidValide(uid) || !estObjet(f) || f.uid !== uid || f.v !== VERSION_ATTENDU) return false;
    const avant = lireAttendu(uid, stockage);
    if (avant && sansHeure(avant) === sansHeure(f) && maintenant - avant.at < 10 * 60000) return false;
    stockage.setItem(cleAttendu(uid), JSON.stringify(f));
    return true;
  } catch (_) { return false; }
}
// La liste de CE vendeur, ou null. La clé d'un autre n'est jamais lue ; un
// contenu qui nomme un autre vendeur est refusé.
export function lireAttendu(uid, stockage) {
  try {
    if (!uidValide(uid)) return null;
    const brut = stockage.getItem(cleAttendu(uid));
    if (!brut) return null;
    const f = JSON.parse(brut);
    if (!estObjet(f) || f.uid !== uid || f.v !== VERSION_ATTENDU || !Number.isFinite(f.at) || !f.su || !Array.isArray(f.articles)) return null;
    return f;
  } catch (_) { return null; }
}

// La vibration du retour immédiat (Android, Chrome ; l'iPhone l'ignore — rien
// n'en dépend : le mot et la couleur disent tout). Une forme par jugement :
// courte = attendu ; double = un geste à faire ; longue = deux paires sous un N°.
export function motifVibration(etat) {
  if (etat === 'attendu') return 18;
  if (etat === 'trop' || etat === 'vendu') return [40, 70, 40];
  if (etat === 'doublon') return [90, 60, 90, 60, 90];
  if (etat === 'illisible') return [25, 40, 25, 40, 25];
  return 30;   // pas su, déjà compté, annulé
}
