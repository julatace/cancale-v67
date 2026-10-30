// ════════════════════════════════════════════════════════════════════════════
//  AUDIT « L'AGENT eBAY QUI DEMANDE » — la règle pure (src/agentEbay.js) et la
//  notification du matin (api/_lib/agent-ebay-rappel.js).
//
//  Le VRAI module est importé (jamais recopié) et jugé sur ce qu'il REND, sur
//  des paires INVENTÉES :
//   · une paire vendue (n'importe où) n'est jamais proposée ;
//   · « pas su » (ventes, annonces eBay, annonces Vinted, réglages) ⇒ RIEN n'est
//     proposé, et ce qui manque est nommé ;
//   · déjà en vente ou programmée sur eBay, jumelle par photo, « jamais » ⇒ pas
//     proposée ;
//   · le prix eBay n'est jamais sous le prix d'achat connu ;
//   · le maximum du jour tient compte de ce qui est déjà publié ;
//   · la phrase libre devient des règles par des mots-clés et des nombres, et
//     ce qui n'est pas compris est DIT ;
//   · la clé d'un N° est la même que `cleNum` d'App.jsx (§11) ;
//   · la notification : résumé de plus de 48 h, illisible, « pas maintenant »,
//     déjà envoyée ⇒ rien.
//  `--prouve` : réaffaiblit chaque règle tour à tour (copie du module) et exige
//  le rouge.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os');
const { pathToFileURL } = require('url');
const R = path.join(__dirname, '..');
const SRC = path.join(R, 'src', 'agentEbay.js');
const SRC_RAPPEL = path.join(R, 'api', '_lib', 'agent-ebay-rappel.js');

const MUTATIONS = {
  'vendue-proposee': ["    if (x.ventes.vendus.get(k)) { ecarte('vendue'); continue; }\n", ''],
  'pas-su-vide': ["  if (pasSu.length) return { etat: 'pas-su', pasSu };", '  /* pas su ignoré */'],
  'deja-ebay': ["    if (x.dejaSurEbay.get(k)) { ecarte('deja-ebay'); continue; }\n", ''],
  'jumelle': ["    if (j && j.gardeId && String(j.gardeId) !== id) { ecarte('jumelle'); continue; }\n", ''],
  'jamais': ["    if (jamais.has(k)) { ecarte('jamais'); continue; }\n", ''],
  'sous-achat': ["  if (a != null && Math.round(p * 100) < Math.round(a * 100)) return { prix: null, raison: 'sous-achat', achat: a, propose: p };\n", ''],
  'quota-ignore': ["- Math.max(0, Number(x.publieesAujourdhui) || 0));", ');'],
  'marque-devinee': ["if (ok === null) { ecarte('marque-inconnue'); continue; }", ''],
  'rappel-vieux': ['maintenant - at > RESUME_AGENT_MAX_AGE_MS || ', ''],
  'rappel-pause': ["  if (r.pause && r.pause === today) return { envoyer: false, raison: '« pas maintenant » aujourd’hui (son choix)' };\n", ''],
  'numero-double': ["    if (nDouble > 1) {", "    if (false) {"],
  'brouillon': ["    if (jugeBrouillons && x.brouillons.has(k)) { ecarte('brouillon'); continue; }\n", ''],
  'negation-ignoree': ["  if (neg) return { regles: {}, compris: [], pasCompris: [], vide: true, negation: neg[1] };\n", ''],
  'nombres-tus': ["(/^\\d+$/.test(w) ? true : ", "(/^\\d+$/.test(w) ? false : "],
  'prete-sans-prep': ["  if (p != null && p >= n) return", "  if (p == null || p >= n) return"],
  'pluriel-fixe': ["RAISONS_AGENT[k][e[k] > 1 ? 1 : 0]", "RAISONS_AGENT[k][1]"],
  'arret-resume': ["  if (prop && ETATS_AGENT_MUET.includes(prop.etat)) return", "  if (false) return"],
  'arret-journee': ["  if (agentArrete(regles)) return null;\n  const r = resume", "  const r = resume"],
  'rappel-arret': ["  if (agentArrete(regles)) return { envoyer: false, raison: 'agent arrêté (son choix)' };\n", ''],
  'taille-prix': ["const TAILLE_SEULE = `${TAILLE_TXT}${PRIX_SUIT}`;", "const TAILLE_SEULE = TAILLE_TXT;"],
  'jours-prix': ["${MOT_NB}${PAS_JOURS}${EUR}`).exec(t))) { const n = nombre(m[1]); if (n != null) regles.prixMax", "${MOT_NB}${EUR}`).exec(t))) { const n = nombre(m[1]); if (n != null) regles.prixMax"],
  'ponctuation': ["  t = ' ' + sansPonctuation(t) + ' ';\n", ''],
  'rappel-memo': ["  if (memo === undefined) return { envoyer: false, raison: 'mémo illisible — rien envoyé' };\n", ''],
};

