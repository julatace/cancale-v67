// ⚠️⚠️ CONTRÔLE PERMANENT — VENDUE SUR UNE PLATEFORME, RETIRÉE DES AUTRES.
//
// Julien, 4 octobre : « quand une paire est vendue sur une plateforme, elle doit
// disparaître des autres, pour éviter de vendre deux fois la même paire ». Le
// sens Vinted → Leboncoin existait ; l'autre sens N'EXISTAIT PAS : une vente
// Leboncoin ne disait rien de la paire, qui restait en vente sur Vinted.
//
// Mesuré le même jour : 3 ventes Leboncoin (dont un colis à envoyer) portaient
// sur des annonces reliées à AUCUNE paire, et ces annonces appartenaient à un
// compte qui en porte 8 — dont 7 qu'aucune règle ne voyait, parce que le champ
// `account` des annonces captées couvre 48 comptes (la 5.88 étiquetait celles
// d'autrui avec leur propre propriétaire).
//
// Ce contrôle EXÉCUTE les vraies règles extraites d'`App.jsx` et de
// `background.js` dans un `vm` et juge ce qu'elles RENDENT (§6.5) :
//   · une vente Leboncoin reliée à une paire encore en vente sur Vinted ⇒ alerte ;
//   · annulée, ou un ACHAT ⇒ rien ;
//   · une vente NON reliée ne désigne JAMAIS une paire toute seule, même quand
//     une paire en ligne porte EXACTEMENT le même titre (les 50 paires
//     identiques, §2.4) — elle part en « quelle paire ? » ;
//   · un compte n'est le sien que s'il a VENDU une de ses annonces ;
//   · l'app et l'extension attribuent EXACTEMENT les mêmes annonces (§11) ;
//   · le tableau de bord ne dit plus « vendue sur Vinted » sur une absence.
//
// `--prouve` réaffaiblit les règles (relier par la suggestion la mieux notée,
// accepter n'importe quel `account`) : les contrôles doivent passer au ROUGE.
// « La fonction n'existait pas avant » n'est pas une preuve (§6.1).
const fs = require('fs'), vm = require('vm'), path = require('path');
const racine = path.join(__dirname, '..');
let APP = fs.readFileSync(path.join(racine, 'src', 'App.jsx'), 'utf8');
let EXT = fs.readFileSync(path.join(racine, 'vinted-sync-extension', 'background.js'), 'utf8');
const PROUVE = process.argv.includes('--prouve');

let ko = 0;
const dit = (ok, nom, det) => { if (!ok) ko++; console.log(`${ok ? '✅' : '❌'} ${nom}${det ? ' — ' + det : ''}`); };
// Un audit ne meurt pas, il rapporte : ce qui lève devient un contrôle ROUGE.
const essaie = (quoi, fn) => { try { return fn(); } catch (e) { dit(false, quoi, String((e && e.message) || e)); return null; } };

if (PROUVE) {
  const avant = APP;
  APP = APP.replace('if (!connus.length) { aRelier.push({ vente: v, ad }); continue; }',
    "if (!connus.length) { const s = (typeof __cands !== 'undefined' ? suggestionsPaires({ titre: v.title }, __cands) : [])[0]; if (!s) { aRelier.push({ vente: v, ad }); continue; } connus.push(cleNum(s.numero)); }");
  APP = APP.replace('if (ad && ad.account) s.add(String(ad.account));\n  }\n  return s;\n}\nfunction annonceLbcALui',
    'if (ad && ad.account) s.add(String(ad.account));\n  }\n  for (const ad of Object.values(items || {})) if (ad && ad.account) s.add(String(ad.account));\n  return s;\n}\nfunction annonceLbcALui');
  EXT = EXT.replace('function estALui(ad, prouves) { return !!(ad && (ad.ref || ad.customRef || ad.lbcUser || (ad.account && prouves && prouves.has(String(ad.account))))); }',
    'function estALui(ad, prouves) { return !!(ad && (ad.ref || ad.customRef || ad.lbcUser || ad.account)); }');
  dit(APP !== avant, '(--prouve) la règle de l\'app a bien été réaffaiblie');
}

