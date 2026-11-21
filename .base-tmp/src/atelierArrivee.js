// ════════════════════════════════════════════════════════════════════════════
//  L'ATELIER « ACHAT ARRIVÉ → EN LIGNE » — LA RÈGLE (15 nov., validé par Julien)
//  Récit : docs/passation/2026-11-15-atelier-arrivee.md
// ════════════════════════════════════════════════════════════════════════════
// Quand un achat est retiré (« J'ai retiré », preuve de retrait), UN écran enchaîne
// les étapes, avec une progression : N° · case · photos · prix d'achat · fiche
// « À publier » · publication. Chaque étape se passe (« Plus tard ») ; on reprend
// là où il s'est arrêté ; RIEN n'est écrit sans son geste.
//
// Ce module ne lit RIEN et n'écrit RIEN : il dit où en est une paire et prépare
// les opérations que la coque écrit (App.jsx, `AtelierArriveeCoque`, par
// `gesteVrm` : chaque écriture s'annule 5 s). Il RÉUTILISE ce qui existe :
//   · N° et case : la feuille « Ranger cet achat » (src/rangementArrivee.js,
//     `opsRanger`) — le même geste « Rangé », appelé SANS prix (le prix a son
//     étape, sur SON tap) ;
//   · photos : le studio (src/StudioPhoto.jsx, `studio_photos_{N°}`, détourage local) ;
//   · prix d'achat : la proposition de `prixAchatPropose.js` (le reçu juste, sinon
//     l'article seul, DIT) — par l'IDENTITÉ de l'achat (son n° de transaction) ;
//   · fiche : `vrm_fiches_neuves` (la fiche « À publier » que « Rangé » a créée) ;
//   · publier : « Créer sur Vinted » (la fiche), puis « Publier partout » (le N°).
//
// ⚠️ §2.5 LE PRIX D'ACHAT EST SON PRIX PAYÉ, JAMAIS DEVINÉ :
//    · proposé SEULEMENT pour un achat relié par SON n° de transaction (aucun
//      titre, aucune ressemblance : 50 achats au même titre ne se prêtent rien) ;
//    · un LOT ne propose jamais son prix entier (ni divisé) : le champ reste vide,
//      « ≈ » en indication seulement ;
//    · un achat remboursé / annulé ne propose rien ; une autre devise non plus ;
//    · un N° qui a déjà un prix d'achat n'est jamais réécrit.
// ⚠️ §3 PRIX CONSEILLÉ À LA MISE EN LIGNE : REFUSÉ — le prix de vente de la fiche
//    n'est JAMAIS pré-rempli ni suggéré.
// ⚠️ §3 « photo d'étiquette → fiche » : REFUSÉ — la fiche se remplit de ce que
//    l'ACHAT dit (son titre, sa taille), jamais d'une photo.
// ⚠️ §5 : sans N°, la paire n'a pas d'identité — les photos (rangées sous le N°),
//    le prix (qui suit le N°) et la fiche attendent le N°. Passer le N° ferme
//    l'atelier (l'achat attend dans Ma journée, comme « Plus tard »).
// Module PUR : exécuté par scripts/audit-atelier-arrivee.cjs.
// ════════════════════════════════════════════════════════════════════════════
import { propositionPrixAchat, ACHAT_SANS_COUT } from './prixAchatPropose.js';
import { prixAchatSaisi } from './prixAuNumerotage.js';
import { caseChoisie } from './rangementArrivee.js';
import { casesProposees } from './ouRanger.js';   // (15 nov., intégration) la case d'un ARTICLE : la règle du Stock

export const ETAPES_ATELIER = ['numero', 'case', 'photos', 'prix', 'fiche', 'publier'];
// La mémoire de SES gestes (« Plus tard », « C'est fait ») : synchronisée, par fiche.
// { [idFiche]: { e: { photos: 'passe'|'fait', … }, at } }
export const CLE_ATELIER = 'vrm_atelier_arrivee';
export const CLE_FICHES_ATELIER = 'vrm_fiches_neuves';
export const ORIGINE_ARRIVEE = 'arrivee';
export const ATELIER_JOURS = 30;   // une paire rangée il y a plus de 30 jours ne se rappelle plus
const JOUR = 86400000;

const str = (v) => String(v == null ? '' : v).trim();
const estObjet = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const txOk = (t) => /^\d{4,20}$/.test(str(t));

