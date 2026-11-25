require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  ARGENT, MESSAGES, RÉGLAGES AVEC MOINS DE TEXTE (25 nov.) — Julien : « je veux vraiment que tu regardes toute
//  l'application et que dès qu'il y a du texte, tu l'enlèves ; ou alors si c'est vraiment indispensable tu le mets
//  mais tu fais un bel affichage ». Récit : docs/passation/2026-11-25-moins-texte-b.md (modèle : aujourdhui-moins-texte).
//
//  L'app RENDUE (dist/), base INVENTÉE (`design-passe.cjs` : 3 comptes Vinted, ventes, achats, conversations — aucune
//  donnée réelle, le dépôt est public), Ventes ouvert une fois d'abord (comme chez lui : le reçu, le bénéfice et le
//  CA déclaré sont publiés par Ventes). Chaque VUE est un écran ou un sous-écran : Argent (Résumé, ses replis ouverts,
//  Statistiques, Déclarer, Factures), Messages (la liste, un fil), Paramètres (l'écran et chacune de ses catégories,
//  « Sécurité des données » exceptée : son vocabulaire est assumé, CLAUDE.md §5), le menu, Comptes liés, Extension,
//  À distance, Parrainage (faux serveur : un parrain à 4 filleuls). Il juge — sur les data-* et les nombres rendus :
//    M  MOTS     — les mots VUS (le texte réservé au lecteur d'écran ne compte pas ; un nombre = un mot ; une liste
//                  de lignes compte UNE ligne ; un menu déroulant, son choix) ≤ la part `PART` des mots d'origin/main
//                  mesurés sur la même base (table `ORIGINE`, 25 nov.) — 55 % par défaut ;
//    T  COUPÉ    — aucun chiffre ni titre tronqué (scrollWidth > clientWidth, texte coupé ou en « … ») ;
//    D  DOUBLON  — aucun montant (≥ 100 €) écrit deux fois dans la vue (hors tableaux, graphiques et listes de lignes) ;
//    G  GESTES   — autant de gestes (boutons, liens, menus, champs, replis) qu'origin/main, et les gestes nommés de la vue ;
//    C  COMPTA   — CLAUDE.md §5 « Les chiffres » : un total partiel porte sa couverture (« au moins » ou ≥, lu au moins
//                  au lecteur d'écran) partout où la donnée le marque (`data-au-moins`, `data-ca-min`, `data-sv-partiel`…),
//                  « au moins » reste écrit au porte-monnaie et au registre des achats, jamais « encaissé » à l'écran,
//                  un « pas su » s'écrit « — » (jamais 0).
//  Réglages : `BANC_DIST` (un autre build : l'AVANT), `LARGEURS=390,1512`, `THEMES=clair,sombre`, `ECRANS=a,b`,
//  `SHOTS=<dossier>` (captures à REGARDER + le texte vu), `DSF=2`, `MESURE=1` (mesure seule : imprime la table
//  `ORIGINE` à recopier), `MUTATION=texte|geste|doublon|aumoins` (rouge attendu). Un banc ne meurt pas, il rapporte.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
process.env.TZ = 'Europe/Paris';
const path = require('path'), fs = require('fs');
const P = require('./design-passe.cjs');
const SHOTS = process.env.SHOTS || '';
const MUT = process.env.MUTATION || '';
const MESURE = !!process.env.MESURE;
const liste = (v, d) => String(process.env[v] == null ? d : process.env[v]).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512').map(Number), THEMES = liste('THEMES', 'clair,sombre');
const VOULUS = liste('ECRANS', '');
const DSF = Number(process.env.DSF || 1);
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 600) : '')); } return c; };

