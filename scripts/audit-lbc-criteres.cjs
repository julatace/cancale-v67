// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : LA CATÉGORIE ET SES CRITÈRES PARTENT DE LA FICHE DE VRM (5.381, `lbccriteres`)
//         node scripts/audit-lbc-criteres.cjs          (BANC_PORT, défaut 8417)
//         node scripts/audit-lbc-criteres.cjs --prouve  chaque mutation doit rougir
// ═══════════════════════════════════════════════════════════════════════════
// 15 nov. (Julien : « quand on met en ligne sur Leboncoin tout doit être vraiment
// parfait »). Leboncoin PRÉ-REMPLIT l'Univers et le Type d'après la photo et le titre
// (sa prédiction) ; une basket femme pouvait partir en « Homme ». Le VRAI `lbc.js` est
// chargé dans une vraie page Chromium (faux `chrome.runtime` qui rend la paire), avec
// des menus à la forme mesurée (role=combobox, options role=option) :
//   A. l'Univers prédit « Homme », la fiche dit « Femme » ⇒ « Femme » choisi ; Type et
//      Pointure (traduite « 38,5 ») choisis au libellé exact ;
//   B. une option que la page n'a pas (Type « Chaussures de randonnées » absent) ⇒
//      rien n'est choisi au hasard dans ce menu ;
//   C. l'étape de publication alors qu'un critère de la fiche n'a pas été posé ⇒ la
//      publication ne part PAS (le bandeau le dit) ;
//   D. sans critères (extension d'avant, fiche d'avant) ⇒ la règle d'avant : publiée une fois.
// Et background.js (`criteresFicheLbc`, exécuté dans une VM) : une catégorie hors du
// vocabulaire Leboncoin est REFUSÉE, un critère illisible aussi ; rien d'envoyé ⇒ rien.
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), http = require('http'), path = require('path'), vm = require('vm');
const { spawnSync } = require('child_process');
const LBC = path.join(__dirname, '..', 'vinted-sync-extension', 'lbc.js');
const BG = path.join(__dirname, '..', 'vinted-sync-extension', 'background.js');
let SRC = fs.readFileSync(LBC, 'utf8');
let BGS = fs.readFileSync(BG, 'utf8');
const MUT = {
  // l'ancienne règle : un menu déjà rempli (la prédiction) n'est jamais touché
  prediction: ['lbc', "if (n(val) === n(cible)) return true;            // déjà la bonne", "if (val) return n(val) === n(cible);"],
  // la garde de publication retirée
  garde: ['lbc', 'if (pasPoses.length) return', 'if (false) return'],
  // n'importe quelle option « qui ressemble »
  approx: ['lbc', ".filter((o) => n(o.textContent) === n(cible));\n      if (opts.length === 1) { try { opts[0].click(); } catch (_) {} return true; }\n      try { box.blur(); } catch (_) {}\n      // pas l'option", ".filter((o) => n(o.textContent).includes(n(cible).slice(0, 4)) || true);\n      if (opts.length >= 1) { try { opts[0].click(); } catch (_) {} return true; }\n      try { box.blur(); } catch (_) {}\n      // pas l'option"],
  // une catégorie hors vocabulaire acceptée
  vocabulaire: ['bg', "if (LBC_CATEGORIES_FICHE.indexOf(c) < 0) return { ok: false, raison: 'catégorie inconnue de Leboncoin' };", ''],
};
const argv = process.argv.slice(2);
if (argv.includes('--prouve')) {
  let ok = 0;
  for (const m of Object.keys(MUT)) {
    const r = spawnSync(process.execPath, [__filename, '--mutation=' + m], { encoding: 'utf8', env: { ...process.env, BANC_PORT: String(8430 + Object.keys(MUT).indexOf(m)) } });
    const rouge = r.status !== 0 && /^❌/m.test(r.stdout);
    if (rouge) ok++;
    console.log(`${rouge ? '✅' : '❌'} mutation « ${m} » ${rouge ? 'attrapée' : 'PAS attrapée'}`);
  }
  console.log(`\n${ok}/${Object.keys(MUT).length} mutations attrapées.`);
  process.exit(ok === Object.keys(MUT).length ? 0 : 1);
}
const mut = (/--mutation=(\w+)/.exec(argv.join(' ')) || [])[1];
if (mut) {
  const m = MUT[mut];
  const cible = m && (m[0] === 'lbc' ? SRC : BGS);
  if (!m || !cible.includes(m[1])) { console.log('❌ mutation ' + mut + ' introuvable — l’audit ne prouve rien'); process.exit(1); }
  if (m[0] === 'lbc') SRC = SRC.replace(m[1], m[2]); else BGS = BGS.replace(m[1], m[2]);
  console.log('(mutation : ' + mut + ')');
}
const PORT = Number(process.env.BANC_PORT) || 8417;
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };

