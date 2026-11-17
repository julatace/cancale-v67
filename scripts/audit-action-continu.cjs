// ════════════════════════════════════════════════════════════════════════════
//  L'ÉCRAN « ACTION EN COURS » NE TOMBE JAMAIS PENDANT UNE ACTION (17 nov., ext. 5.407)
//
//  Julien (5.406, messages aux favoris pour de vrai) : « quand Vinted est bloqué ça fait des bugs
//  parfois, l'affichage qui bloque de l'extension disparaît 1 s » ; puis « le pavé tactile permet de
//  descendre dans Vinted quand même ».
//  A. le VRAI background.js (scripts/_fond-vm.cjs) : Vinted en pause (429/403) pendant une file des
//     favoris — l'attente ne change pas, rien n'était réécrit, l'état passait pour « éteint » au bout de
//     3 min ⇒ l'écran tombait. Le tour suivant de la file (alarme 30 s) doit garder l'état VIVANT ;
//     un service worker neuf (redémarré) répond la même chose.
//  B. le VRAI vrm-action.js + vrm-ui.js (et le voile de rechargement de content.js) dans Chromium, un
//     faux `chrome` à état : on échantillonne toutes les 50 ms pendant l'action et on exige que l'écran
//     soit VU (opacité ≥ 0,98) et que le pointeur au centre n'atteigne PAS Vinted, à travers : pas
//     successifs (compteur, article, attente), fond muet (worker endormi/réveil), une lecture « rien »
//     isolée, navigations SPA (pushState, document réécrit, hôte arraché), un message bref de Vinted
//     (toast 300 ms), un RECHARGEMENT complet ; molette (pavé tactile) et touches de défilement ne font
//     pas bouger la page ; une vérification (captcha) écarte l'écran EN LE DISANT (bandeau ≥ 3 s, page
//     cliquable et défilable), puis il revient ; à la fin, la page est rendue EXACTEMENT (overflow en
//     ligne d'avant, position).
//  §6.1 : `BANC_RACINE=<arbre 5.406>` ⇒ rouge. `--prouve` : chaque mutation ⇒ rouge.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const args = process.argv.slice(2);
const ICI = path.join(__dirname, '..');
const RACINE = process.env.BANC_RACINE ? path.resolve(process.env.BANC_RACINE) : ICI;
const EXT = path.join(RACINE, 'vinted-sync-extension');

