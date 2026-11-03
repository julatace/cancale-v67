// Audit : « CE QUI RAPPORTE LE PLUS » (Statistiques, 3 novembre).
//
// On EXÉCUTE la vraie chaîne sur un jeu FABRIQUÉ (le dépôt est public) :
//   ventes Vinted brutes (forme réelle : price {amount}, status, date, _acc)
//   → `releveVentes` (src/ceQuiRapporte.js), avec les VRAIES règles d'App.jsx
//     extraites du source (`classifyOrderStatus`, `montantCommandeLu`) ;
//   commandes eBay brutes → `ventesAutresBenefice` d'App.jsx (extraite, avec
//     `montantRecuEbay`, `commandeEbayEngagee`, `ficheUniqueDuNumero`, `cleNum`) ;
//   → les lignes de la période (marque, taille, `modeleSur`, mise en ligne)
//   → `classementRapporte` par Modèle, Marque, Taille, Compte, Site.
// Chaque chiffre est comparé à un calcul FAIT À LA MAIN (en tête de chaque bloc).
// Le jeu : deux comptes, 50 articles au MÊME titre, des prix d'achat manquants,
// une vente annulée, une vente masquée, un prix Vinted illisible, une commande
// eBay en livres (écartée), une marque qui contredit le modèle, un « 550 » sans
// marque, une vente à perte.
// `--prouve` rejoue l'audit sur des règles RÉAFFAIBLIES : chacune doit passer au rouge.
process.env.TZ = 'Europe/Paris';
const fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm');
const R = path.join(__dirname, '..');
const SRC = path.join(R, 'src', 'ceQuiRapporte.js');
const APP = fs.readFileSync(path.join(R, 'src', 'App.jsx'), 'utf8');

const MUTATIONS = {
  achat_inconnu_zero: (s) => s.replace("const connu = l.achat != null && String(l.achat).trim() !== '' && isFinite(Number(l.achat));", 'const connu = true;'),
  brut_sur_tout_le_ca: (s) => s.replace('const brut = g.nCout ? (g.caCouvert - g.cout) / 100 : null;', 'const brut = g.nCout ? (g.ca - g.cout) / 100 : null;'),
  devise_convertie: (s) => s.replace(" || (l.devise && String(l.devise).toUpperCase() !== 'EUR')", ''),
  marque_contredite_acceptee: (s) => s.replace('    if (!proprio) return null;                    // la marque lue contredit le modèle', '    if (!proprio) proprio = proprios[0];'),
  numero_seul_accepte: (s) => s.replace("    if (numeroSeul) return null;                  // « 550 » sans New Balance lue : rien n'est sûr\n", ''),
  sous_chaine: (s) => s.replace("export const contientMots = (t, k) => !!k && (' ' + t + ' ').includes(' ' + k + ' ');", 'export const contientMots = (t, k) => !!k && t.includes(k);'),
  autres_classe_comme_les_autres: (s) => s.replace("    if ((a.k === '') !== (b.k === '')) return a.k === '' ? 1 : -1;\n", ''),
  tri_par_nombre: (s) => s.replace('    if (a.brut != null && b.brut !== a.brut) return b.brut - a.brut;\n', ''),
  delai_republiee: (s) => s.replace('Number(l.ts) >= e) { const j', 'true) { const j'),
  moitie_arrondie: (s) => s.replace("return `la moitié part en moins de ${Math.floor(mediane) + 1} j`;", "return `la moitié part en moins de ${Math.round(mediane)} j`;"),
  annulee_gardee: (s) => s.replace('    if (!o || estMasquee(o) || !estFinalisee(o)) continue;', '    if (!o || estMasquee(o)) continue;'),
  masquee_gardee: (s) => s.replace('    if (!o || estMasquee(o) || !estFinalisee(o)) continue;', '    if (!o || !estFinalisee(o)) continue;'),
};

