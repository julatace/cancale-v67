// (11 nov., famille « dates à l'heure de Paris ») UNE règle pour le jour, le mois et l'année
// MÉTIER d'un instant : ceux de Paris (Europe/Paris), quel que soit le fuseau de l'appareil.
// Avant : chaque écran avait sa clé — `toISOString().slice(0, 10)` (UTC : une vente à 0 h 30
// tombait la veille) ou `${d.getFullYear()}-${d.getMonth()+1}` (fuseau de l'APPAREIL : un
// versement lu sur un téléphone à l'étranger changeait de mois). Le CA déclaré, l'URSSAF,
// les exports, les statistiques classent un instant à la date de Paris : c'est ici.
// Gardien : scripts/audit-dates-paris.cjs (interdit les deux motifs dans src/).
//
// Trois états (§5) : un instant illisible rend '' (jamais une date inventée).

let _fmt = null;
const fmt = () => {
  if (_fmt === null) {
    try { _fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }); }
    catch (_) { _fmt = false; }
  }
  return _fmt;
};

// Un instant : nombre (ms), Date, ou texte ISO. Rend une Date valide ou null.
const instant = (t) => {
  if (t == null || t === '') return null;
  const d = t instanceof Date ? t : new Date(typeof t === 'number' ? t : (/^\d+$/.test(String(t)) ? Number(t) : String(t)));
  return Number.isFinite(d.getTime()) ? d : null;
};

// Décalage de Paris (en minutes) à un instant, sans Intl : heure d'été du dernier dimanche
// de mars 1 h UTC au dernier dimanche d'octobre 1 h UTC (règle européenne). Secours seulement.
const dernierDimanche = (an, mois) => { const d = new Date(Date.UTC(an, mois + 1, 0)); return Date.UTC(an, mois, d.getUTCDate() - d.getUTCDay(), 1); };
const decalageParis = (ms) => {
  const an = new Date(ms).getUTCFullYear();
  return (ms >= dernierDimanche(an, 2) && ms < dernierDimanche(an, 9)) ? 120 : 60;
};

// 'AAAA-MM-JJ' du jour de Paris de cet instant ('' si illisible).
export const jourParis = (t = Date.now()) => {
  const d = instant(t);
  if (!d) return '';
  const f = fmt();
  if (f) { try { const s = f.format(d); if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; } catch (_) { /* secours ci-dessous */ } }
  return new Date(d.getTime() + decalageParis(d.getTime()) * 60000).toISOString().slice(0, 10);
};

// 'AAAA-MM' du mois de Paris.
export const moisParis = (t = Date.now()) => jourParis(t).slice(0, 7);
// 'AAAA' de l'année de Paris.
export const anneeParis = (t = Date.now()) => jourParis(t).slice(0, 4);
// Numéro du mois de Paris, 0 à 11 (comme getMonth) ; -1 si illisible.
export const indexMoisParis = (t = Date.now()) => { const m = moisParis(t); return m ? Number(m.slice(5, 7)) - 1 : -1; };

// Arithmétique de mois sur le texte 'AAAA-MM' (aucun fuseau en jeu).
export const moisDecale = (ym, delta) => {
  const m = /^(\d{4})-(\d{2})$/.exec(String(ym || ''));
  if (!m) return '';
  const i = Number(m[1]) * 12 + Number(m[2]) - 1 + Math.trunc(Number(delta) || 0);
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;
};
// Le mois de Paris de `maintenant` puis les n−1 d'avant (le plus récent d'abord).
export const moisRecents = (n, maintenant = Date.now()) => {
  const ym = moisParis(maintenant);
  if (!ym) return [];
  const out = [];
  for (let i = 0; i < n; i++) out.push(moisDecale(ym, -i));
  return out;
};

// Clé 'AAAA-MM-JJ' d'une date de CALENDRIER construite par ses composants
// (`new Date(an, mois, jour)` d'une grille, d'un sélecteur) : elle se lit dans le fuseau où elle
// a été construite. À n'utiliser QUE pour une date de calendrier, jamais pour un instant capté
// (vente, versement, e-mail) : ceux-là passent par jourParis.
export const cleCalendrier = (d) => (d instanceof Date && Number.isFinite(d.getTime()))
  ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  : '';
export const moisCalendrier = (d) => cleCalendrier(d).slice(0, 7);
