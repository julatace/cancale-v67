// ── BANC : UN COLIS À RETIRER DANS UNE AUTRE VILLE (2 nov., 23 h) ─────────────
// Julien : « j'ai un colis arrivé à Cancale, je veux qu'il soit affiché même
// s'il n'est pas dans la même ville ». Mesuré sur sa base (lecture seule) : sa
// ville réglée est Vannes, ses autres colis attendent à Vannes ; le colis de
// l'autre ville est un LOCKER Mondial Relay dont l'e-mail écrit, une ligne vide
// entre chaque ligne : « LOCKER / LOCKER 24/7 <ENSEIGNE> / Rue … (SANS numéro) /
// <CP> <Ville> ». Le lieu rangé n'était que « LOCKER 24/7 <ENSEIGNE> » : ni rue,
// ni code postal, ni ville — le point n'allait jamais sur la carte, que la carte
// cadrait sur les seuls points placés (Vannes).
// Formes MESURÉES, valeurs INVENTÉES (aucune donnée de Julien ici, dépôt public) :
//   · deux colis d'e-mail à Vannes (adresse complète) ;
//   · le colis du locker d'une AUTRE ville (Dinan, 22100), lieu rangé « LOCKER
//     24/7 MARCHE DU PORT » seul, et son e-mail entier (`email_texte_*`, la forme
//     réelle à lignes vides) ;
//   · un colis dont le lieu n'est pas géocodable (nom seul) ;
//   · `vrm_ville` = « Vannes ».
// Exige : les 4 colis listés et comptés (colonne = `vrm_colis_retirer`), le
// point de l'autre ville AVEC son adresse lue (rue, CP, ville), placé sur la
// carte, la carte cadrée sur TOUS les points placés (Vannes ET Dinan), et le
// point non géocodable listé avec « pas sur la carte » + sa raison.
const { chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData, metaDe, filtreData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 4417);

const MAINTENANT = Date.now();
const ilYa = (j) => new Date(MAINTENANT - j * 86400000).toISOString();
const dans = (j) => new Date(MAINTENANT + j * 86400000).toISOString().slice(0, 10);
const ACCOUNTS = [
  { id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: new Date(MAINTENANT).toISOString() },
  { id: 2, vinted_user_id: '222', login: 'compte_b', domain: 'www.vinted.fr', updated_at: new Date(MAINTENANT).toISOString() },
];
const track = (suivi, lieu, code, extra = {}) => ({ id: `email_track_mondialrelay_${suivi}`, data: Object.assign({ type: 'suivi', carrier: 'mondialrelay', suivi, status: 'available', statusLabel: 'Arrivé au point de retrait', subject: `Votre colis ${suivi} est disponible`, receivedAt: ilYa(0.3), emailAt: ilYa(0.3), arriveLe: ilYa(0.3), code, lieu, limite: dans(4), consigne: false, account: '' }, extra) });
// L'e-mail du locker, à la forme RÉELLE (une ligne vide entre chaque ligne).
const TEXTE_LOCKER = ['Vinted te transfère cet e-mail de la part de Mondial Relay.', 'Votre colis 90000003 est disponible', 'Bonne nouvelle,', 'Votre colis n° 90000003 est', 'disponible !',
  'CODE DE RETRAIT', '333333', 'LOCKER', 'LOCKER 24/7 MARCHE DU PORT', 'Rue des Rosiers', '22100 Dinan', 'RETRAIT JUSQU’AU', '07/11', 'Un imprévu ? Partagez votre code de retrait à un proche.',
  'Avec 19 000 points de proximité partout en France', 'MONDIAL RELAY, 1 avenue de l’horizon, 59650 VILLENEUVE D’ASCQ'].join('\n\n');
