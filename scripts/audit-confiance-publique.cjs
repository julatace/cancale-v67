// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — LES PAGES PUBLIQUES /confiance ET /etat (13 nov., lot 50 + 52)
//
//  /confiance (public/confiance.html) dit à un vendeur qui ne connaît pas VRM ce
//  qu'il LIT, ce qui ne part que sur SON clic, ce qui peut se faire seul (éteint
//  au départ), les plafonds, ce qu'il ne fera JAMAIS, et où sont ses données.
//  ⚠️ CHAQUE PHRASE EST UNE PROMESSE (§2.3, §2.7) : chaque `data-affirmation` de
//     la page a ici sa PREUVE (fichier + morceau de code qui la tient), et l'audit
//     JUGE les règles elles-mêmes — les nombres de la page (`data-chiffre`) sont
//     RELUS dans le code (plafond d'actions, pause, prudence, montée, plafond du
//     jour, favoris auto, suppressions Leboncoin, relais serveur), les modes
//     automatiques sont éteints par défaut, rien n'est simulé sur Vinted, VRM ne
//     pose jamais « livraison gratuite »… Changer le code sans changer la phrase ⇒
//     rouge. Les preuves vivent ICI, jamais dans la page (aucun nom de fichier ni
//     identifiant interne sur une page publique — K).
//  /etat (public/etat.js) : la règle `juger` EXÉCUTÉE — pas de réponse, réponse
//     sans `etat`, `ok:false`, heure absente ou vieille de plus de 10 min ⇒
//     « inconnu », JAMAIS « ok » ; « ok » seulement si les trois morceaux le
//     disent ; et des champs de /api/sante, seul `etat` est lu.
//  Les liens : accueil (FAQ + pied de page), connexion (DOCS_LEGAUX), /etat.
//
//  `node scripts/audit-confiance-publique.cjs`           — l'audit
//  `node scripts/audit-confiance-publique.cjs --prouve`  — chaque mutation ⇒ ROUGE
//  `CONFIANCE_RACINE=<arbre>` : juger un autre arbre (archive d'origin/main).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm');
const { spawnSync } = require('child_process');
const R = process.env.CONFIANCE_RACINE || path.join(__dirname, '..');
const silencieux = process.argv.includes('--silencieux');
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; if (!silencieux) console.log('✅ ' + m); } else { ko++; console.log('❌ ' + m + (d != null && d !== '' ? '  → ' + String(typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 400) : '')); } };
const lire = (f) => { try { return fs.readFileSync(path.join(R, f), 'utf8'); } catch (_) { return ''; } };
const sansCommentaires = (js) => js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/.*$/gm, '$1');
const BG = 'vinted-sync-extension/background.js';
const nombre = (src, re) => { const m = re.exec(src); return m ? Number(m[1]) : NaN; };