// Extrait une déclaration de haut niveau (`function nom(` ou `const nom =`)
// jusqu'à sa fin réelle : l'accolade fermante du corps pour une fonction, le `;`
// de profondeur 0 pour une constante.
function extraire(src, nom, quoi) {
  const re = new RegExp(`^(?:async )?function ${nom}\\(|^const ${nom} = `, 'm');
  const m = re.exec(src);
  if (!m) { dit(false, `${quoi} : \`${nom}\` introuvable`); return ''; }
  let i = m.index, prof = 0, vuCorps = false;
  const estFn = /function/.test(m[0]);
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === '(' || c === '[' || c === '{') { prof++; if (c === '{') vuCorps = true; }
    else if (c === ')' || c === ']' || c === '}') {
      prof--;
      if (estFn && vuCorps && prof === 0 && c === '}') return src.slice(m.index, i + 1);
    } else if (!estFn && c === ';' && prof === 0) return src.slice(m.index, i + 1);
  }
  dit(false, `${quoi} : fin de \`${nom}\` introuvable`); return '';
}

// ── LES RÈGLES DE L'APP ──────────────────────────────────────────────────────
const NOMS_APP = ['cleNum', 'refVRMDe', 'NUM_OK', 'lbcAnnulee', 'motsDeTitre', 'pointureDe', 'suggestionsPaires',
  'numDeTitreLbc', 'clesAnnonceLbc', 'comptesLbcProuves', 'annonceLbcALui', 'doublesVenteLbc'];
const srcApp = NOMS_APP.map((n) => extraire(APP, n, 'App.jsx')).join('\n');
const ctxApp = {};
vm.createContext(ctxApp);
essaie('les règles de l\'app se chargent', () => vm.runInContext(srcApp + `\n;this.R = { cleNum, suggestionsPaires, clesAnnonceLbc, comptesLbcProuves, annonceLbcALui, doublesVenteLbc };`, ctxApp));
const R = ctxApp.R || {};

// ── LES RÈGLES DE L'EXTENSION ────────────────────────────────────────────────
const srcExt = ['comptesLbcProuves', 'estALui'].map((n) => extraire(EXT, n, 'background.js')).join('\n');
const ctxExt = {};
vm.createContext(ctxExt);
essaie('les règles de l\'extension se chargent', () => vm.runInContext(srcExt + `\n;this.E = { comptesLbcProuves, estALui };`, ctxExt));
const E = ctxExt.E || {};

// ── LES DONNÉES : la FORME mesurée le 4 octobre (§6.3) ──────────────────────
// `lbc_ventes.data.ventes` : objet clé = txId ; prix en CENTIMES ;
// `lbc_listings.data.items` : objet clé = id d'annonce.
const numeros = {
  'v1': { numero: '101', title: 'nike air max 90 blanc taille 42' },
  'v2': { numero: '102', title: 'salomon xt-6 noir taille 40' },
  'v3': { numero: '103', title: 'adidas spezial bleu taille 41' },
  // Deux paires IDENTIQUES (même modèle, même titre) : seule l'identité tranche.
  'v4': { numero: '104', title: 'adidas samba noir taille 39' },
  'v5': { numero: '105', title: 'adidas samba noir taille 39' },
  'v6': { numero: 'B200', title: 'asics gel 1130 argent taille 43' },
};
const MON_COMPTE = '9999';
const items = {
  // Vendue, reliée À LA MAIN à la N°101 (encore en ligne sur Vinted).
  'a1': { id: 'a1', subject: 'Nike Air Max 90 blanc T42', price: 80, account: MON_COMPTE, status: 'active', images: ['p'] },
  // Vendue, reliée par sa RÉFÉRENCE (VRM-B200 dans la description).
  'a2': { id: 'a2', subject: 'Asics Gel 1130 argent T43', price: 95, ref: 'B200', account: MON_COMPTE, status: 'active' },
  // Vendue, reliée à rien — son titre est IDENTIQUE à deux paires en ligne.
  'a3': { id: 'a3', subject: 'adidas samba noir taille 39', price: 70, account: MON_COMPTE, status: 'active' },
  // Vendue mais ANNULÉE : la paire revient, rien à faire.
  'a4': { id: 'a4', subject: 'Salomon XT-6 noir T40', price: 110, account: MON_COMPTE, status: 'active' },
  // Un ACHAT (il est l'acheteur) d'une annonce d'autrui reliée par erreur au 103.
  'a5': { id: 'a5', subject: 'adidas spezial bleu n°103', price: 60, account: '5555', status: 'active' },
  // Son annonce NON vendue, jamais reliée : à lui par son compte (prouvé).
  'a6': { id: 'a6', subject: 'Puma suede rouge T44', price: 50, account: MON_COMPTE, status: 'active' },
  // L'annonce d'un INCONNU, étiquetée de son propre compte par la 5.88.
  'a7': { id: 'a7', subject: 'Chalet 8 personnes', price: 900, account: '4242', status: 'active' },
};
const ventes = {
  't1': { txId: 't1', itemId: 'a1', isSeller: true, stepStatus: 'action', stepLabel: 'Colis à envoyer', price: 8000, title: 'Nike Air Max 90 blanc T42' },
  't2': { txId: 't2', itemId: 'a2', isSeller: true, stepStatus: 'validation', stepLabel: 'Paiement effectué', price: 9500, title: 'Asics Gel 1130 argent T43' },
  't3': { txId: 't3', itemId: 'a3', isSeller: true, stepStatus: 'validation', stepLabel: 'Paiement effectué', price: 7000, title: 'adidas samba noir taille 39' },
  't4': { txId: 't4', itemId: 'a4', isSeller: true, stepStatus: 'cancelled', stepLabel: 'Annulée', price: 11000, title: 'Salomon XT-6 noir T40' },
  't5': { txId: 't5', itemId: 'a5', isSeller: false, stepStatus: 'validation', stepLabel: 'Paiement effectué', price: 6000, title: 'adidas spezial bleu n°103' },
};
const liens = { a1: '101' };
const enLigne = new Set(['v1', 'v2', 'v3', 'v4', 'v5', 'v6']);
const cands = Object.entries(numeros).map(([id, e]) => ({ numero: e.numero, titre: e.title, prix: 70 }));
ctxApp.__cands = cands;   // n'est lu que par la règle réaffaiblie (--prouve)

