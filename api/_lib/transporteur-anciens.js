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
import { transporteurDeTexteBordereau, transporteursNommes } from './transporteur-bordereau.js';
import { TEXTE_MAX } from './resume-email.js';

export const ID_BORD_TRANSPORTEURS = 'vrm_bord_transporteurs';
export const MAX_PAR_PASSAGE = 20;
const VUS_MAX = 2000;
const RE_TX = /^\d{6,20}$/;

export const REQ_BORDS = 'app_data?id=like.email_bord_*&select=id,tx:meta->>transaction,transporteur:meta->>transporteur,recu:meta->>receivedAt';
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
    candidats.push({ tx, recu: Date.parse(b.recu || '') || 0 });
  }
  candidats.sort((a, b) => b.recu - a.recu || (a.tx < b.tx ? 1 : -1));
  const lot = candidats.slice(0, Math.max(0, max));
  if (!lot.length) return { fait: true, ranges: 0, vus: 0, restants: 0, sansEmail };

  const cles = lot.flatMap((c) => emailsParTx.get(c.tx).map((e) => e.cle)).filter((c) => /^[A-Za-z0-9_-]{1,80}$/.test(c));
  const textes = cles.length ? await lireTout(reqTextes(cles)) : [];
  if (!Array.isArray(textes)) return { fait: false, raison: 'textes illisibles — rien écrit' };
  const texteDe = new Map(textes.map((t) => [String(t.id || '').replace(/^email_texte_/, ''), t.texte]));

  const at = new Date(maintenant).toISOString();
  let ranges = 0, nVus = 0;
  for (const c of lot) {
    const d = decisionPourTx(emailsParTx.get(c.tx).map((e) => ({ sujet: e.sujet, texte: texteDe.get(e.cle) })));
    if (d.t) { parTx[c.tx] = { t: d.t, at }; ranges++; }
    else { vus[c.tx] = { at, r: d.r }; nVus++; }
  }
  // Borné : les « vus » les plus anciens tombent (ils seraient simplement relus).
  const clesVus = Object.keys(vus);
  if (clesVus.length > VUS_MAX) clesVus.sort((a, b) => String(vus[a].at).localeCompare(String(vus[b].at))).slice(0, clesVus.length - VUS_MAX).forEach((k) => delete vus[k]);
  const ok = await ecrire(ID_BORD_TRANSPORTEURS, { v: 1, parTx, vus, at });
  if (!ok) return { fait: false, raison: 'écriture ratée', ranges: 0, vus: 0, restants: candidats.length };
  return { fait: true, ranges, vus: nVus, restants: candidats.length - lot.length, sansEmail };
}

// L'app (et tout lecteur) : le transporteur relu pour un bordereau, SEULEMENT s'il n'en a pas.
export function transporteurRelu(bord, ligne) {
  if (!bord) return bord;
  if (bord.transporteur) return bord;
  const tx = String(bord.transaction || '');
  const e = ligne && ligne.parTx && ligne.parTx[tx];
  return e && typeof e.t === 'string' && e.t ? { ...bord, transporteur: e.t, transporteurSource: 'email-relu' } : bord;
}
