// ════════════════════════════════════════════════════════════════════════════
//  STATISTIQUES · PILOTAGE ET FINANCES (21 nov., lot journee-stats) — Julien : « je veux que tu proposes beaucoup plus de
//  statistiques […] de la vraie data », « toujours dans le style Vintex », puis « toute l'application doit être simplifiée
//  et ergonomique » : le détail vit dans Statistiques, deux segments (Pilotage · Finances) et une période 7 j · 30 j · 90 j.
//  Ce module est PUR (aucun React, aucune lecture) et il est LE PROPRIÉTAIRE des seules règles neuves de ce lot :
//    fenetre            les bornes [de, a) d'une fenêtre glissante de 7, 30 ou 90 jours finissant maintenant ;
//    gestesFenetre      les gestes ACCEPTÉS de VRM sur la fenêtre (la règle de « Ce que VRM a fait » : `gestesVrmEntre`),
//                       dont automatiques (`auto === true`, noté par l'extension) ;
//    tempsGagneFenetre  ces gestes × la durée de RÉFÉRENCE de leur type (src/accueil/tempsGagne.js `secondesGeste`) —
//                       une ESTIMATION, dite ; un type sans durée ne compte pas et c'est dit (« sur N gestes ») ;
//    serieActivite      les jours d'affilée, jusqu'à aujourd'hui (ou hier si rien encore aujourd'hui), où VRM a fait
//                       au moins un geste accepté ;
//    joursFenetre       les jours de la fenêtre (minuit → minuit), pour les barres « Activité quotidienne » ;
//    favorisVersVentes  « Messages aux favoris » : envoyés (gestes favori acceptés), puis les ANNONCES vendues dans les
//                       14 jours après un message, reliées PAR IDENTITÉ (l'identifiant d'annonce du message = celui de la
//                       transaction de la vente), jamais par titre (§5) ;
//    dernierGeste       le geste accepté le plus récent de VRM (la carte « VRM vient de … ») ;
//    parPlateforme      CA et ventes par site sur la fenêtre (chaque nombre DEMANDÉ au propriétaire `valeurChiffre`).
//  Tout le reste (vendu, ventes, panier, bénéfice brut, délai, marge, marques, comptes) est DEMANDÉ à son propriétaire :
//  src/design/carteChiffres.js `valeurChiffre`, src/statsVentes.js, src/aujourdhui/modele.js. Trois états : `undefined`
//  en lecture · `null` pas su (« — » et la raison) · valeur.
// ════════════════════════════════════════════════════════════════════════════
import { gestesVrmEntre, heureEvenement, statsPeriodes, releveParPeriode, parCompteEtSite } from './modele.js';
import { secondesGeste } from '../accueil/tempsGagne.js';

