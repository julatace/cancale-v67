// vc.js — monde isolé de vestiairecollective.com : le RELAIS.
// Il ne lit rien lui-même : il transmet au fond ce que vc-inject.js a relevé
// (des chemins, des noms de champs et des types — jamais une valeur).
// ⚠️ Un message ne vient que de CETTE page (`event.source === window`) et porte
//    notre étiquette. L'adresse de la page et l'origine sont posées par NOUS,
//    jamais dictées par la page.
(function () {
  'use strict';
  if (window.__vrmVcRelais) return; window.__vrmVcRelais = true;
  const vivant = () => { try { return !!(chrome && chrome.runtime && chrome.runtime.id); } catch (_) { return false; } };
  window.addEventListener('message', (event) => {
    try {
      if (event.source !== window) return;
      const d = event.data;
      if (!d || d.__tag !== 'CANCALE_VC' || d.kind !== 'vcrecon') return;
      if (!vivant()) return;                    // extension rechargée : on se tait
      const borne = (a, n) => (Array.isArray(a) ? a.slice(0, n).map((x) => String(x).slice(0, 200)) : []);
      chrome.runtime.sendMessage({
        from: 'cancale-vc', action: 'vcRecon',
        patch: {
          chemins: borne(d.chemins, 300), pages: borne(d.pages, 60),
          hotes: (d.hotes && typeof d.hotes === 'object') ? Object.fromEntries(Object.entries(d.hotes).slice(0, 40).map(([h, n]) => [String(h).slice(0, 80), Number(n) || 0])) : {},
          schemas: (d.schemas && typeof d.schemas === 'object') ? Object.fromEntries(Object.entries(d.schemas).slice(0, 60).map(([e, c]) => [String(e).slice(0, 200), borne(c, 200)])) : {},
          nextData: !!d.nextData, nextFlux: !!d.nextFlux,
        },
      }, () => { void chrome.runtime.lastError; });
    } catch (_) {}
  });
})();
