// ── LA BOÎTE DE RÉCEPTION « E-MAILS » (5 nov., demande de Julien) ───────────
// « Un onglet dédié aux e-mails… une vraie boîte de réception, des filtres (par
// compte, ventes, achats, codes de retrait…) ». Règles PURES (sans React) lues
// par l'écran (src/BoiteEmails.jsx), l'audit et le banc.
//
// ⚠️ §5 IDENTITÉ : le lien « Voir dans VRM » ne part QUE d'une identité lue dans
//    l'email — celle que la phrase du journal reconnaît déjà (`lectureEmail` :
//    n° de suivi, n° de transaction, N° lu dans l'email). Un N° retrouvé par le
//    titre (`nt`) ou un reçu délié par lui n'ouvre rien. Une seule règle (§11).
// ⚠️ « Pas su » ≠ « rien » : pièces jointes non gardées (email classé avant le
//    5 nov.) ⇒ `null` et la phrase le dit ; `[]` seulement si on a lu « aucune ».
import { lectureEmail, expediteurLisible, codeLisible } from './journalEmail.js';

export { expediteurLisible };

// La date d'un email : celle de la boîte d'origine si elle a été transmise
// (`sourceDate`), sinon l'heure où VRM l'a rangé.
export const dateEmail = (e) => (e && (e.sourceDate || e.at)) || null;

