// ════════════════════════════════════════════════════════════════════════════
//  LE MOTEUR D'UN BANC : Chromium par défaut, WebKit (le moteur de Safari) sur
//  demande — `NAVIGATEUR=webkit` (6 nov., filet 6 « Safari »).
//  Les vrais iPhone tournent sur WebKit ; les bancs ne voyaient que Chromium.
//  `lancer(pw, optionsChromium)` rend le navigateur choisi :
//   · chromium : exactement l'appel d'avant (chemin, --use-angle, --no-sandbox) ;
//   · webkit   : `pw.webkit.launch()` sans arguments Chromium (il les refuse).
//  La porte de banc (_porte-banc.cjs) est posée sur les deux moteurs.
//  WebKit doit être installé : `npx playwright install --with-deps webkit`
//  (la CI le fait ; ce conteneur n'a que Chromium dans /opt/pw-browsers).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const NAVIGATEUR = String(process.env.NAVIGATEUR || 'chromium').toLowerCase();
function lancer(pw, optionsChromium) {
  if (NAVIGATEUR === 'webkit') return pw.webkit.launch({});
  if (NAVIGATEUR !== 'chromium') throw new Error(`NAVIGATEUR=${NAVIGATEUR} : seuls chromium et webkit sont servis`);
  return pw.chromium.launch(optionsChromium);
}
module.exports = { lancer, NAVIGATEUR, estWebkit: NAVIGATEUR === 'webkit' };
