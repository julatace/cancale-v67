// ════════════════════════════════════════════════════════════════════════════
//  BANC — LE FILTRE PAR PLATEFORME DES ONGLETS (25 nov. soir)
//  Julien : « On doit avoir un filtre avec toutes les plateformes et par plateforme dans les onglets. »
//
//  Sur l'app RENDUE (le vrai `dist/`, base INVENTÉE : Vinted + Leboncoin + eBay + Vestiaire, la base de
//  `minimaliste.cjs --sites` ; garde réseau : rien ne sort), pour Annonces, Ventes (À envoyer, En route, Terminées)
//  et Achats, au téléphone (390 tactile : la rangée de puces `[data-fp]`) et à l'ordinateur (1512 : l'entrée « Site »
//  du menu de filtres du tableau, `[data-tt-filtre="site"]`) :
//    F1 l'entrée « Toutes » puis une entrée par plateforme PRÉSENTE, chacune avec son logo (`.n-logo-site[data-site]`)
//       et son nombre ;
//    F2 « Toutes » = la somme des plateformes (une ligne n'a qu'un site dans cette base) ;
//    F3 chaque plateforme choisie : la liste ne montre QUE ses lignes (le logo de chaque rangée, ou le morceau d'Achats
//       de son site), autant que son nombre (téléphone : la liste entière ; ordinateur : « N ventes » du tableau) ;
//       les nombres du segmenté suivent (Ventes : À envoyer = le nombre du site) ;
//    F4 le choix est retenu après rechargement (cet appareil) ;
//    F5 une plateforme sans aucune donnée n'a pas d'entrée (base SANS Vestiaire) ;
//    F6 aucune page plus large que l'écran, aucune erreur de page.
//  Captures : SORTIE (défaut /tmp/banc-filtre-plateformes) `<ecran>-<fen>-<theme>-<site>.png`.
//  `FENETRES=390,1512` `THEMES=clair,sombre` `ECRANS=annonces,ventes,achats` ; `BANC_DIST=…` juge un autre build.
//  Preuve « rouge avant » : lancé sur un build d'origin/main (`BANC_DIST`), F1 rougit (aucun filtre) ; mutation : la règle
//  `filtrerPlateforme` rendue sans effet (src/filtrePlateforme.js, build à part) : F3 rougit.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');
require('./_porte-banc.cjs');
const P = require('./design-passe.cjs');
const B = require('./_base-messages-stock.cjs');
const E = require('./ecrans-verre-2.cjs');
const { baseSite } = require('./minimaliste.cjs');

const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const SORTIE = process.env.SORTIE || path.join(os.tmpdir(), 'banc-filtre-plateformes');
fs.mkdirSync(SORTIE, { recursive: true });
const FENETRES = liste('FENETRES', '390,1512');
const THEMES = liste('THEMES', 'clair,sombre');
const ECRANS = liste('ECRANS', 'annonces,ventes,ventes-route,ventes-terminees,achats');
const ATTENTE = Number(process.env.ATTENTE || 2200);
const SITES = ['vinted', 'leboncoin', 'ebay', 'vestiaire'];

function ajouterSite(b, site) {
  const x = baseSite(site);
  const ids = new Set(x.rows.filter((r) => /^(lbc_|ebay_|vc_)/.test(r.id)).map((r) => r.id));
  b.rows = b.rows.filter((r) => !ids.has(r.id)); b.rows.push(...x.rows.filter((r) => ids.has(r.id)));
  return b;
}
// Des ACHATS inventés sur Leboncoin (`isSeller: false`, la forme de `lbc_ventes`) et Vestiaire (`vc_achats`) : la base de
// `--sites` n'en porte pas (eBay : ses achats viennent de l'API, « pas su » ici ⇒ aucune entrée, ce qui est juste).
function avecAchats(b, sites) {
  const iso = (j) => new Date(Date.now() - j * 86400000).toISOString();
  const lbc = b.rows.find((r) => r.id === 'lbc_ventes');
  if (lbc && sites.includes('leboncoin')) for (let i = 0; i < 3; i++) lbc.data.ventes['A' + i] = { txId: 'A' + i, itemId: String(3300000000 + i), isSeller: false, price: (40 + i) * 100, stepStatus: i ? 'done' : 'shipped', dateVente: iso(i + 2), title: 'Achat Leboncoin banc ' + i };
  if (sites.includes('vestiaire')) {
    const achats = {}; for (let i = 0; i < 2; i++) achats['VA' + i] = { nom: 'Achat Vestiaire banc ' + i, montant: { valeur: 60 + i }, etat: i ? 'Livré' : 'En cours', date: iso(i + 3), compte: 'vcA' };
    b.rows = b.rows.filter((r) => r.id !== 'vc_achats'); b.rows.push({ id: 'vc_achats', data: { achats, lecture: { at: iso(0.02) } } });
  }
  return b;
}
const base = (sites = ['leboncoin', 'ebay', 'vestiaire']) => avecAchats(sites.reduce((b, s) => ajouterSite(b, s), E.baseFiches()), sites);