// ── background.js : criteresFicheLbc, exécutée telle quelle ──
{
  const a = BGS.indexOf('const LBC_CATEGORIES_FICHE = ');
  const b = BGS.indexOf('\n}\n', BGS.indexOf('function criteresFicheLbc(saisie)'));
  dit(a > 0 && b > a, 'background.js porte criteresFicheLbc (capacité lbccriteres)');
  if (a > 0 && b > a) {
    const ctx = {}; vm.createContext(ctx);
    vm.runInContext(BGS.slice(a, b + 2) + '\nthis.f = criteresFicheLbc;', ctx);
    const f = ctx.f;
    const r1 = f({ categorie: 'Chaussures', criteres: { univers: 'Femme', type: 'Baskets & Sneakers', taille: '38,5', autre: 'x' } });
    dit(r1.ok && r1.categorie === 'Chaussures' && r1.criteres.univers === 'Femme' && !('autre' in r1.criteres), 'BG1 catégorie du vocabulaire + critères nommés passent, un champ inconnu est laissé', JSON.stringify(r1));
    const r2 = f({ categorie: 'Sneakers rares' });
    dit(!r2.ok, 'BG2 une catégorie hors du vocabulaire de Leboncoin est REFUSÉE (fiche entière refusée)', JSON.stringify(r2));
    const r3 = f({ criteres: { univers: '<b>Femme</b>' } });
    dit(!r3.ok, 'BG3 un critère illisible est refusé', JSON.stringify(r3));
    const r4 = f({ title: 'x' });
    dit(r4.ok && !r4.categorie && !r4.criteres, 'BG4 rien d’envoyé ⇒ rien de changé (la règle d’avant)', JSON.stringify(r4));
  }
}

// ── lbc.js dans une vraie page ──
// Un menu à la forme mesurée : un champ role=combobox, son libellé, une liste role=option.
const MENU = (lib, val, options) => `<div class="m"><label>${lib}</label><input role="combobox" aria-label="${lib}" value="${val}" readonly data-opts="${options.join('|')}"></div>`;
const SCRIPT_MENUS = '<scr' + 'ipt>document.addEventListener("click",function(e){var t=e.target;'
  + 'if(t.getAttribute&&t.getAttribute("role")==="combobox"){document.querySelectorAll(".liste").forEach(function(x){x.remove();});var ul=document.createElement("ul");ul.className="liste";ul.setAttribute("role","listbox");'
  + 't.getAttribute("data-opts").split("|").forEach(function(o){var li=document.createElement("li");li.setAttribute("role","option");li.textContent=o;li.onclick=function(){t.value=o;window.__choix=window.__choix||{};window.__choix[t.getAttribute("aria-label")]=o;ul.remove();};ul.appendChild(li);});t.parentNode.appendChild(ul);}},true);</scr' + 'ipt>';
