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
//
// ⚠️⚠️ ÉLARGI LE 13 SEPTEMBRE : eBay n'avait appris AUCUNE des leçons mesurées sur
// Leboncoin le même jour. Quatre défauts, tous servis ici :
//   · les photos étaient TÉLÉCHARGÉES sur son disque (« ça me fait télécharger
//     des photos dans mon ordi ») alors que `input.files = dataTransfer.files`
//     marche — mesuré dans Chromium, et le fichier affirmait le contraire ;
//   · les listes déroulantes (état, marque, pointure) n'étaient pas même
//     REGARDÉES : `champ()` ne lit que `input`/`textarea`. C'est mot pour mot
//     « ça ne met pas la catégorie ni le reste ». ⚠️ Mais la CATÉGORIE reste
//     interdite : eBay la propose mieux que moi, et le banc l'exige ;
//   · `copy()` annonçait « Titre copié » sans rien copier — une promesse rejetée
//     ne passe pas par `catch`, et ce fichier n'avait même pas de repli ;
//   · le remplissage s'arrêtait au bout de 90 s EN SILENCE.
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
    <!-- Les listes déroulantes : eBay en demande, et \`champ()\` ne les voyait même pas. -->
    <label for="f-c">Catégorie</label>
    <select id="f-c" name="category"><option value=""></option><option value="c1">Chaussures</option><option value="c2">Livres</option></select>
    <label for="f-e">État</label>
    <select id="f-e" name="condition"><option value=""></option><option value="e1">Neuf</option><option value="e2">Très bon état</option></select>
    <label for="f-m">Marque</label>
    <select id="f-m" name="brand"><option value=""></option><option value="m1">Adidas</option><option value="m2">Nike</option></select>
    <label for="f-z">Pointure</label>
    <select id="f-z" name="size"><option value=""></option><option value="z1">41</option><option value="z2">42</option></select>
    <!-- ⚠️ Un filtre de recherche, HORS en-tête : le prix de sa paire n'a rien à y faire. -->
    <label for="f-min">Prix min</label><input id="f-min" name="price_min" type="text">
    <label for="f-ph">Photos</label><input id="f-ph" name="images" type="file" multiple>
  </main>` : `<main><p>Rien à remplir ici.</p></main>`}
