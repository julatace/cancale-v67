// ════════════════════════════════════════════════════════════════════════════
//  BANC « ux-reglages » (21 nov.) — les choix de Julien n° 24, 25, 27, 32, 33, 34 (récit :
//  docs/passation/2026-11-21-ux-reglages.md). Base INVENTÉE (harnais `_ux-harnais.cjs`, rien ne sort), le DOM que voit
//  Julien (le design natif, pas celui d'avant le 17 nov.). Il MESURE (data-*, styles calculés, nombres) :
//   P  PARAMÈTRES — la liste (rangées, pas de tuiles), UNE recherche ; « Enregistrement… » absent au repos, présent
//      PENDANT une écriture tenue, puis « Enregistré » ≤ 2,5 s puis rien ; Apparence = Clair · Sombre · Comme l'appareil,
//      aucun interrupteur « Mode sombre » ; Mon compte : plus de carte « Protège ton compte », la rangée « Double
//      vérification » dit l'état ; sous-page : UN retour texte « ‹ Paramètres », pas de fil d'Ariane, groupes à la même
//      largeur que le premier écran.
//   E  E-MAILS — 3 segments au plus, une seule recherche, « Ventes » / « Achats » dans « Plus de filtres ».
//   V  ÉCRANS VIDES — Ventes, Achats, Annonces, Messages, E-mails, Stock, Notifications (et Statistiques) : base vide ⇒
//      le `Vide` natif (.n-vide) avec UN geste ; jamais un squelette et un vide en même temps ; Achats vide sans
//      Calculette, ni « Relier achats et ventes », ni bande de tirets, ni « meilleures sources ». En cours (lecture
//      TENUE) ⇒ `Attente`, pas de Vide ; pas su (500) ⇒ phrase + Réessayer, pas de Vide « aucun ».
//   M  MOUVEMENTS — toucher 100 ms + scale 0,97 ; feuille 250 ms ; fondu de segment 150 ms ; réduits ⇒ rien.
//   N  « NOUVEAU » — une feuille ≤ 3 lignes à la première ouverture ; « Plus tard » la ferme ; rechargée, elle ne revient pas.
//   B  « BIEN DÉMARRER » — compte neuf : la carte N/5 en haut d'Aujourd'hui, cochée par les PREUVES (compte relié, statut
//      fiscal, N° posé…) ; tout prouvé ⇒ partie ; compte d'avant ⇒ jamais ; « × » ⇒ partie, et rechargée, elle ne revient pas.
//  `BANC_DIST` (juger un autre build), `LARGEURS=390,1512`, `THEMES=clair,sombre`, `SHOTS=<dossier>` (captures à
//  REGARDER), `PARTIES=P,E,V,M,N,B`. Un banc ne meurt pas : il rapporte.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
const H = require('./_ux-harnais.cjs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || (4790 + Math.floor(Math.random() * 200));
const SHOTS = process.env.SHOTS || '';
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
const PARTIES = liste('PARTIES', 'P,E,V,M,N,B');
let ko = 0, ok = 0; const rouges = [];
const dit = (bon, quoi, det) => { if (bon) ok++; else { ko++; rouges.push(quoi); } console.log(`${bon ? 'OK  ' : 'KO  '}${quoi}${!bon && det !== undefined ? ' — ' + String(typeof det === 'string' ? det : JSON.stringify(det)).slice(0, 400) : ''}`); };
const capture = async (pg, nom) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, nom + '.png') }).catch(() => {}); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le banc a pu jouer', String(e && e.message || e).slice(0, 300)); } };
const iso = H.iso;

