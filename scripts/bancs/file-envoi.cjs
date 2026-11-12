// ════════════════════════════════════════════════════════════════════════════
//  RIEN NE SE PERD SI LE RÉSEAU COUPE (2 nov., demande de Julien)
//
//  « Une saisie (prix d'achat, N°, note) faite sans réseau est gardée et envoyée
//  au retour, avec "en attente d'envoi" affiché. » Il utilise l'app sur iPhone
//  en 4G : le réseau « faible » laisse `navigator.onLine` à vrai, mais chaque
//  requête échoue — c'est ce que sert ce banc (`coupe` : la requête avorte
//  comme un réseau coupé), puis le hors-ligne mesuré (`setOffline`).
//
//  Base à ÉTAT et à la vraie forme (`_base-ecritures.cjs` : PATCH conditionnel
//  sur `data->>rev`, garde-fou des numéros). Un compte et six paires INVENTÉS,
//  aucune `fx/`. Les prix sont saisis À L'ÉCRAN (saisie en série).
//
//   P  coupure, saisie du prix du N°1, l'app est FERMÉE avant le retour du
//      réseau, puis rouverte avec le réseau ⇒ le prix arrive en base (mesuré
//      sur main : le chargement recopiait le nuage par-dessus ⇒ perdu) ; une
//      seconde ouverture n'écrit plus rien (envoyé une fois).
//   M  la mention « N changement(s) en attente d'envoi » est là pendant la
//      coupure (et sur l'écran hors ligne), absente une fois envoyé.
//   R  coupure, saisie du N°2, le réseau revient SANS fermer l'app ⇒ envoyé.
//   N  coupure, saisie du N°3 et du N°5 ; pendant ce temps un AUTRE appareil
//      met 53 au N°3 et 54 au N°4 ⇒ au retour, 53 et 54 restent (plus récents),
//      45 arrive.
//   L  « lecture KO, écriture OK » : au retour, la ligne entière ne se LIT pas
//      (500) mais les écritures passeraient ⇒ aucune écriture, rien d'effacé ;
//      la panne finie, la saisie arrive.
//   F  numéros : pool intact, aucun N° changé, aucun doublon.
//
//  §6.1 : rouge sur le build d'avant (`BANC_DIST=<dist d'avant>`), vert après ;
//  mutations : `scripts/audit-file-envoi.cjs --prouve`.
//  Lancer : NODE_OPTIONS="--require $PWD/scripts/bancs/_porte-banc.cjs" BANC_PORT=9412 node scripts/bancs/file-envoi.cjs
// ════════════════════════════════════════════════════════════════════════════
require('./_meta.cjs');
const H = require('./_base-ecritures.cjs');
const fs = require('node:fs'), path = require('node:path');
const CAPT = process.env.BANC_CAPTURES || path.join(require('node:os').tmpdir(), 'vrm-bancs', 'file-envoi');
fs.mkdirSync(CAPT, { recursive: true });
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const SEUL = (process.env.BANC_SEUL || '').split(',').filter(Boolean);
const joue = (x) => !SEUL.length || SEUL.includes(x);

