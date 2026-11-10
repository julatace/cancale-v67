// ─────────────────────────────────────────────────────────────────────────────
// COLIS À RETIRER : LA DATE LIMITE, LE LIEU LU DANS L'E-MAIL, ET L'ÉTAT D'UN
// COLIS — une règle pour le serveur (api/email-inbound au rangement, api/widget
// au comptage) et pour l'app (Achats → À retirer, Ma journée, la publication
// `vrm_colis_retirer`), §11. Pure : aucune lecture, aucune écriture.
//
// (23 octobre) « Nouveau colis Mondial Relay mais c'est pas mis à jour dans
// l'app… il doit prendre en compte si une paire est repartie au vendeur et
// n'est plus disponible. » MESURÉ (lecture seule) :
//   · Mondial Relay écrit « RETRAIT JUSQU'AU 26/10 » — SANS l'année. La route
//     n'acceptait qu'une année à quatre chiffres : 22 colis Mondial Relay
//     « disponibles » sur 22 n'avaient AUCUNE date limite ; Vinted Go (« Libère
//     de la place… ») non plus (4 sur 4).
//   · Ce que le transporteur garde VRAIMENT, lu dans ses e-mails : Mondial Relay
//     5 j (21/10 → 26/10), Chronopost 4 à 7 j (25/08 → 29/08, 19/09 → 23/09,
//     22/10 → 29/10), Vinted Go 6 j (arrivé le 19/09, « Rappel : récupère ton
//     colis avant le 25/09/2026 »). L'app supposait 14 jours.
//   · L'en-tête « POINT RELAIS® » (le ® en fin de ligne) était refusé : le lieu
//     restait vide, alors que le nom et l'adresse étaient sur les lignes d'après
//     (gardés dans `extraitLieu` : « TABA'VAP | 29 Rue Hoche | 56000 Vannes | … »).
// ─────────────────────────────────────────────────────────────────────────────
import { decoderEntitesHtml } from './entites-html.js';

// La garde la plus longue MESURÉE (Chronopost 7 j). Sans date limite écrite par
// le transporteur, un colis arrivé depuis plus longtemps n'est plus présenté
// « à retirer » : il est « à vérifier » (sans doute reparti ou déjà retiré).
// Ce n'est PAS une date : c'est un seuil d'affichage, et il est écrit comme tel.
export const GARDE_MAX_J = 7;
// (revue du 23 oct.) LA GARDE MESURÉE DE CHAQUE TRANSPORTEUR, quand l'e-mail
// n'a pas d'échéance lisible : Mondial Relay 5 j (21/10 → « RETRAIT JUSQU'AU
// 26/10 »), Vinted Go 6 j (arrivé le 19/09, « avant le 25/09/2026 »), Chronopost
// la plus COURTE mesurée, 4 j (25/08 → 29/08, 19/09 → 23/09). Avec 7 j pour
// tous, le Mondial Relay 38235759 (« RETRAIT JUSQU'AU 26/10 », date jamais
// rangée) restait « à retirer » le 27 et le 28, deux jours après son départ.
// Au-delà, le colis passe « à vérifier » : TOUJOURS VISIBLE avec son code — seul
// son compte « à retirer » change. Ce n'est pas une date : c'est un seuil.
export const GARDE_PAR_TRANSPORTEUR = { mondialrelay: 5, vinted: 6, chronopost: 4 };
export const gardeDe = (transporteur) => {
  const g = GARDE_PAR_TRANSPORTEUR[String(transporteur || '').toLowerCase().trim()];
  return Number.isFinite(g) ? g : GARDE_MAX_J;
};

const MOIS = { janvier: 1, fevrier: 2, février: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7,
  aout: 8, août: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12, décembre: 12 };
const JOURS = '(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)?';
// « jusqu'au », « avant le », « à retirer avant le », « à récupérer avant le ».
const AV = "(?:jusqu['’]au|(?:[àa]\\s+retirer\\s+)?avant\\s+le|[àa]\\s+r[ée]cup[ée]rer\\s+avant\\s+le)";

