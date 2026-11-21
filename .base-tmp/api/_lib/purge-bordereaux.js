// ════════════════════════════════════════════════════════════════════════════
//  LE PDF D'UN BORDEREAU PART QUAND LA VENTE EST FINALISÉE ET L'ARGENT REÇU
//  (15 nov., décision de Julien, mot pour mot : « Tu supprimes les bordereaux
//  lorsque la vente est finalisée et que on a reçu l'argent. »)
// ════════════════════════════════════════════════════════════════════════════
// Mesuré le 15 nov. (lecture seule) : la purge de l'extension (`purgeBordereaux`,
// background.js) n'accepte qu'une transaction LUE au statut 450 ; or le détail de
// transaction est un instantané jamais relu, figé à 230 alors que la LISTE des
// ventes, relue à chaque visite, dit « Commande finalisée ». Ses PDF restaient.
//
// LA RÈGLE (une seule, ici ; exécutée par scripts/audit-purge-bordereaux.cjs) —
// le PDF d'un bordereau est retiré quand, ET SEULEMENT quand :
//   1. la vente est FINALISÉE selon la lecture LA PLUS FRAÎCHE (§5) : liste des
//      ventes (`harvest_{uid}_orders_sold`, `classifyOrderStatus` = 'completed')
//      OU détail (`harvest_{uid}_txn_{tx}`, statut 450), chacune datée par SA
//      capture (`capturedAt` — `updated_at` ment, §4.3). Deux lectures de même
//      date qui se contredisent, ou une lecture sans date ⇒ « pas su » ⇒ gardé ;
//   2. L'ARGENT EST REÇU : une date de versement connue, LA règle du CA déclaré
//      (`versementsDeLignes` = `datesDeVersement` d'App.jsx, recopiée au jeton
//      près : transaction 450, relevé vérifié, conversation, e-mail « Transaction
//      finalisée »), passée. Une vente « finalisée » SANS date de versement est
//      « à dater » pour la compta : son PDF reste ;
//   3. AUCUN retour, litige, annulation, remboursement ni suspension n'a été vu
//      sur cette vente — dans N'IMPORTE QUELLE lecture (liste ou détail, même plus
//      ancienne : un 440 « Retour initié » reste 440 pour toujours, c'est voulu) :
//      `classifyOrderStatus` = 'cancelled' (⇔ `PAS_UNE_VENTE`), `transaction_user_status`
//      'failed', statut 220 / 430 / 440 / ≥ 500, et tout bordereau de retour
//      (`email_bordretour_{tx}`) au même n° ;
//   4. « PAS SU » SUR UN SEUL POINT ⇒ ON GARDE : une lecture ratée (ventes,
//      transactions, versements, retours, ligne des transporteurs) n'écrit RIEN ;
//      une vente introuvable, une identité douteuse, une date illisible ⇒ gardé.
//   + deux ceintures : le bordereau a au moins 7 jours (sa propre date, lisible) ;
//     et son PDF a déjà été LU pour le transporteur (api/_lib/transporteur-anciens.js
//     `candidatsPdf` : un bordereau encore à lire n'est jamais purgé avant).
// Vestiaire (`vc_label_{produit}`) : LES règles de api/_lib/vestiaire-regle.js
// (importées) — une seule vente au même produit, ni annulée ni à expédier, étape
// « versée » ou « terminée », date de versement (`verseLe`) lue. Leboncoin et
// eBay ne rangent aucun bordereau (eBay : l'étiquette est chez eBay, §2.8).
// Les bordereaux de RETOUR (`email_bordretour_*`) ne sont jamais touchés.
//
// CE QUI PART : le contenu PDF seul (`pdfB64`, `pdfTamponneB64` ; `b64` pour
// Vestiaire). La LIGNE reste, et toutes ses métadonnées (n° de suivi, transporteur,
// date limite, `filename`, `label_{tx}` qui PROUVE la vente, §5) ; elle porte
// `pdfPurged: true`, `pdfPurgedAt`, `pdfPurgeRaison: 'versement'` — l'app dit
// « Bordereau supprimé après le versement » au lieu d'un bouton mort.
// L'ÉCRITURE : la fonction `vrm_bordereau_retirer_pdf` (migration 044), qui
// remplace ces seuls champs DANS la base (`data || patch`) — jamais un
// `select=data` (§4.4), jamais une réécriture de la ligne entière, jamais une
// autre ligne (identifiant vérifié par la base, identité attendue `@>`).
// Migration pas appliquée (404) ⇒ rien écrit, et la réponse le dit.
// Par lots bornés (`MAX_PAR_PASSAGE`), journal dans `vrm_purge_bordereaux`.
// Module PUR pour la règle ; la passe reçoit ses lectures et écritures.
import { classifyOrderStatus } from './ventes-regle.js';
import { versementsDeLignes } from './bilan-semaine.js';
import { candidatsPdf, ID_BORD_TRANSPORTEURS, REQ_BORDS_PDF, REQ_LABELS_PDF } from './transporteur-anciens.js';
import { etapeMotVc, vcVenteAnnulee, dateVersementVc, aExpedierVc, venteVcFraiche } from './vestiaire-regle.js';

