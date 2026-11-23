// ════════════════════════════════════════════════════════════════════════
//  BANC « L'ONGLET DE TRAVAIL VOILÉ » (21 nov., ext. 5.410.8)
//
//  Julien : « l'onglet ouvert par VRM n'est pas bloqué, je veux que ce soit le cas ». Le VRAI script que le fond pose
//  dans l'onglet de travail (`marquerOngletTravail`, extrait de background.js tel quel) sur une FAUSSE page vinted.fr,
//  avec vrm-ui.js (les textes). On juge, à la souris (1512) et au doigt (390) :
//   V1. le voile couvre tout l'écran : « VRM travaille dans cet onglet — ne le ferme pas » et UN bouton « Tout arrêter » ;
//   V2. les gestes de la PERSONNE (souris, clavier, molette, doigt) n'atteignent plus la page ;
//   V3. les gestes de VRM (évènements non `isTrusted`, comme le formulaire) passent toujours ; un fetch de la page part ;
//   V4. « Tout arrêter » envoie la même demande que l'écran plein (`vrm-action` · `arreter`) ;
//   V5. une VRAIE vérification affichée (cadre captcha visible) ⇒ le voile s'écarte, et revient quand elle part ;
//   V6. la raison d'un refus s'écrit dans le voile ; reposé deux fois, un seul voile.
//  `BANC_EXT=<arbre d'avant>/vinted-sync-extension` : la 5.410.7 (simple bandeau, rien de bloqué : rouge attendu).
// ════════════════════════════════════════════════════════════════════════
require('./_porte-banc.cjs');
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const EXT = process.env.BANC_EXT || path.join(__dirname, '..', '..', 'vinted-sync-extension');
const BG = fs.readFileSync(path.join(EXT, 'background.js'), 'utf8');
const UI = fs.readFileSync(path.join(EXT, 'vrm-ui.js'), 'utf8');
const BADGE = fs.readFileSync(path.join(EXT, 'vrm-badge.js'), 'utf8');
const SORTIE = process.env.BANC_CAPTURES ? path.join(process.env.BANC_CAPTURES, 'onglet-travail-voile') : path.join(__dirname, 'captures', 'onglet-travail-voile');
let ko = 0, ok = 0;
const dit = (bon, quoi, detail) => { if (bon) { ok++; console.log(`  ✅ ${quoi}`); } else { ko++; console.log(`  ❌ ${quoi}${detail ? ' — ' + String(detail).slice(0, 400) : ''}`); } };
// Le script posé dans l'onglet : la fonction `func:` de marquerOngletTravail, telle quelle.
function scriptDuFond() {
  const i = BG.indexOf('async function marquerOngletTravail(');
  const d = BG.indexOf('func: ', i) + 6;
  const f = BG.indexOf('\n    } });', d);
  return BG.slice(d, f + 6);
}
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Messagerie | Vinted</title></head>
<body style="margin:0;font:15px sans-serif;background:#fff"><header style="height:64px;border-bottom:1px solid #ddd;padding:20px"><b style="color:#007782">Vinted</b> · Messagerie</header>
<main style="padding:20px;height:3000px"><button id="cible" style="width:240px;height:60px">Bouton de la page</button><br><br><input id="champ" style="width:240px;height:40px" placeholder="Écrire"></main>
<script>window.__clics=0;window.__touches='';document.getElementById('cible').addEventListener('click',()=>window.__clics++);document.getElementById('champ').addEventListener('keydown',(e)=>window.__touches+=e.key);</script></body></html>`;
(async () => {
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  fs.mkdirSync(SORTIE, { recursive: true });
  const FN = scriptDuFond();
  for (const o of [{ T: '1512', largeur: 1512, hauteur: 900 }, { T: '390', largeur: 390, hauteur: 844, mobile: true }, { T: '1512 dark', largeur: 1512, hauteur: 900, scheme: 'dark' }]) {
    console.log('\n' + o.T);
    const ctx = await nav.newContext(Object.assign({ viewport: { width: o.largeur, height: o.hauteur }, colorScheme: o.scheme || 'light' }, o.mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}));
    const pg = await ctx.newPage(); const erreurs = []; pg.on('pageerror', (e) => erreurs.push(String(e).slice(0, 200)));
    await pg.route('**/*', (r) => /\/api\/ping/.test(r.request().url()) ? r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }) : r.fulfill({ status: 200, contentType: 'text/html', body: PAGE }));
    await pg.goto('https://www.vinted.fr/inbox');
    try {
      await pg.evaluate(({ ui, badge }) => {
        window.__envoyes = [];
        window.chrome = { runtime: { id: 'ext', lastError: null, getURL: (p) => location.origin + '/' + p, getManifest: () => ({ version: '5.410.8' }), sendMessage: (m, cb) => { window.__envoyes.push(JSON.parse(JSON.stringify(m))); setTimeout(() => cb && cb({ ok: true }), 0); } }, storage: { local: { get: (k, cb) => { if (cb) setTimeout(() => cb({}), 0); return Promise.resolve({}); }, set: (o, cb) => { if (cb) setTimeout(cb, 0); return Promise.resolve(); } }, onChanged: { addListener() {} } } };
        for (const js of [ui, badge]) { const s = document.createElement('script'); s.textContent = js; document.documentElement.appendChild(s); }
      }, { ui: UI, badge: (() => { const i = BADGE.indexOf('function vrmVerifVisible'); return i >= 0 ? BADGE.slice(i, BADGE.indexOf('\n}\n', i) + 2) : ''; })() });
      const poser = (raison) => pg.evaluate(({ fn, r }) => { const f = (0, eval)('(' + fn + ')'); f(r); }, { fn: FN, r: raison });
      await poser(''); await poser(''); await pg.waitForTimeout(300);
      const L = () => pg.evaluate(() => { const h = document.getElementById('vrm-travail'); const o = h && h.shadowRoot; const v = o && o.querySelector('[data-voile-travail]'); const b = v ? v.getBoundingClientRect() : null;
        return { n: document.querySelectorAll('#vrm-travail').length, vis: !!(h && !h.hidden && getComputedStyle(h).display !== 'none'), w: b ? Math.round(b.width) : 0, h: b ? Math.round(b.height) : 0, titre: o && o.querySelector('[data-titre]') ? o.querySelector('[data-titre]').textContent : '', bouton: o && o.querySelector('[data-arreter]') ? o.querySelector('[data-arreter]').textContent : '', boutonH: o && o.querySelector('[data-arreter]') ? Math.round(o.querySelector('[data-arreter]').getBoundingClientRect().height) : 0, raison: o && o.querySelector('[data-raison]') ? o.querySelector('[data-raison]').textContent : '', clics: window.__clics, touches: window.__touches, defil: Math.round(scrollY), titrePage: document.title, envoyes: window.__envoyes }; });
      let a = await L();
      dit(a.n === 1 && a.vis && a.w >= o.largeur - 1 && a.h >= o.hauteur - 1 && /VRM travaille dans cet onglet — ne le ferme pas/.test(a.titre) && a.bouton === 'Tout arrêter' && a.boutonH >= 44 && /^VRM · onglet de travail/.test(a.titrePage), `${o.T} : un seul voile plein écran, « VRM travaille dans cet onglet — ne le ferme pas », UN bouton « Tout arrêter » (≥ 44 px), titre de l’onglet`, JSON.stringify(a));
      await pg.screenshot({ path: path.join(SORTIE, o.T.replace(' ', '-') + '-voile.png') });
      // V2 : la personne
      const box = await pg.evaluate(() => { const b = document.getElementById('cible').getBoundingClientRect(); return { x: b.left + 20, y: b.top + 20 }; });
      if (o.mobile) await pg.touchscreen.tap(box.x, box.y); else await pg.mouse.click(box.x, box.y);
      await pg.keyboard.type('abc'); if (!o.mobile) await pg.mouse.wheel(0, 800); await pg.waitForTimeout(250);
      a = await L();
      dit(a.clics === 0 && a.touches === '' && a.defil === 0, `${o.T} : ses clics, son clavier, sa molette n’atteignent pas la page`, JSON.stringify({ c: a.clics, t: a.touches, d: a.defil }));
      // V3 : VRM
      const vrm = await pg.evaluate(async () => { document.getElementById('cible').click(); const ch = document.getElementById('champ'); ch.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', bubbles: true })); let f = 0; try { f = (await fetch('/api/ping', { method: 'POST' })).status; } catch (_) {} return { clics: window.__clics, touches: window.__touches, f }; });
      dit(vrm.clics === 1 && vrm.touches === 'z' && vrm.f === 200, `${o.T} : les gestes de VRM (non isTrusted) passent, et un fetch de la page part`, JSON.stringify(vrm));
      // V4 : Tout arrêter
      const bb = await pg.evaluate(() => { const b = document.getElementById('vrm-travail').shadowRoot.querySelector('[data-arreter]').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
      if (o.mobile) await pg.touchscreen.tap(bb.x, bb.y); else await pg.mouse.click(bb.x, bb.y);
      await pg.waitForTimeout(200); a = await L();
      dit(a.envoyes.some((m) => m.from === 'vrm-action' && m.action === 'arreter'), `${o.T} : « Tout arrêter » demande l’arrêt (même porte que l’écran plein)`, JSON.stringify(a.envoyes));
      // V6 : raison
      await poser('Ces destinataires ont déjà été préparés pour ces articles. Aucun nouvel envoi.'); a = await L();
      dit(a.n === 1 && /déjà été préparés/.test(a.raison), `${o.T} : la raison d’un refus s’écrit dans le voile`, JSON.stringify({ n: a.n, r: a.raison }));
      if (!o.mobile && !o.scheme) await pg.screenshot({ path: path.join(SORTIE, o.T.replace(' ', '-') + '-voile-raison.png') });
      // V5 : vérification visible
      await pg.evaluate(() => { const f = document.createElement('iframe'); f.id = 'cap'; f.src = 'https://geo.captcha-delivery.com/captcha/?banc=1'; f.style.cssText = 'position:fixed;left:50%;top:50%;width:360px;height:420px;transform:translate(-50%,-50%);border:0;background:#eee;z-index:10'; document.body.appendChild(f); });
      await pg.waitForTimeout(1200); a = await L();
      dit(!a.vis, `${o.T} : une vraie vérification affichée ⇒ le voile s’écarte`, JSON.stringify({ vis: a.vis }));
      await pg.evaluate(() => document.getElementById('cap').remove()); await pg.waitForTimeout(1200); a = await L();
      dit(a.vis, `${o.T} : vérification partie ⇒ le voile revient`, JSON.stringify({ vis: a.vis }));
      dit(!erreurs.length, `${o.T} : aucune erreur de page`, JSON.stringify(erreurs));
    } catch (e) { ko++; console.log('  ❌ a levé : ' + String(e && e.message).slice(0, 300)); }
    await ctx.close();
  }
  await nav.close();
  console.log(ko ? `\n❌ onglet-travail-voile : ${ko} rouge(s) sur ${ok + ko}` : `\n✅ onglet-travail-voile : ${ok} contrôles`);
  process.exit(ko ? 1 : 0);
})();
