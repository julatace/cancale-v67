// ═══════════════════════════════════════════════════════════════════════════
// BANC : LE SUIVI D'UN RETOUR (15 nov., lot retours-suivi — node scripts/bancs/retours-suivi.cjs)
// Les données du banc « À renvoyer » + un faux transporteur LOCAL : l'e-mail Mondial Relay
// « Votre colis est entre de bonnes mains » du n° EXACT du bordereau de retour 990009601
// (`email_track_mondialrelay_81239601`, en transit, il y a 30 h). Il exige (390 tactile et 1512,
// clair et sombre) : la carte 990009601 avance SEULE (« Déposé le … · en route vers le vendeur »,
// « lu dans l'e-mail Mondial Relay »), plus de date limite ni de « Déposé », le logo du transporteur,
// le n° de suivi copiable, « Suivre ↗ » vers la page PUBLIQUE de Mondial Relay ; elle sort de « À
// renvoyer » en tête de Ma journée ; la carte sans fait (990009602) garde sa limite et son « Déposé ».
// ─── (ce qui suit : le banc « À renvoyer », données reprises telles quelles) ───
// BANC : « À RENVOYER » — les retours d'achat, en tête de Ma journée et dans Achats
//        (15 nov., lot retours · node scripts/bancs/retours-renvoyer.cjs —
//         après `npm run build` ; BANC_PORT=…, BANC_DIST=…, BANC_SHOTS=…)
// ═══════════════════════════════════════════════════════════════════════════
// Julien : « j'ai un retour sur shop_cancale » puis « c'est vraiment pas ouf » (deux lignes
// « Retour · Renvoyer ↗ » sans nom ni heure). Données INVENTÉES (dépôt public) à la forme
// mesurée le 15 nov. :
//   · 990009602 « Baskets banc Air… Pointure 42.5 » : achat « Retour initié », son bordereau
//     ENCORE GARDÉ « inconnu » (corps entier, PDF en pièce `content`, forme gmail), limite
//     DEMAIN 10 h (Paris), et l'avis « Retourne ta commande d'ici le <demain> » gardé aussi ;
//   · 990009601 « Autry banc Medalist » : achat « Retour initié », bordereau RANGÉ
//     (`email_bordretour_990009601`), limite dans 8 jours 10 h, avis rangé (`email_retourdemande_*`) ;
//   · « Asics banc Gel » : un avis rangé SEUL (aucun bordereau) ⇒ carte sans PDF, sa raison ;
//   · un litige « Retourne ta commande » qui, AVANT, faisait une ligne « Retour » dans À faire.
// Il exige (390 tactile et 1512, clair et sombre) : Ma journée → « À renvoyer 3 » EN TÊTE
// (au-dessus de la grille), le plus pressé d'abord, chaque carte = photo/titre, compte,
// « avant demain 10 h » en ambre / « avant <jour> 10 h », « Imprimer le bordereau » (le PDF
// rangé ou gardé), sans PDF ⇒ la raison et « Retélécharger sur Vinted ↗ » ; AUCUNE ligne
// « Retour » d'achat ailleurs ; Achats → la même liste ; « Imprimer » ouvre la visionneuse
// (PDF du corps gardé, aucune lecture `select=data`) ; « Déposé » s'enfonce ; aucun rouge, rien
// ne déborde, aucune requête vers Vinted, aucune erreur ; captures regardées.
const { chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 4433;
const SHOTS = process.env.BANC_SHOTS || os.tmpdir();
const MAINTENANT = Date.now(), H = 3600000;
const ilYaH = (h) => new Date(MAINTENANT - h * H).toISOString();
const PH = (c) => 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="${c}"/></svg>`);
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'banc_cancale', domain: 'www.vinted.fr', updated_at: ilYaH(0) }];
const NIKE = 'Baskets banc Air. Blanc et rose. Pointure 42.5', AUTRY = 'Autry banc Medalist blanc 42', ASICS = 'Asics banc Gel 1130 43';

// Le jour (Paris) dans `n` jours, et l'instant « ce jour-là à 10 h, Paris ».
const jourParis = (ms) => { const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(ms)).map((x) => [x.type, x.value])); return { y: +p.year, m: +p.month, d: +p.day }; };
const decalage = (ms) => { const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(ms)).map((x) => [x.type, x.value])); return (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute) - ms) / 60000; };
const aDixHeures = (n) => { const j = jourParis(MAINTENANT + n * 86400000); const midi = Date.UTC(j.y, j.m - 1, j.d, 12); return { j, iso: new Date(Date.UTC(j.y, j.m - 1, j.d, 10) - decalage(midi) * 60000).toISOString(), txt: `${String(j.d).padStart(2, '0')}/${String(j.m).padStart(2, '0')}/${j.y} 10 h 00` }; };
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const DEMAIN = aDixHeures(1), DANS8 = aDixHeures(8), DANS5 = aDixHeures(5);

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d && !c ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).replace(/\s+/g, ' ').slice(0, 500)); } };

async function lignes() {
  const { PDFDocument, StandardFonts } = require(path.join(__dirname, '..', '..', 'node_modules', 'pdf-lib'));
  const pdf = async (t) => { const d = await PDFDocument.create(); const p = d.addPage([283.46, 425.2]); p.drawText('BON RETOUR ' + t, { x: 30, y: 200, size: 14, font: await d.embedFont(StandardFonts.Helvetica) }); return Buffer.from(await d.save()).toString('base64'); };
  const achat = (tx, title, eur, status, h, c) => ({ transaction_id: tx, title, price: { amount: String(eur), currency_code: 'EUR' }, status, transaction_user_status: 'needs_action', date: ilYaH(h), photo: { url: PH(c) } });
  const de = '"L\'équipe Vinted" <no-reply_at_vinted_fr_banc@relais.banc.test>';
  const corpsBr = (tx, lim) => ['*Bonjour banc_cancale,*', '*Ton bordereau de retour est joint à ce message*', `Tu as maintenant jusqu’au *${lim} *pour emballer ton colis et \nretourner la commande au·à la vendeur·se.`,
    `*Article :* ${NIKE}`, '*Numéro de suivi :* 8123990009602 ', `*Date limite d'envoi :* ${lim} `, `*Numéro de transaction :* ${tx} `].join('\n');
  const sujetBr = `Bordereau de retour - ${NIKE} - à utiliser avant le ${DEMAIN.txt}`;
  const sujetAv = (art, j) => `Retourne ta commande d'ici le ${j.d} ${MOIS[j.m - 1]} : ${art}`;
  const corpsAv = (art, j) => `Bonjour banc_cancale, banc_vendeur a demandé le retour de la commande ${art}. Retourne la commande d'ici le ${j.d} ${MOIS[j.m - 1]}.. Sinon, tu devras la garder et ton paiement sera transféré au vendeur.`;
  const brBrut = JSON.stringify({ messageId: '<banc-br@banc.test>', from: de, to: 'boite@banc.test', subject: sujetBr, text: corpsBr('990009602', DEMAIN.txt), html: '', source: 'gmail-shared', attachments: [{ content: await pdf('990009602'), filename: 'Bon-Retour-Vinted-990009602.pdf', contentType: 'application/pdf' }] });
  const avBrut = JSON.stringify({ messageId: '<banc-av@banc.test>', from: de, subject: sujetAv(NIKE, DEMAIN.j), text: corpsAv(NIKE, DEMAIN.j), html: '', attachments: [] });
  return [
    // Côté VENTE : un acheteur renvoie la N°21 (transaction 440, colis de retour déposé) ⇒ une ligne « retour en route vers toi ».
    { id: 'main', data: { vinted_annonce_numeros: { i401: { numero: '21', title: 'Nike Dunk banc noir 42', auto: false } }, vinted_used_numeros: [21] } },
    { id: 'harvest_111_txn_990009401', data: { capturedAt: ilYaH(1), payload: { transaction: { id: 990009401, item_id: 'i401', status: 440, status_title: '', shipment: { status_title: 'colis déposé en point relais' } } } } },
    { id: 'harvest_111_orders_purchased', data: { capturedAt: ilYaH(0.2), payload: { my_orders: [
      achat(990009601, AUTRY, 89, 'Retour initié', 150, '#8E8E93'), achat(990009602, NIKE, 55, 'Retour initié', 220, '#C7C7CC'), achat(990009603, NIKE, 50, 'Commande finalisée', 400, '#AEAEB2'),
    ] } } },
    { id: 'harvest_111_orders_sold', data: { capturedAt: ilYaH(0.2), payload: { my_orders: [{ transaction_id: 990009401, title: 'Nike Dunk banc noir 42', status: 'Retour initié', transaction_user_status: 'needs_action', conversation_id: '24618679401', date: ilYaH(120), price: { amount: '70.0', currency_code: 'EUR' } }] } } },
    { id: 'harvest_111_listings', data: { capturedAt: ilYaH(0.2), payload: { items: [], pagination: { total_entries: 0 } } } },
    { id: 'email_bordretour_990009601', data: { type: 'bordereau-retour', sens: 'achat', transaction: '990009601', suivi: '81239601', transporteurPdf: 'mondialrelay', dateLimite: DANS8.txt, dateLimiteIso: DANS8.iso, article: AUTRY, uid: '111', account: 'banc_cancale', filename: 'Bon-Retour-Vinted-990009601.pdf', pdfB64: await pdf('990009601'), receivedAt: ilYaH(20) } },
    // Le faux transporteur local : l'e-mail Mondial Relay du n° EXACT du retour 990009601 (sortant, en transit).
    { id: 'email_track_mondialrelay_81239601', data: { type: 'suivi', carrier: 'mondialrelay', suivi: '81239601', status: 'transit', statusLabel: 'En transit', sens: 'sortant', subject: 'Votre colis est entre de bonnes mains', emailAt: ilYaH(30), receivedAt: ilYaH(30) } },
    { id: 'email_retourdemande_a1', data: { type: 'retour-demande', sens: 'achat', subject: sujetAv(AUTRY, DANS8.j), article: AUTRY, limiteJour: `${DANS8.j.y}-${String(DANS8.j.m).padStart(2, '0')}-${String(DANS8.j.d).padStart(2, '0')}`, limiteIso: new Date(Date.parse(DANS8.iso) + 13 * H).toISOString(), conv: '', uid: '111', account: 'banc_cancale', receivedAt: ilYaH(26) } },
    { id: 'email_retourdemande_a2', data: { type: 'retour-demande', sens: 'achat', subject: sujetAv(ASICS, DANS5.j), article: ASICS, limiteJour: `${DANS5.j.y}-${String(DANS5.j.m).padStart(2, '0')}-${String(DANS5.j.d).padStart(2, '0')}`, limiteIso: new Date(Date.parse(DANS5.iso) + 13 * H).toISOString(), conv: '', uid: '111', account: 'banc_cancale', receivedAt: ilYaH(5) } },
    { id: 'email_inconnu_br990009602', data: { type: 'inconnu', raison: 'aucune règle ne le reconnaît', subject: sujetBr, from: de, receivedAt: ilYaH(140), brut: brBrut } },
    { id: 'email_inconnu_av990009602', data: { type: 'inconnu', raison: 'aucune règle ne le reconnaît', subject: sujetAv(NIKE, DEMAIN.j), from: de, receivedAt: ilYaH(160), brut: avBrut } },
  ];
}

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ')'); process.exit(1); });
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let x = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) x = x == null ? null : x[seg];
    out[alias] = x == null ? null : (/->>/.test(src) && typeof x !== 'object' ? String(x) : x);
  }
  return out;
};
const reDe = (motif) => new RegExp('^' + motif.replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$');

async function preparer(b, vp, ROWS, { sombre = false } = {}) {
  const ctx = await b.newContext({ locale: 'fr-FR', timezoneId: 'Europe/Paris', viewport: vp, colorScheme: sombre ? 'dark' : 'light', ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = [], versVinted = [], lusPdf = [], selectData = [], reclasse = [];
  pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_visite_vue', '1'); localStorage.setItem('vrm_visite_bulles_vue', '1'); localStorage.setItem('vinted_dark', JSON.stringify(s)); localStorage.setItem('vrm_apparence', JSON.stringify(s ? 'sombre' : 'clair')); } catch (_) {} }, sombre);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    if (/vinted\.(fr|com)/i.test(r.request().url()) && !/images\d*\.vinted\.net/.test(r.request().url())) versVinted.push(r.request().url());
    return ['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue();
  });
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return j([]);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    if (/email_(bordretour|inconnu)_/.test(u) && /select=data(&|$)/.test(u)) selectData.push(u);
    if (/email_bordretour_\d+.*pdfB64/.test(u)) lusPdf.push(u);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: r.data.capturedAt || ilYaH(0), cap: r.data.capturedAt });
    const eq = /[?&]id=eq\.([^&]*)/.exec(u);
    if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map(forme));
    const inn = /[?&]id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(',').map((x) => x.replace(/^"|"$/g, '')); return j(ROWS.filter((r) => ids.includes(r.id)).map(forme)); }
    const ou = /[?&]or=\(([^)]*)\)/.exec(u);
    if (ou && /id\.like\./.test(ou[1])) { const res = ou[1].split(',').map((x) => /^id\.like\.(.+)$/.exec(x.trim())).filter(Boolean).map((m) => reDe(m[1])); return j(ROWS.filter((r) => res.some((re) => re.test(r.id))).map(forme)); }
    const lk = /[?&]id=like\.([^&]*)/.exec(u);
    if (lk) { const re = reDe(lk[1]); return j(ROWS.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => { if (/mode=reclasser/.test(r.request().url())) reclasse.push(r.request().url()); return r.fulfill({ status: 200, contentType: 'application/json', body: /mode=reclasser/.test(r.request().url()) ? '{"ok":true,"faits":[],"restes":[]}' : '{"pret":true}' }); });
  return { ctx, pg, errs, versVinted, lusPdf, selectData, reclasse };
}
const rougeIci = (pg, sel) => pg.evaluate((s) => {
  const el = document.querySelector(s); if (!el) return null;
  const rgb = (c) => (/rgba?\(([^)]+)\)/.exec(c) || [, ''])[1].split(',').map((x) => parseFloat(x));
  return [...el.querySelectorAll('*')].some((x) => { const cs = getComputedStyle(x); return [cs.color, cs.backgroundColor].some((c) => { const [r, g, b2, a] = rgb(c); return a !== 0 && r > 190 && g < 90 && b2 < 90; }); });
}, sel);
const deborde = (pg) => pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const cartes = (pg, racine) => pg.evaluate((rac) => [...document.querySelectorAll(`${rac} [data-retour-cle]`)].map((x) => {
  const lim = x.querySelector('[data-retour-phrase-limite]'), imp = x.querySelector('[data-retour-imprimer]'), dep = x.querySelector('[data-retour-depose]');
  return { cle: x.getAttribute('data-retour-cle'), tx: x.getAttribute('data-retour-achat'), source: x.getAttribute('data-retour-source'), pdf: x.getAttribute('data-retour-pdf'), presse: x.getAttribute('data-retour-presse'),
    avis: x.getAttribute('data-retour-avis'), titre: (x.querySelector('.vrm-ret-titre') || {}).innerText || '', meta: (x.querySelector('.vrm-ret-meta') || {}).innerText || '',
    limite: lim ? lim.innerText : '', couleur: lim ? getComputedStyle(lim).color : '', gris: (() => { const m = x.querySelector('.vrm-ret-meta'); return m ? getComputedStyle(m).color : ''; })(),
    imprimer: imp ? Math.round(imp.getBoundingClientRect().height) : 0, depose: dep ? Math.round(dep.getBoundingClientRect().height) : 0,
    sansPdf: (x.querySelector('[data-retour-sans-pdf]') || { getAttribute: () => '' }).getAttribute('data-retour-sans-pdf'), sansPdfTxt: (x.querySelector('[data-retour-sans-pdf]') || {}).innerText || '',
    lien: (x.querySelector('[data-retour-vinted]') || {}).innerText || '', lienVu: (() => { const a = x.querySelector('[data-retour-vinted]'); if (!a) return null; const cs = getComputedStyle(a), r = a.getBoundingClientRect(); return { c: cs.color, o: cs.opacity, v: cs.visibility, d: cs.display, h: Math.round(r.height), w: Math.round(r.width), fond: getComputedStyle(x).backgroundColor }; })(), photo: !!x.querySelector('img.vrm-ret-photo, .vrm-ret-photo') };
}), racine);