// Les mots VUS et les gestes d'origin/main (25 nov., a5f8ea8c1, même base, clair ; le sombre a les mêmes mots),
// [mots 390, gestes 390, mots 1512, gestes 1512]. Recopiés de `MESURE=1 BANC_DIST=<build d'origin/main>`.
const ORIGINE = {
  'argent': [99, 45, 137, 47],
  'argent-replis': [398, 45, 436, 47],
  'stats': [905, 89, 912, 89],
  'declarer': [199, 52, 213, 52],
  'factures': [116, 19, 197, 24],
  'messages': [22, 87, 28, 89],
  'fil': [19, 4, 19, 4],
  'settings': [57, 18, 1248, 113],
  // À l'ordinateur, les catégories des Paramètres sont la MÊME page que `settings` (toutes dépliées) : jugées une fois.
  'reglages-compte': [90, 17, null, null],
  'reglages-plateformes': [45, 16, null, null],
  'reglages-ventes': [23, 8, null, null],
  'reglages-stock': [20, 8, null, null],
  'reglages-argent': [16, 8, null, null],
  'reglages-notifications': [18, 9, null, null],
  'reglages-apparence': [44, 18, null, null],
  'reglages-securite-comptes': [18, 9, null, null],
  'reglages-aide': [81, 27, null, null],
  'menu': [44, 18, 41, 18],
  'comptes': [97, 40, 96, 39],
  'extension': [164, 10, 156, 9],
  'adistance': [124, 13, 118, 11],
  'parrainage': [167, 31, 165, 28],
};
// La part permise. 55 % (la demande) ; une vue qui n'est QU'UNE liste de rangées de navigation ou un tableau de bord
// de chiffres garde une part plus haute, dite ici avec sa raison (le reste de ses mots sont des noms de gestes ou des
// étiquettes de chiffres : les retirer retirerait le geste ou le chiffre).
const LISTE = 'une liste de rangées de navigation : chaque mot restant est le nom d’un geste (la phrase de chaque réglage était déjà cachée au téléphone)';
const PART = {
  stats: [0.78, 0.78, 'un tableau de bord : les mots restants sont les étiquettes des chiffres et des graphiques'],
  argent: [0.75, 0.8, 'les huit replis (des gestes), les quatre segments, la carte DAC7 (une alerte qui dit quoi faire)'],
  'argent-replis': [0.65, 0.68, 'les étiquettes du bilan, du porte-monnaie et des dépenses (des chiffres), « au moins » gardé'],
  declarer: [0.72, 0.75, 'les registres, le récap et l’export : des gestes nommés ; « au moins » du registre des achats gardé'],
  factures: [0.82, 0.9, 'les gestes de facturation électronique et la déclaration des ventes (mentions de la compta)'],
  messages: [1, 1, 'la liste des conversations : son en-tête (filtres) était déjà court'],
  fil: [1, 1, 'un fil : le nom, la paire, le message, « Répondre » — rien de plus à retirer'],
  settings: [1, 0.55, LISTE],
  ...Object.fromEntries(['plateformes', 'ventes', 'stock', 'argent', 'notifications', 'apparence', 'securite-comptes', 'aide'].map((c) => ['reglages-' + c, [1, 1, LISTE]])),
  'reglages-compte': [0.65, 1, 'le profil, l’abonnement, la connexion : des gestes nommés'],
  menu: [0.85, 0.85, 'le menu : chaque mot est un geste'],
  comptes: [0.6, 0.6, 'un compte = son pseudo, sa lecture, ses gestes'],
  parrainage: [1, 1, 'l’écran du parrainage est neuf du 25 nov. (« un vrai interface ») : déjà en chiffres et en étapes illustrées'],
};
const part = (nom, W) => (PART[nom] ? PART[nom][W < 600 ? 0 : 1] : 0.55);

