// Banc de la REVUE du 20 octobre (après les fusions #596-#598 : listes mobiles
// sur une ligne, tableaux lisibles, compensation de zoom retirée des cibles).
// Fixtures (`fx/`, jamais dans le dépôt). Il juge des MESURES et des NOMBRES,
// jamais un libellé seul. Deux tailles : 390 tactile (clair), 1512 (sombre).
//   A. Statistiques — aucun espace avalé par un conteneur flex : « Ventes
//      enregistrées · <span>aujourd'hui… » rendait « ·aujourd'hui 0,00 €· ce mois ».
//   B. « Vendu · 12 derniers mois » — le mois en cours écrit UNE fois, jamais
//      « 2 338 € » au-dessus de « 2337,80 € » (§7).
//   C. L'anneau par plateforme — le même total au centre que dans la légende
//      (« 6984 € » / « 6983,57 € ») ; à 390 le nom n'est pas coupé (« Vin… »).
//   D. « Retirer mon argent » tient dans sa carte (la marge négative des
//      liens-textes le faisait sortir de 10 px de chaque côté).
//   E. Liens-textes : la marge négative suivait encore l'ancien zoom (-16 px pour
//      44 px de zone) : il ne restait que 12 px dans la ligne.
//   F. « Gérer l'annonce » : 44 px au doigt (32 px depuis les listes compactes).
//   G. Compta, « Chiffre d'affaires par période » : la 4ᵉ colonne coupée à 390.
//   H. Leboncoin → Colis : jamais lu ⇒ « pas encore lu », pas « aucun colis ».
//   I. Organisation : une lecture ratée n'est pas rouge, et dit que rien n'est perdu.
//   J. eBay → Ventes / Annonces : la liste ne peint pas sa propre bande de fond
//      (une dalle unie qui s'arrêtait au milieu de l'écran, sur la matière du fond).
//   K. Vinted → Ventes, une vente OUVERTE : « Bordereau », « Saisir le prix »,
//      « Relier un achat », « Modifier » font 44 px au doigt (28-32 px depuis
//      la vente compacte).
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
const PORT = Number(process.env.BANC_PORT) || 7795;
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
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  // Un bloc qui lève devient un contrôle ROUGE, jamais un banc mort.
  const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle n\'a pas pu se dérouler', e.message.slice(0, 140)); } };
  const aller = async (pg, tab, attente = 4500) => { await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(attente); };
  const section = async (pg, nom) => { await pg.locator('.vrm-seg-btn', { hasText: nom }).first().click({ timeout: 5000 }); await pg.waitForTimeout(2500); };

  for (const [W, H, tactile, sombre] of [[390, 900, true, false], [1512, 950, false, true]]) {
    const { ctx, pg } = await contexte(b, W, H, tactile, sombre);

    // A. Statistiques : aucun espace avalé par un conteneur flex.
    await essaie(`[${W}] A`, async () => {
      await aller(pg, 'dashboard');
      await pg.evaluate(() => document.querySelectorAll('.vrm-main details').forEach(d => { d.open = true; }));
      const colles = await pg.evaluate(() => {
        const out = [];
        for (const el of document.querySelectorAll('.vrm-main *')) {
          const cs = getComputedStyle(el); if (!/flex|grid/.test(cs.display)) continue;
          if ((parseFloat(cs.columnGap) || 0) >= 3) continue;
          const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
          const ns = [...el.childNodes].filter(n => n.nodeType === 1 || (n.nodeType === 3 && n.textContent.trim()));
          ns.forEach((n, i) => {
            if (n.nodeType !== 3) return;
            const t = n.textContent;
            const avantEl = i > 0 && ns[i - 1].nodeType === 1 && /^\s/.test(t);
            const apresEl = i < ns.length - 1 && ns[i + 1].nodeType === 1 && /\s$/.test(t);
            if (avantEl || apresEl) out.push((el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 80));
          });
        }
        return [...new Set(out)];
      });
      dit(colles.length === 0, `[${W}] Statistiques : aucun « · » collé à son voisin (espace avalé par un conteneur flex)`, colles.join(' | '));
    });

    // B. Statistiques, carte « Vendu · 12 derniers mois » : le mois en cours est
    //    écrit UNE fois (pas « 2 338 € » au-dessus de « 2337,80 € »).
    await essaie(`[${W}] B`, async () => {
      const r = await pg.evaluate(() => {
        const carte = document.querySelector('[data-stats-courbe]'); if (!carte) return null;
        const g = [...carte.querySelectorAll('[data-courbe-vendu] g[data-valeur], g[data-valeur]')].pop(); if (!g) return null;
        const cts = Number(g.getAttribute('data-valeur'));
        const eur = cts / 100;
        const exact = eur.toFixed(2).replace('.', ',');
        const rond = Math.round(eur).toLocaleString('fr-FR').replace(/\s/g, ' ');
        const txt = carte.innerText.replace(/\s/g, ' ');
        const nExact = txt.split(exact).length - 1;
        const reRond = new RegExp('(^|[^\\d,])' + rond.replace(/ /g, '\\s?') + '\\s?€');
        return { exact, rond, nExact, rondSeul: reRond.test(txt.replace(new RegExp(exact.replace(',', '\\,'), 'g'), '')) };
      });
      dit(!!r, `[${W}] Statistiques : la carte « Vendu · 12 derniers mois » est rendue`);
      if (r) dit(r.nExact <= 1 && !r.rondSeul, `[${W}] Statistiques : le mois en cours n'est écrit qu'une fois, jamais arrondi à côté de son montant exact`, `${r.exact} ×${r.nExact}${r.rondSeul ? ' + « ' + r.rond + ' € »' : ''}`);
    });

    // C. L'anneau par plateforme : même total au centre et dans la légende ;
    //    à 390 le nom de la plateforme n'est pas coupé.
    await essaie(`[${W}] C`, async () => {
      const r = await pg.evaluate(() => {
        const t = [...document.querySelectorAll('svg[aria-label="Répartition du CA par plateforme"] text')][0]; if (!t) return null;
        const card = t.closest('svg').parentElement;
        const leg = [...card.querySelectorAll('span')].filter(s => s.style.textOverflow === 'ellipsis');
        return { centre: t.textContent.replace(/\s/g, ' '), legende: card.innerText.replace(/\s/g, ' '), coupes: leg.filter(s => s.scrollWidth > s.clientWidth + 1).map(s => s.textContent) };
      });
      dit(!!r, `[${W}] Statistiques : l'anneau par plateforme est rendu`);
      if (r) {
        const m = /([\d ]+,\d\d) €/.exec(r.legende.replace(r.centre, ''));
        dit(!!m && r.centre.includes(m[1].trim()), `[${W}] Statistiques : l'anneau dit au centre le même total que sa légende`, `centre « ${r.centre} », légende « ${m ? m[1].trim() : '?'} € »`);
        dit(r.coupes.length === 0, `[${W}] Statistiques : le nom de la plateforme n'est pas coupé dans la légende de l'anneau`, r.coupes.join(', '));
      }
    });

    // D. Vinted → Ventes : « Retirer mon argent » tient DANS sa carte.
    await essaie(`[${W}] D`, async () => {
      await aller(pg, 'plat_vinted');
      const r = await pg.evaluate(() => {
        const d = document.querySelector('[data-retirer-argent]'); if (!d) return null;
        const a = d.getBoundingClientRect(), q = d.querySelector('button').getBoundingClientRect();
        return { carte: [Math.round(a.top), Math.round(a.bottom)], bouton: [Math.round(q.top), Math.round(q.bottom)], h: Math.round(q.height) };
      });
      dit(!!r, `[${W}] Vinted → Ventes : « Retirer mon argent » est rendu`);
      if (r) dit(r.bouton[0] >= r.carte[0] - 1 && r.bouton[1] <= r.carte[1] + 1 && r.h >= 43.5, `[${W}] Vinted → Ventes : « Retirer mon argent » (44 px) tient dans sa carte`, `carte ${r.carte.join('–')} · bouton ${r.bouton.join('–')}`);
    });

    // E. Les liens-textes rendent à la ligne exactement ce qu'ils empruntent :
    //    44 px de zone et -12 px de marge : 20 px restent dans la ligne (à -16 px, 12).
    if (tactile) await essaie(`[${W}] E`, async () => {
      const mauvais = [];
      for (const tab of ['journee', 'cat_bord', 'compta']) {
        await aller(pg, tab);
        const l = await pg.evaluate(() => [...document.querySelectorAll('.vrm-main button, .vrm-main a')].filter(e => {
          const cs = getComputedStyle(e); const mt = parseFloat(cs.marginTop) || 0, mb = parseFloat(cs.marginBottom) || 0;
          if (mt >= 0) return false;
          const h = e.getBoundingClientRect().height; return h > 0 && h + mt + mb < 16;
        }).map(e => (e.innerText || '').trim().slice(0, 30) + ' (' + Math.round(e.getBoundingClientRect().height) + ' px, marge ' + getComputedStyle(e).marginTop + ')'));
        mauvais.push(...l.map(x => tab + ' : ' + x));
      }
      dit(mauvais.length === 0, `[${W}] Liens-textes : aucune marge négative qui écrase leur ligne`, mauvais.slice(0, 5).join(' | '));
    });

    // F. Vinted → Annonces : « Gérer l'annonce » fait 44 px au doigt.
    await essaie(`[${W}] F`, async () => {
      await aller(pg, 'plat_vinted'); await section(pg, 'Annonces');
      const h = await pg.$$eval('.vrm-ann-actions > summary', ss => ss.map(s => s.getBoundingClientRect().height).filter(x => x > 0).map(Math.round)).catch(() => []);
      dit(h.length > 0 && h.every(x => x >= 43.5), `[${W}] Vinted → Annonces : « Gérer l'annonce » fait 44 px de haut`, [...new Set(h)].join(', ') + ' px');
    });

    // G. Compta : le tableau « par période » tient dans l'écran (aucune colonne cachée).
    await essaie(`[${W}] G`, async () => {
      await aller(pg, 'compta', 5500);
      const r = await pg.$eval('[data-ca-table]', t => ({ t: Math.round(t.scrollWidth), w: Math.round(t.parentElement.clientWidth) })).catch(() => null);
      dit(!!r, `[${W}] Compta : le tableau « Chiffre d'affaires par période » est rendu`);
      if (r) dit(r.t <= r.w + 1, `[${W}] Compta : ses quatre colonnes tiennent dans la carte`, `tableau ${r.t} px pour ${r.w} px`);
    });

    // H. Leboncoin → Colis : jamais lu ⇒ « pas encore lu », pas « aucun colis ».
    await essaie(`[${W}] H`, async () => {
      await aller(pg, 'plat_leboncoin'); await section(pg, 'Colis');
      const v = await pg.$eval('[data-lbc-colis-vide]', el => el.getAttribute('data-lbc-colis-vide')).catch(() => null);
      const txt = await pg.$eval('.vrm-main', el => el.innerText).catch(() => '');
      dit(v === 'jamais' && !/Aucun colis Leboncoin/.test(txt), `[${W}] Leboncoin → Colis : sans lecture de « Mes transactions », il dit « pas encore lu », jamais « aucun colis »`, `état ${v}`);
    });

    // I. Organisation : une lecture ratée n'est ni rouge (§7) ni muette sur la suite.
    await essaie(`[${W}] I`, async () => {
      await aller(pg, 'organisation', 4000);
      const r = await pg.$eval('.ops-erreur', el => { const m = getComputedStyle(el).backgroundColor.match(/\d+/g).map(Number); return { rgb: m, txt: el.innerText }; }).catch(() => null);
      dit(!!r, `[${W}] Organisation : la lecture ratée est dite`);
      if (r) {
        const [R, G, B] = r.rgb;
        dit(G - B >= 6, `[${W}] Organisation : le bandeau d'une lecture ratée n'est pas rouge (le rouge est pour deux paires sous un N°)`, `fond rgb(${r.rgb.join(',')})`);
        dit(/rien n.est perdu/i.test(r.txt), `[${W}] Organisation : il dit que rien n'est perdu et quoi faire`, r.txt.slice(0, 80));
      }
    });

    // J. eBay : la liste ne peint pas sa propre bande par-dessus la page (une
    //    dalle unie qui s'arrêtait au milieu de l'écran, sur la matière du fond).
    await essaie(`[${W}] J`, async () => {
      await aller(pg, 'plat_ebay');
      const fonds = [];
      for (const nom of ['Ventes', 'Annonces']) {
        await section(pg, nom);
        const f = await pg.$eval('.vrm-ebay-sales, .vrm-ebay-annonces', el => getComputedStyle(el).backgroundColor).catch(() => null);
        fonds.push(nom + ' ' + f);
      }
      dit(fonds.every(x => /rgba\(0, 0, 0, 0\)|transparent/.test(x)), `[${W}] eBay → Ventes et Annonces : pas de bande de fond posée par-dessus la page`, fonds.join(' · '));
    });

    // K. Vinted → Ventes, une vente OUVERTE : chaque geste fait 44 px au doigt.
    if (tactile) await essaie(`[${W}] K`, async () => {
      await aller(pg, 'plat_vinted'); await section(pg, 'Ventes');
      const petits = await pg.evaluate(async () => {
        for (const t of [...document.querySelectorAll('.vrm-ledger-sale-toggle')].slice(0, 3)) if (t.getAttribute('aria-expanded') !== 'true') t.click();
        await new Promise(r => setTimeout(r, 700));
        const out = [];
        for (const row of document.querySelectorAll('[data-ligne-ouverte="true"]'))
          for (const el of row.querySelectorAll('.vrm-ledger-sale-content :is(button, a[href], summary)')) {
            const rc = el.getBoundingClientRect(); if (!rc.width || !rc.height) continue;
            if (rc.height < 43.5) out.push((el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 24) + ' ' + Math.round(rc.height) + ' px');
          }
        return [...new Set(out)];
      });
      dit(petits.length === 0, `[${W}] Vinted → Ventes : dans une vente ouverte, chaque geste fait 44 px au doigt`, petits.join(' · '));
    });

    if (pg.__errs.length) dit(false, `[${W}] erreurs de page`, [...new Set(pg.__errs)].slice(0, 3).join(' | '));
    await ctx.close();
  }

  await b.close(); srv.close();
  console.log(ko ? `\n${ko} défaut(s).` : '\n✅ revue du 20 octobre : rien à signaler');
  process.exit(ko ? 1 : 0);
})().catch(e => { console.log('❌ banc mort : ' + e.message); process.exit(1); });
