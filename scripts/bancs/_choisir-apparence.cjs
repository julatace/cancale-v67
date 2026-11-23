// ════════════════════════════════════════════════════════════════════════════
//  CHOISIR L'APPARENCE DANS PARAMÈTRES, COMME LE VENDEUR (16 nov., lot apparence-rangee)
//  L'interrupteur « Mode sombre » (`data-reglage-sombre`) est retiré : il doublait
//  « Apparence » (Automatique · Clair · Sombre · Le soir). Les bancs qui le touchaient pour
//  poser un réglage SYNCHRONISÉ (`vinted_dark`) font le même geste au bon endroit :
//  la rangée « Apparence » (`data-sous-ouvrir="apparence"`, dans sa catégorie : le chemin
//  est fait par `_reglages-compat.cjs`), puis le choix (`data-apparence="sombre|clair"`).
//  Choisir Clair ou Sombre écrit `vrm_apparence` ET `vinted_dark` (src/apparence.js) : ce
//  que l'interrupteur écrivait. Rien n'est fabriqué : le geste est fait sur la vraie rangée.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const visible = (pg, sel) => pg.locator(`${sel}:visible`);

// `mode` : 'clair' | 'sombre' | 'auto' | 'soir'. Rend true si le choix a été touché.
async function choisirApparence(pg, mode, { delai = 6000 } = {}) {
  const choix = `[data-apparence="${mode}"]`;
  if (!(await visible(pg, choix).count())) {
    // Au téléphone, la rangée vit dans sa catégorie : la toucher d'abord si elle n'est pas à l'écran
    // (sans `_reglages-compat.cjs`, un banc lancé sans la porte de banc le fait ici, le même geste).
    if (!(await visible(pg, '[data-sous-ouvrir="apparence"]').count())) {
      const cat = visible(pg, '[data-categorie-contient~="apparence"]').first();
      if (await cat.count()) { await cat.click({ timeout: delai }).catch(() => {}); await pg.waitForTimeout(300); }
    }
    await pg.locator('[data-sous-ouvrir="apparence"]').first().click({ timeout: delai }).catch(() => {});
    await pg.waitForSelector(choix, { state: 'visible', timeout: delai }).catch(() => {});
  }
  const b = visible(pg, choix).first();
  if (!(await b.count())) return false;
  await b.click({ timeout: delai }).catch(() => {});
  return true;
}

// L'ancien « toucher l'interrupteur » : l'inverse du thème affiché (sombre ⇒ Clair, sinon Sombre).
async function basculerSombre(pg, opts) {
  const sombre = await pg.evaluate(() => document.documentElement.getAttribute('data-theme') === 'dark').catch(() => false);
  return choisirApparence(pg, sombre ? 'clair' : 'sombre', opts);
}

module.exports = { choisirApparence, basculerSombre };
