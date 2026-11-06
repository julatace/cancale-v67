// ════════════════════════════════════════════════════════════════════════════
//  BANC « ONGLETS C » (6 nov.) — E-mails, « Relier la boîte de <compte> »,
//  Comptes liés, Colis, Ma journée. Récit : docs/passation/2026-11-06-onglets-c.md.
//  Données INVENTÉES (le dépôt est public) : le jeu du banc `nouveau-vendeur`
//  (deux comptes Vinted) ; le compte 222 a vendu sans AUCUN e-mail (preuve) et a
//  un colis à envoyer ; son adresse est un relais d'Apple inventé.
//  À 390 px tactile et 1512 px, clair et sombre. Il MESURE (data-*, nombres —
//  jamais un libellé exact) :
//   C1 E-MAILS — le bandeau des comptes à relier (le compte 222 seul), LE geste ;
//      le pas-à-pas DE CE compte (messagerie suggérée : relais d'Apple), la
//      vérification « attente » ; un e-mail du compte arrive ⇒ « relié » (sur la
//      preuve lue) et le bandeau s'efface ; lecture en panne ⇒ « pas su » ;
//      une seule scène animée.
//   C2 RECHERCHE — la saisie part à la base (`cherche=`), « rien trouvé » dit le
//      geste (Effacer) ; « À vérifier » filtre (`etat=a-verifier`).
//   C3 COMPTES LIÉS — le geste nomme le compte et ouvre SON pas-à-pas.
//   C4 COLIS — la ligne du compte qui a un colis à envoyer, le geste.
//   C5 MA JOURNÉE — UNE carte, comptée ; touchée ⇒ son pas-à-pas, et plus là
//      au retour (dit une fois).
//   C0 chaque écran : aucune erreur JS ni console, aucun « undefined / NaN /
//      null », rien qui déborde, cibles ≥ 44 px au doigt.
//  Réglages : `BANC_PORT` (10600–10649, 10610 par défaut), `LARGEURS=390,1512`,
//  `THEMES=clair,sombre`, `SHOTS=<dossier>` (captures à REGARDER), `BANC_DIST`.
//  Un banc ne meurt pas : il rapporte.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
process.env.BANC_PORT = process.env.BANC_PORT || '10610';
require('./_porte-banc.cjs');
const path = require('path'), fs = require('fs');
const NV = require('./nouveau-vendeur.cjs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const PORT = NV.PORT;
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
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
const ADR_A = 'vendeuse.a@exemple.test', ADR_B = 'k7x2q9w4@privaterelay.appleid.com';
const jeu = () => {
  const l = JSON.parse(JSON.stringify(NV.JEU_LIGNES));
  l.find((x) => x.id === 'main').data.vinted_account_emails = { 111: ADR_A, 222: ADR_B };
  const v2 = l.find((x) => x.id === 'harvest_222_orders_sold');
  const vente = (tx, titre, j, st = 'Commande finalisée', tus = 'completed') => ({ transaction_id: tx, title: titre, price: { amount: '70', currency_code: 'EUR' }, status: st, transaction_user_status: tus, date: iso(j), photo: null });
  v2.data.payload.my_orders.push(vente(62011, 'Asics Gel-1130 argent taille 42', 12), vente(62013, 'New Balance 550 crème taille 41', 0.4, 'Bordereau envoyé au vendeur', 'needs_action'));
  l.push({ id: 'email_track_chronopost_XA000000001FR', data: { carrier: 'chronopost', status: 'delivered', suivi: 'XA000000001FR', subject: 'Votre colis a été livré', account: 'vendeuse_a', receivedAt: iso(40) } });
  return l;
};
// La boîte servie par la route `/api/email-rattacher?mode=journal` (forme réelle de `lireJournalEmail`).
const EMAILS = [
  { id: 'email_reception_' + 'a'.repeat(64), at: iso(0.1), sourceDate: null, etat: 'integre', type: 'suivi', subject: 'Votre colis est disponible', from: 'Mondial Relay <noreply@exemple.test>', adresses: [ADR_A], compte: { id: '111', nom: 'vendeuse_a' }, compteAmbigu: false, resume: { t: 'suivi', s: 'MR40817263', st: 'available', code: '582913', lieu: 'Le Fournil' }, pj: 0 },
  { id: 'email_reception_' + 'b'.repeat(64), at: iso(0.3), sourceDate: null, etat: 'a-verifier', type: 'suivi', subject: 'Votre colis est arrivé', from: 'Mondial Relay <noreply@exemple.test>', adresses: [ADR_A], compte: { id: '111', nom: 'vendeuse_a' }, compteAmbigu: false, resume: { t: 'suivi', st: 'available', av: 'sans-suivi' }, pj: 0 },
  { id: 'email_reception_' + 'c'.repeat(64), at: iso(1.2), sourceDate: null, etat: 'integre', type: 'vente', subject: 'Tu as vendu un article', from: 'Vinted <no-reply@exemple.test>', adresses: [ADR_A], compte: { id: '111', nom: 'vendeuse_a' }, compteAmbigu: false, resume: { t: 'vente', a: 'Nike Air Max 90 blanche', px: '60' }, pj: 1 },
];
const reponseBoite = (q) => {
  let e = EMAILS.slice();
  if (q.get('etat') === 'a-verifier') e = e.filter((x) => x.etat === 'a-verifier');
  const c = (q.get('cherche') || '').toLowerCase();
  if (c) e = e.filter((x) => (x.subject + ' ' + x.from + ' ' + JSON.stringify(x.resume)).toLowerCase().includes(c));
  return { ok: true, page: 0, parPage: 20, suite: false, emails: e, compteurs: { sur: 3, plus: false, integre: 2, aVerifier: 1, erreur: 0, incompris: 0, parRubrique: { ventes: 1, achats: 0, codes: 1, colis: 2, autres: 0 } }, adresses: [{ adresse: ADR_A, nom: 'vendeuse_a' }, { adresse: ADR_B, nom: 'vendeuse_b' }], cherche: c };
};

const ferme = async (o) => { try { await o.ctx.close(); } catch (_) {} };
async function ouvrir(nav, { W, theme, tab, panneDernier = false }) {
  const base = { lignes: jeu(), comptes: NV.JEU_COMPTES, ecritures: 0 };
  const o = await NV.ouvrir(nav, { W, sombre: theme === 'sombre', base, tab });
  o.base = base; o.requetesBoite = [];
  if (process.env.BANC_DEBUG) { o.pg.on('console', (m) => console.log('   [page] ' + m.text().slice(0, 300))); o.pg.on('request', (r) => { if (/meta|relier|email_journal/.test(decodeURIComponent(r.url()))) console.log('   [req] ' + decodeURIComponent(r.url()).replace(/^http:\/\/localhost:\d+/, '').slice(0, 200)); }); }
  // La preuve de la vérification : le dernier e-mail AU NOM d'un compte (`meta->>account`), servie dans sa forme.
  await o.pg.route(/\/rest\/v1\/app_data\?.*meta(->>|-%3E%3E)account=eq\./, (route) => {
    const u = decodeURIComponent(route.request().url());
    const h = { 'access-control-allow-origin': '*' };
    if (panneDernier) return route.fulfill({ status: 503, contentType: 'application/json', headers: h, body: '{"message":"indisponible"}' });
    const acc = (/meta->>account=eq\.([^&]*)/.exec(u) || [])[1];
    const r = base.lignes.filter((x) => /^email_/.test(x.id) && x.data && x.data.account === acc && x.data.receivedAt).sort((a, b) => (a.data.receivedAt < b.data.receivedAt ? 1 : -1)).slice(0, 1).map((x) => ({ at: x.data.receivedAt }));
    return route.fulfill({ status: 200, contentType: 'application/json', headers: h, body: JSON.stringify(r) });
  });
  await o.pg.route('**/api/email-rattacher**', (route) => {
    // (servie AVANT le rechargement ci-dessous : la boîte se lit dès son montage)
    const q = new URL(route.request().url()).searchParams;
    o.requetesBoite.push(q.toString());
    if (q.get('lire')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, id: q.get('lire'), email: null }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(reponseBoite(q)) });
  });
  // Les routes du banc sont posées après la première ouverture : on rouvre l'écran pour qu'elles servent dès le montage.
  await o.pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  await o.pg.waitForSelector('.vrm-main', { timeout: 20000 }).catch(() => {});
  return o;
}
const inspecte = async (o, cle, T, ecran) => {
  const r = await NV.INSPECTE(o.pg, o.tel);
  dit(!r.mauvais.length, 'C0', `${T} ${ecran} : aucun « undefined / NaN / null » à l'écran`, r.mauvais.join(' ¦ '));
  dit(!r.debord && !r.dehors.length, 'C0', `${T} ${ecran} : rien ne déborde`, JSON.stringify({ debord: r.debord, dehors: r.dehors }));
  const petits = r.petits.filter((x) => /Relier|Vérifier|Réessayer|Copier|Effacer|À vérifier|Chercher/.test(x));
  dit(!petits.length, 'C0', `${T} ${ecran} : nos cibles ≥ 44 px au doigt`, petits.join(' ¦ '));
  dit(!o.journal.erreurs.length && !o.journal.console.length, 'C0', `${T} ${ecran} : aucune erreur JS ni console`, [...o.journal.erreurs, ...o.journal.console].join(' ¦ '));
};
const lireRelier = (pg) => pg.evaluate(() => {
  const vis = (e) => !!(e && e.getClientRects().length && e.getBoundingClientRect().width > 0);
  const b = document.querySelector('[data-relier-compte]');
  const v = document.querySelector('[data-relier-verif]');
  return { compte: b ? b.getAttribute('data-relier-compte') : null, messagerie: b ? b.getAttribute('data-relier-compte-messagerie') : null, vis: vis(b),
    scene: (document.querySelector('[data-relier-boite]') || { getAttribute: () => null }).getAttribute('data-messagerie'),
    scenes: document.querySelectorAll('[data-relier-boite]').length, verif: v ? v.getAttribute('data-relier-verif') : null,
    bandeau: document.querySelector('[data-boite-a-relier]') ? document.querySelector('[data-boite-a-relier]').getAttribute('data-boite-a-relier') : null,
    adresse: (document.querySelector('[data-relier-compte-adresse]') || {}).textContent || '', boites: (document.querySelector('[data-relier-boites]') || { getAttribute: () => null }).getAttribute('data-relier-boites') };
});

