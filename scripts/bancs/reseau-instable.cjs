// ════════════════════════════════════════════════════════════════════════════
//  ZÉRO DONNÉE PERDUE, ZÉRO ÉCRAN BLOQUÉ SUR UN RÉSEAU QUI COUPE (11 nov.)
//
//  Julien au point relais, en sous-sol : le réseau coupe, pend, revient. Ce banc
//  joue des pannes RÉALISTES sur des gestes qui ÉCRIVENT (le prénom des
//  Paramètres — un réglage synchronisé — et la note privée d'une paire, geste
//  annulable à pilule) contre une base À ÉTAT à la vraie forme
//  (`_base-ecritures.cjs` : PATCH conditionnel sur `data->>rev`, garde-fou des N°).
//  Un compte et six paires INVENTÉS, aucune `fx/`, aucune écriture réelle.
//
//   A  coupure AVANT la requête : gardé sur l'appareil, « en attente d'envoi »,
//      le champ reste utilisable ; réseau revenu ⇒ en base, puis « Enregistré ».
//   B  coupure PENDANT : la requête part et RESTE sans réponse (tenue par une
//      promesse, jamais un délai fixe, §6.5). Le geste suivant doit partir quand
//      le réseau va bien — sans attendre la requête morte — et l'écran doit dire
//      « en attente » (mesuré sur main : `_pushEnVol` restait vrai, plus RIEN ne
//      partait, aucune mention).
//   C  réponse PERDUE alors que la base a ÉCRIT : rejoué sans doublon, la file
//      se vide.
//   D  5xx puis rétabli ; 429 sur la note privée ⇒ la pilule ne DÉFAIT PAS la
//      note (mesuré sur main : « répondu 429 » se lisait comme un refus, la note
//      était effacée) ; 401 d'un jeton vieux ⇒ renouvelé et renvoyé, sans alerte.
//   E  hors ligne longtemps (réseau mesuré coupé, plusieurs relances ratées),
//      puis retour ⇒ envoyé (temps compressé : les relances 5 s / 15 s / 1 min /
//      2 min tournent sans fin, l'évènement `online` relance tout de suite).
//   F  deux appareils pendant la coupure : l'autre écrit APRÈS (même clé et une
//      autre) ⇒ la valeur plus récente reste, rien d'effacé, le geste d'ici
//      (autre clé) arrive.
//   G  aucun élément de liste en double, pool des N° intact, aucune erreur JS.
//
//  Lancer : npm run build ; NODE_OPTIONS="--require $PWD/scripts/bancs/_porte-banc.cjs" BANC_PORT=0 node scripts/bancs/reseau-instable.cjs
//  BANC_TAILLES=390,1512 (défaut) · BANC_SEUL=A,B… · BANC_DIST=<dist d'avant> pour le rouge.
// ════════════════════════════════════════════════════════════════════════════
require('./_meta.cjs');
const H = require('./_base-ecritures.cjs');
const fs = require('node:fs'), path = require('node:path');
const CAPT = process.env.BANC_CAPTURES || path.join(require('node:os').tmpdir(), 'vrm-bancs', 'reseau-instable');
fs.mkdirSync(CAPT, { recursive: true });
let ko = 0, ok = 0;
let taille = '';
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? 'OK  ' : 'KO  ') + `[${taille}] ` + m + (d ? ' — ' + d : '')); };
const SEUL = (process.env.BANC_SEUL || '').split(',').filter(Boolean);
const joue = (x) => !SEUL.length || SEUL.includes(x);
const TAILLES = (process.env.BANC_TAILLES || '390,1512').split(',').map(Number).filter(Boolean);

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
      { id: 'main', data: { vrm_prenom: 'Banc', vinted_dark: false, vinted_annonce_numeros: fiches, vinted_used_numeros: IDS.map((_, i) => String(i + 1)), vrm_notes_paires: {}, vrm_bienvenue_vue: { at: 'banc' }, vrm_visite_vue: { at: 'banc' }, rev: 3 } },
      { id: `harvest_${UID}_listings`, data: { capturedAt: frais(60e3), nItems: items.length, payload: { items, pagination: { total_entries: items.length } } } },
      { id: `harvest_${UID}_enligne`, data: { capturedAt: frais(60e3), complet: true, n: items.length, ids: items.map((x) => x.id), items: items.map((x) => ({ id: x.id, title: x.title })) } },
      { id: `harvest_${UID}_profile`, data: { capturedAt: frais(60e3), payload: { user: { id: Number(UID), login: 'vendeur_banc' } } } },
      { id: `harvest_${UID}_orders_sold`, data: { capturedAt: frais(60e3), nItems: 0, payload: { my_orders: [] } } },
    ],
  });
}
const PATCH_MAIN = (u, m) => m === 'PATCH' && /app_data\?id=eq\.main/.test(u);
const COUPE = () => ({ coupe: true });
const prenomBase = (base) => String((H.dataMain(base) || {}).vrm_prenom || '');
const noteBase = (base, n) => { const o = (H.dataMain(base) || {}).vrm_notes_paires || {}; for (const [k, v] of Object.entries(o)) if (String(k).replace(/^n:/, '') === String(n) || (v && String(v.numero || '') === String(n))) return v && (v.texte || v.t || v); return ''; };
const mention = (pg) => pg.evaluate(() => { const el = document.querySelector('[data-file-envoi]'); return el ? Number(el.getAttribute('data-file-envoi')) : 0; }).catch(() => -1);
const fait = (pg) => pg.locator('[data-envoi-fait]').count().catch(() => 0);
const fileVide = (pg) => pg.evaluate(() => localStorage.getItem('vrm_file_envoi') == null).catch(() => false);
const lsPrenom = (pg) => pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vrm_prenom') || '""'); } catch (_) { return 'illisible'; } }).catch(() => '?');
const ecrireAilleurs = (base, maj) => { const m = base.lignes.get('main'); const d = JSON.parse(JSON.stringify(m.data)); maj(d); d.rev = (Number.isSafeInteger(m.data.rev) ? m.data.rev : 0) + 1; m.data = d; m.updated_at = new Date().toISOString(); };
// Pendant `ms`, relève ce qui a été VU (mention, « Enregistré », alerte du nuage).
async function guetter(pg, ms, jusqua) {
  const vu = { mention: 0, fait: 0, alerte: [] }; const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const n = await mention(pg); if (n > vu.mention) vu.mention = n;
    if (await fait(pg)) vu.fait++;
    const a = await pg.evaluate(() => { const b = document.querySelector('.vrm-sync-status'); return b ? b.getAttribute('data-sync-etat') : ''; }).catch(() => '');
    if (a && !vu.alerte.includes(a)) vu.alerte.push(a);
    if (jusqua && await jusqua(vu)) break;
    await new Promise((r) => setTimeout(r, 150));
  }
  return vu;
}
async function ouvrirPrenom(pg, url) {
  await pg.goto(url + '/?tab=settings', { waitUntil: 'domcontentloaded' });
  await H.attendre(async () => (await pg.getByText('Mon compte', { exact: true }).count()) > 0, 15000);
  await pg.getByText('Mon compte', { exact: true }).first().click().catch(() => {});
  return H.attendre(async () => (await pg.locator('[data-reglage-prenom] input').count()) > 0, 8000);
}
const taper = async (pg, v) => { const c = pg.locator('[data-reglage-prenom] input'); await c.fill(v); };
const champLibre = (pg) => pg.locator('[data-reglage-prenom] input').isEditable().catch(() => false);
async function ajouterNote(pg, url, num, texte) {
  await pg.goto(url + '/?tab=cat_annonces', { waitUntil: 'domcontentloaded' });
  const sel = `[data-note-paire="ajout"][data-note-num="${num}"]`;
  if (!(await H.attendre(async () => (await pg.locator(sel).count()) > 0, 15000))) return false;
  // (le bouton discret peut être caché par la mise en page : son geste est le même)
  const vis = pg.locator(sel + ':visible');
  if (await vis.count()) await vis.first().click(); else await pg.locator(sel).first().evaluate((b) => b.click());
  if (!(await H.attendre(async () => (await pg.getByRole('button', { name: 'Enregistrer' }).count()) > 0, 5000))) return false;
  const champ = pg.locator('[role="dialog"] textarea, [role="dialog"] input[type="text"], [role="dialog"] input:not([type])').last();
  await champ.fill(texte);
  await pg.getByRole('button', { name: 'Enregistrer' }).last().click();
  return true;
}
const lsNote = (pg, num) => pg.evaluate((n) => { try { const o = JSON.parse(localStorage.getItem('vrm_notes_paires') || '{}'); for (const [k, v] of Object.entries(o)) if (String(k).replace(/^n:/, '') === n || (v && String(v.numero || '') === n)) return (v && (v.texte || v.t)) || String(v); return ''; } catch (_) { return 'illisible'; } }, String(num)).catch(() => '?');
const doublons = (d) => { const out = []; for (const [k, v] of Object.entries(d || {})) if (Array.isArray(v)) { const s = v.map((x) => (x && typeof x === 'object' ? JSON.stringify(x) : String(x))); if (new Set(s).size !== s.length) out.push(k); } return out; };

