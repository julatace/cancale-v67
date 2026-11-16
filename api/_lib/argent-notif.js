// api/_lib/argent-notif.js
// ────────────────────────────────────────────────────────────────────────────
// (15 nov., lot argent-plus) LES TEXTES DE DEUX NOTIFICATIONS D'ARGENT, 5 langues :
//   · `bilanMois` — le 1er du mois, le bilan du mois écoulé : « Ton bilan d’octobre »
//     / « Vendu 1 240 € · reçu au moins 980 € · URSSAF ≈ 121 € · 12 qui dorment » ;
//   · `seuil` — un seuil de l'année à 80 % ou 100 % (src/alertesSeuils.js `texteSeuil`,
//     la MÊME phrase que l'alerte de l'écran Argent).
// Les DONNÉES viennent des règles (src/bilanFinMois.js `donneesNotifBilan`, et
// `alertesSeuils`) : ici on n'écrit que des mots. La règle de rédaction
// (api/_lib/notif-redaction.js, sortes `bilanMois` et `seuil`) coupe à 40 / 90 et
// retire tout identifiant. « Pas su » : la partie n'est pas écrite (jamais « 0 € »),
// et « au moins 0 » ne se dit jamais. Jamais « encaissé ». Pur : aucun module Node.
// ────────────────────────────────────────────────────────────────────────────
import { texteSeuil } from '../../src/alertesSeuils.js';

const LOC = { fr: 'fr-FR', en: 'en-GB', es: 'es-ES', it: 'it-IT', de: 'de-DE' };
const MOIS = {
  fr: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  es: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
  it: ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'],
  de: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
};
const langue = (l) => (LOC[String(l || '').slice(0, 2)] ? String(l).slice(0, 2) : 'fr');
// « 1 240 € », « 980,50 € » (« €1,240 » en anglais) ; zéro s'écrit « 0 € » (un vrai zéro).
export function eurosNotif(x, l = 'fr') {
  const n = Number(x);
  if (!Number.isFinite(n)) return '';
  const entier = Math.round(n * 100) % 100 === 0;
  try { return new Intl.NumberFormat(LOC[langue(l)], { style: 'currency', currency: 'EUR', minimumFractionDigits: entier ? 0 : 2, maximumFractionDigits: entier ? 0 : 2 }).format(n).replace(/ /g, ' '); }
  catch (_) { return `${n} €`; }
}
const T = {
  fr: { titre: (m) => `Ton bilan ${/^[aeiouyàâéèêîôû]/i.test(m) ? 'd’' : 'de '}${m}`, vendu: (e, am) => `Vendu ${am ? 'au moins ' : ''}${e}`, recu: (e, am) => `reçu ${am ? 'au moins ' : ''}${e}`,
    urssaf: (e, am) => `URSSAF ${am ? 'au moins ' : '≈ '}${e}`, regime: 'URSSAF : choisis ton régime', dorment: (n, am) => `${am ? 'au moins ' : ''}${n} qui dor${n > 1 ? 'ment' : 't'}`, voir: 'Le détail est dans Argent.' },
  en: { titre: (m) => `Your ${m} summary`, vendu: (e, am) => `Sold ${am ? 'at least ' : ''}${e}`, recu: (e, am) => `received ${am ? 'at least ' : ''}${e}`,
    urssaf: (e, am) => `URSSAF ${am ? 'at least ' : '≈ '}${e}`, regime: 'URSSAF: choose your status', dorment: (n, am) => `${am ? 'at least ' : ''}${n} not selling`, voir: 'Details in Money.' },
  es: { titre: (m) => `Tu balance de ${m}`, vendu: (e, am) => `Vendido ${am ? 'al menos ' : ''}${e}`, recu: (e, am) => `recibido ${am ? 'al menos ' : ''}${e}`,
    urssaf: (e, am) => `URSSAF ${am ? 'al menos ' : '≈ '}${e}`, regime: 'URSSAF: elige tu régimen', dorment: (n, am) => `${am ? 'al menos ' : ''}${n} sin venderse`, voir: 'El detalle está en Dinero.' },
  it: { titre: (m) => `Il tuo bilancio di ${m}`, vendu: (e, am) => `Venduto ${am ? 'almeno ' : ''}${e}`, recu: (e, am) => `ricevuto ${am ? 'almeno ' : ''}${e}`,
    urssaf: (e, am) => `URSSAF ${am ? 'almeno ' : '≈ '}${e}`, regime: 'URSSAF: scegli il tuo regime', dorment: (n, am) => `${am ? 'almeno ' : ''}${n} ferm${n > 1 ? 'i' : 'o'}`, voir: 'Il dettaglio è in Denaro.' },
  de: { titre: (m) => `Deine Bilanz ${m}`, vendu: (e, am) => `Verkauft ${am ? 'mindestens ' : ''}${e}`, recu: (e, am) => `erhalten ${am ? 'mindestens ' : ''}${e}`,
    urssaf: (e, am) => `URSSAF ${am ? 'mindestens ' : '≈ '}${e}`, regime: 'URSSAF: wähle deinen Status', dorment: (n, am) => `${am ? 'mindestens ' : ''}${n} liegen`, voir: 'Details unter Geld.' },
};
// Les morceaux dans l'ordre d'importance ; on garde ceux qui TIENNENT (90), jamais un
// morceau coupé au milieu.
const assembler = (parts, max) => { let out = ''; for (const p of parts.filter(Boolean)) { const x = out ? `${out} · ${p}` : p; if (x.length <= max) out = x; } return out; };

export function redigerBilanMois(d, { langue: lg = 'fr', max = 90 } = {}) {
  const l = langue(lg), t = T[l];
  const m = /^(\d{4})-(\d{2})$/.exec(String(d && d.ym || ''));
  if (!m) return null;
  const nom = `${MOIS[l][Number(m[2]) - 1]}${l === 'de' || l === 'en' ? ` ${m[1]}` : ''}`;
  const e = (x) => eurosNotif(x, l);
  const parts = [
    d.vendu ? t.vendu(e(d.vendu.eur), d.vendu.auMoins) : '',
    d.recu ? t.recu(e(d.recu.eur), d.recu.auMoins) : '',
    d.urssaf ? (d.urssaf.etat === 'su' ? t.urssaf(e(d.urssaf.apayer), d.urssaf.auMoins) : d.urssaf.etat === 'regime' ? t.regime : '') : '',
    d.dorment && d.dorment.n > 0 ? t.dorment(d.dorment.n, d.dorment.auMoins) : '',
  ];
  const corps = assembler(parts, max);
  if (!corps) return null;
  return { title: t.titre(nom), body: corps.charAt(0).toUpperCase() + corps.slice(1), ligne: assembler(parts.slice(0, 2), max - 20) };
}

// `d` = une alerte de `alertesADire` (src/alertesSeuils.js), sans rien d'autre.
export function redigerSeuil(d, { langue: lg = 'fr' } = {}) {
  const x = texteSeuil(d, langue(lg));
  if (!x) return null;
  return { title: x.titre, body: x.court, ligne: x.ou };
}
