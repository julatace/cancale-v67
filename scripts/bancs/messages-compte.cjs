// Banc : MESSAGES — le compte ouvert dans Chrome d'abord, les autres consultables
// en lecture seule, aucune réponse automatique (15 octobre).
//
// Julien : « pour les messages on doit pouvoir voir, lorsque l'extension d'un
// compte est activée, seulement ses messages ; les autres doivent être floutés
// comme pour les annonces quand on est en mode lecture seule ; on doit pouvoir
// tout voir même si on ne peut pas répondre ; il y a beaucoup trop
// d'informations », puis « les messages envoyés, l'application, toutes les
// notifications : ça doit être beaucoup mieux et beaucoup plus clair », et
// « l'extension lit les messages et permet de répondre directement sur VRM, mais
// elle n'agit pas toute seule ».
//
// Le VRAI écran Messages, sur des conversations INVENTÉES (aucune donnée réelle :
// il vit dans le dépôt, qui est public), avec le dialogue du pont rejoué dans sa
// vraie forme (`ready`, `etat`, `exec` → `result`) et une GARDE STRICTE comme la
// vraie extension (un fil d'un autre compte que celui du cookie : refusé, rien
// ne part). Il exige :
//   A. Chrome sur compte_a (actions possibles) : les QUATRE conversations sont
//      listées (aucune ne disparaît), celles de compte_a d'abord ; celles de
//      compte_b estompées (flou) mais CLIQUABLES, une ligne « Autres comptes »
//      qui le dit une fois avec leurs non-lus ; la tête dit « 3 non lus ».
//   B. Un fil de compte_b s'OUVRE et se lit ; la zone de réponse dit pourquoi
//      on ne peut pas répondre d'ici (Chrome est sur compte_a) avec le geste ;
//      Envoyer est grisé ; RIEN n'est demandé à l'extension (ni lecture
//      qu'elle refuserait, ni envoi).
//   C. Les brouillons : tapé dans un fil, retrouvé en y revenant, absent d'un
//      autre fil.
//   D. L'envoi : sur SON clic, une seule requête, la bulle dit « Envoyé », le
//      brouillon s'efface ; un refus de Vinted est dit en clair et garde le
//      texte ; un envoi SANS réponse (le message est parti, l'extension ne
//      répond pas) bloque le renvoi — Entrée ne renvoie rien — jusqu'à la
//      relecture du fil, qui le retrouve et le dit envoyé.
//   E. « Envoyer l'offre » demande d'abord (un prix engagé).
//   F. Sans extension (téléphone) : tout est affiché, rien n'est estompé, un
//      fil s'ouvre en lecture seule avec le geste.
//   G. Réglages : plus d'interrupteur « Répondre à mes messages Vinted », et
//      une ancienne valeur allumée sur l'appareil est rééteinte.
// Revue du 15 octobre (chaque défaut reproduit d'abord, rouge sur 9701837) :
//   D2/D3. un envoi incertain survit à un départ de Messages ET à un
//      rechargement : revenu sur le fil, Entrée ne renvoie pas — le fil relu en
//      direct à l'ouverture le dit envoyé ;
//   D4. un ANCIEN message au même texte (« Merci ! ») ne fait pas dire
//      « Envoyé » à un envoi qui n'est jamais parti ;
//   H. compte choisi à la main ≠ compte de Chrome : estompé = lecture seule
//      (le compte de Chrome reste net, c'est lui qui répond) ;
//   A/C. le nombre de non-lus s'écrit une fois ; chaque offre dit qui l'a faite.
// Rendu à 1512 et 390 px, clair et sombre (captures dans BANC_CAPTURES ou le
// dossier temporaire). `BANC_PORT` (5932 par défaut).
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 5932;
const CAPT = process.env.BANC_CAPTURES || os.tmpdir();
// `SECTIONS=d2,d3` : ne rendre que ces scénarios (abc, d, d2, d3, d4, h, abis, f, g) —
// pour les preuves par réaffaiblissement, un build par mutation.
const SEC = (process.env.SECTIONS || '').split(',').map((x) => x.trim()).filter(Boolean);
const veut = (x) => !SEC.length || SEC.includes(x);

