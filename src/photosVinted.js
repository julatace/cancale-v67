// ── LES PHOTOS DU CDN DE VINTED, ET LEUR SECOURS PAR L'EXTENSION (11 octobre) ──
// Julien, 11 octobre : « quand je suis dans VRM, je n'ai plus les photos des
// paires — ni dans les annonces, ni dans les bordereaux, ni dans les ventes ».
//
// Mesuré avant d'écrire (lecture seule) : les DONNÉES sont intactes (chaque
// annonce porte `photo.url` = https://images1.vinted.net/t/…/f800/….jpeg?s=…),
// et le code d'affichage n'avait PAS changé dans le déploiement. La cause est
// donc très probablement EXTÉRIEURE : le CDN de Vinted qui refuse désormais
// l'affichage hors de son site (en-tête Cross-Origin-Resource-Policy, ou
// anti-hotlink sur le référent), ou un logiciel de protection local. Ce n'est
// PAS prouvé — c'est pourquoi ce module MESURE dans son navigateur (`sonder`).
//
// Ce que fait ce module, et c'est UNE règle pour toute l'app (§11) :
//   1. chaque photo du CDN Vinted part SANS référent (`no-referrer`) — une
//      protection par référent laisse presque toujours passer « aucun » ;
//   2. si elle ne s'affiche quand même pas, l'EXTENSION va chercher les octets
//      (le pont « photo », présent depuis très longtemps : une requête de son
//      service worker n'est soumise ni à CORP ni au référent de la page —
//      mesuré par la relecture du 11 octobre avec la vraie extension) ;
//      on en fait une URL objet ;
//   3. un cache par URL, borné à MAX_ENTREES entrées hors écran (URL objet
//      révoquées à l'éviction), au plus MAX_EN_VOL demandes à la fois, et
//      AUCUNE demande pour une image hors écran ;
//   4. sans secours possible ici (téléphone, autre navigateur, extension
//      muette, secours refusé) : le pictogramme, jamais une image cassée — et
//      la phrase de la coque (`decision`) dit ce qui se passe et le geste.
//
// ⚠️⚠️ REVUE DU 11 OCTOBRE (deux relecteurs, défauts REPRODUITS) — ce qui a changé :
//   · un échec du navigateur n'est plus FIGÉ pour la session : un réseau qui
//     hoquette (PWA qui se réveille) laissait 36 pictogrammes jusqu'au
//     rechargement, alors que 219150e réessayait à chaque affichage. Nouvel
//     essai borné : un TÉMOIN (une seule photo, 20 s puis ×2 jusqu'à 5 min,
//     onglet visible), l'événement `online`, et une photo remontée plus d'une
//     minute après son échec. Dès qu'une photo qui avait échoué passe, tout
//     réessaie et la sonde mesure à nouveau ;
//   · la sonde n'affirme plus « le navigateur bloque » sur UNE erreur réseau :
//     une coupure donne la même TypeError que CORP. Il en faut deux, espacées,
//     sur deux photos — et même alors la phrase dit ce qui est mesuré (« ce
//     navigateur n'arrive pas à les charger ici ») ; « refusées dans VRM »
//     n'est dit que si l'extension, elle, les a récupérées ;
//   · un DÉLAI de l'extension n'est pas un REFUS : la place reste prise
//     jusqu'à la vraie réponse (plafond 30 s), un délai remet la photo en
//     attente pour un nouvel essai, jamais en « perdue » ;
//   · la phrase se juge sur ce qui est MONTÉ maintenant, plus sur la session :
//     une photo affichée sur Ventes faisait taire la phrase sur Annonces.
//
// ⚠️⚠️ SECONDE REVUE DU 11 OCTOBRE (sept constats confirmés, cinq défauts distincts) — ce qui a changé :
//   · une réponse SANS octets de l'extension n'est plus un refus DÉFINITIF. Le
//     pont (bridge.js) ne transmet que `dataUrl` : un lien mort (404), un 503 ou
//     un 429 du CDN, une coupure du service worker arrivent IDENTIQUES ici. Un
//     refus est donc « pas su, avec recul » : le TÉMOIN redemande à l'extension
//     (au plus 3 photos à l'écran par passage, les moins redemandées d'abord ;
//     20 s puis ×2 jusqu'à 5 min), une photo remontée la redemande après son
//     recul (1, 2, 4, puis 5 min), `online` et le retour de l'extension la
//     redemandent ; et dès qu'UNE photo refusée revient par l'extension, toutes
//     les autres sont redemandées (elle sait de nouveau faire) — sauf un lien
//     déjà redemandé dans la même vague, qui attend son recul. Sans ça, un hoquet de quelques secondes laissait 15 pictogrammes
//     jusqu'au rechargement, sous « rien à régler ici » ;
//   · plus RIEN n'est « définitif » (`estDefinitive`) : tout ce qui empêche une
//     photo de s'afficher se défait (réseau, extension, témoin). Ma journée,
//     Achats et Colis ne la retirent donc plus de leur liste — elle garde sa
//     place avec le pictogramme, et revient d'elle-même ;
//   · le bilan `diag_photos` dit aussi le RETOUR : une photo revenue après un
//     échec le fait réécrire (au plus une fois toutes les 15 s), et une session
//     où tout s'affiche propose un bilan « sans échec », que l'écriture ne range
//     QUE pour remplacer un échec rangé par ce navigateur ;
//   · une seconde sonde qui reçoit une réponse après une erreur réseau, sur la
//     MÊME photo, prouve que le réseau est revenu : tout réessaie tout de suite,
//     sans phrase (un téléphone qui se réveille affichait « le serveur répond,
//     mais ses images ne s'affichent pas » pendant 12 s) ;
//   · hors ligne MESURÉ (`navigator.onLine === false`) est une cause : « pas de
//     connexion », jamais « je n'ai pas pu mesurer » ni « va sur l'ordinateur ».
//
// ⚠️ « Pas su » ne vaut pas « oui » : tant que l'extension n'a pas pu se
//    manifester (les premières secondes), on n'affirme pas qu'il n'y a pas de
//    secours. Les dépendances (le pont, l'état de l'extension, l'écriture du
//    bilan) sont INJECTÉES par App.jsx : ce module ne sait rien de Supabase ni
//    du pont, il est exécutable seul (scripts/audit-photos-vinted.cjs le fait).

// Le CDN d'images de Vinted, et RIEN d'autre : un nom qui IMITE vinted.net
// (« evilvinted.net ») ne passe pas (durcissement, revue du 11 octobre).
// ⚠️ Plus strict que le pont de l'extension (`[\w.-]*vinted\.net`), qu'on ne
//    touche pas ici : l'app ne lui envoie que ce qui passe CETTE règle.
export const RE_PHOTO_VINTED = /^https:\/\/(?:[a-z0-9-]+\.)*vinted\.net\//i;
export const estPhotoVinted = (u) => typeof u === 'string' && RE_PHOTO_VINTED.test(u);

