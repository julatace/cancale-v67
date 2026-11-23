// ════════════════════════════════════════════════════════════════════════════
//  LE CONSEILLER SANS IA (23 nov., Julien : « on doit vraiment avoir un agent intégré dans l'app qui conseille »).
//  docs/passation/2026-11-23-conseiller.md — tranche 1 : gratuit, pour tous, sur SES données.
//  PUR : aucun React, aucune lecture, aucune écriture. Il ne calcule AUCUN chiffre neuf de vente ou d'argent : il reçoit
//  les sorties des PROPRIÉTAIRES (§5 « une seule règle par notion » — rassemblées par src/conseiller/sources.js, la même
//  fonction pour la carte d'Aujourd'hui, l'écran Conseiller et le contexte de « Demande à VRM ») et décide QUOI dire.
//  Seule règle propre : le jour de la semaine où ses ventes partent (un comptage des dates de vente LUES).
//  Chaque conseil : { id, rang, ton, params, geste } — le texte est `tr('cons.' + id + '.titre' | '.preuve', params)`.
//  ⚠️ UN CONSEIL SANS DONNÉES SUFFISANTES NE S'AFFICHE PAS : une source `null` (pas su) ou `undefined` (en lecture) ne
//     produit rien ; jamais un conseil deviné, jamais un « 0 » pris pour un fait.
//  ⚠️ §3 (refus du 11 oct., ne pas reproposer) : aucun prix conseillé à la MISE EN LIGNE, aucun badge « bonne affaire »,
//     aucune saisonnalité (aucun mois, aucune année comparés : un jour de la SEMAINE seulement), aucun « acheteur fidèle »
//     (aucun acheteur lu), aucune alerte « achat jamais arrivé », « argent bloqué », messages sans réponse, évaluations.
//  ⚠️ Rien ne part d'ici : le geste OUVRE l'écran VRM où il le fait lui-même (accepter une offre : son clic, §3).
// ════════════════════════════════════════════════════════════════════════════

const JOUR = 86400000;
// Les seuils, nommés (le banc les relit) : en dessous, le conseil se tait.
export const SEUILS = Object.freeze({
  rachatMin: 3,          // ventes reliées ET datées d'un groupe (la règle de quoiRacheter, MIN_RACHAT)
  rapporteMin: 3,        // ventes au prix d'achat connu d'un groupe pour dire « ne rapporte pas »
  dormentMin: 5,         // paires qui dorment
  joursVentesMin: 40,    // ventes datées sur 90 j pour parler d'un jour de la semaine
  joursEcart: 1.3,       // le meilleur jour ≥ 1,3 × la moyenne
  compteVentesMin: 5,    // ventes du meilleur compte sur 30 j
  compteEcart: 1.5,      // ≥ 1,5 × le 2e compte
  fraicheurMs: 24 * 3600000,   // une publication d'écran plus vieille ne sert plus
});
export const IDS = Object.freeze(['colis', 'offres', 'seuil', 'baisses', 'prix', 'racheter', 'rapporte', 'dorment', 'jour', 'compte']);
// Les gestes possibles — une liste FERMÉE (l'IA de la tranche 2 ne peut proposer QUE ceux-là).
export const GESTES = Object.freeze({
  colis: 'envoyer', offres: 'offres', seuil: 'argent', baisses: 'baisses', prix: 'prix', racheter: 'stats',
  rapporte: 'stats', dorment: 'dorment', jour: 'stats', compte: 'stats',
});

