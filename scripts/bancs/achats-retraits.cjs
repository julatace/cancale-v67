// Banc : ACHATS et COLIS → À RETIRER (5 nov., Julien : « rien ne va c'est horrible dans achat […]
// ça me met que j'ai 33 colis à retirer j'en ai à peine 10 et ça me met 2 points de retrait alors
// que c'est le même »). Sa forme, en données INVENTÉES (dépôt public) :
//  · 3 Mondial Relay « disponible » au même point (l'un sans code) — les SEULS à retirer ;
//  · un achat « déposé » dont le n° de suivi est « livré au destinataire » chez le transporteur,
//    et son e-mail Vinted « t'attend » relié par la conversation ;
//  · un achat « Commande livrée ! » (`needs_action`) et son e-mail « livré au point relais » au
//    même titre (l'écran Achats le reliait par le TITRE et l'affichait « À retirer ») ;
//  · 3 achats « déposé » sans n° de suivi et leurs e-mails Vinted, au point des Mondial Relay ;
//  · 6 e-mails Vinted d'une adresse sans compte, au même point, et 6 Mondial Relay de la même
//    adresse, TOUS déjà retirés chez le transporteur ;
//  · un e-mail Vinted « Utilise le code B12345 » et la consigne au même code, retirée ;
//  · 2 000 achats finis (le compte relu par Orion), 5 en route.
// Exige (data-* et nombres, §6.4) : « À retirer · 3 » partout (publication, onglet, carte sombre) ;
// le point « Maison du Journal » UNE fois ; les doubles possibles à part, jamais comptés ; Achats :
// une seule carte de chiffres (pas de grille), Fournisseurs · Délai · Lots derrière « … », l'achat
// livré et l'achat retiré chez le transporteur disent « Arrivé », « Voir plus — 60 affichés sur N »
// avec N = tous les achats ; rien ne déborde ; aucune erreur. 390 tactile clair/sombre, 1512 clair/sombre.
// Lancer : npm run build ; BANC_PORT=8812 node scripts/bancs/achats-retraits.cjs  (SHOTS=dossier pour les captures)
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('playwright')); }
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = process.env.DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 8812);
const SHOTS = process.env.SHOTS || '';
const VUES = process.env.AR_VUES ? process.env.AR_VUES.split(',') : null;
const maintenant = new Date(2026, 10, 5, 21, 30, 0);
const MS = maintenant.getTime(), J = 864e5;
const iso = (t) => new Date(t).toISOString();
const ilYa = (j) => iso(MS - j * J);
const jour = (j) => { const d = new Date(MS + j * J); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const ACCOUNTS = [
  { id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: iso(MS) },
  { id: 2, vinted_user_id: '222', login: 'compte_b', domain: 'www.vinted.fr', updated_at: iso(MS) },
];
const cap = ilYa(0.06);
const url = (k) => `https://images1.vinted.net/t/b${k}/f800/x${k}.jpeg?s=x`;
const DEPOSE = "La livraison n'a pas encore eu lieu - colis déposé en bureau de Poste ou point relais";
const achat = (id, titre, statut, tus, j, k, extra = {}) => ({ transaction_id: id, conversation_id: `0000aaaa-0000-4000-8000-${String(id).padStart(12, '0')}`, title: titre, price: { amount: '24.90', currency_code: 'EUR' }, status: statut, transaction_user_status: tus, date: ilYa(j), photo: k ? { url: url(k) } : null, ...extra });
const conv = (id) => `0000aaaa-0000-4000-8000-${String(id).padStart(12, '0')}`;
const LIEU = 'MAISON DU JOURNAL, 4 RUE DU QUAI, 35000 VILLEA';
const A = [
  achat(5001, 'Baskets toile blanche 40', DEPOSE, 'needs_action', 6, 1),             // retiré chez le transporteur (n° 81000001)
  achat(5002, 'Bottines daim 38', 'Commande livrée ! ', 'needs_action', 6, 2),          // Vinted : livrée (déjà retirée)
  achat(5003, 'Sneakers rétro 41', DEPOSE, 'needs_action', 4, 3),                       // sans n° de suivi
  achat(5004, 'Mocassins cuir 42', DEPOSE, 'needs_action', 4, 4),
  achat(5005, 'Chaussures course 39', DEPOSE, 'needs_action', 3, 5),
  ...Array.from({ length: 5 }, (_, i) => achat(5100 + i, `Achat en route ${i + 1}`, "Commande expédiée et en cours d'acheminement ! ", 'waiting', 2, 10 + i)),
];
const FIN = "Transaction finalisée - L'acheteur a validé la commande";
const VIEUX = Array.from({ length: 2000 }, (_, i) => achat(600000 + i, `Achat fini ${i + 1}`, FIN, 'completed', 40 + i / 3, 0));
const mr = (n, j, extra = {}) => ({ id: `email_track_mondialrelay_${n}`, data: { type: 'suivi', carrier: 'mondialrelay', suivi: String(n), status: 'available', statusLabel: 'Arrivé au point de retrait', subject: `Votre colis ${n} est disponible`, receivedAt: ilYa(j), emailAt: ilYa(j), arriveLe: ilYa(j), code: '4' + String(n).slice(-5), lieu: LIEU, limite: jour(5 - j), consigne: false, account: 'compte_a', ...extra } });
const vt = (cle, titre, j, forme, extra = {}) => ({ id: `email_track_autre_conv-${cle}`, data: { type: 'suivi', carrier: 'autre', suivi: '', status: 'available', statusLabel: 'Arrivé au point relais (Vinted)', subject: `Commande mise à jour pour ${titre}`, receivedAt: ilYa(j), emailAt: ilYa(j), arriveLe: ilYa(j), code: null, lieu: LIEU, limite: null, consigne: false, conv: cle, source: 'vinted-commande', forme, cleLigne: `email_track_autre_conv-${cle}`, artTitle: titre, account: 'compte_a', ...extra } });
const tr = (carrier, n, etat, j) => ({ id: `transp_${carrier}_${n}`, data: { v: 1, suivi: String(n), carrier, etat, fini: etat === 'retire', libelle: etat === 'retire' ? 'Colis livré au destinataire' : '5 jours restants pour retirer', etatAt: ilYa(j), lu: ilYa(0.05), source: 'serveur', evenements: [] } });
const X = { recuSur: ['adresse-x@exemple.fr'], account: '' };
const TRACKS = [
  mr(81000010, 0.4), mr(81000011, 0.4), mr(81000012, 0.4, { code: null }),               // les 3 à retirer (le dernier : code à venir)
  tr('mondialrelay', 81000010, 'disponible', 0.4), tr('mondialrelay', 81000011, 'disponible', 0.4), tr('mondialrelay', 81000012, 'disponible', 0.4),
  mr(81000001, 2), tr('mondialrelay', 81000001, 'retire', 1),                           // l'achat 5001, retiré
  vt(conv(5001), 'Baskets toile blanche 40', 1.5, 'attend'),
  vt(conv(5002), 'Bottines daim 38', 1.5, 'livre'),
  vt(conv(5003), 'Sneakers rétro 41', 0.5, 'attend'), vt(conv(5004), 'Mocassins cuir 42', 0.5, 'attend'), vt(conv(5005), 'Chaussures course 39', 0.5, 'attend'),
  ...Array.from({ length: 6 }, (_, i) => vt(`0000bbbb-0000-4000-8000-00000000000${i}`, `Article inconnu ${i + 1}`, 1.2, i % 2 ? 'livre' : 'attend', X)),
  ...Array.from({ length: 6 }, (_, i) => mr(82000000 + i, 2, X)), ...Array.from({ length: 6 }, (_, i) => tr('mondialrelay', 82000000 + i, 'retire', 1)),
  { id: 'email_track_vinted_VGS000000000001', data: { type: 'suivi', carrier: 'vinted', suivi: 'VGS000000000001', status: 'available', statusLabel: 'Arrivé au point de retrait', subject: 'Libère de la place dans la consigne : récupère ton colis #VGS000000000001', receivedAt: ilYa(2), emailAt: ilYa(2), arriveLe: null, code: 'B12345', lieu: 'Consigne Vinted Go, Thé du Coin, 13 Rue Basse', limite: null, consigne: true, account: 'compte_b', qrUrl: 'https://qr.exemple/x.png' } },
  tr('vinted', 'VGS000000000001', 'retire', 1),
  vt('0000cccc-0000-4000-8000-000000000001', 'Escarpins noirs 37', 2, 'ici', { code: 'B12345', lieu: 'Thé du Coin, 13 Rue Basse, 56000 Villec', consigne: true, account: 'compte_b', conv: '' }),
];
const LIGNES = [
  { id: 'main', data: { vrm_ville: 'Villea' } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: cap, nItems: A.length + VIEUX.length, payload: { my_orders: [...A, ...VIEUX] } } },
  { id: 'harvest_222_orders_purchased', data: { capturedAt: cap, payload: { my_orders: [achat(5201, 'Escarpins noirs 37', FIN, 'completed', 9, 20)] } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: cap, payload: { my_orders: [] } } },
  { id: 'harvest_222_orders_sold', data: { capturedAt: cap, payload: { my_orders: [] } } },
  { id: 'harvest_111_suivi_5001', data: { tx: '5001', uid: '111', suivi: '81000001', transporteur: 'MONDIAL', capturedAt: cap, dernier: { t: 'Disponible pour retrait', at: ilYa(2) }, etapes: [{ t: 'Disponible pour retrait', at: ilYa(2) }] } },
  { id: 'panel_colis_relais', data: {} },
  ...TRACKS,
];
const ATTENDU = 3;
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).slice(0, 200)); } };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.mjs': 'text/javascript' };
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
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'string' ? (typeof v === 'object' ? JSON.stringify(v) : String(v)) : v);
  }
  return out;
};
const ouvrir = async (b, vp, sombre, query) => {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.clock.install({ time: maintenant });
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(s)); localStorage.setItem('vrm_visite_vue', JSON.stringify(true)); } catch (_) {} }, !!sombre);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    const u = r.request().url();
    const m = /images1\.vinted\.net\/t\/b(\d+)\//.exec(u);
    if (m) return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="${['#dfe3e8', '#e8e1d8', '#dfe5dd', '#e6dcdc'][m[1] % 4]}"/></svg>` });
    if (/api-adresse\.data\.gouv\.fr/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ features: [] }) });
    return ['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue();
  });
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    if (route.request().method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    if (!/\/rest\/v1\/app_data/.test(u)) return j([]);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: cap, cap: r.data.capturedAt });
    const filtres = [...u.matchAll(/[?&]data->>([a-zA-Z_]+)=(not\.)?is\.null/g)];
    const passe = (r) => filtres.every(([, k, non]) => ((r.data || {})[k] == null) === !non);
    const inn = /[?&]id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(',').map((x) => x.replace(/^"|"$/g, '')); return j(LIGNES.filter((r) => ids.includes(r.id) && passe(r)).map(forme)); }
    const eq = /[?&]id=eq\.([^&]*)/.exec(u);
    if (eq) return j(LIGNES.filter((r) => r.id === eq[1] && passe(r)).map(forme));
    const lks = [...u.matchAll(/[?&]id=like\.([^&]*)/g)];
    if (lks.length) { const res = lks.map((lk) => new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$')); return j(LIGNES.filter((r) => res.every((re) => re.test(r.id)) && passe(r)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?${query}`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs };
};
const deborde = (pg) => pg.evaluate(() => { const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; }; return { deb: document.documentElement.scrollWidth - window.innerWidth, hors: [...document.querySelectorAll('.vrm-main *')].filter((e) => vis(e) && !e.closest('svg,.vrm-rangee,.vrm-filtres,[data-defile],.maplibregl-map,.vrm-seg,.vrm-pilules') && getComputedStyle(e).position !== 'fixed' && e.getBoundingClientRect().right > window.innerWidth + 1).map((e) => String(e.className).slice(0, 40)).slice(0, 4) }; });

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] }).catch(() => chromium.launch());
  try {
    for (const [vp, sombre, nom] of [[{ width: 390, height: 844 }, false, '390-clair'], [{ width: 390, height: 844 }, true, '390-sombre'], [{ width: 1512, height: 982 }, false, '1512-clair'], [{ width: 1512, height: 982 }, true, '1512-sombre']]) {
      if (VUES && !VUES.includes(nom)) continue;
      console.log(`\n— Colis → À retirer · ${nom}`);
      { const { ctx, pg, errs } = await ouvrir(b, vp, sombre, 'tab=cat_bord');
        await essaie('retirer', async () => {
          await pg.locator('[data-colis-onglet-choix="retirer"]').first().waitFor({ timeout: 30000 });
          await pg.waitForFunction(() => { try { return !!JSON.parse(localStorage.getItem('vrm_colis_retirer') || 'null'); } catch (_) { return false; } }, null, { timeout: 25000 }).catch(() => {});
          await pg.waitForTimeout(2500);
          await pg.locator('[data-colis-onglet-choix="retirer"]').first().click();
          await pg.waitForTimeout(2000);
          const m = await pg.evaluate(() => {
            const pub = JSON.parse(localStorage.getItem('vrm_colis_retirer') || 'null');
            const attr = (s, a) => (document.querySelector(s) || { getAttribute: () => null }).getAttribute(a);
            return {
              pub: pub && { total: pub.total, aVerifier: pub.aVerifier, colis: (pub.colis || []).map((c) => c[3]) },
              onglet: attr('[data-colis-onglet-choix="retirer"]', 'data-colis-onglet-n'), carte: attr('[data-fu-colis-retirer]', 'data-fu-colis-retirer'),
              journal: [...document.querySelectorAll('.vrm-rpf-section:not(.is-repli) .vrm-rpf-point')].filter((p) => /journal/i.test((p.querySelector('.vrm-rpf-nom') || {}).textContent || '')).length,
              lignesJournal: [...document.querySelectorAll('.vrm-rpf-section:not(.is-repli) .vrm-rpf-point [data-cc-carte]')].filter((l) => /journal/i.test(((l.closest('.vrm-rpf-point') || {}).textContent) || '')).length,
              avenir: document.querySelectorAll('.vrm-rpf-section:not(.is-repli) [data-rp-code-a-venir]').length,
              double: attr('[data-rp-section="double"]', 'data-rp-section-n'), verif: attr('.vrm-rpf-verifier', 'data-retirer-a-verifier'),
              texte: (document.querySelector('.vrm-main') || document.body).innerText,
            };
          });
          dit(m.pub && m.pub.total === ATTENDU, `le nombre publié (vrm_colis_retirer) = ${ATTENDU} (les Mondial Relay disponibles seuls)`, JSON.stringify(m.pub));
          dit(m.onglet === String(ATTENDU) && m.carte === String(ATTENDU), '« À retirer · 3 » : onglet et carte sombre disent le même nombre', `${m.onglet}/${m.carte}`);
          dit(m.journal === 1 && m.lignesJournal === 3, '« Maison du Journal » : UN point, ses 3 colis dedans (même avec un code à venir)', `${m.journal} carte(s), ${m.lignesJournal} ligne(s)`);
          dit(m.avenir === 1, 'le colis sans code garde sa puce « Code à venir » dans la carte du point', String(m.avenir));
          dit(m.double === '9', '« Peut-être en double · 9 » : les moitiés Vinted sans identité, montrées, jamais comptées', String(m.double));
          dit(m.pub && m.pub.aVerifier === Number(m.verif || 0), '« à vérifier » : la carte et la liste disent le même nombre', `${m.pub && m.pub.aVerifier}/${m.verif}`);
          const d = await deborde(pg); dit(d.deb <= 1 && !d.hors.length, 'rien ne déborde', `${d.deb}px ${d.hors.join(' | ')}`);
          if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `retirer-${nom}.png`) });
        });
        dit(!errs.length, 'aucune erreur d’app (Colis)', errs.slice(0, 2).join(' | '));
        await ctx.close(); }
      console.log(`— Achats · ${nom}`);
      { const { ctx, pg, errs } = await ouvrir(b, vp, sombre, 'tab=cat_achats&vue=achats');
        await essaie('achats', async () => {
          const tous = pg.locator('[data-achats-onglet="all"]').first();
          await tous.waitFor({ timeout: 30000 }); await pg.waitForTimeout(3000); await tous.click(); await pg.waitForTimeout(1500);
          const m = await pg.evaluate(() => {
            const etat = (tx) => { const l = document.querySelector(`[data-achat-tx="${tx}"]`); return l ? (l.innerText.match(/À retirer|Arrivé|En route|Annulé|Payé/) || [''])[0] : null; };
            return {
              kpis: document.querySelectorAll('.vrm-achats-kpis').length, carte: document.querySelectorAll('.vrm-fu-ecran').length,
              plus: !!document.querySelector('[data-achats-plus]'), outils: !!document.querySelector('[data-achats-outils]'),
              e5001: etat('5001'), e5002: etat('5002'), e5003: etat('5003'),
              voirPlus: [...document.querySelectorAll('button')].map((x) => x.textContent).find((t) => /Voir plus/.test(t)) || '',
              vert: [...document.querySelectorAll('.vrm-buy-row *')].some((e) => /rgb\(46, 158, 91\)|rgb\(52, 199, 89\)|rgb\(48, 209, 88\)/.test(getComputedStyle(e).color) || (e.getBoundingClientRect().width === 6 && e.getBoundingClientRect().height === 6 && getComputedStyle(e).backgroundColor !== 'rgba(0, 0, 0, 0)')),
            };
          });
          dit(m.kpis === 0 && m.carte >= 1, 'une seule carte de chiffres (la grille ne la répète plus)', JSON.stringify({ kpis: m.kpis, carte: m.carte }));
          dit(m.plus && !m.outils, 'Fournisseurs · Délai · Lots rangés derrière « … »', JSON.stringify(m));
          dit(m.e5001 === 'Arrivé', 'achat « déposé » que le transporteur dit livré au destinataire ⇒ « Arrivé »', String(m.e5001));
          dit(m.e5002 === 'Arrivé', '« Commande livrée ! » ⇒ « Arrivé » (plus relié à un e-mail par son titre)', String(m.e5002));
          dit(m.e5003 === 'À retirer', 'achat « déposé » sans autre preuve ⇒ « À retirer »', String(m.e5003));
          dit(/60 affichés sur 2011/.test(m.voirPlus), '« Voir plus » honnête : tous les achats lus (2 011), 60 affichés', m.voirPlus);
          dit(!m.vert, 'aucune couleur hors palette sur les lignes (ni vert « Reçu », ni pastille de compte)');
          await pg.locator('[data-achats-plus]').first().click(); await pg.waitForTimeout(400);
          dit(await pg.locator('[data-achats-outils]').count() === 1, '« … » ouvre Fournisseurs · Délai · Lots');
          await pg.locator('[data-achats-plus]').first().click(); await pg.waitForTimeout(300);
          const d = await deborde(pg); dit(d.deb <= 1 && !d.hors.length, 'rien ne déborde', `${d.deb}px ${d.hors.join(' | ')}`);
          if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `achats-${nom}.png`) });
        });
        dit(!errs.length, 'aucune erreur d’app (Achats)', errs.slice(0, 2).join(' | '));
        await ctx.close(); }
    }
  } finally { await b.close(); srv.close(); }
  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  if (ko) process.exitCode = 1;
})();
