// ═══════════════════════════════════════════════════════════════════════════
// LA RECHERCHE EN PHRASE, SANS IA (14 nov. 2026, chantier 92 — validé par Julien)
// ═══════════════════════════════════════════════════════════════════════════
// « nike 42 pas vendue depuis 2 mois », « colis mondial relay demain », « B230 »,
// « adidas samba < 80 € » — en français, anglais, espagnol, italien, allemand.
//
// Un analyseur LOCAL (aucun appel, aucune clé, §2.9) qui lit la phrase et en fait des
// FILTRES : marque, modèle, taille, N°, prix, état (vendue / en ligne / à retirer /
// à expédier / brouillon / masquée), durée (« depuis 2 mois »), jour (« demain »),
// transporteur, ce qu'on cherche (colis, ventes…), et les mots qui restent.
// ⚠️ Il ne RÉPOND jamais : il produit des filtres que l'écran MONTRE en capsules
//    (chacune garde la place exacte des mots qui l'ont produite, `de`/`a`, pour être
//    retirée ou changée dans le texte lui-même — le texte reste la seule vérité).
//    Ce qu'il ne comprend pas reste en mots cherchés dans le titre, jamais deviné.
// ⚠️ Les pièges, tranchés une fois (audit-recherche-phrase.cjs) :
//    · « 42 » seul, entre 16 et 52 : une TAILLE, marquée `ambigu` (la capsule propose
//      « C'est un N° ») ; « N°42 », « n42 », « #42 » : un N° ; « taille 42 » : une taille ;
//    · « B230 » (une lettre + chiffres) : un N° (l'archive de la migration 013, §5),
//      jamais une taille ni un mot ;
//    · un nombre hors des tailles (« 550 ») : un N°, sauf un modèle New Balance
//      quand la phrase dit New Balance ;
//    · « moins de 7 jours » est une durée, « moins de 80 » un prix (une durée a
//      toujours son unité) ; « 52 € » un prix exact.
// Le filtrage (`filtrerPhrase`) : chaque écran donne ses ACCESSEURS ; un filtre sans
// accesseur « ne s'applique pas ici » (dit, jamais ignoré en silence) ; une valeur
// pas lue (`null`) écarte la ligne et se COMPTE (« 3 écartées : taille pas lue ») —
// « pas su » ne vaut pas « oui » (§5).
// Rapide : < 50 ms sur 2 000 paires (le titre normalisé est mémorisé par objet).
// Module PUR (aucun React, aucune horloge cachée : `maintenant` est passé) — exécuté
// tel quel par scripts/audit-recherche-phrase.cjs.

const str = (v) => String(v == null ? '' : v);
const COMBINANT = /[̀-ͯ]/g;

// Une normalisation qui garde la LONGUEUR (un signe pour un signe) : les positions
// trouvées dans le texte normalisé sont celles du texte tapé.
export function normaliserPhrase(s) {
  let out = '';
  for (const c of str(s)) {
    let d = c.normalize('NFD').replace(COMBINANT, '').toLowerCase();
    if (c === '_' || c === '\u2013' || c === '\u2014') d = c === '_' ? ' ' : '-';
    if (c === '’' || c === '`' || c === '´') d = "'";
    if (c === ' ' || c === ' ' || c === '\t' || c === '\n') d = ' ';
    if (d.length !== 1) d = d ? d[0] : ' ';
    // un caractère hors du plan de base (emoji) occupe deux unités : on garde deux espaces
    out += c.length === 2 ? '  ' : d;
  }
  return out;
}
const compact = (s) => normaliserPhrase(s).replace(/\s+/g, ' ').trim();
// La même chose, sans garder la longueur (plus rapide : pour les titres des 2 000 paires).
const rapide = (s) => str(s).normalize('NFD').replace(COMBINANT, '').toLowerCase();

// ── LE VOCABULAIRE (5 langues, sans accents : la normalisation les retire) ──
const NOMBRES_MOTS = { un: 1, une: 1, one: 1, a: 1, an: 1, uno: 1, una: 1, ein: 1, eine: 1, einem: 1, einer: 1, einen: 1,
  deux: 2, two: 2, dos: 2, due: 2, zwei: 2, trois: 3, three: 3, tres: 3, tre: 3, drei: 3, quatre: 4, four: 4, cuatro: 4, quattro: 4, vier: 4,
  cinq: 5, five: 5, cinco: 5, cinque: 5, funf: 5, six: 6, seis: 6, sei: 6, sechs: 6, dix: 10, ten: 10, diez: 10, dieci: 10, zehn: 10 };
