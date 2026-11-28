// ════════════════════════════════════════════════════════════════════════════
//  BANC — « LES PAGES DE LEBONCOIN, VESTIAIRE ET eBAY SOIGNÉES » (28 nov. 2026).
//
//  Julien, 28 nov. : « je veux que tu améliores même Vestiaire Collective, Leboncoin et eBay ; pour eBay je veux que
//  tu fasses tout parfaitement comme la page de connexion ; les designs un peu simples doivent être améliorés ».
//
//  Sur l'app RENDUE (le vrai `dist/`, ou `BANC_DIST=…` pour un autre build), base INVENTÉE de volume (les trois sites
//  remplis), base VIDE, ou lecture EN PANNE (`BASES=panne` : la base répond 503), il ouvre chaque page propre à un des
//  trois sites et relève, DANS l'écran (la coque n'est pas comptée) :
//    · P  pleins : plus d'un bouton plein visible est un défaut (§7 : un par écran au plus) ;
//    · T  cibles < 44 px au doigt (32 à la souris) ;
//    · X  texte cassé : page plus large que la fenêtre, texte coupé à l'ellipse dans un bouton, mot coupé au milieu
//         (`overflow-wrap:anywhere` qui casse un mot court), texte qui déborde de sa boîte ;
//    · K  contraste < 4,5:1 ;
//    · S  le SQUELETTE de la page (la même forme d'un site à l'autre, §2.11) : une tête de page native (`[data-site-tete]`,
//         logo du site + titre + une ligne) sur chaque page propre à un site qui n'est pas une LISTE (`tete: true` : les
//         sections eBay, Messages, la connexion — une liste montre d'abord ses lignes, AJOUT 3 de vrm-design) ; un état
//         sans contenu dit comme la page de connexion (`[data-ss-etat]` : tuile, titre, étapes, UN geste), jamais un texte nu.
//  Mesure reprise du banc minimaliste (`mesurer`) pour P, T, K et les coupes, plus S et la casse des mots.
//  Sorties (`SORTIE=…`, défaut /tmp/banc-sites-soignes) : `releve.json`, `releve.md`, `ecrans/<page>-<fen>-<th>-<base>.png`.
//  `PAGES=a,b` `FENETRES=390,1512` `THEMES=clair,sombre` `BASES=volume,vide,panne`.
//  `SEUIL=1` : rouge si une page (base volume) a plus d'un plein, une cible trop petite, un texte cassé, ou pas de tête
//  native ; ou si deux sites n'ont pas le même squelette pour la même tâche.
//  `MUTATION=plein|tete` : ajoute un second plein / retire la tête de page ⇒ le banc rougit (prouvé).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');
require('./_porte-banc.cjs');
const P = require('./design-passe.cjs');
const E = require('./ecrans-verre-2.cjs');
const M = require('./minimaliste.cjs');

const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const SORTIE = process.env.SORTIE || path.join(os.tmpdir(), 'banc-sites-soignes');
fs.mkdirSync(path.join(SORTIE, 'ecrans'), { recursive: true });
const FENETRES = liste('FENETRES', '390,1512');
const THEMES = liste('THEMES', 'clair,sombre');
const BASES = liste('BASES', 'volume');
const MUT = process.env.MUTATION || '';
const ATTENTE = Number(process.env.ATTENTE || 2600);

