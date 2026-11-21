// ════════════════════════════════════════════════════════════════════════════
//  DEUX APPAREILS, DEUX ONGLETS — PERSONNE N'EFFACE LE GESTE DE L'AUTRE (1er nov.)
//
//  Audit « conditions difficiles », points 1 et 2 (vérifiés au banc jetable
//  `s3-deux-appareils`) : l'iPhone resté ouvert depuis le matin renvoyait TOUTE
//  la ligne `main` depuis son navigateur au moindre réglage — le prénom, le prix
//  d'achat, le colis coché, le mois déclaré saisis entre-temps sur le Mac
//  repartaient à l'ancienne valeur. Et deux onglets d'Annonces : le prix du N°1
//  saisi dans l'un disparaissait quand on saisissait celui du N°2 dans l'autre.
//
//  Base à ÉTAT et à la vraie forme (`_base-ecritures.cjs` : PATCH conditionnel,
//  insertion 409, garde-fou 017 des numéros, plafond de 1 000 lignes). Aucune
//  `fx/` : un compte et cinq paires INVENTÉS. Les gestes sont faits À L'ÉCRAN
//  (Paramètres, saisie en série des prix d'achat), jamais en écrivant le
//  navigateur à la main — sauf G (la numérotation concurrente, qu'aucun clic ne
//  sait provoquer à coup sûr), posée dans le navigateur comme l'aurait laissée
//  l'auto-numérotation.
//
//   A  deux appareils, deux clés : A pose son prénom, B (chargé avant) bascule
//      le mode sombre ⇒ la base garde les DEUX, B reçoit le prénom, A rechargé
//      le revoit.
//   B  retour au premier plan : A n'a rien touché depuis ; `visibilitychange`
//      ⇒ A relit le nuage (le mode sombre de B arrive), sans rien écrire.
//   C  deux appareils, la même carte : prix du N°1 sur A, du N°2 sur B ⇒ les
//      deux en base, dans les fiches ; les N° inchangés.
//   D  deux onglets du même navigateur, la saisie en série ouverte dans les
//      deux : prix du N°3 dans l'onglet 1, puis du N°4 dans l'onglet 2 ⇒ les
//      deux restent (en base et dans le navigateur).
//   E  lecture ratée ⇒ rien n'est écrit : la ligne a changé ailleurs ET sa
//      relecture échoue (500) ⇒ B n'écrit RIEN par-dessus ; la panne finie, son
//      geste part, fusionné.
//   F  les numéros : pool jamais rétréci, aucun N° changé, aucun doublon, sur
//      toutes les écritures de A à E.
//   G  numérotation concurrente : A a donné un numéro NEUF à une paire, B
//      (périmé) donne le même à une AUTRE ⇒ aucune écriture avec deux paires
//      sous ce numéro, le bloc « Recharger » s'ouvre.
//   H  la ligne connue se relit ABSENTE (base qui répond [] sans erreur) ⇒
//      aucune clé de l'appareil effacée, aucune ligne réécrite sans elles.
//
//  §6.1 : rouge sur le build d'avant (`BANC_DIST=<dist d'avant>`), vert après ;
//  mutations dans `scripts/audit-fusion-nuage.cjs --prouve`.
//  Lancer : NODE_OPTIONS="--require $PWD/scripts/bancs/_porte-banc.cjs" BANC_PORT=9411 node scripts/bancs/deux-appareils.cjs
// ════════════════════════════════════════════════════════════════════════════
require('./_meta.cjs');
const H = require('./_base-ecritures.cjs');
const fs = require('node:fs'), path = require('node:path');
const CAPT = process.env.BANC_CAPTURES || path.join(require('node:os').tmpdir(), 'vrm-bancs', 'deux-appareils');
fs.mkdirSync(CAPT, { recursive: true });
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const SEUL = (process.env.BANC_SEUL || '').split(',').filter(Boolean);
const joue = (x) => !SEUL.length || SEUL.includes(x);

