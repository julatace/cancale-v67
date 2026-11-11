// ══════════════════════════════════════════════════════════════════════════════
//  LA VEILLE DES CHIFFRES — LA RÈGLE (11 nov. 2026, lot agent2-veille)
//  Julien (validé) : « une alarme quand un chiffre important change d'un coup sans
//  raison » — le stock qui chute d'un relevé à l'autre, le CA d'un mois PASSÉ qui
//  baisse après coup, le nombre de ventes d'un mois passé qui diminue.
//
//  ⚠️ CE MODULE NE COMPTE RIEN LUI-MÊME (§5, un propriétaire par notion) : il range
//     des nombres déjà publiés —
//       · le stock en ligne sur Vinted : celui que la coque publie pour le widget
//         (`online`, complet seulement : une lecture ratée ou « à confirmer » ⇒ rien) ;
//       · le CA déclaré et le nombre de ventes par mois : `vinted_urssaf_mois.mois`,
//         publié par l'écran Ventes (la date de VERSEMENT, §5).
//     et ce qui EXPLIQUE une chute, compté par la coque au même moment : les ventes
//     faites et les suppressions CONSTATÉES (extension, `harvest_{uid}_supprimees`)
//     depuis le relevé précédent (avec une marge d'un jour : mieux vaut taire une
//     chute expliquée deux fois que sonner sur une chute expliquée).
//
//  LA LIGNE `vrm_veille_chiffres` (au nom du vendeur, dédiée, jamais dans `main`) :
//     { v, points: [{ j, at, s, c, v, x, d, m?, p?, e? }], alertes: [...], vus: {}, rev }
//       j  jour de Paris du relevé (un point par jour : le dernier relevé complet du jour)
//       s  stock en ligne (entier) · c  signature des comptes comptés (un nombre)
//       v  ventes faites depuis le relevé d'avant · x  suppressions constatées depuis
//       d  le jour du relevé d'avant auquel `v`/`x` se rapportent
//       m  { 'AAAA-MM': [ca, n, caAilleurs, nAilleurs] } — seulement quand il CHANGE
//       p  plateformes lues (bits) · e  signature des comptes sélectionnés (choix)
//     NOMBRES SEULS : aucun titre, aucun pseudo, aucun montant de vente.
//     Bornée : 90 jours de points, 20 alertes, 7 jours par alerte.
//
//  « PAS SU » NE SONNE JAMAIS : un stock absent, une explication pas comptée, des
//  comptes qui ont changé (un compte exclu, bloqué, ajouté : c'est un CHOIX ou une
//  lecture, pas une perte), une plateforme passée de « lue » à « pas lue » ⇒ aucune
//  alerte. Un CA qui bouge parce qu'une vente a été DÉCLARÉE ailleurs (registre
//  « J'ai déclaré ce mois », `nAilleurs`) est expliqué.
//  Module PUR : l'app (src/VeilleJournee.jsx, la coque), le serveur
//  (api/_lib/veille-chiffres.js) et scripts/audit-veille.cjs l'exécutent tels quels.
// ══════════════════════════════════════════════════════════════════════════════

export const CLE_VEILLE = 'vrm_veille_chiffres';
export const MEMO_VEILLE = 'veille_chiffres_dit';     // le mémo des notifications (écrit par le serveur seul)
export const CAT_VEILLE = 'veille';
export const JOURS_POINTS = 90;
export const ALERTES_MAX = 20;
export const ALERTE_VIE_MS = 7 * 864e5;
export const NOTIF_VIE_MS = 2 * 864e5;               // une alerte de plus de 2 jours ne sonne plus
export const SEUIL_PAIRES = 30;                      // « ≥ 30 paires » sans explication
export const SEUIL_PART = 0.2;                       // « ≥ 20 % » sans explication…
export const SEUIL_PART_MIN = 5;                     // …et au moins 5 paires (10 → 8 n'est pas une alarme)
export const SEUIL_CA = 1;                           // un mois passé qui perd 1 € ou plus
export const MARGE_EXPLICATION_MS = 864e5;           // ventes et suppressions comptées depuis la veille du relevé d'avant
export const PLATEFORMES_BITS = { Vinted: 1, Leboncoin: 2, eBay: 4, Vestiaire: 8 };

