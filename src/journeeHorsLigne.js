// ════════════════════════════════════════════════════════════════════════════
//  MA JOURNÉE HORS LIGNE (21 octobre) — une photo PAR VENDEUR, sur l'appareil.
// ════════════════════════════════════════════════════════════════════════════
// Au point relais sans 4G, dans le métro : ouvrir VRM sans réseau montre Ma
// journée telle qu'à la dernière ouverture RÉUSSIE — colis à expédier, colis à
// retirer avec leurs codes et QR, la liste du soir — en lecture seule.
//
// Trois règles, et c'est tout le module :
//   · la photo n'est écrite qu'après une lecture COMPLÈTE (`lectureComplete`) :
//     une lecture partielle présentée plus tard comme « ta journée » serait un
//     total partiel présenté comme complet (§5) — un colis manquant, c'est un
//     colis oublié ;
//   · une photo appartient à UN vendeur : la clé porte son identifiant ET la
//     photo le répète ; une photo d'un autre (clé ou contenu) n'est JAMAIS
//     servie (`lirePhoto`). Elle part avec la déconnexion (`wipeLocalData`
//     efface tout `vrm_*`) ;
//   · « pas su » ≠ « rien » : sans photo, on le dit — jamais « tout est à jour ».
// Pur (aucun React) : `scripts/audit-journee-hors-ligne.cjs` l'exécute.

// (revue du 23 oct.) Version 2 : « à retirer » et « à vérifier » sont deux
// listes. La v1 mêlait les colis « hors délai » aux colis à retirer (le compte
// hors ligne disait plus que la tuile en ligne) : elle est relue convertie.
export const VERSION_PHOTO = 2;
export const PREFIXE_PHOTO = 'vrm_hl_photo_';
export const CACHE_QR = 'vrm-hl-qr';            // le service worker la garde (public/sw.js)
const MAX_LIGNES = 80;
const MAX_QR_DATA = 60000;                      // un QR en data: au-delà est abandonné (l'adresse reste)

export const clePhoto = (uid) => PREFIXE_PHOTO + String(uid || '');
const uidValide = (uid) => typeof uid === 'string' && uid.length > 0 && uid.length <= 80 && !/\s/.test(uid);

// La lecture qui alimente Ma journée est-elle COMPLÈTE ? Chaque source doit
// avoir RÉPONDU (pas « en cours », pas « échec ») :
//   · la liste des comptes (`accountsReady`, et la base a répondu : `!baseKO`) ;
//   · les ventes ET les achats de TOUS les comptes d'aujourd'hui (aucun compte
//     en échec, la lecture couvre exactement les comptes) ;
//   · les emails de suivi (codes de retrait) et de bordereau ;
//   · la ligne des codes lus dans les conversations (`colisRelaisLu`) ;
//   · les commandes eBay (`colisEb` : `undefined` en cours, `null` pas su).
export function lectureComplete(s) {
  if (!s || s.baseKO !== false || s.accountsReady !== true) return false;
  const couvre = (l) => !!l && Array.isArray(l.items) && !l.loading
    && (s.cleComptes == null || l.comptes === s.cleComptes)
    && !(Array.isArray(l.failedUids) && l.failedUids.length);
  if (!couvre(s.ventes) || !couvre(s.achats)) return false;
  if (!Array.isArray(s.tracking) || !Array.isArray(s.emailBords)) return false;
  if (s.colisRelaisLu !== true) return false;
  if (!s.colisEb || typeof s.colisEb !== 'object' || !Array.isArray(s.colisEb.aPoster)) return false;
  return true;
}

// Jour local AAAA-MM-JJ de `ms + jours`.
const jourLocal = (ms, jours = 0) => {
  const d = new Date(ms); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + jours);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const txt = (v, n = 90) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);