// Le corps texte, nettoyé pour la lecture : les balises HTML restées dans le
// texte (`<img …>`, `<b>`, un `<style>` entier…) RETIRÉES — jamais affichées en
// texte, jamais exécutées —, les entités courantes (`&amp;`, `&nbsp;`…) rendues
// en caractères, les liens de pistage interminables réduits à leur domaine, les
// caractères invisibles retirés, les lignes vides resserrées. Le résultat est du
// TEXTE (React l'échappe) : aucun HTML n'est rendu.
// (Construits par chaîne, en échappements : un séparateur de ligne Unicode
// écrit tel quel dans une expression littérale casse la compilation.)
const INVISIBLES = new RegExp('[\\u200b-\\u200f\\u00ad\\u034f\\ufeff\\u2060-\\u2064]', 'g');
const SEPARATEURS = new RegExp('[\\u2028\\u2029]', 'g');
const ESPACES = new RegExp('[ \\t\\u00a0]+', 'g');
const ENTITES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', eacute: 'é', egrave: 'è', agrave: 'à', ccedil: 'ç', ecirc: 'ê', rsquo: '’', lsquo: '‘', laquo: '«', raquo: '»', euro: '€', hellip: '…', ndash: '–', mdash: '—' };
const entite = (m, nom) => {
  if (nom[0] === '#') { const n = nom[1] === 'x' || nom[1] === 'X' ? parseInt(nom.slice(2), 16) : parseInt(nom.slice(1), 10); return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ''; }
  const k = nom.toLowerCase();
  return Object.prototype.hasOwnProperty.call(ENTITES, k) ? ENTITES[k] : m;
};
// Une balise : `<` suivi d'une lettre, de `/` ou de `!` (commentaire, doctype).
// Une balise restée ouverte en fin de texte (texte coupé à 1 500 caractères) part aussi.
const BLOCS_MORTS = /<(style|script|head|title)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi;
const FIN_DE_BLOC = /<(?:br|\/p|\/div|\/li|\/tr|\/h\d)\b[^>]*>/gi;
const BALISE = /<\/?[a-zA-Z][^<>]*>|<!--[\s\S]*?(?:-->|$)|<![^<>]*>/g;
const BALISE_COUPEE = /<\/?[a-zA-Z][^<>]*$/;
const ENTITE = /&(#x?[0-9a-fA-F]{1,6}|[a-zA-Z]{2,8});/g;
export function retirerBalises(texte) {
  let t = String(texte == null ? '' : texte);
  // Deux tours : une entité qui cachait une balise (`&lt;img …&gt;`) devient une
  // balise au premier, et part au second.
  for (let i = 0; i < 2; i++) {
    t = t.replace(BLOCS_MORTS, ' ').replace(FIN_DE_BLOC, '\n').replace(BALISE, ' ').replace(BALISE_COUPEE, ' ').replace(ENTITE, entite);
  }
  return t;
}
export function nettoyerCorps(texte) {
  if (typeof texte !== 'string') return null;
  const t = retirerBalises(texte)
    .replace(INVISIBLES, '')
    .replace(SEPARATEURS, '\n')
    .replace(/https?:\/\/[^\s<>()"']{60,}/g, (u) => { const d = (/^https?:\/\/([^/?#\s]+)/.exec(u) || [])[1]; return d ? `[lien ${d}]` : '[lien]'; })
    .split('\n').map((l) => l.replace(ESPACES, ' ').trim()).join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return t;
}

// Le poids lisible d'une pièce jointe (estimé depuis son contenu reçu).
export function poidsLisible(o) {
  if (!Number.isFinite(o) || o < 0) return '';
  if (o < 1024) return `${o} o`;
  if (o < 1024 * 1024) return `${Math.round(o / 1024)} Ko`;
  return `${(o / 1024 / 1024).toFixed(1).replace('.', ',')} Mo`;
}

const enc = encodeURIComponent;
// L'objet relié dans VRM, PAR IDENTITÉ — ou `null`. Rend `{ k, url, mot }` :
// `url` est un chemin `?tab=…&cible=…` (src/cibleNotif.js), `k === 'num'` ouvre
// « Tout sur le N° ».
export function objetRelie(e, delies = {}) {
  if (!e) return null;
  const l = lectureEmail(e, delies);
  const r = e.resume && typeof e.resume === 'object' ? e.resume : null;
  if (!r || l.etat === 'reessai') return null;
  const c = l.cible;
  if (c && c.k === 'suivi' && r.t === 'suivi' && r.sens !== 'sortant') return { k: 'retrait', url: `?tab=cat_bord&cible=retrait&suivi=${enc(c.v)}`, mot: r.st === 'available' ? 'Voir le colis à retirer' : 'Voir le colis', ident: `colis n° ${c.v}` };
  if (c && c.k === 'tx' && r.t === 'bordereau') return { k: 'colis', url: `?tab=cat_bord&cible=colis&tx=${enc(c.v)}`, mot: 'Voir le colis à envoyer', ident: `vente n° ${c.v}` };
  if (c && c.k === 'tx' && r.t === 'achat' && l.etat !== 'delie') return { k: 'achat', url: `?tab=achats&cible=achat&tx=${enc(c.v)}`, mot: 'Voir l’achat', ident: `achat n° ${c.v}` };
  if (l.num) return { k: 'num', num: l.num, mot: `Voir le N°${l.num}`, ident: `N°${l.num}` };
  return null;
}

// Ce que VRM a fait de l'email, en une phrase (la même que le journal).
export function ceQueVrmAFait(e, delies = {}) {
  const l = lectureEmail(e, delies);
  return { quoi: l.quoi, fait: l.fait, etat: l.etat, raison: l.raison, geste: l.geste };
}

// ── CE QUE C'EST, EN MOTS SIMPLES (5 nov., Julien : « ça doit être bcp plus
// clair ») ──────────────────────────────────────────────────────────────────
// La première chose écrite sur chaque ligne de la boîte, et le grand titre de la
// lecture : CE QUE C'EST et ce qu'il y a à faire — « Colis à retirer · Relais
// Tabac du Port · code 418 205 · avant le 9 nov. », « Vendu · Nike Air Max 90 ·
// bordereau prêt », « Newsletter Vinted — rien à faire ».
// ⚠️ Rien n'est deviné : chaque mot vient du RÉSUMÉ écrit au classement par les
//    règles d'e-mail existantes (api/_lib/resume-email.js), la même source que
//    « Ce que VRM en a fait » (lectureEmail). Un champ non lu n'est pas écrit ;
//    un e-mail classé avant le résumé dit « détail non gardé » (pas su ≠ rien).
// ⚠️ Un N° n'est écrit que LU dans l'e-mail : un N° retrouvé par le titre (`nt`)
//    n'apparaît jamais ici (§5).
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
// « 2026-11-09 » ou « 09/11/2026 » ⇒ « 9 nov. » ; une autre forme reste telle que lue.
export function jourCourt(v) {
  const s = String(v == null ? '' : v).trim();
  if (!s) return '';
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  let j = 0, mo = 0;
  if (m) { j = +m[3]; mo = +m[2]; }
  else if ((m = /^(\d{1,2})[/.](\d{1,2})(?:[/.]\d{2,4})?\b/.exec(s))) { j = +m[1]; mo = +m[2]; }
  return j >= 1 && j <= 31 && mo >= 1 && mo <= 12 ? `${j} ${MOIS[mo - 1]}` : s;
}
const prix = (m) => { const t = String(m == null ? '' : m).trim(); return t ? `${t.replace('.', ',')} €` : ''; };
const maj = (s) => { const t = String(s || '').trim(); return t ? t[0].toLocaleUpperCase('fr') + t.slice(1) : ''; };
// Un code ou une date ne se coupe pas en fin de ligne (« 418 / 205 »).
const insecable = (s) => String(s).replace(/ /g, "\u00a0");
const sansParenthese = (s) => String(s || '').replace(/\s*\([^)]*\)\s*/g, ' ').trim();
const ANCIENS = { suivi: 'Colis', bordereau: 'Vendu · bordereau', achat: 'Achat · reçu de commande', vente: 'Vendu', 'vente-vestiaire': 'Vendu sur Vestiaire', finalisation: 'Argent reçu', offre: 'Offre reçue', message: 'Message', favori: 'Mis en favori', action: 'Demande de Vinted', 'connu-sans-action': 'Information', information: 'Information', ignoré: 'Pas reconnu par VRM' };

// Rend { titre, details: [..], rien } : `titre` en gras, `details` après « · »,
// `rien` ⇒ « — rien à faire ».
export function titreSimple(e, delies = {}) {
  const l = lectureEmail(e || {}, delies);
  const r = e && e.resume && typeof e.resume === 'object' ? e.resume : null;
  const d = (...x) => x.filter((v) => typeof v === 'string' && v.trim());
  if (l.etat === 'reessai') return { titre: 'En cours de rangement', details: [], rien: true };
  if (!r) return { titre: ANCIENS[e && e.type] || 'E-mail', details: ['détail non gardé'], rien: !!e && e.type === 'connu-sans-action' };
  switch (r.t) {
    case 'suivi': {
      if (r.st === 'available') return { titre: 'Colis à retirer', details: d(r.lieu, r.code ? `code ${insecable(codeLisible(r.code))}` : 'code pas encore lu', r.lim ? `avant le ${insecable(jourCourt(r.lim))}` : '') };
      if (r.st === 'delivered') return r.sens === 'sortant' ? { titre: 'Ton acheteur a retiré son colis', details: [], rien: true } : { titre: 'Colis livré', details: [] };
      if (r.st === 'transit') return { titre: 'Colis en route', details: [] };
      if (r.st === 'retour') return { titre: 'Colis renvoyé à l’expéditeur', details: [] };
      return { titre: 'Nouvelles d’un colis', details: [] };
    }
    case 'bordereau': {
      if (r.av === 'analyse') return { titre: 'Bordereau', details: ['vente pas reconnue'] };
      const num = r.n && !r.nt ? `N°${r.n}` : '';
      return { titre: 'Vendu', details: d(r.a, num, r.av === 'sans-pdf' ? 'bordereau à prendre sur Vinted' : 'bordereau prêt') };
    }
    case 'finalisation': return { titre: 'Argent reçu', details: d(prix(r.mt), r.a) };
    case 'achat': return { titre: 'Achat', details: d('reçu de commande', r.a, prix(r.px), l.etat === 'delie' ? 'délié par toi' : '') };
    case 'vente':
      if (r.av === 'analyse') return { titre: 'Vendu', details: ['détail pas lu'] };
      return { titre: 'Vendu', details: d(r.a, prix(r.px), r.n ? `N°${r.n}` : '') };
    case 'vente-vestiaire':
      if (r.av === 'analyse') return { titre: 'Vendu sur Vestiaire', details: ['détail pas lu'] };
      return { titre: 'Vendu sur Vestiaire', details: d(r.a, r.mt ? `tu reçois ${prix(r.mt)}` : '', r.lim ? `à envoyer avant le ${insecable(jourCourt(r.lim))}` : '') };
    case 'offre': return { titre: 'Offre reçue', details: d(prix(r.mt), r.a ? `sur ${r.a}` : '', r.de ? `de ${r.de}` : '') };
    case 'message': return { titre: 'Message', details: d(r.de ? `de ${r.de}` : '', r.a) };
    case 'favori': return { titre: 'Mis en favori', details: d(r.a, r.de ? `par ${r.de}` : '') };
    case 'action': return { titre: maj(sansParenthese(r.f)) || 'Demande de Vinted', details: ['à faire sur Vinted'] };
    case 'connu-sans-action': return { titre: maj(sansParenthese(r.f)) || 'Information', details: [], rien: true };
    case 'incompris': return { titre: 'Pas reconnu par VRM', details: ['à lire'] };
    default: return { titre: 'Information', details: [] };
  }
}
// Le titre en une chaîne (attributs, lecteurs d'écran).
export const titreEnClair = (t) => `${t.titre}${t.details.length ? ' · ' + t.details.join(' · ') : ''}${t.rien ? ' — rien à faire' : ''}`;

// ── LES JOURS ────────────────────────────────────────────────────────────────
// Les e-mails groupés par jour (heure de l'appareil) : « Aujourd’hui », « Hier »,
// puis « Mardi 3 novembre » (l'année si ce n'est pas celle d'aujourd'hui).
// L'ordre reçu est gardé ; un e-mail sans date lisible va dans « Date non lue ».
const cleJour = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
export function motJour(t, maintenant = Date.now()) {
  if (!Number.isFinite(t)) return 'Date non lue';
  const d = new Date(t), auj = new Date(maintenant), hier = new Date(maintenant);
  hier.setDate(hier.getDate() - 1);
  if (cleJour(d) === cleJour(auj)) return 'Aujourd’hui';
  if (cleJour(d) === cleJour(hier)) return 'Hier';
  const o = { weekday: 'long', day: 'numeric', month: 'long' };
  if (d.getFullYear() !== auj.getFullYear()) o.year = 'numeric';
  return maj(d.toLocaleDateString('fr-FR', o)).replace(/ 1 /, ' 1er ');
}
export function groupesParJour(emails, maintenant = Date.now()) {
  const groupes = new Map();
  for (const e of Array.isArray(emails) ? emails : []) {
    const t = Date.parse(dateEmail(e) || '');
    const cle = Number.isFinite(t) ? cleJour(new Date(t)) : 'sans-date';
    if (!groupes.has(cle)) groupes.set(cle, { cle, mot: motJour(t, maintenant), emails: [] });
    groupes.get(cle).emails.push(e);
  }
  const l = [...groupes.values()];
  const sans = l.findIndex((g) => g.cle === 'sans-date');
  if (sans >= 0) l.push(l.splice(sans, 1)[0]);
  return l;
}

// Le site d'un expéditeur, pour son logo (Vinted, Leboncoin, eBay, Vestiaire) ;
// les transporteurs n'ont pas de logo servi : une initiale neutre.
export function siteExpediteur(from) {
  const n = expediteurLisible(from);
  return n === 'Vinted' || n === 'Vinted Go' ? 'vinted' : n === 'Leboncoin' ? 'leboncoin' : n === 'eBay' ? 'ebay' : n === 'Vestiaire Collective' ? 'vestiaire' : '';
}

// ── LA MARQUE DE L'EXPÉDITEUR (5 nov., v33 « tu peux faire mieux ») ──────────
// Les quatre sites servis gardent leur logo (dessiné dans la couleur du texte) ;
// un transporteur ou un inconnu reçoit un MONOGRAMME NEUTRE tiré de son nom
// lisible (« Mondial Relay » ⇒ « MR », « Chronopost » ⇒ « C ») — gris, police
// système, jamais une couleur ni un dessin de marque (aucun faux logo).
export function monogramme(nom) {
  let s = String(nom == null ? '' : nom).trim();
  if (!s || s === 'Expéditeur non lu') return '?';
  if (!/\s/.test(s) && s.includes('.')) s = s.split('.')[0]; // « exemple.test » ⇒ « exemple »
  const mots = s.split(/[\s\-_'’]+/).filter((m) => /[\p{L}\p{N}]/u.test(m));
  const lettre = (m) => (m.match(/[\p{L}\p{N}]/u) || [''])[0].toLocaleUpperCase('fr');
  return mots.slice(0, 2).map(lettre).join('') || '?';
}

// ── LE DÉLAI LU (date limite écrite dans l'e-mail) ───────────────────────────
// Jours entre aujourd'hui (jour de l'appareil) et la date LUE ; `null` si la
// date n'a pas d'année ou ne se lit pas (pas su ⇒ jamais « proche »).
export function joursAvant(lim, maintenant = Date.now()) {
  const s = String(lim == null ? '' : lim).trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s), a, mo, j;
  if (m) { a = +m[1]; mo = +m[2]; j = +m[3]; }
  else if ((m = /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})\b/.exec(s))) { j = +m[1]; mo = +m[2]; a = +m[3]; }
  else return null;
  if (!(mo >= 1 && mo <= 12 && j >= 1 && j <= 31)) return null;
  const auj = new Date(maintenant);
  const d0 = Date.UTC(auj.getFullYear(), auj.getMonth(), auj.getDate());
  return Math.round((Date.UTC(a, mo - 1, j) - d0) / 864e5);
}

// ── UNE LIGNE DE LA BOÎTE : nature · l'essentiel · le geste ──────────────────
// Rend { titre, essentiel: [..], geste: {k, mot, proche, passe} | null, rien }.
// ⚠️ UNE SEULE SOURCE : chaque mot vient de `titreSimple` (le résumé rangé) —
//    `ligneEmail` ne fait que RANGER ses détails : les faits courts d'abord (code,
//    N°, montant), le nom long de l'article en dernier (une coupure « … » ne mange
//    que la fin du nom, jamais le code) ; ce qui demande un GESTE sort dans
//    `geste` (colis à retirer avant une date, bordereau, envoi, à faire sur
//    Vinted, à vérifier). « reçu de commande » se tait sur la ligne (le titre dit
//    « Achat ») ; la lecture garde tout.
// ⚠️ « Proche » (ambre) = délai LU à moins de 48 h (aujourd'hui ou demain), comme
//    les litiges. Une date sans année ne se juge pas ; une date passée n'est plus
//    un geste à faire (« délai passé », sans ambre).
const ECHEANCE = /^(?:à envoyer )?avant le /;
const GESTES_MOTS = { 'bordereau prêt': 'bordereau', 'bordereau à prendre sur Vinted': 'bordereau', 'à faire sur Vinted': 'action', 'à lire': 'verifier' };
const rang = (x) => (/^(?:code |N°)/.test(x) ? 0 : /€$/.test(x) ? 1 : 2);
export function ligneEmail(e, delies = {}, maintenant = Date.now()) {
  const t = titreSimple(e, delies);
  const r = e && e.resume && typeof e.resume === 'object' ? e.resume : null;
  let geste = null;
  const garde = [];
  for (const x of t.details) {
    if (ECHEANCE.test(x) && r && r.lim) {
      const n = joursAvant(r.lim, maintenant);
      const k = r.t === 'vente-vestiaire' ? 'envoi' : 'retrait';
      const date = insecable(jourCourt(r.lim));
      const quand = n === 0 ? ' (aujourd’hui)' : n === 1 ? ' (demain)' : '';
      geste = n != null && n < 0
        ? { k, mot: `délai passé (${date})`, proche: false, passe: true }
        : { k, mot: `${k === 'envoi' ? 'à envoyer ' : ''}avant le ${date}${quand}`, proche: n === 0 || n === 1, passe: false };
      continue;
    }
    if (GESTES_MOTS[x]) { geste = geste || { k: GESTES_MOTS[x], mot: x, proche: false, passe: false }; continue; }
    if (x === 'reçu de commande') continue;
    garde.push(x);
  }
  // Un colis à retirer sans date lue reste un geste (l'e-mail le demande).
  if (!geste && r && r.t === 'suivi' && r.st === 'available' && r.sens !== 'sortant') geste = { k: 'retrait', mot: 'à retirer', proche: false, passe: false };
  // Un e-mail que VRM n'a pas su ranger : « à vérifier » prime (ambre).
  if (e && e.etat && e.etat !== 'integre' && e.etat !== 'reessai') geste = { k: 'verifier', mot: e.etat === 'erreur' ? 'en attente' : 'à vérifier', proche: false, passe: false };
  const essentiel = garde.map((x, i) => [rang(x), i, x]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map((x) => x[2]);
  return { titre: t.titre, essentiel, geste, rien: !!t.rien && !geste };
}
// Un geste qui mérite l'ambre : délai proche (< 48 h), ou à vérifier.
export const gesteAmbre = (g) => !!(g && !g.passe && (g.proche || g.k === 'verifier'));

// ════════════════════════════════════════════════════════════════════════════
// (6 nov., v36 — Julien : « continue à améliorer la boîte mail de l'app, c'est
// pas ouf » ; « je veux vraiment quelque chose de plus visuel, de beaucoup plus
// beau ».) Les règles PURES de la boîte façon Mail : le lieu lisible, les piles
// d'e-mails identiques, la carte « ce qu'il faut savoir », les gestes par
// identité et le message d'origine rendu proprement. Toujours UNE source : le
// résumé rangé au classement (jamais le sujet), le texte gardé (jamais du HTML).
// ════════════════════════════════════════════════════════════════════════════

// ── LE LIEU, LISIBLE ─────────────────────────────────────────────────────────
// « MAISON DE LA PRESSE, 40 RUE DU PORT, 35260 CANCALE » ⇒ { nom: « Maison de la
// Presse », adresse: « 40 Rue du Port, 35260 Cancale » }. Seulement une MISE EN
// FORME du lieu LU (casse, segments) : rien n'est ajouté, rien n'est deviné. Le
// nom = les segments avant le premier qui commence par un numéro ou un mot de voie.
const PETITS = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'et', 'à', 'au', 'aux', 'en', 'sur', 'sous', 'd', 'l']);
const VOIE = /^(?:\d|rue\b|avenue\b|av\.?\s|bd\b|boulevard\b|place\b|chemin\b|all[ée]e\b|route\b|quai\b|impasse\b|cours\b|rond[- ]point\b|zone\b|za\b|zi\b|centre commercial\b|lieu[- ]dit\b)/i;
function casse(s) {
  const t = String(s || '').trim();
  if (!t || /[a-zà-ÿ]/.test(t)) return t;            // déjà en casse mixte : tel quel
  const bas = t.toLocaleLowerCase('fr');
  return bas.replace(/(^|[\s\-'’/(])([\p{L}])([\p{L}]*)/gu, (m, a, l, reste, i) => a + (i > 0 && PETITS.has(l + reste) ? l : l.toLocaleUpperCase('fr')) + reste);
}
export function lieuLisible(lieu) {
  const s = String(lieu == null ? '' : lieu).replace(/\s+/g, ' ').trim();
  if (!s) return null;
  const segs = s.split(',').map((x) => x.trim()).filter(Boolean);
  let i = segs.findIndex((x, k) => k > 0 && VOIE.test(x));
  if (i < 0) i = segs.length;
  const vus = new Set(), noms = [];
  for (const x of segs.slice(0, i)) { const k = x.toLocaleLowerCase('fr'); if (!vus.has(k)) { vus.add(k); noms.push(casse(x)); } }
  return { nom: noms.join(' · ') || casse(segs[0]), adresse: segs.slice(i).map(casse).join(', ') };
}

// ── LA DATE LIMITE, EN JOURS ────────────────────────────────────────────────
// { date: « 10 nov. », jours: n | null, mot: « dans 4 j » / « demain » / …, proche, passe }.
export function limiteLue(lim, maintenant = Date.now()) {
  const s = String(lim == null ? '' : lim).trim();
  if (!s) return null;
  const n = joursAvant(s, maintenant);
  const date = jourCourt(s);
  const mot = n == null ? '' : n < 0 ? 'délai passé' : n === 0 ? 'aujourd’hui' : n === 1 ? 'demain' : `dans ${n} j`;
  return { date, jours: n, mot, proche: n === 0 || n === 1, passe: n != null && n < 0 };
}

// ── CE QU'IL FAUT SAVOIR (la carte en tête d'un e-mail ouvert) ──────────────
// Rend { genre, titre, montant, montantMot, article, num, code, lieu, limite,
// transporteur, de } — chaque champ LU dans le résumé, absent sinon.
// `genre` : retrait · vente · bordereau · offre · achat · argent · colis · info.
export function carteHeros(e, delies = {}, maintenant = Date.now()) {
  const r = e && e.resume && typeof e.resume === 'object' ? e.resume : null;
  const t = titreSimple(e || {}, delies);
  const base = { titre: t.titre, genre: 'info' };
  if (!r || t.titre === 'En cours de rangement') return base;
  const prixLu = (m) => { const x = String(m == null ? '' : m).trim(); return x ? `${x.replace('.', ',')} €` : ''; };
  const num = r.n && !r.nt ? String(r.n) : '';     // §5 : un N° retrouvé par le titre n'est jamais écrit
  const tr = r.tr && r.tr !== 'autre' ? String(r.tr) : '';
  switch (r.t) {
    case 'suivi':
      if (r.st === 'available' && r.sens !== 'sortant') return { ...base, genre: 'retrait', code: typeof r.code === 'string' && r.code.trim() ? codeLisible(r.code) : '', lieu: lieuLisible(r.lieu), limite: limiteLue(r.lim, maintenant), transporteur: tr };
      return { ...base, genre: 'colis', transporteur: tr };
    case 'bordereau': return r.av === 'analyse' ? base : { ...base, genre: 'bordereau', article: r.a || '', num };
    case 'vente': return r.av === 'analyse' ? base : { ...base, genre: 'vente', montant: prixLu(r.px), montantMot: r.px ? 'vendu' : '', article: r.a || '', num };
    case 'vente-vestiaire': return r.av === 'analyse' ? base : { ...base, genre: 'vente', montant: prixLu(r.mt), montantMot: r.mt ? 'tu reçois' : '', article: r.a || '', limite: limiteLue(r.lim, maintenant) };
    case 'offre': return { ...base, genre: 'offre', montant: prixLu(r.mt), montantMot: r.mt ? 'proposé' : '', article: r.a || '' };
    case 'achat': return { ...base, genre: 'achat', montant: prixLu(r.px), montantMot: r.px ? 'payé' : '', article: r.a || '' };
    case 'finalisation': return { ...base, genre: 'argent', montant: prixLu(r.mt), montantMot: r.mt ? 'versé sur ton porte-monnaie' : '', article: r.a || '' };
    case 'favori': case 'message': return { ...base, article: r.a || '' };
    default: return base;
  }
}

// ── LES GESTES, PAR IDENTITÉ (§5) ───────────────────────────────────────────
// Le geste principal reste `objetRelie` (n° de suivi, n° de transaction, N° lu) ;
// s'y ajoutent les autres chemins tenus par la MÊME identité lue dans le résumé :
// la vente (n° de transaction d'un bordereau), la vente Vestiaire (n° d'annonce).
// Une offre n'a pas d'identité de conversation dans le résumé : le seul geste est
// d'ouvrir le filtre « Offres » de Messages, dit comme tel (jamais « Voir l'offre »).
const IDENT = /^[A-Za-z0-9_-]{1,40}$/;
export function gestesEmail(e, delies = {}) {
  const r = e && e.resume && typeof e.resume === 'object' ? e.resume : null;
  const o = objetRelie(e, delies);
  const l = [];
  if (o) l.push({ ...o, principal: true });
  if (r && r.t === 'bordereau' && r.av !== 'analyse' && IDENT.test(String(r.tx || ''))) l.push({ k: 'vente', url: `?tab=cat_ventes&cible=vente&tx=${encodeURIComponent(r.tx)}`, mot: 'Voir la vente', ident: `vente n° ${r.tx}` });
  if (r && r.t === 'vente-vestiaire' && r.av !== 'analyse' && IDENT.test(String(r.p || ''))) l.push({ k: 'vcvente', url: `?tab=cat_ventes&cible=vcvente&vc=${encodeURIComponent(r.p)}`, mot: 'Voir la vente Vestiaire', ident: `annonce Vestiaire n° ${r.p}` });
  if (r && r.t === 'offre') l.push({ k: 'offres', url: '?tab=cat_msg&cible=offres', mot: 'Ouvrir les offres dans Messages', ident: '' });
  if (l.length && !l.some((x) => x.principal)) l[0] = { ...l[0], principal: true };
  return l;
}

// ── LES PILES (comme Mail regroupe un fil) ──────────────────────────────────
// Dans un même jour, une RAFALE d'au moins 3 e-mails consécutifs qui disent la
// même chose (même nature, même essentiel, même geste, même compte) ne fait
// qu'UNE ligne : « Commande mise à jour · 11 e-mails ». Rien n'est caché : la
// pile se déplie au toucher, chaque e-mail garde sa ligne. Un e-mail porteur d'un
// code ne s'empile jamais avec un autre (chaque code diffère : l'essentiel le dit).
export const PILE_MIN = 3;
export function empiler(emails, delies = {}, maintenant = Date.now()) {
  const out = [];
  const signe = (e) => { const l = ligneEmail(e, delies, maintenant); return JSON.stringify([l.titre, l.essentiel, l.geste && l.geste.mot, l.rien, e.compte ? e.compte.id : '', e.compteAmbigu ? 1 : 0]); };
  const l = Array.isArray(emails) ? emails : [];
  let i = 0;
  while (i < l.length) {
    const s = signe(l[i]);
    let j = i + 1;
    while (j < l.length && signe(l[j]) === s) j++;
    if (j - i >= PILE_MIN) out.push({ k: 'pile', cle: 'pile:' + l[i].id, emails: l.slice(i, j) });
    else for (let k = i; k < j; k++) out.push({ k: 'email', cle: l[k].id, e: l[k] });
    i = j;
  }
  return out;
}

// ── LE MESSAGE D'ORIGINE, RENDU PROPREMENT ───────────────────────────────────
// Le texte gardé à la réception (≤ 1 500 caractères, sans HTML) porte les traces
// de sa conversion : lignes coupées à 76 caractères (une ligne qui finit par une
// espace continue sur la suivante — « format=flowed »), « *gras* », « [image:
// Instagram] », points orphelins, mentions légales en pied. Rend des BLOCS que
// l'écran dessine en éléments React — AUCUN HTML injecté, jamais :
//   { k: 'p' | 'li' | 'etiquette' | 'note', n?, parts: [{ t, gras?, lien? }] }
// et `pied` : les mentions de l'expéditeur, à part (repliées à l'écran — rien
// n'est retiré). Une balise restée dans le texte part (`retirerBalises`) ; un lien
// n'est gardé que s'il est en http(s) (jamais `javascript:`).
const PIED = /^(?:Cet e-mail t['’]a été envoyé par|Cet e-mail vous a été envoyé|Vous pouvez consulter toutes les informations relatives|Si tu ne souhaites plus recevoir|Nous sommes tenus de t['’]envoyer|Vous recevez cet e-mail|Pour vous désabonner|MONDIAL RELAY, \d|SASU au capital|TRANSPORTEUR INVENTÉ)/i;
const IMAGE = /\[image:[^\]]*\]/gi;
const TETE = /^E-mail Vinted$/i;
const PUCE = /^(?:[-•–]\s+|(\d{1,2})[.)]\s+)/;
const LIEN = /\bhttps?:\/\/[^\s<>()"'\]]+[^\s<>()"'\].,;:!?»)]/g;
function morceaux(ligne) {
  const parts = [];
  const pousse = (t, o = {}) => {
    if (!t) return;
    LIEN.lastIndex = 0; let m, k = 0;
    while ((m = LIEN.exec(t))) {
      if (m.index > k) parts.push({ t: t.slice(k, m.index), ...o });
      let d = ''; try { const u = new URL(m[0]); d = /^https?:$/.test(u.protocol) ? u.hostname.replace(/^www\./, '') : ''; } catch (_) {}
      parts.push(d ? { t: d, lien: m[0], ...o } : { t: m[0], ...o });
      k = m.index + m[0].length;
    }
    if (k < t.length) parts.push({ t: t.slice(k), ...o });
  };
  const re = /\*{1,2}([^*\n]*[^*\s\n][^*\n]*?)\s*\*{1,2}/g;
  let m, k = 0;
  while ((m = re.exec(ligne))) { if (m.index > k) pousse(ligne.slice(k, m.index)); pousse(m[1].trim(), { gras: true }); k = m.index + m[0].length; }
  if (k < ligne.length) pousse(ligne.slice(k));
  // Un astérisque resté seul (« **.* ») n'est que la trace d'un gras : retiré.
  return parts.map((p) => ({ ...p, t: p.t.replace(/\*+/g, '').replace(/\s+/g, ' ') })).filter((p) => p.t.trim() || p.lien);
}
export function lireCorps(texte) {
  if (typeof texte !== 'string') return null;
  const t = retirerBalises(texte).replace(INVISIBLES, '').replace(SEPARATEURS, '\n').replace(/\r/g, '').replace(IMAGE, ' ').replace(/\*{3,}(?=\d)/g, '•••• ');
  // 1. Les lignes « coulées » : une ligne qui finit par une espace continue sur la suivante.
  const jointes = [];
  for (const brut of t.split('\n')) {
    const n = jointes.length;
    if (n && /[ \t]$/.test(jointes[n - 1]) && jointes[n - 1].trim() && brut.trim() && !PUCE.test(brut.trim()) && (jointes[n - 1].trim().length >= 55 || /^[a-zà-ÿ]/.test(brut.trim()))) jointes[n - 1] = jointes[n - 1].replace(/[ \t]+$/, ' ') + brut.replace(/^[ \t]+/, '');
    else jointes.push(brut);
  }
  // 2. Les paragraphes ; un paragraphe coupé au milieu d'une phrase (le suivant
  //    commence par une minuscule) est recollé.
  const paras = [];
  for (const p of jointes.join('\n').split(/\n\s*\n/)) {
    const x = p.split('\n').map((l) => l.replace(/[ \t ]+/g, ' ').trim()).filter((l) => l && !/^[.·•\-–—]$/.test(l) && !(TETE.test(l) && !paras.length));
    if (!x.length) continue;
    const prec = paras[paras.length - 1];
    if (prec && /^[a-zà-ÿ]/.test(x[0]) && !/[.!?:»)…]$/.test(prec[prec.length - 1])) { prec[prec.length - 1] += ' ' + x[0]; prec.push(...x.slice(1)); }
    else paras.push(x);
  }
  // 3. Les blocs, puis le pied (à part, jamais retiré).
  const blocs = [], pied = [];
  let dansPied = false;
  for (const p of paras) {
    p.forEach((l, i) => {
      if (TETE.test(l) && !blocs.length) return;
      if (!dansPied && PIED.test(l)) dansPied = true;
      if (dansPied) { pied.push(l); return; }
      const puce = PUCE.exec(l);
      const corps = puce ? l.slice(puce[0].length) : l;
      // Une ligne en capitales, courte, sans chiffre : une étiquette (« CODE DE RETRAIT ») —
      // sauf juste après une autre (« POINT RELAIS » puis « MAISON DE LA PRESSE » : la valeur).
      const capitale = l.length <= 32 && !/[a-zà-ÿ\d]/.test(l) && /[A-ZÀ-Ý]{3}/.test(l);
      const precE = blocs.length && blocs[blocs.length - 1].k === 'etiquette';
      const k = puce ? 'li' : /^Vinted te transfère cet e-mail/i.test(l) ? 'note' : capitale && !precE ? 'etiquette' : 'p';
      const parts = morceaux(corps);
      if (parts.length) blocs.push({ k, ...(puce && puce[1] ? { n: Number(puce[1]) } : {}), parts, fin: i === p.length - 1 });
    });
  }
  return { blocs, pied: pied.join(' ').replace(/\s+([.,])/g, '$1').replace(/\s{2,}/g, ' ').trim() };
}