const objet = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : null);
const entier = (v) => (Number.isInteger(v) && v >= 0 ? v : null);
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const pl = (n, s, p) => (n > 1 ? p : s);

// Le jour de Paris (AAAA-MM-JJ) d'un instant.
export function jourDe(ms) {
  try { return new Date(ms).toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' }); } catch (_) { return new Date(ms).toISOString().slice(0, 10); }
}
const ecartJours = (j0, j1) => Math.round((Date.parse(j1 + 'T12:00:00Z') - Date.parse(j0 + 'T12:00:00Z')) / 864e5);
export const moisLisible = (ym) => { const m = /^(\d{4})-(\d{2})$/.exec(String(ym || '')); return m ? `${MOIS[Number(m[2]) - 1]} ${m[1]}` : String(ym || ''); };
const jourLisible = (j) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(j || '')); return m ? `${Number(m[3])} ${MOIS[Number(m[2]) - 1]}` : String(j || ''); };
const euros = (x) => `${Math.round(Number(x) || 0).toLocaleString('fr-FR')} €`;

// Une signature courte et stable d'une liste (FNV-1a) : les comptes comptés, les
// comptes sélectionnés. Un NOMBRE (rien de lisible ne part).
export function signature(liste) {
  const t = JSON.stringify((Array.isArray(liste) ? liste : []).map(String).sort());
  let h = 0x811c9dc5;
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h;
}

// ── LE RELEVÉ DU JOUR ───────────────────────────────────────────────────────────
// Ce que la coque sait au moment de publier. Tout ce qui n'est pas su reste `null`.
//   stock      : entier (le nombre complet publié pour le widget) ou null
//   comptes    : les identifiants des comptes dont les annonces sont comptées
//   ventes     : les dates (ms ou ISO) des ventes Vinted non annulées LUES, ou null
//   suppressions : les dates des suppressions constatées, ou null
//   urssaf     : la ligne publiée `vinted_urssaf_mois` (ou null)
//   selection  : ce qui décide des comptes SÉLECTIONNÉS (exclusions, comptes masqués)
// `avant` : le dernier point d'un jour antérieur (pour le jour `d` et la fenêtre).
export function pointDuJour({ maintenant = Date.now(), stock, comptes, ventes, suppressions, urssaf, selection } = {}, avant = null) {
  const j = jourDe(maintenant);
  const p = { j, at: maintenant, s: entier(stock), c: Array.isArray(comptes) && entier(stock) != null ? signature(comptes) : null, v: null, x: null, d: null };
  if (avant && Number.isFinite(Number(avant.at)) && avant.j < j) {
    const depuis = Number(avant.at) - MARGE_EXPLICATION_MS;
    const compter = (l) => (Array.isArray(l) ? l.filter((t) => { const ms = typeof t === 'number' ? t : Date.parse(String(t || '')); return Number.isFinite(ms) && ms > depuis && ms <= maintenant + 60e3; }).length : null);
    p.v = compter(ventes); p.x = compter(suppressions); p.d = avant.j;
  }
  const u = objet(urssaf);
  if (u && Array.isArray(u.mois)) {
    const ymMax = j.slice(0, 7);
    const ymMin = (() => { const d = new Date(Date.parse(j + 'T12:00:00Z')); d.setUTCMonth(d.getUTCMonth() - 13); return d.toISOString().slice(0, 7); })();
    const m = {};
    for (const x of u.mois) {
      if (!x || !/^\d{4}-\d{2}$/.test(String(x.ym || '')) || x.ym >= ymMax || x.ym < ymMin) continue;
      const ca = Number(x.ca), n = Number(x.n);
      if (!Number.isFinite(ca) || !Number.isInteger(n)) continue;
      m[x.ym] = [Math.round(ca * 100) / 100, n, Math.round((Number(x.caAilleurs) || 0) * 100) / 100, Number.isInteger(x.nAilleurs) ? x.nAilleurs : 0];
    }
    const src = objet(u.sources) || {};
    let bits = 0;
    for (const [k, b] of Object.entries(PLATEFORMES_BITS)) if (src[k] === 'lu') bits |= b;
    p.m = m; p.p = bits; p.e = signature(selection);
  }
  return p;
}

