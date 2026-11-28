// VRM Observateur Vestiaire — le fond.
// Il REGARDE, il ne touche à rien :
//  · chrome.webRequest SANS « blocking » ni « extraHeaders » : aucune requête bloquée, modifiée ni retardée ;
//    des en-têtes (requête et réponse) seuls les NOMS sont gardés, jamais une valeur (ni Cookie, ni Authorization,
//    ni X-CSRF-Token) ; des valeurs de réponse, seules la taille (Content-Length) et le type (Content-Type) ;
//  · hôtes : vestiairecollective.com et tous ses sous-domaines (www, fr, apiv2, search, images…), et la messagerie
//    Stream Chat que la page de Vestiaire appelle (stream-io-api.com, stream-chat.com, getstream.io), en https et wss ;
//  · les événements du capteur de page et des gestes (relais.js) ;
//  · chrome.management : les extensions installées et leurs (dés)activations ;
//  · chrome.tabs : les onglets Vestiaire ouverts / fermés / actualisés ;
//  · en « Capture complète » seulement (interrupteur séparé, éteint par défaut) : chrome.debugger sur les onglets
//    Vestiaire (Network.*, Page.frameNavigated, et Runtime.consoleAPICalled si « console » est coché). Aucune commande
//    qui modifie une requête (ni Fetch.*, ni Network.setRequestInterception) n'est jamais envoyée.
// Tout est rangé dans IndexedDB (idb.js). Aucun tampon ne vit plus d'une seconde en mémoire (§4.9) : les requêtes
// en cours sont dans chrome.storage.session.
'use strict';
importScripts('regles.js', 'idb.js');
const R = self.VRMObs;
const B = self.VRMBase;

const HOTES = ['*.vestiairecollective.com', '*.stream-io-api.com', '*.stream-chat.com', '*.getstream.io'];
const FILTRE = { urls: [].concat(HOTES.map((h) => 'https://' + h + '/*'), HOTES.map((h) => 'wss://' + h + '/*')) };
const ONGLETS_VC = ['https://*.vestiairecollective.com/*'];
const EST_VC = /^https:\/\/([a-z0-9-]+\.)*vestiairecollective\.com(\/|$)/i;
const EST_OBSERVE = /(^|\.)(vestiairecollective\.com|stream-io-api\.com|stream-chat\.com|getstream\.io)$/i;
const PLAFOND_DEFAUT = 200000;

// ── Réglages (relus à chaque réveil, la vérité est chrome.storage.local) ─────
let actif = false; let complet = false; let consoleOn = false; let plafond = PLAFOND_DEFAUT;
const lireReglages = () => chrome.storage.local.get(['obs_on', 'obs_complet', 'obs_console', 'obs_plafond']).then((o) => {
  actif = o.obs_on === true;
  complet = o.obs_complet === true;
  consoleOn = o.obs_console === true;
  const p = Number(o.obs_plafond);
  plafond = Number.isFinite(p) && p >= 50 ? Math.min(p, 2000000) : PLAFOND_DEFAUT;
}).catch(() => {});
// Le voyant : « REC » rouge sur l'icône tant que l'enregistrement est allumé.
function voyant() {
  try {
    chrome.action.setBadgeText({ text: actif ? 'REC' : '' });
    chrome.action.setBadgeBackgroundColor({ color: '#c4001a' });
    chrome.action.setTitle({ title: 'VRM Observateur Vestiaire — ' + (actif ? 'ENREGISTREMENT EN COURS' : 'éteint') });
  } catch (_) {}
}
const pret = lireReglages().then(() => { voyant(); if (actif && complet) attacherTous(); });
chrome.storage.onChanged.addListener((ch, zone) => {
  if (zone !== 'local') return;
  if (!(ch.obs_on || ch.obs_complet || ch.obs_console || ch.obs_plafond)) return;
  const avant = actif; const avantC = complet;
  lireReglages().then(() => {
    voyant();
    if (actif && !avant) { noter([{ src: 'debut', t: Date.now(), detail: 'Enregistrement allumé' }]); photoExtensions('au démarrage de l\'enregistrement'); ongletsOuverts(); }
    if (!actif && avant) noter([{ src: 'debut', t: Date.now(), detail: 'Enregistrement éteint' }], true);
    if (actif && complet && !(avant && avantC)) attacherTous();
    if (!(actif && complet) && avant && avantC) detacherTous();
    if (ch.obs_plafond) planifier();
  });
});

