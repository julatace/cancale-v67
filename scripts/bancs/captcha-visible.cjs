// ════════════════════════════════════════════════════════════════════════
//  BANC « UNE VÉRIFICATION DE VINTED RESTE VISIBLE » (20 nov., ext. 5.410.5)
//
//  Julien (capture du 20 nov. 22:29, messages aux favoris) : l'extension s'arrête et dit « fais la vérification
//  ici sur la page » — mais le grand panneau VRM reste ouvert PAR-DESSUS la page : il ne peut pas la faire.
//  Le VRAI vrm-badge.js + vrm-action.js + vrm-ui.js dans une FAUSSE page vinted.fr (faux `chrome`, tout inventé) ;
//  pendant une action (messages aux favoris), une iframe `captcha-delivery` est injectée PLEIN ÉCRAN, SOUS le
//  z-index de VRM (le pire cas : si VRM restait, il la couvrirait). On exige :
//   · le grand panneau se replie seul en une pastille en haut, qui dit « fais-la sur la page, puis touche Reprendre » ;
//   · aucun élément VRM ne recouvre la vérification : `elementFromPoint` au centre (et en 5 points) = l'iframe ;
//   · l'écran plein d'action s'est écarté (pas de voile) ;
//   · rien ne repart seul (aucun « reprendre », « lancer », « arreter » envoyé) ;
//   · la vérification retirée : « Vérification faite — Reprendre ? », toujours rien de relancé ; la pastille rouvre
//     le panneau.
//  Captures dans `captures/captcha-visible` (exemple inventé). `BANC_EXT=<arbre d'avant>/vinted-sync-extension` ⇒
//  rouge attendu ; `--prouve` : mutations ⇒ rouge.
// ════════════════════════════════════════════════════════════════════════
require('./_porte-banc.cjs');
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const os = require('os');

const RACINE = path.join(__dirname, '..', '..');
const args = process.argv.slice(2);
const MUTATIONS = {
  'sans-repli': { f: 'vrm-badge.js', a: "if (la) { if (!ouvertMalgre && etatV !== 'page') poserV('page');", b: "if (la) { if (false) poserV('page');" },
  'repli-sans-cacher': { f: 'vrm-badge.js', a: ':host([data-verif-replie]) .carte, :host([data-verif-replie]) .btn,', b: ':host([data-verif-replie]) .btn,' },
  'faite-muette': { f: 'vrm-badge.js', a: "else if (etatV === 'page') poserV('faite');", b: "else if (etatV === 'page') {}" },
};
if (args.includes('--prouve')) {
  let rates = 0;
  for (const m of Object.keys(MUTATIONS)) {
    const M = MUTATIONS[m];
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'captcha-visible-'));
    for (const f of fs.readdirSync(path.join(RACINE, 'vinted-sync-extension'))) { const p = path.join(RACINE, 'vinted-sync-extension', f); if (fs.statSync(p).isFile()) fs.copyFileSync(p, path.join(tmp, f)); }
    const s = fs.readFileSync(path.join(tmp, M.f), 'utf8');
    if (!s.includes(M.a)) { console.log(`❌ mutation ${m} : motif introuvable`); rates++; continue; }
    fs.writeFileSync(path.join(tmp, M.f), s.split(M.a).join(M.b));
    let rouge = false;
    try { execFileSync(process.execPath, [__filename], { stdio: 'pipe', timeout: 600000, env: { ...process.env, BANC_EXT: tmp, BANC_CAPTURES: path.join(tmp, 'cap') } }); } catch (e) { rouge = e.status === 1; }
    console.log(`${rouge ? '✅' : '❌'} mutation ${m} ⇒ ${rouge ? 'rouge' : 'RESTE VERT'}`);
    if (!rouge) rates++;
  }
  console.log(rates ? `\n❌ ${rates} mutation(s) non détectée(s)` : `\n✅ ${Object.keys(MUTATIONS).length}/${Object.keys(MUTATIONS).length} mutations détectées`);
  process.exit(rates ? 1 : 0);
}

const EXT = process.env.BANC_EXT || path.join(RACINE, 'vinted-sync-extension');
const BADGE = fs.readFileSync(path.join(EXT, 'vrm-badge.js'), 'utf8');
const UI = fs.readFileSync(path.join(EXT, 'vrm-ui.js'), 'utf8');
const ACTION = fs.readFileSync(path.join(EXT, 'vrm-action.js'), 'utf8');
const LOGO = fs.readFileSync(path.join(RACINE, 'vinted-sync-extension', 'logo-vrm-96.png'));
const SORTIE = process.env.BANC_CAPTURES ? path.join(process.env.BANC_CAPTURES, 'captcha-visible') : path.join(__dirname, 'captures', 'captcha-visible');
// Les fixtures et l'ouverture de la page : celles du banc du grand panneau (inventées), reprises telles quelles.
const GP = fs.readFileSync(path.join(__dirname, 'grand-panneau.cjs'), 'utf8');
const i0 = GP.indexOf('const MIN = 60000'), i1 = GP.indexOf('const lire = (pg)');
if (i0 < 0 || i1 < i0) { console.log('❌ fixtures du grand panneau introuvables'); process.exit(1); }
const { ouvrir } = new Function('BADGE', 'UI', 'LOGO', GP.slice(i0, i1) + '\nreturn { ouvrir };')(BADGE, UI, LOGO);

