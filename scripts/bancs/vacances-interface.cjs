// ════════════════════════════════════════════════════════════════════════
//  BANC « LE MODE VACANCES PAR L'INTERFACE » (21 nov., ext. 5.420, `vacancesinterface`)
//  Le VRAI vrm-formulaire.js (étape `vacances`) sur une FAUSSE page des réglages de vinted.fr (inventée : la vraie
//  n'a jamais été relevée — ce banc ne prouve rien de ses sélecteurs, il prouve la RÈGLE) :
//   I1. UN interrupteur « Mode vacances » : un clic (isTrusted:false), la réponse que la page reçoit, l'état VU à l'écran ;
//   I2. déjà dans l'état voulu : rien n'est cliqué, aucune requête ;
//   I3. interrupteur absent ⇒ arrêt NOMMÉ ; I4. deux interrupteurs ⇒ « ambigu », rien ;
//   I5. pas la bonne page ⇒ « identite », rien ; I6. Vinted répond mais l'écran ne change pas ⇒ `vu: false` ;
//   I7. la confirmation de Vinted : « Activer » (jamais « Annuler ») ; I8. une vérification VISIBLE ⇒ arrêt, rien.
//  `BANC_EXT=<arbre d'avant>` : rouge attendu (l'étape n'existe pas). Captures 390 puis 1512.
// ════════════════════════════════════════════════════════════════════════
require('./_porte-banc.cjs');
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const RACINE = process.env.BANC_RACINE ? path.resolve(process.env.BANC_RACINE) : path.join(__dirname, '..', '..');
const EXT = process.env.BANC_EXT || path.join(RACINE, 'vinted-sync-extension');
const FORM = fs.readFileSync(path.join(EXT, 'vrm-formulaire.js'), 'utf8');
const SORTIE = process.env.BANC_CAPTURES ? path.join(process.env.BANC_CAPTURES, 'vacances-interface') : path.join(__dirname, 'captures', 'vacances-interface');
let ok = 0, ko = 0;
const dit = (b, quoi, d) => { if (b) { ok++; console.log('  ✅ ' + quoi); } else { ko++; console.log('  ❌ ' + quoi + (d ? ' — ' + String(d).slice(0, 400) : '')); } };
// La fausse page : un interrupteur (case dans un label), la requête de la PAGE quand on le touche, l'écran qui suit la réponse.
const page = ({ deux = false, aucun = false, etat = false, confirmer = false, figer = false, captcha = false } = {}) => `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font:16px -apple-system,system-ui,sans-serif;margin:0;padding:24px;background:#fff;color:#111}.r{display:flex;justify-content:space-between;align-items:center;padding:16px 0;border-bottom:1px solid #eee;max-width:640px}
label.sw{display:flex;gap:12px;align-items:center;min-height:44px}input[type=checkbox]{width:44px;height:26px}[role=dialog]{position:fixed;inset:30% 10% auto;background:#fff;border:1px solid #ccc;padding:20px;border-radius:12px}button{min-height:44px;padding:0 16px}</style></head>
<body><h1>Paramètres du profil</h1>
${aucun ? '<div class="r"><span>Langue</span><span>Français</span></div>' : `<div class="r"><label class="sw"><span>Mode vacances</span><input type="checkbox" id="h1"${etat ? ' checked' : ''}></label></div>`}
${deux ? `<div class="r"><label class="sw"><span>Mode vacances</span><input type="checkbox" id="h2"></label></div>` : ''}
${captcha ? '<iframe src="https://geo.captcha-delivery.com/x" style="width:300px;height:200px;border:0;background:#eee"></iframe>' : ''}
<script>
window.__clics = []; window.__requetes = 0;
document.addEventListener('click', (e) => { if (e.target && e.target.matches && e.target.matches('input,button')) window.__clics.push({ id: e.target.id || e.target.textContent, trusted: e.isTrusted }); }, true);
const envoyer = async (v, el) => {
  window.__requetes++;
  const r = await fetch('/api/v2/users/current', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user: { is_on_holiday: v } }) });
  const j = await r.json();
  if (!${figer}) el.checked = !!(j.user && j.user.is_on_holiday); else el.checked = !v;
};
for (const el of document.querySelectorAll('input[type=checkbox]')) el.addEventListener('change', (ev) => {
  const v = el.checked;
  if (${confirmer}) {
    const d = document.createElement('div'); d.setAttribute('role', 'dialog'); d.innerHTML = '<p>Activer le mode vacances ?</p><button id="an">Annuler</button> <button id="ac">Activer</button>';
    document.body.appendChild(d);
    d.querySelector('#an').onclick = () => { el.checked = !v; d.remove(); };
    d.querySelector('#ac').onclick = () => { d.remove(); envoyer(v, el); };
  } else envoyer(v, el);
});
</script></body></html>`;
async function essai(nav, nom, o, d, taille) {
  const ctx = await nav.newContext({ viewport: { width: taille.l, height: 844 }, ...(taille.mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const pg = await ctx.newPage();
  const erreurs = []; pg.on('pageerror', (e) => erreurs.push(String(e)));
  let recu = 0;
  await pg.route('**/*', async (r) => {
    const u = new URL(r.request().url());
    if (u.pathname === '/api/v2/users/current') { recu++; let b = {}; try { b = JSON.parse(r.request().postData() || '{}'); } catch (_) {} return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { id: 111, is_on_holiday: !!(b.user && b.user.is_on_holiday) } }) }); }
    if (u.hostname.endsWith('captcha-delivery.com')) return r.fulfill({ status: 200, contentType: 'text/html', body: '<p>captcha</p>' });
    return r.fulfill({ status: 200, contentType: 'text/html', body: page(o) });
  });
  await pg.goto('https://www.vinted.fr' + (o.chemin || '/settings/profile'));
  await pg.addScriptTag({ content: FORM });
  const r = await pg.evaluate(async (x) => (globalThis.__vrmFormulaire ? globalThis.__vrmFormulaire('vacances', x) : { ok: false, code: 'script-absent' }), d);
  const clics = await pg.evaluate(() => window.__clics);
  const etat = await pg.evaluate(() => { const el = document.getElementById('h1'); return el ? el.checked : null; });
  try { fs.mkdirSync(SORTIE, { recursive: true }); await pg.screenshot({ path: path.join(SORTIE, `${taille.l}-${nom}.png`) }); } catch (_) {}
  await ctx.close();
  return { r, clics, recu, etat, erreurs };
}
(async () => {
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  for (const taille of [{ l: 390, mobile: true }, { l: 1512 }]) {
    console.log('\n' + taille.l);
    const P = '/settings/profile', T = taille.l;
    let x = await essai(nav, 'I1', {}, { voulu: true, page: P }, taille);
    dit(x.r.ok && x.r.vu === true && x.r.rep && x.r.rep.ok && x.recu === 1 && x.etat === true && x.clics.length === 1 && x.clics[0].trusted === false, `${T} I1 — un clic (isTrusted:false), la réponse de la page, l’état VU`, JSON.stringify(x));
    x = await essai(nav, 'I2', { etat: true }, { voulu: true, page: P }, taille);
    dit(x.r.ok && x.r.deja === true && x.recu === 0 && x.clics.length === 0, `${T} I2 — déjà en vacances : rien n’est cliqué, aucune requête`, JSON.stringify(x));
    x = await essai(nav, 'I3', { aucun: true }, { voulu: true, page: P }, taille);
    dit(!x.r.ok && x.r.code === 'selecteur' && x.r.manque === 'vacances-interrupteur' && x.recu === 0, `${T} I3 — interrupteur absent : arrêt nommé « vacances-interrupteur »`, JSON.stringify(x.r));
    x = await essai(nav, 'I4', { deux: true }, { voulu: true, page: P }, taille);
    dit(!x.r.ok && x.r.manque === 'vacances-interrupteur-ambigu' && x.clics.length === 0, `${T} I4 — deux interrupteurs : « ambigu », rien n’est cliqué`, JSON.stringify(x.r));
    x = await essai(nav, 'I5', { chemin: '/settings/account' }, { voulu: true, page: P }, taille);
    dit(!x.r.ok && x.r.code === 'identite' && x.clics.length === 0, `${T} I5 — pas la bonne page : rien`, JSON.stringify(x.r));
    x = await essai(nav, 'I6', { figer: true }, { voulu: true, page: P }, taille);
    dit(x.r.ok && x.r.vu === false && x.recu === 1, `${T} I6 — Vinted répond mais l’écran ne montre pas l’état : « pas vu »`, JSON.stringify(x.r));
    x = await essai(nav, 'I7', { confirmer: true }, { voulu: true, page: P }, taille);
    dit(x.r.ok && x.r.vu === true && x.clics.some((c) => c.id === 'ac') && !x.clics.some((c) => c.id === 'an'), `${T} I7 — la confirmation : « Activer », jamais « Annuler »`, JSON.stringify(x));
    x = await essai(nav, 'I8', { captcha: true }, { voulu: true, page: P }, taille);
    dit(!x.r.ok && x.r.code === 'captcha' && x.clics.length === 0 && x.recu === 0, `${T} I8 — une vérification visible : arrêt, rien n’est cliqué`, JSON.stringify(x.r));
  }
  await nav.close();
  console.log(`\nbanc vacances-interface : ${ok} vert(s), ${ko} rouge(s) — captures : ${SORTIE}`);
  process.exit(ko ? 1 : 0);
})();
