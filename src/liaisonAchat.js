// ════════════════════════════════════════════════════════════════════════════
//  LIAISON ACHAT ⇄ ARTICLE — LA PROPOSITION PONDÉRÉE (15 nov. 2026)
// ════════════════════════════════════════════════════════════════════════════
// Julien (15 nov., mot pour mot) : « Je veux que tu améliores la liaison entre les
// achats et les articles en vente ou vendus, avec les titres, dates de retrait,
// couleur de l'article, etc. »
//
// MESURÉ en lecture seule sur sa base (récit : docs/passation/2026-11-15-achats-liaison.md) :
//   · 2 666 achats Vinted captés (638 remboursés) ; 572 fiches numérotées, 11 reliées
//     par lui à un achat (n° de transaction) = la VÉRITÉ TERRAIN ; 2 580 ventes, aucune
//     reliée à un achat (165 prix tapés à la main) ;
//   · un achat (`my_orders`) ne porte QUE titre, prix, date de commande, statut, photo
//     (23 %) — ni marque, ni taille, ni couleur, ni catégorie : tout se lit dans son TITRE ;
//     la date de livraison n'est lue que pour 43 achats (détail de transaction) ;
//   · l'ancienne règle (`suggestionsAchat`) exigeait la taille ÉCRITE dans le titre de
//     l'achat : rejouée sur les 11 liaisons de Julien, le bon achat sort premier 5 fois
//     sur 11 (45 %), et rien n'est proposé 5 fois (« Salomon xt-6 vert kaki », « Nike
//     shox », « Nike Schuhe Gr 39 » : titres sans taille ou sans mot de modèle).
//
// LA RÈGLE (une PROPOSITION, §5 : elle peut utiliser la ressemblance ; c'est TOUJOURS
// SON toucher qui relie — ce module n'écrit rien) :
//   ÉCARTÉ (jamais proposé) :
//     · une autre MARQUE (la marque de l'annonce se prouve par son titre, `marqueAnnonce` ;
//       l'achat porte CETTE marque, reconnue ou écrite) ; marque pas sue ⇒ rien ;
//     · taille de l'article pas sue ⇒ rien ; tailles connues des deux côtés et différentes ;
//     · deux modèles reconnus différents (« air max 90 » / « air max 1 ») ;
//     · un achat qui a des mots de modèle, mais aucun en commun ;
//     · couleurs connues des deux côtés et sans couleur commune ;
//     · un achat commandé APRÈS la mise en ligne (ou la vente) ; date de commande inconnue ;
//     · remboursé / annulé ; déjà relié ailleurs (un LOT jusqu'à son nombre) ;
//     · « Ce n'est pas lui » (`refus`, synchronisé) : ce couple ne revient plus.
//   PESÉ (les poids sont MESURÉS sur sa vérité terrain : docs/passation/2026-11-15-achats-liaison.md) :
//     · les MOTS DU MODÈLE en commun, dans les deux sens (part des mots de l'article retrouvés, part
//       des mots de l'achat retrouvés) et leur nombre ; « xt-6 » = « xt 6 » = « xt6 » ; une VERSION
//       différente (« novablast 4 » / « 3 ») écarte. (Mesuré : peser chaque mot par sa rareté parmi
//       ses achats faisait MOINS bien — top-1 73 % contre 82 % sur ses 11 liaisons — : chaque mot pèse 1.)
//     · la TAILLE (identique ; ou US écrite ⇒ EU par la table de la marque) ;
//     · la COULEUR (champ de l'annonce, puis mots de couleur du titre en 7 langues) ;
//     · la CHRONOLOGIE : jours entre le retrait / la livraison (lus) — sinon la commande —
//       et la mise en ligne ; une mise en ligne qui suit de près pèse plus ;
//     · le PRIX : vendu (ou affiché) au-dessus du prix payé, sans l'exiger ;
//     · la PHOTO : la même empreinte (si l'acheteur a reposté la photo du vendeur), quand
//       les deux empreintes sont connues.
//   LE NIVEAU :
//     · « très probable » seulement si : score haut, assez de mots du modèle en commun, la taille
//       ou la couleur confirmée, pas un lot, ET l'affectation est UNIQUE dans les deux sens :
//       l'achat devance nettement le 2e achat de CET article, et CET article devance nettement le
//       2e article de CET achat (affectation globale par dominance mutuelle, jamais gloutonne :
//       50 paires identiques ⇒ aucune « très probable ») ; un achat n'est « très probable » que pour
//       UN article, et n'est plus proposé ailleurs ;
//     · « possible » sinon (deux candidats trop proches ⇒ `ambigu`, il choisit dans la liste).
//   Chaque proposition dit POURQUOI (`pourquoi` : marque, mots, taille, couleur, jours…) —
//   l'écran en fait la phrase (« même marque · même taille 42 · noire · mise en ligne 2 j après
//   le retrait »).
//
// Module PUR : l'app (Annonces → « Sans achat relié », Achats, « Relier un achat ») et l'audit
// exécutent CES fonctions. La marque, les couleurs et le modèle viennent des règles de l'app
// (`extractBrand`, `extractColors`, `extractModel`), passées en paramètre (§11).
import { tailleNorm, tailleDuTitre, marqueAnnonce, memeMarque, normMots, MOTS_VIDES, achatAnnule, achatDisponible, lotDe } from './suggestionsAchat.js';

