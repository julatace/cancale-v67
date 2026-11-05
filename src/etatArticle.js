// ── « VOIR L'ÉTAT » D'UN ARTICLE : TOUT CE QUI SE CALCULE (5 nov. 2026) ──────
// Julien : « de vraies stats, tout ce qui est calculable, on le calcule » —
// prix d'achat (achat relié), temps achat → vente, réception → mise en ligne,
// mise en ligne → vente, nombre de republications.
//
// ⚠️ CHAQUE NOMBRE VIENT DE DEUX DATES LUES, jamais d'une date supposée :
//    achat      = la date de l'achat RELIÉ (`buyFrom.date`, posé par SON lien,
//                 par le n° de transaction — l'événement « achat » de
//                 `histoireArticle`) ;
//    réception  = `dateReception` (src/achatsSourcing.js) : « Commande livrée »
//                 dans la transaction de CET achat, sinon « Récupéré » touché par
//                 lui sur ce colis — la même règle que Achats → délai ;
//    mise en ligne = la date Vinted de l'annonce (`created_at_ts`, la règle
//                 `dateMiseEnLigneMs`), la première vue par VRM (coffre), eBay
//                 `depuis` — la plus ancienne connue ;
//    vente      = la date de la vente retenue par `histoireArticle` (la plus
//                 récente qui n'est pas annulée — une revente après un retour).
// ⚠️ « PAS SU » N'EST PAS « RIEN » : une source non lue ⇒ `jours: null` et la
//    raison (l'écran écrit « — ») ; `undefined` = lecture en cours.
// ⚠️ UNE PAIRE REPUBLIÉE dont l'annonce d'origine n'a pas de date lue : sa
//    première mise en ligne est PLUS ANCIENNE que celle qu'on connaît ⇒ « au
//    moins » pour mise en ligne → vente, « au plus » pour réception → mise en
//    ligne. Jamais un chiffre présenté comme exact quand il ne l'est pas.
// ⚠️ Deux dates dans le désordre (vente avant l'achat…) : rien n'est calculé,
//    c'est dit.
// Module PUR : l'écran (FichePaire.jsx) et `scripts/audit-stock-2d.cjs`.

const J = 86400000;
const t = (v) => {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? (v < 1e12 ? v * 1000 : v) : null;
  const x = Date.parse(v); return Number.isFinite(x) ? x : null;
};
const str = (v) => String(v == null ? '' : v).trim();

// Une durée entre deux dates lues. `borne` : null (exacte) · 'au-moins' ·
// 'au-plus' · 'depuis' (pas encore vendue : compté jusqu'à maintenant) ·
// 'depuis-au-moins' (pas encore vendue, et la 1re mise en ligne est plus ancienne).
function duree(de, a, borne = null) {
  if (de == null || a == null) return null;
  if (a < de) return { jours: null, raison: 'dates dans le désordre — rien de calculé' };
  return { jours: Math.floor((a - de) / J), borne };
}

