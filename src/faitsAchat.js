// ═══════════════════════════════════════════════════════════════════════════
// CE QU'ON SAIT D'UN ACHAT, POUR LE RECONNAÎTRE AU MOMENT DE LE RELIER (17 nov., lot relier-taille)
// ═══════════════════════════════════════════════════════════════════════════
// Julien : « pour relier les achats je veux qu'il y ait la taille ou une description à côté des articles achetés
// pour pouvoir relier ». Module PUR (aucune lecture ici) : l'app lit, ce module range et compare.
//
// LA MESURE (vraie base, lecture seule, 17 nov.) :
//   · la liste « Mes achats » (`harvest_{uid}_orders_purchased` → `my_orders`) porte titre, prix, date, statut,
//     n° de transaction, photo (21 %) — NI taille, NI état, NI vendeur, NI description ;
//   · le DÉTAIL de la transaction (`harvest_{uid}_txn_{tx}`, rangé quand la page de la commande ou de sa
//     conversation est ouverte sur vinted.fr, extension connectée) porte, côté acheteur (`user_side` = buyer) :
//     `order.items[].size_title` (la taille, 49 articles sur 49), `order.items[].status` (l'état : « Très bon
//     état »…), `seller.login` (le vendeur), `items_count` — et AUCUNE description, aucune couleur ;
//   · 35 achats sur 3 327 ont ce détail : la taille LUE manque presque partout aujourd'hui.
//   ⇒ la taille montrée est celle LUE chez Vinted ; sinon celle que le VENDEUR a écrite dans son titre (EU écrite,
//     jamais une conversion US, jamais devinée) ; sinon rien. La description n'est rangée nulle part pour un achat
//     (ni le détail de transaction, ni `vinted_item_details` qui ne garde que SES annonces) : rien n'est montré.
//
// LA COMPARAISON avec l'article visé (annonce ou vente) : « même taille ✓ » / « taille différente » — une aide à
// l'œil, jamais un tri qui cache, jamais un lien : c'est toujours SON toucher qui relie (§5).
// ═══════════════════════════════════════════════════════════════════════════
import { noterPhotos } from './photoTaille.js';
import { tailleNorm, tailleDuTitre, normMots } from './suggestionsAchat.js';

const NB_ITEMS = 4;   // mesuré : 4 articles au plus par achat
// La projection de la lecture (scalaires seulement, §4.4) : les achats dont le détail est rangé (côté acheteur).
export const SELECT_DETAILS_ACHATS = 'id=like.harvest_%25_txn_%25&data->payload->transaction->>user_side=eq.buyer&select=id,tx:meta->>id,'
  + 'vendeur:data->payload->transaction->seller->>login,nb:data->payload->transaction->>items_count,'
  + Array.from({ length: NB_ITEMS }, (_, i) => `t${i}:data->payload->transaction->order->items->${i}->>size_title,e${i}:data->payload->transaction->order->items->${i}->>status`).join(',')
  // (17 nov., lot relier-tout-achat) Un LOT (mesuré le 17 nov. : 2 des 43 détails côté acheteur ont `items_count` > 1, jusqu'à 8 ;
  // 41 sur 43 portent le titre et la 1re photo de chaque article) : le titre et la photo de chaque article, en scalaires.
  + ',' + Array.from({ length: NB_ITEMS }, (_, i) => `n${i}:data->payload->transaction->order->items->${i}->>title,p${i}:data->payload->transaction->order->items->${i}->photos->0->>url`).join(',');

const court = (v, max) => (typeof v === 'string' && v.trim() && v.trim().length <= max ? v.trim() : '');