// Les pages propres aux trois sites. `tache` : la même tâche d'un site à l'autre (le squelette doit être le même).
const PAGES = [
  { cle: 'ebay.connexion', site: 'ebay', tache: 'compte', url: '?tab=plat_ebay&section=compte' , tete: true },
  { cle: 'ebay.connexion-vide', site: 'ebay', tache: 'compte-vide', url: '?tab=plat_ebay&section=compte', ebay: { nonRelie: true } },
  { cle: 'ebay.ventes', site: 'ebay', tache: 'ventes', url: '?tab=plat_ebay&section=ventes' },
  { cle: 'ebay.tableau', site: 'ebay', tache: 'tableau', url: '?tab=plat_ebay&section=tableau' , tete: true },
  { cle: 'ebay.agent', site: 'ebay', tache: 'agent', url: '?tab=plat_ebay&section=agent' , tete: true },
  { cle: 'ebay.offres', site: 'ebay', tache: 'offres', url: '?tab=plat_ebay&section=offres' , tete: true },
  { cle: 'ebay.argent', site: 'ebay', tache: 'argent', url: '?tab=plat_ebay&section=argent' , tete: true },
  { cle: 'ebay.sante', site: 'ebay', tache: 'sante', url: '?tab=plat_ebay&section=sante' , tete: true },
  { cle: 'ebay.annonces', site: 'ebay', tache: 'annonces', url: '?tab=plat_ebay&section=annonces' },
  { cle: 'ebay.trafic', site: 'ebay', tache: 'trafic', url: '?tab=plat_ebay&section=trafic' , tete: true },
  { cle: 'ebay.promo', site: 'ebay', tache: 'promo', url: '?tab=plat_ebay&section=promo' , tete: true },
  { cle: 'ebay.messages', site: 'ebay', tache: 'messages', url: '?tab=plat_ebay&section=messages' , tete: true },
  { cle: 'ebay.recherches', site: 'ebay', tache: 'recherches', url: '?tab=journee', evt: 'vrm:ebay-recherches' },
  { cle: 'lbc.annonces', site: 'leboncoin', tache: 'annonces', url: '?tab=plat_leboncoin&section=annonces' },
  { cle: 'lbc.ventes', site: 'leboncoin', tache: 'ventes', url: '?tab=plat_leboncoin&section=ventes' },
  { cle: 'lbc.messages', site: 'leboncoin', tache: 'messages', url: '?tab=plat_leboncoin&section=messages' , tete: true },
  { cle: 'lbc.achats', site: 'leboncoin', tache: 'achats', url: '?tab=plat_leboncoin&section=achats' },
  { cle: 'vc.annonces', site: 'vestiaire', tache: 'annonces', url: '?tab=plat_vestiaire&section=annonces' },
  { cle: 'vc.ventes', site: 'vestiaire', tache: 'ventes', url: '?tab=plat_vestiaire&section=ventes' },
  { cle: 'vc.messages', site: 'vestiaire', tache: 'messages', url: '?tab=plat_vestiaire&section=messages' , tete: true },
  { cle: 'vc.achats', site: 'vestiaire', tache: 'achats', url: '?tab=plat_vestiaire&section=achats' },
];
const VOULUES = liste('PAGES', PAGES.map((p) => p.cle).join(','));
const CHOISIES = PAGES.filter((p) => VOULUES.includes(p.cle));

const FEN = { 390: { tel: true }, 1512: { tel: false } };

// ── Bases INVENTÉES : la base de volume + les trois sites (formes lues par l'app). ──
function avecSites(b) {
  for (const site of ['leboncoin', 'ebay', 'vestiaire']) {
    const x = M.baseSite(site);
    const ids = new Set(x.rows.filter((r) => /^(lbc_|ebay_|vc_)/.test(r.id)).map((r) => r.id));
    b.rows = b.rows.filter((r) => !ids.has(r.id)); b.rows.push(...x.rows.filter((r) => ids.has(r.id)));
  }
  b.main[0].data.vrm_plateformes_affichees = { sites: ['vinted', 'leboncoin', 'ebay', 'vestiaire'], at: new Date().toISOString() };
  return b;
}
const baseDe = (base) => (base === 'vide' ? M.baseVide() : avecSites(E.baseFiches()));

// ── Un FAUX eBay (aucun appel réel) : deux comptes reliés, ou aucun. ──
const JETON = (j) => ({ expireLe: new Date(Date.now() + j * 86400000).toISOString(), joursRestants: j });
// Les formes d'eBay reprises du banc ebay-tableau (données INVENTÉES).
const JOUR = 86400000, iso = (t) => new Date(t).toISOString(), NOW = Date.now();
const TRAFIC = { debut: iso(NOW - 30 * JOUR), fin: iso(NOW - JOUR), majLe: iso(NOW - JOUR), annonces: Array.from({ length: 24 }, (_, i) => ({ itemId: String(256100000000 + i), titre: ['Nike Air Max 1', 'Adidas Samba OG', 'New Balance 550', 'Asics Gel-1130', 'Salomon XT-6', 'Vans Old Skool'][i % 6] + ' taille ' + (36 + (i % 8)), affichages: 1900 - i * 61, vues: 90 - i * 3, ventes: i % 7 === 0 ? 1 : 0, enLigne: true, photo: '', sku: 'VRM-' + (101 + i), debut: iso(NOW - (3 + i) * JOUR) })), invisibles: { invisibles: [], sansChiffres: [] } };
TRAFIC.invisibles.invisibles = [TRAFIC.annonces[23]];
const ARGENT = { solde: { dispo: { v: 120, c: 'EUR' }, enCours: { v: 115.4, c: 'EUR' }, retenu: { v: 0, c: 'EUR' }, total: { v: 235.4, c: 'EUR' } },
  versements: [{ id: 'P2', statut: 'INITIATED', date: iso(NOW - JOUR), montant: { v: 50, c: 'EUR' }, n: 1, vers: '' }, { id: 'P1', statut: 'SUCCEEDED', date: iso(NOW - 5 * JOUR), montant: { v: 145.4, c: 'EUR' }, n: 3, vers: 'BANK •••• 4321' }] };