// ── C1 · C2 · E-MAILS ────────────────────────────────────────────────────────
async function emails(nav, { W, theme }) {
  const T = `[${W}px ${theme}]`;
  const o = await ouvrir(nav, { W, theme, tab: 'emails' });
  const { pg } = o;
  await pg.waitForSelector('[data-boite-a-relier]', { timeout: 15000 }).catch(() => {});
  await attendre(400);
  const b = await pg.evaluate(() => ({ n: (document.querySelector('[data-boite-a-relier]') || { getAttribute: () => null }).getAttribute('data-boite-a-relier'), comptes: [...document.querySelectorAll('[data-boite-a-relier-compte]')].map((x) => x.getAttribute('data-boite-a-relier-compte')), geste: (() => { const g = document.querySelector('[data-boite-relier-compte="222"]'); return g ? Math.round(g.getBoundingClientRect().height) : 0; })() }));
  dit(b.n === '1' && b.comptes.join() === '222', 'C1', `${T} en tête de la boîte : le compte qui n'envoie rien (222), seul`, JSON.stringify(b));
  dit(b.geste >= 44, 'C1', `${T} LE geste « Relier la boîte de … » (≥ 44 px)`, String(b.geste));
  await capture(pg, `c-emails-bandeau-${W}-${theme}`);
  await inspecte(o, 'C0', T, 'E-mails (boîte)');
  // C2 · la recherche part à la base ; rien trouvé ⇒ le geste.
  await pg.locator('[data-boite-cherche-champ]').fill('zzz introuvable');
  await pg.waitForSelector('[data-boite-etat="recherche-vide"]', { timeout: 8000 }).catch(() => {});
  const r = await pg.evaluate(() => ({ vide: !!document.querySelector('[data-boite-etat="recherche-vide"]'), effacer: !!document.querySelector('[data-boite-etat-geste="effacer"]'), n: document.querySelectorAll('[data-boite-n]').length }));
  dit(r.vide && r.effacer && o.requetesBoite.some((q) => /cherche=zzz/.test(q)), 'C2', `${T} la recherche part à la base (\`cherche=\`) ; rien trouvé ⇒ « Effacer la recherche »`, JSON.stringify({ r, q: o.requetesBoite.slice(-2) }));
  dit(r.n === 0, 'C2', `${T} pendant une recherche, les nombres des rubriques ne sont pas montrés (ils ne la suivent pas)`, String(r.n));
  await capture(pg, `c-emails-recherche-${W}-${theme}`);
  await pg.locator('[data-boite-etat-geste="effacer"]').click().catch(() => {});
  await pg.waitForSelector('[data-boite-email]', { timeout: 8000 }).catch(() => {});
  await pg.locator('[data-boite-rubrique="a-verifier"]').first().click().catch(() => {});
  await pg.waitForFunction(() => document.querySelectorAll('[data-boite-email]').length === 1, null, { timeout: 8000 }).catch(() => {});
  const av = await pg.evaluate(() => [...document.querySelectorAll('[data-boite-email]')].map((x) => x.getAttribute('data-etat')));
  dit(av.join() === 'a-verifier' && o.requetesBoite.some((q) => /etat=a-verifier/.test(q)), 'C2', `${T} « À vérifier » filtre côté base (\`etat=a-verifier\`)`, JSON.stringify(av));
  // C1 · le geste ⇒ le pas-à-pas DE CE compte, avec la vérification.
  await pg.locator('[data-boite-relier-compte="222"]').first().click().catch(() => {});
  await pg.waitForSelector('[data-relier-compte="222"] [data-relier-verif="attente"]', { timeout: 10000 }).catch(() => {});
  let s = await lireRelier(pg);
  dit(s.compte === '222' && s.vis && s.messagerie === 'relais-apple' && s.scene === 'relais-apple', 'C1', `${T} « Relier la boîte de … » ouvre SON pas-à-pas, sur la messagerie suggérée (relais d'Apple)`, JSON.stringify(s));
  dit(s.scenes === 1, 'C1', `${T} une seule scène animée (jamais deux pas-à-pas)`, String(s.scenes));
  dit(s.verif === 'attente' && s.boites === '1' && s.adresse === ADR_B, 'C1', `${T} vérification « en attente » ; l'adresse du compte ; la boîte qui arrive déjà est proposée`, JSON.stringify(s));
  await pg.locator('[data-relier-compte]').first().scrollIntoViewIfNeeded().catch(() => {});
  await capture(pg, `c-relier-attente-${W}-${theme}`);
  await inspecte(o, 'C0', T, 'Relier la boîte');
  // Un e-mail du compte arrive (une ligne rangée À SON NOM) ⇒ coché, sur la preuve lue.
  o.base.lignes.push({ id: 'email_offer_990001', data: { account: 'vendeuse_b', receivedAt: new Date().toISOString(), montant: '50' } });
  if (process.env.BANC_DEBUG) console.log('   [cible] ' + await pg.evaluate(() => { const b = document.querySelector('[data-relier-verifier]'); b.scrollIntoView({ block: 'center' }); const r = b.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return JSON.stringify({ r: [r.top, r.height, innerHeight], cible: e && (e.outerHTML || '').slice(0, 160), n: document.querySelectorAll('[data-relier-verifier]').length }); }));
  if (process.env.BANC_DEBUG) { await pg.evaluate(() => { window.__clics = 0; document.addEventListener('click', () => { window.__clics++; }, true); ['pointerdown','pointerup','touchstart','touchend','mousedown','mouseup'].forEach((t) => document.addEventListener(t, () => { window.__ev = (window.__ev || '') + t[0] + t.slice(-2); }, true)); }); }
  await pg.locator('[data-relier-verifier]').first().click({ timeout: 10000 }).catch((e) => { if (process.env.BANC_DEBUG) console.log('   [clic] ' + String(e.message).slice(0, 600)); });
  await pg.waitForSelector('[data-relier-verif="relie"]', { timeout: 8000 }).catch(() => {});
  if (process.env.BANC_DEBUG) console.log('   [clics] ' + await pg.evaluate(() => window.__clics + ' ' + window.__ev));
  s = await lireRelier(pg);
  dit(s.verif === 'relie' && s.bandeau === null, 'C1', `${T} le premier e-mail lu ⇒ « C'est relié », le compte sort du bandeau`, JSON.stringify(s));
  await capture(pg, `c-relier-relie-${W}-${theme}`);
  await ferme(o);
  // La vérification en panne ⇒ « pas su », jamais « relié ».
  const p = await ouvrir(nav, { W, theme, tab: 'emails', panneDernier: true });
  await p.pg.waitForSelector('[data-boite-relier-compte="222"]', { timeout: 15000 }).catch(() => {});
  await p.pg.locator('[data-boite-relier-compte="222"]').first().click().catch(() => {});
  await p.pg.waitForSelector('[data-relier-verif="passu"]', { timeout: 8000 }).catch(() => {});
  const sp = await lireRelier(p.pg);
  dit(sp.verif === 'passu', 'C1', `${T} lecture de la preuve en panne ⇒ « pas su » (Réessayer), jamais « relié »`, JSON.stringify(sp));
  await ferme(p);
}