const auj = Date.now();
const iso = (h) => new Date(auj - h * 3600e3).toISOString();
const ACCS = [
  { id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: iso(0) },
  { id: 2, vinted_user_id: '222', login: 'compte_b', domain: 'www.vinted.fr', updated_at: iso(0) },
];
const conv = (id, login, desc, unread, h) => ({ id, unread, updated_at: iso(h), description: desc, opposite_user: { id: 5000 + id, login } });
const message = (id, user, body, h) => ({ entity_type: 'message', created_at_ts: Math.floor((auj - h * 3600e3) / 1000), entity: { id, user_id: user, body } });
const filsDe = () => ({
  301: { id: 301, allow_reply: true, description: 'Nike Air Max 1', opposite_user: { id: 5301, login: 'acheteuse_a' }, transaction: { id: 9001, item_id: 444 },
    // (revue du 15 octobre) un ANCIEN « Merci ! » du vendeur : une réponse courte
    // revient souvent dans un fil — elle ne prouve pas qu'un envoi incertain du
    // même texte est parti.
    messages: [message(1, 5301, 'Bonjour, toujours dispo ?', 3), message(2, 999, 'Merci !', 2.9),
      { id: 60, entity_type: 'offer_message', created_at_ts: Math.floor((auj - 2.8 * 3600e3) / 1000), entity: { user_id: 999, current: false, price: { amount: '50.0', currency_code: 'EUR' }, price_label: '50,00 €', currency: 'EUR' } },
      { id: 61, entity_type: 'offer_request_message', created_at_ts: Math.floor((auj - 2.5 * 3600e3) / 1000), entity: { user_id: 5301, current: true, status: 10, status_title: '', price: { amount: '45.0' }, transaction_id: 9001, offer_request_id: 77 } }] },
  401: { id: 401, allow_reply: true, description: 'Adidas Samba 42', opposite_user: { id: 5401, login: 'acheteur_b1' }, transaction: { id: 9101, item_id: 555 },
    messages: [message(11, 5401, 'Vous faites 40 € ?', 1)] },
  // 402 : Vinted refuse la réponse (allow_reply:false) — là, « ouvre Vinted sur
  // compte_b » serait un geste FAUX : même sur le bon compte, rien ne partirait.
  402: { id: 402, allow_reply: false, description: 'Puma Suede 41', opposite_user: { id: 5402, login: 'acheteur_b2' },
    messages: [message(21, 5402, 'Encore là ?', 3)] },
});
// Un TROISIÈME compte (H) : pour juger qu'un fil estompé est toujours en lecture
// seule quand un compte est choisi à la main.
const COMPTE_C = { id: 3, vinted_user_id: '333', login: 'compte_c', domain: 'www.vinted.fr', updated_at: iso(0) };
const FIL_C = { id: 501, allow_reply: true, description: 'New Balance 550', opposite_user: { id: 5501, login: 'acheteur_c' }, transaction: { id: 9201, item_id: 666 },
  messages: [message(31, 5501, 'Dispo en 43 ?', 4)] };
const lignesDe = (trois) => {
  const fils = filsDe();
  return [
    ...(trois ? [{ id: 'harvest_333_inbox', data: { capturedAt: iso(0), payload: { conversations: [conv(501, 'acheteur_c', 'Dispo en 43 ?', true, 4)] } } },
      { id: 'harvest_333_conv_501', data: { capturedAt: iso(0), payload: { conversation: FIL_C } } }] : []),
    { id: 'harvest_111_inbox', data: { capturedAt: iso(0), payload: { conversations: [conv(301, 'acheteuse_a', 'Toujours dispo ?', true, 2), conv(303, 'curieux_a', 'Merci !', false, 30)] } } },
    { id: 'harvest_222_inbox', data: { capturedAt: iso(0), payload: { conversations: [conv(401, 'acheteur_b1', 'Vous faites 40 € ?', true, 1), conv(402, 'acheteur_b2', 'Encore là ?', true, 3)] } } },
    { id: 'harvest_111_conv_301', data: { capturedAt: iso(0), payload: { conversation: fils[301] } } },
    { id: 'harvest_222_conv_401', data: { capturedAt: iso(0), payload: { conversation: fils[401] } } },
    { id: 'harvest_222_conv_402', data: { capturedAt: iso(0), payload: { conversation: fils[402] } } },
    { id: 'main', data: {} },
  ];
};

let ko = 0, okN = 0;
const dit = (c, m, d) => { if (c) okN++; else ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' : le scénario a tourné jusqu’au bout', String(e && e.message).split('\n')[0].slice(0, 200)); } };
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

// Le pont, dans la forme de ses réponses. `chrome` : uid du compte ouvert dans
// Chrome. Une GARDE STRICTE comme la vraie extension : un fil d'un autre compte
// est refusé (`vinted-autre`), rien ne part. `window.__modeReponse` : 'ok' · 'refus'
// (Vinted répond 403) · 'muet' (le message PART, mais aucune réponse ne revient)
// · 'perdu' (rien ne part, et aucune réponse ne revient).
// Ce qui est PARTI chez Vinted y reste après un rechargement de VRM (le vrai
// Vinted le garde) : les envois sont gardés dans le stockage de la page.
const PONT = ({ version, chrome, fils }) => {
  window.__execs = []; window.__modeReponse = 'ok';
  const post = (m) => window.postMessage(m, '*');
  const lo = { 111: 'compte_a', 222: 'compte_b', 333: 'compte_c' };
  try { for (const x of JSON.parse(localStorage.getItem('__banc_envoyes') || '[]')) if (fils[x.conv]) fils[x.conv].messages.push(x.m); } catch (_) {}
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version });
    if (d.__vmr === 'authEtat') post({ __vmr: 'authEtat:result', reqId: d.reqId, etat: { ok: true, connecte: true, expiree: false, email: 'vendeur@exemple.test', user_id: 'u1', cloisonne: false } });
    if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version, vrm: { ok: true, connecte: true, email: 'vendeur@exemple.test', user_id: 'u1' }, vinted: chrome ? { uid: chrome, login: lo[chrome] } : null, cmds: {} } });
    if (d.__vmr !== 'exec') return;
    window.__execs.push({ uid: String(d.uid), method: d.method, endpoint: d.endpoint, body: d.body });
    if (String(d.uid) !== String(chrome)) { post({ __vmr: 'result', reqId: d.reqId, ok: false, code: 'vinted-autre', error: "ton navigateur est connecté à un autre compte Vinted — bascule sur celui-ci sur vinted.fr d'abord" }); return; }
    const m = /\/conversations\/(\d+)(\/replies)?$/.exec(String(d.endpoint));
    if (d.method === 'GET' && m) { setTimeout(() => post({ __vmr: 'result', reqId: d.reqId, ok: true, status: 200, data: { conversation: fils[m[1]] || { id: Number(m[1]), messages: [] } } }), 30); return; }
    if (d.method === 'POST' && m && m[2]) {
      const mode = window.__modeReponse;
      if (mode === 'refus') { setTimeout(() => post({ __vmr: 'result', reqId: d.reqId, ok: false, status: 403, error: 'erreur 403' }), 30); return; }
      if (mode === 'perdu') return;                      // rien n'est parti, rien ne revient
      const f = fils[m[1]];
      if (f) {
        const nouveau = { entity_type: 'message', created_at_ts: Math.floor(Date.now() / 1000), entity: { id: 900 + f.messages.length, user_id: 999, body: d.body && d.body.reply && d.body.reply.body } };
        f.messages.push(nouveau);
        try { const l = JSON.parse(localStorage.getItem('__banc_envoyes') || '[]'); l.push({ conv: m[1], m: nouveau }); localStorage.setItem('__banc_envoyes', JSON.stringify(l)); } catch (_) {}
      }
      if (mode === 'muet') return;                       // parti, mais rien ne revient
      setTimeout(() => post({ __vmr: 'result', reqId: d.reqId, ok: true, status: 200, data: {} }), 30);
      return;
    }
    setTimeout(() => post({ __vmr: 'result', reqId: d.reqId, ok: true, status: 200, data: {} }), 30);
  });
  post({ __vmr: 'ready', version });
};