// ── 1. OÙ EN EST UNE PAIRE ──────────────────────────────────────────────────
// fiche     : la fiche « À publier » rangée à l'arrivée (ou null : pas encore rangée)
// photos    : nombre de photos du studio sous SON N° · null pas su · undefined en cours
// cout      : le prix d'achat posé sur SON N° (`vinted_buyprice_by_num[N°]`) ou null
// etatVinted: 'a-creer' | 'brouillon' | 'en-ligne' (`etatFicheVinted`)
// marques   : `vrm_atelier_arrivee[id]` (SES « Plus tard » / « C'est fait »)
// Rend [{ cle, etat: 'fait'|'passe'|'afaire', raison? }] dans l'ordre des étapes.
export function etapesPaire({ fiche = null, photos, cout = null, etatVinted = 'a-creer', marques = null } = {}) {
  const m = estObjet(marques) && estObjet(marques.e) ? marques.e : {};
  const marque = (c) => (m[c] === 'passe' || m[c] === 'fait' ? m[c] : null);
  const out = [];
  const range = !!(fiche && str(fiche.numero));
  out.push({ cle: 'numero', etat: range ? 'fait' : 'afaire' });
  // (15 nov., Julien : « on range une ANNONCE, pas un achat ») La case vient APRÈS le N° : elle se pose sur l'ARTICLE
  // (sa fiche numérotée), par son geste « Ranger ici » — ou SON « Plus tard ».
  out.push({ cle: 'case', etat: !range ? 'afaire' : fiche.case ? 'fait' : (marque('case') === 'passe' ? 'passe' : 'afaire'), ...(range ? {} : { raison: 'sansNumero' }) });
  if (!range) {
    for (const c of ['photos', 'prix', 'fiche', 'publier']) out.push({ cle: c, etat: 'afaire', raison: 'sansNumero' });
    return out;
  }
  // Photos : PROUVÉES par le studio (≥ 1 photo sous CE N°), ou SON geste.
  if (Number.isFinite(photos) && photos > 0) out.push({ cle: 'photos', etat: 'fait', n: photos });
  else if (marque('photos')) out.push({ cle: 'photos', etat: marque('photos'), ...(photos === null ? { raison: 'passu' } : {}) });
  else out.push({ cle: 'photos', etat: 'afaire', ...(photos === null ? { raison: 'passu' } : {}) });
  // Prix d'achat : un prix posé sur SON N° (ou sur la fiche), ou SON « Plus tard ».
  const prixPose = (cout != null && str(cout) !== '') || (fiche.prixAchat != null && Number.isFinite(Number(fiche.prixAchat)));
  out.push({ cle: 'prix', etat: prixPose ? 'fait' : (marque('prix') === 'passe' ? 'passe' : 'afaire') });
  // Fiche : SON « Enregistrer » (`completeAt`), ou SON « Plus tard ».
  out.push({ cle: 'fiche', etat: str(fiche.completeAt) ? 'fait' : (marque('fiche') === 'passe' ? 'passe' : 'afaire') });
  // Publier : en ligne sur Vinted (l'identifiant rendu, ou SA mise en ligne acceptée), ou SON « Plus tard ».
  const enLigne = etatVinted === 'en-ligne';
  out.push({ cle: 'publier', etat: enLigne ? 'fait' : (marque('publier') === 'passe' ? 'passe' : 'afaire'), ...(etatVinted === 'brouillon' ? { brouillon: true } : {}) });
  return out;
}

// La reprise : la PREMIÈRE étape ni faite ni passée (null : tout est fait ou passé).
export function etapeReprise(etapes) {
  const e = (Array.isArray(etapes) ? etapes : []).find((x) => x && x.etat === 'afaire');
  return e ? e.cle : null;
}
// La progression : { faites, passees, total } — « 3 sur 6 ».
export function progression(etapes) {
  const l = Array.isArray(etapes) ? etapes : [];
  return { faites: l.filter((e) => e.etat === 'fait').length, passees: l.filter((e) => e.etat === 'passe').length, total: ETAPES_ATELIER.length };
}

