// ── LE CALENDRIER DES PÉRIODES, « comme Airbnb » (29 octobre) ───────────────
// Julien : « pour le filtre des périodes je veux que ce soit mieux, tu peux
// peut-être ajouter un calendrier pour que l'on fasse comme avec Airbnb ».
// UNE règle pour tous les écrans qui filtrent par période (Ventes, Achats,
// Statistiques) : ce module (pur, exécuté par audit-choix-periode.cjs) et le
// composant `ChoixPeriode`. La VALEUR ne change pas de forme : `{ from, to,
// label? }` ou `null` (toute la période) — `dansPeriodeDate` (App.jsx) la lit
// telle quelle, bornes incluses, à la date de VENTE (jamais l'encaissement).
//
// Les jours se comparent en « clés » AAAA-MM-JJ de l'heure LOCALE (le jour que
// Julien voit), jamais en millisecondes UTC (une vente de 0 h 30 à Paris est le
// jour d'après en UTC).

export const MOIS_LONG = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
export const MOIS_COURT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
export const JOURS_COURTS = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];
export const JOURS_INITIALES = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const pad = (n) => String(n).padStart(2, '0');
export const cleJour = (d) => (d instanceof Date && !isNaN(d.getTime())) ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : '';
export const dateDeCle = (k) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(k || ''));
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return cleJour(d) === k ? d : null;   // refuse « 2026-02-31 »
};
const jourSeul = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const memeJour = (a, b) => cleJour(a) === cleJour(b);

// Un mois en grille : des semaines du LUNDI au dimanche, `null` hors du mois.
export function grilleMois(annee, mois) {
  const premier = new Date(annee, mois, 1);
  const decalage = (premier.getDay() + 6) % 7;            // lundi = 0
  const nb = new Date(annee, mois + 1, 0).getDate();
  const cases = [];
  for (let i = 0; i < decalage; i++) cases.push(null);
  for (let j = 1; j <= nb; j++) cases.push(new Date(annee, mois, j));
  while (cases.length % 7) cases.push(null);
  const semaines = [];
  for (let i = 0; i < cases.length; i += 7) semaines.push(cases.slice(i, i + 7));
  return semaines;
}

export const nomMois = (annee, mois) => `${MOIS_LONG[mois]} ${annee}`;
export const decalerMois = (annee, mois, n) => { const d = new Date(annee, mois + n, 1); return { annee: d.getFullYear(), mois: d.getMonth() }; };

// Combien de jours, bornes comprises.
export function nbJours(from, to) {
  if (!from || !to) return 0;
  const a = jourSeul(from), b = jourSeul(to);
  return Math.round((b - a) / 86400000) + 1;
}

// LA PLAGE EN CLAIR — « du 12 au 28 oct. 2026 », « du 28 sept. au 12 oct. 2026 »,
// « du 28 déc. 2025 au 3 janv. 2026 », « le 12 oct. 2026 » ; un mois entier se dit
// « octobre 2026 », une année entière « année 2026 ». Une borne seule : « depuis
// le … » / « jusqu'au … ». Rien : « Toute la période ».
export function libellePlage(from, to) {
  const f = from instanceof Date && !isNaN(from) ? jourSeul(from) : null;
  const t = to instanceof Date && !isNaN(to) ? jourSeul(to) : null;
  if (!f && !t) return 'Toute la période';
  const court = (d, annee = true) => `${d.getDate()}${d.getDate() === 1 ? 'er' : ''} ${MOIS_COURT[d.getMonth()]}${annee ? ' ' + d.getFullYear() : ''}`;
  if (f && !t) return `depuis le ${court(f)}`;
  if (!f && t) return `jusqu'au ${court(t)}`;
  if (memeJour(f, t)) return `le ${court(f)}`;
  const finMois = new Date(f.getFullYear(), f.getMonth() + 1, 0);
  if (f.getDate() === 1 && memeJour(t, finMois)) return nomMois(f.getFullYear(), f.getMonth());
  if (f.getMonth() === 0 && f.getDate() === 1 && t.getMonth() === 11 && t.getDate() === 31 && f.getFullYear() === t.getFullYear()) return `année ${f.getFullYear()}`;
  if (f.getFullYear() === t.getFullYear()) {
    if (f.getMonth() === t.getMonth()) return `du ${f.getDate() === 1 ? '1er' : f.getDate()} au ${court(t)}`;
    return `du ${court(f, false)} au ${court(t)}`;
  }
  return `du ${court(f)} au ${court(t)}`;
}

// (29 oct., revue) La plage DANS UNE PHRASE (« 3 ventes finalisées en octobre
// 2026 ») : `libellePlage` est un libellé de bouton (« octobre 2026 », « année
// 2026 ») — collé après un nom, il donnait « finalisée octobre 2026 ».
export function phrasePlage(from, to) {
  const l = libellePlage(from, to);
  if (l === 'Toute la période') return 'sur toute la période';
  if (/^année \d{4}$/.test(l)) return 'en ' + l.slice(6);
  if (/^(le |du |depuis |jusqu)/.test(l)) return l;
  return 'en ' + l; // un mois entier : « en octobre 2026 »
}

