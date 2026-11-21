// Audit : « ACHETÉS MAIS PAS ENCORE EN LIGNE » (11 nov., lot pas-en-ligne) — src/pasEnLigne.js
// et son branchement (Ma journée, Achats).
//   · identité (§2.4, §5) : 50 articles au MÊME titre, chacun jugé par SON N° ou SON achat ;
//     une annonce au même titre sans N° ne désigne aucun d'eux ;
//   · « pas en ligne » PROUVÉ : toutes les lectures complètes, de moins de 24 h ; sinon
//     « à confirmer », jamais compté, le compte nommé avec son âge ;
//   · un achat sans N° : prouvé seulement si toute annonce actuelle est rattachée à un achat ;
//   · seuil réglable (7/14/30/60), le plus ancien d'abord ; lecture ratée ⇒ `su: false` ;
//   · branchement : la carte de Ma journée n'existe que s'il y en a (liste prouvée non vide),
//     textes par tr() dans les 5 langues.
// `--prouve` : chaque règle réaffaiblie doit faire passer l'audit au rouge.
const fs = require('fs'), path = require('path'), os = require('os');
const R = path.join(__dirname, '..');
const SRC = path.join(R, 'src', 'pasEnLigne.js');

const MUTATIONS = {
  titre_identite: (s) => s.replace("if (c.sorte === 'num' && presentCles.has(c.cle)) { enLigne++; continue; }",
    "if (c.sorte === 'num' && (presentCles.has(c.cle) || presents.some((p) => p.titre && p.titre === c.titre))) { enLigne++; continue; }"),
  vieille_ok: (s) => s.replace('if (!(age <= FRAIS_MS)) return { ...base, etat: \'vieille\', lu, jours };', ''),
  ratee_ok: (s) => s.replace("if (!s || s.ok !== true) return { ...base, etat: 'ratee' };", "if (!s) return { ...base, etat: 'ratee' };"),
  sans_numero_ignore: (s) => s.replace("if (c.sorte === 'num' && sansNumero > 0) raisons.push({ sorte: 'sans-numero', n: sansNumero });", ''),
  pas_relie_ignore: (s) => s.replace("if (c.sorte === 'achat' && pasRelies > 0) raisons.push({ sorte: 'pas-relie', n: pasRelies });", ''),
  achat_relie_garde: (s) => s.replace("if (!l.lot || l.n == null || n >= l.n) continue;", "if (l.lot && l.n != null && n >= l.n) continue;"),
  pas_su_vide: (s) => s.replace('if (!Array.isArray(presents)) return vide;', 'if (!Array.isArray(presents)) presents = [];'),
  tri_inverse: (s) => s.replace('const tri = (a, b) => (a.depuis - b.depuis)', 'const tri = (a, b) => (b.depuis - a.depuis)'),
  seuil_libre: (s) => s.replace('export const seuilValide = (s) => (SEUILS_PAS_EN_LIGNE.includes(Number(s)) ? Number(s) : SEUIL_DEFAUT);', 'export const seuilValide = (s) => Number(s) || SEUIL_DEFAUT;'),
  connu_garde: (s) => s.replace('const exclu = (k) => (connus && connus.has(k)) || (vendus && vendus.has(k));', 'const exclu = (k) => (vendus && vendus.has(k));'),
  doublon_deux: (s) => s.replace('const deja = parCle.get(c.cle);', 'const deja = null;'),
};