const UNITES = {
  jour: ['jours', 'jour', 'jrs', 'jr', 'j', 'days', 'day', 'd', 'dias', 'dia', 'giorni', 'giorno', 'gg', 'tagen', 'tage', 'tag'],
  semaine: ['semaines', 'semaine', 'sem', 'weeks', 'week', 'wk', 'w', 'semanas', 'semana', 'settimane', 'settimana', 'wochen', 'woche'],
  mois: ['mois', 'months', 'month', 'meses', 'mes', 'mesi', 'mese', 'monaten', 'monate', 'monat'],
  an: ['annees', 'annee', 'ans', 'an', 'years', 'year', 'anos', 'ano', 'anni', 'anno', 'jahren', 'jahre', 'jahr'],
};
export const JOURS_UNITE = { jour: 1, semaine: 7, mois: 30, an: 365 };
// Ce qui précède une durée : « au moins » (≥) ou « moins de » (<).
const AVANT_DUREE_GE = ['depuis plus de', 'depuis au moins', 'en ligne depuis', 'depuis', 'ca fait', "il y a plus d'", 'il y a plus de', 'il y a', 'plus de', 'au moins',
  'since more than', 'for more than', 'for over', 'for at least', 'since', 'for', 'more than', 'over', 'at least', 'longer than', 'online for',
  'desde hace mas de', 'desde hace', 'desde', 'hace mas de', 'hace', 'mas de', 'al menos',
  'da piu di', 'da oltre', 'da almeno', 'da', 'piu di', 'oltre', 'almeno',
  'seit uber', 'seit mehr als', 'seit mindestens', 'seit', 'uber', 'mehr als', 'mindestens', 'vor'];
const AVANT_DUREE_LT = ['depuis moins de', 'il y a moins de', 'moins de', 'less than', 'under', 'within', 'hace menos de', 'menos de', 'da meno di', 'meno di', 'seit weniger als', 'weniger als', 'unter'];

const AVANT_PRIX_MAX = ['<=', '<', '≤', 'moins cher que', 'moins de', 'sous', "jusqu'a", 'max', 'maximum', 'under', 'less than', 'below', 'cheaper than', 'up to',
  'menos de', 'hasta', 'por debajo de', 'meno di', 'fino a', 'sotto', 'unter', 'weniger als', 'bis', 'hochstens', 'maximal'];
const AVANT_PRIX_MIN = ['>=', '>', '≥', 'plus cher que', 'plus de', 'au dessus de', 'au moins', 'min', 'minimum', 'over', 'more than', 'above', 'at least',
  'mas de', 'por encima de', 'al menos', 'piu di', 'sopra', 'almeno', 'uber', 'mehr als', 'mindestens', 'ab'];
const DEVISE = '(?:€|eur|euros|euro)';

// Les états. L'ordre compte : « pas vendue » avant « vendue ».
const ETATS = [
  ['en-ligne', ['pas encore vendues', 'pas encore vendue', 'pas encore vendus', 'pas encore vendu', 'pas vendues', 'pas vendue', 'pas vendus', 'pas vendu', 'non vendues', 'non vendue', 'non vendus', 'non vendu', 'invendues', 'invendue', 'invendus', 'invendu',
    'not sold yet', 'not yet sold', 'not sold', 'unsold', 'still for sale', 'no vendidas', 'no vendida', 'no vendidos', 'no vendido', 'sin vender', 'aun sin vender',
    'non vendute', 'non venduta', 'non venduti', 'non venduto', 'invendute', 'invenduta', 'invenduti', 'invenduto', 'nicht verkauft', 'noch nicht verkauft', 'unverkaufte', 'unverkauft',
    'en ligne', 'online', 'en linea', 'in linea', 'en vente', 'for sale', 'en venta', 'in vendita', 'zu verkaufen']],
  ['vendue', ['vendues', 'vendue', 'vendus', 'vendu', 'sold', 'vendidas', 'vendida', 'vendidos', 'vendido', 'vendute', 'venduta', 'venduti', 'venduto', 'verkaufte', 'verkauft']],
  ['a-retirer', ['a retirer', 'to pick up', 'to collect', 'pick up', 'pickup', 'a recoger', 'por recoger', 'para recoger', 'da ritirare', 'zum abholen', 'abzuholen', 'abholen']],
  ['a-expedier', ['a expedier', 'a envoyer', 'a poster', 'to ship', 'to send', 'to post', 'por enviar', 'para enviar', 'a enviar', 'da spedire', 'da inviare', 'zu versenden', 'versenden', 'verschicken']],
  ['brouillon', ['brouillons', 'brouillon', 'drafts', 'draft', 'borradores', 'borrador', 'bozze', 'bozza', 'entwurfe', 'entwurf']],
  ['masquee', ['masquees', 'masquee', 'masques', 'masque', 'hidden', 'ocultas', 'oculta', 'ocultos', 'oculto', 'nascoste', 'nascosta', 'nascosti', 'nascosto', 'versteckte', 'versteckt', 'ausgeblendet']],
];
export const ETATS_PHRASE = ETATS.map((e) => e[0]);
// Les états qui disent un COLIS (l'écran des annonces les dit « pas ici »).
export const ETATS_COLIS = ['a-retirer', 'a-expedier'];

const QUOI = [
  ['colis', ['colis', 'parcels', 'parcel', 'packages', 'package', 'paquetes', 'paquete', 'pacchi', 'pacco', 'pakete', 'paket', 'sendungen', 'sendung']],
  ['vente', ['ventes', 'vente', 'sales', 'sale', 'ventas', 'venta', 'vendite', 'vendita', 'verkaufe', 'verkauf']],
  ['achat', ['achats', 'achat', 'purchases', 'purchase', 'bought', 'compras', 'compra', 'acquisti', 'acquisto', 'einkaufe', 'einkauf', 'kaufe', 'kauf']],
  ['annonce', ['annonces', 'annonce', 'listings', 'listing', 'anuncios', 'anuncio', 'annunci', 'annuncio', 'anzeigen', 'anzeige', 'inserate', 'inserat']],
];
export const QUOI_PHRASE = QUOI.map((q) => q[0]);