const UID = '3150002222';
const IDS = ['7200000001', '7200000002', '7200000003', '7200000004', '7200000005', '7200000006'];
const frais = (ms) => new Date(Date.now() - ms).toISOString();
function fabriquer() {
  const items = IDS.map((id, i) => ({ id: Number(id), title: `Nike Dunk ${i + 1} taille 4${i}`, brand_title: 'Nike', size_title: '4' + i, status: 'Très bon état', price: { amount: String(60 + i) + '.0', currency_code: 'EUR' }, is_closed: false, is_hidden: false, is_draft: false, favourite_count: 0, view_count: 3, created_at_ts: frais((i + 2) * 86400000), photo: { url: `https://images1.vinted.net/t/${id}/f800/p.jpeg` } }));
  const fiches = {};
  IDS.forEach((id, i) => { fiches[id] = { numero: String(i + 1), numberedAt: frais((i + 2) * 86400000), auto: false, manuelAt: frais((i + 2) * 86400000), title: items[i].title }; });
  return H.creerBase({
    accounts: [{ id: 1, vinted_user_id: UID, login: 'vendeur_banc', domain: 'www.vinted.fr', updated_at: frais(3600e3), created_at: frais(60 * 86400000) }],
    lignes: [
      { id: 'main', data: { vrm_prenom: 'Banc', vinted_dark: false, vinted_buyprice_by_num: {}, vinted_annonce_numeros: fiches, vinted_used_numeros: IDS.map((_, i) => String(i + 1)), vrm_bienvenue_vue: { at: 'banc' }, vrm_visite_vue: { at: 'banc' }, rev: 3 } },
      { id: `harvest_${UID}_listings`, data: { capturedAt: frais(60e3), nItems: items.length, payload: { items, pagination: { total_entries: items.length } } } },
      { id: `harvest_${UID}_enligne`, data: { capturedAt: frais(60e3), complet: true, n: items.length, ids: items.map((x) => x.id), items: items.map((x) => ({ id: x.id, title: x.title })) } },
      { id: `harvest_${UID}_profile`, data: { capturedAt: frais(60e3), payload: { user: { id: Number(UID), login: 'vendeur_banc' } } } },
      { id: `harvest_${UID}_orders_sold`, data: { capturedAt: frais(60e3), nItems: 0, payload: { my_orders: [] } } },
    ],
  });
}
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
const ouvrirSaisiePrix = async (pg, base) => {
  await pg.goto(base + '/?tab=cat_annonces', { waitUntil: 'domcontentloaded' });
  // (12 nov.) Depuis le 5 nov. (chantier C, revue 2.7), la saisie en série ne vit plus dans le
  // menu « Outils » : sa porte est « Compléter » du bandeau des prix d'achat
  // (`data-ann-achats-completer`) — ou, depuis le 6 nov., le « Prochain geste » quand
  // c'est lui qui dit les prix (`data-ann-prochain-geste="prix"`, le nombre une fois, §7).
  // Le banc ouvrait encore le menu ⇒ 20 rouges sur main (le code n'était pas en faute).
  const PORTE = '[data-ann-achats-completer], [data-ann-prochain-geste="prix"] [data-ann-prochain-geste-bouton]';
  await H.attendre(async () => (await pg.locator(PORTE).count()) > 0, 15000);
  await pg.locator(PORTE).first().click().catch(() => {});
  return H.attendre(async () => (await pg.locator('[data-fillbuy]').count()) > 0, 8000);
};
const saisirPrix = async (pg, numero, prix) => {
  const i = await pg.evaluate((n) => { const champs = [...document.querySelectorAll('[data-fillbuy]')]; const c = champs.find((x) => { let p = x; for (let k = 0; k < 8 && p; k++) { if (/N°\s*(\d+)/.test(p.innerText || '') && (p.innerText || '').match(/N°\s*(\d+)/)[1] === n) return true; p = p.parentElement; } return false; }); return c ? c.getAttribute('data-fillbuy') : null; }, String(numero));
  if (i == null) return false;
  const champ = pg.locator(`[data-fillbuy="${i}"]`);
  await champ.click(); await champ.fill(String(prix)); await champ.press('Enter');
  return true;
};
// (12 nov.) Le prix se juge en NOMBRE, pas en orthographe (§6.4) : la saisie le range
// désormais au format de l'app (« 41,00 », `ecriturePrixSaisi`) — 41 reste 41.
const canonPrix = (v) => { if (v == null || v === '') return ''; const n = Number(String(v).replace(',', '.')); return isFinite(n) ? String(n) : String(v); };
const prixFiche = (d, id) => canonPrix(((d && d.vinted_annonce_numeros) || {})[id]?.buyPrice || '');
// Toute requête vers la base avorte, comme un réseau coupé (`navigator.onLine`
// reste vrai : la 4G faible de l'iPhone).
const COUPE = () => ({ coupe: true });
// La mention de la file : le NOMBRE rendu (jamais le libellé).
const mention = (pg) => pg.evaluate(() => { const el = document.querySelector('[data-file-envoi]'); return el ? Number(el.getAttribute('data-file-envoi')) : 0; }).catch(() => -1);
// Un AUTRE appareil écrit la ligne (comme le ferait son `cloudPush`).
const ecrireAilleurs = (base, maj) => {
  const m = base.lignes.get('main');
  const d = JSON.parse(JSON.stringify(m.data));
  maj(d);
  d.rev = (Number.isSafeInteger(m.data.rev) ? m.data.rev : 0) + 1;
  m.data = d; m.updated_at = new Date().toISOString();
};

