// ════════════════════════════════════════════════════════════════════════════
//  BANC « UNE PHRASE PAR GROUPE » DANS VENTES (8 nov., chantier « restes ventes » ;
//  récit : docs/passation/2026-11-08-restes-ventes.md ; règle : CLAUDE.md §7,
//  `groupesVentesEmailEnTete` (src/venteEmailFraiche.js), `refusCommuns`
//  (src/FacturePro.jsx)).
//  Capture de Julien : chaque vente « Vue par e-mail » répétait « Facture : acheteur
//  pas prouvé : la vente n'est pas (encore) lue dans tes ventes Vinted — ouvre
//  Vinted sur ce compte. » et « Vendue — vue par e-mail, pas encore relue sur
//  Vinted · ventes de ce compte relues le … Ouvre Vinted › Mes commandes… ».
//  Données INVENTÉES (le dépôt est public) : le jeu du banc `nouveau-vendeur`
//  + TROIS ventes Pro vues par e-mail sur le compte 111 (liste relue hier), dont
//  une avec SON bordereau ; UNE sur le compte 222. À 390 px tactile et 1512 px.
//  Mesuré sur data-* et nombres (jamais un libellé) :
//   P1 compte 111 : UNE note en tête (`data-ventes-email-tete="111"`, n = 3, le
//      geste visible) ; aucune de ses trois lignes ne porte la note ; la ligne
//      au bordereau garde « Imprimer » (ce qui lui est propre).
//   P2 compte 222 (une seule ligne) : la note reste SUR la ligne.
//   P3 facture : le refus commun « vinted » du compte 111 dit UNE fois en tête
//      (n = 3) ; ses lignes ne le redisent pas ; celui de 222 reste sur sa ligne.
//   P4 la règle elle-même : aucun texte de note ou de refus n'apparaît sur deux
//      lignes de la liste ; rien ne déborde ; aucune erreur.
//  Réglages : `BANC_PORT` (défaut 9747), `LARGEURS=390,1512`, `SHOTS=<dossier>`,
//  `BANC_DIST` (un autre dist/, pour juger la base). Un banc ne meurt pas : il rapporte.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
process.env.BANC_PORT = process.env.BANC_PORT || '9747';
require('./_porte-banc.cjs');
const path = require('path'), fs = require('fs');
const NV = require('./nouveau-vendeur.cjs');
const { metaVersData } = require('./_meta.cjs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const PORT = NV.PORT;
const LARGEURS = String(process.env.LARGEURS || '390,1512').split(',').map((x) => Number(x.trim())).filter(Boolean);
const SHOTS = process.env.SHOTS || '';
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

let ko = 0;
const compte = {};
const dit = (bon, cle, quoi, det) => {
  compte[cle] = compte[cle] || { ok: 0, ko: 0 };
  if (bon) compte[cle].ok++; else { compte[cle].ko++; ko++; }
  console.log(`${bon ? 'OK  ' : 'KO  '}${cle} ${quoi}${!bon && det ? ' — ' + String(det).slice(0, 500) : ''}`);
};
const capture = async (pg, nom) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, nom + '.png'), fullPage: false }).catch(() => {}); };

// ── LE JEU INVENTÉ ──────────────────────────────────────────────────────────
const now = Date.now(), iso = (j) => new Date(now - j * 86400000).toISOString();
const T111 = ['62100101', '62100102', '62100103'], T222 = '62100201';
const TITRES = ['Nike Air Force 1 blanche taille 43', 'Adidas Samba OG noire taille 41', 'Asics Gel-1130 argent taille 42'];
const jeu = () => {
  const l = JSON.parse(JSON.stringify(NV.JEU_LIGNES));
  l.find((x) => x.id === 'harvest_111_orders_sold').data.capturedAt = iso(1);      // liste relue hier
  l.find((x) => x.id === 'harvest_222_orders_sold').data.capturedAt = iso(1.5);
  const pro = (tx, uid, compteNom, titre, j) => ({ id: 'email_sale_' + tx, data: { type: 'vente', pro: true, designation: titre, prix: '72.00', nomComplet: 'Acheteur Exemple', adresse: '1 rue de l’Exemple, 35000 Rennes', email: 'acheteur@exemple.test', account: compteNom, uid, transaction: tx, receivedAt: iso(j) } });
  T111.forEach((tx, i) => l.push(pro(tx, '111', 'vendeuse_a', TITRES[i], 0.05 + i * 0.01)));
  l.push(pro(T222, '222', 'vendeuse_b', 'New Balance 550 crème taille 40', 0.04));
  l.push({ id: 'email_bord_' + T111[0], data: { type: 'bordereau', transaction: T111[0], filename: 'bordereau-' + T111[0] + '.pdf', pdfB64: 'JVBERi0x', article: TITRES[0], modele: TITRES[0], numero: '', account: 'vendeuse_a', uid: '111', receivedAt: iso(0.04), dateLimite: new Date(now + 4 * 86400000).toLocaleDateString('fr-FR') + ' 10 h 00' } });
  return l;
};

