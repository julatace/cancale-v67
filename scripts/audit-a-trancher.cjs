// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : « À TRANCHER » (9 nov., lot AC) — EXÉCUTE src/aTrancher.js
//        node scripts/audit-a-trancher.cjs
// ═══════════════════════════════════════════════════════════════════════════
//  1. le total = la somme des sources SUES ; une source pas sue n'est jamais 0
//     (« — » + raison), et le total devient « au moins » ;
//  2. une publication trop vieille redevient « pas su » (12 h ; 3 j pour le CA) ;
//  3. une publication d'un AUTRE compte VRM n'est jamais lue ;
//  4. `publierSource` n'écrit qu'un entier ≥ 0, d'une source connue, et ne réécrit
//     pas le même nombre dans l'heure ;
//  5. `comptesARelireDe` rend EXACTEMENT ce que rendait l'expression de la puce de
//     Colis avant son déplacement (cas par cas) ;
//  6. badge et phrase de Ma journée : rien à 0, « au moins » si partiel ;
//  7. chaque source a un geste qui ouvre un écran (aucune n'écrit), dans l'ordre
//     voulu (ce qui coûte un colis d'abord) ;
//  8. l'app : chaque source du module est publiée par un écran (un appel
//     `publierATrancher('<cle>'` dans le code), sauf celles lues d'une publication
//     existante — aucune source orpheline (toujours « — »).
const path = require('path');
const fs = require('fs');
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (d != null && d !== '' ? ' — ' + d : '')); };
const memoire = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), _m: m }; };

