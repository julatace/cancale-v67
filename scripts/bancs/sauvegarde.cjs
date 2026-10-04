// ═══════════════════════════════════════════════════════════════════════════
// BANC : LA SAUVEGARDE COMPLÈTE ET SA RESTAURATION (node scripts/bancs/sauvegarde.cjs)
// ═══════════════════════════════════════════════════════════════════════════
// Revue adverse du 4 octobre : le fichier « sans tes connexions Vinted » portait
// les jetons des comptes (la copie du navigateur), restaurer une vieille
// sauvegarde rendait libres les numéros posés depuis (§5 : un numéro écrit sur
// un carton ne sert jamais deux fois), et « ✓ restaurée » s'affichait même
// quand l'écriture dans le nuage avait échoué. Aucune fixture : des données
// inventées. Ce banc CLIQUE pour de vrai et lit le fichier téléchargé.
const { chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');

const DIST = path.join(__dirname, '..', '..', 'dist');   // ⚠️ JAMAIS un chemin absolu (§6.1)
const PORT = 4545;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.svg':'image/svg+xml', '.zip':'application/zip', '.webmanifest':'application/manifest+json' };
const SESSION = { access_token: 'jeton-de-banc', refresh_token: 'r', expires_at: Date.now() + 3600e3,
  user: { id: '11111111-2222-3333-4444-555555555555', email: 'sophie@exemple.fr' } };

let ko = 0;
const dit = (bon, quoi, detail) => { if (!bon) ko++; console.log(`${bon ? '✅' : '❌'} ${quoi}${detail ? ' — ' + detail : ''}`); };

const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0];
  if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end('nope'); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
  r.end(fs.readFileSync(p));
});

// Ce que le navigateur porte AVANT : la copie COMPLÈTE des comptes (jetons
// compris — c'est vrai dans l'app, `fetchVintedAccounts` lit `select=*`).
const LOCAL = {
  vinted_accounts: [{ id: 1, vinted_user_id: '111', login: 'vendeur_banc', domain: 'www.vinted.fr', access_token: 'SECRET-ACCES-111', refresh_token: 'SECRET-REFRESH-111', csrf_token: 'SECRET-CSRF-111' }],
  vrm_widget_token: 'SECRET-WIDGET-CLE',
  vinted_used_numeros: [1, 2, 3, 4, 5],
  vinted_annonce_numeros: { A: { num: '1' }, C: { num: '5' } },
  vinted_goal: 500,
};
// Les lignes captées : une boîte de messages qui cite un jeton en profondeur,
// et deux lignes qui ne doivent JAMAIS quitter la base.
const LIGNES = [
  { id: 'harvest_111_inbox', data: { payload: { conversations: [{ id: 9, opposite_user: { login: 'acheteuse' }, session: { access_token: 'SECRET-PROFOND' } }] } } },
  { id: 'ebay_tokens', data: { refresh_token: 'SECRET-EBAY' } },
  { id: 'push_subs', data: { subs: [{ endpoint: 'https://push/x', keys: { p256dh: 'SECRET-P256', auth: 'a' } }] } },
];

function exclusDe(u) {
  const m = decodeURIComponent(u).match(/and=\(([^)]*)\)/);
  if (!m) return [];
  return m[1].split(',').map((x) => x.replace(/^id\.not\.like\./, '')).map((x) => new RegExp('^' + x.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/_/g, '.') + '$'));
}

