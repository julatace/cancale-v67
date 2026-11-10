// ════════════════════════════════════════════════════════════════════════════
//  Banc de rendu — LE parcours « Ton adresse VRM » (8 nov. ; refait le 10 nov. au soir,
//  lot `adresse-vrm-simple`). Récit : docs/passation/2026-11-10-adresse-vrm-simple.md.
//  Données INVENTÉES (dépôt public), dans la vraie forme de
//  `/api/email-rattacher?mode=adresse-unique` (GET : { pret, adresse, actif, dernier,
//  essai, code } — api/email-rattacher.js) ; le jeu de comptes du banc `nouveau-vendeur`.
//  À 390 px tactile et 1512 px, clair et sombre. Il MESURE (data-*, jamais un libellé) :
//   A  E-mails → Relier ma boîte, sans compte choisi : UN parcours en tête, barre
//      1·2·3·✓ ; l'adresse de la route, entière, en monospace ; « Copier » ; étape 2 :
//      la messagerie DÉTECTÉE par le domaine de ses boîtes (Gmail) en une tuile,
//      3 pas, « Ouvrir Gmail » vers la page du transfert ; le code de Gmail
//      ARRIVE (la route le rend, forme de api/_lib/adresse-reception.js) ⇒ affiché
//      seul, « Copier le code », « Confirmer dans Gmail » (nouvel onglet, SON clic,
//      aucune requête vers Google) ; « Autre messagerie » ; la REPRISE (rechargée,
//      la page revient à l'étape 3) ; l'essai : en attente CALME (aucune roue après
//      6 s) → l'essai arrive ⇒ ✓ « Reçu » ; rien ne déborde, 44 px, ni rouge ni violet.
//   B  Un compte à relier (relais « Masquer mon adresse » d'Apple) : « Relier la
//      boîte de … » ⇒ LE même parcours sur ce compte, étape 2, « Choisis où Apple fait
//      suivre » + la liste des boîtes déjà reliées, la vérification du compte CALME.
//   C  Paramètres → Mes e-mails → Mon adresse VRM : la MÊME pièce, dans une feuille.
//   D  Pas encore ouverte / pas su : sa phrase, aucune adresse inventée.
//  `BANC_PORT` (défaut 10655), `CAPTURE_DIR` (captures à REGARDER). Un banc ne meurt pas.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
process.env.BANC_PORT = process.env.BANC_PORT || '10655';
require('./_porte-banc.cjs');
const path = require('path'), fs = require('fs'), os = require('os');
const NV = require('./nouveau-vendeur.cjs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const PORT = NV.PORT;
const CAPT = process.env.CAPTURE_DIR || path.join(os.tmpdir(), 'banc-adresse-reception');
fs.mkdirSync(CAPT, { recursive: true });
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (!c && d ? ' — ' + String(d).slice(0, 400) : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'a levé : ' + String(e && e.message || e).slice(0, 300)); } };
const capture = (pg, nom) => pg.screenshot({ path: path.join(CAPT, nom + '.png'), animations: 'disabled' }).catch(() => {});

