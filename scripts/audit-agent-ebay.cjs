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
    const d = A.comprendrePhrase('julatace3535 qui dorment', { comptes: [{ uid: '11', login: 'julatace3535' }] });
    dit((d.regles.comptesVinted || []).join() === '11' && d.regles.joursMin === 30, 'un compte Vinted nommé, « qui dorment » ⇒ 30 jours', JSON.stringify(d.regles));
    const r = A.texteRegles(A.appliquerPhrase({ jamais: ['7'] }, A.comprendrePhrase('Nike +5 €'), 'Nike +5 €'));
    dit(r.some((l) => /Nike/.test(l)) && r.some((l) => /\+ 5 €.*jamais sous ton prix d’achat/.test(l)) && r.some((l) => /N°7/.test(l)), 'la règle comprise est montrée en clair (et « jamais » est gardé)', r.join(' | '));
  });
  await essaie('resume', async () => {
    const p = A.propositionAgent(base());
    const r = A.resumeAgent(p, maintenant);
    dit(r && r.n === 3 && r.at === maintenant, 'le résumé publié porte le nombre proposé et l’heure', JSON.stringify(r));
    dit(A.resumeAgent(A.propositionAgent(base({ dejaSurEbay: null })), maintenant) === null, '« pas su » ne publie aucun résumé');
    const l = A.ligneJourneeAgent({ n: 2, at: maintenant - 3600000 }, '2026-10-29', maintenant);
    dit(l && /2 paires prêtes pour eBay/.test(l.text), 'Ma journée : « 2 paires prêtes pour eBay — je les publie ? »', l && l.text);
    dit(A.ligneJourneeAgent({ n: 2, at: maintenant - 49 * 3600000 }, '2026-10-29', maintenant) === null, 'Ma journée : un résumé de plus de 48 h ne s’affiche pas');
    dit(A.ligneJourneeAgent({ n: 2, at: maintenant, pause: '2026-10-29' }, '2026-10-29', maintenant) === null, 'Ma journée : « pas maintenant » aujourd’hui ⇒ rien');
  });
  await essaie('rappel', async () => {
    const t = '2026-10-29';
    const ok = N.notificationAgentEbay({ resume: { n: 4, at: maintenant - 3600000 }, memo: null, today: t, maintenant });
    dit(ok.envoyer && /4 paires prêtes pour eBay — publier \?/.test(ok.titre) && ok.url === '/?tab=ebay_agent', 'notification « 🛒 4 paires prêtes pour eBay — publier ? » qui ouvre eBay → Agent', ok.titre);
    dit(!N.notificationAgentEbay({ resume: { n: 4, at: maintenant - 49 * 3600000 }, memo: null, today: t, maintenant }).envoyer, 'résumé de plus de 48 h ⇒ rien');
    dit(!N.notificationAgentEbay({ resume: undefined, memo: null, today: t, maintenant }).envoyer, 'résumé illisible ⇒ rien');
    dit(!N.notificationAgentEbay({ resume: { n: 4, at: maintenant, pause: t }, memo: null, today: t, maintenant }).envoyer, '« pas maintenant » aujourd’hui ⇒ rien');
    dit(!N.notificationAgentEbay({ resume: { n: 4, at: maintenant }, memo: undefined, today: t, maintenant }).envoyer, 'mémo illisible ⇒ rien (jamais deux demandes)');
    dit(!N.notificationAgentEbay({ resume: { n: 4, at: maintenant }, memo: { date: t }, today: t, maintenant }).envoyer, 'déjà demandé aujourd’hui ⇒ rien');
    dit(!N.notificationAgentEbay({ resume: { n: 0, at: maintenant }, memo: null, today: t, maintenant }).envoyer, 'aucune paire prête ⇒ rien');
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
    const f = path.join(tmp, nom + '-' + path.basename(cible));
    fs.writeFileSync(f, src.replace(de, vers));
    const { ko } = await verifier(cible === SRC ? f : SRC, cible === SRC ? SRC_RAPPEL : f);
    console.log(`${ko ? 'ROUGE' : 'VERT (mutation non attrapée)'}  ${nom} — ${ko} contrôle(s) au rouge`);
    if (!ko) rates++;
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\n${Object.keys(MUTATIONS).length - rates}/${Object.keys(MUTATIONS).length} mutations attrapées`);
  process.exit(rates ? 1 : 0);
})();