// ── Les preuves : une par affirmation de la page ─────────────────────────────
// [fichier, morceau de code exact]. Une preuve absente ⇒ la phrase n'est plus tenue.
const PREUVES = {
  'lu-comptes': [[BG, 'async function capterReleves'], [BG, 'rangerLbcFil'], [BG, 'rangerVcFil'], ['api/ebay.js', '?mode=callback']],
  'lu-navigateur': [['src/freinRelaisVinted.js', 'export const MAX_PAR_FENETRE'], ['public/legal/confidentialite.html', 'Elle lit les réponses que ces sites envoient déjà à ta page']],
  'lu-mots-de-passe': [['api/vinted-connect.js', 'CONNEXION D\'UN COMPTE VINTED PAR TOKEN'], ['api/ebay.js', 'RETOUR DE CONSENTEMENT'], ['public/legal/confidentialite.html', 'Ces identifiants de session sont stockés dans ton espace VRM']],
  'lu-pas-le-reste': [[BG, 'const WREQ_SENSIBLE = /bank_account'], ['public/legal/confidentialite.html', 'Elle ne collecte pas ton historique de navigation']],
  'lu-emails': [['api/email-inbound.js', 'export default']],
  'clic-repondre': [[BG, 'const EXEC_PERMIS = [']],
  'clic-favoris': [['src/favorisAuto.js', 'actif: false']],
  'clic-supprimer': [[BG, 'async function supprimeLbcDepuisApp'], [BG, 'const LBC_SUPPRIME_MAX_HEURE']],
  'clic-republier': [[BG, 'async function recreerVinted']],
  'clic-publier': [[BG, 'async function publierVestiaire'], ['src/BaissePrixSerie.jsx', 'Rien ne part avant son clic']],
  'auto-offres': [[BG, 'const actif = m.vinted_offres_auto === true;']],
  'auto-ebay-offres': [['api/ebay.js', 'BestOfferAutoAcceptPrice']],
  'auto-favoris': [['src/favorisAuto.js', 'export const AUTO_DEFAUT']],
  'auto-ebay': [['src/ecrans/Ebay.jsx', "load('vrm_ebay_retrait_auto', false) === true"], ['api/ebay.js', "if (v !== 'true') return { status: 403"]],
  'auto-bordereaux': [[BG, 'async function bordereauxAutoActifs'], ['src/App.jsx', 'rows[0]?.data?.active === true']],
  'limite-heure': [[BG, 'const ACTIONS_MAX_HEURE ='], [BG, 'const MONTEE_PALIERS =']],
  'limite-jour': [[BG, 'const DISCRETION_JOUR_DEFAUT ='], ['src/discretion.js', 'export const PAR_JOUR_DEFAUT']],
  'limite-une': [[BG, '_fileRequetes = suite.then']],
  'limite-pause': [[BG, 'const PAUSE_PALIERS_MIN ='], [BG, 'const PRUDENCE_ACTIONS_HEURE =']],
  'limite-verification': [[BG, 'captchaEnCours'], [BG, '« Reprendre »']],
  'limite-compte': [[BG, 'async function gardeStricte']],
  'jamais-souris': [['vinted-sync-extension/manifest.json', '"content_scripts"']],
  'jamais-supprimer': [[BG, 'const EXEC_PERMIS = [']],
  'jamais-etiquette': [['api/ebay.js', 'VRM ne pose jamais « livraison gratuite »']],
  'jamais-prix-achat': [['src/prixAchatPropose.js', 'rien n\'est écrit sans son tap']],
  'jamais-vendre': [['public/legal/confidentialite.html', 'VRM ne vend aucune donnée']],
  'donnees-ou': [['public/legal/confidentialite.html', 'région eu-west-1'], ['supabase/migrations/001-multi-utilisateurs.sql', 'using (owner = auth.uid())']],
  'donnees-journal': [['src/i18n/langues/fr.js', '"reglages.tes-donnees.lib": "Confidentialité : ce que VRM lit et garde"']],
  'donnees-exporter': [['src/composants/TesDonnees.jsx', 'titre="Exporter mes données"'], ['public/legal/confidentialite.html', 'Seuls les PDF de bordereau, les pièces jointes et les jetons de connexion n’y sont pas']],
  'donnees-supprimer': [['src/ecrans/Reglages.jsx', 'Supprimer mon compte'], ['public/legal/confidentialite.html', 'après la suppression de ton compte, sans accès'], ['public/legal/confidentialite.html', 'si tu veux qu’une suppression les couvre aussi, écris-nous']],
};

