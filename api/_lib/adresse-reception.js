// ═══════════════════════════════════════════════════════════════════════════
// L'ADRESSE DE RÉCEPTION UNIQUE D'UN VENDEUR (8 nov. — Julien : « il faut
// absolument qu'on mette ça en place », comme vtools)
// ═══════════════════════════════════════════════════════════════════════════
// Chaque vendeur reçoit SA propre adresse VRM, aléatoire, sur un domaine dédié
// (`DOMAINE_RECEPTION`, variable du serveur, vide ⇒ la fonction se tait) :
//     k7p2…@<domaine>
// Il y crée un transfert automatique depuis Gmail / iCloud / Outlook / Yahoo, ou
// la donne directement comme e-mail d'un compte Vinted. Tout e-mail livré à
// cette adresse est rangé chez LUI : l'adresse EST la preuve (§5 « c'est
// l'adresse de RÉCEPTION qui décide » — ici, l'adresse de réception ne peut
// appartenir qu'à un vendeur, puisque c'est VRM qui l'a fabriquée pour lui).
//
// ── LE JETON ─────────────────────────────────────────────────────────────────
// 24 caractères tirés par `crypto.randomBytes` (tirage par rejet : aucun biais),
// dans un alphabet sans ambiguïté (ni i, l, o, 0, 1) : 31^24 ≈ 2^119 adresses.
// En minuscules seulement (une adresse e-mail se recopie, se dicte, se lit sur
// un téléphone ; la casse d'une partie locale n'est pas fiable d'un serveur à
// l'autre).
//
// ── OÙ IL VIT ────────────────────────────────────────────────────────────────
//   · `vrm_adresse_reception` (owner = le vendeur) : { jeton, actif, creeLe,
//     remplaceLe? } — écrite par le SERVEUR seul (api/email-rattacher.js, sur
//     sa session) ; l'app ne fait que la lire.
//   · l'index `jeton_reception_{sha256}` (owner = NEUTRE, illisible par toute
//     session — api/_lib/jeton-index.js) : { owner, genre, at } ; une ancienne
//     adresse remplacée garde son index, marqué `remplaceeLe` (jamais un
//     vendeur) : un e-mail qui y arrive est mis en quarantaine en le disant.
//   · `vrm_adresse_reception_vu` (owner = le vendeur) : le DERNIER e-mail reçu à
//     l'adresse (date, sujet, expéditeur) — la preuve que le transfert marche ;
//   · `vrm_adresse_reception_code` (owner = le vendeur) : le dernier code de
//     confirmation de transfert (Gmail, Yahoo…) reçu à SON adresse.
// L'index ne fait JAMAIS foi seul : le jeton est RE-COMPARÉ (durée constante) à
// celui de la ligne du vendeur désigné, et `actif` y est relu.
//
// ── CE QUI EN SORT ───────────────────────────────────────────────────────────
// `vendeurDeJeton` rend { etat: 'trouve', owner } — ou 'absent' (aucun index),
// 'remplacee', 'perime' (la ligne du vendeur porte un autre jeton), 'inactif'
// (il l'a éteinte) ; `undefined` = pas su (une lecture a raté ⇒ 503, le service
// de réception rejoue). Tout ce qui n'est pas 'trouve' ⇒ quarantaine au
// propriétaire NEUTRE, SANS adresse réclamable : jamais chez un autre vendeur,
// jamais jeté (§5 « on ne jette aucun email »).
// Tenu par scripts/audit-adresse-reception.cjs (EXÉCUTE api/email-inbound.js).
// ═══════════════════════════════════════════════════════════════════════════
import crypto from 'crypto';
import { PROPRIETAIRE_NEUTRE, normAdresse } from './proprietaire-email.js';
import { idIndexJeton, memeJeton, ecrireIndexJeton } from './jeton-index.js';
import { lireConfirmationTransfert, estConfirmationTransfert } from './transfert-gmail.js';

