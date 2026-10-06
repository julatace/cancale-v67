// ⚠️⚠️ CONTRÔLE PERMANENT — eBAY : UNE PAIRE DÉJÀ VENDUE NE SE PROGRAMME PAS,
// TOUTES PLATEFORMES, JUGÉE PAR SON N° (revue contradictoire du 6 octobre).
//
// Prouvé au rendu sur le code d'avant : le planificateur eBay ne connaissait
// qu'UNE garde « vendue » — l'annonce Vinted du brouillon (`pairId`) dans les
// ventes Vinted. Une paire vendue sur LEBONCOIN, vendue sur eBAY (commande
// SKU VRM-n), revendue sur Vinted sous une AUTRE annonce du même N°, ou un
// brouillon sans `pairId` partaient quand même : la paire était mise en vente
// une seconde fois, à l'heure dite, VRM fermé. Et un brouillon « programmee »
// annulé, terminé ou passé en ligne ressuscitait l'alerte « à annuler ».
//
// Ce contrôle EXÉCUTE les vraies règles extraites d'`App.jsx` dans un `vm` et
// juge ce qu'elles RENDENT (§6.5) :
//   · `numerosDejaVendus` : Vinted (avec « la paire est revenue »), eBay
//     (commande engagée, SKU mal écrit compris), Leboncoin (reliée par titre,
//     ou SEULEMENT par son annonce) ; une vente annulée, une conversation, un
//     achat ne vendent rien ; « pas su » (une source illisible) est DIT, jamais
//     lu comme « pas vendue » ;
//   · `doublesVenteEbay` : une programmée vendue ailleurs est « à annuler »,
//     avec OÙ ; sans verdict, l'ancienne règle (Vinted seul) tient ;
//   · `brouillonEncoreAttendu` / `programmeesConnues` : un brouillon
//     « programmee » ne revient plus une fois eBay relu complet APRÈS, ou une
//     fois parti en ligne ; il compte tant qu'eBay n'a pas été relu.
//
// `--prouve` réaffaiblit chaque règle tour à tour : chaque fois, au moins un
// contrôle doit passer au ROUGE. « La fonction n'existait pas avant » n'est pas
// une preuve (§6.1).
const fs = require('fs'), vm = require('vm'), path = require('path');
const racine = path.join(__dirname, '..');
const APP0 = fs.readFileSync(path.join(racine, 'src', 'App.jsx'), 'utf8');

function extraire(src, nom, dit) {
  const re = new RegExp(`^(?:async )?function ${nom}\\(|^const ${nom} = `, 'm');
  const m = re.exec(src);
  if (!m) { dit(false, `\`${nom}\` introuvable dans App.jsx`); return ''; }
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
  dit(false, `fin de \`${nom}\` introuvable`); return '';
}
const NOMS = ['cleNum', 'refVRMDe', 'NUM_OK', 'lbcAnnulee', 'numDeTitreLbc', 'clesAnnonceLbc', 'numDeSkuEbay', 'skuEbayDe',
  'commandeEbayEngagee', 'numerosDejaVendus', 'ouVenduesTexte', 'doublesVenteEbay', 'BROUILLON_RELU_MARGE_MS', 'brouillonEncoreAttendu', 'programmeesConnues'];