async function charger(src) {
  const f = path.join(os.tmpdir(), `ceQuiRapporte-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(f, src);
  try { return await import(f); } finally { try { fs.unlinkSync(f); } catch (_) {} }
}

// ── Extraction d'App.jsx : une déclaration de premier niveau, telle quelle ──
// (du « const NOM = » ou « function NOM » jusqu'à la ligne d'avant la
// prochaine instruction de premier niveau).
function bloc(nom) {
  const L = APP.split('\n');
  const i = L.findIndex((l) => l.startsWith(`const ${nom} = `) || l.startsWith(`function ${nom}(`));
  if (i < 0) return null;
  let j = i + 1;
  while (j < L.length && (L[j] === '' || /^[\s})\]]/.test(L[j]))) j++;
  return L.slice(i, j).join('\n');
}
const NOMS_APP = ['cleNum', 'classifyOrderStatus', 'montantCommandeLu', 'montantRecuEbay', 'commandeEbayEngagee', 'ficheUniqueDuNumero', 'ventesAutresBenefice'];
function reglesApp() {
  const code = NOMS_APP.map((n) => { const b = bloc(n); if (!b) throw new Error('absente d’App.jsx : ' + n); return b; }).join('\n') + `\n;({ ${NOMS_APP.join(', ')} })`;
  const stub = () => { throw new Error('Leboncoin/Vestiaire non servis dans ce jeu'); };
  return vm.runInNewContext(code, { lbcAnnulee: stub, lbcFinalisee: stub, vcVenteAnnulee: stub, etapeMotVc: stub, montantRecuVc: stub, dateVenteVc: stub, Number, String, Object, Array, Date, Math, isFinite, isNaN, Set, Map, RegExp, JSON });
}

// ── LE JEU FABRIQUÉ ─────────────────────────────────────────────────────────
const J = 86400000;
const T0 = new Date(2026, 9, 1, 12, 0, 0).getTime();          // 1er octobre 2026, 12 h
const FIN = 'Commande finalisée';
const A = { vinted_user_id: '111', login: 'atelier_sneak' }, P = { vinted_user_id: '222', login: 'paris_kicks' };
const vinted = [], marques = {}, mise = {}, achats = {}, masquees = new Set();
const vente = (acc, tx, prix, titre, jour, { statut = FIN, marque = '', achat = null, enLigneJ = null } = {}) => {
  const ts = T0 + jour * J;
  vinted.push({ transaction_id: tx, title: titre, price: prix === 'illisible' ? { amount: 'abc' } : { amount: String(prix), currency_code: 'EUR' }, status: statut, date: new Date(ts).toISOString(), _acc: acc });
  marques[tx] = marque; achats[tx] = achat; if (enLigneJ != null) mise[tx] = ts - enLigneJ * J;
};
// atelier_sneak : 50 « Nike Air Max 90 taille 42 » (même titre), 60 € chacune ;
// prix d'achat 20 € pour les 30 premières, inconnu pour les 20 autres ; mise en
// ligne connue pour les 10 premières (1 à 10 jours avant la vente).
for (let k = 0; k < 50; k++) vente(A, 1000 + k, 60, 'Nike Air Max 90 taille 42', k % 25, { marque: 'Nike', achat: k < 30 ? 20 : null, enLigneJ: k < 10 ? k + 1 : null });
vente(A, 1100, 60, 'Nike Air Max 90 taille 42', 3, { statut: 'Commande annulée', marque: 'Nike', achat: 20, enLigneJ: 2 });   // annulée
vente(A, 1101, 60, 'Nike Air Max 90 taille 42', 4, { marque: 'Nike', achat: 20 }); masquees.add(1101);                       // masquée
vente(A, 1102, 'illisible', 'Nike Air Max 90 taille 42', 5, { marque: 'Nike', achat: 20 });                                    // prix illisible
// paris_kicks
vente(P, 2001, 70, 'Adidas Samba taille 41', 2, { marque: 'adidas', achat: 30, enLigneJ: 4 });
vente(P, 2002, 80, 'adidas samba OG taille 42', 6, { marque: 'Adidas', enLigneJ: 7 });
vente(P, 2003, 50, 'Nike Dunk Low taille 43', 8, { marque: 'Adidas', achat: 45 });        // la marque lue contredit « Dunk »
vente(P, 2004, 90, 'New Balance 550 taille 44', 9, { marque: '' });                         // « 550 » sans marque lue
vente(P, 2005, 40, 'Air Max 180 taille 42', 10, { marque: 'Nike', achat: 50, enLigneJ: 3 }); // vente à perte ; PAS une Air Max 1
vente(P, 2006, 55, 'Nike Air Max 90 taille 42', 11, { marque: 'Nike', achat: 25, enLigneJ: -2 }); // « mise en ligne » APRÈS la vente (republiée)
// eBay : E1 en euros (dû 90, frais 10 ⇒ 80 reçus ; SKU VRM-7 ⇒ prix d'achat 35) ;
// E2 en livres ⇒ écartée, jamais convertie.
const ebayCmd = (orderId, du, fee, cur, titre, sku, jour) => ({ orderId, orderPaymentStatus: 'PAID', creationDate: new Date(T0 + jour * J).toISOString(),
  paymentSummary: { totalDueSeller: { value: String(du), currency: cur } }, totalMarketplaceFee: { value: String(fee), currency: cur }, lineItems: [{ sku, title: titre }] });
const EBAY = [ebayCmd('E1', 90, 10, 'EUR', 'Salomon XT-6 taille 44', 'VRM-7', 12), ebayCmd('E2', 120, 12, 'GBP', 'Nike Air Max 90 taille 42', 'VRM-8', 13)];
const NUMEROS = { a7: { numero: '7', buyPrice: '35' }, a8: { numero: '8', buyPrice: '10' } };

// ── À LA MAIN ───────────────────────────────────────────────────────────────
// Relevé : 51 (atelier : 50 + 1102) + 6 (paris) + E1 = 58 lignes ; exclues : 1100
// (annulée), 1101 (masquée), E2 (livres) ; 1102 (prix illisible) entre au relevé à
// `null` et le classement l'ÉCARTE (ecartees = 1).
// Classement, n = 57, prix d'achat connus = 30 + (2001, 2003, 2005, 2006) + E1 = 35.
// Délais connus : les 10 premières Air Max 90 (1…10 j), 2001 (4), 2002 (7),
// 2005 (3) ; 2006 est « mise en ligne » après la vente ⇒ hors délai. nDelai = 13.
// MODÈLE :
//   Nike Air Max 90 : 51 (50 + 2006), achat connu 31 : ca couvert 30×60 + 55 = 1855,
//     coût 30×20 + 25 = 625 ⇒ brut 1230 ; moyen 1230/31 = 39,677… ⇒ 39,68 ;
//     marge 1230/1855 = 66,307…% ⇒ 66,3 ; délais 1…10 ⇒ médiane 5,5 ⇒ « moins de 6 j ».
//   Salomon XT-6 (eBay) : 1, brut 80 − 35 = 45, moyen 45, marge 56,25 ⇒ 56,3 (arrondi au dixième : 562,5 → 563).
//   Adidas Samba : 2, achat connu 1 (2001) : brut 70 − 30 = 40, moyen 40, marge 40/70 = 57,1 ;
//     délais 4 et 7 ⇒ médiane 5,5.
//   Nike Air Max (2005, « air max 180 » n'est ni une 1 ni une 90) : brut −10, marge −25.
//   Autres : 2003 (Dunk sous « Adidas ») + 2004 (550 sans marque) = 2, achat connu 1 : brut 5.
//   Ordre : Air Max 90 (1230) · XT-6 (45) · Samba (40) · Air Max (−10) · Autres.
// MARQUE (la marque lue ; eBay : celle du titre, ici « Salomon » ; 2004 : « New Balance ») :
//   Nike : 51 + 2005 = 52, brut 1230 − 10 = 1220 ; Adidas : 2001, 2002, 2003 = 3, brut 40 + 5 = 45,
//   marge 45/120 = 37,5 ; Salomon : 1, brut 45 ; New Balance : 1, brut —.
//   Ordre : Nike · Adidas (45, 3 vendus) · Salomon (45, 1 vendu) · New Balance.
// COMPTE : atelier_sneak 50 (brut 1200) · eBay 1 (45) · paris_kicks 6 (40 + 5 − 10 + 30 = 65)
//   ⇒ atelier_sneak (1200) · paris_kicks (65) · eBay (45).
// SITE : Vinted 50 + 6 = 56, brut 1200 + 65 = 1265 · eBay 1, 45.
// TAILLE : 42 → 50 + 2002 + 2005 + 2006 = 53, brut 1200 − 10 + 30 = 1220 ; 44 → 2004 + E1 = 2, brut 45 ;
//   41 → 1, brut 40 ; 43 → 1, brut 5.
const ATT = {
  releve: { n: 58, vinted: 57, ebay: 1, sans: ['1100', '1101', 'ebay:E2'] },
  total: { n: 57, nCout: 35, nDelai: 13, ecartees: 1 },
  modele: [
    { k: 'nike|air max 90', nom: 'Nike Air Max 90', n: 51, nCout: 31, brut: 1230, moyen: 39.68, marge: 66.3, mediane: 5.5, nDelai: 10, phrase: 'la moitié part en moins de 6 j' },
    { k: 'salomon|xt-6', nom: 'Salomon XT-6', n: 1, nCout: 1, brut: 45, moyen: 45, marge: 56.3, mediane: null, nDelai: 0 },
    { k: 'adidas|samba', nom: 'Adidas Samba', n: 2, nCout: 1, brut: 40, moyen: 40, marge: 57.1, mediane: 5.5, nDelai: 2 },
    { k: 'nike|air max', nom: 'Nike Air Max', n: 1, nCout: 1, brut: -10, moyen: -10, marge: -25, mediane: 3, nDelai: 1 },
    { k: '', nom: 'Autres', n: 2, nCout: 1, brut: 5, moyen: 5, marge: 10, mediane: null, nDelai: 0 },
  ],
  marque: [
    { k: 'nike', nom: 'Nike', n: 52, nCout: 32, brut: 1220 },
    { k: 'adidas', nom: 'Adidas', n: 3, nCout: 2, brut: 45, marge: 37.5 },
    { k: 'salomon', nom: 'Salomon', n: 1, nCout: 1, brut: 45 },
    { k: 'new balance', nom: 'New Balance', n: 1, nCout: 0, brut: null, marge: null, moyen: null },
  ],
  compte: [
    { k: 'Vinted|atelier_sneak', n: 50, nCout: 30, brut: 1200 },
    { k: 'Vinted|paris_kicks', n: 6, nCout: 4, brut: 65 },
    { k: 'eBay', n: 1, nCout: 1, brut: 45 },
  ],
  taille: [{ k: '42', n: 53, brut: 1220 }, { k: '44', n: 2, brut: 45 }, { k: '41', n: 1, brut: 40 }, { k: '43', n: 1, brut: 5 }],
};

async function audit(src, bavard) {
  let ko = 0, ok = 0;
  const dit = (c, m, d) => { if (c) ok++; else ko++; if (bavard) console.log((c ? '✅ ' : '❌ ') + m + (d != null && d !== '' ? ' — ' + d : '')); };
  let M;
  try { M = await charger(src); } catch (e) { dit(false, 'le module se charge', String(e.message || e)); return ko; }
  let F;
  try { F = reglesApp(); dit(true, 'les règles d’App.jsx s’extraient et s’exécutent : ' + NOMS_APP.join(', ')); }
  catch (e) { dit(false, 'les règles d’App.jsx s’extraient', String(e.message || e)); return ko; }

  // ── 1. Le relevé (la vraie construction de l'écran Ventes) ──
  const autres = F.ventesAutresBenefice({ lbc: [], ebay: EBAY, vestiaire: [], numeros: NUMEROS, achat: (f) => Number(f.buyPrice),
    numLbc: () => '', numEbayLigne: (o, li) => F.cleNum(String(li.sku || '').replace(/^VRM-/, '')) });
  const titreDe = {}; for (const c of EBAY) titreDe['ebay:' + c.orderId] = c.lineItems[0].title;
  const rel = M.releveVentes({ vinted, estMasquee: (o) => masquees.has(o.transaction_id), estFinalisee: (o) => F.classifyOrderStatus(o.status) === 'completed',
    montant: F.montantCommandeLu, achat: (o) => achats[o.transaction_id], frais: () => 0, compte: (o) => o._acc.login, autres, titreDe, an0: 2025 });
  const ids = rel.map((r) => String(r[2]));
  dit(rel.length === ATT.releve.n && rel.filter((r) => r[0] === 'Vinted').length === ATT.releve.vinted && rel.filter((r) => r[0] === 'eBay').length === ATT.releve.ebay,
    `relevé : ${ATT.releve.n} lignes (${ATT.releve.vinted} Vinted, ${ATT.releve.ebay} eBay)`, `${rel.length} · ${ids.slice(-4).join(',')}`);
  dit(ATT.releve.sans.every((x) => !ids.includes(x)), 'annulée (1100), masquée (1101) et commande en livres (E2) hors du relevé', ATT.releve.sans.filter((x) => ids.includes(x)).join(','));
  const r1102 = rel.find((r) => r[2] === '1102');
  dit(!!r1102 && r1102[4] === null, 'prix Vinted illisible : `null` dans le relevé (jamais 0 €)', r1102 ? String(r1102[4]) : 'absente');
  const e1 = rel.find((r) => r[2] === 'ebay:E1');
  dit(!!e1 && e1[4] === 80 && e1[5] === 35, 'eBay E1 : 80 € reçus (dû − frais), prix d’achat 35 € par SKU', e1 ? `${e1[4]} · ${e1[5]}` : 'absente');

  // ── 2. Les lignes de la période (forme de `useReleveStats`) ──
  const mapE = { 'ebay:E1': { marque: 'Salomon', taille: '44' } };
  const lignes = rel.map(([plateforme, compte, id, ts, eur, achat, frais, titre]) => {
    const tx = Number(id), v = plateforme === 'Vinted';
    const taille = v ? (/taille (\d+)/.exec(titre) || [])[1] || '' : mapE[id].taille;
    const marque = v ? (marques[tx] || (/new balance/i.test(titre) ? 'New Balance' : '')) : mapE[id].marque;
    return { plateforme, compte, id, ts, eur, achat, frais, titre, marque, taille, modeleSur: M.modeleSur(v ? marques[tx] : '', titre), enLigne: v && mise[tx] != null ? mise[tx] : null };
  });

  // ── 3. Le classement ──
  const egal = (a, b) => (a == null && b == null) || (a != null && b != null && Math.abs(a - b) < 1e-9);
  const juge = (axe, attendus) => {
    const C = M.classementRapporte(lignes, axe);
    if (!C) { dit(false, `${axe} : un classement`); return null; }
    const ordre = C.groupes.map((g) => g.k).join(' · ');
    dit(ordre === attendus.map((a) => a.k).join(' · '), `${axe} : ordre ${attendus.map((a) => a.nom || a.k || 'Autres').join(' · ')}`, ordre);
    for (const a of attendus) {
      const g = C.groupes.find((x) => x.k === a.k);
      if (!g) { dit(false, `${axe} « ${a.k} » présent`); continue; }
      const champs = ['n', 'nCout', 'brut', 'moyen', 'marge', 'mediane', 'nDelai'].filter((c) => c in a);
      const faux = champs.filter((c) => !egal(g[c], a[c]));
      if (a.nom && g.nom !== a.nom) faux.push(`nom ${g.nom}`);
      dit(!faux.length, `${axe} « ${a.nom || a.k || 'Autres'} » : ${champs.map((c) => `${c} ${a[c] == null ? '—' : a[c]}`).join(', ')}`, faux.map((c) => `${c}=${g[c]}`).join(', '));
      if (a.phrase) dit(M.phraseMoitie(g.mediane) === a.phrase, `${axe} « ${a.nom} » : « ${a.phrase} »`, M.phraseMoitie(g.mediane));
      dit(g.lignes.length === g.n && g.lignes.every((i, j) => !j || lignes[g.lignes[j - 1]].ts >= lignes[i].ts), `${axe} « ${a.nom || a.k || 'Autres'} » : ses ${g.n} articles, du plus récent au plus ancien`);
    }
    return C;
  };
  const Cm = juge('modele', ATT.modele);
  if (Cm) dit(Cm.n === ATT.total.n && Cm.nCout === ATT.total.nCout && Cm.nDelai === ATT.total.nDelai && Cm.ecartees === ATT.total.ecartees,
    `couverture : prix d’achat connus ${ATT.total.nCout}/${ATT.total.n}, délai ${ATT.total.nDelai}, ${ATT.total.ecartees} écartée (prix illisible)`, Cm && `${Cm.nCout}/${Cm.n} · ${Cm.nDelai} · ${Cm.ecartees}`);
  juge('marque', ATT.marque);
  juge('compte', ATT.compte);
  juge('site', [{ k: 'Vinted', n: 56, nCout: 34, brut: 1265 }, { k: 'eBay', n: 1, nCout: 1, brut: 45 }]);
  juge('taille', ATT.taille);
  // Somme des groupes = le total, sur chaque axe (aucune vente perdue ni comptée deux fois).
  for (const axe of Object.keys(M.AXES_RAPPORTE)) {
    const C = M.classementRapporte(lignes, axe);
    const s = C.groupes.reduce((t, g) => t + g.n, 0), sb = Math.round(C.groupes.reduce((t, g) => t + (g.brut || 0), 0) * 100);
    dit(s === C.n && sb === (1265 + 45) * 100, `${axe} : la somme des groupes = ${C.n} ventes et 1 310 € de bénéfice brut`, `${s} · ${sb / 100}`);
  }

  // ── 4. Le modèle sûr, cas par cas ──
  const cas = [
    ['Nike', 'Nike Air Max 90 taille 42', 'Nike Air Max 90'], ['', 'air max 95 og', 'Nike Air Max 95'],
    ['Nike', 'Air Max 180', 'Nike Air Max'], ['Nike', 'Nike Air Max 1000', 'Nike Air Max'],
    ['Adidas', 'Nike Dunk Low', null], ['', 'New Balance 550 blanche', null], ['New Balance', 'NB 550 blanche', 'New Balance 550'],
    ['', 'Basket montante taille 42', null], ['Nike x sacai x UNDERCOVER', 'Dunk low', 'Nike Dunk'],
    ['Nike', 'Jordan 1 mid', 'Jordan 1'], ['', 'Asics Gel-Kayano 14', 'Asics Gel-Kayano'], ['ASICS', 'gel kayano 14', 'Asics Gel-Kayano'],
    ['', 'Nike P-6000', 'Nike P-6000'], ['', 'p6000 grise', 'Nike P-6000'], ['Okaïdi', 'Gazelle bleue', null], ['', 'Coupe vent imperméable Kariban', null],
  ];
  for (const [m, t, att] of cas) { const r = M.modeleSur(m, t); dit((r ? r.nom : null) === att, `modèle de « ${t} »${m ? ` (marque « ${m} »)` : ''} : ${att || 'Autres'}`, r ? r.nom : 'Autres'); }
  // 50 articles au même titre : UN groupe de 50 (une statistique), jamais une identité.
  const memes = lignes.filter((l) => l.titre === 'Nike Air Max 90 taille 42' && l.compte === 'atelier_sneak');
  dit(memes.length === 51 && new Set(memes.map((l) => l.id)).size === 51, '51 lignes « Nike Air Max 90 taille 42 » d’atelier_sneak au relevé (dont celle au prix illisible), chacune SA transaction', `${memes.length}`);

  // ── 5. Le branchement dans App.jsx (lu dans le code, commentaires retirés) ──
  const code = APP.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((l) => l.replace(/(^|[^:'"`])\/\/.*$/, '$1')).join('\n');
  const appel = (/releveVentes\(\{[\s\S]*?titreDe \}\)/.exec(code) || [''])[0];
  dit(/estMasquee: isHidden/.test(appel) && /estFinalisee: \(o\) => classifyOrderStatus\(o\.status\) === 'completed'/.test(appel) && /montant: montantCommandeLu\b/.test(appel) && /autres: autresBenefice/.test(appel),
    'l’écran Ventes construit le relevé par `releveVentes` : masquées et non finalisées écartées, prix par `montantCommandeLu`, autres plateformes par `ventesAutresBenefice`', appel.replace(/\s+/g, ' ').slice(0, 160));
  dit(/save\('vrm_stats_ventes', \{ v: 1, l: releve/.test(code), 'ce relevé est celui publié dans `vrm_stats_ventes`');
  dit(/modeleSur: modeleSur\(\(it && it\.brand\) \|\| '', titre\)/.test(code), 'Statistiques lit le modèle sûr avec la marque LUE sur l’annonce reliée par la transaction');
  dit(/<CeQuiRapporte lignes=\{lp\}/.test(code), 'la carte « Ce qui rapporte le plus » reçoit les lignes de la PÉRIODE choisie (`lp`)');

  // ── 6. La phrase et les « pas su » ──
  const ph = [[0.4, 'la moitié part en moins d’un jour'], [5.5, 'la moitié part en moins de 6 j'], [6, 'la moitié part en moins de 7 j'], [null, '']];
  for (const [v, att] of ph) dit(M.phraseMoitie(v) === att, `médiane ${v} ⇒ « ${att} »`, M.phraseMoitie(v));
  dit(M.classementRapporte(null, 'modele') === null, 'relevé pas lu ⇒ null (« — »), jamais un classement vide');
  const Cd = M.classementRapporte([{ plateforme: 'eBay', id: 'x', ts: T0, eur: 100, achat: 10, devise: 'GBP', marque: 'Nike', taille: '42' }, { plateforme: 'eBay', id: 'y', ts: T0, eur: 50, achat: null, marque: 'Nike', taille: '42' }], 'marque');
  dit(Cd.ecartees === 1 && Cd.n === 1 && Cd.groupes[0].brut === null && Cd.groupes[0].moyen === null && Cd.groupes[0].marge === null,
    'une ligne dans une autre devise est écartée (jamais convertie) ; un groupe sans prix d’achat connu : brut, moyen, marge « — »', JSON.stringify(Cd.groupes[0]));
  return ko;
}

(async () => {
  const src = fs.readFileSync(SRC, 'utf8');
  if (process.argv.includes('--prouve')) {
    let rate = 0;
    for (const [nom, f] of Object.entries(MUTATIONS)) {
      const m = f(src);
      if (m === src) { console.log(`❌ mutation ${nom} : motif absent`); rate++; continue; }
      const ko = await audit(m, false);
      console.log(`${ko ? '✅' : '❌'} mutation ${nom} : ${ko ? ko + ' rouge(s)' : 'AUCUN rouge'}`);
      if (!ko) rate++;
    }
    console.log(rate ? `\n❌ ${rate} mutation(s) non détectée(s)` : `\n✅ toutes les mutations (${Object.keys(MUTATIONS).length}) sont rouges`);
    process.exit(rate ? 1 : 0);
  }
  const ko = await audit(src, true);
  console.log(ko ? `\n❌ audit-ce-qui-rapporte : ${ko} rouge(s)` : '\n✅ audit-ce-qui-rapporte : tout vert');
  process.exit(ko ? 1 : 0);
})();
