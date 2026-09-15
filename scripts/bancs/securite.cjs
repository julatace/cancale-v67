// ⚠️⚠️ BANC — LE PANNEAU « SÉCURITÉ DES DONNÉES » DIT-IL TOUTE LA VÉRITÉ ?
//
// Demande de Julien, 15 septembre : « je veux que tu commences à réfléchir à une
// optique de MISE EN LIGNE… que les données soient bien séparées, que chaque
// compte appartienne bien à une personne, que tout ne se mélange pas. Car ça
// pourrait avoir de gros problèmes. »
//
// MESURÉ SUR SA VRAIE BASE LE MÊME JOUR, et c'est le point de départ :
//   • `app_data.owner` **n'existe pas** (400 « column does not exist ») — la
//     migration n'a jamais été passée, ses 5 086 lignes sont dans un seul tas ;
//   • `vinted_accounts` n'a pas de propriétaire non plus (9 comptes) ;
//   • la clé publique **LIT** (200) **et ÉCRIT** (201 sur un upsert) ;
//   • et elle lit `vinted_accounts`, qui porte `access_token` / `refresh_token`.
// Autrement dit : aujourd'hui un second utilisateur ouvrirait SA boutique, et
// pourrait l'effacer. Le panneau ne parlait que de la LECTURE.
//
// CE QUE CE BANC EXIGE, DANS LES DEUX SENS :
//   1. base grande ouverte (l'état réel) → le panneau nomme les TROIS accès, et
//      le badge dit « partagées » ;
//   2. base cloisonnée → il dit « fermé » / « cloisonnées » ;
//   3. sondes sans réponse → « pas encore vérifié », **jamais** un diagnostic et
//      **jamais** un feu vert. Une fausse alerte fait cesser de lire les vraies ;
//      un faux feu vert sur cet écran-là est le mensonge le plus cher possible.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist'), SC = __dirname;
const FX = (f) => JSON.parse(fs.readFileSync(path.join(SC, 'fx', f + '.json'), 'utf8'));
const accounts = FX('accounts'), main = FX('main');

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
  r.end(fs.readFileSync(p));
});
srv.listen(4489);
const HTML522 = '<!DOCTYPE html><html><head><title>522: Connection timed out</title></head><body>Connection timed out</body></html>';

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox'] });

  // `etat` : 'ouverte' (le sien aujourd'hui) · 'cloisonnee' · 'muette'
  const rendre = async (etat) => {
    const ctx = await b.newContext({ viewport: { width: 1512, height: 950 } });
    const pg = await ctx.newPage();
    const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
    // ⚠️ UNE SONDE NE DOIT RIEN ÉCRIRE DANS SA BASE (§2.3) — mais l'app, elle,
    //    écrit légitimement (`widget_stats`, les lignes publiées). Mon premier
    //    jet comptait TOUT et sortait rouge sur un comportement normal : on ne
    //    retient que ce que la sonde aurait créé.
    const ecrits = [];
    await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
    const cors = { 'access-control-allow-origin': '*' };
    await pg.route('**/rest/v1/**', (route) => {
      const req = route.request(), u = req.url(), m = req.method();
      const j = (d, st) => route.fulfill({ status: st || 200, contentType: 'application/json', headers: cors, body: JSON.stringify(d) });
      const mort = () => route.fulfill({ status: 522, contentType: 'text/html', headers: cors, body: HTML522 });
      const ferme = () => route.fulfill({ status: 401, contentType: 'application/json', headers: cors, body: '{"message":"JWT required"}' });
      // La sonde d'écriture : un PATCH sur un identifiant qui n'existe pas.
      if (m === 'PATCH') {
        if (/id=eq\.__sonde/.test(u)) {
          if (etat === 'muette') return mort();
          if (etat === 'cloisonnee') return ferme();
          return j([]);                       // droit accordé, zéro ligne touchée
        }
        return j([]);
      }
      if (m === 'POST') { try { (JSON.parse(req.postData() || '[]') || []).forEach((r) => { if (/^__sonde/.test(String(r && r.id || ''))) ecrits.push(r); }); } catch (_) {} return j([], 201); }
      if (m === 'DELETE') { if (/__sonde/.test(u)) ecrits.push({ delete: u }); return j([]); }
      if (m !== 'GET') return j([]);
      if (etat === 'muette') return mort();
      // La colonne `owner` : absente chez lui (400 PostgREST).
      if (/select=owner/.test(u)) return (etat === 'cloisonnee')
        ? j([{ owner: null }])   // cloisonnée ⇒ la colonne existe
        : route.fulfill({ status: 400, contentType: 'application/json', headers: cors, body: '{"code":"42703","message":"column app_data.owner does not exist"}' });
      // ⚠️ UNE BASE CLOISONNÉE NE REFUSE PAS TOUT — elle refuse la CLÉ PUBLIQUE.
      //    Mon premier jet répondait 401 à toutes les requêtes : l'app tombait
      //    sur « base injoignable » et le panneau n'était même plus rendu — le
      //    banc mesurait une panne, pas un cloisonnement. Ce qui doit être
      //    refusé, ce sont les trois SONDES ; l'app, elle, est connectée.
      if (etat === 'cloisonnee') {
        if (/app_data\?select=id&limit=1/.test(u) || /vinted_accounts\?select=id&limit=1/.test(u)) return ferme();
      }
      if (/vinted_accounts/.test(u)) return j(accounts);
      if (/id=eq\.main/.test(u)) return j(main);
      // ⚠️ LA SONDE DE LECTURE COMPTE LES LIGNES RENDUES : un banc qui répond
      //    `[]` fait dire « lecture fermée » sur une base grande ouverte —
      //    vert sur le défaut. Base ouverte ⇒ la lecture ramène quelque chose.
      return j([{ id: 'main' }]);
    });
    await pg.route('**/auth/v1/settings**', (r2) => (etat === 'muette'
      ? r2.fulfill({ status: 522, contentType: 'text/html', headers: cors, body: HTML522 })
      : r2.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: '{"mailer_autoconfirm":true}' })));
    await pg.route('**/api/**', (r2) => r2.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"serviceKey":true,"owner":true,"pret":true}' }));
    await pg.goto('http://localhost:4489/?tab=settings', { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(5200);
    const bloc = await pg.evaluate(() => {
      const t = [...document.querySelectorAll('div')].find((d) => /Sécurité des données/.test(d.textContent || '') && (d.textContent || '').length < 2600);
      if (t) return t.innerText || '';
      return '';
    });
    // ⚠️ REGARDER LA CAPTURE FAIT PARTIE DU TEST (§6.2) — encore faut-il que le
    //    panneau y soit : il vit loin dans un écran qui défile, et une capture
    //    du premier écran ne montrait que l'en-tête des Paramètres.
    try {
      const el = await pg.evaluateHandle(() => {
        const d = [...document.querySelectorAll('div')].find((x) => /Sécurité des données/.test(x.textContent || '') && (x.textContent || '').length < 2600);
        return d || document.body;
      });
      await el.asElement().scrollIntoViewIfNeeded();
      await pg.waitForTimeout(250);
      await el.asElement().screenshot({ path: SC + '/z-securite-' + etat + '.png' });
    } catch (_) { await pg.screenshot({ path: SC + '/z-securite-' + etat + '.png' }); }
    const page = await pg.evaluate(() => document.body.innerText || '');
    await ctx.close();
    return { bloc, errs, ecrits, page };
  };

  // ── 1. L'ÉTAT RÉEL : tout est ouvert ────────────────────────────────────
  {
    const { bloc, errs, ecrits } = await rendre('ouverte');
    dit(!!bloc, 'le panneau de sécurité est rendu', bloc ? '' : 'introuvable');
    dit(/partagées/.test(bloc), 'le badge dit « partagées »', bloc.slice(0, 90).replace(/\n/g, ' · '));
    // Les TROIS accès sont nommés. Lire n'est pas écrire, et un jeton Vinted
    // vaut le compte : trois faits différents, un seul verrou manquant.
    dit(/tout lire/i.test(bloc), 'il dit que la clé publique peut LIRE');
    dit(/écrire/i.test(bloc) && /effacer/i.test(bloc), 'il dit qu’elle peut ÉCRIRE et EFFACER');
    dit(/jetons/i.test(bloc) && /vinted/i.test(bloc), 'il dit que les JETONS Vinted sont lisibles');
    dit(/colonne absente/i.test(bloc), 'et que la colonne « propriétaire » manque');
    // ⚠️ UNE SONDE N'ÉCRIT PAS DANS SA BASE (§2.3). Le `PATCH` de la sonde vise
    //    un identifiant inexistant : il mesure le DROIT sans créer de ligne.
    dit(ecrits.length === 0, 'aucune sonde n’a écrit dans la base', ecrits.length ? JSON.stringify(ecrits).slice(0, 140) : '');
    dit(errs.length === 0, 'aucune erreur d’app', errs.join(' | ').slice(0, 120));
  }

  // ── 2. L'AUTRE SENS, ET C'EST LE CONTRÔLE QUI COMPTE POUR LA MISE EN LIGNE
  //    Le banc l'a révélé en tombant : dès que la base est cloisonnée, l'app ne
  //    montre plus de boutique à qui n'est pas connecté — elle demande une
  //    session. C'est CE comportement qui protège un vendeur d'un autre, bien
  //    plus que le libellé d'un badge. On l'exige donc explicitement.
  {
    const { bloc, page } = await rendre('cloisonnee');
    dit(!bloc, 'base cloisonnée : plus de panneau sans session', bloc ? bloc.slice(0, 80) : '');
    dit(/Se connecter/i.test(page), 'l’app demande de se connecter', page.slice(0, 70).replace(/\n/g, ' · '));
    // ⚠️ Et elle ne doit RIEN montrer de la boutique au passage : ni chiffre, ni
    //    compte Vinted, ni annonce. Une porte qui laisse voir par le trou de la
    //    serrure n'est pas une porte.
    const fuites = ['julatace', 'tomj', 'angeled', '€'].filter((m) => page.includes(m));
    dit(fuites.length === 0, 'et aucune donnée de la boutique ne transparaît', fuites.join(' '));
  }

  // ── 3. SONDES MUETTES : ni diagnostic, ni feu vert ──────────────────────
  {
    const { bloc } = await rendre('muette');
    dit(/pas encore vérifié/i.test(bloc), 'sondes muettes : « pas encore vérifié »', bloc.slice(0, 90).replace(/\n/g, ' · '));
    // ⚠️ LE FEU VERT EST LE PIRE : affirmer que le verrou est posé sans l'avoir
    //    mesuré, sur l'écran qui sert à décider si ses données sont protégées.
    dit(!/cloisonnées/.test(bloc), 'et surtout PAS « cloisonnées »');
    // ⚠️ VINGTIÈME FOIS QU'UN DE MES CONTRÔLES CRIE AU LOUP, et c'est la
    //    récidive exacte de « télécharg » : mon premier jet interdisait les MOTS
    //    (« jetons », « effacer ») — or la phrase honnête NOMME ce qu'elle n'a
    //    pas pu mesurer (« la lecture · l'écriture · les jetons Vinted »), et
    //    c'est précisément ce qu'on veut. Ce qui est interdit, c'est
    //    l'AFFIRMATION qu'un accès est ouvert.
    dit(!/permet encore de/i.test(bloc) && !/tout est ouvert/i.test(bloc),
      'ni le diagnostic d’un problème qu’on n’a pas mesuré');
    dit(!/Copier la migration SQL/i.test(bloc), 'ni le remède sans le diagnostic');
  }

  await b.close(); srv.close();
  console.log('\n' + (ko ? `${ko} controle(s) au rouge.` : 'Le panneau de securite dit ce qu\'il a mesure, et rien de plus.'));
  process.exit(ko ? 1 : 0);
})();