async function monter(nav, { lignesKO = false, patchKO = false } = {}) {
  const ctx = await nav.newContext({ viewport: { width: 1512, height: 1000 }, acceptDownloads: true });
  const pg = await ctx.newPage();
  await pg.addInitScript(([s, l]) => {
    if (sessionStorage.getItem('__monte')) return;   // une seule fois : un rechargement garde ce qui a été écrit
    sessionStorage.setItem('__monte', '1');
    try { localStorage.setItem('vrm_session', JSON.stringify(s)); } catch (_) {}
    for (const k of Object.keys(l)) { try { localStorage.setItem(k, JSON.stringify(l[k])); } catch (_) {} }
  }, [SESSION, LOCAL]);
  await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ access_token: 'jeton-de-banc', refresh_token: 'r', expires_in: 3600, user: SESSION.user }) }));
  const patchs = [];
  await pg.route('**/rest/v1/**', (r) => {
    const req = r.request(); const u = metaVersData(req.url()); const m = req.method();
    const J = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', headers: { 'content-range': '0-0/0' }, body: JSON.stringify(o) });
    if (m === 'PATCH' && /id=eq\.main/.test(u)) {
      try { patchs.push(JSON.parse(req.postData() || '{}')); } catch (_) { patchs.push(null); }
      return patchKO ? r.fulfill({ status: 522, contentType: 'text/html', body: '<html>522</html>' }) : r.fulfill({ status: 204, body: '' });
    }
    if (m !== 'GET') return r.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
    if (/select=owner/.test(u) || /select=id&limit=1/.test(u)) return J([]);
    if (/id=eq\.main/.test(u)) return J([{ id: 'main', data: {} }]);
    if (/app_data\?select=id,data&and=/.test(u)) {
      if (lignesKO) return r.fulfill({ status: 522, contentType: 'text/html', body: '<html>522</html>' });
      const ex = exclusDe(u);
      return J(LIGNES.filter((l) => !ex.some((re) => re.test(l.id))));
    }
    if (/app_data\?select=id,meta&or=/.test(u)) return J([{ id: 'harvest_111_txn_9', meta: { status: '450' } }]);
    if (/vinted_accounts\?select=vinted_user_id,login,domain/.test(u)) return J([{ vinted_user_id: '111', login: 'vendeur_banc', domain: 'www.vinted.fr' }]);
    return J([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await pg.route('**://*.vinted.net/**', (r) => r.abort());
  await pg.route('**://*.vinted.com/**', (r) => r.abort());
  const erreurs = []; pg.on('pageerror', (e) => erreurs.push(String(e).slice(0, 140)));
  await pg.goto(`http://localhost:${PORT}/?tab=settings`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(4000);
  return { ctx, pg, patchs, erreurs };
}

async function exporter(nav, opts) {
  const { ctx, pg, erreurs } = await monter(nav, opts);
  let fichier = null;
  try {
    const [dl] = await Promise.all([pg.waitForEvent('download', { timeout: 15000 }), pg.getByText('Sauvegarde complète (1 clic)').first().click()]);
    fichier = fs.readFileSync(await dl.path(), 'utf8');
  } catch (e) { erreurs.push('téléchargement : ' + e.message); }
  await pg.waitForTimeout(600);
  const stamp = await pg.evaluate(() => localStorage.getItem('vinted_last_backup'));
  await ctx.close();
  return { fichier, stamp, erreurs };
}

async function restaurer(nav, opts, contenu) {
  const { ctx, pg, patchs, erreurs } = await monter(nav, opts);
  const tmp = path.join(require('os').tmpdir(), 'vrm-banc-restauration.json');
  fs.writeFileSync(tmp, JSON.stringify(contenu));
  let recharge = false, vu = '';
  try {
    const [fc] = await Promise.all([pg.waitForEvent('filechooser', { timeout: 10000 }), pg.getByText('Restaurer une sauvegarde').first().click()]);
    await fc.setFiles(tmp);
    const nav = pg.waitForEvent('framenavigated', { timeout: 6000 }).then(() => true, () => false);
    await pg.getByRole('button', { name: /Confirmer/ }).first().click({ timeout: 8000 });
    // Le message (un toast) ne reste que quelques secondes : on le guette tout de suite.
    for (let i = 0; i < 25 && !vu; i++) { try { const t = await pg.evaluate(() => document.body.innerText || ''); const m = t.match(/[^\n]*(n.a pas pu être enregistrée|Sauvegarde restaurée)[^\n]*/gi); if (m) vu = m.join(' | '); } catch (_) {} await pg.waitForTimeout(200); }
    recharge = await nav;
  } catch (e) { erreurs.push('restauration : ' + e.message); }
  await pg.waitForTimeout(1500);
  let local = {}, texte = '';
  try {
    local = await pg.evaluate(() => ({ goal: localStorage.getItem('vinted_goal'), pool: localStorage.getItem('vinted_used_numeros') }));
    texte = await pg.evaluate(() => document.body.innerText || '');
  } catch (_) {}
  await ctx.close();
  return { patchs, recharge, local, texte: vu || texte, erreurs };
}

(async () => {
  try { await new Promise((res, rej) => { srv.once('error', (e) => rej(e.code === 'EADDRINUSE' ? new Error(`le port ${PORT} est déjà pris — relance ce banc seul.`) : e)); srv.listen(PORT, res); }); }
  catch (e) { console.log('❌ ' + e.message); process.exit(1); }
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    console.log('── LE FICHIER');
    const ok = await exporter(nav, {});
    dit(!ok.erreurs.length, 'la sauvegarde se télécharge sans erreur', ok.erreurs[0] || '');
    const j = (() => { try { return JSON.parse(ok.fichier || 'null'); } catch (_) { return null; } })();
    dit(!!j && j._cancale_backup === 3, 'c\'est une sauvegarde v3 lisible');
    dit(!!ok.fichier && !/SECRET-/.test(ok.fichier), 'AUCUN secret dans le fichier (jetons Vinted, eBay, téléphones, widget, ni jeton en profondeur)',
      ((ok.fichier || '').match(/SECRET-[A-Z0-9-]+/g) || []).join(', '));
    dit(!!j && /acheteuse/.test(JSON.stringify(j.donnees || {})), 'les données captées y sont (la boîte de messages)');
    dit(!!j && Array.isArray(j.keys && j.keys.vinted_accounts) && j.keys.vinted_accounts[0].login === 'vendeur_banc', 'la liste des comptes reste (sans les jetons)');
    dit(!!j && j.complet === true, 'le fichier se dit complet quand tout a été lu', j ? JSON.stringify(j.manques) : '');
    dit(!!ok.stamp, '« dernière sauvegarde » est notée pour un fichier complet');

    const ko1 = await exporter(nav, { lignesKO: true });
    const j2 = (() => { try { return JSON.parse(ko1.fichier || 'null'); } catch (_) { return null; } })();
    dit(!!j2 && j2.complet === false && (j2.manques || []).length > 0, 'une page ratée ⇒ le fichier dit qu\'il est INCOMPLET et ce qui manque', j2 ? JSON.stringify(j2.manques) : '(pas de fichier)');
    dit(!ko1.stamp, '… et « dernière sauvegarde : aujourd\'hui ✅ » n\'est PAS posée', String(ko1.stamp));

    console.log('\n── LA RESTAURATION D\'UNE VIEILLE SAUVEGARDE');
    const VIEUX = { _cancale_backup: 3, exportDate: '2026-10-01T00:00:00Z', keys: {
      vinted_used_numeros: [1, 2, 3], vinted_annonce_numeros: { A: { num: '9' }, B: { num: '2' } },
      vinted_accounts: [{ vinted_user_id: '111', access_token: 'SECRET-DU-FICHIER' }], vrm_widget_token: 'SECRET-WIDGET-FICHIER', vinted_goal: 999 } };
    const r1 = await restaurer(nav, {}, VIEUX);
    const p = r1.patchs[r1.patchs.length - 1] || {};
    const d = p.data || {};
    dit(r1.patchs.length >= 1, 'la restauration écrit dans le nuage', `${r1.patchs.length} écriture(s)`);
    const pool = (d.vinted_used_numeros || []).map(String);
    dit(['1', '2', '3', '4', '5'].every((n) => pool.includes(n)), 'le pool des numéros est l\'UNION : 4 et 5, posés depuis, restent réservés (§5)', JSON.stringify(d.vinted_used_numeros));
    const an = d.vinted_annonce_numeros || {};
    dit(an.C && an.C.num === '5' && an.B && an.B.num === '2', 'une fiche numérotée depuis reste ; une fiche perdue revient', JSON.stringify(an));
    dit(an.A && an.A.num === '1', 'un numéro EN PLACE gagne sur celui du fichier (le carton dit 1)', JSON.stringify(an.A));
    dit(!/SECRET-DU-FICHIER|SECRET-WIDGET-FICHIER/.test(JSON.stringify(p)), 'ni jetons ni clé du widget repris du fichier');
    dit(!/SECRET-ACCES|SECRET-REFRESH/.test(JSON.stringify(p)), 'et la copie qui part au nuage est allégée (aucun jeton dans main)');
    dit(d.vinted_goal === 999, 'les autres réglages sont bien restaurés', String(d.vinted_goal));

    console.log('\n── L\'ÉCRITURE ÉCHOUE');
    const r2 = await restaurer(nav, { patchKO: true }, VIEUX);
    dit(!r2.recharge, 'pas de rechargement quand le nuage n\'a pas enregistré');
    dit(/n.a pas pu être enregistrée/i.test(r2.texte) && !/Sauvegarde restaurée/i.test(r2.texte), 'et l\'écran le DIT, sans « ✓ restaurée »', (r2.texte.match(/[^\n]*(restaur|enregistr)[^\n]*/i) || [''])[0].slice(0, 140));
    dit(r2.local.goal === '500', 'les réglages d\'avant sont remis dans le navigateur', String(r2.local.goal));
  } catch (e) { ko++; console.log('❌ le banc a levé — ' + (e && e.message)); }
  await nav.close(); srv.close();
  console.log(`\n${ko ? '❌ ' + ko + ' contrôle(s) au rouge.' : '✅ La sauvegarde ne porte aucun secret, et la restauration ne libère aucun numéro.'}`);
  process.exit(ko ? 1 : 0);
})();
