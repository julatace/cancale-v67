// api/_lib/notif-redaction.js
// ────────────────────────────────────────────────────────────────────────────
// (15 nov.) LA RÈGLE DE RÉDACTION D'UNE NOTIFICATION — une, partagée.
//
// Julien (15 nov., capture de son iPhone) : « Fais de plus belles notifications ».
// On y lisait « n° 37451417 est relié à VRM » (l'identifiant d'un compte, pas un
// nom), « Vendu 62 € · N°215 » (sans la paire), « à déposer avant le 23/11/2026 »
// (une date de machine), « Dernier : Nouvelle offre · « New balance 9060 vert et
// blanc taille 38 » · <pseudo de l’acheteuse> — expire en 24h. » (trop long, et le pseudo
// de l'acheteur). Récit : docs/passation/2026-11-15-notifications-belles.md.
//
// LA RÈGLE (chaque texte de notification la suit) :
//   · titre ≤ 40 caractères, qui dit l'essentiel (« Vendu 62 € · Nike Air Max 1 ») ;
//   · corps ≤ 90 caractères, avec le geste ;
//   · dates EN CLAIR, heure de Paris (« demain 10 h », « lun. 23 nov. 10 h ») ;
//   · montants « 62 € » / « 61,20 € » ;
//   · JAMAIS un identifiant technique (n° de compte, de transaction, uid, code
//     machine) ni le pseudo d'un acheteur ; le N° de rangement « N°215 » quand il
//     est sûr (lu par identité, jamais deviné) ;
//   · la langue du compte (fr, en, es, it, de — `user_metadata.langue`), le
//     français par défaut.
// `rediger({ sorte, ...donnees }, { langue, maintenant, relatif })` fabrique le
// texte d'une sorte ; `api/_lib/push.js` (`sendPushToAll`) le refait dans la
// langue du vendeur au moment d'envoyer. Les fabriques (notif-apercus.js,
// src/compteRelie.js, src/prixAchatVente.js) passent par ici.
// Pur : aucune lecture, aucune écriture, aucun module Node — l'app l'importe.
// ────────────────────────────────────────────────────────────────────────────

import { redigerBilanMois, redigerSeuil } from './argent-notif.js';   // (15 nov., lot argent-plus)

export const TITRE_MAX = 40;
export const CORPS_MAX = 90;
export const LANGUES_NOTIF = ['fr', 'en', 'es', 'it', 'de'];
const LOCALES = { fr: 'fr-FR', en: 'en-GB', es: 'es-ES', it: 'it-IT', de: 'de-DE' };
export const langueNotif = (l) => { const x = String(l == null ? '' : l).toLowerCase().slice(0, 2); return LANGUES_NOTIF.includes(x) ? x : 'fr'; };

const str = (v) => String(v == null ? '' : v);
// Les blancs ramenés à une espace — SAUF l'insécable (« 62\u00a0€ » reste collé).
const BLANCS = /[^\S\u00a0\u202f]+/g;
const espaces = (s) => str(s).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(BLANCS, ' ').trim();

// Couper sans casser un mot : au dernier espace avant la limite, puis « … ».
export function couperMot(s, n) {
  const x = espaces(s);
  if (x.length <= n) return x;
  const tete = x.slice(0, n - 1);
  const i = tete.lastIndexOf(' ');
  return (i >= Math.floor(n * 0.6) ? tete.slice(0, i) : tete).replace(/[\s·,:;—–-]+$/, '') + '…';
}

// Un corps de plusieurs phrases trop long : on garde les phrases ENTIÈRES qui tiennent
// (« Vendu : 9 ventes · 412 €. Reçu : 380 €. … »), jamais une phrase coupée au milieu ;
// une seule phrase trop longue ⇒ coupée sur un mot.
export function couperPhrases(s, n) {
  const x = espaces(s);
  if (x.length <= n) return x;
  // (15 nov., rouges-connus) SANS « lookbehind » `(?<=…)` : ce fichier est aussi dans le paquet de l'app,
  // et Safari < 16.4 refuse de LIRE un paquet qui en contient un (audit-safari). Même découpe : après
  // . ! ? suivi d'espaces, les espaces retirés.
  const phrases = x.replace(/([.!?])\s+/g, '$1\u0000').split('\u0000');
  let out = '';
  for (const p of phrases) { const t = out ? `${out} ${p}` : p; if (t.length > n - 2) break; out = t; }
  return out && out.length >= n * 0.4 ? `${out} …` : couperMot(x, n);
}

// ── LES IDENTIFIANTS TECHNIQUES ─────────────────────────────────────────────
// Deux niveaux :
//   · PARTOUT (`sansIdentifiant`, appliqué par notif-belle.js à tout ce qui sonne) :
//     un uuid, une clé de ligne (`harvest_…`, `email_…`) — jamais un geste ;
//   · dans les textes de CETTE règle (`sansIdentifiant(s, { strict: true })`) : en
//     plus « n° 37451417 » (un compte) et un nombre nu de 9 chiffres ou plus (un n°
//     de transaction). Un n° de SUIVI d'un transporteur (« XW000000051TS »,
//     « Mondial Relay n°87654321 ») reste ailleurs : il est imprimé sur le colis et
//     le point relais le demande. Le N° de rangement (« N°215 », « B125 ») et un code
//     de retrait restent toujours : ce sont des gestes.
const RE_IDS = [
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
  /\b(?:harvest|email|vinted|push|vc|lbc|ebay)_[A-Za-z0-9_]{3,}\b/g,
];
const RE_IDS_STRICTS = [
  /\bn[°ºo]\s*\d{6,}\b/gi,
  // Un nombre nu de 9 chiffres ou plus, sans lettre, virgule ni point collés. Le caractère d'avant est
  // PRIS dans `$1` et rendu tel quel (Safari < 16.4 ne lit pas `(?<!…)`, voir `couperPhrases`).
  [/(^|[^\w,.])\d{9,}(?![\w,.])/g, '$1 '],
];
export function sansIdentifiant(s, { strict = false } = {}) {
  let x = str(s);
  for (const e of strict ? [...RE_IDS, ...RE_IDS_STRICTS] : RE_IDS) { const [re, par] = Array.isArray(e) ? e : [e, ' ']; x = x.replace(re, par); }
  return x.replace(/\(\s*\)/g, ' ').replace(/(?:\s*·\s*){2,}/g, ' · ').replace(/\s+,/g, ',')
    .replace(BLANCS, ' ').replace(/^[\s·:—–-]+/, '').replace(/[\s·:—–-]+$/, '').trim();
}
export const aUnIdentifiant = (s, { strict = true } = {}) => (strict ? [...RE_IDS, ...RE_IDS_STRICTS] : RE_IDS).some((e) => { const re = Array.isArray(e) ? e[0] : e; re.lastIndex = 0; const ok = re.test(str(s)); re.lastIndex = 0; return ok; });

