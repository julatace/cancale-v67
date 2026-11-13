// ════════════════════════════════════════════════════════════════════════════
//  LE STOCK SANS RÉSEAU (13 nov. 2026, point 45 de Julien : « un garage sans
//  connexion »)
// ════════════════════════════════════════════════════════════════════════════
// Dans son garage, sans réseau, il ouvre le Stock : il doit voir OÙ est chaque
// paire (N°, photo déjà vue, case), chercher un N°, faire l'inventaire. Le Stock
// lit ses annonces actuelles au réseau (`lireAnnoncesStock`) : sans réseau, il
// n'avait plus rien (« — articles en ligne · annonces pas lues », mesuré le
// 13 nov. sur main). On garde donc, PAR VENDEUR et sur l'appareil, la DERNIÈRE
// lecture réussie du Stock, réduite à ce que l'écran en lit (`figerLecture`),
// avec son heure ; hors réseau, le Stock se dessine avec ELLE et le DIT
// (« Hors connexion — dernier état du 13 nov. à 14:02 ») — jamais présentée
// comme fraîche (§5).
//
// Les règles (les mêmes que la photo de Ma journée et la liste de l'inventaire) :
//   · figée seulement après une lecture qui a RÉPONDU (au moins une source lue) ;
//     ce qui n'a pas été lu reste « pas lu », NOMMÉ, comme en ligne ;
//   · elle appartient à UN vendeur (la clé porte son identifiant, le contenu le
//     répète ; un autre n'est jamais servi) et part avec la déconnexion
//     (`wipeLocalData` efface tout `vrm_*`) ;
//   · AUCUN NUMÉRO dedans n'est écrit nulle part : c'est une copie de LECTURE.
//     Les N° viennent toujours des fiches (`vinted_annonce_numeros`) ;
//   · bornée (`MAX_ANNONCES`, titres et adresses coupés) : le localStorage est
//     partagé ; une écriture refusée (quota) n'écrit rien — l'écran dit alors
//     « jamais lu sur cet appareil », jamais un faux état.
//
// LES PHOTOS DÉJÀ VUES (`vrm-hl-photos`) : le CDN de Vinted n'envoie aucun
// en-tête CORS — la page ne peut pas ranger l'image elle-même. Comme les QR de
// Ma journée (`/hl-qr`), le service worker répond à `/hl-photo?u=<adresse>` :
// la réserve d'abord, sinon le réseau (sans cookie ni référent), et il range.
// La page ne le lui demande que pour une photo que le Stock a AFFICHÉE en ligne
// (« déjà vue » : le navigateur l'a déjà, rien n'est retéléchargé en plus),
// d'un hôte de photos connu (`estPhotoGardable`, même liste dans public/sw.js —
// audit-stock-hors-ligne), au plus `PHOTOS_MAX`. Hors réseau, la vignette pointe
// sur `/hl-photo?u=…` ; pas gardée ⇒ la vignette sans photo (l'initiale), rien
// de cassé. La réserve part à la déconnexion (`oublierPhotosHl`).
//
// Le module de règles est PUR (aucun React) : scripts/audit-stock-hors-ligne.cjs
// l'exécute. Les deux fonctions du navigateur sont à la fin.

export const VERSION_STOCK_HL = 1;
export const PREFIXE_STOCK_HL = 'vrm_hl_stock_';
export const MAX_ANNONCES = 1500;
export const CACHE_PHOTOS = 'vrm-hl-photos';
export const PHOTOS_MAX = 120;
export const ETAT_STOCK_VIEUX_H = 24;

