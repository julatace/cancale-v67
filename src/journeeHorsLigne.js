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

export const VERSION_PHOTO = 1;
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
// qr, compte, transporteur, suivi, horsDelai }] ; `nePasPoster` : nombre de
// colis eBay dont l'acheteur a demandé l'annulation.
export function construirePhoto({ uid, at, envoyer = [], retirer = [], nePasPoster = 0 }) {
  if (!uidValide(uid) || !Number.isFinite(at)) return null;
  return {
    v: VERSION_PHOTO, uid, at,
    envoyer: envoyer.slice(0, MAX_LIGNES).map((e) => ({
      titre: txt(e.titre), numero: txt(e.numero, 12), compte: txt(e.compte, 40), plateforme: e.plateforme === 'ebay' ? 'ebay' : 'vinted',
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
    retirer: retirer.slice(0, MAX_LIGNES).map((r) => ({
      titre: txt(r.titre), lieu: txt(r.lieu, 120), code: txt(r.code, 16), qr: qrPropre(r.qr), compte: txt(r.compte, 40),
      transporteur: txt(r.transporteur, 30), suivi: txt(r.suivi, 40), horsDelai: !!r.horsDelai,
    })),
    nRetirer: retirer.length,
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
    if (!p || typeof p !== 'object' || p.v !== VERSION_PHOTO || p.uid !== uid || !Number.isFinite(p.at)) return null;
    if (!Array.isArray(p.envoyer) || !Array.isArray(p.retirer)) return null;
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