// ── C3 · COMPTES LIÉS ─────────────────────────────────────────────────────────
async function comptesLies(nav, { W, theme }) {
  const T = `[${W}px ${theme}]`;
  const o = await ouvrir(nav, { W, theme, tab: 'vintedaccounts' });
  const { pg } = o;
  await pg.waitForSelector('[data-compte-emails-relier="222"]', { timeout: 15000 }).catch(() => {});
  const t = await pg.evaluate(() => { const b = document.querySelector('[data-compte-emails-relier="222"]'); return b ? { txt: b.textContent, h: Math.round(b.getBoundingClientRect().height) } : null; });
  dit(t && /vendeuse_b/.test(t.txt) && t.h >= 44, 'C3', `${T} le geste NOMME le compte (≥ 44 px)`, JSON.stringify(t));
  await capture(pg, `c-comptes-${W}-${theme}`);
  await inspecte(o, 'C0', T, 'Comptes liés');
  await pg.locator('[data-compte-emails-relier="222"]').first().click().catch(() => {});
  await pg.waitForSelector('[data-relier-compte="222"]', { timeout: 10000 }).catch(() => {});
  const s = await lireRelier(pg);
  dit(s.compte === '222' && s.vis, 'C3', `${T} il ouvre E-mails sur le pas-à-pas DE CE compte`, JSON.stringify(s));
  await ferme(o);
}

