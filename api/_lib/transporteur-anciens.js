// ════════════════════════════════════════════════════════════════════════════
//  LE TRANSPORTEUR DES ANCIENS BORDEREAUX (9 nov.)
//  Depuis le 9 nov., l'e-mail « Bordereau d'envoi » range à sa réception le
//  transporteur qu'il nomme (`transporteurDeTexteBordereau`). Les bordereaux
//  reçus AVANT n'en ont pas : Colis → « Envoyés » les dit « Transporteur inconnu ».
//  La route des e-mails garde, pour chaque e-mail, son texte lisible
//  (`email_texte_{empreinte}`, borné à TEXTE_MAX) et une ligne de suivi
//  (`email_reception_{empreinte}` : sujet, résumé `{ t:'bordereau', tx }`).
//
//  Cette passe (cron du matin, `api/ship-reminders.js`, aucune fonction de plus)
//  relit CES textes et range le transporteur par LA MÊME règle.
//  ⚠️ JAMAIS DEVINÉ (§5) :
//    · identité : le n° de transaction LU dans l'e-mail (résumé `tx`) = celui du
//      bordereau (`email_bord_{tx}`) — jamais un titre, une date, une ressemblance ;
//    · un seul transporteur nommé ⇒ lui ; deux noms (dans un texte, ou deux
//      e-mails du même n° qui ne disent pas le même) ⇒ rien ;
//    · un texte COUPÉ (borné à TEXTE_MAX, « … » final) ne prouve pas qu'il n'y a
//      qu'un nom : il ne décide rien ;
//    · un bordereau qui a DÉJÀ un transporteur (rangé à la réception, même vide :
//      la règle a déjà vu le texte entier) n'est jamais touché ;
//    · une lecture ratée (bordereaux, suivis, textes, ligne de rangement) ⇒ RIEN
//      n'est écrit (« rien lu » ne vaut pas « rien »).
//  ⚠️ §4.4 : la ligne `email_bord_{tx}` porte son PDF ; la réécrire demanderait
//  `select=data`. Le résultat vit donc dans UNE ligne légère à part,
//  `vrm_bord_transporteurs` ({ v, parTx: { tx: { t, at } }, vus: { tx: { at, r } } }),
//  que l'app fusionne dans ses bordereaux SANS écraser un transporteur rangé
//  (`transporteurRelu`). Idempotente (un n° décidé ou vu n'est plus relu) et
//  bornée (`max` bordereaux par passage, les plus récents d'abord).
// ════════════════════════════════════════════════════════════════════════════
import { transporteurDeTexteBordereau, transporteursNommes, suiviMondialRelayLu } from './transporteur-bordereau.js';
import { TEXTE_MAX } from './resume-email.js';
import { transporteurDeForme } from './suivi-colis.js';
import { transporteurDuPdf } from './transporteur-pdf.js';

export const ID_BORD_TRANSPORTEURS = 'vrm_bord_transporteurs';
export const MAX_PAR_PASSAGE = 20;
const VUS_MAX = 2000;
const RE_TX = /^\d{6,20}$/;

export const REQ_BORDS = 'app_data?id=like.email_bord_*&select=id,tx:meta->>transaction,transporteur:meta->>transporteur,suivi:meta->>suivi,recu:meta->>receivedAt';
export const REQ_RECEPTIONS = 'app_data?id=like.email_reception_*&data->resume->>t=eq.bordereau&select=id,tx:data->resume->>tx,sujet:data->>subject';
export const reqTextes = (cles) => `app_data?id=in.(${cles.map((c) => 'email_texte_' + c).join(',')})&select=id,texte:data->>texte`;

// Un texte COUPÉ par `texteBorne` (TEXTE_MAX caractères + « … ») ne décide rien.
export const texteCoupe = (t) => typeof t === 'string' && t.length > TEXTE_MAX && t.endsWith('…');

// Ce que disent les e-mails d'UN n° : { t } (un seul transporteur), ou { r } (raison de ne rien dire).
export function decisionPourTx(emails) {
  const lus = (emails || []).filter((e) => e && typeof e.texte === 'string' && e.texte.trim());
  if (!lus.length) return { r: 'sans-texte' };
  const entiers = lus.filter((e) => !texteCoupe(e.texte));
  if (!entiers.length) return { r: 'texte-coupe' };
  // La règle de la réception, e-mail par e-mail : deux noms dans UN texte ⇒ rien.
  const textes = entiers.map((e) => String(e.sujet || '') + '\n' + e.texte);
  if (textes.some((t) => transporteursNommes(t).size > 1)) return { r: 'plusieurs' };
  const noms = [...new Set(textes.map(transporteurDeTexteBordereau))].filter(Boolean);
  if (noms.length > 1) return { r: 'plusieurs' };
  // Un e-mail du n° nomme X, un autre (rappel) ne nomme personne : le silence n'ajoute aucun nom.
  if (noms.length === 1) return { t: noms[0] };
  return { r: 'aucun' };
}

