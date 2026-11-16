// ═══════════════════════════════════════════════════════════════════════════
// LE CONTRÔLE DE NUIT, CÔTÉ SERVEUR (11 nov., lot agent2-veille)
// ═══════════════════════════════════════════════════════════════════════════
// La règle et les mots : src/controleNuit.js (module pur, importé tel quel).
// Ici, au cron du MATIN (api/ship-reminders.js — PAS une 13ᵉ fonction) :
//   · `controleVendeur` : pour CE vendeur (contexte du tour), en lecture seule,
//     projetée (jamais `select=data` sur `main` ni sur un dressing), paginée par
//     `Range` (le `lireTout` du cron) ; UNE écriture : sa ligne `vrm_controle_nuit` ;
//   · `controleInstallation` : une fois, pour le PROPRIÉTAIRE de l'installation —
//     les e-mails en quarantaine (propriétaire NEUTRE) et les abonnements Stripe
//     incohérents ; UNE écriture : `vrm_controle_installation` à son nom.
// Une lecture ratée ⇒ ce contrôle est « pas su » (`n: null` + raison), jamais 0 ;
// les autres contrôles continuent. Rien n'est corrigé, rien n'est envoyé.
// ═══════════════════════════════════════════════════════════════════════════
import { annoncesVintedParNumero } from './double-vente.js';
import { masqueesDuCompte, masqueesPresentes } from './masquees-regle.js';
import { cleNum } from './numerotation.js';
import { DESTINATIONS } from './lien-notif.js';
import { comptesARelire, dernieresCaptures, SELECT_CAPTURES } from './comptes-a-relire.js';
import { PROPRIETAIRE_NEUTRE } from './proprietaire-email.js';
import { CLE_CONTROLE, CLE_CONTROLE_INSTALLATION, numerosEnDouble, comptesPasRelus, incoherencesStripe, resultatControle,
  ventesSansNumero, poolRetreci, enLigneVieux, ecartsTotaux, aNotifierControle, memoControleApres } from '../../src/controleNuit.js';
// (15 nov., lot fiabilite-auto) La règle « en ligne », la règle des ventes (miroir de l'app).
import { enLigneDesLignes } from './enligne-regle.js';
import { classifyOrderStatus, compteEcarte, ymDeTs } from './ventes-regle.js';
import { minuitParis } from './bilan-semaine.js';

const objetJson = (v) => {
  if (typeof v === 'string') { try { v = JSON.parse(v); } catch (_) { return undefined; } }
  if (v == null) return null;
  return typeof v === 'object' && !Array.isArray(v) ? v : undefined;
};
const ensemble = (v) => new Set(Array.isArray(v) ? v.map(String) : []);
const objet = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

// (15 nov., lot fiabilite-auto) Les annonces MASQUÉES par Vinted portent leur N° comme les autres :
// ajoutées à la carte N° → annonces (par identifiant ; une masquée déclarée partie n'y est pas).
export function ajouterMasquees(parNum, { lignesL, lignesP, supp, fiches, retirees, perdues, maintenant = Date.now() }) {
  if (!(parNum instanceof Map)) return parNum;
  const ret = new Set(Object.keys(retirees || {}).map(String));
  const lignes = (lignesL || []).map((r) => ({ id: r.id, cap: r.cap, data: { uid: r.uid, capturedAt: r.cap, payload: { items: Array.isArray(r.items) ? r.items : [] } } }));
  const { parCompte } = enLigneDesLignes(lignes, lignesP, supp, maintenant);
  const capDe = new Map(lignes.map((r) => { const k = /^harvest_(\d+)_listings$/.exec(String(r.id || '')); return [k ? k[1] : '', Date.parse(r.cap || '')]; }));
  for (const [uid, res] of parCompte) {
    if (ret.has(String(uid))) continue;
    const m = masqueesPresentes(masqueesDuCompte(res.fermees, supp ? (supp.get(String(uid)) || {}) : null, capDe.get(String(uid))), fiches, perdues);
    for (const it of m) {
      const f = fiches[String(it.id)];
      const k = f && f.numero != null ? cleNum(f.numero) : '';
      if (!k || !/^([A-Z]{1,3})?\d{1,6}$/.test(k)) continue;
      if (!parNum.has(k)) parNum.set(k, []);
      if (!parNum.get(k).some((x) => String(x.id) === String(it.id))) parNum.get(k).push({ id: String(it.id), masquee: true });
    }
  }
  return parNum;
}

