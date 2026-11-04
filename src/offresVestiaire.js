// ═══════════════════════════════════════════════════════════════════════════
// LES OFFRES VESTIAIRE — la règle (4 nov., extension 5.319)
// ═══════════════════════════════════════════════════════════════════════════
// Lit la ligne `vc_offres` rangée par l'extension (`offres` par `n{id}` : article,
// prix en CENTIMES, gestes datés, « à toi » — jamais l'acheteur) et
// `vc_offres_recette` (pour chaque geste : appris ou non, et pourquoi). Fonctions
// PURES (scripts/audit-offres-vestiaire-app.cjs). Trois états : `undefined` en
// cours · `null` pas su · objet lu.
export const GESTES_OFFRE = ['accepter', 'refuser', 'contre'];
const n = (x) => (typeof x === 'number' && isFinite(x) ? x : null);

export function offresVestiaire(ligne, maintenant = Date.now()) {
  if (ligne === undefined) return { etat: 'encours' };
  if (ligne === null) return { etat: 'passu' };
  const brut = ligne && ligne.offres && typeof ligne.offres === 'object' && !Array.isArray(ligne.offres) ? Object.values(ligne.offres) : null;
  if (!brut) return { etat: 'jamais', aTrancher: [], enAttente: [], parProduit: {}, lecture: (ligne && ligne.lecture) || null };
  const aTrancher = [], enAttente = [];
  for (const o of brut) {
    if (!o || !/^\d{3,15}$/.test(String(o.id || ''))) continue;
    const exp = Date.parse(o.expire || '');
    const expiree = isFinite(exp) && exp <= maintenant;
    const d = o.dernier || null;
    const x = { id: String(o.id), produit: String(o.produit || ''), compte: String(o.compte || ''), titre: String(o.titre || ''), photo: String(o.photo || ''), lien: String(o.lien || ''),
      offre: n(o.offre), net: n(o.net), initial: n(o.initial), min: n(o.min), expire: isFinite(exp) ? exp : null, expiree, resteVendeur: n(o.resteVendeur),
      dernierAt: d && Date.parse(d.at || '') || null, dernierCents: d ? n(d.cents) : null };
    // « À toi » : rangé comme tel par l'extension ET pas expiré (une offre expirée ne se tranche plus).
    if (o.aToi === true && o.ouverte === true && d && d.action === 'offer' && d.par === 'acheteur' && !expiree) aTrancher.push(x);
    else if (o.ouverte === true && d && d.action === 'offer' && d.par === 'vendeur' && !expiree) enAttente.push(x);
  }
  aTrancher.sort((a, b) => (a.expire || Infinity) - (b.expire || Infinity));
  enAttente.sort((a, b) => (b.dernierAt || 0) - (a.dernierAt || 0));
  const parProduit = {};
  for (const x of aTrancher) if (x.produit && !parProduit[x.produit]) parProduit[x.produit] = x;
  return { etat: 'lu', aTrancher, enAttente, parProduit, lecture: ligne.lecture || null, at: Date.parse(ligne.capturedAt || '') || null };
}

// Ce que VRM peut faire d'ici, geste par geste : `pret` seulement avec une
// extension qui sait (`cap === 'ok'`) ET une recette APPRISE de ce geste.
export function etatGeste(recettes, geste, cap) {
  if (cap !== 'ok') return { etat: cap === 'absente' ? 'ext-absente' : 'ext-retard', raison: '' };
  if (recettes === null) return { etat: 'passu', raison: '' };
  const r = recettes && recettes[geste];
  if (!r) return { etat: 'pas-appris', raison: '' };
  return r.appris === true ? { etat: 'pret', raison: '' } : { etat: 'pas-sur', raison: String(r.raison || '') };
}

// Le prix d'une contre-offre tapé en euros ⇒ des centimes, entre SON offre et
// ton prix (exclus) — sinon l'erreur dite. « 225 », « 225,5 », « 225.50 ».
export function prixContre(texte, offre) {
  const t = String(texte == null ? '' : texte).replace(/\s|€/g, '').replace(',', '.');
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(t)) return { cents: null, erreur: t ? 'Écris un prix en euros, par exemple 225 ou 225,50.' : '' };
  const cents = Math.round(Number(t) * 100);
  if (offre && offre.offre != null && cents <= offre.offre) return { cents: null, erreur: 'Au-dessus de son offre.' };
  if (offre && offre.initial != null && cents >= offre.initial) return { cents: null, erreur: 'Sous ton prix affiché.' };
  return { cents, erreur: '' };
}

export const euros = (c) => (c == null ? '—' : (c / 100).toLocaleString('fr-FR', { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 }) + ' €');
export function resteAvant(exp, maintenant = Date.now()) {
  if (exp == null) return '';
  const m = Math.max(0, Math.round((exp - maintenant) / 60000));
  return m < 60 ? `${m} min` : m < 48 * 60 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} j`;
}

// Le résultat d'une réponse, dit en français (jamais « fait » sur un doute).
export function etiquetteOffre(r, geste) {
  const fait = { accepter: 'Offre acceptée sur Vestiaire.', refuser: 'Offre refusée sur Vestiaire.', contre: 'Contre-offre envoyée sur Vestiaire.' }[geste] || 'Fait sur Vestiaire.';
  if (!r) return { ton: 'muet', texte: "L'extension n'a pas répondu — je ne sais pas si c'est parti. Regarde l'offre sur Vestiaire avant de recommencer." };
  if (r.accepte === true && r.etape === 'fait') return { ton: 'ok', texte: fait };
  if (r.accepte === true && r.etape === 'incertain') return { ton: 'muet', texte: r.raison || "Je ne sais pas si c'est parti — regarde l'offre sur Vestiaire." };
  if (r.accepte === true && r.etape === 'refuse') return { ton: 'ko', texte: r.raison || "Vestiaire a refusé : rien n'est parti." };
  const t = r.raison ? r.raison.charAt(0).toUpperCase() + r.raison.slice(1) : "Rien n'est parti.";
  return { ton: 'ko', texte: t + (/[.!]$/.test(t) ? '' : '.') };
}