// ── LES DONNÉES (inventées, la FORME mesurée : §6.3) ─────────────────────────
const numeros = {
  '7021': { numero: '21' }, '9021': { numero: '21' },   // N°21 : l'ancienne annonce vendue, la paire REVENUE (7021 en vente)
  '7022': { numero: '22' },                            // N°22 : vendue sur eBay
  '7023': { numero: '23' },                            // N°23 : vendue sur Leboncoin, reliée SEULEMENT par son annonce
  '7024': { numero: '24' }, '8024': { numero: '24' },   // N°24 : revendue sur Vinted sous une AUTRE annonce
  '7025': { numero: '25' },                            // N°25 : une conversation, pas une vente
  '7026': { numero: '26' },                            // N°26 : vendue sur Vinted
  '7027': { numero: '27' },                            // N°27 : vendue sur Leboncoin (« n27 » dans le titre de la vente)
  '7028': { numero: '28' },                            // N°28 : vente Leboncoin ANNULÉE
  '7029': { numero: '29' },                            // N°29 : commande eBay ANNULÉE
  '7030': { numero: '30' },                            // N°30 : un ACHAT Leboncoin (il est l'acheteur)
};
const vendusVinted = new Set(['9021', '8024', '7026']);
const enLigne = new Set(['7021', '7022', '7023', '7025', '7027', '7028', '7029', '7030']);
const commandes = [
  { orderId: 'o22', orderPaymentStatus: 'PAID', lineItems: [{ sku: 'vrm-022' }] },
  { orderId: 'o29', orderPaymentStatus: 'PAID', cancelStatus: { cancelState: 'CANCELED' }, lineItems: [{ sku: 'VRM-29' }] },
];
const ventesLbc = {
  v23: { isSeller: true, itemId: 5023, title: 'Salomon XT-6', stepStatus: 'finished' },
  v27: { isSeller: true, itemId: 5027, title: 'Vans old skool n27', stepStatus: 'finished' },
  v28: { isSeller: true, itemId: 5028, title: 'Puma n28', stepStatus: 'cancelled', stepLabel: 'Annulée' },
  v30: { isSeller: false, itemId: 5030, title: 'Asics n30', stepStatus: 'finished' },
};
const itemsLbc = { 5023: { id: '5023', subject: 'Salomon XT-6 noir', customRef: 'VRM-23' } };
const autres = [{ numero: '31', id: '7031' }];   // un brouillon dont la FICHE a disparu : son annonce compte pour son N°
const vendusAvecAutre = new Set([...vendusVinted, '7031']);

function lancer(APP, dit) {
  const ctx = {};
  vm.createContext(ctx);
  const src = NOMS.map((n) => extraire(APP, n, dit)).join('\n');
  try { vm.runInContext(src + '\n;this.R = { numerosDejaVendus, doublesVenteEbay, brouillonEncoreAttendu, programmeesConnues, ouVenduesTexte };', ctx); }
  catch (e) { dit(false, 'les règles se chargent', String(e && e.message)); return null; }
  return ctx.R;
}

