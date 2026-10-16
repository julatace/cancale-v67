// Audit : LE MODE STREAM (15 octobre) — la RÈGLE de masquage, exécutée, et ses
// branchements.
//
// Julien : « mets un mode stream pour les influenceurs, il faut cacher leurs
// données sensibles comme leur CA ou leur nom de compte ». Le masquage est UN
// mécanisme (`src/modeStream.js`) ; le banc `bancs/mode-stream.cjs` vérifie les
// écrans RENDUS. Cet audit vérifie ce qu'un banc de rendu ne peut pas trancher :
//   1. la règle elle-même, EXÉCUTÉE (`masquerTexte`) sur un tableau de cas —
//      dans les DEUX sens : ce qui est sensible part (montants sous toutes leurs
//      formes, emails, téléphones, IBAN, SIRET, identifiants longs, n° de suivi,
//      adresses, noms de comptes → alias STABLE), ce qu'un streamer montre reste
//      (N° de rangement, dates, nombres de ventes, pourcentages, titres) ;
//   1 bis. le DOCUMENT, dans un vrai navigateur : un montant de fourchette ou un
//      code de casier de 4 chiffres coupés en plusieurs nœuds (relecture du
//      15 octobre) — et l'autre sens (un N°, des vues, une taille restent) ;
//   2. les notifications du TÉLÉPHONE, côté serveur (`api/_lib/push.js`) :
//      allumé ⇒ ni montant, ni nom, ni code, ni texte de message ; coupé ⇒ la
//      notification d'origine ; PAS SU ⇒ sans détail (on tait plutôt que de
//      montrer un CA pendant un live) — la VRAIE fonction d'envoi, exécutée
//      contre une fausse base et un faux Web Push, trois envois de suite sur la
//      MÊME instance (un « coupé » lu juste avant ne vaut pas pour une lecture
//      ratée) ;
//   3. les branchements : le réglage est synchronisé (`SYNC_KEYS`), l'interrupteur
//      est rendu dans Réglages et la pastille dans l'en-tête, la notification du
//      navigateur passe par `textePublic`, un code de retrait vu par l'app est
//      noté (`codeRetrait` → `noterValeurSensible`).
// `--src <fichier>` lance la règle depuis une copie mutée (preuve par
// réaffaiblissement).
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..');
let ko = 0;
const ok = (m) => console.log('✅ ' + m);
const nok = (m, d) => { ko++; console.log('❌ ' + m + (d ? ' — ' + d : '')); };
const lire = (f) => { try { return fs.readFileSync(path.join(R, f), 'utf8'); } catch (_) { return ''; } };
const iSrc = process.argv.indexOf('--src');
const SRC = iSrc > 0 ? path.resolve(process.argv[iSrc + 1]) : path.join(R, 'src', 'modeStream.js');

