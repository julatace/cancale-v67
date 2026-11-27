require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Banc : LE MÊME COLIS DEUX FOIS, LE MÊME POINT EN DEUX CARTES (27 nov., captures iPhone de Julien, Achats → À retirer).
//  (1) Point « Joubert Peintures » : la paire au code 978 216, deux fois — « Au point · 20 nov. » comptée, puis sous « Pas
//      compté » la MÊME paire, son QR, « Date limite dépassée · à vérifier », « Au point · 19 nov. ».
//  (2) La même adresse en DEUX cartes : « Joubert Peintures · Transporteur, 10 Rue du Bois Aurant, 35400 Saint-Malo » et
//      « 10 Rue du Bois Aurant · Vinted Go · Saint-Malo » (le suivi Vinted Go ne donne que « <n° et rue>, <ville> »).
//  Base INVENTÉE (dépôt public) à la forme MESURÉE (passation du 23 nov.) : l'e-mail Vinted Go `email_track_vinted_{n°}` (code
//  « 978 216 », QR, arrivé 8 jours plus tôt, limite LUE il y a 2 jours ; le rappel tombé sur la même ligne) ; l'e-mail Vinted
//  « Commande mise à jour » de SA conversation (`source: 'vinted-commande'`, SANS code écrit, sans limite, arrivé le lendemain) ;
//  l'achat (code lu dans la conversation). Témoin (§5, esprit d'audit-identite) : un AUTRE achat au MÊME titre, même point, mêmes
//  jours, autre code, autre commande ⇒ jamais réuni. Deux colis Vinted Go dont le lieu n'est que la rue et la ville (forme du
//  suivi) au MÊME endroit ; un colis à la même rue, AUTRE numéro ⇒ autre point.
//  Jugé sur les data-* RENDUS : 978216 = UNE rangée, « à vérifier » (`data-rp-verif="depasse"`), QR, « Au point » au jour du
//  transporteur ; le témoin à part ; l'adresse = UNE carte (4 colis), l'autre numéro = une autre carte ; « Retiré » sur la
//  rangée réunie ⇒ plus aucune rangée 978216. 390 tactile et 1512, clair et sombre. `SHOTS=dossier` (captures à regarder).
// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');
const P = require('./design-passe.cjs');
const { ouvrir, base, srv, PORT, chromium } = P;
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-retrait-double-code');
fs.mkdirSync(SHOTS, { recursive: true });
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 900) : '')); } return c; };
const attendre = async (pg, f, ms = 40000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await pg.evaluate(f).catch(() => false)) return true; await pg.waitForTimeout(300); } return false; };
const J = 86400000, H = 3600000;
const iso = (ms) => new Date(Date.now() + ms).toISOString();
const jourParis = (ms) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
// Un VRAI QR (qrcode-generator, déjà dans node_modules), inventé pour le banc.
const qrcode = require(path.join(__dirname, '..', '..', 'node_modules', 'qrcode-generator'));
const QRde = (texte) => { const q = qrcode(0, 'M'); q.addData(texte); q.make(); return Buffer.from(q.createSvgTag({ cellSize: 4, margin: 2, scalable: true })).toString('base64'); };
const N = '1792000000000099';
const RUE = '10 Rue des Essais', VILLE = 'Villeneuve-sur-Banc';
const LIEU_NOMME = `Relais Vinted Go, Droguerie du Banc, ${RUE}, 35400 ${VILLE}`;
const TITRE = 'Nike Air Zoom Alphafly NEXT% Eliud Kipchoge 44';
const DEPOSE = "La livraison n'a pas encore eu lieu - colis déposé en bureau de Poste ou point relais";
const conv = (tx) => `0000aaaa-0000-4000-8000-${String(tx).padStart(12, '0')}`;
function baseDouble() {
  const b = base();
  const uid = b.accounts[0].vinted_user_id;
  const my = (b.rows.find((r) => r.id === `harvest_${uid}_orders_purchased`) || {}).data.payload.my_orders;
  const achat = (tx, titre) => my.unshift({ transaction_id: tx, conversation_id: conv(tx), title: titre, price: { amount: '13.36', currency_code: 'EUR' }, status: DEPOSE,
    transaction_user_status: 'needs_action', date: iso(-12 * J), photo: { url: `https://images1.vinted.net/t/r${tx}/f800/p.jpeg` } });
  achat(99300001, TITRE); achat(99300002, TITRE);
  let relais = b.rows.find((r) => r.id === 'panel_colis_relais'); if (!relais) { relais = { id: 'panel_colis_relais', data: {} }; b.rows.push(relais); }
  relais.data['99300001'] = { code: '978216', lieu: LIEU_NOMME, transporteur: 'vinted', at: iso(-7 * J) };
  relais.data['99300002'] = { code: '431907', lieu: LIEU_NOMME, transporteur: 'vinted', at: iso(-7 * J) };
  // (1) l'e-mail Vinted Go : code écrit « 978 216 », QR, arrivé il y a 8 jours, limite LUE passée (il y a 2 jours) ; le rappel l'a réécrit.
  b.rows.push({ id: `email_track_vinted_${N}`, data: { type: 'suivi', carrier: 'vinted', suivi: N, status: 'available', statusLabel: 'Au point relais', subject: `Rappel : récupère ton colis avant le ${jourParis(Date.now() - 2 * J).split('-').reverse().join('/')} #${N}`,
    receivedAt: iso(-5 * J), emailAt: iso(-5 * J), arriveLe: iso(-8 * J), code: '978 216', code2: null, lieu: LIEU_NOMME, limite: jourParis(Date.now() - 2 * J), consigne: false, qrB64: QRde('978216'), qrType: 'image/svg+xml', account: b.accounts[0].login } });
  // … et la moitié Vinted de SA conversation, sans code écrit, sans limite, le lendemain.
  const moitie = (tx, code) => ({ id: `email_track_autre_conv-${conv(tx)}`, data: { type: 'suivi', carrier: 'autre', suivi: '', status: 'available', statusLabel: 'Arrivé au point relais (Vinted)', subject: `Commande mise à jour pour ${TITRE}`,
    receivedAt: iso(-7 * J), emailAt: iso(-7 * J), arriveLe: iso(-7 * J), code, lieu: LIEU_NOMME, limite: null, consigne: false, conv: conv(tx), source: 'vinted-commande', cleLigne: `email_track_autre_conv-${conv(tx)}`, account: b.accounts[0].login } });
  b.rows.push(moitie(99300001, null), moitie(99300002, '431907'));
  // (2) deux colis Vinted Go dont le lieu est celui du SUIVI (« <n° et rue>, <ville> », sans le commerce), au même endroit,
  // et un à la même rue, AUTRE numéro.
  const vg = (suivi, code, lieu) => b.rows.push({ id: `email_track_vinted_${suivi}`, data: { type: 'suivi', carrier: 'vinted', suivi, status: 'available', statusLabel: 'Au point relais', subject: 'Ton colis Vinted Go est arrivé',
    receivedAt: iso(-6 * H), emailAt: iso(-6 * H), arriveLe: iso(-6 * H), code, code2: null, lieu, limite: jourParis(Date.now() + 5 * J), consigne: false, account: '' } });
  vg('1792000000000201', '713080', `${RUE}, ${VILLE}`);
  vg('1792000000000202', '703693', `${RUE}, ${VILLE}`);
  vg('1792000000000203', '555123', `12 Rue des Essais, ${VILLE}`);
  return b;
}
const releve = () => {
  const vis = (e) => !!e && e.getClientRects().length > 0;
  const points = [...document.querySelectorAll('[data-rp-point]')].filter(vis).map((c) => ({
    nom: ((c.querySelector('.n-rp-nom') || {}).textContent || '').trim(), texte: c.innerText.replace(/\s+/g, ' ').slice(0, 200),
    colis: [...c.querySelectorAll('[data-rp-colis]')].map((li) => ({ cle: li.getAttribute('data-rp-colis') || '', code: String(li.getAttribute('data-rp-code') || li.getAttribute('data-v2-code') || '').replace(/\s+/g, ''),
      verif: li.getAttribute('data-rp-verif') || '', qr: li.getAttribute('data-v2-qr-dispo') || '',
      point: ((li.querySelector('[data-rp-etape="point"][data-rp-etape-lue="1"]') || { getAttribute: () => '' }).getAttribute('data-rp-etape-at') || '') })) }));
  let pub = null; try { pub = JSON.parse(localStorage.getItem('vrm_colis_retirer') || 'null'); } catch (_) {}
  return { points, pub };
};