const MUTATIONS = {
  battement: { f: 'background.js', a: 'if (tour === 0) await battreActionEnCours(st.uid);', b: '' },
  muet: { f: 'vrm-action.js', a: "if (err || !r || r.ok !== true) { relireLocal(); return; }", b: "if (err || !r || r.ok !== true) { appliquer(null, false); return; }" },
  rien: { f: 'vrm-action.js', a: "if (!nulA) { nulA = Date.now(); setTimeout(lire, 1600); return; }", b: '' },
  surplace: { f: 'vrm-action.js', a: "racine.classList.toggle('anim', neuf);", b: "racine.classList.toggle('anim', true);" },
  molette: { f: 'vrm-action.js', a: 'if (ev.cancelable) ev.preventDefault();\n      return;', b: 'return;' },
  verrou: { f: 'vrm-action.js', a: "try { if (h.style.getPropertyValue('overflow') !== 'hidden') h.style.setProperty('overflow', 'hidden', 'important'); } catch (_) {}", b: '' },
  toast: { f: 'vrm-action.js', a: 'return Date.now() - alerteDepuis >= 800 ?', b: 'return Date.now() - alerteDepuis >= 0 ?' },
  gel: { f: 'content.js', a: "if (g && Date.now() - g < 180000 && !document.getElementById('vrm-action-gel')) {", b: 'if (false) {' },
  hote: { f: 'vrm-action.js', a: 'if (!hote.isConnected) accrocher();', b: '' },
};
if (args.includes('--prouve')) {
  let rates = 0;
  for (const m of Object.keys(MUTATIONS)) {
    let rouge = false;
    try { execFileSync(process.execPath, [__filename, `--mutation=${m}`], { stdio: 'pipe', timeout: 600000 }); } catch (e) { rouge = e.status === 1; }
    console.log(`${rouge ? '✅' : '❌'} mutation ${m} ⇒ ${rouge ? 'rouge' : 'RESTE VERT'}`);
    if (!rouge) rates++;
  }
  console.log(rates ? `\n❌ ${rates} mutation(s) non détectée(s)` : `\n✅ ${Object.keys(MUTATIONS).length}/${Object.keys(MUTATIONS).length} mutations détectées`);
  process.exit(rates ? 1 : 0);
}
const mut = (args.find((a) => a.startsWith('--mutation=')) || '').slice(11);
const src = {};
for (const f of ['background.js', 'vrm-action.js', 'vrm-ui.js', 'content.js']) src[f] = fs.existsSync(path.join(EXT, f)) ? fs.readFileSync(path.join(EXT, f), 'utf8') : '';
if (mut) {
  const M = MUTATIONS[mut];
  if (!src[M.f].includes(M.a)) { console.log('mutation introuvable : ' + mut); process.exit(2); }
  src[M.f] = src[M.f].split(M.a).join(M.b);
}
let ko = 0, ok = 0;
const dit = (bon, quoi, detail) => { if (bon) { ok++; console.log(`  ✅ ${quoi}`); } else { ko++; console.log(`  ❌ ${quoi}${detail ? ' — ' + String(detail).slice(0, 500) : ''}`); } };
const UID = '424242', MIN = 60000;

