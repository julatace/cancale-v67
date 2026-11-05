// api/_lib/notif-textes.js
// ────────────────────────────────────────────────────────────────────────────
// (3 nov.) LES NOTIFICATIONS : FAMILLES ET TEXTES — une règle, partagée par
// toutes les routes qui sonnent et par l'écran Paramètres → Notifications.
//
// Julien (3 nov.) : « il y en a qui servent absolument à rien et qui ne sont
// vraiment pas cohérentes ; elles disent "arrivé au point relais" alors que le
// message disait qu'il VA arriver ». L'inventaire et les mesures sont dans
// docs/passation/notifications.md.
//
// 1. SIX FAMILLES, un interrupteur chacune (ligne `push_prefs`, côté serveur :
//    `familles: { ventes: true, … }`). Chaque notification appartient à UNE
//    famille ; famille coupée ⇒ rien n'est envoyé.
// 2. TROIS CATÉGORIES RETIRÉES (plus jamais envoyées, quel que soit l'ancien
//    réglage) : `suivi` (en transit, en route, retiré par lui-même), `achat`
//    (« achat confirmé » : il vient de l'acheter), `favori` (un favori de plus).
//    Mesuré sur 14 jours : 60 « Achat confirmé », ~30 favoris (6 en 15 s le
//    2 nov. à 22 h 55), « en transit » pour chaque « Ton colis arrive
//    aujourd'hui ». Aucune n'appelle un geste ; l'app les montre.
// 3. LE TEXTE D'UNE ARRIVÉE — « 📍 <article> t'attend » · « <point>, <ville> ·
//    code X · jusqu'au JJ/MM » — le même quelle que soit la voie (e-mail du
//    transporteur, e-mail Vinted, conversation, lecture chez le transporteur,
//    suivi Vinted). Jamais « arrivé » sur une annonce : seules les phrases qui
//    CONSTATENT (api/_lib/etat-colis-email.js, `arriveeConstatee`) y mènent.
// Pur : aucune lecture, aucune écriture.
// ────────────────────────────────────────────────────────────────────────────

export const FAMILLES = [
  { id: 'ventes', titre: 'Ventes', def: true },
  { id: 'offres', titre: 'Offres', def: true },
  { id: 'messages', titre: 'Messages', def: true },
  { id: 'poster', titre: 'Colis à poster', def: true },
  { id: 'arrives', titre: 'Codes de retrait', def: true },
  { id: 'doublevente', titre: 'Double vente', def: true },
  { id: 'rappels', titre: 'Rappels', def: true },
];

// Catégorie (le mot que chaque route passe à `pushCategorieActive` et à
// `sendPushToAll({ cat })`) → famille.
// (5 nov., Julien : « personnalisable comme on veut ») SEPT types au lieu de six :
// la double vente a le sien (elle était dans Ventes) et « Compta » devient
// « Rappels » (URSSAF, bilan de la semaine, la veille au soir, l'agent eBay, les
// factures). `test` n'appartient à aucune famille : l'essai sonne toujours.
export const FAMILLE_DE = {
  vente: 'ventes', argent: 'ventes',
  doublevente: 'doublevente',
  expedier: 'poster',
  colis: 'arrives',
  offre: 'offres', offremini: 'offres',
  message: 'messages', action: 'messages', favoris: 'messages',
  soir: 'rappels', urssaf: 'rappels', bilan: 'rappels', facture: 'rappels', agentebay: 'rappels',
};
// Un type NEUF hérite du réglage de la famille d'où il sort tant qu'il n'est pas
// posé lui-même : il avait coupé « Ventes », la double vente reste coupée ; il
// avait coupé « Compta », les rappels restent coupés. Une catégorie qui a changé
// de famille (la veille au soir était dans « Colis à poster », l'agent eBay dans
// « Ventes ») garde l'ancien réglage de sa famille d'avant. Une seule règle, ici.
export const HERITE = { doublevente: 'ventes', rappels: 'compta' };
export const HERITE_CAT = { soir: 'poster', agentebay: 'ventes' };
export const CATEGORIES_RETIREES = new Set(['suivi', 'achat', 'favori']);
export const familleDe = (cat) => FAMILLE_DE[cat] || null;
const famillesDe = (p) => (p && p.familles && typeof p.familles === 'object' ? p.familles : {});

