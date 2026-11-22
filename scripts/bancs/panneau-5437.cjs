// ════════════════════════════════════════════════════════════════════════
//  BANC « PANNEAU 5.437 » (22 nov.) — le VRAI vrm-badge.js + vrm-ui.js sur une fausse page vinted.fr (l'annonce
//  7000000) ; le faux `chrome` répond comme le fond (formes de background.js). Données INVENTÉES.
//  390 × 844 au doigt (Orion), 390 sombre, 1512. On juge :
//   A. « Publier aussi sur… » : la rangée « Prix minimum » préremplie (achat 49,99 € ⇒ 55 €, dit), modifiable ; à la
//      confirmation, `prixMiniCarte · poser` (58) part AVANT `publierAussiLancer` ; « Passer » ⇒ rien n'est rangé ;
//   B. Paramètres : « Description : Coller / Taper » (Coller par défaut, un toucher écrit), l'ordre variable dit,
//      « Garde l'ordinateur éveillé… » coché par défaut ; Cadence : favoris 15 au plus, « 15 par heure : la limite » ;
//   C. Annonces : la série de republication EN PAUSE (« Vinted vérifie … »), puis après 24 h « Reprendre la série ».
//  Mesuré : cibles ≥ 44 px, aucun débordement, aucune erreur de page. Captures (BANC_CAPTURES) à REGARDER.
//  `BANC_EXT=<arbre d'avant>/vinted-sync-extension` : rouge attendu.
// ════════════════════════════════════════════════════════════════════════
require('./_porte-banc.cjs');
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const RACINE = path.join(__dirname, '..', '..');
const EXT = process.env.BANC_EXT || path.join(RACINE, 'vinted-sync-extension');
const BADGE = fs.readFileSync(path.join(EXT, 'vrm-badge.js'), 'utf8');
const UI = fs.existsSync(path.join(EXT, 'vrm-ui.js')) ? fs.readFileSync(path.join(EXT, 'vrm-ui.js'), 'utf8') : '';
const LOGO = fs.readFileSync(path.join(RACINE, 'vinted-sync-extension', 'logo-vrm-96.png'));
const SORTIE = process.env.BANC_CAPTURES ? path.join(process.env.BANC_CAPTURES, 'panneau-5437') : path.join(require('os').tmpdir(), 'banc-panneau-5437');
let ko = 0, ok = 0;
const dit = (bon, quoi, detail) => { if (bon) { ok++; console.log(`  ✅ ${quoi}`); } else { ko++; console.log(`  ❌ ${quoi}${detail ? ' — ' + String(detail).slice(0, 300) : ''}`); } };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { ko++; console.log(`  ❌ ${quoi} — a levé : ${String(e && e.message).slice(0, 220)}`); return null; } };
const MIN = 60000, H = 3600000, J = 86400000, T0 = Date.now();
const img = (c) => `https://images1.vinted.net/banc/${c}.jpg`;
const ANN = Array.from({ length: 3 }, (_, i) => ({ id: String(7000000 + i), titre: ['Nike Air Max 90 blanches taille 42', 'Adidas Samba OG noires 40', 'New Balance 550 crème 41'][i], prix: 75 + i * 5, photo: img('a' + i), photos: [img('a' + i)], num: String(120 + i), jours: 3 + i, favoris: i, depuis: T0 - i * J, taille: String(40 + i), marque: 'Nike', etat: 'Très bon état', vues: 30 + i, description: '', mini: null, achat: i === 0 ? 49.99 : null, statut: 'en_vente' }));
const listes = (atelier) => ({ ok: true, plateforme: 'vinted', compte: { id: '111', nom: 'shop_sophie' }, offres: [],
  annonces: { lu: T0 - 20 * MIN, aConfirmer: false, total: ANN.length, liste: ANN, toutes: ANN, nTous: ANN.length, statuts: { en_vente: 3, brouillon: 0, masque: 0, reserve: 0, vendu: 0, a_confirmer: 0 } },
  automatisations: { cadence: { favorisHeure: 15, actionsHeure: 50, parJour: null, pauseMin: 20, pauseMax: 60 } }, notifications: { vu: T0, liste: [] }, ventes: { lu: T0 - 10 * MIN, total: 0, liste: [] }, messages: { lu: T0 - 5 * MIN, liste: [] }, autres: null, atelier: atelier || null });