(async () => {
  const A = await import(path.join(__dirname, '..', 'src', 'aTrancher.js'));
  const T = 1_800_000_000_000;
  const S = memoire(), U = 'u1';
  // 4
  dit(A.publierSource(S, U, 'numeros-double', 2, T) === true, '4 · un entier se publie');
  dit(A.publierSource(S, U, 'numeros-double', 2, T + 60e3) === false, '4 · le même nombre dans l’heure ne réécrit rien');
  dit(A.publierSource(S, U, 'numeros-double', 2, T + 2 * 3600e3) === true, '4 · le même nombre après une heure est re-daté');
  dit(A.publierSource(S, U, 'numeros-double', null, T) === false && A.publierSource(S, U, 'numeros-double', 1.5, T) === false && A.publierSource(S, U, 'numeros-double', -1, T) === false, '4 · pas su / non entier / négatif : rien écrit');
  dit(A.publierSource(S, U, 'inconnue', 3, T) === false, '4 · une source inconnue : rien écrit');
  dit(A.publierSource(S, '', 'numeros-double', 3, T) === false, '4 · sans compte VRM : rien écrit');
  A.publierSource(S, U, 'achats-sans-prix', 4, T + 2 * 3600e3);
  const pubs = A.lirePublications(S, U);
  // 3
  dit(Object.keys(A.lirePublications(S, 'autre')).length === 0, '3 · un autre compte VRM ne lit rien de ce compte');
  A.publierSource(S, 'autre', 'colis-postes', 9, T);
  dit(Object.keys(A.lirePublications(S, U)).length === 0 && A.lirePublications(S, 'autre')['colis-postes'].n === 9, '3 · un autre compte remplace la ligne, il ne la mélange jamais');
  // 1
  const r = A.lignesATrancher({ pubs, colisRetirer: { aVerifier: 2, enVerification: 1, at: T }, urssafMois: { aDater: { n: 5 }, at: T }, comptes: [{ login: 'a', jours: 3 }], maintenant: T + 2 * 3600e3 });
  dit(r.total === 2 + 4 + 3 + 5 + 1, '1 · total = somme des sources sues', r.total);
  dit(r.partiel === true && r.manque.every((l) => l.n === null && l.raison), '1 · les autres sont « pas su » avec leur raison, jamais 0', r.manque.map((l) => l.cle).join(','));
  dit(r.lignes.find((l) => l.cle === 'colis-retirer').n === 3, '1 · colis à retirer à vérifier = aVerifier + enVerification (la publication de Colis)');
  const r0 = A.lignesATrancher({ pubs: {}, colisRetirer: null, urssafMois: null, comptes: undefined, maintenant: T });
  dit(r0.total === 0 && r0.partiel && r0.aTrancher.length === 0 && r0.lignes.every((l) => !Number.isInteger(l.n)), '1 · rien de publié : total 0 « au moins », aucune ligne à trancher, tout « pas su »');
  // 2
  const vieux = A.lignesATrancher({ pubs, colisRetirer: { aVerifier: 2, at: T - 13 * 3600e3 }, urssafMois: { aDater: { n: 5 }, at: T - 2 * 86400e3 }, comptes: [], maintenant: T + 2 * 3600e3 + 13 * 3600e3 });
  dit(vieux.lignes.find((l) => l.cle === 'numeros-double').n === null, '2 · une publication de plus de 12 h redevient « pas su »');
  dit(vieux.lignes.find((l) => l.cle === 'colis-retirer').n === null, '2 · `vrm_colis_retirer` de plus de 12 h : « pas su »');
  dit(vieux.lignes.find((l) => l.cle === 'ventes-a-dater').n === 5, '2 · le CA déclaré se croit 3 jours (règle du widget)');
  // 5
  const ancienne = (liveStats) => { const ls = liveStats && Number(liveStats.dataAgeJours) > 1 ? liveStats : null; return ls ? ((Array.isArray(ls.dataAgeComptes) && ls.dataAgeComptes.filter((x) => x && x.login).length) ? ls.dataAgeComptes.filter((x) => x && x.login) : [{ login: ls.dataAgeCompte || '', jours: ls.dataAgeJours }]) : []; };
  const cas = [null, {}, { dataAgeJours: 0 }, { dataAgeJours: 1, dataAgeComptes: [] }, { dataAgeJours: 3, dataAgeCompte: 'x', dataAgeComptes: [{ login: 'x', jours: 3 }, { login: 'y', jours: 2 }] }, { dataAgeJours: 4, dataAgeCompte: 'z', dataAgeComptes: null }, { dataAgeJours: 4, dataAgeComptes: [{ jours: 4 }] }, { dataAgeJours: null, dataAgeComptes: null }];
  dit(cas.every((c) => JSON.stringify(A.comptesARelireDe(c) || []) === JSON.stringify(ancienne(c))), '5 · la règle de la puce de Colis, déplacée telle quelle (8 cas)');
  dit(A.comptesARelireDe(null) === undefined && A.comptesARelireDe({ dataAgeJours: null, dataAgeComptes: null }) === null, '5 · « À trancher » distingue en cours (undefined) et pas su (null)');
  // 6
  dit(A.badgeATrancher(r0) === null && A.phraseJournee(r0) === '', '6 · rien à 0 : ni badge, ni ligne dans Ma journée');
  dit(A.badgeATrancher(r) === r.total && /^Au moins 15 choses à trancher$/.test(A.phraseJournee(r)), '6 · partiel : « Au moins N »', A.phraseJournee(r));
  // 7
  const ordre = A.SOURCES.map((s) => s.cle);
  dit(ordre.indexOf('numeros-double') === 0 && ordre.indexOf('colis-postes') < ordre.indexOf('achats-sans-prix') && ordre.indexOf('ventes-a-dater') === ordre.length - 1, '7 · ce qui coûte un colis d’abord, le CA à dater en dernier');
  dit(A.SOURCES.every((s) => s.geste && s.geste.tab && s.geste.libelle && !('ecrit' in s.geste)), '7 · chaque source : un geste qui ouvre un écran');
  dit(A.SOURCES.every((s) => A.NOMS[s.cle]), '7 · chaque source a un nom pour « pas su »');
  // 8
  const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'App.jsx'), 'utf8') + fs.readFileSync(path.join(__dirname, '..', 'src', 'InfosSms.jsx'), 'utf8');
  const lues = ['colis-retirer', 'ventes-a-dater', 'comptes-a-relire'];
  const orphelines = ordre.filter((k) => !lues.includes(k) && !new RegExp(`publi(?:erATrancher|er)\\('${k}'`).test(app));
  dit(!orphelines.length, '8 · chaque source est publiée par un écran', orphelines.join(','));

  // 9 (10 nov., cartes) — les CHOSES publiées et les cartes.
  if (typeof A.exemplesPropres !== 'function' || typeof A.cartesATrancher !== 'function' || typeof A.appliquerTranches !== 'function') {
    dit(false, '9 · le module des cartes existe (exemplesPropres, cartesATrancher, appliquerTranches)');
  } else {
    const sale = [{ id: 'a1', num: '12', photo: 'https://images1.vinted.net/x.jpg', titre: 'Nike Dunk taille 42', prix: 60, acheteur: 'jean' }, { id: 'a1', num: '13' }, { id: 'a2', photo: 'javascript:alert(1)' }, { id: 'a3', photo: 'http://x/y.jpg' }, { id: 'a4' }, { id: 'a5' }];
    const p = A.exemplesPropres(sale);
    dit(p.length === A.EX_MAX && p.every((x) => Object.keys(x).every((k) => ['id', 'num', 'photo', 'photo2', 'de'].includes(k))), '9 · une chose publiée ne porte que id, N°, photo, « de » (ni titre, ni prix, ni acheteur), au plus EX_MAX', JSON.stringify(p));
    dit(p[0].id === 'a1' && p[0].num === '12' && p[1].id === 'a2' && !p[1].photo && !p[2].photo, '9 · un doublon d’id est écarté ; une photo qui n’est pas https n’est pas gardée', JSON.stringify(p));
    const S2 = memoire();
    A.publierSource(S2, U, 'supprimes-vinted', 2, T, [{ id: '7', num: '12', photo: 'https://i/a.jpg' }]);
    dit(A.publierSource(S2, U, 'supprimes-vinted', 2, T + 60e3, [{ id: '8', num: '13' }]) === true, '9 · mêmes nombre, autres choses ⇒ republié (pas d’attente d’une heure)');
    dit(A.publierSource(S2, U, 'supprimes-vinted', 2, T + 120e3) === false && A.lirePublications(S2, U)['supprimes-vinted'].ex[0].id === '8', '9 · sans choses passées, le même nombre garde les siennes');
    A.publierSource(S2, U, 'supprimes-vinted', 1, T + 180e3);
    dit(!A.lirePublications(S2, U)['supprimes-vinted'].ex, '9 · un autre nombre sans choses ⇒ les anciennes tombent (jamais de choses périmées)');
    A.publierSource(S2, U, 'supprimes-vinted', 3, T + 240e3, [{ id: '7', num: '12', photo: 'https://i/a.jpg' }, { id: '9', num: '14' }]);
    A.publierSource(S2, U, 'colis-postes', 2, T + 240e3);
    const e = A.lignesATrancher({ pubs: A.lirePublications(S2, U), comptes: [], maintenant: T + 300e3 });
    const c = A.cartesATrancher(e);
    const gp = c.groupes.find((g) => g.type === 'paires'), gc = c.groupes.find((g) => g.type === 'colis');
    const sv = gp && gp.sources.find((s) => s.cle === 'supprimes-vinted');
    dit(!!sv && sv.cartes.length === 2 && sv.cartes[0].id === '7' && sv.cartes[0].photo && sv.cartes[0].binaire && sv.autres === 1, '9 · une carte par chose publiée (photo, N°, geste binaire), le reste « + N »', JSON.stringify(sv));
    dit(!!gc && gc.sources[0].cartes.length === 1 && gc.sources[0].cartes[0].n === 2 && !gc.sources[0].cartes[0].id && !gc.compteVisible, '9 · sans choses : UNE carte, son nombre, et le titre du groupe ne le répète pas', JSON.stringify(gc));
    // Toutes les questions, au singulier et au pluriel, tiennent en 12 mots.
    const qs = A.SOURCES.flatMap((s) => { const Q = A.QUESTIONS[s.cle]; return Q ? [Q.n(1), Q.n(7), ...(Q.x ? [Q.x({ id: 'x', num: '12', de: 'B1234' }), Q.x({ id: 'x' })] : [])] : [null]; });
    dit(qs.every((q) => q && A.mots(q) <= A.MOTS_MAX), '9 · chaque source a sa question, 12 mots au plus', qs.filter((q) => !q || A.mots(q) > A.MOTS_MAX).join(' | '));
    dit(Object.keys(A.BINAIRES).every((k) => k === 'supprimes-vinted'), '9 · seul « supprimé de Vinted » se tranche ici (interne, annulable) ; une remise en ligne change un N° : elle reste dans Annonces');
    dit(c.groupes.every((g) => g.sources.every((s) => s.ton === (s.cle === 'numeros-double' ? 'rouge' : 'geste'))), '9 · le rouge pour deux paires sous un N°, nulle part ailleurs');
    const t = A.appliquerTranches(e, new Set(['supprimes-vinted:7']));
    const l = t.lignes.find((x) => x.cle === 'supprimes-vinted');
    dit(t.total === e.total - 1 && l.n === 2 && l.ex.length === 1 && l.ex[0].id === '9', '9 · une chose tranchée ici sort tout de suite, le nombre et le total −1', `${e.total} → ${t.total}`);
    const pub2 = A.lirePublications(S2, U); pub2['supprimes-vinted'] = { ...pub2['supprimes-vinted'], n: 2, ex: [{ id: '9', num: '14' }] };
    const e2 = A.lignesATrancher({ pubs: pub2, comptes: [], maintenant: T + 300e3 });
    dit(A.appliquerTranches(e2, new Set(['supprimes-vinted:7'])).total === e2.total, '9 · republiée sans elle par son propriétaire, la chose ne retire plus rien (jamais deux fois)');
    const app2 = fs.readFileSync(path.join(__dirname, '..', 'src', 'App.jsx'), 'utf8');
    // (11 nov., lot DJ4) « Tu l'as encore ? » : trois réponses (garder · enlever + raison · plus tard),
    // toutes par `gesteChezToi` (les opérations de `opsChezToi`, en geste annulable) ; ni confirmation,
    // ni Vinted, ni vente inventée (`vinted_annonces_vendues`).
    const corps = (/const trancherAT=\(carte,choix,raison\)=>\{([\s\S]*?)\n  \};/.exec(app2) || [])[1] || '';
    const corpsG = (/function gesteChezToi\(carte, reponse, raison, apres = null\) \{([\s\S]*?)\n\}/.exec(app2) || [])[1] || '';
    dit(/gesteChezToi\(/.test(corps) && /'garde'/.test(corps) && /'enleve'/.test(corps) && /'plus-tard'/.test(corps) && /gesteVrm\(/.test(corpsG) && /opsChezToi\(/.test(corpsG)
      && !/askConfirm|vmrCmd|fetch\(|vinted_annonces_vendues/.test(corps + corpsG), '9 · « Tu l’as encore ? » : trois réponses en geste annulable, rien d’autre (ni confirmation, ni Vinted, ni vente inventée)', corps.slice(0, 120));
  }

  console.log(ko ? `\n${ko} rouge(s)` : '\nÀ trancher : chaque nombre vient de son écran, pas su ≠ 0.');
  process.exit(ko ? 1 : 0);
})();