const fini = (x) => typeof x === 'number' && Number.isFinite(x);
const frais = (at, maintenant, max = SEUILS.fraicheurMs) => fini(Number(at)) && Number(at) > 0 && maintenant - Number(at) <= max && Number(at) <= maintenant + 60000;
const jourIso = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// ── Chaque règle : la source du propriétaire ⇒ un conseil, ou null. ─────────
// 1. Colis à envoyer : seulement une date limite LUE (l'e-mail du bordereau, `estimee !== true`) — jamais l'estimation.
export function conseilColis(colis, maintenant) {
  if (!colis || !Array.isArray(colis.liste)) return null;
  const auj = jourIso(maintenant), dem = jourIso(maintenant + JOUR);
  const presses = colis.liste.filter((c) => c && c.estimee !== true && typeof c.jour === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(c.jour) && c.jour <= dem);
  if (!presses.length) return null;
  const premier = presses.map((c) => c.jour).sort()[0];
  const nAuj = presses.filter((c) => c.jour === auj).length, nPasse = presses.filter((c) => c.jour < auj).length;
  // Le titre ne dit « aujourd'hui » que si TOUS sont pour aujourd'hui ; sinon « d'ici demain », et la preuve dit combien aujourd'hui.
  const quand = nPasse > 0 ? 'passe' : nAuj === presses.length ? 'auj' : 'demain';
  // §7 : l'ambre SEULEMENT pour une limite aujourd'hui (ou passée) ; « d'ici demain » reste neutre.
  const nums = presses.filter((c) => c && c.num != null && String(c.num) !== '').map((c) => String(c.num)).slice(0, 6);
  return { id: 'colis', ton: nAuj > 0 || nPasse > 0 ? 'ambre' : 'neutre', visuel: nums.length ? { type: 'plaques', nums } : null, params: { n: quand === 'passe' ? nPasse : presses.length, quand, nAuj, total: colis.liste.length },
    geste: GESTES.colis, chiffres: { n: presses.length, aujourdhui: nAuj, passes: nPasse, limite: premier } };
}
// 2. Offres sans réponse : la publication de l'écran (src/offresSansReponse.js).
export function conseilOffres(offres, maintenant) {
  if (!offres || !fini(Number(offres.n)) || !(Number(offres.n) > 0) || !frais(offres.at, maintenant)) return null;
  const jours = fini(Number(offres.plusAncienne)) && Number(offres.plusAncienne) > 0 ? Math.max(0, Math.floor((maintenant - Number(offres.plusAncienne)) / JOUR)) : null;
  // La somme proposée (publiée par Messages, offres au montant LU) : seulement si chaque offre a son montant, sinon rien.
  const somme = fini(Number(offres.somme)) && Number(offres.somme) > 0 && Number(offres.nSomme) === Number(offres.n) ? Number(offres.somme) : null;
  const photos = Array.isArray(offres.photos) ? offres.photos.filter((x) => typeof x === 'string' && x).slice(0, 4) : [];
  return { id: 'offres', ton: 'neutre', visuel: photos.length ? { type: 'photos', photos, total: Number(offres.n) } : null, params: { n: Number(offres.n), jours: jours == null ? '' : jours, avecAge: jours == null ? 0 : 1 }, geste: GESTES.offres, chiffres: { n: Number(offres.n), jours, somme } };
}
// 3. Seuils URSSAF / TVA / DAC7 : `alertesADire(alertesSeuils(…))` (la règle d'Argent) — le plus haut palier pas compris.
export function conseilSeuil(alertes) {
  if (!Array.isArray(alertes) || !alertes.length) return null;
  const a = [...alertes].sort((x, y) => (y.palier || 0) - (x.palier || 0))[0];
  const pct = a.seuil === 'dac7' ? null : fini(a.pct) ? a.pct : null;
  return { id: 'seuil', ton: 'neutre', visuel: pct == null ? null : { type: 'barre', pct: Math.min(100, pct) }, params: { seuil: a.seuil, palier: a.palier, pct: pct == null ? '' : pct, plateforme: a.plateforme || '', auMoins: a.auMoins ? 1 : 0 },
    geste: GESTES.seuil, chiffres: { seuil: a.seuil, palier: a.palier, pct } };
}
// 4. Baisses conseillées : la publication d'Annonces (`decisionsBaisse`, règle baisseConseillee/conseilPrix).
export function conseilBaisses(baisses, maintenant) {
  if (!baisses || !fini(Number(baisses.n)) || !(Number(baisses.n) > 0) || !frais(baisses.at, maintenant)) return null;
  const photos = Array.isArray(baisses.photos) ? baisses.photos.filter((x) => typeof x === 'string' && x).slice(0, 4) : [];
  return { id: 'baisses', ton: 'neutre', visuel: photos.length ? { type: 'photos', photos, total: Number(baisses.n) } : null, params: { n: Number(baisses.n) }, geste: GESTES.baisses, chiffres: { n: Number(baisses.n) } };
}
// 5. Prix d'achat à saisir (« le chiffre faux est la porte pour le corriger ») : la publication de la valeur du stock.
export function conseilPrix(stock) {
  if (!stock || !fini(Number(stock.n)) || !fini(Number(stock.nPrix))) return null;
  const manque = Number(stock.n) - Number(stock.nPrix);
  if (!(manque > 0)) return null;
  return { id: 'prix', ton: 'neutre', visuel: { type: 'barre', pct: Math.round((Number(stock.nPrix) / Number(stock.n)) * 100) }, params: { n: manque, sur: Number(stock.n) }, geste: GESTES.prix, chiffres: { manque, sur: Number(stock.n) } };
}
// 6. Quoi racheter : `quoiRacheter(…).prioritaires` (via vendsMieux, Statistiques › Finances), le premier.
export function conseilRacheter(aRacheter) {
  if (!Array.isArray(aRacheter)) return null;
  const g = aRacheter.find((x) => x && x.nom && fini(x.moyen) && x.moyen > 0 && fini(x.n) && x.n >= SEUILS.rachatMin && fini(x.mediane));
  if (!g) return null;
  return { id: 'racheter', ton: 'neutre', params: { nom: g.nom, n: g.n, moyen: g.moyen, jours: g.mediane }, geste: GESTES.racheter, chiffres: { k: g.k, n: g.n, moyen: g.moyen, mediane: g.mediane } };
}
// 7. Ce qui ne rapporte pas : le classement (`classementRapporte`), un groupe NOMMÉ (pas « Autres ») au bénéfice moyen ≤ 0.
export function conseilRapporte(groupes) {
  if (!Array.isArray(groupes)) return null;
  const L = groupes.filter((g) => g && g.k && g.nom && fini(g.nCout) && g.nCout >= SEUILS.rapporteMin && fini(g.moyen) && g.moyen <= 0)
    .sort((a, b) => a.moyen - b.moyen || b.nCout - a.nCout);
  if (!L.length) return null;
  const g = L[0];
  return { id: 'rapporte', ton: 'neutre', params: { nom: g.nom, n: g.nCout, moyen: g.moyen }, geste: GESTES.rapporte, chiffres: { k: g.k, nCout: g.nCout, moyen: g.moyen } };
}
// 8. Paires qui dorment : `valeurChiffre('dorment')` (la carte des chiffres). Partiel ⇒ « au moins ».
export function conseilDorment(dorment) {
  if (!dorment || !fini(dorment.valeur) || dorment.valeur < SEUILS.dormentMin) return null;
  return { id: 'dorment', ton: 'neutre', params: { n: dorment.valeur, auMoins: dorment.partiel ? 1 : 0 }, geste: GESTES.dorment, chiffres: { n: dorment.valeur, partiel: !!dorment.partiel } };
}
// 9. LE JOUR OÙ ÇA VEND (seule règle propre) : les ventes DATÉES (date lue) des 90 derniers jours, par jour de la semaine
//    (heure locale). Au moins 40 ; le meilleur jour ≥ 1,3 × la moyenne par jour. Une semaine, jamais un mois (pas de saison).
export function joursSemaine(ts, maintenant) {
  if (!Array.isArray(ts)) return null;
  const de = maintenant - 90 * JOUR;
  const n = [0, 0, 0, 0, 0, 0, 0]; let total = 0;
  for (const t of ts) { const x = Number(t); if (!fini(x) || x <= 0 || x < de || x > maintenant + 60000) continue; n[new Date(x).getDay()] += 1; total += 1; }
  return { n, total };
}
export function conseilJour(ts, maintenant) {
  const J = joursSemaine(ts, maintenant);
  if (!J || J.total < SEUILS.joursVentesMin) return null;
  const moyenne = J.total / 7;
  let best = 0; for (let i = 1; i < 7; i++) if (J.n[i] > J.n[best]) best = i;
  if (J.n[best] < SEUILS.joursEcart * moyenne) return null;
  const veille = (best + 6) % 7;
  return { id: 'jour', ton: 'neutre', visuel: { type: 'semaine', n: J.n.slice(), jour: best }, params: { jour: best, veille, n: J.n[best], total: J.total, moyenne: Math.round(moyenne * 10) / 10 },
    geste: GESTES.jour, chiffres: { jour: best, n: J.n[best], total: J.total } };
}
// 10. Le compte qui vend le mieux : `parCompteEtSite` (Statistiques), 30 j, déjà trié par vendu.
export function conseilCompte(comptes) {
  if (!Array.isArray(comptes)) return null;
  const L = comptes.filter((c) => c && c.nom && fini(c.n)).sort((a, b) => b.n - a.n);
  if (L.length < 2) return null;
  const [a, b = { nom: '', n: 0 }] = L;
  if (a.n < SEUILS.compteVentesMin || a.n < SEUILS.compteEcart * Math.max(1, b.n)) return null;
  return { id: 'compte', ton: 'neutre', visuel: { type: 'duo', a: a.n, b: b.n }, params: { nom: a.nom, n: a.n, deux: b.nom, n2: b.n, v: fini(a.v) ? a.v : '', partiel: a.vp ? 1 : 0 }, geste: GESTES.compte, chiffres: { nom: a.nom, n: a.n, n2: b.n } };
}

