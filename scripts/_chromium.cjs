// Même navigateur pour les audits et les bancs, sur Linux, macOS ou Windows.
// BANC_CHROMIUM permet de choisir explicitement un exécutable installé.
const fs = require('node:fs');
const { chromium } = require('playwright');

function executablePath() {
  const choisi = process.env.BANC_CHROMIUM;
  if (choisi) {
    if (!fs.existsSync(choisi)) throw new Error(`BANC_CHROMIUM introuvable : ${choisi}`);
    return choisi;
  }
  const ancien = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  return fs.existsSync(ancien) ? ancien : chromium.executablePath();
}

module.exports = { executablePath };