// La décision, à partir des préférences LUES. Ordre : catégorie retirée ⇒ non ;
// la famille réglée ⇒ elle décide ; sinon la famille d'avant (héritage) ; sinon
// l'ancien réglage de la catégorie (ce qu'il avait choisi avant les familles) ;
// sinon le défaut de la famille.
export function decisionNotif(prefs, cat) {
  if (!cat || cat === 'test') return true;
  if (CATEGORIES_RETIREES.has(cat)) return false;
  const p = prefs && typeof prefs === 'object' ? prefs : {};
  const fs = famillesDe(p);
  const fam = familleDe(cat);
  if (typeof fs[fam] === 'boolean') return fs[fam];
  const hc = HERITE_CAT[cat];
  if (hc && typeof fs[hc] === 'boolean') return fs[hc];
  const hf = HERITE[fam];
  if (hf && typeof fs[hf] === 'boolean') return fs[hf];
  if (typeof p[cat] === 'boolean') return p[cat];
  const d = FAMILLES.find((x) => x.id === fam);
  return d ? d.def : true;
}
// L'état d'une famille tel que l'écran le montre (même règle que le serveur) :
// réglée ⇒ elle ; sinon allumée si une de ses catégories l'est.
export function familleActive(prefs, fam) {
  const p = prefs && typeof prefs === 'object' ? prefs : {};
  const f = famillesDe(p)[fam];
  if (typeof f === 'boolean') return f;
  const cats = Object.keys(FAMILLE_DE).filter((c) => FAMILLE_DE[c] === fam);
  return cats.some((c) => decisionNotif(p, c));
}

// ── HEURES CALMES ET REGROUPEMENT (5 nov.) ─────────────────────────────────
// Réglés dans Paramètres → Notifications, rangés dans la même ligne
// `push_prefs` : `calme: { actif, debut: 'HH:MM', fin: 'HH:MM', sauf: [familles] }`
// et `regrouper: true|false`. Lus par le serveur juste avant d'envoyer
// (api/_lib/push.js) : pendant les heures calmes, RIEN ne sonne — la
// notification est rangée dans le centre de l'app (« heures calmes »), jamais
// perdue. Les heures sont celles de PARIS (VRM reste en France, §3), quelle que
// soit l'horloge du serveur. Par défaut la double vente sonne quand même (le
// seul cas où attendre le matin coûte une paire).
export const CALME_DEFAUT = { actif: false, debut: '22:00', fin: '08:00', sauf: ['doublevente'] };
const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;
export const heureValide = (h) => HHMM.test(String(h || ''));
const minutesDe = (h) => { const m = HHMM.exec(String(h || '')); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
export function reglageCalme(prefs) {
  const c = prefs && prefs.calme && typeof prefs.calme === 'object' ? prefs.calme : {};
  return {
    actif: c.actif === true,
    debut: heureValide(c.debut) ? c.debut : CALME_DEFAUT.debut,
    fin: heureValide(c.fin) ? c.fin : CALME_DEFAUT.fin,
    sauf: Array.isArray(c.sauf) ? c.sauf.filter((x) => FAMILLES.some((f) => f.id === x)) : CALME_DEFAUT.sauf.slice(),
  };
}
// L'heure de Paris d'un instant, en minutes depuis minuit (`null` si illisible).
export function minutesParis(t = Date.now()) {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(t));
    const h = Number((parts.find((x) => x.type === 'hour') || {}).value), m = Number((parts.find((x) => x.type === 'minute') || {}).value);
    return Number.isFinite(h) && Number.isFinite(m) ? (h % 24) * 60 + m : null;
  } catch (_) { return null; }
}
// Vrai si `t` tombe dans les heures calmes (une plage qui passe minuit compte,
// 22:00 → 08:00 ; début = fin ne fait rien). Une famille exemptée ⇒ non.
export function dansHeuresCalmes(prefs, cat, t = Date.now()) {
  const c = reglageCalme(prefs);
  if (!c.actif || !cat || cat === 'test') return false;
  if (c.sauf.includes(familleDe(cat))) return false;
  const d = minutesDe(c.debut), f = minutesDe(c.fin), m = minutesParis(t);
  if (d == null || f == null || m == null || d === f) return false;
  return d < f ? (m >= d && m < f) : (m >= d || m < f);
}
// Regrouper : sur le téléphone, une seule notification PAR TYPE (la nouvelle
// remplace l'ancienne et dit combien attendent dans le centre).
export const regrouper = (prefs) => !!(prefs && prefs.regrouper === true);
// Le texte d'une notification regroupée : `k` notifications de ce type non lues
// dans le centre (celle-ci comprise). k ≤ 1 ⇒ inchangé.
export function texteRegroupe({ title, body }, k) {
  if (!(k > 1)) return { title, body };
  const autres = k - 1;
  return { title, body: `${body ? body + ' · ' : ''}+${autres} autre${autres > 1 ? 's' : ''} dans VRM` };
}

