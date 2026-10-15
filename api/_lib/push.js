// api/_lib/push.js
// ────────────────────────────────────────────────────────────────────────────
// Envoi de notifications push (Web Push). Partagé par :
//   - api/push.js          (abonnement depuis l'app + notification de test)
//   - api/email-inbound.js (vente / bordereau / argent reçu → push en temps réel)
//
// Les abonnements (un par appareil) sont rangés dans Supabase, table app_data,
// ligne id='push_subs' : { subs: [ {endpoint, keys:{p256dh, auth}} ] }.
//
// ⚠ TODO version multi-utilisateur : déplacer VAPID_PRIVATE en variable d'env
// Vercel et associer les abonnements à un utilisateur.
// ────────────────────────────────────────────────────────────────────────────

import webpush from 'web-push';
import crypto from 'node:crypto';

import { withOwnerAll, conflictTarget, proprietaireCourant } from './owner.js';
import { sbCle } from './cle.js';
import { accesVendeur } from './abonnement.js';

// La base sait-elle séparer les vendeurs ? Trois réponses, jamais deux :
// 200 → oui · 400 (colonne inconnue) → non · le reste (522, délai) → PAS SU.
// ⚠️ « Pas su » valait « non » ET restait en mémoire pour toute la vie de
//    l'instance : la liste des appareils se lisait alors SANS filtre, donc
//    celle du premier vendeur venu — une vente de Julien faisait sonner le
//    téléphone de quelqu'un d'autre. Pas su ⇒ on filtre quand même (au pire la
//    lecture échoue et on n'envoie rien) et on ne mémorise rien.
let _cl = null;
export const cloisonnee = async () => {
  if (_cl !== null) return _cl;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?select=owner&limit=1`, { headers: HEADERS });
    if (r.ok) _cl = true;
    else if (r.status === 400) _cl = false;
    else return true;
  } catch (_) { return true; }
  return _cl;
};

// Le vendeur dont on lit/écrit les appareils : celui de la requête (session
// vérifiée, adresse de réception d'un email, tour du rappel quotidien), sinon le
// propriétaire de l'installation. ⚠️ Jamais « tout le monde » : sur une base
// cloisonnée sans vendeur, on ne lit rien et on n'écrit rien.
const OWNER_INSTALL = process.env.VRM_OWNER_UID || '';
export const vendeurDuPush = () => proprietaireCourant() || OWNER_INSTALL;
async function pourCeVendeur(url) {
  if (!(await cloisonnee())) return url;            // une seule boutique : inchangé
  const o = vendeurDuPush();
  if (!o) return null;
  return url + (url.includes('?') ? '&' : '?') + `owner=eq.${encodeURIComponent(o)}`;
}

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
// ⚠️ CLÉ DE SERVICE QUAND ELLE EXISTE. Ces routes tournent sur le serveur, sans
// vendeur connecté : à la seconde où la base est cloisonnée (RLS), la clé
// publique ne peut plus rien lire ni écrire et l'endpoint devient muet — c'est
// LE blocage qui empêchait d'activer le multi-vendeurs. On prend donc
// `SUPABASE_SERVICE_KEY` (variable d'environnement Vercel, jamais dans le
// dépôt) si elle est définie, et on retombe sur la clé publique tant qu'elle ne
// l'est pas : le comportement d'aujourd'hui reste identique.
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxnb254enJ6amNxdGhqdGJkcHpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1ODIyMjYsImV4cCI6MjA5NTE1ODIyNn0.QJQSKILJLEpbDvBP4w7xD-olxoUjX1H2rxrYdo63GWQ';

export const VAPID_PUBLIC = 'BIImaPEF-sZb0ohfXGjjR2eKYVVAyz1I3-fYXNlsSUrTQfGM4le_OxJbUML2YyL5ctFea-LS7NfPD9RotDJ0bbc';
// ⚠️⚠️ LA CLÉ PRIVÉE NE VIT QUE DANS L'ENVIRONNEMENT, JAMAIS DANS LE DÉPÔT.
// Elle était écrite ici en repli — et le dépôt est PUBLIC : n'importe qui
// pouvait donc envoyer une notification sur les téléphones du vendeur.
// La paire a été régénérée (l'ancienne est morte) ; la nouvelle clé privée se
// colle dans les variables d'environnement Vercel sous `VAPID_PRIVATE_KEY`.
// ⚠️ Plus AUCUN repli en dur : sans la variable, on n'envoie rien et on le dit
// (`pushConfigure()`), au lieu de repartir sur une clé connue de tous.
// L'adresse de contact (exigée par la norme Web Push, transmise au service de
// notification) vient de `PUSH_CONTACT` — ce n'est pas un secret, mais ce n'est
// pas non plus au dépôt de porter l'email personnel de quelqu'un.
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '';
const PUSH_CONTACT = process.env.PUSH_CONTACT || 'mailto:contact@vrm.center';

export const pushConfigure = () => {
  if (!VAPID_PRIVATE) return false;
  try { webpush.setVapidDetails(PUSH_CONTACT, VAPID_PUBLIC, VAPID_PRIVATE); return true; }
  catch (_) { return false; }
};
const PUSH_PRET = pushConfigure();

const HEADERS = {
  ...sbCle(SUPABASE_KEY),
  'Content-Type': 'application/json',
};

// ── CE QU'ON NOTIFIE, ET CE QU'ON NE NOTIFIE PAS ────────────────────────────
// Julien : « des fois je reçois des choses complètement débiles ». Mesuré : un
// push partait à CHAQUE étape de colis — sur ses 94 emails de suivi, **54 sont
// "en transit" et 7 "info"**, soit 61 notifications qui n'appellent aucune
// action. Idem « achat confirmé » (il vient de l'acheter), favoris, messages.
//
// RÈGLE : on ne sonne que pour de l'ARGENT ou une ACTION à faire. Le reste se
// consulte dans l'app, où le badge suffit.
// ⚠️ Une seule définition, partagée par le pipeline email ET le rappel quotidien
//    (§11) — sinon les deux finiraient par ne pas notifier la même chose.
export const PUSH_DEFAUT = {
  vente:    true,   // une paire est vendue
  argent:   true,   // virement reçu
  colis:    true,   // colis à retirer (porte le code de retrait)
  offre:    true,   // une offre attend une réponse
  expedier: true,   // colis à poster (rappel quotidien)
  urssaf:   true,   // rappel de déclaration, le 1er du mois
  bilan:    true,   // bilan de la semaine, le lundi matin (api/_lib/bilan-semaine.js)
  suivi:    false,  // « en transit », « livré » : rien à faire
  achat:    false,  // tu viens de l'acheter, tu le sais
  message:  false,  // le badge de l'app suffit
  favori:   false,  // Vinted en envoie beaucoup
  facture:  false,
};
// Réglage du vendeur (Réglages → Notifications), lu depuis la base.
// Absent ⟹ on prend le défaut ci-dessus.
//
// ⚠️⚠️ « PAS SU » RETOMBAIT SUR LE DÉFAUT, ET LE DÉFAUT DE « MESSAGE » EST NON
//    (11 octobre, reproduit sur la vraie route — banc `notif-messages.cjs`).
//    Julien a activé les messages ; un simple hoquet de lecture de `push_prefs`
//    (522, la base debout par ailleurs) les rendait muets. Trois états, jamais
//    deux : la préférence est LUE (elle décide), ABSENTE (le défaut décide), ou
//    PAS SUE — et alors, dans l'ordre :
//      1. on RELIT une fois (un hoquet) ;
//      2. la dernière préférence lue pour CE vendeur par cette instance ;
//      3. la dernière préférence lue, GARDÉE AVEC SES APPAREILS (`push_subs.prefs`,
//         une copie écrite par le serveur quand il la lit — cette ligne-là est lue
//         de toute façon avant d'envoyer) : elle survit à une instance froide ;
//      4. à défaut, le DÉFAUT de la catégorie.
// ⚠️⚠️ REVUE DU 11 OCTOBRE : la première version sonnait pour les messages sur
//    TOUTE instance froide qui ne lisait pas les préférences (`SONNE_SI_PAS_SU`),
//    y compris chez un vendeur qui ne les a jamais activés ou qui les a COUPÉS à
//    la main — Vercel démarre des instances froides sans cesse. « Pas su » ne
//    vaut pas « oui » pour une catégorie coupée par défaut : seule une trace de
//    SA préférence (2 ou 3) peut la faire sonner.
const _prefsVues = new Map();                       // vendeur → dernières préférences LUES
const _copieVue = new Map();                        // vendeur → la copie déjà rangée avec ses appareils (JSON)
export const oublierPrefsVues = () => { _prefsVues.clear(); _copieVue.clear(); };   // bancs : instance froide
const decider = (prefs, cat) => {
  const v = prefs[cat];
  return typeof v === 'boolean' ? v : (PUSH_DEFAUT[cat] !== false);
};
// Rend les préférences lues (`{}` si la ligne n'existe pas), ou `null` = pas su.
async function lirePrefs() {
  try {
    // ⚠️ On passait ici `await cloisonnee()` — un BOOLÉEN — là où l'aide attend
    //    la fonction : dès qu'un vendeur était connu, l'appel levait, et ses
    //    préférences de notification étaient ignorées (le défaut s'appliquait).
    const url = await pourCeVendeur(`${SUPABASE_URL}/rest/v1/app_data?id=eq.push_prefs&select=data`);
    if (!url) return null;
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) return null;
    const rows = await res.json();
    if (!Array.isArray(rows)) return null;          // 522 : c'est du HTML, pas du JSON
    const d = rows[0] && rows[0].data;
    return (d && typeof d === 'object') ? d : {};
  } catch (_) { return null; }
}
// La copie des préférences gardée avec les appareils. On ne l'écrit que si elle
// a CHANGÉ (une fois par instance, ou quand il bascule un réglage), par la même
// écriture conditionnelle que la liste — qui n'est jamais touchée ici. Pas de
// ligne d'appareils ⇒ rien à protéger, on ne la crée pas.
async function copierPrefs(qui, prefs) {
  const json = JSON.stringify(prefs || {});
  if (_copieVue.get(qui) === json) return;
  for (let i = 0; i < 3; i++) {
    const lu = await lireSubsVersion();
    if (!lu || !lu.existe) return;
    if (JSON.stringify(lu.prefs || null) === json) { _copieVue.set(qui, json); return; }
    const e = await ecrireSubsSi(lu, lu.subs, prefs || {});
    if (e === 'ok') { _copieVue.set(qui, json); return; }
    if (e === 'ko') return;
  }
}
export async function pushCategorieActive(cat) {
  if (!cat) return true;
  const qui = vendeurDuPush() || '';
  let lues = await lirePrefs();
  if (!lues) lues = await lirePrefs();              // un hoquet : on relit une fois
  if (lues) {
    _prefsVues.set(qui, lues);
    try { await copierPrefs(qui, lues); } catch (_) {}
    return decider(lues, cat);
  }
  const vues = _prefsVues.get(qui);
  if (vues) return decider(vues, cat);
  const lu = await lireSubsVersion();
  if (lu && lu.prefs) return decider(lu.prefs, cat);
  return PUSH_DEFAUT[cat] !== false;
}

export async function loadSubs() {
  try {
    // ⚠️ Les abonnements sont PAR VENDEUR : sans ce filtre, une vente de Julien
    // ferait sonner le téléphone de Marie.
    const url = await pourCeVendeur(`${SUPABASE_URL}/rest/v1/app_data?id=eq.push_subs&select=data`);
    if (!url) return null;                              // aucun vendeur : on ne lit pas ceux des autres
    const res = await fetch(url, { headers: HEADERS });
    // ⚠️⚠️ `[]` VOULAIT DIRE DEUX CHOSES, ET LA SECONDE EFFAÇAIT SES TÉLÉPHONES.
    // « aucun appareil abonné » et « je n'ai pas pu lire la liste » rendaient la
    // MÊME valeur. Or `subscribe` fait lire-ajouter-réécrire : une lecture
    // ratée repartait donc d'une liste vide et RÉÉCRIVAIT `push_subs` avec le
    // seul appareil courant — les autres téléphones, supprimés, sans un mot.
    // `null` = « pas su ». L'appelant ne doit alors ni écrire ni conclure.
    if (!res.ok) return null;
    const rows = await res.json();
    if (!Array.isArray(rows)) return null;              // 522 : c'est du HTML, pas du JSON
    return (rows[0] && rows[0].data && Array.isArray(rows[0].data.subs)) ? rows[0].data.subs : [];
  } catch (_) { return null; }
}

// ⚠️ `saveSubs` (réécriture INCONDITIONNELLE de la liste) est retirée le
//    11 octobre : c'est elle qui faisait perdre un appareil quand deux écrivaient
//    en même temps. Toute écriture de `push_subs` passe par `modifierSubs`
//    ci-dessous — qui garde les deux leçons d'avant : on ne dit « activé » que
//    si la base a CONFIRMÉ l'écriture, et sur une base cloisonnée la ligne porte
//    le vendeur DE LA REQUÊTE (jamais celui de l'installation : l'appareil d'un
//    second vendeur aurait reçu les ventes de Julien).

// ── MODIFIER LA LISTE DES APPAREILS SANS EN PERDRE UN ─────────────────────
// ⚠️⚠️ LIRE-AJOUTER-RÉÉCRIRE SANS VERROU (11 octobre, reproduit sur la vraie
//    route). L'iPhone et Chrome qui s'abonnent en même temps lisent tous deux
//    la même liste, ajoutent chacun le sien et réécrivent : le second efface le
//    premier — et l'app avait répondu « activé » aux deux. Même chose quand un
//    envoi purge un appareil disparu pendant qu'un autre s'abonne. (Et chaque
//    ouverture de l'app réécrivait la liste deux fois, même sans rien changer.)
// ⇒ Une écriture CONDITIONNELLE, sans migration : la liste porte une marque de
//   version (`rev`, tirée au hasard à chaque écriture). On ne réécrit QUE si la
//   ligne porte encore la marque qu'on a lue (`PATCH … &data->>rev=eq.<lue>`,
//   que Postgres réévalue au moment d'écrire) ; sinon quelqu'un a écrit entre-
//   temps : on relit et on recommence. Une ligne qui n'existe pas encore se crée
//   SANS écraser (`ignore-duplicates`) : si un autre l'a créée à la même
//   milliseconde, on relit et on ajoute. Une ligne d'avant (sans `rev`) se
//   modifie par `data->>rev=is.null` — la première écriture lui en donne une.
// `fn(liste)` rend la nouvelle liste, ou `null` = rien à changer (on n'écrit pas).
// Rend `{ ok:true, subs, ecrit }` ou `{ ok:false, raison:'lecture'|'ecriture'|'conflit' }`.
const nouvelleRev = () => {
  try { return crypto.randomUUID(); } catch (_) { return `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
};
async function lireSubsVersion() {
  try {
    const url = await pourCeVendeur(`${SUPABASE_URL}/rest/v1/app_data?id=eq.push_subs&select=data`);
    if (!url) return null;
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) return null;
    const rows = await res.json();
    if (!Array.isArray(rows)) return null;
    const d = rows[0] && rows[0].data;
    if (!rows[0]) return { existe: false, subs: [], rev: null, prefs: null };
    return { existe: true, subs: (d && Array.isArray(d.subs)) ? d.subs : [], rev: (d && d.rev != null) ? String(d.rev) : null,
      prefs: (d && d.prefs && typeof d.prefs === 'object' && !Array.isArray(d.prefs)) ? d.prefs : null };
  } catch (_) { return null; }
}
// `prefs` (facultatif) remplace la copie des préférences ; sinon celle qu'on a
// LUE est gardée telle quelle — une modification de la liste ne la perd jamais.
async function ecrireSubsSi(lu, subs, prefs) {
  try {
    const copie = prefs !== undefined ? prefs : lu.prefs;
    const data = { subs, updatedAt: new Date().toISOString(), rev: nouvelleRev(), ...(copie ? { prefs: copie } : {}) };
    const enTetes = { ...HEADERS, Prefer: 'return=representation' };
    if (lu.existe) {
      const filtre = lu.rev == null ? 'data->>rev=is.null' : `data->>rev=eq.${encodeURIComponent(lu.rev)}`;
      const url = await pourCeVendeur(`${SUPABASE_URL}/rest/v1/app_data?id=eq.push_subs&${filtre}`);
      if (!url) return 'ko';
      const r = await fetch(url, { method: 'PATCH', headers: enTetes, body: JSON.stringify({ data }) });
      if (!r || !r.ok) return 'ko';
      const j = await r.json().catch(() => null);
      if (!Array.isArray(j)) return 'ko';
      return j.length ? 'ok' : 'conflit';
    }
    let row, conflit;
    if (await cloisonnee()) {
      const o = vendeurDuPush();
      if (!o) return 'ko';
      row = { owner: o, id: 'push_subs', data }; conflit = 'owner,id';
    } else {
      row = withOwnerAll([{ id: 'push_subs', data }])[0]; conflit = conflictTarget('id');
    }
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?on_conflict=${conflit}`, {
      method: 'POST',
      headers: { ...HEADERS, Prefer: 'resolution=ignore-duplicates,return=representation' },
      body: JSON.stringify([row]),
    });
    if (!r || !r.ok) return 'ko';
    const j = await r.json().catch(() => null);
    if (!Array.isArray(j)) return 'ko';
    return j.length ? 'ok' : 'conflit';
  } catch (_) { return 'ko'; }
}
export async function modifierSubs(fn, essais = 6) {
  for (let i = 0; i < essais; i++) {
    const lu = await lireSubsVersion();
    if (lu === null) return { ok: false, raison: 'lecture' };   // « pas su » : on n'écrit rien
    const suivante = fn(lu.subs.slice());
    if (!Array.isArray(suivante)) return { ok: true, subs: lu.subs, ecrit: false };
    const e = await ecrireSubsSi(lu, suivante);
    if (e === 'ok') return { ok: true, subs: suivante, ecrit: true };
    if (e === 'ko') return { ok: false, raison: 'ecriture' };
    // 'conflit' : quelqu'un a écrit entre notre lecture et la nôtre — on relit.
  }
  return { ok: false, raison: 'conflit' };
}

// ⚠️ UN ABONNEMENT SCELLÉ SUR UNE ANCIENNE CLÉ EST MORT POUR TOUJOURS.
// Un abonnement push est scellé à la clé PUBLIQUE avec laquelle il a été créé.
// Quand la paire change (ça est arrivé : §5.53 puis §5.77), les abonnements
// déjà posés deviennent définitivement inutilisables — mais ils restent dans la
// liste et sont comptés comme des appareils vivants. Mesuré en direct sur les
// 2 appareils du vendeur :
//     Chrome/FCM → 403 « the VAPID credentials in the authorization header do
//                        not correspond to the credentials used to create the
//                        subscription »
//     Apple      → 400 {"reason":"VapidPkHashMismatch"}
// Sans ce test, « 2 appareils abonnés » s'affiche pendant que rien n'arrive :
// exactement la panne silencieuse qui a coûté six jours.
// ⚠️ On NE purge PAS sur un 403/400 nu — un refus passager ou une charge mal
// formée effacerait tous les appareils d'un coup. On exige le MOTIF.
const cleSansRapport = (e) => {
  const code = e && e.statusCode;
  if (code !== 400 && code !== 403) return false;
  const txt = String((e && (e.body || e.message)) || '').toLowerCase();
  return /vapidpkhashmismatch/.test(txt)
      || (/vapid/.test(txt) && /(do not correspond|mismatch|invalid)/.test(txt));
};

// ── MODE STREAM (15 octobre) ──────────────────────────────────────────────────
// Le vendeur a allumé le mode stream dans l'app (`vrm_mode_stream`, ligne `main`,
// synchronisée) : il filme ou partage son écran, et son téléphone est souvent
// posé à côté. Ses notifications ne portent alors ni montant, ni nom (acheteur,
// compte), ni code de retrait, ni texte de message — seulement ce qui s'est
// passé (« 💸 Vendu ! », « 💬 Nouveau message ») et « Ouvre VRM ». C'est
// l'APP qui possède le réglage (§11) ; le serveur le LIT, en scalaire (§4.4).
// Trois états : allumé · coupé · PAS SU ⇒ on TAIT le détail. Une notification
// sans détail coûte peu ; un chiffre d'affaires à l'écran pendant un live, non.
// ⚠️ AUCUN « DERNIER ÉTAT CONNU » (relecture du 15 octobre) : une mémoire par
//    instance rendait « coupé » sur une lecture RATÉE — il pouvait l'avoir
//    allumé entre-temps, et la vente partait avec son montant et son login. Une
//    lecture ratée vaut « pas su », à chaque envoi.
export async function streamDuVendeur() {
  for (let i = 0; i < 2; i++) {                     // un hoquet : on relit une fois
    try {
      const url = await pourCeVendeur(`${SUPABASE_URL}/rest/v1/app_data?id=eq.main&select=s:data->vrm_mode_stream`);
      if (!url) break;
      const res = await fetch(url, { headers: HEADERS });
      if (!res.ok) continue;
      const rows = await res.json();
      if (!Array.isArray(rows)) continue;            // 522 : du HTML, pas du JSON
      const v = rows[0] ? rows[0].s : null;
      return v === true || !!(v && typeof v === 'object' && v.on === true);
    } catch (_) { /* relire */ }
  }
  return null;
}
const MONTANT_SRV = /[+\-−]?\d[\d\s.,\u00a0\u202f]*\s*(?:€|EUR\b|euros?\b)/gi;
// Le titre garde ce qui s'est passé, jamais qui ni combien ; le corps, rien.
export function notifStream(payload) {
  const p = payload || {};
  let t = String(p.title || '');
  if (/^💬/u.test(t)) t = '💬 Nouveau message';
  else if (/^💰\s*Offre/iu.test(t)) t = '💰 Nouvelle offre';
  else if (/^📊/u.test(t)) t = '📊 Ton bilan de la semaine';
  else if (new RegExp(MONTANT_SRV.source, 'i').test(t)) t = t.replace(MONTANT_SRV, '').replace(/\s{2,}/g, ' ').replace(/[\s—–-]+$/u, '').trim();
  return { ...p, title: t || 'VRM', body: 'Ouvre VRM pour voir le détail.' };
}

// Envoie la notification à tous les appareils abonnés.
// Les abonnements morts (appli désinstallée, permission retirée) sont purgés,
// ainsi que ceux scellés sur une clé qui n'est plus la nôtre (voir ci-dessus).
export async function sendPushToAll(payload) {
  // ⚠️ QUI NE PAIE PLUS NE REÇOIT PLUS RIEN (Julien, 4 octobre). La règle est
  //    celle de la base (`vrm_acces_pour`), la même qui ferme ses données. On
  //    ne touche PAS à sa liste d'appareils : il reprend l'abonnement, les
  //    notifications reviennent sans rien réactiver. « Pas su » ne coupe pas.
  const owner = vendeurDuPush();
  if (owner && (await accesVendeur(owner)) === false) return { sent: 0, total: null, coupe: 'abonnement' };
  // ⚠️ Sans clé privée (variable d'environnement absente), on n'envoie RIEN et
  // on le dit clairement — plutôt que de repartir sur la clé qui traînait dans
  // le dépôt public. Un envoi silencieusement impossible est pire qu'un refus
  // explicite : le vendeur croirait ses notifications actives.
  // ⚠️ ON COMPTE QUAND MÊME LES APPAREILS. Renvoyer `total: 0` parce qu'on
  // abandonne avant de lire la liste est un MENSONGE : l'app lit ce chiffre et
  // affichait « Aucun appareil abonné » alors que les 2 téléphones du vendeur
  // étaient bien enregistrés (mesuré le 31 août : 2 abonnements, rafraîchis le
  // matin même à 06:59). Il a donc cherché du côté de son téléphone pendant que
  // le problème était la clé du serveur. `total` veut dire « appareils
  // abonnés », jamais « ce qu'on a réussi à faire ».
  if (!PUSH_PRET) {
    const abonnes = await loadSubs();
    // Même règle un cran plus loin : `total: 0` sur une liste qu'on n'a PAS pu
    // lire serait « aucun appareil abonné ». On rend `null` — « pas su ».
    return { sent: 0, total: abonnes === null ? null : abonnes.length, erreur: 'VAPID_PRIVATE_KEY absente' };
  }
  const subs = await loadSubs();
  if (subs === null) return { sent: 0, total: null, erreur: 'base-injoignable' };
  if (!subs.length) return { sent: 0, total: 0 };
  // Mode stream : allumé OU pas su ⇒ sans détail (voir `notifStream`).
  const stream = await streamDuVendeur();
  const body = JSON.stringify(stream === false ? payload : notifStream(payload));
  const alive = [];
  let sent = 0, perimes = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification(s, body);
      alive.push(s); sent += 1;
    } catch (e) {
      const code = e && e.statusCode;
      const mort = code === 404 || code === 410;      // appareil disparu
      const perime = cleSansRapport(e);               // scellé sur une clé morte
      if (perime) perimes += 1;
      if (!mort && !perime) alive.push(s);            // erreur passagère : on garde
    }
  }
  // ⚠️ On ne retire QUE les appareils morts, de la liste TELLE QU'ELLE EST
  //    MAINTENANT (écriture conditionnelle) : réécrire `alive` effaçait un
  //    appareil qui venait de s'abonner pendant l'envoi.
  if (alive.length !== subs.length) {
    const vivants = new Set(alive.map((s) => s.endpoint));
    const retires = new Set(subs.filter((s) => !vivants.has(s.endpoint)).map((s) => s.endpoint));
    await modifierSubs((cur) => {
      const reste = cur.filter((s) => !(s && retires.has(s.endpoint)));
      return reste.length === cur.length ? null : reste;
    });
  }
  // `perimes` remonte jusqu'à l'écran : « 0 envoyé sur 2 » ne dit pas POURQUOI,
  // « 2 appareils scellés sur une ancienne clé » dit quoi faire (rouvrir l'app).
  return { sent, total: subs.length, ...(perimes ? { perimes } : {}) };
}