export const MAX_ENTREES = 300;
export const MAX_EN_VOL = 3;
// Le plafond DUR d'une demande à l'extension : la place reste prise jusque-là
// (un délai plus court libérait la place côté app pendant que le service worker
// travaillait encore — jusqu'à 6 demandes chez lui, mesuré).
export const DELAI_SECOURS_MS = 30000;
// Deux délais d'affilée : on n'insiste plus sans nouveau signal (remontage,
// témoin, `online`, retour de l'extension). « Pas su », jamais « perdue ».
export const MAX_DELAIS = 2;
export const SONDE_DELAI_MS = 10000;
export const SONDE_ECART_MS = 8000;
export const RELANCE_MONTAGE_MS = 60000;
export const TEMOIN_PREMIER_MS = 20000;
export const TEMOIN_MAX_MS = 5 * 60e3;
export const TEMOIN_DELAI_MS = 15000;
// Moins de SEUIL_PHRASE photos perdues à l'écran : des liens morts isolés, le
// pictogramme suffit.
export const SEUIL_PHRASE = 3;
// Le premier bilan part peu après le premier échec (le temps que la sonde et
// les premiers secours répondent), les suivants au plus une fois toutes les 10 min.
export const BILAN_PREMIER_MS = 6000;
export const BILAN_INTERVALLE_MS = 10 * 60e3;
// Un RETOUR (une photo qui avait échoué s'affiche) change ce que dit le bilan :
// il part sans attendre les 10 min, mais jamais deux fois en 15 s.
export const BILAN_URGENT_ECART_MS = 15000;
// Le recul d'une photo que l'extension a rendue SANS octets, avant qu'un
// remontage (ou une reprise) la lui redemande : 1, 2, 4, puis 5 min.
export const reculRefus = (n) => Math.min(TEMOIN_MAX_MS, RELANCE_MONTAGE_MS * Math.pow(2, Math.max(0, (n | 0) - 1)));
// « Le réseau est revenu » (seconde sonde) relance tout — au plus une fois par minute.
export const REPRISE_RESEAU_MIN_MS = 60000;

// ── Les dépendances (injectées par App.jsx) ─────────────────────────────────
// demander(url) → Promise<{ dataUrl, issue }> : le pont « photo » de l'extension
//                 issue : 'ok' · 'refus' (elle a répondu SANS octets) · 'delai'
//                 (pas de réponse avant DELAI_SECOURS_MS — « pas su »).
//                 Une chaîne (data URL) ou `null` restent compris (ancien contrat).
// secours()     → 'oui' | 'attente' | 'non' : peut-on demander ICI ?
//                 'attente' = pas encore su (l'extension se manifeste après le chargement)
// ext()         → 'presente' | 'absente' | 'muette'
// ecrire(bilan) → Promise<bool>            : range le bilan dans SA ligne
// chargerImage(url) → Promise<bool>        : le témoin (par défaut : `new Image()`, sans référent)
const deps = { demander: null, secours: () => 'non', ext: () => 'absente', ecrire: null, chargerImage: null };
export function configurer(d) {
  Object.assign(deps, d || {});
  dernierSecours = null;
  toutNotifier();
  pomper();
  planifierTemoin();
  // Un bilan noté avant que l'écriture soit branchée part maintenant.
  if (d && d.ecrire && bilanSale) planifierBilan();
}
const maintenant = () => Date.now();
const secoursIci = () => { try { return deps.secours(); } catch (_) { return 'non'; } };

// Appelé quand l'état de l'extension change (elle apparaît, se tait, revient).
// Le battement de l'extension prévient toutes les 20 s : on ne redessine les
// photos que si la réponse à « peut-on demander ici ? » a CHANGÉ.
// ⚠️ Quand l'extension (RE)DEVIENT disponible, les photos qu'elle avait laissées
//    en délai OU rendues sans octets retrouvent leurs essais : son retour est un
//    signal neuf (son service worker a pu échouer pour une raison passagère).
let dernierSecours = null;
// (22 oct.) Avec une session, le secours vaut « oui » en permanence (la route
// serveur) : le retour de l'extension ne CHANGE plus la réponse ci-dessus. Une
// extension qui REDEVIENT présente (elle était muette ou absente) reste un
// signal neuf — sans ça, une photo refusée pendant qu'elle se taisait attendait
// son recul avant d'être redemandée. ⚠️ Avec le RECUL (`rouvrirTout(true)`,
// revue du 22 oct.) : une extension qui alterne muette/présente redemandait
// chaque lien mort à chaque retour (16 demandes par lien en 10 min contre 3
// avant — la borne « quinze retours, quinze demandes » du 11 octobre). Une
// photo jamais rouverte, elle, est redemandée tout de suite.
let derniereExt = null;
export function secoursChange() {
  const s = secoursIci();
  let x = 'absente'; try { x = deps.ext(); } catch (_) {}
  const extRevenue = derniereExt !== null && derniereExt !== 'presente' && x === 'presente';
  derniereExt = x;
  if (s !== dernierSecours) {
    const avant = dernierSecours;
    dernierSecours = s;
    if (s === 'oui' && avant !== null && avant !== 'oui') rouvrirTout();
    toutNotifier();
  } else if (extRevenue && s === 'oui') rouvrirTout(true);
  pomper();
  planifierTemoin();
}

// ── Le cache par URL ────────────────────────────────────────────────────────
// etat : 'natif' (on laisse le navigateur l'afficher) · 'attente' (le navigateur
// a échoué, on attend le secours) · 'vol' (demandée à l'extension) · 'ok' (URL
// objet prête) · 'ko' (l'extension a répondu sans image, ou ses octets ne sont
// pas une image — JAMAIS définitif : redemandé au témoin, après son recul, au
// retour du réseau ou de l'extension).
// echecAt : la dernière fois que cette photo a échoué (navigateur, refus, délai).
// refus : l'extension a répondu SANS octets — on ne lui redemande pas avant
//         `reculRefus(refusN)` (ou un signal neuf). refusAt : quand.
// delais : demandes restées sans réponse (« pas su », jamais un refus).
// rouvert : redemandée après un refus ou deux délais (si elle revient, toutes
//           les autres sont redemandées : l'extension sait de nouveau faire).
// rouvertAt : quand elle a été redemandée ainsi pour la dernière fois.
// natifOk : affichée par le navigateur lui-même, maintenant.
const entrees = new Map();
function entree(url, creer) {
  let e = entrees.get(url);
  if (!e && creer) {
    e = { etat: 'natif', blob: null, refs: 0, visibles: new Set(), abonnes: new Set(), essaisBlob: 0,
      echecAt: 0, refus: false, refusN: 0, refusAt: 0, delais: 0, rouvert: false, rouvertAt: 0, natifOk: false };
    entrees.set(url, e);
  }
  return e || null;
}
// Moins récemment servie en tête : on la remet en queue à chaque usage.
function toucher(url) { const e = entrees.get(url); if (e) { entrees.delete(url); entrees.set(url, e); } }
function ranger() {
  if (entrees.size <= MAX_ENTREES) return;
  for (const [u, e] of entrees) {
    if (entrees.size <= MAX_ENTREES) break;
    // Jamais une photo à l'écran, ni une demande en vol : on ne range que ce
    // que plus personne ne regarde.
    if (e.refs > 0 || e.etat === 'vol') continue;
    if (e.blob) { try { URL.revokeObjectURL(e.blob); } catch (_) {} }
    entrees.delete(u);
  }
}

