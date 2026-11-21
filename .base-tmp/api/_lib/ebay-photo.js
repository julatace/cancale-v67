// api/_lib/ebay-photo.js
// ────────────────────────────────────────────────────────────────────────────
// (5 nov.) UNE PHOTO PRISE OU CHOISIE SUR LE TÉLÉPHONE, POUR UNE ANNONCE eBAY.
// Julien (demandes du 5 nov.) : « améliorer l'interface et la mise en ligne ;
// prendre en photo l'article ou l'importer depuis la galerie ».
//
// La publication eBay (`itemXml`, AddFixedPriceItem) ne prend que des ADRESSES
// de photos (<PictureURL>). Une photo du téléphone n'a pas d'adresse : on la
// confie à l'hébergement d'images d'eBay lui-même (Trading
// `UploadSiteHostedPictures`, envoi multipart : la requête XML puis les octets),
// qui rend son adresse `https://i.ebayimg.com/…`. C'est cette adresse, et elle
// seule, qui part ensuite dans l'annonce.
// Pourquoi pas le stockage Supabase (compartiment `detourage`) : il est PRIVÉ
// (la clé de service le lit), eBay ne pourrait pas y lire la photo sans une
// adresse signée qui expire ; et créer un compartiment public toucherait la
// base de production. L'hébergement d'eBay ne crée rien chez nous, et passe par
// la route eBay existante (aucune nouvelle fonction api/, plafond Hobby).
//
// Garde-fous :
//   · des OCTETS D'IMAGE (JPEG, PNG, WebP, HEIC — `estUneImage`, la règle du
//     détourage), sinon 400 et rien n'est envoyé à eBay ;
//   · une taille bornée (base64 ≤ PHOTO_MAX_B64, sous les 4,5 Mo d'une requête
//     Vercel ; l'app réduit la photo à 1600 px avant d'envoyer) ;
//   · une adresse rendue qui n'est pas chez eBay (`i.ebayimg.com`) n'est JAMAIS
//     rendue comme un succès (« pas su » ≠ « oui ») ;
//   · rien n'est publié ici : la photo hébergée attend l'annonce, que seul SON
//     clic publie (confirmation, `confirme:true`).
// Non mesuré sur un vrai compte eBay (aucun appel réel depuis ce dépôt) : la
// forme de la réponse suit la documentation Trading (SiteHostedPictureDetails).
// ────────────────────────────────────────────────────────────────────────────
import { estUneImage } from './detourage.js';
import { URL_PHOTO_EBAY } from '../../src/photosEbayAjout.js';
import { fetchAvecDelai } from './fetch-delai.js';   // (11 nov.) chaque appel sortant a un délai

export const PHOTO_MAX_B64 = 3000000;              // ~2,2 Mo d'octets
export { URL_PHOTO_EBAY };
const B64 = /^[A-Za-z0-9+/]+={0,2}$/;

