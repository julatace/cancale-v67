// ── src/conseiller/planGestes.js — le geste d'une ligne du « Plan du matin » (24 nov.) ──
// PUR (aucun React) : exécuté par scripts/audit-plan-dorment.cjs. Rien ne part d'ici sans SON toucher : `agirPlan` ouvre le
// chemin gardé EXISTANT (le panneau de l'extension sur CETTE annonce, ou l'écran eBay de VRM) ; `verdictPlan` lit la
// porte commune « agir seulement si l'extension est connectée sur ce compte » (src/agir/porte.js) quand elle existe.
import { ouvrirPanneau } from '../ouvrirPanneau.js';
import { ACTIONS_EXTENSION, PANNEAU_DE_SELECTION } from '../actionsExtension.js';

// Le geste de la porte pour chaque action Vinted du plan (les noms de GESTES_AGIR).
export const GESTE_PORTE = Object.freeze({ baisser: 'baisser', favoris: 'favoris', republier: 'republier', prix: 'prix' });
export function verdictPlan(l, porte = null, tr = (k) => k) {
  const g = l && l.action ? GESTE_PORTE[l.action.k] : null;
  if (!g || !porte || typeof porte.agirMaintenant !== 'function') return { ok: true };
  const v = porte.agirMaintenant('vinted', String(l.uid || ''), g, '');
  return v && v.ok ? { ok: true } : { ok: false, texte: v && v.cle ? tr(v.cle, v.vars || {}) : '' };
}
// LE GESTE d'une ligne du plan : le chemin gardé EXISTANT, le même que la liste « Qui dorment » d'Annonces
// (`allerDormante`) — panneau de l'extension sur CETTE annonce (son identifiant), ou l'écran eBay de VRM. Rien d'autre.
export function agirPlan(l, { onEbay = null, ouvrir = ouvrirPanneau } = {}) {
  const a = (l && l.action) || {}, ids = [String(l.id)];
  const panneau = (cle) => { const x = ACTIONS_EXTENSION[cle]; return ouvrir({ site: 'vinted', page: x.page, ids, action: x.action }); };
  switch (a.k) {
    case 'baisser': return panneau(PANNEAU_DE_SELECTION.baisser);
    case 'prix': return panneau(PANNEAU_DE_SELECTION.modifier);
    case 'republier': return panneau(PANNEAU_DE_SELECTION.recreer);
    case 'favoris': return panneau('favoris');
    case 'lbc': return ouvrir({ site: 'leboncoin', page: 'publier', ids, action: 'publier' });
    case 'vestiaire': return ouvrir({ site: 'vestiaire', page: 'publier', ids, action: 'publier' });
    case 'ebay': return onEbay ? onEbay(String(l.id)) : undefined;
    default: return undefined;
  }
}