const SANTE = { niveau: { niveau: 'ABOVE_STANDARD', programme: 'PROGRAM_GLOBAL', evalueLe: iso(NOW - 20 * JOUR), prevu: 'TOP_RATED', metriques: [{ cle: 'DEFECTIVE_TRANSACTION_RATE', nom: 'Transaction defect rate', valeur: 1.25, niveau: 'ABOVE_STANDARD', seuil: 2, type: 'RATE' }, { cle: 'SHIPPING_MISS_RATE', nom: 'Late', valeur: 0.5, niveau: 'TOP_RATED', seuil: null, type: 'RATE' }] },
  nonConforme: { note: 'HIGH', lignes: [{ nom: 'Baskets homme', note: 'HIGH', valeur: 0.04 }] }, nonRecu: { note: null, lignes: [] }, conformite: [{ type: 'ASPECTS_ADOPTION', n: 1 }],
  aCorriger: [{ itemId: '256100000004', sku: 'VRM-105', type: 'ASPECTS_ADOPTION', problemes: [{ code: 'MISSING_OR_INVALID_REQUIRED_ASPECTS', message: 'Pointure manquante', manque: ['Pointure', 'Couleur'], suggestions: [{ nom: 'Pointure', valeurs: ['42', '43'] }], etat: 'OUT_OF_COMPLIANCE' }] }] };
const LITIGES = { paiement: [{ id: '5000000001', orderId: '12-00000', motif: 'ITEM_NOT_RECEIVED', etat: 'ACTION_NEEDED', ouvertLe: iso(NOW - 2 * JOUR), repondreAvant: iso(NOW + 5 * JOUR), montant: { v: 98, c: 'EUR' } }], reclamations: [], cas: [] };
const EVAL = { score: 212, pourcent: 99.1, an: { positives: 140, neutres: 2, negatives: 1 }, dernieres: [{ id: '9001', type: 'Positive', texte: 'Parfait, merci !', date: iso(NOW - 3 * JOUR), itemId: '256100000002', titre: 'New Balance 550', de: 'client', reponse: false }] };
function apiEbay(sc) {
  return (u, req) => {
    if (!/\/api\/ebay/.test(u)) return null;
    if (req.method() !== 'POST') return { ok: true, ready: true, canConsent: true };
    let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch (_) {}
    const a = body.action;
    if (a === 'status') return sc.nonRelie ? { ok: true, connected: false, comptes: [] }
      : { ok: true, connected: true, comptes: [{ cle: 'aaaaaaaaaaaaaaaa', pseudo: 'atelier_sneakers', principal: true, relie: true, type: 'pro', site: 'FR', siteLu: true, jeton: JETON(240) }, { cle: 'bbbbbbbbbbbbbbbb', pseudo: 'camille_perso', principal: false, relie: true, type: 'particulier', site: 'FR', siteLu: true, jeton: JETON(18) }] };
    if (a === 'authurl') return { ok: false, error: 'banc : aucun départ vers eBay' };
    if (a === 'parametres') return { ok: true, categories: null, aspects: null, conditions: null, compte: { type: 'pro', politiquesActivees: true, paiement: [], retour: [], expedition: [], emplacements: [] } };
    if (a === 'messages') return { ok: true, page: 1, totalPages: 1, messages: [{ id: '5550001', itemId: '256100000003', titre: 'New Balance 550 taille 39', sender: 'acheteur_exemple', subject: 'Question', body: 'Elle taille grand ?', responses: [], status: 'Unanswered', date: new Date(Date.now() - 3600e3).toISOString(), type: 'AskSellerQuestion' }] };
    if (a === 'remises') return { ok: true, remises: [] };
    if (a === 'tableau') return { ok: true, capturedAt: NOW, argent: ARGENT, trafic: TRAFIC, sante: SANTE, evaluations: EVAL, litiges: LITIGES, offres: { n: 2, auMoins: false }, messages: { n: 1, auMoins: false, lu: NOW } };
    if (a === 'argent') return { ok: true, ...ARGENT, complet: true, depuis: iso(NOW - 90 * JOUR), commandes: { '12-00002': { net: 85.4, frais: 12.6, devise: 'EUR', versement: iso(NOW - 5 * JOUR), statut: 'SUCCEEDED', rembourse: false, sur: true, autresFrais: 0 }, '12-00003': { net: 50, frais: 7.1, devise: 'EUR', versement: null, statut: 'INITIATED', rembourse: false, sur: true, autresFrais: 0 } }, horsVente: { EUR: { total: 3.2, n: 1, types: { AD_FEE: 3.2 } } } };
    if (a === 'trafic') return { ok: true, ...TRAFIC };
    if (a === 'sante') return { ok: true, ...SANTE };
    if (a === 'litiges') return { ok: true, ...LITIGES };
    if (a === 'evaluationsrecues') return { ok: true, ...EVAL };
    return { ok: true };
  };
}

