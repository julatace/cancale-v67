// ═══════════════════════════════════════════════════════════════════════════
// STATISTIQUES DÉTAILLÉES — LES RÈGLES, PURES (31 octobre)
// ═══════════════════════════════════════════════════════════════════════════
// Julien, 31 oct. : « je veux que tu proposes beaucoup plus de statistiques
// dans Ma journée et même dans Statistiques, de la vraie data ».
//
// Ce module ne LIT rien : il reçoit des lignes que leurs propriétaires ont déjà
// calculées (§11) et rend des chiffres avec LEUR COUVERTURE (§5) :
//   • VENDU (rythme, semaines, jours, heures, panier) : les lignes de
//     `ventesFaites` — { plateforme, ts, eur } — la population de « Vendu
//     aujourd'hui » et « Vendu ce mois » de Ma journée ;
//   • BÉNÉFICE et MARGE par marque / modèle / taille / plateforme / compte : le
//     relevé publié par l'écran Ventes (`vrm_stats_ventes`), les MÊMES ventes
//     et le même prix d'achat que `vrm_benefice_jours` (finalisées, prix
//     d'achat relié par identité seulement, jamais deviné) ;
//   • DÉLAI DE VENTE : la date de mise en ligne (`dateMiseEnLigneMs`) d'une
//     annonce reliée à la vente par sa TRANSACTION — Vinted seulement ;
//   • STOCK qui dort : l'âge lu par l'écran Annonces (`listedAgeDays`).
// Rien ici n'invente : un groupe sans prix d'achat n'a pas de marge (`null`,
// « — »), une vente sans heure lue n'est dans aucune heure, une lecture ratée
// rend `null` (pas su), jamais 0. Aucune estimation n'est rendue sans le
// drapeau qui la nomme (`depuisPremiere` pour une moyenne sur moins de jours).
// Exécuté par scripts/audit-stats-ventes.cjs (données inventées, `--prouve`).

const J = 86400000;
// Minuit LOCAL du jour de `ts` décalé de `k` jours (jamais `ts - k × 24 h` :
// un passage à l'heure d'hiver ferait glisser la borne d'une heure).
export const minuitLocal = (ts, k = 0) => { const d = new Date(ts); return new Date(d.getFullYear(), d.getMonth(), d.getDate() + k).getTime(); };
const arrondi2 = (x) => Math.round(x * 100) / 100;
const somme = (lignes, de, a) => {
  let n = 0, c = 0;
  for (const l of lignes) if (l.ts >= de && l.ts < a) { n += 1; c += Math.round(l.eur * 100); }
  return { n, eur: c / 100 };
};
const valide = (l) => l && isFinite(l.ts) && l.ts > 0 && isFinite(Number(l.eur));

// ── LE RYTHME (VENDU) ──────────────────────────────────────────────────────
// `lignes` : celles de `ventesFaites` ; `null` = pas lues ⇒ `null`.
//   jour       : depuis minuit ;
//   moyenne    : par jour, sur les 28 jours PLEINS d'avant (hier compris). Si la
//                première vente connue est plus récente, la moyenne porte sur
//                les jours depuis elle, et `depuisPremiere` le dit ;
//   j7 / j7av  : les 7 derniers jours (aujourd'hui compris) / les 7 d'avant ;
//   panier30   : CA ÷ nombre de ventes sur 30 jours (aujourd'hui compris) ;
//   semaines   : 12 semaines du lundi au dimanche, la dernière EN COURS (dite).
export const rythmeVendu = (lignes, maintenant = Date.now()) => {
  if (!Array.isArray(lignes)) return null;
  const L = lignes.filter(valide).map((l) => ({ ...l, eur: Number(l.eur) }));
  const m0 = minuitLocal(maintenant), demain = minuitLocal(maintenant, 1);
  const jour = somme(L, m0, demain);
  const premiere = L.reduce((m, l) => Math.min(m, l.ts), Infinity);
  const debut28 = minuitLocal(maintenant, -28);
  let joursMoy = 28, depuisPremiere = false;
  if (premiere > debut28 && premiere < m0) { joursMoy = Math.max(1, Math.round((m0 - minuitLocal(premiere)) / J)); depuisPremiere = true; }
  const avant = somme(L, depuisPremiere ? minuitLocal(premiere) : debut28, m0);
  const moyenne = premiere >= m0 ? null : { n: avant.n / joursMoy, eur: arrondi2(avant.eur / joursMoy), jours: joursMoy, depuisPremiere };
  const j7 = somme(L, minuitLocal(maintenant, -6), demain);
  const j7av = somme(L, minuitLocal(maintenant, -13), minuitLocal(maintenant, -6));
  const p30 = somme(L, minuitLocal(maintenant, -29), demain);
  const panier30 = { n: p30.n, eur: p30.eur, moyen: p30.n ? arrondi2(p30.eur / p30.n) : null };
  // Lundi de la semaine en cours (getDay : 0 = dimanche).
  const d = new Date(m0); const lundi = minuitLocal(m0, -((d.getDay() + 6) % 7));
  const semaines = [];
  for (let k = 11; k >= 0; k--) {
    const de = minuitLocal(lundi, -7 * k), a = minuitLocal(lundi, -7 * k + 7);
    const s = somme(L, de, a);
    semaines.push({ debut: de, n: s.n, eur: s.eur, enCours: k === 0 });
  }
  return { n: L.length, jour, moyenne, j7, j7av, panier30, semaines };
};

