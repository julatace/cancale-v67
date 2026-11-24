// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : « CE QUE TU GAGNES VRAIMENT » (24 nov., lot gains-reels)
// Il EXÉCUTE (esbuild → CommonJS, puis require) la vraie chaîne : `releveVentes` (le relevé que Ventes publie, comptes
// écartés compris) → `lignesReleve` (Statistiques) → `gainsReels` (src/gainsReels.js) → la vue `StatsGains` rendue
// (react-dom/server), sur une base INVENTÉE (aucune donnée réelle) : 3 comptes dont un écarté, 4 modèles + des titres
// non reconnus, des prix d'achat manquants, des frais notés, une vente à perte, une vente en GBP, un montant illisible,
// des sources d'achat. Chaque nombre est RECOMPTÉ à part (sans le module) et comparé.
//   node scripts/audit-gains-reels.cjs [--mutation=net|passu|min|devise|exclu|couverture|horseuro|aumoins]
// Une mutation réaffaiblit une règle : l'audit doit passer au ROUGE.
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os');
const R = process.env.VRM_RACINE || path.join(__dirname, '..');
const NM = [path.join(R, 'node_modules'), path.join(__dirname, '..', 'node_modules')].find((p) => fs.existsSync(path.join(p, 'esbuild')));
if (!NM) { console.log('❌ esbuild introuvable (node_modules absent)'); process.exit(1); }
const esbuild = require(path.join(NM, 'esbuild'));
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (!c && d !== undefined ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 400) : '')); };

const MUTS = {
  // le net oublie les frais notés
  net: ['src/gainsReels.js', 'return netDeVenteRangee({ eur: l.eur, achat: l.achat, frais: l.frais });', 'return netDeVenteRangee({ eur: l.eur, achat: l.achat, frais: 0 });'],
  // « pas su » devient 0 (un prix d'achat manquant compté gratuit)
  passu: ['src/gainsReels.js', 'return netDeVenteRangee({ eur: l.eur, achat: l.achat, frais: l.frais });', 'return netDeVenteRangee({ eur: l.eur, achat: l.achat == null ? 0 : l.achat, frais: l.frais });'],
  // classement dès une vente
  min: ['src/gainsReels.js', 'export const MIN_CLASSEMENT = MIN_RACHAT;', 'export const MIN_CLASSEMENT = 1;'],
  // une vente dans une autre devise n'est plus écartée
  devise: ['src/gainsReels.js', "if (!fini(l.eur) || !Number.isFinite(Number(l.ts)) || (l.devise && String(l.devise).toUpperCase() !== 'EUR')) { ecartees += 1; return; }", "if (!fini(l.eur) || !Number.isFinite(Number(l.ts))) { ecartees += 1; return; }"],
  // le relevé ne retire plus les comptes écartés (le propriétaire de la règle)
  exclu: ['src/ceQuiRapporte.js', 'if (!o || estMasquee(o) || !estFinalisee(o)) continue;', 'if (!o || !estFinalisee(o)) continue;'],
  // la vue ne dit plus la couverture
  couverture: ['src/natif/ecrans/StatsGains.jsx', "Tt.partiel ? tr('gr.sur', { k: nombre(Tt.nNet), n: nombre(Tt.n) }) : tr('gr.toutes', { n: nombre(Tt.n) })", "tr('gr.toutes', { n: nombre(Tt.n) })"],
  // la vue tait les commandes eBay hors euro
  horseuro: ['src/natif/ecrans/StatsGains.jsx', "Tt.horsEuro > 0 ? tr('gr.horsEuro', { n: nombre(Tt.horsEuro) }) : ''", "''"],
  // un bénéfice partiel présenté comme un plancher
  aumoins: ['src/natif/ecrans/StatsGains.jsx', "valeur={Tt && Tt.net != null ? signe(Tt.net) : null}", "valeur={Tt && Tt.net != null ? (Tt.partiel ? 'au moins ' : '') + signe(Tt.net) : null}"],
};
if (MUT && !MUTS[MUT]) { console.log('❌ mutation inconnue : ' + MUT); process.exit(2); }

