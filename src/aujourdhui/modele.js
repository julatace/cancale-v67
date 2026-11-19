// ════════════════════════════════════════════════════════════════════════════
//  « AUJOURD'HUI » — LE FOND (19 nov., Julien : « il y a d'autres choses plus intéressantes pour cet onglet »).
//  Ce module ne CALCULE aucun chiffre et ne connaît aucune règle de vente : il DEMANDE chaque valeur à son
//  propriétaire (§5 de CLAUDE.md, « une seule règle par notion ») et range les réponses dans un modèle que l'écran
//  dessine. Pur (aucun React, aucune lecture) : exécuté tel quel par scripts/audit-aujourdhui.cjs.
//
//    chiffresAujourdhui  le vendu du jour, les sept jours, le mois (Vendu · Reçu · Bénéfice), l'argent à venir —
//                        par `valeur(id, periode)` = `valeurChiffre` (src/design/carteChiffres.js) sur les sources de
//                        la carte des chiffres, les MÊMES appels que l'écran Argent (`ArgentMoisV2`) ;
//    jourMontre          quel jour dit le grand chiffre (aujourd'hui s'il a vendu, sinon le dernier jour utile) ;
//    dernieresVentes     les N dernières lignes de « Vendu » (`ventesFaites`), par leur identité `plateforme:tx` ;
//    alerteDuJour        AU PLUS une alerte : une date limite LUE qui tombe aujourd'hui ou demain (ou déjà passée) —
//                        jamais une limite ESTIMÉE (vente + 7 j n'est qu'un plancher, §5).
//  Trois états partout : 'encours' (lecture) · 'passu' (« — » et la raison, jamais 0) · 'lu'.
// ════════════════════════════════════════════════════════════════════════════

const JOUR_MS = 86400000;

// Les sept derniers jours (heure locale, minuit → minuit), le plus ancien d'abord, aujourd'hui en dernier.
// Par dates (jamais +24 h) : un passage à l'heure d'hiver ne décale aucun jour.
export function septJours(maintenant = Date.now()) {
  const minuit = new Date(maintenant); minuit.setHours(0, 0, 0, 0);
  return [6, 5, 4, 3, 2, 1, 0].map((k) => {
    const d = new Date(minuit); d.setDate(d.getDate() - k);
    const f = new Date(d); f.setDate(f.getDate() + 1);
    return { k, de: d.getTime(), a: f.getTime(), cle: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, auj: k === 0 };
  });
}

// Le jour que dit le grand chiffre : aujourd'hui s'il y a du vendu aujourd'hui, sinon le dernier des sept où il a
// vendu (« le dernier chiffre utile », la règle de la frise du 9 nov.), sinon aujourd'hui. Rend son rang (0…6).
export function jourMontre(jours) {
  const n = jours.length; if (!n) return -1;
  if (jours[n - 1].v > 0) return n - 1;
  for (let i = n - 2; i >= 0; i--) if (jours[i].v > 0) return i;
  return n - 1;
}

