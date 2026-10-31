// ── BANC : LA DATE D'ARRIVÉE DE CHAQUE COLIS À RETIRER (21 oct.)
// Julien : « Améliore les colis, je veux que l'on voie la date à laquelle il est arrivé. »
// Formes MESURÉES sur sa base (lecture seule), valeurs INVENTÉES :
//   · email d'arrivée (« Votre colis … est disponible 📦 ») ⇒ sa date EST l'arrivée ;
//   · email de RAPPEL (« Le temps file : votre colis vous attend… ») qui a réécrit
//     la ligne ⇒ sa date n'est PAS l'arrivée : « au plus tard » ; avec `arriveLe`
//     (gardé par le serveur depuis le 21 oct.) ⇒ la vraie date ;
//   · colis vu par Vinted (conversation lue par l'extension : `at` = heure de LECTURE)
//     ⇒ « au plus tard », jamais présenté comme la date d'arrivée ;
//   · colis vu par Vinted sans conversation lue ⇒ « Date d'arrivée inconnue » ;
//   · colis jamais retiré (25 j) ⇒ sa date, sur sa ligne.
// Exige, à 390 px tactile et 1512 px : chaque carte porte `data-arrive-le` et la
// ligne est VISIBLE (pas dans un repli fermé), le jour juste, le bon mot.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 8137);

const MAINTENANT = Date.now();
const ilYa = (j) => new Date(MAINTENANT - j * 86400000).toISOString();
const dans = (j) => new Date(MAINTENANT + j * 86400000).toISOString().slice(0, 10);
const jourLocal = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const RELAIS_ST = "La livraison n'a pas encore eu lieu - colis déposé en bureau de Poste ou point relais";
const ACHATS = [
  { transaction_id: 9501, conversation_id: 7201, title: 'Nike Cortez blanche taille 41', price: { amount: '40', currency_code: 'EUR' }, status: RELAIS_ST, transaction_user_status: 'needs_action', date: ilYa(9) },
  { transaction_id: 9502, conversation_id: 7202, title: 'Asics Gel noire taille 43', price: { amount: '55', currency_code: 'EUR' }, status: RELAIS_ST, transaction_user_status: 'needs_action', date: ilYa(9) },
];
const VU_RELAIS = ilYa(2);
const RELAIS = { '9501': { code: 'C44444', lieu: 'Tabac du Port, 4 Quai Gambetta, 35260 Cancale', at: VU_RELAIS, url: 'https://www.vinted.fr/inbox/7201' } };
const track = (id, o) => ({ id, data: { type: 'suivi', status: 'available', statusLabel: 'Arrivé au point de retrait', limite: dans(4), consigne: false, ...o } });
const A_ARRIVE = ilYa(3), B_ARRIVE = ilYa(5), RAPPEL = ilYa(1), VIEUX = ilYa(25);
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_banc', domain: 'www.vinted.fr', updated_at: new Date(MAINTENANT).toISOString() }];
const ROWS = [
  { id: 'main', data: {} },
  { id: 'panel_colis_relais', data: RELAIS },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: new Date(MAINTENANT).toISOString(), payload: { my_orders: ACHATS } } },
  track('email_track_mondialrelay_11110001', { carrier: 'mondialrelay', suivi: '11110001', artTitle: 'Colis Alpha', subject: 'Votre colis 11110001 est disponible 📦', receivedAt: A_ARRIVE, code: '111111', lieu: 'Relais Alpha, 1 rue A' }),
  track('email_track_mondialrelay_11110002', { carrier: 'mondialrelay', suivi: '11110002', artTitle: 'Colis Bravo', subject: 'Le temps file : votre colis vous attend avec impatience ⏳', receivedAt: RAPPEL, arriveLe: B_ARRIVE, code: '222222', lieu: 'Relais Bravo, 2 rue B' }),
  track('email_track_mondialrelay_11110003', { carrier: 'mondialrelay', suivi: '11110003', artTitle: 'Colis Charlie', subject: 'Le temps file : votre colis vous attend avec impatience ⏳', receivedAt: RAPPEL, code: '333333', lieu: 'Relais Charlie, 3 rue C' }),
  track('email_track_mondialrelay_11110004', { carrier: 'mondialrelay', suivi: '11110004', subject: 'Votre colis 11110004 est disponible 📦', receivedAt: VIEUX, limite: null, code: '444444', lieu: 'Relais Delta, 4 rue D' }),
];

