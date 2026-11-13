// Banc : L'ENCART « À VÉRIFIER » SUR LE FORMULAIRE DE DÉPÔT VINTED (11 nov., lot verif-publication, 5.353).
//   node scripts/bancs/verif-depot-vinted.cjs        (port 4938, BANC_PORT pour changer)
//
// Une page de dépôt INVENTÉE (dépôt public : aucune page Vinted copiée) servie à
// /items/new : une zone de description, un prix, un bouton « Ajouter ». Le VRAI
// vinted-capture.js y tourne ; le fond est remplacé par la VRAIE règle
// `alertesDepotVinted` du background.js (exécuté dans `_fond-vm.cjs`) sur des faits
// inventés : il numérote lui-même, le N°12 est en ligne sur ce compte, acheté 60 €.
// Exige, à 390 px (tactile) et 1512 px :
//   A. description sans N° ⇒ l'encart dit « Aucun N° à la fin de la description » ;
//   B. « N°12 » à la fin et 50 € ⇒ « déjà en ligne » ET « prix sous l'achat » ;
//   C. aucun prix conseillé (seuls 50 € et 60 €), 12 mots au plus par alerte ;
//   D. « Ne plus me le dire » retire CETTE alerte (cible 44 px) ;
//   E. jamais une garde : le bouton de Vinted reste cliquable, son envoi part, la
//      page n'a reçu aucun clic de l'extension ; aucune requête réseau de l'encart ;
//   F. un N° neuf et un bon prix ⇒ aucun encart ; aucune erreur ; captures regardées
//      (<tmp>/verif-depot-*.png).
const path = require('path'), fs = require('fs'), http = require('http'), os = require('os');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { faireFond } = require('../_fond-vm.cjs');
const PORT = Number(process.env.BANC_PORT) || 4938;
const CAP = fs.readFileSync(path.join(__dirname, '..', '..', 'vinted-sync-extension', 'vinted-capture.js'), 'utf8');
const fond = faireFond({});
const D = { ecrit: true, ou: null, enLigne: new Set(['12']), buyByNum: { 12: '60' }, coupees: [] };

