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
  // 5.165 : l'IDENTIFIANT de l'extension voyage avec la version. Deux extensions
  //    VRM installées dans le même Chrome exécutaient CHAQUE commande de l'app
  //    deux fois (mesuré le 9 octobre) ; l'app compte les ponts qui répondent à
  //    un même « ping » (`sonderPonts`) — avec l'identifiant, deux copies de la
  //    MÊME version se distinguent aussi. Rien d'autre ne part.
  const idExt = (() => { try { return String(rt.id || ''); } catch (_) { return ''; } })();
  function announce() { if (!vivant()) { retirer(); return; } poster({ __vmr: 'ready', version, id: idExt }); }

  // ══ LE CODE QUI RÉPOND EST-IL CELUI DU MANIFESTE ? (11 octobre) ══════════
  // ⚠️⚠️ MESURÉ chez lui : 5 Chrome sur 6 exécutaient une 5.95–5.129 sous un
  //    manifeste « 5.164 » (dossier remplacé, ⟳ jamais cliqué dans ce Chrome).
  //    Ce pont, lui, est TOUJOURS lu depuis le disque : il est donc de la
  //    version du manifeste, et il peut juger le service worker. Depuis la 5.171
  //    l'état porte `code` (la version du code qui répond). Un état sans `code`,
  //    un `code` différent, ou un service worker qui ne connaît même pas
  //    « état » (≤ 5.128 : le port se ferme sans réponse) ⇒ code PÉRIMÉ.
  //    On ne juge que si NOTRE version est une vraie version ≥ 5.171 (sinon ce
  //    pont ne saurait pas que `code` existe).
  const vNum = (v) => String(v || '').split('.').map((x) => parseInt(x, 10) || 0);
  const auMoins = (v, ref) => { const a = vNum(v), b = vNum(ref); for (let i = 0; i < 3; i++) { if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0); } return true; };
  const jugeable = /^\d+\.\d+\.\d+$/.test(version) && auMoins(version, '5.171.0');
  function jugerCode(resp, err) {
    if (!jugeable) return null;
    if (err) {
      const t = String((err && err.message) || err);
      // « The message port closed before a response was received » : le service
      // worker a écouté, mais ne connaît pas ce message (antérieur à 5.129).
      return /port closed/i.test(t) ? { code: null, attendu: version, raison: 'sans-etat' } : null;
    }
    if (!resp || typeof resp !== 'object' || !resp.ok) return null;
    if (!resp.code) return { code: null, attendu: version, raison: 'sans-code' };
    if (String(resp.code) !== version) return { code: String(resp.code), attendu: version, raison: 'autre-code' };
    return null;
  }
  // La RÉPARATION : seule une page de l'extension peut appeler
  // `chrome.runtime.reload()` (le ⟳ de chrome://extensions) — un script de
  // contenu n'en a pas le droit. On pose donc, UNE fois par page, un cadre
  // invisible `popup.html?mode=reparer` : il vérifie lui-même que le code est
  // périmé, et ne recharge qu'UNE fois par version (garde dans
  // `chrome.storage.local`). Prouvé dans un vrai Chromium (relecture du
  // 11 octobre) : le service worker repart sur le bon code, et le reste après un
  // redémarrage de Chrome. S'il ne répare pas, l'app dit le geste (⟳).
  let reparationPosee = false;
  function reparer() {
    if (reparationPosee) return;
    reparationPosee = true;
    try {
      const f = document.createElement('iframe');
      f.src = rt.getURL('popup.html') + '?mode=reparer';
      f.setAttribute('aria-hidden', 'true');
      f.tabIndex = -1;
      f.style.cssText = 'position:fixed;width:1px;height:1px;left:-10px;top:-10px;border:0;opacity:0;pointer-events:none;';
      (document.body || document.documentElement).appendChild(f);
      setTimeout(() => { try { f.remove(); } catch (_) {} }, 15000);
    } catch (_) {}
  }

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
    // ⚠️⚠️ ON RELAIE TOUT CE QUE L'APP ENVOIE (5.160). Ce relais recopiait une
    //    liste fixe (`cmd, uid, tx, jobId`) : `id`, `etat`, `limit` et `plan`
    //    n'arrivaient JAMAIS au service worker — « Publier sur Leboncoin »,
    //    « Préparer sur eBay », « Déjà publiée » et la limite de l'offre étaient
    //    refusés (« annonce inconnue ») depuis la 5.130, sans qu'aucun banc ne
    //    le voie : ils parlaient au service worker DIRECTEMENT, jamais à travers
    //    ce pont. C'est le défaut de `content.js` (5.80) refait ici : un raccord
    //    qui énumère ne transporte que ce qu'on a pensé à écrire.
    //    `from` et `action` restent posés par NOUS (la page ne les dicte pas) ;
    //    le service worker vérifie l'origine et chaque champ qu'il lit.
    if ((d.__vmr === 'etat' || d.__vmr === 'cmd' || d.__vmr === 'cmd:statut') && d.reqId) {
      const charge = {};
      for (const k of Object.keys(d)) if (k !== '__vmr' && k !== 'reqId' && k !== 'from' && k !== 'action') charge[k] = d[k];
      // Un service worker trop ancien peut aussi ne RIEN répondre à « état » :
      // au bout de 8 s on demande la réparation (la page de réparation vérifie
      // elle-même le code — un service worker juste lent n'est pas rechargé).
      const muet = (d.__vmr === 'etat' && jugeable) ? setTimeout(() => reparer(), 8000) : null;
      relayer(Object.assign(charge, { from: 'vmr-bridge', action: d.__vmr }), (resp, err) => {
        if (muet) clearTimeout(muet);
        // 11 octobre : sur « état », on juge le CODE qui répond (voir `jugerCode`).
        const per = d.__vmr === 'etat' ? jugerCode(resp, err) : null;
        if (per) reparer(per);
        poster(Object.assign({ __vmr: d.__vmr + ':result', reqId: d.reqId, resp: resp || null }, per ? { perime: per } : {}));
      });
      return;
    }

    // L'app demande QUI est connecté côté extension. Elle ne peut pas lire le
    // stockage de l'extension (c'est justement le but) : elle le demande.
    if (d.__vmr === 'authEtat' && d.reqId) {
      relayer({ from: 'vmr-bridge', action: 'authEtat' },
        (resp) => poster({ __vmr: 'authEtat:result', reqId: d.reqId, etat: resp || null }));
      return;
    }

    // ⚠️⚠️ PLUS AUCUNE SESSION PAR LA PAGE (11 octobre). Ce pont relayait toute
    //    `{__vmr:'session'}` postée dans la page — et CHAQUE extension de la page
    //    faisait de même : une copie ancienne restée à côté adoptait la même
    //    famille de jetons, et un `session: null` posté par une app dont la
    //    session venait de mourir faisait oublier à l'extension la sienne. La
    //    session arrive maintenant ADRESSÉE à CETTE extension, avec un nonce, par
    //    `chrome.runtime.sendMessage(<identifiant>, …)` depuis l'app
    //    (`externally_connectable`, voir background.js). Ce message-ci n'est
    //    plus relayé du tout.
    if (d.__vmr === 'session') return;

    // ⚠️ LA LIAISON SANS CANAL ADRESSÉ (5.188 — Firefox ne connaît pas
    //    `externally_connectable`). L'app nomme l'IDENTIFIANT de l'extension
    //    qu'elle veut joindre : seul le pont de CETTE extension relaie. Une
    //    autre extension VRM de la page (copie ancienne, autre identifiant) se
    //    tait. Le service worker revérifie l'origine et applique les mêmes
    //    règles que le canal adressé (nonce, compte annoncé, une seule fois).
    if (d.__vmr === 'adresse' && d.reqId) {
      if (String(d.ext || '') !== idExt || !d.msg || typeof d.msg !== 'object') return;
      relayer({ from: 'vmr-bridge', action: 'adresse', msg: d.msg },
        (resp) => poster({ __vmr: 'adresse:result', reqId: d.reqId, ext: idExt, resp: resp || null }));
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
      // 19 oct. : `confirme` voyage (accepter une offre VEND la paire : le fond
      // l'exige, la confirmation de l'app ne se perd plus en route).
      relayer({ from: 'vmr-bridge', action: 'exec', uid: d.uid, method: d.method, endpoint: d.endpoint, body: d.body, confirme: d.confirme === true },
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