// Le n° Mondial Relay que disent les e-mails d'UN n° de transaction (la règle de la
// réception, `suiviMondialRelayLu`). Un texte coupé compte, sauf si le n° touche la
// coupure (il pourrait continuer au-delà). Deux n° différents ⇒ rien.
export function suiviPourTx(emails) {
  const lus = new Set();
  for (const e of emails || []) {
    if (!e || typeof e.texte !== 'string' || !e.texte.trim()) continue;
    const s = String(e.sujet || '') + '\n' + e.texte;
    const l = suiviMondialRelayLu(s);
    if (!l) continue;
    if (texteCoupe(e.texte) && l.fin >= s.length - 1) continue;
    lus.add(l.n);
  }
  return lus.size === 1 ? [...lus][0] : '';
}

// La passe. `lireTout(path)` → tableau | null ; `getRow(id)` → objet | null (absente) | undefined (pas su) ;
// `ecrire(id, data)` → bool. Rend un bilan court (jamais un texte, jamais un nom de compte).
export async function passeTransporteursAnciens({ lireTout, getRow, ecrire, max = MAX_PAR_PASSAGE, maintenant = Date.now() }) {
  const [bords, receptions] = await Promise.all([lireTout(REQ_BORDS), lireTout(REQ_RECEPTIONS)]);
  if (!Array.isArray(bords) || !Array.isArray(receptions)) return { fait: false, raison: 'lecture ratée — rien écrit' };
  const memo = await getRow(ID_BORD_TRANSPORTEURS);
  if (memo === undefined) return { fait: false, raison: 'ligne de rangement illisible — rien écrit' };
  const cur = memo && typeof memo === 'object' ? memo : {};
  const parTx = Object.assign({}, cur.parTx && typeof cur.parTx === 'object' ? cur.parTx : {});
  const vus = Object.assign({}, cur.vus && typeof cur.vus === 'object' ? cur.vus : {});

  // Les e-mails de bordereau gardés, par n° (l'identité lue dans l'e-mail).
  const emailsParTx = new Map();
  for (const r of receptions) {
    const tx = String((r && r.tx) || '');
    const m = /^email_reception_(.+)$/.exec(String((r && r.id) || ''));
    if (!RE_TX.test(tx) || !m) continue;
    if (!emailsParTx.has(tx)) emailsParTx.set(tx, []);
    emailsParTx.get(tx).push({ cle: m[1], sujet: r.sujet || '' });
  }
  // Les candidats : un bordereau SANS transporteur rangé (clé absente), jamais décidé ni vu, avec un e-mail gardé.
  let sansEmail = 0;
  const candidats = [];
  for (const b of bords) {
    const tx = String((b && b.tx) || '') || String((b && b.id) || '').replace(/^email_bord_/, '');
    if (!RE_TX.test(tx)) continue;
    if (b.transporteur != null) continue;                 // déjà rangé (même vide) : jamais touché
    if (parTx[tx] || vus[tx]) continue;                   // idempotent
    if (!emailsParTx.has(tx)) { sansEmail++; continue; }
    candidats.push({ tx, recu: Date.parse(b.recu || '') || 0, sansSuivi: !String(b.suivi || '').trim() });
  }
  candidats.sort((a, b) => b.recu - a.recu || (a.tx < b.tx ? 1 : -1));
  const lot = candidats.slice(0, Math.max(0, max));
  if (!lot.length) return { fait: true, ranges: 0, suivis: 0, vus: 0, restants: 0, sansEmail };

  const cles = lot.flatMap((c) => emailsParTx.get(c.tx).map((e) => e.cle)).filter((c) => /^[A-Za-z0-9_-]{1,80}$/.test(c));
  const textes = cles.length ? await lireTout(reqTextes(cles)) : [];
  if (!Array.isArray(textes)) return { fait: false, raison: 'textes illisibles — rien écrit' };
  const texteDe = new Map(textes.map((t) => [String(t.id || '').replace(/^email_texte_/, ''), t.texte]));

  const at = new Date(maintenant).toISOString();
  let ranges = 0, suivis = 0, nVus = 0;
  for (const c of lot) {
    const emails = emailsParTx.get(c.tx).map((e) => ({ sujet: e.sujet, texte: texteDe.get(e.cle) }));
    const d = decisionPourTx(emails);
    // Le n° Mondial Relay : seulement pour un bordereau qui n'a AUCUN n° rangé.
    const s = c.sansSuivi ? suiviPourTx(emails) : '';
    if (d.t || s) { parTx[c.tx] = { ...(d.t ? { t: d.t } : {}), ...(s ? { s } : {}), at }; if (d.t) ranges++; if (s) suivis++; }
    else { vus[c.tx] = { at, r: d.r }; nVus++; }
  }
  // Borné : les « vus » les plus anciens tombent (ils seraient simplement relus).
  const clesVus = Object.keys(vus);
  if (clesVus.length > VUS_MAX) clesVus.sort((a, b) => String(vus[a].at).localeCompare(String(vus[b].at))).slice(0, clesVus.length - VUS_MAX).forEach((k) => delete vus[k]);
  const ok = await ecrire(ID_BORD_TRANSPORTEURS, { ...cur, v: 1, parTx, vus, at });   // (9 nov.) `pdf`/`pdfVus` gardés
  if (!ok) return { fait: false, raison: 'écriture ratée', ranges: 0, suivis: 0, vus: 0, restants: candidats.length };
  return { fait: true, ranges, suivis, vus: nVus, restants: candidats.length - lot.length, sansEmail };
}