// ── Écriture en lots, une à la fois ──────────────────────────────────────────
let aEcrire = [];
let minuterie = null;
let file = Promise.resolve();
function noter(evs, force) {
  if (!actif && !force) return;
  for (const e of evs) aEcrire.push(e);
  planifier();
}
function planifier() {
  if (aEcrire.length >= 200) return vider();
  if (!minuterie) minuterie = setTimeout(vider, 300);
}
function vider() {
  if (minuterie) { clearTimeout(minuterie); minuterie = null; }
  const lot = aEcrire; aEcrire = [];
  file = file.then(async () => {
    if (lot.length) await B.ajouter(lot);
    if (lot.length) await B.tailler(plafond);   // count() est immédiat dans IndexedDB
  }).catch(() => {});
  return file;
}

// ── webRequest ───────────────────────────────────────────────────────────────
const cleEC = (id) => 'ec_' + id;
const enCoursMem = new Map();
const noms = (l) => Array.isArray(l) ? Array.from(new Set(l.map((h) => String((h && h.name) || '').toLowerCase().slice(0, 80)).filter(Boolean))).slice(0, 60) : [];
chrome.webRequest.onBeforeRequest.addListener((d) => {
  (async () => {
    await pret;
    if (!actif) return;
    const u = R.masquerUrl(d.url);
    const e = {
      src: 'reseau', t: Math.round(d.timeStamp), methode: d.method,
      hote: u.hote, chemin: u.chemin, recherche: u.recherche, params: u.params,
      type: d.type, initiator: d.initiator ? String(d.initiator).slice(0, 200) : '',
      tabId: d.tabId, frameId: d.frameId,
      corps: /^(POST|PUT|PATCH|DELETE)$/i.test(d.method) ? R.corpsDepuis(d.requestBody) : null,
    };
    enCoursMem.set(d.requestId, e);
    chrome.storage.session.set({ [cleEC(d.requestId)]: e }).catch(() => {});
  })();
}, FILTRE, ['requestBody']);

// Les NOMS des en-têtes envoyés (sans « extraHeaders », Chrome ne donne même pas Cookie ; aucune valeur n'est gardée).
chrome.webRequest.onSendHeaders.addListener((d) => {
  (async () => {
    await pret;
    if (!actif) return;
    const n = noms(d.requestHeaders);
    const e = enCoursMem.get(d.requestId);
    if (e) { e.entetesRequete = n; chrome.storage.session.set({ [cleEC(d.requestId)]: e }).catch(() => {}); }
    else chrome.storage.session.set({ ['eh_' + d.requestId]: n }).catch(() => {});
  })();
}, FILTRE, ['requestHeaders']);

async function terminer(d, erreur) {
  await pret;
  let e = enCoursMem.get(d.requestId);
  if (!e) { try { e = (await chrome.storage.session.get(cleEC(d.requestId)))[cleEC(d.requestId)]; } catch (_) {} }
  if (!e) return;
  enCoursMem.delete(d.requestId);
  chrome.storage.session.remove(cleEC(d.requestId)).catch(() => {});
  e.duree = Math.max(0, Math.round(d.timeStamp) - e.t);
  e.statut = erreur ? 0 : (d.statusCode || 0);
  e.taille = null;
  if (!erreur && Array.isArray(d.responseHeaders)) for (const h of d.responseHeaders) if (String(h.name).toLowerCase() === 'content-length') { const n = Number(h.value); if (Number.isFinite(n)) e.taille = n; }
  if (!e.entetesRequete) { try { const k = 'eh_' + d.requestId; const o = await chrome.storage.session.get(k); if (o[k]) e.entetesRequete = o[k]; chrome.storage.session.remove(k).catch(() => {}); } catch (_) {} }
  if (!erreur && Array.isArray(d.responseHeaders)) {
    e.entetesReponse = noms(d.responseHeaders);
    for (const h of d.responseHeaders) if (String(h.name).toLowerCase() === 'content-type') e.mime = String(h.value || '').slice(0, 80);
  }
  e.cache = !!d.fromCache;
  if (explTab != null && d.tabId === explTab) {
    e.origine = 'exploration';
    if (e.statut === 403 || e.statut === 429) explArreter('Vestiaire a répondu ' + e.statut + ' (' + e.methode + ' ' + e.chemin + ')', true);
    else if (e.statut === 401 && /\/users\/me\b/.test(e.chemin)) explArreter('déconnecté (401 sur ' + e.chemin + ')', true);
  }
  e.erreur = erreur ? String(d.error || 'erreur').slice(0, 120) : '';
  noter([e], true);
}
chrome.webRequest.onCompleted.addListener((d) => { terminer(d, false); }, FILTRE, ['responseHeaders']);
chrome.webRequest.onErrorOccurred.addListener((d) => { terminer(d, true); }, FILTRE);

