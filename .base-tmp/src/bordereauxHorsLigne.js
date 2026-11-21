// ════════════════════════════════════════════════════════════════════════════
//  LES BORDEREAUX DÉJÀ OUVERTS, GARDÉS POUR LE HORS CONNEXION (9 nov. 2026)
// ════════════════════════════════════════════════════════════════════════════
// Au point relais sans réseau, le colis à déposer : le bordereau qu'il a déjà
// ouvert dans VRM (avec du réseau) reste lisible — c'est le PDF tel que Vinted
// (ou l'e-mail) l'a fourni, sans le tampon du N°.
//
//   · On ne garde QUE ce qui a déjà été lu (aucun téléchargement de plus : un PDF
//     est une ligne lourde, §4.4) — `lirePdfLigne` le range au passage.
//   · Seulement les lignes de BORDEREAU (`email_bord_*`, `…_label_{tx}`), jamais
//     `label_latest` (la dernière capture du compte : elle change de vente) ni un
//     reçu, une facture.
//   · Par vendeur : l'adresse dans la réserve porte SON identifiant ; une lecture
//     ne regarde que la sienne. La réserve part à la déconnexion (`wipeLocalData`).
//   · Le lien colis → bordereau est l'IDENTITÉ calculée en ligne (le n° de
//     transaction de la vente → ses lignes de bordereau, `bordsParTxn` /
//     `labelsCaptes`), rangée dans la photo de Ma journée (`envoyer[].pdf`) —
//     jamais un rapprochement par le titre (§5).
//   · Au plus `PDF_MAX` bordereaux (les plus anciens partent d'abord).
// Le service worker garde cette réserve à la mise à jour (`vrm-hl-*`, public/sw.js).

export const CACHE_PDF = 'vrm-hl-pdf';
export const PDF_MAX = 30;
const uidValide = (uid) => typeof uid === 'string' && uid.length > 0 && uid.length <= 80 && /^[A-Za-z0-9_-]+$/.test(uid);

// Une ligne de bordereau gardable : l'e-mail du bordereau, ou un bordereau capté
// pour UNE transaction. Jamais `label_latest`, jamais autre chose.
export function estLigneBordereau(row) {
  const r = String(row || '');
  if (!r || r.length > 200 || /[\s/?#]/.test(r)) return false;
  if (/_label_latest$/.test(r)) return false;
  return /^email_bord_[A-Za-z0-9_.-]+$/.test(r) || /^harvest_[A-Za-z0-9]+_label_[A-Za-z0-9_.-]+$/.test(r);
}
export const adressePdf = (uid, row) => `/hl-pdf/${encodeURIComponent(uid)}/${encodeURIComponent(row)}`;

// Range les octets (déjà vérifiés `%PDF` par `lirePdfLigne`). Rend true si rangé.
export async function garderPdf(uid, row, octets, cachesApi = (typeof caches !== 'undefined' ? caches : null)) {
  try {
    if (!cachesApi || !uidValide(uid) || !estLigneBordereau(row) || !octets || !(octets.length > 4)) return false;
    const c = await cachesApi.open(CACHE_PDF);
    await c.put(adressePdf(uid, row), new Response(octets, { headers: { 'Content-Type': 'application/pdf', 'x-vrm-at': String(Date.now()) } }));
    const cles = await c.keys();
    for (const k of cles.slice(0, Math.max(0, cles.length - PDF_MAX))) await c.delete(k);
    return true;
  } catch (_) { return false; }
}
// Le premier bordereau gardé parmi `rows` (dans l'ordre : capté, puis e-mail),
// pour CE vendeur seulement. Rend un Blob, ou null (pas gardé ici).
export async function lirePdfGarde(uid, rows, cachesApi = (typeof caches !== 'undefined' ? caches : null)) {
  try {
    if (!cachesApi || !uidValide(uid)) return null;
    const c = await cachesApi.open(CACHE_PDF);
    for (const row of (Array.isArray(rows) ? rows : [])) {
      if (!estLigneBordereau(row)) continue;
      const r = await c.match(adressePdf(uid, row));
      if (r && r.ok) { const b = await r.blob(); if (b && b.size > 4) return b; }
    }
    return null;
  } catch (_) { return null; }
}
// Les lignes de bordereau d'une vente, gardées dans la photo (au plus deux).
export const lignesPdfPhoto = (rows) => [...new Set((Array.isArray(rows) ? rows : []).map(String).filter(estLigneBordereau))].slice(0, 2);