// (29 oct.) Un achat « au point relais » sans code ni n° de suivi, à côté de
// colis d'e-mail qu'aucune commande ne réclame, n'est montré « à retirer » que
// si son n° a été CHERCHÉ (une ligne de suivi Vinted relevée, même sans n°) —
// sinon il est « en cours de vérification » (peut-être le même colis). Ici la
// ligne est relevée sans n° : sa carte reste, et c'est sa date qu'on juge.
if (!process.env.BANC_RETRAITS) ROWS.push({ id: 'harvest_111_suivi_9502', data: { v: 1, tx: '9502', source: 'journey', capturedAt: new Date(MAINTENANT).toISOString(), transporteur: 'mondialrelay', suivi: null, etapes: [], dernier: null, forme: {} } });
const SESSION={access_token:'session-colis-fictive',refresh_token:'r',totp:[],expires_at:Date.now()+3600000,user:{id:'11111111-1111-4111-8111-111111111111',email:'colis@example.test',totp:[]}};
if(process.env.BANC_RETRAITS){
 ACHATS.forEach((a,i)=>{a.title='Article identique';a.photo='data:image/svg+xml,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" fill="${i?'blue':'red'}"/></svg>`);});
 // (23 oct., soir) La photo dans la transaction ; le n° de suivi dans la LIGNE DE
// SUIVI Vinted (`harvest_{uid}_suivi_{tx}`) — la transaction n'en porte jamais.
ACHATS.forEach((a,i)=>{ROWS.push({id:`harvest_111_txn_${a.transaction_id}`,data:{payload:{transaction:{id:a.transaction_id,item_photo:{url:a.photo}}}}});ROWS.push({id:`harvest_111_suivi_${a.transaction_id}`,data:{v:1,tx:String(a.transaction_id),source:'journey',capturedAt:new Date().toISOString(),transporteur:'mondialrelay',suivi:i?'11110002':'11110001',etapes:[],dernier:null,forme:{}}});});
}
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 140)); } };

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

async function preparer(b, vp, opts = {}) {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}), permissions: opts.clavierRefuse ? [] : ['clipboard-read', 'clipboard-write'] });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(s=>{localStorage.setItem('vrm_session',JSON.stringify(s));localStorage.setItem('vrm_local_owner',s.user.id);localStorage.setItem('schema_cloisonne','1');},SESSION);
  await pg.route('**/auth/v1/**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({access_token:SESSION.access_token,refresh_token:'r',expires_in:3600,user:SESSION.user})}));
  if (opts.clavierRefuse) await pg.addInitScript(() => { try { Object.defineProperty(navigator, 'clipboard', { configurable: true, get: () => ({ writeText: () => Promise.reject(new DOMException('refusé', 'NotAllowedError')) }) }); } catch (_) {} });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return j([]);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: new Date(MAINTENANT).toISOString(), cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map(forme));
    const ins=/id=in\.\(([^)]*)\)/.exec(u);if(ins){const ids=ins[1].split(',');return j(ROWS.filter(r=>ids.includes(r.id)).map(forme));}
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(ROWS.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('mode=confidentialite')?{ok:true,uid:SESSION.user.id}:{ok:true,pret:true,obligatoire:false,acces:true}) }));
  return { ctx, pg, errs };
}