// ── Les e-mails inventés (la forme de /api/email-rattacher?mode=journal) ──────
const idM = (i) => 'email_reception_' + String(i).padStart(4, '0') + 'e'.repeat(60);
const MAILS = [
  { t: 'suivi', s: 'Votre colis 12345678 est disponible', f: 'Mondial Relay <noreply@mondialrelay.fr>', r: { v: 1, t: 'suivi', tr: 'mondialrelay', s: '12345678', st: 'available', code: '418205' } },
  { t: 'bordereau', s: "Bordereau d'envoi pour Baskets essai A", f: 'Vinted <no-reply@vinted.fr>', r: { v: 1, t: 'bordereau', tx: '12345678901', pdf: 1 } },
  { t: 'vente', s: 'Ton article est vendu !', f: 'Vinted <no-reply@vinted.fr>', r: { v: 1, t: 'vente', a: 'Baskets essai B', px: '55' } },
  { t: 'achat', s: 'Ton reçu pour la commande « Baskets essai C »', f: 'Vinted <no-reply@vinted.fr>', r: { v: 1, t: 'achat', tx: '98765432101', px: '45,00' } },
].map((m, i) => ({ id: idM(i + 1), at: iso(i * 0.2), etat: i === 0 ? 'a-verifier' : 'integre', type: m.t, subject: m.s, from: m.f, resume: m.r, pj: 0, lu: i > 1, adresses: ['vendeuse.ux@exemple.test'], compte: { id: '1', nom: 'compte-essai' }, compteAmbigu: false, sourceDate: null }));
const journal = (emails) => ({ ok: true, page: 0, parPage: 50, suite: false, emails, adresses: [{ adresse: 'vendeuse.ux@exemple.test', nom: 'compte-essai' }], lus: 'lu', dernierAt: emails[0] ? emails[0].at : null,
  compteurs: { sur: emails.length, plus: false, integre: emails.length, aVerifier: emails.filter((e) => e.etat === 'a-verifier').length, erreur: 0, incompris: 0, nonLus: emails.filter((e) => !e.lu).length, parRubrique: { ventes: emails.filter((e) => e.type === 'vente').length, achats: emails.filter((e) => e.type === 'achat').length, codes: 0, colis: emails.filter((e) => ['suivi', 'bordereau'].includes(e.type)).length, offres: 0, autres: 0 } } });
const apiMails = (emails, { statut = 200, tenue = null } = {}) => (u) => {
  if (!/email-rattacher/.test(u)) return null;
  const q = new URL(u).searchParams;
  if (q.get('mode') === 'adresse-unique') return { body: { ok: true, pret: true, adresse: 'vendeuse-ux@recu-vrm.exemple', actif: true } };
  if (q.get('mode') !== 'journal') return { body: { ok: true, emails: [] } };
  if (tenue) return tenue.then(() => ({ body: journal(emails) }));
  if (statut !== 200) return { status: statut, body: { ok: false } };
  const b = q.get('boite') || '';
  const l = emails.filter((e) => !b || (b === 'colis' ? ['suivi', 'bordereau'].includes(e.type) : b === 'ventes' ? e.type === 'vente' : b === 'achats' ? e.type === 'achat' : true)).filter((e) => q.get('etat') !== 'a-verifier' || e.etat === 'a-verifier');
  return { body: journal(l) };
};

const visibles = (pg, sel) => pg.evaluate((sel) => [...document.querySelectorAll(sel)].filter((e) => { const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; for (let p = e; p && p !== document.documentElement; p = p.parentElement) { const s = getComputedStyle(p); if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) < 0.05) return false; } return !e.closest('[inert]'); }).length, sel);
const nav0 = async () => chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined, args: ['--use-angle=swiftshader', '--no-sandbox'] });
// Les aides d'accueil (visite en bulles, conseil) coupées : elles se posent par-dessus tout, ce banc juge autre chose.
// La feuille « Nouveau » déjà montrée (toutes les nouveautés du dépôt) — sauf dans la partie N, qui la juge.
const AIDES_OFF = { v: 1, off: { visite: true, glossaire: true, conseil: true }, vues: {} };
let DEJA = { ids: [] };
const MAIN = (extra, { nouveau = false } = {}) => H.MAIN({ vrm_aides_accueil: AIDES_OFF, ...(nouveau ? {} : { vrm_nouveau_feuille: DEJA, vrm_nouveautes_vues: { vues: Object.fromEntries(DEJA.ids.map((id) => [id, iso(1)])) } }), ...extra });
const baseVide = () => ({ lignes: [MAIN({})], comptes: [], panne: null });
const ANCIEN = iso(30);   // un compte d'avant la mise en ligne (pas de « Bien démarrer », pas d'accueil « compte relié »)