// La forme d'une page : ce qui doit se ressembler d'un site à l'autre, et ce qui casse le texte.
function forme({ mut }) {
  const racine = document.querySelector('#vrm-contenu, .vrm-main') || document.body;
  const vis = (e) => { if (e.closest('[hidden], [inert], [aria-hidden="true"]')) return false; if (e.checkVisibility && !e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false; const r = e.getBoundingClientRect(); return r.width >= 2 && r.height >= 2; };
  if (mut === 'tete') for (const t of racine.querySelectorAll('[data-site-tete]')) t.remove();
  if (mut === 'plein') { const b = document.createElement('button'); b.textContent = 'Mutation : un second plein'; b.setAttribute('data-n-variante', 'plein'); b.style.cssText = 'min-height:44px;min-width:200px'; racine.prepend(b); const c = b.cloneNode(true); racine.prepend(c); }
  const q = (s) => [...racine.querySelectorAll(s)].filter(vis);
  const tete = q('[data-site-tete]').map((e) => e.getAttribute('data-site-tete'));
  const groupes = q('.n-groupe').length;
  const rangees = q('.n-rangee, .n-tt-tr').length;
  // Textes cassés : un mot coupé au milieu (une ligne qui commence par une minuscule collée à la fin de la précédente),
  // ou un texte qui déborde de sa boîte.
  const casses = [];
  for (const e of q('p, span, div, b, strong, a, button, li, h1, h2, h3, label')) {
    const direct = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 2);
    if (!direct) continue;
    const cs = getComputedStyle(e);
    if (cs.overflow === 'visible' && e.scrollWidth > e.clientWidth + 2 && cs.display !== 'inline' && cs.whiteSpace !== 'nowrap' && e.clientWidth > 0) casses.push('déborde : ' + (e.innerText || '').trim().slice(0, 40));
    // Un mot court (< 12 lettres) coupé en deux lignes.
    const t = [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('');
    if (t.trim().length > 2) {
      const rg = document.createRange();
      for (const n of e.childNodes) {
        if (n.nodeType !== 3) continue;
        const s = n.textContent; const re = /[A-Za-zÀ-ÿ]{2,11}/g; let m;
        while ((m = re.exec(s))) { rg.setStart(n, m.index); rg.setEnd(n, m.index + m[0].length); const rs = [...rg.getClientRects()].filter((x) => x.width > 0); if (rs.length > 1 && Math.abs(rs[0].top - rs[rs.length - 1].top) > 4) { casses.push('mot coupé : ' + m[0]); break; } }
      }
    }
  }
  const premier = (() => { const r = racine.getBoundingClientRect(); const x = q('.n-rangee, .n-tt-tr, .n-groupe')[0]; return x ? Math.round(x.getBoundingClientRect().top) : null; })();
  return { tete, groupes, rangees, casses: [...new Set(casses)].slice(0, 12), premier, nTexte: (racine.innerText || '').length };
}

// Un contexte par (base, fenêtre, thème) : on ouvre l'app UNE fois, puis chaque page par `vrm:aller` (comme un lien de
// l'app) — sinon chaque page recharge l'app entière. Une page à scénario eBay propre (non relié) a son contexte.
async function ouvrirApp(nav, fen, sombre, base, sc, url) {
  const f = FEN[fen];
  if (base === 'panne') process.env.BANC_PANNE = '1'; else delete process.env.BANC_PANNE;
  const o = await P.ouvrir(nav, { W: f.tel ? 390 : 1512, sombre, b: baseDe(base), url: '/' + url, api: apiEbay(sc) });
  await P.pret(o.pg);
  await o.pg.evaluate((x) => { window.__bancExceptions = x[0]; window.__bancFeuilles = x[1]; }, ['.n-onglets, .n-barre-titre, .n-laterale, .n-plaque, .n-pastille, .n-interrupteur, input, textarea, select, img, canvas, video, svg, [data-banc-exception]', '.n-feuille-panneau, .n-feuille, .n-volet, .vrm-fs, .sb-feuille, .v2-feuille, .vrm-sheet, .n-poussee']);
  return o;
}
async function allerPage(o, pg0, premiere) {
  if (!premiere) {
    // Fermer une feuille restée ouverte (les recherches eBay), puis le lien.
    await o.pg.keyboard.press('Escape').catch(() => {});
    await o.pg.evaluate((u) => window.dispatchEvent(new CustomEvent('vrm:aller', { detail: u })), pg0.url);
    await o.pg.waitForTimeout(400);
  }
  if (pg0.evt) await o.pg.evaluate((n) => window.dispatchEvent(new Event(n)), pg0.evt);
  await o.pg.waitForTimeout(ATTENTE);
  await o.pg.evaluate(() => { for (const t of document.querySelectorAll('.vrm-toast, .n-toast button')) t.click(); window.scrollTo(0, 0); }).catch(() => {});
  await o.pg.waitForTimeout(200);
}

function md(res) {
  const l = ['| page | fen. | thème | base | tête | groupes | rangées | pleins | cibles | contraste | cassé |', '|---|---|---|---|---|---|---|---|---|---|---|'];
  for (const r of res) l.push(`| ${r.page} | ${r.fen} | ${r.theme} | ${r.base} | ${r.f.tete.join(',') || '—'} | ${r.f.groupes} | ${r.f.rangees} | ${r.pleins} | ${r.cibles.length} | ${r.contraste.length} | ${r.coupes.length + r.f.casses.length}${r.erreurs.length ? ' ❌' : ''} |`);
  return l.join('\n');
}

if (require.main === module) (async () => {
  await new Promise((r) => P.srv.listen(P.PORT, r));
  const nav = await P.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  const res = [];
  const mesurerIci = async (o, p, fen, th, base) => {
    const f = await o.pg.evaluate(forme, { mut: MUT });
    if (process.env.SONDE2) console.log(await o.pg.evaluate(() => { const m = document.querySelector('main'); const k = Object.keys(m).find((x) => x.startsWith('__reactProps')); return 'props=' + (k ? m[k]['data-n-volets'] : 'aucune') + ' attr=' + m.getAttribute('data-n-volets') + ' n=' + document.querySelectorAll('main').length; }));
    if (process.env.SONDE) console.log((await o.pg.evaluate((sel) => { const e = document.querySelector(sel); const out = []; for (let x = e; x && x !== document.body; x = x.parentElement) { const cs = getComputedStyle(x); out.push(x.tagName + '.' + String(x.className).slice(0, 70) + ' [' + [...x.attributes].filter((a) => a.name.startsWith('data-')).map((a) => a.name + '=' + a.value).join(' ').slice(0, 120) + ']' + ' w=' + Math.round(x.getBoundingClientRect().width) + ' ' + cs.display + ' gtc=' + cs.gridTemplateColumns.slice(0, 50) + ' max=' + cs.maxWidth); } return out; }, process.env.SONDE)).join('\n'));
    const m = await o.pg.evaluate(M.mesurer, { tel: FEN[fen].tel, mut: '' });
    await o.pg.screenshot({ path: path.join(SORTIE, 'ecrans', `${p.cle}-${fen}-${th}-${base}.png`), fullPage: !!process.env.PLEINE_PAGE }).catch(() => {});
    const r = { page: p.cle, site: p.site, tache: p.tache, fen, theme: th, base, erreurs: o.erreurs.splice(0).slice(0, 4), pleins: m.pleins.length, pleinsNoms: m.pleins, cibles: m.cibles, contraste: m.contraste, coupes: m.coupes, f };
    res.push(r);
    console.log(`· ${p.cle} ${fen} ${th} ${base} : tête ${f.tete.join(',') || '—'} · groupes ${f.groupes} · rangées ${f.rangees} · pleins ${r.pleins} · cibles ${r.cibles.length} · contraste ${r.contraste.length} · cassé ${r.coupes.length + f.casses.length}${r.erreurs.length ? ' ❌ ' + r.erreurs.join(' / ') : ''}`);
  };
  const rate = (p, fen, th, base, e) => { console.log(`❌ ${p.cle} ${fen} ${th} ${base} : ${String(e.message || e).slice(0, 200)}`); res.push({ page: p.cle, site: p.site, tache: p.tache, fen, theme: th, base, erreurs: [String(e.message || e).slice(0, 200)], pleins: 0, cibles: [], contraste: [], coupes: [], f: { tete: [], groupes: 0, rangees: 0, casses: [] } }); };
  try {
    for (const base of BASES) for (const fen of FENETRES) for (const th of THEMES) {
      const communes = CHOISIES.filter((p) => !p.ebay), propres = CHOISIES.filter((p) => p.ebay);
      let o = null;
      try {
        for (let i = 0; i < communes.length; i++) {
          const p = communes[i];
          try {
            if (!o) { o = await ouvrirApp(nav, fen, th === 'sombre', base, base === 'vide' ? { nonRelie: true } : {}, p.url); await allerPage(o, p, true); }
            else await allerPage(o, p, false);
            await mesurerIci(o, p, fen, th, base);
          } catch (e) { rate(p, fen, th, base, e); if (o) { await o.ctx.close().catch(() => {}); o = null; } }
        }
      } finally { if (o) await o.ctx.close().catch(() => {}); }
      for (const p of propres) {
        let x = null;
        try { x = await ouvrirApp(nav, fen, th === 'sombre', base, p.ebay, p.url); await allerPage(x, p, true); await mesurerIci(x, p, fen, th, base); }
        catch (e) { rate(p, fen, th, base, e); }
        if (x) await x.ctx.close().catch(() => {});
      }
    }
  } finally { await nav.close(); P.srv.close(); }
  fs.writeFileSync(path.join(SORTIE, 'releve.json'), JSON.stringify(res, null, 1));
  fs.writeFileSync(path.join(SORTIE, 'releve.md'), `# Sites soignés (${new Date().toISOString().slice(0, 16)}, ${process.env.BANC_DIST || 'dist'})\n\n${md(res)}\n`);
  console.log('\n' + md(res) + '\nSorties : ' + SORTIE);
  if (process.env.SEUIL || MUT) {
    const rouges = [];
    for (const r of res) {
      if (r.erreurs.length) rouges.push(`${r.page} ${r.fen} ${r.theme} ${r.base} : erreur de page`);
      if (r.pleins > 1) rouges.push(`${r.page} ${r.fen} ${r.theme} ${r.base} : ${r.pleins} pleins`);
      if (r.base !== 'volume') continue;
      const pg = PAGES.find((x) => x.cle === r.page) || {};
      if (pg.tete && !r.f.tete.length) rouges.push(`${r.page} ${r.fen} ${r.theme} : pas de tête de page native`);
      if (r.cibles.length) rouges.push(`${r.page} ${r.fen} ${r.theme} : ${r.cibles.length} cibles trop petites (${r.cibles.slice(0, 3).join(' / ')})`);
      if (r.coupes.length || r.f.casses.length) rouges.push(`${r.page} ${r.fen} ${r.theme} : texte cassé (${[...r.coupes, ...r.f.casses].slice(0, 3).join(' / ')})`);
    }
    // Mêmes squelettes : pour une même tâche, chaque site a la même tête (ou aucun n'en a : une liste).
    const parTache = {};
    for (const r of res.filter((x) => x.base === 'volume')) (parTache[r.tache + ' ' + r.fen + ' ' + r.theme] ||= []).push(r);
    for (const [k, l] of Object.entries(parTache)) {
      if (l.length < 2) continue;
      const sq = l.map((r) => `${r.site}:${r.f.tete.length ? 'tête' : '—'}`);
      if (new Set(sq.map((s) => s.split(':')[1])).size > 1) rouges.push(`squelettes différents pour ${k} : ${sq.join(' · ')}`);
    }
    if (rouges.length) { console.log(`\n❌ sites soignés : ${rouges.length} rouge(s)\n  ` + rouges.slice(0, 60).join('\n  ')); process.exitCode = 1; }
    else console.log('\n✅ sites soignés : un plein au plus, cibles 44 px, aucun texte cassé, mêmes squelettes');
  }
})();

module.exports = { PAGES, forme };