// ── 2. LE PRIX PAYÉ, PAR L'IDENTITÉ DE L'ACHAT ───────────────────────────────
// entree : l'achat retiré ({ tx, prix, lot, n, titre, statut?, devise?, paye? })
//   `paye` : la proposition calculée par l'écran Achats AVEC le reçu de CET achat
//   (`propositionPrixAchat`, reçu juste ⇒ « Payé sur Vinted ») — recopiée telle quelle.
// Rend { centimes, source: 'recu'|'achat', detail, valeur, tx } ou null (rien à proposer).
export function prixPayeArrivee(entree) {
  const e = entree || {};
  const tx = str(e.tx);
  if (!txOk(tx)) return null;                                  // aucun achat relié par identité ⇒ rien
  if (e.lot || (Number(e.n) || 0) > 1) return null;            // un lot ne se divise jamais tout seul
  if (ACHAT_SANS_COUT.test(str(e.statut))) return null;        // remboursé, annulé… : rien coûté
  const p = e.paye;
  if (p && Number.isSafeInteger(p.centimes) && p.centimes > 0 && str(p.tx) === tx && (p.source === 'recu' || p.source === 'achat')) {
    return { centimes: p.centimes, source: p.source, detail: str(p.detail), valeur: (p.centimes / 100).toFixed(2).replace('.', ','), tx };
  }
  const r = propositionPrixAchat({ identite: { achat: { transaction_id: tx, title: str(e.titre), status: str(e.statut), lot: !!e.lot, price: { amount: e.prix, currency_code: str(e.devise) || 'EUR' } }, par: 'lien' } });
  if (!r) return null;
  return { centimes: r.centimes, source: r.source, detail: str(r.detail), valeur: r.valeur, tx };
}
// L'indication d'un lot (« ≈ 20 ») : JAMAIS écrite, jamais dans le champ.
export function indicatifLot(entree) {
  const e = entree || {};
  const n = Number(e.n) || 0;
  const p = Number(String(e.prix == null ? '' : e.prix).replace(',', '.'));
  if (!(e.lot || n > 1) || !(n > 1) || !Number.isFinite(p) || p <= 0) return '';
  return String(Math.round((p / n) * 100) / 100).replace('.', ',');
}

// ── 3. LA FICHE PRÉ-REMPLIE DE CE QUE L'ACHAT DIT ────────────────────────────
// La fiche rangée (titre, marque, taille déjà écrits par « Rangé ») d'abord ; sinon
// ce que l'ACHAT dit (son titre, sa taille lue) ; la couleur seulement si le titre de
// l'achat en nomme UNE (deux couleurs ⇒ vide : on ne choisit pas) ; la catégorie
// seulement si l'achat la porte. Le prix de vente : TOUJOURS vide (§3).
export function ficheDepuisAchat(entree, fiche, { marqueDe = null, couleursDe = null } = {}) {
  const e = entree || {}, f = fiche || {};
  const titreAchat = str(e.titre);
  const coul = typeof couleursDe === 'function' ? (couleursDe(titreAchat) || []) : [];
  return {
    titre: str(f.titre) || titreAchat,
    marque: str(f.marque) || str(e.marque) || (typeof marqueDe === 'function' ? str(marqueDe(titreAchat)) : ''),
    taille: str(f.taille) || str(e.taille),
    couleur: str(f.couleur) || (coul.length === 1 ? str(coul[0]) : ''),
    categorie: str(f.categorie) || str(e.categorie),
    etat: str(f.etat),
    description: str(f.description),
    prix: f.prix != null && Number.isFinite(Number(f.prix)) ? String(f.prix).replace('.', ',') : '',
  };
}
export const CHAMPS_FICHE = ['titre', 'marque', 'taille', 'couleur', 'categorie', 'etat', 'description', 'prix'];

