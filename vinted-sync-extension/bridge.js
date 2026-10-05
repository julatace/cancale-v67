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

  // ⚠️ ON GARDE LE `chrome.runtime` DE CE CHARGEMENT-CI. Quand l'extension est
  //    rechargée ou mise à jour, CE script reste dans la page mais son service
  //    worker n'existe plus : `chrome.runtime.id` vaut alors `undefined` (le pont
  //    est ORPHELIN). En gardant SA référence, un pont orphelin se sait orphelin
  //    même si un nouveau `chrome` apparaît plus tard dans le même monde.
  let rt = null;
  try { rt = (typeof chrome !== 'undefined' && chrome && chrome.runtime) || null; } catch (_) { rt = null; }
  const vivant = () => { try { return !!(rt && rt.id); } catch (_) { return false; } };
  if (!vivant()) return;

  // ⚠️⚠️ UN SEUL PONT VIVANT PAR MONDE (5.160). Le script s'exécute dans le
  //    « monde isolé » de l'extension : un `globalThis` à part, partagé par TOUS
  //    les scripts que CETTE extension injecte dans CET onglet — celui du
  //    manifeste ET celui que `reinjecterPont()` (background.js) réinjecte.
  //    Deux ponts vivants relaieraient chaque demande deux fois (une réponse à
  //    un acheteur envoyée deux fois). Si un pont VIVANT est déjà là, on s'en va.
  //    Un pont ORPHELIN, lui, ne compte pas : on prend sa place (c'est le cas
  //    où Chrome réutilise le même monde après une mise à jour).
  try {
    const deja = globalThis.__vrmPontVivant;
    if (deja && typeof deja.vivant === 'function' && deja.vivant()) return;
  } catch (_) {}
  const moi = { vivant };
  try { globalThis.__vrmPontVivant = moi; } catch (_) {}

  // Signale a l'app que l'extension est presente (pour afficher/activer les
  // boutons d'action). On le renvoie au chargement et sur demande ('ping').
  // On joint la VERSION : l'app peut alors dire « extension 5.12 détectée »
  // plutôt que « détectée » — après un rechargement dans Chrome, c'est la seule
  // façon de vérifier de visu que c'est bien la nouvelle qui tourne.
  const version = (() => { try { return rt.getManifest().version; } catch (_) { return ''; } })();

  // ⚠️⚠️ UN PONT ORPHELIN SE TAIT — SUR TOUT (5.160). Mesuré : après une mise à
  //    jour, l'ancien pont restait dans la page et répondait `resp: null` TOUT
  //    DE SUITE à chaque « état » — avant le nouveau pont, réinjecté à côté.
  //    L'app prenait la première réponse et concluait « l'extension ne répond
  //    pas », alors qu'un pont vivant allait répondre juste après. Pareil pour
  //    `authEtat`, `photo`, `pdfLbc` et `exec` : `sendMessage` lève sur un pont
  //    orphelin, et le `catch` répondait une ERREUR à la place du vivant.
  //    ⇒ Orphelin = AUCUNE réponse, à rien, jamais ; et il retire son écouteur.
  //    Sans pont vivant du tout, l'app ne reçoit rien et dit elle-même, à
  //    l'échéance, que l'extension ne répond pas — ce qui est alors VRAI.
  let retire = false;
  const retirer = () => {
    if (retire) return;
    retire = true;
    try { window.removeEventListener('message', onMsg, false); } catch (_) {}
    try { document.removeEventListener('DOMContentLoaded', announce); } catch (_) {}
    try { if (globalThis.__vrmPontVivant === moi) delete globalThis.__vrmPontVivant; } catch (_) {}
  };
  const poster = (m) => { try { window.postMessage(m, '*'); } catch (_) {} };
  function announce() { if (!vivant()) { retirer(); return; } poster({ __vmr: 'ready', version }); }

  // Relaie au service worker et rend la réponse — ou RIEN si ce pont est devenu
  // orphelin entre-temps (envoi qui lève, ou réponse arrivée après la mort).
  // `rendre(resp, err)` : err = la raison d'un échec d'un pont VIVANT (service
  // worker qui a lâché en route) — celui-là a le droit de le dire.
  const relayer = (msg, rendre) => {
    try {
      rt.sendMessage(msg, (resp) => {
        let err = null;
        try { err = rt.lastError || null; } catch (_) { err = null; }
        if (!vivant()) { retirer(); return; }
        rendre(err ? null : resp, err);
      });
    } catch (e) {
      if (!vivant()) { retirer(); return; }
      rendre(null, e);
    }
  };

  function onMsg(ev) {
    if (ev.source !== window) return;
    const d = ev.data;
    if (!d || typeof d !== 'object' || typeof d.__vmr !== 'string') return;
    if (!vivant()) { retirer(); return; }

    if (d.__vmr === 'ping') { announce(); return; }

    // L'ÉTAT, LES COMMANDES ET LEUR SUIVI (5.129). Simple relais, comme le
    // reste : c'est le service worker qui vérifie l'origine, le compte et le
    // plafond, et qui parle à Vinted.
    if ((d.__vmr === 'etat' || d.__vmr === 'cmd' || d.__vmr === 'cmd:statut') && d.reqId) {
      relayer({ from: 'vmr-bridge', action: d.__vmr, cmd: d.cmd, uid: d.uid, tx: d.tx, jobId: d.jobId },
        (resp) => poster({ __vmr: d.__vmr + ':result', reqId: d.reqId, resp: resp || null }));
      return;
    }

    // L'app demande QUI est connecté côté extension. Elle ne peut pas lire le
    // stockage de l'extension (c'est justement le but) : elle le demande.
    if (d.__vmr === 'authEtat' && d.reqId) {
      relayer({ from: 'vmr-bridge', action: 'authEtat' },
        (resp) => poster({ __vmr: 'authEtat:result', reqId: d.reqId, etat: resp || null }));
      return;
    }

    // SESSION DU VENDEUR (multi-vendeurs). L'app, une fois connectee, nous
    // transmet son jeton : c'est ce qui permet a l'extension d'ecrire dans la
    // base SOUS SON COMPTE une fois l'isolation activee. On ne la stocke pas
    // ici (une page web n'a pas a garder ca) : on la relaie au service worker.
    // A la deconnexion, l'app envoie session:null et l'extension oublie tout.
    if (d.__vmr === 'session') {
      relayer({ from: 'vmr-bridge', action: 'session', session: d.session || null }, () => {});
      return;
    }

    // Le PDF d'un bordereau Leboncoin (derrière la session Leboncoin : l'app ne
    // peut pas le lire, l'extension si). Simple relais.
    if (d.__vmr === 'pdfLbc' && d.reqId) {
      relayer({ from: 'vmr-bridge', action: 'pdfLbc', url: d.url }, (resp, err) => poster({
        __vmr: 'pdfLbc:result', reqId: d.reqId,
        dataUrl: (!err && resp && resp.ok) ? resp.dataUrl : null,
        error: err ? String(err.message || err) : (resp && resp.error) || '',
      }));
      return;
    }
    // Octets d'une photo Vinted (pour l'imprimer sur un reçu d'achat).
    // Le CDN Vinted n'autorise pas la lecture cross-origin depuis la page :
    // l'extension, elle, en a le droit. Simple relais, aucun appel API Vinted.
    if (d.__vmr === 'photo' && d.reqId) {
      relayer({ from: 'vmr-bridge', action: 'photo', url: d.url }, (resp, err) => poster({
        __vmr: 'photo:result', reqId: d.reqId,
        dataUrl: (!err && resp && resp.ok) ? (resp.dataUrl || resp.data || null) : null,
      }));
      return;
    }

    if (d.__vmr === 'exec' && d.reqId) {
      relayer({ from: 'vmr-bridge', action: 'exec', uid: d.uid, method: d.method, endpoint: d.endpoint, body: d.body },
        (resp, err) => poster({
          __vmr: 'result',
          reqId: d.reqId,
          ok: !err && !!(resp && resp.ok),
          status: resp && resp.status,
          data: resp && resp.data,
          error: err ? String(err.message || err) : (resp && resp.error) || null,
        }));
    }
  }

  window.addEventListener('message', onMsg, false);
  announce();
  // L'app peut se charger APRÈS nous : sans ces rappels, son écouteur n'existe
  // pas encore quand on annonce, et elle croit l'extension absente pour toujours.
  document.addEventListener('DOMContentLoaded', announce);
  setTimeout(announce, 800);
  setTimeout(announce, 2500);

  // L'EXTENSION PRÉVIENT L'APP (5.129) : une étape de commande, un bordereau
  // rangé, des ventes rafraîchies. Sans ça, l'app ne verrait rien avant de
  // relire la base d'elle-même.
  try {
    rt.onMessage.addListener((m) => {
      if (!vivant()) { retirer(); return; }
      if (m && m.__vmrEvt && m.evt) poster({ __vmr: 'evt', evt: m.evt });
    });
  } catch (_) {}
})();
