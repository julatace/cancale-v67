// Banc de la REVUE VISUELLE du 21 octobre (après l'inspecteur des ventes en
// tiroir, d5cc962). Fixtures (`fx/`, jamais dans le dépôt). Deux tailles :
// 390 tactile (clair), 1512 (sombre). Il juge des MESURES, jamais un libellé seul.
// `EXPLORE=dossier` (option `TAILLE=390|1512`, `ECRANS=a,b`) : captures hautes
// de chaque écran et section, le tiroir d'une vente ouvert, les cibles < 44 px.
// `SONDE=tab [SECTION=…] JS=fichier.js` : évalue un script dans l'écran.
//   A. Achats : le « i » d'un point de retrait cerclé et centré dans sa tête.
//   B. Achats : « J'ai retiré » d'un colis sans code jamais seul à gauche.
//   C. Colis : « à poster en priorité » ambre, pas rouge (§7).
//   D. Leboncoin : « Mes transactions » jamais coupé de ses guillemets.
//   E. eBay : une consigne « onglet / section « X » » nomme une section qui existe.
//   F. eBay → À traiter : chaque « Actualiser » a son titre visible.
//   G. eBay → Compte : pas de bande de fond pleine largeur.
//   H. Compta : « Compléter les prix d'achat » une fois dans « Ton bénéfice ».
//   I. Compta : les segments de période remplissent leur piste.
//   J. Compta → Abonnements : aucune phrase répétée.
//   K. Communauté (panne) : « Réessayer » ne colle pas au texte.
//   L. Comptes liés : « Gérer ce compte » centré dans sa zone de 44 px.
//   M. Vinted : un espace après le bandeau de fraîcheur.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const { dressingsDuJour } = require('./_instantane.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist'), SC = __dirname;
if (!fs.existsSync(path.join(SC, 'fx', 'main.json'))) { console.log('⚠️ fixtures absentes (scripts/bancs/fx) — banc non lancé'); process.exit(0); }
const FX = f => JSON.parse(fs.readFileSync(path.join(SC, 'fx', f + '.json'), 'utf8'));
const main = FX('main'), accounts = FX('accounts');
const rows = [...FX('sold'), ...FX('purch'), ...dressingsDuJour(FX('listings')), ...FX('inbox'), ...FX('track'), ...FX('bord'), ...FX('label'), ...FX('billing')];
const txn = FX('txn');
function projette(row, select) {
  if (!select || select === '*') return row;
  const out = {};
  for (const part of select.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const alias = m[1] || m[2].split('->').pop().replace(/^>/, ''); const src = m[2];
    if (src === 'id' || src === 'updated_at') { out[alias] = row[src]; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    if (/^data(->|->>)/.test(src)) {
      let v = row.data;
      for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = (v == null ? null : v[seg]);
      out[alias] = v == null ? null : v; continue;
    }
    out[alias] = row[src];
  }
  return out;
}
// La somme ATTENDUE, lue sur les fixtures : porte-monnaie des seuls comptes liés.
const lies = new Set(accounts.map(a => String(a.vinted_user_id || '')).filter(Boolean));
let attenduCts = 0, nLies = 0;
for (const r of FX('billing')) {
  const uid = String((/harvest_(\d+)_billing$/.exec(String(r.id || '')) || [])[1] || '');
  if (!lies.has(uid)) continue;
  const p = (r.data || {}).payload || {};
  const v = p.escrow && p.escrow.amount != null ? parseFloat(p.escrow.amount) : (p.pending_balance && p.pending_balance.amount != null ? parseFloat(p.pending_balance.amount) : NaN);
  if (!isNaN(v)) { attenduCts += v; nLies++; }
}
attenduCts = Math.round(attenduCts * 100);

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});
const PORT = Number(process.env.BANC_PORT) || 8811;
srv.on('error', e => { console.log('⚠️ port ' + PORT + ' pris (' + e.code + ') — relance avec BANC_PORT'); process.exit(1); });
srv.listen(PORT);

