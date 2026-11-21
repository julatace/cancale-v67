// transp-page.js — monde isolé, sur les pages de SUIVI des transporteurs
// (Mondial Relay, Chronopost, Vinted Go) que Julien ouvre lui-même (5.290).
//
// Il ne fait qu'UNE chose : dire au fond « une page de suivi est ouverte ». Le
// message ne porte AUCUN n° de suivi, aucun code postal, rien lu dans la page :
// le fond tire le n° de l'ADRESSE de l'onglet (que Chrome pose lui-même,
// `sender.url`), vérifie le site et la forme du n°, puis demande à VRM de lire
// ce colis tout de suite.
// ⚠️ Le DOM de ces pages n'est PAS lu : il n'a jamais été mesuré
//    (mondialrelay.fr refuse ce conteneur, la page Chronopost est une coquille
//    remplie par JavaScript). Un analyseur de page serait une supposition ; le
//    statut se lit par la voie mesurée, au même instant.
// Une page qui change d'adresse sans se recharger (Vinted Go : « Suivre un
// colis » → /fr/tracking/{n}) est revue : l'adresse est relue toutes les 1,5 s,
// 10 min au plus, et le fond n'est prévenu qu'au CHANGEMENT d'adresse.
(function () {
  let derniere = '';
  const prevenir = () => {
    let adresse = '';
    try { adresse = String(location.href); } catch (_) { return; }
    if (adresse === derniere) return;
    derniere = adresse;
    try { chrome.runtime.sendMessage({ from: 'vrm-transp', action: 'transpVu' }, () => { try { void chrome.runtime.lastError; } catch (_) {} }); } catch (_) {}
  };
  prevenir();
  let n = 0;
  const minuterie = setInterval(() => { if (++n > 400) { clearInterval(minuterie); return; } prevenir(); }, 1500);
})();