// ── C4 · COLIS ────────────────────────────────────────────────────────────────
async function colis(nav, { W, theme }) {
  const T = `[${W}px ${theme}]`;
  const o = await ouvrir(nav, { W, theme, tab: 'cat_bord' });
  const { pg } = o;
  await pg.waitForSelector('[data-colis-a-relier-compte]', { timeout: 15000 }).catch(() => {});
  const c = await pg.evaluate(() => [...document.querySelectorAll('[data-colis-a-relier-compte]')].map((x) => ({ uid: x.getAttribute('data-colis-a-relier-compte'), n: x.getAttribute('data-n'), h: Math.round((x.querySelector('[data-colis-relier]') || { getBoundingClientRect: () => ({ height: 0 }) }).getBoundingClientRect().height) })));
  dit(c.length === 1 && c[0].uid === '222' && c[0].n === '1' && c[0].h >= 44, 'C4', `${T} Colis : la ligne du compte qui a 1 colis à envoyer sans ses e-mails, avec LE geste`, JSON.stringify(c));
  await pg.locator('[data-colis-a-relier]').first().scrollIntoViewIfNeeded().catch(() => {});
  await capture(pg, `c-colis-${W}-${theme}`);
  await inspecte(o, 'C0', T, 'Colis');
  await pg.locator('[data-colis-relier="222"]').first().click().catch(() => {});
  await pg.waitForSelector('[data-relier-compte="222"]', { timeout: 10000 }).catch(() => {});
  dit((await lireRelier(pg)).compte === '222', 'C4', `${T} le geste ouvre son pas-à-pas`);
  await ferme(o);
}

