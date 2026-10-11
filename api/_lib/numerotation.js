// ════════════════════════════════════════════════════════════════════════════
//  LA REMISE À ZÉRO DES NUMÉROS, LUE PAR LE SERVEUR (migration 013)
//
//  Julien, 9 et 10 octobre : ses anciens numéros passent en « B » (B1, B230…)
//  et ne servent plus qu'à l'HISTOIRE (ventes, compta, bordereaux) ; chaque
//  annonce republiée après la coupure reçoit un NOUVEAU numéro 1, 2, 3… Un
//  ancien numéro ne se redonne JAMAIS — ni « B230 », ni « 230 ».
//
//  La migration pose dans `main` un marqueur `vrm_numerotation`
//  = { version, coupure, appliqueLe, archive, renum, lbcAnnonces, ebayAnnonces,
//      annule? } que seul le serveur écrit. Ce fichier ne fait que le LIRE.
//
//  Deux lecteurs serveur en ont besoin :
//   • `api/email-inbound` : le N° qu'il tirait du « nXXX » d'un TITRE est,
//     après la coupure, une ressemblance qui peut porter l'ANCIEN numéro (une
//     paire republiée sous le même titre « … n230 »). Il n'est gardé que s'il
//     désigne une fiche actuelle de la nouvelle série AU MÊME TITRE ; sinon il
//     part dans `numeroTitre` (gardé, jamais tamponné). La même règle que
//     `numeroEmailAdmis` dans l'app (§11).
//   • `api/ebay` (retrait automatique) : le SKU « VRM-230 » d'une annonce eBay
//     qui le portait à la coupure désigne la B230, pas la nouvelle 230.
//
//  Fonctions PURES (sauf `lireMarqueur`) : `audit-numerotation-serveur.cjs`
//  les exécute, et compare `cleNum` à celui de l'app.
// ════════════════════════════════════════════════════════════════════════════

export const cleNum = (v) => {
  let s = String(v == null ? '' : v).trim().toUpperCase().replace(/[\s\-_.]/g, '');
  if (/^\d+$/.test(s)) s = String(parseInt(s, 10));
  return s;
};
const normTitre = (t) => String(t || '').toLowerCase().replace(/\s+/g, ' ').trim();

// La lettre des anciens numéros, ou '' (aucune coupure, retour arrière,
// marqueur illisible ou de forme inconnue).
export function archiveDe(mk) {
  if (!mk || typeof mk !== 'object' || Array.isArray(mk) || mk.annule) return '';
  const a = String(mk.archive || '');
  return /^[A-Z]{1,3}$/.test(a) ? a : '';
}
export const estArchive = (num, arch) => !!arch && new RegExp('^' + arch + '\\d+(\\+' + arch + '\\d+)*$').test(cleNum(num));

// Un numéro LU sur une annonce d'une autre plateforme (SKU eBay, référence
// Leboncoin) : celle qui le portait à la coupure (son IDENTIFIANT est dans la
// liste du marqueur), ou une commande passée avant la coupure, parle de
// l'ANCIENNE série. Jamais par le titre (§5).
// Le marqueur garde, PAR ANNONCE, chaque numéro qu'elle portait à la coupure et
// ce qu'il devient ({ "<id>": { "553": "1", "12": "B12" } }) : un numéro donné
// après la coupure suit sa nouvelle paire, et une annonce dont le numéro a été
// réécrit APRÈS (reliée à une nouvelle paire) se lit telle quelle. La même règle
// que `traductionAnnonce` / `numeroExterne` dans l'app (§11).
export function traductionAnnonce(carte, id, k) {
  if (id == null || !carte || typeof carte !== 'object' || Array.isArray(carte)) return undefined;
  const e = carte[String(id)];
  if (!e || typeof e !== 'object' || Array.isArray(e) || !Object.prototype.hasOwnProperty.call(e, k)) return undefined;
  return typeof e[k] === 'string' ? cleNum(e[k]) : '';
}
export function numeroExterne(k, id, liste, dateMs, mk) {
  const arch = archiveDe(mk);
  const c = cleNum(k);
  if (!c || !arch || !/^\d+$/.test(c)) return c;
  const t = traductionAnnonce(mk[liste], id, c);
  if (t !== undefined) return t;
  const coupure = Date.parse(mk.coupure || '');
  const avant = dateMs != null && isFinite(dateMs) && isFinite(coupure) && dateMs < coupure;
  return avant ? cleNum(arch + c) : c;
}

// Le N° tiré du TITRE d'un email (bordereau, vente, finalisation), jugé.
//   mk     : le marqueur (`undefined` = pas su, `null` = aucun)
//   fiches : `vinted_annonce_numeros` (`undefined` = pas su)
// Rend { numero, numeroTitre } — `numeroTitre` garde le nombre lu quand il
// n'est pas retenu (rien n'est jeté, §5 : l'écran peut encore le montrer).
export function numeroDuTitreApresCoupure(numero, titre, mk, fiches) {
  const n = String(numero == null ? '' : numero).trim();
  if (!n) return { numero: '', numeroTitre: '' };
  if (mk === null) return { numero: n, numeroTitre: '' };              // aucune remise à zéro : comme avant
  if (mk !== undefined && !archiveDe(mk)) return { numero: n, numeroTitre: '' }; // annulée
  // Pas su (marqueur ou fiches illisibles) ⇒ on ne tamponne pas un nombre
  // qu'on ne peut pas vérifier : mieux vaut un blanc qu'un faux.
  if (mk === undefined || !fiches || typeof fiches !== 'object') return { numero: '', numeroTitre: n };
  const arch = archiveDe(mk);
  const k = cleNum(n);
  const t = normTitre(titre);
  const ok = !!k && !estArchive(k, arch) && !!t
    && Object.values(fiches).some((e) => e && cleNum(e.numero) === k && normTitre(e.title) === t);
  return ok ? { numero: n, numeroTitre: '' } : { numero: '', numeroTitre: n };
}

// Le marqueur de CE vendeur : `undefined` pas su · `null` absent · l'objet.
// `url` est déjà portée par le vendeur (filtre d'owner posé par l'appelant).
export async function lireMarqueur(url, headers) {
  try {
    const r = await fetch(url, { headers });
    if (!r.ok) return undefined;
    const rows = await r.json();
    if (!Array.isArray(rows)) return undefined;
    const v = rows[0] ? rows[0].mk : null;
    if (v == null) return null;
    if (typeof v === 'string') { try { const o = JSON.parse(v); return o && typeof o === 'object' ? o : undefined; } catch (_) { return undefined; } }
    return typeof v === 'object' && !Array.isArray(v) ? v : undefined;
  } catch (_) { return undefined; }
}
