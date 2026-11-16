// ════════════════════════════════════════════════════════════════════════════
//  LA LIGNE DE TEMPS D'UNE PAIRE (14 nov., idée 154 — demandée par Julien)
// ════════════════════════════════════════════════════════════════════════════
// « L'histoire complète d'une paire » : achetée, reçue, numérotée, photographiée,
// publiée (sur chaque plateforme), chaque changement de prix daté, republiée,
// vendue, bordereau, partie, arrivée au relais, livrée, versement reçu — dans
// l'ORDRE DES DATES, une seule ligne.
//
// Ce module ne lit RIEN et ne relie RIEN lui-même : il range dans le temps ce que
// `histoireArticle` (src/histoireArticle.js) a DÉJÀ trouvé PAR IDENTITÉ (le N° par
// sa clé, la vente par sa transaction → son `item_id`, eBay par le SKU, le colis
// par le n° de suivi écrit sur le bordereau de CETTE transaction, le versement
// par la transaction). Trois sources en plus, chacune par identité aussi :
//   · `reception` : `dateReception` de l'achat relié par SON n° de transaction
//     (« Commande livrée » dans la transaction, ou SON clic « Récupéré ») ;
//   · `crees`     : la date de création LUE chez Vinted pour CETTE annonce (par
//     son identifiant) — sinon la première vue par VRM, dite « vue en ligne » ;
//   · `studio`    : les photos rangées par le studio de VRM sous CE N°
//     (`studio_photos_{clé du N°}`, leurs dates `at`).
// ⚠️ §5 : AUCUN titre, aucune ressemblance. 50 paires identiques gardent 50
//    histoires : rien ici ne regarde un titre (audit-idees-paires.cjs le prouve).
// ⚠️ « Pas su » ne s'invente pas : une étape jamais lue ne s'affiche pas ; un
//    événement prouvé SANS date va dans « date inconnue » (jamais une date
//    déduite) ; une source pas lue est NOMMÉE (`pasSu`), jamais « rien ».
// ⚠️ N° porté par deux paires présentes : AUCUN événement (on ne choisit pas, on ne mélange pas).
// Module PUR : src/paireHistoire/LigneDeTemps.jsx et scripts/audit-idees-paires.cjs.
// ════════════════════════════════════════════════════════════════════════════

// Les sortes d'événement, dans l'ordre du cycle (pour départager deux dates égales).
export const QUOI = ['achetee', 'recue', 'numerotee', 'renumerotee', 'photographiee', 'publiee', 'vueEnLigne', 'republiee', 'baisse', 'hausse', 'prix',
  'offreRecue', 'offreFaite', 'offre', 'masquee', 'visible', 'disparue',
  'vendue', 'bordereau', 'partie', 'relais', 'livree', 'retourColis', 'versement', 'annulee', 'retourRecu', 'remiseStock'];

const str = (v) => String(v == null ? '' : v).trim();
const ms = (v) => {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? (v < 1e12 ? v * 1000 : v) : null;
  const t = Date.parse(v); return Number.isFinite(t) ? t : null;
};
const isoDe = (v) => { const t = ms(v); return t == null ? null : new Date(t).toISOString(); };
const SITE_DE = { 'en-ligne': 'Vinted', republie: 'Vinted', ebay: 'eBay', leboncoin: 'Leboncoin', vestiaire: 'Vestiaire Collective', vinted: 'Vinted' };