export const ID_JOURNAL = 'vrm_purge_bordereaux';
export const RPC_RETIRER = 'vrm_bordereau_retirer_pdf';
export const MAX_PAR_PASSAGE = 20;
export const AGE_MIN_MS = 7 * 86400000;
export const JOURNAL_MAX = 200;
export const RAISON = 'versement';

// Les lectures : PROJETÉES (§4.4), paginées par l'appelant (§4.5).
export const REQ = Object.freeze({
  bords: REQ_BORDS_PDF,
  labels: REQ_LABELS_PDF,
  vcLabels: 'app_data?id=like.vc_label_*&data->>b64=not.is.null&select=id,pid:meta->>productId,at:meta->>at',
  ventes: 'app_data?id=like.harvest_%25_orders_sold&select=id,orders:data->payload->my_orders,cap:data->>capturedAt',
  txn: 'app_data?id=like.harvest_%25_txn_%25&select=id,tx:meta->>id,s:meta->>status,su:meta->>status_updated_at,ss:meta->>status_title,sst:meta->>ship_status_title,cap:meta->>capturedAt',
  releve: 'app_data?id=like.harvest_%25_releve_%25&select=id,l:data->lignes',
  versConv: 'app_data?id=like.harvest_%25_versement_%25&select=tx:data->>tx,at:data->>at,src:data->>source',
  versMail: 'app_data?id=like.email_final_%25&data->>transaction=not.is.null&select=tx:data->>transaction,at:data->>receivedAt',
  retours: 'app_data?id=like.email_bordretour_*&select=id,tx:meta->>transaction',
  vcVentes: 'app_data?id=eq.vc_ventes&select=ventes:data->ventes,lectures:data->lectures',
  transporteurs: `app_data?id=eq.${ID_BORD_TRANSPORTEURS}&select=pdf:data->pdf,pdfVus:data->pdfVus`,
});

const str = (v) => String(v == null ? '' : v).trim();
const ms = (v) => { const t = Date.parse(str(v)); return Number.isFinite(t) && t > 0 ? t : null; };
const RE_TX = /^\d{6,20}$/;

// L'identité d'une ligne de bordereau : { famille, tx | pid } ou null (pas un bordereau de vente).
export function identiteBordereau(id, txMeta) {
  const s = str(id);
  let m;
  if ((m = /^email_bord_(\d{6,20})$/.exec(s))) {
    if (str(txMeta) && str(txMeta) !== m[1]) return null;            // la ligne se contredit : doute
    return { famille: 'email', tx: m[1] };
  }
  if ((m = /^harvest_(\d{1,20})_label_(\d{6,20}|latest)$/.exec(s))) {
    const tx = m[2] === 'latest' ? str(txMeta) : m[2];
    if (!RE_TX.test(tx)) return null;                                   // latest sans transaction : on ne sait pas
    if (str(txMeta) && str(txMeta) !== tx) return null;
    return { famille: 'label', tx, latest: m[2] === 'latest' };
  }
  if ((m = /^vc_label_([0-9A-Za-z_-]{1,64})$/.exec(s))) {
    if (str(txMeta) && str(txMeta) !== m[1]) return null;
    return { famille: 'vc', pid: m[1] };
  }
  return null;
}