// Les transporteurs : la clé est celle de l'app (`carrierKey`, api/_lib/retrait-colis.js).
export const TRANSPORTEURS = [
  ['mondialrelay', 'Mondial Relay', ['mondial relay', 'mondialrelay', 'mondial']],
  ['relaiscolis', 'Relais Colis', ['relais colis', 'relaiscolis']],
  ['colisprive', 'Colis Privé', ['colis prive']],
  ['colissimo', 'Colissimo', ['colissimo']],
  ['chronopost', 'Chronopost', ['chronopost', 'chrono', 'shop2shop', 'shop 2 shop']],
  ['vinted', 'Vinted Go', ['vinted go', 'vintedgo']],
  ['laposte', 'La Poste', ['la poste', 'laposte']],
  ['ups', 'UPS', ['ups']], ['dhl', 'DHL', ['dhl']], ['dpd', 'DPD', ['dpd']], ['gls', 'GLS', ['gls']],
  ['inpost', 'InPost', ['inpost']], ['correos', 'Correos', ['correos']], ['seur', 'SEUR', ['seur']],
  ['posteitaliane', 'Poste Italiane', ['poste italiane']], ['hermes', 'Hermes', ['hermes']], ['packeta', 'Packeta', ['packeta']],
];
export const NOM_TRANSPORTEUR = Object.fromEntries(TRANSPORTEURS.map(([k, n]) => [k, n]));
// La clé d'un transporteur LU (« Mondial Relay », « mondialrelay », « Chronopost Shop2Shop »).
export function cleTransporteur(v) {
  const s = ' ' + compact(v).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ') + ' ';
  if (!s.trim()) return '';
  for (const [k, , al] of TRANSPORTEURS) if (al.some((a) => s.includes(' ' + a + ' ') || s.replace(/ /g, '').includes(a.replace(/ /g, '')))) return k;
  return s.trim().replace(/ /g, '');
}