let rouges = 0, verts = 0;
const dit = (ok, quoi, d) => { if (ok) verts++; else rouges++; console.log((ok ? '  ✅ ' : '  ❌ ') + quoi + (ok || d === undefined ? '' : ' — ' + JSON.stringify(d).slice(0, 700))); return ok; };

const URL = { annonces: '/?tab=annonces', ventes: '/?tab=ventes', 'ventes-route': '/?tab=ventes', 'ventes-terminees': '/?tab=ventes', achats: '/?tab=achats' };
const CLE = { annonces: 'annonces', ventes: 'ventes', 'ventes-route': 'ventes', 'ventes-terminees': 'ventes', achats: 'achats' };
const SEGMENT = { 'ventes-route': 'envoyes', 'ventes-terminees': 'toutes', ventes: 'envoyer' };

async function aller(o, ecran) {
  await o.pg.goto(`http://localhost:${P.PORT}${URL[ecran]}`, { waitUntil: 'domcontentloaded' });
  await P.pret(o.pg); await o.pg.waitForTimeout(ATTENTE);
  if (SEGMENT[ecran]) {
    const s = o.pg.locator(`[data-colis-onglet-choix="${SEGMENT[ecran]}"]`).filter({ visible: true }).first();
    if (await s.count()) { await s.click().catch(() => {}); await o.pg.waitForTimeout(ATTENTE); }
  }
  if (ecran === 'annonces') await o.pg.waitForSelector('[data-eg-article], [data-tt-ligne], .n-ar', { timeout: 20000 }).catch(() => {});
  if (ecran === 'achats') await o.pg.waitForSelector('[data-achats-autre]', { timeout: 15000 }).catch(() => {});
  await o.pg.waitForTimeout(600);
}

// Les entrées du filtre, telles qu'affichées. Téléphone : la rangée ; ordinateur : le menu « Site » ouvert.
async function entrees(o, tel) {
  // Le filtre n'a d'entrées qu'une fois les lignes lues : on l'attend (au plus 10 s ; absent ⇒ null, l'appelant juge).
  await o.pg.locator(tel ? '[data-fp]' : '[data-tt-filtre="site"]').filter({ visible: true }).first().waitFor({ timeout: 10000 }).catch(() => {});
  if (tel) {
    return o.pg.evaluate(() => {
      const vis = (e) => e && e.getClientRects().length && !e.closest('[hidden]');
      const r = [...document.querySelectorAll('[data-fp]')].filter(vis)[0];
      if (!r) return null;
      return { choix: r.getAttribute('data-fp-choix'), haut: Math.round(r.getBoundingClientRect().top), options: [...r.querySelectorAll('[data-fp-site]')].map((b) => ({ cle: b.getAttribute('data-fp-site'), n: b.getAttribute('data-fp-n') == null ? null : Number(b.getAttribute('data-fp-n')),
        logo: !!b.querySelector('.n-logo-site[data-site="' + b.getAttribute('data-fp-site') + '"]'), presse: b.getAttribute('aria-pressed') === 'true', h: Math.round(b.getBoundingClientRect().height) })) };
    });
  }
  const bouton = o.pg.locator('[data-tt-filtre="site"]').filter({ visible: true }).first();
  if (!(await bouton.count())) return null;
  await bouton.click(); await o.pg.waitForTimeout(400);
  const r = await o.pg.evaluate(() => {
    const b = [...document.querySelectorAll('[data-tt-filtre="site"]')].find((e) => e.getClientRects().length);
    return { choix: b && b.getAttribute('data-tt-filtre-valeur'), options: [...document.querySelectorAll('[data-tt-filtre-choix^="site:"]')].filter((e) => e.getClientRects().length).map((e) => {
      const cle = e.getAttribute('data-tt-filtre-choix').slice(5); const n = e.querySelector('.n-tt-case-n');
      return { cle, n: n ? Number(n.textContent) : null, logo: cle === 'toutes' || !!e.querySelector('.n-logo-site[data-site="' + cle + '"]'), presse: e.getAttribute('aria-checked') === 'true' }; }) };
  });
  return r;
}
async function choisir(o, tel, cle) {
  if (tel) { await o.pg.locator(`[data-fp] [data-fp-site="${cle}"]`).filter({ visible: true }).first().click(); }
  else {
    const ouvert = await o.pg.locator('[data-tt-filtre-choix^="site:"]').filter({ visible: true }).count();
    if (!ouvert) { await o.pg.locator('[data-tt-filtre="site"]').filter({ visible: true }).first().click(); await o.pg.waitForTimeout(300); }
    await o.pg.locator(`[data-tt-filtre-choix="site:${cle}"]`).filter({ visible: true }).first().click();
  }
  await o.pg.waitForTimeout(900);
}

