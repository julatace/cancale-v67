// ════════════════════════════════════════════════════════════════════════════
//  LE TRANSPORTEUR LU DANS LE PDF DU BORDEREAU (9 nov., « transporteurs inconnus »)
//  Julien : « Règle le problème des transporteurs inconnus. » Le PDF du bordereau
//  est rangé pour SA vente (`email_bord_{tx}` reçu par e-mail, `harvest_{uid}_label_{tx}`
//  capté par l'extension) : il est relié à la vente par SON n° de transaction — une
//  identité (§5). L'étiquette elle-même nomme le plus souvent son transporteur.
//
//  ⚠️ JAMAIS DEVINÉ (§5), la MÊME règle que l'e-mail du bordereau
//     (`transporteursNommes`, api/_lib/transporteur-bordereau.js) :
//    · un SEUL transporteur nommé dans le texte du PDF ⇒ sa clé ;
//    · deux noms ou plus ⇒ rien (« plusieurs ») ;
//    · aucun texte lisible (étiquette en image, police sans table) ⇒ rien (« aucun ») ;
//    · PDF illisible ⇒ rien (« illisible ») ;
//    · le n° lu dans le PDF n'est gardé que s'il a la FORME PROPRE de CE transporteur
//      (`transporteurDeForme` le rend lui-même), qu'il est UNIQUE dans le PDF, et,
//      pour Mondial Relay (8 chiffres, une forme banale), seulement écrit juste après
//      « suivi / expédition / colis / tracking ».
//  Le texte du PDF n'est JAMAIS gardé (il porte l'adresse de l'acheteur) : seuls la
//  clé, le n° et l'état sont rangés, en scalaires (⇒ `meta`, §4.4).
// ════════════════════════════════════════════════════════════════════════════
import { transporteursNommes } from './transporteur-bordereau.js';
import { transporteurDeForme, FORME_CHRONOPOST_PROPRE } from './suivi-colis.js';
import { texteDuPdf } from './texte-pdf.js';

const sansAccents = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '');

// Les noms longs, cherchés AUSSI dans le texte sans aucun espace (une étiquette qui
// dessine chaque lettre séparément : « M o n d i a l  R e l a y »). Les sigles courts
// (UPS, DPD, GLS) ne le sont pas : collés, ils apparaissent dans n'importe quel mot.
const NOMS_COLLES = [
  ['mondialrelay', /mondialrelay/],
  ['chronopost', /chronopost/],
  ['shop2shop', /shop2shop/],
  ['relaiscolis', /relaiscolis/],
  ['colissimo', /colissimo/],
];

export function transporteursDuPdf(texte) {
  const out = transporteursNommes(texte);
  const colle = sansAccents(texte).toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const [cle, re] of NOMS_COLLES) if (re.test(colle)) out.add(cle);
  if (out.has('shop2shop') && out.has('chronopost')) out.delete('shop2shop');
  if (out.has('inpost')) { out.delete('inpost'); out.add('mondialrelay'); }   // InPost = réseau Mondial Relay
  return out;
}

// (11 nov., « transporteurs inconnus » — mesuré sur ses vrais bordereaux) L'étiquette InPost / Mondial
// Relay ne NOMME personne en texte (les logos sont des images) mais imprime son code-barres en clair :
// 26 chiffres commençant par « 56 », dont les chiffres 3 à 10 sont le n° Mondial Relay (3 bordereaux sur 3 :
// le n° de l'e-mail). Une FORME PROPRE, comme XW…TS pour Chronopost : un seul code de cette forme dans le
// PDF ⇒ Mondial Relay et son n° ; zéro ou plusieurs ⇒ rien (jamais deviné).
export const RE_CODE_MR = /56\d{24}/g;
export function codeMondialRelay(texte) {
  const colle = String(texte == null ? '' : texte).replace(/\s+/g, '');
  const codes = [...new Set(colle.match(RE_CODE_MR) || [])];
  return codes.length === 1 ? { code: codes[0], suivi: codes[0].slice(2, 10) } : null;
}
// La version de la règle : une décision « aucun » prise AVANT elle est relue une fois (anciens bordereaux).
export const REGLE_PDF = 2;

const uniques = (l) => [...new Set(l)];
// Le n° de suivi écrit dans le PDF, de la forme propre de `cle`, unique ; sinon ''.
export function suiviDuPdf(texte, cle) {
  const t = sansAccents(texte).toUpperCase();
  let cands = [];
  if (cle === 'chronopost' || cle === 'shop2shop') {
    const colle = t.replace(/[^A-Z0-9]/g, '');
    cands = uniques([...colle.matchAll(/[XZ]W\d{9}(?:TS|SP)/g)].map((m) => m[0])).filter((n) => FORME_CHRONOPOST_PROPRE.test(n));
  } else if (cle === 'mondialrelay') {
    cands = uniques([...t.matchAll(/(?:SUIVI|EXPEDITION|COLIS|TRACKING)[^0-9A-Z]{0,4}(?:N\s*[°ºO]?\s*)?(?:DE\s+)?[^0-9A-Z]{0,6}(\d{8})(?!\d)/g)].map((m) => m[1]));
  } else if (cle === 'vinted') {
    cands = uniques([...t.replace(/\s+/g, '').matchAll(/VGS\d{8,20}/g)].map((m) => m[0]));
  }
  if (cands.length !== 1) return '';
  const n = cands[0];
  const f = transporteurDeForme(n);
  const attendu = cle === 'shop2shop' ? 'chronopost' : cle;
  return f === attendu ? n : '';
}

// La décision sur un TEXTE de PDF : { etat, t, s }.
//   etat : 'ok' | 'aucun' | 'plusieurs' | 'illisible'
export function decisionTexteBordereau(texte) {
  if (texte == null) return { etat: 'illisible', t: '', s: '' };
  const noms = transporteursDuPdf(texte);
  const mr = codeMondialRelay(texte);
  if (noms.size === 0) return mr ? { etat: 'ok', t: 'mondialrelay', s: mr.suivi } : { etat: 'aucun', t: '', s: '' };
  if (noms.size > 1) return { etat: 'plusieurs', t: '', s: '' };
  const t = [...noms][0];
  return { etat: 'ok', t, s: suiviDuPdf(texte, t) || (t === 'mondialrelay' && mr ? mr.suivi : '') };
}

// Le PDF (base64 ou octets) ⇒ la décision. Ne lève jamais.
export async function transporteurDuPdf(pdf) {
  try { return decisionTexteBordereau(await texteDuPdf(pdf)); }
  catch (_) { return { etat: 'illisible', t: '', s: '' }; }
}

// Les champs SCALAIRES rangés sur la ligne du bordereau (⇒ `meta`).
export const champsPdf = (d) => ({ pdfLu: d.etat, transporteurPdf: d.t || '', suiviPdf: d.s || '' });
