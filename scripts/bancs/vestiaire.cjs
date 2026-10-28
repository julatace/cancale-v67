// Banc : VESTIAIRE — OÙ EN EST LA MESURE (4 octobre). Données INVENTÉES.
// Trois états, jamais deux : relevé (le chiffre des pages/appels, la date) ·
// jamais relevé (le geste) · lecture ratée (la phrase de panne). Et JAMAIS un
// chiffre d'affaires Vestiaire : rien n'est capté tant que la forme d'une vente
// n'a pas été vue.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = 4345;
const auj = new Date();
const META = { vuAt: new Date(auj.getTime() - 2 * 3600e3).toISOString(), ver: '5.154.0', nChemins: '23', nPages: '6', nSchemas: '9' };
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul'); process.exit(1); });
srv.listen(PORT);

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--no-proxy-server'] });
    for (const etat of ['lu', 'jamais', 'panne']) {
      console.log(`── ${etat}`);
      const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      const pg = await ctx.newPage();
      const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
      await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
      await pg.route('**/rest/v1/**', (route) => {
        const u = decodeURIComponent(metaVersData(route.request().url()));
        const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
        if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
        if (/id=eq\.vc_recon/.test(route.request().url())) {
          if (etat === 'panne') return route.fulfill({ status: 522, contentType: 'text/html', headers: { 'access-control-allow-origin': '*' }, body: '<html>522</html>' });
          return j(etat === 'lu' ? [META] : []);
        }
        if (/id=eq\.vc_achats/.test(route.request().url())) {
          if (etat === 'panne') return route.fulfill({ status: 522, contentType: 'text/html', headers: { 'access-control-allow-origin': '*' }, body: '<html>522</html>' });
          return j(etat === 'lu' ? [{ achats: { O42: { productId: '700001', nom: 'Nike Dunk Low', etat: 'shipped', date: '2026-10-25T08:00:00Z', montant: { valeur: 88, devise: 'EUR', cle: 'totalPrice' }, suivi: 'XW123456789FR', transporteur: 'Chronopost' } }, lecture: { at: auj.toISOString(), total: 1, complet: true, page: '/my-orders/' } }] : []);
        }
        if (/id=eq\.vc_messages/.test(route.request().url())) {
          if (etat === 'panne') return route.fulfill({ status: 522, contentType: 'text/html', headers: { 'access-control-allow-origin': '*' }, body: '<html>522</html>' });
          return j(etat === 'lu' ? [{ compteur: { messages: 3, at: new Date(auj.getTime() - 30 * 60e3).toISOString() }, conversations: { C1: { productId: '900001', ref: '401', nonLu: true, date: '2026-10-27T09:00:00Z' }, C2: { productId: '900009', ref: '', nonLu: null, date: '' } }, lecture: { at: auj.toISOString(), total: 2, complet: true, page: '/messages/' } }] : []);
        }
        return j([]);
      });
      await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
      await pg.goto(`http://localhost:${PORT}/?tab=plat_vestiaire`, { waitUntil: 'domcontentloaded' });
      await pg.waitForSelector('[data-vc-mesure]', { timeout: 10000 }).catch(() => {});
      const v = await pg.evaluate(() => { const e = document.querySelector('[data-vc-mesure]'); const n = e && e.querySelector('[data-vc-mesure-pages]'); return e ? { etat: e.getAttribute('data-vc-mesure'), t: e.innerText, pages: n ? n.getAttribute('data-vc-mesure-pages') : null, appels: n ? n.getAttribute('data-vc-mesure-appels') : null } : null; });
      // Le texte de la page SANS la carte des achats : un montant d'achat n'est pas un chiffre d'affaires.
      const page = await pg.evaluate(() => { const c = document.body.cloneNode(true); c.querySelectorAll('[data-vc-achats]').forEach((e) => e.remove()); document.body.appendChild(c); c.style.position = 'absolute'; const t = c.innerText; c.remove(); return t; });
      // (28 oct.) Les chiffres de la mesure restent en ATTRIBUTS : à l'écran, la date
      // du dernier passage seule — « 23 appels, 9 formes de réponse » est du
      // vocabulaire d'informaticien (§2.7).
      if (etat === 'lu') dit(v && v.etat === 'lu' && v.pages === '6' && v.appels === '23' && /il y a 2 h/.test(v.t) && !/appels|forme.? de réponse|apprend à lire/i.test(v.t), 'relevé : la date du dernier passage, les chiffres en attributs, aucun mot technique', v && v.t.slice(0, 160));
      // Plus de « tes ventes ne remontent pas encore… choisis-la ci-dessous » : faux
      // depuis la 5.237 (les ventes sont lues) et la liste est au-dessus.
      dit(!/ne remontent pas encore|choisis-la ci-dessous/.test(page), 'aucune phrase périmée sur les ventes, ni de renvoi « ci-dessous » vers une liste qui est au-dessus');
      if (etat === 'jamais') dit(v && v.etat === 'jamais' && /Vestiaire/.test(v.t), 'jamais relevé : le geste qui fait avancer', v && v.t.slice(0, 120));
      if (etat === 'panne') dit(v && v.etat === 'pas-su' && !/pages,/.test(v.t), 'lecture ratée : ni chiffre, ni « jamais »', v && v.t.slice(0, 120));
      // 5.238 : les messages Vestiaire — trois états, jamais « 0 » sur un « pas su ».
      await pg.waitForSelector('[data-vc-messages]:not([data-vc-messages="charge"])', { timeout: 10000 }).catch(() => {});
      const m = await pg.evaluate(() => { const e = document.querySelector('[data-vc-messages]'); if (!e) return null; const a = e.querySelector('[data-vc-messages-ouvrir]'); const c = [...e.querySelectorAll('[data-vc-conv]')].map((x) => ({ id: x.getAttribute('data-vc-conv'), num: x.getAttribute('data-vc-conv-num'), nl: x.getAttribute('data-vc-conv-nonlu') })); return { etat: e.getAttribute('data-vc-messages'), n: (e.querySelector('[data-vc-messages-nonlus]') || {}).getAttribute ? e.querySelector('[data-vc-messages-nonlus]').getAttribute('data-vc-messages-nonlus') : null, href: a ? a.href : '', h: a ? a.getBoundingClientRect().height : 0, c, t: e.innerText }; });
      if (etat === 'lu') {
        dit(m && m.etat === 'lu' && m.n === '3' && /3 messages non lus/.test(m.t) && /il y a 30 min/.test(m.t), 'messages : le nombre de non-lus de Vestiaire et l’âge du relevé', m && m.t.slice(0, 140));
        dit(m && m.href === 'https://fr.vestiairecollective.com/messages/', 'le lien ouvre la page de messagerie VUE par l’extension (rien de deviné)', m && m.href);
        dit(m && m.c.length === 2 && m.c[0].id === 'C1' && m.c[0].num === '401' && m.c[0].nl === 'oui' && m.c[1].num === '' && /Pas reliée à une paire/.test(m.t), 'conversations : reliées par la référence VRM, non lue en tête, sans référence ⇒ pas de paire devinée', JSON.stringify(m && m.c));
        dit(m && m.h >= 44, 'le lien se touche au doigt (44 px)', m && String(m.h));
      }
      if (etat === 'jamais') dit(m && m.etat === 'jamais' && !/\b0 message/.test(m.t), 'messages jamais relevés : le geste, aucun « 0 »', m && m.t.slice(0, 120));
      if (etat === 'panne') dit(m && m.etat === 'pas-su' && !/non lu/.test(m.t), 'messages illisibles : « pas su », aucun nombre', m && m.t.slice(0, 120));
      // 5.239 : les achats Vestiaire — trois états.
      await pg.waitForSelector('[data-vc-achats]:not([data-vc-achats="charge"])', { timeout: 10000 }).catch(() => {});
      const ac = await pg.evaluate(() => { const e = document.querySelector('[data-vc-achats]'); if (!e) return null; const s = e.querySelector('[data-suivre-colis]'); return { etat: e.getAttribute('data-vc-achats'), t: e.innerText, suivre: s ? s.href : '', h: s ? s.getBoundingClientRect().height : 0 }; });
      if (etat === 'lu') {
        dit(ac && ac.etat === 'lu' && /Nike Dunk Low/.test(ac.t) && /shipped/.test(ac.t) && /suivi XW123456789FR/.test(ac.t), 'achats : le nom de l’article, l’état de Vestiaire, le n° de suivi', ac && ac.t.slice(0, 160));
        dit(ac && /chronopost\.fr/.test(ac.suivre) && ac.h >= 44, 'le colis se suit sur le site du transporteur (44 px)', ac && ac.suivre);
        dit(ac && /aucun prix d.achat/.test(ac.t), 'le montant n’entre dans aucun prix d’achat (c’est toi qui les saisis), et c’est dit', ac && ac.t.slice(0, 200));
      }
      if (etat === 'jamais') dit(ac && ac.etat === 'jamais' && /panier n'est jamais lu/.test(ac.t), 'achats jamais lus : le geste', ac && ac.t.slice(0, 120));
      if (etat === 'panne') dit(ac && ac.etat === 'pas-su' && !/achat vu/.test(ac.t), 'achats illisibles : « pas su », aucune liste', ac && ac.t.slice(0, 120));
      // (la phrase « pas encore reliée » est partie avec la 5.235 : on juge le chiffre, pas la phrase)
      dit(!/Vestiaire[^\n]{0,40}\d+,\d{2}\s?€/.test(page) && !/chiffre d.affaires[^\n]{0,40}Vestiaire[^\n]{0,20}\d/i.test(page), 'aucun chiffre d’affaires Vestiaire n’est inventé');
      const r = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      dit(r.sw <= r.cw + 1, 'aucun débordement horizontal', `${r.sw} > ${r.cw}`);
      dit(errs.length === 0, 'aucune erreur d’app', errs.join(' | ').slice(0, 160));
      await ctx.close();
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 160)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ Vestiaire : ${ko} rouge(s)` : '\n✅ Vestiaire : tout est vert');
  process.exit(ko ? 1 : 0);
})();