// `valeur(id, periode)` → { valeur | null, partiel, manque, raison, B?, aDater? } (le résultat de `valeurChiffre`).
// `etatVendu` : 'lu' | 'pasSu' | 'encours' (`venduEtat` de la coque). `questions` = `questionsArgent` (src/argent.js) ;
// `chiffreBrut` = la règle du brut (src/beneficeNoms.js) ; `raisonCourte` = la raison d'un « — » (carteChiffres.js).
export function chiffresAujourdhui({ valeur, etatVendu = 'encours', sansCompte = false, maintenant = Date.now(), raisonCourte = () => '', questions, chiffreBrut, mois = '' }) {
  const etat = sansCompte ? 'passu' : etatVendu === 'lu' ? 'lu' : etatVendu === 'pasSu' ? 'passu' : 'encours';
  const jours = septJours(maintenant).map((j) => {
    const p = { de: j.de, a: j.a, label: '' };
    const V = valeur('vendu', p) || {}, N = valeur('ventes', p) || {};
    return { ...j, v: V.valeur == null ? null : V.valeur, n: N.valeur == null ? null : N.valeur, partiel: !!V.partiel, raison: V.valeur == null ? (raisonCourte(V) || '') : '' };
  });
  const auj = jours[jours.length - 1];
  const raison = etat === 'passu' ? (raisonCourte(valeur('vendu', 'jour') || {}) || '') : (auj.raison || '');
  const vMois = { vendu: valeur('vendu', 'mois'), recu: valeur('recu', 'mois'), benefice: valeur('benefice', 'mois') };
  const Q = questions({ vendu: vMois.vendu, recu: vMois.recu, benefice: vMois.benefice, prevision: null, profil: null, raisonCourte, mois, dateCourte: (t) => String(t) });
  const q = (id) => Q.find((x) => x.id === id) || { valeur: null, partiel: false, note: '' };
  const cas = (id) => ({ valeur: q(id).valeur == null ? null : q(id).valeur, partiel: !!q(id).partiel, note: q(id).note || '' });
  // Le bénéfice : la règle de la case d'Argent — le net ; sinon le brut des ventes au prix connu, AVEC sa couverture
  // (« k ventes sur n »). Jamais « au moins » devant un bénéfice (§5).
  const Bn = vMois.benefice && vMois.benefice.B ? vMois.benefice.B : null;
  const manquent = Bn && Bn.n > Bn.nCout ? Bn.n - Bn.nCout : 0;
  const qB = q('benefice');
  const brut = qB.valeur == null && Bn && Bn.nCout > 0 && manquent > 0 ? chiffreBrut({ n: Bn.n, nCout: Bn.nCout, brut: Bn.brut }) : null;
  const benefice = brut && brut.valeur != null
    ? { valeur: brut.valeur, partiel: false, note: '', brut: true, couverture: { k: Bn.nCout, n: Bn.n } }
    : { valeur: qB.valeur == null ? null : qB.valeur, partiel: false, note: qB.note || '', brut: false, couverture: null };
  const at = valeur('attente', 'mois');
  return { etat, raison, jours, montre: jourMontre(jours), mois: { vendu: cas('vendu'), recu: cas('recu'), benefice },
    aVenir: at && at.valeur != null ? { valeur: at.valeur, partiel: !!at.partiel } : null };
}

// (19 nov., Julien : « je veux peut-être plus de stats dans l'onglet Ma journée, par exemple le CA, le bénéfice etc. »)
// LES CHIFFRES D'UNE PÉRIODE — Jour · Semaine · Mois : CA vendu, bénéfice, nombre de ventes, panier moyen, et l'écart du
// vendu avec la période d'avant AU MÊME MOMENT (hier à la même heure, la semaine dernière au même jour…). Aucune règle
// neuve : chaque valeur est DEMANDÉE à `valeur(id, période)` (= `valeurChiffre`, les mêmes appels que l'écran Argent) :
//   vendu / ventes  `ventesFaites` (date de vente, toutes plateformes) — « au moins » si un prix n'est pas lu ;
//   bénéfice        le mois : celui de la case d'Argent (`beneficeMois`, le net, sinon le brut et sa couverture) ;
//                   le jour, la semaine : `brut` (la publication `vrm_benefice_jours`, sa couverture si des prix
//                   d'achat manquent) — le bénéfice net ne se calcule qu'au mois (règle de l'URSSAF) ;
//   panier moyen    le vendu divisé par le nombre de ventes, SEULEMENT si les deux sont lus en entier (une moyenne sur
//                   une partie des ventes n'est pas un minimum : « — », la règle du panier de la carte) ;
//   écart           seulement entre deux vendus lus en entier, et une période d'avant qui a vendu (pas de « +∞ % »).
// `precedente(p)` → { de, a } : la période d'avant, coupée au même moment (fourni par l'app : ses règles de période).
export const PERIODES_STATS = ['jour', 'semaine', 'mois'];
export function statsPeriodes({ valeur, precedente = null, raisonCourte = () => '', beneficeMois = null }) {
  const lu = (x) => !!x && x.valeur != null;
  const out = {};
  for (const p of PERIODES_STATS) {
    const V = valeur('vendu', p) || {}, N = valeur('ventes', p) || {};
    const vendu = { valeur: lu(V) ? V.valeur : null, partiel: lu(V) && !!V.partiel, note: lu(V) ? '' : (raisonCourte(V) || '') };
    const ventes = { valeur: lu(N) ? N.valeur : null, partiel: lu(N) && !!N.partiel, note: lu(N) ? '' : (raisonCourte(N) || '') };
    const entier = (x) => x.valeur != null && !x.partiel;
    const panier = entier(vendu) && entier(ventes) && ventes.valeur > 0
      ? { valeur: Math.round((vendu.valeur / ventes.valeur) * 100) / 100, note: '' }
      : { valeur: null, note: entier(ventes) && ventes.valeur === 0 ? 'aucune' : (vendu.partiel || ventes.partiel) ? 'partiel' : (vendu.note || ventes.note) };
    let benefice;
    if (p === 'mois' && beneficeMois) {
      const c = beneficeMois.couverture;
      benefice = { valeur: beneficeMois.valeur == null ? null : beneficeMois.valeur, brut: !!beneficeMois.brut, partiel: !!c, couverture: c ? `${c.k}/${c.n}` : '', note: beneficeMois.note || '' };
    } else {
      const Bb = valeur('brut', p) || {};
      const m = /^(\d+) sur (\d+)$/.exec(String(Bb.couverture || ''));
      benefice = lu(Bb) ? { valeur: Bb.valeur, brut: true, partiel: !!Bb.partiel, couverture: m ? `${m[1]}/${m[2]}` : '', note: '' } : { valeur: null, brut: true, partiel: false, couverture: '', note: raisonCourte(Bb) || '' };
    }
    let ecart = null;
    if (entier(vendu) && typeof precedente === 'function') {
      const P = valeur('vendu', precedente(p)) || {};
      if (lu(P) && !P.partiel && P.valeur > 0) ecart = Math.round(((vendu.valeur - P.valeur) / P.valeur) * 100);
    }
    out[p] = { vendu, ventes, panier, benefice, ecart };
  }
  return out;
}