const J = 86400e3;
const txDe = (a) => (a && a.transaction_id != null ? String(a.transaction_id) : '');
const prixNum = (p) => { const v = p && typeof p === 'object' ? p.amount : p; const n = Number(String(v == null ? '' : v).replace(',', '.')); return Number.isFinite(n) && n > 0 ? n : null; };
const dateMs = (d) => { if (d == null || d === '') return NaN; const t = typeof d === 'number' ? (d < 1e12 ? d * 1000 : d) : Date.parse(d); return Number.isFinite(t) ? t : NaN; };

// ── Les poids (mesurés : voir l'en-tête et l'audit) ─────────────────────────
export const POIDS = Object.freeze({
  mots: 6,            // × la part des mots du modèle retrouvés (moyenne des deux sens)
  motsBonus: 1,       // la part dépasse 60 %
  raretes: 0.4,       // × le nombre de mots du modèle en commun (plafonné)
  raretesMax: 4,
  taille: 3,          // même taille EU
  tailleUs: 2,        // taille US de l'achat = taille EU de l'article (table de la marque)
  couleur: 2,         // une couleur en commun
  chrono: 2.5,        // × e^(−jours / 25) : jours entre le retrait (sinon la commande) et la mise en ligne
  chronoJours: 25,
  prix: 0.5,          // vendu (ou affiché) au-dessus du prix payé
  prixBas: -1,        // vendu sous 60 % du prix payé
  photo: 6,           // la même photo (empreinte)
});
export const SEUIL_POSSIBLE = 3.5;     // en dessous, rien n'est montré (pas de suggestion faible)
export const SEUIL_TRES_PROBABLE = 8;  // score minimal d'une « très probable »
export const COUVERTURE_TRES_PROBABLE = 0.5;
export const ECART_TRES_PROBABLE = 2.5; // l'écart exigé avec le 2e (dans les DEUX sens)

// ── Les couleurs : celles de l'app, et les écritures qu'elle ne lit pas ─────
// (pluriels, « kaki », « bordeaux », « dunkelblau », « écru »… — vus dans ses titres d'achat)
const COULEURS_EN_PLUS = {
  noir: ['noirs', 'noires', 'schwarze', 'schwarzer', 'zwarte', 'neri', 'nere', 'negras', 'negros'],
  blanc: ['blancs', 'blanches', 'weisse', 'weisser', 'witte', 'bianchi', 'bianche', 'blancas', 'blancos', 'offwhite', 'ivoire', 'ivory'],
  gris: ['grises', 'graue', 'grauer', 'grijze', 'argent', 'silver', 'silber'],
  bleu: ['bleus', 'bleues', 'dunkelblau', 'hellblau', 'blaue', 'blauwe', 'royal', 'azure', 'turquoise', 'celeste'],
  vert: ['verts', 'vertes', 'kaki', 'khaki', 'olive', 'grune', 'gruen', 'groene', 'verdi', 'verdes', 'menthe', 'mint'],
  rouge: ['rouges', 'bordeaux', 'burgundy', 'rote', 'roter', 'rode', 'rossi', 'rosse', 'rojas', 'rojos'],
  rose: ['roses', 'rosas', 'fuchsia'],
  jaune: ['jaunes', 'gelbe', 'gialli', 'gialle', 'amarillas'],
  violet: ['violets', 'violettes', 'mauve', 'lilas'],
  beige: ['beiges', 'ecru', 'creme', 'cremes', 'taupe', 'nude'],
  marron: ['marrons', 'marroni', 'braune', 'bruine', 'camel', 'cognac', 'chocolat'],
};
const MOT_COULEUR = new Map();
for (const [nom, mots] of Object.entries(COULEURS_EN_PLUS)) for (const m of mots) MOT_COULEUR.set(m, nom);
// Toutes les couleurs d'un texte : la règle de l'app, puis les écritures en plus (mots entiers, sans accents).
// `parMot` : la règle de l'app appliquée mot par mot (mémorisée par l'appelant : des milliers de titres).
export function couleursTexte(texte, couleursDe, parMot = false) {
  const t = String(texte || '');
  const out = new Set();
  if (typeof couleursDe === 'function') {
    if (parMot) { for (const w of t.toLowerCase().split(/[^a-zà-ÿ0-9]+/)) if (w) for (const c of couleursDe(w) || []) out.add(String(c).toLowerCase()); if (/mineral/i.test(t)) for (const c of couleursDe(t) || []) out.add(String(c).toLowerCase()); }
    else for (const c of couleursDe(t) || []) out.add(String(c).toLowerCase());
  }
  for (const w of normMots(t).split(' ')) { const c = MOT_COULEUR.get(w); if (c) out.add(c); }
  return [...out];
}
// Des mots vides en plus de `MOTS_VIDES` (vus dans ses titres d'achat).
const VIDES_EN_PLUS = new Set(['sans', 'sur', 'vends', 'vend', 'vendu', 'porte', 'portees', 'porté', 'peu', 'jamais', 'quasi', 'etat', 'state', 'condition',
  'used', 'worn', 'gebraucht', 'getragen', 'usato', 'usado', 'gedragen', 'cm', 'eu', 'size', 'gr', 'grosse']);
