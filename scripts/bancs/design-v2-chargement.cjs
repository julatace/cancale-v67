require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  LE CHARGEMENT DU NOUVEAU DESIGN NE BOUGE PAS (17 nov., Julien sur Ma journée : « quand ça charge tout bouge
//  bizarrement » — des blocs qui arrivent puis s'en vont, des faits qui changent d'ordre, le format des nombres
//  qui change, des squelettes remplacés par une autre mise en page).
//  Pour Aujourd'hui, Annonces et Achats, allumés, au téléphone, clair et sombre :
//    L1  CLS de tout le chargement (PerformanceObserver `layout-shift`, `buffered`) ≤ 0,02 — à froid (premier
//        chargement du contexte) ET au chaud (rechargé : cache HTTP, données locales) ;
//    L2  rien n'apparaît puis ne s'en va : chaque bloc vu (`[data-v2-bloc]`) est encore là à la fin ;
//    L3  rien ne change d'ordre : l'ordre des blocs à la première vue de chacun = l'ordre final ;
//    L4  un seul format de nombre : aucun nombre de 4 chiffres ou plus sans l'espace fine de fr-FR dans l'écran.
//  Les lectures de la base arrivent LENTEMENT et dans le désordre (300 à 1 800 ms, selon la requête) : c'est la
//  forme d'un vrai téléphone ; servies d'un coup, aucun saut ne se verrait.
//  MUTATION=reserve : retire la hauteur réservée du chiffre d'affiche ⇒ L1 doit passer au rouge.
// ════════════════════════════════════════════════════════════════════════════
const path = require('path'), fs = require('fs');
const P = require('./design-passe.cjs');
const { ouvrir, base, srv, PORT, chromium } = P;
const SHOTS = process.env.SHOTS || path.join(require('os').tmpdir(), 'banc-design-v2-chargement');
fs.mkdirSync(SHOTS, { recursive: true });
let ok = 0, ko = 0;
const verifier = (c, m) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m); } };
const SEUIL = 0.02;

function baseV2() {
  const b = base();
  const q = require('./_base-volume.cjs').fabriquer({ comptes: 3, qr: true });
  b.rows.push(...q.rows.filter((r) => /^email_track_chronopost_/.test(r.id)));
  // Deux achats ANNULÉS (inventés) : ils ne doivent paraître que dans « Annulés · N ».
  const ach = [...(b.main || []), ...b.rows].find((r) => /_orders_purchased$/.test(r.id) && r.data && r.data.payload && Array.isArray(r.data.payload.my_orders));
  if (ach) { const L = ach.data.payload.my_orders; const t0 = 990000000;
    for (let k = 0; k < 2; k++) L.unshift({ transaction_id: t0 + k, conversation_id: t0 + k, title: 'Achat annulé ' + (k + 1), price: { amount: '30.0', currency_code: 'EUR' }, status: 'Commande annulée', status_title: 'Commande annulée', date: new Date(Date.now() - (k + 1) * 3600e3).toISOString() });
    if (ach.data.nItems != null) ach.data.nItems = L.length; }
  return b;
}

