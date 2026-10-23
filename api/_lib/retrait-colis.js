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
  for (const y of [r.y, r.y + 1]) {
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
export function limiteRetraitDepuisTexte(texte, recuLe) {
  // Les lignes gardées d'un ancien e-mail portent encore leurs entités
  // (« jusqu&rsquo;au ») : décodées d'abord, comme la route le fait (§11).
  const all = decoderEntitesHtml(texte || '');
  if (!all) return null;
  // 1) Avec l'année (formes d'avant : « jusqu'au vendredi 21 août 2026 »,
  //    « jusqu'au 21/08/2026 », « À retirer avant le 29/09/2026 »).
  const mTxt = all.match(new RegExp(`${AV}\\s+${JOURS}\\s*(\\d{1,2})\\s+([a-zà-ÿ]+)\\s+(\\d{4})`, 'i'));
  if (mTxt) {
    const mo = MOIS[mTxt[2].toLowerCase()];
    if (mo && dateValide(+mTxt[3], mo, +mTxt[1]) != null) return `${mTxt[3]}-${pad(mo)}-${pad(+mTxt[1])}`;
  }
  const mNum = all.match(new RegExp(`${AV}\\s+${JOURS}\\s*(\\d{1,2})[\\/.](\\d{1,2})[\\/.](\\d{4})`, 'i'));
  if (mNum && dateValide(+mNum[3], +mNum[2], +mNum[1]) != null) return `${mNum[3]}-${pad(+mNum[2])}-${pad(+mNum[1])}`;
  // 2) SANS l'année (23 oct., mesuré : Mondial Relay « RETRAIT JUSQU'AU 26/10 »).
  const nNum = all.match(new RegExp(`${AV}\\s+${JOURS}\\s*(\\d{1,2})[\\/.](\\d{1,2})(?![\\/.]?\\d)`, 'i'));
  if (nNum) { const l = avecAnnee(+nNum[1], +nNum[2], recuLe); if (l) return l; }
  const nTxt = all.match(new RegExp(`${AV}\\s+${JOURS}\\s*(\\d{1,2})\\s+([a-zà-ÿ]+)(?!\\s+\\d{4})`, 'i'));
  if (nTxt) {
    const mo = MOIS[nTxt[2].toLowerCase()];
    if (mo) { const l = avecAnnee(+nTxt[1], mo, recuLe); if (l) return l; }
  }
  return null;
}

// LE LIEU tel que l'e-mail l'écrit dans les lignes gardées autour d'un code
// postal (`extraitLieu`, « NOM | rue | CP Ville | … »). On ne le prend QUE sous
// cette forme exacte, au début : le nom (sans code postal, pas le transporteur),
// une rue qui commence par son numéro, un code postal suivi de la ville. Sinon
// rien — c'est le texte de l'e-mail, jamais une déduction.
const PAS_UN_NOM = /\b(?:mondial\s*relay|chronopost|vinted|pickup\s+services?|exp[ée]diteur|destinataire|avec\s+\d+|points?\s+de\s+proximit|prière|ne\s+pas\s+r[ée]pondre|code|retrait|jusqu)/i;
export function lieuDepuisExtrait(extrait) {
  const parts = decoderEntitesHtml(extrait || '').split('|').map((x) => x.replace(/[*_]+/g, ' ').replace(/®|™|©/g, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean);
  if (parts.length < 3) return null;
  const [nom, rue, ville] = parts;
  if (!nom || nom.length < 2 || nom.length > 60 || /\d{5}/.test(nom) || PAS_UN_NOM.test(nom)) return null;
  if (nom.replace(/[^a-zà-ÿ]/gi, '').length < 3) return null;
  if (!/^\d{1,4}(?:\s*(?:bis|ter))?[\s,]+[A-Za-zÀ-ÿ]/.test(rue) || rue.length > 80 || /\d{5}/.test(rue)) return null;
  if (!/^\d{5}\s+[A-Za-zÀ-ÿ'’\- ]{2,40}$/.test(ville)) return null;
  return `${nom}, ${rue}, ${ville}`;
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
const jourDe = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const tJour = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return m ? dateValide(+m[1], +m[2], +m[3]) : null; };
export function joursAvantLimite(limite, aujourdhui) {
  const fin = tJour(limite), auj = tJour(aujourdhui);
  if (fin == null || auj == null) return null;
  return Math.round((fin - auj) / 86400000);
}
export function etatRetrait({ limite = null, arriveeMs = null } = {}, maintenant = Date.now(), aujourdhui = null) {
  const auj = aujourdhui || jourDe(maintenant);
  const j = limite ? joursAvantLimite(limite, auj) : null;
  if (j != null) return j < 0 ? { etat: 'delai_depasse', jours: j } : { etat: 'a_retirer', jours: j };
  if (Number.isFinite(arriveeMs) && arriveeMs > 0) {
    const age = joursAvantLimite(auj, jourDe(arriveeMs));
    if (age != null && age > GARDE_MAX_J) return { etat: 'trop_long', age };
    return { etat: 'a_retirer', age };
  }
  return { etat: 'a_retirer' };
}
export const estAVerifier = (e) => !!e && (e.etat === 'delai_depasse' || e.etat === 'trop_long');

// Pour TRIER les points relais (jamais affiché) : les jours qui restent si la
// limite est écrite, sinon ce qui reste de la garde la plus longue mesurée.
export function urgenceTri(e) {
  if (!e) return Infinity;
  if (Number.isFinite(e.jours)) return e.jours;
  if (Number.isFinite(e.age)) return GARDE_MAX_J - e.age;
  return Infinity;
}

// ── CE QUE L'APP PUBLIE, RELU PAR LE WIDGET (§11) ────────────────────────────
// L'app publie `vrm_colis_retirer.colis` = la liste des colis qu'elle compte
// « à retirer » ([limite|'', arriveeMs|0]). Le widget la RELIT avec la règle
// ci-dessus au moment où il s'affiche : un colis dont la limite passe pendant
// que l'app est fermée sort de son compte, sans attendre la prochaine ouverture.
// Absente ou illisible ⇒ null (« pas su » : l'appelant retombe sur ce qu'il sait).
export function retirerPublie(pub, maintenant = Date.now(), aujourdhui = null) {
  if (!pub || typeof pub !== 'object' || !Array.isArray(pub.colis)) return null;
  let n = 0, aVerifier = Number.isFinite(pub.aVerifier) ? pub.aVerifier : 0, urgents = 0;
  for (const c of pub.colis) {
    if (!Array.isArray(c)) return null;
    const e = etatRetrait({ limite: c[0] || null, arriveeMs: Number(c[1]) || null }, maintenant, aujourdhui);
    if (estAVerifier(e)) { aVerifier++; continue; }
    n++;
    if (Number.isFinite(e.jours) && e.jours <= 1) urgents++;
  }
  return { n, aVerifier, urgents, at: Number.isFinite(pub.at) ? pub.at : null };
}