const ETAT = { ok: true, plateforme: 'vinted', capte: true, version: '5.437.0', code: '5.437.0', vrm: { ok: true, connecte: true, email: 'sophie@exemple.fr', cloisonne: true },
  site: { id: '111', nom: 'shop_sophie', choix: 'oui', jauge: { h: 12, maxH: 50, j: 40, maxJ: 200, complet: true }, favoris: null }, secu: { niveau: 'ok', texte: '' }, toutArrete: false, flux: { okAt: T0 - 3 * MIN }, liens: [], capteCoupe: false };
const ligne = (champ, v, s) => ({ champ, etat: 'ok', vinted: v, site: s });
const APERCU = { ok: true, uid: '111', sites: ['leboncoin', 'vestiaire'], pct: { leboncoin: 0, vestiaire: 0 }, pret: true,
  comptes: { leboncoin: { ok: true }, vestiaire: { ok: true } },
  articles: [{ id: '7000000', ok: true, numero: '120', titre: ANN[0].titre, photo: img('a0'), prixVinted: 75,
    sites: Object.fromEntries(['leboncoin', 'vestiaire'].map((s) => [s, { etat: 'pret', lignes: [ligne('titre', ANN[0].titre, ANN[0].titre), ligne('prix', '75', '75'), ligne('taille', '42', '42'), ligne('marque', 'Nike', 'Nike'), ligne('etat', 'Très bon état', 'Très bon état'), ligne('categorie', 'Baskets', 'Mode › Chaussures')], photos: [img('a0')], questions: [] }])) }] };
const PROPOSER = { ok: true, articles: [{ num: '120', item: '7000000', connu: null, achat: 49.99, proposition: { valeur: 55, de: 'achat' } }] };
const CB = { ok: true, reglages: { methode: 'formulaire', favoris: true, messageLot: 'Un lot ?', offreMin: 11, offreMax: 18, description: 'coller', eveil: true }, onglet: null };
const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8sPfefwAHiQM0TP3mWgAAAABJRU5ErkJggg==', 'base64');