function cleNumApp() {
  const app = fs.readFileSync(path.join(R, 'src', 'App.jsx'), 'utf8');
  const m = /const cleNum = \(v\) => \{[\s\S]*?\n\};/.exec(app);
  if (!m) return null;
  return new Function(m[0].replace('const cleNum =', 'return'))();
}

async function verifier(fichier, fichierRappel) {
  let ko = 0; const out = [];
  const dit = (bon, quoi, d) => { if (!bon) ko++; out.push(`${bon ? 'OK  ' : 'KO  '}${quoi}${d ? ' — ' + d : ''}`); };
  const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' (a levé)', String(e && e.message || e).slice(0, 160)); } };
  let A = {}, N = {};
  try { A = await import(pathToFileURL(fichier).href + '?t=' + Date.now() + Math.random()); } catch (e) { dit(false, 'src/agentEbay.js se charge', String(e && e.message)); }
  try { N = await import(pathToFileURL(fichierRappel).href + '?t=' + Date.now() + Math.random()); } catch (e) { dit(false, 'api/_lib/agent-ebay-rappel.js se charge', String(e && e.message)); }
  const J = 86400000, maintenant = Date.parse('2026-10-29T08:00:00Z');
  const paire = (num, o = {}) => ({ id: 'a' + num, num: String(num), title: 'Nike Air Max 1 taille 42', marque: 'Nike', taille: '42', tailleVinted: '42', prix: 60, uid: '11', photos: ['https://images1.vinted.net/x/' + num + '.jpg'], cover: null, cree: maintenant - 40 * J, ...o });
  const base = (o = {}) => {
    const paires = o.paires || [paire(1), paire(2), paire(3)];
    return { regles: A.normaliserReglesAgent ? A.normaliserReglesAgent(o.regles || {}) : {}, paires,
      enLigne: o.enLigne !== undefined ? o.enLigne : new Set(paires.map((p) => p.id)),
      ventes: o.ventes !== undefined ? o.ventes : { vendus: new Map(), pasSu: [], enCours: false },
      dejaSurEbay: o.dejaSurEbay !== undefined ? o.dejaSurEbay : new Map(),
      jumelles: o.jumelles || new Map(), achatDe: o.achatDe || (() => null), cochee: o.cochee,
      incertains: o.incertains, publieesAujourdhui: o.publieesAujourdhui || 0, maintenant };
  };
  const nums = (p) => (p && Array.isArray(p.proposees) ? p.proposees.map((x) => x.num).join(',') : `(${p && p.etat})`);

  await essaie('cle', async () => {
    const c = cleNumApp();
    const cas = ['007', ' 12 ', 'b125', 'B-125', 'n42', '', null, '42.0', 'AB 3'];
    dit(!!c && cas.every((v) => c(v) === A.cleNumAgent(v)), 'la clé d’un N° est la même que cleNum d’App.jsx (§11)');
  });
  await essaie('base', async () => {
    const p = A.propositionAgent(base());
    dit(p.etat === 'lu' && nums(p) === '1,2,3', 'trois paires en ligne, rien de vendu ⇒ les trois sont proposées', nums(p));
  });
  await essaie('vendue', async () => {
    const p = A.propositionAgent(base({ ventes: { vendus: new Map([['2', 'Leboncoin']]), pasSu: [], enCours: false } }));
    dit(nums(p) === '1,3' && p.ecartees.vendue === 1, 'une paire vendue sur Leboncoin n’est pas proposée (et c’est compté)', nums(p));
  });
  await essaie('pas-su', async () => {
    const a = A.propositionAgent(base({ ventes: { vendus: new Map(), pasSu: ['tes ventes eBay'], enCours: false } }));
    dit(a.etat === 'pas-su' && !a.proposees && /eBay/.test((a.pasSu || []).join()), 'ventes eBay illisibles ⇒ RIEN n’est proposé, et c’est nommé', a.etat);
    const b = A.propositionAgent(base({ dejaSurEbay: null }));
    dit(b.etat === 'pas-su' && !b.proposees, 'annonces eBay illisibles ⇒ rien n’est proposé', b.etat);
    const c = A.propositionAgent(base({ enLigne: null }));
    dit(c.etat === 'pas-su' && !c.proposees, 'annonces Vinted illisibles ⇒ rien n’est proposé', c.etat);
    const d = A.propositionAgent(base({ ventes: null }));
    dit(d.etat === 'pas-su', 'aucun verdict de vente ⇒ rien n’est proposé', d.etat);
    const e = A.propositionAgent({ ...base(), regles: undefined });
    dit(e.etat === 'en-cours', 'réglages pas encore lus ⇒ « en cours », rien n’est proposé', e.etat);
    const f = A.propositionAgent(base({ ventes: { vendus: new Map(), pasSu: [], enCours: true } }));
    dit(f.etat === 'en-cours' && !f.proposees, 'vérification des ventes encore en cours ⇒ rien n’est proposé', f.etat);
  });
  await essaie('deja-ebay', async () => {
    const p = A.propositionAgent(base({ dejaSurEbay: new Map([['1', { etat: 'en-vente' }], ['3', { etat: 'programmee' }]]) }));
    dit(nums(p) === '2' && p.ecartees['deja-ebay'] === 2, 'déjà en vente OU programmée sur eBay (tous comptes) ⇒ pas proposée', nums(p));
  });
  await essaie('jumelle', async () => {
    const p = A.propositionAgent(base({ jumelles: new Map([['a1', { gardeId: 'a2' }], ['a2', { gardeId: 'a2' }]]) }));
    dit(nums(p) === '2,3' && p.ecartees.jumelle === 1, 'deux fiches à la même photo : une seule proposée', nums(p));
  });
  await essaie('jamais', async () => {
    const p = A.propositionAgent(base({ regles: { jamais: ['003'] } }));
    dit(nums(p) === '1,2' && p.ecartees.jamais === 1, '« jamais sur eBay » (N°003 = N°3) ⇒ jamais proposée', nums(p));
  });
  await essaie('prix', async () => {
    const r1 = A.prixEbayAgent(50, A.normaliserReglesAgent({ prixMode: 'pct', prixValeur: 10 }), 60);
    dit(r1.prix == null && r1.raison === 'sous-achat', 'prix eBay (55 €) sous le prix d’achat (60 €) ⇒ refusé', JSON.stringify(r1));
    const r2 = A.prixEbayAgent(50, A.normaliserReglesAgent({ prixMode: 'eur', prixValeur: 5 }), 40);
    dit(r2.prix === 55, '+5 € sur 50 € ⇒ 55 €', JSON.stringify(r2));
    const p = A.propositionAgent(base({ achatDe: (x) => (x.num === '1' ? 70 : x.num === '2' ? 60 : null) }));
    dit(nums(p) === '2,3' && p.ecartees['sous-achat'] === 1, 'paire achetée 70 € vendue 60 € : pas proposée ; 60 € pour 60 € : proposée', nums(p));
    const q = A.propositionAgent(base({ paires: [paire(1, { prix: null })] }));
    dit(nums(q) === '' && q.ecartees['sans-prix'] === 1, 'sans prix Vinted lisible ⇒ pas proposée', nums(q));
  });
  await essaie('regles', async () => {
    const ps = [paire(1, { marque: 'Nike', tailleVinted: '42', prix: 65 }), paire(2, { marque: 'Adidas', tailleVinted: '42', prix: 80 }), paire(3, { marque: 'Nike', tailleVinted: '43', prix: 90 }), paire(4, { marque: 'Nike', tailleVinted: '42', prix: 40 }), paire(5, { marque: '', tailleVinted: '42', prix: 70 })];
    const c = A.comprendrePhrase('publie les Nike en 42 à plus de 60 €');
    const r = A.appliquerPhrase({}, c, 'x');
    const p = A.propositionAgent(base({ paires: ps, regles: r }));
    dit(nums(p) === '1' && p.ecartees['hors-regles'] === 3 && p.ecartees['marque-inconnue'] === 1, '« les Nike en 42 à plus de 60 € » ⇒ seule la N°1 ; la marque inconnue n’est pas devinée', nums(p) + ' ' + JSON.stringify(p.ecartees));
    const v = A.propositionAgent(base({ paires: [paire(1, { cree: maintenant - 5 * J }), paire(2, { cree: null })], regles: { joursMin: 30 } }));
    dit(nums(v) === '' && v.ecartees['hors-regles'] === 1 && v.ecartees['anciennete-inconnue'] === 1, 'ancienneté : 5 jours < 30 ⇒ écartée ; date inconnue ⇒ écartée, jamais devinée', JSON.stringify(v.ecartees));
    const w = A.propositionAgent(base({ regles: { seulementCochees: true }, cochee: (x) => x.num === '2' }));
    dit(nums(w) === '2', '« seulement celles cochées eBay » ⇒ seule la cochée', nums(w));
  });
  await essaie('quota', async () => {
    const p = A.propositionAgent(base({ paires: [1, 2, 3, 4, 5, 6, 7].map((n) => paire(n)), regles: { parJour: 5 }, publieesAujourdhui: 3 }));
    dit(nums(p) === '1,2' && p.ecartees.quota === 5, '5 par jour, 3 déjà publiées aujourd’hui ⇒ 2 proposées, 5 « au-delà du maximum »', nums(p));
  });
  await essaie('incertain', async () => {
    const p = A.propositionAgent(base({ incertains: new Set(['1']) }));
    dit(nums(p) === '2,3', 'une publication incertaine n’est pas reproposée avant la relecture chez eBay', nums(p));
  });
  await essaie('phrase', async () => {
    const c = A.comprendrePhrase('les Adidas en 40-41 entre 50 et 90 € +10 %, 3 par jour, rouges');
    dit(c.regles.prixMode === 'pct' && c.regles.prixValeur === 10 && c.regles.prixMin === 50 && c.regles.prixMax === 90 && c.regles.parJour === 3
      && JSON.stringify(c.regles.tailles) === '["40","40.5","41"]' && (c.regles.marques || []).join() === 'Adidas', 'une phrase complète devient des règles (marque, tailles, fourchette, +10 %, 3 par jour)', JSON.stringify(c.regles));
    dit(c.pasCompris.includes('rouges'), 'ce qui n’est pas compris est DIT (« rouges »), jamais deviné', c.pasCompris.join());
    const d = A.comprendrePhrase('compte_test qui dorment', { comptes: [{ uid: '11', login: 'compte_test' }] });
    dit((d.regles.comptesVinted || []).join() === '11' && d.regles.joursMin === 30, 'un compte Vinted nommé, « qui dorment » ⇒ 30 jours', JSON.stringify(d.regles));
    const r = A.texteRegles(A.appliquerPhrase({ jamais: ['7'] }, A.comprendrePhrase('Nike +5 €'), 'Nike +5 €'));
    dit(r.some((l) => /Nike/.test(l)) && r.some((l) => /\+ 5 €.*jamais sous ton prix d’achat/.test(l)) && r.some((l) => /N°7/.test(l)), 'la règle comprise est montrée en clair (et « jamais » est gardé)', r.join(' | '));
  });
  await essaie('numero-double', async () => {
    const p = A.propositionAgent(base({ paires: [paire(30, { id: 'a30', prix: 50 }), paire(30, { id: 'b30', prix: 90 }), paire(2)] }));
    dit(nums(p) === '2' && p.ecartees['numero-double'] === 2, 'deux paires en ligne sous le même N° : aucune n’est proposée, les deux sont comptées', nums(p) + ' ' + JSON.stringify(p.ecartees));
    dit(/2 dont le N° est porté par deux paires/.test(A.phraseEcartees(p.ecartees)), 'et c’est dit', A.phraseEcartees(p.ecartees));
    const q = A.propositionAgent({ ...base({ paires: [paire(30, { id: 'a30' }), paire(2)] }), doubles: new Map([['30', 2]]) });
    dit(nums(q) === '2' && q.ecartees['numero-double'] === 2, 'la liste n’en garde qu’une (l’autre fiche n’y est pas) : la N°30 n’est pas proposée, et les DEUX paires sont comptées', nums(q) + ' ' + JSON.stringify(q.ecartees));
  });
  await essaie('brouillons', async () => {
    const p = A.propositionAgent({ ...base(), brouillons: new Set(['2']) });
    dit(nums(p) === '1,3' && p.ecartees.brouillon === 1, 'une paire déjà en brouillon eBay n’est pas reproposée (et c’est compté)', nums(p));
    dit(A.propositionAgent({ ...base(), brouillons: null }).etat === 'pas-su', 'brouillons illisibles ⇒ « pas su », rien n’est proposé');
    dit(A.propositionAgent({ ...base(), brouillons: undefined }).etat === 'en-cours', 'brouillons en cours de lecture ⇒ « en cours »');
  });
  await essaie('pluriel', async () => {
    const t = A.phraseEcartees({ vendue: 1, 'deja-ebay': 2, jamais: 1, 'sous-achat': 1 });
    dit(/1 déjà vendue ailleurs/.test(t) && /2 déjà en vente ou programmées/.test(t) && /1 mise dans « jamais/.test(t) && /1 dont le prix eBay serait sous/.test(t), 'les raisons s’accordent au nombre (« 1 déjà vendue », « 1 mise »)', t);
  });
  await essaie('phrase-pieges', async () => {
    for (const ph of ['ne publie pas les Adidas', 'pas de Nike', 'tout sauf les Adidas', 'publie tout à moins de 30 € sauf les Adidas', 'sans les Puma']) {
      const c = A.comprendrePhrase(ph);
      dit(c.vide && !(c.regles.marques || []).length && !!c.negation, `une négation n’est JAMAIS appliquée à l’envers : « ${ph} »`, JSON.stringify(c));
    }
    const a = A.comprendrePhrase('Nike 42 43 44');
    dit(['42', '43', '44'].every((x) => a.pasCompris.includes(x)), '« Nike 42 43 44 » : les nombres sans règle sont DITS', a.pasCompris.join());
    const b = A.comprendrePhrase('les Jordan entre 80 et 150 euros');
    dit(b.regles.prixMin === 80 && b.regles.prixMax === 150 && !b.pasCompris.length, '« euros » est compris (pas de « uros »)', JSON.stringify(b));
    const c = A.comprendrePhrase('à moins de 80 euros');
    dit(c.regles.prixMax === 80 && !c.pasCompris.length, '« à moins de 80 euros » ⇒ prix max 80, rien de non compris', JSON.stringify(c));
    const d = A.comprendrePhrase('publie les nike en taille 9 US');
    dit(d.pasCompris.includes('9'), '« taille 9 US » : la taille non comprise est DITE', d.pasCompris.join());
    const e = A.comprendrePhrase('à -10 %');
    dit(e.pasCompris.some((x) => /-10/.test(x)) && e.regles.prixMode == null, '« -10 % » n’est pas appliqué en silence', JSON.stringify(e));
  });
  await essaie('resume', async () => {
    const p = A.propositionAgent(base());
    const r = A.resumeAgent(p, maintenant);
    dit(r && r.n === 3 && r.at === maintenant, 'le résumé publié porte le nombre proposé et l’heure', JSON.stringify(r));
    dit(A.resumeAgent(A.propositionAgent(base({ dejaSurEbay: null })), maintenant) === null, '« pas su » ne publie aucun résumé');
    const l = A.ligneJourneeAgent({ n: 2, at: maintenant - 3600000 }, '2026-10-29', maintenant);
    dit(l && /2 paires à regarder pour eBay/.test(l.text) && !/prête/.test(l.text), 'Ma journée, sans préparation : « 2 paires à regarder pour eBay » (jamais « prêtes »)', l && l.text);
    const l2 = A.ligneJourneeAgent({ n: 3, pretes: 1, at: maintenant }, '2026-10-29', maintenant);
    dit(l2 && /3 paires proposées pour eBay · 1 prête à publier/.test(l2.text), 'Ma journée, préparées : « 3 paires proposées · 1 prête à publier »', l2 && l2.text);
    const l3 = A.ligneJourneeAgent({ n: 2, pretes: 2, at: maintenant }, '2026-10-29', maintenant);
    dit(l3 && /2 paires prêtes pour eBay — je les publie \?/.test(l3.text), 'Ma journée, toutes préparées et prêtes : « 2 paires prêtes pour eBay — je les publie ? »', l3 && l3.text);
    const l4 = A.ligneJourneeAgent({ n: 3, pretes: 0, at: maintenant }, '2026-10-29', maintenant);
    dit(l4 && /3 paires à regarder/.test(l4.text), 'préparées mais aucune prête ⇒ « à regarder »', l4 && l4.text);
    const r4 = A.resumeAgent(p, maintenant, null, 2);
    dit(r4 && r4.n === 3 && r4.pretes === 2, 'le résumé porte les prêtes quand l’écran a préparé', JSON.stringify(r4));
    dit(!('pretes' in (A.resumeAgent(p, maintenant) || {})), 'sans préparation, le résumé ne porte AUCUN nombre de prêtes');
    dit(A.ligneJourneeAgent({ n: 2, at: maintenant - 49 * 3600000 }, '2026-10-29', maintenant) === null, 'Ma journée : un résumé de plus de 48 h ne s’affiche pas');
    dit(A.ligneJourneeAgent({ n: 2, at: maintenant, pause: '2026-10-29' }, '2026-10-29', maintenant) === null, 'Ma journée : « pas maintenant » aujourd’hui ⇒ rien');
     // Dernier tour du 29 oct. : « Arrêter l'agent » le fait taire.
    for (const e of ['eteint', 'sans-ebay', 'devise']) {
      const rn = A.resumeAgent({ etat: e }, maintenant);
      dit(rn && rn.n === 0 && rn.at === maintenant && !('pretes' in rn), `agent « ${e} » : le résumé publié devient NEUTRE (n : 0) — plus rien ne demande`, JSON.stringify(rn));
    }
    dit(A.ligneJourneeAgent({ n: 3, pretes: 3, at: maintenant }, '2026-10-29', maintenant, { actif: false }) === null, 'Ma journée : agent arrêté ⇒ rien, même avec un ancien résumé « 3 prêtes »');
    dit(!!A.ligneJourneeAgent({ n: 3, pretes: 3, at: maintenant }, '2026-10-29', maintenant, { actif: true }), 'l’autre sens : agent actif ⇒ la ligne reste');
  });
  await essaie('phrase-pieges', async () => {
    // Dernier tour du 29 oct. : quatre mauvaises lectures, désormais dites ou justes.
    const a = A.comprendrePhrase('les Nike en 41 à 50 €');
    dit(JSON.stringify(a.regles.tailles) === '["41"]' && a.regles.prixMin == null && a.regles.prixMax == null && a.pasCompris.includes('50'), '« en 41 à 50 € » : la pointure 41, et « 50 » dit non compris (jamais 19 pointures 41 → 50)', JSON.stringify(a));
    const b = A.comprendrePhrase('nike taille 40 à 50 euros');
    dit(JSON.stringify(b.regles.tailles) === '["40"]' && b.pasCompris.includes('50'), '« taille 40 à 50 euros » : la pointure 40, « 50 » dit non compris', JSON.stringify(b));
    const c = A.comprendrePhrase('publie les nike en ligne depuis moins de 10 jours');
    dit(c.regles.prixMax == null && c.pasCompris.some((x) => /moins de 10 jours/.test(x)), '« depuis moins de 10 jours » n’est JAMAIS un prix : dit non compris', JSON.stringify(c));
    const c2 = A.comprendrePhrase('à moins de 10 j');
    dit(c2.regles.prixMax == null && c2.pasCompris.length > 0, '« moins de 10 j » non plus', JSON.stringify(c2));
    const c3 = A.comprendrePhrase('nike maximum 10 jours');
    dit(c3.regles.prixMax == null && c3.pasCompris.includes('10'), '« maximum 10 jours » n’est pas un prix de 10 € (dit non compris)', JSON.stringify(c3));
    const d = A.comprendrePhrase('publie les Nike, Adidas et Puma');
    dit(['Nike', 'Adidas', 'Puma'].every((m) => (d.regles.marques || []).includes(m)) && !d.pasCompris.length, '« les Nike, Adidas et Puma » : les trois marques (la virgule ne colle plus)', JSON.stringify(d));
    const e = A.comprendrePhrase('publie les Adidas.');
    dit(JSON.stringify(e.regles.marques) === '["Adidas"]' && !e.pasCompris.length, '« publie les Adidas. » : Adidas (le point ne colle plus)', JSON.stringify(e));
    const f = A.comprendrePhrase('nike en 41,5 et 42 à moins de 80 €');
    dit(JSON.stringify(f.regles.tailles) === '["41.5","42"]' && f.regles.prixMax === 80, 'une décimale reste une décimale : « 41,5 et 42 », « moins de 80 € »', JSON.stringify(f.regles));
    const g = A.comprendrePhrase('Nike en 41 à 45');
    dit((g.regles.tailles || []).length === 9, 'l’autre sens : « en 41 à 45 » reste un intervalle de pointures', JSON.stringify(g.regles.tailles));
  });

  await essaie('rappel', async () => {
    const t = '2026-10-29';
    const ok = N.notificationAgentEbay({ resume: { n: 4, at: maintenant - 3600000 }, memo: null, today: t, maintenant });
    dit(ok.envoyer && /4 paires à regarder pour eBay/.test(ok.titre) && !/prête/.test(ok.titre) && ok.url === '/?tab=ebay_agent', 'notification sans préparation : « 🛒 4 paires à regarder pour eBay » (jamais « prêtes »)', ok.titre);
    const ok2 = N.notificationAgentEbay({ resume: { n: 4, pretes: 4, at: maintenant - 3600000 }, memo: null, today: t, maintenant });
    dit(ok2.envoyer && /4 paires prêtes pour eBay — je les publie \?/.test(ok2.titre), 'notification après préparation : « 🛒 4 paires prêtes pour eBay — je les publie ? »', ok2.titre);
    dit(/À traiter/.test(ok.corps || ''), 'la notification dit où aller : eBay → À traiter', ok.corps);
    dit(!N.notificationAgentEbay({ resume: { n: 4, at: maintenant - 49 * 3600000 }, memo: null, today: t, maintenant }).envoyer, 'résumé de plus de 48 h ⇒ rien');
    dit(!N.notificationAgentEbay({ resume: undefined, memo: null, today: t, maintenant }).envoyer, 'résumé illisible ⇒ rien');
    dit(!N.notificationAgentEbay({ resume: { n: 4, at: maintenant, pause: t }, memo: null, today: t, maintenant }).envoyer, '« pas maintenant » aujourd’hui ⇒ rien');
    dit(!N.notificationAgentEbay({ resume: { n: 4, at: maintenant }, memo: undefined, today: t, maintenant }).envoyer, 'mémo illisible ⇒ rien (jamais deux demandes)');
    dit(!N.notificationAgentEbay({ resume: { n: 4, at: maintenant }, memo: { date: t }, today: t, maintenant }).envoyer, 'déjà demandé aujourd’hui ⇒ rien');
    dit(!N.notificationAgentEbay({ resume: { n: 0, at: maintenant }, memo: null, today: t, maintenant }).envoyer, 'aucune paire prête ⇒ rien');
    dit(!N.notificationAgentEbay({ resume: { n: 3, pretes: 3, at: maintenant }, regles: { actif: false }, memo: null, today: t, maintenant }).envoyer, 'agent arrêté par Julien ⇒ rien, même avec un résumé frais « 3 prêtes »');
    dit(N.notificationAgentEbay({ resume: { n: 3, pretes: 3, at: maintenant }, regles: { actif: true }, memo: null, today: t, maintenant }).envoyer, 'l’autre sens : agent actif ⇒ la question part');
  });
  return { ko, out };
}

