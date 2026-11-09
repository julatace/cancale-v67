// ── BANC : MA JOURNÉE TOUT DE SUITE + OBJECTIF DU MOIS (9 nov. 2026) ─────────
//        npm run build && node scripts/bancs/journee-instantanee.cjs [dist]
//        SHOTS=dossier  BANC_PORT=4483  JI_SEUL=390-light (une seule passe)  JI_DUMP=1 (positions de la tête)
// Données INVENTÉES (le dépôt est public), à la forme des lignes réelles (celles de
// journee-v2 : un compte Vinted, trois ventes à expédier, 80 € et 45 € hier, 60 € il y a
// 3 jours), et l'objectif du mois posé dans `main` (synchronisé) : 2 000 € de vendu.
// Jugé sur les `data-*` et les nombres rendus, jamais sur un libellé seul.
//  A  1re ouverture (aucun instantané) : l'écran vrai ; l'instantané est rangé pour CE uid
//     quand tout est lu, sans adresse ni photo ni acheteur.
//  I  2e ouverture, TOUTES les lectures de la base TENUES (rien ne revient) : les chiffres
//     de la dernière visite sont là (temps mesuré), « Mis à jour il y a 7 min », les mêmes
//     valeurs que l'écran vrai (case Vendu · mois), inertes ; « Vérification… » sur le geste
//     de la prochaine chose et un clic dessus ne fait rien (on reste sur Ma journée).
//     Puis les lectures sont RENDUES : l'écran vrai prend la place, CLS mesuré.
//  U  Un instantané d'un AUTRE uid (même sous la clé de ce compte) : jamais rendu.
//  V  Un autre vendeur se connecte sur le navigateur : l'instantané est effacé.
//  S  Sans instantané : le comportement d'avant (squelette, aucun chiffre).
//  O  L'objectif : barre = case « Vendu · mois » (même valeur), « sur 2 000 € », ce qui reste et
//     le rythme jusqu'à la fin du mois (faits à la main ici) ; toucher la barre ouvre son
//     réglage ; atteint ⇒ « Objectif atteint » ; aucun objectif ⇒ aucune barre.
require('./_porte-banc.cjs');
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), os = require('os');
const DIST = process.argv[2] || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 4483);
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-journee-instantanee');
const SEUL = process.env.JI_SEUL || '';
try { fs.mkdirSync(SHOTS, { recursive: true }); } catch (_) {}

const UID = '0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b';   // la session de banc (_porte-banc.cjs)
const midi = new Date(); midi.setHours(12, 0, 0, 0);
const MAINTENANT = Date.now();
const ilYa = (j) => new Date(midi.getTime() - j * 86400000).toISOString();
const AEXP = 'Le paiement a été validé';
const PHOTO = (k) => `https://photos-banc.test/paire-${k}.png`;
const vente = (tx, titre, prix, jours) => ({ transaction_id: tx, conversation_id: tx + 1000, title: titre, price: { amount: prix.toFixed(2), currency_code: 'EUR' }, status: AEXP, transaction_user_status: 'needs_action', date: ilYa(jours), photo: { url: PHOTO(tx) } });
const VENTES = [vente(9101, 'Nike Air Max 90 taille 42', 80, 1), vente(9102, 'Adidas Samba OG taille 41', 45, 1), vente(9103, 'Nike Dunk Low taille 44', 60, 3)];
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_banc', domain: 'www.vinted.fr', updated_at: new Date(MAINTENANT).toISOString() }];
const OV = { '9101': { numero: '117' }, '9102': { numero: '42' }, '9103': { numero: '73' } };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP4z8DAwMDAxMDAwMDAAAANBQEBR8b1WQAAAAJJRU5ErkJggg==', 'base64');
const bord = (tx, suivi, transporteur) => ({ id: `email_bord_${tx}`, data: { transaction: String(tx), filename: `bordereau_${tx}.pdf`, suivi, ...(transporteur ? { transporteur } : {}), receivedAt: ilYa(0.2), uid: '111', account: 'compte_banc', pdfB64: 'JVBERi0xLjQK' } });
const ROWS = [
  { id: 'harvest_111_listings', data: { capturedAt: new Date(MAINTENANT - 60000).toISOString(), payload: { items: [] } } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: new Date(MAINTENANT).toISOString(), payload: { my_orders: [] } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: new Date(MAINTENANT).toISOString(), payload: { my_orders: VENTES } } },
  bord(9101, 'MR00099101', 'Mondial Relay'), bord(9102, 'ZZ9102'),
];
// Les attendus, faits À LA MAIN (jamais par le code de l'app).
const debutMois = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
const venduMois = VENTES.filter((v) => Date.parse(v.date) >= debutMois).reduce((s, v) => s + Number(v.price.amount), 0);
const OBJ = 2000;
const finMois = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
const joursRestants = finMois - new Date().getDate() + 1;
const resteMain = OBJ - venduMois;
const parJourMain = Math.ceil(resteMain / joursRestants);
const fr = (n) => n.toLocaleString('fr-FR').replace(/\u202f|\u00a0/g, ' ');

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d != null && d !== '' ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 200)); } };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0];
  // Une page vide de la même origine : lire et poser le stockage de l'app sans la lancer.
  if (f === '/__vide') { r.writeHead(200, { 'content-type': 'text/html' }); return r.end('<!doctype html><title>vide</title>'); }
  if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