// Chaque vue : l'URL, les gestes pour l'atteindre, les replis ouverts, la liste dont une ligne compte, la racine mesurée,
// les gestes NOMMÉS qui doivent rester, et si la règle « un montant une fois » s'y juge.
const VUES = [
  { nom: 'argent', url: '/?tab=argent', d: true, compta: true,
    gestes: ['[data-argent-q="vendu"]', '[data-argent-q="recu"]', '[data-benef-porte]', '[data-a-venir-ouvrir]', '[data-seuil-compris]', '[data-seuil-source]', '[data-compta-repli="compta-bilan"]'] },
  { nom: 'argent-replis', url: '/?tab=argent', replis: '.vrm-main details', compta: true,
    gestes: ['[data-ca-choix]', '[data-bilan-choix="courant"]', '[data-bilan-regime]', '[data-rapport-choix]', '[data-pack-ouvrir]'], auMoins: true },
  { nom: 'stats', url: '/?tab=stats', d: true, compta: true, gestes: ['[data-sp-cmp-choix="0"]', '[data-mp-saisir]'] },
  { nom: 'declarer', url: '/?tab=argent_declarer', lignes: '[data-rev-ligne]', compta: true, gestes: ['[data-statut="micro"]', '[data-export-preparer]'], auMoins: true },
  { nom: 'factures', url: '/?tab=invoices', lignes: '[data-fe-vente]', d: true, compta: true, gestes: ['[data-fe-recap-csv]', '[data-fe-recap-json]', '[data-fe-facture]'] },
  { nom: 'messages', url: '/?tab=messages', lignes: '[data-fil]', d: true, gestes: ['[data-msg-vue="offres"]', '[data-fil]'] },
  { nom: 'fil', url: '/?tab=messages', clics: ['[data-fil]'], racine: '.vrm-chat-overlay', gestes: ['[data-vrm-panneau]'] },
  { nom: 'settings', url: '/?tab=settings', gestes: ['[data-categorie-ouvrir="donnees"], [data-categorie-ouvrir="securite-donnees"]', '[data-recherche-reglages]'] },
  ...['compte', 'plateformes', 'ventes', 'stock', 'argent', 'notifications', 'apparence', 'securite-comptes', 'aide'].map((c) => ({ nom: 'reglages-' + c, url: '/?tab=settings', clics: [`[data-categorie-ouvrir="${c}"]`], gestes: ['[data-reglage-id]'] })),
  { nom: 'menu', url: '/?tab=menu', gestes: ['[data-vrm-panneau], [data-n-menu-groupe="extension"] button'] },
  { nom: 'comptes', url: '/?tab=vintedaccounts', d: true, gestes: ['[data-comptes-relies-revoir]'] },
  { nom: 'extension', url: '/?tab=extension', d: true, gestes: ['[data-ext-groupe="observation"] [role="switch"], [data-ext-groupe="observation"] button, [data-ext-groupe="observation"] input'] },
  { nom: 'adistance', url: '/?tab=adistance', d: true, gestes: ['[data-adist-groupe="comptes"] button, [data-adist-groupe="comptes"] [role="button"]'] },
  { nom: 'parrainage', url: '/?tab=parrainage', d: true, gestes: [] },
];