const qrPropre = (q) => {
  const t = String(q || '');
  if (/^data:image\//i.test(t)) return t.length <= MAX_QR_DATA ? t : '';
  if (/^https:\/\//i.test(t)) return t.slice(0, 1500);
  return '';
};

// Construit la photo à partir de ce que Ma journée affiche. `envoyer` :
// [{ titre, numero, compte, jours, plateforme }] (jours = jours avant la date
// limite AU MOMENT de la lecture, ou null) ; `retirer` : [{ titre, lieu, code,
// qr, compte, transporteur, suivi, limite }] — EXACTEMENT les colis que la
// tuile « À retirer » compte en ligne (§11) ; `aVerifier` : [{ …, raison:
// 'delai_depasse'|'trop_long', limite?, garde? }] — les colis « à vérifier »
// qui ont encore leur code ou leur QR (peut-être encore au relais), comptés à
// part (`nAVerifier`), JAMAIS dans « à retirer ». `nePasPoster` : nombre de
// colis eBay dont l'acheteur a demandé l'annulation.
const cleGeste = (v) => { const t = String(v == null ? '' : v).trim(); return t && t.length <= 200 ? t : ''; };
const txValide = (v) => (/^\d{1,20}$/.test(String(v == null ? '' : v)) ? String(v) : '');
const jourValide = (j) => /^\d{4}-\d{2}-\d{2}$/.test(String(j || '').slice(0, 10)) ? String(j).slice(0, 10) : '';
// (6 nov., v36) `cle` : l'identité du colis pour « J'ai retiré » (`colisKey`, la
// clé de `vrm_colis_collected`) ; `tx` : le n° de transaction d'un colis vu par
// Vinted seulement (`vinted_pickup_done`). Absents (photo d'avant) ⇒ le geste
// est refusé hors réseau, dit — jamais deviné par le titre (§5).
const ligneRetrait = (r) => ({
  titre: txt(r.titre), lieu: txt(r.lieu, 120), code: txt(r.code, 16), qr: qrPropre(r.qr), compte: txt(r.compte, 40),
  transporteur: txt(r.transporteur, 30), suivi: txt(r.suivi, 40), limite: jourValide(r.limite),
  ...(cleGeste(r.cle) ? { cle: cleGeste(r.cle) } : {}), ...(txValide(r.tx) ? { tx: txValide(r.tx) } : {}),
});
export function construirePhoto({ uid, at, envoyer = [], retirer = [], aVerifier = [], nAVerifier = null, nePasPoster = 0 }) {
  if (!uidValide(uid) || !Number.isFinite(at)) return null;
  return {
    v: VERSION_PHOTO, uid, at,
    envoyer: envoyer.slice(0, MAX_LIGNES).map((e) => ({
      titre: txt(e.titre), numero: txt(e.numero, 12), compte: txt(e.compte, 40), plateforme: e.plateforme === 'ebay' ? 'ebay' : 'vinted',
      // (6 nov., v36) La vente Vinted, pour « Colis fait » hors réseau (`vinted_ship_done`).
      ...(e.plateforme !== 'ebay' && txValide(e.tx) ? { tx: txValide(e.tx) } : {}),
      // (9 nov.) Les lignes de bordereau de CETTE vente (son identité, jamais le titre) :
      // hors connexion, le PDF déjà ouvert ici s'affiche (src/bordereauxHorsLigne.js).
      ...(e.plateforme !== 'ebay' && Array.isArray(e.pdf) && e.pdf.length ? { pdf: e.pdf.map((r) => cleGeste(r)).filter((r) => /^(email_bord_|harvest_)[A-Za-z0-9_.-]+$/.test(r) && !/_label_latest$/.test(r)).slice(0, 2) } : {}),
      limite: Number.isFinite(e.jours) ? jourLocal(at, e.jours) : '',
      // (22 oct.) L'HEURE limite lue dans l'email (« avant 10 h ») et l'instant
      // exact, pour que la ligne hors ligne dise la même chose que Colis — et
      // passe « en retard » à l'heure, même sans réseau. Absents ⇒ le jour seul.
      ...(Number.isFinite(e.limiteAt) && /^\d{4}-\d{2}-\d{2}$/.test(String(e.jour || '')) ? { jour: e.jour, limiteAt: e.limiteAt, heure: /^\d{2}:\d{2}$/.test(String(e.heure || '')) ? e.heure : '' } : {}),
      // (revue du 22 oct.) Une date ESTIMÉE (vente + 7 j, pas d'email) : jamais
      // « en retard » une fois passée, « à vérifier sur Vinted ».
      ...(e.estimee === true ? { estimee: true } : {}),
    })),
    nEnvoyer: envoyer.length,
    retirer: retirer.slice(0, MAX_LIGNES).map(ligneRetrait),
    nRetirer: retirer.length,
    aVerifier: aVerifier.slice(0, MAX_LIGNES).map((r) => ({
      ...ligneRetrait(r), raison: r.raison === 'delai_depasse' ? 'delai_depasse' : r.raison === 'trop_long' ? 'trop_long' : '',
      garde: Number.isFinite(r.garde) ? r.garde : null,
    })),
    nAVerifier: Number.isFinite(nAVerifier) ? nAVerifier : aVerifier.length,
    nePasPoster: Number.isFinite(nePasPoster) ? nePasPoster : 0,
  };
}

// Même contenu (hors date) : rien à réécrire, sauf si la photo a plus de 5 min
// (« ce que tu vois date de » doit suivre la dernière lecture réussie).
const sansDate = (p) => JSON.stringify({ ...p, at: 0 });
export function ecrirePhoto(uid, photo, stockage, maintenant = Date.now()) {
  try {
    if (!uidValide(uid) || !photo || photo.uid !== uid || photo.v !== VERSION_PHOTO) return false;
    const avant = lirePhoto(uid, stockage);
    if (avant && sansDate(avant) === sansDate(photo) && maintenant - avant.at < 5 * 60000) return false;
    stockage.setItem(clePhoto(uid), JSON.stringify(photo));
    return true;
  } catch (_) { return false; }
}

// La photo de CE vendeur, ou null. Une clé d'un autre vendeur n'est jamais lue ;
// un contenu qui nomme un autre vendeur est refusé.
export function lirePhoto(uid, stockage) {
  try {
    if (!uidValide(uid)) return null;
    const brut = stockage.getItem(clePhoto(uid));
    if (!brut) return null;
    const p = JSON.parse(brut);
    if (!p || typeof p !== 'object' || p.uid !== uid || !Number.isFinite(p.at)) return null;
    if (!Array.isArray(p.envoyer) || !Array.isArray(p.retirer)) return null;
    if (p.v === 1) {
      // (revue du 23 oct.) Une photo v1 mêlait les « hors délai » aux colis à
      // retirer : on les sort (raison pas sue), le compte « à retirer » suit.
      const hd = p.retirer.filter((r) => r && r.horsDelai);
      const reste = p.retirer.filter((r) => !(r && r.horsDelai));
      return { ...p, v: VERSION_PHOTO, retirer: reste, nRetirer: Math.max(reste.length, (Number(p.nRetirer) || 0) - hd.length),
        aVerifier: hd.map((r) => ({ ...r, raison: '', garde: null })), nAVerifier: hd.length };
    }
    if (p.v !== VERSION_PHOTO) return null;
    if (!Array.isArray(p.aVerifier)) return null;
    return p;
  } catch (_) { return null; }
}

// Jours entre aujourd'hui et une date AAAA-MM-JJ (négatif = passée).
export function joursAvantJour(jour, maintenant = Date.now()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(jour || ''))) return null;
  const [a, m, j] = jour.split('-').map(Number);
  const fin = new Date(a, m - 1, j); const auj = new Date(maintenant); auj.setHours(0, 0, 0, 0);
  return Math.round((fin - auj) / 86400000);
}