async function contexte(b, W, H, tactile, sombre) {
  const ctx = await b.newContext({ viewport: { width: W, height: H }, isMobile: tactile, hasTouch: tactile });
  const pg = await ctx.newPage();
  pg.__errs = [];
  pg.on('pageerror', e => pg.__errs.push(e.message.slice(0, 120)));
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', s ? 'true' : 'false'); } catch (_) {} }, !!sombre);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r3) => {
    const t3 = r3.request().resourceType();
    if (t3 === 'image' || t3 === 'media' || t3 === 'font') return r3.abort();
    return r3.continue();
  });
  await pg.route('**://*.vinted.net/**', r4 => r4.abort());
  await pg.route('**/rest/v1/**', async route => {
    const u = metaVersData(route.request().url());
    // Les comptes arrivent APRÈS le premier rendu (comme sur un vrai réseau) :
    // c'est la forme qui révèle une lecture partie sans eux.
    const j = d => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) { await new Promise(r => setTimeout(r, 900)); return j(accounts); }
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1]; const S = sel ? decodeURIComponent(sel) : null;
    if (/id=eq\.main/.test(u)) return j(main.map(r => projette(r, S)));
    if (/transaction->>id/.test(u)) return j(txn);
    const eq = /id=eq\.([^&]*)/.exec(u); if (eq) { const k = decodeURIComponent(eq[1]); return j(rows.filter(r => r.id === k).map(r => projette(r, S))); }
    const m = /id=like\.([^&]*)/.exec(u); if (m) { const re = new RegExp('^' + decodeURIComponent(m[1]).replace(/[*%]/g, '.*') + '$'); return j(rows.filter(r => re.test(r.id)).map(r => projette(r, S))); }
    return j([]);
  });
  await pg.route('**/api/**', r2 => r2.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true,"devices":1}' }));
  return { ctx, pg };
}