// Lignes projetées ⇒ { [tx]: { tailles: [...], etats: [...], vendeur, nb } }. Une forme inattendue est écartée
// (rien de deviné) ; `null` (lecture ratée) reste `null` : « pas su », jamais « rien ».
export function detailsDeLignes(rows) {
  if (!Array.isArray(rows)) return null;
  const out = {};
  for (const r of rows) {
    if (!r || typeof r !== 'object') continue;
    const tx = String(r.tx != null ? r.tx : ((/_txn_(\d+)$/.exec(String(r.id || '')) || [])[1] || ''));
    if (!/^\d{1,20}$/.test(tx)) continue;
    const tailles = [], etats = [];
    for (let i = 0; i < NB_ITEMS; i++) {
      const t = court(r[`t${i}`], 30), e = court(r[`e${i}`], 40);
      if (t) tailles.push(t);
      if (e) etats.push(e);
    }
    const nb = Number(r.nb);
    const articles = [];
    for (let i = 0; i < NB_ITEMS; i++) {
      const ti = court(r[`n${i}`], 160), ph = typeof r[`p${i}`] === 'string' && /^https:\/\//.test(r[`p${i}`]) && r[`p${i}`].length < 600 ? r[`p${i}`] : '';
      if (ph) noterPhotos(ph);   // (23 nov., photos-nettes) la f800 de cet achat : la visionneuse la montre au lieu de la vignette 150x210
      if (ti || ph) articles.push({ titre: ti, photo: ph, taille: court(r[`t${i}`], 30) });
    }
    out[tx] = { tailles, etats: [...new Set(etats)], vendeur: court(r.vendeur, 60), nb: Number.isFinite(nb) && nb > 0 ? nb : null, articles };
  }
  return out;
}

// Une clé de taille comparable : pointure normalisée (« 42,5 » = « 42.5 », « 42 2/3 »), sinon le texte (« M »).
export function cleTaille(s) {
  const t = String(s == null ? '' : s).trim();
  if (!t) return '';
  return tailleNorm(t) || t.toUpperCase().replace(/\s+/g, ' ');
}
const lisible = (k) => String(k || '').replace('.', ',');

// La taille de l'article visé (son champ, sinon son titre).
export function tailleCible(cible) {
  if (!cible) return '';
  const champ = cleTaille(cible.taille || '');
  return champ || tailleDuTitre(String(cible.titre || ''));
}

// Ce que la ligne d'un achat montre. `details` : la carte de `detailsDeLignes` (ou null / undefined) ;
// `cible` : { taille?, titre? } l'article visé, ou null ; `marqueDe`, `couleursDe` : les règles de l'app.
// Rend { taille, tailleSource ('vinted' | 'titre' | ''), accord ('meme' | 'diff' | ''), tailleVisee, etat, vendeur,
//        marque, couleurs[], lu (le détail est rangé) }.
export function faitsAchat(achat, { details = null, cible = null, marqueDe = null, couleursDe = null } = {}) {
  const tx = String((achat && achat.transaction_id) || '');
  const titre = String((achat && achat.title) || '');
  const d = details && tx ? details[tx] : null;
  let tailles = d && d.tailles.length ? d.tailles.map(cleTaille).filter(Boolean) : [];
  let source = tailles.length ? 'vinted' : '';
  if (!tailles.length) { const t = tailleDuTitre(titre); if (t) { tailles = [t]; source = 'titre'; } }
  tailles = [...new Set(tailles)];
  const visee = tailleCible(cible);
  const accord = !visee || !tailles.length ? '' : tailles.includes(visee) ? 'meme' : 'diff';
  let marque = '';
  try { marque = typeof marqueDe === 'function' ? String(marqueDe(titre) || '') : ''; } catch (_) { marque = ''; }
  // La marque n'est dite que si le TITRE la nomme (pas une marque déduite d'un modèle).
  if (marque && !(' ' + normMots(titre) + ' ').includes(' ' + normMots(marque) + ' ')) marque = '';
  let couleurs = [];
  try { couleurs = typeof couleursDe === 'function' ? (couleursDe(titre) || []).filter((c) => typeof c === 'string' && c).slice(0, 2) : []; } catch (_) { couleurs = []; }
  return { taille: tailles.map(lisible).join(' · '), tailleSource: source, accord, tailleVisee: lisible(visee),
    etat: d && d.etats.length ? d.etats.join(' · ') : '', vendeur: (d && d.vendeur) || '', marque, couleurs, lu: !!d };
}

// Combien d'achats d'une liste n'ont pas de taille LUE chez Vinted (la phrase dite une fois, en tête).
export function sansTailleLue(achats, details) {
  if (!Array.isArray(achats) || details == null) return 0;
  let n = 0;
  for (const a of achats) { const d = details[String((a && a.transaction_id) || '')]; if (!d || !d.tailles.length) n++; }
  return n;
}