async function charger() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-gains-'));
  const src = (f) => JSON.stringify(path.join(R, f));
  fs.writeFileSync(path.join(dir, 'entree.jsx'), `
export * as GR from ${src('src/gainsReels.js')};
export * as CQ from ${src('src/ceQuiRapporte.js')};
export * as CR from ${src('src/coutReel.js')};
export * as QR from ${src('src/quoiRacheter.js')};
export * as RS from ${src('src/rentabiliteSource.js')};
export * as LE from ${src('src/aujourdhui/lectures.js')};
export * as I18N from ${src('src/i18n/index.js')};
export { default as FR } from ${src('src/i18n/langues/fr.js')};
export { default as StatsGains } from ${src('src/natif/ecrans/StatsGains.jsx')};
export { default as React } from 'react';
export { renderToStaticMarkup } from 'react-dom/server';
`);
  const m = MUTS[MUT];
  const plugins = m ? [{ name: 'mutant', setup(b) {
    const cible = path.join(R, m[0]);
    b.onLoad({ filter: /\.(jsx?)$/ }, (a) => {
      if (path.resolve(a.path) !== cible) return undefined;
      const s = fs.readFileSync(cible, 'utf8');
      if (!s.includes(m[1])) { console.log('❌ mutation impossible : motif absent — ' + m[1].slice(0, 90)); process.exit(2); }
      return { contents: s.replace(m[1], m[2]), loader: 'jsx' };
    });
  } }] : [];
  await esbuild.build({ entryPoints: [path.join(dir, 'entree.jsx')], bundle: true, outfile: path.join(dir, 'sortie.cjs'), format: 'cjs', platform: 'node', jsx: 'automatic',
    loader: { '.js': 'jsx', '.css': 'empty' }, nodePaths: [NM], logLevel: 'silent', plugins, define: { 'process.env.NODE_ENV': '"production"' } });
  global.window = global.window || { addEventListener() {}, removeEventListener() {}, dispatchEvent() {} };
  global.CustomEvent = global.CustomEvent || class { constructor(t, o) { this.type = t; this.detail = o && o.detail; } };
  global.localStorage = global.localStorage || { getItem: () => null, setItem() {}, removeItem() {} };
  return { M: require(path.join(dir, 'sortie.cjs')), dir };
}

