// Banc : l'onglet « Captation » rend-il l'état de la moisson, honnêtement ?
// §6.1 — sur le code d'avant l'onglet n'existe pas : `tab=captation` retombe sur
// Ma journée, donc « Ce qui est capté » est absent → rouge.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const fs = require('fs');
const PAN = fs.readFileSync('/home/user/cancale-v67/vinted-sync-extension/vinted-panel.js', 'utf8');

const J = 86400000;
const base = () => ({
  ok: true,
  online: [
    { id: '1', title: 'a', nPhotos: 12, nPhotosVinted: 12 },   // complète
    { id: '2', title: 'b', nPhotos: 4, nPhotosVinted: 11 },    // à compléter
    { id: '3', title: 'c', nPhotos: 5, nPhotosVinted: 0 },     // total inconnu → non jugée
  ],
  byId: {}, sleeping: [], relance: [], noNum: [],
  accounts: [
    { uid: '111', name: 'julatace3535', online: 12, off: false, capte: Date.now() - 1 * J },  // frais
    { uid: '222', name: 'arthuror2', online: 5, off: false, capte: Date.now() - 10 * J },      // vieux → repasse
    { uid: '333', name: 'liliand653', online: 3, off: true, raison: 'app', capte: Date.now() - 40 * J }, // exclu
  ],
  sales: [{}, {}], convs: [{}], bordsToPrint: [{ row: 'x' }],
  pickups: [{ code: 'ABC123' }, {}], toShip: [], offers: [], relances: [], disputes: [],
  recentSales: [], recentBuys: [], coffre: [], quickReplies: [], appStats: {}, goal: 0,
  stats: { online: 3, toPrint: 1, toShip: 0, toPickup: 2, litiges: 0, unread: 0 },
  freshestAt: new Date().toISOString(), compteActif: '111', baseKO: false,
});

(async () => {
  let ko = 0; const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox'] });

  const rendre = async (data) => {
    const pg = await b.newPage();
    const errs = [];
    pg.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
    pg.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
    await pg.route('**/*', r => r.fulfill({ status: 200, contentType: 'text/html', body: '<html><body></body></html>' }));
    await pg.addInitScript(d => {
      localStorage.setItem('vrm_panel_open', '1'); localStorage.setItem('vrm_panel_tab', 'captation');
      window.chrome = {
        runtime: {
          sendMessage: (m, cb) => { const r = m && m.action === 'panelData' ? d : { ok: true }; if (typeof cb === 'function') cb(r); return Promise.resolve(r); },
          getManifest: () => ({ version: '5.102.0' }), lastError: null,
        },
        storage: { local: { get: (k, cb) => { const o = {}; if (typeof cb === 'function') { cb(o); return; } return Promise.resolve(o); }, set: (o, cb) => { if (typeof cb === 'function') { cb(); return; } return Promise.resolve(); } } },
      };
      window.open = () => null;
      navigator.clipboard = { writeText: () => Promise.resolve() };
    }, data);
    await pg.goto('https://www.vinted.fr/member/items');
    await pg.addScriptTag({ content: PAN });
    await pg.waitForTimeout(400);
    await pg.evaluate(() => { const f = document.querySelector('#vrm-fab'); if (f) f.click(); });
    await pg.waitForTimeout(300);
    const txt = await pg.evaluate(() => (document.querySelector('#vrm-panel') || document.body).innerText);
    const app = errs.filter(e => !/net::|ERR_/.test(e));
    await pg.close();
    return { txt, app };
  };

  // 1) Données normales
  let { txt, app } = await rendre(base());
  const N = s => txt.replace(/\s+/g, ' ');
  dit(/Ce qui est capté/.test(txt), 'l\'onglet Captation rend son tableau « Ce qui est capté »');
  dit(/Extension\s*5\.102\.0/.test(N(txt)), 'la version installée de l\'extension est affichée', txt.match(/Extension[^.]*/)?.[0]);
  dit(/Annonces en ligne/.test(txt) && /Ventes captées/.test(txt) && /Conversations/.test(txt), 'les totaux captés sont listés');
  dit(/Bordereaux prêts/.test(txt) && /Colis à retirer/.test(txt), 'bordereaux prêts et colis à retirer sont comptés');
  dit(/avec code/.test(txt), 'les colis avec code de retrait sont distingués');
  dit(/à compléter/.test(txt), 'les photos manquantes sont signalées (1 annonce à compléter)');
  dit(/rien depuis\s*10\s*j|repasse dessus/.test(N(txt)), 'un compte muet depuis 10 j est marqué « repasse dessus »', N(txt).match(/rien depuis[^—]*/)?.[0]);
  dit(/à rafraîchir/.test(txt), 'l\'en-tête nomme les comptes à rafraîchir (1 : arthuror2)');
  dit(app.length === 0, '0 erreur d\'app', app.slice(0, 2).join(' | '));

  // 2) Base injoignable → trois états : aucun zéro, on dit la panne
  ({ txt } = await rendre(Object.assign(base(), { baseKO: true })));
  dit(/rien pu lire/.test(txt), 'base injoignable : l\'onglet dit « je n\'ai rien pu lire »');
  dit(!/Ce qui est capté/.test(txt), 'base injoignable : AUCUN chiffre à zéro n\'est affiché (rien lu ≠ rien)');

  // 3) L'autre sens : tout frais, tout complet → « à jour », jamais « à rafraîchir »
  const frais = base();
  frais.accounts = frais.accounts.filter(a => !a.off).map(a => ({ ...a, capte: Date.now() - 2 * 3600000 }));
  frais.online = [{ id: '1', nPhotos: 12, nPhotosVinted: 12 }, { id: '2', nPhotos: 11, nPhotosVinted: 11 }];
  ({ txt } = await rendre(frais));
  dit(/à jour/.test(txt), 'tout frais : « Tous tes comptes reliés sont à jour »');
  dit(!/à rafraîchir/.test(txt), 'tout frais : aucune fausse alerte « à rafraîchir »');
  dit(!/à compléter/.test(txt), 'tout complet : aucune fausse alerte « à compléter »');

  await b.close();
  console.log(ko ? `\n${ko} contrôle(s) non conforme(s).` : '\nOnglet Captation conforme.');
  process.exit(ko ? 1 : 0);
})();
