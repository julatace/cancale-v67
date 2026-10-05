// ═══════════════════════════════════════════════════════════════════════════
// BANC : « À EXPÉDIER » DIT LA MÊME CHOSE PARTOUT, ET CHAQUE STATUT A LE BON MOT
//        (node scripts/bancs/statuts-colis.cjs — après `npm run build`)
// ═══════════════════════════════════════════════════════════════════════════
// Mesuré le 4 octobre : pour 3 colis réels à poster, Colis en comptait 2, Ma
// journée 3, la cloche 3 et le widget 6 ; « Bordereau envoyé au vendeur » (un
// colis qu'il doit ENCORE poster) s'affichait « En transit » sur les Ventes, et
// « colis déposé en point relais » s'affichait « Livrée » (le mot
// « livraison »), côté ventes comme côté achats. La règle unique est
// `aExpedier(o)` (le champ machine `transaction_user_status` d'abord).
//
// Ce banc rend l'app sur UN compte INVENTÉ (aucune fixture : il vit dans le
// dépôt, qui est public) et neuf ventes qui couvrent les libellés réels :
//   9101 « Bordereau envoyé au vendeur »             needs_action, sans bordereau
//   9102 « Bordereau d'envoi commandé »              needs_action, bordereau email + PDF
//   9103 « Le paiement a été validé »                needs_action, coché « posté » (nuage)
//   9104 « …colis déposé en bureau de Poste ou point relais »  waiting
//   9105 « Commande expédiée et en cours d'acheminement ! »    waiting
//   9106 « Commande non réclamée - Retournée à l'expéditeur.rice »  waiting
//   9107 « Commande finalisée - l'acheteur a validé la commande »   completed
//   9108 « Le paiement a échoué »                    failed
//   9109 « Retour initié »                            waiting (la paire REVIENT)
// et un ACHAT déposé en point relais (needs_action côté acheteur = « va le
// retirer », jamais « reçu »).
//
// Il exige, aux deux tailles (390 px tactile et 1512 px) :
//   1. Colis : exactement 2 cartes à poster (9101, 9102), le compteur du haut
//      dit 2, 9102 est dans le groupe « prêt à imprimer » ; 9103 (posté) n'est
//      ni une carte ni compté ;
//   2. Ma journée : « Expédier N colis » vaut 2, et le nombre PUBLIÉ pour la
//      cloche (`vrm_colis_aposter.total`) aussi ;
//   3. la cloche annonce 2 ventes à expédier — après Ma journée (nombre publié)
//      ET sur un appareil neuf ouvert sur le tableau de bord (repli, sans
//      publication), où le nuage — qui porte « colis posté » — arrive APRÈS
//      les ventes. ⚠️ Premier passage : la cloche y disait 3 et ne se
//      recalculait jamais (son effet n'attendait pas le nuage, §5.49) ;
//   4. Ventes : le filtre « À expédier » montre exactement 9101 et 9102 (et
//      leurs boutons de bordereau portent ces transactions) ; « En transit »
//      contient 9104, 9105, 9106 et jamais 9101, 9102, 9107, 9108 ; chaque
//      vente est dans UN SEUL des quatre filtres (À expédier · En transit ·
//      Finalisées · Annulées) et « Toutes » = tout sauf les annulées ; 9101
//      porte « À expédier », jamais « En transit » ; 9104 « Au relais », jamais
//      « Livrée » ; 9106 ni « Remboursée » ni « Annulée » ; et l'étiquette ne
//      contredit jamais le filtre qui montre la ligne (9103, cochée « posté »,
//      sous « En transit » portait encore « À expédier » au premier passage).
//      ⚠️ Premier passage sur le travail des statuts : 9106 (non réclamée, le
//      colis REVIENT) n'était que dans « Annulées » — `classifyOrderStatus` la
//      range en « cancelled » à cause du mot « Retourn… », juste pour l'argent
//      mais faux pour un filtre de colis. Corrigé dans le filtre seul ;
//   5. Achats : l'achat au relais porte « À retirer », jamais « Reçu » ;
//   6. aucun débordement horizontal, aucune erreur de page, aucun écran tombé
//      sur le garde-fou.
// On juge les ATTRIBUTS (`data-bord-card`, `data-groupe`, `data-tx`,
// `data-bouton-bord`) et les NOMBRES rendus. Les libellés d'étape ne sont lus
// que là où le libellé EST la chose vérifiée (l'étape affichée d'une vente).
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = 4351;

