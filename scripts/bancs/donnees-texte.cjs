// ════════════════════════════════════════════════════════════════════════════
//  BANC — « CHAQUE DONNÉE AFFICHÉE EST JUSTE » (28 nov., lot boutons-donnees).
//
//  Julien, 28 nov. : « toutes les données, boutons doivent être parfaits ».
//
//  Sur l'app RENDUE (le vrai `dist/`, garde réseau : rien ne sort, aucune donnée réelle), il ouvre chaque écran et
//  chaque feuille courante de `boutons-inventaire.cjs` (Aujourd'hui, Annonces, Ventes, Achats, Argent, Messages,
//  E-mails, Stock, Paramètres, fiche, Compléter, Relier, Publier sur…, Changer le prix…) avec TROIS bases :
//    · volume — la base de volume inventée (`ecrans-verre-2.baseFiches()`, `_base-messages-stock.apiVolume`) ;
//    · vide   — un vendeur neuf, aucune ligne, aucun compte ;
//    · panne  — toute lecture de la base répond 503 (« pas su »), les routes /api aussi ;
//  et balaie le TEXTE RENDU (contenu de l'écran + feuilles ouvertes, coque native exclue) :
//    T1 jeton technique à l'écran : « undefined », « NaN », « null », « [object Object] », « Infinity », « Invalid Date » ;
//    T2 date invalide : « NaN/NaN », « 01/01/1970 », année 1970 ;
//    T3 pluriel faux : « 1 ventes », « 3 vente » (noms comptés de l'app) ;
//    T4 « au moins 0 € » / « au moins 0,00 € » (§5 : ne se dit jamais) ;
//    T5 « encaissé » (§5 : interdit à l'écran) ;
//    T6 « n/d » (§7 : pas de « n/d ») ;
//    T7 clé de traduction affichée telle quelle (« ecran.ventes.titre ») ;
//    T8 message d'erreur technique à l'écran (TypeError, Failed to fetch, SyntaxError, « Unexpected token ») ;
//    T9 montant mal formé : « € » orphelin, « NaN € », « 12,5 € » (un seul décimal), « €12 » ;
//    T10 (base PANNE seulement) un « 0 € » ou « 0 vente(s)/annonce(s)/achat(s) » : un zéro qui veut dire « pas su » ;
//    T11 erreur de page (pageerror) — un écran qui casse sur une base vide ou en panne ;
//    T12 grand nombre sans séparateur de milliers (« 1025 annonces » ; hors N°, années, identifiants) ;
//    T14 (base PANNE seulement) « aucun compte … relié » : la lecture a échoué, l'absence n'est pas prouvée.
//  Juge le texte rendu (innerText visible), jamais un libellé précis ; chaque défaut sort avec sa phrase en contexte.
//
//  `CAPTURER=1` : une capture de CHAQUE écran (sinon seulement des écrans fautifs).
//  `BASES=volume,vide,panne` `ECRANS=a,b` `LARGEURS=390,1512` `THEMES=clair` `SORTIE=dossier` (défaut
//  /tmp/banc-donnees-texte : `donnees.json`, `donnees.md`, captures des écrans fautifs). `BANC_DIST=…` juge un autre
//  build (avant). `MUTATION=undefined` : pose « undefined € » dans l'écran — le banc doit le voir (sinon rouge).
//  `ADMIS=0` : rouge sur tout défaut (défaut : rouge sur tout défaut, les EXCEPTIONS ci-dessous sont dites).
//  Un banc ne meurt pas : il rapporte (un écran qui ne s'ouvre pas est un défaut, pas un plantage).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');
require('./_porte-banc.cjs');
const P = require('./design-passe.cjs');
const B = require('./_base-messages-stock.cjs');
const E = require('./ecrans-verre-2.cjs');
const { TOUS } = require('./boutons-inventaire.cjs');

