// ════════════════════════════════════════════════════════════════════════════
//  BANC « VAGUE 2 — COMPTES ET E-MAILS » (6 nov. ; points 5 et 6 de
//  docs/passation/2026-11-05-ameliorations-vague-2.md ; récit :
//  docs/passation/2026-11-06-vague2-comptes.md).
//  Données INVENTÉES (le dépôt est public) : le jeu du banc `nouveau-vendeur`
//  (deux comptes Vinted) + des ventes, des e-mails et des lignes de réception
//  inventés, servis par SON harnais (aucune écriture ne sort du banc).
//  À 390 px tactile et 1512 px, clair et sombre. Il MESURE (data-*, nombres,
//  styles calculés — jamais un libellé exact) :
//   W1 COMPTES LIÉS — chaque carte Vinted porte sa ligne « E-mails » : le compte
//      qui reçoit (`recoit`), le compte MUET prouvé (`muet`, N jours lus de la
//      preuve, en ambre, le geste « Relier sa boîte » à 44 px) ; le geste ouvre
//      E-mails sur « Relier ma boîte » ;
//   W2 ADRESSE SANS COMPTE — en tête de « Relier ma boîte » : les adresses où
//      arrivent ses e-mails sans compte Vinted (leur nombre d'e-mails), jamais
//      l'adresse reliée ; « Relier un compte » ne propose QUE les comptes sans
//      adresse et n'écrit `vinted_account_emails` qu'après SA confirmation ;
//      « C'est un compte acheteur » la retire (réversible) ; lecture ratée ⇒
//      « pas su » (jamais « aucune ») ;
//   W3 VENTES — une vente à l'état « Envoi au centre de vérification » porte
//      l'étape « Au centre de vérification » entre Postée et Livrée (en cours),
//      lisible (rien de coupé), dans la ligne ET le récapitulatif ; les autres
//      ventes gardent leurs quatre étapes.
//  Réglages : `BANC_PORT` (9500–9549, 9520 par défaut), `LARGEURS=390,1512`,
//  `THEMES=clair,sombre`, `SHOTS=<dossier>` (captures à REGARDER), `BANC_DIST`
//  (un autre dist/, pour juger la base). Un banc ne meurt pas : il rapporte.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
process.env.BANC_PORT = process.env.BANC_PORT || '9520';
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
const ADR_A = 'vendeuse.a@exemple.test', ADR_SANS = 'boutique.seconde@exemple.test', ADR_ACH = 'achats.perso@exemple.test';
const TX_VERIF = 62009;
const jeu = () => {
  const l = JSON.parse(JSON.stringify(NV.JEU_LIGNES));
  const main = l.find((x) => x.id === 'main');
  main.data.vinted_account_emails = { 111: ADR_A };
  // Le compte 222 a vendu trois fois depuis le début de la réception, sans AUCUN e-mail.
  const v2 = l.find((x) => x.id === 'harvest_222_orders_sold');
  const vente = (tx, titre, j, st = 'Commande finalisée', tus = 'completed') => ({ transaction_id: tx, title: titre, price: { amount: '70', currency_code: 'EUR' }, status: st, transaction_user_status: tus, date: iso(j), photo: null });
  v2.data.payload.my_orders.push(vente(62011, 'Asics Gel-1130 argent taille 42', 12), vente(62012, 'Salomon XT-6 grise taille 43', 10));
  // Une vente « avec Vérification de l'article » sur le compte 111 (l'état MESURÉ chez lui).
  l.find((x) => x.id === 'harvest_111_orders_sold').data.payload.my_orders.push(vente(TX_VERIF, 'Nike Air Max 1 beige taille 44', 1, 'Envoi au centre de vérification', 'waiting'));
  // Le début de la réception (un e-mail du compte 111 il y a 40 jours).
  l.push({ id: 'email_track_chronopost_XA000000001FR', data: { carrier: 'chronopost', status: 'delivered', suivi: 'XA000000001FR', subject: 'Votre colis a été livré', account: 'vendeuse_a', receivedAt: iso(40) } });
  // Son registre de réception et SES lignes de réception (adresses inventées).
  l.push({ id: 'vrm_email_owners', data: { adresses: { [ADR_A]: { owner: 'x' }, [ADR_SANS]: { owner: 'x' }, [ADR_ACH]: { owner: 'x' } } } });
  const rec = (i, adr, j) => ({ id: `email_reception_${(0xa000000000000000n + BigInt(i)).toString(16)}`, data: { at: iso(j), adresses: [adr], etat: 'integre', type: 'information', subject: 'E-mail ' + i } });
  [[1, ADR_A, 1], [2, ADR_A, 2], [3, ADR_A, 3], [4, ADR_SANS, 1], [5, ADR_SANS, 2], [6, ADR_SANS, 4], [7, ADR_SANS, 6], [8, ADR_ACH, 2], [9, ADR_ACH, 5]].forEach(([i, a, j]) => l.push(rec(i, a, j)));
  return l;
};