// ── Ce que la session a vu (le bilan) — jamais une URL ─────────────────────
// Des empreintes, pas des adresses : le bilan ne compte que des NOMBRES.
const empreinte = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h; };
const vus = { okNatif: new Set(), koNatif: new Set(), secoursOk: new Set(), secoursKo: new Set(), retours: new Set() };
let nDelais = 0, nTemoins = 0, nRedemandes = 0;
let sondeVue = '';          // la dernière cause CONCLUE dans la session (le bilan la garde après un retour)
let derniereRepriseReseau = 0;
let sonde = null;           // null jamais lancée · 'encours' · 'bloquee' · 'reponse' · 'passu'
let sondeGen = 0;           // une sonde rendue caduque par une reprise ne conclut plus rien
let sondeEnCours = false;   // une mesure tourne (la cause d'avant reste affichée tant qu'elle n'est pas contredite)
let sondeUrls = [];         // les photos sur lesquelles la cause a été mesurée
let hote = '';              // le NOM du serveur de la première photo en échec, rien d'autre
let ecranPremier = '';
let ecranCourant = '';
export function ecranActuel(t) { ecranCourant = String(t || '').slice(0, 40); }

// ── Les abonnés ─────────────────────────────────────────────────────────────
const ecouteurs = new Set();
let globalPlanifie = null;
function notifierGlobal() {
  if (globalPlanifie) return;
  globalPlanifie = setTimeout(() => { globalPlanifie = null; ecouteurs.forEach((f) => { try { f(); } catch (_) {} }); }, 40);
}
export function ecouter(fn) { ecouteurs.add(fn); return () => ecouteurs.delete(fn); }
function notifier(url) {
  const e = entrees.get(url);
  if (e) e.abonnes.forEach((f) => { try { f(); } catch (_) {} });
  notifierGlobal();
}
function toutNotifier() {
  for (const e of entrees.values()) e.abonnes.forEach((f) => { try { f(); } catch (_) {} });
  notifierGlobal();
}