const TYPES = ['Baskets & Sneakers', 'Chaussures à lacets', 'Mocassins', 'Bottines & lowboots', 'Autre'];
const UNIV = ['Femme', 'Homme', 'Enfant'];
const POINT = ['37', '37,5', '38', '38,5', '39'];
const COMPTE = '<scr' + 'ipt>window.__clic=function(k){var s=JSON.parse(sessionStorage.getItem("__clics")||"{}");s[k]=(s[k]||0)+1;sessionStorage.setItem("__clics",JSON.stringify(s));};</scr' + 'ipt>';
const CASES = '<fieldset><label><input type="checkbox" name="gallery"> À la une — Pendant 7 jours 7 €</label><label><input type="checkbox" name="urgent"> Logo urgent — 2,50 €</label></fieldset>';
const PAGES = {
  A: SCRIPT_MENUS + MENU('Univers', 'Homme', UNIV) + MENU('Type de chaussures', '', TYPES) + MENU('Pointure', '', POINT),
  B: SCRIPT_MENUS + MENU('Univers', '', UNIV) + MENU('Type de chaussures', '', TYPES.filter((t) => t !== 'Bottines & lowboots')),
  C: CASES + '<div><button type="button" onclick="__clic(\'pub\')">Déposer mon annonce</button></div>',
  D: CASES + '<div><button type="button" onclick="__clic(\'pub\')">Déposer mon annonce</button></div>',
};
const PAGE = (k) => `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Leboncoin</title></head><body>
<header role="banner"><input name="text" placeholder="Rechercher"></header><main>${COMPTE}${PAGES[k] || ''}</main></body></html>`;
const AD = { id: '3170000002', numero: '402', ref: 'VRM-402', title: 'Nike Air Max 1 T38,5', description: 'Paire en très bon état.\n\nRéf. VRM-402', price: '99', category: 'Chaussures', taille: '38.5', etat: 'Très bon état', photos: ['https://ex/1.jpg'], publier: true };
const initChrome = (d) => {
  window.__msgs = [];
  window.chrome = { runtime: { id: 'banc', lastError: null, getManifest: () => ({ version: '9.9.9' }), sendMessage: (m, cb) => {
    const rep = (o) => { try { cb && cb(o); } catch (_) {} };
    if (m && m.action === 'getPending') return rep({ ok: true, ad: d.ad });
    return rep({ ok: true });
  }, onMessage: { addListener() {} } } };
};
const { chromium } = require(path.join(__dirname, '..', 'node_modules', 'playwright'));
(async () => {
  const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(PAGE((/[?&]cas=([A-Z])/.exec(q.url) || [])[1])); });
  await new Promise((res, rej) => { srv.once('error', rej); srv.listen(PORT, res); }).catch((e) => { console.log('❌ port ' + PORT + ' pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  const ctx = await b.newContext({ viewport: { width: 1200, height: 900 } });
  const lancer = async (cas, ad, chemin) => {
    const pg = await ctx.newPage();
    const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
    await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => r.abort());
    await pg.addInitScript(initChrome, { ad });
    await pg.goto(`http://localhost:${PORT}${chemin}?cas=${cas}`, { waitUntil: 'domcontentloaded' });
    await pg.addScriptTag({ content: SRC });
    await pg.waitForTimeout(6000);
    const r = await pg.evaluate(() => ({ vals: Array.from(document.querySelectorAll('[role=combobox]')).reduce((o, el) => { o[el.getAttribute('aria-label')] = el.value; return o; }, {}),
      clics: JSON.parse(sessionStorage.getItem('__clics') || '{}'), banner: (document.getElementById('vrm-lbc-banner') || {}).innerText || '' }));
    await pg.close();
    return { r, errs };
  };
  try {
    { const { r, errs } = await lancer('A', { ...AD, criteres: { univers: 'Femme', type: 'Baskets & Sneakers', taille: '38,5' } }, '/deposer-une-annonce');
      dit(!errs.length, 'A — aucune erreur', errs[0] || '');
      dit(r.vals.Univers === 'Femme', 'A — l’Univers prédit par Leboncoin (« Homme ») est remplacé par celui de la fiche (« Femme »)', JSON.stringify(r.vals));
      dit(r.vals['Type de chaussures'] === 'Baskets & Sneakers', 'A — le Type de la fiche est choisi au libellé exact', JSON.stringify(r.vals));
      dit(r.vals.Pointure === '38,5', 'A — la pointure traduite (« 38,5 ») est choisie', JSON.stringify(r.vals)); }
    { const { r } = await lancer('B', { ...AD, criteres: { univers: 'Femme', type: 'Bottines & lowboots' } }, '/deposer-une-annonce');
      dit(r.vals['Type de chaussures'] === '', 'B — un Type que la page n’a pas : rien de choisi à la place', JSON.stringify(r.vals));
      dit(r.vals.Univers === 'Femme', 'B — l’autre critère, lui, est posé', JSON.stringify(r.vals)); }
    { const { r } = await lancer('C', { ...AD, criteres: { univers: 'Femme', type: 'Baskets & Sneakers' } }, '/deposer-une-annonce/options');
      dit(!r.clics.pub, 'C — un critère de la fiche jamais posé : la publication ne part PAS', 'clics=' + JSON.stringify(r.clics));
      dit(/Univers/.test(r.banner), 'C — le bandeau nomme ce qui manque', r.banner.replace(/\s+/g, ' ').slice(0, 200)); }
    { const { r } = await lancer('D', { ...AD }, '/deposer-une-annonce/options');
      dit(r.clics.pub === 1, 'D — sans critères (fiche d’avant) : la règle d’avant, publiée une fois', 'clics=' + JSON.stringify(r.clics)); }
  } catch (e) { ko++; console.log('❌ l’audit a levé : ' + (e && e.message)); }
  await b.close(); srv.close();
  console.log(ko ? `\n❌ ${ko} contrôle(s) au rouge` : '\n✅ critères Leboncoin : tout est vert');
  process.exit(ko ? 1 : 0);
})();
