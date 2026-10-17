// ═══════════════════════════════════════════════════════════════════════════
// BANC : LE PANNEAU LEBONCOIN, EXÉCUTÉ POUR DE VRAI
//        node scripts/bancs/leboncoin.cjs
// ═══════════════════════════════════════════════════════════════════════════
// ⚠️⚠️ `lbc.js` N'AVAIT JAMAIS TOURNÉ. 480 lignes, et c'est LE panneau qui sert
// à publier — celui que Julien a sous les yeux sur leboncoin.fr. `node --check`
// ne lit que la syntaxe : un sélecteur qui ne trouve rien, un `null`
// déréférencé, un panneau qui ne s'ouvre pas, une liste qui ne se groupe pas —
// rien de tout ça ne se voit sans l'exécuter dans une page. C'est §4.10
// appliqué au script de contenu le plus important du projet (la même leçon que
// `ebay.js`, sur le script qu'on utilise tous les jours).
//
// Ce qu'il vérifie, et pourquoi :
//   · la liste se groupe sur CE QU'IL PEUT FAIRE (loi de l'écran Colis) ;
//   · une annonce à 1 photo le DIT et donne la porte — mesuré le 12 septembre,
//     54 de ses 59 annonces partiraient avec une seule photo ;
//   · une annonce à 0 photo est en HAUT : Leboncoin la refuse ;
//   · ⚠️⚠️ « vendue » n'est écrit QUE sur une vente prouvée. Mesuré : sur ses
//     400 annonces fermées, 151 seulement portent une vente prouvée par
//     identité. Dire « vendue, supprime-la » sur les 249 autres lui ferait
//     perdre une vente sur une paire qu'il a encore.
const { chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'));
const fs = require('fs'), http = require('http'), path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'vinted-sync-extension', 'lbc.js'), 'utf8');

// ⚠️ LA VRAIE STRUCTURE, pas une invention : la page de dépôt de Leboncoin ne
// porte qu'UN champ (`name="subject"`, « Que proposez-vous aujourd'hui ? ») —
// c'est ce que SON navigateur a rapporté dans `lbc_recon` le 2 août, et c'est un
// formulaire en ÉTAPES. L'en-tête, lui, porte une barre de recherche sur TOUTES
// les pages : c'est le piège que la garde `DANS_ENTETE` écarte.
const PAGE = (depot) => `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Leboncoin</title></head>
<body>
  <header role="banner"><form action="/recherche"><input name="text" type="text" placeholder="Rechercher sur leboncoin"></form></header>
  <main>${depot === 'obligatoire'
    // 5.182 : une étape dont un champ OBLIGATOIRE ne se devine pas (« Univers* »),
    //    et un « Continuer » grisé tant qu'il est vide — la fiche de l'app doit
    //    apprendre LEQUEL manque (son libellé, jamais un contenu).
    ? '<label for="u1">Univers*</label><input id="u1" name="univers" type="text" required>'
      + '<button type="button" id="continuer" disabled>Continuer</button>'
    : depot === 'basdepage'
    // ⚠️ Étape publication SANS libellé « Publier » reconnaissable : le bouton
    //    gratuit s'appelle « Terminer » (tout en bas), au-dessus un bouton à PRIX,
    //    un « Annuler » et un « Continuer ». Prouve que la garde argent tient même
    //    quand on DEVINE le bouton du bas (Julien : « il est tout en bas »).
    ? '<div class="dropzone"><input id="uf" type="file" multiple accept="image/*"></div><div id="previews"></div>'
      + '<fieldset><label><input type="checkbox" name="gallery" checked> Galerie</label></fieldset>'
      // ÉTAPE FINALE (pas de « Continuer » — c'est la dernière) : un bouton à PRIX,
      // un « Annuler », et le bouton gratuit « Terminer » tout en bas.
      + '<div><button id="paidx" type="button">Remonter mon annonce · 9,90 €</button></div>'
      + '<div><button id="annx" type="button">Annuler</button></div>'
      + '<div><button id="finx" type="button">Terminer</button></div>'
      + '<scr'+'ipt>var uf=document.getElementById("uf");var k=0;uf.addEventListener("change",function(){var f=uf.files[0];if(!f)return;k++;var img=document.createElement("img");img.src="https://cdn.leboncoin.example/"+k+".jpg";document.getElementById("previews").appendChild(img);uf.value="";});'
      + 'window.__fin=0;window.__paidx=0;window.__annx=0;document.getElementById("finx").onclick=function(){window.__fin++;};document.getElementById("paidx").onclick=function(){window.__paidx++;};document.getElementById("annx").onclick=function(){window.__annx++;};</scr'+'ipt>'
    : depot === 'boost'
    // ⚠️⚠️ L'ÉTAPE OPTIONS (mesurée `lbc_recon.etapes`) : QUE des cases de boost
    //    PAYANTES (gallery/daily_bump/urgent), un bouton de dépôt GRATUIT et un
    //    bouton PAYANT. + un champ photo (multiple, upload-à-chaque-change) pour
    //    que des photos soient « envoyées » (la publication est gatée dessus).
    ? '<div class="dropzone" aria-label="Ajouter des photos"><input id="uf" type="file" multiple accept="image/*"></div><div id="previews"></div>'
      + '<fieldset><label><input type="checkbox" name="gallery" checked> Galerie</label>'
      + '<label><input type="checkbox" name="daily_bump"> Remontée quotidienne</label>'
      + '<label><input type="checkbox" name="urgent"> Annonce urgente</label></fieldset>'
      // Le PAYANT est placé AVANT le gratuit exprès : sans la garde « prix », un
      // finder naïf prendrait le premier « déposer » — celui qui coûte.
      + '<button id="paid" type="button">Déposer mon annonce en Galerie · 9,90 €</button>'
      + '<button id="pub" type="button">Déposer mon annonce</button>'
      + '<scr'+'ipt>var uf=document.getElementById("uf");var k=0;uf.addEventListener("change",function(){var f=uf.files[0];if(!f)return;k++;var img=document.createElement("img");img.src="https://cdn.leboncoin.example/"+k+".jpg";document.getElementById("previews").appendChild(img);uf.value="";});'
      + 'window.__pub=0;window.__paid=0;document.getElementById("pub").onclick=function(){window.__pub++;};document.getElementById("paid").onclick=function(){window.__paid++;};</scr'+'ipt>'
    : depot === 'photosreel'
    // ⚠️⚠️ LE VRAI UPLOADER LEBONCOIN (mesuré le 20 sept. sur `lbc_recon.etapes`) :
    //    champ `multiple:true`, MAIS il lit UNE photo par `change`, l'envoie au
    //    serveur, affiche la vignette RENVOYÉE (une URL http, PAS un blob:) et
    //    VIDE le champ. C'est le cas qui piégeait l'ancien code : il partait en
    //    « envoi groupé » (car multiple) → une seule photo, puis se croyait fini
    //    car il comptait les blob: (=0). Ici les vignettes sont http → aveugle.
    ? '<div class="dropzone" aria-label="Ajouter des photos"><input id="uf" type="file" multiple accept="image/*,.webp"></div><div id="previews"></div>'
      + '<scr'+'ipt>var uf=document.getElementById("uf");var k=0;uf.addEventListener("change",function(){var f=uf.files[0];if(!f)return;k++;var img=document.createElement("img");img.src="https://cdn.leboncoin.example/"+k+".jpg";document.getElementById("previews").appendChild(img);uf.value="";});</scr'+'ipt>'
    : depot === 'photos1'
    // ⚠️ L'UPLOADER QUI NE GARDE QU'UNE PHOTO (« une seule se téléverse »,
    //    Julien 19 sept.) : un champ NON `multiple` qui, à chaque `change`, lit
    //    UNE photo, ajoute sa vignette (blob:) et se VIDE pour la suivante — le
    //    remontage React. Un envoi groupé n'y dépose qu'UNE vignette ; il faut
    //    poser les photos une par une.
    ? '<div class="dropzone" aria-label="Ajouter des photos"><input id="uf" type="file" accept="image/*"></div><div id="previews"></div>'
      + '<scr'+'ipt>var uf=document.getElementById("uf");uf.addEventListener("change",function(){var f=uf.files[0];if(!f)return;var img=document.createElement("img");img.src="blob:"+f.name;document.getElementById("previews").appendChild(img);uf.value="";});</scr'+'ipt>'
    : depot === 'etape3'
    // ⚠️ LA VRAIE FORME MESURÉE sur son dépôt (`lbc_recon.etapes`) : les
    //    attributs sont des COMPOSANTS React — un [role=combobox] + une liste
    //    [role=option], PAS des <select> natifs. C'est pour ça que `choisirListe`
    //    ne remplissait rien. On sert ici exactement cette forme.
    ? '<label for="s3">Titre</label><input id="s3" name="subject" type="text">'
      + '<div><label for="cbp">Pointure*</label><input id="cbp" role="combobox" aria-label="Pointure*" readonly>'
      + '<ul id="cbp-menu" role="listbox" hidden><li role="option">39</li><li role="option">40</li><li role="option">40,5</li><li role="option">41</li></ul></div>'
      + '<div><label for="cbe">État*</label><input id="cbe" role="combobox" aria-label="État*" readonly>'
      + '<ul id="cbe-menu" role="listbox" hidden><li role="option">Neuf avec étiquette</li><li role="option">Très bon état</li><li role="option">Bon état</li><li role="option">État satisfaisant</li></ul></div>'
      // ⚠️ LA MARQUE (mesuré le 15 oct., 5.177) : un menu qui ne montre que 11
      //    marques (« A Bathing Ape »… « Airstep ») et FILTRE À LA FRAPPE. Nike
      //    n'y est jamais sans taper. Le champ est écrivable (pas readonly).
      + '<div><label for="cbm">Marque</label><input id="cbm" role="combobox" aria-label="Marque" type="text">'
      + '<ul id="cbm-menu" role="listbox" hidden></ul></div>'
      + '<scr'+'ipt>(function(){var CAT=["A Bathing Ape (BAPE)","Abercrombie & Fitch","Adidas","Airstep","New Balance","Nike","Nike ACG","Salomon"];var cb=document.getElementById("cbm"),mn=document.getElementById("cbm-menu");window.__marqueTape=[];'
      + 'function rendre(q){mn.innerHTML="";var l=q?CAT.filter(function(c){return c.toLowerCase().indexOf(q.toLowerCase())>=0;}):CAT.slice(0,4);l.forEach(function(c){var li=document.createElement("li");li.setAttribute("role","option");li.textContent=c;li.addEventListener("click",function(){cb.value=c;cb.setAttribute("data-choisi",c);mn.hidden=true;});mn.appendChild(li);});}'
      + 'cb.addEventListener("click",function(){mn.hidden=false;rendre(cb.value);});cb.addEventListener("input",function(){window.__marqueTape.push(cb.value);mn.hidden=false;setTimeout(function(){rendre(cb.value);},120);});})();</scr'+'ipt>'
      // ⚠️ LA CATÉGORIE = des boutons RADIO (mesuré au rendu, 20 sept.), + un
      //    bouton « Continuer » et un « Publier ». L'extension doit cocher le
      //    bon radio (Chaussures), cliquer Continuer, et JAMAIS Publier (§3/§5).
      + '<fieldset><label><input type="radio" name="cat"> Mode &gt; Chaussures</label>'
      + '<label><input type="radio" name="cat"> Loisirs &gt; Sport &amp; Plein air</label>'
      + '<label><input type="radio" name="cat"> Mode &gt; Vêtements</label></fieldset>'
      + '<button type="button" id="continuer">Continuer</button>'
      + '<button type="button" id="publier">Publier mon annonce</button>'
      // ⚠️ LA LIVRAISON : interrupteur maître ÉTEINT (l'extension doit le
      //    rallumer, « activé par défaut » chez lui) + un leurre « offres par
      //    email » qui NE doit PAS être coché (on n'agit que sur l'envoi).
      + '<div id="livsw" role="switch" aria-checked="false" aria-label="Proposer la livraison">Proposer la livraison</div>'
      + '<label><input type="checkbox" id="news"> Recevoir des offres par email</label>'
      + '<scr'+'ipt>document.getElementById("livsw").addEventListener("click",function(){this.setAttribute("aria-checked",this.getAttribute("aria-checked")==="true"?"false":"true");});</scr'+'ipt>'
      + '<scr'+'ipt>document.querySelectorAll("[role=combobox]:not(#cbm)").forEach(function(cb){var menu=document.getElementById(cb.id+"-menu");cb.addEventListener("click",function(){menu.hidden=false;});menu.querySelectorAll("[role=option]").forEach(function(o){o.addEventListener("click",function(){cb.value=o.textContent;cb.setAttribute("data-choisi",o.textContent);menu.hidden=true;});});});'
      + 'window.__cont=0;window.__pub=0;document.getElementById("continuer").addEventListener("click",function(){window.__cont++;});document.getElementById("publier").addEventListener("click",function(){window.__pub++;});</scr'+'ipt>'
    : depot === 'photoscont'
    // ⚠️ DÉTOURAGE (4 oct.) : le fond rend les photos après jusqu'à 45 s. Une
    //    étape qui porte un champ photo ET « Continuer » : on ne doit PAS
    //    enchaîner avant que les photos soient posées. Le banc note l'heure de
    //    chaque clic et de chaque photo reçue.
    ? '<div class="dropzone" aria-label="Ajouter des photos"><input id="uf" name="images" type="file" multiple accept="image/*"></div><div id="previews"></div>'
      + '<button type="button" id="continuer">Continuer</button>'
      + '<scr'+'ipt>window.__t0=Date.now();window.__contAt=[];window.__photoAt=[];var uf=document.getElementById("uf");uf.addEventListener("change",function(){for(var i=0;i<uf.files.length;i++){window.__photoAt.push(Date.now()-window.__t0);var img=document.createElement("img");img.src="blob:"+uf.files[i].name;document.getElementById("previews").appendChild(img);}});'
      + 'document.getElementById("continuer").addEventListener("click",function(){window.__contAt.push(Date.now()-window.__t0);});</scr'+'ipt>'
    : depot === 'etape2'
    ? '<label for="s2">Titre de l’annonce</label><input id="s2" name="subject" type="text">'
      + '<label for="d2">Description</label><textarea id="d2" name="body"></textarea>'
      + '<label for="p2">Prix de vente souhaité*</label><input id="p2" name="price_cents" type="text">'  // ⚠️ la VRAIE forme mesurée : il y tape des EUROS (lbc_recon.etapes, 15 oct.)
      // La localisation, VRAIE forme mesurée (15 oct.) : une liste à choisir, les
      // propositions « Ville (code postal) » n'apparaissent qu'après la frappe.
      + '<label for="loc">Location</label><input id="loc" name="location" role="combobox" aria-label="Location" type="text"><div id="locmenu" role="listbox"></div>'
      + '<scr'+'ipt>(function(){var b=document.getElementById("loc"),m=document.getElementById("locmenu");window.__villeChoisie="";b.addEventListener("input",function(){var v=b.value.toLowerCase();m.innerHTML="";if(v.indexOf("canc")<0)return;setTimeout(function(){["Route de Cancale, Saint-Malo (35400)","Cancale (35260)"].forEach(function(t){var o=document.createElement("div");o.setAttribute("role","option");o.textContent=t;o.addEventListener("click",function(){window.__villeChoisie=t;b.value=t;m.innerHTML="";});m.appendChild(o);});},250);});})();</scr'+'ipt>'
      + '<label for="c2">Catégorie</label><select id="c2" name="category"><option value=""></option><option value="1">Vêtements</option><option value="2">Chaussures</option><option value="3">Sacs à main</option></select>'
      + '<label for="e2">État</label><select id="e2" name="condition"><option value=""></option><option value="1">Neuf</option><option value="2">Très bon état</option><option value="3">Satisfaisant</option></select>'
      + '<label for="f2">Photos</label><input id="f2" name="images" type="file" multiple accept="image/*">'
    : depot
    ? '<label for="s1">Que proposez-vous aujourd’hui ?</label><input id="s1" name="subject" type="text">'
    : '<h1>Annonces</h1><aside><label for="pmin">Prix min</label><input id="pmin" name="price_min" type="text">'
      + '<label for="pmax">Prix max</label><input id="pmax" name="price_max" type="text"></aside>'}</main>
</body></html>`;