// Les e-mails de vente servis comme PostgREST (filtres, projection — §6.3) : la requête
// « vue par e-mail » (meta->>) ET celle de la facture Pro (data->>pro=eq.true).
const servirVentesEmail = (lignes) => async (route) => {
  const u = decodeURIComponent(metaVersData(route.request().url()));
  const q = u.split('?')[1] || '';
  const filtres = []; let sel = null;
  for (const p of q.split('&')) {
    const i = p.indexOf('='); if (i < 0) continue;
    const k = p.slice(0, i), v = p.slice(i + 1);
    if (k === 'select') { sel = v; continue; }
    if (k === 'id' || k === 'order' || k === 'limit' || k === 'offset') continue;
    filtres.push([k, v]);
  }
  const champ = (d, k) => { let x = d; for (const s of k.replace(/^data(->>|->)/, '').split(/->>|->/)) x = x == null ? null : x[s]; return x == null ? null : (typeof x === 'object' ? JSON.stringify(x) : String(x)); };
  const passe = (r) => filtres.every(([k, v]) => {
    const x = champ(r.data, k);
    if (v === 'not.is.null') return x != null;
    if (v === 'is.null') return x == null;
    if (v.startsWith('eq.')) return x === v.slice(3);
    if (v.startsWith('gte.')) return x != null && x >= v.slice(4);
    return true;
  });
  const out = lignes().filter((r) => /^email_sale_/.test(r.id) && passe(r)).map((r) => {
    const o = {};
    for (const part of String(sel || 'id').split(',')) { const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue; o[m[1] || m[2]] = m[2] === 'id' ? r.id : champ(r.data, m[2]); }
    return o;
  });
  return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, out.length - 1)}/${out.length}` }, body: JSON.stringify(out) });
};

const ferme = async (o) => { try { await o.ctx.close(); } catch (_) {} };
async function ouvrirVentes(nav, W) {
  const base = { lignes: jeu(), comptes: NV.JEU_COMPTES, ecritures: 0 };
  const o = await NV.ouvrir(nav, { W, sombre: false, base, tab: 'journee' });
  await o.pg.route(/\/rest\/v1\/app_data\?.*email_sale_/, servirVentesEmail(() => base.lignes));
  await o.pg.goto(`http://localhost:${PORT}/?tab=cat_ventes`, { waitUntil: 'domcontentloaded' });
  await o.pg.waitForSelector('.vrm-sale-row', { timeout: 20000 }).catch(() => {});
  await o.pg.waitForFunction((txs) => txs.every((t) => document.querySelector(`.vrm-sale-row[data-tx="${t}"]`)), [...T111, T222], { timeout: 20000 }).catch(() => {});
  await o.pg.waitForSelector('[data-fp-vente], [data-fp-tete-code]', { timeout: 15000 }).catch(() => {});
  await attendre(2500);
  return o;
}