// Ce que la liste montre : les sites de ses lignes visibles et leur nombre.
async function lignes(o, ecran, tel) {
  // Téléphone : la liste entière (on défile jusqu'au bout pour les paquets).
  if (tel && ecran !== 'achats') {
    for (let i = 0; i < 40; i++) {
      const plus = o.pg.locator('[data-toutes-plus], [data-eg-plus], .n-eg-plus').filter({ visible: true }).first();
      if (await plus.count()) { await plus.click().catch(() => {}); await o.pg.waitForTimeout(300); continue; }
      const fin = await o.pg.evaluate(() => { const avant = scrollY; window.scrollBy(0, 4000); document.querySelectorAll('.n-page, .vrm-main, main').forEach((e) => { e.scrollTop += 4000; }); return scrollY === avant; });
      await o.pg.waitForTimeout(250); if (fin && i > 4) break;
    }
  }
  return o.pg.evaluate(([ecran, tel]) => {
    const vis = (e) => e && e.getClientRects().length && !e.closest('[hidden], .vrm-attente-cache, [aria-hidden="true"][inert]');
    const site = (e) => { const l = e.querySelector('.n-logo-site[data-site]'); return l ? l.getAttribute('data-site') : (e.getAttribute('data-vt-site') || e.getAttribute('data-toutes-vente') || ''); };
    if (ecran === 'achats') {
      const m = [...document.querySelectorAll('[data-achats-morceau]')];
      return { morceaux: m.map((e) => ({ site: e.getAttribute('data-achats-morceau'), vu: !e.hidden && e.getClientRects().length > 0 })) };
    }
    let sel;
    if (ecran === 'annonces') sel = tel ? '[data-eg-article], .n-inv-case' : '[data-tt-ligne]';
    else if (ecran === 'ventes-terminees') sel = tel ? '[data-toutes-vente]:not([data-annul-motif])' : '[data-tt-ligne]';
    else sel = tel ? '[data-vn-rang], [data-vn-route]' : '[data-tt-ligne]';
    const L = [...document.querySelectorAll(sel)].filter(vis).filter((e) => !e.parentElement.closest(sel));
    // Annonces : la rangée porte les logos de SES sites, et l'intertitre de son compte celui du compte.
    const tete = (e) => { const sec = e.closest('.n-ad-section, [data-tt-groupe], section'); const h = sec && sec.querySelector('.n-ad-tete-compte .n-logo-site[data-site], [data-tt-intertitre] .n-logo-site[data-site]'); return h ? [h.getAttribute('data-site')] : []; };
    const par = {}; const sites = L.map((e) => { const logos = [...new Set([...e.querySelectorAll('.n-logo-site[data-site]')].map((x) => x.getAttribute('data-site')).concat(ecran === 'annonces' ? tete(e) : []))]; return logos.length ? logos : [site(e)]; });
    for (const s of sites) for (const x of s) par[x] = (par[x] || 0) + 1;
    const nTab = document.querySelector('[data-tt-nombre]');
    const annul = document.querySelector('[data-toutes-annulees]');
    return { n: L.length + (ecran === 'ventes-terminees' && tel && annul ? Number(annul.getAttribute('data-toutes-annulees')) : 0), par, sites, nTableau: nTab ? Number(nTab.getAttribute('data-tt-nombre')) : null,
      segEnv: (() => { const s = [...document.querySelectorAll('[data-colis-onglet-choix="envoyer"]')].find((e) => e.getClientRects().length); return s ? s.getAttribute('data-colis-onglet-n') : null; })() };
  }, [ecran, tel]);
}

