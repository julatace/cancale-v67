// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  BANC « LA CONFIRMATION DE SUPPRESSION N'EST CLIQUÉE QUE SI ELLE EST SANS DOUTE » (ext. 5.441, 23 nov.)
//
//  Relevé par l'agent Republier : l'étape `supprimer` de vrm-formulaire.js cliquait, dans la fenêtre de confirmation,
//  le PREMIER bouton dont le texte CONTENAIT « supprimer / confirmer / delete » (hors « annuler »). Un « Ne pas supprimer »
//  placé avant, ou deux boutons de confirmation, et VRM cliquait au hasard sur un geste irréversible.
//  Une FAUSSE page vinted.fr (jamais le vrai Vinted) ; le VRAI vrm-formulaire.js y joue l'étape `supprimer`. On juge :
//   S1  [Annuler] [Supprimer] ⇒ « Supprimer » cliqué, la suppression part (témoin) ;
//   S2  [Ne pas supprimer] [Supprimer] ⇒ « Supprimer » (jamais « Ne pas supprimer ») ;
//   S3  [Supprimer] [Confirmer] (deux confirmations) ⇒ AUCUN clic, `supprimer-confirmation-ambigue`, rien n'est supprimé ;
//   S4  deux fenêtres ouvertes ⇒ aucun clic dans aucune, rien n'est supprimé ;
//   S5  [Supprimer l'annonce et mes données ?] seul (nom non exact) ⇒ aucun clic, rien n'est supprimé.
//  `BANC_EXT=<dossier>` : une autre copie (rouge attendu sur la 5.440). `--prouve` : mutations. Données inventées.
// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
require('./_porte-banc.cjs');
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const { chromium } = require('playwright');
const EXT0 = process.env.BANC_EXT || path.join(__dirname, '..', '..', 'vinted-sync-extension');
const MUTATIONS = {
  'premier-venu': ["    return x.el || (x.ambigu ? 'AMBIGU' : null);\n  }\n  const RE_CONFIRMER_SUPPRESSION", "    return x.el || null;\n  }\n  const RE_CONFIRMER_SUPPRESSION"],
  'contient': ["  const RE_CONFIRMER_SUPPRESSION = /^(", "  const RE_CONFIRMER_SUPPRESSION = /("],
};
if (process.argv.includes('--prouve')) {
  let rate = 0;
  for (const m of Object.keys(MUTATIONS)) {
    const r = cp.spawnSync(process.execPath, [__filename, '--mutation', m], { encoding: 'utf8' });
    const rouge = r.status === 1 && /❌ S/.test(r.stdout || '');
    console.log(`${rouge ? '✅' : '❌'} mutation « ${m} » ⇒ ${rouge ? 'rouge' : 'PAS rouge'}`); if (!rouge) rate++;
  }
  process.exit(rate ? 1 : 0);
}
let FORM = fs.readFileSync(path.join(EXT0, 'vrm-formulaire.js'), 'utf8');
const im = process.argv.indexOf('--mutation');
if (im > 0) { const M = MUTATIONS[process.argv[im + 1]]; if (!M || !FORM.includes(M[0])) { console.log('mutation introuvable'); process.exit(2); } FORM = FORM.split(M[0]).join(M[1]); }
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d ? '  → ' + String(d).slice(0, 400) : '')); } };
const ID = '7001234';
const DIALOGUE = (boutons) => `<div role="dialog" aria-modal="true" class="dl">${boutons.map((b, i) => `<button type="button" data-b="${i}">${b}</button>`).join('')}</div>`;
const PAGE = (fenetres) => `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>.dl{position:fixed;top:100px;left:100px;background:#fff;border:1px solid #999;padding:20px;display:none}.dl.on{display:block}.dl+.dl{top:300px}</style></head><body>
<main><h1>Nike Dunk</h1><button type="button" data-testid="item-delete-button">Supprimer</button></main>${fenetres.map(DIALOGUE).join('')}
<script>window.__clics=[];window.__suppr=0;
document.querySelector('[data-testid="item-delete-button"]').addEventListener('click',()=>{document.querySelectorAll('.dl').forEach((d)=>d.classList.add('on'));});
document.querySelectorAll('.dl button').forEach((b)=>b.addEventListener('click',()=>{window.__clics.push(b.textContent);if(/^(Supprimer|Confirmer)$/.test(b.textContent)){fetch('/api/v2/items/${ID}/delete',{method:'POST'}).then(()=>{window.__suppr++;});}document.querySelectorAll('.dl').forEach((d)=>d.classList.remove('on'));}));
</script></body></html>`;

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  const cas = async (nom, fenetres, juge) => {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, locale: 'fr-FR' });
    const pg = await ctx.newPage();
    await ctx.route('**/*', (r) => { const u = new URL(r.request().url()); if (u.pathname === `/api/v2/items/${ID}/delete`) return r.fulfill({ status: 200, contentType: 'application/json', body: '{"code":0}' }); return r.fulfill({ status: 200, contentType: 'text/html', body: PAGE(fenetres) }); });
    await pg.goto(`https://www.vinted.fr/items/${ID}-nike-dunk`);
    try {
      await pg.addScriptTag({ content: FORM });
      const r = await pg.evaluate((id) => globalThis.__vrmFormulaire('supprimer', { id }), ID);
      await pg.waitForTimeout(300);
      const etat = await pg.evaluate(() => ({ clics: window.__clics.slice(), suppr: window.__suppr }));
      await juge(r || {}, etat);
    } catch (x) { dit(false, `${nom} — a levé`, x && x.message); }
    await ctx.close();
  };
  try {
    await cas('S1', [['Annuler', 'Supprimer']], async (r, e) => dit(r.ok === true && e.clics.join() === 'Supprimer' && e.suppr === 1, 'S1 [Annuler] [Supprimer] ⇒ « Supprimer » cliqué, la suppression part', JSON.stringify({ r: { ok: r.ok, m: r.manque }, e })));
    await cas('S2', [['Ne pas supprimer', 'Supprimer']], async (r, e) => dit(e.clics.join() === 'Supprimer' && !e.clics.includes('Ne pas supprimer'), 'S2 [Ne pas supprimer] [Supprimer] ⇒ « Supprimer », jamais « Ne pas supprimer »', JSON.stringify({ r: { ok: r.ok, m: r.manque }, e })));
    await cas('S3', [['Supprimer', 'Confirmer']], async (r, e) => dit(r.ok === false && r.manque === 'supprimer-confirmation-ambigue' && !e.clics.length && e.suppr === 0, 'S3 deux confirmations ⇒ aucun clic, « ambigu », rien n’est supprimé', JSON.stringify({ r: { ok: r.ok, m: r.manque }, e })));
    await cas('S4', [['Annuler', 'Supprimer'], ['Annuler', 'Supprimer']], async (r, e) => dit(r.ok === false && !e.clics.length && e.suppr === 0, 'S4 deux fenêtres ouvertes ⇒ aucun clic, rien n’est supprimé', JSON.stringify({ r: { ok: r.ok, m: r.manque }, e })));
    await cas('S5', [['Supprimer l’annonce et mes données ?']], async (r, e) => dit(r.ok === false && !e.clics.length && e.suppr === 0, 'S5 un seul bouton au nom NON exact ⇒ aucun clic, rien n’est supprimé', JSON.stringify({ r: { ok: r.ok, m: r.manque }, e })));
  } finally { await b.close(); }
  console.log(`\n${ko ? '❌' : '✅'} confirmation de suppression : ${ok} bon(s), ${ko} défaut(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
