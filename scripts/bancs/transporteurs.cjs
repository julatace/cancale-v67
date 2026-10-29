// ── BANC : LE STATUT LU CHEZ LE TRANSPORTEUR, À L'ÉCRAN (24 oct.) ────────────
// Julien : « tu as juste à regarder sur le site du transporteur, je ne te
// demande pas le code de retrait mais juste de regarder le statut ».
// Le serveur range une ligne `transp_{transporteur}_{n°}` (contrat C1, écrite
// par lui seul). L'app la LIT (scalaires, `meta->>`) et l'applique par la règle
// partagée (api/_lib/suivi-colis.js : `finsDesLignes`, `fusionTransporteur`,
// `leverGarde`) à Achats → À retirer, Ma journée et — par la publication
// `vrm_colis_retirer` — au widget (la VRAIE route api/widget.js, exécutée ici).
// Données INVENTÉES à la forme mesurée (n° 12345601…, XW000000001TS…, points
// relais inventés) — aucune donnée réelle.
// Exige, à 390 px tactile en clair et 1512 px en sombre :
//   · un colis « disponible » par e-mail que le transporteur dit RETIRÉ sort
//     d'« À retirer » ; Ma journée dit le même nombre, et le widget aussi —
//     y compris quand la ligne change pendant que l'app est fermée ;
//   · « a quitté le point relais sans être retiré » et un statut inconnu après
//     l'arrivée ⇒ « à vérifier », la ligne du transporteur en ambre ; un retour
//     à l'expéditeur ⇒ « repartis », en ambre ;
//   · un e-mail « en transit » que le transporteur dit DISPONIBLE, plus tard ⇒
//     dans « À retirer », avec le lieu du transporteur et « vers le » ;
//   · une lecture « disponible » récente lève la garde (5 j chez Mondial Relay)
//     qui, seule, rangeait le colis « à vérifier » ;
//   · les trois états de la ligne (lu · pas su · jamais lu), plus « code postal
//     inconnu » avec son geste (« Ajouter un n° de suivi », 44 px) ;
//   · le libellé d'un statut inconnu recopié TEL QUEL ;
//   · la phrase Mondial Relay (« refuse en ce moment la lecture du serveur »)
//     seulement pour une ligne `bloque` ; la lecture de NOTRE base ratée ⇒ dit
//     une fois, « Réessayer » à 44 px, rien n'est perdu ;
//   · aucun rouge ; les cibles à 44 px ;
//   · (horloge pilotée) la relecture C5 (`POST /api/relais?mode=transp`) part
//     sans clic, au plus une fois par 5 min (tics, focus, retour au premier
//     plan compris) ; un changement rendu ⇒ `vrm:transp-maj` ⇒ l'écran relit
//     les lignes `transp_*`, sans recharger.
// `BANC_DIST=/chemin/dist` : rendre un autre build (mutation, §6.1).
// `BANC_SEUL=A,B` : ne jouer que ces sections.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const RACINE = path.join(__dirname, '..', '..');
const DIST = process.env.BANC_DIST || path.join(RACINE, 'dist');
const PORT = Number(process.env.BANC_PORT || process.env.PORT || 8141);

const NOW = Date.now();
const MIN = 60000, H = 3600000, J = 86400000;
const j = (n) => new Date(NOW - n * J).toISOString();
const dans = (n) => new Date(NOW + n * J).toISOString().slice(0, 10);
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_banc', domain: 'www.vinted.fr', updated_at: new Date(NOW).toISOString() }];
const SESSION = { access_token: 'session-transp', refresh_token: 'r', totp: [], expires_at: NOW + 30 * J, user: { id: '11111111-1111-4111-8111-111111111111', email: 'transp@example.test', totp: [] } };
const RELAIS = 'Relais Test, 1 Rue Exemple, 99999 Testville';
const BAR = 'Bar Test, 2 Rue Exemple, 99999 Testville';
const track = (id, o) => ({ id, data: { type: 'suivi', status: 'available', statusLabel: 'Arrivé au point de retrait', receivedAt: j(1), emailAt: j(1), arriveLe: j(1), limite: dans(3), account: 'compte_banc', sens: 'entrant', ...o } });
// La ligne C1, à la forme que le serveur range (api/_lib/transporteurs-lecture.js).
const transp = (carrier, suivi, o) => ({ id: `transp_${carrier}_${suivi}`, data: { v: 1, rev: 1, carrier, suivi, etat: null, detail: null, etatAt: null, libelle: '', lieuNom: '', lieuVille: '', lieuCp: '', limite: null, limiteSure: false, lu: null, source: 'serveur', essai: j(0.02), essaiRes: 'ok', essais: 1, voie: carrier === 'mondialrelay' ? 'mr-fr-mvc' : (carrier === 'chronopost' ? 'cp-ws2' : 'vg-v3'), fini: false, ...o } });
const LIB_INCONNU = 'Étiquette Banc 7Q — statut jamais vu';
const BASE = () => [
  { id: 'main', data: {} },
  { id: 'panel_colis_relais', data: {} },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: j(0.05), payload: { my_orders: [] } } },
  // 1. « disponible » par e-mail, RETIRÉ chez le transporteur ⇒ sort.
  track('email_track_chronopost_XW000000001TS', { carrier: 'chronopost', suivi: 'XW000000001TS', subject: 'Votre colis est disponible dans votre Relais Pickup', code: '111111', lieu: RELAIS }),
  transp('chronopost', 'XW000000001TS', { etat: 'retire', etatAt: j(0.1), libelle: 'Colis remis au destinataire', lu: j(0.02), fini: true }),
  // 2. a quitté le point relais sans être retiré (après l'arrivée) ⇒ à vérifier.
  track('email_track_mondialrelay_12345601', { carrier: 'mondialrelay', suivi: '12345601', subject: 'Votre colis 12345601 est disponible 📦', code: '222222', lieu: BAR, receivedAt: j(2), emailAt: j(2), arriveLe: j(2), limite: dans(2) }),
  transp('mondialrelay', '12345601', { etat: 'incident', detail: 'quitte_relais', etatAt: j(0.5), libelle: 'Colis sorti du Point Relais', lu: j(0.02) }),
  // 3. repart chez l'expéditeur (après l'arrivée) ⇒ repartis.
  track('email_track_mondialrelay_12345602', { carrier: 'mondialrelay', suivi: '12345602', subject: 'Votre colis 12345602 est disponible 📦', code: '333333', lieu: BAR, receivedAt: j(3), emailAt: j(3), arriveLe: j(3), limite: dans(1) }),
  transp('mondialrelay', '12345602', { etat: 'retour_expediteur', etatAt: j(0.3), libelle: 'Colis en retour vers l\'expéditeur', lu: j(0.02) }),
  // 4. « en transit » par e-mail, DISPONIBLE plus tard chez le transporteur ⇒ à retirer, lieu + « vers le ».
  track('email_track_mondialrelay_12345603', { carrier: 'mondialrelay', suivi: '12345603', status: 'transit', statusLabel: 'En cours de livraison', subject: 'Votre colis 12345603 est en route', code: null, lieu: null, receivedAt: j(2), emailAt: j(2), arriveLe: null, limite: null }),
  transp('mondialrelay', '12345603', { etat: 'disponible', etatAt: j(0.4), libelle: 'Colis disponible au Point Relais', lieuNom: 'TABAC BANC', lieuCp: '99999', lieuVille: 'Testville', limite: dans(6), limiteSure: false, lu: j(0.03), voie: 'mr-be' }),
  // 5. la garde de 5 j (Mondial Relay, sans date limite) levée par une lecture « disponible » d'il y a 1 h.
  track('email_track_mondialrelay_12345606', { carrier: 'mondialrelay', suivi: '12345606', subject: 'Votre colis 12345606 est disponible 📦', code: '666666', lieu: BAR, receivedAt: j(6.5), emailAt: j(6.5), arriveLe: j(6.5), limite: null }),
  transp('mondialrelay', '12345606', { etat: 'disponible', etatAt: j(6.4), libelle: 'Colis disponible au Point Relais', lu: new Date(NOW - H).toISOString() }),
  // 6. pas su : le transporteur n'a pas répondu (aucun état lu).
  track('email_track_chronopost_XW000000002TS', { carrier: 'chronopost', suivi: 'XW000000002TS', subject: 'Votre colis est disponible dans votre Relais Pickup', code: '777777', lieu: RELAIS }),
  transp('chronopost', 'XW000000002TS', { essaiRes: 'passu' }),
  // 7. jamais lu : aucune ligne du transporteur.
  track('email_track_chronopost_XW000000003TS', { carrier: 'chronopost', suivi: 'XW000000003TS', subject: 'Votre colis est disponible dans votre Relais Pickup', code: '888888', lieu: RELAIS }),
  // 8. code postal inconnu (Mondial Relay exige celui du point relais).
  track('email_track_mondialrelay_12345604', { carrier: 'mondialrelay', suivi: '12345604', subject: 'Votre colis 12345604 est disponible 📦', code: '444444', lieu: 'Bar Sans Code Postal' }),
  transp('mondialrelay', '12345604', { essaiRes: 'cp-inconnu', cpEssayes: '' }),
  // 9. Mondial Relay a REFUSÉ le serveur (403) : la seule ligne `bloque`.
  track('email_track_mondialrelay_12345605', { carrier: 'mondialrelay', suivi: '12345605', subject: 'Votre colis 12345605 est disponible 📦', code: '555555', lieu: BAR }),
  transp('mondialrelay', '12345605', { essaiRes: 'bloque' }),
  // 10. un statut que VRM ne connaît pas, après l'arrivée ⇒ à vérifier, libellé recopié.
  track('email_track_chronopost_XW000000004TS', { carrier: 'chronopost', suivi: 'XW000000004TS', subject: 'Votre colis est disponible dans votre Relais Pickup', code: '999999', lieu: RELAIS, receivedAt: j(2), emailAt: j(2), arriveLe: j(2) }),
  transp('chronopost', 'XW000000004TS', { etat: 'inconnu', etatAt: j(0.2), libelle: LIB_INCONNU, lu: j(0.02) }),
];
// À retirer : 12345603, 12345606, XW…002TS, XW…003TS, 12345604, 12345605.
const A_RETIRER = ['12345603', '12345606', 'XW000000002TS', 'XW000000003TS', '12345604', '12345605'];

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const seul = (x) => !process.env.BANC_SEUL || process.env.BANC_SEUL.split(',').includes(x);
const essaie = async (nom, f) => { if (!seul(String(nom).trim().charAt(0))) return; try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 180)); } };

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.onnx': 'application/octet-stream' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul'); process.exit(1); });

