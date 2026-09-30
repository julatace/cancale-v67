// VRM Capteur — outil de DIAGNOSTIC, à la demande (bouton Démarrer).
// But : voir quelles requêtes une autre extension (ex. Vintex) fait envoyer à
// Vinted quand on lance une action. Chrome cache à une extension les requêtes
// parties du service worker d'une AUTRE extension ; il laisse voir celles qui
// partent des pages vinted.fr (script injecté, script de contenu, site lui-même).
// On note : heure, méthode, URL SANS paramètres sensibles, statut, initiateur,
// et la FORME du corps (clés + types, valeurs masquées sauf identifiants numériques).
// Jamais : cookies, en-têtes d'autorisation, jetons, mots de passe.
const MAX = 800;
const SENSIBLE = /token|csrf|password|pass|secret|auth|cookie|session|email|phone|iban|card/i;
let actif = false, tampon = [], enCours = {};

chrome.storage.local.get(['actif', 'releve'], (r) => { actif = !!r.actif; tampon = r.releve || []; });
const sauver = () => chrome.storage.local.set({ releve: tampon.slice(-MAX) });

function formeDe(v, prof = 0) {
  if (prof > 4) return '…';
  if (Array.isArray(v)) return v.length ? [formeDe(v[0], prof + 1), `×${v.length}`] : [];
  if (v && typeof v === 'object') {
    const o = {};
    for (const k of Object.keys(v).slice(0, 40)) o[k] = SENSIBLE.test(k) ? '(masqué)' : formeDe(v[k], prof + 1);
    return o;
  }
  if (typeof v === 'number') return 'nombre';
  if (typeof v === 'boolean') return String(v);
  if (typeof v === 'string') return /^\d{3,}$/.test(v) ? 'id' : `texte(${v.length})`;
  return typeof v;
}
function corpsDe(details) {
  try {
    const rb = details.requestBody;
    if (!rb) return null;
    if (rb.formData) { const o = {}; for (const k of Object.keys(rb.formData)) o[k] = SENSIBLE.test(k) ? '(masqué)' : 'champ'; return o; }
    if (rb.raw && rb.raw[0] && rb.raw[0].bytes) {
      const txt = new TextDecoder().decode(rb.raw[0].bytes);
      try { return formeDe(JSON.parse(txt)); } catch (_) { return `brut(${txt.length})`; }
    }
  } catch (_) {}
  return null;
}
function urlPropre(u) {
  try {
    const x = new URL(u);
    const q = [...x.searchParams.keys()].map(k => SENSIBLE.test(k) ? k + '=(masqué)' : k).join('&');
    return x.host + x.pathname.replace(/\/\d{3,}(?=\/|$)/g, '/{id}') + (q ? '?' + q : '');
  } catch (_) { return String(u).split('?')[0]; }
}
const FILTRE = { urls: ['https://*.vinted.fr/*', 'https://*.vinted.com/*'] };

chrome.webRequest.onBeforeRequest.addListener((d) => {
  if (!actif || d.type === 'image' || d.type === 'stylesheet' || d.type === 'font' || d.type === 'media') return;
  enCours[d.requestId] = { t: new Date(d.timeStamp).toISOString(), m: d.method, u: urlPropre(d.url), type: d.type,
    init: d.initiator || '', onglet: d.tabId, corps: corpsDe(d) };
}, FILTRE, ['requestBody']);

const finir = (d, statut) => {
  const e = enCours[d.requestId]; if (!e) return;
  delete enCours[d.requestId];
  e.s = statut;
  tampon.push(e); if (tampon.length > MAX) tampon = tampon.slice(-MAX);
  sauver();
};
chrome.webRequest.onCompleted.addListener((d) => finir(d, d.statusCode), FILTRE);
chrome.webRequest.onErrorOccurred.addListener((d) => finir(d, 'erreur:' + d.error), FILTRE);

chrome.runtime.onMessage.addListener((msg, _s, rep) => {
  if (msg.action === 'etat') { rep({ actif, n: tampon.length }); return; }
  if (msg.action === 'demarrer') { actif = true; tampon = []; enCours = {}; chrome.storage.local.set({ actif: true, releve: [] }); rep({ ok: true }); return; }
  if (msg.action === 'arreter') { actif = false; chrome.storage.local.set({ actif: false }); rep({ ok: true }); return; }
  if (msg.action === 'releve') { rep({ releve: tampon }); return; }
  if (msg.action === 'repere') { tampon.push({ t: new Date().toISOString(), repere: msg.texte || 'repère' }); sauver(); rep({ ok: true }); return; }
});
