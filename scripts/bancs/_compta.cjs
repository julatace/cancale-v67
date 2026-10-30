// Comptabilité (29 octobre) : ce qui sert rarement (résultat de l'année, récap
// mensuel, packs, ton entreprise, factures, facturation électronique) vit dans
// « Avancé », REPLIÉ en bas de l'écran. Un banc qui lit ou remplit ces cartes
// l'ouvre comme Julien : un toucher sur son titre. Ce n'est pas un raccourci —
// sans ce geste, rien de tout ça n'est à l'écran.
// Sur un code d'avant (pas de repli « Avancé »), ne fait rien.
async function ouvrirAvanceCompta(pg, { attendre = 15000 } = {}) {
  try { await pg.waitForSelector('[data-compta-sommaire]', { timeout: attendre }); } catch (_) { return false; }
  const ferme = await pg.evaluate(() => { const d = document.querySelector('[data-compta-avance]'); return d ? !d.open : null; });
  if (ferme == null) return false;               // code d'avant : tout est déjà déplié
  if (ferme) {
    // Délais explicites : certains bancs posent un délai par défaut de 5 s, trop court sur une machine chargée.
    await pg.click('[data-compta-avance] > summary', { timeout: 20000 });
    await pg.waitForFunction(() => { const d = document.querySelector('[data-compta-avance]'); return !!(d && d.open); }, null, { timeout: 15000 });
  }
  return true;
}
module.exports = { ouvrirAvanceCompta };