const estCouleur = (w, couleursDe) => MOT_COULEUR.has(w) || (typeof couleursDe === 'function' && (couleursDe(w) || []).length > 0);

// ── La taille d'un ACHAT : EU écrite, sinon US écrite convertie par la marque ──
// Table homme (la plus vendue chez lui). Une taille US d'une autre marque ne se convertit pas
// (« pas su » : elle ne confirme rien, elle n'écarte rien).
const US_EU = {
  nike: { 6: '38.5', 6.5: '39', 7: '40', 7.5: '40.5', 8: '41', 8.5: '42', 9: '42.5', 9.5: '43', 10: '44', 10.5: '44.5', 11: '45', 11.5: '45.5', 12: '46', 13: '47.5' },
  adidas: { 5: '37 1/3', 5.5: '38', 6: '38 2/3', 6.5: '39 1/3', 7: '40', 7.5: '40 2/3', 8: '41 1/3', 8.5: '42', 9: '42 2/3', 9.5: '43 1/3', 10: '44', 10.5: '44 2/3', 11: '45 1/3', 11.5: '46', 12: '46 2/3' },
};
US_EU.jordan = US_EU.nike; US_EU['air jordan'] = US_EU.nike;
export function tailleAchat(titre, marque = '') {
  const eu = tailleDuTitre(titre);
  if (eu) return { taille: eu, us: false };
  const t = String(titre || '').toLowerCase();
  const m = /(?:\bus\s*m?\s*(\d{1,2}(?:[.,]5)?)\b|\b(\d{1,2}(?:[.,]5)?)\s*us\b)/.exec(t);
  if (!m) return { taille: '', us: false };
  const n = Number(String(m[1] || m[2]).replace(',', '.'));
  const table = US_EU[normMots(marque)];
  const v = table && table[n];
  return v ? { taille: tailleNorm(v) || v, us: true } : { taille: '', us: false };
}

// ── Les mots du modèle et leur VERSION (« xt-6 » = « xt 6 » = « xt6 ») ─────
// Hors marque, mots vides (six langues), couleurs, tailles et petits nombres seuls, lettres seules.
// Un nombre qui suit un mot du modèle (1 à 4 chiffres, hors tailles 34-52) en est la VERSION :
// « novablast 4 » ⇒ novablast + novablast:4 ; « xt6 », « r4 », « p 6000 » ⇒ xt:6, r:4, p:6000.
// Deux versions différentes du même mot ⇒ deux modèles différents (mesuré : « asics novablast 4 » se voyait
// proposer « ASICS NovaBlast 3 », « mexico 66 » « México 68 »). Les nombres de 3-4 chiffres seuls
// (« 550 », « 2002r ») sont des mots du modèle.
const TAILLE_SEULE = /^(3[4-9]|4\d|5[0-2])$/;
export function motsCles(titre, marque, couleursDe) {
  const mq = new Set(normMots(marque).split(' ').filter(Boolean));
  const w = normMots(titre).split(' ').filter(Boolean);
  const out = new Set();
  const vide = (x) => mq.has(x) || MOTS_VIDES.has(x) || VIDES_EN_PLUS.has(x);
  for (let i = 0; i < w.length; i++) {
    const a = w[i], b = w[i + 1];
    if (vide(a)) { if (b && /^\d{1,2}$/.test(b)) i++; continue; }     // « taille 42 », « gr 39 », « us 9 »
    const colle = /^([a-z]{1,4})(\d{1,4})$/.exec(a);                   // « xt6 », « r4 », « p6000 »
    if (colle) { if (colle[1].length > 1 && !vide(colle[1])) out.add(colle[1]); out.add(colle[1] + ':' + colle[2]); continue; }
    if (/^\d+(us|uk|eu|cm|fr)$/.test(a)) continue;                     // « 9 5us »
    if (/^\d+$/.test(a)) { if (a.length >= 3) out.add(a); continue; }  // un nombre seul : modèle s'il a 3-4 chiffres
    if (estCouleur(a, couleursDe)) continue;
    const version = b && /^\d{1,4}$/.test(b) && !TAILLE_SEULE.test(b) ? b : '';
    if (a.length > 1) out.add(a);
    if (version) { out.add(a + ':' + version); i++; }
  }
  return out;
}
// Les versions d'un jeu de mots : base → version.
export function versionsDe(mots) {
  const m = new Map();
  for (const w of mots) { const k = w.indexOf(':'); if (k > 0) m.set(w.slice(0, k), w.slice(k + 1)); }
  return m;
}
// La rareté de chaque mot parmi les achats (un mot présent partout ne prouve rien).
export function poidsMots(listeDeMots) {
  const df = new Map(); let n = 0;
  for (const s of listeDeMots) { n++; for (const w of s) df.set(w, (df.get(w) || 0) + 1); }
  return (w) => Math.log(1 + (n + 1) / (1 + (df.get(w) || 0)));
}

