// ════════════════════════════════════════════════════════════════════════════
//  PARAMÈTRES EN CATÉGORIES (15 nov.) — LE CHEMIN DES BANCS D'AVANT
//  Avant le 15 nov., toutes les rangées de Paramètres étaient sur un écran (trois
//  onglets) : ~70 bancs touchent `[data-sous-ouvrir="push"]` ou
//  `[data-onglets-reglages] [data-vue="compte"]` dès `?tab=settings`. Sur téléphone, une
//  rangée vit maintenant DANS sa catégorie (src/parametres/categories.js) : il faut d'abord
//  toucher la catégorie, comme le vendeur.
//
//  Ce module fait CE geste-là, et seulement lui : avant qu'un banc touche / attende / lise
//  une rangée de Paramètres (`data-sous-ouvrir="X"`, `data-vue="compte|abonnement"`) qui
//  n'est pas visible, il remonte (« ‹ » du panneau ouvert, « ‹ Paramètres ») puis touche la
//  catégorie qui la range (`[data-categorie-contient~="X"]`). Une rangée déjà visible, un
//  écran qui n'est pas Paramètres, un sélecteur qui ne nomme pas de rangée : rien.
//  Il ne fabrique rien et ne contourne rien : le banc fait ensuite SON geste sur la vraie
//  rangée rendue. Le banc `parametres-refonte.cjs` juge, lui, le chemin à la main (il
//  pose `BANC_REGLAGES_SANS_AIDE=1`).
//  Posé une fois par module playwright, comme la porte de banc (`_porte-banc.cjs`).
// ════════════════════════════════════════════════════════════════════════════
'use strict';

