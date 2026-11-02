// Comptabilité (29 octobre, puis 2 novembre) : l'écran répond à trois questions
// (combien j'ai gagné · combien je dois déclarer · le détail). « Le détail » est
// une liste de REPLIS fermés : vendu et reçu, dépenses, déclarations passées,
// micro-entreprise, et « Documents et réglages » (l'ancien « Avancé » : résultat
// de l'année, récap mensuel, packs, ton entreprise, factures, facturation
// électronique, ton statut). Un banc qui lit ou remplit ces cartes les ouvre
// comme Julien : un toucher sur leur titre. Ce n'est pas un raccourci — sans ce
// geste, rien de tout ça n'est à l'écran.
// Sur un code d'avant (pas de repli), ne fait rien.
async function ouvrirReplis(pg, sel, attendre) {
  try { await pg.waitForSelector(sel, { state: 'attached', timeout: attendre }); } catch (_) { return false; }
  const ids = await pg.evaluate((sel) => [...document.querySelectorAll(sel)].filter((d) => !d.open).map((d) => d.id), sel);
  for (const id of ids) {
    // Délais explicites : certains bancs posent un délai par défaut de 5 s, trop court sur une machine chargée.
    await pg.click(`#${id} > summary`, { timeout: 20000 });
    await pg.waitForFunction((id) => { const d = document.getElementById(id); return !!(d && d.open); }, id, { timeout: 15000 });
  }
  return true;
}
// Ouvre « Documents et réglages » (et, puisque plus rien n'y est déplié d'office,
// les autres replis de « Le détail » : un banc d'avant lisait tout l'écran ouvert).
async function ouvrirAvanceCompta(pg, { attendre = 15000 } = {}) {
  const ok = await ouvrirReplis(pg, '[data-compta-avance]', attendre);
  if (!ok) return false;
  await ouvrirReplis(pg, 'details[data-compta-repli]', 3000);
  return true;
}
// Ouvre les replis de « Le détail » seulement (vendu et reçu, dépenses, déclarations).
async function ouvrirDetailCompta(pg, { attendre = 15000 } = {}) {
  return ouvrirReplis(pg, 'details[data-compta-repli]', attendre);
}
module.exports = { ouvrirAvanceCompta, ouvrirDetailCompta };