const dexml = (s) => String(s || '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

// Le corps multipart d'UploadSiteHostedPictures : la requête XML d'abord, les
// octets ensuite (l'ordre exigé par eBay).
export function corpsPhotoEbay(octets, frontiere) {
  const xml = '<?xml version="1.0" encoding="utf-8"?>'
    + '<UploadSiteHostedPicturesRequest xmlns="urn:ebay:apis:eBLBaseComponents">'
    + '<PictureName>VRM</PictureName><PictureSet>Supersize</PictureSet>'
    + '</UploadSiteHostedPicturesRequest>';
  const avant = `--${frontiere}\r\n`
    + 'Content-Disposition: form-data; name="XML Payload"\r\n'
    + 'Content-Type: text/xml;charset=utf-8\r\n\r\n'
    + xml + '\r\n'
    + `--${frontiere}\r\n`
    + 'Content-Disposition: form-data; name="image"; filename="photo.jpg"\r\n'
    + 'Content-Type: application/octet-stream\r\n'
    + 'Content-Transfer-Encoding: binary\r\n\r\n';
  const apres = `\r\n--${frontiere}--\r\n`;
  return Buffer.concat([Buffer.from(avant, 'utf8'), octets, Buffer.from(apres, 'utf8')]);
}

// L'adresse de la photo hébergée, lue dans la réponse ; '' si elle manque ou
// si elle n'est pas chez eBay.
export function adressePhotoEbay(xml) {
  const m = /<SiteHostedPictureDetails>[\s\S]*?<FullURL>([\s\S]*?)<\/FullURL>/.exec(String(xml || ''));
  const u = m ? dexml(m[1]).trim() : '';
  return URL_PHOTO_EBAY.test(u) ? u : '';
}

// Les octets d'une image envoyée en base64 par l'app ; `{ err }` sinon.
export function octetsPhoto(b64) {
  const s = typeof b64 === 'string' ? b64.replace(/^data:image\/[a-z+.-]+;base64,/i, '').replace(/\s+/g, '') : '';
  if (!s) return { err: 'Aucune photo reçue — rien n\'a été envoyé.' };
  if (s.length > PHOTO_MAX_B64) return { err: 'Photo trop lourde — rien n\'a été envoyé. Réessaie avec une photo plus petite.' };
  if (!B64.test(s)) return { err: 'Photo illisible — rien n\'a été envoyé.' };
  const buf = Buffer.from(s, 'base64');
  if (!estUneImage(buf)) return { err: 'Ce fichier n\'est pas une photo (JPEG, PNG, WebP, HEIC) — rien n\'a été envoyé.' };
  return { buf };
}

// Le geste complet, avec ses dépendances passées (jeton, site, adresse de l'API)
// pour que la route garde SON appel au marché du compte.
export async function televerserPhotoEbay(b, { jeton, siteId, api, fetchImpl = fetchAvecDelai }) {
  const o = octetsPhoto(b && b.image);
  if (o.err) return { status: 400, body: { ok: false, reason: 'photo', error: o.err } };
  const at = await jeton();
  if (!at.ok) return { status: at.status || 502, body: { ok: false, reason: at.reason, error: at.error } };
  const frontiere = 'vrm' + Math.random().toString(16).slice(2) + Date.now().toString(16);
  let r, xml = '';
  try {
    r = await fetchImpl(`${api}/ws/api.dll`, {
      method: 'POST',
      headers: { 'X-EBAY-API-CALL-NAME': 'UploadSiteHostedPictures', 'X-EBAY-API-SITEID': String(siteId), 'X-EBAY-API-COMPATIBILITY-LEVEL': '1149', 'X-EBAY-API-IAF-TOKEN': at.token, 'Content-Type': `multipart/form-data; boundary=${frontiere}` },
      body: corpsPhotoEbay(o.buf, frontiere),
    });
    xml = await r.text();
  } catch (_) { return { status: 504, body: { ok: false, reason: 'reseau', error: 'eBay n\'a pas répondu — la photo n\'est pas ajoutée. Réessaie.' } }; }
  const ack = (/<Ack>([\s\S]*?)<\/Ack>/.exec(xml) || [])[1] || '';
  const url = r.ok && /Success|Warning/i.test(ack) ? adressePhotoEbay(xml) : '';
  if (!url) {
    const msg = dexml((/<LongMessage>([\s\S]*?)<\/LongMessage>/.exec(xml) || /<ShortMessage>([\s\S]*?)<\/ShortMessage>/.exec(xml) || [])[1] || '').trim();
    return { status: r.status >= 400 ? r.status : 422, body: { ok: false, reason: 'photo-refusee', error: msg ? `eBay n'a pas pris la photo : ${msg.slice(0, 200)}` : 'eBay n\'a pas rendu l\'adresse de la photo — elle n\'est pas ajoutée.' } };
  }
  return { status: 200, body: { ok: true, url } };
}
