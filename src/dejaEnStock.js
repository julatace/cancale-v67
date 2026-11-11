// ════════════════════════════════════════════════════════════════════════════
//  « TU AS DÉJÀ N PAIRES DE CE MODÈLE EN STOCK » (9 nov., lot F, proposition 8)
// ════════════════════════════════════════════════════════════════════════════
// Au moment d'enregistrer un ACHAT (saisie d'un achat hors plateforme, prix
// d'achat proposé à confirmer), VRM dit combien de paires du même modèle sont
// déjà sur l'étagère — pour ne pas sur-stocker un modèle.
//
// C'est une RESSEMBLANCE (§5 : une proposition peut l'utiliser) : une INFORMATION,
// jamais une liaison. Rien n'est écrit, rien n'est relié ; la fonction ne rend
// qu'une liste à LIRE.
//   · même MARQUE obligatoire (marque inconnue d'un côté ⇒ écartée) ;
//   · MODÈLE : deux modèles reconnus et différents ⇒ écartée ; deux modèles
//     reconnus et égaux ⇒ gardée ; sinon il faut un MOT de modèle commun (hors
//     marque, couleurs, tailles et mots vides) — aucun mot commun ⇒ écartée ;
//   · TAILLE : connue des DEUX côtés et différente ⇒ écartée ; inconnue d'un
//     côté ⇒ gardée (la ligne dit « taille pas lue »).
// La marque, le modèle et les couleurs viennent des règles de l'app
// (`extractBrand`, `extractModel`, `extractColors`), passées en paramètre : une
// seule définition (§11). Module PUR : scripts/audit-plancher-stock.cjs l'EXÉCUTE.
import { tailleNorm, tailleDuTitre } from './suggestionsAchat.js';

const bas = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const VIDES = new Set(['taille', 'pointure', 'size', 'homme', 'femme', 'enfant', 'mixte', 'neuf', 'neuve', 'neuves', 'tres', 'bon', 'bonne', 'etat', 'paire', 'paires', 'chaussures', 'chaussure', 'baskets', 'basket', 'sneakers', 'sneaker', 'avec', 'sans', 'pour', 'les', 'des', 'une', 'eur', 'lot', 'boite', 'original', 'originale', 'authentique', 'vintage', 'rare']);
const motsModele = (titre, marque, couleursDe) => {
  const mq = bas(marque).split(/[^a-z0-9]+/).filter(Boolean);
  return new Set(bas(titre).split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !/^\d+$/.test(w) && !VIDES.has(w) && !mq.includes(w)
    && !(typeof couleursDe === 'function' && (couleursDe(w) || []).length)));
};
const tailleDe = (x) => (x && x.taille ? tailleNorm(x.taille) : '') || tailleDuTitre((x && x.titre) || '');

// Le même modèle ? (cible et paire : { titre, marque?, taille? })
export function memeModele(a, b, { marqueDe, modeleDe = null, couleursDe = null } = {}) {
  if (!a || !b || typeof marqueDe !== 'function') return false;
  const ma = bas(marqueDe(String(a.marque || '')) || a.marque || marqueDe(String(a.titre || '')));
  const mb = bas(marqueDe(String(b.marque || '')) || b.marque || marqueDe(String(b.titre || '')));
  if (!ma || !mb || ma !== mb) return false;
  const ta = tailleDe(a), tb = tailleDe(b);
  if (ta && tb && ta !== tb) return false;
  const oa = typeof modeleDe === 'function' ? modeleDe(String(a.titre || '')) : null;
  const ob = typeof modeleDe === 'function' ? modeleDe(String(b.titre || '')) : null;
  if (oa && ob) return bas(oa) === bas(ob);
  const wa = motsModele(a.titre, ma, couleursDe), wb = motsModele(b.titre, mb, couleursDe);
  for (const w of wa) if (wb.has(w)) return true;
  return false;
}

// cible : { titre, marque?, taille? } · stock : les paires PRÉSENTES
// [{ id, num, titre, marque?, taille?, photo?, depuisMs? }] · sauf : id à ne pas
// compter (la paire elle-même quand on confirme SON prix d'achat).
// Rend { n, paires: [{ id, num, titre, taille, photo, jours }] } — jamais d'écriture.
export function pairesDuModele({ cible, stock, sauf = null, marqueDe, modeleDe = null, couleursDe = null, maintenant = Date.now() } = {}) {
  if (!cible || !String(cible.titre || '').trim() || !Array.isArray(stock) || typeof marqueDe !== 'function') return { n: 0, paires: [] };
  const vus = new Set(), paires = [];
  for (const s of stock) {
    if (!s || s.id == null) continue;
    const id = String(s.id);
    if (vus.has(id) || (sauf != null && id === String(sauf))) continue;
    vus.add(id);
    if (!memeModele(cible, s, { marqueDe, modeleDe, couleursDe })) continue;
    const d = Number(s.depuisMs);
    paires.push({ id, num: String(s.num || ''), titre: String(s.titre || ''), taille: tailleDe(s) || '', photo: s.photo || null,
      jours: Number.isFinite(d) && d > 0 && d <= maintenant ? Math.floor((maintenant - d) / 86400000) : null });
  }
  // Les plus anciennes en ligne d'abord (celles qui dorment), « depuis » inconnu à la fin.
  paires.sort((x, y) => (y.jours == null ? -1 : y.jours) - (x.jours == null ? -1 : x.jours));
  return { n: paires.length, paires };
}

export const phraseDejaEnStock = (n, { autres = false } = {}) => (n > 0
  ? `Tu as déjà ${n} ${autres ? 'autre' + (n > 1 ? 's' : '') + ' ' : ''}${n > 1 ? motsVendeur().noms : motsVendeur().nom} de ce modèle en stock`
  : '');