// ── LE JEU INVENTÉ ──────────────────────────────────────────────────────────
const now = Date.now(), iso = (j) => new Date(now - j * 86400000).toISOString();
const A1 = 'k7p2m9x4q8w3e6r5t2y7u9a3@recu-banc.test';
const ADR_A = 'vendeuse.banc@gmail.com', ADR_B = 'k7x2q9w4@privaterelay.appleid.com';
const jeu = (avecMuet) => {
  const l = JSON.parse(JSON.stringify(NV.JEU_LIGNES));
  l.find((x) => x.id === 'main').data.vinted_account_emails = { 111: ADR_A, 222: ADR_B };
  if (avecMuet) {
    const v2 = l.find((x) => x.id === 'harvest_222_orders_sold');
    const vente = (tx, titre, j) => ({ transaction_id: tx, title: titre, price: { amount: '70', currency_code: 'EUR' }, status: 'Commande finalisée', transaction_user_status: 'completed', date: iso(j), photo: null });
    v2.data.payload.my_orders.push(vente(62011, 'Asics Gel-1130 argent taille 42', 12));
  }
  l.push({ id: 'email_track_chronopost_XA000000001FR', data: { carrier: 'chronopost', status: 'delivered', suivi: 'XA000000001FR', subject: 'Votre colis a été livré', account: 'vendeuse_a', receivedAt: iso(40) } });
  return l;
};
// L'e-mail de Google, tel que api/_lib/adresse-reception.js le range (`lireCodeTransfert`) :
// « (#482913765) Confirmation de transfert Gmail - Recevoir des e-mails de sophie.banc@gmail.com ».
const CODE_GMAIL = { fournisseur: 'gmail', code: '482913765', lien: 'https://mail-settings.google.com/mail/vf-%5BANGjdJ_banc%5D-banc', source: 'sophie.banc@gmail.com', signe: true };

async function ouvrir(nav, { W, theme, tab = 'emails', etat = 'pret', muet = false, reprendre = null }) {
  const base = { lignes: jeu(muet), comptes: NV.JEU_COMPTES, ecritures: 0 };
  const o = await NV.ouvrir(nav, { W, sombre: theme === 'sombre', base, tab });
  o.base = base; o.appels = []; o.google = [];
  const srv = { adresse: A1, actif: true, dernier: null, essai: null, code: null };
  o.srv = srv;
  o.pg.on('request', (r) => { if (/google\.com/.test(r.url())) o.google.push(r.url()); });
  await o.pg.context().grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  // La preuve d'un compte : le dernier e-mail AU NOM d'un compte (`meta->>account`), servie dans sa forme.
  await o.pg.route(/\/rest\/v1\/app_data\?.*meta(->>|-%3E%3E)account=eq\./, (route) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' }));
  await o.pg.route('**/api/email-rattacher**', (route) => {
    const q = new URL(route.request().url()).searchParams;
    if (q.get('mode') === 'adresse-unique') {
      const m = route.request().method(); let corps = null; try { corps = JSON.parse(route.request().postData() || 'null'); } catch (_) {}
      o.appels.push({ m, corps, auth: route.request().headers().authorization || '' });
      if (etat === 'panne') return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'base-injoignable' }) });
      if (etat === 'pas-prete') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, pret: false, manque: 'domaine', message: '…' }) });
      if (m === 'POST' && corps && corps.geste === 'actif') srv.actif = corps.actif;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, pret: true, ...srv, creeLe: iso(1), remplaceLe: null }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, page: 0, parPage: 20, suite: false, emails: [], compteurs: { sur: 0, parRubrique: {} }, adresses: [] }) });
  });
  if (reprendre) await o.pg.addInitScript((x) => { try { localStorage.setItem('vrm_parcours_adresse_vrm', JSON.stringify(x)); } catch (_) {} }, reprendre);
  // Un `mailto:` ne quitte jamais la page du banc (le clic de l'app, lui, part).
  await o.pg.addInitScript(() => { document.addEventListener('click', (e) => { const a = e.target && e.target.closest && e.target.closest('a[href^="mailto:"]'); if (a) e.preventDefault(); }, true); });
  await o.pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  await o.pg.waitForSelector('.vrm-main', { timeout: 20000 }).catch(() => {});
  return o;
}
const ferme = async (o) => { try { await o.ctx.close(); } catch (_) {} };
const etape = (pg) => pg.evaluate(() => { const p = document.querySelector('[data-parcours-adresse]'); return p ? p.getAttribute('data-etape') : null; });