const lire = (pg) => pg.evaluate(([t111, t222]) => {
  const vis = (e) => { if (!e || !e.getClientRects().length) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const ligne = (tx) => document.querySelector(`.vrm-sale-row[data-tx="${tx}"]`);
  const tete = document.querySelector('[data-ventes-email-tete="111"]');
  const g = tete && tete.querySelector('[data-ventes-email-tete-geste]');
  const fpTete = [...document.querySelectorAll('[data-fp-tete-code]')].map((e) => ({ code: e.getAttribute('data-fp-tete-code'), n: e.getAttribute('data-fp-tete-n'), txs: e.getAttribute('data-fp-tete-txs'), vis: vis(e) }));
  // La règle elle-même : un même texte de note / de refus sur deux lignes ou plus ?
  const textes = {};
  for (const l of document.querySelectorAll('.vrm-sale-row')) for (const e of l.querySelectorAll('[data-vente-email], [data-fp-vente="pas-prouve"]')) { const t = e.innerText.replace(/\s+/g, ' ').trim(); if (t) textes[t] = (textes[t] || 0) + 1; }
  const repetes = Object.entries(textes).filter(([, n]) => n > 1);
  return {
    tete: tete ? { n: tete.getAttribute('data-ventes-email-n'), vis: vis(tete), geste: !!(g && vis(g)), txs: tete.getAttribute('data-ventes-email-txs') } : null,
    tetes: [...document.querySelectorAll('[data-ventes-email-tete]')].map((e) => e.getAttribute('data-ventes-email-tete')),
    lignes111: t111.map((tx) => { const l = ligne(tx); return l ? { note: !!l.querySelector('[data-vente-email]'), marque: l.getAttribute('data-vente-email-tete'), imprimer: !!l.querySelector(`[data-fu-imprimer="${tx}"]`), refus: l.querySelector('[data-fp-vente="pas-prouve"]') ? l.querySelector('[data-fp-vente="pas-prouve"]').getAttribute('data-fp-preuve') : null } : null; }),
    ligne222: (() => { const l = ligne(t222); return l ? { note: !!(l.querySelector('[data-vente-email]') && vis(l.querySelector('[data-vente-email]'))), refus: l.querySelector('[data-fp-vente="pas-prouve"]') ? l.querySelector('[data-fp-vente="pas-prouve"]').getAttribute('data-fp-preuve') : null } : null; })(),
    fpTete, repetes,
    debord: document.documentElement.scrollWidth > window.innerWidth + 1,
    garde: /n'a pas pu s'afficher|n’a pas pu s’afficher|Cannot access|is not defined/.test(document.body.innerText),
  };
}, [T111, T222]);

async function un(nav, W) {
  const T = `[${W}px]`;
  const o = await ouvrirVentes(nav, W);
  const r = await lire(o.pg);
  dit(!!r.tete && r.tete.n === '3' && r.tete.vis && r.tete.geste && r.tetes.filter((x) => x === '111').length === 1, 'P1', `${T} compte 111 : UNE note en tête (3 ventes), le geste visible`, JSON.stringify({ tete: r.tete, tetes: r.tetes }));
  dit(r.lignes111.every((l) => l && !l.note && l.marque === '111'), 'P1', `${T} compte 111 : aucune de ses trois lignes ne redit la note`, JSON.stringify(r.lignes111));
  dit(!!r.lignes111[0] && r.lignes111[0].imprimer, 'P1', `${T} la ligne au bordereau garde « Imprimer » (ce qui lui est propre)`, JSON.stringify(r.lignes111[0]));
  dit(!!r.ligne222 && r.ligne222.note && !r.tetes.includes('222'), 'P2', `${T} compte 222 (une seule ligne) : la note reste sur la ligne, pas d'en-tête`, JSON.stringify({ l: r.ligne222, tetes: r.tetes }));
  const f111 = r.fpTete.filter((x) => x.code === 'vinted' && x.n === '3');
  dit(f111.length === 1 && f111[0].vis && String(f111[0].txs).split(',').sort().join(',') === [...T111].sort().join(','), 'P3', `${T} facture : le refus commun du compte 111 dit UNE fois en tête (3 ventes)`, JSON.stringify(r.fpTete));
  dit(r.lignes111.every((l) => l && l.refus === null), 'P3', `${T} facture : les lignes du compte 111 ne redisent pas le refus`, JSON.stringify(r.lignes111));
  dit(!!r.ligne222 && r.ligne222.refus === 'vinted' && !r.fpTete.some((x) => String(x.txs || '').includes(T222)), 'P3', `${T} facture : le refus du compte 222 (seul) reste sur sa ligne`, JSON.stringify({ l: r.ligne222, t: r.fpTete }));
  dit(!r.repetes.length, 'P4', `${T} la règle : aucun texte de note ou de refus sur deux lignes`, JSON.stringify(r.repetes));
  dit(!r.debord && !r.garde && !o.journal.erreurs.length, 'P4', `${T} rien ne déborde, aucune erreur`, JSON.stringify({ d: r.debord, g: r.garde, e: o.journal.erreurs }));
  await o.pg.locator('[data-ventes-email-tete="111"]').first().scrollIntoViewIfNeeded().catch(() => {});
  await attendre(300); await capture(o.pg, `vup-ventes-${W}`);
  await ferme(o);
}

(async () => {
  await new Promise((ok) => NV.srv.listen(PORT, ok));
  const nav = await chromium.launch({ executablePath: process.env.BANC_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  try {
    for (const W of LARGEURS) await un(nav, W).catch((e) => dit(false, 'P0', `[${W}] au bout`, String(e && e.message).slice(0, 300)));
  } catch (e) { dit(false, 'P0', 'le banc a pu aller au bout', String(e && e.stack).slice(0, 400)); }
  await nav.close(); NV.srv.close();
  console.log('\n── Rouges par mesure');
  for (const [k, v] of Object.entries(compte).sort()) console.log(`   ${k} : ${v.ko} rouge(s), ${v.ok} vert(s)`);
  console.log(ko ? `\n❌ ventes-une-phrase : ${ko} défaut(s)` : '\n✅ ventes-une-phrase : rien à signaler');
  process.exit(ko ? 1 : 0);
})();