// La liste du soir : ce qui est à poster DEMAIN, la règle du rappel de la
// veille (en retard demain = date limite aujourd'hui ou avant ; limite demain).
// (revue du 22 oct.) Une date ESTIMÉE (vente + 7 j) passée demain n'est pas
// « déjà en retard » — la vraie tombe jusqu'à 3 jours plus tard : `aVerifier`,
// la même règle que le rappel du soir (api/ship-reminders.js).
export function listeDuSoir(photo, maintenant = Date.now()) {
  if (!photo) return null;
  let enRetard = 0, aVerifier = 0, demain = 0;
  for (const e of photo.envoyer) {
    const j = joursAvantJour(e.limite, maintenant);
    if (j == null) continue;
    if (j <= 0) { if (e.estimee === true) aVerifier++; else enRetard++; } else if (j === 1) demain++;
  }
  return { n: photo.nEnvoyer, enRetard, aVerifier, demain };
}

// « 14:32 », « hier 14:32 », « 12 oct. 14:32 » — l'heure de la photo.
export function heurePhoto(at, maintenant = Date.now()) {
  const d = new Date(at); if (isNaN(d)) return '';
  const h = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const j = joursAvantJour(jourLocal(at), maintenant);
  if (j === 0) return h;
  if (j === -1) return 'hier ' + h;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' ' + h;
}