// Les lectures d'une vente Vinted, par n° de transaction (toutes les lignes du vendeur).
// `ventes` = lignes `orders_sold` projetées ({ id, orders, cap }) ; `txn` = lignes de détail.
export function observationsVinted(ventes, txn) {
  const parTx = new Map();
  const obs = (tx) => { let o = parTx.get(tx); if (!o) { o = { liste: [], detail: [] }; parTx.set(tx, o); } return o; };
  for (const l of (Array.isArray(ventes) ? ventes : [])) {
    if (!/^harvest_\d{1,20}_orders_sold$/.test(str(l && l.id))) continue;
    for (const o of (Array.isArray(l.orders) ? l.orders : [])) {
      const tx = str(o && o.transaction_id);
      if (!RE_TX.test(tx)) continue;
      obs(tx).liste.push({ st: str(o.status), tus: str(o.transaction_user_status), cap: ms(l.cap) });
    }
  }
  for (const r of (Array.isArray(txn) ? txn : [])) {
    const m = /^harvest_\d{1,20}_txn_(\d{6,20})$/.exec(str(r && r.id));
    if (!m) continue;
    const tx = m[1];
    const s = str(r.s) === '' ? null : Number(r.s);
    // Une ligne dont le n° rangé contredit son identifiant : on ne sait pas laquelle croire.
    const contredit = str(r.tx) !== '' && str(r.tx) !== tx;
    obs(tx).detail.push({ s: Number.isFinite(s) ? s : null, ss: str(r.ss), sst: str(r.sst), cap: ms(r.cap), contredit });
  }
  return parTx;
}

const annuleDit = (s) => classifyOrderStatus(s) === 'cancelled';
// 3. Un retour, un litige, une annulation, un remboursement ou une suspension, dans
//    N'IMPORTE QUELLE lecture (une seule suffit à garder).
export function incidentVinted(o) {
  if (!o) return false;
  for (const l of o.liste) if (annuleDit(l.st) || l.tus === 'failed') return true;
  for (const d of o.detail) {
    if (d.s === 220 || d.s === 430 || d.s === 440 || (d.s != null && d.s >= 500)) return true;
    if (annuleDit(d.ss) || annuleDit(d.sst)) return true;
  }
  return false;
}
// 1. Finalisée selon la lecture LA PLUS FRAÎCHE : true · false · null (pas su).
export function finaliseeVinted(o) {
  if (!o) return null;
  const toutes = [
    ...o.liste.map((l) => ({ cap: l.cap, fin: classifyOrderStatus(l.st) === 'completed' })),
    ...o.detail.map((d) => ({ cap: d.cap, fin: d.s === 450, doute: d.contredit || d.s == null })),
  ];
  if (!toutes.length) return null;
  if (toutes.some((x) => x.cap == null)) return null;                    // une lecture sans date : on ne peut pas ordonner
  const max = Math.max(...toutes.map((x) => x.cap));
  const fraiches = toutes.filter((x) => x.cap === max);
  if (fraiches.some((x) => x.doute)) return null;
  const oui = fraiches.filter((x) => x.fin).length;
  if (oui && oui < fraiches.length) return null;                          // même instant, deux avis : pas su
  return oui > 0;
}

// LA DÉCISION pour UN bordereau. Rend { supprimer: bool, raison }.
// `c` : { id, famille, tx|pid, at } ; `ctx` : ce que la passe a lu (jamais null ici —
// une source illisible arrête la passe avant).
export function decisionBordereau(c, ctx, maintenant = Date.now()) {
  const garde = (raison) => ({ supprimer: false, raison });
  if (!c || !c.famille) return garde('identite-douteuse');
  const at = ms(c.at);
  if (at == null) return garde('date-bordereau-illisible');
  if (maintenant - at < AGE_MIN_MS) return garde('trop-recent');
  if (c.famille === 'vc') {
    const ventes = Object.values((ctx.vc && ctx.vc.ventes && typeof ctx.vc.ventes === 'object') ? ctx.vc.ventes : {})
      .filter((v) => v && typeof v === 'object' && str(v.productId) === c.pid);
    if (!ventes.length) return garde('vente-introuvable');
    if (ventes.length > 1) return garde('identite-douteuse');
    const v = venteVcFraiche(ventes[0], ctx.vc.lectures || null);
    if (vcVenteAnnulee(v) || etapeMotVc(v) === 'annulee') return garde('retour-annulation');
    if (aExpedierVc(v, ctx.vc.lectures || null) || !['versee', 'terminee'].includes(etapeMotVc(v))) return garde('pas-finalisee');
    const tv = dateVersementVc(v);
    if (!tv || tv > maintenant) return garde('sans-versement');
    return { supprimer: true, raison: RAISON };
  }
  const o = ctx.obs.get(c.tx);
  if (!o || (!o.liste.length && !o.detail.length)) return garde('vente-introuvable');
  if (incidentVinted(o) || ctx.retours.has(c.tx)) return garde('retour-annulation');
  const fin = finaliseeVinted(o);
  if (fin === null) return garde('etat-pas-su');
  if (!fin) return garde('pas-finalisee');
  const v = ctx.versements ? ctx.versements[c.tx] : null;
  const tv = ms(v);
  if (tv == null || tv > maintenant) return garde('sans-versement');
  if (ctx.aLire.has(c.id)) return garde('transporteur-pas-lu');
  return { supprimer: true, raison: RAISON };
}