// La file servie au panneau : les trois cas de photo, et les trois preuves.
const QUEUE = [
  { id: '1001', numero: '401', account: 'julatace3535', marque: 'Salomon', title: 'Salomon XT-6 blanc T40', description: 'Réf. VRM-401\n\nTrès bon état.', price: '99.00', ville: 'Cancale', category: 'Chaussures', taille: '40', etat: 'Très bon état', photos: ['https://ex/a1.jpg', 'https://ex/a2.jpg', 'https://ex/a3.jpg'], ref: 'VRM-401', vintedUrl: 'https://www.vinted.fr/items/1001' },
  { id: '1002', numero: '402', account: 'julatace3535', title: 'Nike air max 1 clear jade T44', description: 'Réf. VRM-402\n\nBon état.', price: '44.00', category: 'Chaussures', photos: ['https://ex/b1.jpg'], ref: 'VRM-402', vintedUrl: 'https://www.vinted.fr/items/1002' },
  { id: '1003', numero: '403', account: 'llloollllaa', title: 'Autry medalist blanc T36', description: 'Réf. VRM-403', price: '24.00', category: 'Chaussures', photos: [], ref: 'VRM-403', vintedUrl: 'https://www.vinted.fr/items/1003' },
];
const REMOVALS = [
  { id: '2001', numero: '501', ref: 'VRM-501', title: 'Nike p-6000 noir', etat: 'vendue' },
  { id: '2002', numero: '502', ref: 'VRM-502', title: 'Adidas Spezial noir', etat: 'fermee', url: 'https://www.leboncoin.fr/ad/502' },
  { id: '2003', numero: '503', ref: 'VRM-503', title: 'Dr. Martens 1461 mono', etat: 'pause', url: 'https://www.leboncoin.fr/ad/503' },
];
// Ses transactions Leboncoin captées (forme réelle mesurée le 20 sept.). Elles
// MÊLENT ventes et achats — comme sa vraie base : une vente PROUVÉE à lui
// (`isSeller: true`) avec son bordereau ; un ACHAT prouvé (`isSeller: false`,
// une Rolex — il ne la vend pas, il l'a achetée) ; une transaction dont le côté
// n'est pas encore su (issue de la liste v3, `isSeller` absent).
const VENTES = [
  { txId: '362201423', itemId: '3271360255', title: 'New Balance 990 gris taille 44', price: 7500, isSeller: true, stepStatus: 'action', stepLabel: 'Colis à envoyer', deliveryLabel: 'Mondial Relay', label: { reference: '71977917', voucherUrl: 'https://cdn.leboncoin/label/71977917.pdf', qrUrl: '', trackingUrl: 'https://mondialrelay/suivi/71977917' } },
  { txId: '900001', itemId: '900001', title: 'Montre Rolex Submariner', price: 450000, isSeller: false, stepStatus: 'done', stepLabel: 'Terminée', label: null },
  { txId: '163516245', title: 'autre paire', price: 1500, stepStatus: 'cancelled', stepLabel: 'Annulée', label: null },
];

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };

(async () => {
  const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(PAGE(/obligatoire/.test(q.url) ? 'obligatoire' : /basdepage/.test(q.url) ? 'basdepage' : /boost/.test(q.url) ? 'boost' : /photosreel/.test(q.url) ? 'photosreel' : /photoscont/.test(q.url) ? 'photoscont' : /photos1/.test(q.url) ? 'photos1' : /etape3/.test(q.url) ? 'etape3' : /etape2/.test(q.url) ? 'etape2' : /depot/.test(q.url))); });
  await new Promise((res) => srv.listen(4491, res));
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  const pg = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  // Aucune image ne part sur le réseau : un banc ne dépend pas d'un CDN.
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    const t = r.request().resourceType();
    return (t === 'image' || t === 'font' || t === 'media') ? r.abort() : r.continue();
  });
  // Le faux pont : exactement ce que `lbc.js` demande au fond.
  await pg.addInitScript((d) => {
    window.chrome = {
      runtime: {
        id: 'banc', lastError: null,
        sendMessage: (msg, cb) => {
          const rep = (o) => { try { cb && cb(o); } catch (_) {} };
          if (!msg || msg.action === undefined) return rep({ ok: true });
          (window.__demandes = window.__demandes || []).push(msg.action);
          if (msg.action === 'getQueue') return rep({ ok: true, queue: d.queue, removals: d.removals, unlinked: [], postedList: [], ventes: d.ventes, stats: { onlineCount: 3, numberedCount: 3, postedCount: 0, lbcCount: 0 } });
          return rep({ ok: true });
        },
        onMessage: { addListener() {} },
      },
    };
  }, { queue: QUEUE, removals: REMOVALS, ventes: VENTES });

  await pg.goto('http://localhost:4491/', { waitUntil: 'domcontentloaded' });
  await pg.addScriptTag({ content: SRC });
  await pg.waitForTimeout(1200);

  // ── PLUS AUCUN PANNEAU SUR LEBONCOIN (5.130) ──────────────────────────────
  // Julien, 2 octobre : « tout doit être centralisé dans VRM ; l'extension est
  // là pour capter ». La file, ses ventes, les preuves « vendue / à vérifier /
  // en pause » vivent dans l'APP (écran Leboncoin). Sur leboncoin.fr il ne reste
  // que la petite carte VRM (vrm-badge.js, banc badge.cjs).
  const surPage = await pg.evaluate(() => ({
    pastille: !!document.querySelector('[data-a="open"]'),
    racines: [...document.querySelectorAll('*')].filter((e) => e.shadowRoot).length,
    texte: document.body.innerText,
    demandes: window.__demandes || [],
  }));
  dit(!errs.length, 'aucune erreur de page', errs[0] || '');
  dit(!surPage.pastille && surPage.racines === 0, 'aucun panneau VRM sur la page Leboncoin',
    surPage.pastille ? 'la pastille du panneau est encore là' : surPage.racines + ' racine(s) d\'ombre posée(s)');
  dit(!/à publier|Tes ventes Leboncoin|supprime-la/i.test(surPage.texte), 'aucune liste ni consigne écrite dans la page');
  dit(!surPage.demandes.includes('getQueue'), 'et la page ne recalcule plus la file à chaque chargement (zéro lecture pour rien)',
    'demandes : ' + surPage.demandes.join(', '));

  // ── LE PRÉ-REMPLISSAGE SUR LA VRAIE PAGE DE DÉPÔT ─────────────────────────
  // ⚠️⚠️ Le panneau annonçait « pré-rempli (dont la réf VRM-401) » À CHAQUE FOIS,
  // même quand aucun champ de référence n'existait. Or la vraie page de dépôt
  // n'en a pas : la référence n'était donc JAMAIS mise, et c'est elle qui relie
  // l'annonce Leboncoin à la paire sans rapprochement par titre (§5). Sans elle,
  // « vendue sur Vinted → à retirer » ne reconnaît pas l'annonce — il vend la
  // même paire deux fois.
  {
    const p2 = await b.newPage({ viewport: { width: 1280, height: 900 } });
    const e2 = []; p2.on('pageerror', (e) => e2.push(e.message));
    const toasts = [];
    p2.on('console', () => {});
    await p2.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
      const t = r.request().resourceType();
      return (t === 'image' || t === 'font' || t === 'media') ? r.abort() : r.continue();
    });
    await p2.addInitScript((d) => {
      window.chrome = { runtime: { id: 'banc', lastError: null, sendMessage: (m, cb) => { const rep = (o) => { try { cb && cb(o); } catch (_) {} };
        if (m && m.action === 'getQueue') return rep({ ok: true, queue: d.queue, removals: [], unlinked: [], postedList: [], stats: { onlineCount: 3, numberedCount: 3 } });
        if (m && m.action === 'getPending') return rep({ ok: true, ad: d.queue[0] });   // ⚠️ auto : plus de bouton « Pré-remplir »
        return rep({ ok: true }); }, onMessage: { addListener() {} } } };
    }, { queue: QUEUE });
    await p2.goto('http://localhost:4491/depot', { waitUntil: 'domcontentloaded' });
    await p2.addScriptTag({ content: SRC });
    // ⚠️ L'extension fait tout TOUTE SEULE (Julien, 20 sept.) : plus de « Pré-remplir »
    //    à cliquer. Sur une page de dépôt, `autoPrefill` lit la paire en attente
    //    (`getPending`) et remplit — on laisse tourner.
    await p2.waitForTimeout(3000);
    const attendu = QUEUE[0].title || '';
    const etat = await p2.evaluate(() => ({
      sujet: (document.querySelector('input[name="subject"]') || {}).value || '',
      recherche: (document.querySelector('header input[name="text"]') || {}).value || '',
    }));
    dit(!e2.length, 'aucune erreur de page pendant le remplissage automatique', e2[0] || '');
    dit(!!attendu && etat.sujet === attendu, 'la page de dépôt reçoit le titre de la paire en attente, TOUTE SEULE',
      'attendu « ' + attendu + ' », reçu « ' + etat.sujet.slice(0, 40) + ' »');
    // ⚠️ LE PIÈGE : la barre de recherche de l'en-tête, présente sur TOUTES les
    //    pages. La garde `DANS_ENTETE` doit l'écarter.
    dit(etat.recherche === '', 'la barre de recherche de l\'en-tête n\'est JAMAIS remplie',
      etat.recherche ? 'elle a reçu « ' + etat.recherche.slice(0, 30) + ' »' : '');
    await p2.close();
  }

  // ── 11 OCTOBRE : UN DÉPÔT QUI N'ABOUTIT PAS LE DIT À L'APP ─────────────────
  // « Quand je vais poster des paires sur le bon coin, je ne peux pas » : fermer
  // le bandeau laissait le bouton de l'app « Publication en cours… » 15 minutes.
  // Fermer, c'est laisser tomber CE dépôt : le service worker l'apprend
  // (`depotArrete`), et « Réessayer » depuis l'app fait REPRENDRE cet onglet.
  {
    const p2b = await b.newPage({ viewport: { width: 1280, height: 900 } });
    await p2b.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
      const t = r.request().resourceType();
      return (t === 'image' || t === 'font' || t === 'media') ? r.abort() : r.continue();
    });
    await p2b.addInitScript((d) => {
      window.__envoyes = []; window.__ecouteurs = [];
      window.chrome = { runtime: { id: 'banc', lastError: null, sendMessage: (m, cb) => { const rep = (o) => { try { cb && cb(o); } catch (_) {} };
        window.__envoyes.push(JSON.parse(JSON.stringify(m || {})));
        if (m && m.action === 'getQueue') return rep({ ok: true, queue: d.queue, removals: [], unlinked: [], postedList: [], stats: { onlineCount: 3, numberedCount: 3 } });
        if (m && m.action === 'getPending') return rep({ ok: true, ad: d.queue[0] });
        return rep({ ok: true }); }, onMessage: { addListener(fn) { window.__ecouteurs.push(fn); } } } };
    }, { queue: QUEUE });
    await p2b.goto('http://localhost:4491/depot', { waitUntil: 'domcontentloaded' });
    await p2b.addScriptTag({ content: SRC });
    await p2b.waitForTimeout(2500);
    const id = String(QUEUE[0].id);
    // « Réessayer » depuis l'app, sur cet onglet encore ouvert : il REPREND ici.
    // ⚠️ Revue du 11 octobre : le service worker juge l'onglet VIVANT par la
    //    RÉPONSE de la page (un onglet parti ailleurs bloquait la paire pour
    //    toujours) — elle répond donc, pour CETTE paire.
    const reponses = await p2b.evaluate((id) => new Promise((res) => {
      const out = {}; let n = 0; const fin = () => { if (++n === 2) res(out); };
      for (const f of window.__ecouteurs) {
        try { f({ __vrmLbc: 'vivant', id }, {}, (r) => { out.vivant = r; fin(); }); } catch (_) {}
        try { f({ __vrmLbc: 'reprendre', id }, {}, (r) => { out.reprendre = r; fin(); }); } catch (_) {}
      }
      setTimeout(() => res(out), 1500);
    }), id);
    await p2b.waitForTimeout(300);
    const repris = await p2b.evaluate((id) => window.__envoyes.some((m) => m.action === 'depotRepris' && String(m.id) === id), id);
    dit(repris, '« Réessayer » depuis l’app sur un dépôt ouvert : la page REPREND ici (pas un second dépôt)', '');
    dit(reponses.vivant && reponses.vivant.ok && reponses.vivant.depot === true && reponses.vivant.sienne === true && reponses.reprendre && reponses.reprendre.repris === true,
      'et la page RÉPOND : sur le dépôt, pour cette paire, reprise faite (c’est ce que le service worker attend pour la dire vivante)', JSON.stringify(reponses));
    const ferme = await p2b.$('#vrm-close');
    if (ferme) await ferme.click().catch(() => {});
    await p2b.waitForTimeout(300);
    const arret = await p2b.evaluate(() => window.__envoyes.filter((m) => m.action === 'depotArrete'));
    dit(!!ferme && arret.length === 1 && String(arret[0].id) === id && arret[0].raison === 'bandeau-ferme', 'fermer le bandeau du dépôt : l’app l’apprend (« Le dépôt n’a pas abouti — Réessayer »), au lieu de 15 minutes « en cours »', JSON.stringify(arret));
    await p2b.close();
  }

  // ── LE PANNEAU N'AUTO-REMPLIT QUE LES PAGES DE DÉPÔT ──────────────────────
  // ⚠️ Avant, « Pré-remplir » pouvait remplir n'importe quelle page (une
  //    recherche avec « Prix min/max »). Maintenant l'extension fait tout TOUTE
  //    SEULE, et `autoPrefill` ne s'arme QUE sur une URL de dépôt : une page de
  //    résultats n'est jamais touchée (le prix de sa paire n'atterrit pas dans
  //    un filtre), même avec une paire en attente. C'est la garde d'URL, jugée
  //    sur le RÉSULTAT.
  {
    const p3 = await b.newPage({ viewport: { width: 1280, height: 900 } });
    await p3.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
      const t = r.request().resourceType();
      return (t === 'image' || t === 'font' || t === 'media') ? r.abort() : r.continue();
    });
    await p3.addInitScript((d) => {
      window.chrome = { runtime: { id: 'banc', lastError: null, sendMessage: (m, cb) => { const rep = (o) => { try { cb && cb(o); } catch (_) {} };
        if (m && m.action === 'getQueue') return rep({ ok: true, queue: d.queue, removals: [], unlinked: [], postedList: [], stats: { onlineCount: 3, numberedCount: 3 } });
        if (m && m.action === 'getPending') return rep({ ok: true, ad: d.queue[0] });
        return rep({ ok: true }); }, onMessage: { addListener() {} } } };
    }, { queue: QUEUE });
    await p3.goto('http://localhost:4491/recherche', { waitUntil: 'domcontentloaded' });
    await p3.addScriptTag({ content: SRC });
    await p3.waitForTimeout(2500);
    const filtres = await p3.evaluate(() => ({
      min: (document.querySelector('input[name="price_min"]') || {}).value || '',
      max: (document.querySelector('input[name="price_max"]') || {}).value || '',
      recherche: (document.querySelector('header input[name="text"]') || {}).value || '',
    }));
    dit(filtres.min === '' && filtres.max === '' && filtres.recherche === '',
      'une page de RECHERCHE n\'est jamais auto-remplie (ni filtre prix, ni barre de recherche)',
      'min=« ' + filtres.min + ' » max=« ' + filtres.max + ' » rech=« ' + filtres.recherche + ' »');
    await p3.close();
  }

  // ── « JAMAIS LU » N'EST PAS « ZÉRO », ET LA NOUVELLE SOURCE DOIT MARCHER ──
  // Mesuré le 12 septembre : `lbc_listings` et `lbc_accounts` sont ABSENTES de sa
  // base alors que `lbc_recon` existe depuis le 2 août. Or le compte Leboncoin se
  // lit sur n'importe quelle page dès que `__NEXT_DATA__` est là : s'il n'a jamais
  // été écrit, c'est que cet élément n'existe plus. La capture était donc morte,
  // et le panneau annonçait « 📊 0 annonce sur Leboncoin » — un zéro inventé qui
  // cachait que « vendue sur Vinted → à retirer » ne pouvait pas fonctionner.
  {
    const p4 = await b.newPage({ viewport: { width: 1280, height: 900 } });
    const e4 = []; p4.on('pageerror', (e) => e4.push(e.message));
    let capture = null;
    await p4.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
      const t = r.request().resourceType();
      return (t === 'image' || t === 'font' || t === 'media') ? r.abort() : r.continue();
    });
    let recu = null;
    await p4.exposeFunction('__banc_capture', (o) => { capture = o; });
    // ⚠️ ET ON VÉRIFIE QUE LA VRAIE CAPTURE PASSE TOUJOURS : mon diagnostic
    //    réutilisait d'abord le nom `lbcCapture`, et il aurait avalé les annonces.
    await p4.exposeFunction('__banc_listings', (o) => { recu = o; });
    await p4.addInitScript((d) => {
      // Une page SANS `__NEXT_DATA__` : le format actuel de Leboncoin, où les
      // données arrivent en morceaux dans `self.__next_f`.
      self.__next_f = [
        [1, '{"buildId":"x"}'],
        [1, 'a:["$","div",null,{"children":{"list_id":"2837465","subject":"Salomon XT-6 blanc T40","price":[99],"body":"Réf. VRM-401 — très bon état","url":"https://www.leboncoin.fr/ad/2837465","status":"active","owner":{"user_id":"77","name":"Cancale"}}}]'],
      ];
      window.chrome = { runtime: { id: 'banc', lastError: null, sendMessage: (m, cb) => {
        const rep = (o) => { try { cb && cb(o); } catch (_) {} };
        if (m && m.action === 'lbcDiag') { try { window.__banc_capture(m); } catch (_) {} return rep({ ok: true }); }
        if (m && m.action === 'lbcCapture') { try { window.__banc_listings(m); } catch (_) {} return rep({ ok: true }); }
        if (m && m.action === 'getQueue') return rep({ ok: true, queue: d.queue, removals: [], unlinked: [], postedList: [], stats: { onlineCount: 3, numberedCount: 3, postedCount: 0, lbcCount: 0, lbcJamaisLu: true } });
        return rep({ ok: true }); }, onMessage: { addListener() {} } } };
    }, { queue: QUEUE });
    await p4.goto('http://localhost:4491/', { waitUntil: 'domcontentloaded' });
    await p4.addScriptTag({ content: SRC });
    await p4.waitForTimeout(1100);
    dit(!e4.length, 'aucune erreur sur une page au nouveau format', e4[0] || '');
    // 1. La nouvelle source est lue.
    dit(!!capture, 'la capture REMONTE ce qu\'elle a vu', capture ? '' : 'sans ça, « 0 annonce » et « rien pu lire » sont le même silence');
    if (capture) {
      dit(capture.source === 'next_f', 'elle lit le format actuel (données en morceaux)', 'source : ' + capture.source);
      dit(capture.vues >= 1, 'et elle y retrouve bien une annonce', capture.vues + ' vue(s)');
      dit(capture.a_next_data === false && capture.a_next_f === true,
        'elle dit quel format porte la page', `__NEXT_DATA__:${capture.a_next_data} · __next_f:${capture.a_next_f}`);
    }
    // 2. « Jamais lu » n'est pas « zéro » : c'est l'APP qui le dit désormais
    //    (écran Leboncoin, `lbcJamaisLu`) — plus aucun panneau ici.
    dit(!!recu && Array.isArray(recu.listings) && recu.listings.length >= 1,
      'et la VRAIE capture des annonces part toujours vers le fond',
      recu ? (recu.listings || []).length + ' annonce(s) transmise(s)' : 'aucun message `lbcCapture` : le diagnostic a pris sa place');
    await p4.close();
  }

  // ── « PUBLIER » SE DÉCLENCHE DEPUIS L'APP (5.130) ────────────────────────
  // Le bouton « 🚀 Tout préparer » du panneau est retiré : l'app commande
  // (`lbcPublier`), le fond mémorise la paire et ouvre le dépôt — vérifié par
  // audit-publier-app.cjs sur le VRAI background.js. Ici on garde la suite :
  // la page de dépôt se remplit et publie toute seule (blocs suivants).

  // ── LES PHOTOS S'ATTACHENT, ET LA CATÉGORIE SE CHOISIT ────────────────────
  // ⚠️⚠️ LE DOSSIER AFFIRMAIT QUE C'ÉTAIT IMPOSSIBLE, ET C'ÉTAIT FAUX (je
  // l'avais écrit). Ce qui est interdit c'est `input.value = '/chemin/…'` ;
  // `input.files = dataTransfer.files` marche. Mesuré dans Chromium, puis ici
  // sur le VRAI `lbc.js`. Julien : « ça me fait télécharger des photos dans mon
  // ordi ça ne met pas la catégorie ni le reste » — les deux sont traités.
  {
    const p6 = await b.newPage({ viewport: { width: 1280, height: 900 } });
    const e6 = []; p6.on('pageerror', (e) => e6.push(e.message));
    let telechargements = 0;
    await p6.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
      const t = r.request().resourceType();
      return (t === 'image' || t === 'font' || t === 'media') ? r.abort() : r.continue();
    });
    await p6.addInitScript((d) => {
      const JPEG = 'ffd8ffe000104a46494600010100000100010000ffd9';
      const b64 = (() => { const bin = JPEG.match(/../g).map(h => String.fromCharCode(parseInt(h, 16))).join(''); return btoa(bin); })();
      window.__dl = 0;
      window.chrome = { runtime: { id: 'banc', lastError: null, sendMessage: (m, cb) => {
        const rep = (o) => { try { cb && cb(o); } catch (_) {} };
        if (m && m.action === 'getPending') return rep({ ok: true, ad: d.ad });
        if (m && m.action === 'photoBytes') return rep({ ok: true, photos: (m.urls || []).map((u) => ({ url: u, b64, type: 'image/jpeg', taille: 22 })) });
        if (m && m.action === 'downloadPhotos') { window.__dl++; return rep({ ok: true, count: 0 }); }
        if (m && m.action === 'getQueue') return rep({ ok: true, queue: [d.ad], removals: [], unlinked: [], postedList: [], stats: { onlineCount: 1, numberedCount: 1 } });
        return rep({ ok: true }); }, onMessage: { addListener() {} } } };
    }, { ad: QUEUE[0] });
    await p6.goto('http://localhost:4491/depot/etape2', { waitUntil: 'domcontentloaded' });
    await p6.addScriptTag({ content: SRC });
    await p6.waitForTimeout(4200);           // surveillance à la seconde + pose 1re photo (700ms) puis groupée (900ms)
    const etat = await p6.evaluate(() => ({
      photos: (document.querySelector('input[name="images"]') || {}).files ? document.querySelector('input[name="images"]').files.length : -1,
      noms: document.querySelector('input[name="images"]') ? [...document.querySelector('input[name="images"]').files].map(f => f.name + ':' + f.type) : [],
      categorie: (document.querySelector('select[name="category"]') || {}).value || '',
      catTexte: (() => { const s2 = document.querySelector('select[name="category"]'); return s2 && s2.selectedIndex >= 0 ? s2.options[s2.selectedIndex].textContent : ''; })(),
      etatSel: (() => { const s2 = document.querySelector('select[name="condition"]'); return s2 && s2.selectedIndex >= 0 ? s2.options[s2.selectedIndex].textContent : ''; })(),
      titre: (document.querySelector('input[name="subject"]') || {}).value || '',
      prix: (document.querySelector('input[name="price_cents"]') || {}).value || '',
      desc: (document.querySelector('textarea[name="body"]') || {}).value || '',
      dl: window.__dl,
      ville: window.__villeChoisie || '',
      bandeau: (document.getElementById('vrm-lbc-banner') || {}).innerText || '',
    }));
    dit(!e6.length, 'aucune erreur sur la page de dépôt', e6[0] || '');
    dit(etat.photos === 3, 'les 3 photos sont ATTACHÉES au champ fichier',
      etat.photos + ' fichier(s) — ' + (etat.noms[0] || 'aucun'));
    dit(/^VRM-401-1\.jpg:image\/jpeg$/.test(etat.noms[0] || ''), 'et elles portent le nom de la paire et le bon type',
      etat.noms[0] || 'aucun');
    dit(etat.dl === 0, 'RIEN n\'est téléchargé sur son ordinateur',
      etat.dl ? 'il y a eu ' + etat.dl + ' téléchargement(s) : c\'est ce dont il se plaint' : '');
    dit(/Chaussures/.test(etat.catTexte || ''), 'la CATÉGORIE est choisie', 'choisi : « ' + etat.catTexte + ' »');
    dit(/état/i.test(etat.etatSel || ''), 'et l\'état aussi', 'choisi : « ' + etat.etatSel + ' »');
    dit(etat.titre === QUEUE[0].title && !!etat.prix && !!etat.desc, 'titre, prix et description sont remplis',
      'titre « ' + etat.titre.slice(0, 24) + ' » · prix ' + etat.prix);
    // ⚠️⚠️ (16 oct.) LE CHAMP `price_cents` PREND DES EUROS : mesuré sur son
    //    dépôt du 15 octobre, il y tape lui-même 2 ou 3 caractères. Nos « 9900 »
    //    affichaient 9 900 € — « un prix au pif ». Le prix Vinted (99,00 €) part
    //    tel quel : « 99 ».
    dit(etat.prix === '99', 'le prix est le MÊME que sur Vinted (99,00 € → « 99 »), pas des centimes',
      'champ price_cents = « ' + etat.prix + ' » (attendu 99)');
    dit(etat.ville === 'Cancale (35260)', 'la localisation est SA ville (Réglages VRM), la commune exacte — pas « Route de Cancale, Saint-Malo »',
      'choisi : « ' + etat.ville + ' »');
    // Le bandeau écrit le CHIFFRE, jamais « c'est prêt ».
    dit(/3 photos attachées/.test(etat.bandeau), 'le bandeau écrit combien de photos ont été attachées',
      (etat.bandeau || '').replace(/\n/g, ' ').slice(0, 90));
    await p6.close();
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  LES MENUS D'ATTRIBUTS REACT (Julien, 19 sept. : « ça ne fait pas la
  //  catégorie tout seul ») — POINTURE + ÉTAT, PAR CLIC SUR L'OPTION
  // ══════════════════════════════════════════════════════════════════════════
  // La vraie forme mesurée : [role=combobox] + [role=option], pas un <select>.
  // On remplit UNIQUEMENT les attributs CERTAINS depuis ses données (pointure =
  // sa taille, état = son état Vinted), par correspondance EXACTE. Une valeur
  // qui ne colle à AUCUNE option est laissée VIDE (mieux vaut un blanc qu'un
  // faux, §5) — c'est le cas de « Satisfaisant » (Vinted) vs « État satisfaisant ».
  const lireCombos = (page) => page.evaluate(() => {
    const coche = [...document.querySelectorAll('input[type=radio][name=cat]')].find((r) => r.checked);
    const lab = coche ? (coche.closest('label') ? coche.closest('label').innerText.trim() : '') : '';
    return {
      pointure: (document.getElementById('cbp') || {}).getAttribute ? (document.getElementById('cbp').getAttribute('data-choisi') || '') : '',
      etat: (document.getElementById('cbe') || {}).getAttribute ? (document.getElementById('cbe').getAttribute('data-choisi') || '') : '',
      marque: (document.getElementById('cbm') || {}).getAttribute ? (document.getElementById('cbm').getAttribute('data-choisi') || '') : '',
      marqueTexte: (document.getElementById('cbm') || {}).value || '',
      marqueTape: (window.__marqueTape || []).length,
      categorie: lab,
      continuer: window.__cont || 0,
      publier: window.__pub || 0,
      livraison: (document.getElementById('livsw') || {}).getAttribute ? document.getElementById('livsw').getAttribute('aria-checked') : '',
      news: !!(document.getElementById('news') || {}).checked,
    };
  });
  const monteCombos = async (ad) => {
    const pg = await b.newPage({ viewport: { width: 1280, height: 900 } });
    const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
    await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => r.abort());
    await pg.addInitScript((d) => {
      window.chrome = { runtime: { id: 'banc', lastError: null, sendMessage: (m, cb) => {
        const rep = (o) => { try { cb && cb(o); } catch (_) {} };
        if (m && m.action === 'getPending') return rep({ ok: true, ad: d.ad });
        if (m && m.action === 'getQueue') return rep({ ok: true, queue: [d.ad], removals: [], unlinked: [], postedList: [], stats: { onlineCount: 1, numberedCount: 1 } });
        return rep({ ok: true }); }, onMessage: { addListener() {} } } };
    }, { ad });
    await pg.goto('http://localhost:4491/depot/etape3', { waitUntil: 'domcontentloaded' });
    await pg.addScriptTag({ content: SRC });
    await pg.waitForTimeout(3200);   // surveillance à la seconde + ouverture des menus
    const r = await lireCombos(pg); r.errs = errs;
    await pg.close();
    return r;
  };
  // ══════════════════════════════════════════════════════════════════════════
  //  DÉTOURAGE : « CONTINUER » ATTEND LES PHOTOS, ET LE BANDEAU COMPTE JUSTE
  // ══════════════════════════════════════════════════════════════════════════
  // Revue adverse du 4 octobre : le fond détoure les photos AVANT de les rendre
  // (jusqu'à 45 s). Pendant ce temps l'enchaînement cliquait « Continuer » :
  // l'étape photo partait SANS photo. Et « dont N détourées » comptait toutes
  // les photos revenues, posées ou non.
  {
    const pg = await b.newPage({ viewport: { width: 1280, height: 900 } });
    const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
    await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => r.abort());
    await pg.addInitScript((d) => {
      const JPEG = 'ffd8ffe000104a46494600010100000100010000ffd9';
      const b64 = (() => { const bin = JPEG.match(/../g).map(h => String.fromCharCode(parseInt(h, 16))).join(''); return btoa(bin); })();
      window.chrome = { runtime: { id: 'banc', lastError: null, sendMessage: (m, cb) => {
        const rep = (o) => { try { cb && cb(o); } catch (_) {} };
        if (m && m.action === 'getPending') return rep({ ok: true, ad: d.ad });
        // 3 s pour rendre les photos (le détourage) ; la 1re revient détourée,
        // la 2e garde son fond (plafond), la 3e est l'affiche du site.
        if (m && m.action === 'photoBytes') { setTimeout(() => rep({ ok: true, photos: (m.urls || []).map((u, i) => ({ url: u, b64, type: 'image/jpeg', taille: 22,
          detoure: i === 0, detourage: i === 0 ? undefined : (i === 1 ? 'plafond' : 'pas-une-photo') })) }), 3000); return; }
        if (m && m.action === 'getQueue') return rep({ ok: true, queue: [d.ad], removals: [], unlinked: [], postedList: [], stats: { onlineCount: 1, numberedCount: 1 } });
        return rep({ ok: true }); }, onMessage: { addListener() {} } } };
    }, { ad: QUEUE[0] });
    await pg.goto('http://localhost:4491/depot/photoscont', { waitUntil: 'domcontentloaded' });
    await pg.addScriptTag({ content: SRC });
    await pg.waitForTimeout(8000);
    const r = await pg.evaluate(() => ({ cont: window.__contAt || [], photos: window.__photoAt || [],
      bandeau: (document.getElementById('vrm-lbc-banner') || {}).innerText || '' }));
    await pg.close();
    dit(!errs.length, 'aucune erreur pendant une attache de photos lente', errs[0] || '');
    dit(r.photos.length >= 1, 'les photos finissent par être posées', r.photos.length + ' photo(s)');
    const premierClic = r.cont.length ? r.cont[0] : null;
    dit(premierClic === null || (r.photos.length && premierClic > r.photos[0]),
      '« Continuer » n’est PAS cliqué avant que les photos soient posées',
      'clics à ' + JSON.stringify(r.cont) + ' ms · photos à ' + JSON.stringify(r.photos) + ' ms');
    const ban = r.bandeau.replace(/\s+/g, ' ');
    const m = ban.match(/dont (\d+) détourée/);
    dit(m && Number(m[1]) === 1, 'le bandeau compte UNE photo détourée (celle qui l’est vraiment)', ban.slice(0, 160));
    dit(/plafond/i.test(ban) && !/n.est pas une photo de la paire/i.test(ban),
      'la raison dite est celle qui compte (le plafond), pas « l’affiche du site »', ban.slice(0, 220));
  }

  {
    // Positif : sa taille (40) et son état (Très bon état) collent → choisis.
    const ok = await monteCombos(QUEUE[0]);
    dit(!ok.errs.length, 'aucune erreur pendant le remplissage des menus', ok.errs[0] || '');
    dit(ok.pointure === '40', 'la POINTURE est choisie dans le combobox React (clic sur l’option)', 'pointure = « ' + ok.pointure + ' »');
    dit(ok.etat === 'Très bon état', 'l’ÉTAT est choisi par correspondance EXACTE', 'état = « ' + ok.etat + ' »');
    // ── LA MARQUE (17 oct.) : tapée, puis choisie dans la liste FILTRÉE ──────
    dit(ok.marque === 'Salomon', 'la MARQUE de la paire est tapée puis choisie dans la liste filtrée (« Salomon »)', 'marque = « ' + ok.marque + ' »');
    dit(/chaussures/i.test(ok.categorie), 'la CATÉGORIE (bouton radio « Mode > Chaussures ») est cochée', 'coché : « ' + ok.categorie + ' »');
    dit(ok.continuer >= 1, 'le bouton « Continuer » est cliqué pour enchaîner l’étape', ok.continuer + ' clic(s)');
    dit(ok.publier === 0, '⚠️ « Publier » n’est JAMAIS cliqué tout seul (§3/§5)', ok.publier + ' clic(s) sur Publier');
    // ── LA LIVRAISON est activée (Julien, 23 sept.) ─────────────────────────
    dit(ok.livraison === 'true', 'l’interrupteur d’ENVOI éteint est rallumé (livraison activée)', 'aria-checked = « ' + ok.livraison + ' »');
    dit(ok.news === false, 'et RIEN d’autre n’est coché — le leurre « offres par email » reste éteint', 'offres par email cochées : ' + ok.news);
    // Négatif : une valeur qui ne colle à AUCUNE option reste VIDE (§5).
    const ko = await monteCombos({ ...QUEUE[0], taille: '99', etat: 'Satisfaisant', marque: 'Nike SB' });
    dit(ko.marque === '' && ko.marqueTexte === '', '« Nike SB » absente de la liste : AUCUNE marque choisie (pas « Nike » à peu près) et le texte tapé est effacé',
      'choisie « ' + ko.marque + ' » · champ « ' + ko.marqueTexte + ' »');
    dit(ko.marqueTape <= 4, 'une marque introuvable n’est pas retapée en boucle (deux essais au plus)', ko.marqueTape + ' frappe(s)');
    dit(ko.pointure === '', 'une pointure absente de la liste n’est PAS choisie (pas de « à peu près »)', 'pointure = « ' + ko.pointure + ' »');
    dit(ko.etat === '', '« Satisfaisant » (≠ « État satisfaisant ») laisse l’état VIDE — mieux vaut un blanc qu’un faux', 'état = « ' + ko.etat + ' »');
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  TOUTES LES PHOTOS SE TÉLÉVERSENT (Julien, 19 sept. : « une seule se
  //  téléverse, ça ne va pas ») — sur un uploader qui n'en prend qu'UNE à la fois
  // ══════════════════════════════════════════════════════════════════════════
  {
    const initChrome = (d) => {
      const JPEG = 'ffd8ffe000104a46494600010100000100010000ffd9';
      const b64 = (() => { const bin = JPEG.match(/../g).map((h) => String.fromCharCode(parseInt(h, 16))).join(''); return btoa(bin); })();
      window.chrome = { runtime: { id: 'banc', lastError: null, sendMessage: (m, cb) => {
        const rep = (o) => { try { cb && cb(o); } catch (_) {} };
        if (m && m.action === 'getPending') return rep({ ok: true, ad: d.ad });
        if (m && m.action === 'photoBytes') return rep({ ok: true, photos: (m.urls || []).map((u) => ({ url: u, b64, type: 'image/jpeg', taille: 22 })) });
        if (m && m.action === 'getQueue') return rep({ ok: true, queue: [d.ad], removals: [], unlinked: [], postedList: [], stats: { onlineCount: 1, numberedCount: 1 } });
        return rep({ ok: true }); }, onMessage: { addListener() {} } } };
    };
    const adPhotos = { ...QUEUE[0], photos: ['https://ex/a1.jpg', 'https://ex/a2.jpg', 'https://ex/a3.jpg'] };

    // 1) §6.1 — LE DÉFAUT : un envoi GROUPÉ ne dépose qu'UNE vignette sur cet
    //    uploader (c'est ce que Julien voit). On le prouve à la main.
    const pbulk = await b.newPage({ viewport: { width: 1200, height: 900 } });
    await pbulk.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => r.abort());
    await pbulk.goto('http://localhost:4491/depot/photos1', { waitUntil: 'domcontentloaded' });
    const nBulk = await pbulk.evaluate(() => {
      const uf = document.getElementById('uf');
      const dt = new DataTransfer();
      ['a', 'b', 'c'].forEach((x) => dt.items.add(new File([new Uint8Array([255, 216, 255])], 'VRM-401-' + x + '.jpg', { type: 'image/jpeg' })));
      uf.files = dt.files; uf.dispatchEvent(new Event('change', { bubbles: true }));
      return document.querySelectorAll('#previews img').length;
    });
    dit(nBulk === 1, '§6.1 — un envoi GROUPÉ ne dépose qu’UNE vignette sur cet uploader (le défaut)', nBulk + ' vignette(s)');
    await pbulk.close();

    // 2) LE CORRECTIF : l'extension pose les photos UNE PAR UNE → les 3 arrivent.
    const pseq = await b.newPage({ viewport: { width: 1200, height: 900 } });
    const eseq = []; pseq.on('pageerror', (e) => eseq.push(e.message));
    await pseq.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => r.abort());
    await pseq.addInitScript(initChrome, { ad: adPhotos });
    await pseq.goto('http://localhost:4491/depot/photos1', { waitUntil: 'domcontentloaded' });
    await pseq.addScriptTag({ content: SRC });
    await pseq.waitForTimeout(5000);   // pose séquentielle + attentes entre photos
    const nSeq = await pseq.evaluate(() => document.querySelectorAll('#previews img').length);
    dit(!eseq.length, 'aucune erreur pendant le téléversement des photos', eseq[0] || '');
    dit(nSeq === 3, 'les 3 photos sont téléversées (une par une, sur un uploader qui n’en prend qu’une)', nSeq + ' vignette(s) sur 3');
    await pseq.close();

    // 3) ⚠️⚠️ LE VRAI CAS LEBONCOIN (mesuré 20 sept.) : champ `multiple` MAIS
    //    upload-à-chaque-change + vignettes http (pas blob). C'est ce qui donnait
    //    « il n'y a qu'une seule photo » : l'ancien code partait en envoi groupé
    //    (car multiple) et se croyait fini (compteur blob aveugle = 0).
    //    §6.1 : sur le code d'AVANT, une seule vignette arrive ; APRÈS, les trois.
    const preel = await b.newPage({ viewport: { width: 1200, height: 900 } });
    const ereel = []; preel.on('pageerror', (e) => ereel.push(e.message));
    await preel.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => r.abort());
    await preel.addInitScript(initChrome, { ad: adPhotos });
    await preel.goto('http://localhost:4491/depot/photosreel', { waitUntil: 'domcontentloaded' });
    await preel.addScriptTag({ content: SRC });
    await preel.waitForTimeout(6000);
    const reel = await preel.evaluate(() => ({
      vignettes: document.querySelectorAll('#previews img[src^="http"]').length,
      bandeau: (document.getElementById('vrm-lbc-banner') || {}).innerText || '',
    }));
    dit(!ereel.length, 'aucune erreur sur le vrai uploader Leboncoin', ereel[0] || '');
    dit(reel.vignettes === 3, 'les 3 photos arrivent sur le VRAI uploader (multiple + upload-à-chaque-change, vignettes http)',
      reel.vignettes + ' vignette(s) sur 3');
    // Le bandeau ne MENT pas : vignettes non comptables ⇒ « envoyées » + vérifie,
    // jamais un « X/Y attachées » qu'on ne peut pas prouver.
    dit(/envoy[ée]e?s? au formulaire/i.test(reel.bandeau) && /v[ée]rifie/i.test(reel.bandeau),
      'le bandeau dit « envoyées — vérifie » quand il ne peut pas compter les vignettes',
      (reel.bandeau || '').replace(/\n/g, ' ').slice(0, 110));
    await preel.close();

    // 4) ⚠️⚠️ PUBLIER SANS BOOSTER (Julien, 20 sept. : « c'est toi qui appuies
    //    sur publier sans booster »). L'étape options ne porte que des cases de
    //    boost PAYANTES : on les décoche TOUTES, on clique le dépôt GRATUIT,
    //    JAMAIS le payant. §6.1 par réaffaiblissement (retirer la garde « prix »).
    const adPub = { ...QUEUE[0], publier: true, photos: ['https://ex/a1.jpg', 'https://ex/a2.jpg', 'https://ex/a3.jpg'] };
    const lancerBoost = async (srcJs) => {
      const pg = await b.newPage({ viewport: { width: 1200, height: 900 } });
      const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
      await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => r.abort());
      await pg.addInitScript(initChrome, { ad: adPub });
      await pg.goto('http://localhost:4491/depot/boost', { waitUntil: 'domcontentloaded' });
      await pg.addScriptTag({ content: srcJs });
      await pg.waitForTimeout(9000);
      const r = await pg.evaluate(() => ({
        pub: window.__pub, paid: window.__paid,
        coches: [...document.querySelectorAll('fieldset input[type=checkbox]')].filter((c) => c.checked).map((c) => c.name),
        bandeau: (document.getElementById('vrm-lbc-banner') || {}).innerText || '',
      }));
      await pg.close(); return { r, errs };
    };
    {
      const { r, errs } = await lancerBoost(SRC);
      dit(!errs.length, 'aucune erreur pendant la publication sans booster', errs[0] || '');
      dit(r.coches.length === 0, 'TOUTES les options de boost sont décochées (jamais de dépense)', 'restées cochées : ' + (r.coches.join(',') || 'aucune'));
      dit(r.pub === 1, 'le bouton de dépôt GRATUIT est cliqué une fois', '__pub=' + r.pub);
      dit(r.paid === 0, 'le bouton PAYANT (9,90 €) n\'est JAMAIS cliqué', '__paid=' + r.paid);
      dit(/sans booster/i.test(r.bandeau), 'le bandeau dit « publiée sans booster »', (r.bandeau || '').replace(/\n/g, ' ').slice(-70));
    }
    {
      const faible = SRC.replace('if (PRIX.test(libBtn(b))) return false;', 'if (false) return false;').replace('&& !PRIX.test(t) &&', '&&');
      if (faible === SRC) dit(false, 'la garde « prix » attendue est introuvable — l\'audit ne prouve rien');
      else { const { r } = await lancerBoost(faible); dit(r.paid >= 1, '§6.1 — sans la garde « prix », le bouton PAYANT EST cliqué (donc la garde protège de la dépense)', '__paid=' + r.paid + ' __pub=' + r.pub); }
    }
    // 5) ⚠️ DEVINER LE BOUTON DU BAS (Julien, 20 sept. : « il est tout en bas ; même
    //    si tu ne l'as pas, essaie de le deviner »). Sur une étape SANS libellé
    //    « Publier », on clique le bouton le PLUS BAS qui n'est ni à prix, ni
    //    « annuler/retour », ni « continuer » — la garde argent tient en devinant.
    {
      const pg = await b.newPage({ viewport: { width: 1200, height: 900 } });
      const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
      await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => r.abort());
      await pg.addInitScript(initChrome, { ad: adPub });
      await pg.goto('http://localhost:4491/depot/basdepage', { waitUntil: 'domcontentloaded' });
      await pg.addScriptTag({ content: SRC });
      await pg.waitForTimeout(9000);
      const r = await pg.evaluate(() => ({ fin: window.__fin, paidx: window.__paidx, annx: window.__annx, prev: document.querySelectorAll('#previews img').length, gallery: !!document.querySelector('input[name=gallery]:checked'), banner: (document.getElementById('vrm-lbc-banner') || {}).innerText || '' }));
      await pg.close();
      dit(r.fin === 1, 'sans libellé « Publier », le bouton le PLUS BAS (« Terminer ») est cliqué', '__fin=' + r.fin + ' prev=' + r.prev + ' gallery_encore_cochee=' + r.gallery + ' | ' + (r.banner || '').replace(/\n/g, ' ').slice(0, 70));
      dit(r.paidx === 0, 'le bouton à PRIX (9,90 €) reste JAMAIS cliqué, même en devinant', '__paidx=' + r.paidx);
      dit(r.annx === 0, '« Annuler » n\'est pas pris pour « Publier » (garde NEG)', 'ann=' + r.annx);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  LEBONCOIN ÉCRIT PARFOIS LA DESCRIPTION LUI-MÊME (Julien, 19 sept.)
  // ══════════════════════════════════════════════════════════════════════════
  // On ne l'écrase JAMAIS — mais la référence VRM-{n°} doit y être (§5). Le banc
  // pré-remplit la description AVANT que l'extension tourne (comme le ferait
  // l'auto-remplissage de Leboncoin), sans la référence, et exige les deux :
  // le texte de Leboncoin est GARDÉ, et la référence a été AJOUTÉE.
  {
    const pd = await b.newPage({ viewport: { width: 1280, height: 900 } });
    const ed = []; pd.on('pageerror', (e) => ed.push(e.message));
    await pd.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
      const t = r.request().resourceType();
      return (t === 'image' || t === 'font' || t === 'media') ? r.abort() : r.continue();
    });
    await pd.addInitScript((d) => {
      window.chrome = { runtime: { id: 'banc', lastError: null, sendMessage: (m, cb) => {
        const rep = (o) => { try { cb && cb(o); } catch (_) {} };
        if (m && m.action === 'getPending') return rep({ ok: true, ad: d.ad });
        if (m && m.action === 'photoBytes') return rep({ ok: true, photos: [] });
        if (m && m.action === 'getQueue') return rep({ ok: true, queue: [d.ad], removals: [], unlinked: [], postedList: [], stats: { onlineCount: 1, numberedCount: 1 } });
        return rep({ ok: true }); }, onMessage: { addListener() {} } } };
    }, { ad: QUEUE[0] });
    await pd.goto('http://localhost:4491/depot/etape2', { waitUntil: 'domcontentloaded' });
    const AUTO = 'Superbe paire, taille 40, portée deux fois. Envoi rapide et soigné.';
    await pd.evaluate((txt) => {
      const el = document.querySelector('textarea[name="body"]');
      const set = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      set.call(el, txt); el.dispatchEvent(new Event('input', { bubbles: true }));
    }, AUTO);
    await pd.addScriptTag({ content: SRC });
    await pd.waitForTimeout(2600);
    const desc = await pd.evaluate(() => (document.querySelector('textarea[name="body"]') || {}).value || '');
    dit(desc.includes(AUTO), 'la description écrite par Leboncoin n\'est PAS écrasée',
      '« ' + desc.replace(/\n/g, ' ').slice(0, 70) + ' »');
    dit(/VRM-401/.test(desc), 'et la référence VRM-401 y est quand même AJOUTÉE (le lien vers la paire, §5)',
      /VRM-401/.test(desc) ? '' : 'la réf a disparu : « vendue → retire-la » ne reconnaîtra plus l\'annonce');
    dit(!ed.length, 'aucune erreur sur ce cas', ed[0] || '');
    await pd.close();
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  5.182 — LA FICHE DE L'APP : ce qu'il a corrigé dans VRM est POSÉ, et la page
  //  raconte son avancement à l'app (`depotProgres`)
  // ══════════════════════════════════════════════════════════════════════════
  // La paire arrive avec `titreEdite` / `descriptionEditee` / `prixEdite` (posés
  // par le fond après avoir revérifié la fiche). Sa description CORRIGÉE passe
  // devant celle que Leboncoin a écrite (c'est son choix explicite, fait dans la
  // fiche) ; sans fiche, la règle d'avant tient (bloc juste au-dessus).
  {
    const pf = await b.newPage({ viewport: { width: 1280, height: 900 } });
    const ef = []; pf.on('pageerror', (e) => ef.push(e.message));
    await pf.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => r.abort());
    const AD_FICHE = { ...QUEUE[0], title: 'Salomon XT-6 Wings blanc taille 40', description: 'Ma description à moi.\n\nRéf. VRM-401', price: '87.5', edite: true, titreEdite: true, descriptionEditee: true, prixEdite: true, publier: true };
    await pf.addInitScript((d) => {
      window.__envoyes = [];
      window.chrome = { runtime: { id: 'banc', lastError: null, getManifest: () => ({ version: '9.9.9' }), sendMessage: (m, cb) => {
        const rep = (o) => { try { cb && cb(o); } catch (_) {} };
        window.__envoyes.push(JSON.parse(JSON.stringify(m || {})));
        if (m && m.action === 'getPending') return rep({ ok: true, ad: d.ad });
        if (m && m.action === 'photoBytes') return rep({ ok: true, photos: [] });
        return rep({ ok: true }); }, onMessage: { addListener() {} } } };
    }, { ad: AD_FICHE });
    await pf.goto('http://localhost:4491/depot/etape2', { waitUntil: 'domcontentloaded' });
    await pf.evaluate(() => {
      const fixe = (sel, txt) => { const el = document.querySelector(sel); const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, txt); el.dispatchEvent(new Event('input', { bubbles: true })); };
      fixe('textarea[name="body"]', 'Texte écrit par Leboncoin tout seul.');
      fixe('input[name="price_cents"]', '120');
    });
    await pf.addScriptTag({ content: SRC });
    await pf.waitForTimeout(2600);
    const v = await pf.evaluate(() => ({
      titre: document.querySelector('input[name="subject"]').value,
      desc: document.querySelector('textarea[name="body"]').value,
      prix: document.querySelector('input[name="price_cents"]').value,
      progres: window.__envoyes.filter((m) => m.action === 'depotProgres'),
    }));
    dit(v.titre === AD_FICHE.title, 'fiche : le TITRE corrigé dans VRM est posé', v.titre);
    dit(v.desc === AD_FICHE.description, 'fiche : la DESCRIPTION corrigée passe devant celle que Leboncoin a écrite (son choix, fait dans la fiche)', v.desc.replace(/\n/g, ' ').slice(0, 60));
    dit(/^87[,.]5/.test(v.prix), 'fiche : le PRIX corrigé remplace celui que Leboncoin proposait', v.prix);
    dit(v.progres.length >= 1 && v.progres.every((m) => String(m.id) === '1001' && m.progres && m.progres.etape), 'la page RACONTE son avancement à l’app (`depotProgres`, pour CETTE paire)', JSON.stringify(v.progres.map((m) => m.progres.etape)));
    dit(!JSON.stringify(v.progres).includes('Ma description'), 'et l’avancement ne transporte aucun contenu saisi');
    // Il corrige lui-même sur la page : on ne lutte pas (au plus 3 poses).
    for (let i = 0; i < 5; i++) {
      await pf.evaluate(() => { const el = document.querySelector('textarea[name="body"]'); Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(el, 'Corrigé sur la page.'); el.dispatchEvent(new Event('input', { bubbles: true })); });
      await pf.waitForTimeout(1100);
    }
    const garde = await pf.evaluate(() => document.querySelector('textarea[name="body"]').value);
    dit(/^Corrigé sur la page\./.test(garde), 'une correction faite SUR la page finit par être respectée (VRM ne lutte pas sans fin)', garde.replace(/\n/g, ' ').slice(0, 60));
    dit(!ef.length, 'aucune erreur de page (fiche)', ef[0] || '');
    await pf.close();
  }
  {
    const po = await b.newPage({ viewport: { width: 1280, height: 900 } });
    await po.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => r.abort());
    await po.addInitScript((d) => {
      window.__envoyes = [];
      window.chrome = { runtime: { id: 'banc', lastError: null, getManifest: () => ({ version: '9.9.9' }), sendMessage: (m, cb) => {
        const rep = (o) => { try { cb && cb(o); } catch (_) {} };
        window.__envoyes.push(JSON.parse(JSON.stringify(m || {})));
        if (m && m.action === 'getPending') return rep({ ok: true, ad: d.ad });
        return rep({ ok: true }); }, onMessage: { addListener() {} } } };
    }, { ad: { ...QUEUE[0], photos: [] } });
    await po.goto('http://localhost:4491/depot/obligatoire', { waitUntil: 'domcontentloaded' });
    await po.addScriptTag({ content: SRC });
    await po.waitForTimeout(9000);
    const manque = await po.evaluate(() => window.__envoyes.filter((m) => m.action === 'depotProgres' && m.progres && m.progres.etape === 'champ-manquant').map((m) => m.progres.manque));
    dit(manque.length >= 1 && JSON.stringify(manque[manque.length - 1]) === '["Univers"]', 'un champ obligatoire que VRM ne devine pas : l’app apprend LEQUEL (« Univers »)', JSON.stringify(manque));
    await po.close();
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  LES ÉTAPES DU DÉPÔT — le seul code qui puisse me donner la carte
  // ══════════════════════════════════════════════════════════════════════════
  // ⚠️⚠️ CE CODE N'A JAMAIS TOURNÉ, ET C'EST UNE CHANCE UNIQUE. `lbc_recon.etapes`
  //    est absente de sa base : le jour où il fait UN dépôt à la main avec une
  //    extension à jour, soit l'enregistreur marche et j'ai la carte complète du
  //    formulaire (où vivent la catégorie, l'état, le champ photo), soit il ne
  //    marche pas et on ne le saura qu'après. §4.10.
  // ⚠️⚠️ ET IL NE POUVAIT PAS MARCHER : `captureDepositForm()` ne tournait que
  //    dans `load()` — au démarrage, au retour sur l'onglet, et quand l'ADRESSE
  //    change. Or un assistant remplace l'étape SUR PLACE. Les étapes 2, 3, 4…
  //    étaient donc invisibles : exactement ce pour quoi ce code existe.
  {
    const p7 = await b.newPage({ viewport: { width: 1280, height: 900 } });
    const e7 = []; p7.on('pageerror', (e) => e7.push(e.message));
    await p7.addInitScript((d) => {
      window.__formes = [];                      // tout ce qui part vers le fond
      // §6.3 dans mon propre banc : sans `getManifest`, l'extension ne peut pas
      // estampiller sa version et le contrôle sortait rouge sur un code intact.
      window.chrome = { runtime: { id: 'banc', lastError: null, getManifest: () => ({ version: '9.9.9' }), sendMessage: (m, cb) => {
        if (m && m.action === 'lbcForm') window.__formes.push(m);
        const rep = (o) => { try { cb && cb(o); } catch (_) {} };
        if (m && m.action === 'getQueue') return rep({ ok: true, queue: d.queue, removals: [], unlinked: [], postedList: [], stats: {} });
        return rep({ ok: true });
      }, onMessage: { addListener() {} } } };
    }, { queue: QUEUE });
    await p7.goto('http://localhost:4491/depot', { waitUntil: 'domcontentloaded' });
    await p7.addScriptTag({ content: SRC });
    await p7.waitForTimeout(1400);
    const apres1 = await p7.evaluate(() => window.__formes.length);
    dit(apres1 >= 1, 'la première étape du dépôt est enregistrée', apres1 + ' étape(s)');

    // L'ÉTAPE SUIVANTE, comme le fait Leboncoin : on remplace le contenu du
    // formulaire SANS toucher à l'adresse.
    // ⚠️⚠️ ET CETTE ÉTAPE-CI N'A **AUCUN `<select>` NATIF** — c'est le point que
    //    Julien a soulevé (« c'est différent pour chaque annonce ») poussé au
    //    bout : Leboncoin est une application React, ses listes sont des
    //    COMPOSANTS (`role="combobox"` + `role="listbox"`). Servir un vrai
    //    `<select>` rendait le banc VERT sur le défaut — on rapportait « 0
    //    liste », donc ni catégorie, ni état, ni pointure : exactement ce qu'on
    //    vient chercher. §6.3, sur la forme de la PAGE cette fois.
    await p7.evaluate(() => {
      document.querySelector('main').innerHTML =
        '<nav aria-label="Fil d\u2019ariane">Accueil › Mode › Chaussures</nav>'
        + '<label for="p2">Prix</label><input id="p2" name="price" type="text">'
        + '<span id="lblcat">Catégorie</span>'
        + '<div role="combobox" aria-labelledby="lblcat" aria-haspopup="listbox" aria-controls="listecat" data-qa-id="category_picker">Chaussures</div>'
        + '<div id="listecat" role="listbox"><div role="option">Vêtements</div><div role="option">Chaussures</div><div role="option">Sacs</div></div>'
        + '<label for="f2">Photos</label><input id="f2" name="images" type="file" multiple>'
        // ── LA LIVRAISON : composants React (pas des <input>), c'est pour ça
        //    que la capture les manquait. On sert la vraie forme mesurée :
        //    un interrupteur « Proposer la livraison » (éteint) + un choix
        //    Colissimo, avec une VALEUR de poids saisie qui ne doit PAS fuiter.
        + '<span id="lbllvr">Mode d’envoi</span>'
        + '<div role="switch" aria-checked="false" aria-label="Proposer la livraison" data-qa-id="shipping_toggle">Proposer la livraison</div>'
        + '<div role="checkbox" aria-checked="false" aria-label="Colissimo" data-qa-id="shipping_colissimo">Colissimo</div>'
        + '<input name="estimated_parcel_weight" type="text" value="1500" aria-label="Poids du colis (g)">';
    });
    await p7.waitForTimeout(1800);
    const etapes = await p7.evaluate(() => window.__formes.map((m) => ({
      etape: m.etape, champs: (m.fields || []).map((f) => f.name), selects: (m.selects || []).length, fichiers: m.fichiers,
      // Ce qui ne doit JAMAIS partir : une valeur saisie.
      valeurs: JSON.stringify(m).match(/"value"/g) || [],
    })));
    dit(etapes.length >= 2, 'une étape qui arrive SANS changer d’adresse est enregistrée aussi',
      etapes.length + ' étape(s) : ' + etapes.map((e) => e.champs.join('+')).join(' | '));
    dit(new Set(etapes.map((e) => e.etape)).size === etapes.length,
      'et chaque étape a sa propre signature — la suivante n’écrase pas la précédente',
      etapes.map((e) => String(e.etape).slice(0, 30)).join(' | '));
    const derniere = etapes[etapes.length - 1] || {};
    dit(derniere.selects >= 1 && derniere.fichiers >= 1,
      'l’étape rapporte les listes déroulantes ET le champ photo — c’est là que vivent la catégorie et les images',
      `${derniere.selects} liste(s), ${derniere.fichiers} champ(s) fichier`);
    // ⚠️ « C'EST DIFFÉRENT POUR CHAQUE ANNONCE » : sans la CATÉGORIE, un champ
    //    « Pointure » ne dit pas sur quel chemin il vit — et on le remplirait
    //    sur le formulaire d'un livre. Et sans le rang ni le dépôt, deux
    //    annonces se mélangent.
    const brut = await p7.evaluate(() => window.__formes[window.__formes.length - 1] || {});
    dit(/chaussure/i.test(String(brut.categorie || '')),
      'et elle DIT dans quelle catégorie elle a été vue', `catégorie : « ${String(brut.categorie || '').slice(0, 60) || '(vide)'} »`);
    // ── LA LIVRAISON (Julien 23 sept. : « active la livraison ») ────────────
    // Les contrôles d'envoi sont des composants React que la capture manquait.
    // On EXIGE qu'ils soient relevés (libellé + état coché), pour câbler
    // « livraison ON » à coup sûr la prochaine passe — sans deviner le poids.
    const liv = Array.isArray(brut.livraison) ? brut.livraison : [];
    const libLiv = liv.map((x) => String(x.label || '')).join(' | ').toLowerCase();
    dit(/livraison|colissimo|envoi/.test(libLiv),
      'l’étape RELÈVE les contrôles de livraison — je saurai les activer', `livraison: ${liv.length} contrôle(s) — ${liv.map((x) => x.label).join(', ').slice(0, 80) || '(aucun)'}`);
    dit(liv.some((x) => /faux|false|non/i.test(String(x.checked)) || x.checked === '' || x.checked === 'false'),
      'et leur ÉTAT (ici : éteint) est relevé — c’est ce qui prouve qu’il faut l’activer', `états : ${liv.map((x) => x.label + '=' + x.checked).join(', ').slice(0, 90)}`);
    // ⚠️ Le POIDS saisi (1500 g) ne doit JAMAIS partir — un poids faux coûte de
    //    l'argent, et de toute façon on ne stocke aucune valeur (§ promesse).
    dit(!/1500/.test(JSON.stringify(brut)),
      'la VALEUR de poids saisie ne fuite pas — on relève la structure, jamais le contenu');
    dit(!!brut.depot && Number(brut.ordre) >= 2,
      'chaque étape porte son dépôt et son RANG — deux annonces ne se mélangent pas',
      `dépôt ${brut.depot || '—'} · étape n°${brut.ordre || '—'}`);
    const choisi = (brut.selects || []).map((x) => x.choisi).filter(Boolean).join(', ');
    dit(/chaussure/i.test(choisi), 'et la valeur CHOISIE dans la liste est rapportée', `choisi : « ${choisi || '(rien)'} »`);
    const formes = (brut.selects || []).map((x) => x.forme);
    dit(formes.includes('composant'), 'y compris quand la liste n’est PAS un `<select>` natif', `formes vues : ${formes.join(', ') || 'aucune'}`);
    const opts = (brut.selects || []).flatMap((x) => x.options || []);
    dit(opts.some((o) => /vêtements|sacs/i.test(o)), 'avec les options proposées', `${opts.length} option(s)`);

    // Le témoin d'étape à l'écran est retiré (5.130 : aucune information sur la
    // page en dehors de la carte VRM). L'étape, elle, est toujours ENREGISTRÉE.

    // ⚠️⚠️ ET LE SHADOW DOM : une application moderne peut y enfermer son
    //    formulaire. `querySelectorAll` ne le traverse pas — on chercherait dans
    //    une page vide sans le savoir. Même « 0 liste » que les composants, mais
    //    SILENCIEUX.
    // ══════════════════════════════════════════════════════════════════════
    // ⚠️⚠️ LE BRUIT QU'IL A VRAIMENT RENCONTRÉ — SANS LUI, LE BANC EST VERT
    // ══════════════════════════════════════════════════════════════════════
    // Mesuré sur son VRAI dépôt du 17 septembre : sur trois étapes
    // enregistrées, deux ne portaient que `high-contrast-toggle`,
    // `search-header-mobile-input`, `search-header-extendable-input` et une
    // volée de champs cachés `id, ev, dl, rl, if, ts, iw, sw, sh, v, r`. Les
    // quatre « listes » étaient la barre de recherche (« Valider votre
    // recherche »). Le vrai formulaire n'a jamais été enregistré : le bruit
    // changeait la signature et consommait les places.
    // Le banc sert donc cet en-tête-là, avec le vrai formulaire dessous.
    await p7.evaluate(() => {
      document.body.insertAdjacentHTML('afterbegin',
        '<header role="banner"><input id="high-contrast-toggle" type="checkbox">'
        + '<form action="/recherche" role="search"><input name="search-header-mobile-input"><input name="search-header-extendable-input">'
        + '<div role="combobox" aria-label="rech">Valider votre recherche</div></form></header>'
        + '<input type="hidden" name="id"><input type="hidden" name="ev"><input type="hidden" name="dl"><input type="hidden" name="ts">');
      document.querySelector('main').innerHTML =
        '<label for="pr">Prix</label><input id="pr" name="price" type="text">'
        + '<span id="lbe">État</span><div role="combobox" aria-labelledby="lbe" aria-controls="le">Très bon état</div>'
        + '<div id="le" role="listbox"><div role="option" data-value="5">Neuf</div><div role="option" data-value="3">Très bon état</div></div>'
        + '<input name="photos" type="file">';
    });
    await p7.waitForTimeout(1800);
    const propre = await p7.evaluate(() => window.__formes[window.__formes.length - 1] || {});
    const noms = (propre.fields || []).map((f) => f.name || f.id);
    dit(!noms.some((n) => /high-contrast|search-header/.test(String(n))),
      'l’en-tête du site n’est PAS pris pour une étape du dépôt',
      `champs retenus : ${noms.join(', ') || 'aucun'}`);
    dit(!noms.some((n) => ['id', 'ev', 'dl', 'ts'].includes(String(n))),
      'ni les champs cachés de pistage');
    dit(noms.includes('price') && noms.includes('photos'),
      'et le VRAI formulaire est bien là', `champs : ${noms.join(', ')}`);
    const lbl = (propre.selects || []).map((x) => x.choisi).join(' ');
    dit(!/valider votre recherche/i.test(lbl) && /très bon état/i.test(lbl),
      'la barre de recherche n’est pas comptée comme une liste du dépôt', `listes : « ${lbl} »`);
    dit(!!propre.ver, 'et l’étape porte la VERSION de l’extension qui l’a écrite', `ver ${propre.ver || '—'}`);
    // ⚠️ Le CODE de chaque option (jamais capté avant) : Leboncoin soumet un
    //    code, pas le libellé. Sans lui la passe qui remplira Pointure/État ne
    //    peut que deviner. On relève le code réel de SA page.
    const codes = (propre.selects || []).flatMap((x) => x.optcodes || []);
    dit(codes.some((o) => o.t === 'Très bon état' && o.v === '3'),
      'et le CODE de chaque option est relevé (pas seulement son libellé)',
      `optcodes : ${codes.map((o) => o.t + '=' + (o.v || '∅')).join(', ') || 'aucun'}`);

    // La page de FIN n'est pas une étape : elle a fourni deux des trois étapes
    // enregistrées chez lui, et rien d'utilisable.
    const avantFin = await p7.evaluate(() => window.__formes.length);
    await p7.evaluate(() => { history.pushState({}, '', '/deposer-une-annonce/confirmation'); document.querySelector('main').innerHTML = '<input name="autre">'; });
    await p7.waitForTimeout(1800);
    const apresFin = await p7.evaluate(() => window.__formes.length);
    dit(apresFin === avantFin, 'la page de confirmation n’est pas enregistrée comme une étape',
      `${avantFin} → ${apresFin}`);
    await p7.evaluate(() => history.pushState({}, '', '/depot'));

    await p7.evaluate(() => {
      document.querySelector('main').innerHTML = '<div id="hote"></div>';
      const h = document.getElementById('hote').attachShadow({ mode: 'open' });
      h.innerHTML = '<span id="lbp">Pointure</span>'
        + '<div role="combobox" aria-labelledby="lbp" aria-controls="lp">42</div>'
        + '<div id="lp" role="listbox"><div role="option">41</div><div role="option">42</div></div>'
        + '<input name="shoe_size" type="text"><input name="photos" type="file">';
    });
    await p7.waitForTimeout(1800);
    const dansOmbre = await p7.evaluate(() => window.__formes[window.__formes.length - 1] || {});
    dit((dansOmbre.fields || []).some((f) => f.name === 'shoe_size'),
      'un formulaire enfermé dans le SHADOW DOM est vu quand même',
      `${(dansOmbre.fields || []).length} champ(s) : ${(dansOmbre.fields || []).map((f) => f.name).join(', ') || 'aucun'}`);
    dit((dansOmbre.selects || []).length >= 1 && (dansOmbre.fichiers || 0) >= 1,
      'et ses listes et son champ photo aussi',
      `${(dansOmbre.selects || []).length} liste(s), ${dansOmbre.fichiers} champ(s) fichier`);
    // ⚠️ La promesse écrite dans le code : « noms de champs et libellés
    //    d'options uniquement : AUCUN contenu saisi ». Elle n'avait jamais été
    //    vérifiée — et c'est une promesse de confidentialité.
    await p7.evaluate(() => { const i = document.querySelector('input[name="price"]'); if (i) { i.value = 'SECRET-42'; i.dispatchEvent(new Event('input', { bubbles: true })); } });
    await p7.waitForTimeout(1600);
    const fuite = await p7.evaluate(() => JSON.stringify(window.__formes).includes('SECRET-42'));
    dit(!fuite, 'et aucune valeur saisie ne part avec la structure');
    dit(!e7.length, 'aucune erreur pendant l’enregistrement des étapes', e7[0] || '');
    await p7.close();
  }

  await b.close(); srv.close();
  console.log(ko ? `\n${ko} contrôle(s) non conforme(s).` : '\nLe panneau Leboncoin dit ce qu\'il sait, et seulement ce qu\'il sait.');
  process.exit(ko ? 1 : 0);
})();