async function ouvrir(nav, { scheme = 'light', largeur = 1512, hauteur = 900, mobile = false, orion = false, atelier = null }) {
  const ctx = await nav.newContext(Object.assign({ colorScheme: scheme, viewport: { width: largeur, height: hauteur } }, mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}, orion ? { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1 Orion/1.0' } : {}));
  const pg = await ctx.newPage();
  const erreurs = [];
  pg.on('pageerror', (e) => erreurs.push(String(e).slice(0, 200)));
  await pg.route('**/*', (r) => {
    const u = r.request().url();
    if (/logo-vrm-96\.png/.test(u)) return r.fulfill({ status: 200, contentType: 'image/png', body: LOGO });
    if (/vinted\.net\/banc\//.test(u)) return r.fulfill({ status: 200, contentType: 'image/png', body: PIXEL });
    return r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;background:#fff"><main style="height:2000px">Annonce…</main></body></html>' });
  });
  await pg.goto('https://www.vinted.fr/items/7000000-nike-air-max-90');
  await pg.evaluate(({ e, js, ui, L, ap, pr, cb }) => {
    window.__envoyes = [];
    const copie = (x) => JSON.parse(JSON.stringify(x));
    const orig = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (o) { return orig.call(this, Object.assign({}, o, { mode: 'open' })); };
    let cbR = copie(cb);
    window.chrome = {
      runtime: { id: 'ext', getURL: (p) => location.origin + '/' + p, getManifest: () => ({ version: e.version }), lastError: null,
        sendMessage: (msg, f) => {
          window.__envoyes.push(copie(msg));
          let rep = { ok: true };
          if (msg.action === 'etat') rep = copie(e);
          else if (msg.action === 'carteListes') rep = copie(L);
          else if (msg.action === 'capteLot') rep = { ok: true, lot: null };
          else if (msg.action === 'publierAussiApercu') rep = copie(ap);
          else if (msg.action === 'publierAussiLancer') rep = { accepte: true, jobId: 'j1' };
          else if (msg.action === 'publierAussiEtat') rep = { ok: true, job: { etat: 'en-cours', articles: [] } };
          else if (msg.action === 'prixMiniCarte') rep = msg.quoi === 'proposer' ? copie(pr) : { ok: true, poses: (msg.articles || []).length, relu: true };
          else if (msg.action === 'commeBleamLire') rep = copie(cbR);
          else if (msg.action === 'commeBleamPoser') { cbR = copie(cbR); Object.assign(cbR.reglages, msg.valeur || {}); rep = { ok: true, reglages: copie(cbR.reglages) }; }
          setTimeout(() => f && f(rep), 0);
        } },
      storage: { local: { get: (k, f) => { if (f) setTimeout(() => f({}), 0); return Promise.resolve({}); }, set: (o, f) => { if (f) setTimeout(f, 0); return Promise.resolve(); } }, onChanged: { addListener() {} } },
    };
    if (ui) { const u = document.createElement('script'); u.textContent = ui; document.documentElement.appendChild(u); }
    const s = document.createElement('script'); s.textContent = js; document.documentElement.appendChild(s);
  }, { e: ETAT, js: BADGE, ui: UI, L: listes(atelier), ap: APERCU, pr: PROPOSER, cb: CB });
  await pg.waitForTimeout(250);
  return { ctx, pg, erreurs };
}
const montrer = async (pg, mobile) => {
  const b = await pg.evaluate(() => { const x = document.getElementById('vrm-badge').shadowRoot.querySelector('.btn').getBoundingClientRect(); return { x: x.left + x.width / 2, y: x.top + x.height / 2 }; });
  if (mobile) await pg.touchscreen.tap(b.x, b.y); else { await pg.mouse.move(5, 5); await pg.mouse.move(b.x, b.y); await pg.mouse.click(b.x, b.y); }
  await pg.waitForTimeout(500);
};
const clic = async (pg, sel) => { const ok2 = await pg.evaluate((s) => { const b = document.getElementById('vrm-badge').shadowRoot.querySelector(s); if (b) b.click(); return !!b; }, sel); await pg.waitForTimeout(400); return ok2; };
const taper = async (pg, sel, v) => { await pg.evaluate(({ s, v }) => { const c = document.getElementById('vrm-badge').shadowRoot.querySelector(s); if (c) { c.value = v; c.dispatchEvent(new Event('input', { bubbles: true })); } }, { s: sel, v }); await pg.waitForTimeout(150); };
const defiler = async (pg, sel) => { await pg.evaluate((s) => { const el = document.getElementById('vrm-badge').shadowRoot.querySelector(s); if (el) el.scrollIntoView({ block: 'center' }); }, sel); await pg.waitForTimeout(250); };
const mesure = (pg, sel) => pg.evaluate((sel) => {
  const r = document.getElementById('vrm-badge').shadowRoot;
  const zone = r.querySelector(sel);
  const vis = (el) => { if (!el || !el.getClientRects().length) return false; const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0; };
  const petits = [];
  if (zone) for (const el of zone.querySelectorAll('button, a[href]')) { if (!vis(el)) continue; const b = el.getBoundingClientRect(); if (b.height < 43.5 || b.width < 43.5) petits.push(Math.round(b.width) + 'x' + Math.round(b.height) + ':' + el.innerText.slice(0, 20)); }
  const debords = [r.querySelector('.carte'), r.querySelector('.corps6'), zone].filter((x) => x && vis(x) && x.scrollWidth > x.clientWidth + 1).map((x) => x.className);
  return { la: !!zone && vis(zone), texte: zone ? zone.innerText : '', petits, debords, attrs: zone ? Object.fromEntries([...zone.attributes].map((a) => [a.name, a.value])) : null };
}, sel);
const envoyes = (pg) => pg.evaluate(() => window.__envoyes.map((m) => ({ action: m.action, quoi: m.quoi, articles: m.articles, valeur: m.valeur })));

(async () => {
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  fs.mkdirSync(SORTIE, { recursive: true });
  const cap = async (pg, nom) => { try { await pg.screenshot({ path: path.join(SORTIE, nom + '.png') }); } catch (_) {} };
  const jeux = [['390-orion', { largeur: 390, hauteur: 844, mobile: true, orion: true }], ['390-sombre', { largeur: 390, hauteur: 844, mobile: true, scheme: 'dark' }], ['1512', { largeur: 1512, hauteur: 900 }]];
  try {
    for (const [T, o] of jeux) {
      console.log(`\n${T}`);
      // A. Publier aussi : le prix minimum
      await essaie(T + ' A', async () => {
        const t = await ouvrir(nav, o);
        await montrer(t.pg, o.mobile);
        await clic(t.pg, '[data-onglet-b="annonces"]');
        const ouvert = await clic(t.pg, '[data-aussi-un="7000000"]');
        await t.pg.waitForTimeout(500);
        const m = await mesure(t.pg, '[data-prix-mini]');
        const v = await t.pg.evaluate(() => { const c = document.getElementById('vrm-badge').shadowRoot.querySelector('[data-pm-champ]'); return c ? c.value : null; });
        dit(ouvert && m.la && v === '55' && /achat 49,99\s€ \+ 10\s%/.test(m.texte) && /Prix minimum/.test(m.texte), `${T} · A : « Prix minimum » prérempli à 55 € (achat 49,99 € + 10 %, dit)`, JSON.stringify({ ouvert, v, t: m.texte }));
        dit(!m.petits.length && !m.debords.length, `${T} · A : cibles ≥ 44 px, aucun débordement`, JSON.stringify([m.petits, m.debords]));
        await defiler(t.pg, '[data-prix-mini]'); await cap(t.pg, `${T}-publier-prix-mini`);
        await taper(t.pg, '[data-pm-champ]', '58');
        await clic(t.pg, '[data-aussi-publier]');
        await clic(t.pg, '[data-aussi-confirmer]');
        await t.pg.waitForTimeout(400);
        const e = await envoyes(t.pg);
        const iP = e.findIndex((x) => x.action === 'prixMiniCarte' && x.quoi === 'poser'), iL = e.findIndex((x) => x.action === 'publierAussiLancer');
        dit(iP >= 0 && iL > iP && e[iP].articles[0].min === '58' && e[iP].articles[0].num === '120', `${T} · A : le prix mini (58) est rangé à côté du N°120 AVANT le lancement`, JSON.stringify(e.filter((x) => /prixMini|Lancer/.test(x.action))));
        dit(!t.erreurs.length, `${T} · A : aucune erreur de page`, t.erreurs.join(' | '));
        await t.ctx.close();
        // « Passer »
        const t2 = await ouvrir(nav, o);
        await montrer(t2.pg, o.mobile);
        await clic(t2.pg, '[data-onglet-b="annonces"]');
        await clic(t2.pg, '[data-aussi-un="7000000"]');
        await t2.pg.waitForTimeout(400);
        await clic(t2.pg, '[data-pm-passer]');
        const m2 = await mesure(t2.pg, '[data-prix-mini]');
        await clic(t2.pg, '[data-aussi-publier]'); await clic(t2.pg, '[data-aussi-confirmer]');
        const e2 = await envoyes(t2.pg);
        dit(/Passé : rien n’est rangé/.test(m2.texte) && !e2.some((x) => x.action === 'prixMiniCarte' && x.quoi === 'poser') && e2.some((x) => x.action === 'publierAussiLancer'), `${T} · A : « Passer » ⇒ rien n’est rangé, la publication part`, JSON.stringify(e2.map((x) => x.action + (x.quoi ? ':' + x.quoi : ''))));
        await defiler(t2.pg, '[data-prix-mini]'); await cap(t2.pg, `${T}-publier-passer`);
        await t2.ctx.close();
      });
      // B. Paramètres
      await essaie(T + ' B', async () => {
        const t = await ouvrir(nav, o);
        await montrer(t.pg, o.mobile);
        await clic(t.pg, '[data-onglet-b="parametres"]');
        await t.pg.waitForTimeout(500);
        const d = await mesure(t.pg, '[data-cb-description]');
        const ev = await t.pg.evaluate(() => { const c = document.getElementById('vrm-badge').shadowRoot.querySelector('[data-cb-eveil]'); return c ? c.checked : null; });
        const ordre = await mesure(t.pg, '[data-cb-ordre]');
        dit(d.la && d.attrs['data-cb-description'] === 'coller' && /Coller/.test(d.texte) && /Taper/.test(d.texte) && /Collée d’un geste/.test(d.texte), `${T} · B : « Description : Coller / Taper », Coller par défaut, expliqué`, d.texte);
        dit(ev === true && /ordre qui varie/.test(ordre.texte) && /exactement celles de la fiche/.test(ordre.texte), `${T} · B : « Garde l’ordinateur éveillé… » coché par défaut ; l’ordre variable dit (valeurs exactes)`, JSON.stringify({ ev, o: ordre.texte }));
        dit(!d.petits.length && !d.debords.length, `${T} · B : cibles ≥ 44 px, aucun débordement`, JSON.stringify([d.petits, d.debords]));
        await defiler(t.pg, '[data-cb-description]'); await cap(t.pg, `${T}-parametres-description`);
        await clic(t.pg, '[data-cb-desc="taper"]');
        await t.pg.waitForTimeout(400);
        const e = await envoyes(t.pg);
        const d2 = await mesure(t.pg, '[data-cb-description]');
        dit(e.some((x) => x.action === 'commeBleamPoser' && x.valeur && x.valeur.description === 'taper') && d2.attrs['data-cb-description'] === 'taper', `${T} · B : un toucher sur « Taper » l’écrit (relu : taper)`, JSON.stringify(e.filter((x) => x.action === 'commeBleamPoser')));
        const fav = await t.pg.evaluate(() => { const r = document.getElementById('vrm-badge').shadowRoot; const c = r.querySelector('[data-cad="favorisHeure"]'); const n = r.querySelector('[data-cad-fav-limite]'); return { max: c ? c.max : null, note: n ? n.innerText : '' }; });
        dit(fav.max === '15' && /15 par heure : la limite de Vinted/.test(fav.note), `${T} · B : Cadence — favoris 15 par heure au plus, « la limite de Vinted »`, JSON.stringify(fav));
        await defiler(t.pg, '[data-cad-fav-limite]'); await cap(t.pg, `${T}-parametres-cadence`);
        dit(!t.erreurs.length, `${T} · B : aucune erreur de page`, t.erreurs.join(' | '));
        await t.ctx.close();
      });
      // C. La série en pause « en vérification »
      await essaie(T + ' C', async () => {
        for (const aToi of [false, true]) {
          const at = { v: 1, etat: 'cours', uid: '111', ids: ['7000000', '7000001', '7000002'], i: 1, paires: { 7000000: { etape: 'fait', at: T0 - 20 * MIN } }, espacement: { mode: 'fixe', min: 2, max: 2 }, prochain: T0 - MIN,
            verif: { id: '7000000', nouvelId: '7100000', titre: 'Nike Air Max 90 blanches taille 42', depuis: T0 - (aToi ? 25 * H : 10 * MIN), n: aToi ? 50 : 2, prochaine: T0 + 10 * MIN, ...(aToi ? { aToi: true } : {}) } };
          const t = await ouvrir(nav, { ...o, atelier: at });
          await montrer(t.pg, o.mobile);
          await clic(t.pg, '[data-onglet-b="annonces"]');
          await t.pg.waitForTimeout(400);
          const m = await mesure(t.pg, '[data-atelier-verif]');
          if (!aToi) dit(m.la && m.attrs['data-atelier-verif'] === 'attente' && /En pause : Vinted vérifie « Nike Air Max 90 blanches taille 42 »/.test(m.texte) && /Prochaine vérification vers/.test(m.texte), `${T} · C : « En pause : Vinted vérifie … — reprise dès qu’il est démasqué », prochaine vérification dite`, m.texte);
          else {
            dit(m.la && m.attrs['data-atelier-verif'] === 'a-toi' && /après 24 h/.test(m.texte) && /Reprendre la série/.test(m.texte), `${T} · C : après 24 h, « Reprendre la série » (son geste)`, m.texte);
            await clic(t.pg, '[data-atelier-verif-reprendre]');
            const e = await envoyes(t.pg);
            dit(e.some((x) => x.action === 'atelierVerifReprendre'), `${T} · C : « Reprendre la série » envoie SA reprise`, JSON.stringify(e.map((x) => x.action)));
          }
          dit(!m.petits.length && !m.debords.length, `${T} · C : cibles ≥ 44 px, aucun débordement`, JSON.stringify([m.petits, m.debords]));
          await defiler(t.pg, '[data-atelier-verif]'); await cap(t.pg, `${T}-repub-pause-${aToi ? '24h' : 'attente'}`);
          dit(!t.erreurs.length, `${T} · C : aucune erreur de page`, t.erreurs.join(' | '));
          await t.ctx.close();
        }
      });
    }
  } finally { await nav.close(); }
  console.log(`\nCaptures : ${SORTIE}\n${ko ? '❌' : '✅'} banc panneau-5437 : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