async function main() {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 780 }, { width: 1512, height: 950 }]) {
      const T = vp.width + 'px';
      await essaie(T, async () => {
        const { ctx, pg, errs } = await preparer(b, vp);
        await pg.goto(`http://localhost:${PORT}/?tab=cat_achats`, { waitUntil: 'domcontentloaded' });
        await pg.locator('.vrm-pickup-point').first().waitFor({ timeout: 15000 }).catch(async e=>{console.log('ÉCRAN DE BANC : '+(await pg.locator('body').innerText()).slice(0,1500));console.log('ERREURS : '+errs.join(' | '));throw e;});
        await pg.waitForTimeout(1500);
        // Ce que montre CHAQUE carte : l'attribut et la ligne VISIBLE (pas un repli fermé).
        if(process.env.BANC_RETRAITS){
          const alpha=pg.locator('.vrm-pickup-card').filter({hasText:'Colis Alpha'}),bravo=pg.locator('.vrm-pickup-card').filter({hasText:'Colis Bravo'});
          await alpha.scrollIntoViewIfNeeded();dit(await alpha.locator('img').getAttribute('src')===ACHATS[0].photo,`${T} photo du premier achat reliée par suivi, depuis la transaction captée`);
          await bravo.scrollIntoViewIfNeeded();dit(await bravo.locator('img').getAttribute('src')===ACHATS[1].photo,`${T} même titre, deuxième suivi : deuxième photo`);
          ROWS.push(track('email_track_vinted_11110001',{carrier:'vinted',suivi:'11110001',status:'delivered',subject:'Votre colis a été retiré par l’acheteur',receivedAt:new Date().toISOString()}));
          await pg.goto(`http://localhost:${PORT}/?tab=cat_achats`,{waitUntil:'domcontentloaded'});await pg.locator('.vrm-pickup-point').first().waitFor({timeout:15000}).catch(async e=>{console.log('RECHARGEMENT : '+(await pg.locator('body').innerText()).slice(0,1600));throw e;});await pg.waitForTimeout(1700);
          const actifs=await pg.locator('.vrm-pickup-card').allTextContents();dit(!actifs.some(t=>t.includes('Colis Alpha')),`${T} le retrait confirmé enlève l’autre email disponible du même suivi`);
          dit(actifs.filter(t=>t.includes('Article identique')).length===1,`${T} l’ancien statut Vinted ne recrée pas le colis déjà retiré`);
          dit(actifs.some(t=>t.includes('Colis Bravo')),`${T} le second suivi reste à retirer`);dit(!errs.length,`${T} aucune erreur d’app`,errs[0]);
          ROWS.splice(ROWS.findIndex(r=>r.id==='email_track_vinted_11110001'),1);await ctx.close();return;
        }
        const cartes = await pg.evaluate(() => [...document.querySelectorAll('.vrm-pickup-card, [data-oublie]')].map((c) => {
          const e = c.matches('[data-arrive-le]') ? c : c.querySelector('[data-arrive-le]');
          const ligne = c.querySelector('.vrm-arrive') || (c.matches('[data-oublie]') ? c.querySelector('[data-oublie-info]') : null);
          const r = ligne ? ligne.getBoundingClientRect() : null;
          return { t: c.innerText, le: e ? e.getAttribute('data-arrive-le') : null, sur: e ? e.getAttribute('data-arrive-sur') : null,
                   vue: !!(r && r.height > 0 && r.width > 0), ligne: ligne ? ligne.innerText : '' };
        }));
        const de = (re) => cartes.find((c) => re.test(c.t));
        const a = de(/Colis Alpha/), bb = de(/Colis Bravo/), c = de(/Colis Charlie/), v1 = de(/Nike Cortez/), v2 = de(/Asics Gel/), o = de(/11110004/);
        dit(cartes.length >= 6 && cartes.every((x) => x.le), `${T} chaque colis à retirer porte data-arrive-le`, `${cartes.filter((x) => !x.le).length} sans sur ${cartes.length}`);
        dit(cartes.every((x) => x.vue), `${T} … et la date se LIT sur la carte (pas dans un repli fermé)`);
        dit(a && a.le === jourLocal(A_ARRIVE) && a.sur === 'oui' && /^Arrivé le .+ · il y a 3 j/.test(a.ligne), `${T} email d'arrivée : « Arrivé le … · il y a 3 j »`, a && (a.le + ' ' + a.ligne));
        dit(bb && bb.le === jourLocal(B_ARRIVE) && bb.sur === 'oui' && /il y a 5 j/.test(bb.ligne), `${T} rappel après l'arrivée gardée : la date d'ARRIVÉE (5 j), pas celle du rappel`, bb && (bb.le + ' ' + bb.ligne));
        dit(c && c.sur === 'borne' && /au plus tard/i.test(c.ligne), `${T} rappel sans date d'arrivée connue : « au plus tard », jamais présentée comme l'arrivée`, c && c.ligne);
        dit(v1 && v1.le === jourLocal(VU_RELAIS) && v1.sur === 'borne' && /au plus tard/i.test(v1.ligne), `${T} colis vu dans la conversation : l'heure de lecture n'est qu'une borne`, v1 && v1.ligne);
        dit(v2 && v2.le === 'inconnue' && /inconnue/i.test(v2.ligne), `${T} colis vu par Vinted sans conversation lue : « Date d'arrivée inconnue »`, v2 && (v2.le + ' ' + v2.ligne));
        dit(o && o.le === jourLocal(VIEUX) && /il y a 25 j/.test(o.ligne), `${T} colis jamais retiré : sa date d'arrivée sur sa ligne`, o && (o.le + ' ' + o.ligne));
        if (process.env.SHOTS) await pg.screenshot({ path: path.join(process.env.SHOTS, `colis-arrivee-${vp.width}.png`), fullPage: true });
        dit(!errs.length, `${T} aucune erreur d'app`, errs[0]);
        await ctx.close();
      });
    }
  } finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ date d'arrivée des colis : ${ko} rouge(s).` : `\n✅ date d'arrivée des colis : tout est vert`);
  process.exit(ko ? 1 : 0);
}
main();