// ── LA BASE INVENTÉE ───────────────────────────────────────────────────────
let graine = 7;
const hasard = () => { graine = (graine * 1103515245 + 12345) % 2147483648; return graine / 2147483648; };
const J = 86400000, T0 = Date.parse('2026-10-01T10:00:00Z');
const MODELES = [['Nike', 'Nike Dunk Low panda'], ['Adidas', 'Adidas Samba OG blanche'], ['New Balance', 'New Balance 550 blanche'], ['Asics', 'Asics Gel Kayano 14 argent']];
function base() {
  const ventes = [], items = {}, txn = {};
  let i = 0;
  const ajoute = ({ compte, modele, prix, achat, frais = '', jours = 10, statut = 'completed', devise = 'EUR', titre }) => {
    i += 1;
    const tx = String(9000 + i), item = 'it' + i;
    const [brand, t] = MODELES[modele] || ['', titre || 'Paire de baskets'];
    const vente = T0 + i * 3600000 * 7;
    items[item] = { id: item, brand, size: '42', title: t, enLigne: vente - jours * J };
    txn[tx] = { item };
    ventes.push({ transaction_id: tx, date: new Date(vente).toISOString(), status: statut, title: titre || t, price: { amount: String(prix), currency_code: devise }, _acc: { login: compte, vinted_user_id: compte }, _achat: achat, _frais: frais, _num: String(100 + i) });
  };
  // Modèle 0 (Dunk) : 6 ventes, tout connu, rentable et rapide.
  for (let k = 0; k < 6; k++) ajoute({ compte: 'shop_a', modele: 0, prix: 120 + k * 5, achat: 60, frais: k % 2 ? '3.50' : '', jours: 3 + k });
  // Modèle 1 (Samba) : 5 ventes, une sans prix d'achat, une à perte.
  for (let k = 0; k < 5; k++) ajoute({ compte: 'shop_b', modele: 1, prix: 70, achat: k === 0 ? null : k === 1 ? 95 : 40, jours: 20 + k * 4 });
  // Modèle 2 (550) : 2 ventes seulement (jamais classé).
  for (let k = 0; k < 2; k++) ajoute({ compte: 'shop_a', modele: 2, prix: 90, achat: 30, jours: 2 });
  // Modèle 3 (Kayano) : 4 ventes, toutes sans prix d'achat.
  for (let k = 0; k < 4; k++) ajoute({ compte: 'shop_b', modele: 3, prix: 110, achat: null, jours: 15 });
  // Titres non reconnus (« Autres »), 3 ventes connues.
  for (let k = 0; k < 3; k++) ajoute({ compte: 'shop_a', modele: 9, titre: 'Lot chaussures ' + k, prix: 25 + Math.round(hasard() * 20), achat: 10, jours: 40 });
  // Compte ÉCARTÉ par son choix : 5 ventes très rentables qui ne doivent compter nulle part.
  for (let k = 0; k < 5; k++) ajoute({ compte: 'shop_exclu', modele: 0, prix: 500, achat: 10, jours: 1 });
  // Une vente en GBP (jamais convertie), une non finalisée (hors relevé).
  ajoute({ compte: 'shop_a', modele: 0, prix: 150, achat: 60, devise: 'GBP' });
  ajoute({ compte: 'shop_a', modele: 0, prix: 150, achat: 60, statut: 'pending' });
  return { ventes, extras: { items, txn, dates: null } };
}
const SOURCES = { at: Date.now(), sansAchat: 4, achatPasLu: 0, vintedLus: true, sources: [
  { cle: 'vinted', libelle: 'Vinted', genre: 'vinted', articles: 20, revendus: 12, nBenef: 10, beneficeMoyen: 2500, delaiMoyen: 9, nDelai: 10, partiel: false },
  { cle: 'f:brocante', libelle: 'Brocante', genre: 'hors', articles: 6, revendus: 4, nBenef: 4, beneficeMoyen: 4200, delaiMoyen: 30, nDelai: 4, partiel: false },
  { cle: 'f:lbc', libelle: 'Leboncoin', genre: 'hors', articles: 3, revendus: 2, nBenef: 2, beneficeMoyen: 9000, delaiMoyen: 2, nDelai: 2, partiel: false },
  { cle: 'f:magasin', libelle: 'Magasin', genre: 'hors', articles: 5, revendus: 5, nBenef: 5, beneficeMoyen: 3000, delaiMoyen: 5, nDelai: 5, partiel: true },
  { cle: 'non-saisie', libelle: 'Source pas saisie', genre: '', articles: 4, revendus: 3, nBenef: 0, beneficeMoyen: null, delaiMoyen: null, nDelai: 0 },
] };