// ── Ce qu'un composant appelle ──────────────────────────────────────────────
export function etat(url) { const e = entrees.get(url); return e ? e.etat : 'natif'; }
export function blobDe(url) { const e = entrees.get(url); return (e && e.blob) || null; }
// ── LE MUR CONNU : on saute la tentative directe quand elle est VAINE ────────
// Ce navigateur n'a JAMAIS chargé une photo Vinted en direct cette session, et
// l'extension, elle, y arrive au moins une fois : re-tenter le direct à chaque
// vignette n'ajoute qu'une requête PERDUE au CDN avant le secours, et c'est ce
// qui fait « ça prend du temps » (Julien, 13 octobre). On demande alors le
// secours tout de suite. Zéro requête de plus à l'extension (le secours aurait
// eu lieu de toute façon), et MOINS de charge sur le CDN.
// Auto-correcteur : le témoin teste toujours le direct ; dès qu'un chargement
// direct repasse (`chargeNatif` → `vus.okNatif`), `murNatif()` redevient faux et
// on retente le direct d'abord. Mesuré « sans échec direct » ⇒ jamais ce mur.
export function murNatif() { return vus.okNatif.size === 0 && vus.secoursOk.size > 0; }
// L'état de DÉPART d'une photo au premier rendu (avant toute entrée) : « attente »
// — donc on ne dessine pas un <img> direct voué à échouer — quand le mur est connu
// et que l'extension est là ; « natif » sinon (on doit encore tester le direct).
export function etatRendu(url) {
  const e = entrees.get(url);
  if (e) return e.etat;
  return (secoursIci() === 'oui' && murNatif()) ? 'attente' : 'natif';
}
// L'extension peut-elle encore essayer CETTE photo, sans signal neuf ?
const secourable = (e) => !e.refus && e.delais < MAX_DELAIS;
// Morte = elle ne s'affichera pas ICI sans signal neuf : le secours a échoué,
// ou il n'y en a pas (et on le SAIT — « attente » n'est pas « non »).
// ⚠️ RÉVERSIBLE : l'extension peut arriver, le réseau revenir. C'est ce qui se
//    DESSINE (le pictogramme « perdue ») et ce que compte la phrase — jamais ce
//    qui fait retirer une photo d'une liste (`estDefinitive`).
export function estMorte(url) {
  const e = entrees.get(url);
  if (!e) return false;
  if (e.etat === 'ko') return true;
  return e.etat === 'attente' && secoursIci() === 'non';
}
// Définitive = plus RIEN dans ce module ne pourrait la faire revenir. C'est ce
// qui déclencherait `onError` (les écrans qui retirent la photo de leur liste,
// `noterImgMorte`) — et une photo retirée d'une liste n'y revient pas.
// ⚠️⚠️ AUCUN ÉTAT N'EST DÉFINITIF (seconde revue du 11 octobre). « L'extension a
//    répondu sans image » ne l'est pas non plus : le pont ne dit pas POURQUOI
//    (un 404, un 503, une coupure de son service worker arrivent identiques), et
//    le témoin, le recul, `online` et le retour de l'extension la redemandent.
//    Avec `etat === 'ko'` ici, Ma journée RETIRAIT ses 5 photos sur une coupure
//    de quelques secondes, et ne les remontrait pas une fois le réseau revenu.
//    La photo garde sa place (pictogramme « perdue ») et revient d'elle-même.
export function estDefinitive(url) { void url; return false; }
// Lente = l'extension n'a pas répondu à temps, deux fois : « pas su ».
export function estLente(url) {
  const e = entrees.get(url);
  return !!(e && e.etat === 'attente' && secoursIci() === 'oui' && !secourable(e));
}
export function monter(url, fn) {
  const e = entree(url, true);
  e.refs++;
  if (fn) e.abonnes.add(fn);
  toucher(url);
  // Mur connu (ci-dessus) : une vignette NEUVE part directement en « attente »
  // (le secours), sans tenter le direct voué à échouer. Seulement une entrée
  // vierge (aucun échec, aucun chargement direct, aucun blob) : on ne touche
  // jamais une photo qui a déjà une histoire.
  if (e.etat === 'natif' && !e.echecAt && !e.natifOk && !e.blob && secoursIci() === 'oui' && murNatif()) {
    e.etat = 'attente';
  }
  // Une photo perdue qu'on RE-montre plus d'une minute après son échec : un
  // nouvel essai (219150e réessayait à CHAQUE affichage ; ici, une fois par minute).
  // Une photo que l'extension avait rendue sans octets lui est REDEMANDÉE si
  // son recul est passé (`relancer` lève le refus) — sinon le navigateur seul.
  if ((e.etat === 'ko' || e.etat === 'attente') && e.echecAt && maintenant() - e.echecAt >= RELANCE_MONTAGE_MS
      && !(e.etat === 'attente' && secoursIci() !== 'non' && secourable(e))) {
    relancer(e, 'montage');
  }
  ranger();
  planifierTemoin();
  return () => {
    e.refs = Math.max(0, e.refs - 1);
    if (fn) e.abonnes.delete(fn);
    ranger();
  };
}
export function voir(url, qui, visible) {
  const e = entrees.get(url);
  if (!e) return;
  if (visible) e.visibles.add(qui); else e.visibles.delete(qui);
  if (visible) pomper();
}
export function chargeNatif(url) {
  const e = entree(url, true);
  const k = empreinte(url);
  vus.okNatif.add(k);
  const revenue = e.echecAt > 0;
  e.natifOk = true;
  if (revenue) {
    // Une photo qui avait échoué PASSE : le CDN sert de nouveau ce navigateur.
    // Toutes les autres réessaient, et la cause sera remesurée au prochain échec.
    e.echecAt = 0;
    vus.retours.add(k);
    reprise('retour');
    // Le bilan rangé disait l'échec : il dit maintenant le retour (sans
    // attendre les 10 min — « bloquée » sur un hoquet de 20 s était faux).
    planifierBilan(true);
  } else if (!vus.koNatif.size) {
    // Rien n'a échoué : un bilan « sans échec », une fois par session — que
    // l'écriture ne range QUE pour remplacer un échec rangé par ce navigateur.
    planifierBilan(false);
  }
  notifierGlobal();
}
export function echecNatif(url) {
  const e = entree(url, true);
  const k = empreinte(url);
  e.natifOk = false;
  if (!vus.koNatif.has(k)) { vus.koNatif.add(k); }
  if (e.etat === 'natif') {
    // Refusée par l'extension avant : on ne lui redemande pas (elle a déjà dit non).
    e.etat = e.refus ? 'ko' : 'attente';
    e.echecAt = maintenant();
  }
  if (!hote) { try { const h = new URL(url).hostname; if (/^[a-z0-9.-]+\.vinted\.net$/i.test(h)) hote = h.toLowerCase(); } catch (_) {} }
  if (!ecranPremier) ecranPremier = ecranCourant;
  // La cause se mesure sur ce qui est À L'ÉCRAN : mesurée sur des photos qui ne
  // sont plus montées (un lien mort sur Ventes, puis Annonces bloquée par CORP),
  // elle dirait « le serveur répond » pour toute la session — revue du
  // 11 octobre. On la remesure, une fois, sur la photo qui vient d'échouer.
  if (sondeEnCours) { /* une mesure tourne déjà */ }
  else if (sonde === null) sonder(url);
  else if (sondeUrls.length && sondeUrls.every((u) => { const x = entrees.get(u); return !x || x.refs <= 0; })) sonder(url);
  planifierBilan();
  notifier(url);
  pomper();
  planifierTemoin();
}
// L'URL objet ne s'affiche pas (révoquée, octets qui ne sont pas une image) :
// une seconde demande, jamais plus.
export function echecBlob(url) {
  const e = entrees.get(url);
  if (!e || e.etat !== 'ok') return;
  if (e.blob) { try { URL.revokeObjectURL(e.blob); } catch (_) {} }
  e.blob = null;
  e.essaisBlob++;
  e.etat = e.essaisBlob > 1 ? 'ko' : 'attente';
  if (e.etat === 'ko') { e.refus = true; e.refusN++; e.refusAt = e.echecAt = maintenant(); e.rouvert = false; vus.secoursKo.add(empreinte(url)); }
  planifierBilan();
  notifier(url);
  pomper();
}

// ── Un nouvel essai par le navigateur lui-même ──────────────────────────────
// `relancer` : l'entrée redevient « natif » (le composant redessine un <img>
// neuf, donc une vraie nouvelle requête). Le refus de l'extension tombe :
//   · tout de suite quand le RÉSEAU revient (`online`, ou la seconde sonde qui
//     le prouve : `reseau`) — l'extension a pu échouer pour la même raison ;
//   · sinon une fois son RECUL passé (`reculRefus`) : 1, 2, 4, puis 5 min.
// Le refus levé, si le navigateur échoue encore, la photo repart en attente et
// l'extension est redemandée (à l'écran seulement, 3 à la fois).
function leverRefusSiMur(e, raison) {
  if (!e.refus) return;
  if (raison === 'online' || raison === 'reseau' || maintenant() - e.refusAt >= reculRefus(e.refusN)) e.refus = false;
}
function relancer(e, raison) {
  if (e.etat !== 'attente' && e.etat !== 'ko') return false;
  e.etat = 'natif';
  e.delais = 0;
  leverRefusSiMur(e, raison);
  return true;
}
// L'extension est REDEMANDÉE pour cette photo (sans repasser par le navigateur) :
// le témoin, le retour de l'extension, une photo refusée qui revient par elle.
function rouvrir(e) {
  if (!(e.etat === 'ko' || (e.etat === 'attente' && !secourable(e)))) return false;
  e.refus = false; e.delais = 0; e.rouvert = true; e.rouvertAt = maintenant(); e.etat = 'attente';
  nRedemandes++;
  return true;
}
// Toutes les photos refusées ou restées sans réponse sont redemandées : une
// photo refusée vient de revenir par l'extension (`parRetour`), ou l'extension
// (re)vient. Seules celles À L'ÉCRAN partent (`pomper`) ; les autres attendent
// d'y être.
// ⚠️ CHARGE : des liens vraiment morts mêlés à des refus passagers. Chaque photo
//    qui revient déclenche ce balayage ; sans borne, un lien mort déjà
//    redemandé dans la même vague l'était de nouveau à CHAQUE retour (quinze
//    retours, quinze demandes). Sur un retour, une photo déjà redemandée
//    attend donc son recul (`reculRefus`) ; seul le retour de l'EXTENSION (un
//    signal neuf) redemande tout.
function rouvrirTout(parRetour) {
  let n = 0;
  const t = maintenant();
  for (const e of entrees.values()) {
    if (parRetour && e.etat === 'ko' && e.rouvertAt && t - e.rouvertAt < reculRefus(e.refusN)) continue;
    if (rouvrir(e)) n++;
  }
  if (n) { toutNotifier(); pomper(); }
  return n;
}
function reprise(raison) {
  let n = 0;
  for (const e of entrees.values()) if (relancer(e, raison)) n++;
  // La cause doit être remesurée : celle d'avant ne vaut plus.
  sondeGen++;
  sonde = null;
  sondeEnCours = false;
  sondeUrls = [];
  arreterTemoin(true);
  toutNotifier();
  return n;
}

