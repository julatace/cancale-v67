// ════════════════════════════════════════════════════════════════════════════
//  LES SUIVIS DE COLIS SANS L'IMAGE DU QR DES COLIS DÉJÀ RETIRÉS (8 nov.)
// ════════════════════════════════════════════════════════════════════════════
//  `email_track_*` se lisait `select=id,data` : chaque ligne porte `qrB64`, l'IMAGE
//  du QR (une PNG en base64), gardée sur la ligne pour toujours — y compris quand
//  le colis est retiré depuis des mois (api/email-inbound.js garde le QR d'un
//  e-mail à l'autre). Lue à CHAQUE ouverture de l'app, sur chaque écran.
//
//  ⇒ Trois lectures PARALLÈLES (aucune n'attend l'autre) :
//   A. `select=id,meta,<champs non scalaires ou longs>` : la colonne `meta`
//      (migration 004, tenue par la base à chaque écriture) porte TOUS les champs
//      scalaires de premier niveau de moins de 600 caractères — exactement ce
//      que lisent déjà le widget et le rappel du matin (`SELECT_SUIVI_META`).
//      `qrB64` (une image, des milliers de caractères) n'y est jamais. Ce que
//      `meta` ne porte pas (un tableau comme `recuSur`, un texte long) est lu par
//      son chemin (`CHAMPS_HORS_META`) ;
//   B. l'image du QR des lignes qui en ont une et dont l'état RANGÉ n'est pas
//      « retiré / livré » (`delivered`) — les colis encore à aller chercher ;
//   C. l'identifiant des lignes « retiré » qui ont un QR (aucune image).
//  Puis l'app relit chaque ligne (`relireLigneSuivi`) : une ligne rangée
//  « retiré » que la relecture remet « à retirer » (rare) a son QR relu
//  aussitôt (D, `id=in.(…)`). Une ligne retirée garde `qrOmis: true` : son QR
//  se relit à l'ouverture de la vue en grand (`lireQrDeLigne`).
//
//  ⚠️ RÈGLES TENUES
//   · « pas su » : UNE lecture ratée (A, B, C, D ou E) ⇒ `null` pour tout le
//     suivi, comme quand la lecture unique ratait — jamais une liste sans QR
//     présentée comme complète ;
//   · une ligne SANS `meta` (base sans la migration 004, ligne écrite avant son
//     rattrapage, banc qui ne sert pas la colonne) est relue ENTIÈRE (E,
//     `select=id,data`, par lots de son id) : rien n'est deviné ;
//   · une valeur `null` rangée vaut un champ absent (ce que fait déjà `meta`) ;
//   · l'identité d'un colis reste son n° (les lignes gardent tous leurs champs).
// ════════════════════════════════════════════════════════════════════════════

// Les champs d'une ligne de suivi qui peuvent manquer à `meta` : non scalaires
// (`recuSur`, un tableau ; `sms`, la trace du SMS Mondial Relay) et les extraits
// bornés à 600/400 CARACTÈRES par le serveur (api/email-inbound.js), qui peuvent
// dépasser 600 OCTETS en JSON (accents, `\n`). Lus par leur chemin (`data->k` :
// la forme JSON gardée). Le sujet, le lieu, le titre et le libellé sont lus dans
// `meta` — la source que lisent déjà le widget et le rappel du matin
// (`SELECT_SUIVI_META`, api/_lib/suivi-colis.js) : une règle, une source (§11).
export const CHAMPS_HORS_META = ['recuSur', 'sms', 'extraitLieu', 'extraitCode'];
export const SEL_SUIVI_SANS_QR = 'id,meta,' + CHAMPS_HORS_META.map((k) => `${k}:data->${k}`).join(',');
const FAMILLE = 'id=like.email_track_*';
export const Q_SUIVIS = `${FAMILLE}&select=${SEL_SUIVI_SANS_QR}`;
// B : `neq` écarte un état NULL en SQL ⇒ `or=(…is.null, …neq.delivered)`.
export const Q_QR_UTILES = `${FAMILLE}&data->>qrB64=not.is.null&or=(data->>status.is.null,data->>status.neq.delivered)&select=id,qrB64:data->>qrB64,qrType:data->>qrType`;
export const Q_QR_RETIRES = `${FAMILLE}&data->>qrB64=not.is.null&data->>status=eq.delivered&select=id`;
export const LOT_IDS = 40;
const idSur = (id) => typeof id === 'string' && /^[A-Za-z0-9_.:-]+$/.test(id);