// L'app ET le serveur (widget, rappels, bilan) : ce qui a été relu pour un bordereau
// (son n° de transaction), SEULEMENT là où il n'a rien — un transporteur ou un n°
// déjà rangé n'est jamais remplacé. `ligne` : { parTx } (null = pas lue ⇒ rien).
export function transporteurRelu(bord, ligne) {
  if (!bord) return bord;
  const tx = String(bord.transaction || '');
  let out = bord;
  // (9 nov.) Le PDF relu (passe `passeTransporteursPdf`) : seulement là où la réception n'a rien rangé.
  const p = ligne && ligne.pdf && ligne.pdf[tx];
  if (p && typeof p === 'object') {
    if (!bord.transporteurPdf && typeof p.t === 'string' && p.t) out = { ...out, transporteurPdf: p.t, transporteurPdfSource: 'pdf-relu' };
    if (!String(out.suivi || '').trim() && typeof p.s === 'string' && transporteurDeForme(p.s)) out = { ...out, suivi: p.s, suiviSource: 'pdf-relu' };
  }
  const e = ligne && ligne.parTx && ligne.parTx[tx];
  if (!e || typeof e !== 'object') return out;
  if (!bord.transporteur && typeof e.t === 'string' && e.t) out = { ...out, transporteur: e.t, transporteurSource: 'email-relu' };
  if (!String(out.suivi || '').trim() && typeof e.s === 'string' && /^\d{8}$/.test(e.s)) out = { ...out, suivi: e.s, suiviSource: 'email-relu' };
  return out;
}
// La lecture légère de la ligne (aucun PDF, aucun texte) et la fusion d'une liste.
export const REQ_RELUS = `app_data?id=eq.${ID_BORD_TRANSPORTEURS}&select=parTx:data->parTx,pdf:data->pdf`;
export const ligneRelueDe = (rows) => {
  const r = Array.isArray(rows) && rows[0];
  if (!r) return null;
  const parTx = r.parTx && typeof r.parTx === 'object' ? r.parTx : null;
  const pdf = r.pdf && typeof r.pdf === 'object' ? r.pdf : null;
  return parTx || pdf ? { parTx: parTx || {}, pdf: pdf || {} } : null;
};
export const avecRelus = (bords, rows) => { const l = ligneRelueDe(rows); return Array.isArray(bords) && l ? bords.map((b) => transporteurRelu(b, l)) : bords; };