// 44 px, rien qui déborde de l'ÉCRAN, ni rouge ni violet, dans le parcours.
const regles = async (pg, nom, tel) => {
  const r = await pg.evaluate((tel) => {
    const p = document.querySelector('[data-parcours-adresse]'); if (!p) return null;
    const vis = (x) => { const q = x.getBoundingClientRect(); return q.width > 0 && q.height > 0 && getComputedStyle(x).visibility !== 'hidden'; };
    const petites = [...p.querySelectorAll('button, a[href], select, summary, [role="switch"]')].filter((x) => vis(x) && !x.closest('details:not([open]) > :not(summary)')).filter((x) => { const q = x.getBoundingClientRect(); return q.height < 43.5 || q.width < 43.5; }).map((x) => (x.innerText || x.getAttribute('aria-label') || x.className).trim().slice(0, 30) + ' ' + Math.round(x.getBoundingClientRect().width) + '×' + Math.round(x.getBoundingClientRect().height));
    const sortis = [...p.querySelectorAll('*')].filter((x) => { const q = x.getBoundingClientRect(); return vis(x) && (q.right > innerWidth + 1 || q.left < -1); }).map((x) => x.className || x.tagName).slice(0, 3);
    const rgb = [...p.querySelectorAll('*')].flatMap((x) => [getComputedStyle(x).color, getComputedStyle(x).backgroundColor]).map((c) => (/rgba?\((\d+), (\d+), (\d+)/.exec(c) || []).slice(1).map(Number)).filter((a) => a.length === 3);
    return { petites, sortis, page: document.documentElement.scrollWidth > innerWidth + 1, violet: rgb.filter(([r, g, b]) => b > 150 && r > 110 && g < 90).length, rouge: rgb.filter(([r, g, b]) => r > 190 && g < 70 && b < 70).length };
  }, tel);
  if (!r) { dit(false, `${nom} : le parcours n'est pas là`); return; }
  dit(!r.petites.length, `${nom} : chaque cible fait au moins 44 px`, r.petites.join(' · '));
  dit(!r.sortis.length && !r.page, `${nom} : rien ne déborde de l'écran`, JSON.stringify(r));
  dit(!r.violet && !r.rouge, `${nom} : ni violet ni rouge`, JSON.stringify(r));
};

async function scenarioA(nav, W, theme) {
  const T = `[A ${W} ${theme}]`, tag = `${W}-${theme}`, tel = W < 600;
  const o = await ouvrir(nav, { W, theme });
  const { pg } = o;
  await pg.locator('[data-boite-vue="relier"]').first().click();
  await pg.waitForSelector('[data-parcours-adresse][data-etape]', { timeout: 15000 });
  await attendre(400);
  const t = await pg.evaluate(() => {
    const r = document.querySelector('[data-boite-relier]');
    const p = document.querySelectorAll('[data-parcours-adresse]');
    const a = document.querySelector('[data-adresse-reception]');
    return { n: p.length, enTete: !!(r && p[0] && r.querySelector('[data-parcours-adresse]') && r.firstElementChild && r.firstElementChild.contains(p[0])), barre: document.querySelectorAll('[data-pas-barre]').length,
      adr: a && a.dataset.adresseReception, txt: a && a.innerText.replace(/\s+/g, ''), mono: a && /mono|Menlo/i.test(getComputedStyle(a).fontFamily), coupe: a && (a.scrollWidth > a.clientWidth + 1 || /…/.test(a.innerText)),
      guide: !!document.querySelector('[data-boite-guide]'), feuille: !!document.querySelector('[data-feuille-adresse-reception]') };
  });
  dit(t.n === 1 && t.enTete && t.barre === 4 && !t.guide && !t.feuille, `${T} UN parcours, en tête de Relier ma boîte, barre 1·2·3·✓, sans second pas-à-pas ni feuille`, JSON.stringify(t));
  dit(t.adr === A1 && t.txt === A1 && t.mono && !t.coupe && await etape(pg) === '1', `${T} étape 1 : l'adresse de la route, entière, en monospace`, JSON.stringify(t));
  dit(o.appels.length >= 1 && o.appels[0].m === 'GET' && /^Bearer /.test(o.appels[0].auth), `${T} lue par SA session`, JSON.stringify(o.appels[0]));
  if (!tel) {
    await pg.locator('[data-copier-adresse]').click();
    dit(await pg.evaluate(() => navigator.clipboard.readText().catch(() => '')) === A1, `${T} « Copier l'adresse » la met dans le presse-papiers`);
  }
  await regles(pg, T + ' étape 1', tel);
  await capture(pg, `a1-adresse-${tag}`);
  // Étape 2 : la messagerie détectée, 3 pas, le code en attente (calme).
  await pg.locator('[data-suivant="2"]').click();
  await pg.waitForSelector('[data-bloc="transfert"]');
  const s2 = await pg.evaluate(() => ({ tuile: (document.querySelector('[data-messagerie-tuile]') || {}).dataset?.messagerieTuile, pas: document.querySelectorAll('[data-etapes="gmail"] [data-pas]').length,
    ouvrir: (document.querySelector('[data-ouvrir-messagerie="gmail"]') || { getAttribute: () => '' }).getAttribute('href'), cible: (document.querySelector('[data-ouvrir-messagerie="gmail"]') || { getAttribute: () => '' }).getAttribute('target'),
    attente: !!document.querySelector('[data-code-etape="attente"]'), roue: document.querySelectorAll('[data-parcours-adresse] .vrm-pv-roue').length }));
  dit(s2.tuile === 'gmail' && s2.pas === 3, `${T} étape 2 : Gmail détecté (domaine de ses boîtes) en UNE tuile, 3 pas`, JSON.stringify(s2));
  dit(/^https:\/\/mail\.google\.com\/mail\/u\/0\/#settings\/fwdandpop$/.test(s2.ouvrir) && s2.cible === '_blank', `${T} « Ouvrir Gmail » mène droit à Transfert et POP/IMAP (nouvel onglet)`, JSON.stringify(s2));
  dit(s2.attente && s2.roue === 0, `${T} le code attendu : « arrive ici », aucune roue`, JSON.stringify(s2));
  await regles(pg, T + ' étape 2', tel);
  await capture(pg, `a2-transfert-${tag}`);
  // Le code de Gmail arrive : il s'affiche SEUL (relu toutes les 5 s), lien de Google sur SON clic.
  o.srv.code = { ...CODE_GMAIL, recuLe: new Date().toISOString() };
  await pg.waitForSelector('[data-code-valeur]', { timeout: 15000 }).catch(() => {});
  const c = await pg.evaluate(() => { const n = document.querySelector('[data-code-transfert="gmail"]'); const l = n && n.querySelector('[data-lien-confirmation]'); const v = n && n.querySelector('[data-code-valeur]');
    return n ? { v: v && v.dataset.codeValeur, taille: v && parseFloat(getComputedStyle(v).fontSize), href: l && l.getAttribute('href'), cible: l && l.getAttribute('target'), rel: l && l.getAttribute('rel'), src: n.innerText.includes('sophie.banc@gmail.com'), copier: !!n.querySelector('[data-copier-code]') } : null; });
  dit(c && c.v === '482913765' && c.taille >= 28 && c.copier && c.src, `${T} le code de Gmail ARRIVE et s'affiche seul, en grand, avec « Copier le code » et la boîte qui le demande`, JSON.stringify(c));
  dit(c && /^https:\/\/mail-settings\.google\.com\//.test(c.href) && c.cible === '_blank' && /noopener/.test(c.rel) && o.google.length === 0, `${T} « Confirmer dans Gmail » : le lien de l'e-mail, nouvel onglet, rien n'est suivi tout seul`, JSON.stringify({ c, google: o.google }));
  if (!tel) { await pg.locator('[data-copier-code]').click(); dit(await pg.evaluate(() => navigator.clipboard.readText().catch(() => '')) === '482913765', `${T} « Copier le code » copie les chiffres seuls`); }
  await pg.locator('[data-code-transfert]').scrollIntoViewIfNeeded();
  await capture(pg, `a2-code-${tag}`);
  // « Autre messagerie » : les autres, puis iCloud (3 pas), puis retour à Gmail.
  await pg.locator('[data-autre-messagerie]').click();
  const nAutres = await pg.locator('[data-choix-messagerie] [data-fournisseur]').count();
  await pg.locator('[data-fournisseur="icloud"]').click();
  const nIcloud = await pg.locator('[data-etapes="icloud"] [data-pas]').count();
  dit(nAutres >= 6 && nIcloud === 3, `${T} « Autre messagerie » : les autres au choix ; iCloud aussi en 3 pas`, `${nAutres} · ${nIcloud}`);
  await pg.locator('[data-autre-messagerie]').click(); await pg.locator('[data-fournisseur="gmail"]').click();
  // « C'est fait » ⇒ étape 3 ; rechargée ⇒ elle REPREND à l'étape 3.
  await pg.locator('[data-suivant="3"]').click();
  await pg.waitForSelector('[data-bloc="essai"]');
  await pg.reload({ waitUntil: 'domcontentloaded' });
  await pg.locator('[data-boite-vue="relier"]').first().click({ timeout: 15000 });
  await pg.waitForSelector('[data-parcours-adresse][data-etape]', { timeout: 15000 });
  dit(await etape(pg) === '3', `${T} reprise : rouverte, la page revient là où il s'est arrêté (étape 3)`, await etape(pg));
  // L'essai : en attente CALME, puis « Reçu ✓ » quand SON code arrive.
  await pg.locator('[data-essai]').click();
  await pg.waitForSelector('[data-essai-phrase]');
  await attendre(6500);
  const att = await pg.evaluate(() => ({ ton: (document.querySelector('[data-essai-phrase]') || {}).dataset?.ton, roue: document.querySelectorAll('[data-parcours-adresse] .vrm-pv-roue').length, verif: !!document.querySelector('[data-essai-verifier]') }));
  dit(att.ton === 'attente' && att.roue === 0 && att.verif, `${T} en attente de l'essai : état calme (horloge, « vérifié à », « Vérifier »), AUCUNE roue après 6 s`, JSON.stringify(att));
  await regles(pg, T + ' étape 3', tel);
  await capture(pg, `a3-essai-${tag}`);
  const code = await pg.locator('[data-essai-code]').getAttribute('data-essai-code');
  o.srv.essai = { code, at: new Date().toISOString() };
  o.srv.dernier = { at: new Date().toISOString(), sujet: 'Essai VRM ' + code, de: 'Moi <vendeuse.banc@gmail.com>' };
  await pg.waitForSelector('[data-parcours-adresse][data-etape="4"] [data-bloc="recu"]', { timeout: 15000 }).catch(() => {});
  const fin = await pg.evaluate(() => ({ e: (document.querySelector('[data-parcours-adresse]') || {}).dataset?.etape, recu: (document.querySelector('[data-essai-recu]') || {}).dataset?.essaiRecu, fait: document.querySelectorAll('[data-pas-barre][data-fait]').length }));
  dit(fin.e === '4' && fin.recu === code && fin.fait === 4, `${T} SON code d'essai arrive ⇒ ✓ « Reçu », la barre entièrement cochée`, JSON.stringify(fin));
  await regles(pg, T + ' ✓', tel);
  await capture(pg, `a4-recu-${tag}`);
  dit(!o.journal.erreurs.length, `${T} aucune erreur JavaScript`, o.journal.erreurs.join(' ¦ '));
  await ferme(o);
}

async function scenarioB(nav, W, theme) {
  const T = `[B ${W} ${theme}]`, tag = `${W}-${theme}`;
  const o = await ouvrir(nav, { W, theme, muet: true });
  const { pg } = o;
  await pg.waitForSelector('[data-boite-relier-compte="222"]', { timeout: 15000 }).catch(() => {});
  await pg.locator('[data-boite-relier-compte="222"]').first().click();
  await pg.waitForSelector('[data-parcours-adresse][data-relier-compte="222"] [data-relier-boites]', { timeout: 15000 }).catch(() => {});
  await attendre(6500);
  const s = await pg.evaluate(() => {
    const p = document.querySelector('[data-parcours-adresse]');
    const sel = document.querySelector('select[data-relais-boite]');
    return { compte: p && p.dataset.relierCompte, e: p && p.dataset.etape, puces: [...document.querySelectorAll('[data-choix-compte-uid]')].map((x) => x.dataset.choixCompteUid + ':' + x.getAttribute('aria-checked')),
      options: sel ? [...sel.options].map((x) => x.value) : null, adresse: (document.querySelector('[data-relier-compte-adresse]') || {}).textContent,
      verif: (document.querySelector('[data-relier-verif]') || {}).dataset?.relierVerif, roue: document.querySelectorAll('[data-parcours-adresse] .vrm-pv-roue').length, n: document.querySelectorAll('[data-parcours-adresse]').length };
  });
  dit(s.n === 1 && s.compte === '222' && s.e === '2' && s.puces.includes('222:true'), `${T} « Relier la boîte de … » ⇒ LE même parcours, sur ce compte (puce cochée), étape 2`, JSON.stringify(s));
  dit(s.adresse === ADR_B && Array.isArray(s.options) && s.options.includes(ADR_A) && !s.options.includes(ADR_B), `${T} relais d'Apple : « Choisis où Apple fait suivre » + la liste des boîtes déjà reliées (jamais le relais)`, JSON.stringify(s));
  dit(s.verif === 'attente' && s.roue === 0, `${T} la vérification du compte : calme, sans roue qui tourne`, JSON.stringify(s));
  await pg.locator('[data-parcours-adresse]').scrollIntoViewIfNeeded();
  await regles(pg, T, W < 600);
  await capture(pg, `b-relais-${tag}`);
  dit(!o.journal.erreurs.length, `${T} aucune erreur JavaScript`, o.journal.erreurs.join(' ¦ '));
  await ferme(o);
}

async function scenarioC(nav, W, theme) {
  const T = `[C ${W} ${theme}]`, tag = `${W}-${theme}`;
  const o = await ouvrir(nav, { W, theme, tab: 'settings' });
  const { pg } = o;
  await pg.locator('[data-reglage-adresse-vrm]').first().waitFor({ timeout: 30000 });
  dit(o.appels.length === 0, `${T} rien n'est demandé au serveur avant son toucher`, String(o.appels.length));
  await pg.locator('[data-reglage-adresse-vrm]').first().click();
  await pg.waitForSelector('[data-feuille-adresse-reception] [data-parcours-adresse][data-etape="1"]', { timeout: 15000 }).catch(() => {});
  await attendre(450);
  const f = await pg.evaluate(() => ({ etat: (document.querySelector('[data-feuille-adresse-reception]') || {}).dataset?.etat, adr: (document.querySelector('[data-adresse-reception]') || {}).dataset?.adresseReception, barre: document.querySelectorAll('[data-feuille-adresse-reception] [data-pas-barre]').length }));
  dit(f.etat === 'active' && f.adr === A1 && f.barre === 4, `${T} Paramètres → Mon adresse VRM : LE même parcours, dans une feuille`, JSON.stringify(f));
  await capture(pg, `c-reglages-${tag}`);
  await pg.locator('[data-termine]').click();
  await attendre(500);
  dit(await pg.locator('[data-feuille-adresse-reception]').count() === 0, `${T} « Terminé » ferme la feuille`);
  dit(!o.journal.erreurs.length, `${T} aucune erreur JavaScript`, o.journal.erreurs.join(' ¦ '));
  await ferme(o);
}

async function scenarioD(nav, etat) {
  const T = `[D ${etat}]`;
  const o = await ouvrir(nav, { W: 390, theme: 'clair', etat });
  const { pg } = o;
  await pg.locator('[data-boite-vue="relier"]').first().click();
  await pg.waitForFunction(() => { const p = document.querySelector('[data-parcours-adresse]'); return p && p.dataset.etat !== 'lecture'; }, null, { timeout: 15000 }).catch(() => {});
  const r = await pg.evaluate(() => { const p = document.querySelector('[data-parcours-adresse]'); return { etat: p && p.dataset.etat, at: [...document.querySelectorAll('[data-adresse-reception]')].some((x) => /@/.test(x.innerText)), reessayer: !!(p && [...p.querySelectorAll('button')].some((b) => /Réessayer/.test(b.innerText))), guide: !!document.querySelector('[data-boite-guide]') }; });
  if (etat === 'pas-prete') dit(r.etat === 'pas-prete' && !r.at && r.guide, `${T} pas encore ouverte : elle le dit, aucune adresse inventée, l'ancien pas-à-pas reste`, JSON.stringify(r));
  else dit(r.etat === 'pas-su' && !r.at && r.reessayer, `${T} pas su : « Réessayer », jamais une adresse`, JSON.stringify(r));
  await capture(pg, `d-${etat}`);
  dit(!o.journal.erreurs.length, `${T} aucune erreur JavaScript`, o.journal.erreurs.join(' ¦ '));
  await ferme(o);
}

(async () => {
  // La règle pure du lien (l'app re-vérifie l'hôte, même si le serveur le filtre déjà).
  await essaie('lien', async () => {
    const m = await import('file://' + path.join(__dirname, '..', '..', 'src', 'adresseReception.js'));
    dit(m.lienConfirmationSur({ fournisseur: 'gmail', lien: CODE_GMAIL.lien }) && !m.lienConfirmationSur({ fournisseur: 'gmail', lien: 'https://mail-settings.google.com.piege.test/x' }) && !m.lienConfirmationSur({ fournisseur: 'gmail', lien: 'http://mail.google.com/x' }) && !m.lienConfirmationSur({ fournisseur: 'outlook', lien: 'https://mail.google.com/x' }), 'règle : « Confirmer » seulement vers l’hôte de LA messagerie, en https');
    const d = { 'a@gmail.com': 'gmail', 'b@icloud.com': 'icloud', 'c@hotmail.fr': 'outlook', 'd@orange.fr': 'orange', 'e@free.fr': 'free', 'f@yahoo.fr': 'yahoo', 'g@privaterelay.appleid.com': 'relais-apple', 'h@gmail.com.piege.test': 'autre' };
    dit(Object.entries(d).every(([a, x]) => m.messagerieDeDomaine(a) === x) && m.messagerieDetectee(['x@privaterelay.appleid.com', 'y@gmail.com', 'z@orange.fr', 'w@gmail.com']) === 'gmail', 'règle : la messagerie par le DOMAINE seul (jamais par ressemblance)');
    dit(m.FOURNISSEURS.every((f) => f.pas.length <= 3 && f.pas.every((p) => p.t.split(/\s+/).length <= 12)), 'règle : 3 pas au plus par messagerie, 12 mots au plus par pas');
  });
  await new Promise((r) => NV.srv.listen(PORT, r));
  const nav = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined), args: ['--use-angle=swiftshader', '--no-sandbox'] });
  try {
    for (const [W, theme] of [[390, 'clair'], [390, 'sombre'], [1512, 'clair'], [1512, 'sombre']]) {
      await essaie(`A ${W} ${theme}`, () => scenarioA(nav, W, theme));
      await essaie(`B ${W} ${theme}`, () => scenarioB(nav, W, theme));
    }
    for (const [W, theme] of [[390, 'sombre'], [1512, 'clair']]) await essaie(`C ${W} ${theme}`, () => scenarioC(nav, W, theme));
    for (const e of ['pas-prete', 'panne']) await essaie(`D ${e}`, () => scenarioD(nav, e));
  } finally { await nav.close(); try { NV.srv.close(); } catch (_) {} }
  console.log({ ok, ko, captures: CAPT }); process.exit(ko ? 1 : 0);
})();