// ── LES MONTANTS ────────────────────────────────────────────────────────────
// « 62 € », « 61,20 € » (« €62 » en anglais). Illisible ⇒ '' (jamais « 0 € »).
export function nombreEuros(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? v : null;
  const m = /(\d{1,6}(?:[ .  ]\d{3})*(?:[.,]\d{1,2})?)/.exec(str(v));
  if (!m) return null;
  let s = m[1].replace(/[   ]/g, '');
  if (/^\d{1,3}(?:\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}
export function montantClair(v, langue = 'fr') {
  const n = nombreEuros(v);
  if (n == null) return '';
  const c = Math.round(n * 100);
  const sep = langue === 'en' ? '.' : ',';
  const txt = c % 100 === 0 ? String(c / 100) : (c / 100).toFixed(2).replace('.', sep);
  // Espace insécable avant « € » : jamais « 62 » en fin de ligne et « € » sur la suivante.
  return langue === 'en' ? `€${txt}` : `${txt}\u00a0€`;
}

// ── LE NOM COURT D'UN ARTICLE ───────────────────────────────────────────────
// « New balance 9060 vert et blanc taille 38 » ⇒ « 9060 vert/blanc T38 » ; « Nike
// Air Max 1 » reste tel quel. Dans l'ordre, seulement tant que c'est trop long :
// la taille en « T38 », « vert et blanc » en « vert/blanc », la marque en tête
// retirée (s'il reste un modèle d'au moins deux mots), puis coupé sur un mot.
const MARQUES = ['new balance', 'nike', 'adidas originals', 'adidas', 'asics', 'puma', 'reebok', 'vans', 'converse', 'salomon', 'saucony', 'hoka one one', 'hoka', 'on running', 'veja', 'timberland', 'dr. martens', 'dr martens', 'birkenstock', 'onitsuka tiger', 'balenciaga', 'yeezy', 'fila', 'diadora', 'le coq sportif', 'lacoste', 'karhu', 'mizuno', 'autry', 'golden goose', 'common projects', 'ugg', 'crocs', 'clarks'];
export const NOM_COURT_MAX = 24;
export function nomCourt(titre, max = NOM_COURT_MAX) {
  let t = espaces(titre).replace(/^[«"“'\s]+|[»"”'\s]+$/g, '');
  if (!t) return '';
  t = sansIdentifiant(t, { strict: true });
  const compacter = (x) => x
    .replace(/\b(?:taille|pointure|size|talla|taglia|größe|groesse|gr\.?|t\.)\s*:?\s*(\d{2}(?:[.,]5)?|\d{1,2}(?:[.,]5)?\s?(?:us|uk|eu))\b/gi, (m, n) => `T${n.replace(/\s/g, '').toUpperCase()}`)
    .replace(/(\p{L}+)\s+(?:et|and|y|e|und)\s+(\p{L}+)/gu, '$1/$2');
  if (t.length > max) t = compacter(t);
  if (t.length > max) {
    const bas = t.toLowerCase();
    const m = MARQUES.find((b) => bas.startsWith(b + ' '));
    if (m) { const reste = t.slice(m.length).trim(); if (reste.split(/\s+/).length >= 2) t = reste; }
  }
  return t.length > max ? couperMot(t, max) : t;
}

// ── LES DATES EN CLAIR (heure de Paris) ─────────────────────────────────────
// Entrées : un instant (ms, ISO avec heure), « AAAA-MM-JJ » (un jour, sans heure),
// « JJ/MM/AAAA [à] HH:MM » ou « JJ/MM » (lus dans les e-mails, heure de Paris).
// Rend `{ texte, relatif }` ou null (illisible ⇒ rien d'inventé) :
//   aujourd'hui 18 h · demain 10 h · lun. 23 nov. 10 h · lun. 23 nov.
// `relatif: false` (rangée pour plus tard : heures calmes, cloche) ⇒ jamais
// « aujourd'hui » / « demain », qui seraient faux au moment où on la lit.
const FUSEAU = 'Europe/Paris';
function partsParis(t, langue = 'fr') {
  try {
    const p = new Intl.DateTimeFormat(LOCALES[langue] || 'fr-FR', { timeZone: FUSEAU, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(new Date(t));
    const v = (k) => Number((p.find((x) => x.type === k) || {}).value);
    return { y: v('year'), m: v('month'), d: v('day'), h: v('hour'), mi: v('minute') };
  } catch (_) { return null; }
}
// L'instant UTC d'une heure de Paris (JJ/MM/AAAA HH:MM).
function instantParis(y, m, d, h = 12, mi = 0) {
  let t = Date.UTC(y, m - 1, d, h, mi);
  for (let i = 0; i < 2; i++) { const p = partsParis(t); if (!p) return NaN; t += ((h - p.h) * 60 + (mi - p.mi)) * 60e3 + (Date.UTC(y, m - 1, d) - Date.UTC(p.y, p.m - 1, p.d)); }
  return t;
}
export function lireQuand(v, maintenant = Date.now()) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? { t: v, heure: true } : null;
  const s = espaces(v);
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) { const t = instantParis(+m[1], +m[2], +m[3], 12, 0); return Number.isFinite(t) ? { t, heure: false } : null; }
  m = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?:\s*(?:à|a|-|,)?\s*(\d{1,2})\s*(?:h|:)\s*(\d{2})?)?$/i.exec(s);
  if (m) {
    const d = +m[1], mo = +m[2];
    if (!(d >= 1 && d <= 31 && mo >= 1 && mo <= 12)) return null;
    let y = m[3] ? +m[3] : NaN;
    if (m[3] && m[3].length === 2) y += 2000;
    if (!m[3]) { const p = partsParis(maintenant); if (!p) return null; y = p.y; const essai = instantParis(y, mo, d); if (essai < maintenant - 60 * 864e5) y += 1; }
    const heure = m[4] != null;
    const t = instantParis(y, mo, d, heure ? +m[4] : 12, heure && m[5] ? +m[5] : 0);
    const verif = partsParis(t);
    if (!verif || verif.d !== d || verif.m !== mo) return null;
    return Number.isFinite(t) ? { t, heure } : null;
  }
  const t = Date.parse(s);
  if (!Number.isFinite(t)) return null;
  return { t, heure: /[T ]\d{1,2}:\d{2}/.test(s) };
}
const MOTS_JOUR = {
  fr: { auj: 'aujourd’hui', dem: 'demain' }, en: { auj: 'today', dem: 'tomorrow' }, es: { auj: 'hoy', dem: 'mañana' },
  it: { auj: 'oggi', dem: 'domani' }, de: { auj: 'heute', dem: 'morgen' },
};
const heureTexte = (h, mi, langue) => (langue === 'fr' ? `${h} h${mi ? ' ' + String(mi).padStart(2, '0') : ''}` : langue === 'de' ? `${h}${mi ? ':' + String(mi).padStart(2, '0') : ''} Uhr` : `${h}:${String(mi).padStart(2, '0')}`);
function jourTexte(t, langue) {
  try {
    const f = (o) => new Intl.DateTimeFormat(LOCALES[langue] || 'fr-FR', { timeZone: FUSEAU, ...o }).format(new Date(t));
    const wd = f({ weekday: 'short' }), d = f({ day: 'numeric' }).replace(/\.$/, ''), mo = f({ month: 'short' });
    return langue === 'de' ? `${wd} ${d}. ${mo}` : `${wd} ${d} ${mo}`;
  } catch (_) { return ''; }
}
export function dateClaire(v, { maintenant = Date.now(), langue = 'fr', relatif = true } = {}) {
  const l = langueNotif(langue);
  const q = lireQuand(v, maintenant);
  if (!q) return null;
  const p = partsParis(q.t), n = partsParis(maintenant);
  if (!p || !n) return null;
  const ecart = Math.round((Date.UTC(p.y, p.m - 1, p.d) - Date.UTC(n.y, n.m - 1, n.d)) / 864e5);
  const h = q.heure ? heureTexte(p.h, p.mi, l) : '';
  if (relatif && (ecart === 0 || ecart === 1)) return { texte: [ecart === 0 ? MOTS_JOUR[l].auj : MOTS_JOUR[l].dem, h].filter(Boolean).join(' '), relatif: true };
  const j = jourTexte(q.t, l);
  if (!j) return null;
  return { texte: [j, h].filter(Boolean).join(l === 'en' || l === 'es' || l === 'it' ? ', ' : ' '), relatif: false };
}
// « avant demain 10 h » / « avant le lun. 23 nov. » — la préposition de chaque langue.
const AVANT = {
  fr: (d) => (d.relatif ? `avant ${d.texte}` : `avant le ${d.texte}`),
  en: (d) => `by ${d.texte}`,
  es: (d) => (d.relatif ? `antes de ${d.texte}` : `antes del ${d.texte}`),
  it: (d) => `entro ${d.texte}`,
  de: (d) => `bis ${d.texte}`,
};
export const avantClair = (v, ctx = {}) => { const d = dateClaire(v, ctx); return d ? AVANT[langueNotif(ctx.langue)](d) : ''; };

// ── LES PLATEFORMES (le nom court : un titre a 40 caractères) ───────────────
export const PLATEFORME_COURTE = { vinted: 'Vinted', leboncoin: 'Leboncoin', vestiaire: 'Vestiaire', ebay: 'eBay' };

// ── LES TEXTES, langue par langue ───────────────────────────────────────────
// Chaque sorte rend { title, body, ligne } : `ligne` est ce que dit un regroupement
// (« 8 offres à trancher · la plus récente : 9060 vert/blanc T38 » ; une offre Vinted n'expire pas).
const joindre = (...xs) => xs.filter((x) => x && str(x).trim()).join(' · ');
const TXT = {
  fr: {
    compteNomme: (nom) => `${nom} est relié à VRM`,
    compteSansNom: (p) => `Ton compte ${p} est relié`,
    comptesN: (n) => `${n} comptes reliés à VRM`,
    compteCorps: 'Première lecture en cours : touche pour la suivre.',
    comptesCorps: (noms) => `${noms} · première lecture en cours.`,
    vendu: (e) => (e ? `Vendu ${e}` : 'Vendu'),
    venduCorps: 'Prépare le colis : le bordereau suit par e-mail.',
    venduVerif: 'Avec Vérification : envoi au centre de vérification de Vinted.',
    venduAilleurs: 'Prépare le colis : l’étiquette est sur le site.',
    prixCorps: (num) => `${num} · touche pour saisir ton prix d’achat.`,
    prixN: (n) => `${n} ventes sans prix d’achat`,
    prixNCorps: (nums) => `${nums} : touche pour saisir les prix d’achat.`,
    retourTitre: (a) => (a ? `À renvoyer : ${a}` : 'Un achat à renvoyer'),
    retourCorps: (av) => (av ? `Bordereau de retour reçu · à déposer ${av}` : 'Bordereau de retour reçu · touche pour l’imprimer'),
    retourDepose: "Retour déposé",
    retourDeposeCorps: (c) => (c ? `Pris en charge par ${c} · touche pour le suivre.` : "Pris en charge · touche pour le suivre."),
    retourLivre: "Retour livré au vendeur",
    retourLivreCorps: "Le remboursement suit sous 2 jours, sauf problème signalé.",
    rembourse: (e) => (e ? `Remboursé · ${e}` : "Remboursé"),
    rembourseCorps: "Le remboursement d’un de tes achats est arrivé.",
    // (15 nov., lot retour-parfait) Le rappel de la date limite d'un retour : la veille au soir, le matin du jour.
    retourVeille: (av) => (av ? `Retour à déposer ${av}` : 'Retour à déposer demain'),
    retourVeilleCorps: 'Imprime le bordereau, emballe, dépose le colis.',
    retourJour: 'Dernier jour pour ton retour',
    retourJourCorps: (h) => (h ? `À déposer avant ${h}` : 'À déposer aujourd’hui'),
    offre: (e) => (e ? `Offre de ${e}` : 'Nouvelle offre'),
    offreCorps: 'Accepte, refuse ou contre-propose',
    expire24: 'expire dans 24 h',
    conseilAmbigu: 'plusieurs fiches à ce titre : vérifie laquelle',
    conseilPrix: (e) => `même titre acheté ${e} (à vérifier)`,
    argent: (e) => (e ? `${e} reçus` : 'Argent reçu'),
    argentCorps: 'sur ton porte-monnaie Vinted',
    venduVc: 'Vendu sur Vestiaire',
    venduVcCorps: (e, av) => joindre(e ? `tu reçois ${e}` : '', av ? `à envoyer ${av}` : 'à envoyer'),
    bord: (pret) => (pret ? 'Bordereau prêt à imprimer' : 'Bordereau reçu'),
    bordCorps: (av, pret) => joindre(pret ? 'déjà tamponné' : '', av ? `à déposer ${av}` : 'à déposer'),
    message: 'Nouveau message',
    messageCorps: 'Réponds dans Messages',
    annulation: 'Annulation demandée',
    annulationCorps: (r) => `L’acheteur veut annuler${r ? ` (« ${r} »)` : ''} · accepte ou refuse sur Vinted`,
    laPlusRecente: 'la plus récente',
    // (15 nov., lot fiabilite-auto) Le contrôle de nuit : un écart réel, avec son geste.
    ctlTitre: (n) => (n > 1 ? `Tout va bien ? · ${n} points à voir` : 'Tout va bien ? · 1 point à voir'),
    ctlVoir: 'Touche pour voir.',
    ctl: { 'numeros-double': (n) => `${n} N° ${n > 1 ? 'portés' : 'porté'} par deux articles`, 'vente-sans-numero': (n) => `${n} vente${n > 1 ? 's' : ''} récente${n > 1 ? 's' : ''} sans N°`,
      'pool-retreci': (n) => `${n} N° ${n > 1 ? 'manquent' : 'manque'} dans ta liste`, 'enligne-24h': (n) => `${n} compte${n > 1 ? 's' : ''} pas relu${n > 1 ? 's' : ''} depuis 24 h` },
    groupe: { bordereau: (k) => `${k} bordereaux prêts à imprimer`, vente: (k) => `${k} ventes`, argent: (k) => `${k} versements reçus`, arrivee: (k) => `${k} colis t'attendent`, offre: (k) => `${k} offres à trancher`, rappel: (k) => `${k} rappels`, message: (k) => `${k} nouveaux messages` },
    resume: { bordereau: (k) => `${k} colis à poster`, arrivee: (k) => `${k} colis à retirer`, vente: (k) => `${k} vente${k > 1 ? 's' : ''}`, argent: (k) => `${k} versement${k > 1 ? 's' : ''}`, offre: (k) => `${k} offre${k > 1 ? 's' : ''}`, message: (k) => `${k} message${k > 1 ? 's' : ''}`, autre: (k) => `${k} autre${k > 1 ? 's' : ''}`, notifs: (k) => `${k} notifications` },
  },
  en: {
    compteNomme: (nom) => `${nom} is linked to VRM`,
    compteSansNom: (p) => `Your ${p} account is linked`,
    comptesN: (n) => `${n} accounts linked to VRM`,
    compteCorps: 'First sync in progress: tap to follow it.',
    comptesCorps: (noms) => `${noms} · first sync in progress.`,
    vendu: (e) => (e ? `Sold ${e}` : 'Sold'),
    venduCorps: 'Pack it: the shipping label follows by email.',
    venduVerif: 'With item verification: ship to the Vinted centre.',
    venduAilleurs: 'Pack it: the label is on the site.',
    prixCorps: (num) => `${num} · tap to enter what you paid.`,
    prixN: (n) => `${n} sales without a purchase price`,
    prixNCorps: (nums) => `${nums}: tap to enter what you paid.`,
    retourTitre: (a) => (a ? `To send back: ${a}` : 'A purchase to send back'),
    retourCorps: (av) => (av ? `Return label received · drop off ${av}` : 'Return label received · tap to print it'),
    retourDepose: "Return dropped off",
    retourDeposeCorps: (c) => (c ? `Picked up by ${c} · tap to track it.` : "Picked up · tap to track it."),
    retourLivre: "Return delivered to the seller",
    retourLivreCorps: "The refund follows within 2 days unless a problem is reported.",
    rembourse: (e) => (e ? `Refunded · ${e}` : "Refunded"),
    rembourseCorps: "A refund for one of your purchases has arrived.",
    retourVeille: (av) => (av ? `Return to drop off ${av}` : 'Return to drop off tomorrow'),
    retourVeilleCorps: 'Print the label, pack it, drop the parcel off.',
    retourJour: 'Last day for your return',
    retourJourCorps: (h) => (h ? `Drop it off before ${h}` : 'Drop it off today'),
    offre: (e) => (e ? `Offer of ${e}` : 'New offer'),
    offreCorps: 'Accept, decline or counter',
    expire24: 'expires in 24 h',
    conseilAmbigu: 'several items with this title: check which one',
    conseilPrix: (e) => `same title bought for ${e} (check it)`,
    argent: (e) => (e ? `${e} received` : 'Money received'),
    argentCorps: 'in your Vinted wallet',
    venduVc: 'Sold on Vestiaire',
    venduVcCorps: (e, av) => joindre(e ? `you get ${e}` : '', av ? `ship ${av}` : 'to ship'),
    bord: (pret) => (pret ? 'Label ready to print' : 'Shipping label received'),
    bordCorps: (av, pret) => joindre(pret ? 'already stamped' : '', av ? `drop off ${av}` : 'to drop off'),
    message: 'New message',
    messageCorps: 'Reply in Messages',
    annulation: 'Cancellation requested',
    annulationCorps: (r) => `The buyer wants to cancel${r ? ` (“${r}”)` : ''} · accept or decline on Vinted`,
    laPlusRecente: 'latest',
    ctlTitre: (n) => (n > 1 ? `All good? · ${n} things to check` : 'All good? · 1 thing to check'),
    ctlVoir: 'Tap to see.',
    ctl: { 'numeros-double': (n) => `${n} N° used by two items`, 'vente-sans-numero': (n) => `${n} recent sale${n > 1 ? 's' : ''} without a N°`,
      'pool-retreci': (n) => `${n} N° missing from your list`, 'enligne-24h': (n) => `${n} account${n > 1 ? 's' : ''} not read for 24 h` },
    groupe: { bordereau: (k) => `${k} labels ready to print`, vente: (k) => `${k} sales`, argent: (k) => `${k} payments received`, arrivee: (k) => `${k} parcels waiting for you`, offre: (k) => `${k} offers to answer`, rappel: (k) => `${k} reminders`, message: (k) => `${k} new messages` },
    resume: { bordereau: (k) => `${k} to ship`, arrivee: (k) => `${k} to pick up`, vente: (k) => `${k} sale${k > 1 ? 's' : ''}`, argent: (k) => `${k} payment${k > 1 ? 's' : ''}`, offre: (k) => `${k} offer${k > 1 ? 's' : ''}`, message: (k) => `${k} message${k > 1 ? 's' : ''}`, autre: (k) => `${k} other${k > 1 ? 's' : ''}`, notifs: (k) => `${k} notifications` },
  },
  es: {
    compteNomme: (nom) => `${nom} está vinculado a VRM`,
    compteSansNom: (p) => `Tu cuenta ${p} está vinculada`,
    comptesN: (n) => `${n} cuentas vinculadas a VRM`,
    compteCorps: 'Primera lectura en curso: toca para seguirla.',
    comptesCorps: (noms) => `${noms} · primera lectura en curso.`,
    vendu: (e) => (e ? `Vendido ${e}` : 'Vendido'),
    venduCorps: 'Prepara el paquete: la etiqueta llega por e-mail.',
    venduVerif: 'Con verificación: envío al centro de Vinted.',
    venduAilleurs: 'Prepara el paquete: la etiqueta está en el sitio.',
    prixCorps: (num) => `${num} · toca para poner tu precio de compra.`,
    prixN: (n) => `${n} ventas sin precio de compra`,
    prixNCorps: (nums) => `${nums}: toca para poner los precios de compra.`,
    retourTitre: (a) => (a ? `Por devolver: ${a}` : 'Una compra por devolver'),
    retourCorps: (av) => (av ? `Etiqueta de devolución recibida · entregar ${av}` : 'Etiqueta de devolución recibida · toca para imprimirla'),
    retourDepose: "Devolución entregada",
    retourDeposeCorps: (c) => (c ? `Recogido por ${c} · toca para seguirlo.` : "Recogido · toca para seguirlo."),
    retourLivre: "Devolución entregada al vendedor",
    retourLivreCorps: "El reembolso llega en 2 días salvo problema señalado.",
    rembourse: (e) => (e ? `Reembolsado · ${e}` : "Reembolsado"),
    rembourseCorps: "Ha llegado el reembolso de una de tus compras.",
    retourVeille: (av) => (av ? `Devolución ${av}` : 'Devolución mañana'),
    retourVeilleCorps: 'Imprime la etiqueta, embala y entrega el paquete.',
    retourJour: 'Último día para tu devolución',
    retourJourCorps: (h) => (h ? `Entrégala antes de las ${h}` : 'Entrégala hoy'),
    offre: (e) => (e ? `Oferta de ${e}` : 'Nueva oferta'),
    offreCorps: 'Acepta, rechaza o contraoferta',
    expire24: 'caduca en 24 h',
    conseilAmbigu: 'varias fichas con este título: comprueba cuál',
    conseilPrix: (e) => `mismo título comprado por ${e} (compruébalo)`,
    argent: (e) => (e ? `${e} recibidos` : 'Dinero recibido'),
    argentCorps: 'en tu monedero de Vinted',
    venduVc: 'Vendido en Vestiaire',
    venduVcCorps: (e, av) => joindre(e ? `recibes ${e}` : '', av ? `enviar ${av}` : 'por enviar'),
    bord: (pret) => (pret ? 'Etiqueta lista para imprimir' : 'Etiqueta recibida'),
    bordCorps: (av, pret) => joindre(pret ? 'ya sellada' : '', av ? `entregar ${av}` : 'por entregar'),
    message: 'Nuevo mensaje',
    messageCorps: 'Responde en Mensajes',
    annulation: 'Cancelación solicitada',
    annulationCorps: (r) => `El comprador quiere cancelar${r ? ` («${r}»)` : ''} · acepta o rechaza en Vinted`,
    laPlusRecente: 'la más reciente',
    ctlTitre: (n) => (n > 1 ? `¿Todo bien? · ${n} puntos que ver` : '¿Todo bien? · 1 punto que ver'),
    ctlVoir: 'Toca para ver.',
    ctl: { 'numeros-double': (n) => `${n} N° en dos artículos`, 'vente-sans-numero': (n) => `${n} venta${n > 1 ? 's' : ''} reciente${n > 1 ? 's' : ''} sin N°`,
      'pool-retreci': (n) => `Faltan ${n} N° en tu lista`, 'enligne-24h': (n) => `${n} cuenta${n > 1 ? 's' : ''} sin leer desde hace 24 h` },
    groupe: { bordereau: (k) => `${k} etiquetas listas`, vente: (k) => `${k} ventas`, argent: (k) => `${k} pagos recibidos`, arrivee: (k) => `${k} paquetes te esperan`, offre: (k) => `${k} ofertas por responder`, rappel: (k) => `${k} recordatorios`, message: (k) => `${k} mensajes nuevos` },
    resume: { bordereau: (k) => `${k} por enviar`, arrivee: (k) => `${k} por recoger`, vente: (k) => `${k} venta${k > 1 ? 's' : ''}`, argent: (k) => `${k} pago${k > 1 ? 's' : ''}`, offre: (k) => `${k} oferta${k > 1 ? 's' : ''}`, message: (k) => `${k} mensaje${k > 1 ? 's' : ''}`, autre: (k) => `${k} más`, notifs: (k) => `${k} notificaciones` },
  },
  it: {
    compteNomme: (nom) => `${nom} è collegato a VRM`,
    compteSansNom: (p) => `Il tuo account ${p} è collegato`,
    comptesN: (n) => `${n} account collegati a VRM`,
    compteCorps: 'Prima lettura in corso: tocca per seguirla.',
    comptesCorps: (noms) => `${noms} · prima lettura in corso.`,
    vendu: (e) => (e ? `Venduto ${e}` : 'Venduto'),
    venduCorps: 'Prepara il pacco: l’etichetta arriva per e-mail.',
    venduVerif: 'Con verifica: spedizione al centro Vinted.',
    venduAilleurs: 'Prepara il pacco: l’etichetta è sul sito.',
    prixCorps: (num) => `${num} · tocca per inserire il prezzo d’acquisto.`,
    prixN: (n) => `${n} vendite senza prezzo d’acquisto`,
    prixNCorps: (nums) => `${nums}: tocca per inserire i prezzi d’acquisto.`,
    retourTitre: (a) => (a ? `Da rimandare: ${a}` : 'Un acquisto da rimandare'),
    retourCorps: (av) => (av ? `Etichetta di reso ricevuta · da consegnare ${av}` : 'Etichetta di reso ricevuta · tocca per stamparla'),
    retourDepose: "Reso consegnato",
    retourDeposeCorps: (c) => (c ? `Preso in carico da ${c} · tocca per seguirlo.` : "Preso in carico · tocca per seguirlo."),
    retourLivre: "Reso consegnato al venditore",
    retourLivreCorps: "Il rimborso arriva entro 2 giorni salvo problemi segnalati.",
    rembourse: (e) => (e ? `Rimborsato · ${e}` : "Rimborsato"),
    rembourseCorps: "È arrivato il rimborso di un tuo acquisto.",
    retourVeille: (av) => (av ? `Reso da consegnare ${av}` : 'Reso da consegnare domani'),
    retourVeilleCorps: 'Stampa l’etichetta, imballa e consegna il pacco.',
    retourJour: 'Ultimo giorno per il tuo reso',
    retourJourCorps: (h) => (h ? `Consegnalo entro le ${h}` : 'Consegnalo oggi'),
    offre: (e) => (e ? `Offerta di ${e}` : 'Nuova offerta'),
    offreCorps: 'Accetta, rifiuta o fai una controfferta',
    expire24: 'scade tra 24 h',
    conseilAmbigu: 'più schede con questo titolo: verifica quale',
    conseilPrix: (e) => `stesso titolo comprato a ${e} (da verificare)`,
    argent: (e) => (e ? `${e} ricevuti` : 'Denaro ricevuto'),
    argentCorps: 'nel tuo portafoglio Vinted',
    venduVc: 'Venduto su Vestiaire',
    venduVcCorps: (e, av) => joindre(e ? `ricevi ${e}` : '', av ? `da spedire ${av}` : 'da spedire'),
    bord: (pret) => (pret ? 'Etichetta pronta da stampare' : 'Etichetta ricevuta'),
    bordCorps: (av, pret) => joindre(pret ? 'già timbrata' : '', av ? `da consegnare ${av}` : 'da consegnare'),
    message: 'Nuovo messaggio',
    messageCorps: 'Rispondi in Messaggi',
    annulation: 'Annullamento richiesto',
    annulationCorps: (r) => `L’acquirente vuole annullare${r ? ` («${r}»)` : ''} · accetta o rifiuta su Vinted`,
    laPlusRecente: 'la più recente',
    ctlTitre: (n) => (n > 1 ? `Tutto bene? · ${n} punti da vedere` : 'Tutto bene? · 1 punto da vedere'),
    ctlVoir: 'Tocca per vedere.',
    ctl: { 'numeros-double': (n) => `${n} N° su due articoli`, 'vente-sans-numero': (n) => `${n} vendit${n > 1 ? 'e' : 'a'} recent${n > 1 ? 'i' : 'e'} senza N°`,
      'pool-retreci': (n) => `${n} N° mancanti nella tua lista`, 'enligne-24h': (n) => `${n} account non lett${n > 1 ? 'i' : 'o'} da 24 h` },
    groupe: { bordereau: (k) => `${k} etichette da stampare`, vente: (k) => `${k} vendite`, argent: (k) => `${k} pagamenti ricevuti`, arrivee: (k) => `${k} pacchi ti aspettano`, offre: (k) => `${k} offerte da valutare`, rappel: (k) => `${k} promemoria`, message: (k) => `${k} nuovi messaggi` },
    resume: { bordereau: (k) => `${k} da spedire`, arrivee: (k) => `${k} da ritirare`, vente: (k) => `${k} vendit${k > 1 ? 'e' : 'a'}`, argent: (k) => `${k} pagament${k > 1 ? 'i' : 'o'}`, offre: (k) => `${k} offert${k > 1 ? 'e' : 'a'}`, message: (k) => `${k} messagg${k > 1 ? 'i' : 'io'}`, autre: (k) => `${k} altr${k > 1 ? 'i' : 'o'}`, notifs: (k) => `${k} notifiche` },
  },
  de: {
    compteNomme: (nom) => `${nom} ist mit VRM verbunden`,
    compteSansNom: (p) => `Dein ${p}-Konto ist verbunden`,
    comptesN: (n) => `${n} Konten mit VRM verbunden`,
    compteCorps: 'Erstes Einlesen läuft: tippe, um es zu verfolgen.',
    comptesCorps: (noms) => `${noms} · erstes Einlesen läuft.`,
    vendu: (e) => (e ? `Verkauft ${e}` : 'Verkauft'),
    venduCorps: 'Pack das Paket: das Etikett kommt per E-Mail.',
    venduVerif: 'Mit Echtheitsprüfung: Versand an das Vinted-Zentrum.',
    venduAilleurs: 'Pack das Paket: das Etikett ist auf der Website.',
    prixCorps: (num) => `${num} · tippe, um deinen Einkaufspreis einzugeben.`,
    prixN: (n) => `${n} Verkäufe ohne Einkaufspreis`,
    prixNCorps: (nums) => `${nums}: tippe, um die Einkaufspreise einzugeben.`,
    retourTitre: (a) => (a ? `Zurücksenden: ${a}` : 'Ein Kauf zum Zurücksenden'),
    retourCorps: (av) => (av ? `Retourenetikett erhalten · abgeben ${av}` : 'Retourenetikett erhalten · tippe zum Drucken'),
    retourDepose: "Rücksendung abgegeben",
    retourDeposeCorps: (c) => (c ? `Von ${c} übernommen · tippe zum Verfolgen.` : "Übernommen · tippe zum Verfolgen."),
    retourLivre: "Rücksendung beim Verkäufer",
    retourLivreCorps: "Die Erstattung folgt in 2 Tagen, außer bei einem Problem.",
    rembourse: (e) => (e ? `Erstattet · ${e}` : "Erstattet"),
    rembourseCorps: "Die Erstattung eines deiner Käufe ist da.",
    retourVeille: (av) => (av ? `Rücksendung abgeben ${av}` : 'Rücksendung morgen abgeben'),
    retourVeilleCorps: 'Etikett drucken, einpacken, Paket abgeben.',
    retourJour: 'Letzter Tag für deine Rücksendung',
    retourJourCorps: (h) => (h ? `Abgeben bis ${h}` : 'Heute abgeben'),
    offre: (e) => (e ? `Angebot über ${e}` : 'Neues Angebot'),
    offreCorps: 'Annehmen, ablehnen oder Gegenangebot',
    expire24: 'läuft in 24 h ab',
    conseilAmbigu: 'mehrere Einträge mit diesem Titel: prüfe welcher',
    conseilPrix: (e) => `gleicher Titel für ${e} gekauft (prüfen)`,
    argent: (e) => (e ? `${e} erhalten` : 'Geld erhalten'),
    argentCorps: 'in deinem Vinted-Guthaben',
    venduVc: 'Verkauft auf Vestiaire',
    venduVcCorps: (e, av) => joindre(e ? `du erhältst ${e}` : '', av ? `versenden ${av}` : 'zu versenden'),
    bord: (pret) => (pret ? 'Etikett druckbereit' : 'Versandetikett erhalten'),
    bordCorps: (av, pret) => joindre(pret ? 'schon gestempelt' : '', av ? `abgeben ${av}` : 'abzugeben'),
    message: 'Neue Nachricht',
    messageCorps: 'Antworte in Nachrichten',
    annulation: 'Stornierung angefragt',
    annulationCorps: (r) => `Der Käufer möchte stornieren${r ? ` („${r}“)` : ''} · annehmen oder ablehnen auf Vinted`,
    laPlusRecente: 'das neueste',
    ctlTitre: (n) => (n > 1 ? `Alles gut? · ${n} Punkte prüfen` : 'Alles gut? · 1 Punkt prüfen'),
    ctlVoir: 'Tippe zum Ansehen.',
    ctl: { 'numeros-double': (n) => `${n} N° auf zwei Artikeln`, 'vente-sans-numero': (n) => `${n} neue${n > 1 ? '' : 'r'} Verkauf${n > 1 ? 'e' : ''} ohne N°`,
      'pool-retreci': (n) => `${n} N° fehlen in deiner Liste`, 'enligne-24h': (n) => `${n} Konto${n > 1 ? 'en' : ''} seit 24 h nicht gelesen` },
    groupe: { bordereau: (k) => `${k} Etiketten druckbereit`, vente: (k) => `${k} Verkäufe`, argent: (k) => `${k} Zahlungen erhalten`, arrivee: (k) => `${k} Pakete warten auf dich`, offre: (k) => `${k} offene Angebote`, rappel: (k) => `${k} Erinnerungen`, message: (k) => `${k} neue Nachrichten` },
    resume: { bordereau: (k) => `${k} zu versenden`, arrivee: (k) => `${k} abzuholen`, vente: (k) => `${k} Verkä${k > 1 ? 'ufe' : 'uf'}`, argent: (k) => `${k} Zahlung${k > 1 ? 'en' : ''}`, offre: (k) => `${k} Angebot${k > 1 ? 'e' : ''}`, message: (k) => `${k} Nachricht${k > 1 ? 'en' : ''}`, autre: (k) => `${k} weitere`, notifs: (k) => `${k} Benachrichtigungen` },
  },
};
export const textesNotif = (langue) => TXT[langueNotif(langue)];

// Un titre « fait · objet » : l'objet n'y entre que s'il tient en 40 caractères ;
// sinon le fait seul (l'objet descend dans le corps). `brut` (le titre de l'annonce) :
// le nom court prend toute la place qui reste (« Vendu 62 € · Nike Air Max 1 blanche
// T42 » garde la marque, « Offre de 55 € · 9060 vert/blanc T38 » la retire).
function titreAvecObjet(fait, objet, brut = '') {
  const place = TITRE_MAX - fait.length - 3;
  const o = brut ? nomCourt(brut, place >= 12 ? place : NOM_COURT_MAX) || objet : objet;
  const t = o ? `${fait} · ${o}` : fait;
  return t.length <= TITRE_MAX ? { title: t, reste: '' } : { title: couperMot(fait, TITRE_MAX), reste: objet };
}
const num = (n) => { const s = str(n).trim(); return /^[A-Za-z]?\d{1,6}$/.test(s) ? `N°${s.toUpperCase()}` : ''; };

// ── LES SORTES ──────────────────────────────────────────────────────────────
const SORTES = {
  // (15 nov., lot argent-plus) Le bilan de fin de mois et un seuil de l'année (api/_lib/argent-notif.js) :
  // les données viennent des règles (src/bilanFinMois.js, src/alertesSeuils.js), les mots d'ici.
  bilanMois: (d, T, ctx) => redigerBilanMois(d, { langue: ctx.langue, max: CORPS_MAX }),
  seuil: (d, T, ctx) => redigerSeuil(d, { langue: ctx.langue }),
  // Un compte relié pour la première fois. `comptes` : [{ plateforme, nom }] — le
  // nom est SON pseudo (le compte du vendeur, jamais un acheteur) ; sans nom, la
  // plateforme (« Ton compte Vestiaire est relié »), jamais l'identifiant.
  compteRelie: (d, T) => {
    const l = (Array.isArray(d.comptes) ? d.comptes : []).filter(Boolean);
    if (!l.length) return null;
    const nomDe = (c) => { const n = sansIdentifiant(espaces(c.nom), { strict: true }).slice(0, 24); return n && !/^\d+$/.test(n) ? n : ''; };
    if (l.length === 1) {
      const c = l[0], n = nomDe(c), p = PLATEFORME_COURTE[c.plateforme] || '';
      const t = n ? T.compteNomme(n) : T.compteSansNom(p);
      return { title: t.length <= TITRE_MAX ? t : (n ? couperMot(n, TITRE_MAX) : T.compteSansNom(p)), body: joindre(n ? p : '', T.compteCorps), ligne: n || p };
    }
    const noms = l.slice(0, 3).map((c) => nomDe(c) || PLATEFORME_COURTE[c.plateforme] || '').filter(Boolean);
    const reste = l.length - Math.min(3, l.length);
    return { title: T.comptesN(l.length), body: T.comptesCorps(noms.join(', ') + (reste > 0 ? ` +${reste}` : '')), ligne: noms.join(', ') };
  },
  // Une vente Vinted (e-mail « Ton article s'est vendu »). Le compte : SON pseudo.
  vendu: (d, T, ctx) => {
    const a = nomCourt(d.article), e = montantClair(d.prix, ctx.langue);
    const { title, reste } = titreAvecObjet(T.vendu(e), a, d.article);
    return { title, body: joindre(reste, espaces(d.compte).slice(0, 24), d.verification ? T.venduVerif : d.ailleurs ? T.venduAilleurs : T.venduCorps), ligne: joindre(e, a) };
  },
  // « Vendu 62 € · Nike Air Max 1 / N°215 · touche pour saisir ton prix d'achat. »
  // `ventes` : [{ num, eur, titre }] — le N° vient de la fiche (par identité).
  prixAchat: (d, T, ctx) => {
    const l = (Array.isArray(d.ventes) ? d.ventes : []).filter(Boolean);
    if (!l.length) return null;
    if (l.length === 1) {
      const v = l[0], n = num(v.num), a = nomCourt(v.titre), e = montantClair(v.eur, ctx.langue);
      const { title, reste } = titreAvecObjet(T.vendu(e), a || n, v.titre);
      const nCorps = n && !title.includes(n) ? n : '';
      const geste = T.prixCorps(nCorps).replace(/^\s*·\s*/, '');
      return { title, body: joindre(reste && reste !== n ? reste : '', nCorps ? geste : geste.charAt(0).toUpperCase() + geste.slice(1)), ligne: joindre(e, a || n) };
    }
    const nums = l.slice(0, 3).map((v) => num(v.num)).filter(Boolean).join(', ') + (l.length > 3 ? '…' : '');
    return { title: T.prixN(l.length), body: T.prixNCorps(nums), ligne: nums };
  },
  // Le bordereau de retour d'un ACHAT : « À renvoyer : Autry donna ».
  retourAchat: (d, T, ctx) => {
    const a = nomCourt(d.article, TITRE_MAX - 14);
    return { title: couperMot(T.retourTitre(a), TITRE_MAX), body: T.retourCorps(avantClair(d.limite, ctx)), ligne: a };
  },
  // (15 nov., lot retours-suivi) Le colis d'un RETOUR d'achat, lu chez le transporteur (n° EXACT du
  // bordereau de retour) : « Retour déposé · Nike Air Max », « Retour livré au vendeur », puis le
  // remboursement d'un achat (e-mail « … a été remboursée ») : « Remboursé · 62 € ».
  retourDepose: (d, T) => {
    const a = nomCourt(d.article);
    const { title, reste } = titreAvecObjet(T.retourDepose, a, d.article);
    return { title, body: joindre(reste, T.retourDeposeCorps(espaces(d.transporteur).slice(0, 20))), ligne: a };
  },
  retourLivre: (d, T) => {
    const a = nomCourt(d.article);
    const { title, reste } = titreAvecObjet(T.retourLivre, a, d.article);
    return { title, body: joindre(reste, T.retourLivreCorps), ligne: a };
  },
  // (15 nov., lot retour-parfait) Le rappel d'un retour pas encore déposé : `quand` 'veille' (le soir,
  // « Retour à déposer avant demain 10 h ») ou 'jour' (le matin du dernier jour, « Dernier jour pour ton
  // retour » / « À déposer avant 10 h »). L'heure est celle LUE (Paris) ; sans heure lue, aucune n'est dite.
  retourRappel: (d, T, ctx) => {
    const a = nomCourt(d.article);
    const lm = Date.parse(str(d.limite));
    if (d.quand === 'jour') {
      const p = d.heure !== false && Number.isFinite(lm) ? partsParis(lm) : null;
      return { title: T.retourJour, body: joindre(T.retourJourCorps(p ? heureTexte(p.h, p.mi, ctx.langue) : ''), a), ligne: a };
    }
    const av = avantClair(d.heure === false && d.jour ? d.jour : d.limite, ctx);
    return { title: couperMot(T.retourVeille(av), TITRE_MAX), body: joindre(a, T.retourVeilleCorps), ligne: a };
  },
  rembourse: (d, T, ctx) => {
    const e = montantClair(d.montant, ctx.langue), a = nomCourt(d.article);
    const { title, reste } = titreAvecObjet(T.rembourse(e), a, d.article);
    return { title, body: joindre(reste, T.rembourseCorps), ligne: joindre(e, a) };
  },
  // Une offre reçue. Jamais le pseudo de l'acheteur. `juge` : { etat, prix } (le
  // copilote, reconnu AU TITRE seulement : « à vérifier »).
  offre: (d, T, ctx) => {
    const a = nomCourt(d.article), e = montantClair(d.montant, ctx.langue);
    const { title, reste } = titreAvecObjet(T.offre(e), a, d.article);
    const j = d.juge && typeof d.juge === 'object' ? d.juge : null;
    const conseil = j && j.etat === 'ambigu' ? T.conseilAmbigu : j && j.etat === 'unique' && montantClair(j.prix, ctx.langue) ? T.conseilPrix(montantClair(j.prix, ctx.langue)) : '';
    // (16 nov., lot vente-email-absente) UNE OFFRE VINTED N'EXPIRE PAS (Julien, 11 nov.) : seules
    // les offres Vestiaire expirent. L'échéance « expire dans 24 h » ne se dit que pour
    // `site: 'vestiaire'` — jamais par défaut (l'e-mail « Nouvelle offre » est celui de Vinted).
    const ech = str(d.site).toLowerCase() === 'vestiaire' ? T.expire24 : '';
    const corps = joindre(reste, conseil ? conseil.charAt(0).toUpperCase() + conseil.slice(1) : T.offreCorps, ech);
    // Le regroupement dit l'article (« 9060 vert/blanc T38 ») et, pour Vestiaire seulement,
    // l'échéance ; le montant seulement si l'article n'est pas lu.
    return { title, body: corps, ligne: [a || e, ech].filter(Boolean).join(', ') };
  },
  argent: (d, T, ctx) => {
    const e = montantClair(d.montant, ctx.langue), a = nomCourt(d.article);
    return { title: T.argent(e), body: joindre(a, espaces(d.compte).slice(0, 24), T.argentCorps), ligne: joindre(e, a) };
  },
  venduVestiaire: (d, T, ctx) => {
    const a = nomCourt(d.titre), e = montantClair(d.montant, ctx.langue);
    const { title, reste } = titreAvecObjet(T.venduVc, a, d.titre);
    return { title, body: joindre(reste, T.venduVcCorps(e, avantClair(d.limite, ctx))), ligne: joindre(a, e) };
  },
  bordereau: (d, T, ctx) => {
    const n = num(d.numero), a = nomCourt(d.modele);
    return { title: T.bord(!!d.tamponne), body: joindre(n, a, T.bordCorps(avantClair(d.dateLimite, ctx), !!d.tamponne)), ligne: joindre(n, a) };
  },
  // Un message : l'article, jamais le pseudo de l'acheteur ; le compte = SON pseudo.
  message: (d, T) => {
    const a = nomCourt(d.paire);
    const { title, reste } = titreAvecObjet(T.message, a, d.paire);
    const ex = espaces(d.extrait);
    return { title, body: joindre(reste, espaces(d.compte).slice(0, 24), ex ? `« ${couperMot(ex, 50)} »` : T.messageCorps), ligne: a };
  },
  annulation: (d, T) => {
    const a = nomCourt(d.article);
    const { title, reste } = titreAvecObjet(T.annulation, a, d.article);
    return { title, body: joindre(reste, T.annulationCorps(d.raison ? couperMot(d.raison, 30) : '')), ligne: a };
  },
};
// (15 nov., lot fiabilite-auto) Le contrôle de nuit : `lignes` = [{ cle, n }] — des clés et des
// nombres seulement (jamais un N°, un n° de transaction, un pseudo). Le plus grave d'abord.
SORTES.controleNuit = (d, T) => {
  const l = (Array.isArray(d.lignes) ? d.lignes : []).filter((x) => x && T.ctl[x.cle] && Number.isInteger(x.n) && x.n > 0);
  if (!l.length) return null;
  const phrases = l.slice(0, 2).map((x) => T.ctl[x.cle](x.n));
  return { title: T.ctlTitre(l.length), body: `${phrases.join(' · ')}. ${T.ctlVoir}`, ligne: phrases[0] };
};
export const SORTES_NOTIF = Object.keys(SORTES);

// Le texte d'une sorte, dans une langue. Rend { title, body, ligne } (titre ≤ 40,
// corps ≤ 90, sans identifiant technique) ou null (sorte inconnue / rien à dire).
export function rediger(r, { langue = 'fr', maintenant = Date.now(), relatif = true } = {}) {
  if (!r || typeof r !== 'object' || !SORTES[r.sorte]) return null;
  const l = langueNotif(langue);
  let out = null;
  try { out = SORTES[r.sorte](r, TXT[l], { langue: l, maintenant, relatif }); } catch (_) { out = null; }
  if (!out || !out.title) return null;
  return {
    title: couperMot(sansIdentifiant(out.title, { strict: true }), TITRE_MAX),
    body: couperMot(sansIdentifiant(out.body || '', { strict: true }), CORPS_MAX),
    ligne: couperMot(sansIdentifiant(out.ligne || '', { strict: true }), CORPS_MAX - 20),
  };
}

// La notification REGROUPÉE (plusieurs non lues du même genre) : « 8 offres à
// trancher » / « La plus récente : 9060 vert/blanc T38 » (une offre Vinted n'expire pas).
export const titreGroupe = (genre, k, langue = 'fr') => { const f = TXT[langueNotif(langue)].groupe[genre]; return f ? couperMot(f(k), TITRE_MAX) : ''; };
export function corpsGroupe(derniere, langue = 'fr') {
  const T = TXT[langueNotif(langue)];
  const d = sansIdentifiant(derniere, { strict: true });
  if (!d) return '';
  const tete = T.laPlusRecente.charAt(0).toUpperCase() + T.laPlusRecente.slice(1);
  return couperMot(`${tete} : ${d}`, CORPS_MAX);
}
export const phraseResume = (genre, k, langue = 'fr') => { const f = TXT[langueNotif(langue)].resume[genre]; return f ? f(k) : ''; };