// La projection `select=` APPLIQUÉE (§6.3) : `meta->>k` est retraduit vers
// `data->>k` par `metaVersData`, puis chaque alias reçoit sa valeur.
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    if (src === 'updated_at') { out[alias] = new Date(NOW).toISOString(); continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : v;
  }
  return out;
};

// `opts.transpKo` : la lecture `transp_*` répond 503 (notre base, pas le transporteur).
// `opts.horloge` : `page.clock` installé (relecture C5).
async function preparer(b, vp, sombre, opts = {}) {
  const ROWS = opts.rows || BASE();
  const mobile = vp.width < 600;
  const ctx = await b.newContext({ viewport: vp, ...(mobile ? { isMobile: true, hasTouch: true } : {}), locale: 'fr-FR', timezoneId: 'Europe/Paris', serviceWorkers: 'block' });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const c5 = []; const lecturesTransp = [];
  const etat = { c5Change: false };
  if (opts.horloge) await pg.clock.install({ time: Date.now() });
  // `opts.pont` : une extension À JOUR qui répond au pont (version d'`EXT_ATTENDUE`),
  // avec ce qu'elle dit d'elle-même (`nav`, tour 2 n° 12).
  if (opts.pont) await pg.addInitScript((p) => {
    const post = (m) => window.postMessage(m, '*');
    window.addEventListener('message', (e) => {
      const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
      if (d.__vmr === 'ping') post({ __vmr: 'ready', version: p.version, id: p.id });
      if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: Object.assign({ ok: true, version: p.version, code: p.version, ext: p.id, vrm: { ok: true, connecte: true, email: 'transp@example.test', user_id: '11111111-1111-4111-8111-111111111111' }, vinted: { uid: '111', login: 'compte_banc' }, cmds: {} }, p.nav ? { nav: p.nav } : {}) });
    });
    post({ __vmr: 'ready', version: p.version, id: p.id });
  }, opts.pont);
  await pg.addInitScript(([s, dark]) => {
    localStorage.setItem('vrm_session', JSON.stringify(s)); localStorage.setItem('vrm_local_owner', s.user.id); localStorage.setItem('schema_cloisonne', '1'); localStorage.setItem('vinted_dark', dark ? 'true' : 'false');
    window.__cache = false;
    try { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (window.__cache ? 'hidden' : 'visible') }); } catch (_) {}
    try { Object.defineProperty(document, 'hidden', { configurable: true, get: () => !!window.__cache }); } catch (_) {}
  }, [SESSION, !!sombre]);
  await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: SESSION.access_token, refresh_token: 'r', expires_in: 3600, user: SESSION.user }) }));
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const rep = (d, st = 200) => route.fulfill({ status: st, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (req.method() === 'POST') return route.fulfill({ status: 201, headers: { 'access-control-allow-origin': '*' }, body: '' });
    if (req.method() !== 'GET') return rep([]);
    if (/id=like\.transp_/.test(u)) {
      lecturesTransp.push(Date.now());
      if (opts.transpKo) return route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"indisponible"}' });
    }
    if (/select=owner/.test(u)) return rep([]);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return rep(ACCOUNTS);
    if (/\/rest\/v1\/rpc\//.test(u)) return rep(null);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && !/^id,data/.test(sel) && !/^data,updated_at/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: new Date(NOW).toISOString(), cap: r.data && r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return rep(ROWS.filter((r) => r.id === eq[1]).map(forme));
    const ins = /id=in\.\(([^)]*)\)/.exec(u); if (ins) { const ids = ins[1].split(','); return rep(ROWS.filter((r) => ids.includes(r.id)).map(forme)); }
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return rep(ROWS.filter((r) => re.test(r.id)).map(forme)); }
    return rep([]);
  });
  await pg.route('**/api/**', (r) => {
    const url = r.request().url();
    if (/\/api\/relais/.test(url) && /mode=transp(?![-a-z])/.test(url) && r.request().method() === 'POST') {
      c5.push(Date.now());
      const lus = etat.c5Change ? [{ carrier: 'mondialrelay', suivi: '12345603', res: 'ok', change: true }] : [];
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, v: 1, lus, besoinNavigateur: [] }) });
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(url.includes('mode=confidentialite') ? { ok: true, uid: SESSION.user.id } : { ok: true, pret: true, obligatoire: false, acces: true }) });
  });
  return { ctx, pg, errs, ROWS, c5, lecturesTransp, etat };
}

