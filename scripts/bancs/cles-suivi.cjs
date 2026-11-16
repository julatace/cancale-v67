require('./_reglages-compat.cjs');   // Paramètres en catégories : la catégorie d'une rangée touchée avant elle
// ════════════════════════════════════════════════════════════════════════════
//  BANC (16 nov., lot transporteurs-suivi) — Paramètres → Ventes et colis → « Suivi Colissimo et UPS »
//  Le vendeur colle SA clé gratuite (La Poste, UPS) ; elle part UNE fois au serveur, l'écran n'en
//  revoit que la fin. Données inventées, route /api/compte?mode=cles-suivi servie par le banc (aucun
//  réseau), 390 tactile et 1512, clair et sombre, `locale: 'fr-FR'` (nouveau-vendeur.cjs) :
//   K1 la rangée existe dans « Ventes et colis » et s'ouvre ; sans clé, chaque transporteur le dit ;
//   K2 coller + « Ranger ma clé » ⇒ UN POST { action:'poser', transporteur, cle } ; l'écran dit
//      « Clé rangée, pas encore utilisée · …fin » ; la clé n'est plus nulle part dans la page ;
//   K3 « Retirer » demande d'abord, puis UN POST { action:'retirer', confirme:true } ;
//   K4 UPS refusé ⇒ le message du serveur, rien d'affiché comme rangé ;
//   K5 la lecture ratée ⇒ « pas su » dit, aucun formulaire (jamais « aucune clé » supposé) ;
//   K6 44 px au doigt, rien ne déborde, aucune erreur.
//  SHOTS=<dossier> (captures à regarder), BANC_PORT, LARGEURS, THEMES.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); } catch (_) { ({ chromium } = require('playwright')); }
const NV = require('./nouveau-vendeur.cjs');
const SHOTS = process.env.SHOTS || '';
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
let ko = 0, ok = 0;
const dit = (bon, quoi, det) => { if (bon) ok++; else ko++; console.log(`${bon ? '✅ ' : '❌ '}${quoi}${!bon && det !== undefined ? ' — ' + String(det).slice(0, 300) : ''}`); };
const base = () => ({ lignes: JSON.parse(JSON.stringify(NV.JEU_LIGNES)), comptes: NV.JEU_COMPTES, ecritures: 0 });
const capture = async (pg, nom) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, nom + '.png'), fullPage: false }).catch(() => {}); };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const CLE = 'cle-okapi-INVENTEE-1234ABCD';
const vide = { etat: 'aucune', fin: null, at: null, verif: null, verifAt: null };