// ════════════════════════════════════════════════════════════════════════════
//  (9 nov.) LE PDF DES ANCIENS BORDEREAUX — la même règle qu'à la réception
//  (`transporteurDuPdf`, api/_lib/transporteur-pdf.js), en rattrapage BORNÉ :
//  · candidats : `email_bord_*` avec PDF (`meta._pdf`) jamais lu (`pdfLu` absent)
//    et sans transporteur ou sans n° ; `harvest_*_label_{tx}` (capté par
//    l'extension) quand AUCUN bordereau e-mail avec PDF n'existe pour ce n° ;
//  · identité : le n° de transaction de la ligne (`email_bord_{tx}`, `meta.tx`),
//    jamais un titre ;
//  · égress (§4.4) : UN PDF par requête (`data->>pdfB64`, rien d'autre),
//    `MAX_PDF_PAR_PASSAGE` par passage, les plus récents d'abord ;
//  · idempotent : un n° décidé (`pdf[tx]`) ou vu (`pdfVus[tx]`) n'est plus relu ;
//  · une lecture ratée (listes, ligne de rangement) ⇒ RIEN écrit ; un PDF dont
//    la lecture rate n'est pas noté (relu au passage suivant) ;
//  · résultat dans `vrm_bord_transporteurs` : `pdf: { tx: { t, s? } }` (léger,
//    lu par l'app) et `pdfVus: { tx: { r, at } }` (jamais lu par l'app).
// ════════════════════════════════════════════════════════════════════════════
export const MAX_PDF_PAR_PASSAGE = 6;
export const REQ_BORDS_PDF = 'app_data?id=like.email_bord_*&meta->>_pdf=eq.true&select=id,tx:meta->>transaction,pdfLu:meta->>pdfLu,transporteur:meta->>transporteur,suivi:meta->>suivi,recu:meta->>receivedAt';
export const REQ_LABELS_PDF = 'app_data?id=like.harvest_*_label_*&meta->>_pdf=eq.true&select=id,tx:meta->>tx,cap:meta->>capturedAt';
export const reqPdf = (id) => `app_data?id=eq.${encodeURIComponent(id)}&select=pdf:data->>pdfB64`;

export function candidatsPdf(bords, labels, cur) {
  const pdf = (cur && cur.pdf) || {}, vus = (cur && cur.pdfVus) || {};
  const out = []; const avecEmail = new Set();
  for (const b of bords || []) {
    const tx = String((b && b.tx) || '') || String((b && b.id) || '').replace(/^email_bord_/, '');
    if (!RE_TX.test(tx)) continue;
    avecEmail.add(tx);
    if (b.pdfLu != null) continue;                                   // lu à la réception
    if (b.transporteur && String(b.suivi || '').trim()) continue;    // rien à apprendre
    if (pdf[tx] || vus[tx]) continue;
    out.push({ tx, id: b.id, at: Date.parse(b.recu || '') || 0 });
  }
  for (const l of labels || []) {
    const id = String((l && l.id) || '');
    if (/_label_latest$/.test(id)) continue;
    const tx = String((l && l.tx) || '');
    if (!RE_TX.test(tx) || avecEmail.has(tx) || pdf[tx] || vus[tx]) continue;
    if (out.some((c) => c.tx === tx)) continue;
    out.push({ tx, id, at: Date.parse(l.cap || '') || 0 });
  }
  return out.sort((a, b) => b.at - a.at || (a.tx < b.tx ? 1 : -1));
}

// `lirePdf(id)` → base64 | '' (la ligne n'a pas/plus de PDF) | null (pas su).
export async function passeTransporteursPdf({ lireTout, getRow, ecrire, lirePdf, max = MAX_PDF_PAR_PASSAGE, maintenant = Date.now() }) {
  const [bords, labels] = await Promise.all([lireTout(REQ_BORDS_PDF), lireTout(REQ_LABELS_PDF)]);
  if (!Array.isArray(bords) || !Array.isArray(labels)) return { fait: false, raison: 'lecture ratée — rien écrit' };
  const memo = await getRow(ID_BORD_TRANSPORTEURS);
  if (memo === undefined) return { fait: false, raison: 'ligne de rangement illisible — rien écrit' };
  const cur = memo && typeof memo === 'object' ? memo : {};
  const cands = candidatsPdf(bords, labels, cur);
  const lot = cands.slice(0, Math.max(0, max));
  if (!lot.length) return { fait: true, ranges: 0, vus: 0, restants: 0 };
  const pdf = { ...(cur.pdf || {}) }, pdfVus = { ...(cur.pdfVus || {}) };
  const at = new Date(maintenant).toISOString();
  let ranges = 0, nVus = 0, rates = 0;
  for (const c of lot) {
    const b64 = await lirePdf(c.id);
    if (b64 == null) { rates++; continue; }
    if (!b64) { pdfVus[c.tx] = { r: 'sans-pdf', at }; nVus++; continue; }
    const d = await transporteurDuPdf(b64);
    if (d.etat === 'ok') { pdf[c.tx] = { t: d.t, ...(d.s ? { s: d.s } : {}) }; ranges++; }
    else { pdfVus[c.tx] = { r: d.etat, at }; nVus++; }
  }
  if (!ranges && !nVus) return { fait: true, ranges: 0, vus: 0, rates, restants: cands.length };
  const ok = await ecrire(ID_BORD_TRANSPORTEURS, { ...cur, v: 1, pdf, pdfVus, at });
  if (!ok) return { fait: false, raison: 'écriture ratée', ranges: 0, vus: 0, restants: cands.length };
  return { fait: true, ranges, vus: nVus, rates, restants: cands.length - ranges - nVus };
}