// Les raccourcis, dans l'ordre demandé : 7 jours · 30 jours · ce mois · mois
// dernier · cette année. Chacun rend une VALEUR prête (`{from, to, label}`).
export function raccourcisPeriode(maintenant = new Date()) {
  const n = maintenant instanceof Date ? maintenant : new Date(maintenant);
  const auj = jourSeul(n);
  const jours = (k) => ({ from: new Date(auj.getFullYear(), auj.getMonth(), auj.getDate() - k + 1), to: auj, label: `${k} derniers jours` });
  const mois = (dec) => {
    const d = new Date(auj.getFullYear(), auj.getMonth() + dec, 1);
    return { from: d, to: new Date(d.getFullYear(), d.getMonth() + 1, 0), label: nomMois(d.getFullYear(), d.getMonth()) };
  };
  return [
    { cle: 'j7', nom: '7 jours', valeur: jours(7) },
    { cle: 'j30', nom: '30 jours', valeur: jours(30) },
    { cle: 'mois', nom: 'Ce mois', valeur: mois(0) },
    { cle: 'dernier', nom: 'Mois dernier', valeur: mois(-1) },
    { cle: 'annee', nom: 'Cette année', valeur: { from: new Date(auj.getFullYear(), 0, 1), to: new Date(auj.getFullYear(), 11, 31), label: `année ${auj.getFullYear()}` } },
  ];
}

// Le raccourci qui correspond EXACTEMENT à une valeur (pour l'allumer), sinon ''.
export function raccourciDe(valeur, maintenant = new Date()) {
  if (!valeur || !valeur.from || !valeur.to) return '';
  const r = raccourcisPeriode(maintenant).find((x) => memeJour(x.valeur.from, valeur.from) && memeJour(x.valeur.to, valeur.to));
  return r ? r.cle : '';
}

// LE GESTE « COMME AIRBNB » : un premier toucher pose le début ; le second pose
// la fin (le même jour = une seule journée) ; un jour AVANT le début devient le
// nouveau début ; une plage complète qu'on touche de nouveau recommence.
// `sel` = { from, to } (dates ou null). Un jour désactivé ne change rien.
export function toucherJour(sel, jour, { max = null } = {}) {
  if (!(jour instanceof Date) || isNaN(jour)) return sel || { from: null, to: null };
  const j = jourSeul(jour);
  if (max && j > jourSeul(max)) return sel || { from: null, to: null };
  const from = sel && sel.from ? jourSeul(sel.from) : null;
  const to = sel && sel.to ? jourSeul(sel.to) : null;
  if (!from || (from && to)) return { from: j, to: null };
  if (j < from) return { from: j, to: null };
  return { from, to: j };
}

// L'état d'un jour dans la grille, pour le dessin : 'debut' · 'fin' · 'seul'
// (début = fin) · 'dans' · 'apercu' (entre le début et le jour survolé) · ''.
export function etatJour(jour, sel, survol = null) {
  if (!jour) return '';
  const k = cleJour(jour);
  const f = sel && sel.from ? cleJour(sel.from) : '';
  const t = sel && sel.to ? cleJour(sel.to) : '';
  if (f && t) {
    if (k === f && k === t) return 'seul';
    if (k === f) return 'debut';
    if (k === t) return 'fin';
    if (k > f && k < t) return 'dans';
    return '';
  }
  if (f) {
    if (k === f) return 'debut';
    const s = survol ? cleJour(survol) : '';
    if (s && s > f && k > f && k <= s) return k === s ? 'fin-apercu' : 'apercu';
  }
  return '';
}

// La valeur à rendre à l'écran (les bornes en jours entiers ; le libellé si
// c'est un raccourci, sinon la plage en clair est recalculée à l'affichage).
export function valeurDeSelection(sel, maintenant = new Date()) {
  if (!sel || !sel.from) return null;
  const from = jourSeul(sel.from), to = jourSeul(sel.to || sel.from);
  const r = raccourcisPeriode(maintenant).find((x) => memeJour(x.valeur.from, from) && memeJour(x.valeur.to, to));
  return r ? { ...r.valeur } : { from, to };
}

// La liste des mois que montre le calendrier qui défile (téléphone) : des
// `nb` derniers mois jusqu'au mois en cours, le plus ancien en haut.
export function moisDefilants(maintenant = new Date(), nb = 18) {
  const n = maintenant instanceof Date ? maintenant : new Date(maintenant);
  const out = [];
  for (let i = nb - 1; i >= 0; i--) out.push(decalerMois(n.getFullYear(), n.getMonth(), -i));
  return out;
}