// ── P. PARAMÈTRES ─────────────────────────────────────────────────────────────
async function partieP(nav, W, th) {
  const T = `[P ${W} ${th}]`;
  const base = baseVide();
  const o = await H.ouvrir(nav, { PORT, W, sombre: th === 'sombre', base, tab: 'settings', creeLe: ANCIEN });
  const pg = o.pg;
  await pg.waitForSelector('[data-categorie-ouvrir]', { timeout: 20000 }).catch(() => {});
  await pg.waitForTimeout(3500);
  const racine = await pg.evaluate(() => ({ rangees: document.querySelectorAll('[data-categorie-ouvrir]').length, tuiles: document.querySelectorAll('.vg-pm-tuile, .vg-pm-grille').length,
    gauche: (() => { const e = document.querySelector('[data-categories-reglages] [data-categorie-ouvrir], .vrm-pm-sommaire [data-categorie-ouvrir]'); return e ? Math.round(e.getBoundingClientRect().left) : null; })() }));
  dit(racine.rangees >= 8 && racine.tuiles === 0, `${T} P1 le premier écran est une LISTE de rangées (aucune tuile)`, racine);
  dit(await visibles(pg, 'input[type="search"], input[type="text"][placeholder]') === 1, `${T} P2 une seule recherche`, await visibles(pg, 'input[type="search"], input[type="text"][placeholder]'));
  dit(await visibles(pg, '[data-statut-reglages="encours"]') === 0, `${T} P3 « Enregistrement… » absent au repos`);
  await capture(pg, `p-racine-${W}-${th}`);
  // Mon compte : la rangée « Double vérification », plus de carte.
  if (W < 600) await pg.locator('[data-categorie-ouvrir="compte"]').first().click().catch(() => {});
  else await pg.locator('.vrm-pm-sommaire [data-categorie-ouvrir="compte"]').first().click().catch(() => {});
  await pg.waitForTimeout(1200);
  const compte = await pg.evaluate(() => ({ carte: !!document.querySelector('[data-carte-mfa]'), double: (document.querySelector('[data-reglage-id="double"]') || {}).innerText || '' }));
  dit(!compte.carte, `${T} P4 plus de carte « Protège ton compte » (§2.10)`);
  dit(/Désactivée/.test(compte.double), `${T} P4 la rangée « Double vérification » dit « Désactivée »`, compte.double);
  if (W < 600) {
    const barre = await pg.evaluate(() => { const b = document.querySelector('[data-categorie-retour]'); const fil = [...document.querySelectorAll('.vg-pm-nav-txt small')].filter((e) => e.getClientRects().length).length;
      const hb = (() => { const h = document.querySelector('.n-barre-titre'); return h ? h.getBoundingClientRect().bottom : 0; })(); const rb = b ? b.getBoundingClientRect() : null;
      return { libre: !!(rb && rb.top >= hb - 1), texte: b ? b.innerText.trim() : null, natif: !!(b && (b.classList.contains('n-barre-retour') || b.classList.contains('n-bouton'))), fil, retours: document.querySelectorAll('[data-categorie-retour], [data-sous-retour]').length, titre: (document.querySelector('[data-ux-pm-titre]') || {}).innerText || '' }; });
    dit(barre.libre && barre.natif && /Paramètres/.test(barre.texte || '') && barre.fil === 0 && barre.retours === 1, `${T} P5 sous-page : UN retour « ‹ Paramètres » en texte, aucun fil d'Ariane`, barre);
    const g = await pg.evaluate(() => { const e = document.querySelector('[data-categorie-ecran] .vrm-set-liste, [data-categorie-ecran] .n-groupe-carte'); return e ? Math.round(e.getBoundingClientRect().left) : null; });
    dit(g != null && racine.gauche != null && Math.abs(g - racine.gauche) <= 2, `${T} P6 les groupes de la sous-page ont la même marge que le premier écran`, { sous: g, racine: racine.gauche });
    await capture(pg, `p-compte-${W}-${th}`);
    await pg.locator('[data-categorie-retour]').first().click().catch(() => {});
    await pg.waitForTimeout(800);
  }
  // Apparence : trois choix, aucun interrupteur « Mode sombre ».
  if (W < 600) { await pg.locator('[data-categorie-ouvrir="apparence"]').first().click().catch(() => {}); await pg.waitForTimeout(900); }
  else { await pg.locator('.vrm-pm-sommaire [data-categorie-ouvrir="apparence"]').first().click().catch(() => {}); await pg.waitForTimeout(900); }
  dit(await visibles(pg, '[data-reglage-sombre]') === 0, `${T} P7 aucun interrupteur « Mode sombre » (un seul réglage)`);
  await pg.locator('[data-sous-ouvrir="apparence"]').first().click().catch(() => {});
  await pg.waitForTimeout(900);
  const choix = await pg.evaluate(() => [...document.querySelectorAll('[data-apparence]')].filter((e) => e.getClientRects().length).map((e) => e.getAttribute('data-apparence')));
  dit(JSON.stringify(choix) === '["clair","sombre","auto"]', `${T} P7 Apparence : Clair · Sombre · Comme l'appareil`, choix);
  await capture(pg, `p-apparence-${W}-${th}`);
  // L'écriture TENUE : « Enregistrement… » pendant, « Enregistré » après, puis rien.
  base.lent = 2500;
  const autre = th === 'sombre' ? 'clair' : 'sombre';
  await pg.locator(`[data-apparence="${autre}"] button, [data-apparence="${autre}"]`).first().click().catch(() => {});
  const vuEncours = await H.attendre(pg, async () => (await visibles(pg, '[data-statut-reglages="encours"]')) > 0, 6000);
  dit(vuEncours, `${T} P8 « Enregistrement… » PENDANT l'écriture réelle`);
  const vuFait = await H.attendre(pg, async () => (await visibles(pg, '[data-statut-reglages="enregistre"]')) > 0, 9000);
  dit(vuFait, `${T} P8 puis « Enregistré »`);
  await pg.waitForTimeout(2600);
  dit(await visibles(pg, '[data-statut-reglages]') === 0, `${T} P8 puis plus rien (1,5 s)`);
  dit(!o.journal.erreurs.length, `${T} aucune erreur JS`, o.journal.erreurs.join(' ¦ '));
  await o.ctx.close();
}