const ferme = async (o) => { try { await o.ctx.close(); } catch (_) {} };
const vis = `const vis = (e) => { if (!e || !e.getClientRects().length) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };`;

// ── W1 · COMPTES LIÉS ─────────────────────────────────────────────────────────
async function comptesLies(nav, { W, theme }) {
  const T = `[${W}px ${theme}]`;
  const base = { lignes: jeu(), comptes: NV.JEU_COMPTES, ecritures: 0 };
  const o = await NV.ouvrir(nav, { W, sombre: theme === 'sombre', base, tab: 'vintedaccounts' });
  const { pg } = o;
  await pg.waitForFunction(() => { const l = [...document.querySelectorAll('[data-compte-emails]')]; return l.length >= 2 && l.every((x) => x.getAttribute('data-compte-emails') !== 'encours'); }, null, { timeout: 15000 }).catch(() => {});
  await attendre(500);
  const r = await pg.evaluate(new Function(`${vis}
    const carte = (uid) => document.querySelector('[data-compte-lie="vinted"][data-compte-id="' + uid + '"]');
    const ligne = (uid) => { const c = carte(uid); const l = c && c.querySelector('[data-compte-emails]'); if (!l) return null;
      const t = l.querySelector('.vrm-cl-emails-txt'); const b = l.querySelector('[data-compte-emails-relier]');
      const rb = b && b.getBoundingClientRect(); const rc = c.getBoundingClientRect(); const rl = l.getBoundingClientRect();
      return { etat: l.getAttribute('data-compte-emails'), jours: l.getAttribute('data-compte-emails-jours'), vis: vis(l), couleur: t ? getComputedStyle(t).color : '', ambre: getComputedStyle(document.documentElement).getPropertyValue('--fu-ambre-txt').trim(),
        geste: b ? { vis: vis(b), h: Math.round(rb.height) } : null, dedans: rl.right <= rc.right + 1 && rl.left >= rc.left - 1 };
    };
    return { a: ligne('111'), b: ligne('222'), debord: document.documentElement.scrollWidth > window.innerWidth + 1 };`));
  dit(r.a && r.a.vis && r.a.etat === 'recoit' && !r.a.geste, 'W1', `${T} le compte qui reçoit : « reçoit ses e-mails », sans geste`, JSON.stringify(r.a));
  dit(r.b && r.b.vis && r.b.etat === 'muet' && r.b.jours === '12', 'W1', `${T} le compte muet : « aucun e-mail depuis 12 j » (sa 1re vente sans e-mail)`, JSON.stringify(r.b));
  dit(r.b && r.b.geste && r.b.geste.vis && (W >= 600 || r.b.geste.h >= 44), 'W1', `${T} le geste « Relier sa boîte » est là${W < 600 ? ', 44 px au doigt' : ''}`, JSON.stringify(r.b && r.b.geste));
  const rgb = (c) => (c.match(/\d+(\.\d+)?/g) || []).slice(0, 3).map((x) => Math.round(Number(x))).join(',');
  const hex = (h) => { const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(h || ''); return m ? [m[1], m[2], m[3]].map((x) => parseInt(x, 16)).join(',') : rgb(h || ''); };
  dit(r.b && rgb(r.b.couleur) === hex(r.b.ambre) && r.a && rgb(r.a.couleur) !== hex(r.a.ambre), 'W1', `${T} l'ambre seulement pour le compte muet (un geste à faire)`, JSON.stringify({ muet: r.b && r.b.couleur, recoit: r.a && r.a.couleur, ambre: r.b && r.b.ambre }));
  dit(r.a && r.a.dedans && r.b && r.b.dedans && !r.debord, 'W1', `${T} la ligne tient dans sa carte, rien ne déborde`, JSON.stringify({ a: r.a && r.a.dedans, b: r.b && r.b.dedans, debord: r.debord }));
  await pg.locator('[data-compte-lie="vinted"][data-compte-id="222"] [data-compte-emails]').first().scrollIntoViewIfNeeded().catch(() => {});
  await capture(pg, `v2-comptes-${W}-${theme}`);
  await pg.locator('[data-compte-emails-relier]').first().click().catch(() => {});
  await pg.waitForSelector('[data-boite-vue="relier"][aria-selected="true"]', { timeout: 8000 }).catch(() => {});
  const vu = await pg.evaluate(() => ({ relier: !!document.querySelector('[data-boite-vue="relier"][aria-selected="true"]'), boite: !!document.querySelector('[data-boite-emails]') }));
  dit(vu.boite && vu.relier, 'W1', `${T} « Relier sa boîte » ouvre E-mails sur « Relier ma boîte »`, JSON.stringify(vu));
  dit(!o.journal.erreurs.length, 'W0', `${T} aucune erreur JS (Comptes liés)`, o.journal.erreurs.join(' ¦ '));
  await ferme(o);
}

