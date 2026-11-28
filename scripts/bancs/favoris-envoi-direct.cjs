// ════════════════════════════════════════════════════════════════════════
//  BANC « ENVOYER AUX FAVORIS, DIRECTEMENT » (28 nov., ext. 5.455.8)
//  Julien : « un envoi ne peut pas échouer […] tu ouvres la conversation, tu fais une offre et un message ». Le VRAI panneau
//  (vrm-badge.js + vrm-ui.js) branché sur le VRAI background.js et la VRAIE route du serveur (scripts/_favoris-monde-reel.cjs),
//  à 1512 px et 390 px (tactile), clair et sombre : la liste, le récapitulatif « Envoyer », après l'envoi des deux favoris
//  (« Message envoyé · Offre faite 49,50 € »), et un refus de Vinted sur une rangée (la liste reste). Captures dans
//  captures/favoris-envoi-direct/ — à REGARDER (§6.2). On juge aussi : rien ne déborde, cibles ≥ 44 px dans la feuille.
//  `BANC_RACINE=<arbre d'avant>` : rouge attendu.
// ════════════════════════════════════════════════════════════════════════
require('./_porte-banc.cjs');
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright');
const RACINE = process.env.BANC_RACINE ? path.resolve(process.env.BANC_RACINE) : path.join(__dirname, '..', '..');
const { monde, ouvrirPanneau } = require('../_favoris-monde-reel.cjs');
const SORTIE = process.env.BANC_CAPTURES ? path.join(process.env.BANC_CAPTURES, 'favoris-envoi-direct') : path.join(__dirname, 'captures', 'favoris-envoi-direct');
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d ? '  → ' + String(d).slice(0, 400) : '')); } };
(async () => {
  fs.mkdirSync(SORTIE, { recursive: true });
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  const TAILLES = [{ T: '1512-clair', largeur: 1512, scheme: 'light' }, { T: '1512-sombre', largeur: 1512, scheme: 'dark' }, { T: '390-clair', largeur: 390, hauteur: 844, mobile: true, scheme: 'light' }, { T: '390-sombre', largeur: 390, hauteur: 844, mobile: true, scheme: 'dark' }];
  const cap = (P, nom) => P.pg.screenshot({ path: path.join(SORTIE, nom + '.png') }).catch(() => {});
  const mesures = (P) => P.R(() => { const r = document.getElementById('vrm-badge').shadowRoot; const f = r.querySelector('.fav6-feuille');
    const vis = (el) => !!(el && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
    const petits = f ? Array.from(f.querySelectorAll('button')).filter(vis).filter((b) => b.getBoundingClientRect().height < 43.5).map((b) => (b.innerText || b.getAttribute('aria-label') || '').slice(0, 24) + ':' + Math.round(b.getBoundingClientRect().height)) : [];
    return { debord: document.documentElement.scrollWidth > window.innerWidth + 1, petits }; });
  for (const o of TAILLES) {
    console.log('\n' + o.T);
    try {
      const m = await monde(RACINE, { n: 2, dressingAncien: true });
      const P = await ouvrirPanneau(nav, m, RACINE, o);
      await P.ouvrirFavoris();
      let l = await P.lire();
      dit(l.tableau && l.rangs.jn0 && l.rangs.jn0.un && l.rangs.jn1 && l.rangs.jn1.un, `${o.T} : la liste, « Envoyer » sur chaque favori`, JSON.stringify(Object.keys(l.rangs)));
      await cap(P, o.T + '-1-liste');
      for (const id of ['jn0', 'jn1']) await P.clic(`.fav6-table li[data-fav-qui="${id}"] input[data-fav-coche]`);
      await P.clic('[data-fav-envoyer]'); await P.pg.waitForTimeout(700);
      l = await P.lire(); const me = await mesures(P);
      dit(l.etape === '4' && l.lancer, `${o.T} : « Envoyer » ⇒ directement le récapitulatif et « Lancer »`, l.etape);
      dit(!me.debord && !me.petits.length, `${o.T} : rien ne déborde, cibles ≥ 44 px`, JSON.stringify(me));
      await cap(P, o.T + '-2-envoyer');
      await P.clic('.fav6-feuille [data-fav-lancer]'); await P.pg.waitForTimeout(600);
      await m.tours(8, () => P.pg.waitForTimeout(200)); await P.pg.waitForTimeout(900);
      l = await P.lire();
      dit(['jn0', 'jn1'].every((id) => l.rangs[id] && /Message envoyé/.test(l.rangs[id].texte) && /Offre faite 49,50 €/.test(l.rangs[id].texte)) && !l.vuLecture.length, `${o.T} : après l’envoi, « Message envoyé · Offre faite 49,50 € » sur les deux rangées`, JSON.stringify(Object.values(l.rangs).map((x) => x.texte.slice(0, 120))));
      await cap(P, o.T + '-3-apres');
      await P.ctx.close(); m.fin();
      // Un refus de Vinted sur la 1re rangée : la liste reste, le refus est sur SA rangée.
      const m2 = await monde(RACINE, { n: 2, vinted: (e) => (e.methode === 'POST' && e.chemin === '/api/v2/transactions/6000/offers' ? { status: 400, body: { code: 106 } } : null) });
      const P2 = await ouvrirPanneau(nav, m2, RACINE, o);
      await P2.ouvrirFavoris();
      for (const id of ['jn0', 'jn1']) await P2.clic(`.fav6-table li[data-fav-qui="${id}"] input[data-fav-coche]`);
      await P2.clic('[data-fav-envoyer]'); await P2.pg.waitForTimeout(500); await P2.clic('.fav6-feuille [data-fav-lancer]'); await P2.pg.waitForTimeout(500);
      await m2.tours(8, () => P2.pg.waitForTimeout(200)); await P2.pg.waitForTimeout(900);
      l = await P2.lire();
      dit(l.tableau && /Refusé par Vinted/.test((l.rangs.jn0 || {}).texte || '') && /Message envoyé/.test((l.rangs.jn1 || {}).texte || ''), `${o.T} : un refus de Vinted sur SA rangée, l’autre envoyée, la liste reste`, JSON.stringify(Object.values(l.rangs).map((x) => x.texte.slice(0, 120))));
      await cap(P2, o.T + '-4-refus');
      dit(!P.erreurs.length && !P2.erreurs.length, `${o.T} : aucune erreur de page`, JSON.stringify(P.erreurs.concat(P2.erreurs)));
      await P2.ctx.close(); m2.fin();
      // L'AGENT (5.455.8) : l'interrupteur éteint, SON « Allumer », puis la ligne en direct et le journal après des envois seuls.
      const MIN = 60000;
      const m3 = await monde(RACINE, { n: 3, notifAt: (i, T0) => T0 - (20 - i) * MIN });
      const P3 = await ouvrirPanneau(nav, m3, RACINE, o);
      await P3.ouvrirFavoris();
      const agent = () => P3.R(() => { const r = document.getElementById('vrm-badge').shadowRoot; const a = r.querySelector('.ag6'); const sw = r.querySelector('[data-ag-switch]');
        return a ? { etat: a.getAttribute('data-fav-auto-etat'), sw: sw && sw.getAttribute('aria-checked'), h: sw ? Math.round(sw.getBoundingClientRect().height) : 0, texte: a.innerText.replace(/\s+/g, ' '), conf: !!r.querySelector('[data-ag-confirme]'), ligne: (r.querySelector('[data-ag-ligne]') || {}).textContent || '', journal: Number((r.querySelector('[data-ag-journal]') || { getAttribute: () => -1 }).getAttribute('data-ag-journal')) } : null; });
      let g = await agent();
      dit(g && g.etat === 'off' && g.sw === 'false' && /Envoyer automatiquement aux nouveaux favoris/.test(g.texte) && /il te plaît toujours/.test(g.texte) && /−10 %/.test(g.texte) && /prix mini/.test(g.texte) && g.h >= 44, `${o.T} : l’interrupteur de l’agent, éteint, dit le message, l’offre −10 % et le plancher`, JSON.stringify(g));
      await cap(P3, o.T + '-5-agent-eteint');
      await P3.clic('[data-ag-switch]'); g = await agent();
      dit(g && g.conf && g.sw === 'false', `${o.T} : toucher l’interrupteur ⇒ SON « Allumer » est demandé (rien n’est allumé avant)`, JSON.stringify(g));
      await cap(P3, o.T + '-6-agent-confirmer');
      await P3.clic('[data-ag-oui]'); await P3.pg.waitForTimeout(800);
      m3.h.t -= 0;   // les favoris sont arrivés APRÈS l'allumage ? non : allumé maintenant, ils sont d'avant ⇒ seuls les nouveaux partent.
      g = await agent();
      dit(g && g.etat === 'on' && g.sw === 'true' && /Agent favoris : actif · 0 envoyés aujourd’hui/.test(g.ligne), `${o.T} : allumé ⇒ « Agent favoris : actif · 0 envoyés aujourd’hui », Pause / Arrêter`, JSON.stringify(g));
      await cap(P3, o.T + '-7-agent-actif');
      await P3.ctx.close(); m3.fin();
      // Allumé AVANT 3 nouveaux favoris : l'agent les envoie seul (le vrai pilote), puis le panneau montre la ligne et le journal.
      const m4 = await monde(RACINE, { n: 3, notifAt: (i, T0) => T0 - (20 - i) * MIN, avant: async ({ call, h }) => { const t = h.t; h.t = t - 30 * MIN; await call('auto_regler', { reglages: { actif: true, attenteMin: 10, attenteMax: 15, heureDebut: 0, heureFin: 24, jours: [1, 2, 3, 4, 5, 6, 7], parJour: 30, parHeure: 15 }, confirme: true }); h.t = t; } });
      for (let k = 0; k < 30; k++) { const st = m4.f.store.vrmPiloteFavoris || {}; if (Number(st.prochain) > m4.h.t) m4.h.t = Number(st.prochain) + 1; await m4.f.ctx.piloteFavorisTick(m4.h.t); if (m4.f.j.vinted.filter((v) => v.methode === 'POST' && /replies$/.test(v.chemin)).length >= 3) break; m4.h.t += 1000; }
      { const st = m4.f.store.vrmPiloteFavoris; st.prochain = new Date().getTime() + 42000; }   // l'heure de la PAGE (le panneau compte en vrai)
      const P4 = await ouvrirPanneau(nav, m4, RACINE, o);
      await P4.ouvrirFavoris();
      await P4.R(() => { const d = document.getElementById('vrm-badge').shadowRoot.querySelector('[data-ag-journal]'); if (d) d.open = true; });
      const g4 = await P4.R(() => { const r = document.getElementById('vrm-badge').shadowRoot; return { ligne: (r.querySelector('[data-ag-ligne]') || {}).textContent || '', j: Array.from(r.querySelectorAll('[data-ag-journal] li')).map((x) => x.textContent), pause: !!r.querySelector('[data-ag-pause]'), arreter: !!r.querySelector('[data-ag-arreter]') }; });
      dit(/Agent favoris : actif · 3 envoyés aujourd’hui · prochain dans \d+ s/.test(g4.ligne) && g4.j.length === 3 && g4.j.every((x) => /offre 49,50 €/.test(x) && /il te plaît toujours/.test(x)) && g4.pause && g4.arreter, `${o.T} : « Agent favoris : actif · 3 envoyés aujourd’hui · prochain dans 42 s », le journal (heure, personne, article, offre, message), Pause / Arrêter`, JSON.stringify(g4));
      await cap(P4, o.T + '-8-agent-journal');
      dit(!P3.erreurs.length && !P4.erreurs.length, `${o.T} : agent : aucune erreur de page`, JSON.stringify(P3.erreurs.concat(P4.erreurs)));
      await P4.ctx.close(); m4.fin();
    } catch (e) { ko++; console.log('  ❌ ' + o.T + ' a levé : ' + String(e && e.stack || e).slice(0, 400)); }
  }
  await nav.close();
  console.log(`\n${ko ? '❌' : '✅'} banc favoris-envoi-direct : ${ok} vert(s), ${ko} rouge(s) — captures : ${SORTIE}`);
  process.exit(ko ? 1 : 0);
})();