// ── E. E-MAILS ────────────────────────────────────────────────────────────────
async function partieE(nav, W, th) {
  const T = `[E ${W} ${th}]`;
  const o = await H.ouvrir(nav, { PORT, W, sombre: th === 'sombre', base: { lignes: [MAIN({})], comptes: H.COMPTE, panne: null }, tab: 'emails', creeLe: ANCIEN, api: apiMails(MAILS) });
  const pg = o.pg;
  await pg.waitForSelector('[data-boite-rubrique-v2]', { timeout: 20000 }).catch(() => {});
  await pg.waitForTimeout(2500);
  const segs = await pg.evaluate(() => [...document.querySelectorAll('[data-boite-rubrique-v2]')].map((e) => e.getAttribute('data-boite-rubrique-v2')));
  dit(segs.length > 0 && segs.length <= 3 && segs.includes('colis') && segs.includes('tout'), `${T} E1 trois segments au plus (À traiter · Colis · Tout)`, segs);
  dit(await visibles(pg, '.vrm-main input[type="search"], .vrm-main input[placeholder]') === 1, `${T} E2 une seule recherche`, await visibles(pg, '.vrm-main input[type="search"], .vrm-main input[placeholder]'));
  dit(await visibles(pg, '[data-boite-email]') >= 1, `${T} E3 des e-mails en rangées`);
  await capture(pg, `e-boite-${W}-${th}`);
  await pg.locator('[data-v2-mail-plus]').first().click().catch(() => {});
  await pg.waitForTimeout(900);
  const plus = await pg.evaluate(() => [...document.querySelectorAll('[data-v2-mail-choix]')].map((e) => e.getAttribute('data-v2-mail-choix')));
  dit(plus.includes('ventes') && plus.includes('achats'), `${T} E4 « Ventes » et « Achats » dans « Plus de filtres »`, plus);
  await capture(pg, `e-plus-${W}-${th}`);
  await pg.locator('[data-v2-mail-choix="ventes"]').first().click().catch(() => {});
  await pg.waitForTimeout(1500);
  const f = await pg.evaluate(() => ({ chip: (document.querySelector('[data-v2-mail-filtre]') || {}).innerText || '', n: document.querySelectorAll('[data-boite-email]').length }));
  dit(/Ventes/.test(f.chip) && f.n === 1, `${T} E4 le filtre « Ventes » s'applique et se dit`, f);
  dit(!o.journal.erreurs.length, `${T} aucune erreur JS`, o.journal.erreurs.join(' ¦ '));
  await o.ctx.close();
}