// L'adresse locale d'un QR hébergé : le service worker la sert depuis sa
// réserve (`CACHE_QR`), remplie pendant que le réseau est là.
export const adresseQrLocale = (url) => '/hl-qr?u=' + encodeURIComponent(url);


// ════════════════════════════════════════════════════════════════════════════
//  (6 nov., v36) HORS RÉSEAU : COLIS, LA DATE DITE, LES GESTES MIS EN FILE
// ════════════════════════════════════════════════════════════════════════════
// « Hors connexion — dernier état du 6 nov. à 17:36 » : le JOUR toujours (une
// heure seule se lit « aujourd'hui » — un état de la veille passait pour frais).
export function quandEtat(at) {
  const d = new Date(at); if (!Number.isFinite(at) || isNaN(d)) return '';
  return `${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
}
// Au-delà, une ligne le dit (un colis a pu être retiré ou arriver depuis).
export const ETAT_VIEUX_H = 12;
export function ageEtatH(at, maintenant = Date.now()) {
  return Number.isFinite(at) ? Math.max(0, (maintenant - at) / 3600e3) : null;
}
export const etatVieux = (at, maintenant = Date.now()) => { const h = ageEtatH(at, maintenant); return h == null || h >= ETAT_VIEUX_H; };

// Les colis à retirer rangés PAR POINT RELAIS (« un point = une carte », §5) :
// le lieu lu, sinon le transporteur (« Point Mondial Relay »), sinon « Point
// relais » — dans l'ordre de la photo. Un lieu est comparé sans casse ni espace.
export function pointsDeRetrait(retirer) {
  const cartes = []; const parCle = new Map();
  for (const r of Array.isArray(retirer) ? retirer : []) {
    if (!r) continue;
    const lieu = txt(r.lieu, 120);
    const cle = lieu ? 'l:' + lieu.toLowerCase().replace(/\s+/g, ' ') : 't:' + String(r.transporteur || '').toLowerCase();
    let c = parCle.get(cle);
    if (!c) { c = { cle, lieu, nom: lieu || (r.transporteur ? `Point ${r.transporteur}` : 'Point relais'), colis: [] }; parCle.set(cle, c); cartes.push(c); }
    c.colis.push(r);
  }
  return cartes;
}

// Les gestes hors réseau sont des NOTES de l'appareil (rien ne part chez Vinted
// ni chez un transporteur) : « J'ai retiré », « Colis fait ». Ils passent par la
// sauvegarde normale de l'app (`save`, donc la file d'envoi, src/fileEnvoi.js) ;
// ces fonctions rendent seulement la NOUVELLE valeur de la clé, sans toucher à
// ce qu'elle porte d'autre. Une identité absente ⇒ `null` (rien n'est écrit).
//   colisRetireApres(liste, dates, cle, iso) → { liste, dates } | null
export function colisRetireApres(liste, dates, cle, iso) {
  const k = cleGeste(cle); if (!k || !iso) return null;
  const l = (Array.isArray(liste) ? liste : []).map(String);
  return { liste: l.includes(k) ? l : l.concat(k), dates: { ...(dates && typeof dates === 'object' && !Array.isArray(dates) ? dates : {}), [k]: iso } };
}
export function colisRetireAnnule(liste, dates, cle) {
  const k = cleGeste(cle); if (!k) return null;
  const d = { ...(dates && typeof dates === 'object' && !Array.isArray(dates) ? dates : {}) }; delete d[k];
  return { liste: (Array.isArray(liste) ? liste : []).map(String).filter((x) => x !== k), dates: d };
}
// `vinted_ship_done` / `vinted_pickup_done` : { [tx]: valeur }.
export function marqueApres(objet, tx, valeur) {
  const k = txValide(tx); if (!k || valeur == null) return null;
  return { ...(objet && typeof objet === 'object' && !Array.isArray(objet) ? objet : {}), [k]: valeur };
}
export function marqueAnnulee(objet, tx) {
  const k = txValide(tx); if (!k) return null;
  const o = { ...(objet && typeof objet === 'object' && !Array.isArray(objet) ? objet : {}) }; delete o[k]; return o;
}