async function principal() {
  await new Promise((r) => P.srv.listen(P.PORT, r));
  const nav = await P.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  try {
    for (const fen of FENETRES) for (const th of THEMES) {
      const tel = Number(fen) < 600;
      const o = await P.ouvrir(nav, { W: Number(fen), sombre: th === 'sombre', b: base(), url: '/?tab=journee', api: B.apiVolume });
      await o.pg.evaluate(() => { try { localStorage.setItem('vrm_design_v2', '1'); localStorage.removeItem('vrm_filtre_plateformes'); } catch (_) {} });
      for (const ecran of ECRANS) {
        const ou = `${fen} ${th} ${ecran}`;
        const rangee = tel || ecran === 'achats';   // Achats : la rangée de puces aussi à l'ordinateur (ses morceaux n'ont pas de barre commune)
        try {
          await aller(o, ecran);
          // Le défaut : « Toutes ».
          if (rangee) { const avant = await entrees(o, rangee); if (avant && avant.choix !== 'toutes') { await choisir(o, rangee, 'toutes'); } }
          const E0 = await entrees(o, rangee);
          if (!E0) {
            // Une liste d'UN seul site n'a pas de filtre (rien à filtrer) : on le vérifie sur ses lignes.
            const L = await lignes(o, ecran, tel);
            const s1 = ecran === 'achats' ? L.morceaux.filter((m) => m.vu).map((m) => m.site) : Object.keys(L.par);
            dit(ecran !== 'achats' && s1.length <= 1, `F1 ${ou} : pas de filtre — la liste n'a qu'une plateforme (${s1.join(', ') || 'aucune'})`, L.par || L.morceaux);
            continue;
          }
          dit(E0.options.length >= 3, `F1 ${ou} : le filtre est là (Toutes + au moins deux plateformes)`, E0);
          if (!rangee) await o.pg.keyboard.press('Escape').catch(() => {});
          const tout = E0.options.find((x) => x.cle === 'toutes');
          const sites = E0.options.filter((x) => x.cle !== 'toutes');
          dit(E0.options[0].cle === 'toutes' && sites.every((s) => SITES.includes(s.cle)) && sites.map((s) => s.cle).join() === SITES.filter((s) => sites.some((x) => x.cle === s)).join(),
            `F1 ${ou} : « Toutes » d'abord, puis les plateformes dans l'ordre (${sites.map((s) => s.cle + ' ' + s.n).join(', ')})`, E0);
          dit(sites.every((s) => s.logo && Number.isFinite(s.n) && s.n > 0), `F1 ${ou} : chaque plateforme a son logo et son nombre`, sites);
          if (tel) dit(E0.options.every((x) => x.h >= 44), `F1 ${ou} : cibles au doigt ≥ 44`, E0.options.map((x) => x.h));
          const somme = sites.reduce((a, s) => a + s.n, 0), maxi = Math.max(...sites.map((s) => s.n));
          // Annonces : un ARTICLE en vente sur deux sites compte une fois sous « Toutes » et une fois sous chacun de ses sites.
          if (ecran === 'annonces') dit(tout && tout.n >= maxi && tout.n <= somme, `F2 ${ou} : Toutes (${tout && tout.n} articles) entre la plus grande plateforme (${maxi}) et la somme (${somme} : un article sur deux sites compte dans chacun)`, E0.options);
          else dit(tout && Number.isFinite(tout.n) && tout.n === somme, `F2 ${ou} : Toutes (${tout && tout.n}) = somme des plateformes (${somme})`, E0.options);
          await o.pg.screenshot({ path: path.join(SORTIE, `${ecran}-${fen}-${th}-toutes.png`) }).catch(() => {});
          for (const s of sites) {
            await choisir(o, rangee, s.cle);
            // La capture : en haut de l'écran, la plateforme choisie (à l'ordinateur, le menu « Site » rouvert).
            if (s === sites[sites.length - 1] || s === sites[1]) {
              await o.pg.evaluate(() => { window.scrollTo(0, 0); document.querySelectorAll(".n-page, .vrm-main, main").forEach((e) => { e.scrollTop = 0; }); });
              if (!rangee) { await o.pg.locator("[data-tt-filtre=\"site\"]").filter({ visible: true }).first().click().catch(() => {}); await o.pg.waitForTimeout(300); }
              await o.pg.screenshot({ path: path.join(SORTIE, `${ecran}-${fen}-${th}-${s.cle}.png`) }).catch(() => {});
              if (!rangee) await o.pg.keyboard.press("Escape").catch(() => {});
            }
            const L = await lignes(o, ecran, tel);
            if (ecran === 'achats') {
              dit(L.morceaux.length > 0 && L.morceaux.every((m) => m.vu === (m.site === s.cle)), `F3 ${ou} · ${s.cle} : seul le morceau de ${s.cle} est montré`, L.morceaux);
            } else {
              // Chaque ligne montrée est de CE site (Annonces : un article peut être sur plusieurs sites, il doit être sur celui-ci).
              const hors = L.sites.filter((x) => !x.includes(s.cle));
              dit(L.sites.length > 0 && hors.length === 0, `F3 ${ou} · ${s.cle} : la liste ne montre que ${s.cle} (${L.sites.length} lignes)`, { par: L.par, hors: hors.slice(0, 5) });
              if (tel && ecran !== 'annonces') dit(L.n === s.n, `F3 ${ou} · ${s.cle} : autant de lignes que son nombre (${L.n} = ${s.n})`, { n: L.n, attendu: s.n });
              // Annonces à l'ordinateur : le nombre du menu « Site » compte les rangées de TOUS les statuts (règle du 22 nov.,
              // `nRangeesSite`) ; le tableau garde son filtre Statut (« En ligne » d'office) par-dessus ⇒ « N » ≤ ce nombre.
              if (!tel && L.nTableau != null) {
                if (ecran === 'annonces') dit(L.nTableau > 0 && L.nTableau <= s.n, `F3 ${ou} · ${s.cle} : « N » du tableau (${L.nTableau}, Statut par-dessus) ≤ son nombre (${s.n})`, L.nTableau);
                else dit(L.nTableau === s.n, `F3 ${ou} · ${s.cle} : « N » du tableau = son nombre (${L.nTableau} = ${s.n})`, L.nTableau);
              }
              if (ecran === 'ventes') dit(L.segEnv === String(s.n), `F3 ${ou} · ${s.cle} : « À envoyer » du segmenté = ${s.n}`, L.segEnv);
            }
          }
          // F4 : retenu après rechargement.
          const dernier = sites[1] || sites[0];
          await choisir(o, rangee, dernier.cle);
          await aller(o, ecran);
          const E1 = await entrees(o, rangee);
          dit(E1 && E1.choix === dernier.cle, `F4 ${ou} : « ${dernier.cle} » retenu après rechargement`, E1 && E1.choix);
          if (!rangee) await o.pg.keyboard.press('Escape').catch(() => {});
          await choisir(o, rangee, 'toutes');
          const debord = await o.pg.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
          dit(!debord, `F6 ${ou} : rien ne déborde`);
        } catch (e) { rouges++; console.log(`  ❌ ${ou} : ${String(e.message || e).slice(0, 200)}`); }
      }
      dit(!o.erreurs.length, `F6 ${fen} ${th} : aucune erreur de page`, o.erreurs.slice(0, 3));
      await o.ctx.close();
    }
    // F5 : une base SANS Vestiaire ⇒ pas d'entrée Vestiaire (téléphone).
    {
      const o = await P.ouvrir(nav, { W: 390, sombre: false, b: base(['leboncoin', 'ebay']), url: '/?tab=journee', api: B.apiVolume });
      await o.pg.evaluate(() => { try { localStorage.setItem('vrm_design_v2', '1'); localStorage.setItem('vrm_filtre_plateformes', JSON.stringify({ ventes: 'vestiaire', annonces: 'vestiaire', achats: 'vestiaire' })); } catch (_) {} });
      for (const ecran of ['annonces', 'ventes', 'achats']) {
        await aller(o, ecran);
        const E0 = await entrees(o, true);
        dit(!!E0 && !E0.options.some((x) => x.cle === 'vestiaire') && E0.choix === 'toutes', `F5 390 ${ecran} : sans donnée Vestiaire, aucune entrée Vestiaire (choix rangé « vestiaire » ⇒ Toutes)`, E0);
      }
      await o.ctx.close();
    }
  } finally { await nav.close(); P.srv.close(); }
  console.log(`\n${rouges ? '❌' : '✅'} filtre par plateforme : ${verts} vert(s), ${rouges} rouge(s) — captures : ${SORTIE}`);
  if (rouges) process.exitCode = 1;
}
if (require.main === module) principal();
