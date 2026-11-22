// ── « BOOST RENTABLE OU PAS » PAR PÉRIODE (21 nov., ext. 5.429 — point 64, retenu le 11 oct.) ──────────────────────
// La règle, pure : l'app (fiche de l'annonce, « Boosts du mois » dans Statistiques) et `scripts/audit-ext-5429.cjs`.
// Un REPÈRE, jamais de la compta : rien d'ici n'entre dans un total.
//
// LES DONNÉES (mesurées, jamais inventées) : l'extension range, à chaque lecture du dressing, UN relevé par annonce et
// par jour (`vinted_suivi_{uid}` : jour, vues, favoris, `promoted` — 1 boost en cours, 0 pas de boost, vide = pas dit
// par Vinted). Vinted ne dit « boostée » QUE pendant le boost : la période d'un boost = les jours relevés `promoted: 1`
// qui se suivent. Avant la 5.429 rien n'était relevé : un boost d'avant n'a pas de « avant » ⇒ « pas assez de données ».
//
// LA QUESTION : pendant le boost, l'annonce a-t-elle gagné plus de vues / de favoris PAR JOUR que pendant la même durée
// juste avant ? (et, s'il y a assez d'annonces semblables NON boostées du même compte sur les mêmes jours, plus qu'elles ?)
// Une vente PROUVÉE pendant le boost (date de vente, par identité de l'annonce) compte. Le coût : le « Boost payé » saisi
// sur la fiche, sinon « coût inconnu » (Vinted ne rend aucun montant par annonce : mesuré, historique compta).
//
// LES SEUILS (dits à l'écran, `SEUILS_BOOST`) : chaque période (pendant, avant) doit couvrir au moins 1 jour entre deux
// relevés ; au moins `vuesMin` vues sur les deux périodes ensemble ; sinon AUCUN verdict (« pas assez de données »).
// « A servi » : vendue pendant le boost, OU vues/jour ≥ 1,5 × avant (et ≥ 1,5 × les semblables si connues).
// « N'a pas servi » : pas vendue ET vues/jour < 1,2 × avant (et pas au-dessus des semblables). Entre les deux : rien.

