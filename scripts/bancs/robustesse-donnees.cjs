// ════════════════════════════════════════════════════════════════════════════
//  BANC « ROBUSTESSE DES DONNÉES » (11 nov., revue de robustesse — couche données)
//
//  L'app RENDUE (dist/), une base à état à la vraie forme (`_base-ecritures.cjs`),
//  aucune `fx/` (le dépôt est public : tout est inventé ici). Cinq scènes :
//   lbc       — `vinted_lbc_posted` illisible : RIEN n'est publié pour le logo de
//               leboncoin.fr (avant : une liste « à retirer » VIDE effaçait l'alerte).
//   leboncoin — même panne, écran Leboncoin : « — à publier », la file est vide et
//               l'écran dit pourquoi (avant : toutes les paires déjà publiées, à republier).
//   deconnexion — un changement pas envoyé (base qui refuse) : « Se déconnecter » le DIT,
//               « Annuler » garde la saisie ; réseau revenu, « Envoyer d'abord » l'envoie
//               PUIS déconnecte (avant : effacé sans un mot).
//   vendeurs  — vendeur A, « Se déconnecter », vendeur B dans le MÊME onglet : B ne voit
//               rien de A (la page est rechargée, aucun cache de module ne survit).
//   onglets   — deux onglets du même vendeur, jeton qui expire : un seul renouvelle,
//               l'autre adopte le jeton neuf ; l'ancien jeton n'est JAMAIS renvoyé.
//  `BANC_SEUL=lbc,onglets`, `BANC_PORT`, `BANC_DIST`, `BANC_CAPTURES`.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
require('./_meta.cjs');
const H = require('./_base-ecritures.cjs');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const CAPT = process.env.BANC_CAPTURES || path.join(os.tmpdir(), 'vrm-bancs', 'robustesse-donnees');
fs.mkdirSync(CAPT, { recursive: true });
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const SEUL = (process.env.BANC_SEUL || '').split(',').filter(Boolean);
const joue = (x) => !SEUL.length || SEUL.includes(x);
const dort = (ms) => new Promise((r) => setTimeout(r, ms));

const UA = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa', UB = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb';
const VID = '3150004444';
const frais = (ms) => new Date(Date.now() - ms).toISOString();
const sess = (uid, email, tok, rt, dureeMs = 3600e3) => ({ access_token: tok, refresh_token: rt, expires_at: Date.now() + dureeMs, totp: [], user: { id: uid, email, totp: [] } });

function base({ marque = 'Nike Dunk' } = {}) {
  const ids = ['7300000001', '7300000002'];
  const items = ids.map((id, i) => ({ id: Number(id), title: `${marque} ${i + 1}`, brand_title: 'Nike', size_title: '42', status: 'Très bon état', price: { amount: '60.0', currency_code: 'EUR' }, is_closed: false, is_hidden: false, is_draft: false, favourite_count: 0, view_count: 3, created_at_ts: frais(3 * 86400000), photo: { url: `https://images1.vinted.net/t/${id}/f800/p.jpeg` } }));
  const fiches = {}; ids.forEach((id, i) => { fiches[id] = { numero: String(i + 1), numberedAt: frais(86400000), auto: false, manuelAt: frais(86400000), title: items[i].title }; });
  return H.creerBase({
    accounts: [{ id: 1, vinted_user_id: VID, login: 'vendeur_banc', domain: 'www.vinted.fr', updated_at: frais(3600e3), created_at: frais(60 * 86400000) }],
    lignes: [
      { id: 'main', data: { vrm_prenom: 'Banc', vinted_dark: false, vinted_annonce_numeros: fiches, vinted_used_numeros: ['1', '2'], vrm_bienvenue_vue: { at: 'banc' }, vrm_visite_vue: { at: 'banc' }, rev: 3 } },
      { id: `harvest_${VID}_listings`, data: { capturedAt: frais(60e3), nItems: items.length, payload: { items, pagination: { total_entries: items.length } } } },
      { id: `harvest_${VID}_enligne`, data: { capturedAt: frais(60e3), complet: true, n: items.length, ids: items.map((x) => x.id), items: items.map((x) => ({ id: x.id, title: x.title })) } },
      { id: `harvest_${VID}_profile`, data: { capturedAt: frais(60e3), payload: { user: { id: Number(VID), login: 'vendeur_banc' } } } },
      { id: `harvest_${VID}_orders_sold`, data: { capturedAt: frais(60e3), nItems: 0, payload: { my_orders: [] } } },
      { id: 'lbc_listings', data: { items: {}, lectures: {} } },
      { id: 'lbc_ventes', data: { ventes: {} } },
      { id: 'vinted_lbc_posted', data: { ids: ['7300000001', '1'], updatedAt: frais(86400000) } },
    ],
  });
}