// ── W2 · ADRESSE SANS COMPTE ──────────────────────────────────────────────────
const lireSansCompte = (pg) => pg.evaluate(new Function(`${vis}
  const bloc = document.querySelector('[data-adresses-sans-compte]');
  const lignes = [...document.querySelectorAll('[data-adresse-sans-compte]')].map((l) => ({ a: l.getAttribute('data-adresse-sans-compte'), n: l.getAttribute('data-adresse-sans-compte-n'), vis: vis(l),
    gestes: [...l.querySelectorAll('[data-relier-compte], [data-compte-acheteur]')].map((b) => ({ vis: vis(b), h: Math.round(b.getBoundingClientRect().height) })) }));
  return { bloc: bloc ? bloc.getAttribute('data-adresses-sans-compte') : null, lignes, acheteurs: (document.querySelector('[data-adresses-acheteur]') || { getAttribute: () => null }).getAttribute('data-adresses-acheteur'),
    enTete: (() => { const r = document.querySelector('[data-boite-reglages]'); return !!(r && bloc && r.firstElementChild === bloc); })(), debord: document.documentElement.scrollWidth > window.innerWidth + 1 };`));
const confirmer = async (pg, mot) => {
  const b = pg.getByRole('button', { name: mot, exact: true }).last();
  await b.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  await b.click().catch(() => {});
};
async function adresses(nav, { W, theme, panne = false }) {
  const T = `[${W}px ${theme}${panne ? ' panne' : ''}]`;
  const base = { lignes: jeu(), comptes: NV.JEU_COMPTES, ecritures: 0 };
  const o = await NV.ouvrir(nav, { W, sombre: theme === 'sombre', base, tab: 'emails' });
  const { pg } = o;
  if (panne) await pg.route(/\/rest\/v1\/app_data\?.*email_reception/, (r) => r.fulfill({ status: 503, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"message":"indisponible"}' }));
  await pg.locator('[data-boite-vue="relier"]').first().click().catch(() => {});
  await pg.waitForSelector('[data-adresses-sans-compte]', { timeout: 15000 }).catch(() => {});
  await attendre(600);
  let s = await lireSansCompte(pg);
  if (panne) {
    dit(s.bloc === 'pas-su' && !s.lignes.length, 'W2', `${T} une lecture ratée ⇒ « pas su » (EtatPanne), jamais « aucune »`, JSON.stringify(s));
    await capture(pg, `v2-sans-compte-panne-${W}-${theme}`);
    await ferme(o); return;
  }
  const parA = Object.fromEntries(s.lignes.map((l) => [l.a, l]));
  dit(s.bloc === '2' && parA[ADR_SANS] && parA[ADR_SANS].n === '4' && parA[ADR_ACH] && parA[ADR_ACH].n === '2' && !parA[ADR_A], 'W2', `${T} deux adresses sans compte (4 et 2 e-mails) ; l'adresse reliée n'y est pas`, JSON.stringify(s.lignes));
  dit(s.enTete, 'W2', `${T} posé en tête de « Relier ma boîte »`, JSON.stringify({ enTete: s.enTete }));
  dit(s.lignes.every((l) => l.gestes.length === 2 && l.gestes.every((g) => g.vis && (W >= 600 || g.h >= 44))), 'W2', `${T} deux gestes par adresse${W < 600 ? ', 44 px au doigt' : ''}`, JSON.stringify(s.lignes.map((l) => l.gestes)));
  dit(!s.debord, 'W2', `${T} rien ne déborde à l'horizontale`);
  await pg.locator('[data-adresses-sans-compte]').first().scrollIntoViewIfNeeded().catch(() => {});
  await capture(pg, `v2-sans-compte-${W}-${theme}`);
  // « Relier un compte » : seuls les comptes SANS adresse ; rien n'est écrit avant SA confirmation.
  await pg.locator(`[data-relier-compte="${ADR_SANS}"]`).first().click().catch(() => {});
  await attendre(300);
  const choix = await pg.evaluate(() => [...document.querySelectorAll('[data-relier-choix]')].map((b) => b.getAttribute('data-relier-choix')));
  dit(choix.join(',') === '222', 'W2', `${T} « Relier un compte » ne propose que le compte sans adresse (jamais deviné)`, JSON.stringify(choix));
  await capture(pg, `v2-sans-compte-choix-${W}-${theme}`);
  const mainAvant = JSON.stringify(((base.lignes.find((x) => x.id === 'main') || {}).data || {}).vinted_account_emails || {});
  await pg.locator('[data-relier-choix="222"]').first().click().catch(() => {});
  await attendre(400);
  const pendant = JSON.stringify(((base.lignes.find((x) => x.id === 'main') || {}).data || {}).vinted_account_emails || {});
  dit(pendant === mainAvant, 'W2', `${T} rien n'est écrit tant qu'il n'a pas confirmé`, pendant);
  await capture(pg, `v2-sans-compte-confirmer-${W}-${theme}`);
  await confirmer(pg, 'Relier');
  let ecrit = null;
  for (let i = 0; i < 30 && !ecrit; i++) { await attendre(500); const m = ((base.lignes.find((x) => x.id === 'main') || {}).data || {}).vinted_account_emails || {}; if (m['222']) ecrit = m; }
  dit(ecrit && ecrit['222'] === ADR_SANS && ecrit['111'] === ADR_A, 'W2', `${T} confirmé ⇒ le registre \`vinted_account_emails\` relie l'adresse au compte 222 (le 111 intact)`, JSON.stringify(ecrit));
  s = await lireSansCompte(pg);
  dit(!s.lignes.some((l) => l.a === ADR_SANS), 'W2', `${T} l'adresse reliée sort de la liste`, JSON.stringify(s.lignes));
  // « C'est un compte acheteur » : retirée de la liste, notée, réversible.
  await pg.locator(`[data-compte-acheteur="${ADR_ACH}"]`).first().click().catch(() => {});
  await confirmer(pg, 'Oui, acheteur');
  await attendre(600);
  s = await lireSansCompte(pg);
  dit(!s.lignes.length && s.acheteurs === '1', 'W2', `${T} « compte acheteur » : l'adresse ne se signale plus, la marque est listée (« Annuler »)`, JSON.stringify(s));
  let marque = null;
  for (let i = 0; i < 30 && !marque; i++) { await attendre(500); const m = ((base.lignes.find((x) => x.id === 'main') || {}).data || {}).vrm_adresses_acheteur || null; if (m && m[ADR_ACH]) marque = m; }
  dit(!!marque, 'W2', `${T} la marque est synchronisée (ligne \`main\`, \`vrm_adresses_acheteur\`)`, JSON.stringify(marque));
  await capture(pg, `v2-sans-compte-apres-${W}-${theme}`);
  dit(!o.journal.erreurs.length, 'W0', `${T} aucune erreur JS (E-mails)`, o.journal.erreurs.join(' ¦ '));
  await ferme(o);
}

// ── W3 · VENTES : l'étape « Au centre de vérification » ───────────────────────
async function ventes(nav, { W, theme }) {
  const T = `[${W}px ${theme}]`;
  const o = await NV.ouvrir(nav, { W, sombre: theme === 'sombre', base: { lignes: jeu(), comptes: NV.JEU_COMPTES, ecritures: 0 }, tab: 'cat_ventes' });
  const { pg } = o;
  await pg.waitForSelector(`[data-fu-frise="${TX_VERIF}"]`, { timeout: 15000 }).catch(() => {});
  await attendre(500);
  const lire = (sel) => pg.evaluate(({ sel }) => {
    const f = document.querySelector(sel); if (!f) return null;
    return [...f.querySelectorAll('[data-fu-etape]')].map((s) => { const sp = s.querySelector(':scope > span'); return { cle: s.getAttribute('data-fu-etape'), fait: s.getAttribute('data-fait'), cours: s.hasAttribute('data-cours'), lu: s.innerText.replace(/\s+/g, ' ').trim(), coupe: sp ? sp.scrollWidth > sp.clientWidth + 1 : null }; });
  }, { sel });
  const f = await lire(`[data-fu-frise="${TX_VERIF}"]`);
  dit(f && f.map((e) => e.cle).join(',') === 'vendue,postee,centre,livree,payee', 'W3', `${T} la vente « Envoi au centre de vérification » : Vendue · Postée · Au centre de vérification · Livrée · Payée`, JSON.stringify(f));
  const c = f && f.find((e) => e.cle === 'centre');
  dit(c && c.cours && c.fait === '0' && (f.find((e) => e.cle === 'postee') || {}).fait === '1', 'W3', `${T} postée ⇒ l'étape est EN COURS, jamais cochée sans preuve`, JSON.stringify(c));
  dit(f && f.every((e) => e.coupe === false), 'W3', `${T} aucun libellé de la frise n'est coupé (cinq segments)`, JSON.stringify(f && f.map((e) => [e.cle, e.coupe])));
  const autre = await lire('[data-fu-frise="62001"]');
  dit(autre && autre.length === 4 && !autre.some((e) => e.cle === 'centre'), 'W3', `${T} une vente ordinaire garde ses quatre étapes`, JSON.stringify(autre));
  await pg.locator(`[data-fu-frise="${TX_VERIF}"]`).first().scrollIntoViewIfNeeded().catch(() => {});
  await capture(pg, `v2-ventes-ligne-${W}-${theme}`);
  // Le récapitulatif (tiroir de la vente).
  const t = pg.locator(`.vrm-sale-row[data-tx="${TX_VERIF}"] .vrm-ledger-sale-toggle`).first();
  await t.scrollIntoViewIfNeeded().catch(() => {});
  if ((await t.getAttribute('aria-expanded').catch(() => null)) !== 'true') await t.click().catch(() => {});
  const id = await t.getAttribute('aria-controls').catch(() => null);
  if (id) await pg.locator(`[id="${id}"]`).waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
  await attendre(600);
  const rec = id ? await lire(`[id="${id}"] [data-recap-frise] [data-fu-frise]`) : null;
  dit(rec && rec.map((e) => e.cle).join(',') === 'vendue,postee,centre,livree,payee', 'W3', `${T} le récapitulatif porte la même étape`, JSON.stringify(rec));
  const phrase = id ? await pg.evaluate((id) => { const d = document.getElementById(id); return d ? d.innerText : ''; }, id) : '';
  dit(/centre de vérification/i.test(phrase), 'W3', `${T} la phrase d'état le dit`, phrase.slice(0, 200));
  await capture(pg, `v2-ventes-recap-${W}-${theme}`);
  dit(!o.journal.erreurs.length, 'W0', `${T} aucune erreur JS (Ventes)`, o.journal.erreurs.join(' ¦ '));
  await ferme(o);
}

(async () => {
  await new Promise((ok) => NV.srv.listen(PORT, ok));
  const nav = await chromium.launch({ executablePath: process.env.BANC_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  try {
    for (const theme of THEMES) for (const W of LARGEURS) {
      await comptesLies(nav, { W, theme }).catch((e) => dit(false, 'W0', `[${W} ${theme}] Comptes liés au bout`, String(e && e.message).slice(0, 300)));
      await adresses(nav, { W, theme }).catch((e) => dit(false, 'W0', `[${W} ${theme}] E-mails au bout`, String(e && e.message).slice(0, 300)));
      if (theme === THEMES[0]) await adresses(nav, { W, theme, panne: true }).catch((e) => dit(false, 'W0', `[${W} ${theme}] E-mails en panne au bout`, String(e && e.message).slice(0, 300)));
      await ventes(nav, { W, theme }).catch((e) => dit(false, 'W0', `[${W} ${theme}] Ventes au bout`, String(e && e.message).slice(0, 300)));
    }
  } catch (e) { dit(false, 'W0', 'le banc a pu aller au bout', String(e && e.stack).slice(0, 400)); }
  await nav.close(); NV.srv.close();
  console.log('\n── Rouges par mesure');
  for (const [k, v] of Object.entries(compte).sort()) console.log(`   ${k} : ${v.ko} rouge(s), ${v.ok} vert(s)`);
  console.log(ko ? `\n❌ vague2-comptes : ${ko} défaut(s)` : '\n✅ vague2-comptes : rien à signaler');
  process.exit(ko ? 1 : 0);
})();