// ── LES TEXTES ─────────────────────────────────────────────────────────────
const propre = (s, n) => {
  const x = String(s == null ? '' : s).replace(/<[^>]*>/g, ' ').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/®|™|©|[*_]+/g, ' ').replace(/\s+/g, ' ').trim();
  return x.length > n ? x.slice(0, n - 1).trimEnd() + '…' : x;
};
// « MAISON DE LA PRESSE » → « Maison de la Presse » (un nom tout en capitales
// seulement ; un nom déjà écrit en casse mixte est gardé tel quel).
const PETITS = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'et', 'à', 'au', 'aux', 'en', 'sur', "d'", "l'"]);
function casse(s) {
  const x = String(s || '').trim();
  if (!x || x !== x.toUpperCase() || !/[A-Z]/.test(x)) return x;
  return x.toLowerCase().split(/(\s+|-)/).map((m, i) => {
    if (/^\s+$|^-$/.test(m)) return m;
    if (i > 0 && PETITS.has(m)) return m;
    return m.replace(/^([a-zà-ÿ])/, (c) => c.toUpperCase()).replace(/^([dl]')([a-zà-ÿ])/, (_, a, c) => a + c.toUpperCase());
  }).join('');
}
// Le point, court : « Maison de la Presse, Cancale ». Une consigne Vinted Go
// (« Consigne Vinted Go, Kusmi Tea, 13 Rue Saint-Vincent ») : « Consigne Kusmi Tea ».
// La ville seulement si elle est écrite après un code postal ; rien n'est deviné.
export function lieuCourtNotif(lieu) {
  const s = propre(lieu, 200);
  if (!s) return '';
  const parts = s.split(',').map((x) => x.trim()).filter(Boolean);
  let nom = parts[0] || '';
  if (/^consigne\s+vinted\s*go$/i.test(nom) && parts[1] && !/\d/.test(parts[1])) nom = `Consigne ${parts[1]}`;
  if (nom.replace(/[^a-zà-ÿ]/gi, '').length < 3) return '';
  const cp = /\b\d{5}\s+([^,\d][^,]{1,40})$/.exec(s);
  const ville = cp ? casse(cp[1].trim()) : '';
  const n = propre(casse(nom), 40);
  return ville && !n.toLowerCase().includes(ville.toLowerCase()) ? `${n}, ${ville}` : n;
}
const jjmm = (d) => { const m = /(\d{4})-(\d{2})-(\d{2})/.exec(String(d || '')); return m ? `${m[3]}/${m[2]}` : ''; };
// Un code de retrait affichable (des chiffres ; jamais « suivant »).
export const codeAffichable = (c) => { const x = String(c == null ? '' : c).trim(); return (/\d/.test(x) && /^[A-Z0-9 -]{3,14}$/i.test(x) && !/^suivant$/i.test(x)) ? x.toUpperCase() : ''; };
// L'ARRIVÉE, un texte pour toutes les voies.
//   { article, transporteur (nom lisible), lieu, code, code2, limite (AAAA-MM-JJ), limiteHeure }
export function texteArrivee({ article = '', transporteur = '', lieu = '', code = '', code2 = '', limite = '', limiteHeure = '', vers = false } = {}) {
  const a = propre(article, 48);
  const sujet = a || (transporteur ? `Ton colis ${transporteur}` : 'Ton colis');
  const l = lieuCourtNotif(lieu);
  const c = codeAffichable(code), c2 = codeAffichable(code2);
  const lim = jjmm(limite);
  const morceaux = [
    l,
    c ? `code ${c}${c2 ? ' + ' + c2 : ''}` : '',
    lim ? `${vers ? 'vers le' : "jusqu'au"} ${lim}${limiteHeure ? ` à ${limiteHeure}` : ''}` : '',
  ].filter(Boolean);
  return { title: `📍 ${sujet} t'attend`, body: morceaux.length ? morceaux.join(' · ') : (transporteur && a ? transporteur : 'Au point de retrait') };
}
