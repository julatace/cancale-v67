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