(async () => {
  let ko = 0;
  const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  // Un bloc qui lève devient un contrôle ROUGE, jamais un banc mort.
  const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle n\'a pas pu se dérouler', e.message.slice(0, 140)); } };
  const aller = async (pg, tab, attente = 4500) => { await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(attente); };
  const section = async (pg, nom) => { await pg.locator('.vrm-seg-btn', { hasText: nom }).first().click({ timeout: 5000 }); await pg.waitForTimeout(2500); };

  // `SONDE=tab SECTION=nom JS=fichier.js TAILLE=390|1512` : évalue un script dans l'écran (pour mesurer).
  if (process.env.SONDE) {
    const t = process.env.TAILLE === '1512' ? [1512, 950, false, true] : [390, 844, true, false];
    const { ctx, pg } = await contexte(b, ...t);
    await pg.goto(`http://localhost:${PORT}/?tab=${process.env.SONDE}`, { waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(4500);
    if (process.env.SECTION) { await pg.locator('.vrm-seg-btn', { hasText: process.env.SECTION }).first().click({ timeout: 5000 }); await pg.waitForTimeout(2500); }
    const r = await pg.evaluate(fs.readFileSync(process.env.JS, 'utf8'));
    console.log(JSON.stringify(r, null, 1));
    if (process.env.CAPTURE) await pg.screenshot({ path: process.env.CAPTURE });
    await b.close(); srv.close(); process.exit(0);
  }
  if (process.env.EXPLORE) {
    const D = process.env.EXPLORE; fs.mkdirSync(D, { recursive: true });
    const ECR = (process.env.ECRANS || 'journee,plat_vinted,plat_leboncoin,plat_ebay,cat_bord,garage,dashboard,compta,communaute,settings,vintedaccounts').split(',');
    const TAILLES = [[390, 3400, '390', true, false], [1512, 2600, '1512', false, true]].filter(t => !process.env.TAILLE || process.env.TAILLE === t[2]);
    for (const [W, H, tag, tactile, sombre] of TAILLES) {
      const { ctx, pg } = await contexte(b, W, H, tactile, sombre);
      for (const e of ECR) {
        await pg.goto(`http://localhost:${PORT}/?tab=${e}`, { waitUntil: 'domcontentloaded' });
        await pg.waitForTimeout(4000);
        const sections = e.startsWith('plat_') ? await pg.$$eval('.vrm-rubriques .vrm-seg-btn, nav .vrm-seg-btn', bs => bs.map(x => (x.innerText || '').trim()).filter(Boolean)).catch(() => []) : [];
        for (const s of (sections.length ? sections : [''])) {
          if (s) { const ok = await pg.locator('.vrm-seg-btn', { hasText: s }).first().click({ timeout: 3000 }).then(() => true).catch(() => false); if (!ok) continue; await pg.waitForTimeout(2000); }
          const nom = `${tag}-${e}${s ? '-' + s.replace(/[^\w]+/g, '_') : ''}`;
          await pg.screenshot({ path: path.join(D, nom + '.png'), timeout: 20000 }).catch(() => {});
          const debord = await pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
          if (debord > 1) fs.appendFileSync(path.join(D, 'debord.txt'), `${nom} : ${debord} px\n`);
          if (tactile) {
            const petits = await pg.evaluate(() => {
              const out = [];
              for (const el of document.querySelectorAll('.vrm-main button, .vrm-main a[href], .vrm-main summary, .vrm-main input:not([type=hidden]), .vrm-main select, .vrm-main [role=tab]')) {
                const rc = el.getBoundingClientRect(); if (!rc.width || !rc.height) continue;
                const cs = getComputedStyle(el); if (cs.visibility === 'hidden') continue;
                if (rc.height < 43.5 || (rc.width < 30)) out.push(`${el.tagName.toLowerCase()} ${Math.round(rc.width)}x${Math.round(rc.height)} « ${((el.innerText || el.getAttribute('aria-label') || el.value || '') + '').trim().slice(0, 40)} »`);
              }
              return out.slice(0, 40);
            });
            fs.appendFileSync(path.join(D, 'petits.txt'), `## ${nom}\n${petits.join('\n')}\n`);
          }
          if (e === 'plat_vinted' && /Ventes/.test(s)) {
            const ok = await pg.locator('.vrm-ledger-sale-toggle').first().click({ timeout: 3000 }).then(() => true).catch(() => false);
            if (ok) { await pg.waitForTimeout(1500); await pg.screenshot({ path: path.join(D, nom + '-tiroir.png'), timeout: 20000 }).catch(() => {}); await pg.keyboard.press('Escape').catch(() => {}); await pg.waitForTimeout(800); }
          }
        }
      }
      if (pg.__errs.length) console.log('erreurs', tag, [...new Set(pg.__errs)].slice(0, 3));
      await ctx.close();
    }
    await b.close(); srv.close(); process.exit(0);
  }

  for (const [W, H, tactile, sombre] of [[390, 900, true, false], [1512, 950, false, true]]) {
    const { ctx, pg } = await contexte(b, W, H, tactile, sombre);

    // A. Vinted → Achats : le « i » d'un point de retrait est un bouton qui se
    //    voit (un cercle), centré dans la tête de son bloc — plus une lettre nue
    //    plantée sous la ligne du titre.
    await essaie(`[${W}] A`, async () => {
      await aller(pg, 'plat_vinted'); await section(pg, 'Achats');
      const r = await pg.evaluate(() => [...document.querySelectorAll('.vrm-pickup-point')].map(p => {
        const s = p.querySelector('.vrm-pickup-method > summary'); if (!s) return null;
        const tete = p.querySelector(':scope > div:first-child').getBoundingClientRect();
        const rc = s.getBoundingClientRect(), av = getComputedStyle(s, '::before');
        const cy = rc.top + rc.height / 2;
        return { cercle: av.content !== 'none' && parseFloat(av.borderTopWidth) >= 1 && /50%|9999/.test(av.borderTopLeftRadius + av.borderRadius), dansTete: cy >= tete.top && cy <= tete.top + Math.min(tete.height, 60) && Math.abs(cy - (tete.top + Math.min(tete.height, 44) / 2)) <= 6, cy: Math.round(cy - tete.top), th: Math.round(tete.height) };
      }).filter(Boolean));
      dit(r.length > 0, `[${W}] Vinted → Achats : les points de retrait ont leur bouton « i »`);
      if (r.length) dit(r.every(x => x.cercle && x.dansTete), `[${W}] Vinted → Achats : le « i » est cerclé et centré dans la tête du bloc`, r.map(x => `${x.cercle ? 'cercle' : 'nu'} @${x.cy}/${x.th}`).join(' · '));
    });

    // B. Vinted → Achats : « J'ai retiré » reste du côté droit de sa carte, même
    //    quand le colis n'a pas de code (il tombait seul à gauche, sous la photo).
    await essaie(`[${W}] B`, async () => {
      const r = await pg.evaluate(() => [...document.querySelectorAll('.vrm-pickup-collect')].filter(b => b.closest('.vrm-pickup-card') && !b.closest('.vrm-pickup-card').querySelector('.vrm-pickup-code')).map(btn => {
        const card = btn.closest('.vrm-pickup-card'); if (!card) return null;
        const c = card.getBoundingClientRect(), bb = btn.getBoundingClientRect(), pr = parseFloat(getComputedStyle(card).paddingRight) || 0;
        if (!bb.width) return null;
        return Math.round((c.right - pr) - bb.right);
      }).filter(x => x != null));
      dit(r.length > 0, `[${W}] Vinted → Achats : des colis sans code ont leur bouton « J'ai retiré »`);
      // Aucun bouton à plus de la moitié de la carte du bord droit : jamais seul à gauche.
      const mauvais = await pg.evaluate(() => [...document.querySelectorAll('.vrm-pickup-collect')].filter(b => b.closest('.vrm-pickup-card') && !b.closest('.vrm-pickup-card').querySelector('.vrm-pickup-code')).filter(btn => {
        const card = btn.closest('.vrm-pickup-card'); if (!card) return false;
        const c = card.getBoundingClientRect(), bb = btn.getBoundingClientRect();
        return bb.width && (bb.left - c.left) < (c.width - bb.width) / 2 && (c.right - bb.right) > 40;
      }).length);
      if (r.length) dit(mauvais === 0, `[${W}] Vinted → Achats : aucun « J'ai retiré » laissé seul à gauche de sa carte`, `${mauvais} à gauche`);
    });

    // C. Colis : « N à poster en priorité » n'est pas rouge (§7 : le rouge est
    //    pour deux paires sous un même N°) — l'urgence est ambre.
    await essaie(`[${W}] C`, async () => {
      await aller(pg, 'cat_bord', 5500);
      const r = await pg.evaluate(() => {
        const el = [...document.querySelectorAll('.vrm-main span')].find(s => /^à poster en priorité/.test(s.textContent.trim()));
        if (!el) return null;
        const box = el.closest('div[style*="border"]') || el.parentElement.parentElement;
        const n = el.previousElementSibling;
        const rgb = s => (s.match(/\d+(\.\d+)?/g) || []).map(Number);
        return { bord: rgb(getComputedStyle(box).borderTopColor), chiffre: rgb(getComputedStyle(n).color) };
      });
      dit(!!r, `[${W}] Colis : le bandeau « à poster en priorité » est rendu`);
      if (r) { const rouge = c => c[0] > 150 && c[1] < c[0] * 0.45; dit(!rouge(r.bord) && !rouge(r.chiffre), `[${W}] Colis : « à poster en priorité » est ambre, pas rouge`, `bord rgb(${r.bord.slice(0, 3)}) · chiffre rgb(${r.chiffre.slice(0, 3)})`); }
    });

    // D. Leboncoin : « Mes transactions » ne se coupe jamais entre « et son mot.
    if (tactile) await essaie(`[${W}] D`, async () => {
      const coupes = [];
      for (const nom of ['Ventes', 'Colis']) {
        await aller(pg, 'plat_leboncoin'); await section(pg, nom);
        const c = await pg.evaluate(() => {
          const out = [];
          const w = document.createTreeWalker(document.querySelector('.vrm-main'), NodeFilter.SHOW_TEXT);
          for (let n = w.nextNode(); n; n = w.nextNode()) {
            const t = n.textContent; let i = t.indexOf('Mes transactions');
            while (i > 0) {
              const g = t.lastIndexOf('«', i), d = t.indexOf('»', i);
              const top = (a) => { const r = document.createRange(); r.setStart(n, a); r.setEnd(n, a + 1); const q = r.getClientRects()[0]; return q ? Math.round(q.top) : null; };
              if (g >= 0 && top(g) !== top(i)) out.push('« | Mes');
              if (d > 0 && top(d) !== top(i + 'Mes transactions'.length - 1)) out.push('transactions | »');
              i = t.indexOf('Mes transactions', i + 1);
            }
          }
          return out;
        });
        coupes.push(...c.map(x => nom + ' : ' + x));
      }
      dit(coupes.length === 0, `[${W}] Leboncoin : « Mes transactions » ne se coupe pas d'avec ses guillemets`, coupes.join(' · '));
    });

    // E. eBay : une consigne qui renvoie à un onglet nomme un onglet qui existe.
    await essaie(`[${W}] E`, async () => {
      const faux = [];
      for (const nom of ['Annonces']) {
        await aller(pg, 'plat_ebay'); await section(pg, nom);
        const f = await pg.evaluate(() => {
          const libs = new Set([...document.querySelectorAll('.vrm-platform-tabs .vrm-seg-btn')].map(b => b.textContent.replace(/\s+/g, ' ').trim()));
          const t = document.querySelector('.vrm-main').innerText;
          return [...t.matchAll(/(?:onglet|section)\s+«\s*([^»]+?)\s*»/gi)].map(m => m[1]).filter(x => !libs.has(x));
        });
        faux.push(...f.map(x => nom + ' : « ' + x + ' »'));
      }
      dit(faux.length === 0, `[${W}] eBay : chaque « onglet / section » cité existe dans la barre des sections`, faux.join(' · '));
    });

    // F. eBay → À traiter : chaque « Actualiser » partage sa ligne avec un titre
    //    visible (un bouton seul ne dit pas ce qu'il relit).
    await essaie(`[${W}] F`, async () => {
      await aller(pg, 'plat_ebay'); await section(pg, 'À traiter');
      const r = await pg.evaluate(() => [...document.querySelectorAll('.vrm-main button')].filter(b => /^(Actualiser|Lecture…)$/.test(b.textContent.trim()) && b.getBoundingClientRect().width).map(b => {
        const h = b.parentElement.querySelector('h1,h2,h3,h4');
        const r = h && h.getBoundingClientRect();
        return !!(r && r.width > 4 && r.height > 4);
      }));
      dit(r.length >= 2 && r.every(Boolean), `[${W}] eBay → À traiter : chaque « Actualiser » a son titre visible`, r.map(x => x ? 'titré' : 'seul').join(' · '));
    });

    // G. eBay → Compte : pas de dalle de fond posée par-dessus la page (une
    //    bande grise qui s'arrêtait sous la carte, en clair).
    await essaie(`[${W}] G`, async () => {
      await aller(pg, 'plat_ebay'); await section(pg, 'Compte');
      const r = await pg.evaluate(() => {
        const nav = document.querySelector('.vrm-platform-tabs'); const cadre = nav && nav.closest('.vrm-seg-cadre'); const bas = cadre ? cadre.getBoundingClientRect().bottom - 1 : 0;
        return [...document.querySelectorAll('.vrm-main *')].filter(el => {
          const q = el.getBoundingClientRect(); if (q.width < innerWidth - 40 || q.top < bas || q.height < 30) return false;
          const cs = getComputedStyle(el); return !/rgba\(0, 0, 0, 0\)/.test(cs.backgroundColor) && el.closest('.vrm-main') && !el.closest('[class*="card"],[style*="border-radius"]');
        }).map(el => el.tagName + ' ' + getComputedStyle(el).backgroundColor);
      });
      dit(r.length === 0, `[${W}] eBay → Compte : aucune bande de fond pleine largeur sous les sections`, r.join(' · '));
    });

    // H. Compta → « Ton bénéfice » : le geste « Compléter les prix d'achat » est
    //    écrit une fois (il l'était sur la ligne du brut ET sur celle du net).
    await essaie(`[${W}] H`, async () => {
      await aller(pg, 'compta', 5500);
      const n = await pg.$$eval('[data-benef-porte]', l => l.filter(e => e.getBoundingClientRect().width).length).catch(() => -1);
      dit(n === 1, `[${W}] Compta : « Compléter les prix d'achat » une seule fois dans « Ton bénéfice »`, `${n} fois`);
    });

    // I. Compta : le choix de période remplit sa piste (pas de vide à droite des
    //    trois segments).
    await essaie(`[${W}] I`, async () => {
      const r = await pg.$eval('[aria-label="Période du bénéfice"]', g => {
        const cs = getComputedStyle(g), inner = g.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        const bs = [...g.querySelectorAll('button')]; const used = bs[bs.length - 1].getBoundingClientRect().right - bs[0].getBoundingClientRect().left;
        return { vide: Math.round(inner - used) };
      }).catch(() => null);
      dit(!!r && r.vide <= 8, `[${W}] Compta : les segments Mois · Trimestre · Année remplissent leur piste`, r ? `vide ${r.vide} px` : 'absent');
    });

    // J. Compta : la section Abonnements ne dit pas deux fois la même chose
    //    (« il sera compté à chaque échéance » / « comptés à chaque échéance »).
    await essaie(`[${W}] J`, async () => {
      const r = await pg.$eval('[data-compta-section="abonnements"]', s => {
        const t = s.innerText.replace(/\s+/g, ' ').toLowerCase(); const N = 16; const vus = new Map();
        for (let i = 0; i + N <= t.length; i++) { const k = t.slice(i, i + N); if (vus.has(k) && i - vus.get(k) >= N) return k; if (!vus.has(k)) vus.set(k, i); }
        return '';
      }).catch(() => null);
      dit(r === '', `[${W}] Compta → Abonnements : aucune phrase répétée`, r == null ? 'section absente' : `« ${r} »`);
    });

    // K. Communauté (lecture ratée) : « Réessayer » ne colle pas au texte.
    await essaie(`[${W}] K`, async () => {
      await aller(pg, 'communaute', 4000);
      const r = await pg.$eval('[data-cm-reessayer]', b => { const p = b.previousElementSibling; return p ? Math.round(b.getBoundingClientRect().top - p.getBoundingClientRect().bottom) : null; }).catch(() => null);
      dit(r != null && r >= 8, `[${W}] Communauté : « Réessayer » respire sous son texte`, `écart ${r} px`);
    });

    // L. Comptes liés : « Gérer ce compte » est centré dans sa zone de 44 px
    //    (le texte collé en haut laissait un vide sous chaque carte).
    await essaie(`[${W}] L`, async () => {
      await aller(pg, 'vintedaccounts', 4000);
      const r = await pg.$$eval('[data-gerer-compte] > summary', ss => ss.map(s => {
        const rg = document.createRange(); rg.selectNodeContents(s); const t = rg.getClientRects()[0], q = s.getBoundingClientRect();
        return t ? Math.round(Math.abs((t.top + t.height / 2) - (q.top + q.height / 2))) : 99;
      })).catch(() => []);
      dit(r.length > 0 && r.every(x => x <= 4), `[${W}] Comptes liés : « Gérer ce compte » centré dans sa zone`, [...new Set(r)].join(', ') + ' px du centre');
    });

    // M. Vinted : le bandeau « données plus à jour » ne touche pas ce qui suit
    //    (la rangée des sections sur ordinateur, la carte « Compte » au doigt).
    await essaie(`[${W}] M`, async () => {
      await aller(pg, 'plat_vinted');
      const r = await pg.evaluate(() => {
        const b = document.querySelector('[data-fraicheur-comptes]'); if (!b) return null;
        const bb = b.getBoundingClientRect(); let min = 1e9, quoi = '';
        for (const el of document.querySelectorAll('.vrm-main *')) {
          if (b.contains(el) || el.contains(b)) continue;
          const q = el.getBoundingClientRect(); if (q.width < 100 || q.height < 20) continue;
          if (q.top < bb.top + bb.height / 2) continue;
          const d = q.top - bb.bottom; if (d < min) { min = d; quoi = el.tagName + '.' + String(el.className).slice(0, 30); }
        }
        return { ecart: Math.round(min), quoi };
      });
      dit(!!r, `[${W}] Vinted : le bandeau de fraîcheur est rendu (fixtures datées)`);
      if (r) dit(r.ecart >= 8, `[${W}] Vinted : un espace sépare le bandeau de fraîcheur de ce qui suit`, `${r.ecart} px avant ${r.quoi}`);
    });

    if (pg.__errs.length) dit(false, `[${W}] erreurs de page`, [...new Set(pg.__errs)].slice(0, 3).join(' | '));
    await ctx.close();
  }

  await b.close(); srv.close();
  console.log(ko ? `\n${ko} défaut(s).` : '\n✅ revue du 21 octobre : rien à signaler');
  process.exit(ko ? 1 : 0);
})().catch(e => { console.log('❌ banc mort : ' + e.message); process.exit(1); });