const pad = (n) => String(n).padStart(2, '0');
const dateValide = (y, m, d) => {
  if (!(y > 2000 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null;
  const t = Date.UTC(y, m - 1, d);
  const x = new Date(t);
  return (x.getUTCFullYear() === y && x.getUTCMonth() === m - 1 && x.getUTCDate() === d) ? t : null;
};
// Le jour (heure de Paris) où l'e-mail est arrivé : { y, m, d, t } (t = minuit UTC de ce jour).
function jourDeReception(recuLe) {
  const ms = Date.parse(String(recuLe || ''));
  if (!Number.isFinite(ms)) return null;
  try {
    const p = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(ms));
    const v = (k) => Number((p.find((x) => x.type === k) || {}).value);
    const y = v('year'), m = v('month'), d = v('day');
    const t = dateValide(y, m, d);
    return t == null ? null : { y, m, d, t };
  } catch (_) { return null; }
}

// Une date SANS année (« 26/10 », « 26 octobre ») : l'année de la réception, ou
// la suivante si la date tomberait avant la veille de la réception (« 02/01 »
// reçu le 29/12). On ne l'accepte QUE si elle tombe entre la veille de la
// réception et 30 jours après — sinon rien (une date limite fausse ferait courir
// pour rien ou rater le colis : mieux vaut un blanc qu'un faux). Même borne que
// `limiteDeConfirmation` de l'extension.
function avecAnnee(jour, mois, recuLe) {
  const r = jourDeReception(recuLe);
  if (!r) return null;
  // (revue du 23 oct.) L'année d'AVANT aussi : « jusqu'au 31/12 » reçu le
  // 1er janvier est la veille (la borne annoncée), pas une date de l'an prochain.
  for (const y of [r.y - 1, r.y, r.y + 1]) {
    const t = dateValide(y, mois, jour);
    if (t == null) continue;
    const ecartJ = Math.round((t - r.t) / 86400000);
    if (ecartJ < -1) continue;                  // avant la veille : l'année suivante
    if (ecartJ > 30) return null;               // trop loin : on ne devine pas
    return `${y}-${pad(mois)}-${pad(jour)}`;
  }
  return null;
}

// LA DATE LIMITE DE RETRAIT écrite dans l'e-mail, ou null.
// `recuLe` (ISO) sert seulement à une date écrite sans année.
// ⚠️ (revue du 23 oct.) TOUTES les dates « jusqu'au / avant le » sont relevées,
// pas la première venue : « Offre valable jusqu'au 15/11 » au-dessus de
// « RETRAIT JUSQU'AU 26/10 » gardait le colis « à retirer » jusqu'au 15/11. On
// préfère celle qui suit un mot de RETRAIT (« retrait », « retirer »,
// « récupère ») ; à défaut, celles de la fenêtre [veille, +30 j] de la
// réception. Plusieurs dates qui se contredisent ⇒ rien (on ne devine pas).
const MOT_RETRAIT = /retrait|retir|r[ée]cup[ée]r|r[ée]cup[eè]re/i;
export function limiteRetraitDepuisTexte(texte, recuLe) {
  // Les lignes gardées d'un ancien e-mail portent encore leurs entités
  // (« jusqu&rsquo;au ») : décodées d'abord, comme la route le fait (§11).
  const all = decoderEntitesHtml(texte || '');
  if (!all) return null;
  const cands = [];
  const note = (date, m) => {
    if (!date) return;
    const avant = all.slice(Math.max(0, m.index - 40), m.index + m[0].length);
    cands.push({ date, retrait: MOT_RETRAIT.test(avant) });
  };
  // 1) Avec l'année (formes d'avant : « jusqu'au vendredi 21 août 2026 »,
  //    « jusqu'au 21/08/2026 », « À retirer avant le 29/09/2026 »).
  for (const m of all.matchAll(new RegExp(`${AV}\\s+${JOURS}\\s*(\\d{1,2})\\s+([a-zà-ÿ]+)\\s+(\\d{4})`, 'gi'))) {
    const mo = MOIS[m[2].toLowerCase()];
    if (mo && dateValide(+m[3], mo, +m[1]) != null) note(`${m[3]}-${pad(mo)}-${pad(+m[1])}`, m);
  }
  for (const m of all.matchAll(new RegExp(`${AV}\\s+${JOURS}\\s*(\\d{1,2})[\\/.](\\d{1,2})[\\/.](\\d{4})`, 'gi'))) {
    if (dateValide(+m[3], +m[2], +m[1]) != null) note(`${m[3]}-${pad(+m[2])}-${pad(+m[1])}`, m);
  }
  // 2) SANS l'année (23 oct., mesuré : Mondial Relay « RETRAIT JUSQU'AU 26/10 »).
  for (const m of all.matchAll(new RegExp(`${AV}\\s+${JOURS}\\s*(\\d{1,2})[\\/.](\\d{1,2})(?![\\/.]?\\d)`, 'gi'))) {
    note(avecAnnee(+m[1], +m[2], recuLe), m);
  }
  for (const m of all.matchAll(new RegExp(`${AV}\\s+${JOURS}\\s*(\\d{1,2})\\s+([a-zà-ÿ]+)(?!\\s+\\d{4})`, 'gi'))) {
    const mo = MOIS[m[2].toLowerCase()];
    if (mo) note(avecAnnee(+m[1], mo, recuLe), m);
  }
  if (!cands.length) return null;
  const r = jourDeReception(recuLe);
  const dansFenetre = (d) => {
    if (!r) return true;
    const t = tJour(d); if (t == null) return false;
    const e = Math.round((t - r.t) / 86400000);
    return e >= -1 && e <= 30;
  };
  const unique = (l) => { const d = [...new Set(l.map((c) => c.date))]; return d.length === 1 ? d[0] : null; };
  const duRetrait = cands.filter((c) => c.retrait);
  if (duRetrait.length) return unique(duRetrait) || unique(duRetrait.filter((c) => dansFenetre(c.date)));
  return unique(cands.filter((c) => dansFenetre(c.date)));
}

// LE LIEU tel que l'e-mail l'écrit dans les lignes gardées autour d'un code
// postal (`extraitLieu`, « NOM | rue | CP Ville | … »). On ne le prend QUE sous
// cette forme exacte, au début : le nom (sans code postal, pas le transporteur),
// une rue qui commence par son numéro, un code postal suivi de la ville. Sinon
// rien — c'est le texte de l'e-mail, jamais une déduction.
const PAS_UN_NOM = /\b(?:mondial\s*relay|chronopost|vinted|pickup\s+services?|exp[ée]diteur|destinataire|avec\s+\d+|points?\s+de\s+proximit|prière|ne\s+pas\s+r[ée]pondre|code|retrait|jusqu)/i;
// (1er nov.) TOUS les triplets « NOM | rue | CP Ville » de l'extrait sont lus,
// plus seulement le premier : quand une autre ligne à code postal le précède
// (le pied d'un e-mail, une ligne d'agence), le point relais qui suivait était
// perdu et le colis restait « point pas connu ». Deux points DIFFÉRENTS dans le
// même extrait (le relais et l'adresse de quelqu'un, par exemple) ⇒ rien :
// on ne choisit pas.
const tripletLieu = (nom, rue, ville) => {
  if (!nom || nom.length < 2 || nom.length > 60 || /\d{5}/.test(nom) || PAS_UN_NOM.test(nom)) return null;
  if (nom.replace(/[^a-zà-ÿ]/gi, '').length < 3) return null;
  if (!/^\d{1,4}(?:\s*(?:bis|ter))?[\s,]+[A-Za-zÀ-ÿ]/.test(rue) || rue.length > 80 || /\d{5}/.test(rue)) return null;
  if (!/^\d{5}\s+[A-Za-zÀ-ÿ'’\- ]{2,40}$/.test(ville)) return null;
  return `${nom}, ${rue}, ${ville}`;
};
export function lieuDepuisExtrait(extrait) {
  const parts = decoderEntitesHtml(extrait || '').split('|').map((x) => x.replace(/[*_]+/g, ' ').replace(/®|™|©/g, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean);
  if (parts.length < 3) return null;
  const vus = new Map();
  for (let k = 2; k < parts.length; k++) {
    const l = tripletLieu(parts[k - 2], parts[k - 1], parts[k]);
    if (!l) continue;
    const cle = l.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    if (!vus.has(cle)) vus.set(cle, l);   // le même point écrit deux fois : la 1re écriture
  }
  return vus.size === 1 ? [...vus.values()][0] : null;
}

// LE LIEU SOUS SON EN-TÊTE (« POINT RELAIS® », « LOCKER », « Consigne », « Adresse »
// seuls sur leur ligne, puis le nom, la rue, « CP Ville » sur les lignes d'après).
// Sorti d'api/email-inbound.js le 2 nov. (23 h) pour que l'app relise avec la MÊME
// règle le texte gardé d'un e-mail déjà rangé (§11).
// (2 nov., 23 h — Julien : « un colis arrivé à Cancale, je veux qu'il soit affiché »)
// Mesuré : l'e-mail d'un LOCKER Mondial Relay écrit UNE LIGNE VIDE entre chaque
// ligne et une rue SANS numéro (« LOCKER / LOCKER 24/7 <ENSEIGNE> / Rue de … /
// <CP> <Ville> ») : la lecture s'arrêtait à la ligne vide après le nom, le lieu
// rangé n'avait ni rue, ni code postal, ni ville — jamais sur la carte. Une ligne
// vide est maintenant franchie tant que la ligne « CP Ville » arrive dans les lignes
// suivantes (5 morceaux au plus, rien du pied d'e-mail avant elle) ; sinon rien de
// plus qu'avant.
// La date limite et le pied de l'e-mail (« Avec 19 000 points… », le siège) ne sont pas le lieu.
const STOP_LIEU = /horaires|ouvert|lundi|mardi|retrouve|suivez|super\s*pratique|https?:|désabonn|code|colis|retrait|jusqu|avec\s+\d|mondial\s*relay|chronopost|villeneuve\s+d/i;
export function lieuSousEnTete(txt) {
  const lines = String(txt || '').split('\n').map((l) => l.trim());
  const enTete = (l) => l.replace(/®|™|©|[*_]+/g, ' ').replace(/\s+/g, ' ').trim();
  const idx = lines.findIndex((l) => /^(?:point\s+(?:relais|de\s+retrait)|(?:votre\s+)?locker(?:\s*24\s*\/?\s*7)?|(?:votre\s+)?consigne(?:\s+automatique)?|(?:votre\s+)?casier|adresse)\b[\s:–-]*$/i.test(enTete(l)));
  if (idx < 0) return null;
  const parts = [];
  const cpVille = (l) => /^\d{5}\s+[A-Za-zÀ-ÿ'’\- ]{2,40}$/.test(String(l || '').replace(/[*_]+/g, ' ').replace(/\s+/g, ' ').trim());
  const suivante = (i) => { let j = i + 1; while (j < lines.length && !lines[j]) j++; return j; };
  for (let i = idx + 1; i < lines.length && parts.length < 5; i++) {
    const l = lines[i];
    if (!l) {
      if (!parts.length) continue;
      if (parts.some(cpVille)) break;
      const j = suivante(i);
      if (j < lines.length && cpVille(lines[j])) { i = j - 1; continue; }
      // La ligne « CP Ville » arrive dans les lignes suivantes (une ligne vide
      // entre chacune), sans pied d'e-mail ni date limite avant elle : on continue.
      let k = j, n = parts.length, ok = false;
      while (k < lines.length && n < 5) {
        if (cpVille(lines[k])) { ok = true; break; }
        if (STOP_LIEU.test(lines[k])) break;
        n++; k = suivante(k);
      }
      if (ok) { i = j - 1; continue; }
      break;
    }
    if (parts.some(cpVille)) break;
    if (parts.length >= 4 && !cpVille(l)) break;
    if (STOP_LIEU.test(l)) break;
    const propre = l.replace(/[*_]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (propre) parts.push(propre);
  }
  if (!parts.length) return null;
  return parts.join(', ').replace(/®|™|©/g, '').replace(/\s+(super\s*pratique|retrouvez).*$/i, '').replace(/\s{2,}/g, ' ').trim() || null;
}

// (10 nov.) LE NOUVEAU POINT d'un colis redirigé (« Votre colis a changé de plan » :
// le point prévu est indisponible). Lu SOUS la ligne qui le nomme « nouveau » ou
// « suivant » (« Votre nouveau Point Relais : », « livré dans le Point Relais
// suivant : »), avec la règle des lieux (`lieuSousEnTete`). Rien de tel ⇒ `null` :
// jamais l'ancien point ni un point deviné.
const EN_TETE_LIEU = /^(?:point\s+(?:relais|de\s+retrait)|(?:votre\s+)?locker(?:\s*24\s*\/?\s*7)?|(?:votre\s+)?consigne(?:\s+automatique)?|(?:votre\s+)?casier|adresse)\b[\s:–-]*$/i;
export function nouveauPointDansTexte(txt) {
  const lines = String(txt || '').split('\n').map((l) => l.trim());
  const norm = (l) => String(l).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const nomme = (l) => { const n = norm(l); return /\b(?:nouveau|nouvel|nouvelle|suivant|suivante)\b/.test(n) && /\b(?:point|relais|lieu|adresse|locker|consigne|casier)\b/.test(n) && !/\b(?:ancien|initial|prevu|choisi)\b/.test(n); };
  const enTete = (l) => EN_TETE_LIEU.test(l.replace(/®|™|©|[*_]+/g, ' ').replace(/\s+/g, ' ').trim());
  for (let i = 0; i < lines.length; i++) {
    if (!nomme(lines[i])) continue;
    const apres = lines[i].split(/[:：]/).slice(1).join(':').trim();
    const reste = [...(apres ? [apres] : []), ...lines.slice(i + 1)];
    // Les lignes vides, un en-tête « Point Relais » ou une autre ligne « nouveau point » avant le nom.
    while (reste.length && (!reste[0] || enTete(reste[0]) || nomme(reste[0]))) reste.shift();
    const l = lieuSousEnTete(['Point Relais', ...reste].join('\n'));
    if (l && /\d{5}/.test(l)) return l;
  }
  return null;
}

// Un « lieu » qui annonce le FUTUR (« … sera disponible dans les prochains jours
// dans votre Relais Pickup ») n'est pas un lieu : le colis n'est pas encore là.
export const LIEU_AU_FUTUR = /prochains?\s+jours|prochainement|d[èe]s\s+(?:son|que)/i;

// ── L'ÉTAT D'UN COLIS À RETIRER ─────────────────────────────────────────────
// 'a_retirer'     : il attend au point relais ;
// 'delai_depasse' : la date limite ÉCRITE par le transporteur est passée —
//                   sans doute reparti chez le vendeur, à vérifier (jamais « perdu ») ;
// 'trop_long'     : pas de date limite écrite, mais il est arrivé depuis plus
//                   de GARDE_MAX_J jours — même geste : à vérifier.
// Les colis « à vérifier » restent visibles (code et QR compris : il est peut-
// être encore là) mais ne comptent JAMAIS dans « à retirer ».
//   limite     : 'AAAA-MM-JJ' ou null (lue dans l'e-mail, jamais devinée) ;
//   arriveeMs  : l'arrivée (ou une borne : « arrivé au plus tard ») ;
//   aujourdhui : 'AAAA-MM-JJ' (le jour de l'appelant ; par défaut celui de l'appareil).
// ⚠️ (revue du 23 oct.) LE JOUR À L'HEURE DE PARIS, pas celui du processus : sur
// Vercel (UTC), une arrivée à 00 h 30 à Paris tombait la VEILLE, et le widget
// disait « à vérifier » un jour avant l'app (§11 : un nombre, deux écrans).
let FMT_PARIS = null;
const jourDe = (ms) => {
  try {
    FMT_PARIS = FMT_PARIS || new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' });
    const p = FMT_PARIS.formatToParts(new Date(ms));
    const v = (k) => (p.find((x) => x.type === k) || {}).value;
    if (v('year') && v('month') && v('day')) return `${v('year')}-${v('month')}-${v('day')}`;
  } catch (_) { /* repli : le jour de l'appareil */ }
  const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const tJour = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return m ? dateValide(+m[1], +m[2], +m[3]) : null; };
export function joursAvantLimite(limite, aujourdhui) {
  const fin = tJour(limite), auj = tJour(aujourdhui);
  if (fin == null || auj == null) return null;
  return Math.round((fin - auj) / 86400000);
}
//   transporteur : 'mondialrelay' · 'chronopost' · 'vinted' (Vinted Go) · autre ⇒
//                  la garde mesurée de ce transporteur (`gardeDe`), sinon GARDE_MAX_J.
//   limiteAt   : (29 oct.) l'HEURE de la limite quand le transporteur la donne
//                (Vinted Go `expiration_time`, ISO). Passée ⇒ « délai dépassé »
//                même si le jour n'est pas fini (un colis qui expire à 11 h 34
//                n'est plus « à retirer » à 15 h) ; sinon elle est rendue
//                (`limiteAt`) pour être DITE (« avant 11 h 34 »). Le jour reste
//                la clé de tri ; sans `limite`, le jour de `limiteAt` (Paris).
export const jourParis = (ms) => jourDe(ms);
const msIso = (v) => { if (!v) return null; const ms = Date.parse(String(v)); return Number.isFinite(ms) ? ms : null; };
export function etatRetrait({ limite = null, arriveeMs = null, transporteur = '', limiteAt = null } = {}, maintenant = Date.now(), aujourdhui = null) {
  const auj = aujourdhui || jourDe(maintenant);
  const atMs = msIso(limiteAt);
  if (!limite && atMs != null) limite = jourDe(atMs);
  const j = limite ? joursAvantLimite(limite, auj) : null;
  if (j != null) {
    if (j < 0) return { etat: 'delai_depasse', jours: j };
    // L'heure n'est jugée que le jour même de la limite (un `limiteAt` d'un
    // autre jour que `limite` ne dit rien de ce jour-là).
    if (atMs != null && jourDe(atMs) === limite) {
      if (maintenant >= atMs) return { etat: 'delai_depasse', jours: j, heurePassee: true, limiteAt: new Date(atMs).toISOString() };
      return { etat: 'a_retirer', jours: j, limiteAt: new Date(atMs).toISOString() };
    }
    return { etat: 'a_retirer', jours: j };
  }
  const garde = gardeDe(transporteur);
  if (Number.isFinite(arriveeMs) && arriveeMs > 0) {
    const age = joursAvantLimite(auj, jourDe(arriveeMs));
    if (age != null && age > garde) return { etat: 'trop_long', age, garde };
    return { etat: 'a_retirer', age, garde };
  }
  return { etat: 'a_retirer', garde };
}
export const estAVerifier = (e) => !!e && (e.etat === 'delai_depasse' || e.etat === 'trop_long');

// (6 nov., statut des colis) LA DATE LIMITE ESTIMÉE QUAND AUCUNE N'EST LUE : le jour
// (Paris) de l'arrivée + la garde MESURÉE de SON transporteur (Mondial Relay 5 j,
// Vinted Go 6 j, Chronopost 4 j). Seulement un transporteur LU (une clé de la table) et
// une arrivée connue : sinon null — « Date limite inconnue », jamais une garde d'un
// autre transporteur prêtée à ce colis. C'est la même borne que `etatRetrait` (au-delà :
// « à vérifier ») ; elle se DIT « estimée », jamais « en retard » ni « dernier jour ».
// Rend { jour: 'AAAA-MM-JJ', garde, estimee: true } ou null.
export function limiteEstimee({ arriveeMs = null, transporteur = '' } = {}) {
  const g = GARDE_PAR_TRANSPORTEUR[String(transporteur || '').toLowerCase().trim()];
  if (!Number.isFinite(g) || !Number.isFinite(arriveeMs) || arriveeMs <= 0) return null;
  const j0 = tJour(jourDe(arriveeMs)); if (j0 == null) return null;
  const d = new Date(j0 + g * 86400000);
  return { jour: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`, garde: g, estimee: true };
}

// Pour TRIER les points relais (jamais affiché) : les jours qui restent si la
// limite est écrite, sinon ce qui reste de la garde la plus longue mesurée.
export function urgenceTri(e) {
  if (!e) return Infinity;
  if (Number.isFinite(e.jours)) return e.jours;
  if (Number.isFinite(e.age)) return (Number.isFinite(e.garde) ? e.garde : GARDE_MAX_J) - e.age;
  return Infinity;
}

// ── CE QUE L'APP PUBLIE, RELU PAR LE WIDGET (§11) ────────────────────────────
// L'app publie `vrm_colis_retirer.colis` = la liste des colis qu'elle compte
// « à retirer » : [limite|'', arriveeMs|0, transporteur|'', identité]. Le widget
// la RELIT avec la règle ci-dessus au moment où il s'affiche : un colis dont la
// limite passe pendant que l'app est fermée sort de son compte, sans attendre la
// prochaine ouverture.
// ⚠️ (revue du 23 oct.) ET UN COLIS QUI EST SORTI DU POINT RELAIS DEPUIS LA PHOTO
// en sort aussi : l'identité de chaque colis compté (« e:<n° de suivi> » pour un
// colis d'e-mail, « v:<compte>:<transaction> » pour un achat Vinted) est publiée,
// et `sorti(identité, entrée)` dit ce que le widget a RELU depuis : true (retiré,
// reparti, plus au point relais) · false (toujours là) · null (pas su : identité
// absente — une publication d'avant — ou lecture ratée). Sans cette relecture,
// un colis retiré ou reparti après la dernière ouverture de l'app restait compté
// « à retirer » jusqu'à sa date limite, et le nombre se disait complet. Ce que le
// widget n'a pas pu relire est COMPTÉ (`nonRelus`) : l'appelant le dit.
// Absente ou illisible ⇒ null (« pas su » : l'appelant retombe sur ce qu'il sait).
// ⚠️ (24 oct.) `leve(identité, entrée, e)` (facultatif) : la garde levée par ce que
// le TRANSPORTEUR dit (une lecture « disponible » de moins de 6 h, la règle
// `leverGarde` de l'app) — sans elle, le widget rangeait « à vérifier » un colis
// que l'app compte « à retirer » (mesuré au banc `transporteurs.cjs`). Rend
// l'état à garder ; jamais une date limite lue et dépassée n'est levée.
// ⚠️ (29 oct.) `sorti` peut rendre 'a_verifier' : le transporteur signale un
// incident (« a quitté le point relais sans être retiré ») ou un statut inconnu
// depuis la photo — le colis passe « à vérifier » (compté dans `aVerifier`),
// JAMAIS « sorti » : rien ne dit qu'il a été retiré (la règle de l'app,
// `sortiParSuivis`). Avant, il était compté sorti et disparaissait du widget.
// L'entrée publiée : [limite, arrivée, transporteur, identité, arrivée sûre
// (1 · 0 = une borne · absent = publication d'avant), n° de suivi (achat Vinted),
// heure de la limite (ISO, `limiteAt`)].
export function retirerPublie(pub, maintenant = Date.now(), aujourdhui = null, sorti = null, leve = null) {
  if (!pub || typeof pub !== 'object' || !Array.isArray(pub.colis)) return null;
  let n = 0, aVerifier = Number.isFinite(pub.aVerifier) ? pub.aVerifier : 0, urgents = 0, sortis = 0, nonRelus = 0, devenusAVerifier = 0;
  // (29 oct., tour 2 n° 7) LES « À VÉRIFIER » PUBLIÉS AVEC LEUR IDENTITÉ (`verif`,
  // la forme de `colis`) : relus par la même règle (`sorti`) — un colis que le
  // transporteur dit retiré ou reparti depuis sort aussi de « à vérifier », sans
  // attendre la prochaine ouverture de l'app. Une photo d'avant (sans `verif`) :
  // le nombre publié, tel quel.
  if (Array.isArray(pub.verif) && typeof sorti === 'function') {
    aVerifier = 0;
    for (const c of pub.verif) {
      const cle = Array.isArray(c) && typeof c[3] === 'string' ? c[3] : '';
      if (cle && sorti(cle, c) === true) { sortis++; continue; }
      aVerifier++;
    }
  }
  for (const c of pub.colis) {
    if (!Array.isArray(c)) return null;
    const cle = typeof c[3] === 'string' ? c[3] : '';
    if (typeof sorti === 'function') {
      const s = cle ? sorti(cle, c) : null;
      if (s === true) { sortis++; continue; }
      if (s === 'a_verifier') { aVerifier++; devenusAVerifier++; continue; }
      if (s !== false) nonRelus++;
    }
    let e = etatRetrait({ limite: c[0] || null, arriveeMs: Number(c[1]) || null, transporteur: c[2] || '', limiteAt: typeof c[6] === 'string' && c[6] ? c[6] : null }, maintenant, aujourdhui);
    if (typeof leve === 'function' && cle) { const l = leve(cle, c, e); if (l && l.etat) e = l; }
    if (estAVerifier(e)) { aVerifier++; continue; }
    n++;
    if (Number.isFinite(e.jours) && e.jours <= 1) urgents++;
  }
  // (29 oct.) Les achats « au point relais » qu'aucune identité ne relie encore
  // (ni code, ni n° de suivi, compte pas encore relu) : l'app ne les compte pas
  // dans le total, elle les dit à part. Le widget le dit (« au moins »).
  const enVerification = Number.isFinite(pub.enVerification) && pub.enVerification > 0 ? pub.enVerification : 0;
  return { n, aVerifier, urgents, sortis, nonRelus, devenusAVerifier, enVerification, at: Number.isFinite(pub.at) ? pub.at : null };
}