const UID = '3150001111';
const IDS = ['7100000001', '7100000002', '7100000003', '7100000004', '7100000005'];
const frais = (ms) => new Date(Date.now() - ms).toISOString();
function fabriquer() {
  const items = IDS.map((id, i) => ({ id: Number(id), title: `Nike Air Max ${i + 1} taille 4${i}`, brand_title: 'Nike', size_title: '4' + i, status: 'Très bon état', price: { amount: String(50 + i) + '.0', currency_code: 'EUR' }, is_closed: false, is_hidden: false, is_draft: false, favourite_count: 0, view_count: 3, created_at_ts: frais((i + 2) * 86400000), photo: { url: `https://images1.vinted.net/t/${id}/f800/p.jpeg` } }));
  const fiches = {};
  IDS.forEach((id, i) => { fiches[id] = { numero: String(i + 1), numberedAt: frais((i + 2) * 86400000), auto: false, manuelAt: frais((i + 2) * 86400000), title: items[i].title }; });
  return H.creerBase({
    accounts: [{ id: 1, vinted_user_id: UID, login: 'vendeur_banc', domain: 'www.vinted.fr', updated_at: frais(3600e3), created_at: frais(60 * 86400000) }],
    lignes: [
      { id: 'main', data: { vrm_prenom: '', vinted_dark: false, vinted_buyprice_by_num: {}, vinted_annonce_numeros: fiches, vinted_used_numeros: ['1', '2', '3', '4', '5'], vrm_bienvenue_vue: { at: 'banc' }, vrm_visite_vue: { at: 'banc' } } },
      { id: `harvest_${UID}_listings`, data: { capturedAt: frais(60e3), nItems: items.length, payload: { items, pagination: { total_entries: items.length } } } },
      { id: `harvest_${UID}_enligne`, data: { capturedAt: frais(60e3), complet: true, n: items.length, ids: items.map((x) => x.id), items: items.map((x) => ({ id: x.id, title: x.title })) } },
      { id: `harvest_${UID}_profile`, data: { capturedAt: frais(60e3), payload: { user: { id: Number(UID), login: 'vendeur_banc' } } } },
      { id: `harvest_${UID}_orders_sold`, data: { capturedAt: frais(60e3), nItems: 0, payload: { my_orders: [] } } },
    ],
  });
}
// Le contrôle F, sur CHAQUE ligne `main` qu'une écriture a fait passer.
const numerosIntacts = (avant, apres) => {
  const pa = new Set((avant.vinted_used_numeros || []).map(H.cleNum));
  const pb = new Set((apres.vinted_used_numeros || []).map(H.cleNum));
  const perdus = [...pa].filter((c) => !pb.has(c));
  const fa = avant.vinted_annonce_numeros || {}, fb = apres.vinted_annonce_numeros || {};
  const changes = Object.keys(fa).filter((id) => fa[id] && String(fa[id].numero || '') && H.cleNum(fa[id].numero) !== H.cleNum((fb[id] || {}).numero));
  const par = {}; for (const [id, e] of Object.entries(fb)) { const c = e && e.numero != null && String(e.numero).trim() ? H.cleNum(e.numero) : ''; if (c) (par[c] = par[c] || []).push(id); }
  const doublons = Object.entries(par).filter(([, l]) => l.length > 1).map(([c]) => c);
  return { perdus, changes, doublons };
};