async function charger(src) {
  const f = path.join(os.tmpdir(), `pas-en-ligne-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(f, src);
  try { return await import(f); } finally { try { fs.unlinkSync(f); } catch (_) {} }
}

const J = 24 * 3600e3;
const NOW = Date.parse('2026-11-11T12:00:00Z');
// Le jour LOCAL (le calendrier de l'appareil), comme une date saisie « AAAA-MM-JJ ».
const jour = (n) => { const d = new Date(NOW - n * J); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const frais = (nom, plat = 'vinted') => ({ plateforme: plat, nom, ok: true, lu: NOW - 2 * 3600e3, complet: true });

async function verifier(src) {
  const M = await charger(src);
  const fautes = [];
  const dit = (ok, quoi) => { if (!ok) fautes.push(quoi); };

  // ── 1. 50 achats hors plateforme au MÊME titre, N°1 à N°50, achetés il y a 1 à 50 jours.
  const hors = Array.from({ length: 50 }, (_, i) => ({ id: 'ob_' + (i + 1), title: 'Nike Air Force 1 blanche 42', price: String(30 + i), date: jour(i + 1), numero: String(i + 1) }));
  const { candidats } = M.candidatsPasEnLigne({ hors, connus: new Set(), vendus: new Set(), achats: [] });
  dit(candidats.length === 50, `50 candidats attendus, ${candidats.length}`);
  // Le N°17 est en ligne sur Leboncoin ; une annonce Vinted AU MÊME TITRE sans N° mais reliée à un achat Vinted.
  const presents = [{ cles: ['17'], txs: [] }, { cles: [], txs: ['999'], titre: 'Nike Air Force 1 blanche 42' }];
  const sources = [frais('shop_a'), frais('shop_b'), frais('Leboncoin', 'leboncoin')];
  const r = M.jugerPasEnLigne({ candidats, presents, sources, seuilJours: 14, maintenant: NOW });
  const nums = r.liste.map((c) => c.numero);
  dit(r.su === true, 'su attendu');
  dit(!nums.includes('17'), 'le N°17 est en ligne : jamais listé');
  dit(r.enLigne === 1, `1 en ligne attendu, ${r.enLigne}`);
  // ≥ 14 j : N°14..N°50 (37) moins le 17 ⇒ 36 ; récents : 1..13 ⇒ 13.
  dit(r.liste.length === 36, `36 prouvés attendus, ${r.liste.length}`);
  dit(r.recents === 13, `13 récents attendus, ${r.recents}`);
  dit(r.aConfirmer.length === 0, 'rien à confirmer quand tout est frais');
  dit(nums[0] === '50' && nums[nums.length - 1] === '14', `le plus ancien d'abord (${nums[0]} … ${nums[nums.length - 1]})`);
  dit(r.liste.every((c) => c.titre === 'Nike Air Force 1 blanche 42'), 'titres conservés');
  const n20 = r.liste.find((c) => c.numero === '20');
  dit(n20 && n20.prix === 49 && n20.jours === 20, 'prix d’achat et âge de LA ligne N°20');

  // ── 2. Un compte pas relu depuis 3 j ⇒ tout « à confirmer », compte nommé, rien compté.
  const vieux = M.jugerPasEnLigne({ candidats, presents, sources: [frais('shop_a'), { plateforme: 'vinted', nom: 'shop_b', ok: true, lu: NOW - 3 * J - 3600e3, complet: true }], seuilJours: 14, maintenant: NOW });
  dit(vieux.liste.length === 0, `compte vieux : 0 prouvé attendu, ${vieux.liste.length}`);
  dit(vieux.aConfirmer.length === 36, `compte vieux : 36 à confirmer, ${vieux.aConfirmer.length}`);
  const m = vieux.manques.sources[0];
  dit(m && m.nom === 'shop_b' && m.etat === 'vieille' && m.jours === 3, 'le compte pas relu est nommé avec ses 3 jours');
  // Lecture ratée, jamais faite, partielle : à confirmer aussi.
  for (const [s, e] of [[{ plateforme: 'vinted', nom: 'x', ok: false }, 'ratee'], [{ plateforme: 'vinted', nom: 'x', ok: true, lu: null }, 'jamais'], [{ plateforme: 'vestiaire', nom: 'Vestiaire', ok: true, lu: NOW - 3600e3, complet: false }, 'partielle']]) {
    const x = M.jugerPasEnLigne({ candidats, presents, sources: [frais('shop_a'), s], seuilJours: 14, maintenant: NOW });
    dit(x.liste.length === 0 && x.manques.sources.some((q) => q.etat === e), `lecture « ${e} » ⇒ rien de prouvé`);
  }

  // ── 3. Une annonce actuelle SANS N° ni achat relié (au même titre) : elle pourrait être l'un d'eux.
  const avecInconnue = [...presents, { cles: [], txs: [], titre: 'Nike Air Force 1 blanche 42' }];
  const inc = M.jugerPasEnLigne({ candidats, presents: avecInconnue, sources, seuilJours: 14, maintenant: NOW });
  dit(inc.liste.length === 0 && inc.aConfirmer.length === 36 && inc.manques.sansNumero === 1, 'une annonce sans N° ⇒ à confirmer, comptée');

  // ── 4. Lecture des annonces ratée ⇒ pas su.
  const ps = M.jugerPasEnLigne({ candidats, presents: null, sources, maintenant: NOW });
  dit(ps.su === false && ps.liste.length === 0, 'annonces pas lues ⇒ su:false, rien listé');

  // ── 5. 50 achats Vinted au même titre : reliés ⇒ hors liste ; non reliés ⇒ prouvés seulement si
  //       toute annonce actuelle est rattachée à un achat.
  const achats = Array.from({ length: 50 }, (_, i) => ({ transaction_id: 91000000 + i, title: 'Nike Air Force 1 blanche 42', date: new Date(NOW - (20 + i) * J).toISOString(), status: 'Commande finalisée', prix: 40 }));
  achats[3].status = 'Remboursée';
  const liens = new Map([[String(91000007), 1]]);
  const cv = M.candidatsPasEnLigne({ achats, liens }).candidats;
  dit(cv.length === 48, `48 achats candidats (1 relié, 1 remboursé), ${cv.length}`);
  dit(!cv.some((c) => c.tx === '91000007') && !cv.some((c) => c.tx === '91000003'), 'le relié et le remboursé sont écartés par LEUR n°');
  const tous = M.jugerPasEnLigne({ candidats: cv, presents: [{ cles: ['5'], txs: ['91000007'] }], sources, seuilJours: 14, maintenant: NOW });
  dit(tous.liste.length === 48, `achats prouvés quand tout est rattaché, ${tous.liste.length}`);
  const doute = M.jugerPasEnLigne({ candidats: cv, presents: [{ cles: ['5'], txs: ['91000007'] }, { cles: ['6'], txs: [] }], sources, seuilJours: 14, maintenant: NOW });
  dit(doute.liste.length === 0 && doute.manques.pasRelies === 1 && doute.aConfirmer[0].raisons.some((x) => x.sorte === 'pas-relie'), 'une annonce pas reliée ⇒ achats à confirmer');
  // Un lot de 3 relié une fois : il en reste 2.
  const lot = M.candidatsPasEnLigne({ achats: [{ transaction_id: 5, title: 'Lot de 3 paires', date: jour(40), status: '' }], liens: new Map([['5', 1]]) }).candidats;
  dit(lot.length === 1 && lot[0].lot && lot[0].lot.reste === 2, 'lot de 3 relié une fois : 2 restent');

  // ── 6. Exclusions : N° connu d'une fiche, vendu, import relié ; doublon de N° = un article.
  const c6 = M.candidatsPasEnLigne({
    hors: [{ id: 'a', title: 'x', numero: '7', date: jour(30) }, { id: 'b', title: 'y', numero: '8', date: jour(30) }, { id: 'c', title: 'z', numero: '09', date: jour(40) }, { id: 'd', title: 'z', numero: '9', date: jour(35) }],
    importes: [{ id: 'i1', numero: '10', titre: 't', createdAt: new Date(NOW - 60 * J).toISOString(), emplacement: 'Carton A' }, { id: 'i2', numero: '11', titre: 't', annonce: '123' }],
    connus: new Set(['7']), vendus: new Set(['8']),
  }).candidats;
  dit(c6.map((c) => c.cle).join(',') === '9,10', `exclusions par identité (${c6.map((c) => c.cle).join(',')})`);
  dit(c6[0].doublon === true && c6[0].depuis === Date.parse(jour(40) + 'T12:00:00'), 'deux saisies sous le N°9 : un article, en double, la plus ancienne date');
  dit(c6[1].depuisAuMoins === true && c6[1].ou === 'Carton A', 'import sans date : « au moins » depuis l’import, emplacement gardé');

  // ── 7. Seuil réglable.
  dit(M.seuilValide(30) === 30 && M.seuilValide(999) === M.SEUIL_DEFAUT, 'seuil hors liste ⇒ défaut');
  const r30 = M.jugerPasEnLigne({ candidats, presents, sources, seuilJours: 30, maintenant: NOW });
  dit(r30.liste.length === 21, `≥ 30 j : 21 attendus (30..50), ${r30.liste.length}`);
  return fautes;
}

function branchement() {
  const fautes = [];
  const dit = (ok, quoi) => { if (!ok) fautes.push(quoi); };
  const APP = require('./_source-app.cjs').sourceAppDe(path.join(R, 'src', 'App.jsx'));
  const UI = fs.readFileSync(path.join(R, 'src', 'PasEnLigne.jsx'), 'utf8');
  dit(/jugerPasEnLigne\(/.test(APP) && /candidatsPasEnLigne\(/.test(APP), 'App appelle la règle');
  dit(/'pas-en-ligne': *pasEnLigneJ && pasEnLigneJ\.liste\.length \? \[/.test(APP), 'la carte de Ma journée n’existe que s’il y en a');
  dit(!/[>"'`]\s*(Achetés|à confirmer|Ouvrir l’achat)/.test(UI.replace(/\/\/.*$/gm, '')), 'les textes de la liste passent par tr()');
  const langues = ['fr', 'en', 'es', 'it', 'de'].map((l) => fs.readFileSync(path.join(R, 'src', 'i18n', 'langues', l + '.js'), 'utf8'));
  for (const k of ['pasEnLigne.titre', 'pasEnLigne.carte.titre', 'pasEnLigne.aConfirmer', 'pasEnLigne.ouvrirAchat']) dit(langues.every((t) => t.includes(`"${k}"`)), `clé ${k} dans les 5 langues`);
  return fautes;
}

(async () => {
  const src = fs.readFileSync(SRC, 'utf8');
  const fautes = [...await verifier(src), ...branchement()];
  if (fautes.length) { console.log('ROUGE audit-pas-en-ligne :\n  - ' + fautes.join('\n  - ')); process.exitCode = 1; }
  else console.log('VERT audit-pas-en-ligne : identité sur 50 articles identiques, preuve par lectures fraîches, seuil, exclusions, branchement');
  if (process.argv.includes('--prouve')) {
    let ok = 0;
    for (const [nom, mut] of Object.entries(MUTATIONS)) {
      const m = mut(src);
      if (m === src) { console.log(`  mutation ${nom} : NE S'APPLIQUE PAS`); process.exitCode = 1; continue; }
      const f = await verifier(m);
      if (f.length) { ok++; console.log(`  mutation ${nom} : rouge ✓ (${f[0]})`); } else { console.log(`  mutation ${nom} : VERTE ✗`); process.exitCode = 1; }
    }
    console.log(`${ok}/${Object.keys(MUTATIONS).length} mutations rouges`);
  }
})();