// Écart d'une valeur à sa référence, en % arrondi — `null` sans référence
// (« + ∞ % » ne se dit pas : rien à comparer).
export const ecartPct = (v, ref) => (ref == null || !(ref > 0) || v == null) ? null : Math.round((v - ref) / ref * 100);

// ── QUAND TU VENDS : JOUR DE LA SEMAINE ET HEURE ───────────────────────────
// Sur les 365 derniers jours. L'heure n'est comptée que si elle a été LUE : une
// date sans heure (« 2026-10-12 », Leboncoin daté à la main) tombe à minuit
// pile, heure locale — elle va dans `sansHeure`, jamais dans « 0 h ».
export const quandTuVends = (lignes, maintenant = Date.now()) => {
  if (!Array.isArray(lignes)) return null;
  const de = minuitLocal(maintenant, -364), a = minuitLocal(maintenant, 1);
  const jours = Array.from({ length: 7 }, (_, i) => ({ i, n: 0, eur: 0 }));   // 0 = lundi
  const heures = Array.from({ length: 24 }, (_, h) => ({ h, n: 0 }));
  let n = 0, sansHeure = 0, c = Array(7).fill(0);
  for (const l of lignes) {
    if (!valide(l) || l.ts < de || l.ts >= a) continue;
    const d = new Date(l.ts); n += 1;
    const j = (d.getDay() + 6) % 7; jours[j].n += 1; c[j] += Math.round(Number(l.eur) * 100);
    if (l.heureLue === false || (d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0 && d.getMilliseconds() === 0)) sansHeure += 1;
    else heures[d.getHours()].n += 1;
  }
  jours.forEach((x, i) => { x.eur = c[i] / 100; });
  return { n, jours, heures, avecHeure: n - sansHeure, sansHeure };
};

// ── BÉNÉFICE ET MARGE PAR GROUPE ───────────────────────────────────────────
// `lignes` : le relevé de l'écran Ventes, une ligne par vente FINALISÉE :
//   { plateforme, compte, ts, eur, achat (€ | null = pas su), frais (€ | null
//     = pas su), marque, modele, taille }.
// `cle(l)` → le groupe ('' = inconnu, compté dans `sansCle`). Par groupe :
//   n, ca (toutes ses ventes) ; nCout, caCouvert, cout (seulement celles au
//   prix d'achat connu) ; brut = caCouvert − cout ; net = brut − frais (null si
//   un frais n'est pas su) ; marge = brut ÷ caCouvert (en %) ; parPaire = brut
//   ÷ nCout. Sans prix d'achat connu : brut, net, marge et parPaire valent null.
export const margesPar = (lignes, cle) => {
  if (!Array.isArray(lignes)) return null;
  const par = {};
  let n = 0, nCout = 0, sansCle = 0;
  for (const l of lignes) {
    if (!valide(l)) continue;
    const k = String(cle(l) || '').trim();
    n += 1;
    const connu = l.achat != null && isFinite(Number(l.achat));
    if (connu) nCout += 1;
    if (!k) { sansCle += 1; continue; }
    const g = par[k] || (par[k] = { k, n: 0, ca: 0, nCout: 0, caCouvert: 0, cout: 0, frais: 0, fraisInconnus: 0 });
    const v = Math.round(Number(l.eur) * 100);
    g.n += 1; g.ca += v;
    if (connu) {
      g.nCout += 1; g.caCouvert += v; g.cout += Math.round(Number(l.achat) * 100);
      if (l.frais == null || !isFinite(Number(l.frais))) g.fraisInconnus += 1; else g.frais += Math.round(Number(l.frais) * 100);
    }
  }
  const groupes = Object.values(par).map((g) => {
    const brut = g.nCout ? (g.caCouvert - g.cout) / 100 : null;
    return { k: g.k, n: g.n, ca: g.ca / 100, nCout: g.nCout, caCouvert: g.caCouvert / 100, cout: g.cout / 100,
      brut, net: brut == null || g.fraisInconnus ? null : (g.caCouvert - g.cout - g.frais) / 100,
      marge: brut == null || !g.caCouvert ? null : Math.round(brut / (g.caCouvert / 100) * 1000) / 10,
      parPaire: brut == null ? null : arrondi2(brut / g.nCout) };
  }).sort((a, b) => b.n - a.n || b.ca - a.ca || (a.k < b.k ? -1 : 1));
  return { n, nCout, sansCle, groupes };
};