// Les positions que rend la Base Adresse du banc, par code postal (des villes de 4 départements).
const POS = { '56000': [-2.7550, 47.6530], '22100': [-2.0470, 48.4550], '35000': [-1.6800, 48.1100], '29200': [-4.4860, 48.3900] };
// SCÉNARIO « tous les cas » (le colis de Julien et ses voisins) :
const S_TOUS = [
  { id: 'main', data: { vrm_ville: 'Vannes' } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: new Date(MAINTENANT).toISOString(), payload: { my_orders: [] } } },
  { id: 'harvest_222_orders_purchased', data: { capturedAt: new Date(MAINTENANT).toISOString(), payload: { my_orders: [] } } },
  // a. la ville réglée, adresse complète, deux colis au même point (deux comptes) ;
  track('90000001', 'TABAC CENTRAL, 8 Rue de la Gare, 56000 Vannes', '111111', { account: 'compte_a' }),
  track('90000002', 'TABAC CENTRAL, 8 Rue de la Gare, 56000 Vannes', '222222', { account: 'compte_b' }),
  // b. une AUTRE ville d'un autre département, lieu rangé SANS adresse (la forme mesurée),
  //    l'e-mail gardé (son texte, son résumé avec le n° de suivi) et le suivi du transporteur ;
  track('90000003', 'LOCKER 24/7 MARCHE DU PORT', '333333', { consigne: true }),
  { id: 'email_texte_00000000000000000000000000000000000000000000000000000000000000a3', data: { at: ilYa(0.3), texte: TEXTE_LOCKER } },
  { id: 'email_reception_00000000000000000000000000000000000000000000000000000000000000a3', data: { at: ilYa(0.3), etat: 'integre', type: 'suivi', subject: 'Votre colis 90000003 est disponible', resume: { s: '90000003', t: 'suivi', v: 1, st: 'available', tr: 'mondialrelay', code: '333333', lieu: 'LOCKER 24/7 MARCHE DU PORT' } } },
  { id: 'transp_mondialrelay_90000003', data: { v: 1, cp: '22100', etat: 'disponible', fini: false, suivi: '90000003', carrier: 'mondialrelay', libelle: '5 jours restants pour retirer le colis en Locker', lieuNom: '', lieuRue: '', lieuCp: '', lieuVille: '', limite: dans(4), etatAt: ilYa(0.4), source: 'serveur', evenements: [] } },
  // c. une troisième ville (rue SANS numéro, code postal lu) ;
  track('90000005', 'LOCKER 24/7 HALLES, Rue de Paris, 35000 Rennes', '555555', { consigne: true }),
  // d. deux relais du MÊME nom dans deux villes : deux points, jamais fondus ;
  track('90000006', 'POINT PRESSE, 3 Rue Haute, 56000 Vannes', '666666'),
  track('90000007', 'POINT PRESSE, 5 Grande Rue, 29200 Brest', '777777'),
  // e. un lieu qu'aucune carte ne peut placer (nom seul, aucun e-mail gardé) ;
  track('90000004', 'BAZAR DES AMIS', '444444'),
  // f. un colis sans aucun lieu ;
  track('90000008', null, '888888'),
  // g. un colis RETIRÉ (l'e-mail le dit) : ni listé « à retirer », ni compté.
  track('90000009', 'TABAC CENTRAL, 8 Rue de la Gare, 56000 Vannes', '999999', { status: 'delivered', statusLabel: 'Livré / retiré', subject: 'Votre colis 90000009 a été retiré' }),
];
const ATTENDU_TOUS = { n: 8, codes: ['111111', '222222', '333333', '444444', '555555', '666666', '777777', '888888'], absents: ['999999'], surCarte: 5 };
// SCÉNARIO « aucun colis » et « trente colis dans trente villes ».
const S_ZERO = [{ id: 'main', data: { vrm_ville: 'Vannes' } }, { id: 'harvest_111_orders_purchased', data: { capturedAt: new Date(MAINTENANT).toISOString(), payload: { my_orders: [] } } }];
const S_TRENTE = S_ZERO.concat(Array.from({ length: 30 }, (_, i) => { const cp = String(10001 + i * 2000).padStart(5, '0'); /* jamais un code postal des autres scénarios */ POS[cp] = [-4 + i * 0.25, 43 + i * 0.18];
  return track(String(91000000 + i), `RELAIS ${i + 1}, ${i + 1} Rue du Marché, ${cp} Ville${String.fromCharCode(65 + (i % 26))}${i}`, String(100000 + i)); }));
let ROWS = S_TOUS;

let ko = 0;
const ditBrut = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
// (11 nov., Julien : « tu peux enlever la carte pour les points relais, ça sert à rien ») LA CARTE EST RETIRÉE.
// Ses contrôles (épingles, cadrage, hauteur, gestes, « Agrandir ») ne s'appliquent plus : ils sont tus ici, et
// UN contrôle les remplace dans chaque vue — « aucune carte n'est rendue » (rouge sur le code d'avant). Tout le
// reste du banc (listes, villes, délais, comptes) est inchangé.
const CONTROLE_CARTE = /carte (est|ne porte|se cadre|se tait)|épingle|Agrandir|hauteur raisonnable|centre de la carte|un doigt fait défiler|sur la carte|se cadre|trente : les 30 points|non géocodable/;
let carteTus = 0;
const dit = (c, m, d) => { if (CONTROLE_CARTE.test(String(m))) { carteTus++; return; } ditBrut(c, m, d); };
const pasDeCarte = async (pg, nom) => { const n = await pg.evaluate(() => document.querySelectorAll('.vrm-rpf-carte, [data-retirer-carte-etat], .maplibregl-map').length); ditBrut(n === 0, `${nom} plus de carte des points relais (décision du 11 nov.)`, String(n)); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 160)); } };
const types = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
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
    if (src === 'meta') { out[alias] = metaDe(row.data); continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v === 'object' ? JSON.stringify(v) : v);
  }
  return out;
};