(async () => {
  await new Promise((r) => srv.listen(PORT, r));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] }).catch(() => chromium.launch({ args: ['--no-sandbox'] }));
  try {
    for (const W of [390, 1512]) for (const th of ['clair', 'sombre']) {
      const nom = `${W}-${th}`;
      console.log(`\n── 978 216 et le point du 10 Rue · ${nom}`);
      const b = baseDouble();
      const { ctx, pg, erreurs } = await ouvrir(nav, { W, sombre: th === 'sombre', b, url: '/?tab=achats', dsf: 2 });
      await pg.addInitScript(() => { try { localStorage.setItem('vrm_design_v2', '1'); localStorage.removeItem('vrm_banc_dom_ancien'); localStorage.removeItem('vrm_banc_retrait_variante'); } catch (_) {} });
      await pg.reload({ waitUntil: 'domcontentloaded' });
      await pg.waitForSelector('.vrm-main', { timeout: 30000 }).catch(() => {});
      await attendre(pg, () => document.querySelectorAll('[data-rp-point] [data-rp-colis]').length >= 5);
      await pg.waitForTimeout(2000);
      const r = await pg.evaluate(releve);
      const tous = r.points.flatMap((p) => p.colis.map((c) => ({ ...c, pointNom: p.nom })));
      const ceColis = tous.filter((c) => c.code === '978216');
      dit(ceColis.length === 1, `${nom} : (1) le colis 978 216 (e-mail Vinted Go + moitié Vinted) = UNE rangée`, r.points.map((p) => [p.nom, p.colis.map((c) => c.code + ':' + c.verif)]));
      const x = ceColis[0] || {};
      dit(x.verif === 'depasse', `${nom} : (1) sa limite LUE est passée ⇒ « Date limite dépassée · à vérifier »`, x);
      dit(x.qr === '1', `${nom} : (1) il garde le QR de l'e-mail du transporteur`, x);
      dit(!x.point || jourParis(Date.parse(x.point)) === jourParis(Date.now() - 8 * J), `${nom} : (1) « Au point » au jour du transporteur (il y a 8 j), jamais celui de Vinted (7 j)`, x);
      dit(tous.filter((c) => c.code === '431907').length === 1, `${nom} : (1) le témoin (même titre, même point, autre code, autre commande) : une rangée à part`, tous.map((c) => c.code));
      const pub = r.pub ? JSON.stringify([...(r.pub.colis || []), ...(r.pub.verif || [])]) : '';
      dit(!!r.pub && (pub.match(new RegExp(N, 'g')) || []).length <= 1, `${nom} : (1) le compte publié (Ma journée, widget) n'a jamais ce colis deux fois`, r.pub && { total: r.pub.total, colis: r.pub.colis, verif: r.pub.verif });
      const auDix = r.points.filter((p) => p.colis.some((c) => ['713080', '703693', '978216', '431907'].includes(c.code)));
      dit(auDix.length === 1 && /Droguerie du Banc/.test(auDix[0].nom) && auDix[0].colis.length === 4, `${nom} : (2) « Droguerie du Banc » et « ${RUE}, ${VILLE} » (le suivi Vinted Go) : UNE carte, au vrai nom, 4 colis`, auDix.map((p) => [p.nom, p.colis.map((c) => c.code)]));
      const douze = r.points.filter((p) => p.colis.some((c) => c.code === '555123'));
      dit(douze.length === 1 && !douze[0].colis.some((c) => c.code === '713080'), `${nom} : (2) le 12 de la même rue : une AUTRE carte`, douze.map((p) => p.nom));
      const el = await pg.$('[data-rp-point]');
      if (el) { await el.scrollIntoViewIfNeeded().catch(() => {}); await pg.screenshot({ path: path.join(SHOTS, `double-code-${nom}.png`), fullPage: false }).catch(() => {}); }
      if (W < 600 && th === 'clair') {
        const bouton = pg.locator('[data-rp-colis][data-rp-code*="978"] [data-rp-verif-geste="retire"], [data-rp-colis][data-v2-code*="978"] [data-rp-verif-geste="retire"]').first();
        const n = await bouton.count();
        if (n) { await bouton.click(); await pg.waitForTimeout(2500); }
        const apres = await pg.evaluate(releve);
        const reste = apres.points.flatMap((p) => p.colis).filter((c) => c.code === '978216');
        dit(n > 0 && reste.length === 0, `${nom} : (1) « Retiré » sur la rangée réunie ⇒ plus aucune rangée 978 216 (la moitié Vinted ne revient pas seule)`, { bouton: n, reste });
        dit(apres.points.flatMap((p) => p.colis).filter((c) => c.code === '431907').length === 1, `${nom} : (1) le témoin reste`);
        await pg.screenshot({ path: path.join(SHOTS, `double-code-${nom}-apres-retire.png`), fullPage: false }).catch(() => {});
      }
      dit(!erreurs.length, `${nom} : aucune erreur de page`, erreurs.slice(0, 3));
      await ctx.close();
    }
  } catch (e) { dit(false, 'le banc a rencontré une erreur', String(e && e.stack || e)); }
  await nav.close(); srv.close();
  console.log(`\n${ok} vert(s), ${ko} rouge(s) — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