(async () => {
  const srv = await H.serveur(process.env.BANC_PORT || process.env.PORT || 0);
  const nav = await H.lancer();
  const base = fabriquer();
  const depart = JSON.parse(JSON.stringify(H.dataMain(base)));
  const A = await H.appareil(nav, base, { nom: 'A', vp: { width: 390, height: 844 } });
  const errs = [];
  let o = await A.ouvrir('A'); errs.push(o.errs);
  dit(await ouvrirSaisiePrix(o.pg, srv.url), 'la saisie en série des prix d\'achat s\'ouvre');

  // ── P + M ──────────────────────────────────────────────────────────────────
  if (joue('P') || joue('M')) {
    // L'app a fini d'envoyer ce qu'elle publie à l'ouverture (la file est vide) :
    // on mesure SA saisie, pas les chiffres de démarrage.
    await H.attendre(async () => (await o.pg.evaluate(() => localStorage.getItem('vrm_file_envoi'))) == null, 15000);
    A.etat.faute = COUPE;
    dit(await saisirPrix(o.pg, 1, '41'), 'P : prix du N°1 saisi pendant la coupure');
    await o.pg.waitForTimeout(3000);
    dit(prixFiche(H.dataMain(base), IDS[0]) === '', 'P : pendant la coupure, rien n\'est arrivé en base (normal)');
    const ls = await o.pg.evaluate((id) => { try { return (JSON.parse(localStorage.getItem('vinted_annonce_numeros') || '{}')[id] || {}).buyPrice || ''; } catch (_) { return 'illisible'; } }, IDS[0]);
    dit(canonPrix(ls) === '41', 'P : la saisie est gardée sur l\'appareil', JSON.stringify(ls));
    const n = await mention(o.pg);
    dit(n === 1, 'M : « 1 changement en attente d\'envoi » est affiché', String(n) + (process.env.BANC_DEBUG ? ' ' + await o.pg.evaluate(() => { const f = JSON.parse(localStorage.getItem('vrm_file_envoi') || '{}'); return JSON.stringify(Object.entries(f.cles || {}).map(([k, e]) => [k, String(JSON.stringify(e.base)).slice(0, 60), (localStorage.getItem(k) || '').slice(0, 60)])); }) : ''));
    await o.pg.screenshot({ path: path.join(CAPT, 'M-coupure-390.png') });
    // Le hors-ligne MESURÉ : l'écran de lecture seule dit aussi la file.
    await A.ctx.setOffline(true); await o.pg.waitForTimeout(800);
    const nh = await mention(o.pg);
    dit(nh === 1, 'M : l\'écran hors ligne dit aussi la file', String(nh));
    await o.pg.screenshot({ path: path.join(CAPT, 'M-hors-ligne-390.png') });
    // L'app est FERMÉE (iOS tue la PWA) avant que le réseau revienne.
    await o.pg.close();
    await A.ctx.setOffline(false);
    A.etat.faute = null;
    const t0 = Date.now();
    o = await A.ouvrir('A-rouverte'); errs.push(o.errs);
    await o.pg.goto(srv.url + '/?tab=settings', { waitUntil: 'domcontentloaded' });
    await H.attendre(() => prixFiche(H.dataMain(base), IDS[0]) === '41', 12000);
    dit(prixFiche(H.dataMain(base), IDS[0]) === '41', 'P : rouverte avec le réseau, le prix du N°1 arrive en base', JSON.stringify(prixFiche(H.dataMain(base), IDS[0])));
    const ls2 = await o.pg.evaluate((id) => { try { return (JSON.parse(localStorage.getItem('vinted_annonce_numeros') || '{}')[id] || {}).buyPrice || ''; } catch (_) { return 'illisible'; } }, IDS[0]);
    dit(canonPrix(ls2) === '41', 'P : et il est toujours sur l\'appareil (pas recopié par l\'ancienne valeur)', JSON.stringify(ls2));
    await o.pg.waitForTimeout(2000);
    dit((await mention(o.pg)) === 0, 'M : envoyé ⇒ la mention disparaît', String(await mention(o.pg)));
    // Envoyé UNE fois : une écriture acceptée a fait passer le prix (aucune
    // autre ne le « re-pose ») et la réouverture suivante ne le renvoie pas.
    const poseurs = H.ecrituresMain(base, t0).filter((e) => typeof e.resultat === 'number' && e.resultat > 0 && prixFiche((e.corps && e.corps.data) || {}, IDS[0]) === '41');
    dit(poseurs.length >= 1, 'P : une écriture acceptée porte le prix', String(poseurs.length));
    await o.pg.waitForTimeout(1500);
    const t1 = Date.now();
    await o.pg.reload({ waitUntil: 'domcontentloaded' }); await o.pg.waitForTimeout(5000);
    const reecr = H.ecrituresMain(base, t1).filter((e) => e.page === 'A-rouverte' && prixFiche((e.corps && e.corps.data) || {}, IDS[0]) === '41');
    const prixAvant = prixFiche(H.dataMain(base), IDS[0]);
    dit(prixAvant === '41' && (await mention(o.pg)) === 0, 'P : la réouverture suivante n\'a plus rien en attente', JSON.stringify({ prix: prixAvant, ecritures: reecr.length }));
  }
  // ── R (le réseau revient sans fermer l'app) ────────────────────────────────
  if (joue('R')) {
    dit(await ouvrirSaisiePrix(o.pg, srv.url), 'R : saisie en série rouverte');
    A.etat.faute = COUPE;
    dit(await saisirPrix(o.pg, 2, '42'), 'R : prix du N°2 saisi pendant la coupure');
    await o.pg.waitForTimeout(2500);
    dit((await mention(o.pg)) === 1, 'R : la mention est là', String(await mention(o.pg)));
    A.etat.faute = null;
    await o.pg.evaluate(() => window.dispatchEvent(new Event('online')));
    await H.attendre(() => prixFiche(H.dataMain(base), IDS[1]) === '42', 20000);
    dit(prixFiche(H.dataMain(base), IDS[1]) === '42', 'R : le réseau revient ⇒ le prix du N°2 part', JSON.stringify(prixFiche(H.dataMain(base), IDS[1])));
    await H.attendre(async () => (await mention(o.pg)) === 0, 5000);
    dit((await mention(o.pg)) === 0, 'R : puis la mention disparaît');
  }
  // ── N (plus récent ailleurs) ───────────────────────────────────────────────
  if (joue('N')) {
    dit(await ouvrirSaisiePrix(o.pg, srv.url), 'N : saisie en série rouverte');
    A.etat.faute = COUPE;
    dit(await saisirPrix(o.pg, 3, '43'), 'N : prix du N°3 saisi pendant la coupure');
    await o.pg.waitForTimeout(400);
    dit(await saisirPrix(o.pg, 5, '45'), 'N : prix du N°5 saisi pendant la coupure');
    await o.pg.waitForTimeout(2500);
    // Plus tard, un autre appareil (en ligne) met 53 au N°3 et 54 au N°4.
    ecrireAilleurs(base, (d) => { d.vinted_annonce_numeros[IDS[2]].buyPrice = '53'; d.vinted_annonce_numeros[IDS[3]].buyPrice = '54'; });
    await o.pg.close();
    A.etat.faute = null;
    o = await A.ouvrir('A-N'); errs.push(o.errs);
    await o.pg.goto(srv.url + '/?tab=settings', { waitUntil: 'domcontentloaded' });
    await H.attendre(() => prixFiche(H.dataMain(base), IDS[4]) === '45', 12000);
    await o.pg.waitForTimeout(1500);
    const d = H.dataMain(base) || {};
    dit(prixFiche(d, IDS[4]) === '45', 'N : le prix du N°5 (pas touché ailleurs) arrive', JSON.stringify(prixFiche(d, IDS[4])));
    dit(prixFiche(d, IDS[2]) === '53', 'N : le N°3 garde 53, posé PLUS TARD sur l\'autre appareil', JSON.stringify(prixFiche(d, IDS[2])));
    dit(prixFiche(d, IDS[3]) === '54', 'N : le N°4 de l\'autre appareil reste', JSON.stringify(prixFiche(d, IDS[3])));
  }
  // ── L (lecture KO, écriture OK) ────────────────────────────────────────────
  if (joue('L')) {
    dit(await ouvrirSaisiePrix(o.pg, srv.url), 'L : saisie en série rouverte');
    A.etat.faute = COUPE;
    dit(await saisirPrix(o.pg, 6, '46'), 'L : prix du N°6 saisi pendant la coupure');
    await o.pg.waitForTimeout(2500);
    await o.pg.close();
    // Ailleurs, une clé de plus en base (que l'appareil ne connaît pas).
    ecrireAilleurs(base, (d) => { d.vrm_ville = 'Cancale'; });
    const avant = JSON.parse(JSON.stringify(H.dataMain(base)));
    // Au retour : la ligne ENTIÈRE ne se lit pas (500) ; tout le reste répond.
    A.etat.faute = (u, meth) => (meth === 'GET' && /id=eq\.main/.test(u) && /select=(owner,)?data/.test(u) ? { status: 500 } : null);
    const t0 = Date.now();
    o = await A.ouvrir('A-L'); errs.push(o.errs);
    await o.pg.goto(srv.url + '/?tab=settings', { waitUntil: 'domcontentloaded' });
    await o.pg.waitForTimeout(6000);
    const passees = H.ecrituresMain(base, t0).filter((e) => e.page === 'A-L');
    dit(passees.length === 0, 'L : lecture en panne ⇒ aucune écriture de la ligne', passees.map((e) => e.meth + '→' + e.resultat).join(', '));
    const d = H.dataMain(base) || {};
    dit(d.vrm_ville === 'Cancale' && d.vrm_prenom === avant.vrm_prenom && prixFiche(d, IDS[2]) === '53', 'L : rien d\'effacé en base');
    dit((await mention(o.pg)) >= 1, 'L : la saisie reste en attente (pas « envoyée »)', String(await mention(o.pg)));
    A.etat.faute = null;
    await H.attendre(() => prixFiche(H.dataMain(base), IDS[5]) === '46', 40000);
    const d2 = H.dataMain(base) || {};
    dit(prixFiche(d2, IDS[5]) === '46' && d2.vrm_ville === 'Cancale', 'L : la panne finie, la saisie arrive, fusionnée', JSON.stringify({ n6: prixFiche(d2, IDS[5]), ville: d2.vrm_ville }));
  }
  // ── F ──────────────────────────────────────────────────────────────────────
  {
    const r = numerosIntacts(depart, H.dataMain(base) || {});
    dit(!r.perdus.length && !r.changes.length && !r.doublons.length, 'F : pool intact, aucun N° changé, aucun doublon', JSON.stringify(r));
  }
  await o.pg.screenshot({ path: path.join(CAPT, 'fin-390.png') }).catch(() => {});
  const jsErr = errs.flat().filter((m) => !/ResizeObserver|Failed to fetch|NetworkError|internet/i.test(m));
  dit(jsErr.length === 0, 'aucune erreur JS', jsErr.slice(0, 3).join(' | '));
  console.log(`\n${ok} OK, ${ko} KO`);
  await nav.close(); srv.fermer();
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