// Le changement envoyé à la base pour UNE ligne : les seuls champs PDF à null + la marque.
export function patchDe(c, maintenant = Date.now()) {
  const marque = { pdfPurged: true, pdfPurgedAt: new Date(maintenant).toISOString(), pdfPurgeRaison: RAISON };
  if (c.famille === 'vc') return { p_patch: { b64: null, ...marque }, p_attendu: { productId: c.pid } };
  if (c.famille === 'email') return { p_patch: { pdfB64: null, pdfTamponneB64: null, ...marque }, p_attendu: { transaction: c.tx } };
  return { p_patch: { pdfB64: null, ...marque }, p_attendu: c.latest || c.txMeta ? { tx: c.tx } : {} };
}

// ── LA PASSE (cron du matin, par vendeur) ───────────────────────────────────
// lireTout(chemin) → lignes | null (pas su) · rpc(nom, corps) → { etat, avant?, apres? } |
// { absente: true } | null (pas su) · getRow(id) → objet | null (absente) | undefined (pas su) ·
// ecrire(id, data) → bool.
export async function passePurgeBordereaux({ lireTout, rpc, getRow, ecrire, owner, maintenant = Date.now(), max = MAX_PAR_PASSAGE } = {}) {
  if (!owner) return { fait: false, raison: 'vendeur inconnu — rien écrit' };
  const [bords, labels, vcLabels] = await Promise.all([lireTout(REQ.bords), lireTout(REQ.labels), lireTout(REQ.vcLabels)]);
  if (!Array.isArray(bords) || !Array.isArray(labels) || !Array.isArray(vcLabels)) return { fait: false, raison: 'bordereaux illisibles — rien écrit' };
  const cands = [];
  for (const b of bords) { const i = identiteBordereau(b && b.id, b && b.tx); if (i && i.famille === 'email') cands.push({ ...i, id: b.id, at: b.recu }); }
  for (const l of labels) { const i = identiteBordereau(l && l.id, l && l.tx); if (i && i.famille === 'label') cands.push({ ...i, id: l.id, at: l.cap, txMeta: str(l.tx) }); }
  for (const v of vcLabels) { const i = identiteBordereau(v && v.id, v && v.pid); if (i && i.famille === 'vc') cands.push({ ...i, id: v.id, at: v.at }); }
  if (!cands.length) return { fait: true, candidats: 0, supprimes: 0 };

  const avecVinted = cands.some((c) => c.famille !== 'vc'), avecVc = cands.some((c) => c.famille === 'vc');
  const vide = async () => [];
  const [ventes, txn, releve, versConv, versMail, retours, vcRows, transp, journal] = await Promise.all([
    avecVinted ? lireTout(REQ.ventes) : vide(),
    avecVinted ? lireTout(REQ.txn) : vide(),
    avecVinted ? lireTout(REQ.releve) : vide(),
    avecVinted ? lireTout(REQ.versConv) : vide(),
    avecVinted ? lireTout(REQ.versMail) : vide(),
    avecVinted ? lireTout(REQ.retours) : vide(),
    avecVc ? lireTout(REQ.vcVentes) : vide(),
    avecVinted ? lireTout(REQ.transporteurs) : vide(),
    getRow(ID_JOURNAL),
  ]);
  // 4. Une source illisible ⇒ RIEN n'est écrit (jamais une demi-preuve).
  const illisibles = [['ventes', ventes], ['transactions', txn], ['relevé', releve], ['conversations de versement', versConv], ['e-mails de versement', versMail], ['retours', retours], ['ventes Vestiaire', vcRows], ['transporteurs', transp]]
    .filter(([, v]) => !Array.isArray(v)).map(([n]) => n);
  if (journal === undefined) illisibles.push('journal');
  if (illisibles.length) return { fait: false, raison: `lecture ratée (${illisibles.join(', ')}) — rien écrit`, candidats: cands.length };
  const versements = avecVinted ? versementsDeLignes(txn, releve, versConv, versMail) : {};
  if (avecVinted && !versements) return { fait: false, raison: 'versements pas sus — rien écrit', candidats: cands.length };
  const t0 = transp[0] || {};
  const aLire = new Set(candidatsPdf(bords, labels, { pdf: t0.pdf || {}, pdfVus: t0.pdfVus || {} }).map((x) => x.id));
  const ctx = {
    obs: observationsVinted(ventes, txn), versements, aLire,
    retours: new Set(retours.map((r) => { const m = /^email_bordretour_(\d{6,20})$/.exec(str(r && r.id)); return str(r && r.tx) || (m ? m[1] : ''); }).filter(Boolean)),
    vc: { ventes: (vcRows[0] && vcRows[0].ventes) || null, lectures: (vcRows[0] && vcRows[0].lectures) || null },
  };
  const gardes = {}, aSupprimer = [];
  for (const c of cands) {
    const d = decisionBordereau(c, ctx, maintenant);
    if (d.supprimer) aSupprimer.push(c); else gardes[d.raison] = (gardes[d.raison] || 0) + 1;
  }
  // Les plus anciens d'abord, par lots bornés.
  aSupprimer.sort((a, b) => (ms(a.at) || 0) - (ms(b.at) || 0) || (a.id < b.id ? -1 : 1));
  const lot = aSupprimer.slice(0, Math.max(0, max));
  const faits = []; let migration = 'ok', rates = 0;
  for (const c of lot) {
    const { p_patch, p_attendu } = patchDe(c, maintenant);
    const r = await rpc(RPC_RETIRER, { p_owner: owner, p_id: c.id, p_patch, p_attendu });
    if (r && r.absente) { migration = 'absente'; break; }
    if (!r) { rates++; continue; }
    if (r.etat === 'ok') faits.push({ id: c.id, octets: Math.max(0, (Number(r.avant) || 0) - (Number(r.apres) || 0)), at: new Date(maintenant).toISOString() });
  }
  const octets = faits.reduce((t, f) => t + f.octets, 0);
  const dernier = { at: new Date(maintenant).toISOString(), candidats: cands.length, aSupprimer: aSupprimer.length, supprimes: faits.length, octets, gardes, migration, ...(rates ? { rates } : {}), restants: Math.max(0, aSupprimer.length - faits.length) };
  const j = journal && typeof journal === 'object' ? journal : {};
  const ancien = Array.isArray(j.supprimes) ? j.supprimes : [];
  const ecrit = await ecrire(ID_JOURNAL, { v: 1, regle: 'finalisée + versement connu + aucun retour', dernier, supprimes: [...faits.slice().reverse(), ...ancien].slice(0, JOURNAL_MAX) });
  return { fait: true, candidats: cands.length, aSupprimer: aSupprimer.length, supprimes: faits.length, octets, gardes, migration, journal: !!ecrit, ...(rates ? { rates } : {}) };
}

// L'appel de la fonction de la base (migration 044). 404 PGRST202 ⇒ { absente } (pas
// encore appliquée : rien écrit) ; toute autre panne ⇒ null (pas su, la ligne reste).
export function rpcPostgrest({ url, entetes, fetcher }) {
  return async (nom, corps) => {
    let r;
    try { r = await fetcher(`${url}/rest/v1/rpc/${nom}`, { method: 'POST', headers: { ...entetes, 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(corps) }); }
    catch (_) { return null; }
    if (r.status === 404) {
      let j = null; try { j = await r.json(); } catch (_) {}
      return j && j.code === 'PGRST202' ? { absente: true } : null;
    }
    if (!r.ok) return null;
    let j; try { j = await r.json(); } catch (_) { return null; }
    return j && typeof j === 'object' && typeof j.etat === 'string' ? j : null;
  };
}