// Les marques connues (les marques LUES dans les annonces s'ajoutent : `marques`).
const MARQUES = [
  ['New Balance', ['new balance', 'newbalance', 'nb']], ['Onitsuka Tiger', ['onitsuka tiger', 'onitsuka']], ['Air Jordan', ['air jordan']],
  ['Nike', ['nike']], ['Jordan', ['jordan']], ['Adidas', ['adidas']], ['Asics', ['asics']], ['Salomon', ['salomon']], ['Puma', ['puma']], ['Vans', ['vans']],
  ['Converse', ['converse']], ['Reebok', ['reebok']], ['Veja', ['veja']], ['Hoka', ['hoka one one', 'hoka']], ['Saucony', ['saucony']], ['Mizuno', ['mizuno']],
  ['Timberland', ['timberland']], ['Dr. Martens', ['dr martens', 'dr. martens', 'doc martens']], ['Birkenstock', ['birkenstock']], ['UGG', ['ugg']], ['Crocs', ['crocs']],
  ['Autry', ['autry']], ['Golden Goose', ['golden goose']], ['Balenciaga', ['balenciaga']], ['Gucci', ['gucci']], ['Lacoste', ['lacoste']], ['Le Coq Sportif', ['le coq sportif']],
  ['K-Swiss', ['k swiss', 'kswiss']], ['Fila', ['fila']], ['Diadora', ['diadora']], ['Merrell', ['merrell']], ['Karhu', ['karhu']], ['Clarks', ['clarks']], ['Camper', ['camper']],
  ['Axel Arigato', ['axel arigato']], ['Common Projects', ['common projects']], ['Off-White', ['off white', 'offwhite']], ['Yeezy', ['yeezy']], ['Palladium', ['palladium']],
  ['Superga', ['superga']], ['Brooks', ['brooks']], ['Under Armour', ['under armour']], ['Skechers', ['skechers']], ['Ellesse', ['ellesse']], ['Kappa', ['kappa']], ['Diesel', ['diesel']],
];
// Les modèles : `nb` ⇒ un modèle New Balance écrit en chiffres, compris seulement si la phrase dit New Balance.
const MODELES = [
  ['Air Max 90', ['air max 90', 'am90']], ['Air Max 1', ['air max 1', 'am1']], ['Air Max 95', ['air max 95']], ['Air Max 97', ['air max 97']], ['Air Max Plus', ['air max plus', 'tn']],
  ['Air Force 1', ['air force 1', 'af1']], ['Dunk Low', ['dunk low']], ['Dunk High', ['dunk high']], ['Dunk', ['dunk']], ['Air Max', ['air max']],
  ['Jordan 1', ['jordan 1', 'aj1']], ['Jordan 3', ['jordan 3', 'aj3']], ['Jordan 4', ['jordan 4', 'aj4']], ['Jordan 11', ['jordan 11', 'aj11']],
  ['Blazer', ['blazer']], ['Cortez', ['cortez']], ['Vomero', ['vomero']], ['Pegasus', ['pegasus']], ['P-6000', ['p 6000', 'p6000']],
  ['Samba', ['samba']], ['Gazelle', ['gazelle']], ['Campus', ['campus']], ['Spezial', ['spezial']], ['Superstar', ['superstar']], ['Stan Smith', ['stan smith']],
  ['Forum', ['forum']], ['Ultraboost', ['ultraboost', 'ultra boost']], ['NMD', ['nmd']], ['Yeezy 350', ['yeezy 350', 'yeezy boost 350']],
  ['550', ['550'], 'nb'], ['9060', ['9060'], 'nb'], ['2002R', ['2002r', '2002'], 'nb'], ['1906R', ['1906r', '1906'], 'nb'], ['530', ['530'], 'nb'], ['327', ['327'], 'nb'], ['574', ['574'], 'nb'], ['990', ['990'], 'nb'], ['991', ['991'], 'nb'], ['992', ['992'], 'nb'], ['993', ['993'], 'nb'], ['1500', ['1500'], 'nb'],
  ['XT-6', ['xt 6', 'xt6']], ['XT-4', ['xt 4', 'xt4']], ['Speedcat', ['speedcat']], ['Palermo', ['palermo']], ['Suede', ['suede']], ['Old Skool', ['old skool']], ['Sk8-Hi', ['sk8 hi', 'sk8hi']],
  ['Chuck 70', ['chuck 70']], ['Chuck Taylor', ['chuck taylor']], ['All Star', ['all star']], ['Gel-Kayano 14', ['gel kayano 14', 'kayano 14']], ['Gel-1130', ['gel 1130']], ['Gel-NYC', ['gel nyc']],
  ['Mexico 66', ['mexico 66']], ['Club C', ['club c']], ['Classic Leather', ['classic leather']], ['Campo', ['campo']], ['V-10', ['v 10', 'v10']], ['Esplar', ['esplar']],
];
const JOURS_REL = [
  ['apres-demain', 2, ['apres demain', 'day after tomorrow', 'pasado manana', 'dopodomani', 'ubermorgen']],
  ['avant-hier', -2, ['avant hier', 'day before yesterday', 'anteayer', "l'altro ieri", 'altroieri', 'vorgestern']],
  ['aujourdhui', 0, ["aujourd'hui", 'aujourdhui', 'auj', 'today', 'hoy', 'oggi', 'heute']],
  ['demain', 1, ['demain', 'tomorrow', 'manana', 'domani', 'morgen']],
  ['hier', -1, ['hier', 'yesterday', 'ayer', 'ieri', 'gestern']],
];
const SEMAINE = [
  ['lundi', 'monday', 'lunes', 'lunedi', 'montag'], ['mardi', 'tuesday', 'martes', 'martedi', 'dienstag'], ['mercredi', 'wednesday', 'miercoles', 'mercoledi', 'mittwoch'],
  ['jeudi', 'thursday', 'jueves', 'giovedi', 'donnerstag'], ['vendredi', 'friday', 'viernes', 'venerdi', 'freitag'], ['samedi', 'saturday', 'sabado', 'sabato', 'samstag'],
  ['dimanche', 'sunday', 'domingo', 'domenica', 'sonntag'],
];
const AVANT_JOUR = ["d'ici", 'avant', 'pour', 'by', 'before', 'until', 'antes del', 'antes de', 'para el', 'para', 'entro', 'prima di', 'bis', 'vor'];
const AVANT_TAILLE = ['tailles', 'taille', 'pointure', 'size', 'sz', 'talla', 'taglia', 'misura', 'groesse', 'grosse', 'große', 'gr', 'eu', 't'];
const AVANT_NUMERO = ['n°', 'nº', 'no.', 'no', 'num.', 'num', 'numero', 'nr.', 'nr', 'nummer', 'number', '#', 'n'];
const VIDES = new Set(('le la les l de du des d un une et ou au aux en pour avec sans sur dans qui que mes mon ma tes ton ta ses son sa paire paires chaussure chaussures basket baskets sneaker sneakers article articles moi j je ' +
  'the of and or with without my in on pair pairs shoe shoes item items that me i show find ' +
  'el los las del y o con sin mi mis par pares zapatilla zapatillas zapato zapatos ' +
  'il lo gli di della e con senza per mio mia miei paio paia scarpa scarpe ' +
  'der die das den dem des ein und oder mit ohne fur mein meine paar schuh schuhe a y e pas non not').split(/\s+/));

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '[\\s-]+');
const alt = (l) => [...l].sort((a, b) => b.length - a.length).map(esc).join('|');
const B0 = "(?<=^|[\\s,;.!?(\\-])", B1 = "(?=$|[\\s,;.!?)\\-])";
const NOMBRE = '(\\d{1,6}(?:[.,]\\d{1,2})?)';
const _reMots = new Map();
const reMot = (a) => { let r = _reMots.get(a); if (!r) { r = new RegExp(`${B0}${esc(a)}${B1}`, 'g'); _reMots.set(a, r); } return r; };
const _vocabs = new Map();
function vocabulaire(paires, nom) {
  if (nom && _vocabs.has(nom)) return _vocabs.get(nom);
  const parAlias = new Map(); const tous = [];
  for (const [cle, al, ...rest] of paires) for (const a of al) { if (!parAlias.has(a)) parAlias.set(a, [cle, rest]); tous.push(a); }
  const v = { re: new RegExp(`${B0}(?:${alt(tous)})${B1}`, 'g'), parAlias };
  if (nom) _vocabs.set(nom, v);
  return v;
}
const nombreDe = (s) => { const t = str(s).trim(); if (/^\d/.test(t)) return Number(t.replace(',', '.')); return NOMBRES_MOTS[t] != null ? NOMBRES_MOTS[t] : null; };
const uniteDe = (u) => { for (const [k, l] of Object.entries(UNITES)) if (l.includes(u)) return k; return null; };