const ouvrirAchats = async (pg, errs) => {
  await pg.goto(`http://localhost:${PORT}/?tab=cat_achats`, { waitUntil: 'domcontentloaded' });
  await pg.locator('.vrm-pickup-card').first().waitFor({ timeout: 20000 }).catch(async (e) => { console.log('ÉCRAN : ' + (await pg.locator('body').innerText()).slice(0, 1200)); console.log('ERREURS : ' + errs.join(' | ')); throw e; });
  await pg.waitForTimeout(1800);
};
const ouvrirJournee = async (pg, errs) => {
  await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
  await pg.locator('[data-tuile="retirer"]').first().waitFor({ timeout: 20000 }).catch(async (e) => { console.log('ÉCRAN : ' + (await pg.locator('body').innerText()).slice(0, 1200)); console.log('ERREURS : ' + errs.join(' | ')); throw e; });
  // la tuile peut dire « pas encore lu » le temps que tout arrive
  for (let i = 0; i < 40; i++) { const n = await pg.locator('[data-tuile="retirer"]').first().getAttribute('data-n'); if (n !== '' && n != null) break; await pg.waitForTimeout(250); }
  await pg.waitForTimeout(1200);
};
// Rouge (le danger des deux thèmes, #C0392B / #FF6B6B) — jamais sur ces lignes (§7).
const ROUGE_JS = `(v) => { const m = /rgba?\\(([\\d.]+),\\s*([\\d.]+),\\s*([\\d.]+)/.exec(v || ''); if (!m) return false; const r=+m[1], g=+m[2], b=+m[3]; return r > 150 && g < 120 && b < 120 && r - g > 80 && Math.abs(g - b) < 40; }`;
const lire = (pg) => pg.evaluate((rougeSrc) => {
  const rouge = new Function('return ' + rougeSrc)();
  const lieuDuGroupe = (el) => { for (let e = el; e; e = e.parentElement) { const d = e.querySelector && e.querySelector('.vrm-pickup-dest'); if (d) return d.innerText; } return ''; };
  const ligneT = (c) => { const x = c.querySelector('.vrm-transp'); return x ? { etat: x.getAttribute('data-transp'), etatLu: x.getAttribute('data-transp-etat'), t: x.innerText, color: getComputedStyle(x).color, court: x.hasAttribute('data-transp-court') } : null; };
  const cartes = [...document.querySelectorAll('.vrm-pickup-card')].map((c) => {
    const s = c.querySelector('[data-colis-suivi]');
    const lim = c.querySelector('[data-colis-limite]');
    return { suivi: s ? s.getAttribute('data-colis-suivi') : null, t: c.innerText, transp: ligneT(c), lieu: lieuDuGroupe(c),
      limite: lim ? lim.getAttribute('data-colis-limite') : null, limiteVers: lim ? lim.getAttribute('data-colis-limite-vers') : null,
      codePasLu: (c.querySelector('[data-colis-code-pas-lu]') || {}).getAttribute ? c.querySelector('[data-colis-code-pas-lu]').getAttribute('data-colis-code-pas-lu') : null };
  });
  const verif = [...document.querySelectorAll('[data-a-verifier] [data-oublie]')].map((x) => ({ suivi: x.getAttribute('data-colis-suivi'), raison: x.getAttribute('data-a-verifier-raison'), transp: ligneT(x), t: x.innerText }));
  const repartis = [...document.querySelectorAll('[data-repartis] [data-reparti-suivi]')].map((x) => ({ suivi: x.getAttribute('data-reparti-suivi'), transp: ligneT(x), t: x.innerText }));
  const zones = [...document.querySelectorAll('.vrm-pickup-card, [data-a-verifier], [data-repartis], [data-transp-mr], [data-transp-mr-refus], [data-transp-passu], [data-transp-non-lu]')];
  const rougesVus = [];
  // La pastille de MARQUE d'un transporteur (CarrierBadge : titre + graisse 900,
  // le rouge de Chronopost) n'est pas une alerte : elle est écartée.
  const marque = (el) => el.tagName === 'SPAN' && el.getAttribute('title') && getComputedStyle(el).fontWeight === '900';
  for (const z of zones) for (const el of [z, ...z.querySelectorAll('*')]) { if (marque(el) || (el.parentElement && marque(el.parentElement))) continue; const cs = getComputedStyle(el); if (rouge(cs.color) && (el.innerText || '').trim()) rougesVus.push(`${el.tagName}:${cs.color}:${(el.innerText || '').slice(0, 30)}`); else if (rouge(cs.borderTopColor) && cs.borderTopWidth !== '0px') rougesVus.push(`${el.tagName}[bord]:${cs.borderTopColor}`); else if (rouge(cs.backgroundColor)) rougesVus.push(`${el.tagName}[fond]:${cs.backgroundColor}`); }
  // Le serveur lit Mondial Relay : seule la phrase du REFUS (`data-transp-mr-refus`)
  // peut s'écrire ; « ne se lit que depuis ton ordinateur » (`data-transp-mr`), jamais.
  const mr = document.querySelector('[data-transp-mr-refus]');
  const mrOrdi = document.querySelector('[data-transp-mr]');
  const passu = document.querySelector('[data-transp-passu]');
  const reessayer = document.querySelector('[data-transp-reessayer]');
  const ajouter = document.querySelector('[data-suivi-ajouter]');
  const h = (el) => (el ? el.getBoundingClientRect().height : null);
  const onglet = document.querySelector('[data-achats-onglet="attente"]');
  return {
    cartes, verif, repartis, rougesVus,
    mr: mr ? { n: mr.getAttribute('data-transp-mr-n'), etat: mr.getAttribute('data-transp-mr-refus'), t: mr.innerText } : null,
    mrOrdi: mrOrdi ? mrOrdi.innerText : null, nMr: document.querySelectorAll('[data-transp-mr-refus]').length,
    cpTete: [...document.querySelectorAll('[data-transp-cp]')].map((x) => ({ k: x.getAttribute('data-transp-cp'), n: x.getAttribute('data-transp-cp-n'), t: x.innerText })),
    passu: passu ? passu.innerText : null, nPassu: document.querySelectorAll('[data-transp-passu]').length, hReessayer: h(reessayer), hAjouter: h(ajouter),
    suivre: [...document.querySelectorAll('.vrm-pickup-card a[data-suivre-colis]')].map((a) => a.getBoundingClientRect().height),
    total: onglet ? onglet.getAttribute('data-n') : null,
    // L'ambre de CE thème (C.warn) : la bordure du bloc « à vérifier » le porte.
    ambre: (() => { const v = document.querySelector('[data-a-verifier]'); return v ? getComputedStyle(v).borderTopColor : null; })(),
    texte: document.body.innerText, deborde: document.documentElement.scrollWidth > window.innerWidth + 1,
    bg: getComputedStyle(document.body).backgroundColor,
  };
}, ROUGE_JS);