(async () => {
  // ── 1. LA RÈGLE, EXÉCUTÉE ──────────────────────────────────────────────────
  let m = null;
  try { m = await import(require('url').pathToFileURL(SRC).href); } catch (e) { nok('le module du mode stream se charge', String(e && e.message).slice(0, 120)); }
  if (m && typeof m.masquerTexte === 'function') {
    const noms = [
      { valeur: 'zorglub_vend42', alias: 'Compte 1' }, { valeur: 'Boutique Zorglub', alias: 'Compte 1' },
      { valeur: 'pimpante_boutik', alias: 'Compte 2' }, { valeur: 'Bérénice', alias: '•••' },
    ];
    const SENSIBLE = [
      ['CA du mois 1 234,56 €', '1 234,56'], ['Vendu 487,13 €', '487,13'], ['marge +31,50 €', '31,50'],
      ['€ 12', '12'], ['total 45 €', '45'], ['3 456 € encaissés', '3 456'], ['12.50 EUR', '12.50'], ['45 euros', '45 euros'],
      ['Contact : zorglub.secret@exemple.test', 'zorglub.secret@'], ['tél 06 12 34 56 78', '06 12 34 56 78'], ['+33 6 12 34 56 78', '12 34 56 78'],
      ['IBAN FR76 3000 6000 0112 3456 7890 189', '3000 6000'], ['SIRET 123 456 789 00012', '123 456 789'],
      ['compte #24602614 · tx 22155558568', '22155558568'], ['n° Vinted 730000123', '730000123'], ['suivi XW476115185SP', 'XW476115185SP'],
      ['17 rue des Glycines 29280 Plouzané', 'Glycines'], ['Relais, 29200 Brest', '29200'],
      ['@zorglub_vend42', 'zorglub_vend42'], ['Boutique Zorglub · 3 ventes', 'Boutique Zorglub'], ['Bonjour Bérénice', 'Bérénice'],
      ['ZORGLUB_VEND42 a vendu', 'ZORGLUB_VEND42'],
      // Le PREMIER montant d'une fourchette ou d'une baisse (relecture du 15 octobre).
      ['fourchette 20–45 €', '20'], ['38 ventes · de 26,71 à 45,90 €', '26,71'], ['60 → 53 €', '60'], ['objectif 1 234 / 3 000 €', '1 234'],
    ];
    const echecs = SENSIBLE.filter(([t, s]) => m.masquerTexte(t, noms).includes(s));
    echecs.length === 0 ? ok(`la règle masque les ${SENSIBLE.length} formes sensibles (montants, emails, téléphones, IBAN, SIRET, identifiants, suivi, adresses, comptes)`)
      : nok('la règle masque toutes les formes sensibles', echecs.map(([t]) => `« ${t} » → « ${m.masquerTexte(t, noms)} »`).join(' · '));
    // L'alias est STABLE et DISTINCT : il sait toujours sur quel compte agir.
    const a1 = m.masquerTexte('zorglub_vend42', noms), a2 = m.masquerTexte('Boutique Zorglub', noms), b = m.masquerTexte('pimpante_boutik', noms);
    a1 === 'Compte 1' && a2 === 'Compte 1' && b === 'Compte 2'
      ? ok('un compte garde UN alias stable (login et nom donné → « Compte 1 »), distinct des autres (« Compte 2 »)')
      : nok('alias stable et distinct', `${a1} · ${a2} · ${b}`);
    const GARDE = ['N°17', 'B125', 'le 15/10/2026', '3 ventes · 12 paires', 'marge 12,5 %', 'Nike Air Max 90 taille 42', 'Salomon XT-6 blanc taille 40', 'il y a 3 h', '40 vues', 'Tous les comptes'];
    const abimes = GARDE.filter((t) => m.masquerTexte(t, noms) !== t);
    abimes.length === 0 ? ok(`ce qu'un streamer MONTRE reste lisible (${GARDE.length} cas : N°, dates, comptes de ventes, %, titres)`)
      : nok('ce qu\'un streamer montre reste lisible', abimes.map((t) => `« ${t} » → « ${m.masquerTexte(t, noms)} »`).join(' · '));
    // Un tiret long ou un « - » entre espaces est un SÉPARATEUR, pas une fourchette :
    // la taille d'un titre reste lisible.
    const sep = m.masquerTexte('Zephyr Runner taille 42 — 45 €', noms);
    sep.includes('taille 42') && !sep.includes('45') ? ok('un séparateur « — » n\'emporte pas la taille avec le prix (« taille 42 — ••• € »)') : nok('séparateur « — » et taille', sep);
    // Un code de casier de QUATRE chiffres : masqué là où il se lit comme un code,
    // nulle part ailleurs (un N°, un nombre de vues, une année restent lisibles).
    if (typeof m.noterValeurSensible === 'function') {
      m.noterValeurSensible('4821');
      const c1 = m.masquerTexte('Copier code de retrait 4821', noms), c2 = m.masquerTexte('Identifiant 4821 · Ouverture', noms);
      !c1.includes('4821') && !c2.includes('4821') ? ok('un code de 4 chiffres part après « code de retrait » / « identifiant »') : nok('code court masqué dans son contexte', `${c1} · ${c2}`);
      const hors = 'N°4821 · 4821 vues · le 15/10/2026';
      m.masquerTexte(hors, noms) === hors ? ok('le même nombre HORS d\'un contexte de code reste lisible (N°, vues, date)') : nok('code court masqué hors contexte', m.masquerTexte(hors, noms));
    } else nok('noterValeurSensible est exportée');
    // Un login court (« jo ») n'est pas un nom à chercher : il masquerait le texte autour.
    m.masquerTexte('jolie paire', [{ valeur: 'jo', alias: 'Compte 9' }]) === 'jolie paire'
      ? ok('un nom de moins de 3 lettres ne masque rien autour de lui') : nok('un nom trop court masque le texte autour');
    // Un nom ne se cherche que comme MOT entier.
    m.masquerTexte('tomate et tom', [{ valeur: 'tom', alias: 'Compte 3' }]) === 'tomate et Compte 3'
      ? ok('un nom ne se remplace que comme mot entier (« tomate » reste « tomate »)') : nok('un nom se remplace comme mot entier', m.masquerTexte('tomate et tom', [{ valeur: 'tom', alias: 'Compte 3' }]));
  } else if (m) nok('masquerTexte est exportée');

  // ── 2. LES NOTIFICATIONS DU TÉLÉPHONE (le vrai envoi, exécuté) ─────────────
  try {
    process.env.SUPABASE_SERVICE_KEY = 'audit-cle-service';
    process.env.VAPID_PRIVATE_KEY = 'audit-cle-privee';
    delete process.env.VRM_OWNER_UID;
    const webpush = require(path.join(R, 'node_modules', 'web-push'));
    const partis = [];
    webpush.setVapidDetails = () => {};
    webpush.sendNotification = async (sub, body) => { partis.push(JSON.parse(body)); return { statusCode: 201 }; };
    let modeMain = 'coupe';          // 'allume' · 'coupe' · 'panne'
    global.fetch = async (url) => {
      const u = decodeURIComponent(String(url));
      const rep = (status, corps) => ({ ok: status < 400, status, json: async () => corps, text: async () => JSON.stringify(corps) });
      if (/select=owner/.test(u)) return rep(400, { m: 1 });                      // une seule boutique
      if (/id=eq\.push_subs/.test(u)) return rep(200, [{ data: { subs: [{ endpoint: 'https://push.exemple/1', keys: { p256dh: 'p', auth: 'a' } }] } }]);
      if (/id=eq\.main/.test(u)) {
        if (modeMain === 'panne') return { ok: false, status: 522, json: async () => { throw new Error('html'); }, text: async () => '<html>522' };
        return rep(200, [{ s: modeMain === 'allume' ? { on: true, at: Date.now() } : { on: false, at: Date.now() } }]);
      }
      return rep(200, []);
    };
    const push = await import(require('url').pathToFileURL(path.join(R, 'api', '_lib', 'push.js')).href);
    const NOTIF = { title: '💰 Offre 401,99 € de negociateur_secret', body: '« Zephyr Runner » (zorglub_vend42) — code C98765, 487,13 € viré.', tag: 'offer-1', url: '/?tab=cat_msg' };
    const sensible = (n) => /401,99|487,13|negociateur_secret|zorglub_vend42|C98765/.test(JSON.stringify([n.title, n.body]));
    for (const [cas, attendu] of [['allume', 'masquée'], ['coupe', 'intacte'], ['panne', 'masquée']]) {
      modeMain = cas; partis.length = 0;
      const r = await push.sendPushToAll({ ...NOTIF });
      const n = partis[0];
      if (!n) { nok(`notification (${cas}) : elle part`, JSON.stringify(r)); continue; }
      if (attendu === 'masquée') {
        !sensible(n) && n.url === NOTIF.url
          ? ok(`mode stream ${cas === 'allume' ? 'ALLUMÉ' : 'PAS SU (base 522, juste après un « coupé » lu par la MÊME instance)'} : la notification ne dit ni montant, ni nom, ni code — « ${n.title} · ${n.body} »`)
          : nok(`mode stream ${cas} : notification sans détail`, `${n.title} · ${n.body}`);
      } else {
        n.title === NOTIF.title && n.body === NOTIF.body
          ? ok('mode stream COUPÉ : la notification part telle quelle (l\'autre sens)')
          : nok('mode stream coupé : notification intacte', `${n.title} · ${n.body}`);
      }
    }
  } catch (e) { nok('les notifications du serveur s\'exécutent', String(e && e.stack || e).split('\n').slice(0, 2).join(' ')); }

  // ── 2 bis. LE DOCUMENT : montants et codes COUPÉS EN NŒUDS (vrai navigateur) ─
  // `{min} à {max} €` en JSX fait CINQ nœuds de texte ; seul un navigateur dit
  // ce qui s'affiche vraiment. Le vrai module, une vraie page.
  try {
    const { chromium } = require(path.join(R, 'node_modules', 'playwright'));
    const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--no-proxy-server'] });
    try {
      const pg = await b.newPage();
      await pg.setContent(`<body>
        <div id="baisse"><span style="text-decoration:line-through">60</span> → 53 €</div>
        <div id="fourchette">fourchette 20–45 €</div>
        <div id="plage">38 ventes · de 26,71 à 45,90 €</div>
        <div id="plage2"></div>
        <div id="code">Code de retrait <b>4821</b> · casier</div>
        <div id="casier"><div>Identifiant</div><div>7364</div></div>
        <div id="num">N° <b>4821</b> · <b>7364</b> vues</div>
        <div id="taille">Zephyr Runner taille <b>42</b> — <b>45</b> €</div>
      </body>`);
      await pg.addScriptTag({ type: 'module', content: fs.readFileSync(SRC, 'utf8') + '\nwindow.__ms = { activerStream, noterValeurSensible };' });
      await pg.waitForFunction(() => !!window.__ms, null, { timeout: 5000 });
      const r = await pg.evaluate(async () => {
        // Comme le JSX `de {eur2(min)} à {eur2(max)} €` : cinq nœuds de texte frères.
        const p2 = document.getElementById('plage2');
        for (const x of ['2 ventes · de ', '26,71', ' à ', '45,90', ' €']) p2.appendChild(document.createTextNode(x));
        window.__ms.noterValeurSensible('4821'); window.__ms.noterValeurSensible('7364'); window.__ms.activerStream(true);
        await new Promise((x) => setTimeout(x, 80));
        const t = (i) => document.getElementById(i).innerText.replace(/\s+/g, ' ').trim();
        return { baisse: t('baisse'), fourchette: t('fourchette'), plage: t('plage'), plage2: t('plage2'), code: t('code'), casier: t('casier'), num: t('num'), taille: t('taille') };
      });
      const fuit = ['baisse', 'fourchette', 'plage', 'plage2'].filter((k) => /\d/.test(r[k].replace(/^\d+ ventes/, '')));
      fuit.length === 0 ? ok(`une fourchette ou une baisse coupée en nœuds ne laisse aucun montant (« ${r.baisse} » · « ${r.fourchette} » · « ${r.plage2} »)`) : nok('fourchettes coupées en nœuds', fuit.map((k) => `${k}: ${r[k]}`).join(' · '));
      !/4821|7364/.test(r.code + r.casier) ? ok(`un code de 4 chiffres sous son étiquette est masqué (« ${r.code} » · « ${r.casier} »)`) : nok('code court sous son étiquette', `${r.code} · ${r.casier}`);
      /4821/.test(r.num) && /7364 vues/.test(r.num) && /taille 42/.test(r.taille) && !/45/.test(r.taille)
        ? ok(`l'autre sens : hors étiquette de code, le nombre reste lisible, et un « — » garde la taille (« ${r.num} » · « ${r.taille} »)`) : nok('l\'autre sens (N°, vues, taille)', `${r.num} · ${r.taille}`);
    } finally { await b.close(); }
  } catch (e) { nok('le document se masque dans un vrai navigateur', String(e && e.message).split('\n')[0].slice(0, 160)); }

  // ── 3. LES BRANCHEMENTS ────────────────────────────────────────────────────
  const app = lire('src/App.jsx');
  const sync = (app.match(/const SYNC_KEYS = \[([\s\S]*?)\];/) || [])[1] || '';
  /'vrm_mode_stream'/.test(sync) ? ok('le réglage est synchronisé (SYNC_KEYS : allumé sur l\'ordinateur, il l\'est sur le téléphone)') : nok('vrm_mode_stream dans SYNC_KEYS');
  /onCloudReady\(\(\) => \{[\s\S]{0,400}?CLE_STREAM[\s\S]{0,400}?activerStream/.test(app) ? ok('il est rattrapé à l\'arrivée du nuage (onCloudReady)') : nok('rattrapage onCloudReady du mode stream');
  /<StreamSetting\s*\/>/.test(app) && /function StreamSetting\(/.test(app) ? ok('l\'interrupteur est rendu dans Réglages') : nok('interrupteur rendu dans Réglages');
  /<PastilleStream\s*\/>/.test(app) ? ok('la pastille « Stream » est rendue dans l\'en-tête') : nok('pastille rendue dans l\'en-tête');
  /new Notification\(textePublic\(title\),\s*\{\s*body:\s*textePublic\(body\)/.test(app) ? ok('une notification du navigateur passe par textePublic') : nok('pushNotif passe par textePublic');
  /const codeRetrait = [^\n]*noterValeurSensible\(c\)/.test(app) ? ok('un code de retrait vu par l\'app est noté pour être masqué partout') : nok('codeRetrait note le code');
  (app.match(/noterComptesLbc\(/g) || []).length >= 3 && /definirNoms\('lbc'/.test(app) ? ok('les noms de ses comptes Leboncoin passent au dictionnaire (les deux écrans qui les écrivent)') : nok('noms Leboncoin au dictionnaire');
  /function AppCoeur\(\) \{[\s\S]{0,300}?useLayoutEffect\(\(\) => \{ streamEnAttenteDuNuage\(\)/.test(app) ? ok('une session ouverte masque tant que le réglage du nuage n\'est pas lu (« pas su » ≠ « coupé »)') : nok('streamEnAttenteDuNuage au montage d\'AppCoeur');
  const prives = (app.match(/data-stream="prive"/g) || []).length;
  prives >= 8 ? ok(`le texte des messages, les interlocuteurs et les clients sont marqués privés (${prives} marques)`) : nok('marques data-stream="prive"', String(prives));

  console.log(ko ? `\n❌ mode stream : ${ko} contrôle(s) en échec` : '\n✅ mode stream : règle exécutée, notifications et branchements vérifiés');
  process.exit(ko ? 1 : 0);
})();