// ── Préparer un achat une fois (titre lu, marque, taille, couleurs, dates) ──
// (16 nov., stabilite-iphone — « l'app bug énormément », touchers de 1,25 à 4 s sur Ventes) Ventes demande, pour
// CHAQUE vente sans achat relié et à CHAQUE rendu, la proposition d'achat (`propositionsArticle`) : chaque appel
// re-préparait TOUS les achats (marque, mots, couleurs, normalisation du titre). Profil de l'ouverture de Ventes
// (base de 1 000 paires) : 1,3 s sur 1,5 s dans cette préparation. Ce qui ne dépend QUE de l'achat et des règles de
// texte (titre, marque, mots, couleurs, prix, dates, lot, annulé, modèle, tailles lues) est gardé par achat (même
// objet, mêmes champs lus, mêmes règles) ; la date de réception (`receptionDe`, qui peut changer) est relue à
// chaque appel. Même résultat, aucune ressemblance de plus : seule la répétition est retirée.
const PREP_ACHAT = new WeakMap();
function baseAchat(a, marqueDe, couleursDe, couleursCle, modeleDe) {
  const peutGarder = !!a && typeof a === 'object';
  if (peutGarder) {
    const g = PREP_ACHAT.get(a);
    if (g && g.marqueDe === marqueDe && g.couleursCle === couleursCle && g.modeleDe === modeleDe && g.titre === a.title && g.prixBrut === a.price
      && g.dateBrute === a.date && g.statut === a.status && g.txBrut === a.transaction_id) return g.base;
  }
  const t = String((a && a.title) || '');
  const marque = normMots(marqueDe(t));
  const base = { tx: txDe(a), t, norm: ' ' + normMots(t) + ' ', marque, couleurs: couleursTexte(t, couleursDe, true), date: dateMs(a && a.date), prix: prixNum(a && a.price),
    lot: lotDe(a).lot, annule: achatAnnule(a), mots: motsCles(t, marque, couleursDe), modele: typeof modeleDe === 'function' ? modeleDe(t) : null, tailles: new Map() };
  base.motsArr0 = [...base.mots]; base.versions0 = versionsDe(base.mots);
  if (peutGarder) PREP_ACHAT.set(a, { marqueDe, couleursCle, modeleDe, titre: a.title, prixBrut: a.price, dateBrute: a.date, statut: a.status, txBrut: a.transaction_id, base });
  return base;
}
function preparerAchat(a, { marqueDe, couleursDe, couleursCle = couleursDe, receptionDe, modeleDe }) {
  const base = baseAchat(a, marqueDe, couleursDe, couleursCle, modeleDe);
  const rec = typeof receptionDe === 'function' ? receptionDe(a) : null;
  const recMs = rec == null ? NaN : dateMs(typeof rec === 'object' ? rec.ms : rec);
  return { ...base, a, recMs, recSource: rec && typeof rec === 'object' && rec.source ? rec.source : (Number.isFinite(recMs) ? 'livraison' : ''),
    versions: null, motsArr: null, dispo: true };
}