// Le dernier `m` connu au point `i` ou avant (les points ne portent `m` que s'il change).
function moisAu(points, i) {
  for (let k = i; k >= 0; k--) if (points[k] && objet(points[k].m)) return points[k];
  return null;
}

// ── AJOUTER UN RELEVÉ À LA LIGNE ────────────────────────────────────────────────
// Un point par jour (le dernier relevé du jour remplace celui du matin), triés,
// 90 jours au plus. Rend la NOUVELLE donnée (sans `rev`, l'écrivain le pose).
export function ajouterPoint(donnee, point) {
  const d = objet(donnee) || {};
  const points = (Array.isArray(d.points) ? d.points : []).filter((x) => x && /^\d{4}-\d{2}-\d{2}$/.test(String(x.j || '')));
  const autres = points.filter((x) => x.j !== point.j);
  // Un relevé du jour qui ne sait pas le stock ne remplace pas un relevé du jour qui le savait.
  const memeJour = points.find((x) => x.j === point.j) || null;
  const nouveau = { ...point };
  if (memeJour) {
    if (nouveau.s == null && memeJour.s != null) { nouveau.s = memeJour.s; nouveau.c = memeJour.c; nouveau.v = memeJour.v; nouveau.x = memeJour.x; nouveau.d = memeJour.d; }
    if (!objet(nouveau.m) && objet(memeJour.m)) { nouveau.m = memeJour.m; nouveau.p = memeJour.p; nouveau.e = memeJour.e; }
  }
  const tous = [...autres, nouveau].sort((a, b) => (a.j < b.j ? -1 : a.j > b.j ? 1 : 0));
  // `m` seulement s'il change par rapport au dernier connu avant lui (la ligne reste petite).
  const i = tous.indexOf(nouveau);
  if (objet(nouveau.m)) {
    const prec = moisAu(tous, i - 1);
    if (prec && JSON.stringify(prec.m) === JSON.stringify(nouveau.m) && prec.p === nouveau.p && prec.e === nouveau.e) { delete nouveau.m; delete nouveau.p; delete nouveau.e; }
  }
  const dernier = tous[tous.length - 1].j;
  const limite = (() => { const t = Date.parse(dernier + 'T12:00:00Z') - JOURS_POINTS * 864e5; return new Date(t).toISOString().slice(0, 10); })();
  // Le plus ancien `m` gardé doit rester lisible : on le recopie sur le premier point gardé.
  const gardes = tous.filter((x) => x.j > limite);
  if (gardes.length && !objet(gardes[0].m)) {
    const base = moisAu(tous, tous.indexOf(gardes[0]));
    if (base) gardes[0] = { ...gardes[0], m: base.m, p: base.p, e: base.e };
  }
  const alertes = recalculerAlertes(d.alertes, gardes, Number(point.at) || Date.now());
  return { ...d, v: 1, points: gardes, alertes, vus: objet(d.vus) || {} };
}