// ── Le compte vu dans chaque onglet : un changement est noté une fois ──────
async function compteVu(ev) {
  const cle = 'compte_' + ev.tabId;
  let avant = null;
  try { avant = (await chrome.storage.session.get(cle))[cle] || null; } catch (_) {}
  if (avant && avant.login === ev.login) return null;
  chrome.storage.session.set({ [cle]: { login: ev.login, userId: ev.userId } }).catch(() => {});
  ev.detail = avant ? 'Changement de compte : ' + avant.login + ' → ' + ev.login : 'Compte vu : ' + ev.login;
  ev.ancien = avant ? avant.login : '';
  return ev;
}

// ── Messages ─────────────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, repondre) => {
  if (sender.id !== chrome.runtime.id || !msg) return;
  if (msg.quoi === 'evs' && sender.tab && Array.isArray(msg.evs)) {
    (async () => {
      await pret;
      if (!actif) return;
      const out = [];
      for (const ev of msg.evs.slice(0, 500)) {
        if (!ev || typeof ev !== 'object') continue;
        ev.tabId = sender.tab.id; ev.frameId = sender.frameId;
        if (typeof ev.t !== 'number') ev.t = Date.now();
        if (explTab != null && ev.tabId === explTab) ev.origine = 'exploration';
        if (ev.src === 'compte') { const c = await compteVu(ev); if (c) out.push(c); continue; }
        out.push(ev);
      }
      noter(out);
    })();
    return;
  }
  if (msg.quoi === 'expl_lancer') { explLancer(false).then((r) => repondre(r)); return true; }
  if (msg.quoi === 'expl_reprendre') { explLancer(true).then((r) => repondre(r)); return true; }
  if (msg.quoi === 'expl_arreter') { explArreter('arrêtée par toi', false).then(() => repondre({ ok: true })); return true; }
  if (msg.quoi === 'expl_etat') { explLire().then((s) => repondre({ ok: true, etat: s })); return true; }
  if (msg.quoi === 'vider') { vider().then(() => repondre({ ok: true })); return true; }
  if (msg.quoi === 'effacer') {
    aEcrire = [];
    file = file.then(() => B.effacer()).catch(() => {});
    file.then(() => repondre({ ok: true }));
    return true;
  }
  if (msg.quoi === 'extensions') { listeExtensions().then((l) => repondre({ ok: true, liste: l })); return true; }
  if (msg.quoi === 'debogueur') { chrome.storage.session.get('dbg').then((o) => repondre({ ok: true, etat: o.dbg || {} })); return true; }
});

// ── Extensions installées ────────────────────────────────────────────────────
async function listeExtensions() {
  try {
    const l = await chrome.management.getAll();
    return l.map((x) => ({ id: x.id, name: x.name, version: x.version, enabled: x.enabled, type: x.type, installType: x.installType, mayDisable: x.mayDisable, permissions: x.permissions || [], hostPermissions: x.hostPermissions || [], moi: x.id === chrome.runtime.id }));
  } catch (_) { return []; }
}
async function photoExtensions(quand) {
  const l = await listeExtensions();
  chrome.storage.local.set({ obs_extensions: { lu: Date.now(), liste: l } }).catch(() => {});
  noter([{ src: 'extensions_liste', t: Date.now(), detail: l.length + ' extension(s) ' + quand, liste: l }]);
}
const surExt = (quoi) => (info) => {
  const x = typeof info === 'string' ? { id: info } : info || {};
  noter([{ src: 'extension', t: Date.now(), detail: quoi + ' : ' + (x.name || x.id), extId: x.id, nom: x.name || '', permissions: x.permissions || [], hostPermissions: x.hostPermissions || [] }]);
  listeExtensions().then((l) => chrome.storage.local.set({ obs_extensions: { lu: Date.now(), liste: l } })).catch(() => {});
};
try {
  chrome.management.onInstalled.addListener(surExt('installée'));
  chrome.management.onUninstalled.addListener(surExt('désinstallée'));
  chrome.management.onEnabled.addListener(surExt('activée'));
  chrome.management.onDisabled.addListener(surExt('désactivée'));
} catch (_) {}

