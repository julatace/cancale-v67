// ════════════════════════════════════════════════════════════════════════════
//  LES RAPPELS DES TRANSPORTEURS : LE MÊME COLIS, JAMAIS UNE 2e LIGNE (13 nov.)
// ════════════════════════════════════════════════════════════════════════════
//  Julien : « je veux que l'app sache simplement lire les rappels ».
//  Formes MESURÉES (sujets, lecture seule, 13 nov.) — 50 rappels reçus depuis le 25 oct. :
//   · Mondial Relay  « Le temps file : votre colis vous attend avec impatience ⏳ » (18) — n° dans le corps
//     (« votre colis n° 12345678 »), code, point, « RETRAIT JUSQU'AU 14/11 » ;
//   · Chronopost     « Votre colis VINTED vous attend toujours en relais Pickup ! » (5) ;
//   · Vinted Go      « Libère de la place dans la consigne : récupère ton colis sans attendre ! #{n°} » (21)
//                    et « Rappel : récupère ton colis avant le JJ/MM/AAAA #{n°} » (6).
//  Tous ceux dont le n° est lisible sont tombés sur la ligne de LEUR colis (clé = n°) : aucune 2e ligne depuis
//  le 25 oct. (11 lignes « info » à part datent de septembre, avant la lecture du n° du sujet). Aucun « retiré »
//  réveillé. Défaut trouvé : la date limite Vinted Go (« À retirer avant le » / « *12/11/2026* » à la ligne,
//  en gras) n'était jamais lue — corrigé dans `limiteRetraitDepuisTexte` (api/_lib/retrait-colis.js).
//
//  LA RÈGLE (une, pure, utilisée par la route api/email-inbound.js) : un e-mail d'un colis déjà rangé (même n°)
//   · confirme « toujours au point » — sauf un retrait / retour prouvé (`conserverRetrait`, etat-colis-email.js) ;
//   · met à jour la date limite s'il la donne (le plus récent gagne) ;
//   · complète ce qui manquait (lieu, code, QR, horaires, titre, consigne) et n'efface JAMAIS ce qui est connu ;
//   · un e-mail PLUS ANCIEN que la ligne (rejeu) ne remplace rien de ce que la ligne sait.
//  La notification d'arrivée a sa clé PAR COLIS (`relais-{n°}-code`, api/email-inbound.js `cleNotifColis`) : un
//  rappel ne la refait pas sonner.
// ════════════════════════════════════════════════════════════════════════════

const sans = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const FORMES_RAPPEL = [
  ['mondialrelay-temps-file', /\ble\s+temps\s+file\b/],
  ['chronopost-attend-toujours', /\bvous\s+attend\s+toujours\b/],
  ['vintedgo-libere', /\blibere\s+de\s+la\s+place\b/],
  ['vintedgo-rappel', /^\s*rappel\s*:\s*recupere\s+ton\s+colis\b/],
];
// La forme du rappel (sujet seul), ou null : ce n'est pas un rappel connu.
export function formeRappel(sujet) {
  const s = sans(sujet);
  for (const [k, re] of FORMES_RAPPEL) if (re.test(s)) return k;
  return null;
}

// Les champs qu'un e-mail suivant ne doit jamais effacer quand il ne les porte pas.
const GARDES = ['code', 'code2', 'lieu', 'limite', 'artTitle', 'horaires'];
const vide = (v) => v == null || v === '' || (Array.isArray(v) && !v.length);

// track : ce que CET e-mail dit (parseCarrierEmail) · qr : son QR · prev : la ligne déjà rangée (ou null).
// plusAncien : CET e-mail est daté avant celui qui a rangé la ligne. Rend { track, qr } (nouveaux objets).
export function completerParLignePrecedente(track0, qr0, prev, { plusAncien = false } = {}) {
  const track = { ...(track0 || {}) }, qr = { ...(qr0 || {}) };
  if (!prev || typeof prev !== 'object') return { track, qr };
  const redirige = !!track.relaisChange;                 // un colis redirigé ne garde pas l'ancien point
  // Un e-mail PLUS ANCIEN (rejeu, boîte lue à l'envers) ne remplace pas ce que la ligne plus récente sait.
  if (plusAncien && prev.status === 'available' && track.status === 'available') {
    if (prev.code) { track.code = prev.code; track.code2 = prev.code2 || null; }
    if (prev.qrB64 || prev.qrUrl) { qr.qrB64 = prev.qrB64 || null; qr.qrType = prev.qrType || null; qr.qrUrl = prev.qrUrl || null; }
    if (prev.lieu) track.lieu = prev.lieu;
    if (prev.limite) track.limite = prev.limite;
    if (!vide(prev.horaires)) track.horaires = prev.horaires;
  }
  // Ce que CET e-mail ne dit pas reste ce qu'on savait.
  if (!qr.qrB64 && prev.qrB64) { qr.qrB64 = prev.qrB64; qr.qrType = prev.qrType; }
  if (!qr.qrUrl && prev.qrUrl) qr.qrUrl = prev.qrUrl;
  for (const k of GARDES) {
    if (redirige && (k === 'lieu' || k === 'horaires')) continue;
    if (vide(track[k]) && !vide(prev[k])) track[k] = prev[k];
  }
  if (!track.consigne && prev.consigne) track.consigne = true;
  return { track, qr };
}