export const cleStockHl = (uid) => PREFIXE_STOCK_HL + String(uid || '');
const uidValide = (uid) => typeof uid === 'string' && uid.length > 0 && uid.length <= 80 && !/\s/.test(uid);
const estObjet = (o) => !!o && typeof o === 'object' && !Array.isArray(o);
const txt = (v, n = 90) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);
const adresse = (v) => (typeof v === 'string' && /^https:\/\//i.test(v) && v.length <= 600 ? v : null);
const fini = (v) => (Number.isFinite(v) ? v : null);

// Une annonce, réduite à ce que le Stock en lit (`annoncesActuelles`, `masqueesPresentes`).
const annonceVinted = (it) => (it && it.id != null ? { id: txt(it.id, 24), title: txt(it.title), photo: adresse(it.photo) } : null);
const annonceAutre = (a) => (a ? {
  numero: txt(a.numero, 16), title: txt(a.title), photo: adresse(a.photo),
  ...(a.etat === 'aconfirmer' ? { etat: 'aconfirmer' } : {}), ...(fini(a.lu) != null ? { lu: a.lu } : {}),
} : null);

// Vestiaire : la ligne lue telle quelle (la règle de Vestiaire, `annoncesVcStock`, la
// rejuge), chaque annonce réduite à ses champs simples (texte, nombre, booléen).
function vcReduite(vc) {
  if (!estObjet(vc)) return null;
  const lst = estObjet(vc.lst) ? vc.lst : null;
  const items = lst && estObjet(lst.items) ? lst.items : null;
  const its = {};
  if (items) {
    let n = 0;
    for (const [id, it] of Object.entries(items)) {
      if (++n > MAX_ANNONCES) break;
      if (!estObjet(it)) continue;
      const o = {};
      for (const [k, v] of Object.entries(it)) {
        if (typeof v === 'string') o[k] = v.slice(0, k === 'photo' ? 600 : 120);
        else if (typeof v === 'number' || typeof v === 'boolean' || v === null) o[k] = v;
      }
      its[String(id).slice(0, 40)] = o;
    }
  }
  const ventes = {};
  for (const [k, v] of Object.entries(estObjet(vc.ventes) ? vc.ventes : {}).slice(0, MAX_ANNONCES)) {
    if (!estObjet(v)) continue;
    const o = {}; for (const [kk, vv] of Object.entries(v)) if (typeof vv === 'string' || typeof vv === 'number' || typeof vv === 'boolean' || vv === null) o[kk] = typeof vv === 'string' ? vv.slice(0, 80) : vv;
    ventes[String(k).slice(0, 40)] = o;
  }
  return {
    lst: lst ? { items: items ? its : null, liens: estObjet(lst.liens) ? Object.fromEntries(Object.entries(lst.liens).slice(0, MAX_ANNONCES).map(([k, v]) => [String(k).slice(0, 40), typeof v === 'string' || typeof v === 'number' ? v : null])) : {}, capturedAt: txt(lst.capturedAt, 40), complet: lst.complet === true } : null,
    ventes: estObjet(vc.ventes) ? ventes : null,
  };
}

// La lecture du Stock (`lireAnnoncesStock` : { vinted, ebay, lbc, vc, at }) réduite et
// datée, au nom de CE vendeur — ou null (rien n'a répondu, vendeur invalide).
export function figerLecture({ uid, at, lecture } = {}) {
  if (!uidValide(uid) || !Number.isFinite(at) || !estObjet(lecture)) return null;
  const vinted = Array.isArray(lecture.vinted) ? lecture.vinted : [];
  const lus = vinted.filter((c) => c && c.ok).length + (lecture.ebay != null ? 1 : 0) + (lecture.lbc != null ? 1 : 0);
  if (!lus) return null;
  let reste = MAX_ANNONCES;
  const liste = (l, f) => { const out = []; for (const x of (Array.isArray(l) ? l : [])) { if (reste <= 0) break; const y = f(x); if (y) { out.push(y); reste--; } } return out; };
  const v = vinted.filter(Boolean).slice(0, 40).map((c) => (c.ok
    ? { uid: txt(c.uid, 40), nom: txt(c.nom, 60), ok: true, lu: fini(c.lu), enLigne: liste(c.enLigne, annonceVinted), aConfirmer: liste(c.aConfirmer, annonceVinted), masquees: liste(c.masquees, annonceVinted) }
    : { uid: txt(c.uid, 40), nom: txt(c.nom, 60), ok: false }));
  const ebay = lecture.ebay == null ? null : { liste: liste(lecture.ebay.liste, annonceAutre), illisibles: (Array.isArray(lecture.ebay.illisibles) ? lecture.ebay.illisibles : []).slice(0, 20).map((x) => txt(x, 60)) };
  const lbc = lecture.lbc == null ? null : liste(lecture.lbc, annonceAutre);
  return { v: VERSION_STOCK_HL, uid, at, lecture: { vinted: v, ebay, lbc, vc: lecture.vc == null ? null : vcReduite(lecture.vc), at } };
}

// La lecture gardée de CE vendeur, sous la forme que le Stock attend, ou null.
export function lireLectureHl(uid, stockage) {
  try {
    if (!uidValide(uid)) return null;
    const brut = stockage.getItem(cleStockHl(uid));
    if (!brut) return null;
    const f = JSON.parse(brut);
    if (!estObjet(f) || f.v !== VERSION_STOCK_HL || f.uid !== uid || !Number.isFinite(f.at) || !estObjet(f.lecture) || !Array.isArray(f.lecture.vinted)) return null;
    return f;
  } catch (_) { return null; }
}
// Écrit la lecture figée ; même contenu (hors heure) depuis moins de 10 min ⇒ rien.
// Un quota plein ⇒ rien d'écrit (et l'ancienne retirée : jamais un état plus vieux
// que ce que la ligne dit).
const sansHeure = (f) => JSON.stringify({ ...f, at: 0, lecture: { ...f.lecture, at: 0 } });
export function ecrireLectureHl(uid, f, stockage, maintenant = Date.now()) {
  try {
    if (!uidValide(uid) || !estObjet(f) || f.uid !== uid || f.v !== VERSION_STOCK_HL) return false;
    const avant = lireLectureHl(uid, stockage);
    if (avant && sansHeure(avant) === sansHeure(f) && maintenant - avant.at < 10 * 60000) return false;
    try { stockage.setItem(cleStockHl(uid), JSON.stringify(f)); }
    catch (_) { try { stockage.removeItem(cleStockHl(uid)); } catch (__) {} return false; }
    return true;
  } catch (_) { return false; }
}
// Plus d'un jour : dit à l'ambre (vérifie au retour du réseau).
export const etatStockVieux = (at, maintenant = Date.now()) => Number.isFinite(at) && (maintenant - at) / 3600e3 > ETAT_STOCK_VIEUX_H;

// ── Les photos ───────────────────────────────────────────────────────────────
// ⚠️ ÉGALE à `estPhotoGardable` de public/sw.js (un service worker n'importe pas
// un module de l'app) — audit-stock-hors-ligne compare les deux.
const HOTES_PHOTOS = /^(?:[a-z0-9-]+\.)*(?:vinted\.net|ebayimg\.com|vestiairecollective\.com)$|^img\.leboncoin\.fr$/;
export function estPhotoGardable(u) {
  try {
    if (typeof u !== 'string' || u.length > 600) return false;
    const x = new URL(u);
    return x.protocol === 'https:' && !x.username && !x.password && !x.port && HOTES_PHOTOS.test(x.hostname.toLowerCase());
  } catch (_) { return false; }
}
export const adressePhotoHl = (u) => (estPhotoGardable(u) ? '/hl-photo?u=' + encodeURIComponent(u) : null);

// ── Le navigateur ────────────────────────────────────────────────────────────
// Une photo AFFICHÉE en ligne par le Stock : demandée au service worker (qui la
// range), une à la fois, une fois par visite. Rien sans réseau, sans service
// worker qui contrôle la page, ou pour une adresse hors liste.
const _faites = new Set();
const _file = [];
let _enVol = false;
export function retenirPhoto(u) {
  try {
    const a = adressePhotoHl(u);
    if (!a || _faites.has(a) || _faites.size > PHOTOS_MAX * 3) return;
    if (typeof navigator === 'undefined' || navigator.onLine === false || !navigator.serviceWorker || !navigator.serviceWorker.controller || typeof caches === 'undefined') return;
    _faites.add(a); _file.push(a);
    if (!_enVol) pomper();
  } catch (_) {}
}
async function pomper() {
  _enVol = true;
  try {
    while (_file.length) {
      const a = _file.shift();
      try {
        const c = await caches.open(CACHE_PHOTOS);
        if (await c.match(a)) continue;
        await fetch(a, { credentials: 'omit', headers: { 'x-vrm-hl-photo': '1' } });
      } catch (_) { /* réseau coupé : on s'arrête là, la prochaine visite reprend */ _file.length = 0; }
    }
  } finally { _enVol = false; }
}
export function oublierPhotosHl() {
  _faites.clear(); _file.length = 0;
  try { if (typeof caches !== 'undefined') caches.delete(CACHE_PHOTOS).catch(() => {}); } catch (_) {}
}