// La mesure, DANS la page.
const MESURER = ([v, MUT]) => {
  const main = (v.racine && [...document.querySelectorAll(v.racine)].pop()) || document.querySelector('.vrm-main') || document.body;
  if (v.replis) for (const d of main.querySelectorAll(v.replis)) d.open = true;
  if (MUT === 'texte') { const p = document.createElement('p'); p.textContent = 'Cette phrase longue et inutile explique encore une fois ce que chaque bouton de cet écran fait déjà très bien tout seul, mot après mot, ligne après ligne, sans rien apprendre à personne ni montrer un seul chiffre de plus que ceux déjà affichés au-dessus et au-dessous, jusqu’au bout de la page entière.'.repeat(3); main.appendChild(p); }
  if (MUT === 'geste') { for (const s of v.gestes || []) for (const e of document.querySelectorAll(s)) e.remove(); }
  if (MUT === 'doublon') { const p = document.createElement('p'); const m = (main.innerText.match(/\d{1,3}(?:[\s  ]\d{3})+(?:,\d{2})?\s?€|\d{3,}(?:,\d{2})?\s?€/) || ['1 234 €'])[0]; p.textContent = 'Total ' + m; main.appendChild(p); }
  if (MUT === 'aumoins') { for (const e of document.querySelectorAll('[data-au-moins="1"], [data-ca-min="1"], [data-sv-partiel="1"]')) e.innerHTML = e.innerHTML.replace(/au moins|≥/gi, ''); for (const e of main.querySelectorAll('*')) if (e.children.length === 0 && /au moins/i.test(e.textContent)) e.textContent = e.textContent.replace(/au moins/gi, ''); }
  // Une LISTE (conversations, factures) : ses lignes sont du contenu, pas du texte à couper — une seule compte.
  const rangs = v.lignes ? [...main.querySelectorAll(v.lignes)].slice(1) : [];
  const cacher = (L) => L.map((e) => { const d = e.style.getPropertyValue('display'); e.style.setProperty('display', 'none', 'important'); return () => e.style.setProperty('display', d); });
  const remettre = [];
  remettre.push(...cacher(rangs));
  // Les mots VUS : le texte réservé au lecteur d'écran (1 px, découpé) ne compte pas.
  const sr = (e) => { const cs = getComputedStyle(e); if (cs.position !== 'absolute' && cs.position !== 'fixed') return false; const r = e.getBoundingClientRect(); return /inset\(50%\)/.test(cs.clipPath) || /rect\(0(px)?,? 0(px)?,? 0(px)?,? 0(px)?\)/.test(cs.clip) || (r.width <= 1 && r.height <= 1 && (cs.clipPath !== 'none' || cs.clip !== 'auto')); };
  remettre.push(...cacher([...main.querySelectorAll('*')].filter(sr)));
  // La coque (la ligne de fraîcheur de l'extension, posée sur chaque écran) n'est pas l'écran.
  remettre.push(...cacher([...main.querySelectorAll('[data-fraicheur-deplier], .vrm-fraicheur')]));
  // Un menu déroulant ne montre QUE son choix.
  const menus = [...main.querySelectorAll('select')].map((sel) => { const sp = document.createElement('span'); sp.textContent = sel.selectedOptions && sel.selectedOptions[0] ? sel.selectedOptions[0].textContent : ''; sel.after(sp); return sp; });
  remettre.push(...cacher([...main.querySelectorAll('select')]));
  const texte = main.innerText || '';
  // D : les montants ≥ 100 € écrits deux fois, hors tableaux, graphiques (svg, aria-hidden) et lignes de liste.
  remettre.push(...cacher([...main.querySelectorAll('table, svg, [aria-hidden="true"], [role="img"], [data-fil], [data-fe-vente], .vrm-sv-barres, .vrm-gs, [data-sp-cmp], [data-ca-table]')]));
  const texteD = main.innerText || '';
  remettre.forEach((f) => f()); menus.forEach((sp) => sp.remove());
  const mots = texte.replace(/(\d)[\s  ](?=\d)/g, '$1').split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
  const montants = {}; for (const mm of texteD.matchAll(/(\d{1,3}(?:[\s  ]\d{3})+|\d{3,})(?:,\d{2})?[\s  ]?€/g)) { const k = mm[0].replace(/[\s  ]/g, ''); montants[k] = (montants[k] || 0) + 1; }
  const doubles = Object.entries(montants).filter(([, n]) => n > 1).map(([k, n]) => k + '×' + n);
  // T : les chiffres et titres coupés.
  const coupes = [];
  for (const e of main.querySelectorAll('h1, h2, h3, b, strong, .n-rangee-titre, .n-rangee-valeur, .vrm-sv-tuile-val, .vrm-sv-tuile-lib, .vrm-argent-w-n, .vrm-display, [data-argent-valeur] *, .vrm-set-val, .v2-pm-val, .vrm-bilan-val, .vrm-delai-val, [data-categorie-valeur]')) {
    const r = e.getBoundingClientRect(); if (!e.getClientRects().length || r.width <= 1 || e.closest('[hidden], details:not([open]) > :not(summary)')) continue;
    const cs = getComputedStyle(e);
    if (e.scrollWidth > e.clientWidth + 1 && (cs.textOverflow === 'ellipsis' || /hidden|clip/.test(cs.overflowX))) coupes.push((e.className || e.tagName) + ' « ' + (e.innerText || '').slice(0, 40) + ' » ' + e.scrollWidth + '>' + e.clientWidth);
  }
  // G : les gestes visibles.
  const vis = (e) => { if (!e.getClientRects().length) return false; const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1 && !e.closest('[inert]'); };
  const nGestes = [...main.querySelectorAll('button, a[href], [role="button"], [role="switch"], select, input, textarea, summary')].filter(vis).length;
  const nommes = (v.gestes || []).map((s) => [s, [...document.querySelectorAll(s)].some((e) => e.getClientRects().length || e.closest('details'))]);
  // C : la compta.
  const partiels = [...document.querySelectorAll('[data-au-moins="1"], [data-ca-min="1"], [data-sv-partiel="1"], [data-recap-partiel="1"]')].filter((e) => e.getClientRects().length);
  const partielsMuets = partiels.filter((e) => !/au moins|≥|at least/i.test(e.textContent || '')).map((e) => (e.getAttribute('data-bilan-ligne') || e.getAttribute('data-ca-cur') || e.getAttribute('data-sv-tuile') || e.className || e.tagName) + ' « ' + (e.textContent || '').slice(0, 40) + ' »');
  const encaisse = /encaiss/i.test(texte);
  const zeroPasSu = [...main.querySelectorAll('[data-argent-valeur=""], [data-valeur=""][data-bilan-ligne], [data-vide="1"]')].filter((e) => e.getClientRects().length && /(^|\s)0([,.]00)?\s?€?(\s|$)/.test(e.innerText || '') && !/—/.test(e.innerText || '')).map((e) => (e.innerText || '').slice(0, 30));
  return { mots: mots.length, texte, doubles, coupes, nGestes, nommes, partiels: partiels.length, partielsMuets, encaisse, zeroPasSu, auMoinsVu: /au moins|≥/i.test(texte), debord: document.documentElement.scrollWidth > window.innerWidth + 1 };
};