// ── Onglets Vestiaire ───────────────────────────────────────────────────────────
// Sans la permission « tabs », Chrome ne donne l'URL que des onglets dont l'observateur a l'hôte : Vestiaire (et Stream) seulement.
async function onglets() { try { return (await chrome.storage.session.get('onglets')).onglets || {}; } catch (_) { return {}; } }
async function ongletsOuverts() {
  try {
    const l = await chrome.tabs.query({ url: ONGLETS_VC });
    const o = await onglets();
    for (const t of l) o[t.id] = R.masquerUrl(t.url).chemin;
    await chrome.storage.session.set({ onglets: o });
    noter([{ src: 'onglet', t: Date.now(), detail: l.length + ' onglet(s) Vestiaire ouvert(s) au démarrage', liste: l.map((t) => ({ tabId: t.id, chemin: R.masquerUrl(t.url).chemin })) }]);
  } catch (_) {}
}
chrome.tabs.onCreated.addListener((t) => {
  const u = t.pendingUrl || t.url || '';
  if (!EST_VC.test(u)) return;
  pret.then(async () => {
    const o = await onglets(); o[t.id] = R.masquerUrl(u).chemin; await chrome.storage.session.set({ onglets: o });
    noter([{ src: 'onglet', t: Date.now(), tabId: t.id, detail: 'Onglet Vestiaire ouvert', chemin: o[t.id], depuis: t.openerTabId }]);
  });
});
chrome.tabs.onUpdated.addListener((tabId, ch, tab) => {
  pret.then(async () => {
    const u = ch.url || (tab && tab.url) || '';
    const o = await onglets();
    if (ch.status === 'loading' && EST_VC.test(u)) {
      const chemin = R.masquerUrl(u).chemin;
      const etait = o[tabId];
      o[tabId] = chemin; await chrome.storage.session.set({ onglets: o });
      noter([{ src: 'onglet', t: Date.now(), tabId, chemin, detail: etait == null ? 'Onglet devenu Vestiaire' : (ch.url ? 'Page chargée dans l\'onglet' : 'Onglet actualisé') }]);
      if (actif && complet) attacher(tabId);
    } else if (ch.url && !EST_VC.test(ch.url) && o[tabId] != null) {
      delete o[tabId]; await chrome.storage.session.set({ onglets: o });
      noter([{ src: 'onglet', t: Date.now(), tabId, detail: 'Onglet parti de Vestiaire' }]);
    }
  });
});
chrome.tabs.onRemoved.addListener((tabId) => {
  if (explTab != null && tabId === explTab) explArreter('onglet d\'exploration fermé', false);
  pret.then(async () => {
    const o = await onglets();
    if (o[tabId] == null) return;
    delete o[tabId]; await chrome.storage.session.set({ onglets: o });
    noter([{ src: 'onglet', t: Date.now(), tabId, detail: 'Onglet Vestiaire fermé' }]);
  });
});

// ── Capture complète : chrome.debugger ───────────────────────────────────────
// État par onglet dans storage.session (« dbg ») : { [tabId]: { ok, depuis, erreur } }.
async function dbgEtat() { try { return (await chrome.storage.session.get('dbg')).dbg || {}; } catch (_) { return {}; } }
async function dbgPoser(tabId, v) { const d = await dbgEtat(); if (v) d[tabId] = v; else delete d[tabId]; await chrome.storage.session.set({ dbg: d }).catch(() => {}); }
const envoyerCmd = (cible, cmd, p) => new Promise((ok) => { try { chrome.debugger.sendCommand(cible, cmd, p || {}, (r) => { void chrome.runtime.lastError; ok(r); }); } catch (_) { ok(null); } });