// ── Préparer un article (annonce en vente, ou vente) ─────────────────────────
// cible : { key, titre, marque?, taille?, couleur? (texte du champ), dateRef (mise en ligne, sinon
//          vente), dateRefSource? ('en-ligne' | 'vente'), prix?, curTx?, empreinte? }
function preparerCible(c, { marqueDe, couleursDe, modeleDe }) {
  const titre = String(c.titre || '');
  const marque = marqueAnnonce({ marque: c.marque, titre }, marqueDe);
  const taille = c.taille ? tailleNorm(c.taille) : tailleDuTitre(titre);
  return { c, key: String(c.key == null ? '' : c.key), titre, marque, mq: new Set(marque.split(' ').filter(Boolean)), mqArr: marque.split(' ').filter(Boolean), taille, couleurs: couleursTexte([c.couleur || '', titre].join(' '), couleursDe, true),
    ref: dateMs(c.dateRef), refSource: c.dateRefSource === 'vente' ? 'vente' : 'en-ligne', prix: prixNum(c.prix), mots: marque ? motsCles(titre, marque, couleursDe) : new Set(),
    modele: typeof modeleDe === 'function' ? modeleDe(titre) : null, motsArr: null };
}

// Deux modèles reconnus : compatibles quand l'un prolonge l'autre (« dunk » / « dunk low »).
const modelesCompatibles = (x, y) => !x || !y || x === y || x.startsWith(y + ' ') || y.startsWith(x + ' ');

// ── Une paire article × achat : null (écartée) ou { score, … } ───────────────
// (les filtres les moins chers d'abord, aucune allocation tant que la paire n'est pas gardée :
//  2 500 articles × 2 600 achats doivent tenir dans la seconde)
const COMMUNS = [];
function evaluer(P, A, ctx) {
  const { refus, poids, distancePhoto } = ctx;
  // Chronologie : commandé AVANT la mise en ligne (ou la vente) ; date de commande inconnue ⇒ écarté.
  if (!Number.isFinite(A.date) || (Number.isFinite(P.ref) && !(A.date < P.ref))) return null;
  // Au moins un mot du modèle en commun (un achat SANS aucun mot de modèle est pesé plus bas).
  // Les mots de la marque de l'article ne comptent pas (« air jordan 1 » / « jordan »).
  let com = 0, totA = A.totPoids, nA = A.motsArr.length; COMMUNS.length = 0;
  for (const w of P.mqArr) if (A.mots.has(w)) { nA--; totA -= poids(w); }
  const generique = nA === 0;
  const tot = P.totPoids;
  if (!generique) {
    for (const w of P.motsArr) if (A.mots.has(w)) { com += poids(w); COMMUNS.push(w); }
    if (!COMMUNS.length) return null;
  }
  // Deux versions différentes du même mot (« novablast 4 » / « novablast 3 ») ⇒ deux modèles différents.
  for (const [base, v] of P.versions) { const va = A.versions.get(base); if (va && va !== v) return null; }
  // Remboursé / annulé ; déjà relié ailleurs (`achatDisponible`, un lot jusqu'à son nombre) ; refusé par lui.
  if (A.annule || !(A.dispo || (P.c.curTx && String(P.c.curTx) === A.tx))) return null;
  if (refus.size && refus.has(P.key + '>' + A.tx)) return null;
  // La marque : CELLE de l'article, reconnue ou écrite dans le titre de l'achat.
  // (les deux marques sont déjà normalisées : `memeMarque` sans renormaliser, mémorisé par couple)
  if (A.marque) { const k = A.marque + '|' + P.marque; let ok = ctx.marques.get(k); if (ok == null) { ok = memeMarque(A.marque, P.marque); ctx.marques.set(k, ok); } if (!ok) return null; }
  else if (!A.norm.includes(' ' + P.marque + ' ')) return null;
  // Deux modèles reconnus et différents.
  if (!modelesCompatibles(P.modele, A.modele)) return null;
  // La taille : connue des deux côtés et différente ⇒ écarté (une taille US d'une autre table ne dit rien).
  let ta = A.tailles.get(P.marque);
  if (!ta) { ta = tailleAchat(A.t, P.marque); A.tailles.set(P.marque, ta); }
  const tailleOk = !!ta.taille && ta.taille === P.taille;
  if (ta.taille && !tailleOk && !ta.us) return null;
  // La couleur : connue des deux côtés et sans couleur commune ⇒ écarté.
  let couleur = '';
  if (P.couleurs.length && A.couleurs.length) { for (const c of A.couleurs) if (P.couleurs.includes(c)) { couleur = c; break; } if (!couleur) return null; }
  // La chronologie : retrait / livraison lus, sinon la commande.
  const recu = Number.isFinite(A.recMs) && (!Number.isFinite(P.ref) || A.recMs <= P.ref);
  const depuis = recu ? A.recMs : A.date;
  const jours = Number.isFinite(P.ref) ? Math.max(0, Math.round((P.ref - depuis) / J)) : null;
  // Un achat sans aucun mot de modèle (« Nike Schuhe Gr 39 ») ne se propose que sur la taille ET une
  // chronologie serrée (≤ 60 j) — et jamais « très probable ».
  if (generique && !(tailleOk && jours != null && jours <= 60)) return null;
  let score = 0, couv = 0;
  if (!generique) {
    // La part des mots retrouvés dans les DEUX sens (un titre d'achat court, « Nike shox », retrouve
    // tout le sien dans l'annonce même s'il n'en dit pas autant), plus le nombre de mots communs.
    couv = ((tot > 0 ? com / tot : 0) + (totA > 0 ? com / totA : 0)) / 2;
    score += POIDS.mots * couv + (couv >= 0.6 ? POIDS.motsBonus : 0) + Math.min(POIDS.raretesMax, POIDS.raretes * com);
  }
  if (tailleOk) score += ta.us ? POIDS.tailleUs : POIDS.taille;
  if (couleur) score += POIDS.couleur;
  // Une mise en ligne qui suit de près pèse plus, en continu (8 j : 1,8 ; 21 j : 1,1 ; 60 j : 0,2).
  if (jours != null) score += POIDS.chrono * Math.exp(-jours / POIDS.chronoJours);
  // Le prix : vendu (ou affiché) au-dessus du prix payé, sans l'exiger.
  if (P.prix != null && A.prix != null) { if (P.prix >= A.prix) score += POIDS.prix; else if (P.prix < 0.6 * A.prix) score += POIDS.prixBas; }
  // La photo (empreintes connues des deux côtés).
  let photoOk = false;
  if (typeof distancePhoto === 'function') { const d = distancePhoto(P.c, A.a); if (d != null && d <= ctx.seuilPhoto) { photoOk = true; score += POIDS.photo; } }
  if (score < SEUIL_POSSIBLE) return null;
  const fort = !A.lot && score >= SEUIL_TRES_PROBABLE && (photoOk || (!generique && couv >= COUVERTURE_TRES_PROBABLE && (tailleOk || (!!couleur && couv >= 0.75))));
  return { A, score: Math.round(score * 100) / 100, couv, tailleOk, tailleUs: tailleOk && ta.us, couleur, generique, fort, photoOk, jours,
    depuis: recu ? (A.recSource === 'clic' ? 'retrait' : 'livraison') : 'commande', communs: COMMUNS.slice() };
}
// POURQUOI, dans l'ordre de lecture : marque · mots · taille · couleur · jours · photo.
function expliquer(P, e) {
  const out = [{ cle: 'marque', v: P.marque }];
  if (e.generique) out.push({ cle: 'generique' }); else out.push({ cle: 'mots', v: e.communs.join(' ') });
  if (e.tailleOk) out.push({ cle: e.tailleUs ? 'tailleUs' : 'taille', v: P.taille }); else out.push({ cle: 'tailleInconnue' });
  if (e.couleur) out.push({ cle: 'couleur', v: e.couleur });
  if (e.jours != null) out.push({ cle: 'jours', v: e.jours, depuis: e.depuis, ref: P.refSource });
  if (e.photoOk) out.push({ cle: 'photo' });
  return out;
}

