// ── CHANGER DE COMPTE EN UN TAP (4 nov.) ─────────────────────────────────────
// Julien : un sélecteur compact « Tous · compte1 · compte2… » en haut de l'écran
// d'un site, qui pilote LE filtre de compte existant (`compteSel` de la coque
// pour Vinted, `vrm_ebay_vue` pour eBay) — jamais un second état.
//
// Deux règles ici, pures (l'audit les exécute) :
//   1. `pucesComptes` : ce que montre la rangée — « Tous » d'abord, puis chaque
//      compte proposé, UNE puce allumée (celle de la valeur effective). Une
//      valeur hors des options vaut « Tous » (la rangée ne montre jamais un
//      compte qu'elle ne propose pas — même règle que `compteEffectif`).
//   2. `choixPourSite` / `memoriserChoix` : le choix est MÉMORISÉ sur l'appareil,
//      PAR SITE. Le 31 oct. le choix revenait à « tous » en changeant de site
//      (« une sélection ne doit pas suivre en douce sur une autre plateforme ») :
//      c'est tenu — chaque site retrouve SON choix, jamais celui d'un autre.
//      `''` = rien choisi (le compte de l'extension, sinon tous) ; `'*'` = « Tous »
//      choisi exprès ; sinon l'identifiant du compte.

export const CLE_CHOIX_COMPTES = 'vrm_compte_choisi';
const SITES = new Set(['vinted', 'leboncoin', 'ebay', 'vestiaire']);
const valeurPropre = (v) => (typeof v === 'string' && v.length <= 80 && /^[\w*.:@-]*$/.test(v) ? v : '');

// La carte mémorisée, relue telle quelle : tout ce qui n'a pas la bonne forme
// est ignoré (une carte abîmée ne choisit jamais un compte à sa place).
export function lireChoixComptes(brut) {
  let o = brut;
  if (typeof brut === 'string') { try { o = JSON.parse(brut); } catch (_) { return {}; } }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return {};
  const out = {};
  for (const [site, v] of Object.entries(o)) if (SITES.has(site) && valeurPropre(v)) out[site] = v;
  return out;
}

// Le choix d'UN site — jamais celui d'un autre.
export function choixPourSite(carte, site) {
  const c = lireChoixComptes(carte);
  return SITES.has(site) ? (c[site] || '') : '';
}

// Rend la NOUVELLE carte (la carte d'entrée n'est pas modifiée). `''` efface le
// choix du site (retour au défaut), les autres sites ne bougent pas.
export function memoriserChoix(carte, site, valeur) {
  const c = { ...lireChoixComptes(carte) };
  if (!SITES.has(site)) return c;
  const v = valeurPropre(String(valeur == null ? '' : valeur));
  if (v) c[site] = v; else delete c[site];
  return c;
}

// La rangée : [{ val, nom, actif }]. `options` = [{ val, nom }] (dans l'ordre de
// l'écran : le compte de l'extension en tête). Moins de deux comptes ⇒ `[]` :
// rien à choisir, la rangée ne s'affiche pas (§7).
export function pucesComptes(options, valeur) {
  const opts = (Array.isArray(options) ? options : []).filter((o) => o && typeof o.val === 'string' && o.val && o.val !== '*');
  const vus = new Set(); const uniques = [];
  for (const o of opts) if (!vus.has(o.val)) { vus.add(o.val); uniques.push(o); }
  if (uniques.length < 2) return [];
  const v = String(valeur == null ? '' : valeur);
  const eff = vus.has(v) ? v : '*';
  return [{ val: '*', nom: 'Tous', actif: eff === '*' }, ...uniques.map((o) => ({ val: o.val, nom: String(o.nom || o.val), actif: o.val === eff }))];
}
