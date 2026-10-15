// ════════════════════════════════════════════════════════════════════════════
// APRÈS UNE PUBLICATION eBAY : CE QUI EST VRAIMENT EN LIGNE (15 octobre)
// ════════════════════════════════════════════════════════════════════════════
// Prompt maître du 15 octobre : « vérifier après chaque publication la
// plateforme, le compte, l'identifiant d'annonce et le résultat réel ; ne pas
// confondre demandé et publié ».
// `AddFixedPriceItem` qui répond Success + un ItemID, c'est eBay qui dit « j'ai
// pris ta demande ». Ce qu'il a VRAIMENT mis en ligne se relit : un GetItem au
// jeton du vendeur (le même appel que la relecture de la règle d'offre — UN
// seul, `handlePublish` le partage), comparé point par point à ce qui est parti.
//
// Chaque point a TROIS états, jamais deux :
//   · `ok`     — eBay montre la valeur envoyée ;
//   · `ecart`  — eBay montre AUTRE CHOSE (dit, avec les deux valeurs) ;
//   · `pas-lu` — eBay ne l'a pas montré dans sa réponse : « pas su », jamais
//                « conforme » (les noms des éléments viennent de la doc
//                d'eBay, la forme de GetItem sans DetailLevel n'est pas
//                mesurée sur son compte — une absence ne vaut rien).
// Le verdict :
//   · `pas-active` — l'annonce existe mais eBay ne la dit pas « Active » ;
//   · `ecarts`     — au moins un point montre autre chose ;
//   · `partielle`  — rien de faux, mais un point ESSENTIEL (en ligne, prix,
//                    référence de la paire) n'a pas été montré ;
//   · `verifiee`   — en ligne, au bon prix, avec sa référence (si elle en a une).
// Une réponse qui ne porte pas CETTE annonce (pas d'<Item>, autre ItemID) ne
// prouve rien : `{ lu: false }` — l'écran dit « demandée, pas encore vérifiée ».
import { lireXmlEbay } from './ebay-gestion.js';

const texte = (v) => (v == null ? '' : typeof v === 'object' ? String(v['#text'] ?? '') : String(v));
const liste = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
const espaces = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
const cents = (v) => Math.round(Number(v) * 100);

// Ce qui est PARTI chez eBay, réduit à ce qu'on compare (jamais une donnée
// fournie par le navigateur sans être nettoyée : `relirepub` passe aussi ici).
export function attenduDePublication(it, compte) {
  const prix = Number(String(it && it.price != null ? it.price : '').replace(',', '.'));
  const q = parseInt(it && it.quantity != null ? it.quantity : 1, 10);
  return {
    titre: espaces(String((it && it.title) || '').slice(0, 80)),
    prix: Number.isFinite(prix) && prix > 0 ? Math.round(prix * 100) / 100 : null,
    quantite: Number.isInteger(q) && q > 0 ? q : null,
    photos: Array.isArray(it && it.photos) ? Math.min(24, it.photos.length) : null,
    sku: String((it && it.sku) || ''),
    compte: espaces(compte || ''),
  };
}

// `memeSku(vu, attendu)` : la comparaison d'identité de la route (par le N°
// que désigne le SKU, `numDeSku`), passée par l'appelant — §11, une règle.
export function verifPublication(xml, itemId, attendu, opts = {}) {
  const memeSku = typeof opts.memeSku === 'function' ? opts.memeSku : ((a, b) => espaces(a).toUpperCase() === espaces(b).toUpperCase());
  const item = lireXmlEbay(String(xml || ''), 'GetItem')?.Item;
  if (!item || espaces(texte(item.ItemID)) !== String(itemId)) return { lu: false, raison: 'illisible' };
  const a = attendu || {};
  const points = [];
  const ss = item.SellingStatus || {};
  // 1. L'annonce elle-même : en ligne ?
  const statut = espaces(texte(ss.ListingStatus));
  points.push({ cle: 'annonce', etat: !statut ? 'pas-lu' : (statut === 'Active' ? 'ok' : 'ecart'), vu: statut || null, attendu: 'Active' });
  // 2. Le compte : le vendeur que montre eBay. Le jeton est celui du compte
  //    choisi ; si eBay nomme un AUTRE vendeur, c'est dit (jamais avalé).
  const vendeur = espaces(texte(item.Seller && item.Seller.UserID));
  const compteA = espaces(a.compte || '');
  points.push({ cle: 'compte', etat: !vendeur ? 'pas-lu' : (!compteA || vendeur.toLowerCase() === compteA.toLowerCase() ? 'ok' : 'ecart'), vu: vendeur || null, attendu: compteA || null });
  // 3. La référence de la paire (SKU `VRM-{n°}`) — l'identité qui relie
  //    l'annonce à sa paire (§5). Seulement si on en a envoyé une.
  if (a.sku) {
    const s = espaces(texte(item.SKU));
    points.push({ cle: 'reference', etat: !s ? 'pas-lu' : (memeSku(s, a.sku) ? 'ok' : 'ecart'), vu: s || null, attendu: a.sku });
  }
  // 4. Le prix (et sa devise : une annonce en dollars n'est pas « au bon prix »).
  const brut = ss.CurrentPrice != null ? ss.CurrentPrice : item.StartPrice;
  const pv = texte(brut).trim();
  const pn = pv !== '' && Number.isFinite(Number(pv)) ? Math.round(Number(pv) * 100) / 100 : null;
  const dev = (brut && typeof brut === 'object' ? String(brut['@_currencyID'] || '') : '') || espaces(texte(item.Currency));
  if (a.prix != null) points.push({ cle: 'prix', etat: pn == null ? 'pas-lu' : (cents(pn) === cents(a.prix) && (!dev || dev === 'EUR') ? 'ok' : 'ecart'), vu: pn, devise: dev || null, attendu: a.prix });
  // 5. Le titre (espaces réduits : eBay peut normaliser un double espace).
  const t = espaces(texte(item.Title));
  if (a.titre) points.push({ cle: 'titre', etat: !t ? 'pas-lu' : (t === a.titre ? 'ok' : 'ecart'), vu: t || null, attendu: a.titre });
  // 6. La quantité.
  const qv = texte(item.Quantity).trim();
  const qn = /^\d+$/.test(qv) ? Number(qv) : null;
  if (a.quantite != null) points.push({ cle: 'quantite', etat: qn == null ? 'pas-lu' : (qn === a.quantite ? 'ok' : 'ecart'), vu: qn, attendu: a.quantite });
  // 7. Les photos : eBay les recopie chez lui (autres adresses) — on compare
  //    le NOMBRE. Moins que demandé = une photo refusée en silence.
  const pd = item.PictureDetails;
  const nPh = pd ? liste(pd.PictureURL).filter((x) => espaces(texte(x))).length : null;
  if (a.photos != null) points.push({ cle: 'photos', etat: nPh == null ? 'pas-lu' : (nPh === a.photos ? 'ok' : 'ecart'), vu: nPh, attendu: a.photos });

  const ecart = (k) => points.some((p) => p.cle === k && p.etat === 'ecart');
  const pasLu = (k) => points.some((p) => p.cle === k && p.etat === 'pas-lu');
  let verdict = 'verifiee';
  if (ecart('annonce')) verdict = 'pas-active';
  else if (points.some((p) => p.etat === 'ecart')) verdict = 'ecarts';
  else if (pasLu('annonce') || pasLu('prix') || pasLu('reference')) verdict = 'partielle';
  return { lu: true, itemId: String(itemId), verdict, points, vendeur: vendeur || null };
}
