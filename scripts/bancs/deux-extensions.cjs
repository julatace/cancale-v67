// Banc : DEUX EXTENSIONS VRM DANS LE MÊME CHROME (9-11 octobre, extension 5.165).
//
// Julien, 9 octobre ~18:40 : « l'extension ne répond pas », juste après avoir
// installé la 5.164. MESURÉ (Chromium réel, vraies extensions, journaux de la
// base) : une copie plus ancienne de VRM tournait À CÔTÉ (5.143, et une ≤ 5.77
// vivante à 18:37). Alors :
//   · chaque commande et chaque envoi de l'app étaient exécutés par LES DEUX
//     (« cmd:bordereau ×2 », « exec …/replies ×2 ») — deux files « une requête à
//     la fois », deux budgets de 20 actions/h, une réponse envoyée deux fois (§3) ;
//   · l'app affichait la version du DERNIER « ready » reçu : « Mets l'extension à
//     jour (5.163.0) » à quelqu'un qui venait de le faire — le mauvais geste ;
//   · la session que l'app tend à l'extension était adoptée par les deux, qui se
//     la tuaient en la renouvelant (`refresh_token_already_used`).
// Le banc rejoue la VRAIE forme du dialogue (`ping` → `ready {version[, id]}`,
// `etat`, `cmd`, `exec`, `session`) avec DEUX ponts dans la même page, sur des
// données INVENTÉES (il vit dans le dépôt, qui est public). Il exige :
//   1. deux extensions (versions différentes) ⇒ l'en-tête dit « Lecture seule »
//      avec le code `plusieurs`, la raison est dite UNE fois et NOMME les deux
//      versions, le geste est « chrome://extensions » + « Recharger la page » —
//      jamais « mets à jour » ;
//   2. AUCUNE commande, AUCUN envoi, AUCUNE session ne part vers l'un ou l'autre ;
//   3. deux copies de la MÊME version (identifiants différents) ⇒ pareil ;
//   4. l'AUTRE SENS : une seule extension dont le pont répond deux fois (même
//      identifiant) ⇒ PAS « plusieurs », le bouton est actif et la commande part
//      UNE fois ; un ancien pont qui s'est tu (orphelin) ⇒ pas « plusieurs » ;
//   5. la version retenue est la plus HAUTE, pas la dernière arrivée ;
//   6. (11 octobre) la session ne passe plus par la page : adressée à UNE
//      extension (son identifiant, son nonce) — une copie ancienne qui écoute
//      la page n'entend rien, et l'app ne lui prête jamais la sienne.
//   7. (seconde revue du 11 octobre) la liaison aboutit À CÔTÉ d'une copie
//      ancienne vivante : le bandeau ne dit pas « rien d'autre à faire »
//      au-dessus de « Lecture seule » — il porte le même blocage que la pastille
//      (`data-liaison-reste`) et le geste ; seule, il ne l'invente pas.
// Ce qui est jugé : des `data-*` et ce que les ponts ont REÇU — pas une formulation.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 4793;

const auj = Date.now();
const iso = (h) => new Date(auj - h * 3600e3).toISOString();
const ACCS = [
  { id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: iso(0) },
  { id: 2, vinted_user_id: '222', login: 'compte_b', domain: 'www.vinted.fr', updated_at: iso(0) },
];
const vente = (id, titre) => ({ transaction_id: id, title: titre, price: { amount: '60', currency_code: 'EUR' }, status: 'Le paiement a été validé', date: iso(1) });
const conv = (id, login, desc, unread, h) => ({ id, unread, updated_at: iso(h), description: desc, opposite_user: { id: 5000 + id, login } });
const rows = [
  { id: 'harvest_111_orders_sold', data: { capturedAt: iso(0), payload: { my_orders: [vente(7001, 'Paire test A')] } } },
  { id: 'harvest_222_orders_sold', data: { capturedAt: iso(0), payload: { my_orders: [] } } },
  // Une conversation PAS encore captée : l'app demande à l'extension de la lire (`exec` GET).
  { id: 'harvest_222_inbox', data: { capturedAt: iso(0), payload: { conversations: [conv(402, 'acheteur_2', 'Toujours dispo ?', true, 1)] } } },
];

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