const dv = essaie('doublesVenteLbc s\'exécute', () => R.doublesVenteLbc({ ventes, items, liens, numeros, enLigne, vendusVinted: new Set() })) || { doublons: [], aRelier: [] };
const nums = dv.doublons.map((d) => d.numero).sort();
dit(nums.includes('101'), 'vendue sur Leboncoin, reliée À LA MAIN, encore sur Vinted ⇒ alerte (N°101)', `alertes : [${nums}]`);
dit(nums.includes('B200'), 'reliée par sa RÉFÉRENCE VRM-B200 ⇒ alerte', `alertes : [${nums}]`);
const d101 = dv.doublons.find((d) => d.numero === '101');
dit(!!d101 && d101.surVinted.length === 1 && d101.surVinted[0] === 'v1', 'l\'alerte désigne l\'annonce Vinted de CETTE paire, et seulement elle',
  d101 ? `[${d101.surVinted}]` : 'aucune');
dit(!nums.includes('102'), 'une vente ANNULÉE ne fait partir aucune paire');
dit(!nums.includes('103'), 'un ACHAT (il est l\'acheteur) ne retire rien de Vinted — même avec un « n°103 » dans le titre');
dit(!nums.includes('104') && !nums.includes('105'),
  '⚠️ une vente NON reliée ne désigne JAMAIS une paire, même au titre identique (§5)', `alertes : [${nums}]`);
const aRelier = (dv.aRelier || []).map((x) => x.vente.txId);
dit(aRelier.length === 1 && aRelier[0] === 't3', 'elle part en « quelle paire ? », et elle seule', `[${aRelier}]`);
dit(nums.length === 2, 'exactement deux alertes sur ces données', `${nums.length}`);

// La paire est déjà vendue sur Vinted aussi : une des deux ventes ne partira pas.
const dv2 = essaie('vendue des deux côtés', () => R.doublesVenteLbc({ ventes, items, liens, numeros, enLigne: new Set(), vendusVinted: new Set(['v1']) })) || { doublons: [] };
const d2 = (dv2.doublons || []).find((d) => d.numero === '101');
dit(!!d2 && d2.vendueVinted.length === 1, 'vendue sur Leboncoin ET prouvée vendue sur Vinted ⇒ dit « vendue deux fois »');
// Plus en ligne nulle part (il l'a déjà retirée) : plus rien à faire.
const dv3 = essaie('déjà retirée de Vinted', () => R.doublesVenteLbc({ ventes, items, liens, numeros, enLigne: new Set(), vendusVinted: new Set() })) || { doublons: [1] };
dit((dv3.doublons || []).length === 0, 'retirée de Vinted ⇒ plus aucune alerte (une alerte réglée se tait)');
// Sans les annonces (le tableau de bord ne les lit qu'au besoin) : le lien posé
// à la main suffit, et rien n'est inventé pour le reste.
const dv4 = essaie('sans les annonces', () => R.doublesVenteLbc({ ventes, items: null, liens, numeros, enLigne, vendusVinted: new Set() })) || { doublons: [], aRelier: [] };
dit((dv4.doublons || []).map((d) => d.numero).join() === '101' && (dv4.aRelier || []).length === 2,
  'sans les annonces : le lien manuel tient, la référence attend sa lecture (rien deviné)',
  `alertes [${(dv4.doublons || []).map((d) => d.numero)}] · à relier ${(dv4.aRelier || []).length}`);