const MAINTENANT = Date.now();
const ilYa = (j, h = 0) => new Date(MAINTENANT - j * 86400000 - h * 3600000).toISOString();
const dansJ = (j) => { const d = new Date(MAINTENANT + j * 86400000); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`; };

// Titres INVENTÉS, chacun unique : ils servent à retrouver la ligne rendue
// (une donnée que le banc sert, pas une formulation de l'app).
const V = {
  9101: { titre: 'Alpha Runner taille 42', status: 'Bordereau envoyé au vendeur', tus: 'needs_action', j: 1 },
  9102: { titre: 'Bravo Runner taille 41', status: "Bordereau d'envoi commandé", tus: 'needs_action', j: 1.2 },
  9103: { titre: 'Charlie Runner taille 40', status: 'Le paiement a été validé', tus: 'needs_action', j: 1.4 },
  9104: { titre: 'Delta Runner taille 43', status: "La livraison n'a pas encore eu lieu - colis déposé en bureau de Poste ou point relais", tus: 'waiting', j: 2 },
  9105: { titre: 'Echo Runner taille 39', status: "Commande expédiée et en cours d'acheminement ! ", tus: 'waiting', j: 2.2 },
  9106: { titre: 'Foxtrot Runner taille 44', status: "Commande non réclamée - Retournée à l'expéditeur.rice", tus: 'waiting', j: 2.4 },
  9107: { titre: 'Golf Runner taille 38', status: "Commande finalisée - l'acheteur a validé la commande", tus: 'completed', j: 2.6 },
  9108: { titre: 'Hotel Runner taille 45', status: 'Le paiement a échoué', tus: 'failed', j: 2.8 },
  9109: { titre: 'India Runner taille 37', status: 'Retour initié', tus: 'waiting', j: 3 },
};
const TITRES = Object.values(V).map((v) => v.titre);
const titreDe = (tx) => V[tx].titre;
const VENTES = Object.entries(V).map(([tx, v], i) => ({
  transaction_id: Number(tx), title: v.titre, price: { amount: String(40 + i * 5), currency_code: 'EUR' },
  status: v.status, transaction_user_status: v.tus, date: ilYa(v.j),
}));
const ACHAT_TITRE = 'India Relay taille 43';
const ACHATS = [{ transaction_id: 7101, title: ACHAT_TITRE, price: { amount: '30', currency_code: 'EUR' },
  status: "La livraison n'a pas encore eu lieu - colis déposé en bureau de Poste ou point relais",
  transaction_user_status: 'needs_action', date: ilYa(3), seller: 'vendeur_banc' }];
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_banc', domain: 'www.vinted.fr', updated_at: new Date(MAINTENANT).toISOString() }];
const PDF_B64 = fs.readFileSync(path.join(__dirname, 'bordereau-test.b64'), 'utf8').trim();
const ROWS = [
  { id: 'main', data: { vinted_ship_done: { 9103: MAINTENANT - 3600000 } } },
  { id: 'email_bord_banc_bravo', data: { transaction: '9102', filename: 'bordereau-bravo.pdf', modele: 'Bravo Runner', article: titreDe(9102),
    receivedAt: ilYa(0, 5), dateLimite: dansJ(6), pdfB64: PDF_B64 } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: new Date(MAINTENANT).toISOString(), payload: { my_orders: VENTES } } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: new Date(MAINTENANT).toISOString(), payload: { my_orders: ACHATS } } },
];

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
// Un banc ne meurt pas, il rapporte : ce qui lève devient un contrôle ROUGE.
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 140)); } };
const memes = (a, b) => a.length === b.length && [...a].sort().join(',') === [...b].sort().join(',');

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul'); process.exit(1); });
srv.listen(PORT);
// Projection PostgREST minimale : `alias:data->>champ` (§6.3 — servir la ligne
// brute à une requête projetée fait lire des champs absents).
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : v;
  }
  return out;
};

async function preparer(b, vp, opts = {}) {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: new Date(MAINTENANT).toISOString(), cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    // Appareil neuf : le NUAGE (ligne `main`, qui porte « colis posté ») arrive
    // APRÈS les comptes et les ventes — c'est la forme réelle d'un premier
    // démarrage (§5.49), pas un cas d'école.
    if (eq && eq[1] === 'main' && opts.retardMain) return new Promise((ok) => setTimeout(ok, opts.retardMain)).then(() => j(ROWS.filter((r) => r.id === 'main').map(forme)));
    if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(ROWS.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  return { ctx, pg, errs };
}

// État commun d'un écran : débordement, garde-fou.
async function sain(pg, ecran) {
  const r = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, t: document.body.innerText }));
  dit(r.sw <= r.cw + 1, `${ecran} : aucun débordement horizontal`, `${r.sw} > ${r.cw}`);
  const m = /n'a pas pu s'afficher|n’a pas pu s’afficher|Cannot access|is not defined/.exec(r.t);
  dit(!m, `${ecran} : l'écran n'est pas tombé sur le garde-fou`, m && m[0]);
}

// La cloche : on l'ouvre et on lit le NOMBRE de la ligne « ventes à expédier ».
async function lireCloche(pg) {
  await pg.click('[aria-label="Notifications"]', { timeout: 5000 });
  await pg.waitForTimeout(500);
  const n = await pg.evaluate(() => {
    for (const bt of document.querySelectorAll('button')) {
      const m = /(\d+)\s+ventes?\s+à\s+expédier/.exec(bt.innerText || '');
      if (m && !/eBay/.test(bt.innerText)) return Number(m[1]);
    }
    return 0;      // aucune ligne : zéro colis annoncé
  });
  await pg.click('[aria-label="Notifications"]', { timeout: 3000 }).catch(() => {});
  await pg.keyboard.press('Escape').catch(() => {});
  await pg.waitForTimeout(200);
  return n;
}

// Les lignes de vente/d'achat rendues : titre (attribut `title`, la donnée
// servie) → étape affichée (premier élément de la ligne d'infos).
const lireLignes = (pg, titres) => pg.evaluate((titres) => {
  const out = {};
  for (const d of document.querySelectorAll('div[title]')) {
    const t = d.getAttribute('title'); if (!titres.includes(t)) continue;
    const meta = d.nextElementSibling; if (!meta || !meta.firstElementChild) continue;
    out[t] = meta.firstElementChild.textContent.trim();
  }
  return out;
}, titres);
const txDeTitre = (t) => Object.keys(V).find((k) => V[k].titre === t);

async function filtre(pg, nom) {
  await pg.getByRole('button', { name: nom, exact: true }).first().click({ timeout: 4000 });
  await pg.waitForTimeout(700);
}

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      console.log(`── ${vp.width} px`);
      const { ctx, pg, errs } = await preparer(b, vp);

      // ── 1. COLIS ─────────────────────────────────────────────────────────
      await essaie('Colis', async () => {
        await pg.goto(`http://localhost:${PORT}/?tab=cat_bord`, { waitUntil: 'domcontentloaded' });
        await pg.waitForTimeout(4000);
        const c = await pg.evaluate((titres) => {
          let g = null; const cartes = [];
          for (const el of document.querySelectorAll('[data-groupe],[data-bord-card]')) {
            if (el.hasAttribute('data-groupe')) { g = el.getAttribute('data-groupe'); continue; }
            const txt = el.innerText || '';
            cartes.push({ g, titre: titres.find((t) => txt.includes(t)) || null,
              txs: [...el.querySelectorAll('[data-tx]')].map((x) => x.getAttribute('data-tx')) });
          }
          const m = /(\d+)\s*colis à envoyer/.exec(document.body.innerText);
          return { cartes, n: m ? Number(m[1]) : 0 };
        }, TITRES);
        const tx = c.cartes.map((x) => txDeTitre(x.titre));
        dit(c.cartes.length === 2 && memes(tx, ['9101', '9102']), 'Colis : exactement 2 colis à poster, 9101 et 9102', JSON.stringify(tx));
        dit(c.n === 2, 'Colis : le compteur du haut dit 2', 'lu ' + c.n);
        const bravo = c.cartes.find((x) => x.titre === titreDe(9102));
        dit(!!bravo && bravo.g === 'pret', 'Colis : 9102 (son PDF est là) est dans le groupe « prêt à imprimer »', bravo ? 'groupe ' + bravo.g : 'carte absente');
        const alpha = c.cartes.find((x) => x.titre === titreDe(9101));
        dit(!!alpha && alpha.txs.includes('9101') && alpha.g !== 'pret', 'Colis : 9101 (sans bordereau) porte SA transaction et n’est pas « prêt »', alpha ? JSON.stringify(alpha) : 'carte absente');
        dit(!tx.includes('9103'), 'Colis : 9103, coché « posté », n’est pas un colis à poster', JSON.stringify(tx));
        await pg.screenshot({ path: path.join(os.tmpdir(), 'statuts-colis-colis-' + vp.width + '.png'), fullPage: true }).catch(() => {});
        await sain(pg, 'Colis');
      });

      // ── 2. MA JOURNÉE + 3a. LA CLOCHE (nombre publié) ─────────────────────
      await essaie('Ma journée', async () => {
        await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
        await pg.waitForTimeout(4500);
        const j = await pg.evaluate(() => {
          const m = /Expédier\s+(\d+)\s+colis/.exec(document.body.innerText);
          let pub = null; try { pub = JSON.parse(localStorage.getItem('vrm_colis_aposter') || 'null'); } catch (_) {}
          return { n: m ? Number(m[1]) : 0, pub };
        });
        dit(j.n === 2, 'Ma journée : « Expédier N colis » vaut 2', 'lu ' + j.n);
        dit(!!j.pub && j.pub.total === 2, 'Ma journée publie 2 colis à poster pour la cloche', JSON.stringify(j.pub));
        await sain(pg, 'Ma journée');
        const n = await lireCloche(pg);
        dit(n === 2, 'la cloche (après Ma journée) annonce 2 ventes à expédier', 'lu ' + n);
      });

      // ── 4. VENTES ────────────────────────────────────────────────────────
      await essaie('Ventes', async () => {
        await pg.goto(`http://localhost:${PORT}/?tab=cat_ventes`, { waitUntil: 'domcontentloaded' });
        await pg.waitForTimeout(3500);
        // Chaque filtre est cliqué pour de vrai ; on note QUELLES ventes il rend
        // et l'étape que porte chacune. Un filtre absent (code d'avant) est un
        // contrôle rouge, pas un banc qui meurt.
        const vu = {}, etapes = {}, parFiltre = {};
        for (const f of ['À expédier', 'En transit', 'Finalisées', 'Annulées', 'Toutes']) {
          await essaie('filtre « ' + f + ' »', async () => {
            await filtre(pg, f);
            const lignes = await lireLignes(pg, TITRES);
            vu[f] = Object.keys(lignes).map(txDeTitre);
            parFiltre[f] = Object.entries(lignes).map(([t, lib]) => [txDeTitre(t), lib]);
            Object.entries(lignes).forEach(([t, lib]) => { etapes[txDeTitre(t)] = lib; });
            if (f === 'En transit') await pg.screenshot({ path: path.join(os.tmpdir(), 'statuts-colis-transit-' + vp.width + '.png'), fullPage: true }).catch(() => {});
            if (f === 'À expédier') vu.boutons = await pg.evaluate(() => [...new Set([...document.querySelectorAll('[data-bouton-bord][data-tx]')].map((x) => x.getAttribute('data-tx')))]);
          });
        }
        console.log('    étapes rendues : ' + Object.keys(V).map((t) => t + '=' + (etapes[t] || '∅')).join(' · '));
        console.log('    filtres : ' + ['À expédier', 'En transit', 'Finalisées', 'Annulées', 'Toutes'].map((f) => f + '=' + JSON.stringify(vu[f] || null)).join(' · '));
        dit(etapes[9101] === 'À expédier', '9101 « Bordereau envoyé au vendeur » porte « À expédier » (jamais « En transit »)', etapes[9101]);
        dit(etapes[9104] === 'Au relais', '9104 déposé en point relais porte « Au relais » (jamais « Livrée »)', etapes[9104]);
        dit(!!etapes[9106] && !/^(Remboursée|Annulée)$/.test(etapes[9106]), '9106 non réclamée ne porte ni « Remboursée » ni « Annulée »', etapes[9106] || 'rendue nulle part');
        const ax = vu['À expédier'] || [], tr = vu['En transit'] || [];
        dit(!!vu['À expédier'] && memes(ax, ['9101', '9102']), 'filtre « À expédier » : exactement 9101 et 9102', JSON.stringify(vu['À expédier'] || null));
        dit(!!vu.boutons && memes(vu.boutons, ['9101', '9102']), 'filtre « À expédier » : les boutons de bordereau portent 9101 et 9102, rien d’autre', JSON.stringify(vu.boutons || null));
        dit(!!vu['En transit'] && ['9104', '9105', '9106'].every((t) => tr.includes(t)), 'filtre « En transit » : 9104, 9105 et 9106 y sont', JSON.stringify(vu['En transit'] || null));
        // ⚠️ 9109 « Retour initié » : l'acheteur RENVOIE la paire. Comme 9106,
        // c'est un colis qui revient — rangé « annulé » pour l'argent seulement.
        // Vu le 5 octobre : il n'était que sous « Annulées ».
        dit(!!vu['En transit'] && tr.includes('9109') && !(vu['Annulées'] || []).includes('9109'),
          '9109 « Retour initié » (la paire revient) est sous « En transit », pas sous « Annulées »',
          'En transit=' + JSON.stringify(vu['En transit'] || null) + ' · Annulées=' + JSON.stringify(vu['Annulées'] || null));
        dit(etapes[9109] === 'Retour en cours', '9109 porte « Retour en cours »', etapes[9109] || 'rendue nulle part');
        dit(!!vu['En transit'] && !['9101', '9102', '9107', '9108'].some((t) => tr.includes(t)), 'filtre « En transit » : ni 9101/9102 (à poster), ni 9107 (finalisée), ni 9108 (paiement échoué)', JSON.stringify(vu['En transit'] || null));
        // L'étiquette d'une ligne ne contredit pas le filtre qui la montre :
        // sous « En transit », jamais « À expédier » (9103, cochée « posté »,
        // le portait au premier passage) ; sous « À expédier », toujours.
        const pfA = parFiltre['À expédier'], pfT = parFiltre['En transit'];
        dit(!!pfA && pfA.length > 0 && pfA.every(([, lib]) => lib === 'À expédier'), 'sous « À expédier », chaque ligne porte « À expédier »', JSON.stringify(pfA || null));
        dit(!!pfT && pfT.length > 0 && !pfT.some(([, lib]) => lib === 'À expédier'), 'sous « En transit », aucune ligne ne porte « À expédier » (9103 cochée « posté » non plus)', JSON.stringify(pfT || null));
        // Les quatre filtres découpent les ventes sans trou ni doublon : une
        // vente rangée dans deux filtres (ou dans aucun) se lit comme deux
        // colis, ou comme un colis perdu.
        const quatre = ['À expédier', 'En transit', 'Finalisées', 'Annulées'];
        const fois = Object.keys(V).map((t) => [t, quatre.filter((f) => (vu[f] || []).includes(t)).length]);
        dit(quatre.every((f) => vu[f]) && fois.every(([, n]) => n === 1), 'chaque vente est dans UN seul des quatre filtres', JSON.stringify(Object.fromEntries(fois)));
        const horsAnnulees = Object.keys(V).filter((t) => !(vu['Annulées'] || []).includes(t));
        dit(!!vu['Toutes'] && !!vu['Annulées'] && memes(vu['Toutes'], horsAnnulees), '« Toutes » = toutes sauf les annulées', JSON.stringify(vu['Toutes'] || null));
        try { await filtre(pg, 'Toutes'); } catch (_) {}
        await sain(pg, 'Ventes');
      });

      // ── 5. ACHATS ────────────────────────────────────────────────────────
      await essaie('Achats', async () => {
        await pg.goto(`http://localhost:${PORT}/?tab=cat_achats`, { waitUntil: 'domcontentloaded' });
        await pg.waitForTimeout(3500);
        await filtre(pg, 'Tous');
        const a = await lireLignes(pg, [ACHAT_TITRE]);
        dit(a[ACHAT_TITRE] === 'À retirer', 'Achats : le colis déposé en point relais porte « À retirer » (jamais « Reçu »)', a[ACHAT_TITRE] || 'ligne absente');
        await sain(pg, 'Achats');
      });
      dit(errs.length === 0, 'aucune erreur de page', errs.join(' | ').slice(0, 200));
      await pg.screenshot({ path: path.join(os.tmpdir(), 'statuts-colis-' + vp.width + '.png') }).catch(() => {});
      await ctx.close();

      // ── 3b. LA CLOCHE SUR UN APPAREIL NEUF (repli, rien de publié) ─────────
      await essaie('cloche (appareil neuf)', async () => {
        const n2 = await preparer(b, vp, { retardMain: 1500 });
        await n2.pg.goto(`http://localhost:${PORT}/?tab=dashboard`, { waitUntil: 'domcontentloaded' });
        await n2.pg.waitForTimeout(5500);
        const pub = await n2.pg.evaluate(() => localStorage.getItem('vrm_colis_aposter'));
        dit(pub == null, 'appareil neuf : aucun nombre publié (la cloche est sur son repli)', String(pub));
        const n = await lireCloche(n2.pg);
        dit(n === 2, 'la cloche (appareil neuf, le nuage arrive en dernier) annonce 2 ventes à expédier — le colis coché « posté » n’en est pas', 'lu ' + n);
        await sain(n2.pg, 'Tableau de bord');
        dit(n2.errs.length === 0, 'aucune erreur de page (tableau de bord)', n2.errs.join(' | ').slice(0, 200));
        await n2.ctx.close();
      });
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 160)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ statuts des colis : ${ko} rouge(s)` : '\n✅ statuts des colis : tout est vert');
  process.exit(ko ? 1 : 0);
})();