const JOUR = 86400000;
export const FENETRES = ['7', '30', '90'];
export const SEGMENTS_STATS = ['pilotage', 'finances', 'transporteurs'];
// Les bornes d'une fenêtre : du minuit d'il y a (n − 1) jours jusqu'à demain minuit (aujourd'hui compris en entier).
export function fenetre(cle, maintenant = Date.now()) {
  const n = Number(cle) || 30;
  const fin = new Date(maintenant); fin.setHours(0, 0, 0, 0); fin.setDate(fin.getDate() + 1);
  const de = new Date(fin); de.setDate(de.getDate() - n);
  return { de: de.getTime(), a: fin.getTime(), n, label: '' };
}
export function joursFenetre(cle, maintenant = Date.now()) {
  const F = fenetre(cle, maintenant); const out = [];
  for (let d = new Date(F.de); d.getTime() < F.a; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
    const f = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    out.push({ de: d.getTime(), a: f.getTime(), cle: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` });
  }
  return out;
}

export function gestesFenetre(evenements, cle, maintenant = Date.now()) {
  const F = fenetre(cle, maintenant);
  const L = gestesVrmEntre(evenements, F.de, Math.min(F.a, maintenant + 60000));
  if (!L) return null;
  return { n: L.length, auto: L.filter((e) => e.auto === true).length };
}

export function tempsGagneFenetre(evenements, cle, maintenant = Date.now()) {
  const F = fenetre(cle, maintenant);
  const L = gestesVrmEntre(evenements, F.de, Math.min(F.a, maintenant + 60000));
  if (!L) return null;
  let s = 0, k = 0;
  for (const e of L) { const x = secondesGeste(e.type); if (x != null) { s += x; k += 1; } }
  return { minutes: Math.round(s / 60), nCompte: k, n: L.length };
}

export function serieActivite(evenements, maintenant = Date.now()) {
  if (!Array.isArray(evenements)) return null;
  const minuit = new Date(maintenant); minuit.setHours(0, 0, 0, 0);
  const actif = (d) => { const f = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1); const L = gestesVrmEntre(evenements, d.getTime(), f.getTime()); return !!L && L.length > 0; };
  let d = new Date(minuit);
  if (!actif(d)) d = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);
  let n = 0;
  while (n < 400 && actif(d)) { n += 1; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1); }
  return { jours: n, aujourdhui: actif(minuit) };
}

// L'activité de chaque jour : ventes et CA (DEMANDÉS à `valeur`), gestes de VRM (journal). Pas su ⇒ null par série.
export function activiteParJour({ cle, valeur, evenements, maintenant = Date.now() }) {
  return joursFenetre(cle, maintenant).map((j) => {
    const p = { de: j.de, a: j.a, label: '' };
    const V = valeur('vendu', p) || {}, N = valeur('ventes', p) || {};
    const G = gestesVrmEntre(evenements, j.de, j.a);
    return { ...j, ca: V.valeur == null ? null : V.valeur, caPartiel: !!V.partiel, ventes: N.valeur == null ? null : N.valeur, gestes: G ? G.length : null };
  });
}

// `lignes` : les lignes de « Vendu » (`ventesFaites` : { plateforme, tx, ts }) ; `itemDeTx(tx)` → l'identifiant de
// l'annonce de CETTE transaction (le détail de transaction lu, `lireExtrasRepartition`) ou null. Pas su ⇒ null.
export const DELAI_FAVORI_VENTE_J = 14;
export function favorisVersVentes({ evenements, lignes, itemDeTx, cle, maintenant = Date.now() }) {
  if (!Array.isArray(evenements)) return null;
  const F = fenetre(cle, maintenant);
  const msg = evenements.filter((e) => e && e.resultat === 'ok' && (e.type === 'favori' || e.type === 'favori_offre')).map((e) => ({ t: heureEvenement(e.at), item: e.cle && e.cle.item ? String(e.cle.item) : '', offre: e.type === 'favori_offre' }))
    .filter((m) => m.t != null && m.t >= F.de && m.t < F.a);
  const envoyes = msg.length, avecOffre = msg.filter((m) => m.offre).length;
  const relies = msg.filter((m) => m.item);
  if (!Array.isArray(lignes) || typeof itemDeTx !== 'function') return { envoyes, avecOffre, relies: relies.length, annonces: new Set(relies.map((m) => m.item)).size, ventes: null, taux: null };
  const premier = new Map();
  for (const m of relies) if (!premier.has(m.item) || m.t < premier.get(m.item)) premier.set(m.item, m.t);
  const vendues = new Set();
  for (const l of lignes) {
    if (!l || l.plateforme !== 'Vinted' || l.tx == null) continue;
    const it = itemDeTx(String(l.tx)); if (!it || !premier.has(String(it))) continue;
    const t0 = premier.get(String(it)), ts = Number(l.ts);
    if (Number.isFinite(ts) && ts >= t0 && ts <= t0 + DELAI_FAVORI_VENTE_J * JOUR) vendues.add(String(it));
  }
  const annonces = premier.size;
  return { envoyes, avecOffre, relies: relies.length, annonces, ventes: vendues.size, taux: annonces > 0 ? Math.round((vendues.size / annonces) * 100) : null };
}

export function dernierGeste(evenements, maintenant = Date.now()) {
  const L = gestesVrmEntre(evenements, 0, maintenant + 60000);
  if (!L) return null;
  let best = null;
  for (const e of L) { const t = heureEvenement(e.at); if (best == null || t > best.t) best = { t, type: e.type, compte: e.compte || '', auto: e.auto === true, site: e.site || '' }; }
  return best;
}

const PLATEFORMES = [['Vinted', 'vinted'], ['Leboncoin', 'leboncoin'], ['eBay', 'ebay'], ['Vestiaire', 'vestiaire']];
export function parPlateforme({ valeur, p }) {
  return PLATEFORMES.map(([nom, site]) => {
    const sel = { site, compte: null, periode: null };
    const V = valeur('vendu', p, sel) || {}, N = valeur('ventes', p, sel) || {};
    return { cle: site, nom, v: V.valeur == null ? null : V.valeur, vp: !!V.partiel, n: N.valeur == null ? null : N.valeur };
  }).filter((x) => (x.n || 0) > 0 || (x.v || 0) > 0).sort((a, b) => (b.v || 0) - (a.v || 0));
}

// LE MODÈLE DE L'ÉCRAN, pour une fenêtre : tout ce que Statistiques dessine, rien de calculé dans l'écran.
// `valeur(id, p, sel?)` = `valeurChiffre` ; `releve` = les lignes de Statistiques (ou null) ; `regles` : { delaisPar, margesPar }.
export function statsFenetre({ cle, valeur, evenements, lignes, itemDeTx, releve, regles, enLigne = null, dorment = null, raisonCourte = () => '', maintenant = Date.now() }) {
  const F = fenetre(cle, maintenant);
  const P = { [cle]: F };
  const chiffres = statsPeriodes({ valeur: (id, k) => valeur(id, P[k] || k), periodes: [cle], raisonCourte })[cle];
  const R = Array.isArray(releve) ? releveParPeriode({ lignes: releve, bornes: (k) => P[k] || null, delaisPar: regles.delaisPar, margesPar: regles.margesPar, periodes: [cle] })[cle] : (releve === undefined ? undefined : null);
  const ecoulement = chiffres.ventes.valeur != null && !chiffres.ventes.partiel && enLigne && enLigne.valeur > 0 ? { pct: Math.round((chiffres.ventes.valeur / enLigne.valeur) * 100), ventes: chiffres.ventes.valeur, enLigne: enLigne.valeur } : null;
  const comptes = parCompteEtSite({ lignes, valeur: (id, k, sel) => valeur(id, P[k] || k, sel), periodes: [cle] });
  const jours = activiteParJour({ cle, valeur, evenements, maintenant });
  return {
    cle, n: F.n, chiffres, releve: R, ecoulement, dorment,
    comptes: comptes ? comptes[cle] : null,
    plateformes: Array.isArray(lignes) ? parPlateforme({ valeur, p: F }) : null,
    gestes: gestesFenetre(evenements, cle, maintenant),
    temps: tempsGagneFenetre(evenements, cle, maintenant),
    serie: serieActivite(evenements, maintenant),
    favoris: favorisVersVentes({ evenements, lignes, itemDeTx, cle, maintenant }),
    dernier: dernierGeste(evenements, maintenant),
    jours,
    // (21 nov., captures de Julien : « barres sans repère ») L'ÉCHELLE de chaque série (sa barre la plus haute) : dite sous
    // ses barres, avec le premier et le dernier jour. Une série sans aucune valeur lue n'a pas d'échelle (null).
    echelles: Object.fromEntries(['ventes', 'ca', 'gestes'].map((k) => { const v = jours.map((j) => j[k]).filter((x) => x != null); return [k, v.length ? Math.max(0, ...v) : null]; })),
  };
}