// ── DÉLAI DE VENTE (mise en ligne → vente) ─────────────────────────────────
// `lignes` : { ts (vente), enLigne (ms | null), eur, plateforme, marque… }.
// Une vente sans date de mise en ligne, ou datée AVANT (republiée ensuite),
// n'entre pas dans le délai : elle reste dans `n` (la couverture « sur N »).
export const TRANCHES_PRIX = [[0, 30, 'moins de 30 €'], [30, 60, '30 à 60 €'], [60, 100, '60 à 100 €'], [100, Infinity, '100 € et plus']];
export const tranchePrix = (eur) => { const x = Number(eur); if (!isFinite(x)) return ''; const t = TRANCHES_PRIX.find(([a, b]) => x >= a && x < b); return t ? t[2] : ''; };
const resumeJours = (js) => {
  if (!js.length) return { nDelai: 0, moyenne: null, mediane: null };
  const s = js.slice().sort((a, b) => a - b);
  const med = s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
  return { nDelai: s.length, moyenne: Math.round(s.reduce((a, b) => a + b, 0) / s.length * 10) / 10, mediane: Math.round(med * 10) / 10 };
};
export const delaisPar = (lignes, cle) => {
  if (!Array.isArray(lignes)) return null;
  const par = {}, tous = [];
  let n = 0;
  for (const l of lignes) {
    if (!l || !isFinite(l.ts)) continue;
    n += 1;
    const k = String(cle(l) || '').trim();
    const g = k ? (par[k] || (par[k] = { k, n: 0, js: [] })) : null;
    if (g) g.n += 1;
    const e = Number(l.enLigne);
    if (l.enLigne == null || !isFinite(e) || e <= 0 || l.ts < e) continue;
    const j = (l.ts - e) / J; tous.push(j); if (g) g.js.push(j);
  }
  const groupes = Object.values(par).map((g) => ({ k: g.k, n: g.n, ...resumeJours(g.js) }))
    .sort((a, b) => b.nDelai - a.nDelai || b.n - a.n || (a.k < b.k ? -1 : 1));
  return { n, ...resumeJours(tous), groupes };
};

// ── LE STOCK QUI DORT ──────────────────────────────────────────────────────
// `annonces` : { age (jours | null = pas su), prix (€ | null), achat (€ | null) }
// — la base de la grille Annonces. Seuils : 30, 60, 90 jours (cumulés : une
// paire à 95 j compte dans les trois). `valeur` = la somme des prix AFFICHÉS ;
// `cout` = les prix d'achat connus, avec `nCout` à côté (jamais un coût
// présenté comme complet).
export const SEUILS_DORT = [30, 60, 90];
export const stockQuiDort = (annonces) => {
  if (!Array.isArray(annonces)) return null;
  const out = { total: 0, datesConnues: 0, seuils: {} };
  for (const s of SEUILS_DORT) out.seuils[s] = { n: 0, valeur: 0, nCout: 0, cout: 0 };
  const c = {}; for (const s of SEUILS_DORT) c[s] = { v: 0, a: 0 };
  for (const a of annonces) {
    if (!a) continue;
    out.total += 1;
    if (a.age == null || !isFinite(Number(a.age))) continue;
    out.datesConnues += 1;
    for (const s of SEUILS_DORT) {
      if (Number(a.age) < s) continue;
      const b = out.seuils[s]; b.n += 1;
      if (a.prix != null && isFinite(Number(a.prix))) c[s].v += Math.round(Number(a.prix) * 100);
      if (a.achat != null && isFinite(Number(a.achat))) { b.nCout += 1; c[s].a += Math.round(Number(a.achat) * 100); }
    }
  }
  for (const s of SEUILS_DORT) { out.seuils[s].valeur = c[s].v / 100; out.seuils[s].cout = c[s].a / 100; }
  return out;
};

