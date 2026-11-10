// Comptabilité (29 octobre, puis 2 novembre) : l'écran répond à trois questions
// (combien j'ai gagné · combien je dois déclarer · le détail). « Le détail » est
// une liste de REPLIS fermés : vendu et reçu, dépenses, déclarations passées,
// micro-entreprise, et « Documents et réglages » (l'ancien « Avancé » : résultat
// de l'année, récap mensuel, packs, ton entreprise, factures, facturation
// électronique, ton statut). Un banc qui lit ou remplit ces cartes les ouvre
// comme Julien : un toucher sur leur titre. Ce n'est pas un raccourci — sans ce
// geste, rien de tout ça n'est à l'écran.
// (10 nov., Argent — src/argent.js) Compta est devenue « Argent » à quatre segments :
// Résumé (le détail replié), Statistiques, Déclarer (URSSAF, DAC7, comptable,
// statut — l'ancien « Documents et réglages »), Factures. Un banc va au segment
// comme Julien : un toucher sur le segment (`allerSegment`).
// Sur un code d'avant (pas de repli, pas de segment), ne fait rien.
async function allerSegment(pg, seg, { attendre = 15000 } = {}) {
  const sel = `[data-argent-nav] [data-section="${seg}"]`;
  try { await pg.waitForSelector(sel, { state: 'attached', timeout: Math.min(attendre, 6000) }); } catch (_) { return false; }
  const deja = await pg.evaluate((sel) => { const b = document.querySelector(sel); return !!(b && b.getAttribute('aria-current') === 'page'); }, sel);
  if (!deja) {
    await pg.click(sel, { timeout: 20000 });
    await pg.waitForFunction((sel) => { const b = document.querySelector(sel); return !!(b && b.getAttribute('aria-current') === 'page'); }, sel, { timeout: 15000 }).catch(() => {});
    if (seg !== 'stats') await pg.waitForFunction((seg) => { const p = document.querySelector(`[data-argent-vue="${seg}"]`); return !p || !p.hidden; }, seg === 'resume' ? 'resume' : seg, { timeout: 15000 }).catch(() => {});
  }
  return true;
}
async function ouvrirReplis(pg, sel, attendre) {
  try { await pg.waitForSelector(sel, { state: 'attached', timeout: attendre }); } catch (_) { return false; }
  // Seulement les replis du segment montré (un repli d'un segment caché ne se touche pas).
  const ids = await pg.evaluate((sel) => [...document.querySelectorAll(sel)].filter((d) => !d.open && !d.closest('[data-argent-vue][hidden]')).map((d) => d.id), sel);
  for (const id of ids) {
    // Délais explicites : certains bancs posent un délai par défaut de 5 s, trop court sur une machine chargée.
    await pg.click(`#${id} > summary`, { timeout: 20000 });
    await pg.waitForFunction((id) => { const d = document.getElementById(id); return !!(d && d.open); }, id, { timeout: 15000 });
  }
  return true;
}
// Ouvre « Documents et réglages » — depuis Argent, le segment « Déclarer » (où vivent
// résultat, récap, export, registres, statut, entreprise) et ses replis.
async function ouvrirAvanceCompta(pg, { attendre = 15000 } = {}) {
  if (await allerSegment(pg, 'declarer', { attendre })) {
    await ouvrirReplis(pg, 'details[data-compta-repli]', 3000);
    return true;
  }
  const ok = await ouvrirReplis(pg, '[data-compta-avance]', attendre);
  if (!ok) return false;
  await ouvrirReplis(pg, 'details[data-compta-repli]', 3000);
  return true;
}
// Ouvre les replis de « Le détail » seulement (vendu et reçu, dépenses, packs) — le Résumé.
async function ouvrirDetailCompta(pg, { attendre = 15000 } = {}) {
  await allerSegment(pg, 'resume', { attendre });
  return ouvrirReplis(pg, 'details[data-compta-repli]', attendre);
}
module.exports = { ouvrirAvanceCompta, ouvrirDetailCompta, allerSegment };