// ── L'AFFECTATION GLOBALE ──────────────────────────────────────────────────
// cibles : [cible] (voir `preparerCible`) · achats : la liste captée · liens : `liensParAchat`
// refus : Set|objet de clés `${key}>${tx}` (« Ce n'est pas lui ») · receptionDe(a) → { ms, source } | ms | null
// Rend { parArticle: { [key]: [proposition] }, parAchat: { [tx]: [{ key, score, niveau }] }, tresProbables: [{ key, tx }] }
// proposition : { achat, score, niveau: 'tres-probable' | 'possible', ambigu, rang, pourquoi, jours, depuis }
export function affecterPropositions({ cibles, achats, liens = null, refus = null, marqueDe, couleursDe, modeleDe = null, receptionDe = null,
  distancePhoto = null, seuilPhoto = 12, max = 3 } = {}) {
  const vide = { parArticle: {}, parAchat: {}, tresProbables: [] };
  if (!Array.isArray(cibles) || !Array.isArray(achats) || typeof marqueDe !== 'function' || typeof couleursDe !== 'function') return vide;
  const refusSet = refus instanceof Set ? refus : new Set(Object.keys(refus || {}));
  // Les couleurs d'un mot, lues une fois (la règle de l'app compile ses motifs à chaque appel).
  const memo = new Map();
  const couleursM = (x) => { const k = String(x || ''); let v = memo.get(k); if (!v) { v = couleursDe(k) || []; memo.set(k, v); } return v; };
  const lz = liens || new Map();
  const As = achats.filter((a) => a && txDe(a)).map((a) => preparerAchat(a, { marqueDe, couleursDe: couleursM, couleursCle: couleursDe, receptionDe, modeleDe }));
  for (const A of As) { A.motsArr = A.motsArr0; A.versions = A.versions0; A.dispo = achatDisponible(A.a, lz, ''); }
  // Le poids d'un mot : 1. (MESURÉ sur ses 11 liaisons : la rareté parmi ses achats, `poidsMots`, donnait
  // top-1 73 % / top-3 73 % ; le poids plat 82 % / 91 %. `poidsMots` reste pour une mesure future.)
  const poids = () => 1;
  const ctx = { refus: refusSet, poids, distancePhoto, seuilPhoto, marques: new Map() };
  // L'index des achats par mot du modèle (un achat ne se pèse que s'il partage un mot avec l'article).
  const index = new Map(), sansMots = [];
  let tampon = 0;
  for (const A of As) {
    A.totPoids = 0; for (const w of A.motsArr) A.totPoids += poids(w);
    A.vu = 0;
    if (!A.motsArr.length) { sansMots.push(A); continue; }
    for (const w of A.motsArr) { let l = index.get(w); if (!l) { l = []; index.set(w, l); } l.push(A); }
  }
  const cand = new Map();   // key → [éval] (score décroissant)
  const Pde = new Map();    // key → article préparé
  const parTx = new Map();  // tx → [{ key, e }]
  const Ps = [];
  for (const c of cibles) {
    if (!c) continue;
    const P = preparerCible(c, { marqueDe, couleursDe: couleursM, modeleDe });
    if (!P.key || !P.marque || !P.taille || !P.mots.size) { cand.set(P.key, []); continue; }
    P.motsArr = [...P.mots]; P.versions = [...versionsDe(P.mots)];
    P.totPoids = 0; for (const w of P.motsArr) P.totPoids += poids(w);
    Ps.push(P); Pde.set(P.key, P);
    const l = [];
    // Les achats à peser : ceux qui partagent un mot du modèle (index), et ceux sans aucun mot de
    // modèle ; la marque, la date et le reste sont jugés par `evaluer`.
    tampon++;
    for (const w of P.motsArr) for (const A of (index.get(w) || [])) { if (A.vu === tampon) continue; A.vu = tampon; const e = evaluer(P, A, ctx); if (e) l.push(e); }
    for (const A of sansMots) { const e = evaluer(P, A, ctx); if (e) l.push(e); }
    l.sort((x, y) => (y.score - x.score) || (y.A.date - x.A.date));
    cand.set(P.key, l);
    for (const e of l) { if (!parTx.has(e.A.tx)) parTx.set(e.A.tx, []); parTx.get(e.A.tx).push({ key: P.key, e }); }
  }
  // Dominance mutuelle, par tours : un couple est « très probable » quand l'achat devance nettement le
  // 2e achat de l'article ET l'article devance nettement le 2e article de l'achat, parmi ce qui reste.
  // Ce qui est confirmé sort du jeu (un achat sert une fois), puis on recommence. Jamais glouton :
  // deux candidats proches restent proches, aucun n'est choisi.
  const pris = new Map();   // key → tx
  const prisTx = new Map(); // tx → key
  for (let tour = 0; tour < 6; tour++) {
    const nouveaux = [];
    for (const P of Ps) {
      if (pris.has(P.key)) continue;
      const l = cand.get(P.key).filter((e) => !prisTx.has(e.A.tx));
      const b = l[0]; if (!b || !b.fort) continue;
      const s2 = l[1] ? l[1].score : -Infinity;
      if (b.score - s2 < ECART_TRES_PROBABLE) continue;
      const autres = (parTx.get(b.A.tx) || []).filter((x) => x.key !== P.key && !pris.has(x.key)).map((x) => x.e.score);
      const s2a = autres.length ? Math.max(...autres) : -Infinity;
      if (b.score - s2a < ECART_TRES_PROBABLE) continue;
      nouveaux.push([P.key, b.A.tx]);
    }
    if (!nouveaux.length) break;
    for (const [k, tx] of nouveaux) { if (prisTx.has(tx) || pris.has(k)) continue; pris.set(k, tx); prisTx.set(tx, k); }
  }
  const parArticle = {}, parAchat = {}, tresProbables = [];
  for (const [key, l0] of cand) {
    const sien = pris.get(key);
    // Un achat « très probable » pour UN autre article n'est plus proposé ici.
    const l = l0.filter((e) => !(prisTx.has(e.A.tx) && prisTx.get(e.A.tx) !== key && !e.A.lot));
    if (!l.length) { parArticle[key] = []; continue; }
    const ambigu = !sien && l.length > 1 && l[0].score - l[1].score < ECART_TRES_PROBABLE;
    parArticle[key] = l.slice(0, max).map((e, i) => ({
      achat: e.A.a, score: e.score, niveau: i === 0 && sien === e.A.tx ? 'tres-probable' : 'possible', ambigu: i === 0 ? ambigu : false,
      rang: e.tailleOk && e.couleur ? 1 : 2, pourquoi: expliquer(Pde.get(key), e), jours: e.jours,
      recu: Number.isFinite(e.A.recMs) ? { ms: e.A.recMs, source: e.A.recSource } : null,
    }));
    if (sien) tresProbables.push({ key, tx: sien });
  }
  for (const [tx, l] of parTx) {
    const k = prisTx.get(tx);
    const libres = l.filter((x) => !pris.has(x.key) || x.key === k).sort((x, y) => y.e.score - x.e.score);
    if (!libres.length) continue;
    parAchat[tx] = libres.slice(0, max).map((x) => ({ key: x.key, score: x.e.score, niveau: x.key === k ? 'tres-probable' : 'possible' }));
  }
  return { parArticle, parAchat, tresProbables };
}

