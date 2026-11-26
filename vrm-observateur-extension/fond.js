importScripts('regle.js');
// Le sel des empreintes : tiré une fois, gardé sur CET ordinateur (jamais envoyé).
chrome.storage.local.get('obsSel').then((s) => {
  if (s.obsSel) { OBS.poserSel(s.obsSel); return; }
  const a = new Uint8Array(12); crypto.getRandomValues(a);
  const sel = [...a].map((x) => x.toString(16).padStart(2, '0')).join('');
  OBS.poserSel(sel); chrome.storage.local.set({ obsSel: sel });
});
const MAX = 4000;
let file = [];          // entrées en attente d'écriture (vidées toutes les 2 s)
const enCours = new Map(); // requestId -> entrée (pour y poser le statut)
let actif = null;

async function estActif() {
  if (actif === null) {
    const s = await chrome.storage.local.get('obsActif');
    actif = s.obsActif !== false;
  }
  return actif;
}
chrome.storage.onChanged.addListener((c) => {
  if (c.obsActif) actif = c.obsActif.newValue !== false;
});

chrome.webRequest.onBeforeRequest.addListener((d) => {
  if (actif === false) return;
  const e = OBS.entree(d);
  if (!e) return;
  enCours.set(d.requestId, e);
  if (enCours.size > 500) enCours.delete(enCours.keys().next().value);
}, { urls: ['<all_urls>'] }, ['requestBody']);

function fin(d, statut, erreur) {
  const e = enCours.get(d.requestId);
  if (!e) return;
  enCours.delete(d.requestId);
  e.s = statut;
  if (erreur) e.err = String(erreur).slice(0, 60);
  e.ms = Math.round(d.timeStamp - e.t);
  file.push(e);
}
chrome.webRequest.onCompleted.addListener((d) => fin(d, d.statusCode), { urls: ['<all_urls>'] });
chrome.webRequest.onErrorOccurred.addListener((d) => fin(d, 0, d.error), { urls: ['<all_urls>'] });

async function vider() {
  if (!file.length) return;
  if (!(await estActif())) { file = []; return; }
  const lot = file; file = [];
  const s = await chrome.storage.local.get('obsJournal');
  const j = (s.obsJournal || []).concat(lot);
  await chrome.storage.local.set({ obsJournal: j.slice(-MAX) });
}
setInterval(vider, 2000);
chrome.runtime.onMessage.addListener((msg, snd, rep) => {
  if (msg && msg.obs === 'vider') { vider().then(() => rep({ ok: true })); return true; }
  // 2.0 : un geste de la page (page.js), passé par la règle avant d'être gardé.
  if (msg && msg.obs === 'geste' && actif !== false) { const e = OBS.geste(Object.assign({}, msg.g, { onglet: snd && snd.tab ? snd.tab.id : undefined })); if (e) file.push(e); }
});
// 2.0 : les onglets Vinted ouverts, changés, fermés (qui ouvre quoi pendant un envoi).
chrome.tabs.onCreated.addListener((t) => { if (actif === false) return; const e = OBS.geste({ k: 'onglet', t: Date.now(), vrai: true, url: t.pendingUrl || t.url || 'about:blank', quoi: 'cree', onglet: t.id }); if (e) file.push(e); });
chrome.tabs.onUpdated.addListener((id, ch) => { if (actif === false || !ch.url) return; const e = OBS.geste({ k: 'onglet', t: Date.now(), vrai: true, url: ch.url, quoi: 'adresse', onglet: id }); if (e && (e.p || OBS.estVinted(e.h))) file.push(e); });
chrome.tabs.onRemoved.addListener((id) => { if (actif === false) return; file.push({ k: 'onglet', t: Date.now(), vrai: true, quoi: 'ferme', onglet: id }); });
