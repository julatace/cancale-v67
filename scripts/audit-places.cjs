// ⚠️ CONTRÔLE PERMANENT — « LES ANNONCES QUE L'ON SÉLECTIONNE ».
//
// Demande de Julien (11 septembre) : « lorsqu'une annonce est publiée sur
// n'importe quel compte associé à VRM, je veux que ça publie les annonces que
// l'on SÉLECTIONNE sur Leboncoin, eBay, etc. »
// Le « peu importe le compte » était déjà vrai : la file se construit sur les
// annonces en ligne de TOUS les comptes moissonnés. Ce qui manquait, c'est le
// CHOIX. Il vit dans `vinted_annonce_numeros[id].mp` — la même ligne que le
// numéro, le prix d'achat et le prix plancher : l'app en est propriétaire,
// l'extension le lit (§11).
//
// Ce script exécute le VRAI `buildLbcData()` du service worker dans un `vm`,
// sur trois annonces en ligne de DEUX comptes différents :
//   · une sélectionnée explicitement  → dans la file
//   · une retirée explicitement       → PAS dans la file
//   · une jamais touchée              → dans la file (le défaut vaut OUI, sinon
//     la nouveauté aurait vidé sa file du jour au lendemain)
// Et il vérifie que l'app applique la MÊME règle : les deux calculent la file
// chacun de leur côté (le panneau tourne sur leboncoin.fr, où l'app n'est pas
// chargée), donc une règle appliquée d'un seul côté fait diverger les deux
// écrans — « 12 à publier » ici, 8 là-bas.
const fs = require('fs'), vm = require('vm'), path = require('path');
const racine = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(racine, 'vinted-sync-extension', 'background.js'), 'utf8');
const APP = fs.readFileSync(path.join(racine, 'src', 'App.jsx'), 'utf8');
const dual = (v) => function (...a) { const cb = a[a.length - 1]; if (typeof cb === 'function') { cb(v); return; } return Promise.resolve(v); };

let ko = 0;
const dit = (ok, nom, det) => { if (!ok) ko++; console.log(`${ok ? '✅' : '❌'} ${nom}${det ? ' — ' + det : ''}`); };

// Deux comptes, trois annonces numérotées en ligne — « peu importe le compte ».
const NUMEROS = {
  '101': { numero: '101', title: 'Paire A', mp: { lbc: true } },   // choisie
  '202': { numero: '202', title: 'Paire B', mp: { lbc: false } },  // retirée
  '303': { numero: '303', title: 'Paire C' },                      // jamais touchée
};
const LISTINGS = [
  { id: 'harvest_9001_listings', data: { uid: '9001', payload: { items: [
    { id: 101, title: 'Paire A', price: { amount: '40' } },
    { id: 202, title: 'Paire B', price: { amount: '50' } },
  ] } } },
  { id: 'harvest_9002_listings', data: { uid: '9002', payload: { items: [
    { id: 303, title: 'Paire C', price: { amount: '60' } },
  ] } } },
];

function ctxAvec(numeros) {
  const ctx = {
    console: { log() {}, warn() {}, error() {} },
    setTimeout, clearTimeout, setInterval, clearInterval, URL, TextDecoder, TextEncoder,
    btoa: s => Buffer.from(s, 'binary').toString('base64'), atob: s => Buffer.from(s, 'base64').toString('binary'),
    chrome: {
      runtime: { onInstalled: { addListener() {} }, onStartup: { addListener() {} }, onMessage: { addListener() {} }, getManifest: () => ({ version: 't' }), lastError: null, id: 'x' },
      alarms: { create() {}, onAlarm: { addListener() {} } },
      cookies: { get: dual(null), getAll: dual([]), onChanged: { addListener() {} } },
      downloads: { onCreated: { addListener() {} } },
      action: { setBadgeText() {}, setBadgeBackgroundColor() {}, setTitle() {} },
      tabs: { onUpdated: { addListener() {} }, query: dual([]), sendMessage: dual(undefined) },
      storage: { local: { get: dual({}), set: dual(undefined), remove: dual(undefined) } },
    },
    fetch: async (url, opts = {}) => {
      const u = String(url);
      const j = (d) => ({ ok: true, status: 200, json: async () => d, text: async () => JSON.stringify(d), headers: { get: () => 'application/json' } });
      if ((opts.method || 'GET') === 'POST') return { ok: true, status: 201, json: async () => ({}), text: async () => '', headers: { get: () => '' } };
      if (/id=eq\.main/.test(u)) return j([{ data: { vinted_annonce_numeros: numeros, vinted_accounts: [
        { vinted_user_id: '9001', login: 'compteA' }, { vinted_user_id: '9002', login: 'compteB' }] } }]);
      if (/id=like\.harvest_\*_listings/.test(u)) return j(LISTINGS);
      return j([]);
    },
  };
  ctx.self = ctx; ctx.globalThis = ctx; ctx.window = undefined;
  vm.createContext(ctx); vm.runInContext(src, ctx, { filename: 'background.js' });
  return ctx;
}