// ── LE TÉMOIN : le CDN répond-il de nouveau à ce navigateur ? ───────────────
// UNE photo perdue à l'écran, rechargée par le navigateur (sans référent), au
// bout de 20 s, puis 40, 80… jusqu'à 5 min — seulement onglet visible, et
// seulement tant qu'une photo à l'écran ne peut pas s'afficher autrement. Si
// elle passe : tout réessaie (`chargeNatif` → `reprise`).
// ⚠️ Et si le navigateur échoue encore ALORS QUE L'EXTENSION EST LÀ, c'est à
//    elle que le témoin redemande des photos (au plus 3, À L'ÉCRAN) : un
//    refus de l'extension n'est pas un verdict (seconde revue du 11 octobre —
//    le témoin ne passait que par le navigateur, que CORP refuse toujours :
//    53 requêtes au CDN, toutes refusées, et 0 nouvelle demande à l'extension,
//    qui les aurait rendues). Si elle la rend, toutes les autres lui sont
//    redemandées (`lancer` → `rouvrirTout`).
let temoinTimer = null, temoinDelai = TEMOIN_PREMIER_MS, temoinDernier = '', temoinEnCours = false, temoinAt = 0;
const visible = () => { try { return typeof document === 'undefined' || !document.hidden; } catch (_) { return true; } };
function candidatsTemoin() {
  const l = [];
  const s = secoursIci();
  for (const [u, e] of entrees) {
    if (e.refs <= 0 || !e.echecAt) continue;
    if (e.etat === 'ko' || (e.etat === 'attente' && (s === 'non' || (s === 'oui' && !secourable(e))))) l.push(u);
  }
  return l;
}
function arreterTemoin(remettre) {
  if (temoinTimer) { clearTimeout(temoinTimer); temoinTimer = null; }
  if (remettre) temoinDelai = TEMOIN_PREMIER_MS;
}
function planifierTemoin() {
  if (temoinTimer || temoinEnCours) return;
  if (!candidatsTemoin().length) { temoinDelai = TEMOIN_PREMIER_MS; return; }
  temoinTimer = setTimeout(lancerTemoin, temoinDelai);
}
const chargerImageParDefaut = (u) => new Promise((ok) => {
  if (typeof Image !== 'function') { ok(false); return; }
  let fini = false, t = null;
  const fin = (v) => { if (fini) return; fini = true; if (t) clearTimeout(t); ok(v); };
  try {
    const im = new Image();
    try { im.referrerPolicy = 'no-referrer'; } catch (_) {}
    im.onload = () => fin(im.naturalWidth > 0);
    im.onerror = () => fin(false);
    t = setTimeout(() => fin(false), TEMOIN_DELAI_MS);
    im.src = u;
  } catch (_) { fin(false); }
});
async function lancerTemoin() {
  temoinTimer = null;
  if (!visible()) return;                 // repris au retour au premier plan
  const l = candidatsTemoin();
  if (!l.length) { temoinDelai = TEMOIN_PREMIER_MS; return; }
  // Avec l'extension, de préférence une photo À L'ÉCRAN : c'est la seule qu'on
  // puisse lui redemander (aucune demande pour une image hors écran).
  const lv = secoursIci() === 'oui' ? l.filter((x) => { const e = entrees.get(x); return e && e.visibles.size > 0; }) : [];
  const pool = lv.length ? lv : l;
  const i = (pool.indexOf(temoinDernier) + 1) % pool.length;
  const u = pool[i]; temoinDernier = u;
  temoinEnCours = true; temoinAt = maintenant(); nTemoins++;
  let ok = false;
  try { ok = await (deps.chargerImage || chargerImageParDefaut)(u); } catch (_) { ok = false; }
  temoinEnCours = false;
  if (ok) { temoinDelai = TEMOIN_PREMIER_MS; chargeNatif(u); return; }
  // Le navigateur échoue encore : l'extension, si elle est là, pour des photos
  // À L'ÉCRAN seulement — au plus MAX_EN_VOL par passage, les MOINS redemandées
  // d'abord. Une seule par passage, prise dans l'ordre de la page, faisait
  // passer cinq liens morts avant le premier refus passager : 10 minutes de
  // pictogrammes (20 + 40 + 80 + 160 + 300 s) pour des photos que l'extension
  // rendait. Si l'une revient, toutes les autres suivent (`rouvrirTout`).
  if (deps.demander && secoursIci() === 'oui') {
    const l2 = [...entrees.values()].filter((x) => x.refs > 0 && x.visibles.size > 0 && (x.etat === 'ko' || (x.etat === 'attente' && !secourable(x))));
    l2.sort((a, b2) => (a.refusN - b2.refusN) || (a.rouvertAt - b2.rouvertAt));
    let n = 0;
    for (const x of l2) { if (n >= MAX_EN_VOL) break; if (rouvrir(x)) n++; }
    if (n) { toutNotifier(); pomper(); }
  }
  temoinDelai = Math.min(TEMOIN_MAX_MS, temoinDelai * 2);
  planifierTemoin();
}
// Les signaux qui méritent un nouvel essai tout de suite.
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  try {
    // Le réseau revient : tout réessaie (refus de l'extension compris).
    window.addEventListener('online', () => { reprise('online'); pomper(); });
    // Il part : la phrase le dit (« pas de connexion »), jamais « pas su ».
    window.addEventListener('offline', () => { notifierGlobal(); });
    // Retour au premier plan : le témoin passe tout de suite (une seule photo),
    // pas plus d'une fois toutes les 10 s.
    if (typeof document !== 'undefined' && document.addEventListener) {
      document.addEventListener('visibilitychange', () => {
        if (!visible() || temoinEnCours || maintenant() - temoinAt < 10000) return;
        if (!candidatsTemoin().length) return;
        arreterTemoin(false);
        lancerTemoin();
      });
    }
  } catch (_) {}
}