// ── LES ALERTES D'UNE COMPARAISON ───────────────────────────────────────────────
// Le dernier point face au dernier point d'un jour ANTÉRIEUR. Rend [] (rien à dire)
// ou des alertes { k, type, ... } — jamais une alerte sur un « pas su ».
export function alertesDe(points) {
  const L = (Array.isArray(points) ? points : []).filter((x) => x && x.j);
  if (L.length < 2) return [];
  const iB = L.length - 1, B = L[iB];
  let iA = iB - 1; while (iA >= 0 && !(L[iA].j < B.j)) iA--;
  if (iA < 0) return [];
  const A = L[iA];
  const out = [];
  // Le stock.
  if (entier(A.s) != null && entier(B.s) != null && A.c != null && A.c === B.c && B.d === A.j && entier(B.v) != null && entier(B.x) != null) {
    const chute = A.s - B.s;
    const explique = B.v + B.x;
    const sans = chute - explique;
    if (sans >= SEUIL_PAIRES || (sans >= SEUIL_PART_MIN && sans >= A.s * SEUIL_PART)) {
      out.push({ k: `stock:${A.j}>${B.j}`, type: 'stock', j0: A.j, j1: B.j, de: A.s, a: B.s, ventes: B.v, suppressions: B.x, sans });
    }
  }
  // Les mois passés.
  const MA = moisAu(L, iA), MB = moisAu(L, iB);
  if (MA && MB && MA !== MB && MA.p === MB.p && MA.e === MB.e) {
    const ymA = A.j.slice(0, 7);
    for (const [ym, va] of Object.entries(MA.m)) {
      if (!(ym < ymA)) continue;                         // un mois déjà PASSÉ au relevé d'avant
      const vb = MB.m[ym];
      if (!Array.isArray(va) || !Array.isArray(vb)) continue;   // hors de la fenêtre de l'un : pas su
      const [caA, nA, caAilA, nAilA] = va, [caB, nB, caAilB, nAilB] = vb;
      const baisseCa = Math.round(((caA - caB) - Math.max(0, (caAilB || 0) - (caAilA || 0))) * 100) / 100;
      const baisseN = (nA - nB) - Math.max(0, (nAilB || 0) - (nAilA || 0));
      if (baisseCa >= SEUIL_CA || baisseN >= 1) {
        out.push({ k: `mois:${ym}:${A.j}>${B.j}`, type: 'mois', ym, j0: A.j, j1: B.j, caDe: caA, caA: caB, nDe: nA, nA: nB });
      }
    }
  }
  return out;
}

// Les alertes gardées : celles des comparaisons d'avant (7 jours au plus), et
// celles de la DERNIÈRE comparaison recalculées (un relevé plus tard dans la
// journée qui ne montre plus la chute la retire, tant qu'elle n'a pas sonné).
export function recalculerAlertes(anciennes, points, maintenant = Date.now()) {
  const L = Array.isArray(points) ? points : [];
  const dernierJ = L.length ? L[L.length - 1].j : '';
  const fraiches = alertesDe(L).map((a) => ({ ...a, at: maintenant }));
  const vieilles = (Array.isArray(anciennes) ? anciennes : []).filter((a) => a && a.k && Number.isFinite(Number(a.at)) && maintenant - Number(a.at) <= ALERTE_VIE_MS && a.j1 !== dernierJ);
  const parK = new Map();
  for (const a of vieilles) parK.set(a.k, a);
  for (const a of fraiches) { const av = (anciennes || []).find((x) => x && x.k === a.k); parK.set(a.k, av ? { ...a, at: av.at } : a); }
  return [...parK.values()].sort((a, b) => Number(b.at) - Number(a.at)).slice(0, ALERTES_MAX);
}