// ── LE WIDGET, LA VRAIE ROUTE (api/widget.js), sur les MÊMES lignes ─────────
// La publication `vrm_colis_retirer` est celle que l'app vient d'écrire (lue
// dans son navigateur) : c'est elle que le widget relit avec la même règle.
async function widgetPickup(ROWS, pub) {
  process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'banc-cle-service';
  const base = new Map(ROWS.map((r) => [r.id, r.data]));
  base.set('main', { ...(base.get('main') || {}), vrm_colis_retirer: pub, vrm_widget_token: '', vinted_pickup_done: {}, vinted_ship_done: {}, vinted_bords_shipped: {}, vinted_sales_hidden: [], vinted_bords_hidden: {}, vrm_colis_collected: [] });
  const metaDe = (d) => { const m = {}; for (const [k, v] of Object.entries(d || {})) if (v != null && typeof v !== 'object' && String(v).length <= 600) m[k] = String(v); return m; };
  const val = (id, d, k) => k === 'id' ? id : k.startsWith('meta->>') ? metaDe(d)[k.slice(7)] : undefined;
  const ok = (x, op) => { const i = op.indexOf('.'), o = op.slice(0, i), v = op.slice(i + 1); if (o === 'eq') return x === v; if (o === 'like') return x != null && new RegExp('^' + v.replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$').test(x); if (o === 'in') return v.replace(/^\(|\)$/g, '').split(',').includes(x); return true; };
  const vraiFetch = global.fetch;
  global.fetch = async (url, opts = {}) => {
    const u = new URL(String(url)); const m = (opts.method || 'GET').toUpperCase();
    const rep = (c, s = 200) => new Response(JSON.stringify(c), { status: s, headers: { 'content-type': 'application/json' } });
    if (u.pathname === '/rest/v1/rpc/vrm_acces_pour') return rep(true);
    if (u.pathname !== '/rest/v1/app_data') return rep([]);
    if (m !== 'GET') return new Response('', { status: 201 });
    const sel = u.searchParams.get('select') || '';
    if (sel === 'owner' && u.searchParams.get('limit') === '1') return rep({ message: 'column app_data.owner does not exist' }, 400);   // une seule boutique
    const conds = [...u.searchParams].filter(([k]) => !['select', 'limit', 'order', 'offset', 'on_conflict'].includes(k));
    const lignes = [...base.entries()].filter(([id, d]) => conds.every(([k, v]) => ok(val(id, d, k), v)));
    return rep(lignes.map(([id, d]) => {
      if (!sel || sel === 'data' || sel === '*') return { id, data: d };
      const o = {};
      for (const part of sel.split(',')) { const [al, ch] = part.includes(':') ? part.split(/:(.+)/) : [part, part];
        if (ch === 'id') o[al] = id; else if (ch === 'data') o[al] = d; else if (ch.startsWith('meta->>')) o[al] = metaDe(d)[ch.slice(7)] ?? null;
        else { let x = d; for (const s of ch.replace(/^data(->>|->)/, '').split(/->>|->/)) x = x == null ? undefined : x[s]; o[al] = x === undefined ? null : x; } }
      return o;
    }));
  };
  try {
    const w = (await import('file://' + path.join(RACINE, 'api', 'widget.js'))).default;
    const res = { code: 0 }; res.status = (n) => { res.code = n; return res; }; res.json = (o) => { res.corps = o; return res; }; res.setHeader = () => {}; res.end = () => res; res.send = () => res;
    await w({ method: 'GET', headers: {}, query: {} }, res);
    return { code: res.code || 200, pickup: res.corps ? res.corps.pickup : undefined, corps: res.corps };
  } finally { global.fetch = vraiFetch; }
}
const publication = (pg) => pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vrm_colis_retirer') || 'null'); } catch (_) { return null; } });

async function navigateur() {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  const tailles = [['390 clair', { width: 390, height: 844 }, false], ['1512 sombre', { width: 1512, height: 950 }, true]];
  try {
    for (const [nom, vp, sombre] of tailles) {
      // ── A. Achats → À retirer : chaque ligne du transporteur appliquée ──
      await essaie(`A ${nom}`, async () => {
        const { ctx, pg, errs } = await preparer(b, vp, sombre);
        await ouvrirAchats(pg, errs);
        const r = await lire(pg);
        const carte = (n) => r.cartes.find((c) => c.suivi === n);
        const ambre = r.ambre;
        dit(!!ambre, `${nom} A : l'ambre du thème est mesuré (bordure de « à vérifier »)`, String(ambre));
        dit(!carte('XW000000001TS'), `${nom} A : un « disponible » par e-mail que le transporteur dit RETIRÉ n'est plus « à retirer »`, r.cartes.map((c) => c.suivi).join(' · '));
        dit(r.total === String(A_RETIRER.length) && A_RETIRER.every((n) => !!carte(n)), `${nom} A : « À retirer » compte ${A_RETIRER.length} — les colis encore là, et eux seuls`, `data-n=${r.total} · ${r.cartes.map((c) => c.suivi).join(' · ')}`);
        const q = r.verif.find((x) => x.suivi === '12345601');
        dit(!carte('12345601') && q && q.raison === 'transporteur' && q.transp && q.transp.etatLu === 'incident' && /a quitté le point relais/.test(q.transp.t), `${nom} A : « a quitté le point relais sans être retiré » ⇒ « à vérifier », jamais « à retirer »`, q ? `${q.raison} · ${q.transp && q.transp.t}` : 'absent de « à vérifier »');
        dit(q && q.transp && q.transp.color === ambre, `${nom} A : sa ligne du transporteur est en AMBRE`, q && q.transp && q.transp.color);
        const rp = r.repartis.find((x) => x.suivi === '12345602');
        dit(!carte('12345602') && rp && rp.transp && rp.transp.etatLu === 'retour_expediteur' && /ne te déplace pas/.test(rp.transp.t), `${nom} A : « repart chez l'expéditeur » (transporteur seul) ⇒ dans « repartis », « ne te déplace pas »`, rp ? rp.transp && rp.transp.t : 'absent de « repartis »');
        dit(rp && rp.transp && rp.transp.color === ambre, `${nom} A : la ligne d'un retour est en AMBRE`, rp && rp.transp && rp.transp.color);
        const c3 = carte('12345603');
        dit(c3 && /tabac banc/i.test(c3.lieu), `${nom} A : « en transit » par e-mail, DISPONIBLE plus tard chez le transporteur ⇒ dans « À retirer », au point du transporteur (TABAC BANC)`, c3 ? c3.lieu.replace(/\s+/g, ' ').slice(0, 80) : 'pas de carte');
        dit(c3 && c3.limite === 'vers' && c3.limiteVers === dans(6) && /À retirer vers le/.test(c3.t), `${nom} A : sa limite déduite est dite « vers le », jamais « jusqu'au »`, c3 && `${c3.limite} ${c3.limiteVers}`);
        dit(c3 && c3.codePasLu === 'transporteur', `${nom} A : « VRM ne lit que le statut » — aucun code inventé`, c3 && c3.codePasLu);
        const c6 = carte('12345606');
        dit(!!c6 && !r.verif.some((x) => x.suivi === '12345606'), `${nom} A : la garde de 5 j (Mondial Relay, sans date limite) est levée par une lecture « disponible » d'il y a 1 h ⇒ « à retirer »`, c6 ? 'à retirer' : (r.verif.find((x) => x.suivi === '12345606') || {}).raison);
        // Les trois états de la ligne, plus « code postal inconnu ».
        const lu = c6 && c6.transp, passu = carte('XW000000002TS'), jamais = carte('XW000000003TS'), cpi = carte('12345604'), bl = carte('12345605');
        // (tour 2 n° 6) La carte dit DÉJÀ le point et la limite : « disponible » confirmé
        // chez le transporteur n'y laisse qu'une marque courte, avec l'âge de la lecture.
        dit(lu && lu.etat === 'lu' && lu.court && /^Confirmé chez Mondial Relay (il y a|à l'instant)/.test(lu.t) && !/Point Relais|jusqu|vers le/i.test(lu.t), `${nom} A : ligne LUE « disponible » : une marque courte (« Confirmé chez Mondial Relay il y a 1 h »), sans redire le point ni la limite`, lu && lu.t);
        dit(lu && ambre && lu.color !== ambre, `${nom} A : une ligne « disponible » reste NEUTRE (l'ambre est pour un retour, un incident, un inconnu)`, lu && lu.color);
        dit(passu && passu.transp && passu.transp.etat === 'passu' && /n'a pas répondu/.test(passu.transp.t), `${nom} A : ligne PAS SU : « n'a pas répondu — VRM réessaie plus tard »`, passu && passu.transp && passu.transp.t);
        dit(jamais && jamais.transp && jamais.transp.etat === 'jamais' && /pas encore lu chez le transporteur/.test(jamais.transp.t), `${nom} A : ligne JAMAIS LUE : « pas encore lu chez le transporteur »`, jamais && jamais.transp && jamais.transp.t);
        // (tour 2 n° 2) Le geste est dit UNE fois en tête, la carte n'en garde que l'état.
        dit(cpi && cpi.transp && cpi.transp.etat === 'cp-inconnu' && /code postal du point relais inconnu/.test(cpi.transp.t) && !/N° de suivi ajoutés/.test(cpi.transp.t), `${nom} A : « code postal inconnu » sur la carte, sans le geste (dit en tête)`, cpi && cpi.transp && cpi.transp.t);
        dit(r.cpTete.length === 1 && r.cpTete[0].k === 'inconnu' && r.cpTete[0].n === '1' && /N° de suivi ajoutés/.test(r.cpTete[0].t), `${nom} A : « code postal inconnu » : le GESTE (l'ajouter avec son code postal) dit UNE fois en tête de liste`, JSON.stringify(r.cpTete));
        dit(r.hAjouter != null && r.hAjouter >= 43.5, `${nom} A : le geste « Ajouter un n° de suivi » fait 44 px`, String(r.hAjouter));
        const inc = r.verif.find((x) => x.suivi === 'XW000000004TS');
        dit(inc && inc.transp && inc.transp.t.includes(`« ${LIB_INCONNU} »`) && /statut que VRM ne connaît pas/.test(inc.transp.t), `${nom} A : un statut inconnu est recopié TEL QUEL, et ce n'est pas « à retirer »`, inc ? inc.transp && inc.transp.t : 'absent de « à vérifier »');
        dit(inc && inc.transp && inc.transp.color === ambre, `${nom} A : un statut inconnu est en AMBRE`, inc && inc.transp && inc.transp.color);
        // Mondial Relay : la phrase seulement pour la ligne `bloque`.
        dit(r.mr && r.mr.n === '1' && r.nMr === 1 && /refuse en ce moment la lecture du serveur VRM \(1 colis\)/.test(r.mr.t), `${nom} A : « Mondial Relay refuse en ce moment la lecture du serveur » — UNE fois, pour la seule ligne bloquée (pas le code postal inconnu, pas les lues)`, r.mr ? `${r.mr.n} · ${r.mr.t.slice(0, 140)}` : 'absente');
        dit(!r.mrOrdi, `${nom} A : le serveur lit Mondial Relay ⇒ jamais « Mondial Relay ne se lit que depuis ton ordinateur »`, r.mrOrdi && r.mrOrdi.slice(0, 120));
        dit(bl && bl.transp && bl.transp.etat === 'passu', `${nom} A : la ligne bloquée dit « pas su » sur sa carte (jamais un statut inventé)`, bl && bl.transp && bl.transp.etat);
        dit(r.nPassu === 0, `${nom} A : notre base a répondu : aucune phrase « pas pu être relu »`);
        dit(!r.rougesVus.length, `${nom} A : aucun rouge sur les colis, « à vérifier », « repartis » ni les phrases du transporteur (§7)`, r.rougesVus.slice(0, 4).join(' | '));
        dit(r.suivre.length >= 4 && r.suivre.every((x) => x >= 43.5), `${nom} A : chaque « Suivre ↗ » fait 44 px`, r.suivre.map(Math.round).join(','));
        dit(!r.deborde, `${nom} A : rien ne déborde`);
        if (sombre) dit(/rgb\((\d{1,2}), (\d{1,2}), (\d{1,2})\)/.test(r.bg), `${nom} A : le fond est sombre`, r.bg);
        if (process.env.SHOTS) await pg.screenshot({ path: path.join(process.env.SHOTS, `transporteurs-${nom.replace(/\s+/g, '-')}.png`), fullPage: true });
        dit(!errs.length, `${nom} A : aucune erreur d'app`, errs[0]);
        await ctx.close();
      });
    }
    // ── B. Ma journée et le widget disent le MÊME nombre (§11), y compris
    //       quand le transporteur change d'avis pendant que l'app est fermée ──
    await essaie('B', async () => {
      const ROWS = BASE();
      const { ctx, pg, errs } = await preparer(b, { width: 390, height: 844 }, false, { rows: ROWS });
      await ouvrirJournee(pg, errs);
      const n1 = await pg.locator('[data-tuile="retirer"]').first().getAttribute('data-n');
      const pub1 = await publication(pg);
      const w1 = await widgetPickup(ROWS, pub1);
      dit(n1 === String(A_RETIRER.length), `B : Ma journée compte ${A_RETIRER.length} colis à retirer (le retiré chez le transporteur n'y est pas)`, `data-n=${n1}`);
      dit(w1.code === 200 && w1.pickup === Number(n1), 'B : le widget (la vraie route) dit le même nombre que Ma journée', `widget=${w1.pickup} (${w1.code}) · journée=${n1}`);
      await ctx.close();
      // L'app fermée : le transporteur dit maintenant RETIRÉ le colis 12345603.
      const i = ROWS.findIndex((r) => r.id === 'transp_mondialrelay_12345603');
      ROWS[i] = transp('mondialrelay', '12345603', { etat: 'retire', etatAt: new Date(NOW - 20 * MIN).toISOString(), libelle: 'Colis livré au destinataire', lu: new Date(NOW - 10 * MIN).toISOString(), fini: true, voie: 'mr-fr-mvc' });
      // …et Mondial Relay accepte de nouveau le serveur pour 12345605.
      const k = ROWS.findIndex((r) => r.id === 'transp_mondialrelay_12345605');
      ROWS[k] = transp('mondialrelay', '12345605', { etat: 'disponible', etatAt: j(0.5), libelle: 'Colis disponible au Point Relais', lu: new Date(NOW - 10 * MIN).toISOString() });
      const w2 = await widgetPickup(ROWS, pub1);
      dit(w2.code === 200 && w2.pickup === A_RETIRER.length - 1, `B : app fermée, le transporteur dit retiré ⇒ le widget descend à ${A_RETIRER.length - 1} sans attendre l'app`, `widget=${w2.pickup}`);
      const o = await preparer(b, { width: 390, height: 844 }, false, { rows: ROWS });
      await ouvrirJournee(o.pg, o.errs);
      const n2 = await o.pg.locator('[data-tuile="retirer"]').first().getAttribute('data-n');
      const w3 = await widgetPickup(ROWS, await publication(o.pg));
      dit(n2 === String(A_RETIRER.length - 1) && w3.pickup === Number(n2), 'B : l\'app rouverte : Ma journée et le widget disent tous deux ' + (A_RETIRER.length - 1), `journée=${n2} · widget=${w3.pickup}`);
      await ouvrirAchats(o.pg, o.errs);
      const r = await lire(o.pg);
      dit(r.total === n2 && !r.cartes.some((c) => c.suivi === '12345603'), 'B : Achats → À retirer dit le même nombre, sans le colis retiré', `data-n=${r.total}`);
      dit(!r.mr, 'B : plus aucune ligne bloquée ⇒ plus de phrase « Mondial Relay refuse »', r.mr && r.mr.t.slice(0, 100));
      dit(!errs.length && !o.errs.length, 'B : aucune erreur d\'app', (errs[0] || o.errs[0]));
      await o.ctx.close();
    });
    // ── C. Notre base ne répond pas sur `transp_*` : dit une fois, rien n'est perdu ──
    await essaie('C', async () => {
      const { ctx, pg, errs } = await preparer(b, { width: 1512, height: 950 }, true, { transpKo: true });
      await ouvrirAchats(pg, errs);
      const r = await lire(pg);
      dit(r.nPassu === 1 && /n'a pas pu être relu/.test(r.passu || '') && /Rien n'est perdu/.test(r.passu || ''), 'C : lecture de `transp_*` ratée ⇒ « n\'a pas pu être relu… Rien n\'est perdu », UNE fois', r.passu && r.passu.slice(0, 120));
      dit(r.hReessayer != null && r.hReessayer >= 43.5, 'C : « Réessayer » fait 44 px', String(r.hReessayer));
      dit(r.cartes.some((c) => c.suivi === 'XW000000001TS') && r.cartes.every((c) => !c.transp), 'C : les colis restent (ce que disent les e-mails) ; aucune ligne de transporteur inventée', r.cartes.map((c) => c.suivi).join(' · '));
      dit(!r.mr, 'C : « pas su » n\'accuse pas Mondial Relay');
      dit(!r.rougesVus.length, 'C : aucun rouge', r.rougesVus.slice(0, 3).join(' | '));
      dit(!errs.length, 'C : aucune erreur d\'app', errs[0]);
      await ctx.close();
    });
    // ── D. La relecture C5, horloge pilotée : une fois par 5 min, et elle RELIT ──
    await essaie('D', async () => {
      const ROWS = BASE();
      const { ctx, pg, errs, c5, lecturesTransp, etat } = await preparer(b, { width: 390, height: 844 }, false, { rows: ROWS, horloge: true });
      await ouvrirAchats(pg, errs);
      const attendre = async (f, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await f()) return true; await new Promise((r) => setTimeout(r, 200)); } return false; };
      await attendre(async () => c5.length >= 1);
      dit(c5.length === 1, 'D : à l\'ouverture, la relecture chez les transporteurs (C5) part SANS CLIC, une fois', `appels=${c5.length}`);
      await pg.clock.runFor(4 * MIN);
      await pg.evaluate(() => { window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('focus')); });
      await new Promise((r) => setTimeout(r, 1200));
      dit(c5.length === 1, 'D : 4 min plus tard (4 tics, deux retours au premier plan) : pas de second appel', `appels=${c5.length}`);
      await pg.evaluate(() => { window.__cache = true; document.dispatchEvent(new Event('visibilitychange')); });
      await pg.clock.runFor(2 * MIN);
      await new Promise((r) => setTimeout(r, 800));
      dit(c5.length === 1, 'D : onglet caché : aucune relecture, même passé 5 min', `appels=${c5.length}`);
      await pg.evaluate(() => { window.__cache = false; document.dispatchEvent(new Event('visibilitychange')); });
      await attendre(async () => c5.length >= 2);
      dit(c5.length === 2, 'D : de retour au premier plan, passé 5 min : elle repart, une fois', `appels=${c5.length}`);
      // Le serveur a changé un état : l'écran relit `transp_*` et le colis sort, sans recharger.
      const i = ROWS.findIndex((r) => r.id === 'transp_mondialrelay_12345603');
      ROWS[i] = transp('mondialrelay', '12345603', { etat: 'retire', etatAt: new Date(Date.now() - 5 * MIN).toISOString(), libelle: 'Colis livré au destinataire', lu: new Date().toISOString(), fini: true });
      etat.c5Change = true;
      const avant = lecturesTransp.length;
      await pg.clock.runFor(6 * MIN);
      await attendre(async () => c5.length >= 3);
      const sorti = await attendre(async () => !(await lire(pg)).cartes.some((c) => c.suivi === '12345603'));
      dit(c5.length === 3 && lecturesTransp.length > avant && sorti, 'D : C5 rend « changé » ⇒ `vrm:transp-maj` ⇒ les lignes `transp_*` sont relues et le colis retiré sort, sans recharger', `appels=${c5.length} · relectures=${lecturesTransp.length - avant} · sorti=${sorti}`);
      // L'évènement seul (l'extension, sa voie de secours) relit aussi.
      etat.c5Change = false;
      const k = ROWS.findIndex((r) => r.id === 'transp_mondialrelay_12345606');
      ROWS[k] = transp('mondialrelay', '12345606', { etat: 'incident', detail: 'quitte_relais', etatAt: new Date(Date.now() - 5 * MIN).toISOString(), libelle: 'Colis sorti du Point Relais', lu: new Date().toISOString() });
      await pg.clock.runFor(3000);
      const avant2 = lecturesTransp.length;
      await pg.evaluate(() => window.dispatchEvent(new Event('vrm:transp-maj')));
      const passe = await attendre(async () => (await lire(pg)).verif.some((x) => x.suivi === '12345606'));
      dit(lecturesTransp.length > avant2 && passe && c5.length === 3, 'D : `vrm:transp-maj` relit `transp_*` (12345606 passe « à vérifier »), sans relancer C5', `relectures=${lecturesTransp.length - avant2} · appels=${c5.length}`);
      dit(!errs.length, 'D : aucune erreur d\'app', errs[0]);
      await ctx.close();
    });
    // ── E. Tour 1 du 29 octobre (revue n° 1, 2, 3, 5, 8, 10 ; constats a, b) ──
    //    Une base À PART (les colis de A à D n'y sont pas), aux deux tailles.
    const RELAIS_ST = "La livraison n'a pas encore eu lieu - colis déposé en bureau de Poste ou point relais";
    const achatE = (tx, conv, title) => ({ transaction_id: tx, conversation_id: conv, title, price: { amount: '45', currency_code: 'EUR' }, status: RELAIS_ST, transaction_user_status: 'needs_action', date: j(3) });
    const suiviV = (tx, suivi, transporteur) => ({ id: `harvest_111_suivi_${tx}`, data: { v: 1, tx: String(tx), source: 'journey', capturedAt: j(0.05), transporteur, suivi, etapes: [], forme: {}, dernier: null } });
    const LIM_AT = new Date(Date.parse(dans(1) + 'T09:34:00Z')).toISOString();   // 10 h 34 à Paris (heure d'hiver)
    const ROWS_E = () => [
      { id: 'main', data: { vrm_colis_collected: ['XW000000076TS'] } },
      { id: 'panel_colis_relais', data: {} },
      { id: 'harvest_111_orders_purchased', data: { capturedAt: j(0.05), payload: { my_orders: [
        achatE(9701, 7701, 'Achat V1 reparti chez le transporteur'),
        achatE(9703, 7703, 'Achat V3 Vinted Go'),
        achatE(9706, 7706, 'Achat au même n° que son e-mail'),
        achatE(9707, 7707, 'Achat sans aucune identité'),
      ] } } },
      // n° 1 : arrivée = la capture (il y a 1 h) ; le transporteur dit reparti il y a 2 jours.
      suiviV(9701, 'XW000000071TS', 'Chronopost'),
      transp('chronopost', 'XW000000071TS', { etat: 'retour_expediteur', etatAt: j(2), libelle: 'Retour à l\'expéditeur', lu: j(0.02) }),
      // n° 2 : un e-mail resté « en transit », le transporteur dit « a quitté le point relais ».
      track('email_track_chronopost_XW000000072TS', { carrier: 'chronopost', suivi: 'XW000000072TS', status: 'transit', statusLabel: 'En cours de livraison', subject: 'Information sur votre colis XW000000072TS', code: null, lieu: null, receivedAt: j(2), emailAt: j(2), arriveLe: null, limite: null }),
      transp('chronopost', 'XW000000072TS', { etat: 'incident', detail: 'quitte_relais', etatAt: j(0.5), libelle: 'Colis sorti du point relais', lu: j(0.02) }),
      // n° 2 : un n° ajouté à la main, que le transporteur dit reparti.
      { id: 'colis_suivi_mondialrelay_12345671', data: { suivi: '12345671', transporteur: 'mondialrelay', codePostal: '99999', at: j(4) } },
      transp('mondialrelay', '12345671', { etat: 'retour_expediteur', etatAt: j(1), libelle: 'Colis en retour vers l\'expéditeur', lu: j(0.02), cp: '99999' }),
      // n° 3 : une lecture « disponible » récente dont la limite DÉDUITE est passée ⇒ la garde reste.
      track('email_track_mondialrelay_12345672', { carrier: 'mondialrelay', suivi: '12345672', subject: 'Votre colis 12345672 est disponible 📦', code: '727272', lieu: BAR, receivedAt: j(6.5), emailAt: j(6.5), arriveLe: j(6.5), limite: null }),
      transp('mondialrelay', '12345672', { etat: 'disponible', etatAt: j(6.4), libelle: 'Colis disponible au Point Relais', lu: new Date(NOW - H).toISOString(), limite: dans(-1), limiteSure: false }),
      // n° 5 : un achat Vinted dont Vinted Go donne la limite ET l'heure.
      suiviV(9703, '1234567890123403', 'Vinted Go'),
      transp('vinted', '1234567890123403', { etat: 'disponible', etatAt: j(1), libelle: 'Ton colis t\'attend', lieuNom: 'Consigne Banc', lu: j(0.02), limite: dans(1), limiteSure: true, limiteAt: LIM_AT }),
      // n° 8 : retiré il y a 60 jours (ligne finie) — jamais revenu « à vérifier ».
      track('email_track_mondialrelay_12345673', { carrier: 'mondialrelay', suivi: '12345673', subject: 'Votre colis 12345673 est disponible 📦', code: '737373', lieu: BAR, receivedAt: j(70), emailAt: j(70), arriveLe: j(70), limite: null }),
      transp('mondialrelay', '12345673', { etat: 'retire', etatAt: j(60), libelle: 'Colis livré au destinataire', lu: j(60), essai: j(60), fini: true }),
      // n° 10 : reparti il y a 40 jours (transporteur seul) ⇒ plus montré ; il y a 10 jours ⇒ montré.
      track('email_track_mondialrelay_12345675', { carrier: 'mondialrelay', suivi: '12345675', subject: 'Votre colis 12345675 est disponible 📦', code: '757575', lieu: BAR, receivedAt: j(45), emailAt: j(45), arriveLe: j(45), limite: null }),
      transp('mondialrelay', '12345675', { etat: 'retour_expediteur', etatAt: j(40), libelle: 'Colis en retour vers l\'expéditeur', lu: j(0.02) }),
      track('email_track_mondialrelay_12345676', { carrier: 'mondialrelay', suivi: '12345676', subject: 'Votre colis 12345676 est disponible 📦', code: '767600', lieu: BAR, receivedAt: j(12), emailAt: j(12), arriveLe: j(12), limite: null }),
      transp('mondialrelay', '12345676', { etat: 'retour_expediteur', etatAt: j(10), libelle: 'Colis en retour vers l\'expéditeur', lu: j(0.02) }),
      // constat a : le même n° vu par Vinted (sans code) qu'un e-mail coché « retiré » ⇒ UNE carte (aucune).
      track('email_track_chronopost_XW000000076TS', { carrier: 'chronopost', suivi: 'XW000000076TS', subject: 'Votre colis est disponible dans votre Relais Pickup', code: '767676', lieu: RELAIS }),
      suiviV(9706, 'XW000000076TS', 'Chronopost'),
      // un vrai colis à retirer (e-mail avec code), d'un compte qui n'a aucune commande reliée.
      track('email_track_chronopost_XW000000077TS', { carrier: 'chronopost', suivi: 'XW000000077TS', subject: 'Votre colis est disponible dans votre Relais Pickup', code: '777700', lieu: RELAIS, limite: dans(3) }),
    ];
    const lireE = (pg) => pg.evaluate(() => {
      const conv = (el) => [...el.querySelectorAll('a[href*="/inbox/"]')].map((a) => (a.getAttribute('href') || '').split('/inbox/')[1]);
      const cartes = [...document.querySelectorAll('.vrm-pickup-card')].map((c) => { const s = c.querySelector('[data-colis-suivi]'); const lt = c.querySelector('[data-colis-limite-transp]'); return { suivi: s ? s.getAttribute('data-colis-suivi') : null, conv: conv(c), t: c.innerText, limTransp: lt ? lt.getAttribute('data-colis-limite') : null, limTxt: lt ? lt.innerText : '' }; });
      return {
        cartes, total: (document.querySelector('[data-achats-onglet="attente"]') || { getAttribute: () => null }).getAttribute('data-n'),
        verif: [...document.querySelectorAll('[data-a-verifier] [data-oublie]')].map((x) => x.getAttribute('data-colis-suivi')),
        verifV: [...document.querySelectorAll('[data-a-verifier] [data-a-verifier-vinted]')].map((x) => x.getAttribute('data-a-verifier-vinted')),
        repS: [...document.querySelectorAll('[data-repartis] [data-reparti-suivi]')].map((x) => x.getAttribute('data-reparti-suivi')),
        repT: [...document.querySelectorAll('[data-repartis] [data-reparti-tx]')].map((x) => x.getAttribute('data-reparti-tx')),
        enVerif: [...document.querySelectorAll('[data-en-verification-tx]')].map((x) => x.getAttribute('data-en-verification-tx')),
        verifTxt: (document.querySelector('[data-a-verifier]') || { innerText: '' }).innerText,
        texte: document.body.innerText, deborde: document.documentElement.scrollWidth > window.innerWidth + 1,
      };
    });
    for (const [nom, vp, sombre] of tailles) {
      await essaie(`E ${nom}`, async () => {
        const ROWS = ROWS_E();
        const { ctx, pg, errs } = await preparer(b, vp, sombre, { rows: ROWS });
        await ouvrirAchats(pg, errs);
        const r = await lireE(pg);
        const parConv = (c) => r.cartes.find((x) => x.conv.includes(String(c)));
        const partout = (n) => [...r.cartes.map((c) => c.suivi), ...r.verif, ...r.repS].includes(n);
        dit(!parConv(7701) && r.repT.includes('9701'), `E ${nom} n° 1 : un achat Vinted (arrivée = la capture d'il y a 1 h) que le transporteur dit reparti il y a 2 j ⇒ « repartis », plus « à retirer »`, `repartis=${r.repT.join(',')} · carte=${!!parConv(7701)}`);
        dit(r.verif.includes('XW000000072TS'), `E ${nom} n° 2 : un e-mail resté « en transit », le transporteur dit « a quitté le point relais » ⇒ « à vérifier » (jamais nulle part)`, `à vérifier=${r.verif.join(',')}`);
        dit(r.repS.includes('12345671'), `E ${nom} n° 2 : un n° ajouté à la main que le transporteur dit reparti ⇒ « repartis »`, `repartis=${r.repS.join(',')}`);
        dit(!r.cartes.some((c) => c.suivi === '12345672') && r.verif.includes('12345672'), `E ${nom} n° 3 : une limite déduite (« vers le ») déjà passée ⇒ la garde n'est pas levée (« à vérifier »)`, `à vérifier=${r.verif.join(',')}`);
        const v3 = parConv(7703);
        dit(!!v3 && v3.limTransp === dans(1) && /10 h 34/.test(v3.limTxt), `E ${nom} n° 5 et n° 11 : un achat Vinted porte la limite du transporteur, avec son heure`, v3 ? `${v3.limTransp} « ${v3.limTxt} »` : 'pas de carte');
        // constat d (29 oct.) : « à vérifier » ne conclut JAMAIS « sans doute reparti » — mesuré,
        // les 5 colis ainsi nommés avaient tous été retirés. Seuls le transporteur ou Vinted le disent.
        dit(r.verif.length > 0 && !/sans doute|repartis? chez le vendeur/i.test(r.verifTxt), `E ${nom} constat d : le bloc « à vérifier » ne dit jamais « sans doute reparti »`, r.verifTxt.replace(/\s+/g, ' ').slice(0, 140));
        dit(!partout('12345673'), `E ${nom} n° 8 : retiré il y a 60 jours (ligne finie, ancienne) ⇒ nulle part (ni « à retirer », ni « à vérifier »)`, `à vérifier=${r.verif.join(',')}`);
        dit(!r.repS.includes('12345675') && r.repS.includes('12345676'), `E ${nom} n° 10 : reparti il y a 40 j ⇒ plus montré ; il y a 10 j ⇒ montré`, `repartis=${r.repS.join(',')}`);
        dit(!parConv(7706) && !r.enVerif.includes('9706'), `E ${nom} constat a : un achat Vinted sans code au même n° qu'un e-mail (coché « retiré ») ⇒ aucune seconde carte`, `carte=${!!parConv(7706)}`);
        dit(!parConv(7707) && r.enVerif.includes('9707'), `E ${nom} constat b : un achat sans aucune identité, à côté d'un colis d'e-mail sans commande ⇒ « en cours de vérification », pas « à retirer »`, `en vérif=${r.enVerif.join(',')}`);
        dit(r.total === '2' && r.cartes.some((c) => c.suivi === 'XW000000077TS'), `E ${nom} : « À retirer » compte 2 (le colis d'e-mail et l'achat Vinted Go)`, `data-n=${r.total} · ${r.cartes.map((c) => c.suivi || c.conv.join('/')).join(' · ')}`);
        const pub = await publication(pg);
        const cV3 = pub && Array.isArray(pub.colis) ? pub.colis.find((c) => c[3] === 'v:111:9703') : null;
        dit(!!cV3 && cV3[0] === dans(1) && cV3[6] === LIM_AT && pub.enVerification === 1, `E ${nom} : la publication porte la limite et l'heure de l'achat Vinted Go, et « en cours de vérification » = 1`, JSON.stringify(cV3) + ` enVérif=${pub && pub.enVerification}`);
        const w = await widgetPickup(ROWS, pub);
        dit(w.pickup === 2 && w.corps && w.corps.pickupAuMoins === true, `E ${nom} : le widget dit 2, « au moins » (un achat en vérification)`, `pickup=${w.pickup} auMoins=${w.corps && w.corps.pickupAuMoins}`);
        dit(!r.deborde, `E ${nom} : rien ne déborde`);
        dit(!errs.length, `E ${nom} : aucune erreur d'app`, errs[0]);
        if (vp.width < 600) {
          await ouvrirJournee(pg, errs);
          const tu = await pg.evaluate(() => { const x = document.querySelector('[data-tuile="retirer"]'); const jb = document.querySelector('[data-job="retrait-en-verification"]'); const jv = document.querySelector('[data-job="retrait-a-verifier"]'); return x ? { n: x.getAttribute('data-n'), jn: jb ? jb.getAttribute('data-n') : null, jt: jb ? jb.innerText : '', jv: jv ? jv.innerText : null } : null; });
          dit(tu && tu.jv != null && !/sans doute|repartis? chez le vendeur/i.test(tu.jv), `E ${nom} constat d : Ma journée dit « à vérifier », jamais « sans doute reparti »`, tu && String(tu.jv).replace(/\s+/g, ' ').slice(0, 140));
          dit(tu && tu.n === '2' && tu.jn === '1' && /en cours de vérification/.test(tu.jt), `E ${nom} : Ma journée dit 2 à retirer, et DIT (une ligne) l'achat en cours de vérification — jamais un total présenté complet`, tu && `${tu.n} · ${tu.jn} · ${tu.jt.replace(/\s+/g, ' ').slice(0, 160)}`);
        }
        await ctx.close();
      });
    }
    // ── F. Tour 2 du 29 octobre (revue n° 1, 4, 5, 8, 12) ──
    const EXT_V = (/const EXT_ATTENDUE\s*=\s*'([\d.]+)'/.exec(fs.readFileSync(path.join(RACINE, 'src', 'App.jsx'), 'utf8')) || [])[1] || '9.9.9';
    await essaie('F 390 · n° 1 : ouvrir Colis après Achats ne change pas la publication', async () => {
      const { ctx, pg, errs } = await preparer(b, { width: 390, height: 844 }, false, { rows: ROWS_E() });
      await ouvrirAchats(pg, errs);
      const p1 = await publication(pg);
      await pg.goto(`http://localhost:${PORT}/?tab=cat_bord`, { waitUntil: 'domcontentloaded' });
      await pg.waitForTimeout(4500);
      const p2 = await publication(pg);
      const r = (p) => p ? `total=${p.total} sansCode=${p.sansCode} enVérif=${p.enVerification}` : 'aucune';
      dit(!!p1 && !!p2 && p2.total === p1.total && p2.enVerification === p1.enVerification && (p2.sansCode || 0) === (p1.sansCode || 0), 'F n° 1 : la publication `vrm_colis_retirer` reste celle d\'Achats après l\'ouverture de Colis (les achats « en vérification » n\'y sont pas recomptés)', `Achats : ${r(p1)} · après Colis : ${r(p2)}`);
      dit(!!p1 && Array.isArray(p1.verif) && p1.verif.some((c) => Array.isArray(c) && c[3] === 'e:XW000000072TS') && p1.aVerifier === p1.verif.length, 'F n° 7 : la publication porte les « à vérifier » avec leur IDENTITÉ (`verif`), que le widget relit chez le transporteur', p1 && JSON.stringify(p1.verif));
      const w = await widgetPickup(ROWS_E(), p2);
      dit(w.pickup === 2 && w.corps && w.corps.pickupAuMoins === true, 'F n° 1 : le widget dit toujours 2, « au moins »', `pickup=${w.pickup} auMoins=${w.corps && w.corps.pickupAuMoins}`);
      dit(!errs.length, 'F n° 1 : aucune erreur d\'app', errs[0]);
      await ctx.close();
    });
    await essaie('F 390 · n° 4 et n° 5 : le bloc « en vérification » et la carte d\'un n° sans transporteur', async () => {
      const ROWS = ROWS_E();
      const ach = ROWS.find((x) => x.id === 'harvest_111_orders_purchased');
      ach.data.payload.my_orders.push(achatE(9708, 7708, 'Achat au n° Vinted Go sans transporteur'));
      ROWS.push({ id: 'harvest_111_suivi_9708', data: { v: 1, tx: '9708', source: 'journey', capturedAt: j(0.05), transporteur: null, suivi: '1792999999999001', etapes: [{ t: 'Ton colis est disponible au point relais', at: j(0.2) }], dernier: { t: 'Ton colis est disponible au point relais', at: j(0.2) }, forme: {} } });
      const { ctx, pg, errs } = await preparer(b, { width: 390, height: 844 }, false, { rows: ROWS });
      await ouvrirAchats(pg, errs);
      const x = await pg.evaluate(() => {
        const bloc = document.querySelector('[data-en-verification]');
        const carte = [...document.querySelectorAll('.vrm-pickup-card, [data-en-verification-tx], [data-a-verifier-vinted]')].find((c) => [...c.querySelectorAll('a[href*="/inbox/"]')].some((a) => /\/inbox\/7708/.test(a.getAttribute('href') || '')) || c.getAttribute('data-en-verification-tx') === '9708');
        const l = carte ? carte.querySelector('.vrm-transp') : null;
        return { bloc: bloc ? bloc.innerText : null, ligne: l ? { etat: l.getAttribute('data-transp'), t: l.innerText } : null, trouve: !!carte };
      });
      dit(x.bloc != null && !/extension/i.test(x.bloc), 'F n° 4 : le bloc « en cours de vérification » ne promet rien de l\'extension (le geste vit dans « Suivi Vinted », gardé par sa version)', (x.bloc || 'absent').replace(/\s+/g, ' ').slice(0, 220));
      dit(x.trouve && x.ligne && x.ligne.etat === 'transporteur-inconnu', 'F n° 5 : un achat dont le suivi Vinted donne un n° sans transporteur ⇒ sa carte dit « transporteur pas encore connu », jamais rien', x.ligne ? `${x.ligne.etat} « ${x.ligne.t} »` : (x.trouve ? 'aucune ligne' : 'carte introuvable'));
      dit(!errs.length, 'F n° 4-5 : aucune erreur d\'app', errs[0]);
      await ctx.close();
    });
    await essaie('F 390 · n° 6 : une étape Vinted plus ancienne que la lecture du transporteur ne s\'affiche pas', async () => {
      // L'achat 9703 : Vinted Go le dit « disponible » depuis 1 j (lu il y a 30 min).
      const lireNv = async (atNv) => {
        const ROWS = ROWS_E();
        const sv = ROWS.find((x) => x.id === 'harvest_111_suivi_9703');
        sv.data.dernier = { t: 'Ton colis vient de partir du centre de tri', at: atNv };
        sv.data.etapes = [sv.data.dernier];
        const { ctx, pg, errs } = await preparer(b, { width: 390, height: 844 }, false, { rows: ROWS });
        await ouvrirAchats(pg, errs);
        const x = await pg.evaluate(() => {
          const carte = [...document.querySelectorAll('.vrm-pickup-card')].find((c) => [...c.querySelectorAll('a[href*="/inbox/"]')].some((a) => /\/inbox\/7703/.test(a.getAttribute('href') || '')));
          return carte ? { nv: !!carte.querySelector('[data-nouvelle-vinted]'), transp: !!carte.querySelector('.vrm-transp') } : null;
        });
        await ctx.close();
        return { x, errs };
      };
      const vieux = await lireNv(j(2));
      dit(vieux.x && vieux.x.transp && !vieux.x.nv, 'F n° 6 : « vient de partir du centre de tri » (il y a 2 j) sous « disponible » chez le transporteur (depuis 1 j) ne s\'affiche pas', JSON.stringify(vieux.x));
      const recent = await lireNv(j(0.01));
      dit(recent.x && recent.x.nv, 'F n° 6, l\'autre sens : une étape Vinted PLUS RÉCENTE que l\'évènement du transporteur reste affichée', JSON.stringify(recent.x));
      dit(!vieux.errs.length && !recent.errs.length, 'F n° 6 : aucune erreur d\'app', vieux.errs[0] || recent.errs[0]);
    });
    await essaie('F 1512 · n° 12 : ce que l\'extension dit d\'elle-même (`nav.indispo`)', async () => {
      const lireRefus = async (nav) => {
        const { ctx, pg, errs } = await preparer(b, { width: 1512, height: 950 }, false, { pont: { version: EXT_V, id: 'a'.repeat(32), nav } });
        await ouvrirAchats(pg, errs);
        await pg.waitForTimeout(1500);
        const m = await pg.evaluate(() => { const x = document.querySelector('[data-transp-mr-refus]'); return x ? { etat: x.getAttribute('data-transp-mr-refus'), t: x.innerText } : null; });
        await ctx.close();
        return { m, errs };
      };
      const a = await lireRefus({ indispo: ['transporteurs'] });
      dit(a.m && a.m.etat === 'permission' && /Autoriser/.test(a.m.t) && !/les lit à la place/.test(a.m.t), 'F n° 12 : l\'extension dit qu\'elle n\'a pas la permission des transporteurs ⇒ « autorise VRM… », jamais « elle les lit à la place »', a.m ? `${a.m.etat} « ${a.m.t.slice(0, 160)} »` : 'absente');
      const c = await lireRefus(null);
      dit(c.m && c.m.etat === 'ok' && /les lit à la place/.test(c.m.t), 'F n° 12, l\'autre sens : rien d\'indisponible ⇒ « l\'extension de ce Chrome les lit à la place »', c.m ? `${c.m.etat} « ${c.m.t.slice(0, 160)} »` : 'absente');
      dit(!a.errs.length && !c.errs.length, 'F n° 12 : aucune erreur d\'app', a.errs[0] || c.errs[0]);
    });
    await essaie('F 390 · n° 8 : « Reçus 1 779 » tient sur une ligne', async () => {
      const ROWS = ROWS_E();
      const ach = ROWS.find((x) => x.id === 'harvest_111_orders_purchased');
      for (let i = 0; i < 1779; i++) ach.data.payload.my_orders.push({ transaction_id: 800000 + i, conversation_id: 900000 + i, title: 'Achat reçu ' + i, price: { amount: '20', currency_code: 'EUR' }, status: 'Commande finalisée', transaction_user_status: 'completed', date: j(30 + (i % 200)) });
      const { ctx, pg, errs } = await preparer(b, { width: 390, height: 844 }, false, { rows: ROWS });
      await ouvrirAchats(pg, errs);
      const x = await pg.evaluate(() => {
        const btns = [...document.querySelectorAll('[data-achats-onglet]')];
        // Une ligne = le libellé et le nombre côte à côte (même milieu vertical), rien de
        // coupé (le bouton ne déborde pas). `innerText` ne sert pas : le nombre est un
        // élément flex, qu'il compte comme un bloc.
        const ligne = (el) => { const tn = [...el.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim()); const sp = el.querySelector('.vrm-seg-n'); if (!tn || !sp) return 0; const r = document.createRange(); r.selectNodeContents(tn); const a = r.getBoundingClientRect(), b = sp.getBoundingClientRect(); const meme = Math.abs((a.top + a.bottom) / 2 - (b.top + b.bottom) / 2) < 6 && b.left >= a.right - 1; return meme && el.scrollWidth <= el.clientWidth + 1 ? 1 : 2; };
        const recus = document.querySelector('[data-achats-onglet="recus"]');
        return { n: recus && recus.getAttribute('data-n'), t: recus && recus.textContent, lignes: recus ? ligne(recus) : 0, h: btns.map((x) => Math.round(x.getBoundingClientRect().height)), deborde: document.documentElement.scrollWidth > window.innerWidth + 1 };
      });
      dit(x.n === '1779' && x.lignes === 1 && new Set(x.h).size === 1 && /1,7\s?k/.test(x.t || ''), 'F n° 8 : « Reçus 1,7 k » sur UNE ligne, les onglets à la même hauteur (le nombre exact dans l\'infobulle)', `data-n=${x.n} « ${x.t} » lignes=${x.lignes} hauteurs=${x.h.join(',')}`);
      dit(!x.deborde && !errs.length, 'F n° 8 : rien ne déborde, aucune erreur', errs[0]);
      await ctx.close();
    });
  } finally { await b.close(); }
}

(async () => {
  srv.listen(PORT);
  try { await navigateur(); } finally { srv.close(); }
  console.log(ko ? `\n❌ statut des transporteurs à l'écran : ${ko} rouge(s).` : '\n✅ statut des transporteurs à l\'écran : tout est vert');
  process.exit(ko ? 1 : 0);
})();