let ko = 0, ok = 0;
const dit = (bon, quoi, detail) => { if (bon) { ok++; console.log(`  ✅ ${quoi}`); } else { ko++; console.log(`  ❌ ${quoi}${detail ? ' — ' + String(detail).slice(0, 400) : ''}`); } };

const etatPanneau = (pg) => pg.evaluate(() => {
  const h = document.getElementById('vrm-badge'), r = h.shadowRoot;
  const carte = r.querySelector('.carte'), p = r.querySelector('[data-verif-pastille]');
  const vis = (el) => !!(el && el.getClientRects().length && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden');
  const b = p && vis(p) ? p.getBoundingClientRect() : null;
  const a = document.getElementById('vrm-action'), ar = a && a.shadowRoot;
  return { replie: h.getAttribute('data-verif-replie'), carteVue: vis(carte) && carte.classList.contains('on'), grand: !!(carte && carte.hasAttribute('data-grand')),
    pastille: b ? { t: p.textContent, etat: p.getAttribute('data-verif'), x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height) } : null,
    voile: !!(ar && ar.querySelector('.voile[data-action-plein]')), cote: ar && ar.querySelector('[data-action-cote]') ? ar.querySelector('[data-action-cote]').textContent : '',
    envoyes: (window.__envoyes || []).filter((m) => ['reprendre', 'lancer', 'arreter'].includes(m.action) || (m.action === 'favorisCarte' && m.quoi !== 'apercu')).map((m) => m.action + ':' + (m.quoi || '')) };
});

