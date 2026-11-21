// Banc : LE RÉCAPITULATIF D'UNE VENTE (1er nov., maquette A « fiche en lignes
// nettes » — Julien : « je n'aime pas trop le récapitulatif de la vente », puis
// « applique tout, je veux que ce soit clair »). Le tiroir qui s'ouvre quand on
// touche une vente dans Ventes (Vinted), au téléphone (390 px, feuille du bas)
// et sur ordinateur (1512 px, panneau de droite), en clair et en sombre.
// Données INVENTÉES (le dépôt est public).
//
// Il juge la RÈGLE, pas l'orthographe (§6.4) — data-* et nombres rendus :
//   1. la frise ne coche une étape que si SA preuve est lue — jamais déduite
//      (10 nov., lot BE : src/friseProuvee.js, sept étapes) :
//      · 7002 payée, sans bordereau          ⇒ Vendue seule, « Bordereau » ambre (geste) ;
//      · 7001 bordereau reçu par email        ⇒ Vendue + Bordereau, « Déposée » ambre ;
//      · 7011 « livré » + « Colis fait »      ⇒ Vendue, Bordereau, Déposée, Livrée —
//                                              « En route » pas lu (aucun transporteur lu) ;
//      · 7005 finalisée (450, versée le 25)   ⇒ Vendue, Finalisée, Versée : le reste
//                                              « pas lu » (rien ne le prouve), date dite une fois ;
//   2. la frise REMPLACE la pastille de statut : jamais les deux dans le tiroir ;
//      une vente annulée porte la bifurcation « Annulée », une phrase dit l'état ;
//   3. sans prix d'achat, le bénéfice est « — » (aucun `data-benef-vente`) et le
//      geste « Saisir le prix d'achat » est là ; frais pas confirmés ⇒ « au plus » ;
//   4. un nombre une seule fois (prix, N°), jamais « encaissé » ni « n/d » ;
//   5. aucun débordement horizontal, aucun montant cassé sur deux lignes, des
//      cibles de 44 px au téléphone ;
//   6. un toucher à côté referme le tiroir (1er nov.) ; aucune erreur d'app.
// Lancer : npm run build && BANC_PORT=99xx node scripts/bancs/recap-vente.cjs
// Captures : SHOTS=<dossier> node scripts/bancs/recap-vente.cjs
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || process.env.PORT || 4397);
const SHOTS = process.env.SHOTS || '';

const maintenant = new Date(2026, 9, 31, 15, 30, 0);
const il = (n, h = 12) => { const d = new Date(maintenant); d.setHours(h, 0, 0, 0); d.setDate(d.getDate() - n); return d; };
const A = '111';
let nPhoto = 0;
const vente = (id, titre, prix, statut, d, tus, extra = {}) => ({ transaction_id: id, conversation_id: 50000 + id, title: titre, price: { amount: String(prix), currency_code: 'EUR' }, status: statut, transaction_user_status: tus, date: d.toISOString(), photo: { url: `https://images1.vinted.net/t/b${++nPhoto}/f800/${id}.jpeg?s=x` }, ...extra });
const VENTES = [
  vente(7001, 'Nike Air Max 90 blanche taille 42', 65, 'Le paiement a été validé', il(0, 11), 'needs_action'),
  vente(7002, 'Adidas Samba OG noir gomme taille 40', 72, 'Le paiement a été validé', il(1, 9), 'needs_action'),
  vente(7011, 'Nike Dunk Low Retro « Panda » blanc et noir', 79, 'Le colis a été livré', il(5, 10), 'waiting', { user_login: 'lucas_b92' }),
  vente(7005, 'Asics Gel-Kayano 14 argent taille 44', 89, 'Commande finalisée', il(9), 'completed'),
  vente(7009, 'Nike Shox TL noir taille 41', 95, 'Commande annulée', il(1), 'failed'),
];
const ACCOUNTS = [{ id: 1, vinted_user_id: A, login: 'julatace35260', domain: 'www.vinted.fr', updated_at: maintenant.toISOString() }];
const cap = maintenant.toISOString();
const PDF_B64 = fs.readFileSync(path.join(__dirname, 'bordereau-test.b64'), 'utf8').trim();
const LIGNES = [
  { id: `harvest_${A}_orders_sold`, data: { capturedAt: cap, payload: { my_orders: VENTES } } },
  { id: 'email_bord_7001', data: { transaction: '7001', uid: A, filename: 'b1.pdf', modele: 'Air Max', receivedAt: il(0, 12).toISOString(), pdfB64: PDF_B64 } },
  { id: 'email_bord_7011', data: { transaction: '7011', uid: A, filename: 'b2.pdf', modele: 'Dunk', suivi: '24819306', receivedAt: il(5, 12).toISOString(), pdfB64: PDF_B64 } },
  // La transaction finalisée (450) : sa date de versement (la même lecture que la compta).
  // (la vraie forme : `data.payload.transaction`, lue par `meta->>` — `_meta.cjs`)
  { id: `harvest_${A}_txn_7005`, data: { capturedAt: cap, payload: { transaction: { id: 7005, item_id: 9905, status: 450, status_title: 'Commande finalisée', status_updated_at: il(6, 9).toISOString() } } } },
];

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).slice(0, 200)); } };

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
srv.listen(PORT);

