// Banc de la REVUE du 19 octobre (après les fusions du jour : achats en lignes,
// Colis en lignes fines, bénéfice brut/net, case à cocher mobile). Fixtures
// (`fx/`, jamais dans le dépôt). Il juge des NOMBRES et des MESURES, jamais un
// libellé.
//   A. Ma journée — « En attente » (`data-argent-attente`) = la somme des
//      porte-monnaie des comptes LIÉS (un compte supprimé n'a plus d'argent chez
//      toi). Le premier passage partait AVANT l'arrivée des comptes, donc sans
//      filtre, et n'était jamais refait : 9 porte-monnaie au lieu de 6.
//   B. Annonces (390) — la ligne « N annonces à confirmer » : la phrase ne dit
//      pas « ne est », et son bouton ne fait pas un trou dans le paragraphe
//      (cible de 44 px gardée, rendue à la ligne par sa marge).
//   C. Achats › colis jamais retirés — « Je l'ai eu » au même endroit sur
//      chaque ligne, l'âge jamais coupé, « Vérifier » à 44 px affichés, et pas
//      de rouge (§7 : réservé à deux paires sous un même N°).
//   D. Colis — aucune couleur de l'ancienne palette menthe (#0F8A6A).
//   E. Compta — la prochaine échéance se dit « au moins » quand la ligne
//      publiée porte des ventes finalisées sans date de versement.
//   F. Colis en lignes (1512) — « Colis fait » à la même place sur chaque ligne.
//   G. Annonces (390) — une valeur éditable en place (« achat — ») fait 44 px de large.
// Rouge sur le build de 47e9249 (13 défauts), vert après.
// `EXPLORE=dossier` : captures hautes de chaque écran (pour REGARDER, §6.2) et
// la liste des cibles tactiles < 44 px affichés à 390 px.
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
const PORT = Number(process.env.BANC_PORT) || 7790;
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

  if (process.env.EXPLORE) {
    const D = process.env.EXPLORE; fs.mkdirSync(D, { recursive: true });
    const ECR = (process.env.ECRANS || 'journee,plat_vinted,plat_leboncoin,plat_ebay,cat_bord,garage,dashboard,compta,settings,vintedaccounts').split(',');
    for (const [W, H, tag, tactile, sombre] of [[390, 3400, '390', true, false], [1512, 2600, '1512', false, true]]) {
      const { ctx, pg } = await contexte(b, W, H, tactile, sombre);
      for (const e of ECR) {
        await pg.goto(`http://localhost:${PORT}/?tab=${e}`, { waitUntil: 'domcontentloaded' });
        await pg.waitForTimeout(3000);
        const sections = e.startsWith('plat_') ? await pg.$$eval('.vrm-rubriques .vrm-seg-btn, nav .vrm-seg-btn', bs => bs.map(x => (x.innerText || '').trim()).filter(Boolean)).catch(() => []) : [];
        for (const s of (sections.length ? sections : [''])) {
          if (s) { const ok = await pg.locator('.vrm-seg-btn', { hasText: s }).first().click({ timeout: 3000 }).then(() => true).catch(() => false); if (!ok) continue; await pg.waitForTimeout(1500); }
          const nom = `${tag}-${e}${s ? '-' + s.replace(/[^\w]+/g, '_') : ''}`;
          await pg.screenshot({ path: path.join(D, nom + '.png'), timeout: 20000 }).catch(() => {});
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
        }
      }
      if (pg.__errs.length) console.log('erreurs', tag, [...new Set(pg.__errs)].slice(0, 3));
      await ctx.close();
    }
    await b.close(); srv.close(); process.exit(0);
  }

  // A. Ma journée : « En attente » = porte-monnaie des comptes liés.
  for (const [W, H, tactile] of [[390, 844, true], [1512, 950, false]]) {
    const { ctx, pg } = await contexte(b, W, H, tactile, false);
    await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
    await pg.waitForSelector('[data-argent-attente]', { timeout: 15000 }).catch(() => {});
    await pg.waitForTimeout(2500);
    const v = await pg.$eval('[data-argent-attente]', el => Number(el.getAttribute('data-argent-attente'))).catch(() => null);
    dit(v === attenduCts, `[${W}] Ma journée « En attente » = porte-monnaie des ${nLies} comptes liés`, `affiché ${v} cts, attendu ${attenduCts} cts`);
    await ctx.close();
  }

  // B. Annonces (390) : la ligne « à confirmer ».
  {
    const { ctx, pg } = await contexte(b, 390, 844, true, false);
    await pg.goto(`http://localhost:${PORT}/?tab=cat_annonces`, { waitUntil: 'domcontentloaded' });
    await pg.waitForSelector('[data-a-confirmer-dit]', { timeout: 15000 }).catch(() => {});
    await pg.waitForTimeout(1500);
    const r = await pg.evaluate(() => {
      const sp = document.querySelector('[data-a-confirmer-dit]'); if (!sp) return null;
      const btn = sp.querySelector('[data-a-confirmer-ouvrir]');
      // Les lignes de texte du paragraphe (hors bouton) : l'écart d'une ligne à la suivante.
      const rg = document.createRange(); rg.setStartAfter(btn); rg.setEnd(sp, sp.childNodes.length);
      const tops = [...new Set([...rg.getClientRects()].map(x => Math.round(x.top)))].sort((a, b) => a - b);
      const lh = parseFloat(getComputedStyle(sp.parentElement).lineHeight) * 0.8 || 14;
      let saut = 0; for (let i = 1; i < tops.length; i++) saut = Math.max(saut, tops[i] - tops[i - 1]);
      const bt = btn.getBoundingClientRect();
      return { txt: sp.innerText, saut, lh, btnH: bt.height };
    });
    if (!r) dit(false, 'Annonces : la ligne « à confirmer » est rendue (les fixtures en portent une)');
    else {
      dit(!/\bne est\b/.test(r.txt), 'Annonces : la phrase « à confirmer » est correcte', r.txt.slice(0, 120));
      dit(r.saut > 0 && r.saut <= r.lh * 1.8, 'Annonces : le bouton « à confirmer » ne fait pas de trou dans le paragraphe', `écart entre deux lignes ${Math.round(r.saut)} px (ligne ${Math.round(r.lh)} px)`);
      dit(r.btnH >= 43.5, 'Annonces : la cible du bouton « à confirmer » garde 44 px affichés', `${Math.round(r.btnH)} px`);
    }
    // G. Les champs édités en place (« achat — », « N°2 ») : 44 px de large au doigt.
    const larg = await pg.evaluate(() => [...document.querySelectorAll('[data-edition]')].map(x => x.getBoundingClientRect()).filter(rc => rc.width > 0).map(rc => Math.round(rc.width)));
    const etroits = larg.filter(w => w < 43.5);
    dit(larg.length > 0 && etroits.length === 0, `Annonces (390) : les ${larg.length} valeurs éditables en place font 44 px de large au doigt`, etroits.length ? `${etroits.length} plus étroites (${[...new Set(etroits)].slice(0, 4).join(', ')} px)` : '');
    if (pg.__errs.length) dit(false, 'erreurs d’app', pg.__errs.join(' | '));
    await ctx.close();
  }

  // C. Achats › À retirer : les colis jamais retirés.
  for (const [W, H, tactile] of [[390, 844, true], [1512, 950, false]]) {
    const { ctx, pg } = await contexte(b, W, H, tactile, false);
    await pg.goto(`http://localhost:${PORT}/?tab=cat_achats`, { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(4000);
    const r = await pg.evaluate(() => {
      // Le bloc : sa bordure (orange, jamais le rouge réservé aux doublons de N°).
      // Trouvé par sa STRUCTURE (titre, phrase, liste), pas par un attribut :
      // le build d'avant n'en porte aucun.
      const titre = [...document.querySelectorAll('.vrm-main div')].find(d => /^\d+ colis jamais retirés$/.test((d.innerText || '').trim()));
      if (!titre) return null;
      const bloc = titre.parentElement;
      const lignes = [...(bloc.children[2] || { children: [] }).children];
      if (!lignes.length) return null;
      const btn = (l) => [...l.querySelectorAll('button')].find(x => /Je l.ai eu/.test(x.innerText || ''));
      const droites = lignes.map(l => { const bt = btn(l); const rl = l.getBoundingClientRect(); return bt ? Math.round(rl.right - bt.getBoundingClientRect().right) : null; });
      const coupes = lignes.filter(l => [...l.querySelectorAll('div')].some(d => /il y a/.test(d.innerText || '') && d.scrollWidth > d.clientWidth + 1)).length;
      const verif = lignes.map(l => [...l.querySelectorAll('a')].find(a => /Vérifier/.test(a.innerText || ''))).filter(Boolean).map(a => Math.round(a.getBoundingClientRect().height));
      return { n: lignes.length, bord: getComputedStyle(bloc).borderTopColor, droites, coupes, verif };
    });
    if (!r) dit(false, `[${W}] Achats : les colis jamais retirés sont rendus (les fixtures en portent)`);
    else {
      const d = [...new Set(r.droites)];
      dit(d.length === 1 && d[0] != null, `[${W}] Achats : « Je l'ai eu » au même endroit sur les ${r.n} lignes des colis jamais retirés`, `écarts au bord droit : ${d.join(', ')} px`);
      dit(r.coupes === 0, `[${W}] Achats : l'âge d'un colis jamais retiré n'est jamais coupé`, `${r.coupes} ligne(s) coupée(s)`);
      if (tactile) dit(r.verif.every(h => h >= 43.5), `[${W}] Achats : « Vérifier » fait 44 px affichés`, r.verif.slice(0, 4).join(', ') + ' px');
      const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(r.bord) || [];
      const rouge = Number(m[1]) > 170 && Number(m[2]) < 90 && Number(m[3]) < 90;
      dit(!rouge, `[${W}] Achats : le bloc des colis jamais retirés n'est pas rouge (§7 : rouge = deux paires sous un N°)`, r.bord);
    }
    await ctx.close();
  }

  // D. Colis : plus aucune couleur de l'ancienne palette menthe (#0F8A6A).
  {
    const { ctx, pg } = await contexte(b, 1512, 950, false, false);
    await pg.goto(`http://localhost:${PORT}/?tab=cat_bord`, { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(4500);
    const menthe = await pg.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll('.vrm-main *')) {
        const cs = getComputedStyle(el);
        for (const v of [cs.color, cs.borderTopColor, cs.backgroundColor]) if (/^rgba?\(15,\s*138,\s*106/.test(v)) { out.push(((el.innerText || '').trim().slice(0, 40)) || el.tagName); break; }
        if (out.length > 4) break;
      }
      return out;
    });
    dit(menthe.length === 0, 'Colis : aucune couleur hors palette (le vert #0F8A6A de l’ancienne palette)', menthe.join(' // '));
    // F. Colis en lignes : « Colis fait » à la même place sur chaque ligne.
    const places = await pg.evaluate(() => [...document.querySelectorAll('.vrm-colis-carte button')]
      .filter(x => /Colis fait|Pas encore/.test(x.innerText || ''))
      .map(x => Math.round(x.getBoundingClientRect().left - x.parentElement.getBoundingClientRect().left)));
    const pl = [...new Set(places)];
    dit(places.length > 1 && pl.length === 1, `Colis (1512) : « Colis fait » à la même place sur les ${places.length} lignes`, `décalages : ${pl.join(', ')} px`);
    await ctx.close();
  }

  // E. Compta : la prochaine échéance dit qu'elle est un minimum quand des
  // ventes finalisées n'ont pas encore de date de versement (même ligne publiée).
  {
    const { ctx, pg } = await contexte(b, 1512, 950, false, false);
    await pg.goto(`http://localhost:${PORT}/?tab=plat_vinted`, { waitUntil: 'domcontentloaded' });
    await pg.waitForFunction(() => { try { const v = JSON.parse(localStorage.getItem('vinted_urssaf_mois') || 'null'); return !!(v && Array.isArray(v.mois)); } catch (_) { return false; } }, null, { timeout: 25000 }).catch(() => {});
    const pub = await pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vinted_urssaf_mois') || 'null'); } catch (_) { return null; } });
    await pg.goto(`http://localhost:${PORT}/?tab=compta`, { waitUntil: 'domcontentloaded' });
    await pg.waitForSelector('[data-echeance-ca]', { timeout: 15000 }).catch(() => {});
    await pg.waitForTimeout(1200);
    const nAD = pub && pub.aDater ? Number(pub.aDater.n) || 0 : 0;
    const e = await pg.evaluate(() => { const el = document.querySelector('[data-echeance-ca]'); return el ? { ca: el.getAttribute('data-echeance-ca'), txt: (el.parentElement.innerText || '') } : null; });
    if (!nAD) dit(true, 'Compta : aucune vente sans date de versement — rien à dire sur l’échéance');
    else if (!e || e.ca === '') dit(true, 'Compta : l’échéance n’a pas de montant (« — »)');
    else dit(/au moins/.test(e.txt), `Compta : l'échéance (${e.ca} €) se dit « au moins » — ${nAD} ventes finalisées sans date de versement`, e.txt.replace(/\n/g, ' | ').slice(0, 120));
    await ctx.close();
  }

  await b.close(); srv.close();
  console.log(ko ? `\n${ko} défaut(s).` : '\n✅ revue du 19 octobre : rien à signaler');
  process.exit(ko ? 1 : 0);
})().catch(e => { console.log('❌ banc mort : ' + e.message); process.exit(1); });