const RE = (() => {
  const unites = alt(Object.values(UNITES).flat());
  const motsNb = alt(Object.keys(NOMBRES_MOTS));
  return {
    duree: new RegExp(`${B0}(?:(${alt(AVANT_DUREE_LT)})\\s+|(${alt(AVANT_DUREE_GE)})\\s+)?(\\d{1,4}|${motsNb})\\s*(${unites})${B1}`, 'g'),
    prixEntre: new RegExp(`${B0}(?:entre|between|from|de|tra|fra|zwischen|von)\\s+${NOMBRE}\\s*${DEVISE}?\\s+(?:et|and|to|a|y|e|und|bis)\\s+${NOMBRE}\\s*${DEVISE}${B1}`, 'g'),
    prixTiret: new RegExp(`${B0}${NOMBRE}\\s*${DEVISE}?\\s*(?:-|\\s(?:a|to|bis|al)\\s)\\s*${NOMBRE}\\s*${DEVISE}${B1}`, 'g'),
    prixMax: new RegExp(`(?:${B0}(?:${alt(AVANT_PRIX_MAX.filter((x) => /^[a-z]/.test(x)))})\\s*|(?:${alt(AVANT_PRIX_MAX.filter((x) => !/^[a-z]/.test(x)))})\\s*)${NOMBRE}\\s*(?:${DEVISE})?${B1}`, 'g'),
    prixMin: new RegExp(`(?:${B0}(?:${alt(AVANT_PRIX_MIN.filter((x) => /^[a-z]/.test(x)))})\\s*|(?:${alt(AVANT_PRIX_MIN.filter((x) => !/^[a-z]/.test(x)))})\\s*)${NOMBRE}\\s*(?:${DEVISE})?${B1}`, 'g'),
    prixMot: new RegExp(`${B0}(?:prix|price|precio|prezzo|preis)\\s*:?\\s*${NOMBRE}\\s*(?:${DEVISE})?${B1}`, 'g'),
    prixExact: new RegExp(`(?:${B0}${NOMBRE}\\s*${DEVISE}${B1}|€\\s*${NOMBRE}${B1})`, 'g'),
    taille: new RegExp(`${B0}(?:${alt(AVANT_TAILLE)})\\s?\\.?\\s?(\\d{2}(?:[.,]5)?(?:\\s?[12]\\/3|\\s?1\\/2)?)${B1}`, 'g'),
    numero: new RegExp(`${B0}(?:${alt(AVANT_NUMERO)})\\s?\\.?\\s?([a-z]?\\d{1,6})${B1}`, 'g'),
    numeroLettre: new RegExp(`${B0}([a-z]\\d{1,6})${B1}`, 'g'),
    nombre: new RegExp(`${B0}(\\d{1,6}(?:[.,]5)?)${B1}`, 'g'),
  };
})();

// La date du jour à Paris (« 2026-11-14 ») et ses voisines — sans horloge cachée.
export function jourParis(ms) {
  // L'heure de Paris sans Intl (rapide, la même partout) : UTC+1, UTC+2 du dernier dimanche de mars
  // (1 h UTC) au dernier dimanche d'octobre (1 h UTC) — la règle européenne.
  const d = new Date(ms); const y = d.getUTCFullYear();
  const dernierDimanche = (m) => { const x = new Date(Date.UTC(y, m + 1, 0, 1)); x.setUTCDate(x.getUTCDate() - x.getUTCDay()); return x.getTime(); };
  const ete = ms >= dernierDimanche(2) && ms < dernierDimanche(9);
  return new Date(ms + (ete ? 2 : 1) * 3600000).toISOString().slice(0, 10);
}
export function decalerJour(jour, n) {
  const [y, m, d] = String(jour).split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}
const jourSemaine = (jour) => { const [y, m, d] = jour.split('-').map(Number); return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7; };   // 0 = lundi