// `lireTout(chemin)` : le `fetchPaginated(scoped(chemin))` du cron (tableau, ou `null` = pas su).
// `ecrire(id, data)` : l'`ecrireDedup` du cron (vrai si la base a confirmé).
// (15 nov., lot fiabilite-auto) `lireBilan` : la lecture des ventes du bilan (api/ship-reminders.js
// `lireDonneesBilan`) ; `calculer` : `calculerBilan` (api/_lib/bilan-semaine.js). Absents ⇒ « pas su ».
export async function controleVendeur({ lireTout, ecrire, maintenant = Date.now(), lireBilan = null, calculer = null }) {
  const [mainL, vL, vP, vS, comptesL, panneau, etats, noirs, captures, widgetL, avantL, bilan] = await Promise.all([
    lireTout('app_data?id=eq.main&select=fiches:data->vinted_annonce_numeros,retirees:data->vrm_annonces_retirees,masques:data->vinted_accounts_hidden'
      // (15 nov.) la liste des N°, les N° posés sur une vente et ses liens, les publications du mois (projetées)
      + ',pool:data->vinted_used_numeros,ov:data->vinted_sale_overrides,liens:data->vinted_txn_link,recu:data->vinted_urssaf_mois->recu,urssafAt:data->vinted_urssaf_mois->>at,benef:data->vrm_benefice_jours->jours,benefAt:data->vrm_benefice_jours->>at,perdues:data->vinted_pairs_lost'),
    lireTout('app_data?id=like.harvest_%25_listings&select=id,cap:data->>capturedAt,uid:data->uid,items:data->payload->items'),
    lireTout('app_data?id=like.harvest_%25_enligne&select=id,cap:data->>capturedAt,complet:data->complet,ids:data->ids,items:data->items'),
    lireTout('app_data?id=like.harvest_%25_supprimees&select=id,ids:data->ids'),
    lireTout('vinted_accounts?select=vinted_user_id'),
    lireTout('app_data?id=eq.panel_accounts_off&select=d:data'),
    lireTout('app_data?id=eq.panel_comptes_etat&select=comptes:data->comptes'),
    lireTout('app_data?id=eq.vrm_blocked_accounts&select=uids:data->uids'),
    lireTout(`app_data?id=like.harvest_%25&meta->>supprime=is.null&select=${SELECT_CAPTURES}`),
    lireTout('app_data?id=eq.widget_stats&select=vm:data->>ventesMois,ca:data->>caMois,at:data->>updatedAt'),
    lireTout(`app_data?id=eq.${CLE_CONTROLE}&select=pool:data->>pool`),
    // Les ventes de tous les sites et la table transaction → annonce : la lecture du bilan.
    typeof lireBilan === 'function' ? Promise.resolve().then(lireBilan).catch(() => null) : Promise.resolve(null),
  ]);
  const valeurs = {}, raisons = {};
  const m0 = Array.isArray(mainL) ? (mainL[0] || {}) : null;
  // 1. Deux paires en ligne sous un N° : fiches (N° par identifiant d'annonce) + dressings lus.
  valeurs['numeros-double'] = null;
  if (!m0) raisons['numeros-double'] = 'tes fiches n’ont pas pu être lues';
  else if (!Array.isArray(vL) || !Array.isArray(vS)) raisons['numeros-double'] = 'tes annonces n’ont pas pu être lues';
  else {
    const fiches = objetJson(m0.fiches), retirees = objetJson(m0.retirees);
    const supp = new Map();
    for (const r of vS) { const k = /^harvest_(\d+)_supprimees$/.exec(String((r && r.id) || '')); const ids = objetJson(r && r.ids); if (k && ids) supp.set(k[1], ids); }
    const lignesL = vL.filter((r) => /^harvest_\d+_listings$/.test(String((r && r.id) || ''))).map((r) => ({ ...r, items: typeof r.items === 'string' ? (() => { try { return JSON.parse(r.items); } catch (_) { return null; } })() : r.items }));
    if (fiches === undefined || retirees === undefined || !lignesL.every((r) => r.items == null || Array.isArray(r.items))) raisons['numeros-double'] = 'forme inattendue';
    else {
      const lignesP = Array.isArray(vP) ? vP.filter((r) => /^harvest_\d+_enligne$/.test(String((r && r.id) || ''))) : null;
      // (15 nov., lot fiabilite-auto) PRÉSENTES = en ligne + masquées par Vinted (la paire est
      // toujours chez lui, `<masquees-regle>`, copie exacte api/_lib/masquees-regle.js).
      const parNum = annoncesVintedParNumero(lignesL, lignesP, supp, fiches || {}, retirees || {}, maintenant);
      ajouterMasquees(parNum, { lignesL, lignesP, supp, fiches: fiches || {}, retirees: retirees || {}, perdues: objetJson(m0.perdues) || {}, maintenant });
      valeurs['numeros-double'] = numerosEnDouble(parNum);
    }
  }
  // 2. (15 nov., extension 5.390) « Ventes sans versement depuis 30 jours » n'est plus un contrôle :
  //    Julien ne date rien lui-même, l'extension récupère ces dates (src/controleNuit.js).
  const details = {};
  // 3. Comptes pas relus depuis 48 h : la règle de « Tout va bien ? ».
  valeurs['comptes-48h'] = null;
  if (!m0 || !Array.isArray(comptesL) || !Array.isArray(panneau) || !Array.isArray(etats) || !Array.isArray(noirs) || !Array.isArray(captures)) raisons['comptes-48h'] = 'tes comptes n’ont pas pu être lus';
  else {
    const liste = comptesARelire({
      comptes: comptesL, captures: dernieresCaptures(captures), masques: ensemble(m0.masques),
      panneau: objet(panneau[0] && panneau[0].d), etats: objet(etats[0] && etats[0].comptes), supprimes: ensemble(noirs[0] && noirs[0].uids), maintenant,
    });
    valeurs['comptes-48h'] = comptesPasRelus(liste, maintenant);
    if (valeurs['comptes-48h'] == null) raisons['comptes-48h'] = 'pas lu';
  }
  // ── (15 nov., lot fiabilite-auto) ─────────────────────────────────────────────
  // Les comptes Vinted GARDÉS : ni masqués, ni retirés du panneau, ni supprimés, ni bannis.
  const gardes = Array.isArray(comptesL) && m0 && Array.isArray(panneau) && Array.isArray(etats) && Array.isArray(noirs)
    ? (() => {
      const masques = ensemble(m0.masques), off = objet(panneau[0] && panneau[0].d), et = objet(etats[0] && etats[0].comptes), supp = ensemble(noirs[0] && noirs[0].uids);
      return new Set(comptesL.map((c) => String((c && c.vinted_user_id) || '')).filter((u) => u && !masques.has(u) && !off[u] && !supp.has(u) && !(et[u] && et[u].etat === 'banni')));
    })() : null;
  // 4. Une vente récente sans N° (par identité : transaction → annonce → fiche, §5).
  valeurs['vente-sans-numero'] = null;
  const d = bilan && typeof bilan === 'object' ? bilan : null;
  if (!m0) raisons['vente-sans-numero'] = 'tes fiches n’ont pas pu être lues';
  else if (!d || !d.commandes || !gardes) raisons['vente-sans-numero'] = 'tes ventes n’ont pas pu être lues';
  else {
    const ventes = [];
    for (const [uid, l] of Object.entries(d.commandes)) {
      if (!gardes.has(String(uid)) || compteEcarte(uid, d.masquesComptes || new Set(), d.panneau || {}, d.regle)) continue;
      for (const o of (l && Array.isArray(l.orders) ? l.orders : [])) {
        if (!o || typeof o.status !== 'string' || !o.status.trim()) continue;   // une conversation n'est pas une vente (§5)
        ventes.push({ tx: o.transaction_id != null ? o.transaction_id : o.id, ts: Date.parse(o.date || ''), annulee: classifyOrderStatus(o.status) === 'cancelled' });
      }
    }
    const txItem = new Map(Object.entries(objet(d.txItem)).map(([k, v]) => [String(k), String(v)]));
    const fiches = objetJson(m0.fiches);
    valeurs['vente-sans-numero'] = fiches === undefined ? null : ventesSansNumero({ ventes, txItem, fiches: fiches || {}, overrides: objetJson(m0.ov) || {}, liens: objetJson(m0.liens) || {}, maintenant });
    if (valeurs['vente-sans-numero'] == null) raisons['vente-sans-numero'] = 'forme inattendue';
  }
  // 5. La liste des N° rétrécie (append-only, §5) : dite, jamais réparée.
  let poolN = null;
  valeurs['pool-retreci'] = null;
  if (!m0) raisons['pool-retreci'] = 'tes numéros n’ont pas pu être lus';
  else {
    let pool = m0.pool; if (typeof pool === 'string') { try { pool = JSON.parse(pool); } catch (_) { pool = undefined; } }
    const fiches = objetJson(m0.fiches);
    const avant = Array.isArray(avantL) && avantL[0] && /^\d+$/.test(String(avantL[0].pool == null ? '' : avantL[0].pool)) ? Number(avantL[0].pool) : null;
    const r = Array.isArray(pool) && fiches !== undefined ? poolRetreci({ pool, fiches: fiches || {}, overrides: objetJson(m0.ov) || {}, avant }) : null;
    if (r) { valeurs['pool-retreci'] = r.ids; poolN = r.n; } else raisons['pool-retreci'] = pool == null ? 'aucune liste de numéros' : 'forme inattendue';
  }
  // 6. Les annonces d'un compte gardé lues il y a plus de 24 h (la règle « en ligne »).
  valeurs['enligne-24h'] = null;
  if (!Array.isArray(vL) || !gardes) raisons['enligne-24h'] = 'tes annonces n’ont pas pu être lues';
  else {
    const items = (x) => { if (Array.isArray(x)) return x; if (typeof x === 'string') { try { const y = JSON.parse(x); return Array.isArray(y) ? y : []; } catch (_) { return []; } } return []; };
    const lignesL = vL.filter((r) => /^harvest_\d+_listings$/.test(String((r && r.id) || ''))).map((r) => ({ id: r.id, data: { uid: r.uid, capturedAt: r.cap, payload: { items: items(r.items) } } }));
    const lignesP = Array.isArray(vP) ? vP.filter((r) => /^harvest_\d+_enligne$/.test(String((r && r.id) || ''))) : null;
    const supp = new Map();
    for (const r of (Array.isArray(vS) ? vS : [])) { const k = /^harvest_(\d+)_supprimees$/.exec(String((r && r.id) || '')); const ids = objetJson(r && r.ids); if (k && ids) supp.set(k[1], ids); }
    const { parCompte } = enLigneDesLignes(lignesL, lignesP, Array.isArray(vS) ? supp : null, maintenant);
    valeurs['enligne-24h'] = enLigneVieux(parCompte, gardes);
  }
  // 7. Les totaux du mois publiés par l'app, comparés à leur source (la règle miroir).
  valeurs['totaux-mois'] = null;
  const ym = ymDeTs(maintenant);
  if (!m0 || !Array.isArray(widgetL)) raisons['totaux-mois'] = 'tes chiffres publiés n’ont pas pu être lus';
  else if (!d || typeof calculer !== 'function') raisons['totaux-mois'] = 'tes ventes n’ont pas pu être lues';
  else {
    let src = null;
    try { src = calculer({ ...d, debut: minuitParis(`${ym}-01`), fin: maintenant + 1, seuilCapture: 0, maintenant }); } catch (_) { src = null; }
    const caps = Object.values(d.commandes || {}).map((l) => Date.parse((l && l.cap) || '')).filter(Number.isFinite);
    const sourceAt = caps.length ? Math.max(...caps) : NaN;
    const w0 = widgetL[0] || null;
    const wAt = w0 ? Date.parse(w0.at || '') : NaN;
    const widget = w0 && Number.isFinite(wAt) && ymDeTs(wAt) === ym
      ? { at: wAt, n: /^\d+$/.test(String(w0.vm == null ? '' : w0.vm)) ? Number(w0.vm) : null, eur: w0.ca != null && Number.isFinite(Number(w0.ca)) ? Number(w0.ca) : NaN } : null;
    const recu = objetJson(m0.recu);
    const uAt = Number(m0.urssafAt);
    // Un mois sans versement n'a pas de clé : 0 € seulement si la ligne a été publiée CE mois-ci.
    const urssaf = recu && Number.isFinite(uAt) ? (Number.isFinite(Number(recu[ym])) && recu[ym] != null ? { at: uAt, eur: Number(recu[ym]) } : (ymDeTs(uAt) === ym ? { at: uAt, eur: 0 } : null)) : null;
    const jours = objetJson(m0.benef);
    const bAt = Number(m0.benefAt);
    let bn = null;
    if (jours && Number.isFinite(bAt)) { bn = 0; for (const [k, j] of Object.entries(jours)) if (String(k).slice(0, 7) === ym) bn += Array.isArray(j) ? (Number(j[0]) || 0) : (Number(j && j.n) || 0); }
    const r = src ? ecartsTotaux({ src, sourceAt, widget, urssaf, benefice: bn == null ? null : { at: bAt, n: bn }, ym }) : { passu: 'calcul impossible' };
    if (r.passu) raisons['totaux-mois'] = r.passu; else valeurs['totaux-mois'] = r.ecarts;
  }
  const data = resultatControle(valeurs, raisons, maintenant, details, { pool: poolN });
  const ecrit = await ecrire(CLE_CONTROLE, data);
  // La réponse du cron : des NOMBRES seulement.
  return { ecrit: !!ecrit, data: ecrit ? data : null, n: Object.fromEntries(Object.entries(data.controles).map(([k, c]) => [k, c.n])) };
}

