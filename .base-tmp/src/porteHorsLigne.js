// ═══════════════════════════════════════════════════════════════════════════
// L'OUVERTURE HORS LIGNE « À FROID » (9 nov., oui explicite de Julien :
// « vas-y, fais absolument tout » sur la proposition qui disait « je ne le fais
// que sur un oui explicite »).
// ═══════════════════════════════════════════════════════════════════════════
// VRM fermé puis rouvert SANS réseau (au point relais, à la cave) restait sur
// « Vérification indisponible » : la porte de confidentialité
// (src/PorteConfidentialite.jsx) échoue fermée tant que le serveur n'a pas
// confirmé la séparation des boutiques. Désormais, et SEULEMENT quand la
// vérification n'a PAS PU PARTIR (aucune réponse HTTP : réseau absent), la
// porte laisse passer en mode « hors ligne », en LECTURE SEULE, si :
//   · une session est rangée sur l'appareil (jeton d'accès + jeton de
//     renouvellement + uid), et le jeton d'accès dit le MÊME uid (`sub`) ;
//   · CE compte a déjà passé la vérification serveur sur CET appareil
//     (`vrm_porte_ok_{uid}`, posé UNIQUEMENT après une réponse `{ok:true, uid}`
//     du serveur), avec la MÊME session (empreinte du jeton de renouvellement :
//     une autre connexion, même du même compte, n'a pas été vérifiée) ;
//   · la dernière vérification réussie date de MOINS DE 7 JOURS (voir
//     DUREE_LAISSEZ_PASSER_MS) ;
//   · le dernier état de l'abonnement de CE compte est connu sur l'appareil
//     (`vrm_abo_dernier_{uid}`) — hors ligne, « sans abonnement » reste un
//     APERÇU (src/abonnement/apercu.js), jamais l'app entière.
// Un autre compte, une session absente, un drapeau d'un autre uid, un drapeau
// périmé ou d'une autre session ⇒ RIEN ne passe (« Vérification indisponible »).
//
// ⚠️ MODÈLE DE MENACE (détail : docs/passation/2026-11-09-hors-ligne-relie.md).
//    Le drapeau vit dans localStorage : n'importe qui qui tient l'appareil peut
//    l'écrire. Il ne doit donc RIEN ouvrir de plus que ce que l'appareil a déjà :
//      · pendant le mode hors ligne, la garde ci-dessous REFUSE toute requête
//        vers la base (lecture comme écriture, REST, stockage, fonctions) et vers
//        nos routes `/api/` (sauf la vérification elle-même), et tout message à
//        l'extension (sauf « es-tu là ? ») — comme une coupure réseau : les
//        appelants voient « pas su », jamais une donnée, jamais un succès ;
//      · seules les données DÉJÀ rangées sur l'appareil (localStorage, réserves
//        du hors connexion) s'affichent — celles qu'un voleur de l'appareil lit
//        de toute façon dans les outils du navigateur ;
//      · au retour du réseau, la vérification est refaite AVANT toute lecture ;
//        un refus du serveur (session refusée, séparation non confirmée) referme
//        la porte et efface le drapeau ; l'abonnement relu reprend la main.
//    Le serveur, lui, ne fait JAMAIS confiance au drapeau : il ne le voit pas.
// ═══════════════════════════════════════════════════════════════════════════

export const PREFIXE_LAISSEZ_PASSER = 'vrm_porte_ok_';
export const PREFIXE_ABO_DERNIER = 'vrm_abo_dernier_';
// 7 JOURS depuis la dernière vérification réussie :
//   · le hors connexion sert une tournée, un week-end, un dépôt sans 4G — au-delà
//     les données gardées sont vieilles (Ma journée hors ligne passe déjà en
//     ambre après un jour) ;
//   · c'est l'essai gratuit (7 jours) et la plus courte période qui puisse finir
//     sans que l'appareil le sache : au pire, un abonnement fini (ou un compte
//     supprimé, une session révoquée ailleurs) laisse revoir SES données déjà
//     sur l'appareil 7 jours de plus, sans rien pouvoir écrire ;
//   · la même borne que « Plus tard » de la double vérification (MFA_PLUS_TARD_MS).
export const DUREE_LAISSEZ_PASSER_MS = 7 * 86400000;
// Une horloge d'appareil un peu en avance n'invente pas un laissez-passer futur.
const AVANCE_TOLEREE_MS = 5 * 60000;

export const cleLaissezPasser = (uid) => PREFIXE_LAISSEZ_PASSER + String(uid || '');
export const cleAboDernier = (uid) => PREFIXE_ABO_DERNIER + String(uid || '');

