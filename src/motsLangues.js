// ══ « PAIRE » OU « ARTICLE », DANS CHAQUE LANGUE (16 nov., lot traduction-restes) ══════════
// `motsVendeur()` (src/profilVendeur.js) rend les mots FRANÇAIS du vendeur connecté (« paire » pour
// des sneakers, « article » sinon) : 30 textes des écrans traduits étaient restés en français parce
// qu'ils accordent ces mots (docs/passation/2026-11-13-integration-traduction.md). Ici, les MÊMES
// clés dans chaque langue, et `trm(cle, vars)` : tr() avec les mots de la langue courante posés en
// variables ({nom}, {noms}, {Le}, {e}…). En français, ce sont EXACTEMENT ceux de motsVendeur() : le
// texte d'avant, mot pour mot (banc traduction-restes).
// Les marques d'accord françaises (« e », « es ») valent '' ailleurs : chaque traduction écrit ses
// propres accords. Traductions de première main : relecture native requise.
import { tr, langueCourante } from './i18n/index.js';
import { motsVendeur, vendCourant } from './profilVendeur.js';

const base = (o) => Object.freeze(o);
export const MOTS_LANGUES = Object.freeze({
  en: {
    sneakers: base({ nom: 'pair', noms: 'pairs', un: 'a pair', Un: 'A pair', le: 'the pair', Le: 'The pair', ce: 'this pair', tes: 'your pairs', e: '', es: '', chaque: 'Each pair', elle: 'it', Elle: 'It', une: 'one',
      Nom: 'Pair', Noms: 'Pairs', sa: 'the pair', la: 'the', La: 'The', de: 'of the pair', a: 'to the pair', Ce: 'This pair', aucune: 'no pair', Aucune: 'No pair',
      celle: 'the one', celles: 'these', toutes: 'all', Toutes: 'All', laquelle: 'which one', autre: 'another pair', meme: 'the same pair', Meme: 'The same pair', lui: 'it', eux: 'them', deNom: 'pair', deNoms: 'pairs', Tes: 'Your pairs', quelle: 'which pair', bonne: 'the right pair', AucuneDe: 'None of these pairs', mes: 'my pairs', deMeme: 'of the same pair', quelles: 'which pairs', ancienne: 'OLD pair', nouvelle: 'the new one', ta: 'your pair', deCe: 'of this pair', deLa: 'of the' }),
    autre: base({ nom: 'item', noms: 'items', un: 'an item', Un: 'An item', le: 'the item', Le: 'The item', ce: 'this item', tes: 'your items', e: '', es: '', chaque: 'Each item', elle: 'it', Elle: 'It', une: 'one',
      Nom: 'Item', Noms: 'Items', sa: 'the item', la: 'the', La: 'The', de: 'of the item', a: 'to the item', Ce: 'This item', aucune: 'no item', Aucune: 'No item',
      celle: 'the one', celles: 'these', toutes: 'all', Toutes: 'All', laquelle: 'which one', autre: 'another item', meme: 'the same item', Meme: 'The same item', lui: 'it', eux: 'them', deNom: 'item', deNoms: 'items', Tes: 'Your items', quelle: 'which item', bonne: 'the right item', AucuneDe: 'None of these items', mes: 'my items', deMeme: 'of the same item', quelles: 'which items', ancienne: 'OLD item', nouvelle: 'the new one', ta: 'your item', deCe: 'of this item', deLa: 'of the' }),
  },
  es: {
    sneakers: base({ nom: 'par', noms: 'pares', un: 'un par', Un: 'Un par', le: 'el par', Le: 'El par', ce: 'este par', tes: 'tus pares', e: '', es: '', chaque: 'Cada par', elle: 'él', Elle: 'Él', une: 'uno',
      Nom: 'Par', Noms: 'Pares', sa: 'su par', la: 'el', La: 'El', de: 'del par', a: 'al par', Ce: 'Este par', aucune: 'ningún par', Aucune: 'Ningún par',
      celle: 'el', celles: 'estos', toutes: 'todos', Toutes: 'Todos', laquelle: 'cuál', autre: 'otro par', meme: 'el mismo par', Meme: 'El mismo par', lui: 'él', eux: 'ellos', deNom: 'par', deNoms: 'pares', Tes: 'Tus pares', quelle: 'qué par', bonne: 'el par correcto', AucuneDe: 'Ninguno de estos pares', mes: 'mis pares', deMeme: 'del mismo par', quelles: 'qué pares', ancienne: 'par ANTIGUO', nouvelle: 'el nuevo', ta: 'tu par', deCe: 'de este par', deLa: 'del' }),
    autre: base({ nom: 'artículo', noms: 'artículos', un: 'un artículo', Un: 'Un artículo', le: 'el artículo', Le: 'El artículo', ce: 'este artículo', tes: 'tus artículos', e: '', es: '', chaque: 'Cada artículo', elle: 'él', Elle: 'Él', une: 'uno',
      Nom: 'Artículo', Noms: 'Artículos', sa: 'su artículo', la: 'el', La: 'El', de: 'del artículo', a: 'al artículo', Ce: 'Este artículo', aucune: 'ningún artículo', Aucune: 'Ningún artículo',
      celle: 'el', celles: 'estos', toutes: 'todos', Toutes: 'Todos', laquelle: 'cuál', autre: 'otro artículo', meme: 'el mismo artículo', Meme: 'El mismo artículo', lui: 'él', eux: 'ellos', deNom: 'artículo', deNoms: 'artículos', Tes: 'Tus artículos', quelle: 'qué artículo', bonne: 'el artículo correcto', AucuneDe: 'Ninguno de estos artículos', mes: 'mis artículos', deMeme: 'del mismo artículo', quelles: 'qué artículos', ancienne: 'artículo ANTIGUO', nouvelle: 'el nuevo', ta: 'tu artículo', deCe: 'de este artículo', deLa: 'del' }),
  },
  it: {
    sneakers: base({ nom: 'paio', noms: 'paia', un: 'un paio', Un: 'Un paio', le: 'il paio', Le: 'Il paio', ce: 'questo paio', tes: 'le tue paia', e: '', es: '', chaque: 'Ogni paio', elle: 'lui', Elle: 'Lui', une: 'uno',
      Nom: 'Paio', Noms: 'Paia', sa: 'il suo paio', la: 'il', La: 'Il', de: 'del paio', a: 'al paio', Ce: 'Questo paio', aucune: 'nessun paio', Aucune: 'Nessun paio',
      celle: 'quello', celles: 'questi', toutes: 'tutte', Toutes: 'Tutte', laquelle: 'quale', autre: 'un altro paio', meme: 'lo stesso paio', Meme: 'Lo stesso paio', lui: 'lui', eux: 'loro', deNom: 'paio', deNoms: 'paia', Tes: 'Le tue paia', quelle: 'quale paio', bonne: 'il paio giusto', AucuneDe: 'Nessuna di queste paia', mes: 'le mie paia', deMeme: 'dello stesso paio', quelles: 'quali paia', ancienne: 'paio VECCHIO', nouvelle: 'il nuovo', ta: 'il tuo paio', deCe: 'di questo paio', deLa: 'del' }),
    autre: base({ nom: 'articolo', noms: 'articoli', un: 'un articolo', Un: 'Un articolo', le: 'l’articolo', Le: 'L’articolo', ce: 'questo articolo', tes: 'i tuoi articoli', e: '', es: '', chaque: 'Ogni articolo', elle: 'lui', Elle: 'Lui', une: 'uno',
      Nom: 'Articolo', Noms: 'Articoli', sa: 'il suo articolo', la: 'il', La: 'Il', de: 'dell’articolo', a: 'all’articolo', Ce: 'Questo articolo', aucune: 'nessun articolo', Aucune: 'Nessun articolo',
      celle: 'quello', celles: 'questi', toutes: 'tutti', Toutes: 'Tutti', laquelle: 'quale', autre: 'un altro articolo', meme: 'lo stesso articolo', Meme: 'Lo stesso articolo', lui: 'lui', eux: 'loro', deNom: 'articolo', deNoms: 'articoli', Tes: 'I tuoi articoli', quelle: 'quale articolo', bonne: 'l’articolo giusto', AucuneDe: 'Nessuno di questi articoli', mes: 'i miei articoli', deMeme: 'dello stesso articolo', quelles: 'quali articoli', ancienne: 'articolo VECCHIO', nouvelle: 'il nuovo', ta: 'il tuo articolo', deCe: 'di questo articolo', deLa: 'del' }),
  },
  de: {
    sneakers: base({ nom: 'Paar', noms: 'Paare', un: 'ein Paar', Un: 'Ein Paar', le: 'das Paar', Le: 'Das Paar', ce: 'dieses Paar', tes: 'deine Paare', e: '', es: '', chaque: 'Jedes Paar', elle: 'es', Elle: 'Es', une: 'eines',
      Nom: 'Paar', Noms: 'Paare', sa: 'sein Paar', la: 'das', La: 'Das', de: 'des Paares', a: 'dem Paar', Ce: 'Dieses Paar', aucune: 'kein Paar', Aucune: 'Kein Paar',
      celle: 'das', celles: 'diese', toutes: 'alle', Toutes: 'Alle', laquelle: 'welches', autre: 'ein anderes Paar', meme: 'dasselbe Paar', Meme: 'Dasselbe Paar', lui: 'es', eux: 'sie', deNom: 'Paar', deNoms: 'Paare', Tes: 'Deine Paare', quelle: 'welches Paar', bonne: 'das richtige Paar', AucuneDe: 'Keines dieser Paare', mes: 'meine Paare', deMeme: 'desselben Paares', quelles: 'welche Paare', ancienne: 'ALTES Paar', nouvelle: 'das neue', ta: 'dein Paar', deCe: 'dieses Paares', deLa: 'des' }),
    autre: base({ nom: 'Artikel', noms: 'Artikel', un: 'ein Artikel', Un: 'Ein Artikel', le: 'der Artikel', Le: 'Der Artikel', ce: 'dieser Artikel', tes: 'deine Artikel', e: '', es: '', chaque: 'Jeder Artikel', elle: 'er', Elle: 'Er', une: 'einer',
      Nom: 'Artikel', Noms: 'Artikel', sa: 'sein Artikel', la: 'der', La: 'Der', de: 'des Artikels', a: 'dem Artikel', Ce: 'Dieser Artikel', aucune: 'kein Artikel', Aucune: 'Kein Artikel',
      celle: 'der', celles: 'diese', toutes: 'alle', Toutes: 'Alle', laquelle: 'welcher', autre: 'ein anderer Artikel', meme: 'derselbe Artikel', Meme: 'Derselbe Artikel', lui: 'er', eux: 'sie', deNom: 'Artikel', deNoms: 'Artikel', Tes: 'Deine Artikel', quelle: 'welcher Artikel', bonne: 'der richtige Artikel', AucuneDe: 'Keiner dieser Artikel', mes: 'meine Artikel', deMeme: 'desselben Artikels', quelles: 'welche Artikel', ancienne: 'ALTER Artikel', nouvelle: 'der neue', ta: 'dein Artikel', deCe: 'dieses Artikels', deLa: 'des' }),
  },
});

// Les mots du vendeur connecté, dans la langue de l'écran (français : motsVendeur() tel quel).
export function motsLangue(l = langueCourante()) {
  const fr = motsVendeur();
  if (l === 'fr' || !MOTS_LANGUES[l]) return fr;
  return MOTS_LANGUES[l][vendCourant() === 'sneakers' ? 'sneakers' : 'autre'];
}
// tr() avec ces mots posés en variables ; les variables passées l'emportent (n, num…).
export const trm = (cle, vars) => tr(cle, { ...motsLangue(), ...(vars || {}) });