// Le service d'authentification (GoTrue) du banc : mot de passe ⇒ A ou B ;
// renouvellement : un jeton de renouvellement ne sert qu'UNE fois (réutilisé ⇒ 400).
function authBanc(etat) {
  return async (route) => {
    const req = route.request(); const u = req.url();
    let corps = {}; try { corps = JSON.parse(req.postData() || '{}'); } catch (_) {}
    const rep = (st, b) => route.fulfill({ status: st, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(b) }).catch(() => {});
    if (/grant_type=password/.test(u)) {
      const s = String(corps.email || '').startsWith('b@') ? sess(UB, 'b@banc.test', 'jeton-B', 'rB') : sess(UA, 'a@banc.test', 'jeton-A', 'rA');
      return rep(200, { access_token: s.access_token, refresh_token: s.refresh_token, expires_in: 3600, user: { id: s.user.id, email: s.user.email } });
    }
    if (/grant_type=refresh_token/.test(u)) {
      const rt = String(corps.refresh_token || '');
      etat.renouvellements.push(rt);
      if (etat.utilises.has(rt)) { etat.reutilises.push(rt); return rep(400, { error: 'invalid_grant', error_description: 'Invalid Refresh Token: Already Used' }); }
      etat.utilises.add(rt);
      const n = etat.utilises.size;
      return rep(200, { access_token: 'jeton-A' + (n + 1), refresh_token: 'rA' + (n + 1), expires_in: 3600, user: { id: UA, email: 'a@banc.test' } });
    }
    if (/\/auth\/v1\/user/.test(u)) { const a = req.headers()['authorization'] || ''; return rep(200, /jeton-B/.test(a) ? { id: UB, email: 'b@banc.test' } : { id: UA, email: 'a@banc.test' }); }
    if (/\/auth\/v1\/settings/.test(u)) return rep(200, { external: {} });
    return rep(200, {});
  };
}

