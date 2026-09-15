// ═══════════════════════════════════════════════════════════════════════════
// BANC : UN RÉGLAGE QU'ON N'A PAS PU LIRE NE SE FAIT PAS ÉCRASER
//        node scripts/bancs/reglages.cjs
// ═══════════════════════════════════════════════════════════════════════════
// Quatre panneaux de Réglages lisent leur ligne puis la RÉÉCRIVENT ENTIÈRE au
// premier réglage touché. Tous traitaient une lecture ratée comme « vide » :
//   · vrm_email_owners  → toutes ses adresses de réception effacées. C'est
//     l'adresse de RÉCEPTION qui décide à quel vendeur appartient un email
//     (§5) : les emails Vinted suivants partent en quarantaine.
//   · push_prefs        → mesuré 5 préférences ; un basculement en réécrit UNE.
//   · vrm_pro_facture   → l'entité du reçu comptable revient à « Ma boutique ».
//   · vrm_email_config  → l'écran affiche AUJOURD'HUI au lieu du 10 juillet.
//
// ⚠️⚠️ LE CAS QUI DÉTRUIT N'EST PAS LA PANNE TOTALE : quand tout est tombé,
//    l'écriture échoue aussi et rien n'est perdu. C'est **lecture KO, écriture
//    OK** — un hoquet pendant qu'il ouvre Réglages — et c'est ce que ce banc
//    sert : SEULES ces quatre lignes échouent, la base debout par ailleurs.
//    (Même famille que `push_subs` côté serveur et les onze fusions de
//    l'extension.)
//
// ⚠️ ET IL VÉRIFIE LES DEUX SENS. Ne rien écrire du tout est le moyen le plus
//    simple de ne rien écraser : en marche normale le banc CLIQUE pour de vrai
//    et exige que l'écriture parte, avec les autres clés intactes.
//
// ⚠️ Les valeurs servies ici sont SYNTHÉTIQUES (aucune donnée réelle ne monte
//    dans le dépôt, §6) : ce qui est mesuré est la RÈGLE, pas leur contenu.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const fs = require('fs'), http = require('http'), path = require('path');
// ⚠️⚠️ JAMAIS UN CHEMIN ABSOLU : la méthode de preuve (§6.1) lance le banc
// depuis /tmp/avN, et un chemin en dur y servirait le build COURANT — le banc
// mesurerait le correctif en croyant mesurer le code d'avant.
const DIST = path.join(__dirname, '..', '..', 'dist'), SC = __dirname;
const FX = (f) => JSON.parse(fs.readFileSync(path.join(SC, 'fx', f + '.json'), 'utf8'));
const main = FX('main'), accounts = FX('accounts');
const rows = [...FX('sold'), ...FX('purch'), ...FX('listings'), ...FX('inbox'),
  ...FX('track'), ...FX('bord'), ...FX('label'), ...FX('billing')];

// Les quatre lignes de réglages, telles qu'elles existent chez lui (formes
// mesurées le 15 septembre ; contenus synthétiques).
const REGLAGES = {
  push_prefs: { achat: true, suivi: true, favori: true, facture: true, message: true },
  vrm_email_config: { startDate: '2026-07-10', updatedAt: '2026-07-15T21:18:21.389Z' },
  vrm_pro_facture: { actif: true, prefixe: 'VRM', tauxTva: 20, nom: 'MA RAISON SOCIALE',
    siret: '00000000000000', adresse: '1 rue du Banc', ville: 'Cancale', codePostal: '35260',
    tva: '', logo: '', autoSend: false, mentions: '' },
  vrm_email_owners: { adresses: {
    'a@exemple.test': { owner: 'u1', label: '', at: '2026-07-01T00:00:00.000Z' },
    'b@exemple.test': { owner: 'u1', label: '', at: '2026-07-02T00:00:00.000Z' },
  } },
};
const CIBLES = Object.keys(REGLAGES);

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
      out[alias] = (v == null) ? null : v; continue;
    }
    out[alias] = row[src];
  }
  return out;
}
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
  r.end(fs.readFileSync(p));
});
srv.listen(4482);

// ⚠️ LA VRAIE FORME D'UNE LECTURE RATÉE : 522 + HTML, pas un JSON d'erreur.
const HTML522 = '<!DOCTYPE html><html><head><title>522: Connection timed out</title></head><body>Connection timed out</body></html>';

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };

// Ce qu'un panneau ne doit JAMAIS affirmer quand il n'a rien pu lire. Ce sont
// des AFFIRMATIONS sur la donnée, pas des formulations : la règle est « on ne
// présente pas comme un fait ce qu'on n'a pas mesuré » (§6.5).
const MENSONGES = [
  [/Aucune adresse déclarée/i, '« Aucune adresse déclarée » — une affirmation sur l\'attribution de ses emails'],
  [/✓ enregistré/, '« ✓ enregistré » sur un réglage jamais lu'],
];

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox'] });

  // `reglagesKO` : SEULES les quatre lignes de réglages échouent. Tout le reste
  // répond — y compris les ÉCRITURES, qui sont comptées.
  const rendre = async (reglagesKO, gestes) => {
    const ctx = await b.newContext({ viewport: { width: 1512, height: 950 } });
    const pg = await ctx.newPage();
    const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
    const ecrits = [];                       // les upserts réellement partis
    await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
    await pg.route('**/rest/v1/**', (route) => {
      const u = route.request().url();
      const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
      if (route.request().method() === 'POST') {
        // ⚠️ L'ÉCRITURE PASSE (c'est le cas qui détruit). On la compte.
        try { (JSON.parse(route.request().postData() || '[]') || []).forEach((r) => ecrits.push(r)); } catch (_) {}
        return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
      }
      if (route.request().method() !== 'GET') return j([]);
      const cible = CIBLES.find((k) => u.includes('id=eq.' + k));
      if (cible) {
        if (reglagesKO) return route.fulfill({ status: 522, contentType: 'text/html', headers: { 'access-control-allow-origin': '*' }, body: HTML522 });
        return j([{ data: REGLAGES[cible] }]);
      }
      if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
      const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1]; const S = sel ? decodeURIComponent(sel) : null;
      if (/vinted_accounts/.test(u)) return j(accounts);
      if (/id=eq\.main/.test(u)) return j(main.map((r) => projette(r, S)));
      const eq = /id=eq\.([^&]*)/.exec(u);
      if (eq) { const k = decodeURIComponent(eq[1]); return j(rows.filter((r) => r.id === k).map((r) => projette(r, S))); }
      const m = /id=like\.([^&]*)/.exec(u);
      if (m) { const pat = decodeURIComponent(m[1]).replace(/[*%]/g, '.*'); const re = new RegExp('^' + pat + '$');
        return j(rows.filter((r) => re.test(r.id)).map((r) => projette(r, S))); }
      return j([]);
    });
    await pg.route('**/api/**', (r2) => r2.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true,"devices":1}' }));
    await pg.goto('http://localhost:4482/?tab=settings', { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(5000);
    // Déplie le panneau des notifications (c'est un <details>).
    try { await pg.evaluate(() => { document.querySelectorAll('details').forEach((d) => { d.open = true; }); }); } catch (_) {}
    await pg.waitForTimeout(600);
    if (gestes) await gestes(pg);
    await pg.waitForTimeout(1200);
    await pg.screenshot({ path: SC + '/z-reglages-' + (reglagesKO ? 'ko' : 'ok') + '.png', fullPage: true });
    // ⚠️ UNE VALEUR DANS UN CHAMP NE SE VOIT PAS DANS `innerText`. La date
    //    d'import est un `<input type="date">`, la raison sociale un `<input>` :
    //    un contrôle posé sur le seul texte de la page les déclare absentes et
    //    crie au loup sur une app intacte. Même leçon que les `href` de
    //    `panne.cjs` — on lit ce qui est RENDU, pas ce qui est écrit en toutes
    //    lettres.
    const champs = await pg.evaluate(() => Array.from(document.querySelectorAll('input,textarea,select'))
      .map((e) => String(e.value == null ? '' : e.value)).filter(Boolean));
    const txt = (await pg.evaluate(() => document.body.innerText || '')) + '\n' + champs.join('\n');
    await ctx.close();
    return { txt, errs, ecrits };
  };

  // Le geste qui détruit : basculer UNE notification. Sur le code d'avant, il
  // réécrivait `push_prefs` avec une seule clé.
  const basculer = async (pg) => {
    const b2 = pg.locator('button[aria-label*="Suivi du colis"]');
    if (await b2.count()) { try { await b2.first().click({ timeout: 2500 }); } catch (_) {} }
  };

  // ══════════════════════════════════════════════════════════════════════════
  console.log('── LECTURE RATÉE, ÉCRITURE POSSIBLE (le cas qui détruit)');
  {
    const r = await rendre(true, basculer);
    for (const [re, quoi] of MENSONGES) {
      dit(!re.test(r.txt), `Réglages n'affirme pas ${quoi}`);
    }
    // ⚠️ LE CONTRÔLE QUI COMPTE PORTE SUR L'ÉCRITURE PARTIE, pas sur un texte :
    //    une reformulation ne peut pas le rendre vert (§6.5).
    const fautifs = r.ecrits.filter((x) => CIBLES.includes(x && x.id));
    dit(fautifs.length === 0, 'aucune ligne de réglages n\'est réécrite depuis une lecture ratée',
      fautifs.length ? fautifs.map((x) => `${x.id} ← ${JSON.stringify(x.data).slice(0, 70)}`).join(' | ') : '');
    // Et il le DIT : se taire renverrait au défaut d'origine (« je l'ai réglé
    // et ça n'a pas tenu »).
    // ⚠️ MAIS UNE SEULE FOIS (§7). Premier rendu : les QUATRE panneaux portaient
    //    le même paragraphe de 190 caractères — quatre alertes pour une cause,
    //    sur un écran qu'il faut déjà faire défiler. C'est le défaut de Ma
    //    journée (« la panne dite trois fois ») et des six « saisis tes prix
    //    d'achat ». Le banc COMPTE : le bloc ×1, et la pastille une par panneau
    //    touché — c'est elle qui distingue, pas le libellé.
    const bloc = (r.txt.match(/n'ont pas pu être lus|n'a pas pu être lu/g) || []).length;
    dit(bloc === 1, 'l\'écran DIT qu\'il n\'a pas pu lire — et UNE seule fois',
      `le bloc apparaît ${bloc} fois`);
    dit(/rien ne sera\s+écrit par-dessus/i.test(r.txt), 'et il dit que rien ne sera écrasé',
      'c\'est exactement ce qu\'il craint : « je l\'ai réglé et ça n\'a pas tenu »');
    // Il NOMME les panneaux : sur un écran qui défile, « un réglage » ne dit pas
    // lequel regarder.
    for (const nom of ['les notifications', 'tes adresses de réception', 'la facturation Pro', "la date d'import des emails"]) {
      dit(r.txt.includes(nom), `et il nomme « ${nom} »`);
    }
    // Et le panneau lui-même porte la marque — se taire dessus laisserait croire
    // que le formulaire vide est son vrai réglage.
    const past = (r.txt.match(/réglage pas lu/g) || []).length;
    dit(past >= 1 && past <= CIBLES.length, 'chaque panneau touché porte sa pastille, sans répéter l\'explication',
      `${past} pastille(s) pour ${CIBLES.length} panneau(x)`);
    // Le mensonge le plus discret : afficher la date du jour à la place de la sienne.
    const auj = new Date().toISOString().slice(0, 10);
    const [a, mo, d2] = auj.split('-');
    dit(!new RegExp(`${d2}/${mo}/${a}|${auj}`).test(r.txt), 'et il n\'invente pas la date d\'import du jour',
      `la vraie est le 10/07/2026 — afficher ${d2}/${mo}/${a} lui ferait croire qu'il a perdu deux mois d'emails`);
    dit(r.errs.length === 0, 'aucune erreur d\'app', r.errs.slice(0, 2).join(' | '));
  }

  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n── ET EN MARCHE NORMALE, TOUT S\'AFFICHE ET S\'ENREGISTRE (l\'autre sens)');
  // Sans cette moitié, « ne rien écrire jamais » passerait le banc.
  {
    const r = await rendre(false, basculer);
    dit(/10\/07\/2026|2026-07-10/.test(r.txt), 'la date d\'import lue est bien la sienne',
      'sinon l\'écran affiche autre chose que ce qui est enregistré');
    dit(/MA RAISON SOCIALE/.test(r.txt), 'l\'entité de facturation est affichée');
    dit(/a@exemple\.test/.test(r.txt) && /b@exemple\.test/.test(r.txt),
      'ses deux adresses de réception sont là');
    dit(!/n'ai pas pu lire ce réglage/i.test(r.txt), 'et aucune fausse alerte quand la base répond');
    const w = r.ecrits.filter((x) => x && x.id === 'push_prefs');
    dit(w.length > 0, 'basculer une notification écrit pour de vrai',
      w.length ? '' : 'un panneau qui n\'écrit jamais passerait la première moitié de ce banc');
    if (w.length) {
      const d3 = w[w.length - 1].data || {};
      const perdues = Object.keys(REGLAGES.push_prefs).filter((k) => !(k in d3));
      dit(perdues.length === 0, 'et les autres préférences sont TOUTES conservées',
        perdues.length ? `perdues : ${perdues.join(', ')}` : `${Object.keys(d3).length} clés écrites`);
      dit(d3.suivi === false, 'et c\'est bien celle qu\'il a cliquée qui change',
        `suivi = ${JSON.stringify(d3.suivi)}`);
    }
    dit(r.errs.length === 0, 'aucune erreur d\'app', r.errs.slice(0, 2).join(' | '));
  }

  await b.close(); srv.close();
  console.log(ko ? `\n${ko} controle(s) non conforme(s).` : '\nUn reglage qu\'on n\'a pas pu lire n\'est plus ecrase.');
  process.exit(ko ? 1 : 0);
})();
