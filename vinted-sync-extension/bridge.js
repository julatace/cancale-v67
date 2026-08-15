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
  // On joint la VERSION : l'app peut alors dire « extension 5.12 détectée »
  // plutôt que « détectée » — après un rechargement dans Chrome, c'est la seule
  // façon de vérifier de visu que c'est bien la nouvelle qui tourne.
  const version = (() => { try { return chrome.runtime.getManifest().version; } catch (_) { return ''; } })();
  const announce = () => { try { window.postMessage({ __vmr: 'ready', version }, '*'); } catch (_) {} };
  announce();
  // L'app peut se charger APRÈS nous : sans ces rappels, son écouteur n'existe
  // pas encore quand on annonce, et elle croit l'extension absente pour toujours.
  document.addEventListener('DOMContentLoaded', announce);
  setTimeout(announce, 800);
  setTimeout(announce, 2500);

  window.addEventListener('message', (ev) => {
    if (ev.source !== window) return;
    const d = ev.data;
    if (!d || typeof d !== 'object') return;

    if (d.__vmr === 'ping') { announce(); return; }

    // SESSION DU VENDEUR (multi-vendeurs). L'app, une fois connectee, nous
    // transmet son jeton : c'est ce qui permet a l'extension d'ecrire dans la
    // base SOUS SON COMPTE une fois l'isolation activee. On ne la stocke pas
    // ici (une page web n'a pas a garder ca) : on la relaie au service worker.
    // A la deconnexion, l'app envoie session:null et l'extension oublie tout.
    if (d.__vmr === 'session') {
      try { chrome.runtime.sendMessage({ from: 'vmr-bridge', action: 'session', session: d.session || null }); } catch (_) {}
      return;
    }

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