(async () => {
  await new Promise((r) => NV.srv.listen(NV.PORT, r));
  const nav = await chromium.launch({ executablePath: process.env.BANC_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  try {
    for (const W of LARGEURS) for (const theme of THEMES) {
      const tag = `${W}-${theme}`;
      for (const issue of ['ok', 'panne']) {
        const { ctx, pg, journal, tel } = await NV.ouvrir(nav, { W, sombre: theme === 'sombre', base: base(), tab: 'settings' });
        const posts = [];
        let etat = { ok: true, coffre: true, colissimo: { ...vide }, ups: { ...vide } };
        await pg.route('**/api/compte?mode=cles-suivi', async (r) => {
          const q = r.request();
          if (issue === 'panne') return r.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ erreur: 'pas-su', message: 'La base n’a pas répondu.' }) });
          if (q.method() === 'POST') {
            const c = JSON.parse(q.postData() || '{}'); posts.push(c);
            if (c.action === 'poser' && c.transporteur === 'ups') return r.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ erreur: 'refusee', message: 'UPS refuse ces identifiants (Client ID ou Client Secret faux). Rien n’a été rangé.' }) });
            if (c.action === 'poser') etat = { ...etat, [c.transporteur]: { etat: 'posee', fin: String(c.cle || c.id).slice(-4), at: new Date().toISOString(), verif: 'pas-su', verifAt: null } };
            if (c.action === 'retirer' && c.confirme === true) etat = { ...etat, [c.transporteur]: { ...vide } };
          }
          return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(etat) });
        });
        await pg.goto(`http://localhost:${NV.PORT}/?tab=settings`, { waitUntil: 'domcontentloaded' }); await attendre(1500);
        let ouvert = true;
        await pg.click('[data-sous-ouvrir="cles-suivi"]', { timeout: 15000 }).catch(async (e) => { ouvert = false; await capture(pg, `cles-suivi-${tag}-${issue}-rangee-absente`); dit(false, `K1 ${tag} : la rangée « Suivi Colissimo et UPS » se touche (Ventes et colis)`, String(e.message).split('\n')[0]); });
        if (!ouvert) { await ctx.close(); continue; }
        const cat = await pg.evaluate(() => { const c = document.querySelector('[data-categorie-contient~="cles-suivi"]'); return c ? c.getAttribute('data-categorie') || c.getAttribute('data-categorie-contient') : null; });
        await pg.waitForSelector('[data-cles-suivi]:not([data-cles-suivi="lecture"])', { timeout: 8000 }).catch(() => {});
        if (issue === 'panne') {
          const e = await pg.evaluate(() => ({ etat: document.querySelector('[data-cles-suivi]') && document.querySelector('[data-cles-suivi]').getAttribute('data-cles-suivi'), forms: document.querySelectorAll('[data-cle-form]').length, aucune: /Pas de clé/.test(document.body.innerText) }));
          dit(e.etat === 'pas-su' && e.forms === 0 && !e.aucune, `K5 ${tag} : lecture ratée ⇒ « pas su » dit, aucun formulaire, jamais « pas de clé » supposé`, JSON.stringify(e));
          await capture(pg, `cles-suivi-${tag}-panne`);
          await ctx.close(); continue;
        }
        const a = await pg.evaluate(() => [...document.querySelectorAll('[data-cle-transporteur]')].map((s) => ({ t: s.getAttribute('data-cle-transporteur'), e: s.getAttribute('data-cle-etat'), phrase: (s.querySelector('[data-cle-phrase]') || {}).textContent || '' })));
        dit(a.length === 2 && a.every((x) => x.e === 'aucune' && /Pas de clé : suivi non lu chez/.test(x.phrase)), `K1 ${tag} : la rangée s’ouvre ; sans clé, chaque transporteur dit « suivi non lu chez … »`, JSON.stringify({ a, cat }));
        await capture(pg, `cles-suivi-${tag}-vide`);
        await pg.fill('[data-cle-champ="colissimo.cle"]', CLE);
        await pg.click('[data-cle-ranger="colissimo"]');
        await pg.waitForSelector('[data-cle-transporteur="colissimo"][data-cle-etat="posee"]', { timeout: 6000 }).catch(() => {});
        const b = await pg.evaluate((cle) => ({ phrase: (document.querySelector('[data-cle-transporteur="colissimo"] [data-cle-phrase]') || {}).textContent || '', valeurs: [...document.querySelectorAll('input')].map((i) => i.value).filter((v) => v.includes(cle)).length, texte: document.body.innerText.includes(cle), stock: JSON.stringify(Object.assign({}, localStorage)).includes(cle) }), CLE);
        dit(posts.length === 1 && posts[0].action === 'poser' && posts[0].transporteur === 'colissimo' && posts[0].cle === CLE, `K2 ${tag} : UN envoi { poser, colissimo, cle }`, JSON.stringify(posts));
        dit(/Clé rangée, pas encore utilisée/.test(b.phrase) && /…ABCD/.test(b.phrase) && !b.valeurs && !b.texte && !b.stock, `K2 ${tag} : « Clé rangée, pas encore utilisée · …ABCD » ; la clé n’est plus dans la page ni sur l’appareil`, JSON.stringify(b));
        await capture(pg, `cles-suivi-${tag}-posee`);
        await pg.click('[data-cle-retirer="colissimo"]');
        await pg.waitForSelector('[data-cle-confirme="colissimo"]', { timeout: 4000 }).catch(() => {});
        const avantConfirme = posts.length;
        await capture(pg, `cles-suivi-${tag}-confirmer`);
        await pg.click('[data-cle-confirmer="colissimo"]');
        await pg.waitForSelector('[data-cle-transporteur="colissimo"][data-cle-etat="aucune"]', { timeout: 6000 }).catch(() => {});
        dit(avantConfirme === 1 && posts.length === 2 && posts[1].action === 'retirer' && posts[1].confirme === true, `K3 ${tag} : « Retirer » demande d’abord, puis UN envoi confirmé`, JSON.stringify(posts.slice(1)));
        await pg.fill('[data-cle-champ="ups.id"]', 'ups-id-INVENTE-0000');
        await pg.fill('[data-cle-champ="ups.secret"]', 'ups-secret-INVENTE-0000');
        await pg.click('[data-cle-ranger="ups"]');
        await pg.waitForSelector('[data-cle-msg="ups"]', { timeout: 6000 }).catch(() => {});
        const u = await pg.evaluate(() => ({ msg: (document.querySelector('[data-cle-msg="ups"]') || {}).textContent || '', e: document.querySelector('[data-cle-transporteur="ups"]').getAttribute('data-cle-etat') }));
        dit(/UPS refuse ces identifiants/.test(u.msg) && u.e === 'aucune', `K4 ${tag} : UPS refusé ⇒ le message du serveur, rien affiché comme rangé`, JSON.stringify(u));
        await capture(pg, `cles-suivi-${tag}-ups-refuse`);
        const m = await pg.evaluate((tel) => {
          const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
          const petits = tel ? [...document.querySelectorAll('[data-cles-suivi] button, [data-cles-suivi] input, [data-cles-suivi] summary')].filter((e) => vis(e) && e.getBoundingClientRect().height < 43.5).map((e) => (e.textContent || e.getAttribute('data-cle-champ') || '').trim().slice(0, 30) + ':' + Math.round(e.getBoundingClientRect().height)) : [];
          const hors = [...document.querySelectorAll('[data-cles-suivi] *')].filter((e) => vis(e) && e.getBoundingClientRect().right > window.innerWidth + 1).map((e) => String(e.className || e.tagName).slice(0, 30));
          return { deb: document.documentElement.scrollWidth - window.innerWidth, petits, hors };
        }, tel);
        dit(m.deb <= 1 && !m.hors.length && !m.petits.filter((x) => !/^Où trouver/.test(x)).length, `K6 ${tag} : rien ne déborde${tel ? ', 44 px au doigt' : ''}`, JSON.stringify(m));
        dit(!journal.erreurs.length, `K6 ${tag} : aucune erreur d’app`, journal.erreurs.join(' | '));
        await ctx.close();
      }
    }
  } finally { await nav.close(); NV.srv.close(); }
  console.log(ko ? `\n❌ banc cles-suivi : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ banc cles-suivi : ${ok} verts`);
  process.exit(ko ? 1 : 0);
})();
