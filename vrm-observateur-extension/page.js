// VRM Observateur 2.0 — les GESTES faits dans une page Vinted (26 nov.) ; 2.1 (27 nov.) : et Vestiaire Collective.
// Regarde seulement : aucun clic, aucune frappe, aucune requête. Chaque geste part au fond, qui le passe par la
// règle (regle.js `geste`) avant de le ranger : on n'envoie ici que la sorte, l'heure, « vrai doigt ou script » et la
// signature brute de l'élément ; le fond garde seulement ce que la règle laisse passer.
(() => {
  if (window.__vrmObsGestes) return; window.__vrmObsGestes = true;
  const envoyer = (g) => { try { chrome.runtime.sendMessage({ obs: 'geste', g }); } catch (_) {} };
  const brut = (el) => {
    if (!el || el.nodeType !== 1) return null;
    const cible = el.closest('button,a,[role],input,textarea,select,label,[data-testid]') || el;
    const anc = []; let p = cible.parentElement;
    while (p && anc.length < 4) { const t = p.getAttribute && p.getAttribute('data-testid'); if (t) anc.push(t); p = p.parentElement; }
    return {
      tag: cible.localName, role: cible.getAttribute('role') || '', type: cible.getAttribute('type') || '',
      testid: cible.getAttribute('data-testid') || '', name: cible.getAttribute('name') || '', aria: cible.getAttribute('aria-label') || '',
      placeholder: cible.getAttribute('placeholder') || '', texte: (cible.innerText || cible.value || '').slice(0, 60),
      href: cible.localName === 'a' ? cible.href : '', ancetres: anc,
    };
  };
  const cat = (k) => (/^[a-zA-Z]$/.test(k) ? 'lettre' : /^\d$/.test(k) ? 'chiffre' : k === ' ' ? 'espace' : /^Arrow/.test(k) ? 'fleche' : ['Enter', 'Backspace', 'Tab', 'Escape'].includes(k) ? k : 'autre');
  const o = { capture: true, passive: true };
  addEventListener('click', (e) => envoyer({ k: 'clic', t: Date.now(), vrai: e.isTrusted, el: brut(e.target) }), o);
  addEventListener('pointerdown', (e) => envoyer({ k: 'appui', t: Date.now(), vrai: e.isTrusted, el: brut(e.target) }), o);
  addEventListener('keydown', (e) => envoyer({ k: 'touche', t: Date.now(), vrai: e.isTrusted, touche: cat(e.key), el: brut(e.target) }), o);
  addEventListener('input', (e) => { const t = e.target; const v = t && (t.value != null ? t.value : t.innerText); envoyer({ k: 'frappe', t: Date.now(), vrai: e.isTrusted, longueur: String(v || '').length, el: brut(t) }); }, o);
  addEventListener('focusin', (e) => envoyer({ k: 'focus', t: Date.now(), vrai: e.isTrusted, el: brut(e.target) }), o);
  addEventListener('submit', (e) => envoyer({ k: 'envoi', t: Date.now(), vrai: e.isTrusted, el: brut(e.target) }), o);
  let dernierDefile = 0;
  addEventListener('scroll', (e) => { const n = Date.now(); if (n - dernierDefile < 400) return; dernierDefile = n; envoyer({ k: 'defile', t: n, vrai: e.isTrusted, y: scrollY }); }, o);
  document.addEventListener('visibilitychange', () => envoyer({ k: 'visible', t: Date.now(), vrai: true, etat: document.visibilityState }), o);
  // La page : à l'ouverture, puis à chaque changement d'adresse sans rechargement (la messagerie de Vinted en fait).
  let adr = location.href; envoyer({ k: 'page', t: Date.now(), vrai: true, url: adr, quoi: 'ouverte' });
  setInterval(() => { if (location.href !== adr) { adr = location.href; envoyer({ k: 'page', t: Date.now(), vrai: true, url: adr, quoi: 'changee' }); } }, 300);
})();