// `tel` : 390 px de large. `tactile` : un vrai téléphone (aucune souris) — là,
// l'extension ne peut pas tourner : c'est le cas F. Une fenêtre étroite sur
// l'ordinateur (390 px, souris), elle, garde l'extension.
async function rendre(b, { chrome = '111', tel = false, tactile = false, sombre = false, onglet = 'cat_msg', sansExtension = false, repondAuto = false, trois = false } = {}) {
  const vp = tel ? { width: 390, height: 844 } : { width: 1512, height: 950 };
  const ctx = await b.newContext({ viewport: vp, ...(tactile ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(({ sombre, repondAuto }) => { try {
    localStorage.setItem('vrm_acces_direct', '1');
    // (la bascule « Minéral » remet le clair une fois : déjà faite sur cet appareil)
    if (sombre) { localStorage.setItem('vinted_dark', 'true'); localStorage.setItem('vrm_bascule_mineral_v1', '1'); }
    if (repondAuto) localStorage.setItem('vinted_repond_auto', 'true');
  } catch (_) {} }, { sombre, repondAuto });
  if (!sansExtension) await pg.addInitScript(PONT, { version: '5.163.0', chrome, fils: filsDe() });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  const lignes = lignesDe(trois);
  const accs = trois ? [...ACCS, COMPTE_C] : ACCS;
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(accs);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && !/^id,data|^data,updated_at/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: iso(0), cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(lignes.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(lignes.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  // Le relais serveur : en panne (un fil jamais capté d'un autre compte ne se lit pas par lui ici).
  await pg.route('**/api/**', (r) => (/vinted-proxy/.test(r.request().url())
    ? r.fulfill({ status: 503, contentType: 'application/json', body: '{"erreur":"pas-su"}' })
    : r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' })));
  await pg.goto(`http://localhost:${PORT}/?tab=${onglet}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(4500);
  return { ctx, pg, errs };
}
const liste = (pg) => pg.evaluate(() => {
  const t = document.querySelector('[data-messagerie-tete]');
  const sep = [...document.querySelectorAll('[data-conv-autres]')];
  const lignes = [...document.querySelectorAll('[data-messagerie] [data-conv]')].map((x) => {
    const cs = getComputedStyle(x);
    return { id: x.getAttribute('data-conv'), flou: /blur/.test(cs.filter), inerte: cs.pointerEvents === 'none' };
  });
  // L'ordre DOM : où se trouve la séparation par rapport aux lignes.
  const tout = [...document.querySelectorAll('[data-messagerie] [data-conv], [data-messagerie] [data-conv-autres]')].map((x) => x.hasAttribute('data-conv-autres') ? '|' : x.getAttribute('data-conv'));
  return { tete: t ? { etat: t.getAttribute('data-messagerie-tete'), n: t.getAttribute('data-nonlus'), txt: t.innerText.trim() } : null,
    sep: sep.map((s) => ({ etat: s.getAttribute('data-conv-autres'), n: s.getAttribute('data-nonlus-ailleurs'), txt: s.innerText.replace(/\s+/g, ' ').trim() })),
    lignes, ordre: tout.join(' ') };
});
const zone = (pg) => pg.evaluate(() => {
  const z = document.querySelector('[data-reponse]');
  const r = document.querySelector('[data-reponse-raison]');
  const b = document.querySelector('[data-envoyer]');
  const t = document.querySelector('textarea[aria-label="Réponse à la conversation"]');
  return z ? { etat: z.getAttribute('data-reponse'), raison: r ? r.getAttribute('data-reponse-raison') : null, raisonTxt: r ? r.innerText.replace(/\s+/g, ' ').trim() : '',
    envoyerGrise: b ? b.disabled : null, texte: t ? t.value : null,
    incertain: (document.querySelector('[data-envoi-incertain]') || {}).innerText || '', refus: (document.querySelector('[data-envoi-refuse]') || {}).innerText || '',
    note: (document.querySelector('[data-envoi-note]') || {}).innerText || '', envoye: document.querySelectorAll('[data-envoye]').length } : null;
});
const execs = (pg) => pg.evaluate(() => window.__execs || []);
const ouvrir = async (pg, id) => { await pg.click(`[data-conv="${id}"]`, { timeout: 10000 }); await pg.waitForTimeout(900); };
const fermer = async (pg) => { await pg.keyboard.press('Escape'); await pg.waitForTimeout(300); };
const sansDebordement = async (pg) => pg.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
// Le bouton Envoyer, trouvé par son RÔLE et son nom (il existe aussi sur le code
// d'avant : le banc y mesure le comportement, pas l'absence d'une marque).
const envoyer = (pg) => pg.getByRole('button', { name: /^(Envoyer|…|Envoi…)$/ }).first().click({ timeout: 4000 });
const capture = async (pg, nom) => { try { await pg.screenshot({ path: path.join(CAPT, 'messages-compte-' + nom + '.png') }); } catch (_) {} };

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });

    for (const { tel, sombre } of (veut('abc') ? [{ tel: false, sombre: false }, { tel: true, sombre: false }, { tel: false, sombre: true }, { tel: true, sombre: true }] : [])) {
      const taille = (tel ? '390' : '1512') + (sombre ? '-sombre' : '');
      console.log(`── A-B-C. Chrome sur compte_a · ${taille}`);
      const r = await rendre(b, { chrome: '111', tel, sombre });
      // Chaque bloc a son `essaie` : un bloc qui tombe (sur un code d'avant) ne
      // tait pas les suivants — un banc ne meurt pas, il rapporte.
      await essaie('A ' + taille, async () => {
        const l = await liste(r.pg);
        dit(l.lignes.length === 4, 'les QUATRE conversations sont listées — aucune ne disparaît', JSON.stringify(l.lignes.map((x) => x.id)));
        dit(l.ordre === '301 303 | 401 402', 'compte_a (celui de Chrome) d’abord, puis « Autres comptes », puis compte_b — chacun du plus récent au plus ancien', l.ordre);
        const b1 = l.lignes.filter((x) => ['401', '402'].includes(x.id)), a1 = l.lignes.filter((x) => ['301', '303'].includes(x.id));
        dit(b1.length === 2 && b1.every((x) => x.flou && !x.inerte), 'celles de compte_b sont estompées (floutées) mais restent CLIQUABLES', JSON.stringify(b1));
        dit(a1.length === 2 && a1.every((x) => !x.flou), 'celles de compte_a restent nettes', JSON.stringify(a1));
        dit(l.sep.length === 1 && l.sep[0].etat === 'lecture' && l.sep[0].n === '2' && /lecture seule/.test(l.sep[0].txt) && /2 non lus/.test(l.sep[0].txt),
          'UNE ligne « Autres comptes · lecture seule · 2 non lus » — le pourquoi dit une fois, pas sur chaque ligne', JSON.stringify(l.sep));
        dit(l.tete && l.tete.etat === 'nonlus' && l.tete.n === '3' && /^3 non lus$/.test(l.tete.txt), 'la tête dit « 3 non lus » (toute la liste, autres comptes compris)', JSON.stringify(l.tete));
        // (revue du 15 octobre) « 3 non lus | Toutes 4 | Non lues 3 » : le même
        // nombre deux fois à 40 px (§7). On juge le RENDU de la tête et des filtres.
        const haut = await r.pg.evaluate(() => [...document.querySelectorAll('[data-messagerie-tete], .vrm-inbox-filters')].map((x) => x.innerText.replace(/\s+/g, ' ').trim()).join(' | '));
        dit((haut.match(/\b3\b/g) || []).length === 1, 'le nombre de non-lus s’écrit UNE fois (la tête), pas une seconde fois sur le filtre', haut);
        await capture(r.pg, 'liste-' + taille);
      });
      await essaie('B ' + taille, async () => {
        // B. un fil de compte_b s'ouvre et se lit
        await ouvrir(r.pg, '401');
        const fil = await r.pg.evaluate(() => (document.querySelector('.vrm-chat-history') || {}).innerText || '');
        dit(/Vous faites 40/.test(fil), 'le fil de compte_b s’OUVRE et se lit', fil.slice(0, 80));
        const z = await zone(r.pg);
        dit(z && z.etat === 'lecture' && z.raison === 'vinted-autre' && /compte_a/.test(z.raisonTxt) && /compte_b/.test(z.raisonTxt) && /Ouvrir sur Vinted/.test(z.raisonTxt),
          'la zone de réponse dit pourquoi (Chrome est sur compte_a) et le geste (ouvrir Vinted sur compte_b), en une phrase', JSON.stringify(z && { etat: z.etat, raison: z.raison, txt: z.raisonTxt }));
        await r.pg.fill('textarea[aria-label="Réponse à la conversation"]', 'Brouillon B');
        const z2 = await zone(r.pg);
        dit(z2 && z2.envoyerGrise === true, 'Envoyer est grisé (on peut écrire un brouillon, pas l’envoyer)', JSON.stringify(z2 && z2.envoyerGrise));
        await r.pg.keyboard.press('Enter'); await r.pg.waitForTimeout(400);
        const e1 = await execs(r.pg);
        dit(!e1.some((x) => /\/conversations\/40\d/.test(x.endpoint)), 'RIEN n’est demandé à l’extension pour un fil de compte_b — ni lecture qu’elle refuserait, ni envoi (Entrée comprise)', JSON.stringify(e1));
        const off = await r.pg.evaluate(() => { const o = document.querySelector('[data-offre]'); return o ? o.getAttribute('data-offre') : null; });
        dit(off === null, 'aucun bouton d’offre sur un fil qu’on ne peut pas trancher d’ici', String(off));
        await capture(r.pg, 'fil-lecture-' + taille);
        await fermer(r.pg);
        // B bis. Vinted refuse la réponse : on le dit, sans geste qui ne débloquerait rien.
        await ouvrir(r.pg, '402');
        const zr = await zone(r.pg);
        dit(zr && zr.etat === 'refusee' && zr.raison === 'vinted-refuse' && /ne permet pas de répondre/.test(zr.raisonTxt) && !/Ouvre Vinted|ouvre vinted\.fr|Chrome est sur/i.test(zr.raisonTxt),
          'Vinted refuse la réponse : la zone le dit, sans renvoyer ouvrir Vinted sur un autre compte (ça ne débloquerait rien)', JSON.stringify(zr && { etat: zr.etat, raison: zr.raison, txt: zr.raisonTxt }));
        dit(zr && zr.envoyerGrise !== false && zr.texte === null, 'aucune zone de saisie ni bouton Envoyer actif sur ce fil', JSON.stringify(zr && { envoyer: zr.envoyerGrise, texte: zr.texte }));
        await fermer(r.pg);
      });
      await essaie('C ' + taille, async () => {
        // C. brouillons (et la lisibilité d'une offre sans titre)
        await ouvrir(r.pg, '301');
        const zA = await zone(r.pg);
        dit(zA && zA.etat === 'libre' && zA.texte === '', 'le fil de compte_a se répond (zone libre) et ne reprend PAS le brouillon d’un autre fil', JSON.stringify(zA && { etat: zA.etat, texte: zA.texte }));
        const filA = await r.pg.evaluate(() => (document.querySelector('.vrm-chat-history') || {}).innerText || '');
        dit(/Ton offre : 50,00 €/.test(filA) && /Offre reçue : 45,00 €/.test(filA) && !/offer_(request_)?message|currency_code|INFO COLIS/i.test(filA),
          'chaque offre dit QUI l’a faite — « Ton offre : 50,00 € », « Offre reçue : 45,00 € » — jamais le type brut, ni un faux « Info colis · currency_code »', filA.replace(/\s+/g, ' ').slice(0, 200));
        const cotes = await r.pg.evaluate(() => [...document.querySelectorAll('[data-offre-fil]')].map((x) => x.getAttribute('data-offre-fil') + ':' + getComputedStyle(x).alignSelf));
        dit(cotes.includes('moi:flex-end') && cotes.includes('acheteur:flex-start'), 'et chacune se range du côté de son auteur (la sienne à droite, celle de l’acheteuse à gauche)', JSON.stringify(cotes));
        await r.pg.fill('textarea[aria-label="Réponse à la conversation"]', 'Brouillon A');
        await fermer(r.pg);
        await ouvrir(r.pg, '303');
        const z3 = await zone(r.pg);
        dit(z3 && z3.texte === '', 'un autre fil ne reprend pas ce brouillon', JSON.stringify(z3 && z3.texte));
        await fermer(r.pg);
        await ouvrir(r.pg, '301');
        const zB = await zone(r.pg);
        dit(zB && zB.texte === 'Brouillon A', 'en revenant sur le fil, son brouillon est là', JSON.stringify(zB && zB.texte));
        await r.pg.fill('textarea[aria-label="Réponse à la conversation"]', '');
        await fermer(r.pg);
        dit(await sansDebordement(r.pg), 'aucun débordement horizontal');
        dit(r.errs.length === 0, 'aucune erreur d’app', r.errs.join(' | ').slice(0, 160));
      });
      await r.ctx.close();
    }

    if (veut('d')) {
    console.log('── D. envoyer, refus, envoi sans réponse (1512)');
      const r = await rendre(b, { chrome: '111' });
      await essaie('D envoyé', async () => {
        await ouvrir(r.pg, '301');
        const avant = (await execs(r.pg)).filter((x) => x.method === 'POST').length;
        await r.pg.fill('textarea[aria-label="Réponse à la conversation"]', 'Oui, toujours dispo !');
        await envoyer(r.pg); await r.pg.waitForTimeout(900);
        const posts = (await execs(r.pg)).filter((x) => x.method === 'POST');
        dit(posts.length - avant === 1 && posts[posts.length - 1].endpoint === '/api/v2/conversations/301/replies' && posts[posts.length - 1].uid === '111',
          'sur SON clic : UNE requête, sur ce fil, au nom de compte_a', JSON.stringify(posts));
        const zE = await zone(r.pg);
        dit(zE && zE.envoye === 1 && zE.texte === '', 'la bulle dit « Envoyé » et la zone se vide', JSON.stringify(zE && { envoye: zE.envoye, texte: zE.texte }));
        await fermer(r.pg); await ouvrir(r.pg, '301');
        const zE2 = await zone(r.pg);
        dit(zE2 && zE2.texte === '', 'le brouillon d’un message parti est effacé (rien à renvoyer par erreur)', JSON.stringify(zE2 && zE2.texte));
      });
      await essaie('D refus', async () => {
        await r.pg.evaluate(() => { window.__modeReponse = 'refus'; });
        await r.pg.fill('textarea[aria-label="Réponse à la conversation"]', 'Merci !');
        await envoyer(r.pg); await r.pg.waitForTimeout(900);
        const zR = await zone(r.pg);
        dit(zR && /^Pas envoyé/.test(zR.refus) && /403/.test(zR.refus) && zR.texte === 'Merci !', 'un refus de Vinted est dit en clair (« Pas envoyé — … 403 ») et le texte reste', JSON.stringify(zR && { refus: zR.refus, texte: zR.texte }));
      });
      await essaie('D incertain', async () => {
        // envoi sans réponse : le message PART, l'extension se tait (16 s : le
        // délai réel de `vmrExec`, pas un raccourci de banc)
        await r.pg.evaluate(() => { window.__modeReponse = 'muet'; });
        await r.pg.fill('textarea[aria-label="Réponse à la conversation"]', 'Je vous la garde');
        await envoyer(r.pg);
        await r.pg.waitForTimeout(16500);
        const zI = await zone(r.pg);
        dit(zI && zI.etat === 'incertain' && /non confirmé/.test(zI.incertain) && zI.envoyerGrise === true, 'sans réponse : « Envoi non confirmé — relis le fil avant de renvoyer », et Envoyer est bloqué', JSON.stringify(zI && { etat: zI.etat, inc: zI.incertain, grise: zI.envoyerGrise }));
        const n1 = (await execs(r.pg)).filter((x) => x.method === 'POST').length;
        await r.pg.focus('textarea[aria-label="Réponse à la conversation"]'); await r.pg.keyboard.press('Enter'); await r.pg.waitForTimeout(500);
        const n2 = (await execs(r.pg)).filter((x) => x.method === 'POST').length;
        dit(n2 === n1, 'Entrée ne renvoie RIEN tant que le fil n’est pas relu (jamais deux fois le même message)', `${n1} → ${n2}`);
        await capture(r.pg, 'fil-incertain-1512');
        await r.pg.click('button[aria-label="Actualiser la conversation"]', { timeout: 4000 }); await r.pg.waitForTimeout(1200);
        const zJ = await zone(r.pg);
        dit(zJ && zJ.etat === 'libre' && /Envoyé/.test(zJ.note) && zJ.texte === '', 'la relecture du fil le retrouve : « Envoyé — il est dans le fil », le brouillon s’efface', JSON.stringify(zJ && { etat: zJ.etat, note: zJ.note, texte: zJ.texte }));
      });
      console.log('── E. envoyer une offre demande d’abord');
      await essaie('E', async () => {
        await r.pg.evaluate(() => { window.__modeReponse = 'ok'; });
        const nO = (await execs(r.pg)).filter((x) => /offers$/.test(x.endpoint)).length;
        await r.pg.fill('input[aria-label="Prix de l\'offre"]', '50', { timeout: 4000 });
        await r.pg.getByRole('button', { name: 'Envoyer l\'offre' }).click({ timeout: 4000 }); await r.pg.waitForTimeout(500);
        const nO2 = (await execs(r.pg)).filter((x) => /offers$/.test(x.endpoint)).length;
        dit(nO2 === nO, '« Envoyer l’offre » DEMANDE d’abord (un prix engagé) — rien n’est parti', `${nO} → ${nO2}`);
        await capture(r.pg, 'offre-confirmation-1512');
        await r.pg.locator('div[style*="z-index: 2000"] button', { hasText: 'Proposer' }).click({ timeout: 8000 }); await r.pg.waitForTimeout(900);
        const of = (await execs(r.pg)).filter((x) => /offers$/.test(x.endpoint));
        dit(of.length === nO + 1 && of[of.length - 1].endpoint === '/api/v2/transactions/9001/offers' && of[of.length - 1].body.offer.price === '50', 'puis l’offre part, au prix saisi, sur la bonne transaction', JSON.stringify(of));
      });
      dit(r.errs.length === 0, 'aucune erreur d’app (D-E)', r.errs.join(' | ').slice(0, 160));
      await r.ctx.close();
    }

    // ── D2-D4 (revue du 15 octobre) ─────────────────────────────────────────
    // L'envoi incertain vivait dans un `useState` : quitter Messages ou
    // recharger le perdait, et le BROUILLON (même texte) revenait dans le champ —
    // Entrée renvoyait le message. Et la relecture disait « Envoyé » dès qu'un
    // ANCIEN message au même texte était dans le fil.
    const TA = 'textarea[aria-label="Réponse à la conversation"]';
    const envoiIncertain = async (pg, texte, mode) => {
      await ouvrir(pg, '301');
      await pg.evaluate((m) => { window.__modeReponse = m; }, mode);
      await pg.fill(TA, texte);
      await envoyer(pg);
      await pg.waitForTimeout(16500);
      const z = await zone(pg);
      dit(z && z.etat === 'incertain', `« ${texte} » (${mode}) : envoi non confirmé`, JSON.stringify(z && z.etat));
      await pg.evaluate(() => { window.__modeReponse = 'ok'; });
    };
    const repliesDe = async (pg) => (await execs(pg)).filter((x) => x.method === 'POST' && /\/replies$/.test(x.endpoint)).map((x) => x.body && x.body.reply && x.body.reply.body);
    if (veut('d2')) {
    console.log('── D2. envoi incertain, puis Ma journée et retour sur Messages (sans recharger)');
    await essaie('D2', async () => {
      const r = await rendre(b, { chrome: '111' });
      await envoiIncertain(r.pg, 'Je vous la garde', 'muet');
      await fermer(r.pg);
      await r.pg.getByText('Ma journée', { exact: true }).first().click({ timeout: 8000 }); await r.pg.waitForTimeout(1500);
      await r.pg.getByText('Vinted', { exact: true }).first().click({ timeout: 8000 }); await r.pg.waitForTimeout(1200);
      await r.pg.getByRole('button', { name: 'Messages', exact: true }).first().click({ timeout: 8000 }).catch(() => {}); await r.pg.waitForTimeout(2500);
      await ouvrir(r.pg, '301');
      const zR = await zone(r.pg);
      await r.pg.focus(TA); await r.pg.keyboard.press('Enter'); await r.pg.waitForTimeout(900);
      const env = await repliesDe(r.pg);
      dit(env.length === 1, 'revenu sur le fil, Entrée ne renvoie PAS le message — un seul envoi en tout', JSON.stringify(env));
      dit(zR && zR.etat === 'libre' && zR.texte === '' && /Envoyé/.test(zR.note), 'relu en direct à l’ouverture, le fil le retrouve : « Envoyé — il est dans le fil », le brouillon s’efface', JSON.stringify(zR && { etat: zR.etat, texte: zR.texte, note: zR.note }));
      await capture(r.pg, 'incertain-retour-1512');
      await r.ctx.close();
    });
    }
    if (veut('d3')) {
    console.log('── D3. envoi incertain, puis RECHARGEMENT de la page');
    await essaie('D3', async () => {
      const r = await rendre(b, { chrome: '111' });
      await envoiIncertain(r.pg, 'Je vous la garde', 'muet');
      await r.pg.goto(`http://localhost:${PORT}/?tab=cat_msg`, { waitUntil: 'domcontentloaded' }); await r.pg.waitForTimeout(5000);
      await ouvrir(r.pg, '301');
      const zR = await zone(r.pg);
      await r.pg.focus(TA); await r.pg.keyboard.press('Enter'); await r.pg.waitForTimeout(900);
      const env = await repliesDe(r.pg);
      dit(env.length === 0, 'après le rechargement, Entrée ne renvoie PAS le message', JSON.stringify(env));
      dit(zR && zR.texte === '' && /Envoyé/.test(zR.note), 'et le fil relu le dit envoyé (« il est dans le fil »)', JSON.stringify(zR && { etat: zR.etat, texte: zR.texte, note: zR.note }));
      await r.ctx.close();
    });
    }
    if (veut('d4')) {
    console.log('── D4. envoi incertain d’un « Merci ! » qui n’est PAS parti, un ancien « Merci ! » déjà dans le fil');
    await essaie('D4', async () => {
      const r = await rendre(b, { chrome: '111' });
      await envoiIncertain(r.pg, 'Merci !', 'perdu');
      await r.pg.click('button[aria-label="Actualiser la conversation"]', { timeout: 4000 }); await r.pg.waitForTimeout(1500);
      const zJ = await zone(r.pg);
      const fil = await r.pg.evaluate(() => (document.querySelector('.vrm-chat-history') || {}).innerText || '');
      dit((fil.match(/Merci !/g) || []).length === 1, 'le fil relu ne porte que l’ANCIEN « Merci ! » (rien n’est parti)', String((fil.match(/Merci !/g) || []).length));
      dit(zJ && zJ.etat === 'libre' && /Pas dans le fil/.test(zJ.note) && !/Envoyé/.test(zJ.note) && zJ.texte === 'Merci !' && zJ.envoyerGrise === false,
        'la relecture ne le dit PAS envoyé : « pas dans le fil », le texte reste et peut repartir', JSON.stringify(zJ && { etat: zJ.etat, note: zJ.note, texte: zJ.texte, grise: zJ.envoyerGrise }));
      await r.ctx.close();
    });
    }

    // ── H (revue du 15 octobre) : estompé = LECTURE SEULE, même quand un autre
    //    compte est choisi à la main. Le flou suivait le choix : Chrome sur
    //    compte_a, compte_b choisi ⇒ les fils de compte_a (les seuls auxquels on
    //    répond d'ici) étaient estompés.
    if (veut('h')) {
    console.log('── H. Chrome sur compte_a, compte_b choisi à la main, trois comptes');
    await essaie('H', async () => {
      const r = await rendre(b, { chrome: '111', trois: true });
      await r.pg.selectOption('#vrm-sel-compte', '222', { timeout: 8000 }); await r.pg.waitForTimeout(700);
      const l = await liste(r.pg);
      dit(l.ordre === '401 402 301 303 | 501', 'le compte choisi (compte_b) d’abord, puis celui de Chrome (compte_a), puis « Autres comptes »', l.ordre);
      const flou = (id) => { const x = l.lignes.find((y) => y.id === id); return x ? x.flou : null; };
      dit(['401', '402', '301', '303'].every((id) => flou(id) === false) && flou('501') === true, 'compte_a (il répond d’ici) et compte_b (choisi) restent nets ; seul compte_c est estompé', JSON.stringify(l.lignes));
      dit(l.sep.length === 1 && l.sep[0].etat === 'lecture' && /lecture seule/.test(l.sep[0].txt), 'la séparation dit « lecture seule »', JSON.stringify(l.sep));
      const note = await r.pg.evaluate(() => { const n = document.querySelector('[data-sel-compte-note]'); return n ? n.innerText.replace(/\s+/g, ' ') : ''; });
      dit(/sauf/.test(note) && /compte_a/.test(note), 'la note du choix ne dit pas compte_a estompé (« sauf compte_a qui répond d’ici »)', note);
      // Chaque fil estompé s'ouvre en lecture seule ; celui de Chrome se répond.
      const etats = {};
      for (const id of l.lignes.filter((x) => x.flou).map((x) => x.id).concat(['301', '401'])) { await ouvrir(r.pg, id); const z = await zone(r.pg); etats[id] = z && z.etat; await fermer(r.pg); }
      dit(l.lignes.filter((x) => x.flou).every((x) => etats[x.id] === 'lecture' || etats[x.id] === 'refusee'), 'tout fil ESTOMPÉ s’ouvre en lecture seule', JSON.stringify(etats));
      dit(etats['301'] === 'libre' && etats['401'] === 'lecture', 'le fil de compte_a (net) se répond ; celui de compte_b (net, choisi) dit pourquoi il se lit seulement', JSON.stringify(etats));
      await capture(r.pg, 'choix-b-trois-comptes-1512');
      dit(r.errs.length === 0, 'aucune erreur d’app (H)', r.errs.join(' | ').slice(0, 160));
      await r.ctx.close();
    });
    await essaie('H2', async () => {
      // Deux comptes seulement : rien d'estompé (les deux sont nets), pas de note.
      const r = await rendre(b, { chrome: '111' });
      await r.pg.selectOption('#vrm-sel-compte', '222', { timeout: 8000 }); await r.pg.waitForTimeout(700);
      const l = await liste(r.pg);
      const note = await r.pg.evaluate(() => !!document.querySelector('[data-sel-compte-note]'));
      dit(l.lignes.length === 4 && l.lignes.every((x) => !x.flou) && l.ordre === '401 402 301 303' && !note, 'deux comptes, compte_b choisi : rien d’estompé — compte_a répond d’ici — et aucune note de flou', JSON.stringify({ ordre: l.ordre, note }));
      await r.ctx.close();
    });
    }

    if (veut('abis')) {
    console.log('── A bis. « Tous les comptes » choisi : rien d’estompé, mais un fil de compte_b reste en lecture seule');
    await essaie('tous', async () => {
      const r = await rendre(b, { chrome: '111' });
      if (await r.pg.$('#vrm-sel-compte')) { await r.pg.selectOption('#vrm-sel-compte', '*'); await r.pg.waitForTimeout(500); }
      const l = await liste(r.pg);
      dit(l.lignes.length === 4 && l.lignes.every((x) => !x.flou) && l.sep.length === 0 && l.ordre === '401 301 402 303', 'tout net, aucune séparation, du plus récent au plus ancien', JSON.stringify({ ordre: l.ordre, sep: l.sep.length }));
      await ouvrir(r.pg, '401');
      const z = await zone(r.pg);
      dit(z && z.etat === 'lecture' && z.raison === 'vinted-autre', 'répondre à compte_b reste impossible d’ici (Chrome est sur compte_a) — « Tous les comptes » ne le change pas, et c’est dit', JSON.stringify(z && { etat: z.etat, raison: z.raison }));
      await r.ctx.close();
    });

    }
    if (veut('f')) {
    console.log('── F. SANS extension (téléphone) : tout affiché, rien d’estompé, lecture seule dite');
    await essaie('F', async () => {
      const r = await rendre(b, { tel: true, tactile: true, sansExtension: true });
      const l = await liste(r.pg);
      dit(l.lignes.length === 4 && l.lignes.every((x) => !x.flou) && l.sep.length === 0, 'les quatre, toutes nettes, sans séparation', JSON.stringify(l));
      await ouvrir(r.pg, '301');
      const z = await zone(r.pg);
      dit(z && z.etat === 'lecture' && z.raison === 'telephone' && z.envoyerGrise === true, 'un fil s’ouvre en lecture seule, avec le geste (depuis l’ordinateur)', JSON.stringify(z && { etat: z.etat, raison: z.raison, txt: z.raisonTxt }));
      await capture(r.pg, 'telephone-sans-extension-390');
      await r.ctx.close();
    });

    }
    if (veut('g')) {
    console.log('── G. Réglages : plus de réponse automatique');
    await essaie('G', async () => {
      const r = await rendre(b, { onglet: 'settings', repondAuto: true });
      await r.pg.waitForTimeout(1500);
      const txt = await r.pg.evaluate(() => document.body.innerText);
      const sw = await r.pg.$('[aria-label="Répondre automatiquement aux messages Vinted"]');
      dit(!/Répondre à mes messages Vinted/.test(txt) && !sw, 'plus d’interrupteur « Répondre à mes messages Vinted » dans Réglages');
      const v = await r.pg.evaluate(() => localStorage.getItem('vinted_repond_auto'));
      dit(v === 'false', 'une ancienne valeur ALLUMÉE sur l’appareil est rééteinte (une extension d’avant le retrait la lit encore)', String(v));
      await r.ctx.close();
    });
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 200)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ messages-compte : ${ko} rouge(s), ${okN} vert(s)` : `\n✅ messages-compte : ${okN} contrôles verts`);
  process.exit(ko ? 1 : 0);
})();