async function activerDomaines(cible) {
  await envoyerCmd(cible, 'Network.enable', { maxPostDataSize: 65536 });
  await envoyerCmd(cible, 'Page.enable');
  if (consoleOn) await envoyerCmd(cible, 'Runtime.enable');
  await envoyerCmd(cible, 'Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: false, flatten: true });
}
async function attacher(tabId) {
  const d = await dbgEtat();
  if (d[tabId] && d[tabId].ok) return;
  await new Promise((ok) => {
    chrome.debugger.attach({ tabId }, '1.3', async () => {
      const err = chrome.runtime.lastError;
      if (err) {
        const m = String(err.message || err);
        await dbgPoser(tabId, { ok: false, erreur: m, depuis: Date.now() });
        noter([{ src: 'debogueur', t: Date.now(), tabId, detail: 'Attache impossible : ' + m + (/attached|another/i.test(m) ? ' (un autre débogueur — souvent les outils de développement ouverts sur cet onglet — est déjà attaché)' : '') }]);
        return ok();
      }
      await dbgPoser(tabId, { ok: true, depuis: Date.now() });
      await activerDomaines({ tabId });
      noter([{ src: 'debogueur', t: Date.now(), tabId, detail: 'Capture complète attachée à l\'onglet' }]);
      ok();
    });
  });
}
async function attacherTous() {
  try { const l = await chrome.tabs.query({ url: ONGLETS_VC }); for (const t of l) await attacher(t.id); } catch (_) {}
}
async function detacherTous() {
  const d = await dbgEtat();
  for (const id of Object.keys(d)) {
    await new Promise((ok) => { try { chrome.debugger.detach({ tabId: Number(id) }, () => { void chrome.runtime.lastError; ok(); }); } catch (_) { ok(); } });
    noter([{ src: 'debogueur', t: Date.now(), tabId: Number(id), detail: 'Capture complète détachée (interrupteur éteint)' }], true);
  }
  await chrome.storage.session.set({ dbg: {} }).catch(() => {});
  await oublierCdp(null);
}
async function oublierCdp(tabId) {
  try { const t = await chrome.storage.session.get(null); const k = Object.keys(t).filter((x) => x.startsWith('cdp_' + (tabId == null ? '' : tabId + '_'))); if (k.length) await chrome.storage.session.remove(k); } catch (_) {}
}
chrome.debugger.onDetach.addListener((src, raison) => {
  if (src.tabId == null) return;
  dbgPoser(src.tabId, null);
  oublierCdp(src.tabId);
  const dit = raison === 'canceled_by_user' ? 'tu as cliqué « Annuler » sur le bandeau de Chrome' : raison === 'target_closed' ? 'onglet fermé ou rechargé ailleurs' : raison;
  noter([{ src: 'debogueur', t: Date.now(), tabId: src.tabId, detail: 'Capture complète détachée : ' + dit }], true);
});

const cleCdp = (tabId, sid, id) => 'cdp_' + tabId + '_' + (sid || '') + '_' + id;
const IDS_EXT = /(?:chrome|moz)-extension:\/\/([a-p]{32})/g;
function extDans(init) {
  const ids = new Set();
  const voir = (s) => { if (!s) return; let m; IDS_EXT.lastIndex = 0; while ((m = IDS_EXT.exec(s))) if (m[1] !== chrome.runtime.id) ids.add(m[1]); };
  if (!init) return [];
  voir(init.url);
  let st = init.stack;
  for (let i = 0; st && i < 5; i++, st = st.parent) for (const f of st.callFrames || []) voir(f.url);
  return Array.from(ids);
}
const LISIBLE = /json|text|javascript|xml|x-www-form-urlencoded|graphql/i;
let wsMinute = 0; let wsN = 0;
chrome.debugger.onEvent.addListener((src, methode, p) => {
  if (src.tabId == null) return;
  (async () => {
    await pret;
    if (!actif || !complet) return;
    const tabId = src.tabId; const sid = src.sessionId || '';
    const cible = sid ? { tabId, sessionId: sid } : { tabId };
    try {
      if (methode === 'Target.attachedToTarget') { await activerDomaines({ tabId, sessionId: p.sessionId }); return; }
      if (methode === 'Network.requestWillBeSent') {
        const u = R.masquerUrl(p.request.url);
        if (!EST_OBSERVE.test(String(u.hote).replace(/:\d+$/, '')) && !/^(Document|XHR|Fetch|WebSocket|EventSource|Script)$/.test(p.type || '')) return;   // images et polices d'ailleurs : bruit
        const meth = p.request.method;
        const e = {
          origine: explTab != null && tabId === explTab ? 'exploration' : undefined,
          src: 'cdp', api: 'net', t: Math.round((p.wallTime || Date.now() / 1000) * 1000), mono: p.timestamp,
          methode: meth, hote: u.hote, chemin: u.chemin, recherche: u.recherche, params: u.params, type: String(p.type || '').toLowerCase(),
          tabId, session: sid ? 'iframe' : 'onglet', frameUrl: '', initiatorType: p.initiator ? p.initiator.type : '',
          extPile: extDans(p.initiator),
          // Des en-têtes (Cookie, Authorization, X-CSRF-Token…), seuls les NOMS sont recopiés, jamais une valeur.
          entetesRequete: Object.keys(p.request.headers || {}).map((k) => k.toLowerCase()).slice(0, 60),
          corps: p.request.postData ? R.tronquer(R.masquerTexte(p.request.postData)) : (p.request.hasPostData ? { texte: '', note: 'corps non fourni par Chrome', tronque: false, taille: 0 } : null),
        };
        if (p.redirectResponse) e.redirige = p.redirectResponse.status;
        await chrome.storage.session.set({ [cleCdp(tabId, sid, p.requestId)]: e });
        return;
      }
      if (methode === 'Network.responseReceived') {
        const k = cleCdp(tabId, sid, p.requestId);
        const e = (await chrome.storage.session.get(k))[k]; if (!e) return;
        e.statut = p.response.status; e.mime = p.response.mimeType || '';
        e.entetesReponse = Object.keys(p.response.headers || {}).map((k) => k.toLowerCase()).slice(0, 60);
        await chrome.storage.session.set({ [k]: e });
        return;
      }
      if (methode === 'Network.loadingFinished' || methode === 'Network.loadingFailed') {
        const k = cleCdp(tabId, sid, p.requestId);
        const e = (await chrome.storage.session.get(k))[k]; if (!e) return;
        chrome.storage.session.remove(k).catch(() => {});
        e.duree = e.mono ? Math.max(0, Math.round((p.timestamp - e.mono) * 1000)) : null; delete e.mono;
        if (methode === 'Network.loadingFailed') { e.erreur = String(p.errorText || 'échec').slice(0, 120); if (p.canceled) e.erreur += ' (annulée)'; }
        else {
          e.taille = p.encodedDataLength;
          if (LISIBLE.test(e.mime || '') && (p.encodedDataLength || 0) < 4 * 1024 * 1024) {
            const r = await envoyerCmd(cible, 'Network.getResponseBody', { requestId: p.requestId });
            if (r && typeof r.body === 'string') {
              const txt = r.base64Encoded ? '' : r.body;
              e.reponse = r.base64Encoded ? { texte: '', note: 'binaire', tronque: false, taille: r.body.length } : R.tronquer(R.masquerTexte(txt.slice(0, 1048576)), 16384);
            } else e.reponse = { texte: '', note: 'corps plus disponible', tronque: false, taille: 0 };
          }
        }
        noter([e]);
        return;
      }
      if (methode === 'Network.webSocketCreated' || methode === 'Network.webSocketFrameSent' || methode === 'Network.webSocketFrameReceived' || methode === 'Network.webSocketClosed') {
        const m = Math.floor(Date.now() / 60000); if (m !== wsMinute) { wsMinute = m; wsN = 0; }
        if (++wsN > 300) return;
        const e = { src: 'cdp', api: 'ws', t: Date.now(), tabId, methode: 'WS' };
        if (p.url) { const u = R.masquerUrl(p.url); e.hote = u.hote; e.chemin = u.chemin; e.extPile = extDans(p.initiator); }
        e.sens = { 'Network.webSocketCreated': 'ouvert', 'Network.webSocketFrameSent': 'envoyé', 'Network.webSocketFrameReceived': 'reçu', 'Network.webSocketClosed': 'fermé' }[methode];
        if (p.response && typeof p.response.payloadData === 'string') {
          const txt = p.response.opcode === 2 ? '' : p.response.payloadData;
          (e.sens === 'envoyé' ? (e.corps = R.tronquer(R.masquerTexte(txt), 2048)) : (e.reponse = R.tronquer(R.masquerTexte(txt), 2048)));
        }
        noter([e]);
        return;
      }
      if (methode === 'Page.frameNavigated') {
        const u = R.masquerUrl(p.frame.url);
        noter([{ src: 'nav', t: Date.now(), tabId, detail: (p.frame.parentId ? 'iframe' : 'page') + ' naviguée (débogueur)', hote: u.hote, chemin: u.chemin, extId: (/^chrome-extension:\/\/([a-p]{32})/.exec(p.frame.url) || [])[1] || '' }]);
        return;
      }
      if (methode === 'Runtime.consoleAPICalled' && consoleOn) {
        const txt = (p.args || []).map((a) => (a.value != null ? String(a.value) : a.description || a.type)).join(' ');
        const fr = p.stackTrace && p.stackTrace.callFrames && p.stackTrace.callFrames[0];
        noter([{ src: 'console', t: Math.round(p.timestamp || Date.now()), tabId, detail: p.type + ' : ' + R.masquerTexte(txt).slice(0, 300), extPile: extDans({ stack: p.stackTrace }), pile: fr ? String(fr.url || '').replace(/\?.*/, '') + ':' + fr.lineNumber : '' }]);
      }
    } catch (_) {}
  })();
});


// ══ Explorer le site tout seul (2.1.0) ═══════════════════════════════════════
// Sur TON clic : un onglet vestiairecollective.com dédié, dans une fenêtre à part qui ne passe pas au premier plan,
// connecté à ton compte (le même navigateur), parcourt en LECTURE l'accueil, ton profil et ton dressing, tes
// articles (et la liste de ceux qui les ont aimés si le site la montre), tes notifications, ta messagerie, tes offres,
// tes commandes, tes favoris, tes réglages ; puis, en largeur, les liens du même site liés à ton compte (200 pages au
// plus, profondeur 3). Chaque page : défilement jusqu'en bas, ouverture de ce qui s'ouvre sans écrire (explorateur.js,
// liste noire de regles.js). Rythme : 3 à 9 s au hasard entre deux pages, jamais deux fois le même temps. Arrêt
// immédiat : vérification (captcha) affichée, 403 / 429, déconnexion, onglet fermé, ton « Arrêter ». Reprise possible :
// l'état vit dans chrome.storage.local (« obs_expl »), un réveil du fond reprend là où il en était.
// Tout ce que l'onglet d'exploration provoque est capté comme le reste, marqué origine « exploration ».
const EXPL_DEFAUT = { min: 3000, max: 9000, maxPages: 200, profMax: 3, maxClics: 25 };
let explTab = null;
let explBoucle = false;
let explStop = false;
async function explLire() { try { return (await chrome.storage.local.get('obs_expl')).obs_expl || null; } catch (_) { return null; } }
// L'onglet d'exploration reste « exploration » même arrêté : ce qui s'y passe ensuite n'est pas un geste de l'utilisateur.
async function explEcrire(s) { if (s && s.tabId != null) explTab = s.tabId; await chrome.storage.local.set({ obs_expl: s }).catch(() => {}); }
// Réservé au banc : un rythme plus court (le défaut reste 3 à 9 s, 200 pages, profondeur 3).
async function explReglages() {
  let e = {}; try { e = (await chrome.storage.local.get('obs_expl_essai')).obs_expl_essai || {}; } catch (_) {}
  const r = Object.assign({}, EXPL_DEFAUT);
  for (const k of Object.keys(EXPL_DEFAUT)) if (Number.isFinite(Number(e[k])) && Number(e[k]) > 0) r[k] = Number(e[k]);
  r.vitesse = e.min ? Math.max(0.05, r.min / EXPL_DEFAUT.min) : 1;
  return r;
}
chrome.storage.onChanged.addListener((ch, zone) => { if (zone === 'local' && ch.obs_expl) { const s = ch.obs_expl.newValue; if (s && s.tabId != null) explTab = s.tabId; } });
pret.then(async () => { const s = await explLire(); if (s && s.tabId != null) explTab = s.tabId; if (s && s.actif) explDerouler(); });

function noterExpl(ev) { noter([Object.assign({ src: 'exploration', t: Date.now(), origine: 'exploration', tabId: explTab }, ev)], true); }

async function moiConnu() {
  try { const t = await chrome.storage.session.get(null); for (const k of Object.keys(t)) if (k.startsWith('compte_') && t[k] && t[k].userId) return String(t[k].userId); } catch (_) {}
  return '';
}

async function explLancer(reprise) {
  await pret;
  let s = await explLire();
  if (s && s.actif && explBoucle && !explStop) return { ok: true, etat: s, deja: true };
  // Une boucle précédente encore en train de finir sa page : on attend qu'elle ait rendu la main.
  if (explBoucle) { explStop = true; for (let i = 0; i < 120 && explBoucle; i++) await attendre(250); }
  s = await explLire();
  const reg = await explReglages();
  // L'exploration enregistre : l'interrupteur est allumé avec elle.
  if (!actif) { await chrome.storage.local.set({ obs_on: true }); await lireReglages(); voyant(); }
  const moi = await moiConnu();
  if (!reprise || !s || !s.file || (!s.file.length && !s.courant)) {
    let origine = 'https://www.vestiairecollective.com';
    try { const l = await chrome.tabs.query({ url: ONGLETS_VC }); const u = l.map((t) => t.url).find(Boolean); if (u) origine = new URL(u).origin; } catch (_) {}
    const graines = ['/', moi ? '/members/profile-' + moi + '.shtml' : null, '/notifications/', '/chat/'].filter(Boolean).map((p) => ({ url: origine + p, prof: 0, compte: true }));
    s = { actif: true, origine, moi, file: graines, vus: [], n: 0, delais: [], debut: Date.now(), arret: null, courant: null, tabId: null, windowId: null };
  } else {
    s.actif = true; s.arret = null; s.moi = s.moi || moi;
    if (s.courant) { s.file.unshift(s.courant); s.courant = null; }
  }
  s.reglages = { maxPages: reg.maxPages, profMax: reg.profMax };
  s.run = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);   // une exploration = un numéro ; une ancienne boucle s'efface
  explStop = false;
  await explEcrire(s);
  noterExpl({ etape: reprise ? 'reprise' : 'debut', detail: (reprise ? 'Exploration reprise' : 'Exploration lancée') + ' · ' + s.file.length + ' page(s) en attente' });
  explDerouler();
  return { ok: true, etat: s };
}