export const SEUILS_BOOST = Object.freeze({ vuesMin: 10, semblablesMin: 5, servi: 1.5, pasServi: 1.2, ecartMaxJours: 2 });
const JOUR = 86400000;
const jourMs = (j) => { const m = /^(\d{4})(\d{2})(\d{2})$/.exec(String(j || '')) || /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(j || '')); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN; };
export const jourDe = (ms) => { const d = new Date(ms); return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`; };

// La série rangée (« 20261121,123,4,1;… ») ⇒ [{ j, t, v, f, p }] triée, un relevé par jour (le dernier gagne).
export function lireSerie(txt) {
  const par = new Map();
  for (const morceau of String(txt || '').split(';')) {
    const [j, v, f, p] = morceau.split(',');
    const t = jourMs(j);
    if (!Number.isFinite(t)) continue;
    // (22 nov.) Un champ VIDE (« pas dit par Vinted », l'extension écrit ',,') n'est pas un 0 : Number('') vaut 0.
    const vv = v == null || v === '' ? NaN : Number(v), ff = f == null || f === '' ? NaN : Number(f);
    par.set(t, { j: String(j), t, v: Number.isFinite(vv) && vv >= 0 ? vv : null, f: Number.isFinite(ff) && ff >= 0 ? ff : null, p: p === '1' ? 1 : p === '0' ? 0 : null });
  }
  return [...par.values()].sort((a, b) => a.t - b.t);
}
// Les boosts d'une série : les jours `p === 1` qui se suivent (un trou de relevé de plus de `ecartMaxJours` jours, ou
// un relevé `p === 0`, coupe la période). Rend [{ debut, fin, jours, enCours }].
export function periodesBoost(serie) {
  const s = Array.isArray(serie) ? serie : [];
  const out = []; let cur = null;
  for (let i = 0; i < s.length; i++) {
    const x = s[i];
    if (x.p === 1) {
      if (cur && x.t - cur.fin <= SEUILS_BOOST.ecartMaxJours * JOUR) cur.fin = x.t;
      else { if (cur) out.push(cur); cur = { debut: x.t, fin: x.t }; }
    } else if (cur && x.p === 0) { out.push(cur); cur = null; }
  }
  if (cur) out.push(cur);
  const dernier = s.length ? s[s.length - 1] : null;
  return out.map((p) => ({ ...p, jours: Math.round((p.fin - p.debut) / JOUR) + 1, enCours: !!(dernier && dernier.p === 1 && dernier.t === p.fin) }));
}
// Le taux d'une fenêtre [a, b] (ms, jours) : vues et favoris gagnés par jour entre le relevé de départ (le dernier ≤ a,
// au plus `ecartMaxJours` avant) et celui d'arrivée (le dernier ≤ b, au moins 1 jour après le départ). `null` = pas su.
function taux(serie, a, b, cle) {
  const avant = serie.filter((x) => x.t <= a && x[cle] != null);
  const depart = avant.length ? avant[avant.length - 1] : null;
  if (!depart || a - depart.t > SEUILS_BOOST.ecartMaxJours * JOUR) return null;
  const fin = serie.filter((x) => x.t <= b && x.t > depart.t && x[cle] != null);
  const arrivee = fin.length ? fin[fin.length - 1] : null;
  if (!arrivee) return null;
  const jours = (arrivee.t - depart.t) / JOUR;
  if (!(jours >= 1)) return null;
  const gagne = arrivee[cle] - depart[cle];
  if (gagne < 0) return null;   // un compteur qui recule (annonce recréée ?) : pas su
  return { gagne, jours, parJour: gagne / jours };
}
const mediane = (l) => { const s = l.filter((x) => Number.isFinite(x)).sort((a, b) => a - b); if (!s.length) return null; const k = Math.floor(s.length / 2); return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2; };

// Le verdict d'UN boost. `serie` : lireSerie(…) ; `periode` : un élément de periodesBoost ; `venteAt` : la date (ms)
// de la vente PROUVÉE de cette annonce (ou null) ; `offres` : { pendant, avant } comptées par identité, ou null (pas su) ;
// `cout` : le « Boost payé » saisi (€) ou null ; `semblables` : [serie] d'annonces du même compte, NON boostées sur les
// deux fenêtres. Rend { verdict: 'a-servi' | 'pas-servi' | 'pas-assez', pendant, avant, semblables, vendue, cout, raison }.
export function verdictBoost({ serie, periode, venteAt = null, offres = null, cout = null, semblables = [] } = {}) {
  const S = Array.isArray(serie) ? serie : [];
  const p = periode;
  const base = { verdict: 'pas-assez', pendant: null, avant: null, semblables: null, vendue: false, offres: offres && typeof offres === 'object' ? offres : null, cout: Number(cout) > 0 ? Math.round(Number(cout) * 100) / 100 : null, raison: '' };
  if (!p || !Number.isFinite(p.debut) || !Number.isFinite(p.fin)) return { ...base, raison: 'aucun boost relevé', code: 'aucun' };
  // Pendant : du relevé de la veille du début jusqu'au dernier jour boosté ; avant : la MÊME durée (`n`, en ms), juste avant.
  const debut0 = p.debut - JOUR;
  const n = p.fin - debut0;
  const vendue = Number.isFinite(venteAt) && venteAt >= p.debut && venteAt < p.fin + JOUR;
  const pv = taux(S, debut0, p.fin, 'v'), pf = taux(S, debut0, p.fin, 'f');
  const av = taux(S, debut0 - n, debut0, 'v'), af = taux(S, debut0 - n, debut0, 'f');
  const pendant = pv ? { vues: pv.gagne, favoris: pf ? pf.gagne : null, jours: pv.jours, vuesJour: pv.parJour, favorisJour: pf ? pf.parJour : null } : null;
  const avant = av ? { vues: av.gagne, favoris: af ? af.gagne : null, jours: av.jours, vuesJour: av.parJour, favorisJour: af ? af.parJour : null } : null;
  // Les semblables : leurs vues/jour sur les deux mêmes fenêtres (au moins `semblablesMin` annonces lisibles).
  let semb = null;
  const sp = [], sa = [];
  for (const s of Array.isArray(semblables) ? semblables : []) {
    const l = Array.isArray(s) ? s : [];
    if (l.some((x) => x.p === 1 && x.t >= debut0 - n && x.t <= p.fin)) continue;   // boostée sur les mêmes jours : pas une « semblable »
    const a1 = taux(l, debut0, p.fin, 'v'), a2 = taux(l, debut0 - n, debut0, 'v');
    if (a1 && a2) { sp.push(a1.parJour); sa.push(a2.parJour); }
  }
  if (sp.length >= SEUILS_BOOST.semblablesMin) semb = { n: sp.length, vuesJourPendant: mediane(sp), vuesJourAvant: mediane(sa) };
  const out = { ...base, pendant, avant, semblables: semb, vendue };
  if (vendue) return { ...out, verdict: 'a-servi', raison: 'vendue pendant le boost', code: 'vente' };
  if (!pendant || !avant) return { ...out, raison: !pendant ? 'pas de relevé assez proche pendant le boost' : 'pas de relevé assez long avant le boost', code: !pendant ? 'pendant' : 'avant' };
  if (pendant.vues + avant.vues < SEUILS_BOOST.vuesMin) return { ...out, raison: `moins de ${SEUILS_BOOST.vuesMin} vues en tout`, code: 'vues' };
  const ratio = avant.vuesJour > 0 ? pendant.vuesJour / avant.vuesJour : (pendant.vuesJour > 0 ? Infinity : 1);
  const ratioS = semb && semb.vuesJourPendant > 0 ? pendant.vuesJour / semb.vuesJourPendant : null;
  if (ratio >= SEUILS_BOOST.servi && (ratioS == null || ratioS >= SEUILS_BOOST.servi)) return { ...out, verdict: 'a-servi', ratio, ratioS, raison: 'plus de vues par jour', code: 'plus' };
  if (ratio < SEUILS_BOOST.pasServi && (ratioS == null || ratioS < SEUILS_BOOST.pasServi)) return { ...out, verdict: 'pas-servi', ratio, ratioS, raison: 'pas plus de vues par jour', code: 'pas-plus' };
  return { ...out, ratio, ratioS, raison: 'écart trop faible pour conclure', code: 'ecart' };
}

// « BOOSTS DU MOIS » : chaque boost relevé qui touche le mois [de, a[ (ms). `annonces` : [{ id, uid, serie, venteAt, cout,
// offres, titre, numero }] ; `illisibles` : comptes dont la série n'a pas pu être lue (⇒ « au moins »). Les semblables
// d'une annonce : les autres annonces du MÊME compte. Rend { boosts: [{ id, uid, periode, ...verdict }], n: {…}, auMoins, cout }.
export function boostsDuMois({ annonces = [], de, a, illisibles = 0 } = {}) {
  const parCompte = new Map();
  for (const x of annonces) { if (!x || !x.uid) continue; if (!parCompte.has(x.uid)) parCompte.set(x.uid, []); parCompte.get(x.uid).push(x); }
  const boosts = [];
  for (const x of annonces) {
    for (const per of periodesBoost(x.serie)) {
      if (!(per.fin >= de && per.debut < a)) continue;
      const semblables = (parCompte.get(x.uid) || []).filter((y) => y.id !== x.id).map((y) => y.serie);
      boosts.push({ id: String(x.id), uid: String(x.uid), titre: x.titre || '', numero: x.numero || '', periode: per, ...verdictBoost({ serie: x.serie, periode: per, venteAt: x.venteAt, offres: x.offres, cout: x.cout, semblables }) });
    }
  }
  const n = { total: boosts.length, servi: boosts.filter((b) => b.verdict === 'a-servi').length, pasServi: boosts.filter((b) => b.verdict === 'pas-servi').length, pasAssez: boosts.filter((b) => b.verdict === 'pas-assez').length };
  const couts = boosts.map((b) => b.cout).filter((c) => c != null);
  return { boosts, n, auMoins: illisibles > 0, cout: { connu: couts.reduce((s, c) => s + c, 0), avec: couts.length, sur: boosts.length } };
}
