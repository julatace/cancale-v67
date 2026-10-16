// AUCUN MESSAGE NE PART TOUT SEUL — la réponse automatique est RETIRÉE (15 octobre).
//
// Julien, 15 octobre : « ils répondent à mes messages Vinted : enlève, parce que
// l'extension lit les messages et permet de répondre directement sur VRM, mais
// elle n'agit pas toute seule ». C'est sa décision ; elle remplace celle du
// 19 septembre (« tout, elle répond à tout »). Un message envoyé par un
// programme ressemble à un robot (§3, le compte bloqué).
//
// Même forme que `audit-offres-auto.cjs` pour `/accept` — l'INVARIANT, sur le
// code SANS ses commentaires (un commentaire qui raconte l'histoire n'est pas
// du code), puis l'EXÉCUTION du vrai `background.js` :
//   1. extension : la route `/conversations/{id}/replies` n'apparaît QUE dans la
//      liste blanche `EXEC_PERMIS` (la réponse sur son clic, `executerPourApp`),
//      dans aucun autre fichier de l'extension ;
//   2. aucun reste du moteur (fonctions, constantes, lecture de l'interrupteur,
//      question « écris une réponse » à l'IA) ;
//   3. app : `/replies` ne se construit QUE dans `sendReply`, et `sendReply`
//      n'est appelé QUE par un geste (onClick / onKeyDown) — jamais par un
//      effet, un minuteur ou un signal ; plus d'interrupteur, plus de capacité
//      « repond », plus aucune phrase qui promet une réponse automatique ;
//   4. serveur : aucune route ne poste une réponse Vinted ;
//   5. EXÉCUTÉ : le vrai `background.js` dans un `vm`, l'interrupteur ALLUMÉ en
//      base (une ancienne valeur), une question d'acheteur non lue sur une de
//      ses annonces, une IA qui répond « sûre » — une visite Vinted n'envoie
//      AUCUNE réponse et ne demande rien à l'IA ;
//   6. l'AUTRE SENS : sur son clic (origine de l'app), la réponse part, une
//      fois ; depuis une autre origine, rien ; l'interrupteur reste synchronisé
//      et rééteint (les extensions d'avant le retrait le lisent encore).
//
// `--src chemin` : un autre background.js · `--app chemin` : un autre App.jsx ·
// `--racine dossier` : une autre copie du dépôt (preuve §6.1, code d'AVANT).
const fs = require('fs'), path = require('path');
let parser;
try { parser = require(path.join(__dirname, '..', 'node_modules', '@babel', 'parser')); }
catch (_) { parser = require('/home/user/cancale-v67/node_modules/@babel/parser'); }

const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? path.resolve(process.argv[i + 1]) : null; };
const RACINE = arg('--racine') || path.join(__dirname, '..');
const SRC_BG = arg('--src') || path.join(RACINE, 'vinted-sync-extension', 'background.js');
const SRC_APP = arg('--app') || path.join(RACINE, 'src', 'App.jsx');
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'le contrôle a levé : ' + String(e && e.message || e).slice(0, 180)); } };

const parse = (texte, jsx) => parser.parse(texte, { sourceType: jsx ? 'module' : 'script', errorRecovery: true, allowReturnOutsideFunction: true, plugins: jsx ? ['jsx'] : [] });
function sansCommentaires(texte, jsx) {
  const ast = parse(texte, jsx);
  const t = texte.split('');
  for (const c of ast.comments || []) for (let i = c.start; i < c.end; i++) if (t[i] !== '\n') t[i] = ' ';
  return t.join('');
}
const ligneDe = (txt, idx) => txt.slice(0, idx).split('\n').length;
const RE_REPLIES = /\/replies\b/g;