// ── LE CONSEILLER : toutes les règles, classées par urgence (l'ordre d'IDS). ─
// `s` : la sortie de src/conseiller/sources.js. Rend la liste (peut être vide) ; `undefined` tant que tout est en lecture.
export function conseils(s, maintenant = Date.now()) {
  if (!s || typeof s !== 'object') return [];
  const brut = [
    conseilColis(s.colis, maintenant), conseilOffres(s.offres, maintenant), conseilSeuil(s.seuils), conseilBaisses(s.baisses, maintenant),
    conseilPrix(s.stock), conseilRacheter(s.aRacheter), conseilRapporte(s.groupes), conseilDorment(s.dorment),
    conseilJour(s.ventesTs, maintenant), conseilCompte(s.comptes),
  ].filter(Boolean);
  return brut.map((c) => ({ ...c, rang: IDS.indexOf(c.id) })).sort((a, b) => a.rang - b.rang);
}
// LES TROIS GROUPES de l'écran (23 nov., coordinateur : « grouper ») : à faire aujourd'hui · pour gagner plus · à savoir.
export const CATEGORIES = Object.freeze({ colis: 'faire', offres: 'faire', prix: 'faire', baisses: 'gagner', racheter: 'gagner', rapporte: 'gagner', dorment: 'gagner', seuil: 'savoir', jour: 'savoir', compte: 'savoir' });
export const ORDRE_GROUPES = Object.freeze(['faire', 'gagner', 'savoir']);
export function grouper(L) {
  const out = { faire: [], gagner: [], savoir: [] };
  for (const c of Array.isArray(L) ? L : []) out[CATEGORIES[c.id] || 'savoir'].push(c);
  return out;
}
// LA PHRASE DU JOUR : le nombre de gestes à faire aujourd'hui, les pistes pour gagner plus, et la SEULE somme qu'une source
// donne entière (les offres en attente, chacune au montant lu). Rien de calculable ⇒ pas de somme (jamais un gain inventé).
export function syntheseDuJour(L) {
  const G = grouper(L);
  const o = G.faire.find((c) => c.id === 'offres');
  return { faire: G.faire.length, gagner: G.gagner.length, savoir: G.savoir.length, sommeOffres: o && fini(o.chiffres.somme) ? o.chiffres.somme : null, total: (L || []).length };
}
// La carte d'Aujourd'hui : 3 au plus (l'écran montre tout).
export const MAX_CARTE = 3;
export const pourCarte = (L) => (Array.isArray(L) ? L.slice(0, MAX_CARTE) : []);