// ── V. ÉCRANS VIDES ───────────────────────────────────────────────────────────
const ECRANS_V = [['ventes', 'Ventes'], ['achats', 'Achats'], ['annonces', 'Annonces'], ['messages', 'Messages'], ['emails', 'E-mails'], ['garage', 'Stock']];
const sondeVide = (pg) => pg.evaluate(() => {
  const vis = (e) => { const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; for (let p = e; p && p !== document.documentElement; p = p.parentElement) { const s = getComputedStyle(p); if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) < 0.05) return false; } return !e.closest('[inert]'); };
  const main = document.querySelector('.vrm-main') || document.body;
  const vides = [...main.querySelectorAll('.n-vide')].filter(vis);
  return { largeur: vides.length ? Math.round(Math.min(...vides.map((v) => v.getBoundingClientRect().width))) : 0, vides: vides.length, gestes: vides.reduce((n, v) => n + [...v.querySelectorAll('button, a[href]')].filter(vis).length, 0),
    squelettes: [...main.querySelectorAll('.n-attente, [data-boite-chargement], .vrm-attente-squelette')].filter(vis).length,
    achats: { calculette: [...main.querySelectorAll('[data-achats-calculette]')].filter(vis).length, glisser: [...main.querySelectorAll('[data-glisser-ouvrir]')].filter(vis).length, hero: [...main.querySelectorAll('[data-achats-hero]')].filter(vis).length, sources: [...main.querySelectorAll('[data-achats-sources]')].filter(vis).length },
    blanc: (main.innerText || '').replace(/\s+/g, ' ').trim().length };
});
async function partieV(nav, W, th) {
  for (const [tab, nom] of ECRANS_V) {
    await essaie(`[V ${nom} ${W} ${th}]`, async () => {
      const T = `[V vide ${nom} ${W} ${th}]`;
      const o = await H.ouvrir(nav, { PORT, W, sombre: th === 'sombre', base: baseVide(), tab, creeLe: ANCIEN, api: apiMails([]) });
      await o.pg.waitForTimeout(6500);
      const s = await sondeVide(o.pg);
      dit(s.vides >= 1 && s.largeur >= 240, `${T} V1 le Vide natif (icône, phrase), à sa largeur (jamais écrasé en colonne)`, s);
      dit(s.gestes >= 1, `${T} V1 UN geste utile dans le vide`, s);
      dit(!(s.vides && s.squelettes), `${T} V2 jamais un squelette et un vide en même temps`, s);
      if (tab === 'achats') dit(!s.achats.calculette && !s.achats.glisser && !s.achats.hero && !s.achats.sources, `${T} V3 Achats vide : ni Calculette, ni Relier, ni tirets, ni sources`, s.achats);
      dit(!o.journal.erreurs.length, `${T} aucune erreur JS`, o.journal.erreurs.join(' ¦ '));
      await capture(o.pg, `v-${tab}-${W}-${th}`);
      await o.ctx.close();
    });
  }
  // E-mails : en cours (réponse TENUE) ⇒ Attente seule ; pas su (500) ⇒ phrase + Réessayer.
  await essaie(`[V E-mails états ${W} ${th}]`, async () => {
    let lacher; const tenue = new Promise((r) => { lacher = r; });
    const o = await H.ouvrir(nav, { PORT, W, sombre: th === 'sombre', base: baseVide(), tab: 'emails', creeLe: ANCIEN, api: apiMails([], { tenue }) });
    await o.pg.waitForTimeout(3500);
    let s = await sondeVide(o.pg);
    dit(s.squelettes >= 1 && s.vides === 0, `[V E-mails ${W} ${th}] V4 en cours : le squelette, pas de Vide`, s);
    await capture(o.pg, `v-emails-encours-${W}-${th}`);
    lacher(); await o.pg.waitForTimeout(2000);
    s = await sondeVide(o.pg);
    dit(s.squelettes === 0 && s.vides >= 1, `[V E-mails ${W} ${th}] V4 lu et vide : le Vide, plus de squelette`, s);
    await o.ctx.close();
    const p = await H.ouvrir(nav, { PORT, W, sombre: th === 'sombre', base: baseVide(), tab: 'emails', creeLe: ANCIEN, api: apiMails([], { statut: 500 }) });
    await p.pg.waitForTimeout(4000);
    const r = await p.pg.evaluate(() => ({ passu: !!document.querySelector('[data-boite="pas-su"]'), reessayer: !!document.querySelector('[data-boite-reessayer]'), vide: !!document.querySelector('[data-boite="vide"]') }));
    dit(r.passu && r.reessayer && !r.vide, `[V E-mails ${W} ${th}] V4 pas su : la phrase et « Réessayer », jamais « vide »`, r);
    await capture(p.pg, `v-emails-passu-${W}-${th}`);
    await p.ctx.close();
  });
  // Notifications (la cloche) : lecture TENUE ⇒ Attente ; lue vide ⇒ Vide ; jamais les deux.
  await essaie(`[V Notifications ${W} ${th}]`, async () => {
    const o = await H.ouvrir(nav, { PORT, W, sombre: th === 'sombre', base: baseVide(), tab: 'journee', creeLe: ANCIEN, tenir: /notif|journal_notif|vrm_notif/i });
    await o.pg.waitForTimeout(4000);
    await o.pg.evaluate(() => window.dispatchEvent(new Event('vrm:centre-notifs')));
    await o.pg.waitForSelector('[data-centre-notifs]', { timeout: 8000 }).catch(() => {});
    await o.pg.waitForTimeout(1200);
    const e1 = await o.pg.evaluate(() => { const f = document.querySelector('[data-centre-notifs]'); return { etat: f ? f.getAttribute('data-centre-etat') : null, attente: !!(f && f.querySelector('.n-attente')), vide: !!(f && f.querySelector('.n-vide')), lecture: !!(f && /Lecture en cours/.test(f.innerText)) }; });
    dit(e1.etat !== 'lecture' || (e1.attente && !e1.vide && !e1.lecture), `[V Notifications ${W} ${th}] V5 en cours : Attente native, ni « Lecture en cours… » ni Vide`, e1);
    await capture(o.pg, `v-notifs-encours-${W}-${th}`);
    o.relacher(); await o.pg.waitForTimeout(2500);
    const e2 = await o.pg.evaluate(() => { const f = document.querySelector('[data-centre-notifs]'); return { etat: f ? f.getAttribute('data-centre-etat') : null, attente: !!(f && f.querySelector('.n-attente')), vide: !!(f && f.querySelector('.n-vide')) }; });
    dit(e2.etat === 'vide' && e2.vide && !e2.attente, `[V Notifications ${W} ${th}] V5 lu et vide : le Vide natif seul`, e2);
    await capture(o.pg, `v-notifs-vide-${W}-${th}`);
    await o.ctx.close();
  });
}