async function explArreter(raison, garderOnglet) {
  explStop = true;
  const s = await explLire();
  if (!s || !s.actif) return;
  s.actif = false; s.arret = { raison, t: Date.now() }; s.garderOnglet = !!garderOnglet;
  await explEcrire(s);
  noterExpl({ etape: 'arret', detail: 'Exploration arrêtée : ' + raison });
  if (s.tabId != null) { try { chrome.tabs.sendMessage(s.tabId, { quoi: 'expl_stop' }).catch(() => {}); } catch (_) {} }
  // Sur une vérification, un refus ou une déconnexion, l'onglet reste ouvert pour que tu voies ce qui s'affiche.
  if (!garderOnglet && s.windowId != null) { try { await chrome.windows.remove(s.windowId); } catch (_) {} }
}

const attendre = (ms) => new Promise((ok) => setTimeout(ok, ms));
// Attente découpée : « Arrêter » est entendu en moins d'un quart de seconde.
async function attendreOuStop(ms) { const fin = Date.now() + ms; while (Date.now() < fin) { if (explStop) return false; await attendre(Math.min(250, fin - Date.now())); } return !explStop; }
function attendreCharge(tabId, timeout) {
  return new Promise((ok) => {
    let fini = false;
    const finir = (v) => { if (fini) return; fini = true; chrome.tabs.onUpdated.removeListener(ecoute); clearTimeout(m); ok(v); };
    const ecoute = (id, ch) => { if (id === tabId && ch.status === 'complete') finir(true); };
    chrome.tabs.onUpdated.addListener(ecoute);
    const m = setTimeout(() => finir(false), timeout);
  });
}
async function demanderPage(tabId, o) {
  for (let i = 0; i < 12; i++) {
    if (explStop) return null;
    try { const r = await chrome.tabs.sendMessage(tabId, o, { frameId: 0 }); if (r) return r; } catch (_) {}
    await attendre(500);
  }
  return null;
}
// Un temps au hasard entre min et max, jamais deux fois le même (à la milliseconde) dans une exploration.
function delaiUnique(s, reg) {
  const deja = new Set(s.delais || []);
  let d;
  do { d = Math.round(reg.min + Math.random() * (reg.max - reg.min)); } while (deja.has(d));
  s.delais = (s.delais || []).concat(d).slice(-500);
  return d;
}