// ── ROTATION ET TAUX DE VENTE ──────────────────────────────────────────────
// Rotation : au rythme des ventes Vinted des 30 derniers jours, en combien de
// jours partiraient les annonces en ligne — un REPÈRE (dit comme tel), jamais
// une prévision. Sans vente sur 30 jours : `null`.
// Taux de vente du mois : ventes Vinted du mois ÷ (ventes du mois + annonces
// encore en ligne). Les deux comptes viennent de la même plateforme.
export const rotationStock = (enLigne, ventes30) => {
  if (enLigne == null || ventes30 == null || !(ventes30 > 0)) return null;
  return Math.round(Number(enLigne) / (Number(ventes30) / 30));
};
export const tauxVenteMois = (vendusMois, enLigne) => {
  if (vendusMois == null || enLigne == null) return null;
  const d = Number(vendusMois) + Number(enLigne);
  return d > 0 ? Math.round(Number(vendusMois) / d * 100) : null;
};

// ── ANNULATIONS ET RETOURS ─────────────────────────────────────────────────
// `etats` : la classe de chaque commande Vinted lue ('completed' | 'pending' |
// 'cancelled' | autre). Taux = annulées ÷ toutes les commandes lues.
export const tauxAnnulation = (etats) => {
  if (!Array.isArray(etats)) return null;
  let n = 0, annulees = 0, finalisees = 0, enCours = 0;
  for (const e of etats) { n += 1; if (e === 'cancelled') annulees += 1; else if (e === 'completed') finalisees += 1; else if (e === 'pending') enCours += 1; }
  return { n, annulees, finalisees, enCours, taux: n ? Math.round(annulees / n * 1000) / 10 : null };
};

// ── LA PÉRIODE CHOISIE : SEMAINE · MOIS · ANNÉE (31 octobre, maquette) ─────
// UNE règle de période pour tout l'écran Statistiques (tuiles, barres, modèles,
// comptes, tailles, boost) : [de, a[ en minuit LOCAL.
//   semaine : du lundi au lundi suivant ; mois : du 1er au 1er suivant ;
//   annee   : du 1er janvier au 1er janvier suivant.
// La comparaison se fait avec la période d'avant AU MÊME POINT (`prevCoupe`) :
// autant de jours écoulés et la même heure — un mois commencé ne se compare
// pas à un mois entier (le 3 octobre, « −90 % » sur septembre serait faux).
export const PERIODES = { semaine: 'Semaine', mois: 'Mois', annee: 'Année' };
export const bornesPeriode = (type, maintenant = Date.now()) => {
  const m0 = minuitLocal(maintenant), d = new Date(m0);
  const ty = PERIODES[type] ? type : 'mois';
  let de, a, prevDe;
  if (ty === 'semaine') { de = minuitLocal(m0, -((d.getDay() + 6) % 7)); a = minuitLocal(de, 7); prevDe = minuitLocal(de, -7); }
  else if (ty === 'annee') { de = new Date(d.getFullYear(), 0, 1).getTime(); a = new Date(d.getFullYear() + 1, 0, 1).getTime(); prevDe = new Date(d.getFullYear() - 1, 0, 1).getTime(); }
  else { de = new Date(d.getFullYear(), d.getMonth(), 1).getTime(); a = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime(); prevDe = new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime(); }
  const jours = Math.round((m0 - de) / J), t = new Date(maintenant), p = new Date(prevDe);
  const coupe = new Date(p.getFullYear(), p.getMonth(), p.getDate() + jours, t.getHours(), t.getMinutes(), t.getSeconds(), t.getMilliseconds()).getTime();
  return { type: ty, de, a, prevDe, prevA: de, prevCoupe: Math.min(de, coupe) };
};
export const dansBornes = (ts, de, a) => isFinite(ts) && ts >= de && ts < a;

