// ── SECOURS SYNTHÉTIQUE QUAND fx/ EST ABSENT (#3, 26 octobre) ────────────────
// Les `fx/` sont une copie de SA vraie base, gitignorée (vrais acheteurs, vraies
// adresses — dépôt public). Les bancs de rendu qui les lisaient mouraient donc en
// ENOENT PARTOUT sauf sur la machine de Julien : aveugles à chaque session sans sa
// base. Or ces bancs n'assert PAS sur le CONTENU de fx (leurs contrôles vivent sur
// des données synthétiques inline, ou sur un état piloté par le banc — pont,
// panne). Ce socle rend un chargeur fx TOLÉRANT + des comptes/main synthétiques,
// pour qu'ils tournent partout, SANS risque de faux-vert : ce qu'ils jugent vient
// de données qu'ils contrôlent. Sur SA machine (fx/ présent), on lit la vraie
// base — comportement inchangé.
const fs = require('fs'), path = require('path');

function fxSecours(SC) {
  const FX = f => JSON.parse(fs.readFileSync(path.join(SC, 'fx', f + '.json'), 'utf8'));
  const FXok = f => { try { return FX(f); } catch (_) { return []; } };
  const present = fs.existsSync(path.join(SC, 'fx', 'accounts.json'));
  const MAIN_SYNTH = [{ id: 'main', data: { vinted_dark: false } }];
  const ACCOUNTS_SYNTH = [
    { vinted_user_id: '111', login: 'boutique_test_a', domain: 'www.vinted.fr', updated_at: new Date().toISOString(), created_at: new Date(Date.now() - 500 * 3600e3).toISOString() },
    { vinted_user_id: '222', login: 'boutique_test_b', domain: 'www.vinted.fr', updated_at: new Date().toISOString(), created_at: new Date(Date.now() - 500 * 3600e3).toISOString() },
  ];
  const main = present ? FX('main') : MAIN_SYNTH;
  const accounts = present ? FX('accounts') : ACCOUNTS_SYNTH;
  // Une annonce par compte (seulement en secours) : peuple `liveStats` de la coque,
  // sinon des cartes/écrans restent vides. Id distinct du dressing réel : jamais de
  // collision quand fx/ est présent (on ne l'ajoute pas dans ce cas).
  const LISTV = () => present ? [] : accounts.map((a, i) => ({ id: `harvest_${a.vinted_user_id}_listings`, data: { payload: { items: [
    { id: `syn_${a.vinted_user_id}_${i}`, title: 'Paire test ' + (i + 1), brand_title: 'Nike', size_title: '42', price: { amount: '40', currency_code: 'EUR' }, is_closed: false, is_hidden: false, is_draft: false, photo: { url: '' } },
  ], pagination: null } } }));
  return { FX, FXok, present, main, accounts, LISTV };
}
module.exports = { fxSecours };
