// ── src/automatisationsEtat.js — l'état des automatisations, en UNE ligne (20 nov.) ─────────────
// Précision de Julien (20 nov.) : « les automatisations ne doivent pas forcément être dans l'application mais plutôt
// dans l'extension ». L'écran Automatisations de l'app est RETIRÉ ; Paramètres garde UNE rangée « Automatisations ·
// dans l'extension » qui ouvre le panneau (`page: 'automatisations'`) et dit, à droite, combien sont actives — LU dans
// les réglages que l'extension lit (jamais deviné ; une clé illisible ne compte pas). Rien n'est écrit d'ici.
//   offres auto      `vinted_offres_auto` === true
//   baisse par règle `vinted_baisse_regle.comptes[*].actif` (au moins un compte)
//   paliers          `vinted_offres_paliers.actif`
// Les messages aux favoris (mode automatique) vivent côté serveur : pas comptés ici (pas lus sans réseau).
import { REGLE_CLE } from './reglesAuto.js';
import { CLE_PALIERS, reglagesPaliers } from './negociationPaliers.js';

export function automatisationsActives(load) {
  let n = 0;
  try { if (load('vinted_offres_auto', false) === true) n++; } catch (_) {}
  try { const r = load(REGLE_CLE, null); if (r && r.comptes && typeof r.comptes === 'object' && Object.values(r.comptes).some((c) => c && c.actif === true)) n++; } catch (_) {}
  try { if (reglagesPaliers(load(CLE_PALIERS, null)).actif === true) n++; } catch (_) {}
  return n;
}