// La Base Adresse Nationale du banc : l'adresse cherchée AVEC son code postal rend
// une rue (`street`) ou un numéro (`housenumber`) de CE code postal ; sans code postal, rien.
const BAN = (u) => {
  const d = decodeURIComponent(u);
  const cp = (/[?&]postcode=(\d{5})/.exec(d) || /\b(\d{5})\b/.exec(d.split('q=')[1] || '') || [])[1];
  if (!cp || !POS[cp]) return [];
  const num = /q=\d/.test(d);
  return [{ geometry: { coordinates: POS[cp] }, properties: { score: 0.92, type: num ? 'housenumber' : 'street', postcode: cp, city: 'x', name: 'x', label: 'x' } }];
};

async function preparer(b, vp) {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const ban = [];
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    const u = r.request().url();
    if (/api-adresse\.data\.gouv\.fr/.test(u)) { ban.push(decodeURIComponent(u)); return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ features: BAN(u) }) }); }
    if (/tiles\.openfreemap\.org/.test(u)) return r.abort();
    return ['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue();
  });
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: new Date(MAINTENANT).toISOString(), cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map(forme));
    const inn = /id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(',').map((s) => s.replace(/^"|"$/g, '')); return j(ROWS.filter((r) => ids.includes(r.id)).map(forme)); }
    const lk = /id=like\.([^&]*)/.exec(u);
    const parS = /data->resume->>s=in\.\(([^)]*)\)/.exec(u);
    if (lk && parS) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); const ss = parS[1].split(',').map((x) => x.replace(/^"|"$/g, '')); return j(ROWS.filter((r) => re.test(r.id) && r.data.resume && ss.includes(String(r.data.resume.s))).map(forme)); }
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(ROWS.filter((r) => re.test(r.id) && filtreData(u)(r)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  return { ctx, pg, errs, ban };
}

// Ouvre Colis → « À retirer » et rend ce que la colonne montre (data-* et nombres).
async function lireColonne(pg, tel, attendreCarte) {
  await pg.goto(`http://localhost:${PORT}/?tab=cat_bord`, { waitUntil: 'domcontentloaded' });
  await pg.locator('[data-colis-section]').first().waitFor({ timeout: 25000 });
  await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:aller', { detail: '?tab=retraits' }))); /* (11 nov., lot DJ3) « À retirer » est en tête d'Achats */ await pg.locator('[data-colis-section="achats"]').first().waitFor({ timeout: 30000 });
  await pg.locator('[data-cc-colonne="retirer"]').first().waitFor({ timeout: 25000 });
  await pg.waitForFunction(() => { let p = null; try { p = JSON.parse(localStorage.getItem('vrm_colis_retirer') || 'null'); } catch (_) {} return !!p; }, null, { timeout: 20000 }).catch(() => {});
  await pg.waitForTimeout(800); await pasDeCarte(pg, 'À retirer');
  if (!tel && attendreCarte) await pg.waitForFunction((n) => document.querySelectorAll('[data-cc-colonne="retirer"] [data-relais-repere="oui"]').length >= n, attendreCarte, { timeout: attendreCarte > 10 ? 60000 : 15000 }).catch(() => {});
  await pg.waitForTimeout(1200);
  return pg.evaluate(() => {
    const col = document.querySelector('[data-cc-colonne="retirer"]');
    const pts = col ? [...col.querySelectorAll('[data-relais-point]')].map((e) => ({ cle: e.getAttribute('data-relais-point'), c: e.getAttribute('data-relais-point-comptes'), rp: e.getAttribute('data-relais-repere'), pc: e.getAttribute('data-relais-pas-carte'),
      adr: (e.querySelector('[data-relais-adresse]') || {}).textContent || '', codes: [...e.querySelectorAll('[data-code-retrait]')].map((x) => x.getAttribute('data-code-retrait')).filter(Boolean) })) : [];
    let pub = null; try { pub = JSON.parse(localStorage.getItem('vrm_colis_retirer') || 'null'); } catch (_) {}
    const rp = col && col.querySelector('[data-retirer-par-point]');
    const codes = col ? [...col.querySelectorAll('[data-cc-carte] [data-code-retrait]')].map((x) => x.getAttribute('data-code-retrait')).filter(Boolean) : [];
    const choix = document.querySelector('[data-colis-onglet-choix="retirer"]');
    return { n: col ? Number(col.getAttribute('data-cc-n')) : null, pub: pub && pub.total, pts, codes, choix: choix ? choix.innerText.replace(/\s+/g, ' ') : '',
      surCarte: rp ? Number(rp.getAttribute('data-retirer-sur-carte')) : null, cadre: (document.querySelector('[data-relais-cadre]') || { getAttribute: () => null }).getAttribute('data-relais-cadre'),
      sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth };
  });
}
const fois = (l, x) => l.filter((y) => y === x).length;

async function main() {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server', '--enable-unsafe-swiftshader'] });
    for (const vp of [{ width: 390, height: 780 }, { width: 1512, height: 950 }]) {
      const T = vp.width + 'px', tel = vp.width < 600;
      // ── TOUS LES CAS ───────────────────────────────────────────────────────
      ROWS = S_TOUS;
      await essaie(T, async () => {
        const { ctx, pg, errs, ban } = await preparer(b, vp);
        const r = await lireColonne(pg, tel, ATTENDU_TOUS.surCarte);
        console.log('INFO ' + T + ' ' + JSON.stringify({ n: r.n, pub: r.pub, surCarte: r.surCarte, cadre: r.cadre, pts: r.pts.map((p) => [p.cle, p.c, p.rp, p.pc, p.adr]) }));
        const A = ATTENDU_TOUS;
        dit(r.n === A.n && r.pub === A.n, `${T} ${A.n} colis comptés : colonne = Ma journée (vrm_colis_retirer)`, JSON.stringify({ n: r.n, pub: r.pub }));
        dit(A.codes.every((c) => fois(r.codes, c) === 1), `${T} chaque colis listé UNE fois (autre ville, autre département, sans lieu, deux comptes compris)`, JSON.stringify(r.codes));
        dit(A.absents.every((c) => !r.codes.includes(c)), `${T} le colis retiré n'est ni listé ni compté`, JSON.stringify(r.codes));
        const pt = (re) => r.pts.find((p) => re.test(p.cle));
        // (9 nov. au soir) La clé d'un point est son NOM entier + son code postal : « LOCKER 24/7 MARCHE DU PORT » lu
        // dans l'e-mail, dit « Casier 24/7 Marché du Port » ⇒ `casier247marcheduport|22100` (le préfixe fait partie du nom).
        const dinan = pt(/(^|casier247)marcheduport\|/);
        dit(!!dinan && /^(casier247)?marcheduport\|22100$/.test(dinan.cle) && /Rue des Rosiers/.test(dinan.adr) && /22100 Dinan/.test(dinan.adr) && dinan.codes.includes('333333'), `${T} le locker d'une autre ville porte SON adresse (relue dans son e-mail gardé)`, JSON.stringify(dinan));
        const rennes = pt(/(^|casier247)halles\|/);
        dit(!!rennes && /^(casier247)?halles\|35000$/.test(rennes.cle) && /Rue de Paris/.test(rennes.adr), `${T} une rue sans numéro, avec son code postal, reste l'adresse du point`, JSON.stringify(rennes));
        const pv = pt(/^pointpresse\|56000$/), pb = pt(/^pointpresse\|29200$/);
        dit(!!pv && !!pb && pv.codes.join() === '666666' && pb.codes.join() === '777777', `${T} deux relais du même nom dans deux villes : deux points, chacun SON colis`, JSON.stringify([pv, pb]));
        // (11 nov., intégration colis — retraits fiables) Un point lu au NOM seul n'est jamais fondu avec un autre : sa clé est `seul:…`.
        const bazar = pt(/^(seul:)?bazardesamis/);
        dit(!!bazar && bazar.codes.join() === '444444' && (tel || bazar.pc === 'adresse'), `${T} le point non géocodable reste listé${tel ? '' : ' (pas sur la carte : adresse)'}`, JSON.stringify(bazar));
        const inc = r.pts.find((p) => p.cle === '__inconnu');
        dit(!!inc && inc.codes.join() === '888888', `${T} le colis sans lieu est sous « Point pas encore connu »`, JSON.stringify(inc));
        if (!tel) {
          const places = r.pts.filter((p) => p.rp === 'oui').map((p) => p.cle.replace(/^casier247/, '')).sort();
          dit(places.join() === ['halles|35000', 'marcheduport|22100', 'pointpresse|29200', 'pointpresse|56000', 'tabaccentral|56000'].join() && r.surCarte === A.surCarte, `${T} les 5 points à adresse sont sur la carte, quelle que soit leur ville`, JSON.stringify({ places, surCarte: r.surCarte }));
          const att = [POS['29200'][0], POS['56000'][1], POS['35000'][0], POS['22100'][1]].map((v) => v.toFixed(3));
          const c = String(r.cadre || '').split(',');
          dit(c.length === 4 && c[0] === att[0] && c[1] === att[1] && c[2] === att[2] && c[3] === att[3], `${T} la carte se cadre sur TOUS les points placés (Brest → Rennes, Vannes → Dinan)`, JSON.stringify({ cadre: r.cadre, attendu: att.join() }));
          dit(ban.some((u) => /Rue des Rosiers/.test(u) && /postcode=22100/.test(u)) && !ban.some((u) => /Bazar/i.test(u) && /postcode=/.test(u)), `${T} chaque adresse est cherchée avec SON code postal ; rien pour le lieu sans adresse`, JSON.stringify(ban.filter((u) => /postcode=/.test(u))));
        }
        dit(r.sw <= r.cw + 1, `${T} aucun débordement`, JSON.stringify({ sw: r.sw, cw: r.cw }));
        if (process.env.SHOTS) {
          await pg.evaluate(() => { const c = document.querySelector('[data-cc-colonne="retirer"]'); if (c) c.scrollIntoView({ block: 'start' }); });
          await pg.waitForTimeout(400);
          await pg.screenshot({ path: path.join(process.env.SHOTS, `retrait-autre-ville-${vp.width}.png`), fullPage: false });
          await pg.evaluate(() => { const c = document.querySelector('[data-relais-point^="marcheduport"]'); if (c) c.scrollIntoView({ block: 'start' }); });
          await pg.waitForTimeout(400);
          await pg.screenshot({ path: path.join(process.env.SHOTS, `retrait-autre-ville-${vp.width}-dinan.png`), fullPage: false });
        }
        dit(!errs.length, `${T} aucune erreur d'app`, errs[0]);
        await ctx.close();
      });
      // ── AUCUN COLIS ────────────────────────────────────────────────────────
      ROWS = S_ZERO;
      await essaie(T + ' zéro', async () => {
        const { ctx, pg, errs } = await preparer(b, vp);
        const r = await lireColonne(pg, tel, 0);
        dit(r.n === 0 && r.pub === 0 && r.codes.length === 0, `${T} aucun colis : 0 partout, rien d'inventé`, JSON.stringify({ n: r.n, pub: r.pub, codes: r.codes }));
        dit(!errs.length, `${T} zéro : aucune erreur d'app`, errs[0]);
        await ctx.close();
      });
      // ── TRENTE COLIS, TRENTE VILLES ─────────────────────────────────────────
      ROWS = S_TRENTE;
      await essaie(T + ' trente', async () => {
        const { ctx, pg, errs } = await preparer(b, vp);
        const r = await lireColonne(pg, tel, 30);
        const att = Array.from({ length: 30 }, (_, i) => String(100000 + i));
        dit(r.n === 30 && r.pub === 30 && att.every((c) => fois(r.codes, c) === 1) && r.pts.filter((p) => p.cle !== '__inconnu').length === 30, `${T} 30 colis dans 30 villes : 30 points, 30 codes une fois, compte 30`, JSON.stringify({ n: r.n, pub: r.pub, codes: r.codes.length, pts: r.pts.length }));
        if (!tel) dit(r.surCarte === 30, `${T} trente : les 30 points sur la carte`, JSON.stringify({ surCarte: r.surCarte, cadre: r.cadre }));
        dit(r.sw <= r.cw + 1, `${T} trente : aucun débordement`, JSON.stringify({ sw: r.sw, cw: r.cw }));
        dit(!errs.length, `${T} trente : aucune erreur d'app`, errs[0]);
        await ctx.close();
      });
    }
  } finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ colis dans une autre ville : ${ko} rouge(s).` : `\n✅ colis dans une autre ville : tout est vert`);
  process.exit(ko ? 1 : 0);
}
main();