// ── M. MOUVEMENTS ─────────────────────────────────────────────────────────────
async function partieM(nav, W) {
  for (const reduit of [false, true]) {
    const T = `[M ${W} ${reduit ? 'réduit' : 'normal'}]`;
    const o = await H.ouvrir(nav, { PORT, W, base: { lignes: [MAIN({})], comptes: H.COMPTE, panne: null }, tab: 'emails', creeLe: ANCIEN, api: apiMails(MAILS), reduit });
    await o.pg.waitForSelector('[data-v2-mail-plus]', { timeout: 15000 }).catch(() => {});
    await o.pg.waitForTimeout(1500);
    const m = await o.pg.evaluate(() => {
      const b = document.querySelector('.n-bouton, .n-bouton-icone-seule'); const sb = b ? getComputedStyle(b) : null;
      const l = document.querySelector('[data-n-fondu]'); const sl = l ? getComputedStyle(l) : null;
      return { bProp: sb ? sb.transitionProperty : '', bDur: sb ? sb.transitionDuration : '', fondu: sl ? sl.animationName + ' ' + sl.animationDuration : '' };
    });
    await o.pg.locator('[data-v2-mail-plus]').first().click().catch(() => {});
    await o.pg.waitForTimeout(700);
    const f = await o.pg.evaluate(() => { const e = document.querySelector('.n-feuille'); return e ? getComputedStyle(e).transitionDuration : ''; });
    if (!reduit) {
      dit(/transform/.test(m.bProp) && /0\.1s/.test(m.bDur), `${T} M1 toucher : transform en 100 ms`, m);
      dit(/^0\.25s/.test(f), `${T} M2 feuille : 250 ms`, f);
      dit(/n-fondu-court 0\.15s/.test(m.fondu), `${T} M3 segment : fondu 150 ms`, m.fondu);
    } else {
      dit(!/transform/.test(m.bProp), `${T} M4 réduit : pas d'enfoncement animé`, m);
      dit(!/n-fondu-court/.test(m.fondu), `${T} M4 réduit : pas de fondu`, m.fondu);
      dit(!/^0\.(2|3)/.test(f), `${T} M4 réduit : la feuille ne glisse pas`, f);
    }
    await o.ctx.close();
  }
}