(async () => {
  let BG = '', APP = '', APP_BRUT = '';
  await essaie('lecture du code', async () => {
    BG = sansCommentaires(fs.readFileSync(SRC_BG, 'utf8'), false);
    APP_BRUT = fs.readFileSync(SRC_APP, 'utf8');
    APP = sansCommentaires(APP_BRUT, true);
  });

  // ── 1. extension : `/replies` seulement dans la liste blanche ──────────────
  await essaie('extension : route replies', async () => {
    const debut = BG.indexOf('const EXEC_PERMIS'), fin = debut >= 0 ? BG.indexOf('];', debut) : -1;
    dit(debut >= 0 && fin > debut, "l'extension garde sa liste blanche des actions permises (EXEC_PERMIS)");
    const hors = []; let m; RE_REPLIES.lastIndex = 0;
    while ((m = RE_REPLIES.exec(BG))) {
      if (debut >= 0 && m.index > debut && m.index < fin) continue;
      hors.push('l.' + ligneDe(BG, m.index) + ' « ' + BG.slice(Math.max(0, m.index - 50), m.index + 12).replace(/\s+/g, ' ').trim() + ' »');
    }
    dit(hors.length === 0, "aucun code du fond ne construit une réponse à un message hors de la liste blanche", hors.slice(0, 3).join(' · '));
    // Les autres fichiers de l'extension (pages, ponts) : aucun envoi de réponse.
    const dossier = path.dirname(SRC_BG), autres = [];
    for (const n of fs.readdirSync(dossier)) {
      if (!/\.js$/.test(n) || n === path.basename(SRC_BG)) continue;
      const code = sansCommentaires(fs.readFileSync(path.join(dossier, n), 'utf8'), false);
      RE_REPLIES.lastIndex = 0; let x;
      while ((x = RE_REPLIES.exec(code))) autres.push(n + ' l.' + ligneDe(code, x.index));
    }
    dit(autres.length === 0, "aucun autre fichier de l'extension (pages, pont) n'envoie de réponse", autres.join(', '));
  });

  // ── 2. aucun reste du moteur ────────────────────────────────────────────────
  await essaie('restes du moteur', async () => {
    const restes = ['repondreAuxMessages', 'convDernierMessageId', 'sesAnnonces', 'aiReply', 'MSG_MAX_PAR_VISITE', 'MSG_MIN_CONFIANCE', 'MSG_DEMANDES_MAX', 'panel_msg_repondus', 'vinted_repond_auto']
      .filter((n) => new RegExp('\\b' + n + '\\b').test(BG));
    dit(restes.length === 0, "aucun reste du moteur de réponse automatique dans l'extension", restes.join(', '));
    dit(!/mode\s*:\s*['"]reply['"]/.test(BG), "l'extension ne demande jamais à l'IA d'écrire une réponse (mode « reply »)");
  });

  // ── 3. app : `/replies` seulement dans `sendReply`, appelé sur un geste ─────
  await essaie('app : sendReply sur son clic', async () => {
    const ast = parse(APP_BRUT, true);
    let corps = null; const appels = [];
    const visite = (n, pere, attr) => {
      if (!n || typeof n !== 'object') return;
      if (n.type === 'VariableDeclarator' && n.id && n.id.name === 'sendReply' && n.init) corps = [n.init.start, n.init.end];
      if (n.type === 'Identifier' && n.name === 'sendReply' && !(pere && pere.type === 'VariableDeclarator' && pere.id === n)) appels.push({ at: n.start, attr });
      const prochainAttr = n.type === 'JSXAttribute' && n.name ? n.name.name : attr;
      for (const k of Object.keys(n)) {
        if (k === 'loc' || k === 'start' || k === 'end') continue;
        const v = n[k];
        if (Array.isArray(v)) v.forEach((c) => visite(c, n, prochainAttr)); else if (v && typeof v === 'object' && v.type) visite(v, n, prochainAttr);
      }
    };
    visite(ast.program, null, null);
    dit(!!corps, "l'app a toujours sa réponse manuelle (`sendReply`)");
    const hors = []; let m; RE_REPLIES.lastIndex = 0;
    while ((m = RE_REPLIES.exec(APP))) if (!(corps && m.index > corps[0] && m.index < corps[1])) hors.push('l.' + ligneDe(APP, m.index));
    dit(hors.length === 0, "l'app ne construit une réponse QUE dans `sendReply`", hors.join(', '));
    const pasUnGeste = appels.filter((a) => !['onClick', 'onKeyDown'].includes(a.attr)).map((a) => 'l.' + ligneDe(APP_BRUT, a.at) + (a.attr ? ' (' + a.attr + ')' : ''));
    dit(appels.length > 0 && pasUnGeste.length === 0, '`sendReply` n’est appelé QUE par un geste (clic sur Envoyer, Entrée) — jamais par un effet, un minuteur ou un signal',
      pasUnGeste.join(', ') || (appels.length ? '' : 'aucun appel'));
  });
  await essaie('app : rien ne promet', async () => {
    dit(!/\bRepondreSetting\b/.test(APP), "plus d'interrupteur « Répondre à mes messages » dans Réglages");
    const cap = /const EXT_CAPACITES\s*=\s*\{([^}]*)\}/.exec(APP);
    dit(!!cap && !/\brepond\s*:/.test(cap[1]), "l'app ne déclare plus de capacité « repond » à l'extension", cap ? '' : 'EXT_CAPACITES introuvable');
    dit(!/extSait\(\s*['"]repond['"]\s*\)/.test(APP), 'plus aucune décision de l’app sur cette capacité');
    const promesses = []; let m;
    const re = /r[ée]pon\w*[^\n<>{}`'"]{0,40}(automatiquement|tout(?:e)?\s+seule?|à ta place|à sa place|en ton nom)/gi;
    while ((m = re.exec(APP))) promesses.push('l.' + ligneDe(APP, m.index) + ' « ' + m[0].slice(0, 60) + ' »');
    dit(promesses.length === 0, "aucune phrase de l'app ne promet une réponse automatique", promesses.slice(0, 3).join(' · '));
  });

  // ── 3b. les PAGES PUBLIQUES non plus (revue du 15 octobre) ─────────────────
  // La page d'accueil (« Les automatismes — répondre aux questions des
  // acheteurs… — restent éteints tant que tu ne les allumes pas ») et les pages
  // légales (CGU, confidentialité) promettaient encore la réponse automatique
  // RETIRÉE — et ce contrôle ne lisait que `App.jsx` : il était vert dessus.
  // On juge la PROMESSE (une réponse automatique, une réponse aux acheteurs
  // rangée parmi les automatismes), jamais le mot « répondre » : la phrase
  // honnête « VRM refuse… de répondre à un acheteur à ta place » doit passer.
  await essaie('pages publiques', async () => {
    const PAGES = ['src/Accueil.jsx', 'src/accueil-carte.jsx', 'src/accueil-scenes.jsx', 'src/accueil-demo.js', 'src/AccueilFilm.jsx',
      'public/legal/cgu.html', 'public/legal/confidentialite.html', 'public/legal/cgv.html', 'public/legal/mentions-legales.html', 'public/legal/cookies.html'];
    const fautes = [];
    for (const f of PAGES) {
      let t = ''; try { t = fs.readFileSync(path.join(RACINE, f), 'utf8'); } catch (_) { continue; }
      t = /\.html$/.test(f) ? t.replace(/<!--[\s\S]*?-->/g, ' ') : sansCommentaires(t, true);
      const motifs = [
        [/r[ée]ponses?\s+automatiques?/gi, 'réponse automatique'],
        [/r[ée]pon(?:dre|se)\s+aux\s+questions\s+des\s+acheteurs/gi, 'réponse aux questions des acheteurs'],
        [/data-automatisme[^>]*>[^<]{0,80}r[ée]pon/gi, 'un automatisme qui répond'],
      ];
      for (const [re, nom] of motifs) { re.lastIndex = 0; let m; while ((m = re.exec(t))) fautes.push(`${f} l.${ligneDe(t, m.index)} (${nom})`); }
    }
    dit(fautes.length === 0, 'ni la page d’accueil ni les pages légales ne promettent une réponse automatique aux acheteurs', fautes.slice(0, 4).join(' · '));
  });

  // ── 4. serveur : aucune route ne poste une réponse Vinted ──────────────────
  await essaie('serveur', async () => {
    const fautes = [];
    for (const d of ['api', path.join('api', '_lib')]) {
      let noms = []; try { noms = fs.readdirSync(path.join(RACINE, d)); } catch (_) {}
      for (const n of noms) {
        if (!/\.js$/.test(n)) continue;
        const code = sansCommentaires(fs.readFileSync(path.join(RACINE, d, n), 'utf8'), false);
        if (/conversations\/[^'"`\s]*\/replies/.test(code)) fautes.push(path.join(d, n));
      }
    }
    dit(fautes.length === 0, 'aucune route du serveur ne poste une réponse Vinted', fautes.join(', '));
  });

  // ── 5 et 6. le vrai background.js, exécuté ──────────────────────────────────
  const { faireFond } = require('./_fond-vm.cjs');
  const UID = '111';
  const lignes = () => ({
    // Une ANCIENNE valeur allumée en base : une extension qui la lit encore répondrait.
    main: { vinted_repond_auto: true, vinted_accounts: [] },
    [`harvest_${UID}_listings`]: { capturedAt: new Date().toISOString(), payload: { items: [{ id: 444, title: 'Nike Air Max 1', is_closed: false }] } },
    [`harvest_${UID}_inbox`]: { capturedAt: new Date().toISOString(), payload: { conversations: [{ id: 301, unread: true, updated_at: new Date().toISOString(), description: 'Nike Air Max 1', opposite_user: { id: 5301, login: 'acheteuse_1' } }] } },
    [`harvest_${UID}_conv_301`]: { capturedAt: new Date().toISOString(), payload: { conversation: { id: 301, allow_reply: true, description: 'Nike Air Max 1',
      opposite_user: { id: 5301, login: 'acheteuse_1' }, transaction: { id: 9001, item_id: 444 },
      messages: [{ entity_type: 'message', entity: { id: 77, user_id: 5301, body: 'Bonjour, toujours disponible ?' } }] } } },
    panel_msg_repondus: {},
  });
  const vinted = (r) => {
    const c = r.chemin;
    if (/\/replies$/.test(c)) return { status: 200, body: { message: { id: 1 } } };
    if (/\/api\/v2\/users\/current/.test(c)) return { status: 200, body: { user: { id: 9001, login: 'compte_banc' } } };
    if (/\/my_orders/.test(c)) return { status: 200, body: { my_orders: [], pagination: { total_entries: 0 } } };
    if (/\/inbox/.test(c)) return { status: 200, body: { conversations: [] } };
    if (/\/wardrobe\//.test(c)) return { status: 200, body: { items: [], pagination: { total_pages: 1 } } };
    if (/\/api\/v2\/conversations\/\d+$/.test(c)) return { status: 200, body: { conversation: { id: 301, messages: [] } } };
    return { status: 404, body: {} };
  };
  // Une IA qui répond « sûre » : si un chemin lui demande une réponse, il en aura une.
  const brancherIA = (f) => {
    const f0 = f.ctx.fetch; f.ia = 0;
    f.ctx.fetch = async (url, opts) => {
      if (/\/api\/ai\b/.test(String(url))) {
        f.ia++;
        const t = JSON.stringify({ ok: true, intent: 'disponibilite', confidence: 95, suggestions: [{ text: 'Oui, toujours disponible !' }] });
        return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => JSON.parse(t), text: async () => t, clone() { return this; } };
      }
      return f0(url, opts);
    };
  };
  const reponses = (f) => f.j.vinted.filter((x) => /\/replies$/.test(x.chemin));

  console.log('── 5. une visite Vinted, interrupteur ALLUMÉ en base, une question d’acheteur non lue');
  await essaie('visite', async () => {
    const f = faireFond({ src: SRC_BG, lignes: lignes(), vinted });
    brancherIA(f);
    if (typeof f.ctx.visiteVinted !== 'function') { dit(false, 'la visite Vinted est trouvable (`visiteVinted`)'); return; }
    await f.ctx.visiteVinted();
    await new Promise((r) => setTimeout(r, 30));
    const env = reponses(f);
    dit(f.j.vinted.length > 0, 'la visite a bien travaillé (elle a lu Vinted)', `${f.j.vinted.length} requête(s)`);
    dit(env.length === 0, 'aucune réponse n’est partie chez Vinted pendant la visite', env.map((x) => x.methode + ' ' + x.chemin).join(', '));
    dit(f.ia === 0, 'et l’IA n’a pas été sollicitée pour écrire une réponse', `${f.ia} appel(s) à /api/ai`);
    const ecrits = [].concat(...f.j.posts).filter((id) => id === 'panel_msg_repondus');
    dit(ecrits.length === 0, 'aucun journal de « réponses envoyées en ton nom » n’est écrit', ecrits.join(', '));
  });

  console.log('── 6. l’autre sens : la réponse SUR SON CLIC part, une fois');
  await essaie('clic', async () => {
    const f = faireFond({ src: SRC_BG, lignes: lignes(), vinted });
    const corps = { reply: { body: 'Oui, toujours disponible !', photo_temp_uuids: null, is_personal_data_sharing_check_skipped: false } };
    const r = await f.envoyer({ from: 'vmr-bridge', action: 'exec', uid: UID, method: 'POST', endpoint: '/api/v2/conversations/301/replies', body: corps }, { origin: 'https://vrm.center', url: 'https://vrm.center/' });
    const env = reponses(f);
    dit(r && r.ok && env.length === 1 && env[0].methode === 'POST' && env[0].chemin === '/api/v2/conversations/301/replies',
      'depuis l’app (son clic), la réponse part — une seule fois, sur CETTE conversation', JSON.stringify({ ok: r && r.ok, env: env.map((x) => x.chemin) }));
    const g = faireFond({ src: SRC_BG, lignes: lignes(), vinted });
    const r2 = await g.envoyer({ from: 'vmr-bridge', action: 'exec', uid: UID, method: 'POST', endpoint: '/api/v2/conversations/301/replies', body: corps }, { origin: 'https://www.vinted.fr', url: 'https://www.vinted.fr/inbox' });
    dit(!(r2 && r2.ok) && reponses(g).length === 0, 'depuis une autre origine (une page Vinted), rien ne part', JSON.stringify(r2));
  });
  await essaie('interrupteur gardé éteint', async () => {
    const sync = /const SYNC_KEYS\s*=\s*\[([\s\S]*?)\];/.exec(APP);
    dit(!!sync && /'vinted_repond_auto'/.test(sync[1]), '`vinted_repond_auto` reste synchronisé (une extension d’avant le retrait le lit encore : absent ou faux, elle se tait)');
    dit(/onCloudReady\(\s*eteindreReponseAuto\s*\)/.test(APP) && /save\(\s*'vinted_repond_auto'\s*,\s*false\s*\)/.test(APP),
      'et l’app le rééteint si un appareil l’avait encore allumé (après le chargement du nuage)');
  });

  console.log(ko ? `\n❌ audit-reponses-auto : ${ko} contrôle(s) rouge(s), ${ok} vert(s)` : `\n✅ audit-reponses-auto : ${ok} contrôles — aucun message ne part sans son clic`);
  process.exit(ko ? 1 : 0);
})();