// ── La file : au plus MAX_EN_VOL demandes, seulement pour ce qui est à l'écran ──
let enVol = 0;
function pomper() {
  if (!deps.demander || secoursIci() !== 'oui') return;
  while (enVol < MAX_EN_VOL) {
    let cible = null;
    for (const [u, e] of entrees) { if (e.etat === 'attente' && secourable(e) && e.visibles.size > 0) { cible = u; break; } }
    if (!cible) return;
    lancer(cible);
  }
}
// La réponse du pont, quelle que soit sa forme (contrat d'avant : une chaîne ou null).
function normaliser(r) {
  if (typeof r === 'string') return { dataUrl: r, issue: 'ok' };
  if (r && typeof r === 'object') {
    const dataUrl = typeof r.dataUrl === 'string' && r.dataUrl ? r.dataUrl : null;
    if (dataUrl) return { dataUrl, issue: 'ok' };
    // « pas de réponse » ou « pas d'extension » : PAS SU, jamais un refus.
    if (r.issue === 'delai' || r.issue === 'absente') return { dataUrl: null, issue: 'delai' };
    return { dataUrl: null, issue: 'refus' };
  }
  return { dataUrl: null, issue: 'refus' };
}
function lancer(url) {
  const e = entrees.get(url);
  if (!e) return;
  e.etat = 'vol';
  enVol++;
  notifier(url);
  let fini = false;
  const fin = (brut) => {
    if (fini) return; fini = true;
    enVol = Math.max(0, enVol - 1);
    const r = normaliser(brut);
    // L'entrée a pu être rangée entre-temps (elle était en vol : non) — prudence.
    const cur = entrees.get(url) || e;
    const k = empreinte(url);
    if (r.issue === 'delai') {
      // Pas su : la photo retourne en attente — un nouvel essai, jamais « perdue ».
      cur.etat = 'attente'; cur.delais++; cur.echecAt = maintenant(); nDelais++;
    } else {
      const blob = r.dataUrl ? blobDeDataUrl(r.dataUrl) : null;
      if (blob) {
        try { cur.blob = URL.createObjectURL(blob); } catch (_) { cur.blob = null; }
      }
      if (cur.blob) {
        // Une photo REDEMANDÉE (refusée, ou restée sans réponse) revient : l'extension
        // sait de nouveau faire — toutes les autres lui sont redemandées.
        const revenue = cur.refusN > 0 || cur.rouvert;
        cur.etat = 'ok'; cur.refusN = 0; cur.rouvert = false; vus.secoursOk.add(k); vus.secoursKo.delete(k);
        if (revenue) { vus.retours.add(k); rouvrirTout(true); planifierBilan(true); }
      } else {
        // Réponse SANS octets : le pont ne dit pas pourquoi (lien mort, 503, coupure).
        // « Perdue » pour l'instant, JAMAIS définitive — redemandée plus tard.
        cur.etat = 'ko'; cur.refus = true; cur.refusN++; cur.refusAt = cur.echecAt = maintenant(); cur.rouvert = false;
        if (!vus.secoursOk.has(k)) vus.secoursKo.add(k);
      }
    }
    planifierBilan();
    notifier(url);
    ranger();
    pomper();
    planifierTemoin();
  };
  let p;
  try { p = deps.demander(url); } catch (_) { p = null; }
  Promise.resolve(p).then(fin, () => fin({ dataUrl: null, issue: 'delai' }));
}
// Les octets rendus par l'extension, en Blob. Une image et RIEN d'autre :
//  · un type d'image connu (jpeg, png, webp, gif, avif) est gardé tel quel ;
//  · une autre image (SVG surtout) est REFUSÉE : en URL objet, un SVG ouvert
//    dans un onglet exécute son script DANS l'origine de l'app (mesuré par la
//    relecture du 11 octobre) — on ne prend pas ce risque pour une vignette ;
//  · un type qui n'est pas une image (le CDN répond parfois sans type, ou en
//    octet-stream) devient image/jpeg : le navigateur l'affiche si ce sont des
//    octets d'image, sinon l'<img> échoue et `echecBlob` le constate — et un
//    contenu déclaré JPEG ne s'exécute jamais.
const TYPES_IMAGE = /^image\/(?:jpeg|jpg|pjpeg|png|webp|gif|avif)$/i;
export function blobDeDataUrl(d) {
  try {
    const m = /^data:([^;,]*)((?:;[^;,]*)*?)(;base64)?,([\s\S]*)$/.exec(String(d || ''));
    if (!m) return null;
    const type = String(m[1] || '').trim().toLowerCase();
    if (/^image\//.test(type) && !TYPES_IMAGE.test(type)) return null;
    const mime = TYPES_IMAGE.test(type) ? type : 'image/jpeg';
    const bin = m[3] ? atob(m[4]) : decodeURIComponent(m[4]);
    if (!bin.length) return null;
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return new Blob([u8], { type: mime });
  } catch (_) { return null; }
}

// ── LA SONDE : pourquoi ça ne s'affiche pas, mesuré dans SON navigateur ──────
// Au premier échec (et de nouveau après chaque reprise). Une requête `no-cors`
// SANS référent ni cookie :
//   · une réponse (opaque) ⇒ « le serveur a répondu » (mais l'image ne
//     s'affiche pas : un statut d'erreur, ou une image refusée pour une autre
//     raison) ;
//   · TypeError ⇒ CORP de Vinted, un logiciel de protection, OU le réseau —
//     indiscernables d'ici. Une seule ne prouve rien (une coupure passagère
//     donne la même) : on en refait une SECONDE, SONDE_ECART_MS plus tard, sur
//     une AUTRE photo en échec. Deux ⇒ « bloquee » (= deux échecs réseau
//     espacés : la cause reste « bloquée OU injoignable », la phrase le dit) ;
//   · hors ligne MESURÉ (`navigator.onLine === false`) ⇒ « horsligne » : une
//     cause, pas un « pas su » (la phrase disait « je n'ai pas pu mesurer
//     pourquoi » et envoyait sur l'ordinateur — seconde revue du 11 octobre) ;
//   · délai, autre erreur ⇒ « pas su ».
const attendre = (ms) => new Promise((ok) => setTimeout(ok, ms));
const horsLigne = () => { try { return typeof navigator !== 'undefined' && navigator.onLine === false; } catch (_) { return false; } };
async function essaiSonde(url) {
  try {
    if (horsLigne()) return 'horsligne';
    if (typeof fetch !== 'function') return 'passu';
    const ac = typeof AbortController === 'function' ? new AbortController() : null;
    const t = setTimeout(() => { try { ac && ac.abort(); } catch (_) {} }, SONDE_DELAI_MS);
    try {
      await fetch(url, { mode: 'no-cors', referrerPolicy: 'no-referrer', cache: 'no-store', credentials: 'omit', signal: ac ? ac.signal : undefined });
      return 'reponse';
    } catch (err) {
      return err && err.name === 'TypeError' ? 'erreur' : 'passu';
    } finally { clearTimeout(t); }
  } catch (_) { return 'passu'; }
}
// Une AUTRE photo en échec, À L'ÉCRAN (la cause se mesure sur ce qu'on montre).
function autreEchec(url) {
  for (const [u, e] of entrees) if (u !== url && e.refs > 0 && e.echecAt && (e.etat === 'attente' || e.etat === 'ko')) return u;
  return url;
}
// ⚠️ REMESURER NE DOIT PAS FAIRE SCINTILLER LA PHRASE (vu au banc, scénario U) :
//    en changeant d'écran, la cause se remesure sur les photos qui échouent
//    maintenant (une cause mesurée sur un écran quitté ne vaut plus). Avec
//    « en cours » posé d'office, la phrase de la coque DISPARAISSAIT pendant
//    les 8 s de la seconde sonde, puis revenait, identique — à chaque écran.
//    Donc : pendant le premier essai (quelques millisecondes), la conclusion
//    d'avant reste ; une nouvelle erreur réseau alors que la précédente était
//    déjà « bloquee » (deux échecs espacés, et AUCUNE photo passée depuis —
//    sinon `reprise` l'aurait effacée) est corroborée tout de suite ; « en
//    cours » (rien affiché) seulement quand il faut VRAIMENT attendre la seconde
//    sonde : pas de conclusion d'avant, ou une conclusion que le premier essai
//    contredit (« le serveur répondait », il ne répond plus : on ne sait pas).
// ⚠️⚠️ UNE ERREUR PUIS UNE RÉPONSE, C'EST LE RÉSEAU QUI REVIENT (seconde revue du
//    11 octobre, scénario « PWA qui se réveille »). La seconde sonde recevait une
//    réponse (le réseau était revenu entre-temps) et la phrase affirmait « le
//    serveur répond, mais ses images ne s'affichent pas » pendant 12 s, sur des
//    photos qui n'avaient simplement pas été réessayées. On redemande donc la
//    PREMIÈRE photo : si elle répond aussi, le réseau est revenu — tout
//    réessaie tout de suite (`reprise('reseau')`), sans conclure ; « répond,
//    mais ne s'affiche pas » ne se dira que sur un échec constaté APRÈS. Si elle
//    échoue encore pendant qu'une autre répond, c'est un mélange : « reponse »,
//    comme avant. Au plus une reprise par minute (un réseau qui bat ne fait pas
//    tourner la sonde en boucle) — au-delà, « pas su ».
async function sonder(url) {
  const gen = ++sondeGen;
  const avant = sonde === 'reponse' || sonde === 'bloquee' ? sonde : null;
  sondeEnCours = true;
  if (!avant) sonde = 'encours';
  sondeUrls = [url];
  notifierGlobal();
  let r = 'passu';
  try {
    r = await essaiSonde(url);
    if (gen !== sondeGen) return;
    if (r === 'erreur' && avant === 'bloquee') r = 'bloquee';
    else if (r === 'erreur') {
      sonde = 'encours';
      notifierGlobal();
      await attendre(SONDE_ECART_MS);
      if (gen !== sondeGen) return;
      const autre = autreEchec(url);
      sondeUrls = [url, autre];
      const r2 = await essaiSonde(autre);
      if (gen !== sondeGen) return;
      if (r2 === 'erreur') r = horsLigne() ? 'horsligne' : 'bloquee';
      else if (r2 === 'reponse') {
        const r3 = autre === url ? r2 : await essaiSonde(url);
        if (gen !== sondeGen) return;
        if (r3 === 'reponse') {
          if (maintenant() - derniereRepriseReseau >= REPRISE_RESEAU_MIN_MS) {
            derniereRepriseReseau = maintenant();
            reprise('reseau');
            pomper();
            return;
          }
          r = 'passu';
        } else r = r3 === 'erreur' ? 'reponse' : r3;
      } else r = r2;
    }
  } catch (_) { r = 'passu'; }
  if (gen !== sondeGen) return;
  sondeEnCours = false;
  sonde = r === 'reponse' || r === 'bloquee' || r === 'horsligne' ? r : 'passu';
  if (sonde !== 'passu') sondeVue = sonde;
  planifierBilan();
  notifierGlobal();
}

// ── Ce que la coque affiche (une phrase, une fois) ─────────────────────────
// Jugé sur ce qui est MONTÉ maintenant (pas sur la session) :
//   · on mesure encore (`sonde` en cours) ⇒ rien — pas de phrase sur une cause
//     pas finie ;
//   · moins de SEUIL_PHRASE photos perdues à l'écran ⇒ rien (liens morts isolés) ;
//   · une photo affichée PAR L'EXTENSION à l'écran ⇒ rien : elle sait les
//     chercher, celles qui manquent sont des liens morts (revue : « l'extension
//     n'a pas pu les récupérer non plus : recharge » s'affichait à côté de 8
//     photos qu'elle venait de récupérer) ;
//   · une photo affichée par le NAVIGATEUR à l'écran, et la sonde n'a pas mesuré
//     de blocage ⇒ rien (le CDN répond à ce navigateur : liens morts). Si la
//     sonde a mesuré deux échecs réseau, une photo affichée vient du cache et
//     ne prouve rien — la phrase reste.
// cause : 'navigateur' (deux échecs réseau, mais l'extension les a récupérées :
//         c'est la page qui est refusée) · 'injoignable' (deux échecs réseau,
//         rien ne dit que l'extension ferait mieux) · 'reponse' · 'horsligne'
//         (`navigator.onLine === false`, MESURÉ maintenant ou par la sonde) ·
//         'passu'.
export function decision() {
  let morts = 0, lentes = 0, okNatif = 0, okSecours = 0, refusees = 0;
  for (const [u, e] of entrees) {
    if (e.refs <= 0) continue;
    if (e.etat === 'ok') okSecours++;
    else if (e.etat === 'natif' && e.natifOk) okNatif++;
    else if (estMorte(u)) { morts++; if (e.etat === 'ko') refusees++; }
    else if (estLente(u)) lentes++;
  }
  const compte = { morts, lentes, okNatif, okSecours, refusees };
  if (sonde === 'encours') return { parle: false, pourquoi: 'mesure', ...compte };
  if (morts < SEUIL_PHRASE) return { parle: false, pourquoi: 'isolees', ...compte };
  if (okSecours > 0) return { parle: false, pourquoi: 'extension', ...compte };
  // Hors ligne : la cause est connue, quelles que soient les photos du cache.
  const hl = horsLigne() || sonde === 'horsligne';
  if (!hl && okNatif > 0 && sonde !== 'bloquee') return { parle: false, pourquoi: 'liens', ...compte };
  const cause = hl ? 'horsligne'
    : sonde === 'bloquee' ? (vus.secoursOk.size > 0 ? 'navigateur' : 'injoignable')
      : sonde === 'reponse' ? 'reponse' : 'passu';
  let ext = 'absente'; try { const v = deps.ext(); ext = v === 'presente' || v === 'muette' ? v : 'absente'; } catch (_) {}
  return { parle: true, cause, ext, ...compte };
}
export function etatGlobal() {
  const d = decision();
  return {
    koNatif: vus.koNatif.size, okNatif: vus.okNatif.size,
    secoursOk: vus.secoursOk.size, secoursKo: vus.secoursKo.size,
    sonde: sonde === 'encours' ? null : sonde, secours: secoursIci(), decision: d,
  };
}

// ── LE BILAN DANS SA BASE (`diag_photos`) ───────────────────────────────────
// Des nombres et des mots, JAMAIS une URL, une signature ou un titre.
export function bilan(extra) {
  return Object.assign({
    at: new Date().toISOString(),
    ko: vus.koNatif.size, ok: vus.okNatif.size,
    secoursOk: vus.secoursOk.size, secoursKo: vus.secoursKo.size,
    // Photos revenues après un échec, demandes restées sans réponse, témoins
    // tentés : ce qui distingue un hoquet d'un refus durable.
    retours: vus.retours.size, delais: nDelais, temoins: nTemoins, redemandes: nRedemandes,
    sonde: sonde === 'bloquee' || sonde === 'reponse' || sonde === 'horsligne' ? sonde : 'passu',
    // La cause conclue plus tôt dans la session (une reprise remet `sonde` à zéro :
    // sans elle, le bilan d'un retour ne dirait plus ce qu'on avait mesuré).
    sondeVue: sondeVue || '',
    // Photos à l'écran qui ne s'affichent pas EN CE MOMENT (0 = tout est revenu).
    enEchec: (() => { let n = 0; for (const e of entrees.values()) if (e.refs > 0 && (e.etat === 'attente' || e.etat === 'ko' || e.etat === 'vol')) n++; return n; })(),
    // Rien n'a échoué dans la session : ce bilan ne sert qu'à REMPLACER un échec rangé.
    sansEchec: !vus.koNatif.size,
    hote: hote || '',
    ext: (() => { try { const v = deps.ext(); return v === 'presente' || v === 'muette' ? v : 'absente'; } catch (_) { return 'absente'; } })(),
    ecran: ecranPremier || ecranCourant || '',
  }, extra || {});
}
// ⚠️⚠️ LE BILAN DIT AUSSI LE RETOUR (seconde revue du 11 octobre). Il n'était
//    écrit QUE sur un échec : une photo revenue ne le faisait jamais réécrire, et
//    une session où tout s'affiche n'écrivait rien. La base gardait donc
//    « bloquée, 0 affichée, 0 revenue » pour un hoquet de 20 s — la mesure qui
//    doit trancher la cause chez lui mentait. Maintenant :
//      · un échec : premier bilan après BILAN_PREMIER_MS, puis au plus toutes
//        les 10 min (inchangé) ;
//      · un RETOUR (`urgent`) : réécrit sans attendre les 10 min, jamais deux
//        fois en BILAN_URGENT_ECART_MS ;
//      · aucun échec : UN bilan « sans échec » par session — l'écriture (App.jsx)
//        ne le range que s'il REMPLACE un échec rangé par ce navigateur (sinon
//        aucune écriture : pas une ligne de plus à chaque ouverture).
let bilanTimer = null, bilanDernier = 0, bilanEnVol = false, bilanSale = false, bilanTimerAt = 0, bilanSansEchecFait = false;
function planifierBilan(urgent) {
  if (!vus.koNatif.size) {
    if (bilanSansEchecFait || !vus.okNatif.size) return;
    bilanSansEchecFait = true;
  }
  bilanSale = true;
  if (bilanEnVol) return;
  const t = maintenant();
  const delai = (!bilanDernier) ? BILAN_PREMIER_MS
    : urgent ? Math.max(BILAN_PREMIER_MS, bilanDernier + BILAN_URGENT_ECART_MS - t)
      : Math.max(0, bilanDernier + BILAN_INTERVALLE_MS - t);
  if (bilanTimer) {
    if (!urgent || bilanTimerAt <= t + delai) return;
    clearTimeout(bilanTimer); bilanTimer = null;
  }
  bilanTimerAt = t + delai;
  bilanTimer = setTimeout(envoyerBilan, delai);
}
async function envoyerBilan() {
  bilanTimer = null;
  // Pas encore d'écriture branchée (pas de session) : le bilan reste « à écrire »,
  // `configurer` le relancera.
  if (!deps.ecrire || !bilanSale) return;
  // On mesure encore la cause (deux sondes espacées) : le bilan attend sa
  // conclusion — écrit trop tôt, il dirait « pas su » pour dix minutes.
  if (sondeEnCours || sonde === 'encours') { bilanTimerAt = maintenant() + 2000; bilanTimer = setTimeout(envoyerBilan, 2000); return; }
  bilanEnVol = true; bilanSale = false;
  const b = bilan();
  let ok = false;
  try { ok = await deps.ecrire(b); } catch (_) { ok = false; }
  bilanEnVol = false;
  // Un bilan « sans échec » (le plus souvent PAS écrit : rien à remplacer) ne
  // retarde pas le premier bilan d'un échec qui arriverait ensuite.
  if (!b.sansEchec) bilanDernier = maintenant();
  // Pas écrit ⇒ on retentera au prochain créneau ; écrit ⇒ seulement si du neuf est arrivé.
  if (!ok) bilanSale = true;
  if (bilanSale) planifierBilan();
}

// ── Pour les bancs et les audits ────────────────────────────────────────────
export function _etatInterne() { return { taille: entrees.size, enVol, sonde, sondeEnCours, temoinDelai, temoinPlanifie: !!temoinTimer }; }

// ── L'observation de l'écran : un seul IntersectionObserver pour toute l'app ──
let io = null;
const rappels = new WeakMap();
export function observer(el, cb) {
  if (!el) return () => {};
  if (typeof IntersectionObserver === 'undefined') { cb(true); return () => cb(false); }
  if (!io) {
    io = new IntersectionObserver((liste) => liste.forEach((en) => { const f = rappels.get(en.target); if (f) f(en.isIntersecting); }), { rootMargin: '200px 0px' });
  }
  rappels.set(el, cb);
  io.observe(el);
  return () => { try { io.unobserve(el); } catch (_) {} rappels.delete(el); cb(false); };
}