const RE_SOUS = /data-sous-ouvrir\s*=\s*["']?([a-z0-9-]+)/i;
const RE_VUE = /data-vue\s*=\s*["']?(compte|abonnement|reglages)\b/i;
const cible = (sel) => {
  if (typeof sel !== 'string') return null;
  const s = RE_SOUS.exec(sel); if (s) return s[1];
  const v = RE_VUE.exec(sel); if (v) return v[1] === 'compte' ? '@compte' : v[1] === 'abonnement' ? 'abonnement' : '@racine';
  // Le champ de recherche vit sur le premier écran.
  if (/Rechercher dans les param|data-recherche-reglages/.test(sel)) return '@racine';
  return null;
};

// Dans la page : UN pas vers la rangée (remonter, ou ouvrir la catégorie). Rend ce qu'il a fait.
function pasVersReglage(id) {
  const racine = document.querySelector('.vrm-set[data-parametres]');
  if (!racine) return 'hors';
  const vis = (e) => !!e && e.getClientRects().length > 0 && !e.closest('[hidden]');
  const retourPanneau = document.querySelector('[data-sous-retour]');
  const retourCat = document.querySelector('[data-categorie-retour]');
  if (id === '@racine') { if (vis(retourPanneau)) { retourPanneau.click(); return 'retour'; } if (vis(retourCat)) { retourCat.click(); return 'retour'; } return 'ici'; }
  if (id === '@compte') {
    if (racine.getAttribute('data-categorie-ouverte') === 'compte' && !racine.getAttribute('data-sous-ecran-ouvert')) return 'ici';
    const ligne = [...document.querySelectorAll('[data-categorie-ouvrir="compte"]')].find(vis);
    if (ligne) return 'ici';   // la rangée « Mon compte » est là : le banc la touche lui-même
    if (vis(retourPanneau)) { retourPanneau.click(); return 'retour'; }
    if (vis(retourCat)) { retourCat.click(); return 'retour'; }
    return 'rien';
  }
  const ligne = [...document.querySelectorAll(`[data-sous-ouvrir="${id}"]`)].find(vis);
  if (ligne) return 'ici';
  if (vis(retourPanneau)) { retourPanneau.click(); return 'retour'; }
  const cat = [...document.querySelectorAll(`[data-categorie-contient~="${id}"]`)].find(vis);
  if (cat) { cat.click(); return 'categorie'; }
  if (vis(retourCat)) { retourCat.click(); return 'retour'; }
  return 'rien';
}

async function versReglage(page, sel) {
  if (process.env.BANC_REGLAGES_SANS_AIDE === '1') return;
  const id = cible(sel); if (!id || !page || typeof page.evaluate !== 'function') return;
  // Paramètres pas encore rendu (la page charge) alors que l'adresse le demande : on l'attend, 20 s au plus
  // (un banc qui ATTEND une rangée — `waitForSelector` — l'attendait avant pour la même raison).
  let url = ''; try { url = page.url(); } catch (_) {}
  const attendre = /tab=settings/.test(url);
  for (let i = 0, hors = 0; i < 6; i++) {
    let r; try { r = await page.evaluate(pasVersReglage, id); } catch (_) { return; }
    if (r === 'hors' && attendre && hors < 40) { hors++; i--; try { await page.waitForTimeout(500); } catch (_) { return; } continue; }
    if (r !== 'retour' && r !== 'categorie') return;
    try { await page.waitForTimeout(250); } catch (_) { return; }
  }
}

// Les méthodes qui touchent, attendent ou lisent une rangée par son sélecteur.
const PAGE = ['click', 'tap', 'waitForSelector', '$', '$$', 'isVisible', 'hover', 'focus', 'getAttribute', 'textContent', 'innerText', 'dispatchEvent', 'fill', 'type', 'press', 'inputValue'];
const LOC = ['fill', 'type', 'press', 'pressSequentially', 'inputValue', 'click', 'tap', 'waitFor', 'isVisible', 'count', 'scrollIntoViewIfNeeded', 'getAttribute', 'textContent', 'innerText', 'boundingBox', 'hover', 'focus', 'evaluate', 'dispatchEvent', 'isHidden', 'all'];
const selDuLocator = (l) => { try { return String(l._selector || (l._impl && l._impl._selector) || ''); } catch (_) { return ''; } };
function poserSurPage(p) {
  if (!p) return;
  const proto = Object.getPrototypeOf(p);
  if (proto && !proto.__vrmReglagesCompat) {
    proto.__vrmReglagesCompat = true;
    for (const m of PAGE) {
      const f = proto[m]; if (typeof f !== 'function') continue;
      proto[m] = async function (sel, ...r) { await versReglage(this, sel); return f.call(this, sel, ...r); };
    }
  }
  let lp = null; try { lp = Object.getPrototypeOf(p.locator('body')); } catch (_) {}
  if (lp && !lp.__vrmReglagesCompat) {
    lp.__vrmReglagesCompat = true;
    for (const m of LOC) {
      const f = lp[m]; if (typeof f !== 'function') continue;
      lp[m] = async function (...r) { const s = selDuLocator(this); if (s) { let pg = null; try { pg = typeof this.page === 'function' ? this.page() : null; } catch (_) {} if (pg) await versReglage(pg, s); } return f.apply(this, r); };
    }
  }
}
function poser(pw) {
  for (const t of ['chromium', 'webkit', 'firefox']) {
    const b = pw && pw[t]; if (!b || b.__vrmReglagesCompat) continue;
    b.__vrmReglagesCompat = true;
    const surCtx = (ctx) => { try { const np = ctx.newPage.bind(ctx); ctx.newPage = async (...a) => { const p = await np(...a); poserSurPage(p); return p; }; ctx.on('page', poserSurPage); for (const p of ctx.pages()) poserSurPage(p); } catch (_) {} return ctx; };
    const l0 = b.launch.bind(b);
    b.launch = async (...a) => {
      const nav = await l0(...a);
      const nc = nav.newContext.bind(nav), np = nav.newPage.bind(nav);
      nav.newContext = async (...x) => surCtx(await nc(...x));
      nav.newPage = async (...x) => { const p = await np(...x); poserSurPage(p); return p; };
      return nav;
    };
    const lpc = b.launchPersistentContext && b.launchPersistentContext.bind(b);
    if (lpc) b.launchPersistentContext = async (...a) => surCtx(await lpc(...a));
  }
}
try { poser(require('playwright')); } catch (_) {}
try { poser(require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'))); } catch (_) {}
module.exports = { poserReglagesCompat: poser, cibleReglage: cible, pasVersReglage };