// ── N. « NOUVEAU » UNE FOIS ───────────────────────────────────────────────────
async function partieN(nav, W, th) {
  const T = `[N ${W} ${th}]`;
  const base = { lignes: [MAIN({}, { nouveau: true })], comptes: H.COMPTE, panne: null };
  const o = await H.ouvrir(nav, { PORT, W, sombre: th === 'sombre', base, tab: 'journee', creeLe: iso(4) });
  const vue = await H.attendre(o.pg, async () => (await visibles(o.pg, '[data-ux-nouveau]')) > 0, 16000);
  const lignes = await o.pg.evaluate(() => document.querySelectorAll('[data-ux-nouveau-ligne]').length);
  dit(vue && lignes >= 1 && lignes <= 3, `${T} N1 la feuille « Nouveau » à la première ouverture, 3 lignes au plus`, { vue, lignes });
  await capture(o.pg, `n-feuille-${W}-${th}`);
  await o.pg.locator('[data-ux-nouveau-plus-tard]').first().click().catch(() => {});
  await o.pg.waitForTimeout(900);
  dit(await visibles(o.pg, '[data-ux-nouveau]') === 0, `${T} N2 « Plus tard » la ferme`);
  await o.pg.reload({ waitUntil: 'domcontentloaded' });
  await o.pg.waitForTimeout(11000);
  dit(await visibles(o.pg, '[data-ux-nouveau]') === 0, `${T} N3 rechargée : elle ne revient pas`);
  dit(!o.journal.erreurs.length, `${T} aucune erreur JS`, o.journal.erreurs.join(' ¦ '));
  await o.ctx.close();
  // Une ligne ouvre son écran.
  const p = await H.ouvrir(nav, { PORT, W, sombre: th === 'sombre', base: { lignes: [MAIN({}, { nouveau: true })], comptes: H.COMPTE, panne: null }, tab: 'journee', creeLe: iso(4) });
  await H.attendre(p.pg, async () => (await visibles(p.pg, '[data-ux-nouveau-ligne]')) > 0, 16000);
  const ecran = () => p.pg.evaluate(() => { const e = document.querySelector('.vrm-main .vrm-ecran-vivant[data-espace], .vrm-main [data-espace]'); return e ? e.getAttribute('data-espace') : ''; });
  const avant = await ecran();
  await p.pg.locator('[data-ux-nouveau-ligne]').first().click().catch(() => {});
  await p.pg.waitForTimeout(2000);
  const apres = await ecran();
  dit(apres && apres !== avant && (await visibles(p.pg, '[data-ux-nouveau]')) === 0, `${T} N4 une ligne ferme la feuille et ouvre son écran`, { avant, apres });
  await p.ctx.close();
}