async function explDerouler() {
  if (explBoucle) return;
  explBoucle = true;
  let run = null;
  try {
    const reg = await explReglages();
    let s = await explLire();
    run = s && s.run;
    const encore = (x) => x && x.actif && x.run === run && !explStop;
    while (encore(s)) {
      if (s.n >= reg.maxPages) { await explFin(s, 'limite de ' + reg.maxPages + ' pages atteinte'); return; }
      const item = s.file.shift();
      if (!item) { await explFin(s, 'tout ce qui était à voir a été vu'); return; }
      if (s.vus.includes(item.url)) { await explEcrire(s); continue; }
      s.courant = item; s.vus.push(item.url);
      await explEcrire(s);
      // L'onglet : créé à la première page, dans une fenêtre qui ne prend pas le premier plan.
      let tabId = s.tabId;
      let vivant = false;
      if (tabId != null) { try { await chrome.tabs.get(tabId); vivant = true; } catch (_) {} }
      const charge = vivant ? attendreCharge(tabId, 30000) : null;
      if (!vivant) {
        const w = await chrome.windows.create({ url: item.url, focused: false, type: 'normal', width: 1280, height: 900 });
        s.windowId = w.id; s.tabId = tabId = w.tabs[0].id; explTab = tabId;
        await explEcrire(s);
        await attendreCharge(tabId, 30000);
      } else {
        await chrome.tabs.update(tabId, { url: item.url });
        await charge;
      }
      if (!encore(await explLire())) break;
      const r = await demanderPage(tabId, { quoi: 'expl_page', vitesse: reg.vitesse, moiId: s.moi || '', maxClics: reg.maxClics });
      s = await explLire();
      if (!encore(s)) break;
      s.courant = null;
      s.n++;
      let ajout = 0;
      if (r && Array.isArray(r.liens)) {
        for (const l of r.liens) {
          if (item.prof + 1 > reg.profMax) break;
          if (s.vus.includes(l.url) || s.file.some((x) => x.url === l.url)) continue;
          if (!(l.compte || (l.article && item.compte))) continue;    // liés au compte : pages du compte, et les articles vus depuis elles
          s.file.push({ url: l.url, prof: item.prof + 1, compte: !!l.compte }); ajout++;
        }
      }
      let chemin = item.url; try { chemin = new URL(item.url).pathname; } catch (_) {}
      noterExpl({ etape: 'page', chemin, profondeur: item.prof, n: s.n, clics: r && r.clics ? r.clics.length : 0, clicsDetail: r && r.clics, refuses: r && r.refuses, liens: ajout, titre: r && r.titre, detail: 'Page ' + s.n + ' vue : ' + chemin + (r ? '' : ' (la page n\'a pas répondu)') });
      await explEcrire(s);
      if (r && r.captcha) { await explArreter('vérification affichée (' + r.captcha + ')', true); return; }
      if (r && r.deconnecte) { await explArreter('déconnecté (' + r.deconnecte + ')', true); return; }
      const d = delaiUnique(s, reg);
      await explEcrire(s);
      if (!(await attendreOuStop(d))) break;
      s = await explLire();
    }
  } catch (err) {
    const x = await explLire();
    if (x && x.run === run) await explArreter('erreur : ' + String(err && err.message || err).slice(0, 120), true);
  } finally { explBoucle = false; }
}
async function explFin(s, raison) {
  s.actif = false; s.arret = { raison, t: Date.now(), fini: true };
  await explEcrire(s);
  noterExpl({ etape: 'arret', detail: 'Exploration terminée : ' + raison });
  if (s.windowId != null) { try { await chrome.windows.remove(s.windowId); } catch (_) {} }
}