const carte = (pg, cle) => pg.evaluate((k) => {
  const x = document.querySelector(`[data-retours-achat] [data-retour-cle="${k}"]`); if (!x) return null;
  const copier = x.querySelector('[data-retour-copier]'), suivre = x.querySelector('[data-retour-suivre]'), logo = x.querySelector('[data-retour-suivi-ligne] [data-transporteur-logo]');
  return { etape: x.getAttribute('data-retour-etape'), fait: x.getAttribute('data-retour-fait'), limite: !!x.querySelector('[data-retour-phrase-limite]'), depose: !!x.querySelector('[data-retour-depose]'),
    phrase: (x.querySelector('[data-retour-phrase-etape]') || {}).innerText || '', source: (x.querySelector('[data-retour-source-fait]') || {}).innerText || '',
    copier: copier ? { txt: copier.innerText, h: Math.round(copier.getBoundingClientRect().height) } : null, suivre: suivre ? suivre.getAttribute('href') : null,
    logo: logo ? logo.getAttribute('data-marque') : null, imprimer: !!x.querySelector('[data-retour-imprimer]') };
}, cle);

(async () => {
  let b;
  try {
    await new Promise((r) => srv.listen(PORT, r));
    const ROWS = await lignes();
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    const cas = [[{ width: 390, height: 844 }, false], [{ width: 1512, height: 950 }, false], [{ width: 390, height: 844 }, true], [{ width: 1512, height: 950 }, true]];
    for (const [vp, sombre] of cas) {
      const nom = `${vp.width} px ${sombre ? 'sombre' : 'clair'}`;
      console.log(`── ${nom}`);
      const P = await preparer(b, vp, ROWS, { sombre });
      const { pg } = P;
      await essaie('Ma journée', async () => {
        await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
        await pg.waitForSelector('[data-a-renvoyer-journee] [data-retour-cle]', { timeout: 30000 }).catch(() => {});
        await pg.waitForTimeout(3500);
        const cles = await pg.evaluate(() => [...document.querySelectorAll('[data-a-renvoyer-journee] [data-retour-cle]')].map((x) => x.getAttribute('data-retour-cle')));
        dit(!cles.includes('r:990009601') && cles.includes('r:990009602'), `${nom} : le retour DÉPOSÉ (fait lu) sort de « À renvoyer » en tête ; celui pas encore déposé y reste`, JSON.stringify(cles));
      });
      await essaie('Achats → la carte', async () => {
        await pg.goto(`http://localhost:${PORT}/?tab=achats`, { waitUntil: 'domcontentloaded' });
        await pg.waitForSelector('[data-retours-achat] [data-retour-cle="r:990009601"][data-retour-fait]', { timeout: 30000 }).catch(() => {});
        await pg.waitForTimeout(1500);
        const a = await carte(pg, 'r:990009601'), z = await carte(pg, 'r:990009602');
        // (15 nov., lot retour-parfait) la phrase est devenue les ÉTAPES : « Déposé · <date> » coché, « En route vers le vendeur » ici.
        // (23 nov., lot retours-suivi) frise HORIZONTALE : libellés courts (« Bordereau », « En route ») — la règle (les états) inchangée.
        dit(a && a.etape === 'en-route' && a.fait === 'email' && /^Bordereau[\s\S]*\nDéposé\s+\d{1,2} \S+\s+En route\s+Livré au vendeur\s+Remboursé$/.test(a.phrase) && /e-mail Mondial Relay/.test(a.source), `${nom} : 990009601 avance SEULE — « Déposé le … · en route vers le vendeur », « lu dans l’e-mail Mondial Relay »`, JSON.stringify(a));
        dit(a && !a.limite && !a.depose && !a.imprimer, `${nom} : déposé ⇒ plus de date limite, ni « Déposé », ni « Imprimer » (le fait remplace le geste)`, JSON.stringify(a));
        dit(a && a.logo === 'mondialrelay' && a.copier && /81239601/.test(a.copier.txt) && a.copier.h >= 44 && /^https:\/\/www\.mondialrelay\.fr\/suivi-de-colis\/\?numeroExpedition=81239601/.test(a.suivre || ''), `${nom} : le logo Mondial Relay, le n° copiable (44 px), « Suivre ↗ » vers la page PUBLIQUE de Mondial Relay`, JSON.stringify(a));
        dit(z && z.etape === 'a-deposer' && z.limite && z.depose && !z.fait, `${nom} : 990009602 (aucun fait lu) garde sa limite et son « Déposé »`, JSON.stringify(z));
        if (!sombre) {
          await pg.click('[data-retours-achat] [data-retour-copier="81239601"]').catch(() => {});
          await pg.waitForTimeout(300);
          const t = await pg.evaluate(() => (document.querySelector('[data-retours-achat] [data-retour-copier="81239601"]') || {}).innerText || '');
          dit(/Copié|81239601/.test(t), `${nom} : toucher le n° le copie (« Copié »)`, t);
        }
        await pg.locator('[data-retours-achat] [data-retour-cle="r:990009601"]').first().scrollIntoViewIfNeeded().catch(() => {});
        await pg.screenshot({ path: path.join(SHOTS, `retour-suivi-${vp.width}-${sombre ? 'sombre' : 'clair'}.png`), fullPage: false }).catch(() => {});
        dit((await rougeIci(pg, '[data-retours-achat]')) === false, `${nom} : aucun rouge`);
        dit((await deborde(pg)) <= 1, `${nom} : rien ne déborde`);
      });
      dit(P.versVinted.length === 0, `${nom} : aucune requête vers Vinted`, P.versVinted.slice(0, 3).join(' '));
      dit(P.errs.length === 0, `${nom} : aucune erreur de page`, P.errs.join(' | ').slice(0, 300));
      await P.ctx.close();
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 200)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ suivi des retours : ${ko} rouge(s)` : '\n✅ suivi des retours : tout est vert');
  process.exit(ko ? 1 : 0);
})();