async function attendreStable(pg) {
  let av = '', eg = 0;
  for (let k = 0; k < 14 && eg < 2; k++) { await pg.waitForTimeout(1100); const s = await pg.evaluate(() => (document.querySelector('.vrm-main') || document.body).innerText); if (s && s === av) eg++; else eg = 0; av = s; }
}

// Le faux serveur du parrainage (inventé : un code, 4 filleuls, des gains) — ce que `mode=parrainage` rend.
const mois = (k) => { const d = new Date(); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - k, 15)).toISOString().slice(0, 7); };
const PARRAIN = {
  ok: true, installe: true, ouvert: true, code: 'K7MQ4RZP', modeTest: false, moisCentimes: 1699, semaineCentimes: 396, nom: 'Camille',
  regle: { pourcent: 20, remise: 10, joursOfferts: 7, seuilCentimes: 2000, delaiJours: 14 },
  suivi: { inscrits: 4, payes: 3, moisOfferts: 1, enAttente: 0 },
  filleuls: [{ rang: 1, inscritLe: '2026-10-02', etat: 'offert' }, { rang: 2, inscritLe: '2026-10-09', etat: 'paye' }, { rang: 3, inscritLe: '2026-11-02', etat: 'paye' }, { rang: 4, inscritLe: '2026-11-20', etat: 'inscrit' }],
  filleul: null,
  gains: { installe: true, mode: 'credit', iban: null,
    chiffres: { filleulsPayants: 3, filleulsAyantPaye: 4, moisCentimes: 877, totalCentimes: 5145, attenteCentimes: 478, crediteCentimes: 4667, aCrediterCentimes: 0, verseCentimes: 0, aVerserCentimes: 0, tropVerseCentimes: 0, seuilCentimes: 2000, parMois: Array.from({ length: 12 }, (_, i) => ({ mois: mois(11 - i), centimes: [0, 0, 0, 0, 0, 0, 339, 339, 678, 1017, 1356, 877][i], n: [0, 0, 0, 0, 0, 0, 1, 1, 2, 3, 4, 3][i] })), historique: [] },
    filleuls: [
      { rang: 1, nom: null, etat: 'paie', plan: 'solo', inscritLe: '2026-09-02', depuis: mois(2), jusquau: null, le: null, moisPayes: 3, gagneCentimes: 1017, prochainCentimes: 339, pourraitCentimes: null, paiements: [] },
      { rang: 2, nom: 'Léa', etat: 'paie', plan: 'pro', inscritLe: '2026-10-09', depuis: mois(1), jusquau: null, le: null, moisPayes: 2, gagneCentimes: 798, prochainCentimes: 399, pourraitCentimes: null, paiements: [] },
      { rang: 3, nom: null, etat: 'essai', plan: 'pro', inscritLe: '2026-11-19', depuis: null, jusquau: new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10), le: null, moisPayes: 0, gagneCentimes: 0, prochainCentimes: null, pourraitCentimes: 399, paiements: [] },
      { rang: 4, nom: null, etat: 'inscrit', plan: null, inscritLe: '2026-11-20', depuis: null, jusquau: null, le: null, moisPayes: 0, gagneCentimes: 0, prochainCentimes: null, pourraitCentimes: 339, paiements: [] },
    ],
    potentiel: { estimation: true, moisCentimes: 738, siTousCentimes: 1476, nPayants: 2, nPossibles: 2 } },
};
const api = (u) => (/mode=parrainage/.test(u) ? PARRAIN : /mode=factures/.test(u) ? { ok: true, carte: null, factures: [] } : null);

