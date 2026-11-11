// ═══════════════════════════════════════════════════════════════════════════
//  « VENDU AILLEURS » — EN MAIN PROPRE, ENTRE AMIS, SUR UN AUTRE SITE (11 nov.)
// ═══════════════════════════════════════════════════════════════════════════
// Julien (validé le 11 nov.) : sur la fiche d'une paire du stock, 2 touchers :
// « Vendu ailleurs » ⇒ le prix (et la date, aujourd'hui par défaut) ⇒ la paire
// sort du stock, la vente entre dans le chiffre d'affaires, le bénéfice et
// l'URSSAF du BON mois. Annulable 5 s (`gesteVrm`, src/gesteAnnulable.js).
//
// ⚠️ UNE SEULE RÈGLE, PAS UNE DEUXIÈME. La vente en main propre existait déjà :
//    `vrm_cycle_decisions[idAnnonce] = { choix: 'vendu-main', numero, at, montant }`
//    (src/cycleArticle.js, « Vendu en main propre » de Ma journée) — mais son
//    montant n'entrait dans AUCUN total. On la réutilise telle quelle (+ `date`),
//    et elle entre dans LES règles de l'app (`ventesFaites`, `ventesDeclarables`,
//    `ventesAutresBenefice`, paramètre `main`) par `ventesMainPropre` ci-dessous.
// ⚠️ DATE : pour une vente en main propre, l'argent est reçu le jour de la vente
//    ⇒ la date de vente EST la date d'encaissement (le CA déclaré est daté au
//    versement, §5) ; l'écran le dit.
// ⚠️ IDENTITÉ (§5) : la décision porte l'IDENTIFIANT D'ANNONCE ; elle ne compte
//    plus dès qu'une vente Vinted LUE de cette même annonce (transaction →
//    annonce, jamais un titre) est comptée — jamais deux fois la même paire.
// ⚠️ N° JAMAIS REDONNÉ : la fiche garde son N° ; seule sa case du Stock est libérée.
// ⚠️ §2.3/§2.5 : le montant est SAISI par lui (`montantSaisi`), jamais deviné.
// Module PUR : la coque l'appelle, `scripts/audit-vendu-ailleurs.cjs` l'exécute.

export const CLE_DECISIONS = 'vrm_cycle_decisions';
export const CLE_VENDUES = 'vinted_annonces_vendues';
export const CHOIX_MAIN = 'vendu-main';
export const PLATEFORME_AILLEURS = 'Ailleurs';
const DATE_OK = /^\d{4}-\d{2}-\d{2}$/;
const str = (v) => String(v == null ? '' : v).trim();
const cleDefaut = (n) => { const s = str(n).toUpperCase().replace(/\s+/g, '').replace(/^N[°O]?(?=\d)/, ''); const m = /^([A-Z]*)0*(\d+)$/.exec(s); return m ? m[1] + m[2] : s; };

// Le jour d'aujourd'hui, en local : « AAAA-MM-JJ ».
export function aujourdhui(ms = Date.now()) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
// Une date saisie valide : « AAAA-MM-JJ », pas dans le futur (demain au plus, un fuseau), pas avant 2000.
export function dateValide(s, maintenant = Date.now()) {
  const v = str(s);
  if (!DATE_OK.test(v)) return false;
  const t = Date.parse(v + 'T12:00:00');
  return Number.isFinite(t) && t <= maintenant + 36 * 3600000 && t >= Date.parse('2000-01-01T00:00:00');
}

// Les opérations du geste (`gesteVrm`) : la décision « vendu en main propre » datée,
// la paire marquée vendue (elle sort du stock et des annonces), sa case libérée.
//   carte   { id (annonce), numero, title }
//   montant nombre > 0 (déjà lu par `montantSaisi`) ; date « AAAA-MM-JJ »
//   decisions, vendues (liste d'ids), slots : les valeurs COURANTES (pour « avant »)
// Rend { ops, texte } ou null (rien n'est écrit).
export function opsVenduAilleurs({ carte, montant, date, decisions = {}, vendues = [], slots = {}, cle = cleDefaut, maintenant = Date.now() } = {}) {
  if (!carte || carte.id == null || str(carte.id) === '') return null;
  const m = Number(montant);
  if (!Number.isFinite(m) || m <= 0 || m >= 100000) return null;
  if (!dateValide(date, maintenant)) return null;
  const id = str(carte.id), numero = str(carte.numero);
  const D = decisions || {}, S = slots || {};
  const eur = Math.round(m * 100) / 100;
  const ops = [{ k: CLE_DECISIONS, type: 'cle', id, apres: { choix: CHOIX_MAIN, numero, at: new Date(maintenant).toISOString(), montant: eur, date: str(date), ailleurs: true }, avant: D[id] }];
  const dedans = (Array.isArray(vendues) ? vendues : [...(vendues || [])]).map(String).includes(id);
  if (!dedans) ops.push({ k: CLE_VENDUES, type: 'ensemble', id, apres: true, avant: false });
  const kn = numero ? cle(numero) : '';
  if (kn && S[kn]) ops.push({ k: 'vrm_slots', type: 'cle', id: kn, apres: undefined, avant: S[kn] });
  const e = (eur % 1 === 0 ? String(eur) : eur.toFixed(2).replace('.', ',')) + ' €';
  return { texte: `N°${numero || '?'} vendu ailleurs · ${e}`, ops };
}

// LES VENTES EN MAIN PROPRE, telles que les règles des totaux les lisent.
//   decisions   `vrm_cycle_decisions`
//   vendusVinted Set des identifiants d'annonce dont une vente Vinted est COMPTÉE
//               (ces décisions-là ne comptent pas : la même paire, une seule fois)
// Rend [{ id, eur, ts, num, titre }] — `ts` : la date saisie (midi, heure locale),
// sinon le jour de la réponse ; un montant illisible n'est jamais une vente à 0 €.
export function ventesMainPropre(decisions, vendusVinted = null) {
  const out = [];
  if (!decisions || typeof decisions !== 'object' || Array.isArray(decisions)) return out;
  for (const id of Object.keys(decisions)) {
    const d = decisions[id];
    if (!d || d.choix !== CHOIX_MAIN) continue;
    if (vendusVinted && typeof vendusVinted.has === 'function' && vendusVinted.has(String(id))) continue;
    const eur = Number(d.montant);
    if (!Number.isFinite(eur) || eur <= 0) continue;
    const t = DATE_OK.test(str(d.date)) ? Date.parse(str(d.date) + 'T12:00:00') : Date.parse(str(d.at));
    out.push({ id: String(id), eur: Math.round(eur * 100) / 100, ts: Number.isFinite(t) ? t : null, num: str(d.numero), titre: '' });
  }
  return out;
}