// ── 4. LES ÉCRITURES (chacune sur SON geste) ─────────────────────────────────
// « Enregistrer la fiche » : les champs (liste blanche, longueurs bornées), `completeAt`.
// Le prix de vente tapé est relu (« 85 », « 85,50 ») ; illisible ⇒ refus, rien d'écrit.
export function opsFiche({ fiches, id, champs, maintenant = new Date().toISOString() } = {}) {
  if (!estObjet(fiches)) return { ok: false, raison: 'lecture' };
  const f = fiches[str(id)];
  if (!estObjet(f) || f.retireeAt) return { ok: false, raison: 'fiche' };
  const c = champs || {};
  const BORNES = { titre: 200, marque: 80, taille: 40, couleur: 40, categorie: 80, etat: 60, description: 4000 };
  const apres = {};
  for (const k of Object.keys(BORNES)) if (c[k] != null) apres[k] = String(c[k]).replace(/\r/g, '').trim().slice(0, BORNES[k]);
  if (c.prix != null && str(c.prix) !== '') {
    const p = prixAchatSaisi(c.prix);
    if (p == null) return { ok: false, raison: 'prix' };
    apres.prix = Number(p.replace(',', '.'));
  }
  apres.completeAt = maintenant;
  const avant = {}; for (const k of Object.keys(apres)) avant[k] = f[k];
  return { ok: true, ops: [{ k: CLE_FICHES_ATELIER, type: 'champs', id: str(id), apres, avant }] };
}
// « Garder » / « Enregistrer » le prix d'achat : sur SON N°, jamais par-dessus un prix posé.
//   texte : le montant tapé ou gardé (« 41,90 ») ; couts : `vinted_buyprice_by_num`.
export function opsPrixAchat({ fiches, id, couts, texte, source = 'tape' } = {}) {
  if (!estObjet(fiches) || !estObjet(couts)) return { ok: false, raison: 'lecture' };
  const f = fiches[str(id)];
  if (!estObjet(f) || !str(f.numero)) return { ok: false, raison: 'fiche' };
  const p = prixAchatSaisi(texte);
  if (p === undefined) return { ok: false, raison: 'vide' };
  if (p === null) return { ok: false, raison: 'illisible' };
  const num = str(f.numero);
  if (couts[num] != null && str(couts[num]) !== '') return { ok: false, raison: 'deja' };
  if (f.prixAchat != null && Number.isFinite(Number(f.prixAchat))) return { ok: false, raison: 'deja' };
  const n = Number(p.replace(',', '.'));
  return { ok: true, valeur: p, ops: [
    { k: 'vinted_buyprice_by_num', type: 'cle', id: num, apres: p, avant: couts[num] },
    { k: CLE_FICHES_ATELIER, type: 'champs', id: str(id), apres: { prixAchat: n, prixAchatSource: source }, avant: { prixAchat: f.prixAchat, prixAchatSource: f.prixAchatSource } },
  ] };
}
// ── LA CASE D'UN ARTICLE (15 nov., Julien : « on range une ANNONCE, pas un achat ») ──
// La case se propose à un ARTICLE qui a déjà son N° (sa fiche), une fois le N° donné. Lue sur
// les cases ACTUELLES (`vrm_slots`) : une case prise — par l'article d'avant d'un même lot, ou par
// n'importe quel N° — n'est jamais reproposée ; deux articles n'ont jamais la même case.
// `reservees` : les cases montrées à d'autres articles et pas encore écrites.
// Rend { su: false } (plan pas lu) · { su: true, case: null, aucunMeuble? } · { su: true, case }.
// (15 nov., intégration avec claude/pas-ranger-achat) La case vient de LA règle du Stock, `casesProposees`
// (src/ouRanger.js) : la première case libre qui n'est proposée à aucun autre article (empilement compris).
// `cle` : le N° de l'article (cleNum) ; `reservees` comptent comme prises. Rend la forme { meubleId, i, … }.
export function caseProposee({ meubles, slots, cle = '', reservees = [] } = {}) {
  if (!Array.isArray(meubles) || !estObjet(slots)) return { su: false };
  const prises = { ...slots };
  (Array.isArray(reservees) ? reservees : []).forEach((r, k) => { if (r && r.meubleId != null) prises['\u0000r' + k] = { m: String(r.meubleId), i: Number(r.i) }; });
  const c = str(cle) || '\u0000article';
  const r = casesProposees({ meubles, slots: prises, cles: [c] });
  if (!r) return { su: false };
  const pose = r[c] || null;
  const aucunMeuble = !meubles.some((m) => m && m.id != null);
  return { su: true, case: pose, ...(aucunMeuble ? { aucunMeuble: true } : {}) };
}
// « Ranger ici » : la case de CET article (son N°), relue et refusée plutôt qu'écrasée —
// une case prise entre-temps, un article déjà dans une case ⇒ rien n'est écrit.
//   place : { meubleId, i } (la proposition, ou la case touchée sur le plan)
export function opsCase({ fiches, id, slots, meubles, place, cleNum, maintenant = new Date().toISOString() } = {}) {
  if (!estObjet(fiches) || !estObjet(slots) || !Array.isArray(meubles) || typeof cleNum !== 'function') return { ok: false, raison: 'lecture' };
  const f = fiches[str(id)];
  if (!estObjet(f) || f.retireeAt || !str(f.numero)) return { ok: false, raison: 'fiche' };
  const c = cleNum(f.numero);
  if (!c) return { ok: false, raison: 'fiche' };
  if (slots[c] || f.case) return { ok: false, raison: 'deja' };
  if (!place || place.meubleId == null) return { ok: false, raison: 'case' };
  const ok = caseChoisie({ meubles, slots, m: place.meubleId, i: Number(place.i) });
  if (!ok) return { ok: false, raison: 'case' };
  const p = { m: String(ok.meubleId), i: Number(ok.i) };
  return { ok: true, case: ok, ops: [
    { k: 'vrm_slots', type: 'cle', id: c, apres: p, avant: undefined },
    { k: CLE_FICHES_ATELIER, type: 'champs', id: str(id), apres: { case: p, caseAt: maintenant }, avant: { case: f.case, caseAt: f.caseAt } },
  ] };
}
// « Plus tard » / « C'est fait » d'une étape : SA mémoire, par fiche.
export function opMarque({ marques, id, etape, etat, maintenant = new Date().toISOString() } = {}) {
  if (!ETAPES_ATELIER.includes(etape) || !['passe', 'fait', undefined].includes(etat) || !str(id)) return null;
  const base = estObjet(marques) ? marques : {};
  const avant = base[str(id)];
  const e = { ...((estObjet(avant) && estObjet(avant.e)) ? avant.e : {}) };
  if (etat === undefined) delete e[etape]; else e[etape] = etat;
  return { k: CLE_ATELIER, type: 'cle', id: str(id), apres: { e, at: maintenant }, avant };
}