(async () => {
  const html = lire('public/confiance.html');
  const visible = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<style[\s\S]*?<\/style>/gi, '');
  const texte = visible.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
  const bg = lire(BG);

  // ── P. La page existe, servie comme une page statique ──────────────────────
  if (!silencieux) console.log('\n── P. la page /confiance');
  const vercel = (() => { try { return JSON.parse(lire('vercel.json')); } catch (_) { return null; } })();
  dit(!!html, 'P1 public/confiance.html existe');
  dit(vercel && (vercel.rewrites || []).some((x) => x.source === '/confiance' && x.destination === '/confiance.html'), 'P2 vercel.json : /confiance → /confiance.html');
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  const srcs = scripts.map((m) => (/\bsrc="([^"]+)"/.exec(m[1]) || [])[1] || null);
  dit(html && scripts.length === 1 && scripts[0][2].trim() === '' && srcs[0] === '/confiance.js' && !/\son[a-z]+="/i.test(html), 'P3 aucun script ni gestionnaire en ligne ; un seul script, /confiance.js (la CSP n’en permet pas d’autre)', srcs);
  const fichiers = [...html.matchAll(/<(?:script|img|link)[^>]*\b(?:src|href)="(\/[^"]+)"/g)].map((m) => m[1]);
  dit(html && fichiers.length && fichiers.every((f) => fs.existsSync(path.join(R, 'public', f))) && !/<(iframe|img|link|script)\b[^>]*\b(src|href)="https?:\/\//i.test(html), 'P4 ses fichiers sont dans public/, rien chargé d’un autre site', fichiers);
  const cjs = sansCommentaires(lire('public/confiance.js'));
  dit(cjs && !/fetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|localStorage\.setItem|importScripts/.test(cjs) && [...cjs.matchAll(/localStorage\.(\w+)\(\s*([^)]*)\)/g)].every((m) => m[1] === 'getItem' && /^['"]vinted_dark['"]$/.test(m[2].trim())), 'P5 /confiance.js ne lit ni n’envoie rien (le thème seulement)');
  const sw = lire('public/sw.js');
  const iC = sw.indexOf("url.pathname === '/confiance'"), iN = sw.indexOf("if (req.mode === 'navigate') {");
  dit(iC > 0 && iC < iN, 'P6 le service worker la laisse au réseau (elle ne remplace jamais l’app en cache)');

  // ── K. Rien d'interne ni de personnel sur la page publique ─────────────────
  if (!silencieux) console.log('\n── K. aucune donnée personnelle ni identifiant interne');
  const internes = [
    [/\b[\w-]+\.(?:cjs|mjs|jsx)\b/, 'nom de fichier du code'], [/\b(?:api|src|scripts|supabase)\/[\w./-]+/, 'chemin du dépôt'],
    [/\bvrm_[a-z_]+|\bharvest_|\bapp_data\b|\bvinted_accounts\b/, 'nom de ligne de la base'], [/lgonxzrzjcqthjtbdpzo/, 'identifiant du projet'],
    [/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i, 'identifiant'], [/[\w.+-]+@[\w-]+\.[\w.]+/, 'adresse e-mail'],
    [/\b(?:ACTIONS_MAX_HEURE|RESERVE_GESTES|requeteVinted|vrmPauseVinted|garde(?:Stricte)?\b|EXEC_PERMIS)\b/, 'nom de fonction ou de constante'],
    [/\b0[1-9](?:[ .]?\d{2}){4}\b/, 'numéro de téléphone'], [/@[a-z0-9_]{3,}/i, 'pseudo'],
  ];
  const vus = internes.filter(([re]) => re.test(html.replace(/<style[\s\S]*?<\/style>/gi, ''))).map(([, n]) => n);
  dit(html && !vus.length, 'K1 la page (commentaires compris) ne porte ni chemin, ni fichier, ni nom de ligne, ni identifiant, ni e-mail, ni pseudo', vus);

  // ── A. Chaque affirmation a sa preuve, chaque preuve existe ────────────────
  if (!silencieux) console.log('\n── A. chaque phrase est tenue par le code');
  const affs = [...html.matchAll(/data-affirmation="([a-z-]+)"/g)].map((m) => m[1]);
  const sans = affs.filter((a) => !PREUVES[a]);
  const enTrop = Object.keys(PREUVES).filter((k) => !affs.includes(k));
  dit(affs.length >= 25 && !sans.length && !enTrop.length && new Set(affs).size === affs.length, `A1 ${affs.length} affirmations, chacune avec sa preuve (aucune sans, aucune en trop)`, { sans, enTrop });
  const manquent = [];
  for (const [id, ps] of Object.entries(PREUVES)) for (const [f, c] of ps) if (!lire(f).includes(c)) manquent.push(`${id} : ${f} « ${c} »`);
  dit(!manquent.length, 'A2 chaque preuve existe dans le code', manquent);
  for (const s of ['lu', 'clic', 'auto', 'limites', 'jamais', 'donnees']) dit(new RegExp(`data-section="${s}"`).test(html), `A3 la section « ${s} » est là`);

  // ── N. Les nombres de la page = ceux du code ───────────────────────────────
  if (!silencieux) console.log('\n── N. les nombres de la page sont ceux du code');
  const chiffre = (id) => { const m = new RegExp(`data-chiffre="${id}">([^<]+)<`).exec(html); return m ? m[1].trim() : null; };
  const paliers = (() => { const m = /const PAUSE_PALIERS_MIN = \[([^\]]+)\]/.exec(bg); return m ? m[1].split(',').map(Number) : null; })();
  const montee = (() => { const m = /const MONTEE_PALIERS = \[([^\]]+)\]/.exec(bg); return m ? m[1].split(',').map(Number) : null; })();
  const fa = lire('src/favorisAuto.js'), defaut = (/export const AUTO_DEFAUT = Object\.freeze\((\{[^)]*\})\)/.exec(fa) || [])[1];
  let auto = null; try { auto = defaut ? vm.runInNewContext('(' + defaut + ')') : null; } catch (_) { auto = null; }
  const relais = lire('src/freinRelaisVinted.js');
  const attendus = [
    ['actions-heure', nombre(bg, /const ACTIONS_MAX_HEURE = (\d+)/), 'ACTIONS_MAX_HEURE'],
    ['actions-jour', nombre(bg, /const DISCRETION_JOUR_DEFAUT = (\d+)/), 'DISCRETION_JOUR_DEFAUT'],
    ['prudence-heure', nombre(bg, /const PRUDENCE_ACTIONS_HEURE = (\d+)/), 'PRUDENCE_ACTIONS_HEURE'],
    ['pause-min', paliers ? paliers[0] : NaN, 'PAUSE_PALIERS_MIN[0] (min)'],
    ['pause-max', paliers ? paliers[paliers.length - 1] / 60 : NaN, 'PAUSE_PALIERS_MIN[fin] (h)'],
    ['lbc-suppressions-heure', nombre(bg, /const LBC_SUPPRIME_MAX_HEURE = (\d+)/), 'LBC_SUPPRIME_MAX_HEURE'],
    ['favoris-jour', auto ? auto.parJour : NaN, 'AUTO_DEFAUT.parJour'],
    ['favoris-heure', auto ? auto.parHeure : NaN, 'AUTO_DEFAUT.parHeure'],
    ['relais-demi-heure', /FENETRE_MS = 30 \* 60 \* 1000/.test(relais) ? nombre(relais, /MAX_PAR_FENETRE = (\d+)/) : NaN, 'MAX_PAR_FENETRE par 30 min'],
  ];
  for (const [id, code, nom] of attendus) dit(Number.isFinite(code) && chiffre(id) === String(code), `N ${id} : la page dit ${chiffre(id)}, le code (${nom}) dit ${code}`);
  dit(Number(nombre(lire('src/discretion.js'), /export const PAR_JOUR_DEFAUT = (\d+)/)) === Number(chiffre('actions-jour')), 'N le plafond du jour de l’app (PAR_JOUR_DEFAUT) est le même');
  dit(montee && chiffre('montee') === montee.slice(0, -1).join(', ') + ' puis ' + montee[montee.length - 1], `N montée d’un compte neuf : la page dit « ${chiffre('montee')} », le code ${montee}`);

  // ── G. Les règles elles-mêmes ──────────────────────────────────────────────
  if (!silencieux) console.log('\n── G. les règles que la page promet');
  dit(auto && auto.actif === false, 'G1 le mode auto des favoris est éteint par défaut', auto);
  dit(/const actif = m\.vinted_offres_auto === true;/.test(bg) && /if \(!reg \|\| !reg\.actif\) return 0;/.test(bg), 'G2 l’acceptation auto des offres Vinted n’est allumée que par un vrai « oui » (absent ⇒ éteint)');
  dit(/load\('vrm_ebay_retrait_auto', false\) === true/.test(lire('src/ecrans/Ebay.jsx')) && /if \(v !== 'true'\) return \{ status: 403/.test(lire('api/ebay.js')), 'G3 le retrait eBay automatique : éteint par défaut, et le serveur le re-vérifie');
  dit(/return rows\.length === 1 && rows\[0\]\?\.data\?\.active === true;/.test((/async function bordereauxAutoActifs[\s\S]*?\n\}/.exec(bg) || [''])[0]), 'G4 bordereaux automatiques : éteints tant que la ligne ne dit pas « active: true »');
  // Rien n'est simulé sur Vinted : ni les scripts injectés sur Vinted, ni le service worker
  // (d'où partent les fonctions injectées) ne fabriquent un clic, une frappe ou un évènement.
  let man = null; try { man = JSON.parse(lire('vinted-sync-extension/manifest.json')); } catch (_) {}
  const surVinted = man ? [...new Set((man.content_scripts || []).filter((c) => (c.matches || []).some((m) => /vinted\./.test(m))).flatMap((c) => c.js || []))] : [];
  const SIMULE = /dispatchEvent\s*\(|\.click\s*\(\s*\)|new\s+(?:Mouse|Keyboard|Pointer|Touch|Input|Drag)Event\b|\.(?:sendKeys|execCommand)\s*\(/;
  // Une exception, NOMMÉE et bornée : la petite carte VRM (vrm-badge.js) dessine SON formulaire
  // de connexion à VRM dans une shadow root FERMÉE (la page ne la voit pas) et y vide son propre
  // champ (un seul `dispatchEvent(new Event('blur'))`) — rien n'y touche la page de Vinted.
  const CARTE = 'vrm-badge.js', carte = sansCommentaires(lire('vinted-sync-extension/' + CARTE));
  const carteBornee = /attachShadow\(\{ mode: 'closed' \}\)/.test(carte) && (carte.match(/dispatchEvent\s*\(/g) || []).length === 1 && /c\.dispatchEvent\(new Event\('blur'\)\)/.test(carte) && !/\.click\s*\(\s*\)|new\s+(?:Mouse|Keyboard|Pointer|Touch|Input|Drag)Event\b/.test(carte);
  const simulent = ['background.js', ...surVinted].filter((f) => !(f === CARTE && carteBornee) && SIMULE.test(sansCommentaires(lire('vinted-sync-extension/' + f))));
  dit(surVinted.length >= 2 && !simulent.length, `G5 sur Vinted rien n’est simulé : ni clic ni frappe dans ${['background.js', ...surVinted].join(', ')} (la carte VRM : son propre champ, shadow root fermée)`, simulent);
  const bloc = (/const EXEC_PERMIS = \[[\s\S]*?\n\];/.exec(bg) || [''])[0];
  let permis = null; try { permis = vm.runInNewContext(bloc.replace('const EXEC_PERMIS =', '(').replace(/\];$/, '])')); } catch (_) { permis = null; }
  const supprime = Array.isArray(permis) ? permis.filter((p) => p.methode === 'DELETE' || ['/api/v2/items/5', '/api/v2/items/5/delete', '/api/v2/items/5/hide'].some((e) => p.chemin.test(e))) : null;
  dit(Array.isArray(permis) && permis.length >= 5 && supprime.length === 0, 'G6 aucune commande de l’app ne supprime une annonce Vinted (EXEC_PERMIS exécuté)', supprime && supprime.map((p) => p.methode + ' ' + p.chemin));
  const fonctions = [...lire('api/ebay.js').matchAll(/\/sell\/logistics|createShippingQuote|purchaseShippingLabel|shipping_label/gi)].map((m) => m[0]);
  dit(!fonctions.length && /if \(port == null\) return \{ err: 'Frais de port : un montant en euros, non nul/.test(lire('api/ebay.js')), 'G7 eBay : aucun achat d’étiquette, et un port à 0 est refusé (jamais « livraison gratuite »)', fonctions);
  const tour = (/function requeteVinted\(quoi, fn, qui\) \{[\s\S]*?\n\}/.exec(bg) || [''])[0];
  dit(/const p = await pauseVinted\(\);\s*\n\s*if \(p\) \{[^\n]*return \{[^\n]*pause: true/.test(tour) && /_fileRequetes = suite\.then/.test(tour) && /if \(r && freinVinted\(r\.status\)\) await poserPauseVinted/.test(tour), 'G8 une requête Vinted à la fois ; pendant une pause, rien ne part ; un 429/403 pose la pause');
  dit(/const freinVinted = \(s\) => s === 429 \|\| s === 403;/.test(bg), 'G9 « Vinted refuse » = 429 ou 403');
  // La carte VRM porte UN champ de mot de passe : celui de VRM (« Mot de passe VRM »), dans sa
  // shadow root fermée. Aucun autre script injecté ne cherche ni ne lit un champ de mot de passe.
  const PASSE = /type=["']?password|\[type=["']?password|input\[type="password"\]|\.type\s*===?\s*['"]password/i;
  const motsDePasse = (man ? [...new Set((man.content_scripts || []).flatMap((c) => c.js || []))] : []).filter((f) => {
    const s = sansCommentaires(lire('vinted-sync-extension/' + f));
    if (f === CARTE) return !(carteBornee && (s.match(/type="password"/g) || []).length === 1 && /type="password"[^>]*placeholder="Mot de passe VRM"/.test(s) && !/querySelector(?:All)?\([^)]*password/i.test(s));
    return PASSE.test(s);
  });
  dit(man && !motsDePasse.length, 'G10 aucun script injecté ne touche un mot de passe de site de revente (la carte : le seul « Mot de passe VRM »)', motsDePasse);

  // ── E. La règle de /etat, EXÉCUTÉE ─────────────────────────────────────────
  if (!silencieux) console.log('\n── E. /etat : pas de réponse ⇒ « inconnu », jamais « tout va bien »');
  const ejs = lire('public/etat.js');
  let juger = null, PERIME = null;
  try {
    const ctx = { window: {}, document: { readyState: 'loading', addEventListener() {}, documentElement: { setAttribute() {} } }, localStorage: { getItem: () => null }, Date, Array, Object, JSON, isFinite, Math, String };
    vm.createContext(ctx); vm.runInContext(ejs, ctx);
    juger = ctx.window.VRM_ETAT && ctx.window.VRM_ETAT.juger; PERIME = ctx.window.VRM_ETAT && ctx.window.VRM_ETAT.PERIME_MS;
  } catch (_) { juger = null; }
  if (typeof juger !== 'function') dit(false, 'E0 la règle `juger` de /etat est exécutable (window.VRM_ETAT)');
  else {
    const T = Date.parse('2026-11-13T10:00:00Z'), iso = (ms) => new Date(T - ms).toISOString();
    const tout = (x, h = iso(5000)) => ({ ok: true, serviceKey: true, owner: true, etat: { base: x, emails: x, notifications: x, verifieA: h } });
    const cas = [
      ['pas de réponse (null)', null, 'inconnu'], ['réponse vide', {}, 'inconnu'], ['ok:false', { ok: false, etat: tout('ok').etat }, 'inconnu'],
      ['sans « etat »', { ok: true, serviceKey: true, owner: true }, 'inconnu'], ['« etat » en liste', { ok: true, etat: [] }, 'inconnu'],
      ['heure absente', { ok: true, etat: { base: 'ok', emails: 'ok', notifications: 'ok' } }, 'inconnu'],
      ['heure illisible', tout('ok', 'hier'), 'inconnu'], ['vérification de 11 min', tout('ok', iso(11 * 60000)), 'inconnu'],
      ['vérification de 9 min', tout('ok', iso(9 * 60000)), 'ok'], ['tout ok', tout('ok'), 'ok'],
      ['e-mails en panne', { ok: true, etat: { base: 'ok', emails: 'panne', notifications: 'ok', verifieA: iso(1000) } }, 'panne'],
      ['un morceau « inconnu »', { ok: true, etat: { base: 'ok', emails: 'inconnu', notifications: 'ok', verifieA: iso(1000) } }, 'partiel'],
      ['une valeur jamais vue', { ok: true, etat: { base: 'ok', emails: 'degrade', notifications: 'ok', verifieA: iso(1000) } }, 'partiel'],
      ['un morceau absent', { ok: true, etat: { base: 'ok', emails: 'ok', verifieA: iso(1000) } }, 'partiel'],
      ['ok + config (propriétaire)', { ...tout('ok'), config: { ia: true } }, 'ok'],
    ];
    for (const [nom, sante, att] of cas) { const j = juger(sante, T); dit(j && j.global === att, `E ${nom} ⇒ ${att}`, j); }
    dit(PERIME === 10 * 60000, 'E une vérification de plus de 10 min ne dit rien de maintenant', PERIME);
    // « ok » n'est rendu QUE si les trois morceaux disent « ok » (tirage exhaustif).
    const V = ['ok', 'panne', 'inconnu', undefined, 'x'];
    let faux = [];
    for (const a of V) for (const b of V) for (const c of V) { const j = juger({ ok: true, etat: { base: a, emails: b, notifications: c, verifieA: iso(1000) } }, T); if ((j.global === 'ok') !== (a === 'ok' && b === 'ok' && c === 'ok')) faux.push([a, b, c, j.global]); }
    dit(!faux.length, 'E « Tout fonctionne » seulement si base, e-mails et notifications disent « ok » (125 combinaisons)', faux.slice(0, 5));
  }
  const sj = sansCommentaires(ejs);
  dit(!/sante\.(?:config|serviceKey|owner|statut)\b|\.config\b/.test(sj) && /sante\.etat/.test(sj), 'E de /api/sante, seul `etat` est lu (ni la configuration, ni le reste)');
  dit(!/prévenus/.test(sj) && /'État inconnu'/.test(sj) && !/'VRM ne répond pas'/.test(sj), 'E la page ne promet plus « nous sommes prévenus » et dit « État inconnu » sans réponse');

  // ── L. Les liens ───────────────────────────────────────────────────────────
  if (!silencieux) console.log('\n── L. la page est liée depuis l’accueil, la connexion et /etat');
  const acc = lire('src/Accueil.jsx');
  const pied = (/<footer className="av-pied">[\s\S]*?<\/footer>/.exec(acc) || [''])[0];
  dit(/href="\/confiance"/.test(pied), 'L1 le pied de page de l’accueil');
  dit(/id: 'securite', r: \(\) => \[[^\n]*href="\/confiance"/.test(acc), 'L2 la question « Mes données sont-elles en sécurité ? » de l’accueil');
  const docs = (/const DOCS_LEGAUX = \[[\s\S]*?\n\];/.exec(lire('src/App.jsx')) || [''])[0];
  dit(/docLegal\('\/confiance', 'legal\.confiance'\)/.test(docs) && /<LiensLegaux\/>/.test(lire('src/App.jsx')), 'L3 l’écran de connexion (et Réglages) : DOCS_LEGAUX');
  const langues = ['fr', 'en', 'es', 'it', 'de'].filter((l) => !/"legal\.confiance": "[^"]+"/.test(lire(`src/i18n/langues/${l}-accueil.js`)));
  dit(!langues.length, 'L4 le libellé existe dans les cinq langues', langues);
  dit(/href="\/confiance"/.test(lire('public/etat.html')) && /href="\/etat"/.test(html), 'L5 /etat ↔ /confiance');
  dit(/<loc>https:\/\/vrm\.center\/confiance<\/loc>/.test(lire('public/sitemap.xml')), 'L6 dans le plan du site');
  dit(/Ce que VRM fait/.test(texte) && /ne fait jamais/.test(texte), 'L7 le titre dit ce qu’elle est');

  // ── --prouve : chaque mutation doit rendre l'audit ROUGE ───────────────────
  if (process.argv.includes('--prouve') && !process.env.CONFIANCE_RACINE) {
    console.log('\n── --prouve');
    const MUT = [
      ['TÉMOIN : la copie sans mutation doit rester VERTE', 'public/confiance.html', '<main data-confiance="">', '<main data-confiance="">'],
      ['plafond d’actions monté à 60 sans changer la page', BG, 'const ACTIONS_MAX_HEURE = 50', 'const ACTIONS_MAX_HEURE = 60'],
      ['pause de 5 min au lieu de 15', BG, 'const PAUSE_PALIERS_MIN = [15,', 'const PAUSE_PALIERS_MIN = [5,'],
      ['mode auto des favoris allumé par défaut', 'src/favorisAuto.js', 'Object.freeze({ actif: false,', 'Object.freeze({ actif: true,'],
      ['offres auto allumées si le réglage manque', BG, 'const actif = m.vinted_offres_auto === true;', 'const actif = m.vinted_offres_auto !== false;'],
      ['un clic simulé sur Vinted', 'vinted-sync-extension/content.js', '(function', '(function(){try{document.body.dispatchEvent(new MouseEvent("click"));}catch(_){}})();\n(function'],
      ['/etat : pas de réponse ⇒ « ok »', 'public/etat.js', "if (!e) return { global: 'inconnu', morceaux: inconnus, raison: 'muet' };", "if (!e) return { global: 'ok', morceaux: { base: 'ok', emails: 'ok', notifications: 'ok' }, raison: 'muet' };"],
      ['/etat : une vieille vérification vaut maintenant', 'public/etat.js', "if (maintenant - t > PERIME_MS) return", "if (false) return"],
      ['/etat : « inconnu » compté comme « ok »', 'public/etat.js', "m[k] = e[k] === 'ok' || e[k] === 'panne' ? e[k] : 'inconnu';", "m[k] = e[k] === 'panne' ? 'panne' : 'ok';"],
      ['une affirmation ajoutée sans preuve', 'public/confiance.html', '<li data-affirmation="limite-une">', '<li data-affirmation="limite-magique"><b>x</b></li>\n      <li data-affirmation="limite-une">'],
      ['un nom de ligne interne sur la page', 'public/confiance.html', 'Jamais deux en même temps.', 'Jamais deux en même temps (vrm_actions).'],
      ['le lien du pied de page retiré', 'src/Accueil.jsx', "            <a href=\"/confiance\" data-lien-confiance=\"\">{tr('legal.confiance')}</a>\n", ''],
      ['la preuve « livraison gratuite » disparue', 'api/ebay.js', 'VRM ne pose jamais « livraison gratuite »', 'VRM ne pose pas de livraison gratuite'],
      ['un script en ligne sur la page', 'public/confiance.html', '<script src="/confiance.js"></script>', '<script src="/confiance.js"></script><script>1</script>'],
    ];
    let mord = 0;
    for (const [nom, f, avant, apres] of MUT) {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'confiance-mut-'));
      const ecrire = (rel, s) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), s); };
      const tous = new Set(['public/confiance.html', 'public/confiance.js', 'public/etat.html', 'public/etat.js', 'public/sw.js', 'public/sitemap.xml', 'public/logo-vrm-96.png', 'public/vrm-icon-v4-192.png', 'vercel.json', 'src/Accueil.jsx', 'src/App.jsx', 'src/favorisAuto.js', 'src/discretion.js', 'src/freinRelaisVinted.js', 'src/ecrans/Ebay.jsx', 'src/ecrans/Reglages.jsx', 'src/composants/TesDonnees.jsx', 'src/prixAchatPropose.js', 'src/BaissePrixSerie.jsx', 'src/i18n/langues/fr.js', 'api/ebay.js', 'api/email-inbound.js', 'api/vinted-connect.js', 'public/legal/confidentialite.html', 'supabase/migrations/001-multi-utilisateurs.sql', ...['fr', 'en', 'es', 'it', 'de'].map((l) => `src/i18n/langues/${l}-accueil.js`)]);
      for (const x of fs.readdirSync(path.join(R, 'vinted-sync-extension'))) if (/\.(js|json)$/.test(x)) tous.add('vinted-sync-extension/' + x);
      for (const rel of tous) { const p = path.join(R, rel); if (fs.existsSync(p)) ecrire(rel, fs.readFileSync(p)); }
      const src = fs.readFileSync(path.join(dir, f), 'utf8');
      if (!src.includes(avant)) { console.log(`❌ mutation « ${nom} » : texte introuvable`); ko++; continue; }
      ecrire(f, src.replace(avant, apres));
      const r = spawnSync(process.execPath, [__filename, '--silencieux'], { env: { ...process.env, CONFIANCE_RACINE: dir }, encoding: 'utf8' });
      const rouge = r.status !== 0, temoin = avant === apres;
      if (rouge !== temoin) mord++;
      console.log(`${rouge !== temoin ? '✅' : '❌'} mutation « ${nom} » ⇒ ${rouge ? 'ROUGE' : 'vert'}${temoin && rouge ? '\n' + r.stdout.split('\n').filter((l) => l.startsWith('❌')).join('\n') : ''}`);
      fs.rmSync(dir, { recursive: true, force: true });
    }
    dit(mord === MUT.length, `mutations : ${mord}/${MUT.length} rougissent l’audit`);
  }

  console.log(`\n${ko ? '❌' : '✅'} ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
