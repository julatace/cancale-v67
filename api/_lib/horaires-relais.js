// ════════════════════════════════════════════════════════════════════════════
//  LES HORAIRES D'OUVERTURE DU POINT RELAIS, LUS DANS L'E-MAIL DE RETRAIT (13 nov.)
// ════════════════════════════════════════════════════════════════════════════
//  Demande : « les e-mails de retrait donnent les horaires du point ; VRM ne les
//  garde pas ». Une règle PURE, partagée par la route (api/email-inbound.js, qui les
//  range sur la ligne de suivi, champ `horaires`) et l'app (src/lieuxRetrait.js relit
//  le texte gardé des e-mails déjà rangés ; src/CarteRelais.jsx les dit).
//
//  MESURÉ (lecture seule, 13 nov., 916 textes d'e-mails gardés, 82 disent « horaires ») :
//   · Vinted Go : « Horaires d'ouverture » puis, ligne par ligne, « *Lundi* » / « Fermé »,
//     « *Mardi–Vendredi* » / « 10:00-19:00 », « *Lundi–Dimanche* » / « 07:00-21:00 » ;
//   · Chronopost Pickup : « Détails du relais Pickup » … « Horaires d’ouverture : » puis
//     « lun. - sam. 09:00 - 19:30 » (le texte gardé est borné à 1 500 caractères : il
//     s'arrête souvent au milieu, « lun. - sa… » ⇒ RIEN, jamais un bout pris pour le tout) ;
//   · Mondial Relay : « Horaires d'ouvertures, photo, itinéraire : toutes les informations
//     juste ici ! » — un LIEN, aucune heure ⇒ rien ;
//   · les conseils « Vérifie les horaires d'ouverture du point relais » ⇒ rien.
//  Les autres réseaux (InPost, Relais Colis, Colissimo, DPD, GLS, UPS) écrivent les
//  mêmes briques (jours groupés, « de 9h à 12h et de 14h à 19h », « Fermé ») : la même
//  lecture, sans forme propre à un réseau.
//
//  ⚠️ RÈGLES TENUES
//   · forme inconnue, ligne à moitié comprise, jour sans heure ni « fermé », jour dit
//     deux fois, heure impossible ⇒ `null` (rien), jamais un horaire inventé ;
//   · un jour que l'e-mail ne nomme pas n'est PAS fermé : il est inconnu ;
//   · deux blocs d'horaires différents dans le même e-mail ⇒ rien (on ne choisit pas) ;
//   · les listes de « points de proximité » (`sansSuggestions`) ne comptent pas.
//
//  La forme rangée : [{ jours: [1..7] (1 = lundi … 7 = dimanche), plages: [{ de: 'HH:MM', a: 'HH:MM' }] }],
//  `plages: []` = fermé ces jours-là.
// ════════════════════════════════════════════════════════════════════════════
import { sansSuggestions } from './retrait-colis.js';
import { decoderEntitesHtml } from './entites-html.js';

const JOUR = String.raw`(?:lundi|lun|mardi|mar|mercredi|mer|jeudi|jeu|vendredi|ven|samedi|sam|dimanche|dim)\.?`;
const NUM_JOUR = { lun: 1, mar: 2, mer: 3, jeu: 4, ven: 5, sam: 6, dim: 7 };
const jourDe = (s) => NUM_JOUR[String(s).toLowerCase().replace(/\./g, '').slice(0, 3)] || 0;
const HEURE = String.raw`(\d{1,2})\s*(?:[:h]\s*(\d{2})?)?`;
const ENTRE_JOURS = String.raw`\s*(?:-|–|—|au|à|a)\s*`;
const ENTRE_HEURES = String.raw`\s*(?:-|–|—|à|a|jusqu['’]?\s*[àa])\s*`;
// Ce que la lecture d'une ligne reconnaît, dans l'ordre (le premier qui colle à la position gagne).
const MOTIFS = [
  ['plage', new RegExp(String.raw`^(?:de\s+)?${HEURE}${ENTRE_HEURES}${HEURE}(?![\d:h])`, 'i')],
  ['h24', /^(?:24\s*h?\s*(?:\/|sur)\s*24|24\s*h\s*\/\s*24\s*h?)(?![\d])/i],
  ['tous', /^(?:7\s*j(?:ours)?\s*(?:\/|sur)\s*7|tous\s+les\s+jours)(?![\d])/i],
  ['ferme', /^ferm[ée]e?s?(?![a-zà-ÿ])/i],
  ['jours', new RegExp(String.raw`^(?:du\s+)?(${JOUR})${ENTRE_JOURS}(${JOUR})(?![a-zà-ÿ])`, 'i')],
  ['jour', new RegExp(String.raw`^(${JOUR})(?![a-zà-ÿ])`, 'i')],
  ['blanc', /^(?:[\s,;\/|:：.*_]+|et\b|le\b|les\b|ouvert\b|de\b(?!\s*\d))/i],
];
const hh = (h, m) => { const H = +h, M = m == null || m === '' ? 0 : +m; if (!(H >= 0 && H <= 24 && M >= 0 && M < 60) || (H === 24 && M)) return null; return `${String(H).padStart(2, '0')}:${String(M).padStart(2, '0')}`; };
const etendue = (a, b) => { const out = []; if (!a || !b) return out; let d = a; for (let i = 0; i < 7; i++) { out.push(d); if (d === b) break; d = d === 7 ? 1 : d + 1; } return out; };