// ── LA NOTIFICATION DU MATIN (15 nov., lot fiabilite-auto) ───────────────────────
// UNE notification, seulement pour un écart RÉEL qui demande un geste (`CONTROLES_NOTIFIES`)
// et seulement s'il est NOUVEAU (signature différente de la dernière dite). Le mémo est écrit
// AVANT l'envoi et confirmé (pas écrit ⇒ rien envoyé). Texte : api/_lib/notif-redaction.js.
export const MEMO_CONTROLE = 'vrm_controle_nuit_dit';
export async function notifierControle({ data, getRow, ecrire, pousser, active = async () => true, maintenant = Date.now() }) {
  if (!data) return { envoye: false, raison: 'contrôle pas écrit' };
  if (!(await active())) return { envoye: false, raison: 'désactivé par le vendeur' };
  const memo = await getRow(MEMO_CONTROLE);
  if (memo === undefined) return { envoye: false, raison: 'mémo illisible — rien envoyé' };
  const n = aNotifierControle(data, memo, maintenant);
  if (!n) return { envoye: false, raison: 'rien de neuf' };
  if (!(await ecrire(MEMO_CONTROLE, memoControleApres(n, maintenant)))) return { envoye: false, raison: 'mémo non écrit — rien envoyé' };
  const lignes = n.lignes.map((l) => ({ cle: l.cle, n: l.n }));
  const envoi = await pousser({ cat: 'veille', redaction: { sorte: 'controleNuit', lignes }, title: 'Tout va bien ? · à voir', body: 'Le contrôle de cette nuit a trouvé un écart.', tag: 'vrm-controle-nuit', url: DESTINATIONS.toutVaBien() });
  return { envoye: true, n: lignes.length, envoi: envoi && (envoi.coupe || envoi.erreur || envoi.sent) };
}

