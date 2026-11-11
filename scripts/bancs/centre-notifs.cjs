require(require('path').join(__dirname, '..', '_horloge-notif.cjs'));   // heures calmes : midi (Paris) pour ce banc
require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « CENTRE DE NOTIFICATIONS » (5 nov.) — l'app RENDUE, 390 px tactile et
//  1512 px, clair et sombre.
//
//  Julien (5 nov.) : « une meilleure interface, plus pro, personnalisable comme
//  on veut ; cliquer une notification amène directement sur ce qui est arrivé ».
//  Il juge ce qui est RENDU (data-*, nombres, requêtes envoyées), jamais un
//  libellé exact :
//   A  la cloche de l'en-tête porte le NOMBRE de non-lues, lu en deux scalaires
//      (n, luJusqua, lus) — et rien si la liste n'a pas pu être lue (pas « 0 ») ;
//   B  la feuille liste ce qui a été envoyé, rangé par jour, non-lues marquées,
//      l'état d'une notification qui n'a pas sonné (heures calmes), filtres par
//      type ; aucune cible < 44 px au doigt ; aucun débordement ;
//   C  toucher une entrée : elle est marquée lue (POST de `push_journal_lu`) et
//      l'app ouvre l'objet (l'écran de la cible) ; « Tout marquer lu » ;
//   D  une notification touchée sur le téléphone (`?notif=<n°>`) marque SON entrée lue ;
//   E  « pas su » : la liste illisible dit « — », jamais « aucune » ;
//   F  Réglages → Notifications : huit types, heures calmes (bascule ⇒ POST de
//      `push_prefs` avec `calme.actif`), regroupement, et la carte des e-mails
//      de l'essai qui DIT « pas configuré » et ce qui manque.
//  Données INVENTÉES (le dépôt est public).
//  Lancer : npm run build && BANC_PORT=7973 CHROMIUM_PATH=/opt/pw-browsers/chromium SHOTS=<dossier> node scripts/bancs/centre-notifs.cjs
// ════════════════════════════════════════════════════════════════════════════
const path = require('path'), http = require('http'), fs = require('fs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 7973;
const SHOTS = process.env.SHOTS || '';
const CHROMIUM = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };

const UID = '11111111-2222-3333-4444-555555555555';
const SESSION = { access_token: 'jeton-de-banc', refresh_token: 'r', expires_at: Date.now() + 3600e3, user: { id: UID, email: 'camille.martin@exemple.test' } };
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'boutique_camille', domain: 'www.vinted.fr', updated_at: new Date().toISOString() }];
const ilYa = (min) => new Date(Date.now() - min * 60000).toISOString();
const JOURNAL = {
  n: 6, rev: 'r1',
  entrees: [
    { seq: 6, at: ilYa(12), famille: 'ventes', cat: 'vente', titre: '💸 Vendu !', texte: 'Baskets de banc taille 42 — 45 € (boutique_camille)', url: '/?tab=ventes&site=vinted&cible=vente&tx=90000006', etat: 'envoyee' },
    { seq: 5, at: ilYa(95), famille: 'arrives', cat: 'colis', titre: '📍 Ton colis Mondial Relay t’attend', texte: 'Tabac du Quai, Portville · code 123456 · jusqu’au 12/11', url: '/?tab=cat_bord&cible=retrait&suivi=80000005', etat: 'calme' },
    { seq: 4, at: ilYa(160), famille: 'offres', cat: 'offre', titre: '💰 Offre 30 € de acheteur_banc', texte: 'Sur Sneakers de banc blanches', url: '/?tab=messages&site=vinted&cible=offres', etat: 'envoyee' },
    { seq: 3, at: ilYa(60 * 26), famille: 'doublevente', cat: 'doublevente', titre: '⚠️ N°12 vendu sur Vinted · encore en ligne sur Leboncoin', texte: 'Baskets de banc', url: '/?tab=annonces&site=leboncoin&cible=doublon&plat=leboncoin&num=12', etat: 'envoyee' },
    { seq: 2, at: ilYa(60 * 27), famille: 'rappels', cat: 'soir', titre: '📮 Demain : 2 colis à poster', texte: 'Le premier avant 12 h', url: '/?tab=cat_bord&cible=colonne&colonne=prets', etat: 'sans-appareil' },
    { seq: 1, at: ilYa(60 * 50), famille: 'test', cat: 'test', titre: '🔔 VRM — test réussi !', texte: 'Les notifications push fonctionnent sur cet appareil.', url: '/', etat: 'envoyee' },
  ],
};
const LU = { luJusqua: 2, lus: [4] };                  // non lues : 3, 5, 6 ⇒ 3
const PREFS = { familles: { messages: false } };
const RELANCES = { ok: true, configure: false, manque: ['RELANCES_SMTP_HOTE', 'RELANCES_SMTP_UTILISATEUR', 'RELANCES_SMTP_MOT_DE_PASSE', 'RELANCES_EXPEDITEUR'], proprietaire: true, essai: false, finEssai: null, abonne: true, envois: {} };

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e && e.message || e).slice(0, 240)); } };