(async () => {
  const prouve = process.argv.includes('--prouve');
  if (!prouve) {
    const { ko, out } = await verifier(SRC, SRC_RAPPEL);
    out.forEach((l) => console.log(l));
    console.log(`\n${out.length - ko} contrôle(s) OK, ${ko} en échec`);
    process.exit(ko ? 1 : 0);
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-ebay-'));
  let rates = 0;
  for (const [nom, [de, vers]] of Object.entries(MUTATIONS)) {
    const cible = nom.startsWith('rappel-') ? SRC_RAPPEL : SRC;
    const src = fs.readFileSync(cible, 'utf8');
    if (!src.includes(de)) { console.log(`?? ${nom} : ancre introuvable`); rates++; continue; }
    // Une copie qui garde l'arborescence (le serveur importe la phrase de l'app, §11).
    const d = path.join(tmp, nom);
    fs.mkdirSync(path.join(d, 'src'), { recursive: true }); fs.mkdirSync(path.join(d, 'api', '_lib'), { recursive: true });
    const fA = path.join(d, 'src', 'agentEbay.js'), fN = path.join(d, 'api', '_lib', 'agent-ebay-rappel.js');
    fs.copyFileSync(SRC, fA); fs.copyFileSync(SRC_RAPPEL, fN);
    fs.writeFileSync(cible === SRC ? fA : fN, src.replace(de, vers));
    const { ko } = await verifier(fA, fN);
    console.log(`${ko ? 'ROUGE' : 'VERT (mutation non attrapée)'}  ${nom} — ${ko} contrôle(s) au rouge`);
    if (!ko) rates++;
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\n${Object.keys(MUTATIONS).length - rates}/${Object.keys(MUTATIONS).length} mutations attrapées`);
  process.exit(rates ? 1 : 0);
})();
