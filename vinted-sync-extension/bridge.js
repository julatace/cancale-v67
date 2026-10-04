// bridge.js — tourne sur la page de l'app VRM (vrm.center, et l'adresse Vercel
// du projet qui y redirige — jamais une autre : voir ORIGINES_APP, background.js).
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
  // ⚠️ UN PONT ORPHELIN NE DOIT PAS ANNONCER UNE EXTENSION VIVANTE. Quand
  //    l'extension est rechargée, mise à jour ou désactivée, ce script reste
  //    dans la page mais n'a plus de service worker derrière lui :
  //    `chrome.runtime.id` vaut alors `undefined`. Mesuré : il continuait de
  //    répondre « ready » et l'app croyait l'extension là pour toujours.
  const vivant = () => { try { return !!(chrome && chrome.runtime && chrome.runtime.id); } catch (_) { return false; } };
  const announce = () => { if (!vivant()) return; try { window.postMessage({ __vmr: 'ready', version }, '*'); } catch (_) {} };
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

    // L'ÉTAT, LES COMMANDES ET LEUR SUIVI (5.129). Simple relais, comme le
    // reste : c'est le service worker qui vérifie l'origine, le compte et le
    // plafond, et qui parle à Vinted.
    if ((d.__vmr === 'etat' || d.__vmr === 'cmd' || d.__vmr === 'cmd:statut') && d.reqId) {
      const repondre = (resp) => { try { window.postMessage({ __vmr: d.__vmr + ':result', reqId: d.reqId, resp: resp || null }, '*'); } catch (_) {} };
      if (!vivant()) { repondre(null); return; }
      try {
        chrome.runtime.sendMessage({ from: 'vmr-bridge', action: d.__vmr, cmd: d.cmd, uid: d.uid, tx: d.tx, jobId: d.jobId }, (resp) => {
          const err = chrome.runtime.lastError;
          repondre(err ? null : resp);
        });
      } catch (_) { repondre(null); }
      return;
    }

    // L'app demande QUI est connecté côté extension. Elle ne peut pas lire le
    // stockage de l'extension (c'est justement le but) : elle le demande.
    if (d.__vmr === 'authEtat' && d.reqId) {
      try {
        chrome.runtime.sendMessage({ from: 'vmr-bridge', action: 'authEtat' }, (resp) => {
          const err = chrome.runtime.lastError;
          try { window.postMessage({ __vmr: 'authEtat:result', reqId: d.reqId, etat: err ? null : resp }, '*'); } catch (_) {}
        });
      } catch (_) { try { window.postMessage({ __vmr: 'authEtat:result', reqId: d.reqId, etat: null }, '*'); } catch (_) {} }
      return;
    }

    // SESSION DU VENDEUR (multi-vendeurs). L'app, une fois connectee, nous
    // transmet son jeton : c'est ce qui permet a l'extension d'ecrire dans la
    // base SOUS SON COMPTE une fois l'isolation activee. On ne la stocke pas
    // ici (une page web n'a pas a garder ca) : on la relaie au service worker.
    // A la deconnexion, l'app envoie session:null et l'extension oublie tout.
    if (d.__vmr === 'session') {
      try { chrome.runtime.sendMessage({ from: 'vmr-bridge', action: 'session', session: d.session || null }); } catch (_) {}
      return;
    }

    // Octets d'une photo Vinted (pour l'imprimer sur un reçu d'achat).
    // Le CDN Vinted n'autorise pas la lecture cross-origin depuis la page :
    // l'extension, elle, en a le droit. Simple relais, aucun appel API Vinted.
    if (d.__vmr === 'pdfLbc' && d.reqId) {
      try {
        chrome.runtime.sendMessage({ from: 'vmr-bridge', action: 'pdfLbc', url: d.url }, (resp) => {
          const err = chrome.runtime.lastError;
          try { window.postMessage({ __vmr: 'pdfLbc:result', reqId: d.reqId, dataUrl: (!err && resp && resp.ok) ? resp.dataUrl : null, error: err ? String(err.message || err) : (resp && resp.error) || '' }, '*'); } catch (_) {}
        });
      } catch (_) { try { window.postMessage({ __vmr: 'pdfLbc:result', reqId: d.reqId, dataUrl: null, error: 'pont' }, '*'); } catch (_) {} }
      return;
    }
    if (d.__vmr === 'photo' && d.reqId) {
      try {
        chrome.runtime.sendMessage({ from: 'vmr-bridge', action: 'photo', url: d.url }, (resp) => {
          const err = chrome.runtime.lastError;
          try { window.postMessage({ __vmr: 'photo:result', reqId: d.reqId, dataUrl: (!err && resp && resp.ok) ? (resp.dataUrl || resp.data || null) : null }, '*'); } catch (_) {}
        });
      } catch (_) { try { window.postMessage({ __vmr: 'photo:result', reqId: d.reqId, dataUrl: null }, '*'); } catch (_) {} }
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

  // L'EXTENSION PRÉVIENT L'APP (5.129) : une étape de commande, un bordereau
  // rangé, des ventes rafraîchies. Sans ça, l'app ne verrait rien avant de
  // relire la base d'elle-même.
  try {
    chrome.runtime.onMessage.addListener((m) => {
      if (m && m.__vmrEvt && m.evt) { try { window.postMessage({ __vmr: 'evt', evt: m.evt }, '*'); } catch (_) {} }
    });
  } catch (_) {}
})();