const PAGE = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font-family:system-ui,sans-serif;margin:0;padding:16px;background:#fff;color:#111}form{max-width:640px;margin:auto;display:flex;flex-direction:column;gap:12px}
textarea,input{font:16px system-ui;padding:10px;border:1px solid #ccc;border-radius:8px}textarea{min-height:120px}.pied{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
button{font:600 16px system-ui;padding:12px 20px;border-radius:8px;border:0;background:#09757a;color:#fff}</style></head><body>
<form id="f" onsubmit="event.preventDefault(); window.__envois=(window.__envois||0)+1;">
<label>Titre <input name="title" value="Paire de test"></label>
<label>Description <textarea name="description"></textarea></label>
<label>Prix <input name="price" inputmode="decimal"></label>
<div class="pied"><button type="submit" id="ajouter">Ajouter</button></div></form></body></html>`;

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const srv = http.createServer((q, r) => { if (q.url.split('?')[0] === '/items/new') { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return r.end(PAGE); } r.writeHead(404); r.end(); });

const CHROME = () => {
  window.__msgs = []; window.__clicsExt = 0;
  const orig = HTMLElement.prototype.click; HTMLElement.prototype.click = function () { window.__clicsExt++; return orig.call(this); };
  const st = {};
  window.chrome = { runtime: { id: 'banc', lastError: null, sendMessage: (msg, cb) => {
    window.__msgs.push(msg && msg.action);
    const rep = (r) => setTimeout(() => cb && cb(r), 5);
    if (msg && msg.action === 'verifDepot') { window.__verif(msg.description == null ? null : msg.description, msg.prix == null ? null : msg.prix).then((a) => rep({ ok: true, alertes: a })); return; }
    if (msg && msg.action === 'numeroPourPublier') return rep({ ok: false, raison: 'ecrit' });
    rep({ ok: true, items: {}, convs: {}, txs: {} });
  } }, storage: { local: { get: async (k) => ({ [k]: st[k] }), set: async (o) => { Object.assign(st, o); } } } };
};
const encart = (pg) => pg.evaluate(() => { const h = document.querySelector('[data-vrm-verif-depot]'); return h ? { n: Number(h.getAttribute('data-vrm-verif-depot')), codes: h.getAttribute('data-vrm-verif-codes'), cle: h.getAttribute('data-vrm-verif-cle') } : null; });

(async () => {
  srv.listen(PORT);
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844, tactile: true }, { width: 1512, height: 950 }]) {
      console.log(`── ${vp.width} px`);
      const ctx = await b.newContext({ viewport: { width: vp.width, height: vp.height }, ...(vp.tactile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
      const pg = await ctx.newPage();
      const errs = [], reseau = []; pg.on('pageerror', (e) => errs.push(e.message));
      pg.on('request', (r) => { if (!/\/items\/new$/.test(r.url())) reseau.push(r.url()); });
      await pg.exposeFunction('__verif', (description, prix) => JSON.parse(JSON.stringify(fond.ctx.alertesDepotVinted({ description: description == null ? undefined : description, prix: prix == null ? undefined : prix }, D))));
      await pg.addInitScript(CHROME);
      await pg.goto(`http://localhost:${PORT}/items/new`);
      await pg.addScriptTag({ content: CAP });
      // A — description sans N°.
      await pg.fill('textarea[name="description"]', 'Très belle paire, portée deux fois, boîte d’origine.');
      await pg.fill('input[name="price"]', '80');
      await pg.waitForFunction(() => document.querySelector('[data-vrm-verif-depot]'), null, { timeout: 6000 }).catch(() => {});
      let e = await encart(pg);
      dit(e && e.codes === 'numero' && /Aucun N° à la fin de la description/.test(e.cle), 'A · sans N° à la fin : « Aucun N° à la fin de la description »', JSON.stringify(e));
      // B — N° en ligne, prix sous l'achat.
      await pg.fill('textarea[name="description"]', 'Très belle paire, portée deux fois.\nN°12');
      await pg.fill('input[name="price"]', '50');
      await pg.waitForFunction(() => /enligne/.test((document.querySelector('[data-vrm-verif-depot]') || {}).getAttribute?.('data-vrm-verif-codes') || ''), null, { timeout: 6000 }).catch(() => {});
      e = await encart(pg);
      dit(e && e.codes === 'enligne,prix', 'B · N°12 en ligne sur ce compte, 50 € sous 60 € ⇒ deux alertes', JSON.stringify(e));
      const textes = e ? e.cle.split('|').map((x) => x.replace(/^[a-z]+:/, '')) : [];
      const montants = textes.join(' ').match(/\d+(?:,\d+)?\s?€/g) || [];
      dit(montants.length === 2 && textes.every((t) => t.trim().split(/\s+/).length <= 12), 'C · aucun prix conseillé, 12 mots au plus', JSON.stringify(textes));
      await pg.waitForTimeout(300);
      await pg.screenshot({ path: path.join(os.tmpdir(), `verif-depot-${vp.width}.png`), fullPage: true });
      // D — « Ne plus me le dire » (dans une ombre fermée : on vise par coordonnées).
      const hote = await pg.$('[data-vrm-verif-depot]');
      const bb = hote ? await hote.boundingBox() : null;
      // La 1re alerte (« enligne ») : son bouton est sous ses deux lignes de texte.
      let coupe = false;
      if (bb) {
        for (let y = bb.y + 30; y < bb.y + bb.height && !coupe; y += 6) {
          await pg.mouse.click(bb.x + 40, y);
          await pg.waitForTimeout(120);
          const x = await encart(pg);
          if (x && x.codes === 'prix') coupe = true;
          if (!x) break;
        }
      }
      e = await encart(pg);
      dit(coupe && e && e.codes === 'prix', 'D · « Ne plus me le dire » retire CETTE alerte, l’autre reste', JSON.stringify(e));
      // E — jamais une garde.
      await pg.click('#ajouter');
      await pg.waitForTimeout(200);
      const env = await pg.evaluate(() => ({ envois: window.__envois || 0, clics: window.__clicsExt, msgs: [...new Set(window.__msgs)] }));
      dit(env.envois === 1 && env.clics === 0, 'E · le bouton de Vinted envoie (l’extension n’a rien cliqué ni bloqué)', JSON.stringify(env));
      dit(reseau.length === 0, 'E · aucune requête réseau depuis la page', reseau.slice(0, 3).join(' '));
      // F — un N° neuf et un bon prix : rien.
      await pg.fill('textarea[name="description"]', 'Très belle paire.\nN°40');
      await pg.fill('input[name="price"]', '90');
      await pg.waitForFunction(() => !document.querySelector('[data-vrm-verif-depot]'), null, { timeout: 6000 }).catch(() => {});
      dit(!(await encart(pg)), 'F · N° neuf, bon prix : aucun encart');
      const sw = await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      dit(sw <= 1, 'F · aucun débordement horizontal', String(sw));
      dit(!(await pg.$('[data-vrm-num-depot]')), 'F · « Je numérote moi-même » : aucune pastille de N° à côté du bouton (5.324)');
      dit(errs.length === 0, 'F · aucune erreur de page', errs.join(' | ').slice(0, 200));
      await ctx.close();
    }
  } catch (err) { dit(false, 'le banc a tourné jusqu’au bout', err.message); }
  finally {
    if (b) await b.close();
    srv.close();
    console.log(ko ? `\n❌ verif-depot-vinted : ${ko} rouge(s)` : '\n✅ verif-depot-vinted : tout est vert');
    process.exitCode = ko ? 1 : 0;
  }
})();