export const ALPHABET_JETON = 'abcdefghjkmnpqrstuvwxyz23456789';
export const LONGUEUR_JETON = 24;
export const GENRE = 'reception';
export const ID_ADRESSE = 'vrm_adresse_reception';
export const ID_VU = 'vrm_adresse_reception_vu';
export const ID_CODE = 'vrm_adresse_reception_code';
const RE_JETON = new RegExp(`^[${ALPHABET_JETON}]{${LONGUEUR_JETON}}$`);
const RE_DOMAINE = /^(?=.{3,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;
const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// LA constante : le domaine de réception, lu sur le serveur (Vercel →
// Environment Variables → `DOMAINE_RECEPTION`, ex. `recu-vrm.fr`). Vide ou mal
// formé ⇒ '' : aucune adresse n'est fabriquée, la feuille dit ce qui manque.
export function domaineReception(env = process.env) {
  const d = String((env && env.DOMAINE_RECEPTION) || '').trim().toLowerCase().replace(/^@/, '').replace(/\.$/, '');
  return RE_DOMAINE.test(d) ? d : '';
}

export function nouveauJeton(aleas = crypto.randomBytes) {
  const n = ALPHABET_JETON.length, plafond = 256 - (256 % n);   // 248 : au-delà, le modulo biaiserait
  let out = '';
  while (out.length < LONGUEUR_JETON) {
    for (const b of aleas(32)) {
      if (b >= plafond) continue;
      out += ALPHABET_JETON[b % n];
      if (out.length === LONGUEUR_JETON) break;
    }
  }
  return out;
}
export const jetonValide = (j) => RE_JETON.test(String(j || ''));
export const adresseDeJeton = (jeton, domaine) => (jetonValide(jeton) && domaine ? `${jeton}@${domaine}` : '');

// L'enveloppe RÉELLE (`message.to` du Worker Cloudflare, `envelope.to` d'un autre
// service) quand le corps la donne : c'est elle qui dit à QUI l'e-mail a été
// livré ; les en-têtes To/Cc d'un e-mail transféré disent encore la boîte
// d'origine du vendeur (ou celle d'un autre destinataire).
export function enveloppeDe(corps) {
  const b = corps && typeof corps === 'object' ? corps : {};
  const brut = b.envelopeTo || b.envelope_to || (b.envelope && (b.envelope.to || b.envelope.To)) || '';
  const liste = Array.isArray(brut) ? brut : String(brut || '').split(/[,;]/);
  return [...new Set(liste.map(normAdresse).filter((a) => a.includes('@')))];
}

// Parmi des adresses de livraison, celles du domaine de réception.
//   { jetons: [jeton…] distincts et bien formés, surDomaine: [adresse…] }
// Une étiquette « + » est ignorée (k7p…+vinted@domaine = k7p…@domaine).
export function jetonsDesAdresses(adresses, domaine) {
  const jetons = [], surDomaine = [];
  if (!domaine) return { jetons, surDomaine };
  for (const brute of adresses || []) {
    const a = normAdresse(brute);
    const i = a.lastIndexOf('@');
    if (i < 1 || a.slice(i + 1) !== domaine) continue;
    if (!surDomaine.includes(a)) surDomaine.push(a);
    const local = a.slice(0, i).split('+')[0];
    if (jetonValide(local) && !jetons.includes(local)) jetons.push(local);
  }
  return { jetons, surDomaine };
}

const lireUne = async (fetcher, url, headers, requete) => {
  try {
    const r = await fetcher(`${url}/rest/v1/app_data?${requete}`, { headers });
    if (!r || !r.ok) return undefined;
    const j = await r.json();
    return Array.isArray(j) ? (j[0] || null) : undefined;
  } catch (_) { return undefined; }
};

// LE VENDEUR D'UN JETON (voir l'en-tête). Deux lectures par clé exacte.
export async function vendeurDeJeton({ url, headers, fetcher = fetch, jeton }) {
  if (!jetonValide(jeton)) return { etat: 'absent' };
  const ix = await lireUne(fetcher, url, headers, `owner=eq.${PROPRIETAIRE_NEUTRE}&id=eq.${idIndexJeton(GENRE, jeton)}&select=o:data->>owner,r:data->>remplaceeLe&limit=1`);
  if (ix === undefined) return undefined;
  if (!ix) return { etat: 'absent' };
  if (ix.r) return { etat: 'remplacee', depuis: String(ix.r) };
  const owner = String(ix.o || '');
  if (!RE_UUID.test(owner) || owner === PROPRIETAIRE_NEUTRE) return { etat: 'perime' };
  const l = await lireUne(fetcher, url, headers, `owner=eq.${encodeURIComponent(owner)}&id=eq.${ID_ADRESSE}&select=t:data->>jeton,a:data->>actif&limit=1`);
  if (l === undefined) return undefined;
  if (!l || !l.t || !memeJeton(jeton, l.t)) return { etat: 'perime' };
  if (String(l.a) === 'false') return { etat: 'inactif', owner };
  return { etat: 'trouve', owner };
}

export const RAISON_QUARANTAINE = {
  absent: "adresse VRM inconnue : aucun vendeur n'a cette adresse",
  remplacee: "adresse VRM remplacée par son vendeur : elle ne reçoit plus rien",
  perime: "adresse VRM qui ne correspond plus à son vendeur",
  inactif: "adresse VRM désactivée par son vendeur",
  illisible: "adresse VRM mal formée",
  plusieurs: "plusieurs adresses VRM différentes sur le même e-mail : aucune n'est choisie",
};

// L'index d'une adresse (le serveur seul l'écrit, sous le propriétaire neutre).
export const ecrireIndexReception = ({ url, headers, fetcher = fetch, jeton, owner, maintenant }) =>
  ecrireIndexJeton({ url, headers, fetcher, genre: GENRE, jeton, owner, maintenant });
// Une adresse remplacée : son index reste, mais ne désigne plus PERSONNE.
export async function marquerRemplacee({ url, headers, fetcher = fetch, jeton, maintenant = Date.now() }) {
  if (!jetonValide(jeton)) return true;
  const at = new Date(maintenant).toISOString();
  try {
    const r = await fetcher(`${url}/rest/v1/app_data?on_conflict=owner,id`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([{ owner: PROPRIETAIRE_NEUTRE, id: idIndexJeton(GENRE, jeton), data: { genre: GENRE, remplaceeLe: at, at }, updated_at: at }]),
    });
    return !!(r && r.ok);
  } catch (_) { return false; }
}

// ── LE CODE DE CONFIRMATION D'UN TRANSFERT ──────────────────────────────────
// Gmail (et Yahoo) envoient un message de confirmation À L'ADRESSE de
// destination : ici, celle du vendeur — c'est donc à LUI qu'il revient, et VRM
// le lui montre (le code, « Copier », et le lien de confirmation s'il est dans
// le message). Gmail : la règle stricte de api/_lib/transfert-gmail.js (sujet
// et corps d'accord sur UNE adresse source et UN code, destination = SON
// adresse). Le lien n'est rendu que s'il pointe chez le fournisseur lui-même
// (liste blanche d'hôtes) : un faux message ne fait pas afficher un lien piégé.
const HOTES_LIEN = {
  gmail: /^https:\/\/(?:mail-settings\.google\.com|mail\.google\.com|isolated\.mail\.google\.com)\//i,
  yahoo: /^https:\/\/(?:[a-z0-9-]+\.)*(?:yahoo\.com|yahoo\.net)\//i,
  outlook: /^https:\/\/(?:[a-z0-9-]+\.)*(?:live\.com|outlook\.com|microsoft\.com|office\.com)\//i,
};
const texteBrut = (mail) => {
  const t = String((mail && mail.text) || '');
  const h = String((mail && mail.html) || '');
  const liens = [...h.matchAll(/href\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1].replace(/&amp;/g, '&'));
  return t + '\n' + h.replace(/<[^>]+>/g, ' ') + '\n' + liens.join('\n');
};
const premierLien = (mail, fournisseur) => {
  const re = HOTES_LIEN[fournisseur];
  for (const m of texteBrut(mail).matchAll(/https:\/\/[^\s"'<>)\]]+/gi)) {
    const u = m[0].replace(/[.,;]+$/, '');
    if (re.test(u)) return u.slice(0, 600);
  }
  return '';
};
const DE_YAHOO = /@(?:[a-z0-9-]+\.)*(?:yahoo\.com|yahoo-inc\.com|yahoo\.fr)\b/i;
const DE_MICROSOFT = /@(?:[a-z0-9-]+\.)*(?:microsoft\.com|outlook\.com|live\.com)\b/i;
const SUJET_TRANSFERT = /(transf[ée]r|forward)/i;
const SUJET_CONFIRMER = /(confirm|v[ée]rif|valid)/i;

export function lireCodeTransfert(mail, adresse, { signeGoogle = false } = {}) {
  if (!mail) return null;
  if (estConfirmationTransfert(mail)) {
    const lu = lireConfirmationTransfert(mail, { destination: adresse });
    if (!lu) return null;
    return { fournisseur: 'gmail', code: lu.code, source: lu.source, lien: premierLien(mail, 'gmail'), signe: !!signeGoogle };
  }
  const from = String(mail.from || ''), sujet = String(mail.subject || '');
  const fournisseur = DE_YAHOO.test(from) ? 'yahoo' : DE_MICROSOFT.test(from) ? 'outlook' : '';
  if (!fournisseur || !SUJET_TRANSFERT.test(sujet) || !SUJET_CONFIRMER.test(sujet)) return null;
  const texte = texteBrut(mail);
  const codes = [...new Set([...texte.matchAll(/\bcode\b[^0-9\n]{0,30}(\d{6,10})\b/gi)].map((m) => m[1]))];
  const lien = premierLien(mail, fournisseur);
  if (!lien && codes.length !== 1) return null;
  const sources = [...new Set((texte.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) || []).map(normAdresse))]
    .filter((a) => a !== normAdresse(adresse) && !/@(?:[a-z0-9-]+\.)*(?:yahoo-inc\.com|microsoft\.com)$/.test(a) && !/no-?reply/.test(a));
  return { fournisseur, code: codes.length === 1 ? codes[0] : '', source: sources.length === 1 ? sources[0] : '', lien, signe: false };
}

// ── L'E-MAIL D'ESSAI (10 nov. — « Recevoir tes e-mails Vinted dans VRM ») ────
// La feuille fabrique un petit code (4 à 8 caractères de l'alphabet sans
// ambiguïté, en MAJUSCULES) et propose d'envoyer « Essai VRM K7P2 » à SON
// adresse. Quand cet e-mail arrive, le code est rangé chez LUI
// (`vrm_adresse_reception_essai`, une ligne à part : le « dernier e-mail reçu »
// est réécrit par le prochain e-mail Vinted, l'essai non). La feuille montre
// « Reçu ✓ » quand le code rangé est CELUI qu'elle attend — une identité, pas
// une heure. Rien d'autre n'est lu de l'e-mail (ni corps, ni pièce jointe).
export const ID_ESSAI = 'vrm_adresse_reception_essai';
export const RE_CODE_ESSAI = new RegExp(`(?:^|[^A-Za-z0-9])essai\\s+vrm\\s*[:#·-]?\\s*([${ALPHABET_JETON}]{4,8})(?![A-Za-z0-9])`, 'i');
export function codeEssaiDe(sujet) {
  const m = RE_CODE_ESSAI.exec(String(sujet || ''));
  return m ? m[1].toUpperCase() : '';
}

// ── CE QUI MANQUE POUR OUVRIR LA RÉCEPTION (au seul propriétaire) ────────────
// Ce que le serveur SAIT de lui-même — jamais une valeur, seulement « posée » ou
// non. Le reste (DNS, Cloudflare, Worker) ne se voit pas d'ici : il se prouve
// par l'e-mail d'essai, une fois le domaine posé.
//   domaine : 'ok' · 'absent' · 'mal-forme'      cle : true · false
export function etatMiseEnService(env = process.env) {
  const brut = String((env && env.DOMAINE_RECEPTION) || '').trim();
  return {
    domaine: domaineReception(env) ? 'ok' : brut ? 'mal-forme' : 'absent',
    cle: !!String((env && env.EMAIL_INBOUND_SECRET) || '').trim(),
  };
}
