// ═══════════════════════════════════════════════════════════════════════════
// BANC : L'ASSISTANT eBAY, EXÉCUTÉ POUR DE VRAI
//        node scripts/bancs/ebay.cjs
// ═══════════════════════════════════════════════════════════════════════════
// `ebay.js` n'avait JAMAIS tourné. `node --check` ne lit que la syntaxe : un
// `null` déréférencé, un sélecteur qui ne trouve rien, un panneau qui ne
// s'ouvre pas — rien de tout ça ne se voit sans l'exécuter dans une page.
//
// Ce banc sert une fausse page de mise en vente (avec la VRAIE structure
// d'en-tête d'eBay, mesurée le 12 septembre), y charge le vrai `ebay.js` avec
// un faux `chrome.runtime`, et vérifie ce qui compte :
//   · le panneau s'ouvre et liste ce qui est coché ;
//   · le remplissage remplit les champs du formulaire ;
//   · ⚠️ il ne touche PAS la barre de recherche du haut — un `<input>` vide et
//     visible présent sur TOUTES les pages d'eBay (`#gh-ac`, mesuré sur la
//     vraie page). C'est le piège le plus bête et le plus probable ;
//   · quand rien n'est reconnu, le bandeau le DIT (« aucun champ ») au lieu de
//     laisser croire que l'annonce est prête.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const fs = require('fs'), http = require('http'), path = require('path');
const EXT = path.join(__dirname, '..', '..', 'vinted-sync-extension', 'ebay.js');
const SRC = fs.readFileSync(EXT, 'utf8');

// La page : en-tête eBay (mesuré) + formulaire de mise en vente plausible.
const PAGE = (avecForm) => `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Vendre</title></head><body>
  <div id="gh" role="banner">
    <input id="gh-ac" name="_nkw" type="text" placeholder="Rechercher sur eBay" aria-label="Rechercher sur eBay">
  </div>
  ${avecForm ? `
  <main>
    <label for="f-t">Titre de l'annonce</label><input id="f-t" name="title" type="text">
    <label for="f-d">Description</label><textarea id="f-d" name="description"></textarea>
    <label for="f-p">Prix</label><input id="f-p" name="price" type="text">
    <label for="f-s">SKU (numéro de référence)</label><input id="f-s" name="sku" type="text">
  </main>` : `<main><p>Rien à remplir ici.</p></main>`}
</body></html>`;

const AD = {
  id: '101', numero: '101', sku: 'VRM-101', account: 'julatace3535',
  title: 'Nike Air Max Taille 42', description: 'Réf. VRM-101\n\nTrès bon état.',
  price: '45.00', photos: ['https://exemple/1.jpg', 'https://exemple/2.jpg'],
};

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };

(async () => {
  const srv = http.createServer((q, r) => {
    r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    r.end(PAGE(!/vide/.test(q.url)));
  });
  await new Promise((res) => srv.listen(4488, res));

  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox'] });

  const ouvrir = async (chemin) => {
    const pg = await b.newPage({ viewport: { width: 1280, height: 900 } });
    const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
    // Le faux pont : exactement les actions que `ebay.js` envoie.
    await pg.addInitScript((ad) => {
      window.open = () => null;
      window.__vrmEnvois = [];
      window.chrome = { runtime: { sendMessage(m, cb) {
        window.__vrmEnvois.push(m.action);
        const rep = m.action === 'getQueue' ? { ok: true, queue: [ad], retirees: 3, postedCount: 0, echec: false }
          : m.action === 'getPending' ? { ok: true, ad }
          : m.action === 'downloadPhotos' ? { ok: true, count: (m.urls || []).length }
          : { ok: true };
        if (typeof cb === 'function') setTimeout(() => cb(rep), 0);
      } } };
    }, AD);
    await pg.goto('http://localhost:4488' + chemin, { waitUntil: 'domcontentloaded' });
    await pg.addScriptTag({ content: SRC });
    return { pg, errs };
  };

  // ── 1. LA PAGE DE MISE EN VENTE ───────────────────────────────────────────
  {
    const { pg, errs } = await ouvrir('/sl/sell');
    await pg.waitForTimeout(3000);

    dit(await pg.locator('#vrm-ebay').count() === 1, 'le panneau VRM est bien là');
    await pg.click('#vrm-ebay [data-a="toggle"]');
    await pg.waitForTimeout(800);
    const txt = await pg.locator('#vrm-ebay').innerText();
    dit(/N°101/.test(txt), 'il liste la paire cochée', txt.split('\n')[1] || '');
    dit(/1 paire cochée pour eBay/.test(txt), 'et il dit combien', '');

    // Le remplissage : les 4 champs du formulaire, et RIEN d'autre.
    const v = await pg.evaluate(() => ({
      titre: document.getElementById('f-t').value,
      desc: document.getElementById('f-d').value,
      prix: document.getElementById('f-p').value,
      sku: document.getElementById('f-s').value,
      recherche: document.getElementById('gh-ac').value,
      bandeau: (document.getElementById('vrm-ebay-b') || {}).innerText || '',
    }));
    dit(v.titre === AD.title, 'le titre est rempli', v.titre || '(vide)');
    dit(v.desc === AD.description, 'la description est remplie', v.desc ? 'ok' : '(vide)');
    dit(v.prix === AD.price, 'le prix est rempli', v.prix || '(vide)');
    dit(v.sku === AD.sku, 'la référence VRM-{n°} est dans le SKU', v.sku || '(vide)');
    // ⚠️ LE PIÈGE MESURÉ : la barre de recherche d'eBay est un input vide sur
    //    toutes ses pages. La remplir avec un titre d'annonce serait absurde
    //    et très visible.
    dit(v.recherche === '', 'et la barre de recherche d\'eBay reste VIDE',
      v.recherche ? 'elle contient « ' + v.recherche + ' »' : '');
    dit(/4 champs remplis/.test(v.bandeau), 'le bandeau annonce le nombre de champs remplis',
      v.bandeau.slice(0, 70));
    dit(errs.length === 0, 'aucune erreur pendant tout ça', errs.slice(0, 2).join(' | '));
    await pg.close();
  }

  // ── 2. UNE PAGE OÙ RIEN N'EST RECONNU ─────────────────────────────────────
  // Le cas le plus probable, puisque je n'ai jamais vu le vrai formulaire :
  // il doit se dire, pas se taire — et surtout ne pas laisser croire que
  // l'annonce est prête.
  {
    const { pg, errs } = await ouvrir('/sl/sell?vide=1');
    await pg.waitForTimeout(3000);
    const bandeau = await pg.evaluate(() => (document.getElementById('vrm-ebay-b') || {}).innerText || '');
    dit(/aucun champ/i.test(bandeau), 'formulaire non reconnu : il le DIT', bandeau.slice(0, 80) || '(pas de bandeau)');
    dit(!/prête|prêt à publier/i.test(bandeau), 'et il ne dit jamais que l\'annonce est prête');
    dit(/presse-papier|VRM-101/.test(bandeau), 'il rappelle où sont le texte et les photos');
    dit(errs.length === 0, 'aucune erreur non plus', errs.slice(0, 2).join(' | '));
    await pg.close();
  }

  await b.close(); srv.close();
  console.log(ko ? `\n${ko} controle(s) non conforme(s).` : '\nL\'assistant eBay tourne, remplit ce qu\'il faut, et dit ce qu\'il ne sait pas.');
  process.exit(ko ? 1 : 0);
})();