// Un article seul (« Relier un achat », la meilleure suggestion d'une annonce) : la MÊME règle.
export function propositionsArticle({ cible, ...o } = {}) {
  if (!cible) return [];
  const key = cible.key == null ? '_' : String(cible.key);
  return affecterPropositions({ ...o, cibles: [{ ...cible, key }] }).parArticle[key] || [];
}

// ── « Ce n'est pas lui » : la clé du couple refusé ──────────────────────────
export const cleRefusLiaison = (key, tx) => `${key}>${tx}`;
export const cleArticleAnnonce = (id) => `a:${id}`;
export const cleArticleVente = (tx) => `v:${tx}`;

// ── « Valider les N très probables » : la liste MONTRÉE avant SON toucher ───
// Un article, un achat ; jamais un lot (le prix de l'article serait à saisir).
export function aValider(parArticle) {
  const out = [], vus = new Set();
  for (const [key, l] of Object.entries(parArticle || {})) {
    const p = l && l[0];
    if (!p || p.niveau !== 'tres-probable' || lotDe(p.achat).lot) continue;
    const tx = txDe(p.achat); if (vus.has(tx)) continue; vus.add(tx);
    out.push({ key, achat: p.achat, proposition: p });
  }
  return out;
}

// ── La phrase « pourquoi », en morceaux (l'écran les traduit) ────────────────
// Rend [{ cle, vars }] dans l'ordre de lecture : marque · mots · taille · couleur · jours.
export function morceauxPourquoi(p) {
  const out = [];
  for (const x of (p && p.pourquoi) || []) {
    if (x.cle === 'marque') out.push({ cle: 'marque', vars: {} });
    else if (x.cle === 'mots') out.push({ cle: 'mots', vars: { mots: motsLisibles(x.v) } });
    else if (x.cle === 'taille' || x.cle === 'tailleUs') out.push({ cle: x.cle, vars: { taille: String(x.v).replace('.', ',') } });
    else if (x.cle === 'couleur') out.push({ cle: 'couleur', vars: { couleur: x.v } });
    else if (x.cle === 'jours') out.push({ cle: `jours.${x.ref}.${x.depuis}`, vars: { n: String(x.v) } });
    else if (x.cle === 'photo') out.push({ cle: 'photo', vars: {} });
    else if (x.cle === 'tailleInconnue') out.push({ cle: 'tailleInconnue', vars: {} });
    else if (x.cle === 'generique') out.push({ cle: 'generique', vars: {} });
  }
  return out;
}
// « xt xt:6 » ⇒ « xt 6 » ; trois mots au plus.
export function motsLisibles(v) {
  const ws = String(v || '').split(' ').filter(Boolean);
  const bases = new Set(ws.filter((w) => w.includes(':')).map((w) => w.split(':')[0]));
  return ws.filter((w) => w.includes(':') || !bases.has(w)).map((w) => w.replace(':', ' ')).slice(0, 3).join(' ');
}

// ── Ce que l'écran montre d'un ACHAT : sa taille et ses couleurs, lues dans son titre ──
export function lectureAchat(achat, marqueDe, couleursDe) {
  const t = String((achat && achat.title) || '');
  const marque = typeof marqueDe === 'function' ? normMots(marqueDe(t)) : '';
  return { taille: tailleAchat(t, marque).taille, couleurs: couleursTexte(t, couleursDe) };
}