// Posé AVANT tout script de la page : le CLS, et un relevé des blocs toutes les 50 ms.
function sonde(mutation) {
  try { localStorage.setItem('vrm_design_v2', '1'); } catch (_) {}
  window.__cls = 0; window.__sauts = [];
  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) { if (e.hadRecentInput) continue; window.__cls += e.value;
      window.__sauts.push({ v: +e.value.toFixed(4), t: Math.round(e.startTime), q: (e.sources || []).slice(0, 3).map((s) => { const n = s.node; const dy = Math.round(s.currentRect.y - s.previousRect.y); return n && n.nodeType === 1 ? (n.tagName + '.' + String(n.className || '').split(' ').slice(0, 2).join('.') + (n.getAttribute('data-v2-bloc') ? '[' + n.getAttribute('data-v2-bloc') + ']' : '') + ' Δy' + dy) : (n ? '#text' : '?'); }) }); } })
      .observe({ type: 'layout-shift', buffered: true });
  } catch (_) {}
  // Pour dire QUI pousse : les éléments posés (visibles, ≥ 8 px de haut) pendant le chargement, avec l'heure et la place.
  window.__ajouts = [];
  try { new MutationObserver((ms) => { const t = Math.round(performance.now()); for (const m of ms) for (const n of m.addedNodes) { if (n.nodeType !== 1 || window.__ajouts.length > 400) continue;
    requestAnimationFrame(() => { if (!n.isConnected || !n.getClientRects().length) return; const q = n.getBoundingClientRect(); if (q.height < 8 || q.top > innerHeight) return;
      window.__ajouts.push({ t, y: Math.round(q.top), h: Math.round(q.height), c: n.tagName + '.' + String(n.className || '').split(' ').slice(0, 2).join('.') }); }); } })
    .observe(document.documentElement, { childList: true, subtree: true }); } catch (_) {}
  window.__vus = []; // ordre de première apparition
  window.__releve = setInterval(() => {
    for (const e of document.querySelectorAll('[data-v2-bloc]')) { const k = e.getAttribute('data-v2-bloc'); if (e.getClientRects().length && !window.__vus.includes(k)) window.__vus.push(k); }
  }, 50);
  if (mutation === 'reserve') { const st = document.createElement('style'); st.textContent = '.v2-affiche-reserve, .v2-bloc-reserve { min-height: 0 !important; }'; document.addEventListener('DOMContentLoaded', () => document.head.appendChild(st)); }
}