// Une ligne ⇒ ses jetons, ou 'partielle' (une partie comprise, le reste non), ou [] (rien de compris).
function jetonsDeLigne(ligne) {
  let s = String(ligne || '').replace(/[  ]/g, ' ').trim();
  const out = []; let utile = false;
  while (s.length) {
    let pris = false;
    for (const [sorte, re] of MOTIFS) {
      const m = re.exec(s);
      if (!m || !m[0].length) continue;
      if (sorte === 'plage') { const de = hh(m[1], m[2]), a = hh(m[3], m[4]); if (!de || !a || a <= de) return 'partielle'; out.push({ sorte, de, a }); }
      else if (sorte === 'jours') { const j = etendue(jourDe(m[1]), jourDe(m[2])); if (!j.length) return 'partielle'; out.push({ sorte: 'jours', jours: j }); }
      else if (sorte === 'jour') out.push({ sorte: 'jours', jours: [jourDe(m[1])] });
      else if (sorte === 'tous') out.push({ sorte: 'jours', jours: [1, 2, 3, 4, 5, 6, 7] });
      else if (sorte === 'h24') out.push({ sorte: 'plage', de: '00:00', a: '24:00' });
      else if (sorte === 'ferme') out.push({ sorte });
      if (sorte !== 'blanc') utile = true;
      s = s.slice(m[0].length); pris = true; break;
    }
    if (!pris) return utile ? 'partielle' : [];
  }
  return out;
}

