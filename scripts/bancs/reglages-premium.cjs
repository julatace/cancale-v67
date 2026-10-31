require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « PARAMÈTRES PREMIUM » — Réglages et Mon compte, RENDUS à 390 et 1512 px.
//
//  Demande de Julien (16 octobre) : « ça fait encore trop vibe-codé ; une
//  meilleure organisation visuelle, surtout sur téléphone ». Paramètres suit le
//  modèle des Réglages d'iOS : des groupes en listes à lignes, et sur téléphone
//  un SOUS-ÉCRAN par panneau long (chevron, puis « ‹ Réglages »).
//
//  Il juge ce qui est RENDU, jamais un libellé exact (§6.5) :
//    1. l'écran s'affiche sans erreur d'app, aux deux tailles, sur les deux
//       onglets — et dans CHAQUE sous-écran du téléphone ;
//    2. aucun débordement horizontal ;
//    3. au téléphone, aucune cible tactile de moins de 44 px (boutons, liens
//       hors d'une phrase, champs, interrupteurs, résumés repliables) ;
//    4. chaque interrupteur visible est cliquable (rien ne le recouvre au point
//       où on tape) et le clic change bien son état — puis le rétablit ;
//    5. téléphone : les panneaux longs ne sont PAS dépliés sur la page racine
//       (un sous-écran les porte), et le retour ramène à la liste ;
//       ordinateur : rien n'est caché (tous les panneaux sont dépliés).
//  Données INVENTÉES (le dépôt est public) — aucune fixture.
//  Captures : SHOTS=<dossier> node scripts/bancs/reglages-premium.cjs
//  Lancer : npm run build && BANC_PORT=52xx node scripts/bancs/reglages-premium.cjs
// ════════════════════════════════════════════════════════════════════════════
const path = require('path'), http = require('http'), fs = require('fs');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('/home/user/cancale-v67/node_modules/playwright')); }
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 5233;
const SHOTS = process.env.SHOTS || '';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };

const SESSION = { access_token: 'jeton-de-banc', refresh_token: 'r', expires_at: Date.now() + 3600e3,
  user: { id: '11111111-2222-3333-4444-555555555555', email: 'camille.martin@exemple.test' } };
const ABO = { ok: true, proprietaire: false, configure: true, modeTest: true, obligatoire: false, prix: { montant: 12.99, devise: 'eur', intervalle: 'month' }, prixConforme: true, prixStripe: null,
  statut: 'active', finPeriode: '2026-11-04T10:00:00.000Z', annuleFinPeriode: false, peutGerer: true, actif: true, acces: true };
const FACTURES = { ok: true, carte: { marque: 'visa', fin: '4242', mois: 12, annee: 2027 },
  factures: [{ id: 'in_1', numero: 'VRM-0001', date: '2026-10-04T10:00:00.000Z', montant: 12.99, devise: 'eur', statut: 'paid', pdf: 'https://pay.stripe.com/invoice/x/pdf', page: null }] };
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'boutique_camille', domain: 'www.vinted.fr', updated_at: new Date().toISOString() }];
const REGLAGES = {
  push_prefs: { vente: true, bordereau: true, argent: true, suivi: true, message: true },
  vrm_email_owners: { adresses: { 'camille.martin@exemple.test': { owner: SESSION.user.id } } },
  vrm_email_config: { startDate: '2026-07-10' },
};

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e && e.message || e).slice(0, 200)); } };

const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});