</body></html>`;

const AD = {
  id: '101', numero: '101', sku: 'VRM-101', account: 'julatace3535',
  title: 'Nike Air Max T42', description: 'Réf. VRM-101\n\nTrès bon état.',
  price: '45.00', photos: ['https://exemple/1.jpg', 'https://exemple/2.jpg', 'https://exemple/3.jpg'],
  marque: 'Nike', taille: '42',
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
      window.open = (u) => { window.__vrmOuvert = String(u || ''); return null; };
      window.__vrmEnvois = []; window.__dl = 0; window.__etapes = [];
      // Un vrai JPEG minuscule, en base64 : de quoi fabriquer de vrais `File`.
      const JPEG = 'ffd8ffe000104a46494600010100000100010000ffd9';
      const b64 = (() => { const bin = JPEG.match(/../g).map(h => String.fromCharCode(parseInt(h, 16))).join(''); return btoa(bin); })();
      window.chrome = { runtime: { sendMessage(m, cb) {
        window.__vrmEnvois.push(m.action);
        if (m.action === 'downloadPhotos') window.__dl++;
        if (m.action === 'ebayForm') window.__etapes.push({ etape: m.etape, selects: (m.selects || []).length, fichiers: m.fichiers });
        const rep = m.action === 'getQueue' ? { ok: true, queue: [ad], retirees: 3, postedCount: 0, vendues: 2, echec: false }
          : m.action === 'getPending' ? { ok: true, ad }
          : m.action === 'photoBytes' ? { ok: true, photos: (m.urls || []).map((u) => ({ url: u, b64, type: 'image/jpeg', taille: 22 })) }
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

    // ⚠️ ET IL DIT COMBIEN IL A ÉCARTÉ : une file qui rétrécit sans explication se
    //    lit comme une perte. Mesuré sur ses vraies données : 14 des 53 annonces
    //    « en ligne » sont prouvées vendues.
    dit(/2 paires déjà vendues/.test(txt), 'il dit combien de paires vendues sont écartées',
      (txt.match(/.{0,40}vendue.{0,40}/) || ['(rien)'])[0]);
    // ⚠️ ONZIÈME FOIS QU'UN DE MES CONTRÔLES CRIE AU LOUP, et c'est la même
    //    erreur que sur `leboncoin.cjs` : mon premier jet interdisait le MOT
    //    « télécharg », et il attrapait la phrase HONNÊTE que je venais
    //    d'écrire — « rien n'est téléchargé sur ton ordinateur ». Ce qui est
    //    interdit n'est pas un mot mais l'INSTRUCTION d'aller chercher un
    //    dossier sur son disque. *La donnée déclenche, jamais la formulation.*
    dit(!/dossier/i.test(txt), 'et il ne l\'envoie plus chercher un dossier sur son disque',
      (txt.match(/.{0,50}dossier.{0,30}/i) || [''])[0]);

    const lire = () => pg.evaluate(() => {
      const texte = (el) => (el && el.selectedIndex >= 0 ? String(el.options[el.selectedIndex].textContent || '').trim() : '');
      const ph = document.getElementById('f-ph');
      return {
        titre: document.getElementById('f-t').value,
        desc: document.getElementById('f-d').value,
        prix: document.getElementById('f-p').value,
        sku: document.getElementById('f-s').value,
        recherche: document.getElementById('gh-ac').value,
        filtre: document.getElementById('f-min').value,
        categorie: texte(document.getElementById('f-c')),
        etat: texte(document.getElementById('f-e')),
        marque: texte(document.getElementById('f-m')),
        pointure: texte(document.getElementById('f-z')),
        photos: ph && ph.files ? ph.files.length : -1,
        noms: ph && ph.files ? [...ph.files].map((f) => f.name + ':' + f.type) : [],
        dl: window.__dl,
        etapes: window.__etapes,
        bandeau: (document.getElementById('vrm-ebay-b') || {}).innerText || '',
      };
    });
    const v = await lire();
    dit(v.titre === AD.title, 'le titre est rempli', v.titre || '(vide)');
    dit(v.desc === AD.description, 'la description est remplie', v.desc ? 'ok' : '(vide)');
    dit(v.prix === AD.price, 'le prix est rempli', v.prix || '(vide)');
    dit(v.sku === AD.sku, 'la référence VRM-{n°} est dans le SKU', v.sku || '(vide)');
    // ⚠️ LE PIÈGE MESURÉ : la barre de recherche d'eBay est un input vide sur
    //    toutes ses pages. La remplir avec un titre d'annonce serait absurde
    //    et très visible.
    dit(v.recherche === '', 'et la barre de recherche d\'eBay reste VIDE',
      v.recherche ? 'elle contient « ' + v.recherche + ' »' : '');
    // ⚠️ ET UN FILTRE « Prix min » N'EST PAS LE PRIX DE SA PAIRE. Sur Leboncoin
    //    c'est arrivé pour de vrai (`price_min = 24.00`, prouvé au banc).
    dit(v.filtre === '', 'le filtre « Prix min » reste vide',
      v.filtre ? 'il contient ' + v.filtre : '');

    // ── LES LISTES DÉROULANTES : « ça ne met pas la catégorie ni le reste » ───
    dit(/très bon état/i.test(v.etat), 'l\'ÉTAT est choisi dans la liste déroulante', 'choisi : « ' + v.etat + ' »');
    dit(v.marque === 'Nike', 'la MARQUE est choisie', 'choisi : « ' + v.marque + ' »');
    dit(v.pointure === '42', 'la POINTURE est choisie', 'choisi : « ' + v.pointure + ' »');
    // ⚠️⚠️ ET LA CATÉGORIE, NON : c'est la règle du dossier (eBay la propose à
    //    partir du titre, et une catégorie fausse fait plus de mal que pas de
    //    catégorie). Un jour où quelqu'un « complète la symétrie » avec
    //    Leboncoin, ce contrôle doit passer au rouge.
    dit(v.categorie === '', 'la CATÉGORIE n\'est JAMAIS devinée sur eBay',
      v.categorie ? 'il a choisi « ' + v.categorie + ' » — eBay la propose mieux que nous' : '');

    // ── LES PHOTOS S'ATTACHENT, ET RIEN NE TOUCHE SON DISQUE ─────────────────
    dit(v.photos === 3, 'les 3 photos sont ATTACHÉES au champ fichier',
      v.photos + ' fichier(s) — ' + (v.noms[0] || 'aucun'));
    dit(/^VRM-101-1\.jpg:image\/jpeg$/.test(v.noms[0] || ''), 'et elles portent le nom de la paire et le bon type',
      v.noms[0] || 'aucun');
    dit(v.dl === 0, 'RIEN n\'est téléchargé sur son ordinateur',
      v.dl ? 'il a demandé ' + v.dl + ' téléchargement(s) : c\'est ce dont il se plaint' : '');

    // ── LE BANDEAU ÉCRIT LES CHIFFRES, JAMAIS « C'EST PRÊT » ─────────────────
    const remplis = [v.titre, v.desc, v.prix, v.sku].filter(Boolean).length
      + [v.etat, v.marque, v.pointure].filter(Boolean).length;
    dit(new RegExp(remplis + ' champs? rempli').test(v.bandeau),
      'le bandeau annonce le nombre EXACT de champs remplis (' + remplis + ')', v.bandeau.replace(/\n/g, ' ').slice(0, 80));
    dit(/3 photos attachées/.test(v.bandeau), 'et combien de photos ont été attachées',
      v.bandeau.replace(/\n/g, ' ').slice(0, 90));
    dit(!/prête|prêt à publier|plus qu'à/i.test(v.bandeau), 'il ne dit jamais que l\'annonce est prête');
    dit(!/dossier VRM-101/.test(v.bandeau), 'et il n\'envoie plus chercher un dossier sur son disque',
      (v.bandeau.match(/.{0,40}dossier.{0,20}/) || [''])[0]);

    // ── LA STRUCTURE DU FORMULAIRE M'EST RAPPORTÉE, AVEC SES LISTES ──────────
    // Je n'ai jamais vu ce formulaire (il est derrière la connexion) : sans les
    // libellés d'options je ne peux pas viser juste au passage suivant.
    // Le rapport part 6 s après l'arrivée sur la page : on l'attend plutôt que
    // de mesurer son absence (piège de banc classique).
    await pg.waitForFunction(() => (window.__etapes || []).length > 0, null, { timeout: 9000 }).catch(() => {});
    const etapes = await pg.evaluate(() => window.__etapes || []);
    dit(etapes.length >= 1 && etapes[0].selects >= 4 && etapes[0].fichiers >= 1,
      'il me rapporte l\'étape avec ses listes déroulantes et son champ photo',
      JSON.stringify(etapes[0] || null));

    // ── « Re-remplir » RELANCE : sans ça il ne servait qu'une fois ───────────
    // On vide un champ et on fait apparaître une nouvelle liste, comme une étape
    // suivante. Le bouton doit les reprendre.
    await pg.evaluate(() => {
      document.getElementById('f-t').value = '';
      const d = document.createElement('div');
      d.innerHTML = '<label for="f-e2">État de l\'objet</label><select id="f-e2" name="condition2"><option value=""></option><option value="x">Bon état</option></select>';
      document.querySelector('main').appendChild(d);
    });
    // ⚠️ UN BANC NE MEURT PAS, IL RAPPORTE : sur le code d'avant ce bouton
    //    n'existe pas, et un `click` qui expire faisait tomber tout le banc —
    //    donc les contrôles suivants n'étaient jamais rendus. Même erreur que le
    //    premier jet d'`audit-places.cjs` (mort sur `buildEbayData` absent).
    const aRefill = await pg.locator('#vrm-eb-refill').count() > 0;
    if (aRefill) { await pg.click('#vrm-eb-refill'); await pg.waitForTimeout(400); }
    const apres = await pg.evaluate(() => ({
      titre: document.getElementById('f-t').value,
      bandeau: (document.getElementById('vrm-ebay-b') || {}).innerText || '',
    }));
    dit(aRefill && apres.titre === AD.title, '« Re-remplir » reprend un champ vidé entre-temps',
      aRefill ? (apres.titre || '(vide)') : 'le bouton n\'existe pas : passé 1 min 30, le remplissage s\'arrête en silence');
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

  // ── 3. LE PRESSE-PAPIER QUI REFUSE ────────────────────────────────────────
  // ⚠️⚠️ ON SERT LE CAS QUI ÉCHOUE : `navigator.clipboard.writeText` rend une
  // promesse REJETÉE (document pas au premier plan, permission refusée, contexte
  // non sécurisé). Un `try/catch` ne l'attrape pas — et ce fichier n'avait même
  // pas de repli : le panneau annonçait « Titre copié », « Référence copiée :
  // VRM-101 », et le presse-papier restait vide. Or c'est le texte qui porte la
  // référence, le seul filet quand le formulaire n'a pas de champ pour elle.
  {
    const pg = await b.newPage({ viewport: { width: 1280, height: 900 } });
    const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
    await pg.exposeFunction('__banc_copy', (t) => { copie = t; });
    let copie = null;
    await pg.addInitScript((ad) => {
      window.open = () => null;
      window.__dl = 0;
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
        writeText: () => Promise.reject(new Error('NotAllowed')),
      } });
      document.execCommand = function () {
        try { const ta = document.querySelector('textarea[style*="-9999px"]'); window.__banc_copy(ta ? ta.value : ''); } catch (_) {}
        return true;
      };
      window.chrome = { runtime: { sendMessage(m, cb) {
        if (m.action === 'downloadPhotos') window.__dl++;
        const rep = m.action === 'getQueue' ? { ok: true, queue: [ad], retirees: 0, postedCount: 0, vendues: 0, echec: false }
          : m.action === 'getPending' ? { ok: true, ad: null }
          : { ok: true };
        if (typeof cb === 'function') setTimeout(() => cb(rep), 0);
      } } };
    }, AD);
    await pg.goto('http://localhost:4488/sl/sell', { waitUntil: 'domcontentloaded' });
    await pg.addScriptTag({ content: SRC });
    await pg.waitForTimeout(700);
    await pg.click('#vrm-ebay [data-a="toggle"]');
    await pg.waitForTimeout(600);
    await pg.click('#vrm-ebay [data-a="csku"]');
    await pg.waitForTimeout(500);
    dit(String(copie || '') === AD.sku, 'le presse-papier refusé retombe sur l\'ancienne méthode',
      copie === null ? 'RIEN n\'a été copié, et le panneau annonçait « copié »' : 'copié : « ' + copie + ' »');
    const t3 = await pg.evaluate(() => (document.getElementById('vrm-ebay-toast') || {}).innerText || '');
    dit(/VRM-101/.test(t3), 'et le message nomme la référence copiée', t3.slice(0, 60));

    // « Tout préparer » : plus AUCUN téléchargement, et la paire est mémorisée.
    copie = null;
    await pg.click('#vrm-ebay [data-a="prepare"]');
    await pg.waitForTimeout(700);
    const fin = await pg.evaluate(() => ({
      dl: window.__dl, ouvert: window.__vrmOuvert || '',
      toast: (document.getElementById('vrm-ebay-toast') || {}).innerText || '',
    }));
    dit(fin.dl === 0, '« Tout préparer » ne télécharge RIEN sur son ordinateur',
      fin.dl ? 'il a demandé ' + fin.dl + ' téléchargement(s)' : 'les photos partent par le formulaire');
    dit(/VRM-101/.test(String(copie || '')), 'le texte préparé porte la référence VRM-101',
      'sans elle, « vendue sur Vinted → retire-la » ne reconnaît plus l\'annonce');
    dit(/3 photos prêtes/.test(fin.toast), 'et le message écrit le CHIFFRE des photos', fin.toast.slice(0, 80));
    dit(errs.length === 0, 'aucune erreur non plus', errs.slice(0, 2).join(' | '));
    await pg.close();
  }

  await b.close(); srv.close();
  console.log(ko ? `\n${ko} controle(s) non conforme(s).` : '\nL\'assistant eBay tourne, remplit ce qu\'il faut, et dit ce qu\'il ne sait pas.');
  process.exit(ko ? 1 : 0);
})();