// Empreinte courte (FNV-1a 32 bits) du jeton de renouvellement : relie le drapeau
// à LA session vérifiée sans recopier le jeton. Pas un secret (le jeton est à
// côté, en clair, dans le même stockage) : une identité de session.
export function empreinteSession(session) {
  const s = String((session && session.refresh_token) || '');
  if (!s) return '';
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16) + ':' + s.length;
}

// Le `sub` du jeton d'accès (JWT de Supabase), lu sans vérifier la signature :
// ce n'est pas une preuve (personne ici ne peut la vérifier hors ligne), c'est
// une COHÉRENCE — une session dont le jeton dit un autre compte ne passe pas.
export function subDuJeton(jeton) {
  try {
    const p = String(jeton || '').split('.');
    if (p.length !== 3) return '';
    const b = p[1].replace(/-/g, '+').replace(/_/g, '/');
    const txt = typeof atob === 'function' ? atob(b + '==='.slice((b.length + 3) % 4)) : Buffer.from(b, 'base64').toString('utf8');
    const j = JSON.parse(txt);
    return j && typeof j.sub === 'string' ? j.sub : '';
  } catch (_) { return ''; }
}

const lireJson = (stock, k) => { try { const t = stock.getItem(k); return t ? JSON.parse(t) : null; } catch (_) { return null; } };

// Après une vérification SERVEUR réussie (et seulement là) : le drapeau, daté.
export function noterVerification(stock, session, maintenant = Date.now()) {
  const uid = session && session.user && session.user.id;
  const rt = empreinteSession(session);
  if (!uid || !rt) return false;
  try { stock.setItem(cleLaissezPasser(uid), JSON.stringify({ uid: String(uid), at: maintenant, rt })); return true; } catch (_) { return false; }
}
// Un refus du serveur (ou une déconnexion) : le drapeau part. Sans uid : tous.
export function effacerLaissezPasser(stock, uid) {
  try {
    if (uid) { stock.removeItem(cleLaissezPasser(uid)); return; }
    const k = [];
    for (let i = 0; i < stock.length; i++) { const c = stock.key(i); if (c && c.indexOf(PREFIXE_LAISSEZ_PASSER) === 0) k.push(c); }
    k.forEach((c) => stock.removeItem(c));
  } catch (_) {}
}

// Le dernier état de l'abonnement LU DU SERVEUR, gardé pour le hors ligne : les
// seuls champs qui décident de l'écran (aucun prix, aucun identifiant Stripe).
const CHAMPS_ABO = ['acces', 'lecture', 'statut', 'annuleFinPeriode', 'finPeriode', 'proprietaire', 'configure', 'peutGerer', 'obligatoire'];
export function noterAbonnement(stock, uid, x, maintenant = Date.now()) {
  if (!uid || !x || typeof x !== 'object') return false;
  const o = {};
  for (const c of CHAMPS_ABO) if (x[c] !== undefined) o[c] = x[c];
  try { stock.setItem(cleAboDernier(uid), JSON.stringify({ uid: String(uid), at: maintenant, x: o })); return true; } catch (_) { return false; }
}
// Ce que l'app publie hors ligne : le dernier état connu ; un essai ou un
// abonnement RÉSILIÉ dont la fin est passée devient « sans abonnement » (aperçu
// si la base laissait lire, porte sinon) — jamais l'app entière sur une
// supposition. `horsLigne: true` le marque.
export function abonnementHorsLigne(snap, maintenant = Date.now()) {
  const x = snap && snap.x && typeof snap.x === 'object' ? { ...snap.x, horsLigne: true } : null;
  if (!x) return null;
  if (x.proprietaire === true || x.acces === false) return x;
  const fin = Date.parse(x.finPeriode || '');
  if (Number.isFinite(fin) && fin < maintenant && x.annuleFinPeriode === true) return { ...x, acces: false, statut: 'canceled' };
  return x;
}

// LA décision. Rend { ok: true, at, abo } ou { ok: false, raison }.
export function laissezPasserHorsLigne({ stock, session, maintenant = Date.now() }) {
  const uid = session && session.user && typeof session.user.id === 'string' ? session.user.id : '';
  if (!uid || !session.access_token || !session.refresh_token) return { ok: false, raison: 'session' };
  if (subDuJeton(session.access_token) !== uid) return { ok: false, raison: 'jeton' };
  const d = lireJson(stock, cleLaissezPasser(uid));
  if (!d) return { ok: false, raison: 'aucun' };
  if (d.uid !== uid) return { ok: false, raison: 'autre-compte' };
  const at = Number(d.at);
  if (!Number.isFinite(at) || at > maintenant + AVANCE_TOLEREE_MS || maintenant - at > DUREE_LAISSEZ_PASSER_MS) return { ok: false, raison: 'perime' };
  if (!d.rt || d.rt !== empreinteSession(session)) return { ok: false, raison: 'autre-session' };
  const snap = lireJson(stock, cleAboDernier(uid));
  if (!snap || snap.uid !== uid || !snap.x) return { ok: false, raison: 'abonnement-inconnu' };
  return { ok: true, at, abo: abonnementHorsLigne(snap, maintenant) };
}

