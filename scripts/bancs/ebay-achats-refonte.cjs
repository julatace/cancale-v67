// Banc : eBAY → ACHATS, LA REFONTE (16 nov., lot ebay-achats-refonte) — données INVENTÉES, faux eBay.
// Julien, sur 4 captures iPhone : « Améliore eBay, c'est de la merde. » (titres bleu marine
// sur fond bleu, champs bleu foncé, textes d'exemple invisibles, « Recherches enregistrées »
// écrit deux fois, un paragraphe technique « Les données », trop long.)
// Rend eBay → Achats à 390 px tactile et 1512 px, CLAIR et SOMBRE, et juge :
//   M  les MESURES (toujours imprimées, avant comme après) : hauteur de la partie eBay
//      (du haut de l'onglet au repli « achats gagnés »), nombre de mots visibles, contraste
//      MINIMUM de chaque texte visible (placeholders compris), sur le fond réellement peint
//      (dégradé : sa pire couleur) ;
//   A  trois cartes, dans l'ordre : « Chercher sur eBay » · « Mes recherches » · « Nouvelles
//      annonces » ; « Recherches enregistrées » n'est écrit nulle part, aucun sur-titre
//      « Gestion », le paragraphe « Les données » est replié (« Détails »), le quota reste
//      dit en un coin (« 1/200 aujourd'hui ») ;
//   B  chaque texte visible ≥ 4,5:1 (placeholders compris), champs : fond clair en mode
//      clair, un bord, cibles ≥ 44 px, clavier décimal (prix, pointure), Entrée = Chercher ;
//   C  chercher : état/achat immédiat/livrable en France sous « Plus de critères » (replié),
//      Entrée dans le champ « Prix max » envoie la recherche avec ses critères ; résultats
//      photo/prix/port/lien eBay ;
//   D  « Enregistrer cette recherche » ⇒ `veille.creer` (même liste qu'Organisation), elle
//      apparaît en UNE ligne : nom, budget, nombre de nouvelles ;
//   E  « Me prévenir » (interrupteur, role=switch) ⇒ `veille.alerte` {alerte:true} pour CETTE
//      recherche, l'interrupteur dit « allumé » ; le prix de revente se règle au détail ;
//   F  « Nouvelles annonces » : la liste lue par la route `alertes` (photo, prix, port, lien) ;
//      rien ⇒ une phrase courte avec le geste ;
//   G  le détail d'une recherche s'ouvre au toucher (critères, Modifier, Archiver) ;
//      « Exporter » et « Historique » sont dans un menu ; aucune erreur de page, aucun
//      débordement horizontal.
// Jugé sur des data-*, des rôles et des nombres. `BANC_CAPTURE=<dossier>` : captures.
// `BANC_DIST=<dossier>` : un autre build (preuve §6.1 : le build de main doit rougir A–G).
//        BANC_PORT=$((20000+RANDOM%20000)) node -r ./scripts/bancs/_porte-banc.cjs -r ./scripts/bancs/_garde-reseau.cjs scripts/bancs/ebay-achats-refonte.cjs
const { chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || process.env.PORT) || 9531;
const CAPT = process.env.BANC_CAPTURE || '';
const auj = new Date();
const ACCS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: auj.toISOString() }];
const il = (n) => new Date(auj.getTime() - n * 86400000);
const vente = (id, prix, titre) => ({ transaction_id: id, title: titre, price: { amount: String(prix), currency_code: 'EUR' }, status: 'Commande finalisée', date: il(3 + (id % 5)).toISOString() });
const rows = [
  { id: 'main', data: {} },
  { id: 'ebay_comptes', data: { comptes: [{ cle: 'aaaaaaaaaaaaaaa1', pseudo: 'paire_perso', principal: true }] } },
  { id: 'ebay_orders', data: { orders: [], capturedAt: Date.now() } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: auj.toISOString(), payload: { my_orders: [vente(9001, 80, 'Adidas Spezial bleu 42'), vente(9002, 90, 'Adidas Spezial noir 42'), vente(9003, 70, 'Adidas Spezial rouge 42')] } } },
];
const V = (n, titre, mots, x) => ({ id: '00000000-0000-4000-8000-00000000000' + n, titre, mots, pointure: '42', exclus: '', categorie: '', etatArticle: 'tous', minimum: null, maximum: 2000, pays: 'tous', achatImmediat: true, livraisonFR: true, etat: 'preparee', version: 1, cree: '2026-11-0' + n + 'T10:00:00.000Z', evenements: [], ...x });
const V1 = V(1, 'Adidas Spezial', 'adidas spezial', { exclus: 'Fake' });
const V2 = V(2, 'Samba 42', 'adidas samba', { maximum: 6000, alerte: true, revente: 9000, reventeSite: 'vinted' });
const item = (id, titre, prix, port) => ({ itemId: id, titre, prix, port, total: port == null ? null : prix + port, etat: 'Occasion', vendeur: 'vendeur_' + id.slice(-3, -2), avis: 99.1, photo: null, url: 'https://www.ebay.fr/itm/' + id.replace(/\D/g, '').slice(1, -1), achatImmediat: true, enchere: false, date: auj.toISOString(), pays: 'FR' });
const NOUVELLE = () => [{ ...item('v1|801|0', 'Adidas Samba OG blanc 42', 4500, 600), veille: V2.id, recherche: 'Samba 42' }];
let veillesBanc, ops, envois, appels, nouvelles;
const reinit = (avecNouvelle) => { veillesBanc = [V1, V2]; ops = []; envois = []; appels = []; nouvelles = avecNouvelle ? NOUVELLE() : []; };
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { dit(false, quoi, 'a levé : ' + String((e && e.message) || e).split('\n')[0].slice(0, 160)); return null; } };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.onnx': 'application/octet-stream' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul'); process.exit(1); });
srv.listen(PORT);
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'string' ? String(v) : v);
  }
  return out;
};
const reponseChercher = (body) => {
  const items = /spezial/i.test(body.mots || '')
    ? [item('v1|701|0', 'Adidas Spezial bleu taille 42', 1500, 450), item('v1|702|0', 'Adidas Spezial noir 42 occasion', 1700, null)]
    : [item('v1|711|0', 'Adidas Samba OG noir 42', 5000, 500)];
  return { ok: true, items, total: items.length, horsBudget: 0, exclus: 0, autreDevise: 0, criteres: body, appels: { aujourdhui: appels.length, plafond: 200, fil: appels.filter((a) => a.source === 'fil').length, plafondFil: 150 }, quotaEbay: null, plafondEbayDoc: 5000, octets: { ebay: 9000, vrm: 1200 }, lueA: new Date().toISOString() };
};
async function ouvrir(b, vp, sombre) {
  const ctx = await b.newContext({ viewport: vp, locale: 'fr-FR', ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_je_vends', JSON.stringify({ choix: 'sneakers', at: '2026-11-01T10:00:00.000Z' })); if (s) localStorage.setItem('vinted_dark', 'true'); } catch (_) {} }, !!sombre);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => r.abort());
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d, st) => route.fulfill({ status: st || 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return j({ m: 1 }, 400);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: auj.toISOString() });
    const eq = /id=eq\.([^&]*)/.exec(u); if (eq) return j(rows.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.route('**/api/compte?mode=operations**', (route) => {
    const j = (d, st) => route.fulfill({ status: st || 200, contentType: 'application/json', body: JSON.stringify(d) });
    const donnees = () => ({ version: 1, revision: 4 + ops.length, missions: [], reservations: [], lots: [], consommables: [], veilles: veillesBanc, receptions: [], dossiers: [], journal: [], commandes: [] });
    if (route.request().method() === 'POST') {
      let c = {}; try { c = JSON.parse(route.request().postData() || '{}'); } catch (_) {}
      ops.push(c);
      if (c.type === 'veille.creer') veillesBanc = [...veillesBanc, { ...c.donnees, id: c.id, etat: 'preparee', version: 1, cree: new Date().toISOString(), evenements: [] }];
      if (c.type === 'veille.alerte') veillesBanc = veillesBanc.map((v) => (v.id === c.donnees.cible ? { ...v, alerte: c.donnees.alerte, revente: c.donnees.revente, reventeSite: c.donnees.site } : v));
      if (c.type === 'veille.archiver') veillesBanc = veillesBanc.map((v) => (v.id === c.donnees.cible ? { ...v, etat: 'archivee' } : v));
      return j({ ok: true, donnees: donnees(), equipe: [], serveur: new Date().toISOString(), confirmees: [c.id] });
    }
    return j({ ok: true, donnees: donnees(), equipe: [], serveur: new Date().toISOString(), confirmees: [] });
  });
  await pg.route('**/api/ebay**', (route) => {
    const req = route.request();
    const j = (d, st) => route.fulfill({ status: st || 200, contentType: 'application/json', body: JSON.stringify(d) });
    if (req.method() !== 'POST') return j({ ok: true, ready: true, canConsent: true });
    let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch (_) {}
    if (body.action === 'chercher') { appels.push(body); return j(reponseChercher(body)); }
    envois.push(body);
    if (body.action === 'alertes') {
      if (body.op === 'ecarter') nouvelles = nouvelles.filter((x) => !body.itemIds.includes(x.itemId));
      const at = new Date(auj.getTime() - 3600e3).toISOString();
      return j({ ok: true, lue: true, nouvelles, recherches: { [V2.id]: { at, n: 4, echec: null, premiere: '2026-11-10T10:00:00.000Z', refus: null } }, dernier: { at, raison: null }, limites: { parHeure: 4, intervalleMin: 60, partAuto: 150, plafondJour: 200 } });
    }
    if (body.action === 'status') return j({ ok: true, connected: true, comptes: [{ cle: 'aaaaaaaaaaaaaaa1', pseudo: 'paire_perso', principal: true, relie: true }] });
    return j({ ok: true });
  });
  return { ctx, pg, errs };
}
const ouvrirAchats = async (pg) => {
  await pg.goto(`http://localhost:${PORT}/?tab=plat_ebay&section=achats`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('[data-ebay-recherche]', { timeout: 30000 });
  // Les lectures (recherches enregistrées, fil, alertes) posées.
  await pg.waitForFunction(() => { const f = document.querySelector('[data-ebay-fil]'); const a = document.querySelector('[data-alertes-ebay]'); return f && !/en-cours/.test(f.getAttribute('data-ebay-fil')) && (!a || a.getAttribute('data-alertes-ebay') !== 'en-cours') && !document.querySelector('[data-ebay-fil-recherche][data-etat="encours"]'); }, null, { timeout: 20000 }).catch(() => {});
  await pg.waitForTimeout(600);
};
const deborde = (pg) => pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

// Les mesures : hauteur, mots, contraste minimum (texte et placeholders), sur la partie eBay.
const mesurer = (pg) => pg.evaluate(() => {
  const onglet = document.querySelector('[data-ebay-achats-onglet]');
  if (!onglet) return null;
  const fin = onglet.querySelector('[data-ebay-achats-gagnes]');
  const o = onglet.getBoundingClientRect();
  const hauteur = Math.round((fin ? fin.getBoundingClientRect().top : o.bottom) - o.top);
  const rgba = (c) => { const m = (c || '').match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; };
  const L = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ratio = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const mel = (h, b) => [0, 1, 2].map((i) => h[i] * h[3] + b[i] * (1 - h[3])).concat(1);
  // Les fonds possibles sous un élément : les couches jusqu'à la première opaque ; un dégradé
  // donne CHACUNE de ses couleurs (on garde la pire).
  const fonds = (el) => {
    const couches = [];
    let fond = null;
    for (let e = el; e; e = e.parentElement) {
      fond = e;
      const cs = getComputedStyle(e);
      const bi = cs.backgroundImage;
      if (bi && /gradient/.test(bi)) { const cols = (bi.match(/rgba?\([^)]+\)/g) || []).map(rgba).filter(Boolean); if (cols.length) { couches.push({ grad: cols }); if (cols.every((c) => c[3] >= 0.99)) break; } }
      const c = rgba(cs.backgroundColor);
      if (c && c[3] > 0) { couches.push({ c }); if (c[3] >= 0.99) break; }
    }
    let bases = [[255, 255, 255, 1]];
    // Le fond du verre est peint par un pseudo-élément (dégradé --sv-haut → --sv-bas) : arrivé à
    // la page, chaque arrêt du dégradé est un fond possible (le plus clair compris).
    if (fond && (fond === document.documentElement || fond === document.body) && document.querySelector('.vrm-app-shell[data-espace]')) {
      const rs = getComputedStyle(document.documentElement);
      const hex = (h) => { const m = /^#([0-9a-f]{6})$/i.exec(String(h || '').trim()); return m ? [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4), 16), 1] : null; };
      const arrets = ['--sv-haut', '--sv-milieu', '--sv-bas'].map((v) => hex(rs.getPropertyValue(v))).filter(Boolean);
      if (arrets.length) { couches.pop(); bases = arrets; }
    }
    for (let i = couches.length - 1; i >= 0; i--) {
      const k = couches[i];
      if (k.grad) bases = k.grad.flatMap((g) => bases.map((b) => mel(g, b)));
      else bases = bases.map((b) => mel(k.c, b));
    }
    return bases;
  };
  const visible = (el) => { const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; for (let e = el; e; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) return false; if (e.tagName === 'DETAILS' && !e.open && e !== el && !(el.closest('summary') && el.closest('summary').parentElement === e)) return false; } return true; };
  let mini = 99, pire = '', textes = 0;
  const limiteBas = fin ? fin.getBoundingClientRect().top : Infinity;
  const juger = (el, couleur, texte) => {
    const c = rgba(couleur); if (!c) return;
    for (const b of fonds(el)) { const t = mel(c, b); const r = ratio(t, b); if (r < mini) { mini = r; pire = texte.slice(0, 60) + ' · ' + couleur + ' sur rgb(' + b.slice(0, 3).map(Math.round).join(',') + ')'; } }
  };
  const tous = [...onglet.querySelectorAll('*')].filter((el) => !(fin && (fin === el || fin.contains(el))) && el.getBoundingClientRect().top < limiteBas);
  let mots = 0;
  for (const el of tous) {
    const direct = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(' ').replace(/\s+/g, ' ').trim();
    if (direct && visible(el)) { textes++; mots += direct.split(' ').filter((w) => /[\p{L}\p{N}]/u.test(w)).length; juger(el, getComputedStyle(el).color, direct); }
    if ((el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && el.placeholder && !el.value && visible(el)) { textes++; juger(el, getComputedStyle(el, '::placeholder').color, 'placeholder « ' + el.placeholder + ' »'); }
    if (el.tagName === 'SELECT' && visible(el)) { juger(el, getComputedStyle(el).color, 'select ' + (el.value || '')); }
  }
  return { hauteur, mots, contraste: Math.round(mini * 100) / 100, pire, textes };
});

(async () => {
  let b;
  const mesures = {};
  try {
    b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const [vp, sombre] of [[{ width: 390, height: 844 }, false], [{ width: 390, height: 844 }, true], [{ width: 1512, height: 950 }, false], [{ width: 1512, height: 950 }, true]]) {
      const nom = vp.width + (sombre ? '-sombre' : '-clair');
      console.log(`── ${vp.width} px · ${sombre ? 'sombre' : 'clair'}${vp.width < 600 ? ' · tactile' : ''}`);
      reinit(true);
      const { ctx, pg, errs } = await ouvrir(b, vp, sombre);
      await essaie('ouvrir eBay → Achats', () => ouvrirAchats(pg));
      if (process.env.BANC_INSPECT) await essaie('inspecter', async () => {
        const cdp = await pg.context().newCDPSession(pg);
        await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
        const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
        const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: process.env.BANC_INSPECT });
        const m = await cdp.send('CSS.getMatchedStylesForNode', { nodeId });
        for (const r of m.matchedCSSRules || []) { const props = r.rule.style.cssProperties.filter((x) => /background|border|color|box-shadow/.test(x.name) && x.value).map((x) => x.name + ':' + x.value + (x.important ? '!' : '')); if (props.length) console.log('RÈGLE ' + r.rule.selectorList.text.slice(0, 160) + ' {' + props.join('; ').slice(0, 300) + '} ' + (r.rule.origin) + ' ' + ((r.rule.layers || []).map((l) => l.text).join('/'))); }
      });
      // ── M · mesures (la vue telle qu'elle s'ouvre) ─────────────────────────
      // (Une entrée animée en fondu rend la vue invisible quelques instants : on attend des textes.)
      let m = null;
      for (let i = 0; i < 20 && !(m && m.textes >= 10); i++) { if (i) await pg.waitForTimeout(500); m = await essaie('mesurer', () => mesurer(pg)); }
      dit(!!m && m.textes >= 10, 'la mesure voit les textes de la partie eBay', m && String(m.textes));
      mesures[nom] = m;
      console.log('MESURE ' + nom + ' · hauteur ' + (m && m.hauteur) + ' px · ' + (m && m.mots) + ' mots · contraste mini ' + (m && m.contraste) + ':1 (' + (m && m.pire) + ') · ' + (m && m.textes) + ' textes');
      if (CAPT) { fs.mkdirSync(CAPT, { recursive: true }); await pg.screenshot({ path: path.join(CAPT, 'achats-ebay-' + nom + '.png'), fullPage: true }).catch(() => {}); }
      // ── A · structure ────────────────────────────────────────────────────
      await essaie('structure', async () => {
        const blocs = await pg.$$eval('[data-ebay-bloc]', (l) => l.map((e) => e.getAttribute('data-ebay-bloc')));
        dit(blocs.join(',') === 'chercher,recherches,nouvelles', 'trois cartes, dans l’ordre : chercher · mes recherches · nouvelles annonces', blocs.join(','));
        const cartes = await pg.$$eval('[data-ebay-bloc]', (l) => l.map((e) => { const cs = getComputedStyle(e); return { fond: cs.backgroundColor, bord: cs.borderTopWidth, rayon: parseFloat(cs.borderTopLeftRadius) }; }));
        dit(cartes.length === 3 && cartes.every((c) => !/rgba\(0, 0, 0, 0\)|transparent/.test(c.fond) && c.rayon >= 8), 'chaque bloc est une carte (fond plein, coins arrondis)', JSON.stringify(cartes[0] || {}));
        const txt = await pg.$eval('[data-ebay-achats-onglet]', (e) => e.innerText);
        dit(!/Recherches enregistrées/i.test(txt) && !/\bGestion\b/i.test(txt) && !/Tes prochaines trouvailles/.test(txt), 'ni « Recherches enregistrées », ni « Gestion », ni phrase d’accroche', (txt.match(/Recherches enregistrées|Gestion|Tes prochaines trouvailles/gi) || []).join(' | '));
        const don = await pg.$('[data-ebay-donnees]');
        const ouvertDon = don ? await don.evaluate((e) => { const d = e.closest('details'); return d ? (d.open ? 'ouvert' : 'replie') : 'visible'; }) : 'absent';
        dit(ouvertDon === 'replie' || ouvertDon === 'absent', '« Les données » repliées sous « Détails »', ouvertDon);
        const q = await pg.$eval('[data-ebay-quota-court]', (e) => e.innerText).catch(() => '');
        dit(/^\d+\/200 aujourd’hui$/.test(q.trim()), 'le quota reste dit, discret : « N/200 aujourd’hui »', q);
      });
      // ── B · lisibilité des champs ───────────────────────────────────────────
      await essaie('champs lisibles', async () => {
        dit(m && m.contraste >= 4.5, 'chaque texte visible (placeholders compris) ≥ 4,5:1', m && (m.contraste + ' · ' + m.pire));
        const ch = await pg.$$eval('[data-ebay-form-recherche] input:not([type=checkbox]), [data-ebay-form-recherche] select, [data-ebay-form-recherche] button', (l) => l.filter((e) => e.getBoundingClientRect().height > 0).map((e) => { const cs = getComputedStyle(e); const c = (cs.backgroundColor.match(/\d+(\.\d+)?/g) || []).map(Number); return { n: e.getAttribute('aria-label') || e.textContent.trim(), h: Math.round(e.getBoundingClientRect().height), bord: parseFloat(cs.borderTopWidth), lum: c.length ? (c[0] + c[1] + c[2]) / 3 : -1, im: e.getAttribute('inputmode') || '' }; }));
        dit(ch.length >= 4 && ch.every((x) => x.h >= 44), 'champs et bouton du formulaire : 44 px au moins', JSON.stringify(ch.map((x) => x.n + ':' + x.h)));
        const champs = ch.filter((x) => x.n !== 'Chercher' && !/^Plus/.test(x.n));
        dit(champs.every((x) => x.bord >= 1), 'chaque champ a un bord', JSON.stringify(champs.map((x) => x.n + ':' + x.bord)));
        if (!sombre) dit(champs.every((x) => x.lum >= 235), 'mode clair : chaque champ sur fond clair', JSON.stringify(champs.map((x) => x.n + ':' + Math.round(x.lum))));
        const im = ch.filter((x) => /Prix maximum|Pointure/.test(x.n)).map((x) => x.im);
        dit(im.length === 2 && im.every((x) => x === 'decimal'), 'clavier décimal pour le prix et la pointure', JSON.stringify(im));
        const plus = await pg.$eval('[data-ebay-plus-criteres]', (e) => ({ tag: e.tagName, open: e.open, etat: !!e.querySelector('select[aria-label="État"]'), ai: /Achat immédiat/.test(e.textContent), fr: /Livrable en France/.test(e.textContent) })).catch(() => null);
        dit(!!plus && plus.tag === 'DETAILS' && !plus.open && plus.etat && plus.ai && plus.fr, '« Plus de critères » replié porte état, achat immédiat, livrable en France', JSON.stringify(plus));
      });
      // ── C · chercher (Entrée dans « Prix max ») ─────────────────────────────
      await essaie('chercher', async () => {
        const avant = appels.length;
        await pg.fill('[aria-label="Mots à chercher"]', 'adidas spezial');
        await pg.fill('[aria-label="Pointure"]', '42');
        await pg.fill('[aria-label="Prix maximum"]', '20');
        await pg.press('[aria-label="Prix maximum"]', 'Enter');
        await pg.waitForSelector('[data-ebay-liste="manuel"]', { timeout: 10000 });
        const a = appels[avant] || {};
        dit(a.mots === 'adidas spezial' && a.pointure === '42' && a.maximum === 2000 && a.achatImmediat === true && a.livraisonFR === true && a.source !== 'fil', 'Entrée = Chercher : la recherche part avec ses critères (prix en centimes)', JSON.stringify(a));
        const r = await pg.$$eval('[data-ebay-liste="manuel"] [data-ebay-resultat]', (l) => l.map((e) => ({ ph: !!e.querySelector('.eba-ph'), prix: e.querySelector('[data-ebay-prix]') && e.querySelector('[data-ebay-prix]').getAttribute('data-ebay-prix'), port: e.querySelector('[data-ebay-port]') && e.querySelector('[data-ebay-port]').getAttribute('data-ebay-port'), lien: (e.querySelector('[data-voir-ebay]') || {}).href || '', h: e.querySelector('[data-voir-ebay]') ? e.querySelector('[data-voir-ebay]').getBoundingClientRect().height : 0 })));
        dit(r.length === 2 && r.every((x) => x.ph && x.prix && /^https:\/\/www\.ebay\.fr\/itm\//.test(x.lien) && x.h >= 44) && r[1].port === 'inconnu', 'résultats : photo, prix, port (inconnu dit), lien eBay 44 px', JSON.stringify(r));
        if (CAPT) await pg.locator('[data-ebay-bloc="chercher"]').screenshot({ path: path.join(CAPT, 'chercher-' + nom + '.png') }).catch(() => {});
      });
      // ── D · enregistrer la recherche ───────────────────────────────────────
      await essaie('enregistrer', async () => {
        const avantApp = appels.length;
        await pg.click('[data-geste="ajouter-fil"]');
        await pg.waitForFunction(() => document.querySelectorAll('[data-ebay-fil-recherche]').length === 3, null, { timeout: 10000 });
        const c = ops.find((x) => x.type === 'veille.creer');
        dit(!!c && c.donnees.mots === 'adidas spezial' && c.donnees.maximum === 2000 && c.donnees.pointure === '42', '« Enregistrer cette recherche » ⇒ veille.creer (mots, budget, pointure)', JSON.stringify(c && c.donnees));
        dit(appels.length === avantApp, 'enregistrer ne relance pas la recherche chez eBay', (appels.length - avantApp) + ' appel(s)');
        const lignes = await pg.$$eval('[data-ebay-fil-recherche]', (l) => l.map((e) => { const t = e.querySelector('[data-ebay-ligne]'); const r = t ? t.getBoundingClientRect() : { height: 0 }; return { id: e.getAttribute('data-ebay-fil-recherche'), h: Math.round(r.height), t: t ? t.innerText.replace(/\s+/g, ' ') : '', nv: e.getAttribute('data-ebay-nouvelles') }; }));
        dit(lignes.length === 3 && lignes.every((x) => x.h >= 44 && x.h <= 96 && /\d+,\d\d\s€/.test(x.t) && x.nv !== null), 'chaque recherche tient en UNE ligne (44–96 px) : nom, budget, nouvelles', JSON.stringify(lignes.map((x) => x.h + ' · ' + x.t.slice(0, 50) + ' · nv ' + x.nv)));
      });
      // ── E · « Me prévenir » ────────────────────────────────────────────────
      await essaie('me prévenir', async () => {
        const sw = await pg.$('[data-ebay-fil-recherche="' + V1.id + '"] [role="switch"]');
        dit(!!sw, 'un interrupteur « Me prévenir » sur la ligne');
        const ar = sw ? await sw.evaluate((e) => ({ c: e.getAttribute('aria-checked'), h: e.getBoundingClientRect().height, w: e.getBoundingClientRect().width, n: e.getAttribute('aria-label') || '' })) : {};
        dit(ar.c === 'false' && ar.h >= 44 && ar.w >= 44 && /Me prévenir/.test(ar.n), 'éteint au départ, 44 px, nommé « Me prévenir »', JSON.stringify(ar));
        if (sw) await sw.click();
        await pg.waitForFunction((id) => { const e = document.querySelector('[data-ebay-fil-recherche="' + id + '"] [role="switch"]'); return e && e.getAttribute('aria-checked') === 'true'; }, V1.id, { timeout: 10000 });
        const o = ops.find((x) => x.type === 'veille.alerte');
        dit(!!o && o.donnees.cible === V1.id && o.donnees.alerte === true, '« Me prévenir » ⇒ veille.alerte {alerte:true} pour CETTE recherche', JSON.stringify(o && o.donnees));
        dit(true, 'l’interrupteur dit « allumé » ensuite');
      });
      // ── G · détail au toucher, menu ────────────────────────────────────────
      await essaie('détail et menu', async () => {
        await pg.click('[data-ebay-fil-recherche="' + V1.id + '"] [data-ebay-ligne]');
        await pg.waitForSelector('[data-ebay-fil-recherche="' + V1.id + '"] [data-ebay-detail]', { timeout: 5000 });
        const d = await pg.$eval('[data-ebay-fil-recherche="' + V1.id + '"] [data-ebay-detail]', (e) => ({ t: e.innerText, modifier: !!e.querySelector('[data-geste="modifier-recherche"]'), archiver: !!e.querySelector('[data-geste="archiver-recherche"]'), revente: !!e.querySelector('[data-geste="prix-revente"]') }));
        dit(/Fake/.test(d.t) && d.modifier && d.archiver && d.revente, 'le détail s’ouvre au toucher : critères (exclusions), Modifier, Archiver, prix de revente', JSON.stringify({ ...d, t: d.t.replace(/\s+/g, ' ').slice(0, 120) }));
        if (CAPT) await pg.locator('[data-ebay-bloc="recherches"]').screenshot({ path: path.join(CAPT, 'recherches-' + nom + '.png') }).catch(() => {});
        await pg.click('[data-geste="modifier-recherche"]');
        await pg.waitForSelector('[data-ebay-edition]', { timeout: 5000 });
        const ed = await pg.$$eval('[data-ebay-edition] input, [data-ebay-edition] select', (l) => l.filter((e) => e.type !== 'checkbox' && e.getBoundingClientRect().height > 0).map((e) => Math.round(e.getBoundingClientRect().height)));
        dit(ed.length >= 4 && ed.every((h) => h >= 44), 'la modification : champs de 44 px', JSON.stringify(ed));
        await pg.click('[data-ebay-edition] [data-geste="annuler-edition"]');
        const menu = await pg.$('[data-ebay-menu]');
        dit(!!menu, 'un menu « … » dans « Mes recherches »');
        if (menu) { await pg.click('[data-ebay-menu] > summary'); }
        const items = await pg.$$eval('[data-ebay-menu] [role="menuitem"], [data-ebay-menu] button', (l) => l.map((e) => e.textContent.trim()));
        dit(items.some((x) => /Exporter/.test(x)) && items.some((x) => /Historique|archivées/.test(x)), '« Exporter » et « Historique » sont dans le menu', JSON.stringify(items));
        const horsMenu = await pg.$$eval('[data-ebay-bloc="recherches"] button', (l) => l.filter((e) => !e.closest('[data-ebay-menu]') && /^(Exporter|Historique)/.test(e.textContent.trim())).length);
        dit(horsMenu === 0, 'aucun « Exporter » / « Historique » hors du menu', String(horsMenu));
        if (menu) await pg.click('[data-ebay-menu] > summary');
      });
      // ── F · nouvelles annonces ─────────────────────────────────────────────
      await essaie('nouvelles annonces', async () => {
        const l = await pg.$$eval('[data-ebay-bloc="nouvelles"] [data-alerte-ebay]', (x) => x.map((e) => ({ id: e.getAttribute('data-alerte-ebay'), lien: (e.querySelector('[data-voir-ebay]') || {}).href || '', prix: (e.querySelector('[data-alerte-prix]') || { getAttribute: () => '' }).getAttribute('data-alerte-prix') })));
        dit(l.length === 1 && l[0].id === 'v1|801|0' && /^https:\/\/www\.ebay\.fr\/itm\//.test(l[0].lien) && l[0].prix === '4500', 'une nouvelle annonce se voit dans « Nouvelles annonces » (prix, lien eBay)', JSON.stringify(l));
        if (CAPT) await pg.locator('[data-ebay-bloc="nouvelles"]').screenshot({ path: path.join(CAPT, 'nouvelles-' + nom + '.png') }).catch(() => {});
        await pg.click('[data-alerte-ebay="v1|801|0"] [data-alerte-retirer]');
        await pg.waitForSelector('[data-alerte-ebay="v1|801|0"]', { state: 'detached', timeout: 10000 });
        const vide = await pg.$eval('[data-ebay-bloc="nouvelles"]', (e) => e.innerText.replace(/\s+/g, ' ').trim()).catch(() => '');
        const mots = vide.split(' ').length;
        dit(/Rien de nouveau|Aucune nouvelle/.test(vide) && mots <= 22, 'plus rien : une phrase courte (≤ 22 mots)', mots + ' mots · ' + vide.slice(0, 160));
      });
      dit(errs.length === 0, 'aucune erreur de page', errs.join(' | ').slice(0, 200));
      dit((await deborde(pg)) <= 1, 'aucun débordement horizontal', String(await deborde(pg)));
      await ctx.close();
      // ── F' · sans alerte allumée et sans nouvelle : le geste est dit ─────────
      if (vp.width < 600 && !sombre) {
        reinit(false); veillesBanc = [V1];
        const o2 = await ouvrir(b, vp, sombre);
        await essaie('sans alerte', async () => {
          await ouvrirAchats(o2.pg);
          const t = await o2.pg.$eval('[data-ebay-bloc="nouvelles"]', (e) => e.innerText.replace(/\s+/g, ' ').trim()).catch(() => '');
          dit(/Me prévenir/.test(t) && t.split(' ').length <= 22, 'aucune alerte : une phrase courte avec le geste « Me prévenir »', t.slice(0, 160));
        });
        await o2.ctx.close();
      }
    }
  } catch (e) { dit(false, 'le banc a levé', String(e && e.message || e).slice(0, 200)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log('MESURES ' + JSON.stringify(mesures));
  console.log(ko ? `\n${ko} KO` : '\nTout est OK');
  process.exit(ko ? 1 : 0);
})();