// ── 5. LES FICHES RANGÉES À L'ARRIVÉE ────────────────────────────────────────
// Les fiches d'UN achat retiré : par SON n° de transaction, sinon par les N° que
// « Rangé » vient de rendre (un colis sans achat relié). Jamais par le titre.
export function fichesDeLArrivee({ fiches, tx = '', numeros = [], cleNum } = {}) {
  if (!estObjet(fiches)) return [];
  const k = (n) => (typeof cleNum === 'function' ? cleNum(n) : str(n).toUpperCase());
  const voulus = new Set((numeros || []).map(k).filter(Boolean));
  const t = str(tx);
  return Object.values(fiches)
    .filter((f) => f && !f.retireeAt && f.origine === ORIGINE_ARRIVEE && str(f.numero)
      && ((txOk(t) && f.achat && str(f.achat.tx) === t) || voulus.has(k(f.numero))))
    .sort((a, b) => (Number(a.achat && a.achat.ligne) || 0) - (Number(b.achat && b.achat.ligne) || 0) || String(a.numero).localeCompare(String(b.numero), 'fr', { numeric: true }));
}
// Les paires à FINIR (Ma journée) : rangées à l'arrivée depuis moins de 30 jours, pas
// retirées, avec une étape ni faite ni passée. Les photos ne se lisent pas ici (une
// lecture de plus par fiche) : l'étape compte « à faire » tant que ni le studio (lu à
// l'ouverture de l'atelier) ni SON geste ne l'a réglée.
export function pairesAFinir({ fiches, marques, couts, etatVinted = () => 'a-creer', maintenant = Date.now() } = {}) {
  if (!estObjet(fiches)) return [];
  const M = estObjet(marques) ? marques : {}, C = estObjet(couts) ? couts : {};
  const out = [];
  for (const f of Object.values(fiches)) {
    if (!f || f.retireeAt || f.origine !== ORIGINE_ARRIVEE || !str(f.numero)) continue;
    const t = Date.parse(f.rangeAt || f.creeAt || '');
    if (!Number.isFinite(t) || maintenant - t > ATELIER_JOURS * JOUR) continue;
    const etapes = etapesPaire({ fiche: f, photos: undefined, cout: C[str(f.numero)], etatVinted: etatVinted(f), marques: M[str(f.id)] });
    const r = etapeReprise(etapes);
    if (r) out.push({ fiche: f, reprise: r, etapes });
  }
  return out.sort((a, b) => String(b.fiche.rangeAt || '').localeCompare(String(a.fiche.rangeAt || '')));
}