// Le propriétaire de l'installation. `lire(chemin)` : lecture paginée SANS filtre de
// vendeur (clé de service) ; `ecrire(owner, id, data)` ; `stripe` : { pret(), api(m, chemin) }.
export const STRIPE_MAX = 40;
export async function controleInstallation({ lire, ecrire, proprio, stripe = null, maintenant = Date.now(), budgetMs = 15000 }) {
  if (!proprio) return { fait: false, raison: 'propriétaire inconnu' };
  const [quar, abos] = await Promise.all([
    lire(`app_data?id=like.email_quarantaine_*&meta->>supprime=is.null&owner=eq.${PROPRIETAIRE_NEUTRE}&select=id`),
    lire('abonnements?select=owner,statut,abonnement_stripe,fin_periode,annule_fin_periode'),
  ]);
  const valeurs = {}, raisons = {};
  valeurs['emails-quarantaine'] = Array.isArray(quar) ? quar.map((r) => String((r && r.id) || '')).filter(Boolean) : null;
  if (!Array.isArray(quar)) raisons['emails-quarantaine'] = 'la quarantaine n’a pas pu être lue';
  if (!Array.isArray(abos)) { valeurs.stripe = null; raisons.stripe = 'les abonnements n’ont pas pu être lus'; }
  else {
    let carte = null;
    if (stripe && typeof stripe.pret === 'function' && stripe.pret()) {
      carte = new Map();
      const t0 = Date.now();
      const aVoir = abos.filter((r) => r && r.abonnement_stripe && ['active', 'trialing', 'past_due'].includes(String(r.statut))).slice(0, STRIPE_MAX);
      for (const r of aVoir) {
        if (Date.now() - t0 > budgetMs) break;
        const x = await stripe.api('GET', `subscriptions/${encodeURIComponent(String(r.abonnement_stripe))}`).catch(() => null);
        if (x && x.ok && x.data && x.data.status) carte.set(String(r.abonnement_stripe), { statut: String(x.data.status) });
        else if (x && x.status === 404) carte.set(String(r.abonnement_stripe), { absent: true });
        // Stripe muet : rien de rangé (pas su) — la table seule est comparée.
      }
    }
    valeurs.stripe = incoherencesStripe(abos, { stripe: carte, maintenant, proprio });
  }
  const data = resultatControle(valeurs, raisons, maintenant);
  const ecrit = await ecrire(proprio, CLE_CONTROLE_INSTALLATION, data);
  return { fait: !!ecrit, n: Object.fromEntries(Object.entries(data.controles).map(([k, c]) => [k, c.n])) };
}