// Les ponts simulés, injectés AVANT l'app. Chacun est une extension :
//   { version, id ('' = un pont d'avant la 5.165, qui ne dit pas son identifiant),
//     double (le même pont répond deux fois — une seule extension),
//     tu (s'est tu après son premier « ready » : un orphelin depuis la 5.129) }.
// Chaque pont note ce qu'il REÇOIT : c'est ce que son service worker exécuterait.
const PONTS = ({ ponts, connecte, vrm }) => {
  window.__recus = [];
  window.__sessions = [];
  window.__externes = [];
  // `externally_connectable` (5.171) : la page peut ADRESSER un message à une
  // extension par son identifiant ; seule celle-là le reçoit.
  const adressables = ponts.filter((p) => p.adresse && p.id);
  if (adressables.length) {
    window.chrome = { runtime: { lastError: null, sendMessage(id, msg, cb) {
      const p = adressables.find((x) => x.id === id);
      window.__externes.push({ id, type: msg && msg.type, nonce: msg && msg.nonce || null, recu: !!p });
      let r;
      if (!p) r = undefined;
      else if (msg.type === 'liaison') r = { ok: true, besoin: true, nonce: 'n'.repeat(32), raison: 'aucune' };
      else if (msg.type === 'session') r = msg.nonce === 'n'.repeat(32) ? { ok: true, email: 'vendeur@exemple.test' } : { ok: false, code: 'nonce' };
      // Elle a reçu SA session : son état le dit ensuite (comme le vrai fond).
      if (r && r.ok && msg.type === 'session') window.__vrmApres = { ok: true, connecte: true, email: 'vendeur@exemple.test', user_id: '11111111-2222-3333-4444-555555555555' };
      setTimeout(() => cb && cb(r), 5);
    } } };
  }
  window.addEventListener('message', (e) => { const d = e.data; if (e.source === window && d && d.__vmr === 'session' && d.session) window.__sessions.push(1); });
  const post = (m) => window.postMessage(m, '*');
  ponts.forEach((p, i) => {
    const nom = 'pont' + i + ':' + p.version;
    const ready = () => post(Object.assign({ __vmr: 'ready', version: p.version }, p.id ? { id: p.id } : {}));
    // Un pont qui s'est tu (orphelin depuis la 5.129) : il a pu annoncer « ready »
    // en arrivant, il ne répond plus à rien ensuite — ni « ping », ni commande.
    let vivant = !p.tu;
    window.addEventListener('message', (e) => {
      const d = e.data; if (e.source !== window || !d || typeof d !== 'object' || !vivant) return;
      const n = p.double ? 2 : 1;
      for (let k = 0; k < n; k++) {
        if (d.__vmr === 'ping') ready();
        if (k) continue;                     // le second pont d'une même extension relaie au MÊME service worker
        if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: Object.assign({ ok: true, version: p.version, vrm: window.__vrmApres || vrm || { ok: true, connecte: true, email: '' }, vinted: { uid: connecte, login: 'compte_a' }, cmds: {} }, p.adresse ? { code: p.version, ext: p.id } : {}) });
        if (d.__vmr === 'cmd') { window.__recus.push(nom + ' cmd:' + d.cmd); post({ __vmr: 'cmd:result', reqId: d.reqId, resp: d.cmd === 'bordereau' ? { accepte: true, jobId: `bord:${d.uid}:${d.tx}`, etape: 'file' } : { accepte: true, etape: 'recent' } }); }
        if (d.__vmr === 'exec') { window.__recus.push(nom + ' exec:' + d.method + ' ' + d.endpoint); post({ __vmr: 'result', reqId: d.reqId, ok: true, status: 200, data: { conversation: { id: 402, messages: [] } } }); }
        if (d.__vmr === 'session' && d.session) window.__recus.push(nom + ' session');
      }
    });
    ready();
  });
};