(async () => {
  const b = P.base();
  await new Promise((ok) => P.srv.listen(P.PORT, ok));
  const nav = await P.chromium.launch({ executablePath: process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  const res = {}, table = [];
  try {
    for (const W of LARGEURS) for (const theme of THEMES) {
      // Ventes ouvert une fois (il publie le reçu, le bénéfice, le CA déclaré), puis chaque vue rechargée.
      const { ctx, pg, erreurs } = await P.ouvrir(nav, { W, sombre: theme === 'sombre', b, url: '/?tab=ventes', dsf: DSF, api });
      await pg.waitForSelector('.vrm-main', { timeout: 30000 }).catch(() => {});
      await attendreStable(pg);
      for (const v of VUES) {
        if (VOULUS.length && !VOULUS.includes(v.nom)) continue;
        if (W >= 600 && ORIGINE[v.nom] && ORIGINE[v.nom][2] == null && !MESURE) continue;   // la même page que `settings` à l'ordinateur
        const nom = `${v.nom}-${W}-${theme}`;
        erreurs.length = 0;
        try {
          await pg.goto(`http://localhost:${P.PORT}${v.url}`, { waitUntil: 'domcontentloaded' });
          await pg.waitForSelector('.vrm-main', { timeout: 30000 }).catch(() => {});
          await attendreStable(pg);
          for (const c of v.clics || []) { await pg.locator(c).first().click({ timeout: 8000 }).catch(() => console.log('  (clic raté ' + c + ')')); await attendreStable(pg); }
          const r = await pg.evaluate(MESURER, [v, MUT]);
          (res[v.nom] = res[v.nom] || {})[W] = [r.mots, r.nGestes];
          table.push(`${nom} ${r.mots} mots · ${r.nGestes} gestes`);
          console.log(`\n▶ ${nom} : ${r.mots} mots, ${r.nGestes} gestes`);
          if (SHOTS) {
            fs.mkdirSync(SHOTS, { recursive: true }); fs.writeFileSync(path.join(SHOTS, nom + '.txt'), r.texte);
            const h = await pg.evaluate(() => { let m = document.documentElement.scrollHeight; for (const e of document.querySelectorAll('body *')) { const cs = getComputedStyle(e); if (/(auto|scroll)/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 4) m = Math.max(m, e.scrollHeight + e.getBoundingClientRect().top + 120); } return Math.ceil(m); });
            const vp = pg.viewportSize(); await pg.setViewportSize({ width: vp.width, height: Math.min(9000, Math.max(vp.height, h)) }); await pg.waitForTimeout(500);
            await pg.screenshot({ path: path.join(SHOTS, nom + '.png') }); await pg.setViewportSize(vp);
          }
          if (MESURE) continue;
          dit(!erreurs.length, 'aucune erreur de page', erreurs);
          dit(!r.debord, 'aucun défilement de côté');
          const o = ORIGINE[v.nom] ? ORIGINE[v.nom][W < 600 ? 0 : 2] : null;
          if (o != null) dit(r.mots <= Math.floor(o * part(v.nom, W)), `M ${r.mots} mots vus ≤ ${Math.round(part(v.nom, W) * 100)} % des ${o} d’origin/main (${Math.floor(o * part(v.nom, W))})`);
          if (o != null && part(v.nom, W) >= 1) dit(r.mots <= o, `M jamais plus de mots qu’origin/main (${r.mots} ≤ ${o})`);
          dit(!r.coupes.length, 'T aucun chiffre ni titre coupé', r.coupes);
          if (v.d) dit(!r.doubles.length, 'D aucun montant (≥ 100 €) écrit deux fois', r.doubles);
          const og = ORIGINE[v.nom] ? ORIGINE[v.nom][W < 600 ? 1 : 3] : null;
          if (og != null) dit(r.nGestes >= og, `G ${r.nGestes} gestes ≥ ${og} d’origin/main`);
          const manque = r.nommes.filter(([, x]) => !x).map(([s]) => s);
          dit(!manque.length, `G les gestes nommés de la vue sont là (${r.nommes.length})`, manque);
          if (v.compta) {
            dit(!r.encaisse, 'C jamais « encaissé » à l’écran');
            dit(!r.partielsMuets.length, `C chaque total partiel dit « au moins » (${r.partiels})`, r.partielsMuets);
            dit(!r.zeroPasSu.length, 'C un « pas su » s’écrit « — », jamais 0', r.zeroPasSu);
          }
          if (v.auMoins) dit(r.auMoinsVu, 'C « au moins » reste écrit (porte-monnaie, registre des achats)');
        } catch (e) { dit(false, 'mesure ' + nom, String(e && e.stack || e).slice(0, 400)); }
      }
      await ctx.close();
    }
  } finally { await nav.close(); P.srv.close(); }
  console.log('\n' + table.join('\n'));
  if (MESURE) {
    console.log('\nconst ORIGINE = {');
    for (const [k, x] of Object.entries(res)) console.log(`  '${k}': [${x[390] ? x[390].join(', ') : 'null, null'}, ${x[1512] ? x[1512].join(', ') : 'null, null'}],`);
    console.log('};');
  }
  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
