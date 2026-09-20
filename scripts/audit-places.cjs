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

// Applique le `select=` d'une requête comme le ferait PostgREST : chaque alias
// `nom:data->a->b->>c` devient une colonne. Sans ça un banc sert une FORME que
// l'app ne sait pas lire (§6.3).
function projette(rows, url) {
  const sel = decodeURIComponent((/[?&]select=([^&]*)/.exec(url) || [])[1] || '');
  if (!sel || sel === '*') return rows;
  const parts = sel.split(',').map((x) => x.trim()).filter(Boolean);
  return rows.map((row) => {
    const out = {};
    for (const part of parts) {
      const m = /^(?:([^:]+):)?(.+)$/.exec(part); if (!m) continue;
      const src = m[2];
      const alias = m[1] || src.split('->').pop().replace(/^>/, '');
      if (src === 'id' || src === 'updated_at') { out[alias] = row[src]; continue; }
      if (src === 'data') { out[alias] = row.data; continue; }
      if (/^data(->|->>)/.test(src)) {
        let v = row.data;
        for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = (v == null ? null : v[seg]);
        out[alias] = (v == null) ? null : v;
        continue;
      }
      out[alias] = row[src];
    }
    return out;
  });
}

function ctxAvec(numeros, txns, lbcItems, exclus, quiEchoue, bloquesDef) {
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
      // ⚠️ On sert la VRAIE forme d'un échec : 522 + HTML, pas un JSON d'erreur.
      if (quiEchoue && u.includes(quiEchoue) && (opts.method || 'GET') === 'GET') {
        return { ok: false, status: 522, json: async () => { throw new Error('HTML'); }, text: async () => '<html>522</html>', headers: { get: () => 'text/html' } };
      }
      const j = (d) => ({ ok: true, status: 200, json: async () => d, text: async () => JSON.stringify(d), headers: { get: () => 'application/json' } });
      if ((opts.method || 'GET') === 'POST') return { ok: true, status: 201, json: async () => ({}), text: async () => '', headers: { get: () => '' } };
      // ⚠️ MÊME RÈGLE POUR `main` : les files la lisent PROJETÉE (197 Ko sinon,
      //    §4.4). Servir la ligne brute ferait lire `main.vinted_annonce_numeros`
      //    sur un objet qui ne l'a pas → file VIDE, et l'audit crierait au loup
      //    sur un code intact. C'est le piège de l'écran Colis, deuxième fois.
      if (/id=eq\.main/.test(u)) return j(projette([{ data: { vinted_annonce_numeros: numeros, vinted_accounts_hidden: exclus || [], vinted_accounts: [
        { vinted_user_id: '9001', login: 'compteA' }, { vinted_user_id: '9002', login: 'compteB' }] } }], u));
      if (/id=like\.harvest_\*_listings/.test(u)) return j(LISTINGS);
      // La PREUVE d'une vente : `transaction → item_id` (§5, l'identité).
      // ⚠️⚠️ ET ON APPLIQUE LA PROJECTION POUR DE VRAI (§6.3). Le code demande
      //    `select=it:data->payload->transaction->>item_id` ; servir la ligne
      //    BRUTE ferait lire `r.it` sur un objet qui ne l'a pas — donc « aucune
      //    vente prouvée », et l'audit mesurerait une fiction. C'est le piège
      //    qui avait fait afficher « 0 bordereau prêt » sur l'écran Colis.
      if (/id=like\.harvest_\*_txn_\*/.test(u)) return j(projette(txns || [], u));
      // Les annonces Leboncoin captées — dont celles qui NE SONT PAS à lui.
      if (/id=eq\.lbc_listings/.test(u)) return j(lbcItems ? [{ data: { items: lbcItems } }] : []);
      // Les comptes supprimés DÉFINITIVEMENT (liste distincte de hidden/blocked).
      if (/id=eq\.vrm_blocked_accounts/.test(u)) return j(bloquesDef ? [{ data: { uids: bloquesDef.map(String), logins: [] } }] : []);
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

    // ── ⚠️⚠️ UNE PAIRE DÉJÀ VENDUE NE DOIT PAS ENTRER DANS LA FILE eBAY ──────
    // C'est la plainte de Julien du 13 septembre (« des paires qui sont
    // vendues »), corrigée pour Leboncoin le jour même et laissée entière ici.
    // Mesuré sur ses vraies données : **14 de ses 53 annonces en ligne et
    // numérotées portent une vente PROUVÉE**. Vinted ne ferme pas toujours
    // l'annonce après la vente, et la capture d'un compte peut dater : l'état de
    // l'annonce ne suffit pas, la preuve de vente PRIME.
    {
      const tous = {
        '101': { numero: '101', title: 'A', mp: { ebay: true } },
        '202': { numero: '202', title: 'B', mp: { ebay: true } },
        '303': { numero: '303', title: 'C', mp: { ebay: true } },
      };
      // ⚠️ TROISIÈME FOIS QUE MON BANC SERT UNE FORME QUE LE CODE NE LIT PLUS (§6.3).
      //    Une ligne txn ne prouve une vente que si Vinted lui a donné un ÉTAT DE
      //    COMMANDE : **468 des 711 lignes réelles** portent un `status_title`
      //    VIDE — ce sont des conversations. Servir une ligne sans état, c'est
      //    servir une conversation et s'étonner qu'elle ne prouve rien.
      const vendue = [{ id: 'harvest_9001_txn_7', data: { payload: { transaction: { item_id: 101, status_title: 'Commande finalisée' } } } }];
      const r3 = await ctxAvec(tous, vendue).buildEbayData();
      const n3 = (r3.queue || []).map(a2 => String(a2.numero)).sort();
      dit(!n3.includes('101'), 'eBay : une paire PROUVÉE VENDUE n\'entre pas dans la file',
        n3.includes('101') ? 'il se verrait proposer de remettre en vente une paire qu\'il n\'a plus' : 'file : ' + n3.join(', '));
      dit(n3.includes('202') && n3.includes('303'), 'et les autres y restent (on n\'écarte que le prouvé)',
        'file : ' + n3.join(', '));
      // ⚠️ Et on DIT combien : une file qui rétrécit sans explication se lit
      //    comme une perte (leçon de l'écran Leboncoin).
      dit(r3.vendues === 1, 'eBay : le nombre de paires écartées est RENDU, pour être dit à l\'écran',
        'vendues = ' + String(r3.vendues));
      // L'absence de preuve n'est pas une preuve d'absence : sans transaction
      // captée, la paire reste dans la file.
      const r4 = await ctxAvec(tous, []).buildEbayData();
      dit((r4.queue || []).length === 3, 'sans AUCUNE transaction captée, rien n\'est écarté',
        'sinon une lecture vide viderait sa file — « rien lu » ne vaut pas « rien »');
    }

    // ── LE TITRE eBAY : LA MÊME RÈGLE QUE LEBONCOIN, AVEC 80 CARACTÈRES ──────
    // Mesuré le 13 septembre sur ses 53 annonces en ligne : l'ancien
    // `buildEbayAd` recollait marque + titre sans regarder si le titre portait
    // déjà la marque → **18 titres sur 53 en « Nike nike shox tl »**, et 51 en
    // « taille 42 » au lieu de « T42 ». Deux règles pour une notion, c'est §11.
    {
      const cas = [
        ['Nike', 'nike shox tl noir et vert', '36'],
        ['Salomon', 'salomon XT-6 blanc', '40'],
        ['Nike', 'chaussures style Nike sacai vaporwaffle sail', '42'],
        ['Dr. Martens', '1461 mono noir taille 46', '46'],
      ];
      const mauvais = [];
      for (const [b2, t2, z2] of cas) {
        const titre = ctx2.buildEbayAd({ title: t2, brand_title: b2, size_title: z2 }, {}, '101', 'compteA').title;
        const mots = titre.split(/\s+/);
        for (let i = 1; i < mots.length; i++) {
          if (mots[i] && mots[i].toLowerCase() === mots[i - 1].toLowerCase()) mauvais.push('doublon : « ' + titre + ' »');
        }
        if (titre.length > 80) mauvais.push('trop long : ' + titre.length);
        if (/\btaille\s/i.test(titre)) mauvais.push('« taille » au long : « ' + titre + ' »');
        if (z2 && !new RegExp('T' + z2.replace('.', '[.,]') + '$').test(titre)) mauvais.push('taille absente de la fin : « ' + titre + ' »');
      }
      dit(mauvais.length === 0, 'eBay : la marque n\'est jamais doublée et la taille est en suffixe',
        mauvais[0] || '4 cas réels vérifiés');
      // Et c'est bien la MÊME fonction : un second `slice(0, 80)` recréerait le
      // défaut corrigé pour Leboncoin.
      dit(/lbcTitre\([^)]*EBAY_TITRE_MAX\)/.test(src), 'eBay : il réutilise la règle de titre, il n\'en a pas une seconde',
        'une notion, une règle, un propriétaire (§11)');
    }
  }
  // L'app doit afficher la puce eBay ET ne rien promettre que l'extension
  // installée ne sait pas faire.
  dit(/cle: 'ebay'/.test(APP) && /defaut: false/.test(APP), 'l\'app propose eBay, décoché par défaut');
  dit(/ebay: '5\.55\.0'/.test(APP), 'et la capacité `ebay` est déclarée avec sa version d\'arrivée');
  dit(/mpChoisi\(e, 'ebay'\)/.test(src), 'l\'extension lit le même choix pour eBay');

  // ── ⚠️⚠️ UNE ANNONCE QUI N'EST PAS À LUI NE COMPTE NULLE PART ──────────────
  // Mesuré le 13 septembre sur sa VRAIE base : `lbc_listings` contient **81
  // annonces qui ne sont pas les siennes** (chalets, gîtes — le flux
  // « découverte » de la page qu'il regardait). Le filtre d'attribution avait été
  // posé sur `lbcCount`… et seulement là : `readLbcItems` rendait tout, donc le
  // panneau annonçait « 81 vues sur Leboncoin » et déroulait 81 chalets en
  // « non reliées » — pendant que l'APP en affichait 0. Deux lecteurs, deux
  // règles, la même ligne (§11).
  // ⚠️ ET LE CAS QUI COÛTE : `adRefKeys` lit « n° 1234 » dans le TITRE de
  //    n'importe quelle annonce. Un chalet nommé « … n°202 » relie la paire
  //    N°202 et la SORT de sa file en silence (« déjà en ligne sur Leboncoin »).
  //    C'est un rapprochement par ressemblance (§5) sur des données qui ne sont
  //    même pas les siennes. On sert donc exprès ce chalet-là.
  {
    const tous = {
      '101': { numero: '101', title: 'A', mp: { lbc: true } },
      '202': { numero: '202', title: 'B', mp: { lbc: true } },
      '303': { numero: '303', title: 'C', mp: { lbc: true } },
    };
    const items = {
      // À LUI : elle porte notre référence pro.
      '900': { id: '900', ref: '101', customRef: 'VRM-101', subject: 'Paire A', url: 'u', status: 'active' },
      // PAS à lui : aucune référence, aucun propriétaire connu — et un titre
      // qui contient « n°202 », exactement le piège.
      '901': { id: '901', ref: null, subject: 'Chalet 8/15 personnes n°202 aux Menuires', url: 'u2', status: 'active' },
      '902': { id: '902', ref: null, subject: 'Gîte à louer, 3 chambres', url: 'u3', status: 'active' },
    };
    const r5 = await ctxAvec(tous, [], items).buildLbcData();
    const st = r5.stats || {};
    dit(st.lbcSeen === 1, 'Leboncoin : seules les annonces ATTRIBUABLES sont comptées',
      st.lbcSeen === 1 ? '1 sur 3 (les 2 autres ne sont pas à lui)' : `il en compte ${st.lbcSeen} — des annonces d'autres gens sur son écran`);
    dit((r5.unlinked || []).length === 0, 'et aucune annonce d\'autrui ne sort en « non reliée »',
      (r5.unlinked || []).length ? `${(r5.unlinked || []).length} rendues — 81 chalets sur sa vraie base` : '');
    const nums5 = (r5.queue || []).map(a => String(a.numero)).sort();
    dit(nums5.includes('202'), '⚠️ et un CHALET nommé « n°202 » ne retire pas sa paire N°202 de la file',
      nums5.includes('202') ? '' : 'rapprochement par ressemblance (§5) sur une annonce qui n\'est même pas la sienne');
    dit(st.lbcCount === 1, 'le compteur du panneau dit la même chose que la lecture',
      `lbcCount ${st.lbcCount} / lbcSeen ${st.lbcSeen} — deux règles pour une notion, c'est §11`);
    // L'app applique la MÊME règle (elle la portait déjà — c'est l'extension qui
    // avait dérivé). On compare les PRÉDICATS sur les mêmes entrées.
    const mApp = /const aLui = \(ad\) => [^;]+;/.exec(APP);
    if (!mApp) {
      dit(false, 'l\'app a sa règle d\'attribution', '`aLui` introuvable dans App.jsx');
    } else {
      const aLuiApp = new Function('"use strict"; ' + mApp[0] + ' return aLui;')();
      const aLuiExt = ctxAvec(tous, [], items).estALui;
      // ⚠️ UN AUDIT NE MEURT PAS, IL RAPPORTE — et c'est la TROISIÈME fois que je
      //    l'oublie ici même. Sur le code d'avant `estALui` n'existe pas : mon
      //    premier jet appelait `aLuiExt(ad)` et sortait en `TypeError`, donc le
      //    bilan n'était jamais imprimé et les contrôles suivants disparaissaient.
      if (typeof aLuiExt !== 'function') {
        dit(false, 'l\'app et l\'extension attribuent EXACTEMENT pareil',
          '`estALui` n\'existe pas dans background.js — la règle vit chez un seul des deux lecteurs');
      } else {
        const cas = Object.values(items).concat([{ id: 'x', lbcUser: 'julatace' }, { id: 'y' }]);
        const memes = cas.every((ad) => !!aLuiApp(ad) === !!aLuiExt(ad));
        dit(memes, 'l\'app et l\'extension attribuent EXACTEMENT pareil',
          memes ? `${cas.length} cas` : 'l\'app en montre un nombre, le panneau un autre');
      }
    }
  }

  // ── ⚠️⚠️ UN COMPTE QU'IL A EXCLU N'ALIMENTE AUCUNE FILE ────────────────────
  // Mesuré le 13 septembre sur sa vraie base : la file du panneau contenait la
  // **N°118, qui vient de `liliand653`** — le compte que Julien a lui-même mis
  // de côté dans l'app. `buildEbayData` filtrait, l'APP filtrait (`offAcc`),
  // seule la file Leboncoin du panneau ne le faisait pas : **l'app annonçait 39
  // et le panneau 40**, sur exactement la même donnée (§11).
  {
    const tous = {
      '101': { numero: '101', title: 'A', mp: { lbc: true, ebay: true } },
      '202': { numero: '202', title: 'B', mp: { lbc: true, ebay: true } },
      '303': { numero: '303', title: 'C', mp: { lbc: true, ebay: true } },
    };
    // 303 vit sur le compte 9002 : on l'exclut, comme `liliand653`.
    const ctxE = ctxAvec(tous, [], null, ['9002']);
    const rl = await ctxE.buildLbcData();
    const nl = (rl.queue || []).map(a => String(a.numero)).sort();
    dit(!nl.includes('303'), 'Leboncoin : un compte EXCLU de l\'app n\'alimente pas la file',
      nl.includes('303') ? 'le panneau propose de publier l\'annonce d\'un compte qu\'il a écarté' : 'file : ' + nl.join(', '));
    dit(nl.includes('101') && nl.includes('202'), 'et les comptes actifs y restent', 'file : ' + nl.join(', '));
    // ⚠️ Et on le DIT : une file qui rétrécit sans explication se lit comme une
    //    perte. Le compte est RENDU, pour que le panneau puisse l'écrire.
    dit((rl.stats || {}).exclues === 1, 'et le nombre de paires écartées est RENDU',
      'exclues = ' + String((rl.stats || {}).exclues));
    // eBay le faisait déjà : on vérifie que les deux files partagent la règle.
    const re = await ctxE.buildEbayData();
    const ne = (re.queue || []).map(a => String(a.numero)).sort();
    dit(!ne.includes('303'), 'eBay : même règle sur le compte exclu', 'file : ' + ne.join(', '));
    // Et l'app aussi — c'est elle qui était juste.
    dit(/offAcc\.has\(uid\)/.test(APP), 'l\'app applique la même exclusion sur SA file',
      'sinon l\'app annonce un nombre et le panneau en montre un autre');
  }

  // ── ⚠️⚠️ UN COMPTE SUPPRIMÉ DÉFINITIVEMENT N'ALIMENTE AUCUNE FILE ──────────
  // Mesuré le 19 septembre : `shop_cancale` (199082413) est dans
  // `vrm_blocked_accounts` — une TROISIÈME liste, que ni `vinted_accounts_hidden`
  // ni `vinted_accounts_blocked` ne recouvrent. Ses 96 paires numérotées en
  // ligne entraient dans la file Leboncoin (panneau ET app), alors que l'app
  // les écarte déjà de ses écrans (plus de jetons). On propose de republier
  // ailleurs les paires d'un compte que Vinted a fermé. §11 : même notion,
  // même règle — les deux files doivent l'appliquer.
  {
    const tous = {
      '101': { numero: '101', title: 'A', mp: { lbc: true, ebay: true } },
      '202': { numero: '202', title: 'B', mp: { lbc: true, ebay: true } },
      '303': { numero: '303', title: 'C', mp: { lbc: true, ebay: true } },
    };
    // 9002 (paire 303) n'est PAS masqué — il est supprimé DÉFINITIVEMENT.
    const ctxB = ctxAvec(tous, [], null, [], null, ['9002']);
    const rl = await ctxB.buildLbcData();
    const nl = (rl.queue || []).map(a => String(a.numero)).sort();
    dit(!nl.includes('303'), 'Leboncoin : un compte SUPPRIMÉ DÉFINITIVEMENT n\'alimente pas la file',
      nl.includes('303') ? 'le panneau propose de publier une paire d\'un compte fermé par Vinted' : 'file : ' + nl.join(', '));
    dit(nl.includes('101') && nl.includes('202'), 'et les comptes actifs y restent malgré tout',
      'file : ' + nl.join(', '));
    const re = await ctxB.buildEbayData();
    const ne = (re.queue || []).map(a => String(a.numero)).sort();
    dit(!ne.includes('303'), 'eBay : même règle sur le compte supprimé définitivement', 'file : ' + ne.join(', '));
    // ⚠️ L'AUTRE SENS : liste NON LUE ⇒ on n'exclut rien (ne pas cacher un
    //    compte vivant sur un hoquet). Sur une lecture ratée de la liste, 303 reste.
    const ctxKO = ctxAvec(tous, [], null, [], 'vrm_blocked_accounts', ['9002']);
    const rko = await ctxKO.buildLbcData();
    dit((rko.queue || []).map(a => String(a.numero)).includes('303'),
      'liste des supprimés NON LUE ⇒ on n\'exclut rien (pas de sur-exclusion sur un hoquet)',
      'file : ' + (rko.queue || []).map(a => String(a.numero)).join(', '));
    // Et l'app applique la même exclusion sur SA file.
    dit(/vrm_blocked_accounts&select=data/.test(APP) && /blkRows\[0\]\.data\.uids|data && blkRows\[0\]\.data\.uids/.test(APP.replace(/\s+/g,' ')),
      'l\'app exclut aussi les supprimés définitivement de SA file Leboncoin',
      'sinon l\'app et le panneau divergent sur un compte fermé');
  }

  // ── ⚠️⚠️ UNE PREUVE QU'ON N'A PAS PU LIRE N'EST PAS « AUCUNE VENTE » ───────
  // Mesuré EN DIRECT le 15 septembre, pendant les essais de performance : la
  // lecture des transactions a échoué une fois (base sous charge), le `|| []`
  // l'a transformée en « aucune vente prouvée », et la file Leboncoin est passée
  // de **40 à 55 paires** — quinze paires DÉJÀ VENDUES reproposées à la
  // publication, sans un mot. C'est la plainte du 13 septembre ressuscitée par
  // un simple timeout, et c'est la quinzième forme de « rien lu ne vaut pas
  // rien ». On ne cache pas la liste : on DIT ce qu'on n'a pas pu vérifier.
  {
    const tous = {
      '101': { numero: '101', title: 'A', mp: { lbc: true, ebay: true } },
      '202': { numero: '202', title: 'B', mp: { lbc: true, ebay: true } },
      '303': { numero: '303', title: 'C', mp: { lbc: true, ebay: true } },
    };
    // ⚠️ TROISIÈME FOIS QUE MON BANC SERT UNE FORME QUE LE CODE NE LIT PLUS (§6.3).
      //    Une ligne txn ne prouve une vente que si Vinted lui a donné un ÉTAT DE
      //    COMMANDE : **468 des 711 lignes réelles** portent un `status_title`
      //    VIDE — ce sont des conversations. Servir une ligne sans état, c'est
      //    servir une conversation et s'étonner qu'elle ne prouve rien.
      const vendue = [{ id: 'harvest_9001_txn_7', data: { payload: { transaction: { item_id: 101, status_title: 'Commande finalisée' } } } }];
    // 1) marche normale : la preuve est lue, 101 sort de la file, rien à signaler.
    const ok = ctxAvec(tous, vendue, null, [], null);
    const rOk = await ok.buildLbcData();
    const nOk = (rOk.queue || []).map(a2 => String(a2.numero)).sort();
    dit(!nOk.includes('101') && (rOk.stats || {}).preuveKO === false,
      'preuve LUE : la paire vendue sort de la file, et rien n\'est signalé',
      'file ' + nOk.join(', ') + ' · preuveKO ' + String((rOk.stats || {}).preuveKO));
    // 2) la MÊME base, mais la lecture de la preuve échoue.
    const ko2 = ctxAvec(tous, vendue, null, [], 'txn_');
    const rKo = await ko2.buildLbcData();
    dit((rKo.stats || {}).preuveKO === true,
      '⚠️ preuve RATÉE : la file le PORTE, elle ne se présente pas comme sûre',
      (rKo.stats || {}).preuveKO === true ? '' : 'une lecture ratée devient « aucune vente » : 15 paires vendues reproposées (mesuré)');
    // Et eBay, où une vente engage une expédition.
    const rE = await ctxAvec(tous, vendue, null, [], 'txn_').buildEbayData();
    dit(rE.preuveKO === true, 'eBay : même règle, la file porte l\'échec',
      rE.preuveKO === true ? '' : 'publier une paire vendue sur eBay engage une expédition qu\'il ne peut pas faire');
    // ⚠️ Et les DEUX panneaux doivent le dire — une information rendue que
    //    l'affichage ignore ne vaut rien (défaut du panneau de sécurité).
    const LBC = fs.readFileSync(path.join(racine, 'vinted-sync-extension', 'lbc.js'), 'utf8');
    const EBAY = fs.readFileSync(path.join(racine, 'vinted-sync-extension', 'ebay.js'), 'utf8');
    dit(/preuveKO/.test(LBC), 'le panneau Leboncoin LIT cet échec', 'le fond le signale, l\'affichage l\'ignore');
    dit(/preuveKO/.test(EBAY), 'le panneau eBay aussi');
    dit(/preuveKO/.test(APP), 'et l\'écran Leboncoin de l\'app aussi');
  }

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
      // ⚠️ NON-CHAUSSURES (Julien, 20 sept. : « qu'un reseller qui fasse autre
      //    chose que des chaussures puisse l'utiliser »). Une taille LETTRE ne
      //    doit pas devenir « TM » : c'est corrompre le titre.
      ['Nike', 'sweat tech fleece gris', 'M'],
      ['Lacoste', 'polo piqué blanc', 'L'],
      ['Louis Vuitton', 'sac speedy 30 monogram', ''],
    ];
    // Le VRAI `lbcTitre` de l'extension, déjà chargé dans le contexte vm.
    const ctxT = ctxAvec({});
    // Celui de l'app : on l'extrait du source et on l'exécute tel quel.
    // ⚠️ DOUZIÈME FOIS QU'UN DE MES CONTRÔLES CRIE AU LOUP : ce motif exigeait la
    //    signature EXACTE `(brand, base, size)`. Le jour où le plafond est devenu
    //    un paramètre (`(brand, base, size, max)`, pour qu'eBay réutilise la MÊME
    //    règle à 80 caractères au lieu d'en avoir une seconde), la fonction était
    //    intacte — mieux partagée qu'avant — et l'audit tombait au rouge en
    //    annonçant « `lbcTitre` introuvable dans App.jsx ».
    //    *Un audit suit la RÈGLE, pas son orthographe* : on accepte n'importe
    //    quelle liste de paramètres, et ce sont les SORTIES qui sont comparées.
    const m = /const lbcTitre = \([^)]*\) => \{[\s\S]*?\n\};/.exec(APP);
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
      // ⚠️ NON-CHAUSSURES : une taille LETTRE ne devient jamais « TM »/« TL »
      //    (le « T » n'est une pointure que pour un nombre). Et la taille lettre
      //    reste présente. §6.1 : sur le code d'avant (`' T' + taille`), « M »
      //    donnait « … TM » → ce contrôle rougit.
      const mSweat = lbcApp('Nike', 'sweat tech fleece gris', 'M');
      const lPolo = lbcApp('Lacoste', 'polo piqué blanc', 'L');
      dit(!/\bT[A-Za-zÀ-ÿ]\b/.test(mSweat) && !/\bT[A-Za-zÀ-ÿ]\b/.test(lPolo) && /\bM$/.test(mSweat) && /\bL$/.test(lPolo),
        'une taille LETTRE (M, L) n\'est pas corrompue en « TM »/« TL »',
        `« ${mSweat} » · « ${lPolo} »`);
      // Et l'app == extension sur ces cas non-chaussures (une seule règle, §11).
      const divNS = [['Nike', 'sweat tech fleece gris', 'M'], ['Louis Vuitton', 'sac speedy 30 monogram', '']]
        .filter(([b, t, z]) => ctxT.lbcTitre && lbcApp(b, t, z) !== ctxT.lbcTitre(b, t, z));
      dit(divNS.length === 0, 'app == extension aussi sur les articles non-chaussures');
      // La marque n'est jamais doublée (« Nike nike shox » était son titre réel).
      const double = cas.map(([b, t, z]) => [b, lbcApp(b, t, z)])
        .filter(([b, r2]) => b && (r2.toLowerCase().split(b.toLowerCase()).length - 1) > 1);
      dit(double.length === 0, 'la marque n\'apparaît jamais deux fois', double.length ? double[0][1] : '');
      // La taille survit TOUJOURS : c'est sur elle qu'un acheteur filtre.
      // ⚠️ Numérique (pointure) → suffixe « T{n} » ; lettre (M/L…) → « {z} » sans
      //    le T (une taille lettre n'est pas une pointure — Julien, 20 sept.).
      const sansTaille = cas.filter(([b, t, z]) => {
        if (!z) return false;
        const est = /^\d{1,2}([.,]\d)?$/.test(z);
        const attendu = est ? 'T' + z.replace('.', '[.,]') + '$' : z + '$';
        return !new RegExp(attendu).test(lbcApp(b, t, z));
      });
      dit(sansTaille.length === 0, 'la taille est toujours à la fin, même sur un titre long',
        sansTaille.length ? '« ' + lbcApp(...sansTaille[0]) + ' »' : '');
    }
  }

  // ── LE TEXTE DE VINTED N'EST PAS SA DESCRIPTION ─────────────────────────────
  // Mesuré le 12 septembre : sur ses 92 descriptions captées, 4 sont le texte
  // PUBLICITAIRE de Vinted (« Une communauté, des milliers de marques et de
  // styles de seconde main. Prêt à te lancer ? … »), et UNE de ces quatre est en
  // ligne — elle partirait telle quelle sur Leboncoin comme description de SON
  // annonce. Même principe qu'`URL_PAS_UN_QR` : on écarte ce qui n'est pas la
  // chose. Le contrôle porte sur le RÉSULTAT de `buildLbcAd`, pas sur la regex.
  {
    const ctxD = ctxAvec({});
    const PUB = 'Une communauté, des milliers de marques et de styles de seconde main. Prêt à te lancer ? Découvre comment ça marche !';
    if (typeof ctxD.buildLbcAd !== 'function') {
      dit(false, 'l\'extension sait fabriquer une annonce Leboncoin', '`buildLbcAd` introuvable');
    } else {
      const raw = { id: '9001', title: 'nike air max 1 taille 42', brand_title: 'Nike', size_title: '42', price: { amount: '45.0' }, photo: { url: 'https://ex/1.jpg' } };
      const a1 = ctxD.buildLbcAd(raw, { description: PUB }, '601', 'julatace3535');
      dit(!/communauté|Prêt à te lancer|comment ça marche/i.test(a1.description),
        'le texte publicitaire de Vinted ne part JAMAIS comme description',
        /communaut/i.test(a1.description) ? 'il partirait tel quel sur son annonce Leboncoin' : '');
      dit(a1.aDescription === false, 'et l\'annonce sait qu\'elle n\'a PAS de description',
        'sinon la carte ne peut pas le dire — « pas su » ne vaut pas « oui »');
      // Le libellé « Description » collé au texte (1 cas mesuré).
      const a2 = ctxD.buildLbcAd(raw, { description: 'Description👟nike air max 1\n\ntrès bon état' }, '602', 'x');
      dit(!/^.{0,20}\bDescription👟/.test(a2.description.replace(/^📦[^\n]*\n+/, '')),
        'le libellé « Description » collé au texte est retiré', a2.description.slice(0, 40).replace(/\n/g, ' '));
      // ⚠️ ET UNE VRAIE DESCRIPTION NE DOIT PAS ÊTRE JETÉE : un filtre trop large
      //    viderait ses annonces. C'est l'autre sens, et il compte autant.
      const vraie = '👟nike dunk low sb low pro st patrick\n\ntaille 42,5\n\ntrès bon état voir photos';
      const a3 = ctxD.buildLbcAd(raw, { description: vraie }, '603', 'x');
      dit(/dunk low sb/.test(a3.description) && a3.aDescription === true,
        'mais une VRAIE description est gardée entière', 'un filtre trop large viderait ses annonces');
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