const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});

async function ouvrir(nav, vp, { sombre = false, chemin = '/?tab=journee', journalKO = false, journal = JOURNAL, lu = LU } = {}) {
  const mobile = vp.width < 600;
  const ctx = await nav.newContext({ viewport: vp, locale: 'fr-FR', timezoneId: 'Europe/Paris', ...(mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const pg = await ctx.newPage();
  const erreurs = []; pg.on('pageerror', (e) => erreurs.push(e.message));
  const ecrits = [];
  await pg.addInitScript(([s, d]) => { try { localStorage.setItem('vrm_session', JSON.stringify(s)); localStorage.setItem('vinted_dark', JSON.stringify(d)); localStorage.setItem('vinted_last_backup', String(Date.now())); } catch (_) {} }, [SESSION, sombre]);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'jeton-de-banc', refresh_token: 'r', expires_in: 3600, user: SESSION.user }) }));
  await pg.route('**/rest/v1/**', (r) => {
    const req = r.request();
    const u = decodeURIComponent(req.url());
    const j = (d) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (req.method() === 'PATCH') {
      // (5 nov.) « lu » s'écrit en comparer-et-échanger : PATCH filtré sur la ligne.
      const id = (/[?&]id=eq\.([^&]+)/.exec(u) || [])[1];
      try { const b = JSON.parse(req.postData() || '{}'); ecrits.push({ id, data: b.data }); } catch (_) {}
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id }]) });
    }
    if (req.method() !== 'GET') {
      try { for (const l of JSON.parse(req.postData() || '[]')) ecrits.push(l); } catch (_) {}
      return r.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
    }
    if (/select=owner/.test(u)) return j([]);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    if (u.includes('id=eq.push_journal_lu')) return j([{ data: lu }]);
    if (u.includes('id=eq.push_journal')) {
      if (journalKO) return r.fulfill({ status: 522, contentType: 'text/html', body: '<html>522</html>' });
      // La projection telle que l'app la demande : seulement les scalaires nommés.
      if (/select=n:data->n/.test(u)) return j([{ n: journal.n, ...(/depuis:data->depuis/.test(u) ? { depuis: journal.depuis } : {}) }]);
      return j([{ data: journal }]);
    }
    if (u.includes('id=eq.push_prefs')) return j([{ data: PREFS }]);
    return j([]);
  });
  await pg.route('**/api/**', (r) => {
    const u = r.request().url();
    const js = (d) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
    if (/mode=relances/.test(u)) return js(RELANCES);
    if (/mode=abonnement/.test(u)) return js({ ok: true, proprietaire: true, configure: false, obligatoire: false, statut: null });
    if (/email-rattacher/.test(u)) return js({ ok: true, emails: [], installation: null });
    return js({ ok: true, pret: true, devices: 1 });
  });
  await pg.goto(`http://localhost:${PORT}${chemin}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => document.querySelector('.vrm-main') || /pas pu s'afficher/.test(document.body.innerText), null, { timeout: 20000 }).catch(() => {});
  await pg.waitForTimeout(2500);
  return { ctx, pg, erreurs, ecrits };
}

const mesurer = (pg, mobile, racineSel) => pg.evaluate(([mobile, racineSel]) => {
  const visible = (e) => { const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; const s = getComputedStyle(e); return s.visibility !== 'hidden' && s.display !== 'none'; };
  const racine = document.querySelector(racineSel);
  const petites = [];
  if (racine && mobile) {
    for (const e of racine.querySelectorAll('button, a[href], input, select, [role="switch"]')) {
      if (!visible(e)) continue;
      const r = e.getBoundingClientRect();
      if (r.height < 43.5 || (e.tagName !== 'INPUT' && r.width < 43.5)) petites.push(`${e.tagName.toLowerCase()}「${(e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 24)}」${Math.round(r.width)}×${Math.round(r.height)}`);
    }
  }
  // Une rangée qui défile (filtres) a le droit de déborder DANS son conteneur.
  const dansDefileur = (e) => { for (let p = e.parentElement; p && p !== racine; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll') return true; } return false; };
  const sortie = racine ? [...racine.querySelectorAll('*')].filter((e) => visible(e) && !dansDefileur(e) && e.getBoundingClientRect().right > window.innerWidth + 1).map((e) => e.className || e.tagName) : [];
  return { deb: document.documentElement.scrollWidth - document.documentElement.clientWidth, petites, sortie };
}, [mobile, racineSel]);

(async () => {
  await new Promise((res, rej) => { srv.once('error', rej); srv.listen(PORT, res); }).catch((e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
  const nav = await chromium.launch({ executablePath: CHROMIUM, args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
  try {
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      for (const sombre of [false, true]) {
        const mobile = vp.width < 600;
        const T = `${vp.width} px · ${sombre ? 'sombre' : 'clair'}`;
        console.log(`\n── ${T}`);
        await essaie(T, async () => {
          const { ctx, pg, erreurs, ecrits } = await ouvrir(nav, vp, { sombre });
          // A — la cloche
          const cloche = pg.locator('[data-centre-notifs-cloche]');
          await pg.waitForFunction(() => { const c = document.querySelector('[data-centre-notifs-cloche]'); return c && c.getAttribute('data-non-lues') !== ''; }, null, { timeout: 8000 }).catch(() => {});
          const nl = await cloche.first().getAttribute('data-non-lues').catch(() => null);
          const pastille = await pg.locator('[data-centre-notifs-cloche] .vrm-cn-pastille').first().innerText().catch(() => '');
          dit(nl === '3' && pastille.trim() === '3', `${T} · A1 la cloche dit 3 non lues (n=6, lu jusqu’au 2, et le 4)`, `data=${nl} pastille=${pastille}`);
          const bc = await cloche.first().boundingBox().catch(() => null);
          if (mobile) dit(!!bc && bc.width >= 43.5 && bc.height >= 43.5, `${T} · A2 la cloche fait au moins 44 px au doigt`, bc ? `${Math.round(bc.width)}×${Math.round(bc.height)}` : 'absente');
          if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `centre-${vp.width}-${sombre ? 'sombre' : 'clair'}-entete.png`) });
          // B — la feuille
          await cloche.first().click();
          await pg.waitForSelector('[data-centre-notifs][data-centre-etat="lu"]', { timeout: 6000 }).catch(() => {});
          const f = await pg.evaluate(() => {
            const s = document.querySelector('[data-centre-notifs]');
            if (!s) return null;
            const lignes = [...s.querySelectorAll('[data-centre-entree]')];
            return {
              etat: s.getAttribute('data-centre-etat'),
              n: lignes.length,
              nonLues: lignes.filter((l) => l.getAttribute('data-non-lue') === '1').map((l) => Number(l.getAttribute('data-centre-entree'))).sort(),
              jours: s.querySelectorAll('.vrm-cn-jour').length,
              calme: !!s.querySelector('[data-centre-entree="5"] [data-centre-etat-entree="calme"]'),
              sansApp: !!s.querySelector('[data-centre-entree="2"] [data-centre-etat-entree="sans-appareil"]'),
              envoyeeSansPuce: !s.querySelector('[data-centre-entree="6"] [data-centre-etat-entree]'),
              filtres: [...s.querySelectorAll('[data-centre-filtre]')].map((b) => b.getAttribute('data-centre-filtre')),
              toutLu: !!s.querySelector('[data-centre-tout-lu]'),
            };
          });
          dit(f && f.etat === 'lu' && f.n === 6, `${T} · B1 la feuille liste les 6 notifications envoyées`, JSON.stringify(f && { etat: f.etat, n: f.n }));
          dit(f && JSON.stringify(f.nonLues) === JSON.stringify([3, 5, 6]), `${T} · B2 les non lues sont marquées (3, 5, 6)`, JSON.stringify(f && f.nonLues));
          dit(f && f.jours >= 2, `${T} · B3 rangées par jour`, String(f && f.jours));
          dit(f && f.calme && f.sansApp && f.envoyeeSansPuce, `${T} · B4 l’état de celles qui n’ont pas sonné est dit (heures calmes, aucun appareil), rien pour une envoyée`);
          dit(f && f.filtres.includes('ventes') && f.filtres.includes('arrives') && f.filtres.includes('doublevente') && !f.filtres.includes('messages'), `${T} · B5 filtres par type présent`, JSON.stringify(f && f.filtres));
          const m = await mesurer(pg, mobile, '[data-centre-notifs]');
          dit(m.deb <= 1 && m.sortie.length === 0, `${T} · B6 aucun débordement`, `${m.deb} px · dehors : ${m.sortie.slice(0, 4).join(', ')}`);
          if (mobile) dit(m.petites.length === 0, `${T} · B7 aucune cible de moins de 44 px`, m.petites.slice(0, 6).join(' · '));
          if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `centre-${vp.width}-${sombre ? 'sombre' : 'clair'}-feuille.png`) });
          // Filtre
          await pg.locator('[data-centre-filtre="arrives"]').click();
          await pg.waitForTimeout(250);
          const nf = await pg.locator('[data-centre-entree]').count();
          dit(nf === 1, `${T} · B8 le filtre « Codes de retrait » ne laisse que la sienne`, String(nf));
          await pg.locator('[data-centre-filtre="arrives"]').click();
          await pg.waitForTimeout(200);
          // C — toucher la vente : marquée lue + l'écran Ventes s'ouvre
          ecrits.length = 0;
          await pg.locator('[data-centre-entree="6"]').click();
          await pg.waitForTimeout(1200);
          const apres = await pg.evaluate(() => ({ ouverte: !!document.querySelector('[data-centre-notifs]'), ecran: (document.querySelector('.vrm-main') || {}).getAttribute ? document.querySelector('.vrm-main').getAttribute('data-ecran') : null }));
          const luEcrit = ecrits.find((l) => l.id === 'push_journal_lu');
          dit(!apres.ouverte && /ventes/.test(String(apres.ecran)), `${T} · C1 toucher la vente ferme la feuille et ouvre Ventes`, JSON.stringify(apres));
          dit(!!luEcrit && (luEcrit.data.luJusqua >= 6 || (luEcrit.data.lus || []).includes(6)), `${T} · C2 … et la marque lue (push_journal_lu écrit par l’app)`, JSON.stringify(luEcrit && luEcrit.data));
          // Tout marquer lu
          await cloche.first().click();
          await pg.waitForSelector('[data-centre-tout-lu]', { timeout: 5000 }).catch(() => {});
          ecrits.length = 0;
          await pg.locator('[data-centre-tout-lu]').click().catch(() => {});
          await pg.waitForTimeout(500);
          const tout = ecrits.find((l) => l.id === 'push_journal_lu');
          const reste = await pg.locator('[data-centre-entree][data-non-lue="1"]').count();
          dit(!!tout && tout.data.luJusqua === 6 && reste === 0, `${T} · C3 « Tout marquer lu » : lu jusqu’au 6, plus aucune non lue`, JSON.stringify(tout && tout.data) + ` reste=${reste}`);
          await pg.keyboard.press('Escape');
          await pg.waitForTimeout(300);
          dit(erreurs.length === 0, `${T} · aucune erreur d’app`, erreurs.join(' | ').slice(0, 200));
          await ctx.close();
        });
        // F — Réglages → Notifications
        await essaie(`${T} · réglages`, async () => {
          const { ctx, pg, erreurs, ecrits } = await ouvrir(nav, vp, { sombre, chemin: '/?tab=settings' });
          const sous = pg.locator('[data-sous-ouvrir="push"]');
          if (await sous.count()) { await sous.first().click(); await pg.waitForTimeout(800); }
          await pg.locator('[data-famille-notif]').first().waitFor({ state: 'attached', timeout: 6000 }).catch(() => {});
          const types = await pg.locator('[data-famille-notif]').evaluateAll((l) => l.map((e) => e.getAttribute('data-famille-notif')));
          dit(types.length === 8 && ['ventes', 'offres', 'messages', 'poster', 'arrives', 'doublevente', 'rappels', 'comptes'].every((t) => types.includes(t)), `${T} · F1 huit types (dont « Nouveau compte relié ») réglables`, types.join(','));
          ecrits.length = 0;
          const calme = pg.locator('[data-np-calme] [role="switch"]');
          dit(await calme.count() === 1, `${T} · F2 l’interrupteur « Heures calmes » est là`);
          // (8 nov.) Allumées PAR DÉFAUT (22 h → 8 h) sans rien posé : les heures se voient
          // d'emblée ; le toucher les COUPE et l'écrit, le reste de la ligne gardé.
          const heures = await pg.locator('[data-np-heures] input[type="time"]').count();
          const avant = await pg.locator('[data-np-calme]').getAttribute('data-np-calme').catch(() => null);
          dit(heures === 2 && avant === 'on', `${T} · F4 heures calmes allumées par défaut, début et fin visibles`, `${heures} ${avant}`);
          await calme.first().click().catch(() => {});
          await pg.waitForTimeout(500);
          const p = ecrits.find((l) => l.id === 'push_prefs');
          dit(!!p && p.data.calme && p.data.calme.actif === false && p.data.familles && p.data.familles.messages === false, `${T} · F3 heures calmes coupées ⇒ push_prefs.calme.actif:false écrit, le reste de la ligne GARDÉ`, JSON.stringify(p && p.data));
          // (11 nov., lot `notifs-groupees`) Regrouper : Non · 15 · 30 · 60 min (15 par défaut),
          // et l'heure du résumé du soir (Auto par défaut). Chaque choix écrit la ligne entière.
          const fen0 = await pg.locator('[data-np-fenetre]').getAttribute('data-np-fenetre').catch(() => null);
          const choix = await pg.locator('[data-np-fenetre-choix]').evaluateAll((l) => l.map((e) => e.getAttribute('data-np-fenetre-choix')));
          dit(fen0 === '15' && choix.join(',') === 'non,15,30,60', `${T} · F5 « Regrouper » : 15 min par défaut ; Non · 15 · 30 · 60`, `${fen0} · ${choix}`);
          ecrits.length = 0;
          await pg.locator('[data-np-fenetre-choix="30"]').click().catch(() => {});
          await pg.waitForTimeout(500);
          const g30 = ecrits.filter((l) => l.id === 'push_prefs').pop();
          dit(!!g30 && g30.data.groupe && g30.data.groupe.fenetre === 30 && g30.data.regrouper === true && g30.data.familles && g30.data.familles.messages === false
            && await pg.locator('[data-np-fenetre="30"]').count() === 1, `${T} · F5b « 30 min » ⇒ push_prefs.groupe.fenetre:30, le reste GARDÉ`, JSON.stringify(g30 && g30.data));
          await pg.locator('[data-np-fenetre-choix="non"]').click().catch(() => {});
          await pg.waitForTimeout(500);
          const gnon = ecrits.filter((l) => l.id === 'push_prefs').pop();
          dit(!!gnon && gnon.data.regrouper === false && await pg.locator('[data-np-regrouper="off"]').count() === 1, `${T} · F5c « Non » ⇒ regrouper:false (chaque notification seule)`, JSON.stringify(gnon && gnon.data));
          const soir0 = await pg.locator('[data-np-soir]').getAttribute('data-np-soir').catch(() => null);
          await pg.locator('[data-np-soir-choix="21:00"]').click().catch(() => {});
          await pg.waitForTimeout(500);
          const s21 = ecrits.filter((l) => l.id === 'push_prefs').pop();
          dit(soir0 === 'auto' && !!s21 && s21.data.resumeSoir === '21:00' && s21.data.regrouper === false, `${T} · F5d résumé du soir « Auto » par défaut ; « 21 h » ⇒ resumeSoir:'21:00'`, `${soir0} · ${JSON.stringify(s21 && s21.data)}`);
          await pg.locator('[data-np-soir-choix="auto"]').click().catch(() => {});
          await pg.waitForTimeout(500);
          const sa = ecrits.filter((l) => l.id === 'push_prefs').pop();
          dit(!!sa && !('resumeSoir' in sa.data), `${T} · F5e « Auto » retire l’heure (le passage habituel)`, JSON.stringify(sa && sa.data));
          await pg.locator('[data-np-fenetre-choix="15"]').click().catch(() => {});
          await pg.waitForTimeout(400);
          const rel = await pg.evaluate(() => { const e = document.querySelector('[data-relances-essai]'); return e ? { etat: e.getAttribute('data-relances-essai'), codes: e.querySelectorAll('code').length } : null; });
          dit(!!rel && rel.etat === 'non-configure' && rel.codes === 4, `${T} · F6 e-mails de l’essai : « pas configurés » et ce qui manque (au propriétaire)`, JSON.stringify(rel));
          const m = await mesurer(pg, mobile, '.vrm-set');
          dit(m.deb <= 1, `${T} · F7 aucun débordement`, `${m.deb} px`);
          if (mobile) dit(m.petites.filter((x) => !/^input/.test(x)).length === 0, `${T} · F8 aucune cible de moins de 44 px`, m.petites.slice(0, 6).join(' · '));
          if (SHOTS) {
            const haut = await pg.evaluate(() => Math.ceil((document.querySelector('.vrm-set') || document.body).getBoundingClientRect().height + 200));
            await pg.setViewportSize({ width: vp.width, height: Math.min(Math.max(haut, vp.height), 5000) }); await pg.waitForTimeout(300);
            await pg.screenshot({ path: path.join(SHOTS, `centre-${vp.width}-${sombre ? 'sombre' : 'clair'}-reglages.png`) });
          }
          // « Voir les notifications envoyées » ouvre la feuille.
          await pg.setViewportSize(vp);
          await pg.locator('[data-np-voir-centre]').first().click().catch(() => {});
          await pg.waitForTimeout(800);
          dit(await pg.locator('[data-centre-notifs]').count() === 1, `${T} · F9 « Voir les notifications envoyées » ouvre le centre`);
          dit(erreurs.length === 0, `${T} · réglages : aucune erreur d’app`, erreurs.join(' | ').slice(0, 200));
          await ctx.close();
        });
      }
      // D — le toucher d'une notification du téléphone ; E — pas su
      const T = `${vp.width} px`;
      await essaie(`${T} · notif`, async () => {
        const { ctx, pg, ecrits } = await ouvrir(nav, vp, { chemin: '/?tab=ventes&site=vinted&cible=vente&tx=90000006&notif=5' });
        await pg.waitForTimeout(800);
        const l = ecrits.find((x) => x.id === 'push_journal_lu');
        dit(!!l && (l.data.lus || []).includes(5) && l.data.luJusqua === 2, `${T} · D1 ouverte depuis le téléphone (?notif=5) : l’entrée 5 est marquée lue, rien d’autre`, JSON.stringify(l && l.data));
        await ctx.close();
      });
      // G — (revue du 5 nov.) une entrée purgée par le serveur (plus de 30 jours,
      //     au-delà de 150) ne compte plus : la cloche dit ce que la liste montre.
      await essaie(`${T} · purge`, async () => {
        const PURGE = { n: 40, depuis: 37, rev: 'r9', entrees: [40, 39, 38, 37].map((seq, i) => ({ seq, at: ilYa(10 + i * 30), famille: 'ventes', cat: 'vente', titre: '💸 Vendu !', texte: `Article de banc ${seq}`, url: `/?tab=ventes&site=vinted&cible=vente&tx=9000${seq}`, etat: 'envoyee' })) };
        const { ctx, pg } = await ouvrir(nav, vp, { journal: PURGE, lu: {} });
        await pg.waitForFunction(() => { const c = document.querySelector('[data-centre-notifs-cloche]'); return c && c.getAttribute('data-non-lues') !== ''; }, null, { timeout: 8000 }).catch(() => {});
        const nl = await pg.locator('[data-centre-notifs-cloche]').first().getAttribute('data-non-lues').catch(() => null);
        await pg.locator('[data-centre-notifs-cloche]').first().click().catch(() => {});
        await pg.waitForSelector('[data-centre-notifs][data-centre-etat="lu"]', { timeout: 6000 }).catch(() => {});
        const liste = await pg.locator('[data-centre-entree][data-non-lue="1"]').count();
        dit(nl === '4' && liste === 4, `${T} · G1 33 anciennes purgées par le serveur : la cloche dit 4, comme la liste (jamais 40)`, `cloche=${nl} liste=${liste}`);
        await ctx.close();
      });
      await essaie(`${T} · pas su`, async () => {
        const { ctx, pg } = await ouvrir(nav, vp, { journalKO: true });
        const nl = await pg.locator('[data-centre-notifs-cloche]').first().getAttribute('data-non-lues').catch(() => null);
        const past = await pg.locator('[data-centre-notifs-cloche] .vrm-cn-pastille').count();
        dit(nl === '' && past === 0, `${T} · E1 liste illisible : aucune pastille (jamais « 0 » inventé)`, `data=${nl} pastilles=${past}`);
        await pg.locator('[data-centre-notifs-cloche]').first().click().catch(() => {});
        await pg.waitForTimeout(800);
        const etat = await pg.locator('[data-centre-notifs]').first().getAttribute('data-centre-etat').catch(() => null);
        dit(etat === 'passu' && await pg.locator('[data-centre-passu]').count() === 1, `${T} · E2 la feuille dit « — », pas « aucune notification »`, String(etat));
        if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `centre-${vp.width}-passu.png`) });
        await ctx.close();
      });
    }
  } catch (e) { dit(false, 'banc', String(e && e.message || e).slice(0, 200)); }
  finally { await nav.close(); srv.close(); }
  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})();