// VENDU sur la période (les lignes de `ventesFaites`) et la période d'avant au
// même point. `null` = pas lu. `ecart` : sur le montant, `null` sans référence.
export const venduPeriode = (lignes, b) => {
  if (!Array.isArray(lignes) || !b) return null;
  const L = lignes.filter(valide).map((l) => ({ ...l, eur: Number(l.eur) }));
  const cur = somme(L, b.de, b.a), prec = somme(L, b.prevDe, b.prevCoupe);
  return { n: cur.n, eur: cur.eur, prec, ecart: ecartPct(cur.eur, prec.eur) };
};

// Numéro de semaine ISO 8601 (celle qui porte le jeudi).
export const semaineIso = (ts) => {
  const d = new Date(ts);
  const jeudi = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const premier = new Date(jeudi.getFullYear(), 0, 1);
  return 1 + Math.floor(Math.round((jeudi.getTime() - premier.getTime()) / J) / 7);
};

// Les BARRES de la période : semaine ⇒ ses 7 jours ; mois ⇒ les 8 dernières
// semaines (la maquette) ; année ⇒ ses 12 mois. `enCours` : la barre
// d'aujourd'hui ; `avenir` : une barre pas encore commencée (vide, pas « 0 »).
export const barresPeriode = (lignes, type, maintenant = Date.now()) => {
  if (!Array.isArray(lignes)) return null;
  const L = lignes.filter(valide).map((l) => ({ ...l, eur: Number(l.eur) }));
  const b = bornesPeriode(type, maintenant), out = [];
  const pousse = (de, a, extra) => { const s = somme(L, de, a); out.push({ debut: de, fin: a, n: s.n, eur: s.eur, enCours: maintenant >= de && maintenant < a, avenir: de > maintenant, ...(extra || {}) }); };
  if (b.type === 'semaine') for (let k = 0; k < 7; k++) pousse(minuitLocal(b.de, k), minuitLocal(b.de, k + 1));
  else if (b.type === 'annee') { const y = new Date(b.de).getFullYear(); for (let m = 0; m < 12; m++) pousse(new Date(y, m, 1).getTime(), new Date(y, m + 1, 1).getTime()); }
  else {
    const m0 = minuitLocal(maintenant), d = new Date(m0), lundi = minuitLocal(m0, -((d.getDay() + 6) % 7));
    for (let k = 7; k >= 0; k--) { const de = minuitLocal(lundi, -7 * k); pousse(de, minuitLocal(de, 7), { semaine: semaineIso(de) }); }
  }
  return out;
};

// Combien de ventes (et quel montant) par groupe — pour « Par compte » : les
// MÊMES lignes que la tuile « Vendu », donc la somme des comptes = la tuile.
export const ventesPar = (lignes, cle) => {
  if (!Array.isArray(lignes)) return null;
  const par = {}; let sansCle = 0;
  for (const l of lignes) {
    if (!valide(l)) continue;
    const k = String(cle(l) || '').trim();
    if (!k) { sansCle += 1; continue; }
    const g = par[k] || (par[k] = { k, n: 0, c: 0 });
    g.n += 1; g.c += Math.round(Number(l.eur) * 100);
  }
  return { sansCle, groupes: Object.values(par).map((g) => ({ k: g.k, n: g.n, eur: g.c / 100 })).sort((a, b) => b.n - a.n || b.eur - a.eur || (a.k < b.k ? -1 : 1)) };
};

// « Ce qui part vite » : les groupes de `delaisPar` qui ont au moins une vente
// datée, du plus court au plus long (médiane), à égalité le plus vendu d'abord.
export const plusRapides = (D, max = 5) => {
  if (!D || !Array.isArray(D.groupes)) return null;
  return D.groupes.filter((g) => g.nDelai > 0 && g.mediane != null)
    .sort((a, b) => a.mediane - b.mediane || b.nDelai - a.nDelai || (a.k < b.k ? -1 : 1)).slice(0, max);
};