async function ouvrir(nav, vp, vue) {
  const mobile = vp.width < 600;
  const ctx = await nav.newContext({ viewport: vp, permissions: ['notifications'], ...(mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const pg = await ctx.newPage();
  const erreurs = []; pg.on('pageerror', (e) => erreurs.push(e.message));
  await pg.addInitScript(([s, v]) => { try { localStorage.setItem('vrm_session', JSON.stringify(s)); localStorage.setItem('vrm_reglages_vue', v); localStorage.setItem('vrm_widget_token', 'cle-de-banc-123'); localStorage.setItem('vinted_last_backup', String(Date.now() - 3 * 86400000)); } catch (_) {} }, [SESSION, vue]);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'jeton-de-banc', refresh_token: 'r', expires_in: 3600, user: SESSION.user }) }));
  await pg.route('**/rest/v1/**', (r) => {
    const u = decodeURIComponent(r.request().url());
    const j = (d) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (r.request().method() !== 'GET') return r.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
    if (/select=owner/.test(u)) return j([]);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    for (const k of Object.keys(REGLAGES)) if (u.includes('id=eq.' + k)) return j([{ data: REGLAGES[k] }]);
    return j([]);
  });
  await pg.route('**/api/**', (r) => {
    const u = r.request().url();
    if (/mode=abonnement/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ABO) });
    if (/mode=factures/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FACTURES) });
    if (/mode=detourage/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, ready: true, autorise: true, n: 12, plafond: 100 }) });
    if (/email-rattacher/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, emails: [], installation: null }) });
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"pret":true}' });
  });
  await pg.goto(`http://localhost:${PORT}/?tab=settings`, { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => document.querySelector('.vrm-set') || /pas pu s'afficher/.test(document.body.innerText), null, { timeout: 15000 }).catch(() => {});
  await pg.waitForTimeout(2500);
  return { ctx, pg, erreurs };
}

// Ce qui se lit sur la page : débordement, écran tombé, cibles trop petites.
const mesurer = (pg, mobile) => pg.evaluate((mobile) => {
  const visible = (e) => { const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; const s = getComputedStyle(e); return s.visibility !== 'hidden' && s.display !== 'none' && !e.closest('[hidden]'); };
  const racine = document.querySelector('.vrm-set');
  const petites = [];
  if (racine && mobile) {
    for (const e of racine.querySelectorAll('button, a[href], input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]), select, textarea, summary, [role="switch"]')) {
      if (!visible(e)) continue;
      // Un lien DANS une phrase est exempté (WCAG 2.5.8 : cible en ligne dans un texte).
      if (e.tagName === 'A' && getComputedStyle(e).display === 'inline') continue;
      const r = e.getBoundingClientRect();
      if (r.height < 43.5 || (e.tagName !== 'INPUT' && e.tagName !== 'SUMMARY' && e.tagName !== 'TEXTAREA' && r.width < 43.5)) petites.push(`${e.tagName.toLowerCase()}「${(e.innerText || e.getAttribute('aria-label') || e.value || '').trim().slice(0, 28)}」${Math.round(r.width)}×${Math.round(r.height)}`);
    }
  }
  return {
    deb: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    tombe: /pas pu s'afficher|Cannot access|is not defined/.test(document.body.innerText),
    petites,
    sous: [...document.querySelectorAll('[data-sous-ouvrir]')].filter(visible).map((e) => e.getAttribute('data-sous-ouvrir')),
    panneauxVisibles: [...document.querySelectorAll('[data-sous-ecran]')].filter(visible).length,
    disposition: racine ? racine.getAttribute('data-reglages-disposition') : null,
  };
}, mobile);

// Chaque interrupteur visible : rien ne le recouvre là où on tape, et le clic
// change son état ; un second clic le rétablit.
async function interrupteurs(pg, T) {
  const loc = pg.locator('.vrm-set [role="switch"]');
  const n = await loc.count();
  let vus = 0;
  for (let i = 0; i < n; i++) {
    const s = loc.nth(i);
    if (!(await s.isVisible())) continue;
    vus++;
    const nom = (await s.getAttribute('aria-label')) || `n°${i}`;
    await s.scrollIntoViewIfNeeded();
    const libre = await s.evaluate((el) => { const r = el.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2; const h = document.elementFromPoint(x, y); return !!h && (h === el || el.contains(h)); });
    if (await s.isDisabled()) { dit(libre, `${T} interrupteur « ${nom} » (désactivé : réglage pas lu) rien ne le recouvre`); continue; }
    const avant = await s.getAttribute('aria-checked');
    await s.click({ timeout: 4000 });
    await pg.waitForTimeout(450);
    const s2 = pg.locator('.vrm-set [role="switch"]').nth(i);
    const apres = await s2.getAttribute('aria-checked');
    dit(libre && avant !== apres, `${T} interrupteur « ${nom} » : cliquable, et le clic change son état`, `${avant} → ${apres}${libre ? '' : ' · RECOUVERT'}`);
    await s2.click({ timeout: 4000 }).catch(() => {});
    await pg.waitForTimeout(350);
  }
  return vus;
}

(async () => {
  await new Promise((res, rej) => { srv.once('error', rej); srv.listen(PORT, res); }).catch((e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
  try {
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      const mobile = vp.width < 600;
      for (const vue of ['reglages', 'compte']) {
        const T = `${vp.width} px · ${vue === 'compte' ? 'Mon compte' : 'Réglages'}`;
        console.log(`\n── ${T}`);
        await essaie(T, async () => {
          const { ctx, pg, erreurs } = await ouvrir(nav, vp, vue);
          const m = await mesurer(pg, mobile);
          if (SHOTS) {
            await pg.screenshot({ path: path.join(SHOTS, `reglages-${vue}-${vp.width}-ecran.png`) });
            const haut = await pg.evaluate(() => Math.ceil((document.querySelector('.vrm-set') || document.body).getBoundingClientRect().height + 300));
            await pg.setViewportSize({ width: vp.width, height: Math.min(Math.max(haut, vp.height), 9000) }); await pg.waitForTimeout(400);
            await pg.screenshot({ path: path.join(SHOTS, `reglages-${vue}-${vp.width}.png`) });
            await pg.setViewportSize(vp); await pg.waitForTimeout(300);
          }
          dit(!m.tombe && erreurs.length === 0, `${T} : l’écran s’affiche, sans erreur d’app`, erreurs.join(' | ').slice(0, 160));
          dit(m.deb <= 1, `${T} : aucun débordement horizontal`, `${m.deb} px`);
          dit(m.disposition === (mobile ? 'telephone' : 'ordinateur'), `${T} : disposition ${mobile ? 'téléphone (sous-écrans)' : 'ordinateur (tout déplié)'}`, String(m.disposition));
          if (mobile) {
            dit(m.petites.length === 0, `${T} : aucune cible tactile de moins de 44 px`, m.petites.slice(0, 6).join(' · '));
          }
          // Depuis le 28 oct. (77633d9, « Clarifier les paramètres ») les panneaux longs
          // s'ouvrent dans un écran dédié AUSSI sur ordinateur : la liste reste courte.
          dit(m.sous.length >= 3 && m.panneauxVisibles === 0, `${T} : les panneaux longs sont derrière un chevron (rien de déplié sur la liste)`, `${m.sous.length} sous-écrans · ${m.panneauxVisibles} panneau(x) visible(s)`);
          const n = await interrupteurs(pg, T);
          if (vue === 'reglages') dit(n >= 3, `${T} : les interrupteurs de la page sont là (sombre, stream, alertes)`, `${n} vu(s)`);
          // Chaque sous-écran : rendu, sans débordement (ni petite cible au doigt), puis retour.
          {
            for (const id of m.sous) {
              await pg.locator(`[data-sous-ouvrir="${id}"]`).first().click();
              await pg.waitForTimeout(700);
              const s = await mesurer(pg, true);
              const titre = await pg.evaluate(() => (document.querySelector('.vrm-set-sous-h') || {}).innerText || '');
              if (SHOTS) {
                const haut = await pg.evaluate(() => Math.ceil((document.querySelector('.vrm-set') || document.body).getBoundingClientRect().height + 300));
                await pg.setViewportSize({ width: vp.width, height: Math.min(Math.max(haut, vp.height), 6000) }); await pg.waitForTimeout(300);
                await pg.screenshot({ path: path.join(SHOTS, `reglages-${vue}-${vp.width}-sous-${id}.png`) });
                await pg.setViewportSize(vp); await pg.waitForTimeout(200);
              }
              dit(!s.tombe && s.deb <= 1 && s.panneauxVisibles === 1 && !!titre, `${T} › « ${titre} » : un seul panneau, sans débordement`, `déb ${s.deb} · ${s.panneauxVisibles} panneau(x)`);
              if (mobile) dit(s.petites.length === 0, `${T} › « ${titre} » : aucune cible de moins de 44 px`, s.petites.slice(0, 6).join(' · '));
              // §7 : le titre du sous-écran ne se redit pas juste dessous (« Sécurité des
              // données » ×2, revue du 17 oct.). On compte les TITRES RENDUS égaux au titre :
              // éléments visibles (un titre caché par CSS ne compte pas), le plus profond qui
              // porte le texte, hors bouton ou lien — un bouton qui porte le même mot est un
              // GESTE (« Fermer mon compte » s'ouvre en deux temps, exprès), pas un titre.
              const nTitre = await pg.evaluate((t) => {
                const vis = (e) => { const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; const st = getComputedStyle(e); return st.visibility !== 'hidden' && st.display !== 'none' && !e.closest('[hidden]'); };
                const egal = (e) => (e.innerText || '').trim() === t.trim();
                return [...document.querySelectorAll('.vrm-set *')].filter((e) => egal(e) && vis(e) && ![...e.children].some(egal) && !e.closest('button, a, summary')).length;
              }, titre);
              dit(nTitre === 1, `${T} › « ${titre} » : le titre n’est écrit qu’une fois`, `${nTitre} fois`);
              await interrupteurs(pg, `${T} › ${titre}`);
              await pg.locator('[data-sous-retour]').click();
              await pg.waitForTimeout(500);
              const r = await mesurer(pg, true);
              dit(r.sous.includes(id) && r.panneauxVisibles === 0, `${T} › « ${titre} » : le retour ramène à la liste`);
            }
          }
          dit(erreurs.length === 0, `${T} : toujours aucune erreur d’app après les gestes`, erreurs.join(' | ').slice(0, 160));
          await ctx.close();
        });
      }
    }
  } catch (e) { dit(false, 'banc', String(e && e.message || e).slice(0, 200)); }
  finally { await nav.close(); srv.close(); }
  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})();