// p : le résultat de `histoireArticle` (étapes `achat`, `annonces`, `vente`).
// x : {
//   fiches     { [idAnnonce]: fiche } | null   (null = pas lues)
//   ids        [idAnnonce] — les annonces qui portent CE N° (par identité)
//   crees      { [idAnnonce]: ms } | null | undefined — dates Vinted lues
//   reception  { ms, source } | null | undefined — `dateReception` de l'achat relié
//   receptionRaison  texte quand `reception` est null
//   maintenant ms
// }
export function etatArticle(p, x = {}) {
  if (!p || !Array.isArray(p.etapes)) return null;
  const now = Number.isFinite(x.maintenant) ? x.maintenant : Date.now();
  const etape = (cle) => p.etapes.find((e) => e.cle === cle) || null;
  const evs = (e) => (e && Array.isArray(e.evenements) ? e.evenements : []);
  const fiches = x.fiches === undefined ? null : x.fiches;
  const ids = (Array.isArray(x.ids) ? x.ids : []).map(String);

  // ── PRIX D'ACHAT ─────────────────────────────────────────────────────────
  const eA = etape('achat');
  const evA = evs(eA)[0] || null;
  const relie = !!(evA && /^achat n°/.test(str(evA.preuve)));
  const cents = p.resume && Number.isFinite(p.resume.achat) ? p.resume.achat : null;
  const prixAchat = !eA || eA.etat === 'passu'
    ? { cents: null, source: null, raison: (eA && eA.detail) || 'tes fiches pas encore lues' }
    : cents == null
      ? { cents: null, source: null, raison: eA.etat === 'absent' ? 'prix d’achat pas saisi, aucun achat relié' : 'prix de l’achat relié pas lu' }
      : { cents, source: relie ? 'relie' : 'saisi', raison: '' };
  const dAchat = relie || (evA && evA.at) ? t(evA && evA.at) : null;

  // ── VENTE ────────────────────────────────────────────────────────────────
  const eV = etape('vente');
  const datesV = evs(eV).map((e) => t(e.at)).filter((v) => v != null);
  const vendue = !!(eV && eV.etat === 'fait' && evs(eV).length);
  const venteSu = !!eV && eV.etat !== 'passu';
  const dVente = datesV.length ? Math.max(...datesV) : null;

  // ── MISE EN LIGNE (la plus ancienne connue) ──────────────────────────────
  const crees = x.crees;
  const dateDe = (id) => {
    const c = crees && crees[id] != null ? t(crees[id]) : null; if (c != null) return c;
    const ev = evs(etape('annonces')).find((e) => str(e.preuve) === `annonce ${id}` && e.cle === 'en-ligne' && e.at);
    return ev ? t(ev.at) : null;
  };
  const datesL = [];
  for (const id of ids) { const d = dateDe(id); if (d != null) datesL.push(d); }
  for (const e of evs(etape('annonces'))) if (e.cle === 'ebay' || e.cle === 'leboncoin' || e.cle === 'vestiaire') { const d = t(e.at); if (d != null) datesL.push(d); }
  // Une republication dont l'annonce d'origine n'a aucune date lue ⇒ partiel.
  let partiel = false;
  if (fiches) for (const id of ids) { const f = fiches[id]; const anc = f && str(f.recreeDe); if (anc && dateDe(anc) == null) partiel = true; }
  const dLigne = datesL.length ? Math.min(...datesL) : null;
  const eL = etape('annonces');
  const jamaisEnLigne = !!(eL && eL.etat === 'absent');
  const raisonLigne = crees === undefined ? undefined
    : !ids.length && !datesL.length ? (jamaisEnLigne ? 'pas encore mise en ligne' : 'aucune annonce lue pour ce N°')
    : crees === null ? 'dates de mise en ligne pas lues' : 'date de mise en ligne pas écrite par Vinted';

  // ── RÉCEPTION ────────────────────────────────────────────────────────────
  const rec = x.reception;
  const dRec = rec && Number.isFinite(rec.ms) ? rec.ms : null;
  const raisonRec = rec === undefined ? undefined : (!relie ? 'achat pas relié à cette paire' : (x.receptionRaison || 'réception pas lue (ni « livrée » dans la transaction, ni « Récupéré » touché)'));

  const lignes = [];
  const pose = (cle, titre, res, raison) => lignes.push(res && res.jours !== undefined ? { cle, titre, ...res, raison: res.raison || '' } : { cle, titre, jours: raison === undefined ? undefined : null, borne: null, raison: raison || '' });

  // 1. ACHAT → VENTE
  if (!venteSu) pose('achat-vente', 'Achat → vente', null, (eV && eV.detail) || 'tes ventes pas toutes lues');
  else if (dAchat == null) pose('achat-vente', 'Achat → vente', null, relie ? 'date de l’achat pas écrite' : 'achat pas relié à cette paire');
  else if (vendue) pose('achat-vente', 'Achat → vente', dVente != null ? duree(dAchat, dVente) : null, 'date de vente pas lue');
  else pose('achat-vente', 'Achat → vente', duree(dAchat, now, 'depuis'), '');

  // 2. RÉCEPTION → MISE EN LIGNE
  if (dRec == null) pose('reception-en-ligne', 'Réception → mise en ligne', null, raisonRec);
  else if (dLigne == null) pose('reception-en-ligne', 'Réception → mise en ligne', jamaisEnLigne ? duree(dRec, now, 'depuis') : null, raisonLigne);
  else pose('reception-en-ligne', 'Réception → mise en ligne', duree(dRec, dLigne, partiel ? 'au-plus' : null), '');

  // 3. MISE EN LIGNE → VENTE
  if (dLigne == null) pose('en-ligne-vente', 'Mise en ligne → vente', null, raisonLigne);
  else if (!venteSu) pose('en-ligne-vente', 'Mise en ligne → vente', null, (eV && eV.detail) || 'tes ventes pas toutes lues');
  else if (vendue) pose('en-ligne-vente', 'Mise en ligne → vente', dVente != null ? duree(dLigne, dVente, partiel ? 'au-moins' : null) : null, 'date de vente pas lue');
  else pose('en-ligne-vente', 'Mise en ligne → vente', duree(dLigne, now, partiel ? 'depuis-au-moins' : 'depuis'), '');

  // ── REPUBLICATIONS (vues par VRM : table de recréation par identité) ─────
  const republications = fiches == null
    ? { n: null, raison: 'tes fiches pas encore lues' }
    : { n: ids.filter((id) => fiches[id] && str(fiches[id].recreeDe)).length, raison: '' };

  return { prixAchat, lignes, republications, partiel, vendue };
}

// Le texte d'une durée, une règle pour l'écran et le banc.
export function texteDuree(l) {
  if (!l || l.jours === undefined) return '…';
  if (l.jours == null) return '—';
  const n = l.jours === 0 ? (l.borne === 'depuis' ? 'aujourd’hui' : 'le jour même') : `${l.jours}\u00a0j`;
  if (l.borne === 'au-moins') return `au moins ${n}`;
  if (l.borne === 'au-plus') return `au plus ${n}`;
  if (l.borne === 'depuis') return l.jours === 0 ? 'depuis aujourd’hui' : `depuis ${n}`;
  if (l.borne === 'depuis-au-moins') return `depuis au moins ${l.jours === 0 ? 'aujourd’hui' : n}`;
  return n;
}