async function rendre(b, { ponts, onglet = 'cat_ventes', tel = false, vrm = null, session = false }) {
  const vp = tel ? { width: 390, height: 844 } : { width: 1512, height: 950 };
  const ctx = await b.newContext({ viewport: vp, ...(tel ? { isMobile: false, hasTouch: false } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const SESSION = { access_token: 'jeton-de-l-app', refresh_token: 'jeton-r', expires_at: Date.now() + 3600e3, user: { id: '11111111-2222-3333-4444-555555555555', email: 'vendeur@exemple.test' } };
  await pg.addInitScript((sess) => { try { if (sess) localStorage.setItem('vrm_session', JSON.stringify(sess)); else localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} }, session ? SESSION : null);
  await pg.addInitScript(PONTS, { ponts, connecte: '111', vrm });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  // Le faux GoTrue APRÈS le fourre-tout des hôtes externes : Playwright prend la
  // DERNIÈRE route en premier (§6.6) — posé avant, il n'était jamais atteint, et
  // `PorteMfa` restait sur « pas su ». `GET /user` rend la fiche utilisateur (§6.3).
  if (session) await pg.route('**/auth/v1/**', (r) => {
    const chemin = new URL(r.request().url()).pathname.replace(/^.*\/auth\/v1\//, '');
    const corps = chemin === 'user' ? { id: SESSION.user.id, email: SESSION.user.email, aud: 'authenticated' } : { ...SESSION, expires_in: 3600 };
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(corps) });
  });
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (/select=owner/.test(u)) return session ? j([]) : route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && !/^id,data|^data,updated_at/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: iso(0), cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(rows.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => {
    const u = r.request().url();
    if (/mode=session-extension/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, session: { access_token: 'x', refresh_token: 'y', expires_at: Date.now() + 3600e3, user_id: SESSION.user.id, email: SESSION.user.email } }) });
    if (/mode=abonnement/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, acces: true, statut: 'active' }) });
    if (/vinted-proxy/.test(u)) return r.fulfill({ status: 503, contentType: 'application/json', body: '{"erreur":"pas-su"}' });
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' });
  });
  await pg.goto(`http://localhost:${PORT}/?tab=${onglet}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(4500);
  // Machine chargée : la liste des ventes peut arriver après 4,5 s (10 rouges
  // sur un écran intact le 20 oct.). On attend l'ÉTAT — les ventes rendues —,
  // borné ; les contrôles restent exacts.
  if (onglet === 'cat_ventes') await pg.waitForSelector('[data-bouton-bord]', { state: 'attached', timeout: 15000 }).catch(() => {});
  const lire = () => pg.evaluate(() => ({
    boutons: [...document.querySelectorAll('[data-bouton-bord]')].map((x) => ({ etat: x.getAttribute('data-bouton-bord'), tx: x.getAttribute('data-tx'), txt: x.innerText })),
    raisons: [...document.querySelectorAll('[data-raison-bord]')].map((x) => ({ code: x.getAttribute('data-raison-bord'), txt: x.innerText })),
    recharger: document.querySelectorAll('[data-raison-bord] [data-recharger]').length,
    etat: (() => { const x = document.querySelector('[data-etat-actions]'); return x ? { niveau: x.getAttribute('data-etat-actions'), code: x.getAttribute('data-etat-code') } : null; })(),
    recus: window.__recus || [], sessions: (window.__sessions || []).length, externes: window.__externes || [],
    sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
  }));
  const panneau = async () => {
    if (!(await pg.$('[data-etat-actions]'))) return null;
    await pg.click('[data-etat-actions]'); await pg.waitForTimeout(250);
    return pg.evaluate(() => { const p = document.querySelector('[data-etat-panneau]'); if (!p) return null;
      const g = p.querySelector('[data-etat-geste]');
      return { txt: p.innerText, geste: g ? g.getAttribute('data-etat-geste') : null, recharger: !!p.querySelector('[data-etat-geste-recharger]') }; });
  };
  // Depuis 5cdffcb (20 oct., choix de Julien) une vente est une ligne REPLIÉE :
  // son bouton n'est visible qu'une fois la ligne touchée. On l'ouvre comme une
  // personne, puis on attend le bouton visible (un état, pas un délai).
  const ouvrirVente = async (sel = '[data-bouton-bord]') => {
    const ouverte = await pg.evaluate((sel) => { const b = document.querySelector(sel); if (!b) return null;
      // (21 oct.) Le détail d'une vente vit dans un TIROIR (portail sur <body>,
      // caché tant qu'il est fermé) : on ouvre la ligne qui le commande.
      const tiroir = b.closest('.vrm-ledger-drawer');
      if (tiroir) { const host = tiroir.closest('.vrm-ledger-drawer-host'); if (host && !host.hidden) return true;
        const t = document.querySelector(`.vrm-ledger-sale-toggle[aria-controls="${tiroir.id}"]`); if (!t) return false; t.setAttribute('data-banc-ouvrir', '1'); return false; }
      const ligne = b.closest('[data-ligne-ouverte]'); if (!ligne || ligne.getAttribute('data-ligne-ouverte') === 'true') return true;
      const t = ligne.querySelector('.vrm-ledger-sale-toggle'); if (!t) return false; t.setAttribute('data-banc-ouvrir', '1'); return false; }, sel);
    if (ouverte === null) return false;
    if (!ouverte) await pg.click('[data-banc-ouvrir="1"]').catch(() => {});
    return pg.waitForFunction((sel) => { const x = document.querySelector(sel); const b = x && (x.querySelector('button') || x); if (!b) return false;
      const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0; }, sel, { timeout: 5000 }).then(() => true, () => false);
  };
  return { ctx, pg, errs, lire, panneau, ouvrirVente };
}

(async () => {
  let b;
  const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' : le scénario a tourné jusqu’au bout', String(e && e.message).slice(0, 200)); } };
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });

    for (const tel of [false, true]) {
      const t = tel ? '390 px' : '1512 px';
      console.log(`── 1. ${t} — une 5.143 restée installée À CÔTÉ de la 5.165`);
      await essaie('1 ' + t, async () => {
        // L'ANCIENNE annonce en dernier : c'était la version affichée avant.
        const r = await rendre(b, { tel, ponts: [{ version: '5.165.0', id: 'idnouvelle' }, { version: '5.143.0' }] });
        const v = await r.lire();
        dit(v.etat && v.etat.niveau === 'lecture' && v.etat.code === 'plusieurs', `${t} : l’en-tête dit « Lecture seule » parce qu’il y en a DEUX (code plusieurs)`, JSON.stringify(v.etat));
        dit(v.raisons.length === 1 && v.raisons[0].code === 'plusieurs', `${t} : la raison est dite UNE fois au-dessus des ventes`, JSON.stringify(v.raisons.map((x) => x.code)));
        dit(v.raisons[0] && /5\.143\.0/.test(v.raisons[0].txt) && /5\.165\.0/.test(v.raisons[0].txt) && /chrome:\/\/extensions/.test(v.raisons[0].txt), `${t} : elle NOMME les deux versions et le geste (chrome://extensions)`, v.raisons[0] && v.raisons[0].txt);
        dit(v.raisons[0] && !/mets l.extension à jour/i.test(v.raisons[0].txt), `${t} : jamais « mets l’extension à jour » à quelqu’un qui vient de le faire`, v.raisons[0] && v.raisons[0].txt);
        dit(v.recharger === 1, `${t} : avec le bouton « Recharger la page »`, `boutons : ${v.recharger}`);
        dit(v.boutons.length === 1 && v.boutons[0].etat === 'grise', `${t} : « Générer le bordereau » reste VISIBLE mais grisé`, JSON.stringify(v.boutons));
        if (!tel) {
          await r.pg.evaluate(() => { const x = document.querySelector('[data-bouton-bord] button'); if (x) x.click(); });
          await r.pg.waitForTimeout(800);
        }
        const v2 = await r.lire();
        dit(v2.recus.filter((x) => / cmd:/.test(x)).length === 0, `${t} : AUCUNE commande ne part, vers aucune des deux (ni bordereau, ni relecture des ventes)`, JSON.stringify(v2.recus));
        const p = await r.panneau();
        dit(p && p.geste === 'extensions' && p.recharger && /5\.143\.0/.test(p.txt) && /5\.165\.0/.test(p.txt), `${t} : le panneau de l’en-tête dit les deux versions et le geste`, JSON.stringify(p && { geste: p.geste, txt: p.txt.slice(0, 260) }));
        dit(p && /allumée · 5\.165\.0|5\.165\.0/.test(p.txt) && !/version 5\.143\.0 — trop ancienne/.test(p.txt), `${t} : la version retenue est la plus HAUTE, jamais « 5.143 trop ancienne »`, p && p.txt.slice(0, 260));
        dit(v2.sw <= v2.cw + 1, `${t} : aucun débordement`, `${v2.sw} > ${v2.cw}`);
        dit(r.errs.length === 0, `${t} : aucune erreur d’app`, r.errs.join(' | ').slice(0, 160));
        await r.pg.screenshot({ path: path.join(os.tmpdir(), `deux-extensions-${tel ? 390 : 1512}.png`) });
        await r.ctx.close();
      });
    }

    console.log('── 2. Messages : un fil pas encore capté n’est PAS lu deux fois');
    await essaie('2', async () => {
      const r = await rendre(b, { onglet: 'cat_msg', ponts: [{ version: '5.165.0', id: 'idnouvelle' }, { version: '5.143.0' }] });
      try { await r.pg.selectOption('#vrm-sel-compte', '*'); await r.pg.waitForTimeout(300); } catch (_) {}
      await r.pg.click('[data-conv="402"]');
      await r.pg.waitForTimeout(1500);
      const v = await r.lire();
      dit(v.recus.filter((x) => / exec:/.test(x)).length === 0, 'aucun « exec » ne part vers l’une ou l’autre', JSON.stringify(v.recus));
      await r.ctx.close();
    });

    console.log('── 3. La session : l’extension pas connectée ne reçoit RIEN tant qu’elles sont deux');
    await essaie('3', async () => {
      const r = await rendre(b, { session: true, vrm: { ok: true, connecte: false, email: '' }, ponts: [{ version: '5.165.0', id: 'idnouvelle' }, { version: '5.164.0' }] });
      await r.pg.waitForTimeout(1500);
      const v = await r.lire();
      dit(v.sessions === 0 && !v.recus.some((x) => / session/.test(x)), 'aucune session postée (les deux l’adopteraient et se la tueraient)', JSON.stringify({ sessions: v.sessions, recus: v.recus }));
      await r.ctx.close();
    });

    console.log('── 4. Deux copies de la MÊME version (identifiants différents)');
    await essaie('4', async () => {
      const r = await rendre(b, { ponts: [{ version: '5.165.0', id: 'idA' }, { version: '5.165.0', id: 'idB' }] });
      const v = await r.lire();
      dit(v.etat && v.etat.code === 'plusieurs' && v.raisons.length === 1 && /n.en garde qu.une/.test(v.raisons[0].txt), 'aussi « plusieurs », avec « n’en garde qu’une »', JSON.stringify({ e: v.etat, r: v.raisons }));
      await r.ctx.close();
    });

    console.log('── 5. L’AUTRE SENS : une seule extension, son pont répond deux fois');
    await essaie('5', async () => {
      const r = await rendre(b, { ponts: [{ version: '5.165.0', id: 'idA', double: true }] });
      const v = await r.lire();
      dit(v.etat && v.etat.code !== 'plusieurs' && v.raisons.length === 0, 'PAS « plusieurs » (même identifiant : une extension)', JSON.stringify({ e: v.etat, r: v.raisons }));
      dit(v.boutons[0] && v.boutons[0].etat === 'pret', 'le bouton est ACTIF', JSON.stringify(v.boutons));
      dit(await r.ouvrirVente('[data-bouton-bord="pret"]'), 'la ligne de la vente s’ouvre et montre le bouton (repliée au repos)');
      await r.pg.click('[data-bouton-bord="pret"] button');
      await r.pg.waitForTimeout(800);
      const v2 = await r.lire();
      dit(v2.recus.filter((x) => /cmd:bordereau/.test(x)).length === 1, 'et la commande part UNE fois', JSON.stringify(v2.recus));
      await r.ctx.close();
    });

    console.log('── 6. L’AUTRE SENS : un ancien pont qui s’est tu (orphelin) + la 5.165');
    await essaie('6', async () => {
      const r = await rendre(b, { ponts: [{ version: '5.143.0', tu: true }, { version: '5.165.0', id: 'idA' }] });
      const v = await r.lire();
      dit(v.etat && v.etat.code !== 'plusieurs' && v.raisons.length === 0 && v.boutons[0] && v.boutons[0].etat === 'pret', 'un pont muet ne compte pas : une extension, actions possibles', JSON.stringify({ e: v.etat, r: v.raisons, b: v.boutons }));
      await r.ctx.close();
    });
    console.log('── 7. (11 octobre) Une 5.171 + une copie ancienne muette : la session va à LA BONNE, adressée');
    await essaie('7', async () => {
      const A = 'abcdefghijklmnopabcdefghijklmnop';
      const r = await rendre(b, { session: true, vrm: { ok: true, connecte: false, email: '' }, ponts: [{ version: '5.143.0', tu: true }, { version: '5.171.0', id: A, adresse: true }] });
      await r.pg.waitForTimeout(1500);
      const v = await r.lire();
      const env = v.externes.filter((x) => x.type === 'session');
      dit(v.etat && v.etat.code !== 'plusieurs', 'une copie muette ne compte pas : une seule extension', JSON.stringify(v.etat));
      dit(env.length === 1 && env[0].id === A && env[0].recu && env[0].nonce === 'n'.repeat(32), 'la session part À CETTE extension (son identifiant, le nonce qu’elle a émis)', JSON.stringify(v.externes));
      dit(v.externes.every((x) => x.id === A), 'et à aucune autre', JSON.stringify(v.externes));
      dit(v.sessions === 0 && !v.recus.some((x) => / session/.test(x)), 'RIEN dans la page : la copie ancienne qui écoute la page n’entend rien (avant : elle adoptait la même famille de jetons)', JSON.stringify({ sessions: v.sessions, recus: v.recus }));
      await r.ctx.close();
    });
    // ⚠️ Revue du 11 octobre : « Se connecter avec VRM » cliqué dans la NEUVE
    //    pendant qu'une copie ancienne répond encore au ping. Le bandeau restait
    //    « Je connecte… Rien à taper » pour toujours, sans croix, sous une
    //    pastille « supprime l'ancienne » — et rien ne partait.
    // ⚠️⚠️ Seconde revue du 11 octobre : une fois la session partie, le bandeau
    //    disait « Extension connectée ✓ — elle capte maintenant pour toi. Rien
    //    d'autre à faire. » AU-DESSUS de la pastille « Lecture seule » (deux
    //    extensions : aucune commande ne part). Deux voix contraires sur le même
    //    écran — et « rien d'autre à faire » était faux (il reste à supprimer
    //    l'ancienne). Le cas a deux moitiés, et le banc juge le rendu COMBINÉ :
    //    l'état que porte le bandeau (`data-liaison-reste`) est celui de la
    //    pastille, et sa phrase ne promet rien que la pastille dément.
    for (const tel of [false, true]) {
      const t = tel ? '390 px' : '1512 px';
      console.log(`── 8. ${t} (11 octobre) « Se connecter avec VRM » avec une copie ancienne VIVANTE à côté — Ma journée`);
      await essaie('8 ' + t, async () => {
        const A = 'abcdefghijklmnopabcdefghijklmnop';
        const r = await rendre(b, { tel, session: true, onglet: 'journee&lier-extension=' + A, vrm: { ok: true, connecte: false, email: '' }, ponts: [{ version: '5.77.0' }, { version: '5.171.0', id: A, adresse: true }] });
        await r.pg.waitForTimeout(3000);
        const v = await r.lire();
        const band = await r.pg.evaluate(() => { const x = document.querySelector('[data-liaison]'); return x ? { etat: x.getAttribute('data-liaison'), reste: x.getAttribute('data-liaison-reste'), fermer: !!x.querySelector('button[aria-label="Fermer"]'), txt: x.innerText } : null; });
        const env = v.externes.filter((x) => x.type === 'session');
        dit(v.etat && v.etat.niveau === 'lecture' && v.etat.code === 'plusieurs', `${t} : deux extensions répondent : la pastille dit « Lecture seule » (plusieurs)`, JSON.stringify(v.etat));
        dit(env.length === 1 && env[0].id === A && env[0].recu, `${t} : la session part quand même, ADRESSÉE à celle qui a demandé`, JSON.stringify(v.externes));
        dit(v.sessions === 0 && !v.recus.some((x) => / session/.test(x)) && !v.recus.some((x) => /cmd:|exec:/.test(x)), `${t} : rien dans la page, et aucune commande n’est relayée (les commandes restent coupées)`, JSON.stringify(v.recus));
        dit(band && band.etat === 'ok' && band.fermer, `${t} : le bandeau dit le résultat, et se ferme — plus de « Je connecte… » éternel`, JSON.stringify(band && { etat: band.etat, fermer: band.fermer }));
        dit(band && v.etat && band.reste === v.etat.code, `${t} : le bandeau porte ce qui bloque encore, et c’est ce que dit la pastille (une notion, une voix)`, JSON.stringify({ bandeau: band && band.reste, pastille: v.etat && v.etat.code }));
        dit(band && !/rien d.autre à faire|rien à faire|capte maintenant/i.test(band.txt), `${t} : il n’affirme pas « rien d’autre à faire » au-dessus de « Lecture seule »`, band && band.txt.replace(/\n/g, ' · '));
        dit(band && /chrome:\/\/extensions/.test(band.txt), `${t} : il dit le geste qui reste (chrome://extensions)`, band && band.txt.replace(/\n/g, ' · '));
        dit(v.sw <= v.cw + 1, `${t} : aucun débordement`, `${v.sw} > ${v.cw}`);
        dit(r.errs.length === 0, `${t} : aucune erreur d’app`, r.errs.join(' | ').slice(0, 160));
        await r.pg.screenshot({ path: path.join(os.tmpdir(), `deux-extensions-liaison-${tel ? 390 : 1512}.png`) });
        await r.ctx.close();
      });
    }
    // L'AUTRE SENS : une seule extension, la liaison aboutit — le bandeau
    //    n'invente aucun blocage (une fausse alerte fait cesser de lire les vraies).
    console.log('── 9. L’AUTRE SENS : une seule extension, « Se connecter avec VRM » aboutit');
    await essaie('9', async () => {
      const A = 'abcdefghijklmnopabcdefghijklmnop';
      const r = await rendre(b, { session: true, onglet: 'journee&lier-extension=' + A, vrm: { ok: true, connecte: false, email: '' }, ponts: [{ version: '5.171.0', id: A, adresse: true }] });
      await r.pg.waitForTimeout(3000);
      const v = await r.lire();
      const band = await r.pg.evaluate(() => { const x = document.querySelector('[data-liaison]'); return x ? { etat: x.getAttribute('data-liaison'), reste: x.getAttribute('data-liaison-reste'), txt: x.innerText } : null; });
      dit(v.etat && v.etat.code !== 'plusieurs', 'une seule extension : pas « plusieurs »', JSON.stringify(v.etat));
      dit(band && band.etat === 'ok' && !band.reste, 'le bandeau dit « connectée ✓ » sans aucun blocage inventé', JSON.stringify(band));
      await r.ctx.close();
    });
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 200)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ deux-extensions : ${ko} rouge(s)` : '\n✅ deux-extensions : tout est vert');
  process.exit(ko ? 1 : 0);
})();