(async () => {
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  fs.mkdirSync(SORTIE, { recursive: true });
  const cap = async (pg, nom) => { try { await pg.screenshot({ path: path.join(SORTIE, nom + '.png') }); } catch (_) {} };
  try {
    for (const [largeur, hauteur, mobile] of [[1280, 800, false], [390, 844, true]]) {
      const T = String(largeur);
      console.log(`\n${T} px`);
      const t = await ouvrir(nav, { largeur, hauteur, mobile });
      const pg = t.pg;
      // L'écran plein d'action (vrm-action.js) : une file des favoris en cours, compte de l'onglet.
      await pg.evaluate((act) => {
        window.__action = { actif: true, sorte: 'favoris', uid: '111', debut: Date.now() - 60000, maj: Date.now(), fait: 0, total: 15, item: { id: '500', titre: 'Nike Air Max 90 blanches 38', photo: '' } };
        const avant = window.chrome.runtime.sendMessage;
        window.chrome.runtime.sendMessage = (msg, cb) => {
          if (msg && msg.from === 'vrm-action' && msg.action === 'etat') { window.__envoyes.push(JSON.parse(JSON.stringify(msg))); setTimeout(() => cb && cb({ ok: true, action: JSON.parse(JSON.stringify(window.__action)) }), 0); return; }
          return avant(msg, cb);
        };
        const s = document.createElement('script'); s.textContent = act; document.documentElement.appendChild(s);
      }, ACTION);
      await pg.waitForTimeout(500);
      // Le grand panneau ouvert (il le recouvrait sur la capture de Julien).
      await pg.evaluate(() => { const b = document.getElementById('vrm-badge').shadowRoot.querySelector('.btn'); b.click(); });
      await pg.waitForTimeout(500);
      let e = await etatPanneau(pg);
      dit(e.carteVue && e.grand, `${T} : avant — le grand panneau est ouvert`, JSON.stringify(e));
      // (21 nov., 5.410.6) vinted.fr porte en permanence des cadres reCAPTCHA INVISIBLES (hors écran, 0 × 0) : ce n'est PAS
      // une vérification — le panneau ne doit ni se replier ni dire « fais-la sur la page ».
      await pg.evaluate(() => {
        const g = document.createElement('div'); g.style.cssText = 'position:absolute;top:-10000px;left:0;width:256px;height:60px';
        const f1 = document.createElement('iframe'); f1.src = 'https://www.google.com/recaptcha/api2/anchor?banc=1'; f1.width = 256; f1.height = 60; g.appendChild(f1);
        const f2 = document.createElement('iframe'); f2.src = 'https://www.google.com/recaptcha/api2/bframe?banc=1'; f2.style.cssText = 'width:0;height:0;border:0'; document.body.appendChild(f2);
        document.body.appendChild(g);
        window.__action = Object.assign({}, window.__action, { robot: true, robotAt: Date.now(), maj: Date.now() });
        try { window.__vrmActionLire && window.__vrmActionLire(); } catch (_) {}
      });
      await pg.waitForTimeout(1500);
      e = await etatPanneau(pg);
      dit(e.carteVue && !e.replie && !/fais-la sur la page/.test(e.cote + ' ' + ((e.pastille && e.pastille.t) || '')), `${T} : cadres reCAPTCHA invisibles de vinted.fr ⇒ PAS une vérification (panneau ouvert, aucun « fais-la sur la page »)`, JSON.stringify(e));
      await pg.evaluate(() => { window.__action = Object.assign({}, window.__action, { robot: false, maj: Date.now() }); });
      // Vinted affiche sa vérification : une iframe plein écran, SOUS le z-index de VRM (le pire cas).
      // Le geste de Julien sur le panneau compte comme une file en pause « vérification » (5.407).
      await pg.evaluate(() => {
        window.__action = Object.assign({}, window.__action, { verification: true, robot: true, robotAt: Date.now(), attente: 'verification', maj: Date.now() });
        const f = document.createElement('iframe'); f.id = 'dd'; f.src = 'https://geo.captcha-delivery.com/captcha/?banc=1';
        f.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;border:0;z-index:1000;background:#e9eef3';
        document.body.appendChild(f);
        try { window.__vrmActionLire && window.__vrmActionLire(); } catch (_) {}
      });
      await pg.waitForTimeout(1500);
      e = await etatPanneau(pg);
      await cap(pg, `verification-${T}`);
      dit(e.replie === 'page' && !e.carteVue, `${T} : la vérification apparaît ⇒ le panneau se replie seul`, JSON.stringify(e));
      dit(e.pastille && e.pastille.y < 260 && e.pastille.h >= 44 && /fais-la sur la page, puis touche Reprendre/.test(e.cote + ' ' + e.pastille.t) && !(/fais-la/.test(e.cote) && /fais-la/.test(e.pastille.t)), `${T} : une petite pastille en HAUT (44 px), et la phrase « fais-la sur la page, puis touche Reprendre » dite UNE fois`, JSON.stringify({ p: e.pastille, cote: e.cote }));
      // La pastille et le bandeau ne se chevauchent pas.
      const chev = await pg.evaluate(() => { const a = document.getElementById('vrm-action'); return Number(a && a.getAttribute('data-cote-bas')) || 0; });
      dit(!!e.pastille && (!chev || largeur >= 900 || e.pastille.y >= chev), `${T} : la pastille se pose sous le bandeau de l’écran d’action (jamais dessus)`, JSON.stringify({ bas: chev, p: e.pastille }));
      const points = await pg.evaluate(() => { const f = document.getElementById('dd'), b = f.getBoundingClientRect(); const cx = b.left + b.width / 2, cy = b.top + b.height / 2;
        return [[cx, cy], [cx - 120, cy], [cx + 120, cy], [cx, cy - 150], [cx, cy + 150]].map(([x, y]) => { const el = document.elementFromPoint(x, y); return el === f ? 'iframe' : (el ? (el.id || el.tagName) : 'rien'); }); });
      dit(points.every((p) => p === 'iframe'), `${T} : aucun élément VRM sur la vérification — elementFromPoint au centre et en 4 points = l’iframe`, JSON.stringify(points));
      dit(!e.voile && /Vinted demande une vérification/.test(e.cote), `${T} : l’écran plein s’est écarté (bandeau en haut, pas de voile)`, JSON.stringify({ voile: e.voile, cote: e.cote }));
      await pg.waitForTimeout(1500);
      e = await etatPanneau(pg);
      dit(e.envoyes.length === 0, `${T} : rien ne repart seul pendant la vérification`, JSON.stringify(e.envoyes));
      // La vérification faite (l'iframe disparaît) : on le DIT, rien n'est relancé.
      await pg.evaluate(() => document.getElementById('dd').remove());
      await pg.waitForTimeout(1200);
      e = await etatPanneau(pg);
      await cap(pg, `faite-${T}`);
      dit(/Vérification faite/.test(e.cote) && e.replie === 'faite' && e.pastille && /Vérification faite — Reprendre/.test(e.pastille.t) && e.envoyes.length === 0, `${T} : vérification disparue ⇒ « Vérification faite — Reprendre ? », rien de relancé`, JSON.stringify(e));
      // SON toucher sur la pastille : le panneau revient.
      await pg.evaluate(() => document.getElementById('vrm-badge').shadowRoot.querySelector('[data-verif-pastille]').click());
      await pg.waitForTimeout(500);
      e = await etatPanneau(pg);
      dit(!e.replie && e.carteVue && !e.pastille && e.envoyes.length === 0, `${T} : toucher la pastille rouvre le panneau (et ne relance rien)`, JSON.stringify(e));
      await cap(pg, `rouvert-${T}`);
      dit(!t.erreurs.length, `${T} : aucune erreur de page`, t.erreurs.join(' | '));
      await t.ctx.close();
    }
  } finally { await nav.close(); }
  console.log(`\n${ko ? '❌' : '✅'} banc captcha-visible : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ a levé : ' + (e && e.stack || e)); process.exit(1); });