async function uneTaille(nav, srv, w) {
  taille = String(w);
  const base = fabriquer();
  const depart = JSON.parse(JSON.stringify(H.dataMain(base)));
  const A = await H.appareil(nav, base, { nom: 'A', vp: w < 700 ? { width: 390, height: 844 } : { width: 1512, height: 900 } });
  const errs = [];
  let o = await A.ouvrir('A'); errs.push(o.errs);
  const pg = () => o.pg;
  dit(await ouvrirPrenom(pg(), srv.url), 'le champ Prénom (Paramètres → Mon compte) s’ouvre');
  // L'app a fini d'envoyer ce qu'elle publie à l'ouverture.
  await H.attendre(() => fileVide(pg()), 15000);
  const suf = `-${w}`;

  if (joue('A')) {
    A.etat.faute = COUPE;
    await taper(pg(), 'Ana');
    const vu = await guetter(pg(), 9000, async (v) => v.mention >= 1);
    dit(prenomBase(base) === 'Banc', 'A : coupure ⇒ rien en base (normal)');
    dit((await lsPrenom(pg())) === 'Ana', 'A : gardé sur l’appareil', JSON.stringify(await lsPrenom(pg())));
    dit(vu.mention >= 1, 'A : l’écran dit « en attente d’envoi »', String(vu.mention));
    dit(await champLibre(pg()), 'A : le champ reste utilisable (aucun bouton bloqué)');
    await pg().screenshot({ path: path.join(CAPT, `A-en-attente${suf}.png`) });
    A.etat.faute = null;
    await pg().evaluate(() => window.dispatchEvent(new Event('online')));
    const vu2 = await guetter(pg(), 15000, async (v) => prenomBase(base) === 'Ana' && v.fait > 0);
    dit(prenomBase(base) === 'Ana', 'A : réseau revenu ⇒ en base', prenomBase(base));
    dit(vu2.fait > 0, 'A : puis « Enregistré » est dit');
    if (vu2.fait > 0) await pg().screenshot({ path: path.join(CAPT, `A-enregistre${suf}.png`) }).catch(() => {});
    dit(await H.attendre(() => fileVide(pg()), 5000), 'A : la file est vide');
  }

  if (joue('B')) {
    let relache = null, tenue = false;
    const tenir = new Promise((r) => { relache = r; });
    A.etat.faute = (u, m) => (PATCH_MAIN(u, m) && !tenue ? { tenir, surTenue: () => { tenue = true; } } : null);
    await taper(pg(), 'Bea');
    dit(await H.attendre(() => tenue, 8000), 'B : la requête part et reste sans réponse');
    const t0 = Date.now();
    // Le réseau va bien pour toute AUTRE requête : la saisie doit arriver sans
    // attendre la requête morte, et l'écran doit dire qu'elle attend.
    const vu = await guetter(pg(), 45000, async (v) => prenomBase(base) === 'Bea' && v.mention >= 1);
    dit(vu.mention >= 1, 'B : pendant la requête morte, l’écran dit « en attente d’envoi » (pas une roue infinie)', String(vu.mention));
    dit(prenomBase(base) === 'Bea', 'B : la saisie arrive en base sans attendre la requête morte', `${prenomBase(base)} en ${Math.round((Date.now() - t0) / 1000)} s`);
    dit(await champLibre(pg()), 'B : le champ n’est jamais bloqué');
    await taper(pg(), 'Bea2');
    dit(await H.attendre(() => prenomBase(base) === 'Bea2', 12000), 'B : le geste suivant part aussi', prenomBase(base));
    relache({ coupe: true });
    dit(await H.attendre(() => fileVide(pg()), 8000), 'B : la file est vide');
  }

  if (joue('C')) {
    let perdue = false; const t0 = Date.now();
    A.etat.faute = (u, m) => (PATCH_MAIN(u, m) && !perdue ? (perdue = true, { perdre: true }) : null);
    await taper(pg(), 'Cid');
    dit(await H.attendre(() => prenomBase(base) === 'Cid', 8000), 'C : la base a écrit (réponse perdue)');
    dit(await H.attendre(() => fileVide(pg()), 40000), 'C : le rejeu voit que c’est écrit, la file se vide');
    const acceptees = H.ecrituresMain(base, t0).filter((e) => e.page === 'A' && e.meth === 'PATCH' && typeof e.resultat === 'number' && e.resultat > 0).length;
    dit(acceptees <= 2, 'C : pas d’écriture en boucle', String(acceptees));
    dit(prenomBase(base) === 'Cid' && !doublons(H.dataMain(base)).length, 'C : rien en double', JSON.stringify(doublons(H.dataMain(base))));
  }

  if (joue('D')) {
    // D1 : 503 deux fois, puis rétabli.
    let n503 = 0;
    A.etat.faute = (u, m) => (PATCH_MAIN(u, m) && n503 < 2 ? (n503++, { status: 503 }) : null);
    await taper(pg(), 'Dan');
    dit(await H.attendre(() => prenomBase(base) === 'Dan', 30000), 'D : 503 puis rétabli ⇒ en base', prenomBase(base));
    // D3 : 401 d'un jeton vieux, une fois ⇒ renouvelé, renvoyé, sans alerte.
    let n401 = 0;
    A.etat.faute = (u, m) => (PATCH_MAIN(u, m) && n401 < 1 ? (n401++, { status: 401, body: '{"code":"PGRST301","message":"JWT expired"}' }) : null);
    await taper(pg(), 'Eli');
    const vu = await guetter(pg(), 3500, async () => prenomBase(base) === 'Eli');
    dit(prenomBase(base) === 'Eli', 'D : 401 (jeton vieux) ⇒ renouvelé et envoyé tout de suite', prenomBase(base));
    dit(!vu.alerte.some((a) => a === 'error' || a === 'refus'), 'D : 401 renouvelé ⇒ aucune alerte « refusé » à l’écran', vu.alerte.join(','));
    await H.attendre(() => prenomBase(base) === 'Eli', 10000);
    // D2 : 429 sur la note privée (geste à pilule « Annuler »).
    A.etat.faute = null;
    await H.attendre(() => fileVide(pg()), 8000);
    A.etat.faute = (u, m) => (PATCH_MAIN(u, m) ? { status: 429, body: '{"message":"rate limit"}' } : null);
    const okNote = await ajouterNote(pg(), srv.url, 1, 'carton du haut');
    dit(okNote, 'D : note privée du N°1 saisie pendant un 429');
    await pg().waitForTimeout(4000);
    const etatPil = await pg().evaluate(() => { const p = document.querySelector('[data-pilule-etat]'); return p ? p.getAttribute('data-pilule-etat') : ''; }).catch(() => '');
    dit(!/echec/.test(etatPil), 'D : 429 ⇒ la pilule ne dit pas « Pas enregistré »', etatPil || '(fermée)');
    dit((await lsNote(pg(), 1)) === 'carton du haut', 'D : 429 ⇒ la note n’est PAS défaite', JSON.stringify(await lsNote(pg(), 1)));
    await pg().screenshot({ path: path.join(CAPT, `D-429${suf}.png`) });
    A.etat.faute = null;
    await pg().evaluate(() => window.dispatchEvent(new Event('online')));
    dit(await H.attendre(() => noteBase(base, 1) === 'carton du haut', 20000), 'D : 429 fini ⇒ la note arrive en base', JSON.stringify(noteBase(base, 1)));
  }

  if (joue('E')) {
    await ouvrirPrenom(pg(), srv.url);
    await A.ctx.setOffline(true);
    await taper(pg(), 'Fay');
    await pg().waitForTimeout(12000);   // plusieurs relances ratées
    dit((await lsPrenom(pg())) === 'Fay' && prenomBase(base) !== 'Fay', 'E : longtemps hors ligne ⇒ gardé, pas en base');
    const n = await mention(pg());
    dit(n >= 1, 'E : « en attente d’envoi » reste dit', String(n));
    await pg().screenshot({ path: path.join(CAPT, `E-hors-ligne${suf}.png`) });
    await A.ctx.setOffline(false);
    dit(await H.attendre(() => prenomBase(base) === 'Fay', 15000), 'E : retour du réseau ⇒ envoyé', prenomBase(base));
  }

  if (joue('F')) {
    A.etat.faute = COUPE;
    await taper(pg(), 'Gus');
    dit(await ajouterNote(pg(), srv.url, 2, 'boîte abîmée'), 'F : note du N°2 saisie pendant la coupure');
    await pg().waitForTimeout(2500);
    // Plus tard, l'AUTRE appareil (en ligne) change le prénom et la ville.
    await pg().waitForTimeout(50);
    ecrireAilleurs(base, (d) => { d.vrm_prenom = 'Hugo'; d.vrm_ville = 'Cancale'; });
    A.etat.faute = null;
    await pg().evaluate(() => window.dispatchEvent(new Event('online')));
    await H.attendre(() => noteBase(base, 2) === 'boîte abîmée', 20000);
    await H.attendre(() => fileVide(pg()), 10000);
    const d = H.dataMain(base) || {};
    dit(noteBase(base, 2) === 'boîte abîmée', 'F : la note d’ici (autre clé) arrive', JSON.stringify(noteBase(base, 2)));
    dit(d.vrm_prenom === 'Hugo', 'F : le prénom posé PLUS TARD sur l’autre appareil reste', String(d.vrm_prenom));
    dit(d.vrm_ville === 'Cancale', 'F : la clé de l’autre appareil n’est pas effacée', String(d.vrm_ville));
    dit(noteBase(base, 1) === 'carton du haut' || !joue('D'), 'F : la note d’avant est toujours là');
  }

  {
    const d = H.dataMain(base) || {};
    const pool0 = new Set((depart.vinted_used_numeros || []).map(H.cleNum)), pool1 = new Set((d.vinted_used_numeros || []).map(H.cleNum));
    const perdus = [...pool0].filter((c) => !pool1.has(c));
    const changes = Object.keys(depart.vinted_annonce_numeros).filter((id) => H.cleNum(depart.vinted_annonce_numeros[id].numero) !== H.cleNum(((d.vinted_annonce_numeros || {})[id] || {}).numero));
    dit(!perdus.length && !changes.length, 'G : pool intact, aucun N° changé', JSON.stringify({ perdus, changes }));
    dit(!doublons(d).length, 'G : aucun élément de liste en double', JSON.stringify(doublons(d)));
  }
  const jsErr = errs.flat().filter((m) => !/ResizeObserver|Failed to fetch|NetworkError|internet|aborted|abort/i.test(m));
  dit(jsErr.length === 0, 'aucune erreur JS', jsErr.slice(0, 3).join(' | '));
  await A.fermer().catch(() => {});
}

(async () => {
  const srv = await H.serveur(process.env.BANC_PORT || process.env.PORT || 0);
  const nav = await H.lancer();
  for (const w of TAILLES) await uneTaille(nav, srv, w);
  console.log(`\n${ok} OK, ${ko} KO · captures : ${CAPT}`);
  await nav.close(); srv.fermer();
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