// Le bloc qui suit UN en-tête « Horaires (d'ouverture) : » ⇒ des entrées, ou null.
const EN_TETE = /^\s*horaires(?:\s+d['’]\s*ouverture)?(?:\s+du\s+(?:point|relais|magasin)(?:\s+(?:relais|pickup))?)?\s*[:：]?\s*/i;
function blocDepuis(lignes, i) {
  const premier = lignes[i].replace(/[*_]+/g, ' ').trim();
  const m = EN_TETE.exec(premier);
  if (!m) return undefined;
  const reste = premier.slice(m[0].length);
  // « Horaires d'ouvertures, photo, itinéraire : … » (un lien) : la suite n'est pas un horaire.
  if (/^s\b|^[a-zà-ÿ]/i.test(reste) && !new RegExp(`^(?:du\\s+)?${JOUR}|^tous|^ferm`, 'i').test(reste)) return undefined;
  const entrees = []; let cour = null; let vu = false;
  const suite = [reste, ...lignes.slice(i + 1, i + 30).map((l) => l.replace(/[*_]+/g, ' ').trim())];
  for (let k = 0; k < suite.length; k++) {
    const l = suite[k];
    if (!l) continue;
    if (/…|\.\.\.\s*$/.test(l)) return null;                   // texte coupé : on ne prend pas un bout pour le tout
    const js = jetonsDeLigne(l);
    if (js === 'partielle') return null;
    if (!js.length) { if (k === 0) continue; break; }          // fin du bloc
    vu = true;
    for (const j of js) {
      if (j.sorte === 'jours') {
        if (!cour || ((cour.plages.length || cour.ferme) && cour.jours.length)) { cour = { jours: [], plages: [], ferme: false }; entrees.push(cour); }
        cour.jours.push(...j.jours);
      } else if (j.sorte === 'plage') { if (cour && cour.ferme) return null; if (!cour) { cour = { jours: [], plages: [], ferme: false }; entrees.push(cour); } cour.plages.push({ de: j.de, a: j.a }); }
      else if (j.sorte === 'ferme') { if (!cour || cour.plages.length) return null; cour.ferme = true; }
    }
  }
  if (!vu || !entrees.length) return null;
  const vus = new Set();
  for (const e of entrees) {
    if (!e.jours.length || (!e.plages.length && !e.ferme)) return null;
    for (const d of e.jours) { if (vus.has(d)) return null; vus.add(d); }
    e.plages.sort((a, b) => a.de.localeCompare(b.de));
    for (let k = 1; k < e.plages.length; k++) if (e.plages[k].de < e.plages[k - 1].a) return null;
  }
  if (!entrees.some((e) => e.plages.length)) return null;
  return entrees.map((e) => ({ jours: [...e.jours], plages: e.plages.map((p) => ({ de: p.de, a: p.a })) }));
}

export function horairesDepuisTexte(texte) {
  if (!texte || typeof texte !== 'string') return null;
  const lignes = sansSuggestions(texte.replace(/\r/g, '').replace(/\t+/g, '\n')).split('\n');
  const trouves = [];
  for (let i = 0; i < lignes.length; i++) {
    const b = blocDepuis(lignes, i);
    if (b === undefined) continue;
    if (b === null) return null;                                // un bloc d'horaires illisible : rien
    trouves.push(b);
  }
  if (!trouves.length) return null;
  const k = JSON.stringify(trouves[0]);
  return trouves.every((b) => JSON.stringify(b) === k) ? trouves[0] : null;
}

// ── (13 nov., lot 11) MONDIAL RELAY : LES HORAIRES LUS CHEZ LE TRANSPORTEUR ───
// L'e-mail Mondial Relay n'écrit pas les horaires : un LIEN (`notification.mondialrelay.fr/c?q=…`,
// redirection de suivi opaque, propre au destinataire — jamais suivi). La réponse de suivi que le
// SERVEUR lit déjà pour CE colis (`_mvc/…/RechercherJsonResponsive`, n° + code postal, écho
// contrôlé — api/_lib/transporteurs.js) porte, mesuré le 24 oct. (api/_lib/transporteurs-lecture.js) :
//   `<input type="hidden" id="numeroTemp" value=NNNNN />` (le n° du point relais),
//   `<input type="hidden" id="codePaysTemp" value=FR />`,
//   `<div class="points_relais PCL_Details hide"><div class="detail-mag">
//      <p class="tittle-info"><strong>Horaires d'ouverture :</strong></p>
//      <table><tbody><tr><td>lundi</td><td> 08h00 - 19h00 </td></tr>
//      <tr><td>dimanche</td><td colspan="2">Fermé</td></tr>…`.
// AUCUNE requête de plus : les horaires viennent avec le suivi. L'identité du point est celle que
// Mondial Relay donne pour CE n° de colis, jamais un point « qui ressemble » (nom, ville).
// ⚠️ Rien plutôt qu'un faux : deux n° de point différents, un pays autre que la France (ou pas dit),
// deux tableaux différents, une ligne qui n'est pas « jour + plages | fermé » ⇒ pas d'horaires.
// Un bloc présent mais illisible rend sa FORME (jamais son contenu : nombre de points, de blocs,
// de lignes, de cellules), rangée sur la ligne `transp_` pour qu'on la mesure en base.
const texteCellule = (h) => decoderEntitesHtml(String(h || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/[\s ]+/g, ' ').trim();
const valeurInput = (tag) => { const m = /\bvalue\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s/>]+))/i.exec(tag); return m ? String(m[1] ?? m[2] ?? m[3] ?? '').trim() : ''; };
export function pointEtHorairesMr(html) {
  const vide = { pointId: '', pays: '', horaires: null, forme: '' };
  if (typeof html !== 'string' || !html) return vide;
  const inputs = [...html.matchAll(/<input\b[^>]*>/gi)].map((m) => m[0]);
  const deId = (id) => inputs.filter((t) => new RegExp(`\\bid\\s*=\\s*["']?${id}["']?(?=[\\s/>])`, 'i').test(t)).map(valeurInput);
  const ids = [...new Set(deId('numeroTemp').filter((v) => /^\d{1,12}$/.test(v)).map((v) => v.replace(/^0+(?=\d)/, '')))];
  const pays = [...new Set(deId('codePaysTemp').map((v) => v.toUpperCase()).filter(Boolean))];
  const pointId = ids.length === 1 && pays.length === 1 && pays[0] === 'FR' ? ids[0] : '';
  const blocs = [...html.matchAll(/<div\b[^>]*class\s*=\s*["'][^"']*\bdetail-mag\b[^"']*["'][^>]*>([\s\S]*?)<\/table>/gi)].map((m) => m[1]);
  if (!blocs.length) return { ...vide, pointId, pays: pays.length === 1 ? pays[0] : '' };
  const lus = blocs.map((b) => {
    if (!/horaires\s+d['’]\s*ouverture/i.test(texteCellule(b))) return { h: null, lignes: 0, cel: 0 };
    const trs = [...b.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) => [...m[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((c) => texteCellule(c[1])));
    const lignes = trs.map((cs) => cs.filter(Boolean).join(' ')).filter(Boolean);
    const h = lignes.length ? horairesDepuisTexte(["Horaires d'ouverture :", ...lignes].join('\n')) : null;
    return { h, lignes: trs.length, cel: trs.reduce((n, cs) => Math.max(n, cs.length), 0) };
  });
  const k = lus[0].h ? JSON.stringify(lus[0].h) : '';
  const memes = !!k && lus.every((x) => x.h && JSON.stringify(x.h) === k);
  // Mondial Relay écrit un jour par ligne : les jours aux MÊMES plages sont regroupés (« lun.–sam. 9 h–19 h »).
  const regroupe = (h) => { const out = []; for (const e of h) { const cle = JSON.stringify(e.plages); const x = out.find((o) => JSON.stringify(o.plages) === cle); if (x) x.jours.push(...e.jours); else out.push({ jours: [...e.jours], plages: e.plages.map((p) => ({ ...p })) }); } for (const o of out) o.jours.sort((a, b) => a - b); return out.sort((a, b) => a.jours[0] - b.jours[0]); };
  const horaires = pointId && memes ? horairesValides(regroupe(lus[0].h)) : null;
  const forme = horaires ? '' : `mr-horaires:points=${ids.length},pays=${pays.join('|') || '-'},blocs=${blocs.length},lignes=${lus.map((x) => x.lignes).join('|')},cellules=${lus.map((x) => x.cel).join('|')}`;
  return { pointId, pays: pays.length === 1 ? pays[0] : '', horaires, forme };
}
// (13 nov., lot 11) Des horaires lus chez le transporteur valent 7 JOURS (ils changent rarement ; la
// ligne est relue avec le suivi du colis, sans requête de plus). Plus vieux ⇒ plus dits.
export const HORAIRES_TRANSP_VALIDES_MS = 7 * 24 * 3600 * 1000;

// Une valeur rangée (ou lue) n'est crue que sous la forme exacte.
const RE_H = /^(?:[01]\d|2[0-4]):[0-5]\d$/;
export function horairesValides(h) {
  if (!Array.isArray(h) || !h.length || h.length > 7) return null;
  const vus = new Set();
  for (const e of h) {
    if (!e || !Array.isArray(e.jours) || !Array.isArray(e.plages) || !e.jours.length) return null;
    for (const d of e.jours) { if (!Number.isInteger(d) || d < 1 || d > 7 || vus.has(d)) return null; vus.add(d); }
    for (const p of e.plages) if (!p || !RE_H.test(p.de) || !RE_H.test(p.a) || p.a <= p.de) return null;
  }
  return h.some((e) => e.plages.length) ? h : null;
}

// ── CE QUE L'ÉCRAN DIT ───────────────────────────────────────────────────────
const ABR = ['', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];
const NOM = ['', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
export const heureDite = (x) => { const [H, M] = String(x).split(':').map(Number); if (H === 24 || (H === 0 && !M)) return 'minuit'; return M ? `${H} h ${String(M).padStart(2, '0')}` : `${H} h`; };
const joursDits = (js) => {
  const t = [...js];
  const suite = t.length > 2 && t.every((d, i) => i === 0 || d === (t[i - 1] === 7 ? 1 : t[i - 1] + 1));
  if (t.length === 7) return 'tous les jours';
  return suite ? `${ABR[t[0]]}–${ABR[t[t.length - 1]]}` : t.map((d) => ABR[d]).join(', ');
};
const plagesDites = (ps) => (ps.length === 1 && ps[0].de === '00:00' && ps[0].a === '24:00' ? '24 h/24' : ps.map((p) => `${heureDite(p.de)}–${heureDite(p.a)}`).join(', '));
// « Ouvert lun.–sam. 9 h–19 h 30 » (les jours fermés ne sont pas redits : ils ne sont pas dans « Ouvert »).
export function texteHoraires(h0) {
  const h = horairesValides(h0); if (!h) return '';
  return 'Ouvert ' + h.filter((e) => e.plages.length).map((e) => `${joursDits(e.jours)} ${plagesDites(e.plages)}`).join(' · ');
}

// Le jour (1..7) et la minute À PARIS.
export function momentParis(ms) {
  try {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
    const j = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[p.weekday];
    const min = (+p.hour) * 60 + (+p.minute);
    return j && Number.isFinite(min) ? { jour: j, min } : null;
  } catch (_) { return null; }
}
const enMin = (x) => { const [H, M] = String(x).split(':').map(Number); return H * 60 + M; };
// Ouvert maintenant ? ⇒ { ouvert: true, fermeA } · { ouvert: false, ouvreA, dans: 0|1|n, jour } · { ouvert: false } · null (pas su).
export function etatOuverture(h0, maintenantMs = Date.now()) {
  const h = horairesValides(h0); const m = momentParis(maintenantMs);
  if (!h || !m) return null;
  const du = (j) => h.find((e) => e.jours.includes(j)) || null;
  const auj = du(m.jour);
  if (!auj) return null;                                        // aujourd'hui pas dit dans l'e-mail : pas su
  const p = auj.plages.find((x) => enMin(x.de) <= m.min && m.min < enMin(x.a));
  if (p) {
    // Une plage qui finit à minuit et reprend à minuit le lendemain (24 h/24) ne « ferme » pas.
    const demain = du(m.jour === 7 ? 1 : m.jour + 1);
    const continu = p.a === '24:00' && demain && demain.plages.some((x) => x.de === '00:00');
    return { ouvert: true, fermeA: continu ? null : p.a };
  }
  const plusTard = auj.plages.find((x) => enMin(x.de) > m.min);
  if (plusTard) return { ouvert: false, ouvreA: plusTard.de, dans: 0, jour: m.jour };
  let j = m.jour;
  for (let n = 1; n <= 7; n++) {
    j = j === 7 ? 1 : j + 1;
    const e = du(j);
    if (!e) return { ouvert: false };                           // un jour pas dit avant la réouverture : on ne promet rien
    if (e.plages.length) return { ouvert: false, ouvreA: e.plages[0].de, dans: n, jour: j };
  }
  return { ouvert: false };
}
// « ouvert maintenant · ferme à 19 h 30 » · « fermé — ouvre à 14 h » · « fermé — ouvre demain à 9 h » ·
// « fermé — ouvre mardi à 10 h » · « fermé maintenant ». Pas su ⇒ ''.
export function phraseOuverture(e) {
  if (!e) return '';
  if (e.ouvert) return e.fermeA ? `ouvert maintenant · ferme à ${heureDite(e.fermeA)}` : 'ouvert maintenant';
  if (!e.ouvreA) return 'fermé maintenant';
  const quand = e.dans === 0 ? '' : e.dans === 1 ? 'demain ' : `${NOM[e.jour]} `;
  return `fermé — ouvre ${quand}à ${heureDite(e.ouvreA)}`;
}

// Les horaires d'UN point, d'après ses colis : ceux de la source la plus récente qui en a (le transporteur
// les réécrit à chaque e-mail ; un changement d'horaires est le plus récent). Aucun ⇒ null.
export function horairesDuPoint(colis, dateDe = () => 0) {
  let best = null, bestMs = -Infinity;
  for (const c of (colis || [])) {
    const h = horairesValides(c && c.horaires);
    if (!h) continue;
    const ms = Number(dateDe(c)) || 0;
    if (!best || ms > bestMs) { best = h; bestMs = ms; }
  }
  return best;
}
