// ═══════════════════════════════════════════════════════════════════════════
// « DEPUIS TA DERNIÈRE VISITE » — CE QUE VRM SAIT DÉJÀ DE CHAQUE NOUVEAUTÉ (25 nov.) — règles PURES
// ═══════════════════════════════════════════════════════════════════════════
// Julien (capture iPhone : « 3 messages » puis trois lignes « Nouveau message · Vinted · il y a 12 min ») :
// « change l'affichage du pop up message, ça doit faire mieux, jeu vidéo ».
// Une entrée du journal (`capte_journal_*`) ne porte que { site, compte, sorte, identité, heure } — jamais un texte.
// L'app y ajoute ce qu'elle a DÉJÀ rangé, PAR IDENTITÉ seulement (CLAUDE.md §5) :
//   · message / offre Vinted : la conversation de la boîte du MÊME compte au MÊME n° (`harvest_{compte}_inbox`) ⇒ le
//     pseudo et la photo de profil de l'autre (`opposite_user`), la photo de l'article (`item_photos`), et l'extrait de la
//     boîte SEULEMENT si la conversation est NON LUE (le dernier mot n'est alors pas le sien) et que ce n'est pas le titre ;
//   · vente, versement, bordereau, code : la commande VENDUE du même compte au même n° de transaction ; achat : la commande
//     ACHETÉE ⇒ la photo, le titre de CETTE commande, son prix.
// Rien trouvé ⇒ `null` : la ligne reste nue. Jamais un titre rapproché, jamais un détail d'un autre compte.
// `regrouper(entrees, details)` : les entrées SANS rien de connu, d'un même site et d'un même compte, ne font plus N lignes
// identiques mais UNE (« 3 messages ») ; une entrée seule garde sa ligne (elle mène à SON élément).
// ═══════════════════════════════════════════════════════════════════════════
import { descriptionBoite } from '../messagesLisibles.js';
import { photoArticle } from '../photosArticles.js';
import { cleEntree, identiteDe } from './arrivee.js';

// Une photo : celle de Vinted (https, images*.vinted.net) ; ou une photo d'EXEMPLE de l'app (public/exemple/, mode exemple).
const RE_PHOTO = /^https:\/\/images\d*\.vinted\.net\/[^\s"'<>]{4,480}$/i;
const RE_EXEMPLE = /^\/exemple\/[a-z0-9-]{3,80}-(120|400)\.webp$/;
export const photoSure = (u) => { const s = typeof u === 'string' ? u.trim() : ''; return RE_PHOTO.test(s) || RE_EXEMPLE.test(s) ? s : ''; };
const texte = (s, n) => (typeof s === 'string' || typeof s === 'number' ? String(s).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n) : '');
const montant = (p) => { const v = Number(p && typeof p === 'object' ? p.amount : p); const dev = p && typeof p === 'object' ? String(p.currency_code || 'EUR') : 'EUR'; return Number.isFinite(v) && v > 0 && dev === 'EUR' ? v : null; };

// La forme sûre d'un détail (ce que l'écran affiche) ; rien de connu ⇒ null.
export function detailPropre(d) {
  if (!d || typeof d !== 'object') return null;
  const out = {};
  const nom = texte(d.nom, 40); if (nom) out.nom = nom;
  const avatar = photoSure(d.avatar); if (avatar) out.avatar = avatar;
  const photo = photoSure(d.photo); if (photo) out.photo = photo;
  const extrait = texte(d.extrait, 140); if (extrait) out.extrait = extrait;
  const titre = texte(d.titre, 90); if (titre) out.titre = titre;
  const prix = Number(d.prix); if (Number.isFinite(prix) && prix > 0) out.prix = prix;
  const offre = Number(d.offre); if (Number.isFinite(offre) && offre > 0) out.offre = offre;
  return Object.keys(out).length ? out : null;
}

