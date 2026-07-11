// bridge.js — tourne sur la page de l'app VRM (cancale-v67*.vercel.app).
// Role : faire le PONT entre l'app et le service worker de l'extension, pour
// EXECUTER une action Vinted (repondre a un message, faire une offre...) depuis
// TON navigateur / TON IP (jamais un serveur). L'app envoie un window.postMessage
// { __vmr:'exec', ... }, on relaie au background, et on renvoie le resultat a
// l'app via window.postMessage { __vmr:'result', ... }.
//
// bridge.js ne parle JAMAIS a Vinted directement : il ne fait que relayer.
(function () {
  'use strict';

  // Signale a l'app que l'extension est presente (pour afficher/activer les
  // boutons d'action). On le renvoie au chargement et sur demande ('ping').
  const announce = () => { try { window.postMessage({ __vmr: 'ready' }, '*'); } catch (_) {} };
  announce();

  window.addEventListener('message', (ev) => {
    if (ev.source !== window) return;
    const d = ev.data;
    if (!d || typeof d !== 'object') return;

    if (d.__vmr === 'ping') { announce(); return; }

    if (d.__vmr === 'exec' && d.reqId) {
      try {
        chrome.runtime.sendMessage(
          { from: 'vmr-bridge', action: 'exec', uid: d.uid, method: d.method, endpoint: d.endpoint, body: d.body },
          (resp) => {
            const err = chrome.runtime.lastError;
            try {
              window.postMessage({
                __vmr: 'result',
                reqId: d.reqId,
                ok: !err && !!(resp && resp.ok),
                status: resp && resp.status,
                data: resp && resp.data,
                error: err ? err.message : (resp && resp.error) || null,
              }, '*');
            } catch (_) {}
          }
        );
      } catch (e) {
        try { window.postMessage({ __vmr: 'result', reqId: d.reqId, ok: false, error: String(e) }, '*'); } catch (_) {}
      }
    }
  }, false);
})();