// ── B. « BIEN DÉMARRER » ──────────────────────────────────────────────────────
const sondeBD = (pg) => pg.evaluate(() => { const c = document.querySelector('[data-ux-bien-demarrer]'); return c ? { n: c.getAttribute('data-ux-bien-demarrer'), etats: Object.fromEntries([...c.querySelectorAll('[data-ux-bd-etape]')].map((e) => [e.getAttribute('data-ux-bd-etape'), e.getAttribute('data-ux-bd-etat')])) } : null; });
async function partieB(nav, W, th) {
  const T = `[B ${W} ${th}]`;
  const RELIES = { id: 'vrm_comptes_relies', data: { v: 1, bases: { vinted: Date.now() - 864e5 }, connus: { 'vinted:9001': { at: Date.now() - 864e5, accueilli: Date.now() - 864e5, notifie: Date.now() - 864e5 } } } };   // déjà accueilli : pas de feuille « compte relié » par-dessus
  // 1. Compte NEUF, rien relié : la carte, 0 fait (ou l'extension pas sue), étapes à faire.
  let o = await H.ouvrir(nav, { PORT, W, sombre: th === 'sombre', base: baseVide(), tab: 'journee', creeLe: new Date().toISOString() });
  await o.pg.waitForTimeout(7000);
  let s = await sondeBD(o.pg);
  dit(!!s && s.n === '0/5' && s.etats.compte === 'afaire' && s.etats.fiscal === 'afaire', `${T} B1 compte neuf : « Bien démarrer 0/5 », rien coché sans preuve`, s);
  await capture(o.pg, `b-neuf-${W}-${th}`);
  await o.ctx.close();
  // 2. Compte relié + statut fiscal choisi (preuves) : 3/5 (extension par le compte, compte, fiscal).
  o = await H.ouvrir(nav, { PORT, W, sombre: th === 'sombre', base: { lignes: [MAIN({ vinted_regime: 'micro' }), RELIES], comptes: H.COMPTE, panne: null }, tab: 'journee', creeLe: new Date().toISOString() });
  await o.pg.waitForTimeout(7500);
  s = await sondeBD(o.pg);
  dit(!!s && s.n === '3/5' && s.etats.compte === 'fait' && s.etats.extension === 'fait' && s.etats.fiscal === 'fait' && s.etats.numeros !== 'fait' && s.etats.lecture !== 'fait', `${T} B2 compte relié + statut choisi ⇒ 3/5, cochés par les preuves`, s);
  await capture(o.pg, `b-trois-${W}-${th}`);
  // « × » : partie, et rechargée elle ne revient pas.
  await o.pg.locator('[data-ux-bd-masquer]').first().click().catch(() => {});
  await o.pg.waitForTimeout(800);
  dit(!(await sondeBD(o.pg)), `${T} B3 « × » : la carte part`);
  await o.pg.reload({ waitUntil: 'domcontentloaded' }); await o.pg.waitForTimeout(7000);
  dit(!(await sondeBD(o.pg)), `${T} B3 rechargée : elle ne revient pas`);
  await o.ctx.close();
  // 4. Tout prouvé (dressing lu, N° posé) : 5/5 ⇒ partie d'elle-même.
  const cap = new Date(Date.now() - 600e3).toISOString();
  const DRESSING = { id: 'harvest_9001_listings', data: { type: 'listings', uid: '9001', capturedAt: cap, nItems: 1, complete: true, payload: { items: [{ id: 70001, title: 'Baskets essai A', price: { amount: '45.00', currency_code: 'EUR' }, photos: [], is_hidden: false }] } }, meta: { capturedAt: cap } };
  o = await H.ouvrir(nav, { PORT, W, sombre: th === 'sombre', base: { lignes: [MAIN({ vinted_regime: 'micro', vinted_annonce_numeros: { 70001: { numero: '1' } }, vinted_used_numeros: ['1'] }), RELIES, DRESSING], comptes: H.COMPTE, panne: null }, tab: 'journee', creeLe: new Date().toISOString() });
  await o.pg.waitForTimeout(8000);
  dit(!(await sondeBD(o.pg)), `${T} B4 tout prouvé ⇒ la carte part d'elle-même`, await sondeBD(o.pg));
  await o.ctx.close();
  // 5. Un compte d'avant (Julien) : jamais.
  o = await H.ouvrir(nav, { PORT, W, sombre: th === 'sombre', base: baseVide(), tab: 'journee', creeLe: ANCIEN });
  await o.pg.waitForTimeout(7000);
  dit(!(await sondeBD(o.pg)), `${T} B5 compte d'avant : jamais « Bien démarrer »`);
  await o.ctx.close();
}

(async () => {
  try { const N = await import(require('url').pathToFileURL(path.join(__dirname, '..', '..', 'src', 'nouveautes.js')).href); DEJA = { ids: N.NOUVEAUTES.map((n) => n.id), at: iso(1) }; } catch (_) {}
  const srv = H.serveur(DIST); await new Promise((r) => srv.listen(PORT, r));
  const nav = await nav0();
  try {
    for (const W of LARGEURS) for (const th of THEMES) {
      if (PARTIES.includes('P')) await essaie(`[P ${W} ${th}]`, () => partieP(nav, W, th));
      if (PARTIES.includes('E')) await essaie(`[E ${W} ${th}]`, () => partieE(nav, W, th));
      if (PARTIES.includes('V')) await essaie(`[V ${W} ${th}]`, () => partieV(nav, W, th));
      if (PARTIES.includes('N')) await essaie(`[N ${W} ${th}]`, () => partieN(nav, W, th));
      if (PARTIES.includes('B')) await essaie(`[B ${W} ${th}]`, () => partieB(nav, W, th));
    }
    if (PARTIES.includes('M')) for (const W of LARGEURS) await essaie(`[M ${W}]`, () => partieM(nav, W));
  } finally { await nav.close(); srv.close(); }
  console.log(`\n${ok} OK · ${ko} KO`);
  if (ko) { console.log('Rouges :'); for (const r of rouges) console.log(' - ' + r); }
  process.exit(ko ? 1 : 0);
})();