// ══ ANALYSER : la phrase ⇒ des filtres (avec la place de leurs mots) ══
// `marques` : les marques LUES dans les annonces de l'écran (s'ajoutent aux connues).
// Rend { q, filtres: [...], mots: [...], structure: bool, vide: bool }.
export function analyserPhrase(q, { maintenant = Date.now(), marques = [] } = {}) {
  const brut = str(q);
  let s = normaliserPhrase(brut);
  const filtres = [];
  const prendre = (de, a) => { s = s.slice(0, de) + ' '.repeat(a - de) + s.slice(a); };
  const poser = (f, de, a) => { filtres.push({ ...f, de, a, src: brut.slice(de, a) }); prendre(de, a); };
  const chaque = (re, fn) => { re.lastIndex = 0; const trouves = []; let m; while ((m = re.exec(s))) { trouves.push(m); if (m[0] === '') re.lastIndex++; } for (const x of trouves) fn(x, x.index, x.index + x[0].length); };
  // UNE expression par vocabulaire (les alias du plus long au plus court : à une même place, le plus long gagne).
  const listeMots = (paires, fn, nom = null) => {
    const v = vocabulaire(paires, nom);
    chaque(v.re, (m, de, fin) => { const e = v.parAlias.get(m[0].replace(/[\s-]+/g, ' ')); if (e) fn(e[0], de, fin, e[1], m[0]); });
  };
  if (!s.trim()) return { q: brut, filtres: [], mots: [], structure: false, vide: true };

  // 1. Les durées (« depuis 2 mois », « for 3 weeks », « seit 10 Tagen », « moins de 7 jours »).
  chaque(RE.duree, (m, de, a) => {
    const n = nombreDe(m[3]); const u = uniteDe(m[4]); if (n == null || !u) return;
    // « a/an/una… » sans préposition n'est pas un nombre (« a month » oui, « pour un jour » oui ; « une semaine » oui)
    poser({ k: 'depuis', op: m[1] ? '<' : '>=', n, unite: u, jours: n * JOURS_UNITE[u] }, de, a);
  });
  // 1 bis. Les modèles écrits en lettres (« air max 90 » n'est pas « max 90 € ») ; ceux en chiffres seuls
  //        (New Balance « 550 ») attendent les prix (« 550 € » est un prix).
  const ditNb = /(?:^|[\s-])(?:new balance|newbalance|nb)(?=[\s-]|$)/.test(s);
  const modele = (k, de, a) => poser({ k: 'modele', v: k, cles: (MODELES.find((x) => x[0] === k) || [, []])[1] }, de, a);
  listeMots(MODELES.filter((x) => x[2] !== 'nb'), modele, 'modeles');
  // 2. Les prix (avant les tailles : « 42 € » est un prix).
  chaque(RE.prixEntre, (m, de, a) => { const x = Number(m[1].replace(',', '.')), y = Number(m[2].replace(',', '.')); poser({ k: 'prix', min: Math.min(x, y), max: Math.max(x, y) }, de, a); });
  chaque(RE.prixTiret, (m, de, a) => { const x = Number(m[1].replace(',', '.')), y = Number(m[2].replace(',', '.')); poser({ k: 'prix', min: Math.min(x, y), max: Math.max(x, y) }, de, a); });
  chaque(RE.prixMax, (m, de, a) => poser({ k: 'prix', max: Number(m[1].replace(',', '.')), strict: /</.test(m[0]) && !/<=/.test(m[0]) }, de, a));
  chaque(RE.prixMin, (m, de, a) => poser({ k: 'prix', min: Number(m[1].replace(',', '.')), strict: />/.test(m[0]) && !/>=/.test(m[0]) }, de, a));
  chaque(RE.prixMot, (m, de, a) => { const v = Number(m[1].replace(',', '.')); poser({ k: 'prix', min: v, max: v }, de, a); });
  chaque(RE.prixExact, (m, de, a) => { const v = Number(String(m[1] || m[2]).replace(',', '.')); poser({ k: 'prix', min: v, max: v }, de, a); });
  // 3. Les transporteurs (avant « colis » : « colis privé »).
  listeMots(TRANSPORTEURS.map(([k, , al]) => [k, al]), (k, de, a) => poser({ k: 'transporteur', v: k }, de, a), 'transporteurs');
  // 4. Les états (avant les jours et les mots : « à retirer », « pas vendue »).
  listeMots(ETATS, (k, de, a) => { poser({ k: 'etat', v: k }, de, a); }, 'etats');
  // 5. Les jours (« demain », « lundi », « avant demain »).
  const auj = jourParis(maintenant);
  const reAvant = `(?:(${alt(AVANT_JOUR)})\\s+)?`;
  for (const [cle, d, al] of JOURS_REL) chaque(new RegExp(`${B0}${reAvant}(${alt(al)})${B1}`, 'g'), (m, de, a) => {
    const j = decalerJour(auj, d); poser({ k: 'jour', rel: cle, de_: m[1] ? null : j, jusqua: j, avant: !!m[1] }, de, a);
  });
  SEMAINE.forEach((al, i) => chaque(new RegExp(`${B0}${reAvant}(${alt(al)})${B1}`, 'g'), (m, de, a) => {
    const ecart = (i - jourSemaine(auj) + 7) % 7; const j = decalerJour(auj, ecart);
    poser({ k: 'jour', rel: 'semaine', jourSemaine: i, de_: m[1] ? null : j, jusqua: j, avant: !!m[1] }, de, a);
  }));
  // 6. Ce qu'on cherche (« colis », « ventes »…).
  listeMots(QUOI, (k, de, a) => poser({ k: 'quoi', v: k }, de, a), 'quoi');
  // 7. Les modèles New Balance en chiffres, seulement si la phrase dit New Balance.
  listeMots(MODELES.filter((x) => x[2] === 'nb'), (k, de, a, rest) => { if (rest[0] === 'nb' && !ditNb) return; modele(k, de, a); }, 'modeles-nb');
  // 8. Les marques (connues, puis LUES dans ses annonces).
  const lues = [];
  for (const mq of marques || []) { const c = compact(mq); if (c.length >= 3 && !VIDES.has(c) && !MARQUES.some(([, al]) => al.includes(c))) lues.push([str(mq).trim(), [c]]); }
  const toutes = [...MARQUES, ...lues];
  listeMots(toutes, (k, de, a) => poser({ k: 'marque', v: k, cles: (toutes.find((x) => x[0] === k) || [, []])[1] }, de, a), 'marques|' + lues.map((x) => x[1][0]).join('|'));
  // 9. Les tailles écrites (« taille 42 », « t42 », « EU 42,5 »), puis les N° écrits (« N°42 », « #42 », « B230 »).
  chaque(RE.taille, (m, de, a) => { const v = tailleNombre(m[1]); if (v == null || v < 16 || v > 52) return; poser({ k: 'taille', v, ambigu: false }, de, a); });
  chaque(RE.numero, (m, de, a) => poser({ k: 'numero', v: cleNumeroPhrase(m[1]) }, de, a));
  chaque(RE.numeroLettre, (m, de, a) => poser({ k: 'numero', v: cleNumeroPhrase(m[1]) }, de, a));
  // 10. Les nombres seuls : une taille (16–52, `ambigu`) ou un N°.
  chaque(RE.nombre, (m, de, a) => {
    const v = Number(m[1].replace(',', '.'));
    if (v >= 16 && v <= 52) poser({ k: 'taille', v, ambigu: Number.isInteger(v) }, de, a);
    else if (Number.isInteger(v) && v >= 1) poser({ k: 'numero', v: String(v), ambigu: false }, de, a);
  });
  // 11. Les mots qui restent : cherchés dans le titre (jamais devinés).
  const mots = [];
  { const re = /[^\s,;.!?()'"«»]+/g; let m; while ((m = re.exec(s))) { const w = m[0]; if (w.length < 2 || VIDES.has(w) || /^[<>≤≥=€]+$/.test(w)) continue; mots.push({ v: w, de: m.index, a: m.index + w.length, src: brut.slice(m.index, m.index + w.length) }); } }
  if (mots.length) filtres.push({ k: 'mots', v: mots.map((x) => x.v), morceaux: mots, de: mots[0].de, a: mots[mots.length - 1].a, src: mots.map((x) => x.src).join(' ') });
  filtres.sort((x, y) => x.de - y.de);
  filtres.forEach((f, i) => { f.id = `${f.k}:${i}:${f.de}`; });
  const structure = filtres.some((f) => f.k !== 'mots');
  return { q: brut, filtres, mots: mots.map((x) => x.v), structure, vide: false };
}
export function tailleNombre(v) {
  const t = str(v).trim().replace(',', '.');
  const m = /^(\d{2}(?:\.5)?)(?:\s?([12])\/3|\s?(1)\/2)?$/.exec(t);
  if (!m) { const x = /(\d{2}(?:[.,]5)?)/.exec(t); return x ? Number(x[1].replace(',', '.')) : null; }
  let n = Number(m[1]); if (m[2]) n += Number(m[2]) / 3; if (m[3]) n += 0.5;
  return Math.round(n * 100) / 100;
}
// La clé d'un N° (la même règle que `cleNum` : majuscules, « 007 » = « 7 »).
export function cleNumeroPhrase(v) { let s = str(v).trim().toUpperCase().replace(/[\s\-_.]/g, ''); if (/^\d+$/.test(s)) s = String(parseInt(s, 10)); else { const m = /^([A-Z]+)0*(\d+)$/.exec(s); if (m) s = m[1] + m[2]; } return s; }

// Une phrase est « en phrase » quand elle porte AU MOINS un filtre qui n'est pas un
// simple N° ou un mot : « 128 » reste la recherche par N° (« Tout sur le N° »).
export function estPhrase(a) {
  if (!a || !a.filtres || !a.filtres.length) return false;
  const nonMots = a.filtres.filter((f) => f.k !== 'mots');
  if (!nonMots.length) return false;
  if (a.filtres.length === 1 && nonMots[0].k === 'numero') return false;
  if (a.filtres.length === 1 && nonMots[0].k === 'taille' && nonMots[0].ambigu) return false;   // « 42 » seul : la recherche par N° d'avant
  if (a.filtres.length === 1 && nonMots[0].k === 'prix' && nonMots[0].min === nonMots[0].max) return false;   // « 52 € » : le montant de la loupe
  return true;
}

// ══ RÉÉCRIRE : retirer ou changer UN filtre dans le texte (ses mots, à leur place) ══
export function retirerFiltre(q, f) {
  if (!f) return str(q);
  if (f.k === 'mots' && Array.isArray(f.morceaux)) { let t = str(q); for (const m of [...f.morceaux].sort((x, y) => y.de - x.de)) t = t.slice(0, m.de) + t.slice(m.a); return t.replace(/\s{2,}/g, ' ').trim(); }
  return (str(q).slice(0, f.de) + str(q).slice(f.a)).replace(/\s{2,}/g, ' ').trim();
}
export function remplacerFiltre(q, f, texte) {
  if (!f) return str(q);
  const t = str(q); return (t.slice(0, f.de) + str(texte) + t.slice(f.a)).replace(/\s{2,}/g, ' ').trim();
}

// ══ FILTRER : chaque écran donne ses accesseurs ══
// `acces` : { titre(it), marque(it), taille(it), numero(it), prix(it), etat(it), age(it), jour(it), transporteur(it) }
//   chacun rend la valeur LUE, `null` si pas lue ; un accesseur absent ⇒ le filtre « ne s'applique pas ici ».
// `quoi` : ce que l'écran liste ('annonce', 'vente', 'colis'…) ; `etats` : les états qui ont un sens ici.
// Rend { liste, ignores: [ids], pasSu: { [id]: n }, n }.
// Ce qu'une ligne porte, normalisé UNE fois par objet (une frappe de plus ne refait rien).
const _cache = new WeakMap();
const fiche = (it, acces) => {
  let c = it && typeof it === 'object' ? _cache.get(it) : undefined;
  if (c === undefined) { c = {}; if (it && typeof it === 'object') _cache.set(it, c); }
  return c;
};
const titreNorm = (it, acces) => {
  const c = fiche(it, acces);
  if (c.t === undefined) c.t = ' ' + rapide([acces.titre ? acces.titre(it) : '', acces.marque ? acces.marque(it) : ''].join(' ')).replace(/[^a-z0-9ß]+/g, ' ').trim() + ' ';
  return c.t;
};
const marqueNorm = (it, acces) => {
  const c = fiche(it, acces);
  if (c.m === undefined) { const m = acces.marque ? acces.marque(it) : null; c.m = m == null || !str(m).trim() ? null : rapide(m).replace(/[^a-z0-9ß]+/g, ' ').trim(); }
  return c.m;
};
export function filtreApplicable(f, { acces = {}, quoi = null, etats = null } = {}) {
  switch (f.k) {
    case 'mots': case 'modele': return !!acces.titre;
    case 'marque': return !!(acces.marque || acces.titre);
    case 'taille': return !!acces.taille;
    case 'numero': return !!acces.numero;
    case 'prix': return !!acces.prix;
    case 'etat': return !!acces.etat && (!etats || etats.includes(f.v));
    case 'depuis': return !!acces.age;
    case 'jour': return !!acces.jour;
    case 'transporteur': return !!acces.transporteur;
    case 'quoi': return !quoi || f.v === quoi || (Array.isArray(quoi) && quoi.includes(f.v));
    default: return false;
  }
}
export function filtrerPhrase(items, filtres, { acces = {}, quoi = null, etats = null } = {}) {
  const liste = Array.isArray(items) ? items : [];
  const actifs = []; const ignores = [];
  for (const f of filtres || []) { if (filtreApplicable(f, { acces, quoi, etats })) { if (f.k !== 'quoi') actifs.push(f); } else ignores.push(f.id); }
  const pasSu = {};
  const garde = [];
  const tient = (f, it) => {
    switch (f.k) {
      case 'mots': { const t = titreNorm(it, acces); return f.v.every((w) => t.includes(' ' + w) || t.includes(w)); }
      case 'modele': { const t = titreNorm(it, acces); return (f.cles || [compact(f.v)]).some((c) => t.includes(' ' + c + ' ')); }
      case 'marque': {
        const mc = marqueNorm(it, acces);
        const cles = f.cles || [compact(f.v)];
        if (mc != null && cles.some((c) => mc === c || (' ' + mc + ' ').includes(' ' + c + ' '))) return true;
        const t = titreNorm(it, acces); if (cles.some((c) => t.includes(' ' + c + ' '))) return true;
        return mc == null && !t.trim() ? null : false;
      }
      case 'taille': { const v = acces.taille(it); if (v == null || str(v).trim() === '') return null; const n = tailleNombre(v); if (n == null) return null; return Math.abs(n - f.v) < 0.01; }
      case 'numero': { const v = acces.numero(it); if (v == null || str(v).trim() === '') return false; return cleNumeroPhrase(v) === f.v; }
      case 'prix': { const v = acces.prix(it); if (v == null || !Number.isFinite(Number(v))) return null; const p = Number(v);
        if (f.min != null && (f.strict ? !(p > f.min) : !(p >= f.min - 1e-9))) return false;
        if (f.max != null && (f.strict ? !(p < f.max) : !(p <= f.max + 1e-9))) return false; return true; }
      case 'etat': { const v = acces.etat(it); if (v == null) return null; return Array.isArray(v) ? v.includes(f.v) : v === f.v; }
      case 'depuis': { const v = acces.age(it); if (v == null || !Number.isFinite(Number(v))) return null; return f.op === '<' ? Number(v) < f.jours : Number(v) >= f.jours; }
      case 'jour': { const v = acces.jour(it); if (!v) return null; const j = str(v).slice(0, 10); return f.avant ? j <= f.jusqua : j === f.jusqua; }
      case 'transporteur': { const v = acces.transporteur(it); if (v == null || !str(v).trim()) return null; return cleTransporteur(v) === f.v; }
      default: return true;
    }
  };
  for (const it of liste) {
    let ok = true;
    for (const f of actifs) { const r = tient(f, it); if (r === true) continue; ok = false; if (r === null) pasSu[f.id] = (pasSu[f.id] || 0) + 1; break; }
    if (ok) garde.push(it);
  }
  return { liste: garde, ignores, pasSu, n: garde.length, actifs: actifs.map((f) => f.id) };
}

// Le filtre « quoi » qui désigne un AUTRE endroit (« colis » dans Annonces) : l'écran
// propose d'y chercher (la loupe), il ne devine rien.
export function ailleurs(a, { quoi = null, etats = null } = {}) {
  if (!a || !a.filtres) return null;
  const q = a.filtres.find((f) => f.k === 'quoi' && quoi && f.v !== quoi && !(Array.isArray(quoi) && quoi.includes(f.v)));
  if (q) return q.v;
  if (a.filtres.some((f) => f.k === 'transporteur' || (f.k === 'etat' && ETATS_COLIS.includes(f.v) && (!etats || !etats.includes(f.v))))) return 'colis';
  if (a.filtres.some((f) => f.k === 'etat' && f.v === 'vendue' && etats && !etats.includes('vendue'))) return 'vente';
  return null;
}