// ── LES SUGGESTIONS PROPOSENT, ELLES NE DÉCIDENT PAS ────────────────────────
const sug = essaie('suggestionsPaires', () => R.suggestionsPaires({ titre: 'adidas samba noir taille 39', prix: 70 }, cands)) || [];
dit(sug.length >= 2 && sug.some((s) => s.numero === '104') && sug.some((s) => s.numero === '105'),
  'les deux paires identiques sont PROPOSÉES — c\'est son clic qui tranche', `[${sug.map((s) => s.numero)}]`);
const sug2 = essaie('pointure différente', () => R.suggestionsPaires({ titre: 'nike air max 90 blanc taille 44', prix: 70 }, cands)) || [];
dit(!sug2.some((s) => s.numero === '101'), 'une pointure DIFFÉRENTE n\'est pas proposée (même modèle, autre paire)', `[${sug2.map((s) => s.numero)}]`);
const cinquante = Array.from({ length: 50 }, (_, i) => ({ numero: String(300 + i), titre: 'nike dunk low panda taille 42', prix: 90 }));
const sug3 = essaie('50 paires identiques', () => R.suggestionsPaires({ titre: 'nike dunk low panda taille 42', prix: 90 }, cinquante)) || [];
dit(sug3.length <= 3, 'cinquante paires identiques : au plus trois propositions, aucune décision', `${sug3.length}`);

// ── À QUI EST UNE ANNONCE : UN COMPTE SE PROUVE PAR UNE VENTE ───────────────
const prouves = essaie('comptesLbcProuves (app)', () => R.comptesLbcProuves(ventes, items)) || new Set();
const aLuiApp = (ad) => R.annonceLbcALui(ad, prouves);
dit(prouves.has && prouves.has(MON_COMPTE) && !prouves.has('5555'), 'le compte d\'une annonce qu\'il a VENDUE est le sien — pas celui d\'un ACHAT',
  `[${[...(prouves.values ? prouves.values() : [])]}]`);
dit(!!essaie('attribution', () => aLuiApp(items.a6)), 'son annonce jamais reliée est vue (par son compte prouvé)');
dit(!essaie('attribution', () => aLuiApp(items.a7)), '⚠️ l\'annonce d\'un inconnu, étiquetée de SON compte à lui, n\'est pas la sienne (48 comptes mesurés)');
const prouvesExt = essaie('comptesLbcProuves (extension)', () => E.comptesLbcProuves(ventes, items)) || new Set();
const cas = Object.values(items).concat([{ id: 'x', lbcUser: 'julatace' }, { id: 'y' }, { id: 'z', customRef: 'VRM-12' }, { id: 'w', account: '' }]);
const memes = essaie('comparaison app ↔ extension', () => cas.every((ad) => !!aLuiApp(ad) === !!E.estALui(ad, prouvesExt)));
dit(memes === true, 'l\'app et l\'extension attribuent EXACTEMENT les mêmes annonces (§11)', `${cas.length} cas`);

// ── LE TABLEAU DE BORD NE DIT PLUS « VENDUE » SUR UNE ABSENCE ───────────────
const blocDash = (/let lbcRemoveCount=0;[\s\S]*?catch\(_\)\{\}/.exec(APP) || [''])[0];
dit(/soldIdsN\.has/.test(blocDash) && !/!lbcOnlineIds\.has/.test(blocDash),
  'le tableau de bord ne compte « vendue sur Vinted » que sur une vente PROUVÉE', blocDash ? '' : 'bloc introuvable');
dit(/doublesVenteLbc\(/.test((/let lbcDoubles=0[\s\S]*?catch\(_\)\{\}/.exec(APP) || [''])[0]),
  'et il signale l\'autre sens avec la MÊME règle que l\'écran Leboncoin (§11)');

console.log(`\n${ko ? `❌ ${ko} échec(s)` : '✅ tout est vert'}`);
process.exit(ko ? 1 : 0);