async function mesure(pg) {
  await pg.waitForTimeout(15000); // toutes les lectures lentes sont arrivées (plusieurs pages en série), et les effets qui suivent
  return pg.evaluate(() => {
    clearInterval(window.__releve);
    const fin = [...document.querySelectorAll('[data-v2-bloc]')].filter((e) => e.getClientRects().length).map((e) => e.getAttribute('data-v2-bloc'));
    const racine = document.querySelector('.vrm-main') || document.body;
    // Un montant ou un compte de 4 chiffres et plus écrit sans l'espace de fr-FR (« 2943 € », « 1002 annonces ») ; les
    // codes de retrait, n° de suivi et années ne sont pas des nombres à formater.
    const nus = (racine.innerText.match(/(^|[^\d\u202f\u00a0 ])\d{4,}(?=\s?(€|annonces?|ventes?|paires?|colis))/g) || []).map((s) => s.trim()).slice(0, 5);
    // L'AIR (brief « AIR », 17 nov.) : relevé sur l'écran chargé.
    const vis = (e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden';
    const air = { pad: [], rangees: [], boutons: [], sections: [] };
    // (a) marge intérieure : tout texte d'une carte (listes, passes, carte d'erreur) à ≥ 20 px de son bord gauche/droit.
    for (const carte of [...document.querySelectorAll('.v2-liste, .v2-liste-annonces, .v2-passe, .v2-passe-mini, .v2-erreur, .vrm-achats .vrm-buy-list')].filter(vis)) {
      const c = carte.getBoundingClientRect();
      const tw = document.createTreeWalker(carte, NodeFilter.SHOW_TEXT); let t;
      while ((t = tw.nextNode())) { if (!t.textContent.trim()) continue; const el = t.parentElement; if (!el || !vis(el) || el.closest('.v2-etiquette, .v2-ann-groupe, [aria-hidden="true"]')) continue;
        const r = document.createRange(); r.selectNodeContents(t); const q = r.getBoundingClientRect(); if (!q.width || q.bottom < 0 || q.top > innerHeight) continue;
        const g = Math.round(q.left - c.left), d = Math.round(c.right - q.right); if (g < 20 || d < 20) { air.pad.push(carte.className.split(' ')[0] + ' « ' + t.textContent.trim().slice(0, 20) + ' » ' + g + '/' + d); break; } }
    }
    // (b) rangées de liste ≥ 64.
    for (const r of [...document.querySelectorAll('.v2l, .v2-ligne, .v2-afaire-ligne, .vrm-achats .vrm-buy-row')].filter(vis).slice(0, 40)) { const h = Math.round(r.getBoundingClientRect().height); if (h < 64) air.rangees.push(r.className.split(' ')[0] + ' ' + h); }
    // (c) deux boutons voisins (même ligne, se chevauchant en hauteur) : ≥ 12 entre eux.
    //     (19 nov., Aujourd’hui refait) Les vignettes de la bande et les sept barres de la semaine sont UNE suite (comme un
    //     contrôle segmenté) : 8 et 4 px entre elles, chacune garde sa cible de 44.
    const bs = [...document.querySelectorAll('.vrm-main button, .vrm-main a[href]')].filter(vis).map((b) => ({ b, q: b.getBoundingClientRect() })).filter((x) => x.q.width && x.q.top < innerHeight && x.q.bottom > 0 && !x.b.closest('.v2-seg, .v2l, .v2-ligne, .v2-bande, .v2-afaire-ligne, nav, [data-v2-bande], [data-v2-semaine]'));
    for (const a of bs) for (const b of bs) { if (a === b || a.b.contains(b.b) || b.b.contains(a.b)) continue; const ch = Math.min(a.q.bottom, b.q.bottom) - Math.max(a.q.top, b.q.top); if (ch < 8) continue;
      const e = Math.round(b.q.left - a.q.right); if (e >= 0 && e < 12) air.boutons.push('« ' + a.b.textContent.trim().slice(0, 14) + ' » ↔ « ' + b.b.textContent.trim().slice(0, 14) + ' » ' + e); }
    // (d) entre deux blocs repérés (sections) qui se suivent : ≥ 32 (le squelette et la liste sont un même bloc).
    // La liste d'Achats (capture de Julien du 17 nov.) : reçu en icône, « ⋯ » discret, compte entier, une forme, annulés cachés.
    const rangs = [...document.querySelectorAll('.vrm-achats .vrm-buy-row')].filter(vis);
    const achats = rangs.length ? {
      n: rangs.length,
      recuTexte: rangs.filter((r) => { const c = r.querySelector('.vrm-buy-chip'); return c && c.getBoundingClientRect().width > 48; }).length,
      grosPlus: rangs.filter((r) => { const b = r.querySelector('.vrm-buy-more'); if (!b) return false; const st = getComputedStyle(b); return b.getBoundingClientRect().width > 36 || (st.backgroundColor !== 'rgba(0, 0, 0, 0)' && st.backgroundColor !== 'transparent'); }).length,
      coupes: rangs.map((r) => r.querySelector('.vrm-buy-meta .vrm-acct-tag')).filter((t) => t && t.scrollWidth > t.clientWidth + 1).map((t) => t.textContent.trim().slice(0, 12)),
      hauteurs: [...new Set(rangs.slice(0, 30).map((r) => Math.round(r.getBoundingClientRect().height)))],
      annules: rangs.filter((r) => r.querySelector('[data-achat-etat="annule"]')).length,
      filtre: !!document.querySelector('[data-achats-onglet="annules"]'),
      filtreActif: !!document.querySelector('[data-achats-onglet="annules"][aria-pressed="true"]'),
    } : null;
    const blocs = [...document.querySelectorAll('[data-v2-bloc]')].filter(vis).map((e) => ({ k: e.getAttribute('data-v2-bloc'), q: e.getBoundingClientRect() })).sort((a, b) => a.q.top - b.q.top);
    for (let k = 1; k < blocs.length; k++) { const e = Math.round(blocs[k].q.top - blocs[k - 1].q.bottom); if (e >= 0 && e < 32 && !/segment/.test(blocs[k - 1].k)) air.sections.push(blocs[k - 1].k + ' → ' + blocs[k].k + ' ' + e); }
    const avant = (t) => window.__ajouts.filter((a) => a.t <= t + 20 && a.t >= t - 1500);
    return { ajouts: window.__sauts.slice(0, 3).map((x) => avant(x.t).slice(-6)), cls: +window.__cls.toFixed(4), sauts: window.__sauts.slice(0, 8), vus: window.__vus, fin, nus, air, achats };
  });
}

async function un(nav, b, tab, sombre, mutation) { // eslint-disable-line
  // Ouvert sur une page fixe (aucun script de l'app), PUIS la sonde et les lectures lentes, PUIS l'écran : à froid.
  const { ctx, pg } = await ouvrir(nav, { W: 390, sombre, b, url: '/manifest.webmanifest' });
  await pg.addInitScript(sonde, mutation || '');
  let n = 0;
  await pg.route('**/rest/v1/**', async (r) => { n++; const u = r.request().url(); let h = 0; for (const c of u) h = (h * 31 + c.charCodeAt(0)) >>> 0; await new Promise((ok) => setTimeout(ok, 300 + (h % 1500))); return r.fallback(); });
  const res = {};
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  res.froid = await mesure(pg);
  await pg.screenshot({ path: path.join(SHOTS, `${tab}-${sombre ? 'sombre' : 'clair'}-froid.png`) });
  await pg.reload({ waitUntil: 'domcontentloaded' });
  res.chaud = await mesure(pg);
  await pg.screenshot({ path: path.join(SHOTS, `${tab}-${sombre ? 'sombre' : 'clair'}-chaud.png`) });
  await ctx.close();
  return res;
}

(async () => {
  await new Promise((r) => srv.listen(PORT, r));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  const b = baseV2();
  const mutation = process.env.MUTATION || '';
  try {
    for (const sombre of mutation ? [false] : [false, true]) for (const tab of ['journee', 'annonces', 'achats']) {
      const r = await un(nav, b, tab, sombre, mutation);
      console.log(`\n${tab} · ${sombre ? 'sombre' : 'clair'}`);
      for (const k of ['froid', 'chaud']) {
        const m = r[k];
        verifier(m.cls <= SEUIL, `L1 ${k} : CLS ${m.cls} ≤ ${SEUIL}` + (m.cls > SEUIL ? ' — ' + JSON.stringify(m.sauts) + '\n      posés juste avant : ' + JSON.stringify(m.ajouts) : ''));
        const partis = m.vus.filter((x) => !m.fin.includes(x));
        verifier(!partis.length, `L2 ${k} : aucun bloc apparu puis parti` + (partis.length ? ' — ' + partis.join(', ') : ''));
        const ordreVu = m.vus.filter((x) => m.fin.includes(x)); const ordreFin = m.fin.filter((x) => ordreVu.includes(x));
        verifier(JSON.stringify(ordreVu) === JSON.stringify(ordreFin), `L3 ${k} : ordre des blocs stable (${ordreFin.join(' › ') || 'aucun bloc'})` + (JSON.stringify(ordreVu) !== JSON.stringify(ordreFin) ? ' — vu ' + ordreVu.join(' › ') : ''));
        verifier(!m.nus.length, `L4 ${k} : nombres au format fr-FR` + (m.nus.length ? ' — ' + m.nus.join(', ') : ''));
        verifier(m.fin.length > 0, `L0 ${k} : l'écran porte ses blocs repérés (${m.fin.length})`);
        if (k === 'chaud' && tab === 'achats') { const A = m.achats;
          verifier(!!A, `ACHATS la liste est rendue (${A ? A.n : 0} rangées)`);
          if (A) {
            verifier(A.recuTexte === 0, `ACHATS le reçu est une petite icône, jamais la pilule « Reçu d'achat » (${A.recuTexte} rangées)`);
            verifier(A.grosPlus === 0, `ACHATS « ⋯ » discret (icône ≤ 36 px, sans fond) (${A.grosPlus} rangées)`);
            verifier(!A.coupes.length, `ACHATS le compte jamais coupé` + (A.coupes.length ? ' — ' + A.coupes.join(', ') : ''));
            verifier(A.hauteurs.length <= 3, `ACHATS une forme de rangée (hauteurs : ${A.hauteurs.join(', ')})`);
            verifier(A.filtreActif || A.annules === 0, `ACHATS les annulés cachés par défaut (${A.annules} visibles)` + (A.filtre ? ' · filtre « Annulés » présent' : ''));
          } }
        if (k === 'chaud') for (const [cle, lib] of [['pad', 'marge intérieure des cartes ≥ 20 px'], ['rangees', 'rangées de liste ≥ 64 px'], ['boutons', 'boutons voisins ≥ 12 px'], ['sections', 'sections ≥ 32 px']])
          verifier(!m.air[cle].length, `AIR ${lib}` + (m.air[cle].length ? ' — ' + m.air[cle].slice(0, 4).join(' · ') : ''));
      }
    }
  } catch (e) { ko++; console.log('  ❌ le banc s’est arrêté : ' + String(e && e.stack || e).slice(0, 1500)); }
  await nav.close(); srv.close();
  console.log(`\n${ko ? '❌' : '✅'} design-v2-chargement : ${ok} verts, ${ko} rouges — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