// Une conversation de la boîte (forme rangée par l'extension, `alleger('inbox')`).
export function detailDeConversation(c) {
  if (!c || typeof c !== 'object') return null;
  const u = c.opposite_user && typeof c.opposite_user === 'object' ? c.opposite_user : {};
  const d = { nom: u.login, avatar: u.photo && u.photo.url, photo: photoArticle({ photos: c.item_photos }) };
  // L'extrait de la boîte n'a pas d'auteur : il n'est dit que si la conversation est NON LUE (le dernier mot vient de l'autre
  // côté) ; un montant nu est une offre ; le titre de l'article n'est jamais présenté comme un message.
  if (c.unread === true) {
    const b = descriptionBoite(c.description, '', null);
    if (b.kind === 'texte') d.extrait = b.texte;
    else if (b.kind === 'montant') d.offre = b.montant;
  }
  return detailPropre(d);
}

// Une commande rangée (`commandeMaigre` : title, price, photo, transaction_id…).
export function detailDeCommande(o) {
  if (!o || typeof o !== 'object') return null;
  return detailPropre({ photo: photoArticle(o), titre: o.title, prix: montant(o.price) });
}

// Ce qu'il faut lire pour une entrée : { compte, ou: 'inbox' | 'sold' | 'purchased', id } — Vinted seulement ; sinon null.
export function besoinDe(e) {
  if (!e || e.p !== 'vinted' || !/^\d{1,20}$/.test(String(e.c || ''))) return null;
  const i = identiteDe(e);
  if (e.s === 'messages' || e.s === 'offres') return /^\d{1,20}$/.test(String(i.conv || '')) ? { compte: e.c, ou: 'inbox', id: String(i.conv) } : null;
  if (['ventes', 'versements', 'bordereaux', 'codes'].includes(e.s)) return /^\d{1,20}$/.test(String(i.tx || '')) ? { compte: e.c, ou: 'sold', id: String(i.tx) } : null;
  if (e.s === 'achats') return /^\d{1,20}$/.test(String(i.tx || '')) ? { compte: e.c, ou: 'purchased', id: String(i.tx) } : null;
  return null;
}

// Les détails de toutes les entrées, à partir d'un lecteur `lireCopie(compte, ou)` → Promise<liste | null> (les copies déjà
// captées : conversations de la boîte, commandes vendues ou achetées). Une lecture par compte et par sorte. ⇒ { [cleEntree]: detail }
export async function detailsDepuis(entrees, lireCopie) {
  const out = {};
  if (!Array.isArray(entrees) || typeof lireCopie !== 'function') return out;
  const lus = new Map();
  const liste = (compte, ou) => { const k = compte + '|' + ou; if (!lus.has(k)) lus.set(k, Promise.resolve().then(() => lireCopie(compte, ou)).catch(() => null)); return lus.get(k); };
  await Promise.all(entrees.map(async (e) => {
    const b = besoinDe(e); if (!b) return;
    const l = await liste(b.compte, b.ou);
    if (!Array.isArray(l)) return;
    const memes = l.filter((x) => x && String(b.ou === 'inbox' ? x.id : x.transaction_id) === b.id);
    if (memes.length !== 1) return;                     // aucune, ou deux sous le même n° : rien n'est affirmé
    const d = b.ou === 'inbox' ? detailDeConversation(memes[0]) : detailDeCommande(memes[0]);
    if (d) out[cleEntree(e)] = d;
  }));
  return out;
}

// Les lignes d'un groupe : [{ type: 'carte', e, d } | { type: 'ligne', e } | { type: 'lot', p, c, entrees }], dans l'ordre du
// groupe (le plus récent d'abord). Un « Vinted a freiné » garde toujours sa ligne (chacun dit autre chose).
export function regrouper(g, details) {
  const out = [];
  const lots = new Map();
  for (const e of (g && g.entrees) || []) {
    const d = details && details[cleEntree(e)];
    if (d) { out.push({ type: 'carte', e, d }); continue; }
    if (g.s === 'refus') { out.push({ type: 'ligne', e }); continue; }
    const k = e.p + '|' + e.c;
    if (lots.has(k)) { lots.get(k).entrees.push(e); continue; }
    const lot = { type: 'lot', p: e.p, c: e.c, entrees: [e] };
    lots.set(k, lot); out.push(lot);
  }
  return out.map((x) => (x.type === 'lot' && x.entrees.length === 1 ? { type: 'ligne', e: x.entrees[0] } : x));
}