(async () => {
  // ── A : le vrai fond, Vinted en pause ─────────────────────────────────────────
  console.log('\nA. Vinted en pause pendant une file des favoris : l’état reste vivant');
  {
    const { faireFond } = require('./_fond-vm.cjs');
    const bg = path.join(os.tmpdir(), `bg-action-continu-${process.pid}.js`);
    fs.writeFileSync(bg, src['background.js']);
    const t = Date.now();
    const store = { vrmFavorisCarte: { v: 1, uid: UID, dom: 'www.vinted.fr', actif: true, debut: t - 10 * MIN, total: 15, file: { total: 15, envoyes: 3 }, attente: null, prochain: null, fin: null, items: [] },
      vrmPauseVinted: { jusqua: t + 20 * MIN, niveau: 1, statut: 429, depuis: t - MIN } };
    const vrm = async () => ({ status: 200, body: { ok: true, uid: UID, vue: { active: true, jobs: [] }, carte: { total: 15, envoyes: 3, active: true }, serveur: Date.now() } });
    const f = faireFond({ src: bg, connecte: UID, store, vrm, vinted: () => ({ status: 500, body: {} }) });
    await f.ctx.tickFavorisCarte();
    const a1 = f.store.vrmActionEnCours || {};
    dit(a1.actif === true && (f.store.vrmFavorisCarte || {}).attente === 'pause', 'la file attend la fin de la pause, l’écran est posé', JSON.stringify({ actif: a1.actif, att: (f.store.vrmFavorisCarte || {}).attente }));
    // Le temps passe : 4 min sans changement (la pause dure) ; l'alarme relance le tour.
    f.store.vrmActionEnCours.maj = Date.now() - 4 * MIN;
    await f.ctx.tickFavorisCarte();
    const sender = { tab: { id: 7, url: 'https://www.vinted.fr/catalog' } };
    const e1 = await f.envoyer({ from: 'vrm-action', action: 'etat' }, sender);
    console.log(`     mesuré : après 4 min de pause, l’écran lit actif=${e1 && e1.action && e1.action.actif}`);
    dit(!!(e1 && e1.action && e1.action.actif === true), 'après 4 min de pause, l’écran lit toujours « actif » (avant : éteint ⇒ l’écran tombait)', JSON.stringify(e1).slice(0, 200));
    // Un service worker neuf (Chrome l'a tué) : même stockage, même réponse.
    const f2 = faireFond({ src: bg, connecte: UID, store: JSON.parse(JSON.stringify(f.store)), vrm, vinted: () => ({ status: 500, body: {} }) });
    const e2 = await f2.envoyer({ from: 'vrm-action', action: 'etat' }, sender);
    dit(!!(e2 && e2.action && e2.action.actif === true), 'un service worker redémarré répond « actif » (l’état vit dans chrome.storage.local)', JSON.stringify(e2).slice(0, 160));
    try { fs.unlinkSync(bg); } catch (_) {}
  }
  // ── B : l'écran dans Chromium ─────────────────────────────────────────────────
  console.log('\nB. L’écran plein, échantillonné toutes les 50 ms');
  require('./bancs/_porte-banc.cjs');
  const { chromium } = require('playwright');
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    const ctx = await nav.newContext({ viewport: { width: 1280, height: 800 } });
    const pg = await ctx.newPage();
    const erreurs = []; pg.on('pageerror', (e) => erreurs.push(String(e).slice(0, 200)));
    const PAGE = `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;overflow:visible;font:15px system-ui">${Array.from({ length: 80 }, (_, i) => `<p style="height:60px;margin:0;padding:8px;border-bottom:1px solid #ccc"><a href="#x${i}" class="lien-page">Article inventé ${i + 1}</a> <button class="bouton-page">Acheter</button></p>`).join('')}</body></html>`;
    await pg.route('**/*', (r) => r.fulfill({ status: 200, contentType: /\.(webp|png|svg)/.test(r.request().url()) ? 'image/svg+xml' : 'text/html', body: /\.(webp|png|svg)/.test(r.request().url()) ? '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"/>' : PAGE }));
    // Le voile de rechargement : le VRAI bloc de content.js (rien d'autre de content.js ne tourne ici).
    const cs = src['content.js'];
    const i0 = cs.indexOf("  // 5.407 (Julien : « l'affichage"), i1 = cs.indexOf("  const TAG = 'CANCALE_VINTED';");
    const gelJs = i0 > 0 && i1 > i0 ? cs.slice(i0, i1) : '';
    // À chaque chargement (rechargement compris) : faux chrome à état (dans localStorage du banc, il
    // survit au rechargement), échantillonneur dès document_start, voile de content.js, puis vrm-ui.js et
    // vrm-action.js « à document_idle » (DOMContentLoaded + 300 ms).
    await pg.addInitScript(({ ui, act, gelJs }) => {
      const o = Element.prototype.attachShadow; Element.prototype.attachShadow = function (x) { const r = o.call(this, Object.assign({}, x, { mode: 'open' })); return r; };
      const lireS = () => { try { return JSON.parse(localStorage.getItem('__store') || '{}'); } catch (_) { return {}; } };
      const ecoutes = [];
      window.__mode = () => localStorage.getItem('__mode') || 'ok';
      window.__poser = (a) => { const s = lireS(); s.vrmActionEnCours = a; localStorage.setItem('__store', JSON.stringify(s)); for (const f of ecoutes) try { f({ vrmActionEnCours: { newValue: a } }, 'local'); } catch (_) {} };
      window.chrome = { runtime: { id: 'ext', lastError: null, sendMessage: (msg, cb) => {
        const m = window.__mode();
        setTimeout(() => {
          if (msg.action === 'etat') {
            if (m === 'muet') { chrome.runtime.lastError = { message: 'Could not establish connection. Receiving end does not exist.' }; try { cb && cb(undefined); } finally { chrome.runtime.lastError = null; } return; }
            if (m === 'rien') { localStorage.setItem('__mode', 'ok'); cb && cb({ ok: true, action: null }); return; }
            const a = lireS().vrmActionEnCours || null; cb && cb({ ok: true, action: a && Object.assign({}, a, { actif: a.actif === true && Date.now() - Number(a.maj || 0) < 180000 }) });
          } else if (msg.action === 'arreter') { cb && cb({ ok: true }); } else cb && cb({ ok: false });
        }, m === 'muet' ? 30 : 5);
      } }, i18n: { getUILanguage: () => 'fr' },
      storage: { local: { get: (k, cb) => { const s = lireS(); setTimeout(() => cb && cb(s), 0); return Promise.resolve(s); }, set: (x, cb) => { const s = Object.assign(lireS(), x); localStorage.setItem('__store', JSON.stringify(s)); cb && setTimeout(cb, 0); return Promise.resolve(); } }, onChanged: { addListener: (f) => ecoutes.push(f) } } };
      // L'échantillonneur : toutes les 50 ms, l'écran vu ? le centre bloqué ? (dès document_start)
      window.__ech = [];
      const ech = () => {
        const h = document.getElementById('vrm-action'), r = h && h.shadowRoot;
        const v = r && r.querySelector('.voile[data-action-plein]');
        const gel = !!document.getElementById('vrm-action-gel');
        let op = 0; if (v) { op = Number(getComputedStyle(v).opacity); const b = v.querySelector('.boite'); if (b) op = Math.min(op, Number(getComputedStyle(b).opacity)); }
        const vu = gel || (!!h && getComputedStyle(h).display !== 'none' && !!v && op >= 0.98);
        let x = null; try { x = document.elementFromPoint(innerWidth / 2, innerHeight / 2); } catch (_) {}
        const bloque = !!x && (x === h || x === document.documentElement) ;
        const cote = !!(r && r.querySelector('[data-action-cote]'));
        window.__ech.push({ t: Date.now(), vu, bloque, cote, op: Math.round(op * 100) / 100 });
        try { const L = JSON.parse(sessionStorage.getItem('__ech_tous') || '[]'); L.push({ t: Date.now(), vu, bloque, cote, g: gel, d: (document.readyState[0]) + (h ? 'h' : '') + (x ? x.tagName[0] : '0') }); sessionStorage.setItem('__ech_tous', JSON.stringify(L.slice(-4000))); } catch (_) {}
      };
      setInterval(ech, 50);
      try { (0, eval)(gelJs); } catch (_) {}
      const charger = () => setTimeout(() => { for (const js of [ui, act]) { const s = document.createElement('script'); s.textContent = js; document.documentElement.appendChild(s); } }, 300);
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', charger); else charger();
    }, { ui: src['vrm-ui.js'], act: src['vrm-action.js'], gelJs });
    // Avant l'action : une page à l'état connu (défilée à 400 px, overflow en ligne « visible » sur body).
    await pg.goto('https://www.vinted.fr/catalog');
    await pg.evaluate(() => { localStorage.setItem('__store', '{}'); localStorage.setItem('__mode', 'ok'); sessionStorage.removeItem('__ech_tous'); });
    await pg.waitForTimeout(500);
    await pg.evaluate(() => window.scrollTo(0, 400));
    const T0 = Date.now();
    const etat = (o) => Object.assign({ v: 1, actif: true, sorte: 'favoris', uid: '424242', debut: T0, fait: 0, total: 5, enCours: false, prochain: Date.now() + 5 * MIN, quoi: 'rythme', attente: '', item: { id: '9001', photo: '', titre: 'Baskets cuir blanc 42' }, suivants: [], maj: Date.now() }, o || {});
    await pg.evaluate((a) => window.__poser(a), etat());
    await pg.waitForTimeout(800);   // l'entrée calme (une fois)
    const debut = await pg.evaluate(() => Date.now());
    const y0 = await pg.evaluate(() => window.scrollY);
    // 1) cinq pas : compteur, article, en cours / attente
    for (let k = 1; k <= 5; k++) {
      await pg.evaluate((a) => window.__poser(a), etat({ fait: k - 1, enCours: k % 2 === 1, prochain: k % 2 ? null : Date.now() + (8 + k) * 1000, quoi: k % 2 ? '' : 'rythme', item: { id: String(9000 + k), photo: '', titre: 'Article ' + k } }));
      await pg.waitForTimeout(350);
    }
    // 2) le fond muet 1,5 s (service worker endormi / en réveil), avec des écritures pendant
    await pg.evaluate(() => localStorage.setItem('__mode', 'muet'));
    for (let k = 0; k < 3; k++) { await pg.evaluate((a) => window.__poser(a), etat({ fait: 2, attente: 'pause', item: { id: '9003', photo: '', titre: 'Article 3' } })); await pg.waitForTimeout(500); }
    await pg.evaluate(() => localStorage.setItem('__mode', 'ok'));
    // 3) une lecture « rien » isolée (compte relu un instant), puis l'état revient
    await pg.evaluate(() => localStorage.setItem('__mode', 'rien'));
    await pg.evaluate((a) => window.__poser(a), etat({ fait: 3 }));
    await pg.waitForTimeout(900);
    await pg.evaluate((a) => window.__poser(a), etat({ fait: 3, enCours: true }));
    await pg.waitForTimeout(500);
    // 4) navigations SPA : pushState, document réécrit, l'hôte arraché par la page
    await pg.evaluate(() => { history.pushState({}, '', '/member/424242'); document.body.innerHTML += '<div id="spa">route</div>'; });
    await pg.waitForTimeout(300);
    await pg.evaluate(() => { history.pushState({}, '', '/inbox'); const h = document.getElementById('vrm-action'); if (h) h.remove(); });
    await pg.waitForTimeout(400);
    // 5) un message bref de Vinted (300 ms) : l'écran ne s'écarte pas
    await pg.evaluate(() => { const d = document.createElement('div'); d.setAttribute('role', 'alert'); d.setAttribute('data-testid', 'toast'); d.textContent = 'Inventé'; document.body.appendChild(d); setTimeout(() => d.remove(), 300); });
    await pg.waitForTimeout(700);
    // 6) molette (pavé tactile) et touches de défilement : la page ne bouge pas
    await pg.mouse.move(640, 400);
    for (let k = 0; k < 6; k++) { await pg.mouse.wheel(0, 300); await pg.waitForTimeout(40); }
    for (const key of ['PageDown', 'Space', 'ArrowDown', 'End']) { await pg.keyboard.press(key); await pg.waitForTimeout(40); }
    await pg.waitForTimeout(200);
    const yPendant = await pg.evaluate(() => window.scrollY);
    const ovf = await pg.evaluate(() => [document.documentElement.style.overflow, document.body.style.overflow]);
    const fin1 = await pg.evaluate(() => Date.now());
    const ech1 = await pg.evaluate(({ a, b }) => window.__ech.filter((x) => x.t >= a && x.t <= b), { a: debut, b: fin1 });
    const trous = ech1.filter((x) => !x.vu || !x.bloque);
    console.log(`     mesuré : ${ech1.length} échantillons (50 ms) · ${trous.length} sans écran ou sans blocage · scrollY ${y0} → ${yPendant} · overflow ${JSON.stringify(ovf)}`);
    dit(ech1.length > 80 && !trous.length, 'à chaque échantillon : écran plein vu (opacité ≥ 0,98) ET Vinted bloqué au centre — pas, fond muet, « rien » isolé, routes SPA, hôte arraché, message bref', JSON.stringify(trous.slice(0, 5)) + ` (${trous.length}/${ech1.length})`);
    dit(yPendant === y0, 'molette du pavé tactile et touches de défilement : la page ne bouge pas', `${y0} → ${yPendant}`);
    dit(ovf[0] === 'hidden' && ovf[1] === 'hidden', 'html et body verrouillés (overflow: hidden) pendant l’écran', JSON.stringify(ovf));
    // 7) rechargement complet pendant l'action
    await pg.evaluate(() => sessionStorage.removeItem('__ech_tous'));
    await pg.reload({ waitUntil: 'commit' });
    await pg.waitForTimeout(1800);
    const ech2 = await pg.evaluate(() => JSON.parse(sessionStorage.getItem('__ech_tous') || '[]'));
    const trous2 = ech2.filter((x) => !x.vu || !x.bloque);
    if (process.env.DEBUG_AC) console.log(JSON.stringify(ech2.map((x, i) => `${i}:${x.vu ? "V" : "-"}${x.bloque ? "B" : "-"}${x.g ? "g" : ""}${x.d || ""}`)));
    console.log(`     rechargement : ${ech2.length} échantillons depuis document_start · ${trous2.length} trou(s)`);
    dit(ech2.length >= 20 && !trous2.length, 'rechargement complet : bloqué dès le premier échantillon (voile de content.js), puis l’écran — aucun trou', JSON.stringify(trous2.slice(0, 4)));
    // 8) vérification de Vinted : l'écran s'écarte EN LE DISANT, la page redevient cliquable et défilable
    await pg.evaluate(() => { const f = document.createElement('iframe'); f.src = 'https://geo.captcha-delivery.com/captcha/?banc=1'; f.id = 'cap'; f.style.cssText = 'width:300px;height:200px;position:fixed;left:0;top:0'; document.body.appendChild(f); });
    await pg.waitForTimeout(250);
    const cap = await pg.evaluate(() => { const h = document.getElementById('vrm-action'), r = h && h.shadowRoot; const x = document.elementFromPoint(innerWidth / 2, innerHeight / 2); return { cote: !!(r && r.querySelector('[data-action-cote="verification"]')), libre: !!x && x !== h && x !== document.documentElement, ovf: document.documentElement.style.overflow }; });
    dit(cap.cote && cap.libre && cap.ovf !== 'hidden', 'vérification : bandeau « Vinted demande une vérification », page cliquable et défilable', JSON.stringify(cap));
    await pg.evaluate(() => document.getElementById('cap').remove());
    const tCap = await pg.evaluate(() => Date.now());
    await pg.waitForTimeout(1500);
    const tient = await pg.evaluate(() => { const r = document.getElementById('vrm-action').shadowRoot; return !!r.querySelector('[data-action-cote]'); });
    dit(tient, 'le bandeau tient (≥ 3 s) même si la vérification disparaît vite : jamais un éclair');
    await pg.waitForTimeout(2200);
    const retour = await pg.evaluate(() => { const r = document.getElementById('vrm-action').shadowRoot; return { plein: !!r.querySelector('.voile[data-action-plein]'), fin: !!r.querySelector('[data-action-fin]'), ovf: document.documentElement.style.overflow }; });
    dit(retour.plein && !retour.fin && retour.ovf === 'hidden', 'après la vérification : l’écran plein revient (pas de « Terminé »), verrou reposé', JSON.stringify(retour) + ` (${Date.now() - tCap} ms)`);
    // 9) la fin : tout est rendu exactement
    await pg.evaluate((a) => window.__poser(a), etat({ actif: false, fait: 5, fin: { at: Date.now(), raison: 'fini' } }));
    await pg.waitForTimeout(2600);
    const apres = await pg.evaluate(() => ({ y: window.scrollY, h: document.documentElement.getAttribute('style') || '', b: document.body.getAttribute('style') || '', vu: getComputedStyle(document.getElementById('vrm-action')).display !== 'none' }));
    dit(!apres.vu && apres.h === '' && /overflow:\s*visible/.test(apres.b) && Math.abs(apres.y - y0) <= 1, 'fin : écran retiré, overflow en ligne d’avant rendu exactement (html sans style, body « visible »), position rendue', JSON.stringify(apres) + ` y0=${y0}`);
    dit(!erreurs.length, 'aucune erreur de page', erreurs.join(' | '));
    await ctx.close();
  } finally { await nav.close(); }
  console.log(`\n${ko ? '❌' : '✅'} ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ a levé : ' + (e && e.stack || e)); process.exit(1); });