function controles(APP, journal) {
  let ko = 0;
  const dit = (ok, nom, det) => { if (!ok) ko++; if (journal) console.log(`${ok ? '✅' : '❌'} ${nom}${det ? ' — ' + det : ''}`); };
  const essaie = (quoi, fn) => { try { return fn(); } catch (e) { dit(false, quoi, 'a levé : ' + String((e && e.message) || e).slice(0, 140)); return null; } };
  const R = lancer(APP, dit);
  if (!R) return ko + 1;
  // 1. Le verdict, sources lues, annonces Leboncoin PAS ENCORE lues.
  const v0 = essaie('verdict sans les annonces Leboncoin', () => R.numerosDejaVendus({ numeros, autres, enLigne, vendusVinted: vendusAvecAutre, commandes, ventesLbc, itemsLbc: undefined, liensLbc: {} }));
  if (v0) {
    dit(v0.lbcSansPaire === 1 && v0.enCours === true, 'une vente Leboncoin qui ne se relie pas sans son annonce : « en cours », l\'appelant lit les annonces (une fois)', `lbcSansPaire=${v0.lbcSansPaire} enCours=${v0.enCours}`);
  }
  const v = essaie('verdict complet', () => R.numerosDejaVendus({ numeros, autres, enLigne, vendusVinted: vendusAvecAutre, commandes, ventesLbc, itemsLbc, liensLbc: {} }));
  if (v) {
    const g = (n) => v.vendus.get(n) || null;
    dit(g('21') === null, 'N°21 : une ancienne annonce vendue, une AUTRE en vente et pas vendue ⇒ la paire est revenue, pas vendue', String(g('21')));
    dit(g('22') === 'eBay', 'N°22 : commande eBay engagée, SKU « vrm-022 » ⇒ vendue sur eBay', String(g('22')));
    dit(g('23') === 'Leboncoin', 'N°23 : vente Leboncoin reliée par son annonce (réf VRM-23) ⇒ vendue sur Leboncoin', String(g('23')));
    dit(g('24') === 'Vinted', 'N°24 : revendue sur Vinted sous une AUTRE annonce du même N° ⇒ vendue sur Vinted', String(g('24')));
    dit(g('25') === null, 'N°25 : une conversation n\'est pas une vente', String(g('25')));
    dit(g('26') === 'Vinted', 'N°26 : vendue sur Vinted', String(g('26')));
    dit(g('27') === 'Leboncoin', 'N°27 : vente Leboncoin reliée par « n27 » dans son titre', String(g('27')));
    dit(g('28') === null && g('29') === null && g('30') === null, 'une vente Leboncoin annulée, une commande eBay annulée, un ACHAT : rien n\'est vendu', `${g('28')} ${g('29')} ${g('30')}`);
    dit(g('31') === 'Vinted', 'un brouillon dont la fiche a disparu : son annonce compte quand même pour son N°', String(g('31')));
    dit(v.pasSu.length === 0 && v.enCours === false, 'tout lu ⇒ ni « pas su », ni « en cours »', JSON.stringify(v.pasSu));
  }
  // 2. « Pas su » : chaque source illisible est DITE, jamais lue « pas vendue ».
  const p1 = essaie('ventes Leboncoin illisibles', () => R.numerosDejaVendus({ numeros, enLigne, vendusVinted, commandes, ventesLbc: null, itemsLbc, liensLbc: {} }));
  const p2 = essaie('ventes Vinted illisibles', () => R.numerosDejaVendus({ numeros, enLigne, vendusVinted: null, commandes, ventesLbc, itemsLbc, liensLbc: {} }));
  const p3 = essaie('ventes eBay illisibles', () => R.numerosDejaVendus({ numeros, enLigne, vendusVinted, commandes: null, ventesLbc, itemsLbc, liensLbc: {} }));
  const p4 = essaie('annonces Leboncoin illisibles', () => R.numerosDejaVendus({ numeros, enLigne, vendusVinted, commandes, ventesLbc, itemsLbc: null, liensLbc: {} }));
  dit(!!(p1 && p1.pasSu.includes('tes ventes Leboncoin')), 'ventes Leboncoin illisibles ⇒ « pas su », dit', JSON.stringify(p1 && p1.pasSu));
  dit(!!(p2 && p2.pasSu.includes('tes ventes Vinted')), 'ventes Vinted illisibles ⇒ « pas su », dit', JSON.stringify(p2 && p2.pasSu));
  dit(!!(p3 && p3.pasSu.includes('tes ventes eBay')), 'ventes eBay illisibles ⇒ « pas su », dit', JSON.stringify(p3 && p3.pasSu));
  dit(!!(p4 && p4.pasSu.includes('tes annonces Leboncoin')), 'une vente Leboncoin qui ne se relie pas, annonces illisibles ⇒ « pas su », dit', JSON.stringify(p4 && p4.pasSu));
  dit(!!(p1 && p1.vendus.get('22') === 'eBay' && p1.vendus.get('26') === 'Vinted'), 'et ce qui EST su reste dit (une source illisible n\'efface pas les autres)');
  // 3. L'alerte « à annuler », avec OÙ.
  const programmees = [
    { itemId: 'P22', sku: 'VRM-22' }, { itemId: 'P23', sku: 'VRM 023' }, { itemId: 'P24', sku: 'VRM-24' },
    { itemId: 'P21', sku: 'VRM-21' }, { itemId: 'P25', sku: 'VRM-25' }, { itemId: 'PX', sku: '' },
  ];
  const dv = essaie('doublesVenteEbay', () => R.doublesVenteEbay({ annonces: [], commandes, numeros, enLigne, vendusVinted, programmees, ventes: v }));
  const vu = dv ? dv.aAnnulerEbay.map((x) => `${x.numero}:${x.ou}`).join(',') : '';
  dit(vu === '22:eBay,23:Leboncoin,24:Vinted', 'programmées vendues AILLEURS ⇒ « à annuler », avec OÙ — pas la revenue, pas la conversation, pas une sans SKU', vu);
  dit(!!(dv && R.ouVenduesTexte(dv.aAnnulerEbay) === 'ailleurs' && R.ouVenduesTexte([{ ou: 'Vinted' }]) === 'sur Vinted'), 'le titre dit « ailleurs » quand elles sont vendues sur plusieurs plateformes, « sur Vinted » sinon');
  const dv0 = essaie('doublesVenteEbay sans verdict', () => R.doublesVenteEbay({ annonces: [], commandes, numeros, enLigne, vendusVinted, programmees }));
  dit(!!(dv0 && dv0.aAnnulerEbay.map((x) => x.numero).join(',') === '24'), 'sans verdict, l\'ancienne règle (Vinted seul) tient toujours', dv0 && dv0.aAnnulerEbay.map((x) => x.numero).join(','));
  // 4. Le brouillon « programmee » n'est qu'un repli en attendant eBay.
  const T = 1_800_000_000_000;
  const pr = { itemId: 'B1', at: T };
  dit(R.brouillonEncoreAttendu(pr, null) === true, 'eBay pas encore relu ⇒ le brouillon compte (VRM sait qu\'il l\'a programmée)');
  dit(R.brouillonEncoreAttendu(pr, { items: [], enLigne: [], capturedAt: T + 30000, complet: true }) === true, 'relu 30 s après (eBay peut tarder à la lister) ⇒ elle compte encore');
  dit(R.brouillonEncoreAttendu(pr, { items: [], enLigne: [], capturedAt: T + 3600000, complet: true }) === false, 'relu COMPLET une heure APRÈS, absente (annulée, terminée) ⇒ elle ne revient plus');
  dit(R.brouillonEncoreAttendu(pr, { items: [], enLigne: [], capturedAt: T + 3600000, complet: false }) === true, 'relu INCOMPLET ⇒ on ne conclut rien, elle compte');
  dit(R.brouillonEncoreAttendu(pr, { items: [], enLigne: [{ itemId: 'B1' }], capturedAt: T - 1, complet: true }) === false, 'partie EN LIGNE ⇒ elle n\'est plus « programmée » (une seule alerte, « à retirer »)');
  const brouillons = {
    a: { etatBrouillon: 'programmee', numero: '22', programme: { itemId: 'B1', at: T } },
    b: { etatBrouillon: 'programmee', numero: '24', programme: { itemId: 'B2', at: T } },
    c: { etatBrouillon: 'brouillon', numero: '26', programme: null },
  };
  const liste = essaie('programmeesConnues', () => R.programmeesConnues({ items: [{ itemId: 'E1', sku: 'VRM-25' }], enLigne: [{ itemId: 'B2' }], capturedAt: T + 30000, complet: true }, brouillons, true));
  dit(!!(liste && liste.map((x) => `${x.itemId}:${x.lu}`).join(',') === 'E1:true,B1:false'), 'la liste : celles d\'eBay, puis le brouillon encore attendu — pas celui parti en ligne, pas un simple brouillon', liste && liste.map((x) => `${x.itemId}:${x.lu}`).join(','));
  return ko;
}