// Les N dernières ventes : les lignes de « Vendu » datées et identifiées, la plus récente d'abord. Une ligne sans
// date ou sans identité n'y est pas (jamais un titre comme identité, §5) ; deux lignes de même identité : une seule.
export function dernieresVentes(lignes, n = 5) {
  if (!Array.isArray(lignes)) return null;                 // pas su ≠ aucune
  const vus = new Set(), out = [];
  for (const l of [...lignes].filter((x) => x && Number.isFinite(Number(x.ts)) && x.tx != null && String(x.tx) !== '' && x.plateforme).sort((a, b) => Number(b.ts) - Number(a.ts))) {
    const cle = l.plateforme + ':' + l.tx; if (vus.has(cle)) continue; vus.add(cle);
    out.push({ cle, plateforme: l.plateforme, tx: String(l.tx), ts: Number(l.ts), eur: l.eur, compte: l.compte || '' });
    if (out.length >= n) break;
  }
  return out;
}

// AU PLUS UNE ALERTE. Dans l'ordre : un colis à poster (limite LUE en retard, aujourd'hui ou demain), un colis à
// retirer qui presse (`urgents` : la règle du point ambre d'« À retirer »), un retour à déposer (limite lue ≤ 1 j).
//   aPoster : les colis de `toShip` ({ at, limite: 'email' | 'estimee', retard, depasse, daysLeft }) ;
//   urgentsRetrait : un nombre, ou null = pas su ; retours : [{ limiteJour }] ; joursAvant(jour) → jours restants.
export function alerteDuJour({ aPoster = [], urgentsRetrait = null, retours = [], joursAvant = () => null } = {}) {
  const lus = (aPoster || []).filter((t) => t && t.at != null && t.limite !== 'estimee' && (t.retard || (!t.depasse && Number.isFinite(t.daysLeft) && t.daysLeft <= 1)))
    .sort((a, b) => (b.retard ? 1 : 0) - (a.retard ? 1 : 0) || a.at - b.at);
  if (lus.length) return { id: 'poster', n: lus.length, premier: lus[0] };
  if (Number(urgentsRetrait) > 0) return { id: 'retirer', n: Number(urgentsRetrait), premier: null };
  const rA = (retours || []).filter((c) => { const j = c && c.limiteJour ? joursAvant(c.limiteJour) : null; return j != null && j >= 0 && j <= 1; });
  if (rA.length) return { id: 'retour', n: rA.length, premier: rA[0] };
  return null;
}

export const _interne = { JOUR_MS };