(async () => {
  const ctx = ctxAvec(NUMEROS);
  const r = await ctx.buildLbcData();
  const nums = (r.queue || []).map(a => String(a.numero)).sort();

  dit(nums.includes('101'), 'une annonce SÉLECTIONNÉE est dans la file Leboncoin', 'file : ' + (nums.join(', ') || 'vide'));
  dit(!nums.includes('202'), 'une annonce RETIRÉE n\'y est pas',
    nums.includes('202') ? 'elle serait préparée alors qu\'il l\'a décochée' : '');
  dit(nums.includes('303'), 'une annonce JAMAIS TOUCHÉE y est (le défaut vaut oui)',
    nums.includes('303') ? '' : 'la sélection a vidé sa file : une nouveauté ne doit pas éteindre ce qui marchait');
  // « Peu importe le compte » : la file mélange bien les deux comptes.
  dit(nums.includes('101') && nums.includes('303'), 'et elle prend les annonces de TOUS les comptes',
    'compteA + compteB');

  // ── Tout retirer doit vider la file, sinon le choix ne sert à rien ─────────
  {
    const aucun = {}; for (const k in NUMEROS) aucun[k] = { ...NUMEROS[k], mp: { lbc: false } };
    const r2 = await ctxAvec(aucun).buildLbcData();
    dit((r2.queue || []).length === 0, 'tout retirer vide vraiment la file', `${(r2.queue || []).length} restante(s)`);
  }

  // ── LA MÊME RÈGLE DES DEUX CÔTÉS ──────────────────────────────────────────
  // L'app et le panneau calculent la file chacun de leur côté. Une règle posée
  // d'un seul côté fait diverger les deux écrans.
  dit(/mpChoisi\s*\(\s*e\s*,\s*'lbc'\s*\)/.test(APP), 'l\'app applique le même filtre sur SA file',
    'sinon l\'app annonce un nombre et le panneau en montre un autre');
  const defExt = /const MP_DEFAUT = \{ lbc: true \}/.test(src);
  const defApp = /defaut: true/.test(APP) && /MP_PLACES/.test(APP);
  dit(defExt && defApp, 'et le même défaut (Leboncoin = oui tant qu\'on n\'a rien décoché)',
    `extension ${defExt ? 'ok' : 'non'} · app ${defApp ? 'ok' : 'non'}`);
  // `undefined` (jamais touché) ne doit jamais être confondu avec `false`.
  const troisEtats = (t) => /v === undefined \|\| v === null/.test(t);
  dit(troisEtats(src) && troisEtats(APP), '« jamais touché » reste distinct de « retiré exprès »',
    'sinon décocher et ne rien faire deviennent la même chose');
  // Une annonce qu'il a retirée ne doit pas disparaître SANS UN MOT (§5).
  dit(/retirees/.test(APP) && /pas dans cette file/.test(APP),
    'une annonce retirée est comptée et dite, jamais effacée en silence');

  // ── eBAY : MÊME RÈGLE, MAIS LE DÉFAUT EST NON ────────────────────────────
  // Leboncoin vaut « oui » parce que sa file existait AVANT la sélection.
  // eBay n'a jamais rien préparé : cocher à sa place mettrait 44 annonces dans
  // une file qu'il n'a pas demandée.
  {
    const n2 = {
      '101': { numero: '101', title: 'A', mp: { ebay: true } },
      '202': { numero: '202', title: 'B', mp: { ebay: false } },
      '303': { numero: '303', title: 'C' },
    };
    // ⚠️ UN AUDIT NE MEURT PAS, IL RAPPORTE. Sur le code d'avant `buildEbayData`
    //    n'existe pas : un `TypeError` non rattrapé coupe le script au milieu et
    //    les contrôles suivants ne sont jamais rendus — on ne sait plus ce qui
    //    manque vraiment.
    const ctx2 = ctxAvec(n2);
    if (typeof ctx2.buildEbayData !== 'function') {
      dit(false, 'eBay : l\'extension sait construire sa file', '`buildEbayData` n\'existe pas dans background.js');
      console.log(ko ? `\n${ko} contrôle(s) en échec.` : '');
      process.exit(1);
    }
    const r = await ctx2.buildEbayData();
    const nums = (r.queue || []).map(a => String(a.numero)).sort();
    dit(nums.includes('101'), 'eBay : une annonce cochée est dans la file', 'file : ' + (nums.join(', ') || 'vide'));
    dit(!nums.includes('202'), 'eBay : une annonce décochée n\'y est pas');
    dit(!nums.includes('303'), 'eBay : une annonce jamais touchée n\'y est PAS (défaut = non)',
      nums.includes('303') ? '44 annonces se retrouveraient dans une file qu\'il n\'a pas demandée' : '');
    const a = (r.queue || [])[0] || {};
    // La référence est ce qui permettra de reconnaître l'annonce plus tard :
    // jamais un rapprochement par titre (§5).
    dit(a.sku === 'VRM-101', 'eBay : chaque annonce porte sa référence VRM-{n°}', String(a.sku));
    dit(String(a.title || '').length <= 80, 'eBay : le titre tient dans les 80 caractères du site', String((a.title || '').length));
    dit(!a.category, 'eBay : aucune catégorie devinée', 'eBay la propose lui-même, une catégorie fausse ferait pire que rien');
  }
  // L'app doit afficher la puce eBay ET ne rien promettre que l'extension
  // installée ne sait pas faire.
  dit(/cle: 'ebay'/.test(APP) && /defaut: false/.test(APP), 'l\'app propose eBay, décoché par défaut');
  dit(/ebay: '5\.55\.0'/.test(APP), 'et la capacité `ebay` est déclarée avec sa version d\'arrivée');
  dit(/mpChoisi\(e, 'ebay'\)/.test(src), 'l\'extension lit le même choix pour eBay');

  // ── LE TITRE LEBONCOIN : LES DEUX CÔTÉS DOIVENT RENDRE LE MÊME ──────────────
  // ⚠️⚠️ L'app et l'extension calculent la file CHACUN DE SON CÔTÉ (le panneau
  // tourne sur leboncoin.fr, où l'app n'est pas chargée). Jusqu'ici ce banc
  // vérifiait seulement que les FILTRES existaient des deux côtés — pas que le
  // résultat était le même. Or l'app montre maintenant le titre tel qu'il
  // partira : si les deux règles divergent d'un caractère, elle lui montre un
  // titre et l'extension en publie un autre. On compare donc les SORTIES, sur
  // les cas réels mesurés chez lui le 12 septembre.
  {
    const cas = [
      // [marque, titre Vinted, taille] — tirés de ses vraies annonces
      ['Nike', 'nike shox tl noir et vert taille 36', '36'],
      ['Nike', 'Chaussures style Nike air Jordan 1 bleu taille 40', '40'],
      ['Philippe model', 'chaussures philippe model tropez fringe noir taille 36', '36'],
      ['Timberland', 'chaussures bateau/ mocassins timberland marron taille 40,5', '40,5'],
      ['Paraboot', 'chaussures de ville derby paraboot en cuir taille 43,5', '43,5'],
      ['Nike', 'nike zoomX vaporfly next 4 bright crimson mint foam taille 44', '44'],
      ['', 'basket sans marque', ''],
      ['Autry', 'Autry medalist blanc taille 36', '36'],
    ];
    // Le VRAI `lbcTitre` de l'extension, déjà chargé dans le contexte vm.
    const ctxT = ctxAvec({});
    // Celui de l'app : on l'extrait du source et on l'exécute tel quel.
    const m = /const lbcTitre = \(brand, base, size\) => \{[\s\S]*?\n\};/.exec(APP);
    // ⚠️ UN AUDIT NE MEURT PAS ET NE SAUTE PAS SES CONTRÔLES. Premier jet : si
    //    l'app n'avait pas la fonction, tout le bloc était sauté — donc on ne
    //    savait même pas si l'EXTENSION l'avait. On juge les deux séparément,
    //    puis leur égalité seulement quand les deux existent.
    dit(typeof ctxT.lbcTitre === 'function', 'l\'extension a `lbcTitre`',
      'sinon le titre publié reste l\'ancien, coupé en plein mot');
    if (!m) {
      dit(false, 'l\'app a sa propre règle de titre Leboncoin', '`lbcTitre` introuvable dans App.jsx — la liste ne peut pas montrer ce qui partira');
      if (typeof ctxT.lbcTitre === 'function') {
        dit(cas.every(([b, t, z]) => ctxT.lbcTitre(b, t, z).length <= 50), 'côté extension : aucun titre ne dépasse 50 caractères');
      }
    } else {
      const lbcApp = new Function('"use strict"; const LBC_TITRE_MAX = 50; ' + m[0] + ' return lbcTitre;')();
      let memes = 0; const divergents = [];
      for (const [b, t, z] of cas) {
        const a = lbcApp(b, t, z);
        const e = ctxT.lbcTitre ? ctxT.lbcTitre(b, t, z) : null;
        if (e !== null && a === e) memes++; else divergents.push(`« ${t.slice(0, 28)}… » app:« ${a} » ext:« ${e} »`);
      }
      dit(divergents.length === 0, `l'app et l'extension rendent le MÊME titre (${memes}/${cas.length})`,
        divergents.length ? divergents[0] : '');
      // Et les règles qui font la qualité, jugées sur le RÉSULTAT (pas sur
      // l'orthographe de la fonction) : c'est la leçon des six audits d'avant.
      for (const [b, t, z] of cas) {
        const r2 = lbcApp(b, t, z);
        if (r2.length > 50) { dit(false, 'aucun titre ne dépasse 50 caractères', `${r2.length} : « ${r2} »`); break; }
      }
      dit(cas.every(([b, t, z]) => lbcApp(b, t, z).length <= 50), 'aucun titre ne dépasse les 50 caractères de Leboncoin');
      // ⚠️ Coupé en plein mot : c'est LE défaut mesuré (6 titres sur 59).
      const coupe = cas.map(([b, t, z]) => lbcApp(b, t, z)).filter(r2 => {
        if (r2.length < 45) return false;                    // pas au plafond
        return /[a-zà-ÿ]$/i.test(r2) && !/\bT\d/.test(r2.slice(-6));
      });
      dit(coupe.length === 0, 'aucun titre ne se termine au milieu d\'un mot', coupe[0] || '');
      // La marque n'est jamais doublée (« Nike nike shox » était son titre réel).
      const double = cas.map(([b, t, z]) => [b, lbcApp(b, t, z)])
        .filter(([b, r2]) => b && (r2.toLowerCase().split(b.toLowerCase()).length - 1) > 1);
      dit(double.length === 0, 'la marque n\'apparaît jamais deux fois', double.length ? double[0][1] : '');
      // La taille survit TOUJOURS : c'est sur elle qu'un acheteur filtre.
      const sansTaille = cas.filter(([b, t, z]) => z && !new RegExp('T' + z.replace('.', '[.,]') + '$').test(lbcApp(b, t, z)));
      dit(sansTaille.length === 0, 'la taille est toujours à la fin, même sur un titre long',
        sansTaille.length ? '« ' + lbcApp(...sansTaille[0]) + ' »' : '');
    }
  }

  // ── « VENDUE » SE PROUVE PAR UNE TRANSACTION, PAS PAR UNE ABSENCE ───────────
  // Mesuré le 12 septembre : sur ses 400 annonces fermées, 151 seulement portent
  // une vente prouvée (`transaction → item_id`). Annoncer « vendue » pour les
  // 249 autres lui ferait retirer de Leboncoin une paire qu'il a encore.
  {
    dit(/harvest_\*_txn_\*/.test(src) && /item_id/.test(src),
      'l\'extension prouve la vente par l\'identité de la transaction',
      'sans ça « plus en ligne » vaut « vendue » — faux 249 fois sur 400');
    dit(/harvest_\*_txn_\*/.test(APP) && /vendus\.add/.test(APP),
      'l\'app fait la même preuve, sur la même identité');
    // L'état doit distinguer la PAUSE : une annonce masquée n'est pas vendue.
    dit(/'pause'/.test(src) && /'pause'/.test(APP), 'les deux distinguent « en pause » de « vendue »',
      'une annonce masquée sur Vinted n\'est pas vendue — la retirer de Leboncoin perdrait la vente');
    // Et l'écran ne doit pas CRIER « vendue » sur ce qu'il n'a pas prouvé.
    // ⚠️ HUITIÈME FOIS : mon premier jet cherchait « à vérifier » dans TOUT
    //    App.jsx — or la phrase existe déjà sur l'écran Achats (les commandes non
    //    réclamées). Le contrôle était donc VERT sur le code fautif, exactement
    //    ce qu'un contrôle ne doit jamais être. On le borne à l'écran Leboncoin.
    const iL = APP.indexOf('function LeboncoinScreen');
    const ecran = iL < 0 ? '' : APP.slice(iL, APP.indexOf('\n}', APP.indexOf('➕ Ouvrir « Déposer une annonce »')));
    dit(ecran.length > 2000, 'l\'écran Leboncoin a été retrouvé pour être jugé', ecran.length + ' caractères');
    dit(/à vérifier/.test(ecran), 'l\'écran Leboncoin dit « à vérifier » quand la vente n\'est pas prouvée',
      'sinon il fait supprimer une annonce Leboncoin sur une supposition');
    dit(/etat === 'vendue'/.test(ecran), 'et le rouge y est réservé à la vente PROUVÉE');
    dit(/en pause sur Vinted/.test(ecran), 'une annonce en pause est dite en pause, sans consigne');
  }

  console.log(ko ? `\n${ko} contrôle(s) en échec.` : '\nLa file part de SA sélection, sur tous ses comptes.');
  process.exit(ko ? 1 : 0);
})();