// Les alertes à MONTRER (Ma journée) : pas vues, de moins de 7 jours.
export function alertesAMontrer(donnee, maintenant = Date.now()) {
  const d = objet(donnee);
  if (!d) return [];
  const vus = objet(d.vus) || {};
  return (Array.isArray(d.alertes) ? d.alertes : []).filter((a) => a && a.k && !vus[a.k] && maintenant - Number(a.at) <= ALERTE_VIE_MS);
}
// « C'est vérifié » : l'alerte ne se montre plus (ni ne sonne). Les vus de plus de
// 14 jours s'oublient (la ligne reste petite).
export function marquerVue(donnee, k, maintenant = Date.now()) {
  const d = objet(donnee) || {};
  const vus = { ...(objet(d.vus) || {}), [k]: maintenant };
  for (const [x, t] of Object.entries(vus)) if (maintenant - Number(t) > 2 * ALERTE_VIE_MS) delete vus[x];
  return { ...d, vus };
}

// ── LES MOTS (≤ 12 par phrase, §règles) ─────────────────────────────────────────
// `geste.aller` : l'adresse (les clés de api/_lib/lien-notif.js), ouverte par
// `vrm:aller` dans l'app et par la notification.
export function texteAlerte(a) {
  if (!a) return null;
  const quand = (j0, j1) => (ecartJours(j0, j1) === 1 ? 'en une nuit' : `depuis le ${jourLisible(j0)}`);
  if (a.type === 'stock') {
    const expl = a.ventes + a.suppressions;
    return {
      titre: `Ton stock est passé de ${a.de} à ${a.a} ${quand(a.j0, a.j1)}`,
      phrase: 'Vérifie tes annonces Vinted.',
      pourquoi: expl > 0
        ? `${a.ventes} ${pl(a.ventes, 'vente', 'ventes')} et ${a.suppressions} ${pl(a.suppressions, 'suppression vue', 'suppressions vues')} expliquent ${expl} ${pl(expl, 'paire', 'paires')} sur ${a.de - a.a}.`
        : 'Aucune vente ni suppression vue ne l’explique.',
      geste: { libelle: 'Voir mes annonces', aller: '/?tab=cat_annonces' },
    };
  }
  if (a.type === 'mois') {
    const mois = moisLisible(a.ym);
    const caBaisse = a.caDe - a.caA >= SEUIL_CA;
    return {
      titre: caBaisse ? `Ton CA de ${mois} est passé de ${euros(a.caDe)} à ${euros(a.caA)}` : `Les ventes de ${mois} sont passées de ${a.nDe} à ${a.nA}`,
      phrase: 'Un mois passé ne devrait plus baisser : vérifie.',
      pourquoi: `${a.nDe} ${pl(a.nDe, 'vente', 'ventes')} avant, ${a.nA} maintenant. Un compte pas lu ou une vente annulée peut l’expliquer.`,
      geste: { libelle: 'Voir le mois', aller: '/?tab=compta&cible=urssaf' },
    };
  }
  return null;
}

// La notification : la première alerte, et combien d'autres.
export function notificationAlertes(alertes) {
  const l = Array.isArray(alertes) ? alertes.filter(Boolean) : [];
  if (!l.length) return null;
  const t = texteAlerte(l[0]);
  if (!t) return null;
  return { title: `⚠️ ${t.titre}`, body: l.length > 1 ? `${t.phrase} Et ${l.length - 1} autre${l.length > 2 ? 's' : ''} chiffre${l.length > 2 ? 's' : ''} à vérifier.` : t.phrase, url: t.geste.aller, tag: 'veille-' + l.map((a) => a.k).join('|').slice(0, 60) };
}

// Ce qui doit SONNER : pas vu, pas déjà dit (mémo du serveur), de moins de 2 jours.
export function aNotifier(donnee, memo, maintenant = Date.now()) {
  const dits = new Set(Array.isArray(memo && memo.cles) ? memo.cles : []);
  return alertesAMontrer(donnee, maintenant).filter((a) => !dits.has(a.k) && maintenant - Number(a.at) <= NOTIF_VIE_MS);
}
export function memoApres(memo, alertes, maintenant = Date.now()) {
  const avant = Array.isArray(memo && memo.cles) ? memo.cles : [];
  return { cles: [...new Set([...avant, ...alertes.map((a) => a.k)])].slice(-200), at: maintenant };
}
