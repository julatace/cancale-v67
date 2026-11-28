// ════════════════════════════════════════════════════════════════════════════
//  LA VÉRIFICATION ANTI-ROBOT DES BANCS (5.456, 27 nov.)
//  · la VRAIE page public/verif-extension.html / .js, servie sous https://vrm.center ;
//  · un faux Turnstile (challenges.cloudflare.com) : un cadre « ✓ Réussi », un jeton NEUF (`jeton-banc-…`) à chaque
//    rendu et à chaque `reset` (usage unique, comme Turnstile) — ce que le faux GoTrue à captcha accepte.
//  ⚠️ Seule substitution : la page accepte aussi le parent `https://ext.test` (un banc ne peut pas servir une origine
//     chrome-extension://) ; la vraie règle des parents est jugée par audit-connexion-panneau V1.
//  `servirVerif(route)` : rend true si la requête a été servie.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
const RACINE = path.join(__dirname, '..', '..');
const pub = (n) => { try { return fs.readFileSync(path.join(RACINE, 'public', n), 'utf8'); } catch (_) { return null; } };
const VERIF_HTML = pub('verif-extension.html');
const VERIF_JS = (pub('verif-extension.js') || '').replace('var PARENT_PERMIS = /^(?:', 'var PARENT_PERMIS = /^(?:https:\\/\\/ext\\.test|');
const FAUX_TURNSTILE = `(function(){var n=0;function jet(){n++;return 'jeton-banc-'+n+'-'+Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2);}
window.turnstile={render:function(sel,o){var el=typeof sel==='string'?document.querySelector(sel):sel;var b=document.createElement('div');b.setAttribute('data-faux-turnstile','');b.style.cssText='box-sizing:border-box;height:65px;width:100%;border:1px solid #ccc;border-radius:6px;display:flex;align-items:center;gap:10px;padding:0 14px;font:14px system-ui;background:'+(o.theme==='dark'?'#232323;color:#eee':'#fafafa;color:#222');b.textContent='Vérification…';el.appendChild(b);window.__o=o;setTimeout(function(){b.textContent='✓ Réussi';o.callback(jet());},250);return 'w1';},
reset:function(){var b=document.querySelector('[data-faux-turnstile]');if(b)b.textContent='Vérification…';setTimeout(function(){if(b)b.textContent='✓ Réussi';window.__o.callback(jet());},200);},remove:function(){}};
var m=/onload=([\\w$]+)/.exec((document.currentScript&&document.currentScript.src)||'');if(m&&window[m[1]])setTimeout(window[m[1]],0);})();`;
function servirVerif(r) {
  const u = r.request().url();
  if (/^https:\/\/challenges\.cloudflare\.com\/turnstile\/v0\/api\.js/.test(u)) { r.fulfill({ status: 200, contentType: 'text/javascript', body: FAUX_TURNSTILE }); return true; }
  if (/^https:\/\/vrm\.center\/verif-extension\.html/.test(u)) { if (VERIF_HTML) r.fulfill({ status: 200, contentType: 'text/html', body: VERIF_HTML }); else r.fulfill({ status: 404, body: 'introuvable' }); return true; }
  if (/^https:\/\/vrm\.center\/verif-extension\.js/.test(u)) { if (VERIF_JS) r.fulfill({ status: 200, contentType: 'text/javascript', body: VERIF_JS }); else r.fulfill({ status: 404, body: '' }); return true; }
  return false;
}
module.exports = { servirVerif, FAUX_TURNSTILE, VERIF_HTML, VERIF_JS };
