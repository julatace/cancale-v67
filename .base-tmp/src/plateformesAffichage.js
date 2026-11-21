// Préférence du vendeur : présentation seulement, jamais un filtre de calcul.
import { IDS_PLATEFORMES } from './plateformes.js';
export const CLE_PLATEFORMES = 'vrm_plateformes_affichees';
export function lirePlateformes(r) {
  if (!r || !Array.isArray(r.sites)) return null;
  return { sites: IDS_PLATEFORMES.filter(id => r.sites.includes(id)), at: r.at || null };
}
export function plateformesAffichees(reglage, relies = {}) {
  const r = lirePlateformes(reglage);
  return IDS_PLATEFORMES.filter(id => (r ? r.sites.includes(id) : id === 'vinted') || relies[id] === true);
}