(async () => {
  const { M, dir } = await charger();
  if (MUT) console.log('… mutation « ' + MUT + ' » posée');
  const { GR, CQ, CR, QR, LE, I18N, FR, StatsGains, React, renderToStaticMarkup } = M;
  dit(typeof (GR && GR.gainsReels) === 'function', 'G0 src/gainsReels.js exporte gainsReels');
  if (!GR || !GR.gainsReels) return fin(dir);
  I18N.ajouterSourceApp(FR);

  // ── La chaîne réelle : relevé (Ventes) → lignes (Statistiques) → gains ──
  const B = base();
  const montant = (o) => { const p = o.price; if (p && p.currency_code && p.currency_code !== 'EUR') return null; return Number(p.amount); };   // la règle `montantCommandeLu`
  const rows = CQ.releveVentes({ vinted: B.ventes, estMasquee: (o) => o._acc.vinted_user_id === 'shop_exclu', estFinalisee: (o) => o.status === 'completed', an0: 2025,
    montant, achat: (o) => o._achat, frais: (o) => (o._frais === '' ? 0 : Number(o._frais)), compte: (o) => o._acc.login, numero: (o) => o._num });
  const lignes = LE.lignesReleve(rows, B.extras, (it) => it.enLigne);
  const G = GR.gainsReels({ lignes, bilan: SOURCES, horsEuro: 2 });

  // ── Recompte indépendant (sans le module) ──
  const vues = B.ventes.filter((o) => o.status === 'completed' && o._acc.vinted_user_id !== 'shop_exclu');
  const eur = vues.filter((o) => o.price.currency_code === 'EUR');
  const connues = eur.filter((o) => o._achat != null);
  const netDe = (o) => Math.round(Number(o.price.amount) * 100) - Math.round((o._frais === '' ? 0 : Number(o._frais)) * 100) - Math.round(o._achat * 100);
  const totalNet = connues.reduce((s, o) => s + netDe(o), 0);
  dit(G.total.n === eur.length && G.total.nNet === connues.length && G.total.sansAchat === eur.length - connues.length,
    'G1 couverture : ' + connues.length + ' ventes au prix d’achat connu sur ' + eur.length + ', ' + (eur.length - connues.length) + ' sans prix d’achat', G.total);
  dit(G.total.net === totalNet, 'G2 le net total = Σ (vente − frais notés − prix d’achat) des ventes connues, au centime', { module: G.total.net, recompte: totalNet });
  dit(G.total.net === lignes.filter((l) => l.eur != null).map((l) => CR.netDeVenteRangee(l)).filter((x) => x != null).reduce((s, x) => s + x, 0), 'G2 et = Σ netDeVenteRangee (la règle propriétaire de la colonne « Net »)');
  dit(G.total.netMoyen === Math.round(totalNet / connues.length), 'G3 le net moyen par paire = total ÷ ventes connues', G.total.netMoyen);
  const js = eur.map((o) => (Date.parse(o.date) - B.extras.items[B.extras.txn[o.transaction_id].item].enLigne) / J);
  dit(G.total.delaiMoyen === Math.round((js.reduce((s, x) => s + x, 0) / js.length) * 10) / 10 && G.total.nDelai === js.length, 'G4 le délai moyen = mise en ligne → vente prouvée, sur les ventes datées', { m: G.total.delaiMoyen, n: G.total.nDelai });
  dit(G.total.ecartees === 1 && G.paire.paires.every((p) => p.eur !== 15000), 'G5 la vente en GBP est ÉCARTÉE et comptée (jamais convertie)', { ecartees: G.total.ecartees });
  const Gd = GR.gainsReels({ lignes: [...lignes, { plateforme: 'eBay', compte: '', id: 'ebay:x', ts: T0, eur: 99, achat: 10, frais: 0, devise: 'USD', titre: 'Nike Dunk Low' }] });
  dit(Gd.total.ecartees === 2 && Gd.total.net === G.total.net && Gd.modele.ecartees === 2, 'G5 une ligne marquée dans une autre devise (USD) est écartée aussi, jamais additionnée', Gd.total);
  dit(!lignes.some((l) => l.compte === 'shop_exclu') && !G.compte.groupes.some((g) => /shop_exclu/.test(g.k)), 'G6 le compte écarté n’entre dans aucun total ni groupe');
  dit(G.total.horsEuro === 2, 'G7 les commandes eBay hors euro publiées sont portées jusqu’à la vue', G.total.horsEuro);

  // Par modèle : chaque groupe recompté.
  const parModele = {};
  for (const o of eur) { const t = o.title; const k = /Dunk/.test(t) ? 'nike|dunk' : /Samba/.test(t) ? 'adidas|samba' : /550/.test(t) ? 'new balance|550' : /Kayano/.test(t) ? 'asics|gel-kayano' : ''; (parModele[k] = parModele[k] || []).push(o); }
  let okModeles = true; const detail = [];
  for (const g of G.modele.groupes) {
    const L = parModele[g.k] || [], K = L.filter((o) => o._achat != null);
    const moy = K.length ? Math.round(K.reduce((s, o) => s + netDe(o), 0) / K.length) : null;
    if (g.n !== L.length || g.nNet !== K.length || g.netMoyen !== moy) { okModeles = false; detail.push({ k: g.k, g: [g.n, g.nNet, g.netMoyen], r: [L.length, K.length, moy] }); }
  }
  dit(okModeles && G.modele.groupes.length === Object.keys(parModele).length, 'G8 par modèle : nombre, couverture et net moyen de chaque groupe = recompte', detail);
  dit(G.modele.groupes.find((g) => g.k === 'asics|gel-kayano').netMoyen === null, 'G9 « pas su » ⇒ null (« — ») : un modèle sans aucun prix d’achat n’a pas de net, jamais 0');
  const classes = G.modele.groupes.filter((g) => g.nNet >= 3 && !g.autres);
  const tousRanges = [...G.modele.meilleurs, ...G.modele.moinsBons];
  dit(tousRanges.every((k) => classes.some((g) => g.k === k)) && !tousRanges.includes('new balance|550') && !tousRanges.includes(''), 'G10 aucun classement sous 3 ventes au prix connu (550 : 2 ventes ; « Autres » jamais classé)', tousRanges);
  dit(G.modele.meilleurs.join() === 'nike|dunk' && G.modele.moinsBons.join() === 'adidas|samba', 'G11 le meilleur et le moins bon sont ceux du recompte (Dunk, Samba)', { m: G.modele.meilleurs, b: G.modele.moinsBons });
  const sc = (g) => QR.scoreRachat({ k: g.k, n: g.nNet, nDelai: g.nDelai, moyen: g.netMoyen / 100, mediane: g.delaiMoyen });
  dit(G.modele.aRacheter.join('|') === classes.filter((g) => sc(g) != null).sort((a, b) => sc(b) - sc(a)).map((g) => g.k).slice(0, 3).join('|'), 'G12 « À racheter » = scoreRachat (net moyen ÷ délai moyen, 3 ventes reliées et datées, net positif)', G.modele.aRacheter);
  // Par compte.
  const cA = eur.filter((o) => o._acc.login === 'shop_a' && o._achat != null), gA = G.compte.groupes.find((g) => g.k === 'Vinted|shop_a');
  dit(gA && gA.net === cA.reduce((s, o) => s + netDe(o), 0) && gA.nNet === cA.length, 'G13 par compte : le net de shop_a = recompte', gA);
  // Par paire.
  const P = G.paire, nets = P.paires.filter((p) => p.net != null).map((p) => p.net).sort((a, b) => b - a);
  dit(P.meilleurs.map((k) => P.paires.find((p) => p.k === k).net).join() === nets.slice(0, 3).join(), 'G14 par paire : les 3 meilleures ventes = les 3 plus gros nets');
  dit(!P.moinsBons.some((k) => P.meilleurs.includes(k)) && P.moinsBons.map((k) => P.paires.find((p) => p.k === k).net).join() === nets.slice().reverse().slice(0, 3).join(), 'G14 et les 3 moins bonnes = les 3 plus petits nets (une vente à perte comprise), jamais les mêmes');
  dit(P.sansAchat.length === G.total.sansAchat && P.sansAchat.every((k) => P.paires.find((p) => p.k === k).num), 'G15 chaque vente sans prix d’achat est listée avec SON N° (la porte de saisie)');
  const peu = GR.gainsReels({ lignes: lignes.filter((l) => l.achat != null).slice(0, 2) });
  dit(peu.paire.meilleurs.length === 0 && peu.modele.meilleurs.length === 0, 'G16 deux ventes connues ⇒ rien n’est classé (ni paire, ni modèle)', { p: peu.paire.meilleurs, m: peu.modele.meilleurs });
  // Par source.
  const S = G.source;
  dit(S.groupes.find((g) => g.k === 'vinted').netMoyen === 2500 && S.groupes.find((g) => g.k === 'f:brocante').netMoyen === 4200, 'G17 par source : le bénéfice moyen = celui de « Tes meilleures sources », tel quel');
  dit(!S.meilleurs.includes('f:lbc') && !S.meilleurs.includes('f:magasin') && !S.aRacheter.includes('f:magasin') && !S.aRacheter.includes('non-saisie'), 'G18 source : 2 reventes (Leboncoin) ou « au plus » (Magasin) ne sont jamais classées ni à racheter', { m: S.meilleurs, r: S.aRacheter });
  dit(GR.gainsReels({ lignes: [], bilan: null }).source === null && GR.gainsReels({ lignes: undefined }) === undefined && GR.gainsReels({ lignes: null }) === null, 'G19 pas su ⇒ null, en lecture ⇒ undefined (jamais une liste vide)');
  // Identité : le module ne pose ni N° ni prix d'achat — le modèle ne relie rien.
  const avant = JSON.stringify(lignes);
  GR.gainsReels({ lignes, bilan: SOURCES });
  dit(JSON.stringify(lignes) === avant, 'G20 rien n’est écrit dans le relevé (le modèle ne relie aucune vente, ne pose aucun prix)');

  // Le module n'est lu que par les statistiques (jamais par une règle d'identité, de N° ou de prix d'achat).
  const importeurs = [];
  const parcourir = (d) => { for (const e of fs.readdirSync(path.join(R, d), { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) parcourir(f); else if (/\.jsx?$/.test(e.name) && /from ['"][./]+(?:[^'"]*\/)?gainsReels\.js['"]/.test(fs.readFileSync(path.join(R, f), 'utf8'))) importeurs.push(f); } };
  parcourir('src');
  dit(importeurs.sort().join() === ['src/aujourdhui/StatsBranche.jsx', 'src/natif/ecrans/StatsGains.jsx'].join(), 'G21 gainsReels.js n’est importé que par Statistiques (aucune identité n’en dépend)', importeurs);

  // ── La vue rendue ──
  const montantTxt = (x) => (Math.round(x * 100) / 100).toFixed(2).replace('.', ',') + ' €';
  const html = (vue) => { global.localStorage = { getItem: (k) => (k === 'vrm_stats_gains_vue' ? vue : null), setItem() {}, removeItem() {} }; return renderToStaticMarkup(React.createElement(StatsGains, { G, sur: '30 jours', montant: montantTxt })); };
  const H = html('modele');
  const attr = (h, a) => { const m = h.match(new RegExp(a + '="([^"]*)"')); return m ? m[1] : null; };
  dit(attr(H, 'data-gr-net') === String(totalNet) && attr(H, 'data-gr-nnet') === String(connues.length) && attr(H, 'data-gr-n') === String(eur.length), 'V1 la vue montre le net total et sa couverture (data-gr-*)');
  const txt = H.replace(/<[^>]+>/g, ' ');
  dit(txt.includes(I18N.tr('gr.sur', { k: String(connues.length), n: String(eur.length) })), 'V2 partiel ⇒ « sur K des N ventes » écrit à côté du total', txt.slice(0, 200));
  dit(!/au moins/i.test(txt), 'V3 jamais « au moins » sur un bénéfice (une paire au prix inconnu peut être à perte)');
  dit(attr(H, 'data-gr-sansachat') === String(G.total.sansAchat) && /data-gr-saisir/.test(H) && txt.includes(I18N.tr('gr.sansAchat', { n: String(G.total.sansAchat) })), 'V4 le manque est NOMMÉ (« N ventes sans prix d’achat ») avec le bouton « Saisir »');
  dit(txt.includes(I18N.tr('gr.ecartees', { n: '1' })) && txt.includes(I18N.tr('gr.horsEuro', { n: '2' })), 'V5 autre devise : écartée ET dite (Vinted, eBay)');
  dit(attr(H, 'data-gr-meilleurs') === G.modele.meilleurs.join('|') && !/data-gr-groupe="new balance\|550"[^>]*data-gr-meilleurs/.test(H), 'V6 la vue range exactement ce que le module classe');
  const Hp = html('paire');
  dit((Hp.match(/data-gr-porte="1"/g) || []).length === Math.min(5, G.total.sansAchat), 'V7 par paire : chaque vente sans prix d’achat est une porte de saisie');
  const Hs = html('source');
  dit(/data-gr-groupe="f:brocante"/.test(Hs) && attr(Hs, 'data-gr-racheter') === S.aRacheter.join('|'), 'V8 par source : la vue montre les sources et « À racheter » du module');
  const Hv = renderToStaticMarkup(React.createElement(StatsGains, { G: { ...G, total: { ...G.total, net: null, netMoyen: null, nNet: 0, sansAchat: G.total.n, partiel: true } }, montant: montantTxt }));
  dit(attr(Hv, 'data-gr-net') === '' && /n-tuile-valeur[^>]*data-n-vide="1"/.test(Hv), 'V9 aucun prix d’achat ⇒ « — » (jamais 0 €)');
  // ── Textes : cinq langues ──
  const cles = Object.keys(FR).filter((k) => k.startsWith('gr.') || k === 'v2.ps.seg.gains');
  let manque = [];
  for (const l of ['en', 'es', 'it', 'de']) { const s = fs.readFileSync(path.join(R, 'src/i18n/langues', l, 'gains.js'), 'utf8'); for (const k of cles) if (!s.includes(JSON.stringify(k) + ':')) manque.push(l + ':' + k); }
  dit(cles.length > 30 && !manque.length, 'T1 chaque texte de l’écran existe en en/es/it/de', manque.slice(0, 5));
  fin(dir);
})().catch((e) => { console.log('❌ ' + (e && e.stack || e)); process.exit(1); });

function fin(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
  console.log(`\n${ko ? '❌' : '✅'} audit-gains-reels : ${ok} verts, ${ko} rouges${MUT ? ' (mutation ' + MUT + ')' : ''}`);
  process.exit(ko ? 1 : 0);
}