// ── LE MODE HORS LIGNE, PARTAGÉ (porte → garde → porte de l'abonnement) ──────
let _horsLigne = null;   // null, ou { uid, at, abo }
const _ecoutes = new Set();
export const horsLigneActif = () => !!_horsLigne;
export const etatHorsLigne = () => _horsLigne;
export function poserHorsLigne(v) {
  _horsLigne = v && v.uid ? v : null;
  _ecoutes.forEach((f) => { try { f(_horsLigne); } catch (_) {} });
}
export function suivreHorsLigne(f) { _ecoutes.add(f); return () => _ecoutes.delete(f); }

// ── LA GARDE : AUCUNE REQUÊTE NI AUCUN MESSAGE À L'EXTENSION EN MODE HORS LIGNE ─
// Seules passent : la vérification de la porte (`/api/compte?mode=confidentialite`,
// GET) et le renouvellement de la session (`/auth/v1/token`) qui la précède au
// retour du réseau. Tout le reste vers la base ou nos routes est refusé comme
// une coupure (TypeError) : la file d'envoi garde ses saisies (« pas su » ≠
// « envoyé »), aucune lecture ne ramène une donnée que l'appareil n'a pas.
export const CODE_HORS_LIGNE = 'vrm-hors-ligne';
export function requeteAutoriseeHorsLigne(url, methode, base, origine) {
  const u = String(url || '');
  const m = String(methode || 'GET').toUpperCase();
  const b = String(base || '').replace(/\/+$/, '');
  let chemin = '', memeOrigine = false;
  try { const x = new URL(u, origine || 'http://localhost'); chemin = x.pathname + x.search; memeOrigine = !!origine && x.origin === new URL(origine).origin; } catch (_) { return false; }
  if (b && u.indexOf(b) === 0) return /^\/auth\/v1\/token\?grant_type=refresh_token/.test(u.slice(b.length)) && m === 'POST';
  if (memeOrigine && /^\/api\//.test(chemin)) return m === 'GET' && /^\/api\/compte\?mode=confidentialite(&|$)/.test(chemin);
  // Le reste (fichiers de l'app, polices, images d'un autre site) n'est pas de
  // la donnée du vendeur : la page en a besoin pour s'afficher.
  return true;
}
export function creerGardeHorsLigne(fetchOrig, base, estActive, origine) {
  return function (input, init) {
    if (estActive()) {
      const url = typeof input === 'string' ? input : (input && typeof input.url === 'string' ? input.url : (typeof URL !== 'undefined' && input instanceof URL ? input.href : ''));
      const methode = (init && init.method) || (input && typeof input === 'object' && input.method) || 'GET';
      if (!requeteAutoriseeHorsLigne(url, methode, base, typeof origine === 'function' ? origine() : origine)) {
        try { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('vrm:hors-ligne-refus')); } catch (_) {}
        return Promise.reject(new TypeError(CODE_HORS_LIGNE));
      }
    }
    return fetchOrig(input, init);
  };
}
// Les messages de l'app à l'extension (`{__vmr: …}`) : seul « es-tu là ? » passe.
export const MESSAGES_EXTENSION_PERMIS = ['ping'];
export function creerGardeMessages(postOrig, estActive) {
  return function (msg, ...reste) {
    if (estActive() && msg && typeof msg === 'object' && typeof msg.__vmr === 'string' && !MESSAGES_EXTENSION_PERMIS.includes(msg.__vmr)) return undefined;
    return postOrig(msg, ...reste);
  };
}
export function installerGardeHorsLigne(base) {
  try {
    if (typeof window === 'undefined' || window.__vrmGardeHorsLigne) return;
    if (typeof window.fetch === 'function') window.fetch = creerGardeHorsLigne(window.fetch.bind(window), base, horsLigneActif, () => window.location.origin);
    if (typeof window.postMessage === 'function') window.postMessage = creerGardeMessages(window.postMessage.bind(window), horsLigneActif);
    window.__vrmGardeHorsLigne = true;
  } catch (_) {}
}