// Lit des lignes par identifiant, par lots `in.(…)` (un id pas sûr : seul).
async function parIds(lire, ids, select) {
  const out = [];
  const sures = ids.filter(idSur), autres = ids.filter((x) => !idSur(x));
  for (let i = 0; i < sures.length; i += LOT_IDS) {
    const l = await lire(`id=in.(${sures.slice(i, i + LOT_IDS).join(',')})&select=${select}`);
    if (!Array.isArray(l)) return null;
    out.push(...l);
  }
  for (const id of autres) {
    const l = await lire(`id=eq.${encodeURIComponent(id)}&select=${select}`);
    if (!Array.isArray(l)) return null;
    out.push(...l);
  }
  return out;
}

// Une ligne lue (A) ⇒ son `data` : `meta` + les champs lus par leur chemin.
// `null` si la ligne n'a pas de `meta` (à relire entière).
export function dataDeLigneSansQr(r) {
  if (!r || !r.meta || typeof r.meta !== 'object' || Array.isArray(r.meta)) return null;
  const d = { ...r.meta };
  // `_pdf` est un témoin ajouté par la base, pas un champ de la ligne.
  delete d._pdf;
  for (const k of CHAMPS_HORS_META) if (r[k] !== undefined && r[k] !== null) d[k] = r[k];
  return d;
}

// `lireTout(q)` : toutes les pages, tableau ou `null` (pas su).
// `lire(q)` : une requête, tableau ou `null`.
// `besoinQr(data)` : la ligne RELUE par l'app a-t-elle besoin de son QR ?
// Rend `[{ id, data }]` (la forme de l'ancienne lecture `select=id,data`) ou `null`.
export async function lireSuivisSansQr({ lireTout, lire, besoinQr }) {
  const [a, b, c] = await Promise.all([lireTout(Q_SUIVIS), lireTout(Q_QR_UTILES), lireTout(Q_QR_RETIRES)]);
  if (!Array.isArray(a) || !Array.isArray(b) || !Array.isArray(c)) return null;
  const qr = new Map(b.filter((x) => x && x.id && x.qrB64).map((x) => [String(x.id), x]));
  const retiresAvecQr = new Set(c.filter((x) => x && x.id).map((x) => String(x.id)));
  const lignes = [];
  const sansMeta = [];
  for (const r of a) {
    if (!r || typeof r.id !== 'string') continue;
    // Un serveur qui rend la ligne ENTIÈRE malgré la projection (PostgREST ne le
    // fait jamais ; un faux serveur de banc, oui) : la ligne est là, on la garde.
    if (r.data && typeof r.data === 'object' && !Array.isArray(r.data) && !r.meta) { lignes.push({ id: r.id, data: r.data }); continue; }
    const d = dataDeLigneSansQr(r);
    if (!d) { sansMeta.push(r.id); continue; }
    const q = qr.get(r.id);
    if (q) { d.qrB64 = q.qrB64; if (q.qrType) d.qrType = q.qrType; }
    else if (retiresAvecQr.has(r.id)) d.qrOmis = true;
    lignes.push({ id: r.id, data: d });
  }
  // E. Les lignes sans `meta` : relues entières (QR compris), comme avant.
  if (sansMeta.length) {
    const e = await parIds(lire, sansMeta, 'id,data');
    if (!Array.isArray(e)) return null;
    const parId = new Map(e.filter((x) => x && x.id).map((x) => [String(x.id), x]));
    for (const id of sansMeta) { const x = parId.get(id); if (x) lignes.push({ id, data: x.data }); }
  }
  // D. Une ligne rangée « retiré » que la relecture remet en jeu : son QR, tout de suite.
  const aRelire = lignes.filter((l) => l.data && l.data.qrOmis && besoinQr && besoinQr(l.data)).map((l) => l.id);
  if (aRelire.length) {
    const d = await parIds(lire, aRelire, 'id,qrB64:data->>qrB64,qrType:data->>qrType');
    if (!Array.isArray(d)) return null;
    const parId = new Map(d.filter((x) => x && x.id && x.qrB64).map((x) => [String(x.id), x]));
    for (const l of lignes) {
      const x = parId.get(l.id);
      if (x) { l.data = { ...l.data, qrB64: x.qrB64, ...(x.qrType ? { qrType: x.qrType } : {}) }; delete l.data.qrOmis; }
    }
  }
  return lignes;
}

// Le QR d'UNE ligne (vue en grand d'un colis retiré) : `{qrB64, qrType}` ou `null`.
export async function lireQrDeLigne(lire, id) {
  if (!id) return null;
  const l = await lire(`id=eq.${encodeURIComponent(id)}&select=qrB64:data->>qrB64,qrType:data->>qrType`);
  return Array.isArray(l) && l[0] && l[0].qrB64 ? { qrB64: l[0].qrB64, qrType: l[0].qrType || null } : null;
}