const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    if (src === 'updated_at') { out[alias] = cap; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'string' ? String(v) : v);
  }
  return out;
};
const photoSvg = (k) => `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="${['#d9d4cc', '#c9ced6', '#e2ddd4', '#cfd6cf'][k % 4]}"/><path d="M70 250 C90 190 150 180 190 200 C230 220 280 205 320 230 C345 245 340 280 300 282 L90 282 C70 282 62 268 70 250 Z" fill="rgba(30,34,40,.55)"/></svg>`;

const ouvrir = async (b, vp, sombre) => {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.clock.install({ time: maintenant });
  await pg.addInitScript((s) => { try {
    localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(s));
    // 7011 : prix d'achat, N° et frais saisis à la main (frais PAS confirmés ⇒ « au plus ») ; colis coché « fait » il y a 4 jours.
    localStorage.setItem('vinted_sale_overrides', JSON.stringify({ '7011': { buyPrice: '35', numero: '73', fees: '1.95' } }));
    localStorage.setItem('vinted_ship_done', JSON.stringify({ '7011': Date.now() - 4 * 864e5 }));
  } catch (_) {} }, !!sombre);
  await pg.route(/^https?:\/\/[^/]*vinted\.net\//i, (r) => { const m = /\/b(\d+)\//.exec(r.request().url()); return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: photoSvg(m ? Number(m[1]) : 0) }); });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1|[^/]*vinted\.net)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) || /^https?:\/\/[^/]*vinted\.net\//i.test(r.request().url()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    if (route.request().method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: cap, cap: r.data.capturedAt });
    const filtres = [...u.matchAll(/[?&]data->>([a-zA-Z_]+)=(not\.)?is\.null/g)];
    const passe = (r) => filtres.every(([, k, non]) => (r.data[k] == null) === !non);
    const eq = /[?&]id=eq\.([^&]*)/.exec(u);
    if (eq) return j(LIGNES.filter((r) => r.id === eq[1] && passe(r)).map(forme));
    const lk = /[?&]id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(LIGNES.filter((r) => re.test(r.id) && passe(r)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=cat_ventes`, { waitUntil: 'domcontentloaded' });
  await pg.locator('.vrm-sale-row[data-tx] .vrm-ledger-sale-toggle').first().waitFor({ timeout: 30000 });
  await pg.waitForTimeout(1200);
  return { ctx, pg, errs };
};

// Ouvre le tiroir d'une vente (par sa TRANSACTION) et attend l'ÉTAT : le tiroir visible.
// Comme une personne : la feuille ouverte d'abord refermée (sa croix), puis la ligne touchée.
const ouvrirVente = async (pg, tx) => {
  const t = pg.locator(`.vrm-sale-row[data-tx="${tx}"] .vrm-ledger-sale-toggle`).first();
  if (await t.getAttribute('aria-expanded') !== 'true') {
    const croix = pg.locator('.vrm-ledger-drawer-host:not([hidden]) .vrm-recap-fermer');
    if (await croix.count()) { await croix.first().click(); await pg.locator('.vrm-ledger-drawer-host:not([hidden])').first().waitFor({ state: 'detached', timeout: 4000 }).catch(() => {}); await pg.waitForTimeout(150); }
  }
  await t.scrollIntoViewIfNeeded();
  if (await t.getAttribute('aria-expanded') !== 'true') await t.click();
  const id = await t.getAttribute('aria-controls');
  await pg.locator(`[id="${id}"]`).waitFor({ state: 'visible', timeout: 8000 });
  await pg.waitForTimeout(400);
  return id;
};
// Ce que montre le tiroir ouvert, lu dans le DOM.
const lire = (pg, id) => pg.evaluate((id) => {
  const d = document.getElementById(id); if (!d) return null;
  const vw = window.innerWidth;
  // (10 nov., lot BE) Le récapitulatif porte LA FRISE PROUVÉE (src/FriseVente.jsx) : sept étapes,
  // chacune cochée seulement par SA preuve (`data-frv-etat` : fait · paslu · geste).
  const fr = d.querySelector('[data-recap-frise]');
  const etapes = [...d.querySelectorAll('[data-recap-frise] [data-frv-etape]')].map((li) => ({ cle: li.getAttribute('data-frv-etape'), fait: li.getAttribute('data-fait') === '1', etat: li.getAttribute('data-frv-etat'), quand: li.getAttribute('data-fait') === '1' ? 'fait' : 'à venir', sous: ((li.querySelector('.vrm-frv-sous') || {}).textContent || '').trim() }));
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !e.closest('details:not([open]) > :not(summary)'); };
  const txt = d.innerText;
  const montantsCasses = [];
  // Le MONTANT lui-même (« au plus » et la petite raison dessous ont leur propre taille) :
  for (const e of d.querySelectorAll('.vrm-recap-argent dd')) {
    if (!vis(e) || e.querySelector('button')) continue;
    const v = e.querySelector('.vrm-recap-montant') || e;
    const rg = document.createRange(); rg.selectNodeContents(v);
    const lignes = new Set([...rg.getClientRects()].filter((x) => x.width > 0).map((x) => Math.round(x.top)));
    if (lignes.size > 1) montantsCasses.push(v.textContent.trim());
  }
  const petites = [];
  for (const e of d.querySelectorAll('button, summary, a.vrm-b')) {
    if (!vis(e)) continue;
    const r = e.getBoundingClientRect(); if (r.height < 43.5) petites.push(`${Math.round(r.height)}px « ${(e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 24)} »`);
  }
  const hors = [...d.querySelectorAll('*')].filter((e) => vis(e) && !e.closest('svg') && e.getBoundingClientRect().right > vw + 1).map((e) => String(e.className || e.tagName).slice(0, 30));
  const benef = d.querySelector('[data-recap-benef-etat]');
  return {
    etapes, frise: !!d.querySelector('[data-recap-frise]'), bif: fr ? fr.getAttribute('data-frv-bif') : null,
    pastille: d.querySelectorAll('[data-statut-vente], .vrm-statut').length,
    phrase: (d.querySelector('[data-recap-phrase]') || {}).textContent || '',
    benefEtat: benef ? benef.getAttribute('data-recap-benef-etat') : null, benefData: benef ? benef.getAttribute('data-benef-vente') : null,
    benefTexte: benef ? benef.querySelector('dd').innerText.replace(/\s+/g, ' ').trim() : null,
    saisir: !!d.querySelector('[data-cout-vente-saisir]'), verse: (d.querySelector('[data-recap-verse]') || {}).getAttribute ? d.querySelector('[data-recap-verse]').getAttribute('data-recap-verse') : null,
    num: (d.querySelector('[data-recap-num]') || {}).getAttribute ? d.querySelector('[data-recap-num]').getAttribute('data-recap-num') : null,
    txt, montantsCasses, petites, hors: hors.slice(0, 5),
    deb: Math.max(document.documentElement.scrollWidth - vw, d.scrollWidth - d.clientWidth),
  };
}, id);
const faits = (r) => r.etapes.filter((e) => e.fait).map((e) => e.cle).join(',');
const etat = (r, c) => (r.etapes.find((e) => e.cle === c) || {}).etat;
const sous = (r, c) => (r.etapes.find((e) => e.cle === c) || {}).sous || '';

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] }).catch(() => chromium.launch());
  try {
    for (const [vp, sombre, nom] of [[{ width: 390, height: 844 }, false, '390 clair'], [{ width: 390, height: 844 }, true, '390 sombre'], [{ width: 1512, height: 982 }, false, '1512 clair']]) {
      console.log(`\n— ${nom}`);
      const { ctx, pg, errs } = await ouvrir(b, vp, sombre);
      const tel = vp.width < 600;
      const nomFichier = nom.replace(/\s+/g, '-');
      await essaie('7002 payée, sans bordereau', async () => {
        const r = await lire(pg, await ouvrirVente(pg, '7002'));
        dit(r.frise && faits(r) === 'vendue', 'payée sans bordereau : seule « Vendue » est cochée', faits(r));
        dit(etat(r, 'bordereau') === 'geste' && r.etapes.filter((e) => e.etat === 'geste').length === 1, '… « Bordereau » est le geste attendu (ambre), une seule étape ambre', r.etapes.map((e) => e.cle + ':' + e.etat).join(' '));
      });
      await essaie('7001 bordereau reçu', async () => {
        const id = await ouvrirVente(pg, '7001');
        const r = await lire(pg, id);
        dit(faits(r) === 'vendue,bordereau', 'bordereau reçu par email : Vendue + Bordereau, rien de plus', faits(r));
        dit(etat(r, 'deposee') === 'geste', '… « Déposée » est le geste attendu (ambre)', etat(r, 'deposee'));
        dit(r.benefEtat === 'achat' && r.benefData == null && r.benefTexte === '—', 'sans prix d’achat : bénéfice « — », aucun bénéfice publié', `${r.benefEtat} · ${r.benefData} · ${r.benefTexte}`);
        dit(r.saisir, 'le geste « Saisir le prix d’achat » est à la place du montant');
        dit(r.num === '', 'sans identité : « Sans N° VRM », aucun N° deviné', String(r.num));
        if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `recap-7001-${nomFichier}.png`) });
      });
      await essaie('7011 livrée', async () => {
        const id = await ouvrirVente(pg, '7011');
        const r = await lire(pg, id);
        dit(faits(r) === 'vendue,bordereau,deposee,livree', 'livrée + colis fait : Vendue, Bordereau, Déposée, Livrée — rien d’autre', faits(r));
        dit(etat(r, 'enroute') === 'paslu' && /pas lu/.test(sous(r, 'enroute')), '… « En route » : aucun transporteur lu ⇒ « pas lu », jamais déduit de « Livrée »', `${etat(r, 'enroute')} · ${sous(r, 'enroute')}`);
        dit(!r.etapes.find((e) => e.cle === 'versee').fait && !r.etapes.some((e) => e.etat === 'geste'), '… « Versée » pas cochée, aucune étape ambre (rien à faire)');
        dit(r.frise && r.pastille === 0, 'la frise REMPLACE la pastille de statut (jamais les deux)', `pastilles ${r.pastille}`);
        dit(r.benefEtat === 'partiel' && /au plus/.test(r.benefTexte) && r.benefData === '42.05', 'frais pas confirmés : « au plus 42,05 € » (79 − 35 − 1,95)', `${r.benefEtat} · ${r.benefTexte} · ${r.benefData}`);
        dit(r.verse === 'non', 'pas finalisée : « Versé — pas encore »', String(r.verse));
        dit(r.num === '73', 'le N° vient de l’identité (saisi à la main) : N°73', String(r.num));
        const fois = (re) => (r.txt.match(re) || []).length;
        dit(fois(/79,00/g) === 1 && fois(/N°\s?73/g) === 1, 'un nombre une seule fois (prix 79,00 et N°73)', `79,00 ×${fois(/79,00/g)} · N°73 ×${fois(/N°\s?73/g)}`);
        dit(!/encaiss|n\/d/i.test(r.txt), 'jamais « encaissé » ni « n/d »');
        dit(r.deb <= 1 && !r.hors.length, 'aucun débordement horizontal', `${r.deb}px ${r.hors.join(' | ')}`);
        dit(!r.montantsCasses.length, 'aucun montant cassé sur deux lignes', r.montantsCasses.join(' | '));
        if (tel) dit(!r.petites.length, 'au téléphone, toutes les cibles font 44 px', r.petites.join(' | '));
        if (SHOTS) {
          await pg.screenshot({ path: path.join(SHOTS, `recap-7011-${nomFichier}.png`) });
          const h = await pg.evaluate((id) => { const d = document.getElementById(id); const c = d && d.querySelector('.vrm-ledger-drawer-body'); return c ? c.scrollHeight - c.clientHeight : 0; }, id);
          if (h > 0) { await pg.setViewportSize({ width: vp.width, height: vp.height + h + 40 }); await pg.waitForTimeout(500); await pg.screenshot({ path: path.join(SHOTS, `recap-7011-${nomFichier}-long.png`) }); await pg.setViewportSize(vp); await pg.waitForTimeout(300); }
        }
      });
      await essaie('7005 finalisée', async () => {
        const r = await lire(pg, await ouvrirVente(pg, '7005'));
        dit(faits(r) === 'vendue,finalisee,versee', 'finalisée (450), versée : Vendue, Finalisée, Versée — rien de déduit', faits(r));
        dit(['bordereau', 'deposee', 'enroute', 'livree'].every((c) => etat(r, c) === 'paslu' && /pas lu/.test(sous(r, c))), '… bordereau, dépôt, route, livraison sans preuve : gris, « pas lu »', r.etapes.map((e) => e.cle + ':' + e.etat).join(' '));
        dit(r.verse === 'date' && /25 oct/.test(r.txt), 'versée : la date du versement lue (25 oct.)', `${r.verse}`);
        const dates = (r.txt.match(/25 oct/g) || []).length;
        dit(dates === 1, 'la date du versement n’est écrite qu’une fois', `×${dates}`);
      });
      await essaie('toucher à côté', async () => {
        const id = await ouvrirVente(pg, '7005');
        const t = pg.locator('.vrm-sale-row[data-tx="7005"] .vrm-ledger-sale-toggle').first();
        // un toucher sur la page hors du tiroir (le titre de l'écran, toujours au-dessus de la feuille)
        await pg.locator('.vrm-app-shell:not(.vrm-ledger-drawer-host) .vrm-main').first().click({ position: { x: 8, y: 8 }, force: true });
        await pg.waitForFunction((id) => { const d = document.getElementById(id); return !d || !!d.closest('[hidden]'); }, id, { timeout: 4000 }).catch(() => {});
        dit(await t.getAttribute('aria-expanded') === 'false', 'un toucher à côté referme le tiroir');
      });
      await essaie('annulée', async () => {
        await pg.locator('button[aria-pressed]', { hasText: 'Annulées' }).first().click();
        await pg.locator('.vrm-sale-row[data-tx="7009"]').first().waitFor({ timeout: 8000 });
        const r = await lire(pg, await ouvrirVente(pg, '7009'));
        dit(r.frise && r.bif === 'annulee' && faits(r) === 'vendue' && /Annul/.test(r.phrase) && r.pastille === 0, 'vente annulée : la frise bifurque (« Annulée » après « Vendue »), une phrase dit l’état', `${r.bif} · ${faits(r)} · ${r.phrase.slice(0, 60)}`);
        dit(r.benefEtat == null && r.verse == null, '… ni bénéfice ni versement');
      });
      dit(!errs.length, 'aucune erreur d’app', errs.join(' | ').slice(0, 200));
      await ctx.close();
    }
  } finally { await b.close(); srv.close(); }
  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