async function contexte(nav, { vp = { width: 390, height: 844 }, session }) {
  const ctx = await nav.newContext(Object.assign({ viewport: vp, timezoneId: 'Europe/Paris', locale: 'fr-FR' }, vp.width < 700 ? { isMobile: true, hasTouch: true } : {}));
  // Une fois par contexte (la clé ne commence ni par vrm_ ni par vinted_ : la
  // déconnexion ne l'efface pas, et un rechargement ne repose pas la session).
  await ctx.addInitScript((s) => { try { if (!localStorage.getItem('banc_robustesse_init')) { localStorage.setItem('banc_robustesse_init', '1'); localStorage.setItem('schema_cloisonne', '1'); localStorage.setItem('vrm_session', JSON.stringify(s)); localStorage.setItem('vrm_local_owner', s.user.id); } } catch (_) {} }, session);
  return ctx;
}
async function page(ctx, b, etat, { faute = null } = {}) {
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => { const u = r.request().url(); if (/\/rest\/v1\/|\/auth\/v1\//.test(u)) return r.fallback(); return ['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }); });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"pret":true}' }));
  await H.brancher(pg, b, { faute: (u, m, q) => (etat.faute ? etat.faute(u, m, q) : null) });
  await pg.route('**/auth/v1/**', authBanc(etat));
  return { pg, errs };
}
const etatNeuf = () => ({ faute: null, renouvellements: [], utilises: new Set(), reutilises: [] });
const capture = async (pg, nom) => { try { await pg.screenshot({ path: path.join(CAPT, nom + '.png') }); } catch (_) {} };
const texte = (pg) => pg.evaluate(() => document.body.innerText || '').catch(() => '');

(async () => {
  const { url, fermer } = await H.serveur(process.env.BANC_PORT || 0);
  const nav = await H.lancer();
  try {
    // ── lbc ──────────────────────────────────────────────────────────────────
    if (joue('lbc')) {
      console.log('── lbc : `vinted_lbc_posted` illisible ⇒ rien publié pour le logo de leboncoin.fr');
      const b = base(); const etat = etatNeuf();
      etat.faute = (u, m) => (/id=eq\.vinted_lbc_posted/.test(u) && m === 'GET' ? { status: 503 } : null);
      const ctx = await contexte(nav, { vp: { width: 1512, height: 900 }, session: sess(UA, 'a@banc.test', 'jeton-A', 'rA') });
      const { pg, errs } = await page(ctx, b, etat);
      await pg.goto(url + '/?tab=journee', { waitUntil: 'domcontentloaded' });
      await H.attendre(async () => b.lectures.some((l) => /lbc_ventes/.test(l.url)), 25000);
      await dort(6000);
      const pub = b.ecritures.filter((e) => [].concat(e.corps || []).some((x) => x && x.id === 'lbc_a_retirer'));
      const lus = b.lectures.filter((l) => /lbc_ventes/.test(l.url)).length;
      dit(lus > 0, 'le passage de la cloche a bien tourné (lbc_ventes lu)', `${lus} lecture(s)`);
      dit(pub.length === 0, 'aucune liste « à retirer de Leboncoin » publiée sur une lecture ratée', pub.map((e) => JSON.stringify([].concat(e.corps)[0].data.liste)).join(' | '));
      dit(errs.length === 0, 'aucune erreur d\'app', errs.join(' | ').slice(0, 200));
      await capture(pg, 'lbc-journee-1512');
      await ctx.close();
    }
    // ── leboncoin ────────────────────────────────────────────────────────────
    if (joue('leboncoin')) {
      console.log('── leboncoin : ce qui est déjà sur Leboncoin pas lu ⇒ « — à publier », dit');
      for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 900 }]) {
        for (const sombre of [false, true]) {
          const b = base(); const etat = etatNeuf();
          etat.faute = (u, m) => (/id=eq\.vinted_lbc_posted/.test(u) && m === 'GET' ? { status: 503 } : null);
          const ctx = await contexte(nav, { vp, session: sess(UA, 'a@banc.test', 'jeton-A', 'rA') });
          if (sombre) await ctx.addInitScript(() => { try { localStorage.setItem('vinted_dark', 'true'); } catch (_) {} });
          const { pg, errs } = await page(ctx, b, etat);
          await pg.goto(url + '/?tab=leboncoin', { waitUntil: 'domcontentloaded' });
          await H.attendre(async () => /à publier sur Leboncoin/.test(await texte(pg)), 25000);
          await dort(1500);
          const t = await texte(pg);
          const m = /(\S+) à publier sur Leboncoin/.exec(t);
          const nom = `leboncoin-${vp.width}-${sombre ? 'sombre' : 'clair'}`;
          dit(m && m[1] === '—', `${nom} : le compteur dit « — » (pas su), jamais un nombre`, m ? m[0] : 'compteur absent');
          const panne = await pg.locator('[data-lbc-lecture-ratee]').innerText().catch(() => '');
          dit(/déjà sur Leboncoin/.test(panne) && /risque de doublon/.test(panne), `${nom} : l'écran dit pourquoi`, panne.slice(0, 200));
          dit(errs.length === 0, `${nom} : aucune erreur d'app`, errs.join(' | ').slice(0, 200));
          await capture(pg, nom);
          await ctx.close();
        }
      }
    }
    // ── deconnexion ──────────────────────────────────────────────────────────
    if (joue('deconnexion')) {
      console.log('── deconnexion : un changement pas envoyé ⇒ dit, gardé, puis envoyé avant de partir');
      for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 900 }]) {
        const b = base(); const etat = etatNeuf();
        // La base refuse d'écrire `main` (panne) : le changement reste dans la file.
        etat.faute = (u, m) => (/app_data\?id=eq\.main/.test(u) && m === 'PATCH' ? { status: 503 } : null);
        const ctx = await contexte(nav, { vp, session: sess(UA, 'a@banc.test', 'jeton-A', 'rA') });
        await ctx.addInitScript((owner) => { try { if (!localStorage.getItem('banc_robustesse_file')) { localStorage.setItem('banc_robustesse_file', '1'); localStorage.setItem('vrm_prenom', JSON.stringify('Prénom saisi hors réseau')); localStorage.setItem('vrm_file_envoi', JSON.stringify({ v: 1, owner, cles: { vrm_prenom: { base: 'Banc', at: Date.now(), seq: 1 } } })); } } catch (_) {} }, UA);
        const { pg, errs } = await page(ctx, b, etat);
        await pg.goto(url + '/?tab=journee', { waitUntil: 'domcontentloaded' });
        await H.attendre(async () => (await pg.locator('nav, [data-onglet], .vrm-tabbar').count()) > 0, 20000);
        await dort(4000);
        const file0 = await pg.evaluate(() => localStorage.getItem('vrm_file_envoi'));
        dit(!!file0 && /vrm_prenom/.test(file0), `${vp.width} : le changement attend dans la file (la base refuse)`);
        await pg.evaluate(() => window.dispatchEvent(new Event('vrm:profil-ouvrir')));
        await H.attendre(async () => (await pg.locator('[data-profil-menu="deconnexion"]').count()) > 0, 8000);
        await pg.locator('[data-profil-menu="deconnexion"]').click();
        await dort(800);
        let t = await texte(pg);
        // Avant : « Se déconnecter ? — Tes données restent dans VRM. » puis tout effacé.
        if (!/pas encore envoy/.test(t) && /Tes données restent dans VRM/.test(t)) {
          await pg.getByRole('button', { name: /^Se déconnecter$/ }).last().click().catch(() => {});
          await dort(1500);
        }
        t = await texte(pg);
        dit(/\d+ changements? pas encore envoyés?/.test(t) && /Envoyer d’abord/.test(t), `${vp.width} : « Se déconnecter » DIT qu'un changement n'est pas parti, et propose « Envoyer d'abord »`, t.match(/[^\n]*pas encore envoy[^\n]*/) ? t.match(/[^\n]*pas encore envoy[^\n]*/)[0] : '');
        await capture(pg, `deconnexion-question-${vp.width}`);
        await pg.getByRole('button', { name: /^Annuler$/ }).last().click().catch(() => {});
        await dort(800);
        const file1 = await pg.evaluate(() => localStorage.getItem('vrm_file_envoi')).catch(() => null);
        const sess1 = await pg.evaluate(() => localStorage.getItem('vrm_session')).catch(() => null);
        dit(!!file1 && /vrm_prenom/.test(file1) && !!sess1, `${vp.width} : « Annuler » ⇒ toujours connecté, la saisie est gardée`);
        // Le réseau revient : « Envoyer d'abord ».
        etat.faute = null;
        await pg.evaluate(() => window.dispatchEvent(new Event('vrm:profil-ouvrir')));
        await H.attendre(async () => (await pg.locator('[data-profil-menu="deconnexion"]').count()) > 0, 8000);
        await pg.locator('[data-profil-menu="deconnexion"]').click().catch(() => {});
        await dort(800);
        // Le réseau revenu a parfois déjà vidé la file : alors la question simple (rien à perdre).
        if (await pg.getByRole('button', { name: /Envoyer d’abord/ }).count()) await pg.getByRole('button', { name: /Envoyer d’abord/ }).last().click().catch(() => {});
        else await pg.getByRole('button', { name: /^Se déconnecter$/ }).last().click().catch(() => {});
        await H.attendre(async () => !(await pg.evaluate(() => localStorage.getItem('vrm_session')).catch(() => 'x')), 20000);
        await dort(1500);
        const prenomNuage = (H.dataMain(b) || {}).vrm_prenom;
        let sess2 = 'x';
        for (let i = 0; i < 6 && sess2 === 'x'; i++) { sess2 = await pg.evaluate(() => localStorage.getItem('vrm_session')).catch(() => 'x'); if (sess2 === 'x') await dort(1000); }
        dit(prenomNuage === 'Prénom saisi hors réseau', `${vp.width} : « Envoyer d'abord » ⇒ le changement est arrivé dans le nuage`, String(prenomNuage));
        dit(!sess2, `${vp.width} : puis déconnecté`);
        dit(errs.length === 0, `${vp.width} : aucune erreur d'app`, errs.join(' | ').slice(0, 200));
        await capture(pg, `deconnexion-apres-${vp.width}`);
        await ctx.close();
      }
    }
    // ── vendeurs ─────────────────────────────────────────────────────────────
    if (joue('vendeurs')) {
      console.log('── vendeurs : A se déconnecte, B se connecte dans le MÊME onglet : B ne voit rien de A');
      const b = base({ marque: 'PAIRE-SECRETE-A' }); const etat = etatNeuf();
      // Tout ce que B lit : rien (sa boutique est vide) — une base cloisonnée.
      etat.faute = (u, m, q) => (m === 'GET' && /jeton-B/.test((q && q.headers()['authorization']) || '') && /\/rest\/v1\//.test(u) ? { status: 200, body: '[]' } : null);
      const ctx = await contexte(nav, { vp: { width: 390, height: 844 }, session: sess(UA, 'a@banc.test', 'jeton-A', 'rA') });
      const { pg, errs } = await page(ctx, b, etat);
      await pg.goto(url + '/?tab=cat_annonces', { waitUntil: 'domcontentloaded' });
      const vuA = await H.attendre(async () => /PAIRE-SECRETE-A/.test(await texte(pg)), 25000);
      dit(vuA, 'A voit ses annonces (« PAIRE-SECRETE-A »)');
      await pg.evaluate(() => { window.__banc_onglet_de_A = 1; });
      await pg.evaluate(() => window.dispatchEvent(new Event('vrm:profil-ouvrir')));
      await H.attendre(async () => (await pg.locator('[data-profil-menu="deconnexion"]').count()) > 0, 8000);
      await pg.locator('[data-profil-menu="deconnexion"]').click();
      await dort(600);
      await pg.getByRole('button', { name: /^Se déconnecter$/ }).last().click().catch(() => {});
      // L'app se recharge (300 ms) puis montre l'écran de connexion.
      await dort(1500);
      await H.attendre(async () => (await pg.locator('input[type="email"]').count()) > 0, 15000);
      await dort(800);
      try {
        await pg.locator('input[type="email"]').first().fill('b@banc.test', { timeout: 10000 });
        await pg.locator('#vrm-cx-password').fill('motdepasse-B-1', { timeout: 10000 });
        await pg.locator('#vrm-cx-password').press('Enter');
      } catch (e) { await capture(pg, 'vendeurs-connexion-B-ratee'); dit(false, 'l\'écran de connexion de B se remplit', String(e.message).slice(0, 120)); }
      await H.attendre(async () => (await pg.locator('input[type="email"]').count()) === 0, 15000);
      await dort(2500);
      // B va sur Annonces PAR L'APP (pas d'adresse tapée : elle rechargerait la page elle-même).
      await pg.evaluate(() => { try { window.history.pushState({}, '', '/?tab=cat_annonces'); window.dispatchEvent(new PopStateEvent('popstate')); } catch (_) {} });
      await dort(6000);
      const tB = await texte(pg);
      const marque = await pg.evaluate(() => window.__banc_onglet_de_A).catch(() => 'erreur');
      const sB = await pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vrm_session') || 'null'); } catch (_) { return null; } });
      dit(sB && sB.user && sB.user.id === UB, 'B est connecté');
      dit(marque === undefined, 'l\'onglet de A a été RECHARGÉ (aucun cache de module ne survit au changement de vendeur)', String(marque));
      dit(!/PAIRE-SECRETE-A/.test(tB), 'B ne voit rien de A', (tB.match(/[^\n]*PAIRE-SECRETE-A[^\n]*/) || [''])[0]);
      dit(errs.length === 0, 'aucune erreur d\'app', errs.join(' | ').slice(0, 200));
      await capture(pg, 'vendeurs-B-390');
      await ctx.close();
    }
    // ── onglets ──────────────────────────────────────────────────────────────
    if (joue('onglets')) {
      console.log('── onglets : deux onglets du même vendeur, un seul renouvelle le jeton');
      const b = base(); const etat = etatNeuf();
      const ctx = await contexte(nav, { vp: { width: 1512, height: 900 }, session: sess(UA, 'a@banc.test', 'jeton-A', 'rA', 75e3) });
      const p1 = await page(ctx, b, etat); const p2 = await page(ctx, b, etat);
      await p1.pg.goto(url + '/?tab=journee', { waitUntil: 'domcontentloaded' });
      await p2.pg.goto(url + '/?tab=journee', { waitUntil: 'domcontentloaded' });
      // Le jeton entre dans sa dernière minute : les deux onglets voudraient renouveler.
      await dort(17000);
      await Promise.all([p1.pg.evaluate(() => window.dispatchEvent(new Event('focus'))), p2.pg.evaluate(() => window.dispatchEvent(new Event('focus')))]);
      await dort(3000);
      await p2.pg.evaluate(() => window.dispatchEvent(new Event('online')));
      await p1.pg.evaluate(() => window.dispatchEvent(new Event('online')));
      await dort(3000);
      // Une lecture de chaque onglet après coup : avec quel jeton part-elle ?
      const jetons = [];
      for (const p of [p1.pg, p2.pg]) {
        const j = await p.evaluate(async () => { try { const s = JSON.parse(localStorage.getItem('vrm_session') || 'null'); return s && s.access_token; } catch (_) { return null; } });
        jetons.push(j);
      }
      dit(etat.renouvellements.length >= 1, 'le jeton a bien été renouvelé', etat.renouvellements.join(','));
      dit(etat.reutilises.length === 0, 'l\'ancien jeton de renouvellement n\'est JAMAIS renvoyé (pas de révocation)', `${etat.reutilises.length} réutilisation(s) : ${etat.reutilises.join(',')}`);
      // Chaque onglet lit désormais avec le jeton neuf.
      const auth = [];
      for (const p of [p1.pg, p2.pg]) {
        const req = p.waitForRequest((r) => /\/rest\/v1\//.test(r.url()), { timeout: 15000 }).catch(() => null);
        await p.evaluate(() => { window.dispatchEvent(new Event('vrm:synchroniser')); document.dispatchEvent(new Event('visibilitychange')); });
        const r = await req; auth.push(r ? (r.headers()['authorization'] || '') : '');
      }
      dit(auth.every((a) => /jeton-A\d/.test(a)), 'les deux onglets lisent avec le jeton NEUF', auth.join(' · '));
      dit(p1.errs.length + p2.errs.length === 0, 'aucune erreur d\'app', [...p1.errs, ...p2.errs].join(' | ').slice(0, 200));
      await capture(p2.pg, 'onglets-2-1512');
      await ctx.close();
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu\'au bout', String(e && e.stack || e).slice(0, 300)); }
  finally { await nav.close(); fermer(); }
  console.log(ko ? `\n❌ robustesse-donnees : ${ko} rouge(s) sur ${ok + ko}` : `\n✅ robustesse-donnees : ${ok} contrôles verts`);
  process.exit(ko ? 1 : 0);
})();
