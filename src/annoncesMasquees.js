// ═══════════════════════════════════════════════════════════════════════════
// LES ANNONCES MASQUÉES PAR VINTED, COMPTE PAR COMPTE — la règle (4 nov.)
// ═══════════════════════════════════════════════════════════════════════════
// Une annonce `is_hidden` (masquée par Vinted, ni fermée ni brouillon) est
// toujours chez lui (`<masquees-regle>` de l'app : comptée parmi les PRÉSENTES,
// jamais « en ligne » — rien ne change ici). Cette liste les montre, par compte,
// avec le lien pour aller la corriger sur Vinted. La lecture qui l'a vue
// masquée date de plus de 24 h ⇒ « à confirmer » (même seuil que « en ligne »).
// Fonctions PURES (scripts/audit-annonces-masquees.cjs).
export const MASQUEE_FRAIS_MS = 24 * 60 * 60 * 1000;
const prixDe = (p) => { const v = p && typeof p === 'object' ? p.amount : p; const f = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isFinite(f) && f > 0 ? f : null; };

// masquees : `listings.masquees` (chaque annonce porte `_acc` et `_vrmVueMasqueeLe`) ;
// numeroDe(id) → N° ou '' ; nomDe(acc) → nom affiché ; parties : Set d'id déclarés partis.
export function masqueesParCompte(masquees, { maintenant = Date.now(), numeroDe = () => '', nomDe = (a) => (a && (a.login || a.vinted_user_id)) || '', parties = null } = {}) {
  if (masquees === undefined) return { etat: 'encours' };
  if (!Array.isArray(masquees)) return { etat: 'passu' };
  const groupes = new Map(), vus = new Set();
  let n = 0, nAConfirmer = 0;
  for (const it of masquees) {
    if (!it || it.id == null) continue;
    const id = String(it.id);
    if (vus.has(id) || (parties && parties.has(id))) continue;
    vus.add(id);
    const acc = it._acc || null;
    const uid = String((acc && acc.vinted_user_id) || '');
    const lu = Number(it._vrmVueMasqueeLe) || null;
    const aConfirmer = !(lu && maintenant - lu <= MASQUEE_FRAIS_MS);
    const domaine = (acc && /^[\w.-]+\.vinted\.[a-z.]+$/.test(String(acc.domain || ''))) ? acc.domain : 'www.vinted.fr';
    const lien = /^\d+$/.test(id) ? `https://${domaine}/items/${id}/edit` : '';
    if (!groupes.has(uid)) groupes.set(uid, { uid, nom: nomDe(acc) || uid, lu, aConfirmer, items: [] });
    const g = groupes.get(uid);
    if (lu && (!g.lu || lu > g.lu)) { g.lu = lu; g.aConfirmer = maintenant - lu > MASQUEE_FRAIS_MS; }
    g.items.push({ id, titre: String(it.title || ''), photo: String(it.photo || ''), num: String(numeroDe(id) || ''), prix: prixDe(it.price), lien, aConfirmer });
    n++; if (aConfirmer) nAConfirmer++;
  }
  const liste = [...groupes.values()].sort((a, b) => b.items.length - a.items.length || String(a.nom).localeCompare(String(b.nom)));
  return { etat: 'lu', n, nFrais: n - nAConfirmer, nAConfirmer, groupes: liste };
}