srv.listen(PORT);
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    if (src === 'updated_at') { out[alias] = new Date(MAINTENANT).toISOString(); continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v === 'object' ? JSON.stringify(v) : v);
  }
  return out;
};
// Le contexte : la base servie (ou TENUE : chaque lecture attend `rendre()`), l'objectif dans `main`.
async function contexte(b, vp, { theme = 'light', objectif = OBJ } = {}) {
  const ctx = await b.newContext({ viewport: vp, colorScheme: theme, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const MAIN = { vinted_dark: theme === 'dark', vinted_sale_overrides: OV, vinted_bords_printed: {}, ...(objectif ? { vrm_objectif_mois: { v: 1, type: 'ca', valeur: objectif, cache: {} } } : {}) };
  await ctx.addInitScript((sombre) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_visite_vue', '1'); localStorage.setItem('vrm_visite_bulles_vue', '1'); localStorage.setItem('vinted_dark', JSON.stringify(sombre)); localStorage.setItem('vrm_apparence', JSON.stringify(sombre ? 'sombre' : 'clair')); } catch (_) {} }, theme === 'dark');
  // Le CLS de toute la vie de la page (entrées tamponnées dès le début).
  await ctx.addInitScript(() => { window.__cls = 0; window.__clsListe = []; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) { window.__cls += e.value; window.__clsListe.push({ v: Math.round(e.value * 1000) / 1000, t: Math.round(e.startTime), n: (e.sources || []).map((s) => (s.node && s.node.className ? String(s.node.className).slice(0, 60) : (s.node ? s.node.nodeName : '?')) + `@${Math.round(s.previousRect.y)}→${Math.round(s.currentRect.y)}h${Math.round(s.previousRect.height)}→${Math.round(s.currentRect.height)}`).join('|') }); } }).observe({ type: 'layout-shift', buffered: true }); } catch (_) {} });
  const etat = { tenir: false, tenues: [] };
  const servir = (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) }).catch(() => {});
    // Une écriture est acceptée comme le ferait PostgREST (`return=representation` : les lignes écrites).
    if (route.request().method() !== 'GET') { let d = []; try { const x = JSON.parse(route.request().postData() || '[]'); d = Array.isArray(x) ? x : [x]; } catch (_) {} return j(d); }
    // La sonde du schéma : la base de production EST cloisonnée (l'appareil le retient, `schema_cloisonne`).
    if (/\/app_data\?select=owner&limit=1$/.test(u)) return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' }).catch(() => {});
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq && eq[1] === 'main') return j([projette({ id: 'main', data: MAIN }, sel)]);
    if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map((r) => projette(r, sel)));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(ROWS.filter((r) => re.test(r.id)).map((r) => projette(r, sel))); }
    return j([]);
  };
  await ctx.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    const u = r.request().url();
    if (/photos-banc\.test/.test(u)) return r.fulfill({ status: 200, contentType: 'image/png', body: PNG, headers: { 'access-control-allow-origin': '*' } });
    return ['media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue();
  });
  // Les lectures de la base : TENUES (une requête tenue, jamais un délai fixe, §6.5) ou servies.
  // Seules les LECTURES sont tenues (la relecture de l'ouverture) ; une écriture tenue ferait
  // apparaître le bandeau « changements en attente », un autre sujet.
  await ctx.route('**/rest/v1/**', (route) => { if (etat.tenir && route.request().method() === 'GET') etat.tenues.push(route); else servir(route); });
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  const rendre = () => { etat.tenir = false; const l = etat.tenues.splice(0); l.forEach(servir); return l.length; };
  return { ctx, etat, rendre };
}
const shot = (pg, nom) => pg.screenshot({ path: path.join(SHOTS, nom + '.png') }).catch(() => {});
const cle = (uid) => 'vrm_journee_instantane:' + uid;
const vrai = (pg) => pg.evaluate(() => {
  const ok = document.querySelector('[data-attente-ecran="journee"][data-attente="pret"]');
  const v = document.querySelector('[data-carte-stats="journee"] [data-fu-case="vendu-mois"]');
  const ob = document.querySelector('[data-carte-stats="journee"] [data-objectif]');
  return { pret: !!ok, vendu: v ? v.getAttribute('data-carte-valeur') : null, vb: v ? v.querySelector('b').textContent.replace(/\u202f|\u00a0/g, ' ').trim() : null,
    obj: ob ? { tag: ob.tagName, valeur: ob.getAttribute('data-objectif-valeur'), cible: ob.getAttribute('data-objectif-cible'), reste: ob.getAttribute('data-objectif-reste'), parJour: ob.getAttribute('data-objectif-par-jour'), atteint: ob.getAttribute('data-objectif-atteint'), pct: ob.getAttribute('data-objectif-pct'),
      texte: ob.textContent.replace(/\u202f|\u00a0/g, ' '), plein: (() => { const s = ob.querySelector('.vrm-fu-objectif-piste > span'); return s ? getComputedStyle(s).backgroundColor : null; })(), piste: getComputedStyle(ob.querySelector('.vrm-fu-objectif-piste')).backgroundColor } : null,
    instantane: !!document.querySelector('[data-journee-instantane]') };
});
const attendreVrai = async (pg, ms = 30000) => {
  await pg.waitForSelector('[data-attente-ecran="journee"][data-attente="pret"] [data-carte-stats="journee"] [data-fu-case="vendu-mois"]', { timeout: ms });
  await pg.waitForFunction(() => { const e = document.querySelector('[data-jv2-argent]'); return e && e.getAttribute('data-fu-vendu-jour') !== ''; }, null, { timeout: 15000 }).catch(() => {});
};

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  const temps = [];
  try {
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) for (const theme of ['light', 'dark']) {
      if (SEUL && SEUL !== `${vp.width}-${theme}`) continue;
      const T = `${vp.width}px ${theme === 'dark' ? 'sombre' : 'clair'}`;
      const { ctx, etat, rendre } = await contexte(b, vp, { theme });
      let ref = null;
      // ── A : 1re ouverture, l'instantané se range ───────────────────────────
      await essaie('A ' + T, async () => {
        const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
        const t0 = Date.now();
        await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
        await attendreVrai(pg);
        const tReel = await pg.evaluate(() => performance.now());
        temps.push({ T, quoi: 'écran vrai (base servie, 1re ouverture)', ms: Math.round(tReel) });
        ref = await vrai(pg);
        await pg.waitForFunction((k) => !!localStorage.getItem(k), cle(UID), { timeout: 15000 }).catch(() => {});
        const brut = await pg.evaluate((k) => localStorage.getItem(k), cle(UID));
        const s = brut ? JSON.parse(brut) : null;
        dit(!!s && s.uid === UID && s.v === 1, `A ${T} l'instantané est rangé pour CE compte quand tout est lu`, s ? `${brut.length} octets` : 'absent');
        const caseV = s && s.cases && s.cases.find((c) => c.cle === 'vendu-mois');
        dit(!!caseV && caseV.valeur === ref.vendu && ref.vendu === String(Math.round(venduMois * 100)), `A ${T} il porte la case Vendu · mois RENDUE (${venduMois} €)`, JSON.stringify({ rangé: caseV && caseV.valeur, rendu: ref.vendu }));
        dit(!!brut && !/https?:|photos-banc|Nike|Adidas|compte_banc|MR000|@/.test(brut), `A ${T} rien de personnel rangé (ni photo, ni titre d'article, ni compte, ni suivi, ni e-mail)`, brut ? (brut.match(/https?:|photos-banc|Nike|Adidas|compte_banc|MR000|@/) || [''])[0] : '');
        dit(!!s && s.prochain && /colis/.test(s.prochain.titre), `A ${T} la prochaine chose (son titre seul) est rangée`, s && JSON.stringify(s.prochain));
        // O — l'objectif dans l'écran vrai.
        const o = ref.obj;
        dit(!!o && o.valeur === ref.vendu && o.cible === String(OBJ * 100), `O ${T} la barre de l'objectif = la case « Vendu · mois » (${venduMois} € sur ${OBJ} €)`, JSON.stringify(o && { valeur: o.valeur, cible: o.cible, caseVendu: ref.vendu }));
        dit(!!o && o.reste === String(Math.round(resteMain * 100)) && o.parJour === String(parJourMain * 100), `O ${T} ce qui reste (${resteMain} €) et le rythme (${parJourMain} €/jour sur ${joursRestants} jours, aujourd'hui compris)`, JSON.stringify(o && { reste: o.reste, parJour: o.parJour }));
        const txtAttendu = joursRestants > 1 ? `encore ${fr(resteMain)} € · ≈ ${fr(parJourMain)} €/jour d’ici le ${finMois}` : `encore ${fr(resteMain)} € aujourd’hui`;
        dit(!!o && o.texte.includes(`sur ${fr(OBJ)} €`) && o.texte.includes(txtAttendu), `O ${T} la phrase : « ${fr(venduMois)} € sur ${fr(OBJ)} € · ${txtAttendu} »`, o && o.texte);
        dit(!!o && o.plein && o.piste && o.plein !== o.piste && /rgba\(255, 255, 255, 0\.1/.test(o.piste), `O ${T} la piste neutre, l'accent seulement sur la part faite`, o && `${o.piste} / ${o.plein}`);
        await shot(pg, `ji-vrai-${vp.width}-${theme}`);
        // Toucher la barre ⇒ le réglage de l'objectif, déplié.
        await pg.locator('[data-carte-stats="journee"] [data-objectif-ouvrir]').click();
        const ouvert = await pg.waitForSelector('[data-carte-objectif-saisie]', { timeout: 6000 }).then(() => true).catch(() => false);
        dit(ouvert, `O ${T} toucher la barre ouvre le réglage de l'objectif`);
        await shot(pg, `ji-objectif-reglage-${vp.width}-${theme}`);
        dit(!errs.length, `A ${T} aucune erreur d'app`, errs.join(' | ').slice(0, 200));
        await pg.close();
      });
      // ── I : 2e ouverture, la base TENUE ────────────────────────────────────
      await essaie('I ' + T, async () => {
        // L'instantané a 7 minutes : la mention doit le dire.
        const p0 = await ctx.newPage();
        await p0.goto(`http://localhost:${PORT}/__vide`);
        await p0.evaluate((k) => { const s = JSON.parse(localStorage.getItem(k) || "null"); if (s) { s.t -= 7 * 60000; localStorage.setItem(k, JSON.stringify(s)); } }, cle(UID));
        await p0.close();
        etat.tenir = true;
        const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
        await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
        const vu = await pg.waitForSelector('[data-journee-instantane] [data-ji-case="vendu-mois"]', { timeout: 12000 }).then(() => true).catch(() => false);
        const tChiffres = vu ? await pg.evaluate(() => performance.now()) : null;
        temps.push({ T, quoi: 'chiffres de Ma journée, base TENUE (2e ouverture)', ms: tChiffres == null ? 'jamais (12 s)' : Math.round(tChiffres) });
        dit(vu, `I ${T} base tenue : les derniers chiffres sont là`, tChiffres == null ? 'aucun chiffre en 12 s' : `${Math.round(tChiffres)} ms`);
        dit(tChiffres != null && tChiffres <= 4000, `I ${T} en moins de 4 s (base tenue)`, tChiffres == null ? '—' : `${Math.round(tChiffres)} ms`);
        const i = await pg.evaluate(() => {
          const r = document.querySelector('[data-journee-instantane]');
          if (!r) return null;
          const v = r.querySelector('[data-ji-case="vendu-mois"]');
          const geste = r.querySelector('[data-ji-geste]');
          const pro = r.querySelector('[data-ji-prochain]');
          const dem = document.getElementById('vrm-demarrage');
          return { inert: r.hasAttribute('inert') && r.inert === true, mention: (r.querySelector('[data-ji-mention]') || {}).textContent || '', valeur: v && v.getAttribute('data-ji-valeur'), b: v && v.querySelector('b').textContent.replace(/\u202f|\u00a0/g, ' ').trim(),
            geste: geste ? geste.textContent.trim() : null, pro: pro ? pro.getBoundingClientRect().toJSON() : null, demarrage: !!dem && !dem.hasAttribute('data-sortie'),
            fraisVus: document.querySelectorAll('[data-attente-ecran="journee"] .vrm-attente-cache [data-fu-case]').length,
            frais: [...document.querySelectorAll('[data-fu-case], [data-jv2-vendu], [data-prochain], [data-objectif], [data-carte-valeur], [data-tuile]')].filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden').length,
            obj: (() => { const o = r.querySelector('[data-ji-objectif]'); return o ? o.getAttribute('data-ji-objectif-valeur') : null; })(),
            attente: (document.querySelector('[data-attente-ecran="journee"]') || {}).getAttribute ? document.querySelector('[data-attente-ecran="journee"]').getAttribute('data-attente') : null };
        });
        dit(!!i && /^Mis à jour il y a 7 min$/.test(i.mention.trim()), `I ${T} la mention dit l'âge : « Mis à jour il y a 7 min »`, i && i.mention);
        dit(!!i && i.valeur === ref.vendu && i.b === ref.vb, `I ${T} les MÊMES chiffres que l'écran vrai (Vendu · mois ${ref.vb})`, JSON.stringify(i && { valeur: i.valeur, b: i.b }));
        dit(!!i && i.obj === ref.vendu, `O ${T} l'objectif de l'instantané = sa case Vendu · mois`, i && String(i.obj));
        dit(!!i && i.frais === 0 && i.attente === 'instantane', `I ${T} aucun chiffre « frais » montré pendant ce temps (l'écran vrai attend)`, JSON.stringify(i && { frais: i.frais, attente: i.attente }));
        dit(!!i && !i.demarrage, `I ${T} l'écran de démarrage s'est retiré devant l'instantané`);
        dit(!!i && i.inert && i.geste === 'Vérification…', `I ${T} le geste de la prochaine chose est gardé : « Vérification… », instantané inerte`, JSON.stringify(i && { inert: i.inert, geste: i.geste }));
        await shot(pg, `ji-instantane-${vp.width}-${theme}`);
        if (process.env.JI_DUMP) console.log(await pg.evaluate(() => { const out = []; let e = document.querySelector('.vrm-ji .vrm-fu-tete'); while (e && e !== document.body) { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); out.push(`${e.tagName}.${String(e.className).slice(0,50)} y=${Math.round(r.y)} h=${Math.round(r.height)} mt=${cs.marginTop} pt=${cs.paddingTop}`); e = e.parentElement; } return out.join('\n'); }));
        if (i && i.pro) {
          await pg.mouse.click(i.pro.x + i.pro.width - 30, i.pro.y + i.pro.height / 2);
          await pg.waitForTimeout(700);
          const ecran = await pg.evaluate(() => { const m = document.querySelector('.vrm-main'); return m && m.getAttribute('data-ecran'); });
          dit(ecran === 'journee', `I ${T} toucher « Vérification… » ne fait rien (aucun écran, aucune impression)`, String(ecran));
        } else dit(false, `I ${T} la prochaine chose de l'instantané est là`);
        // Les lectures reviennent : l'écran vrai prend la place.
        const avant = await pg.evaluate(() => window.__cls);
        const n = rendre();
        await attendreVrai(pg);
        await pg.waitForTimeout(1500);
        const apres = await pg.evaluate(() => ({ cls: window.__cls, liste: window.__clsListe, ji: !!document.querySelector('[data-journee-instantane]') }));
        const r2 = await vrai(pg);
        dit(!apres.ji && r2.pret && r2.vendu === ref.vendu, `I ${T} lectures rendues (${n}) : l'écran vrai a pris la place, mêmes chiffres`, JSON.stringify({ ji: apres.ji, vendu: r2.vendu }));
        dit(apres.cls - avant <= 0.01 && apres.cls <= 0.05, `I ${T} remplacé sans saut (CLS au remplacement ${(apres.cls - avant).toFixed(4)}, page ${apres.cls.toFixed(4)})`, JSON.stringify(apres.liste.slice(-4)));
        await shot(pg, `ji-remplace-${vp.width}-${theme}`);
        if (process.env.JI_DUMP) console.log(await pg.evaluate(() => { const out = []; let e = document.querySelector('.vrm-fu-journee .vrm-fu-tete'); while (e && e !== document.body) { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); out.push(`${e.tagName}.${String(e.className).slice(0,50)} y=${Math.round(r.y)} h=${Math.round(r.height)} mt=${cs.marginTop} pt=${cs.paddingTop}`); e = e.parentElement; } return out.join('\n'); }));
        const deb = await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        dit(deb <= 1, `I ${T} aucun débordement`, String(deb));
        dit(!errs.length, `I ${T} aucune erreur d'app`, errs.join(' | ').slice(0, 200));
        await pg.close();
      });
      // ── V : un autre vendeur se connecte sur ce navigateur ⇒ effacé ────────
      await essaie('V ' + T, async () => {
        const p0 = await ctx.newPage();
        await p0.goto(`http://localhost:${PORT}/__vide`);
        const avant = await p0.evaluate((k) => !!localStorage.getItem(k), cle(UID));
        await p0.evaluate(() => localStorage.setItem('vrm_local_owner', 'un-autre-vendeur'));
        await p0.close();
        etat.tenir = true;
        const pg = await ctx.newPage();
        await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
        await pg.waitForSelector('[data-attente-ecran="journee"]', { timeout: 12000 }).catch(() => {});
        await pg.waitForTimeout(1500);
        const r = await pg.evaluate((k) => ({ ji: !!document.querySelector('[data-journee-instantane]'), cle: !!localStorage.getItem(k) }), cle(UID));
        dit(avant && !r.ji && !r.cle, `V ${T} changement de vendeur sur ce navigateur : l'instantané est effacé, rien n'est montré`, JSON.stringify({ avant, ...r }));
        rendre(); await pg.close();
      });
      await ctx.close();
      // ── U : l'instantané d'un AUTRE uid ────────────────────────────────────
      await essaie('U ' + T, async () => {
        const { ctx: c2, etat: e2, rendre: r2 } = await contexte(b, vp, { theme });
        const faux = (uid) => ({ v: 1, uid, t: Date.now() - 120000, jour: '', mois: '', prenom: 'Autre', phrase: null, prochain: { tuile: 'envoyer', job: '', n: '9', titre: '9 colis à envoyer', note: '', action: 'Imprimer', principal: true }, frise: null,
          cases: [{ cle: 'vendu-mois', valeur: '98765400', partiel: false, b: '987 654 €', vide: false, l: 'Vendu · mois', raison: '' }], objectif: null, gestes: 9, hauteur: 0, largeur: 0 });
        await c2.addInitScript(([k, a, b2]) => { try { localStorage.setItem('vrm_local_owner', '0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b'); localStorage.setItem(k, JSON.stringify(a)); localStorage.setItem('vrm_journee_instantane:autre-vendeur', JSON.stringify(b2)); } catch (_) {} },
          [cle(UID), faux('autre-vendeur'), faux('autre-vendeur')]);
        e2.tenir = true;
        const pg = await c2.newPage();
        await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
        await pg.waitForSelector('[data-attente-ecran="journee"]', { timeout: 12000 }).catch(() => {});
        await pg.waitForTimeout(2500);
        const r = await pg.evaluate(() => ({ ji: !!document.querySelector('[data-journee-instantane]'), txt: document.body.innerText.replace(/\u202f|\u00a0/g, ' ') }));
        dit(!r.ji && !/987 654|9 colis/.test(r.txt), `U ${T} un instantané d'un autre uid n'est jamais rendu (même rangé sous la clé de ce compte)`, JSON.stringify({ ji: r.ji, chiffre: /987 654/.test(r.txt) }));
        r2(); await c2.close();
      });
      // ── S : sans instantané, le comportement d'avant ──────────────────────
      await essaie('S ' + T, async () => {
        const { ctx: c3, etat: e3, rendre: r3 } = await contexte(b, vp, { theme, objectif: 50 });
        e3.tenir = true;
        const pg = await c3.newPage();
        await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
        await pg.waitForSelector('[data-attente-ecran="journee"]', { timeout: 12000 }).catch(() => {});
        await pg.waitForTimeout(2000);
        const r = await pg.evaluate(() => ({ ji: !!document.querySelector('[data-journee-instantane]'), attente: document.querySelector('[data-attente-ecran="journee"]').getAttribute('data-attente'), sq: !!document.querySelector('[data-attente-ecran="journee"] [data-demarrage-attente]') }));
        dit(!r.ji && r.attente === 'attente' && r.sq, `S ${T} sans instantané : le squelette d'avant, aucun chiffre`, JSON.stringify(r));
        r3();
        // O — atteint : « Objectif atteint », sans fête.
        await attendreVrai(pg);
        const o = (await vrai(pg)).obj;
        dit(!!o && o.atteint === '1' && /Objectif atteint/.test(o.texte) && o.pct === '100' && !o.reste, `O ${T} objectif dépassé (50 €) ⇒ « Objectif atteint », piste pleine`, o && o.texte);
        await shot(pg, `ji-atteint-${vp.width}-${theme}`);
        await c3.close();
      });
      if (vp.width === 390 && theme === 'light') await essaie('O sans objectif', async () => {
        const { ctx: c4 } = await contexte(b, vp, { theme, objectif: 0 });
        const pg = await c4.newPage();
        await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
        await attendreVrai(pg);
        dit(!(await vrai(pg)).obj, `O ${T} aucun objectif ⇒ aucune barre (vide par défaut)`);
        // Réglages → Affichage → Objectif du mois : un montant, « Enregistrer ».
        await pg.goto(`http://localhost:${PORT}/?tab=settings`, { waitUntil: 'domcontentloaded' });
        const ligne = pg.locator('[data-reglage-objectif]').first();
        await ligne.waitFor({ timeout: 15000 });
        await ligne.click();
        await pg.locator('[data-reglage-objectif-saisie]').fill('1 500');
        await pg.locator('[data-reglage-objectif-ok]').click();
        await pg.waitForTimeout(500);
        const v = await pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vrm_objectif_mois')); } catch (_) { return null; } });
        dit(!!v && v.type === 'ca' && v.valeur === 1500, `O ${T} Réglages → Affichage → Objectif du mois : 1 500 € enregistré (le réglage synchronisé)`, JSON.stringify(v));
        await shot(pg, `ji-reglage-${vp.width}-${theme}`);
        await c4.close();
      });
    }
  } finally {
    await b.close(); srv.close();
  }
  console.log('\nTemps mesurés (performance.now, depuis la navigation) :');
  for (const t of temps) console.log(`  ${t.T} · ${t.quoi} : ${t.ms}${typeof t.ms === 'number' ? ' ms' : ''}`);
  console.log(`\n${ko ? 'KO' : 'OK'} — ${ko} rouge(s) · captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
}
main();