// ── C5 · MA JOURNÉE ───────────────────────────────────────────────────────────
async function journee(nav, { W, theme }) {
  const T = `[${W}px ${theme}]`;
  const o = await ouvrir(nav, { W, theme, tab: 'journee' });
  const { pg } = o;
  await pg.waitForSelector('[data-journee-a-relier]', { timeout: 15000 }).catch(() => {});
  const j = await pg.evaluate(() => ({ cartes: [...document.querySelectorAll('[data-journee-a-relier]')].map((x) => x.getAttribute('data-journee-a-relier')), gestes: (document.querySelector('[data-fu-gestes]') || { getAttribute: () => null }).getAttribute('data-fu-gestes'), autres: document.querySelectorAll('.vrm-day-task-list > .vrm-day-task, .vrm-day-task-list [data-alertes-argent] > .vrm-day-task').length }));
  dit(j.cartes.length === 1 && j.cartes[0] === '222' && Number(j.gestes) === j.autres, 'C5', `${T} Ma journée : UNE carte, comptée dans « N gestes »`, JSON.stringify(j));
  await pg.locator('[data-journee-a-relier]').first().scrollIntoViewIfNeeded().catch(() => {});
  await capture(pg, `c-journee-${W}-${theme}`);
  await inspecte(o, 'C0', T, 'Ma journée');
  await pg.locator('[data-journee-a-relier]').first().click().catch(() => {});
  await pg.waitForSelector('[data-relier-compte="222"]', { timeout: 10000 }).catch(() => {});
  dit((await lireRelier(pg)).compte === '222', 'C5', `${T} touchée ⇒ le pas-à-pas du compte`);
  await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('[data-fu-gestes], [data-tout-a-jour]', { timeout: 15000 }).catch(() => {});
  await attendre(1500);
  dit(!(await pg.$('[data-journee-a-relier]')), 'C5', `${T} au retour, la carte n'est plus là (dite une fois par jour)`);
  await ferme(o);
}

(async () => {
  await new Promise((ok) => NV.srv.listen(PORT, ok));
  const nav = await chromium.launch({ executablePath: process.env.BANC_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  try {
    for (const theme of THEMES) for (const W of LARGEURS) {
      for (const [nom, f] of [['E-mails', emails], ['Comptes liés', comptesLies], ['Colis', colis], ['Ma journée', journee]].filter(([n]) => !process.env.SEUL || process.env.SEUL.split(',').includes(n))) {
        await f(nav, { W, theme }).catch((e) => dit(false, 'C0', `[${W} ${theme}] ${nom} au bout`, String(e && e.message).slice(0, 300)));
      }
    }
  } catch (e) { dit(false, 'C0', 'le banc a pu aller au bout', String(e && e.stack).slice(0, 400)); }
  await nav.close(); NV.srv.close();
  console.log('\n── Rouges par mesure');
  for (const [k, v] of Object.entries(compte).sort()) console.log(`   ${k} : ${v.ko} rouge(s), ${v.ok} vert(s)`);
  console.log(ko ? `\n❌ onglets-c : ${ko} défaut(s)` : '\n✅ onglets-c : rien à signaler');
  process.exit(ko ? 1 : 0);
})();