// (15 nov., l'historique complet demandé par Julien) Trois sources de plus, chacune par IDENTITÉ :
//   · les OFFRES : celles que `histoireArticle` a gardées par l'identifiant de CETTE annonce
//     (la transaction de la conversation → `item_id`), avec leur sens et leur état lu
//     (`etatOffreVinted` : acceptée · refusée · en attente · terminée) ;
//   · `moderation` : les événements « masquée / de nouveau visible / disparue » que
//     l'extension a constatés en comparant deux lectures COMPLÈTES du dressing
//     (`moderation_vinted_{uid}`, src/moderationVinted.js), par l'identifiant d'annonce
//     (`ids`, les annonces de CE N°) — null ⇒ « pas lu », nommé ;
//   · `retours` : SES clics « Reçu chez toi » / « Remis en stock » (Ventes → Retours,
//     `vinted_retours_recus` / `_remis`), par le n° de transaction d'une vente de CE N° (`txs`).
// h : la sortie de `histoireArticle` · x : { reception, crees, studio, ids, txs, moderation, retours }
//   reception : { ms, source: 'livraison'|'clic' } | null (pas trouvée) | undefined (pas lue)
//   crees     : { [idAnnonce]: ms } | null (pas lues) | undefined
//   studio    : { dates: [iso] } | null (pas lu) | undefined (pas demandé)
// Rend { evenements: [{ quoi, at, site, montant, avant, preuve, id }], sansDate: [...],
//   pasSu: [raison] } — `evenements` du plus ancien au plus récent.
export function ligneDeTemps(h, x = {}) {
  if (!h || !Array.isArray(h.etapes)) return null;
  // ⚠️ §5 : DEUX paires présentes sous ce N° ⇒ leurs annonces, ventes et colis sont mêlés sous la même clé.
  // La ligne de temps ne les mélange pas en UNE histoire : rien n'est rangé, c'est dit (la fiche dit le doublon).
  if (h.double) return { double: true, evenements: [], sansDate: [], pasSu: [] };
  const evs = [], pasSu = [];
  const pose = (e) => evs.push({ site: '', montant: null, avant: null, preuve: '', id: '', ...e, at: isoDe(e.at) });
  const etape = (cle) => h.etapes.find((e) => e.cle === cle) || null;
  const evDe = (cle) => { const e = etape(cle); return e && Array.isArray(e.evenements) ? e.evenements : []; };
  const passu = (cle) => { const e = etape(cle); if (e && e.etat === 'passu' && e.detail) pasSu.push(e.detail); };

  // ACHETÉE — l'achat relié (son n° de transaction) ou le prix saisi : la preuve de histoire.
  for (const e of evDe('achat')) pose({ quoi: 'achetee', at: e.at, montant: (etape('achat') || {}).etat === 'fait' ? montantAchat(h) : null, preuve: e.preuve, ...(e.vendeur ? { vendeur: str(e.vendeur) } : {}) });
  passu('achat');
  // REÇUE — seulement d'un achat RELIÉ (la date appartient à SA transaction).
  const rel = (etape('achat') || {}).evenements || [];
  const relie = rel.some((e) => /^achat n° /.test(str(e.preuve)));
  if (relie && x.reception && ms(x.reception.ms) != null) pose({ quoi: 'recue', at: x.reception.ms, preuve: x.reception.source === 'clic' ? 'clic' : 'livraison' });
  else if (relie && x.reception === undefined) pasSu.push('recue');
  // NUMÉROTÉE — `numberedAt` de la fiche ; un N° qui remplace un autre est dit.
  for (const e of evDe('numero')) pose({ quoi: e.sorte === 'reattribue' ? 'renumerotee' : 'numerotee', at: e.at, preuve: e.preuve });
  // PHOTOGRAPHIÉE — la première photo du studio de VRM sous CE N° (et combien).
  if (x.studio === null) pasSu.push('studio');
  else if (x.studio && Array.isArray(x.studio.dates)) {
    const d = x.studio.dates.map(ms).filter((t) => t != null).sort((a, b) => a - b);
    if (d.length) pose({ quoi: 'photographiee', at: d[0], montant: null, preuve: 'studio', n: d.length });
  }
  // PUBLIÉE / REPUBLIÉE — par plateforme, par l'identifiant de l'annonce.
  for (const e of evDe('annonces')) {
    const id = (/annonce (\d+)/.exec(str(e.preuve)) || [])[1] || '';
    // Une republication garde le N° de la paire (src/repriseNumero.js) : elle est sous CE N° par construction.
    if (e.cle === 'republie') { pose({ quoi: 'republiee', at: e.at, site: 'Vinted', preuve: e.preuve, id, ...(e.recreeDe ? { memeNumero: true } : {}) }); continue; }
    if (e.cle === 'en-ligne') {
      const c = id && x.crees ? ms(x.crees[id]) : null;
      if (c != null) pose({ quoi: 'publiee', at: c, site: 'Vinted', preuve: e.preuve, id, source: 'vinted' });
      else pose({ quoi: e.at ? 'vueEnLigne' : 'publiee', at: e.at, site: 'Vinted', preuve: e.preuve, id });
      continue;
    }
    pose({ quoi: 'publiee', at: e.at, site: SITE_DE[e.cle] || str(e.cle), preuve: e.preuve });
  }
  passu('annonces');
  if (x.crees === null && evDe('annonces').some((e) => e.cle === 'en-ligne')) pasSu.push('crees');
  // PRIX — chaque changement DATÉ : baisse, hausse, ou prix lu sans prix d'avant.
  for (const e of evDe('prix')) {
    const a = e.avant != null && Number.isFinite(Number(e.avant)) ? Number(e.avant) : null, b = e.apres != null && Number.isFinite(Number(e.apres)) ? Number(e.apres) : null;
    pose({ quoi: a == null || b == null || a === b ? 'prix' : b < a ? 'baisse' : 'hausse', at: e.at, site: str(e.site) === 'vinted' ? 'Vinted' : str(e.site), montant: b, avant: a, preuve: e.preuve });
  }
  passu('prix');
  // OFFRES — reçues ou faites, par l'annonce de CETTE paire ; montant et état lus, jamais devinés.
  for (const e of evDe('offres')) {
    if (e.cle !== 'offre' || !Number.isFinite(Number(e.prix))) continue;
    pose({ quoi: e.sens === 'faite' ? 'offreFaite' : e.sens === 'recue' ? 'offreRecue' : 'offre', at: e.at, site: 'Vinted', montant: Number(e.prix), preuve: e.preuve, id: str(e.item), statut: ['acceptee', 'refusee', 'attente', 'terminee'].includes(e.statut) ? e.statut : '' });
  }
  passu('offres');
  // MASQUÉE / DE NOUVEAU VISIBLE / DISPARUE — constaté par l'extension sur deux lectures complètes, par l'annonce.
  const idsM = new Set((Array.isArray(x.ids) ? x.ids : []).map(str).filter(Boolean));
  if (x.moderation === null && idsM.size) pasSu.push('moderation');
  else if (Array.isArray(x.moderation)) for (const m of x.moderation) {
    if (!m || !idsM.has(str(m.a))) continue;
    if (m.s === 'masquee') { pose({ quoi: 'masquee', at: m.t, site: 'Vinted', preuve: 'moderation', id: str(m.a) }); if (m.f) pose({ quoi: 'visible', at: m.f, site: 'Vinted', preuve: 'moderation', id: str(m.a) }); }
    else if (m.s === 'disparue') pose({ quoi: 'disparue', at: m.t, site: 'Vinted', preuve: 'moderation', id: str(m.a) });
  }
  // VENDUE — la vente de histoire (Vinted par sa transaction, eBay, Leboncoin).
  for (const e of evDe('vente')) pose({ quoi: 'vendue', at: e.at, site: SITE_DE[e.cle] || 'Vinted', montant: montantDuTexte(e.texte), preuve: e.preuve, id: e.tx ? String(e.tx) : '' });
  passu('vente');
  // COLIS — bordereau (son e-mail), déposé (SON clic), relais et livré (le transporteur, par le n° de suivi).
  const COLIS = { bordereau: 'bordereau', depose: 'partie', relais: 'relais', livre: 'livree', 'retour-colis': 'retourColis' };
  const colis = evDe('colis');
  for (const e of colis) if (COLIS[e.cle]) pose({ quoi: COLIS[e.cle], at: e.at, preuve: e.preuve });
  // Une étape du colis PROUVÉE par l'état de la vente, sans e-mail daté : « date inconnue ».
  const ec = etape('colis');
  if (ec && ec.etat === 'fait') {
    const a = new Set(colis.map((e) => COLIS[e.cle]));
    if (/livr/i.test(str(ec.titre)) && !a.has('livree')) pose({ quoi: 'livree', at: null, preuve: ec.tx ? `transaction ${ec.tx}` : '' });
    else if (/relais/i.test(str(ec.titre)) && !a.has('relais')) pose({ quoi: 'relais', at: null, preuve: ec.tx ? `transaction ${ec.tx}` : '' });
    if (!a.has('partie')) pose({ quoi: 'partie', at: null, preuve: ec.tx ? `transaction ${ec.tx}` : '' });
  }
  passu('colis');
  // VERSEMENT — la date de la commande finalisée (450) de LA vente.
  for (const e of evDe('argent')) if (e.cle === 'versement') pose({ quoi: 'versement', at: e.at, preuve: e.preuve });
  passu('argent');
  // ANNULÉE / RETOUR — une vente que son état fait revenir.
  for (const e of evDe('retour')) pose({ quoi: 'annulee', at: e.at, preuve: e.preuve });
  // RETOUR REÇU / REMIS EN STOCK — SES clics, par le n° de transaction d'une vente de CE N°.
  const R = x.retours && typeof x.retours === 'object' ? x.retours : null;
  if (R) for (const tx of (Array.isArray(x.txs) ? x.txs : []).map(str).filter(Boolean)) {
    const rc = R.recus && R.recus[tx]; if (rc) pose({ quoi: 'retourRecu', at: typeof rc === 'string' ? rc : null, preuve: 'clicRetour', id: tx });
    const rm = R.remis && R.remis[tx]; if (rm) pose({ quoi: 'remiseStock', at: rm && typeof rm === 'object' ? rm.at : null, preuve: 'clicRetour', id: tx });
  }

  const rang = (q) => { const i = QUOI.indexOf(q); return i < 0 ? 99 : i; };
  const dates = evs.filter((e) => e.at).sort((a, b) => (Date.parse(a.at) - Date.parse(b.at)) || (rang(a.quoi) - rang(b.quoi)));
  const sansDate = evs.filter((e) => !e.at).sort((a, b) => rang(a.quoi) - rang(b.quoi));
  return { evenements: dates, sansDate, pasSu: [...new Set(pasSu)] };
}

// Le prix d'achat en euros (le chiffre de la fiche, centimes ⇒ euros), ou null.
function montantAchat(h) { const c = h && h.resume ? h.resume.achat : null; return c == null || !Number.isFinite(Number(c)) ? null : Number(c) / 100; }
// Le premier montant écrit « 80 € » / « 80,50 € » dans le texte d'une vente (le texte de histoire).
function montantDuTexte(t) { const m = /(\d+(?:,\d{1,2})?) €/.exec(str(t)); return m ? Number(m[1].replace(',', '.')) : null; }

// Les photos du studio de CE N° (`studio_photos_{clé}`, projection scalaire `a0..a5`) ⇒ { dates }.
// `rows` null ⇒ null (pas lu) ; aucune ligne ⇒ { dates: [] }.
export function studioDe(rows) {
  if (!Array.isArray(rows)) return null;
  const dates = [];
  for (const r of rows) for (let i = 0; i < 12; i++) { const v = r && r['a' + i]; if (v != null && v !== '') dates.push(String(v)); }
  return { dates };
}