const PROUVE = process.argv.includes('--prouve');
if (!PROUVE) {
  const ko = controles(APP0, true);
  console.log(ko ? `\n❌ eBay « déjà vendue » : ${ko} rouge(s)` : '\n✅ eBay « déjà vendue » : jugée par le N°, toutes plateformes, « pas su » jamais lu comme « pas vendue », et un brouillon programmé ne ressuscite plus');
  process.exit(ko ? 1 : 0);
} else {
  // Chaque réaffaiblissement doit faire passer AU MOINS un contrôle au rouge.
  const MUTATIONS = [
    ['sans « la paire est revenue »', "if (estSet(enLigne) && ids.some((id) => enLigne.has(id) && !vendusVinted.has(id))) continue;   // revenue", ''],
    ['Leboncoin ignoré', "for (const k of connus) pose(k, 'Leboncoin');", ''],
    ['eBay ignoré', "pose(numDeSkuEbay(li && li.sku), 'eBay')", "void 0"],
    ['les brouillons (`autres`) ignorés', 'for (const a of (Array.isArray(autres) ? autres : [])) if (a) ajoute(a.numero, a.id);', ''],
    ['une source illisible lue comme « rien de vendu »', "else if (!ventesLbc || typeof ventesLbc !== 'object') pasSu.push('tes ventes Leboncoin');", "else if (!ventesLbc || typeof ventesLbc !== 'object') {}"],
    ['l\'alerte sans verdict (Vinted seul)', 'const verdict = ventes && ventes.vendus', 'const verdict = false && ventes && ventes.vendus'],
    ['le brouillon programmé toujours attendu', 'if (!P || typeof P !== \'object\') return true;', 'return true;'],
  ];
  let nonPris = 0;
  for (const [nom, de, vers] of MUTATIONS) {
    if (APP0.indexOf(de) < 0) { console.log(`❌ mutation « ${nom} » : texte introuvable`); nonPris++; continue; }
    const ko = controles(APP0.replace(de, vers), false);
    console.log(`${ko ? '✅' : '❌'} mutation « ${nom} » ⇒ ${ko} contrôle(s) rouge(s)`);
    if (!ko) nonPris++;
  }
  console.log(nonPris ? `\n❌ ${nonPris} réaffaiblissement(s) que l'audit ne voit pas` : '\n✅ chaque réaffaiblissement est attrapé');
  process.exit(nonPris ? 1 : 0);
}