const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const SORTIE = process.env.SORTIE || path.join(os.tmpdir(), 'banc-donnees-texte');
fs.mkdirSync(path.join(SORTIE, 'ecrans'), { recursive: true });
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair');
const BASES = liste('BASES', 'volume,vide,panne');
const VOULUS = liste('ECRANS', TOUS.map((e) => e.cle).join(','));
const ECRANS = TOUS.filter((e) => VOULUS.includes(e.cle));
const MUT = process.env.MUTATION || '';
const ATTENTE = Number(process.env.ATTENTE || 2500);

// Un vendeur neuf : aucune ligne de données, aucun compte — seulement les réglages d'arrivée (sinon l'écran de bienvenue).
function baseVide() {
  const at = '2026-11-01T10:00:00.000Z';
  return {
    accounts: [], rows: [],
    main: [{ id: 'main', data: { vrm_bienvenue_vue: { at }, vrm_visite_vue: { at }, vrm_je_vends: { choix: 'sneakers', at },
      vrm_configuration: { etat: 'fait', at, statut: null, version: 1 }, vrm_parcours: { etat: 'fini', at }, vrm_bilan_minute: { vu: at, fin: 'vu' } } }],
  };
}
const panneApi = () => ({ __panne: true });

// ── La mesure, DANS la page ────────────────────────────────────────────────
function lire({ mut }) {
  const COQUE = '.n-onglets, .n-laterale, .n-barre-titre, .vrm-mobile-nav, .vrm-atelier-rail, .vrm-toasts, .n-toast';
  const dialogues = [...document.querySelectorAll('[role="dialog"], [aria-modal="true"], .n-feuille, .n-poussee, .vrm-sheet, dialog[open]')]
    .filter((d) => d.getClientRects().length && getComputedStyle(d).visibility !== 'hidden');
  const contenu = document.querySelector('#vrm-contenu, .vrm-main') || document.body;
  if (mut === 'undefined') { const s = document.createElement('div'); s.textContent = 'Bénéfice undefined €'; contenu.prepend(s); }
  const racines = [contenu, ...dialogues];
  const lignes = []; const vus = new Set();
  for (const r of racines) {
    const w = document.createTreeWalker(r, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const el = n.parentElement; if (!el || vus.has(el)) continue;
      if (el.closest('script, style, noscript, textarea, svg, option, [hidden], [inert], .vrm-sr-only, .sr-only, code, pre')) continue;
      if (el.closest(COQUE) && !el.closest('.n-feuille, .n-poussee, [role="dialog"]')) continue;
      if (el.checkVisibility && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
      if (!el.getClientRects().length) continue;
      vus.add(el);
      // La phrase du bloc (le texte de l'élément le plus proche qui ressemble à une ligne : rangée, paragraphe, bouton).
      const bloc0 = el.closest('li, p, button, [role="button"], .n-rangee, tr, h1, h2, h3, label, dd, dt, td, th');
      const bloc = bloc0 && r.contains(bloc0) && (bloc0.innerText || '').length < 240 ? bloc0 : el;
      const t = (bloc.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
      // Un bloc qui porte un champ (« Je veux toucher [   ] € ») : le chiffre est dans le champ, pas dans le texte.
      // Une PLAQUE de N° (« N° » et le nombre dans deux éléments) : un numéro de rangement s'écrit sans séparateur.
      const plaque = el.closest('.n-plaque, [class*="plaque"], [class*="vrm-num"], [data-num], [data-n-plaque]');
      if (t) lignes.push(((bloc.querySelector && bloc.querySelector('input, select')) || el.closest('.nf-champ-faux, [data-nf-champ]') ? '[saisie] ' : '') + (plaque ? '[num] ' : '') + t.slice(0, 220));
    }
    // Les champs remplis (une valeur « undefined » dans un champ se voit aussi).
    for (const i of r.querySelectorAll('input:not([type=hidden]):not([type=password]), select')) {
      if (!i.getClientRects().length) continue;
      const v = i.tagName === 'SELECT' ? (i.selectedOptions[0] ? i.selectedOptions[0].textContent : '') : (i.value || '') + ' ' + (i.placeholder || '');
      if (v.trim()) lignes.push('[champ] ' + v.trim().slice(0, 120));
    }
  }
  return { lignes: [...new Set(lignes)], titre: document.title, dialogues: dialogues.length };
}

// ── Les règles, HORS de la page (les mêmes pour toutes les bases) ───────────
const NOMS = ['vente', 'annonce', 'achat', 'paire', 'article', 'compte', 'message', 'jour', 'offre', 'commande', 'brouillon', 'photo',
  'favori', 'retrait', 'numéro', 'fiche', 'heure', 'minute', 'semaine', 'chose', 'conversation', 'e-mail', 'facture', 'vendeur', 'acheteur', 'carton', 'lot', 'étape'];
const REGLES = [
  { d: 'T1', re: /(^|[^\w-])(undefined|NaN|null|Infinity)([^\w-]|$)|\[object Object\]|Invalid Date/ },
  { d: 'T2', re: /NaN\/NaN|01\/01\/1970|\b1970\b/ },
  { d: 'T3', re: null, test: (t) => {
    // « 1 ventes » (et pas « 21 ventes », « 1,5 jours », « 1 234 ventes » : le 1 est un nombre seul).
    const m = t.match(new RegExp(`(?<![\\d,.])(?<!\\d[\\s\\u202f\\u00a0])\\b1[\\s\\u202f\\u00a0](${NOMS.join('|')})s\\b`, 'i')); return m ? m[0] : null; } },
  { d: 'T3', re: null, test: (t) => {
    // « 3 vente » : un nombre ≥ 2 suivi du nom au singulier (« 2 ventes » est juste ; « 0 vente » se lit au singulier en français).
    const m = t.match(new RegExp(`(?<![\\w,.-])([2-9]|[1-9]\\d+)[\\s\\u202f\\u00a0](${NOMS.join('|')})(?![s\\wàâçéèêëîïôûùüÿœ-])`));   // casse exacte : « XT-6 Offre » est un titre
    if (!m) return null;
    // « 3 jour(s) », « 2 lot de » : les formes lues comme une unité (« 2 lot de 3 ») restent jugées ; un « N° 2 vente » non.
    if (/N°\s?$/.test(t.slice(0, m.index + 1))) return null;
    return m[0]; } },
  { d: 'T4', re: /au moins\s*[0０][\s  ]?(,0+)?[\s  ]?€/i },
  { d: 'T5', re: /encaiss[ée]/i },
  { d: 'T6', re: /(^|\s)n\/d(\s|$)/i },
  { d: 'T7', re: /(^|\s)(ecran|ecrans|commun|natif|reglages|parametres|ventes|annonces|achats|argent|fiche|stock|messages|emails|aujourdhui|compta|bouton|erreur)\.[a-z][\w]*\.[a-z][\w.]*(\s|$)/i },
  { d: 'T8', re: /TypeError|ReferenceError|SyntaxError|Failed to fetch|NetworkError|Unexpected token|is not a function|Cannot read propert/ },
  // T12 grand nombre sans séparateur de milliers (« 1025 annonces ») : hors N°, années, versions, heures, identifiants.
  { d: 'T12', re: null, test: (t) => {
    const re = /(?<![\w°#.,\/:\u202f\u00a0-])(\d{4,})(?![\w.,\/:%-])/g; let m;
    while ((m = re.exec(t))) {
      const avant = t.slice(Math.max(0, m.index - 4), m.index);
      if (/N°\s?$|n°\s?$|#\s?$/i.test(avant)) continue;
      if (/^(19|20)\d\d$/.test(m[1])) continue;   // une année
      if (m[1].length > 6) continue;                // un identifiant (transaction, suivi)
      if (/^\[(champ|num)\]/.test(t)) continue;
      return m[0];
    }
    return null; } },
  { d: 'T9', re: /NaN[\s\u202f\u00a0]?€|(?<![\d\s\u202f\u00a0])[\s\u202f\u00a0]€(?!\w)|\d,\d[\s\u202f\u00a0]?€|€\d/ },
];
const ZERO_PANNE = /(^|[^\d,.\s  ])[\s  ]?\b0([,.]0+)?[\s  ]?(€|ventes?\b|annonces?\b|achats?\b|colis\b|paires?\b)/i;

// Exceptions DITES (chacune avec sa raison) : un texte qui ressemble à un défaut sans en être un.
const EXCEPTIONS = [
  { d: 'T5', re: /recettes encaissées.*URSSAF|URSSAF.*encaiss/i, pourquoi: 'la phrase cite le vocabulaire de l\'URSSAF (audit-urssaf l\'admet)' },
  { d: 'T9', re: /^\[saisie\]/, pourquoi: 'le montant est dans le champ de saisie, à côté du « € »' },
  { d: 'T1', re: /\[champ\]/, pourquoi: 'jamais : un champ qui affiche undefined est un défaut', jamais: true },
];

function juger(lignes, base) {
  const out = [];
  for (const t of lignes) {
    for (const r of REGLES) {
      const m = r.test ? r.test(t) : (t.match(r.re) || [null])[0];
      if (m == null) continue;
      const ex = EXCEPTIONS.find((x) => x.d === r.d && !x.jamais && x.re.test(t));
      out.push({ d: r.d, extrait: String(m).trim(), phrase: t, admis: ex ? ex.pourquoi : '' });
    }
    if (base === 'panne') { const m = t.match(ZERO_PANNE); if (m) out.push({ d: 'T10', extrait: m[0].trim(), phrase: t, admis: '' }); }
    // T14 (base PANNE) « aucun compte » : une lecture ratée n'est pas une absence prouvée (§5 « rien lu » ≠ « rien »).
    if (base === 'panne') { const m = t.match(/aucun compte[^.]*reli[ée]/i); if (m) out.push({ d: 'T14', extrait: m[0].trim(), phrase: t, admis: '' }); }
  }
  // Un même défaut sur la même phrase une fois.
  const vu = new Set(); return out.filter((x) => { const k = x.d + '|' + x.phrase; if (vu.has(k)) return false; vu.add(k); return true; });
}

async function ouvrirEcran(nav, W, sombre, ec, base) {
  const b = base === 'volume' ? E.baseFiches() : baseVide();
  const api = base === 'volume' ? B.apiVolume : null;
  if (base === 'panne') process.env.BANC_PANNE = '1'; else delete process.env.BANC_PANNE;
  const o = await P.ouvrir(nav, { W, sombre, b: base === 'panne' ? E.baseFiches() : b, url: '/' + ec.url, api });
  if (base === 'panne') {
    // Les routes /api aussi en panne (la dernière route enregistrée passe en premier).
    await o.pg.route('**/api/**', (r) => { const u = r.request().url(); if (/mode=abonnement/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, proprietaire: true, acces: true }) }); return r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"indisponible"}' }); });
  }
  await o.pg.evaluate(() => { try { localStorage.setItem('vrm_design_v2', '1'); } catch (_) {} });
  await o.pg.reload({ waitUntil: 'domcontentloaded' });
  await P.pret(o.pg);
  if (ec.evt) { await o.pg.evaluate((x) => window.dispatchEvent(new CustomEvent(x.nom, { detail: x.detail })), ec.evt); await o.pg.waitForTimeout(ATTENTE); }
  if (ec.clic) await o.pg.waitForSelector(ec.clic, { timeout: 8000, state: 'attached' }).catch(() => {});
  if (ec.clic) { const l = o.pg.locator(ec.clic).first(); if (await l.count()) { await l.click({ timeout: 4000 }).catch(() => {}); await o.pg.waitForTimeout(ATTENTE); } else o.manque = 'clic introuvable : ' + ec.clic; }
  await o.pg.waitForTimeout(800);
  return o;
}

(async () => {
  await new Promise((r) => P.srv.listen(P.PORT, r));
  const nav = await P.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  const resultats = [];
  try {
    for (const base of BASES) for (const W of LARGEURS) for (const th of THEMES) for (const ec of ECRANS) {
      if (base !== 'volume' && /^(fiche|changer-prix)$/.test(ec.cle) && base === 'vide') continue;   // la fiche d'un N° qui n'existe pas
      let o;
      try {
        o = await ouvrirEcran(nav, W, th === 'sombre', ec, base);
        const m = await o.pg.evaluate(lire, { mut: MUT });
        const defauts = juger(m.lignes, base);
        for (const e of o.erreurs) defauts.push({ d: 'T11', extrait: e.slice(0, 120), phrase: '(erreur de page)', admis: '' });
        if (o.manque) defauts.push({ d: 'T11', extrait: o.manque, phrase: '(écran non atteint)', admis: '' });
        const r = { base, ecran: ec.cle, W, theme: th, lignes: m.lignes.length, defauts, texte: m.lignes };
        resultats.push(r);
        const vrais = defauts.filter((x) => !x.admis);
        if (vrais.length || process.env.CAPTURER) await o.pg.screenshot({ path: path.join(SORTIE, 'ecrans', `${base}-${ec.cle}-${W}-${th}.png`) }).catch(() => {});
        console.log(`· ${base} ${ec.cle} ${W} ${th} : ${m.lignes.length} lignes, ${vrais.length} défaut(s)${vrais.length ? ' — ' + vrais.slice(0, 4).map((x) => `${x.d} « ${x.extrait} » dans « ${x.phrase.slice(0, 90)} »`).join(' | ') : ''}`);
      } catch (e) {
        resultats.push({ base, ecran: ec.cle, W, theme: th, lignes: 0, defauts: [{ d: 'T11', extrait: String(e.message || e).slice(0, 160), phrase: '(banc)', admis: '' }] });
        console.log(`❌ ${base} ${ec.cle} ${W} ${th} : ${String(e.message || e).slice(0, 160)}`);
      }
      if (o) await o.ctx.close().catch(() => {});
    }
  } finally { await nav.close(); P.srv.close(); delete process.env.BANC_PANNE; }
  const tous = resultats.flatMap((r) => r.defauts.map((d) => ({ ...d, base: r.base, ecran: r.ecran, W: r.W, theme: r.theme })));
  const vrais = tous.filter((x) => !x.admis);
  // Le tableau : un défaut par (règle, phrase), avec les écrans où il paraît.
  const groupes = new Map();
  for (const x of vrais) { const k = x.d + '|' + x.phrase; const g = groupes.get(k) || { d: x.d, extrait: x.extrait, phrase: x.phrase, ou: new Set() }; g.ou.add(`${x.base}/${x.ecran}/${x.W}`); groupes.set(k, g); }
  const md = ['| règle | extrait | phrase | où |', '|---|---|---|---|', ...[...groupes.values()].sort((a, b) => a.d.localeCompare(b.d)).map((g) => `| ${g.d} | ${g.extrait.replace(/\|/g, '\\|')} | ${g.phrase.slice(0, 140).replace(/\|/g, '\\|')} | ${[...g.ou].slice(0, 6).join(', ')}${g.ou.size > 6 ? ` +${g.ou.size - 6}` : ''} |`)].join('\n');
  fs.writeFileSync(path.join(SORTIE, 'donnees.md'), `# Données affichées (${new Date().toISOString().slice(0, 16)}, ${process.env.BANC_DIST || 'dist'})\n\n${md}\n`);
  fs.writeFileSync(path.join(SORTIE, 'donnees.json'), JSON.stringify(resultats, null, 1));
  console.log('\n' + md);
  const admis = tous.filter((x) => x.admis);
  console.log(`\n${resultats.length} écrans lus · ${groupes.size} défaut(s) distinct(s) · ${admis.length} admis (${[...new Set(admis.map((x) => x.admis))].join(' ; ') || '—'})\nSorties : ${SORTIE}`);
  if (MUT === 'undefined') { const vu = vrais.some((x) => x.d === 'T1' && /undefined/.test(x.extrait)); console.log(vu ? '✅ mutation vue' : '❌ mutation PAS vue'); process.exitCode = vu ? 0 : 1; return; }
  if (groupes.size) { console.log('❌ défauts de données à l\'écran'); process.exitCode = 1; } else console.log('✅ aucun défaut de donnée');
})();