const champPrenom = async (pg) => {
  let champ = pg.locator('input[aria-label="Ton prénom"]');
  if (!(await champ.count())) { const t = pg.getByText('Mon compte', { exact: false }).first(); if (await t.count()) { await t.click().catch(() => {}); await pg.waitForTimeout(800); } }
  champ = pg.locator('input[aria-label="Ton prénom"]');
  return champ;
};
const ouvrirSaisiePrix = async (pg, base) => {
  await pg.goto(base + '/?tab=cat_annonces', { waitUntil: 'domcontentloaded' });
  // « ⋯ Outils » → « Compléter les prix d'achat » (le chemin de l'écran).
  await H.attendre(async () => (await pg.getByRole('button', { name: /Outils/ }).count()) > 0, 15000);
  await pg.getByRole('button', { name: /Outils/ }).first().click().catch(() => {});
  await H.attendre(async () => (await pg.getByText(/Compl[ée]ter les prix d'achat/).count()) > 0, 5000);
  await pg.getByText(/Compl[ée]ter les prix d'achat/).first().click().catch(() => {});
  return H.attendre(async () => (await pg.locator('[data-fillbuy]').count()) > 0, 8000);
};
// Saisit un prix dans la ligne du N° voulu de la saisie en série.
const saisirPrix = async (pg, numero, prix) => {
  const i = await pg.evaluate((n) => { const champs = [...document.querySelectorAll('[data-fillbuy]')]; const c = champs.find((x) => { let p = x; for (let k = 0; k < 8 && p; k++) { if (/N°\s*(\d+)/.test(p.innerText || '') && (p.innerText || '').match(/N°\s*(\d+)/)[1] === n) return true; p = p.parentElement; } return false; }); return c ? c.getAttribute('data-fillbuy') : null; }, String(numero));
  if (i == null) return false;
  const champ = pg.locator(`[data-fillbuy="${i}"]`);
  await champ.click(); await champ.fill(String(prix)); await champ.press('Enter');
  return true;
};
const prixFiche = (d, id) => String(((d && d.vinted_annonce_numeros) || {})[id]?.buyPrice || '');

(async () => {
  const srv = await H.serveur(process.env.BANC_PORT || process.env.PORT || 0);
  const nav = await H.lancer();
  const base = fabriquer();
  const depart = JSON.parse(JSON.stringify(H.dataMain(base)));
  const A = await H.appareil(nav, base, { nom: 'A' });
  const B = await H.appareil(nav, base, { nom: 'B' });
  const errs = [];
  const pB = await B.ouvrir('B'); errs.push(pB.errs);
  await pB.pg.goto(srv.url + '/?tab=settings', { waitUntil: 'domcontentloaded' });
  await pB.pg.waitForTimeout(5000);
  const pA = await A.ouvrir('A'); errs.push(pA.errs);
  await pA.pg.goto(srv.url + '/?tab=settings', { waitUntil: 'domcontentloaded' });
  await pA.pg.waitForTimeout(5000);

  // ── A ───────────────────────────────────────────────────────────────────────
  if (joue('A') || joue('B')) {
    const champ = await champPrenom(pA.pg);
    dit((await champ.count()) > 0, 'A : le champ « Ton prénom » est là');
    await champ.first().fill('Julien');
    await H.attendre(() => (H.dataMain(base) || {}).vrm_prenom === 'Julien', 6000);
    dit((H.dataMain(base) || {}).vrm_prenom === 'Julien', 'A : son prénom est en base', JSON.stringify((H.dataMain(base) || {}).vrm_prenom));
    const t0 = Date.now();
    const sw = pB.pg.locator('[data-reglage-sombre]');
    dit((await sw.count()) > 0, 'B : l\'interrupteur du mode sombre est là');
    await sw.first().click();
    await H.attendre(() => (H.dataMain(base) || {}).vinted_dark === true, 6000);
    await pB.pg.waitForTimeout(1200);
    const d = H.dataMain(base) || {};
    dit(d.vinted_dark === true, 'B : son mode sombre est en base', String(d.vinted_dark));
    dit(d.vrm_prenom === 'Julien', 'A+B : le prénom saisi sur A n\'est PAS effacé par B', `base vrm_prenom=${JSON.stringify(d.vrm_prenom)} · écritures de B : ${H.ecrituresMain(base, t0).filter((e) => e.page === 'B').map((e) => e.meth + '→' + e.resultat).join(', ')}`);
    const lsB = await pB.pg.evaluate(() => localStorage.getItem('vrm_prenom'));
    dit(lsB === '"Julien"', 'B : le prénom de A arrive dans son navigateur (fusion)', String(lsB));
  }
  // ── B (retour au premier plan) ─────────────────────────────────────────────
  if (joue('B')) {
    const t0 = Date.now();
    const avant = await pA.pg.evaluate(() => localStorage.getItem('vinted_dark'));
    await pA.pg.evaluate(() => { document.dispatchEvent(new Event('visibilitychange')); });
    await H.attendre(async () => (await pA.pg.evaluate(() => localStorage.getItem('vinted_dark'))) === 'true', 5000);
    const apres = await pA.pg.evaluate(() => localStorage.getItem('vinted_dark'));
    dit(apres === 'true', 'A au premier plan : le mode sombre posé sur B arrive sans recharger', `avant=${avant} après=${apres}`);
    dit(H.ecrituresMain(base, t0).filter((e) => e.page === 'A').length === 0, 'A au premier plan : relire n\'écrit rien (rien de neuf ici)', String(H.ecrituresMain(base, t0).filter((e) => e.page === 'A').length));
    await pA.pg.reload({ waitUntil: 'domcontentloaded' }); await pA.pg.waitForTimeout(5000);
    dit((await pA.pg.evaluate(() => localStorage.getItem('vrm_prenom'))) === '"Julien"', 'A rechargé : son prénom est toujours là');
  }
  // ── C (deux appareils, la même carte : les prix d'achat) ───────────────────
  if (joue('C')) {
    const okA = await ouvrirSaisiePrix(pA.pg, srv.url);
    const okB = await ouvrirSaisiePrix(pB.pg, srv.url);
    dit(okA && okB, 'C : la saisie en série des prix d\'achat s\'ouvre sur les deux appareils');
    await pA.pg.screenshot({ path: path.join(CAPT, 'C-A-saisie.png') });
    dit(await saisirPrix(pA.pg, 1, '41'), 'C : A saisit le prix du N°1');
    await H.attendre(() => prixFiche(H.dataMain(base), IDS[0]) === '41', 6000);
    dit(prixFiche(H.dataMain(base), IDS[0]) === '41', 'C : le prix du N°1 est en base');
    dit(await saisirPrix(pB.pg, 2, '42'), 'C : B (écran ouvert AVANT) saisit le prix du N°2');
    await H.attendre(() => prixFiche(H.dataMain(base), IDS[1]) === '42', 6000);
    await pB.pg.waitForTimeout(1500);
    const d = H.dataMain(base) || {};
    dit(prixFiche(d, IDS[1]) === '42', 'C : le prix du N°2 est en base');
    dit(prixFiche(d, IDS[0]) === '41', 'C : le prix du N°1 (A) n\'est PAS effacé par B', `N°1=${JSON.stringify(prixFiche(d, IDS[0]))} N°2=${JSON.stringify(prixFiche(d, IDS[1]))}`);
  }
  // ── D (deux onglets) ───────────────────────────────────────────────────────
  if (joue('D')) {
    // Les deux onglets ont la saisie en série OUVERTE avant le premier prix.
    const o2 = await A.ouvrir('A2'); errs.push(o2.errs);
    const ok1 = await ouvrirSaisiePrix(pA.pg, srv.url);
    const ok2 = await ouvrirSaisiePrix(o2.pg, srv.url);
    dit(ok1 && ok2, 'D : la saisie en série est ouverte dans les deux onglets');
    dit(await saisirPrix(pA.pg, 3, '43'), 'D : onglet 1 saisit le prix du N°3');
    await H.attendre(() => prixFiche(H.dataMain(base), IDS[2]) === '43', 6000);
    await pA.pg.waitForTimeout(800);
    dit(await saisirPrix(o2.pg, 4, '44'), 'D : onglet 2 saisit le prix du N°4');
    await H.attendre(() => prixFiche(H.dataMain(base), IDS[3]) === '44', 6000);
    await o2.pg.waitForTimeout(1500);
    const d = H.dataMain(base) || {};
    dit(prixFiche(d, IDS[3]) === '44', 'D : le prix du N°4 (onglet 2) est en base');
    dit(prixFiche(d, IDS[2]) === '43', 'D : le prix du N°3 (onglet 1) reste en base', JSON.stringify(prixFiche(d, IDS[2])));
    const ls = await o2.pg.evaluate((ids) => { try { const f = JSON.parse(localStorage.getItem('vinted_annonce_numeros') || '{}'); return ids.map((id) => (f[id] || {}).buyPrice || '').join('/'); } catch (_) { return 'illisible'; } }, [IDS[2], IDS[3]]);
    dit(ls === '43/44', 'D : et les deux dans le navigateur', JSON.stringify(ls));
    await o2.pg.close();
  }
  // ── E (lecture ratée ⇒ rien d'écrit) ───────────────────────────────────────
  if (joue('E')) {
    // La ligne change « ailleurs » (un troisième appareil, écrit directement).
    const m = base.lignes.get('main');
    m.data = { ...m.data, vrm_ville: 'Cancale', rev: (Number.isSafeInteger(m.data.rev) ? m.data.rev : 0) + 1 }; m.updated_at = new Date().toISOString();
    // B bascule le mode sombre pendant que la relecture de la ligne entière échoue.
    B.etat.faute = (u, meth) => (meth === 'GET' && /id=eq\.main/.test(u) && /select=(owner,)?data/.test(u) ? { status: 500 } : null);
    await pB.pg.goto(srv.url + '/?tab=settings', { waitUntil: 'domcontentloaded' });
    // Pendant le chargement, la ligne entière ne se lit pas non plus : on lève la
    // panne le temps du chargement, puis on la remet.
    B.etat.faute = null; await pB.pg.waitForTimeout(5000);
    m.data = { ...m.data, vrm_ville: 'Saint-Malo', rev: (Number.isSafeInteger(m.data.rev) ? m.data.rev : 0) + 1 }; m.updated_at = new Date().toISOString();
    B.etat.faute = (u, meth) => (meth === 'GET' && /id=eq\.main/.test(u) && /select=(owner,)?data/.test(u) ? { status: 500 } : null);
    const t0 = Date.now();
    const sw = pB.pg.locator('[data-reglage-sombre]');
    await sw.first().click();
    await pB.pg.waitForTimeout(3500);
    const passees = H.ecrituresMain(base, t0).filter((e) => e.page === 'B' && (e.resultat === 201 || (typeof e.resultat === 'number' && e.resultat > 0)));
    const d = H.dataMain(base) || {};
    dit(d.vrm_ville === 'Saint-Malo', 'E : relecture en panne ⇒ la ligne écrite ailleurs n\'est PAS écrasée', `vrm_ville=${JSON.stringify(d.vrm_ville)} · écritures passées de B : ${passees.length}`);
    B.etat.faute = null;
    await H.attendre(() => (H.dataMain(base) || {}).vinted_dark === false, 20000);
    const d2 = H.dataMain(base) || {};
    dit(d2.vinted_dark === false && d2.vrm_ville === 'Saint-Malo', 'E : la panne finie, le geste de B part, fusionné', `dark=${d2.vinted_dark} ville=${JSON.stringify(d2.vrm_ville)}`);
  }
  // ── I (5 nov. : l'appareil a perdu une fiche numérotée de son côté) ───────────
  // Capture de Julien (Edge, ouvert depuis la veille) : la base refuse son envoi
  // (`vrm_fiche_perdue`) et le bloc « Recharger » couvre l'écran. Une fiche
  // numérotée du nuage ne doit jamais sortir par la fusion : l'envoi passe, la
  // fiche reste, aucun bloc.
  if (joue('I')) {
    const C = await H.appareil(nav, base, { nom: 'C' });
    const pC = await C.ouvrir('C'); errs.push(pC.errs);
    await pC.pg.goto(srv.url + '/?tab=settings', { waitUntil: 'domcontentloaded' });
    await pC.pg.waitForTimeout(5000);
    const perdue = IDS[4];
    await pC.pg.evaluate((id) => { const f = JSON.parse(localStorage.getItem('vinted_annonce_numeros') || '{}'); delete f[id]; localStorage.setItem('vinted_annonce_numeros', JSON.stringify(f)); }, perdue);
    const t0 = Date.now();
    await pC.pg.locator('[data-reglage-sombre]').first().click().catch(() => {});
    await pC.pg.waitForTimeout(4000);
    const refusI = base.ecritures.filter((e) => e.at >= t0 && e.page === 'C' && /vrm_/.test(String(e.resultat)));
    dit(refusI.length === 0, 'I : un appareil qui a perdu une fiche numérotée : la base ne refuse rien', refusI.map((e) => e.resultat).join(', '));
    const dI = H.dataMain(base) || {};
    dit(dI.vinted_annonce_numeros && dI.vinted_annonce_numeros[perdue] && H.cleNum(dI.vinted_annonce_numeros[perdue].numero) === '5', 'I : la fiche N°5 reste en base');
    const blocI = await pC.pg.evaluate(() => !!document.querySelector('[data-numeros-perimes]'));
    dit(!blocI, 'I : aucun bloc « Recharger » sur cet appareil');
    await pC.pg.close();
  }
  // ── F (les numéros, sur toutes les écritures) ───────────────────────────────
  {
    const fin = H.dataMain(base) || {};
    const r = numerosIntacts(depart, fin);
    dit(!r.perdus.length && !r.changes.length && !r.doublons.length, 'F : pool intact, aucun N° changé, aucun doublon', JSON.stringify(r));
    const refusees = base.ecritures.filter((e) => /vrm_/.test(String(e.resultat)));
    dit(refusees.length === 0, 'F : aucune écriture refusée par le garde-fou des numéros', refusees.map((e) => e.page + ':' + e.resultat).join(', '));
  }
  // ── G (numérotation concurrente) ──────────────────────────────────────────
  if (joue('G')) {
    // Un numéro NEUF pour les deux côtés : au-dessus de tout ce qui existe.
    const poolB = await pB.pg.evaluate(() => JSON.parse(localStorage.getItem('vinted_used_numeros') || '[]'));
    const m = base.lignes.get('main');
    const N = String(Math.max(0, ...[...poolB, ...(m.data.vinted_used_numeros || [])].map((x) => Number(H.cleNum(x)) || 0)) + 1);
    // A (dans le nuage) a donné N à une paire…
    const fA = { ...(m.data.vinted_annonce_numeros || {}) }; fA['7100000098'] = { numero: N, numberedAt: new Date().toISOString(), auto: true };
    m.data = { ...m.data, vinted_annonce_numeros: fA, vinted_used_numeros: [...(m.data.vinted_used_numeros || []), N], rev: (Number.isSafeInteger(m.data.rev) ? m.data.rev : 0) + 1 };
    m.updated_at = new Date().toISOString();
    // … et B, périmé, donne N à une AUTRE paire, comme l'aurait fait sa numérotation automatique.
    await pB.pg.evaluate((N) => {
      const f = JSON.parse(localStorage.getItem('vinted_annonce_numeros') || '{}'); f['7100000099'] = { numero: N, numberedAt: new Date().toISOString(), auto: true };
      localStorage.setItem('vinted_annonce_numeros', JSON.stringify(f));
      const p = JSON.parse(localStorage.getItem('vinted_used_numeros') || '[]'); p.push(N); localStorage.setItem('vinted_used_numeros', JSON.stringify(p));
    }, N);
    const t0 = Date.now();
    await pB.pg.locator('[data-reglage-sombre]').first().click();
    await pB.pg.waitForTimeout(4000);
    const d = H.dataMain(base) || {};
    const porteurs = Object.entries(d.vinted_annonce_numeros || {}).filter(([, e]) => e && H.cleNum(e.numero) === N).map(([id]) => id);
    dit(porteurs.length === 1, `G : jamais deux paires sous le N°${N} en base`, porteurs.join(',') + (process.env.BANC_DEBUG ? ' · ' + JSON.stringify(base.ecritures.filter((e) => e.at >= t0).map((e) => [e.page, e.meth, e.resultat])) : ''));
    const txt = await pB.pg.evaluate(() => document.body.innerText || '');
    dit(/[Rr]echarge/.test(txt), 'G : B dit de recharger (le bloc des numéros)', '');
    await pB.pg.screenshot({ path: path.join(CAPT, 'G-B-bloc.png') });
  }
  // ── H (la ligne connue se relit ABSENTE) ───────────────────────────────────
  // Une base cloisonnée qui refuse la session répond `[]` sans erreur : la ligne
  // `main` que l'appareil vient de lire ou d'écrire « disparaît ». Fusionner avec
  // ce vide effaçait les clés de l'appareil (banc reglages-premium : le jeton du
  // widget). Pas su ⇒ rien n'est effacé, rien n'est écrit.
  if (joue('H')) {
    const avantLs = await pA.pg.evaluate(() => ({ p: localStorage.getItem('vrm_prenom'), n: localStorage.getItem('vinted_annonce_numeros') }));
    const cache = base.lignes.get('main'); base.lignes.delete('main');
    const t0 = Date.now();
    await pA.pg.goto(srv.url + '/?tab=settings', { waitUntil: 'domcontentloaded' }).catch(() => {});
    base.lignes.set('main', cache);
    await pA.pg.waitForTimeout(5000);
    base.lignes.delete('main');
    await pA.pg.locator('[data-reglage-sombre]').first().click().catch(() => {});
    await pA.pg.waitForTimeout(3500);
    await pA.pg.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await pA.pg.waitForTimeout(2500);
    const apresLs = await pA.pg.evaluate(() => ({ p: localStorage.getItem('vrm_prenom'), n: localStorage.getItem('vinted_annonce_numeros') }));
    // Les fiches peuvent s'enrichir entre-temps (l'écran vit) : on juge qu'aucune
    // ne PERD sa présence ni son numéro.
    const fa = JSON.parse(avantLs.n || '{}'), fb = JSON.parse(apresLs.n || '{}');
    const perdues = Object.keys(fa).filter((id) => !fb[id] || H.cleNum((fb[id] || {}).numero) !== H.cleNum((fa[id] || {}).numero));
    dit(apresLs.p === avantLs.p && perdues.length === 0, 'H : ligne relue absente ⇒ aucune clé de l\'appareil effacée', JSON.stringify({ avant: avantLs.p, apres: apresLs.p, fichesPerdues: perdues.length }));
    const inserees = base.ecritures.filter((e) => e.at >= t0 && e.meth === 'POST' && [].concat(e.corps || []).some((x) => x && x.id === 'main'));
    dit(inserees.every((e) => [].concat(e.corps).every((x) => x.id !== 'main' || (x.data && x.data.vrm_prenom === JSON.parse(avantLs.p || 'null')))), 'H : aucune ligne réécrite sans ce que l\'appareil porte', String(inserees.length));
    base.lignes.set('main', base.lignes.get('main') || cache);
  }
  const jsErr = errs.flat().filter((m) => !/ResizeObserver|Failed to fetch|NetworkError/.test(m));
  dit(jsErr.length === 0, 'aucune erreur JS', jsErr.slice(0, 3).join(' | '));
  console.log(`\n${ok} OK, ${ko} KO`);
  await nav.close(); srv.fermer();
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
