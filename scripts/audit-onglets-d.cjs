#!/usr/bin/env node
// ══ ONGLETS D (6 nov.) — Annonces, Compta, Statistiques, Paramètres ══════════
// Exécute les VRAIES règles (copies posées À CÔTÉ des originaux : leurs imports
// relatifs restent justes) sur des données INVENTÉES, et lit l'app pour ce qui
// est rendu. `--mutation=<nom>` réaffaiblit une règle : l'audit doit virer au rouge.
//   A · une vente « à dater » VENDUE cette année et lue cette année est VERSÉE cette
//       année (src/aDaterAnnee.js) : le CA de l'année (seuils, revenus, DAC7) la
//       compte, aucun MOIS ne la compte ; vendue l'année d'avant : « au moins ».
//       (Mesuré sur sa base : 1 772 ventes à dater, toutes vendues de mai 2025 à
//       juin 2026 ; « Reçu en 2026 » n'en comptait aucune.)
//   B · la carte « Déclarer » : trois étapes, le « ? » de chaque chiffre, la période
//       des ventes à dater dite.
//   C · Paramètres par intention, chaque réglage dit ce qu'il fait.
//   D · Annonces : le prochain geste (ordre du risque, jamais un compteur pas su).
//   E · Statistiques : « Frais par site » sans aucun site lu = une ligne.
const fs = require('fs'), path = require('path');
const R0 = path.join(__dirname, '..');
const mut = (process.argv.find((a) => a.startsWith('--mutation=')) || '').slice(11);
let ko = 0, n = 0;
const dit = (ok, l, d) => { n++; if (!ok) ko++; console.log(`${ok ? '✅' : '❌'} ${l}${!ok && d !== undefined ? ' — ' + d : ''}`); };
const lire = (f) => { try { return fs.readFileSync(path.join(R0, f), 'utf8'); } catch (_) { return null; } };
const sans = (t) => String(t || '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const copies = [];
const poser = (fichier, muter) => {
  let src = lire(fichier);
  if (src == null) return null;
  if (muter) src = muter(src);
  const tmp = path.join(R0, path.dirname(fichier), `.audit-od-${process.pid}-${path.basename(fichier, '.js')}.mjs`);
  fs.writeFileSync(tmp, src); copies.push(tmp);
  return tmp;
};
const remplacer = (src, a, b) => { if (!src.includes(a)) { console.error('ancre absente :', a.slice(0, 80)); process.exit(2); } return src.replace(a, b); };

(async () => {
  try {
    // ── A. LA RÈGLE ───────────────────────────────────────────────────────────
    const fA = poser('src/aDaterAnnee.js', (s) => {
      // aDaterAnnee réexporte depuis microEntreprise : la copie pointe vers la COPIE de microEntreprise.
      s = s.replace("from './microEntreprise.js'", `from './.audit-od-${process.pid}-microEntreprise.mjs'`);
      if (mut === 'annee-vente-seule') s = remplacer(s, 'return y === anneeDe(l) ? y : null;', 'return y;');
      if (mut === 'apres-lecture') s = remplacer(s, '|| v > l) return null;', ') return null;');
      return s;
    });
    const fM = poser('src/microEntreprise.js', (s) => {
      if (mut === 'sans-annee-pub') s = remplacer(s, "if (!(at > 0) || new Date(at).getFullYear() !== Number(annee)) return null;", 'if (false) return null;');
      if (mut === 'reste-oublie') s = remplacer(s, "const nAdReste = (ligne.aDater ? Number(ligne.aDater.n) || 0 : 0) - (sur ? sur.n : 0);", 'const nAdReste = 0;');
      if (mut === 'sur-ignore') s = remplacer(s, 'if (sur) ca += sur.ca;', '');
      return s;
    });
    const fS = poser('src/seuilsAnnee.js', (s) => {
      s = s.replace("from './microEntreprise.js'", `from './.audit-od-${process.pid}-microEntreprise.mjs'`);
      if (mut === 'dac7-sur-ignore') s = remplacer(s, "if (sur) for (const [p, v] of Object.entries(sur.par))", 'if (false) for (const [p, v] of Object.entries(sur.par))');
      return s;
    });
    const fG = poser('src/prochainGesteAnnonces.js', (s) => {
      if (mut === 'geste-ordre') s = remplacer(s, "if (ok(aVerifier)) return", "if (false) return");
      return s;
    });
    const A = fA && await import('file://' + fA);
    const M = fM && await import('file://' + fM);
    const S = fS && await import('file://' + fS);
    const G = fG && await import('file://' + fG);
    // Les règles d'avant (microEntreprise, seuilsAnnee) se chargent aussi sur l'arbre d'avant :
    // ce qu'elles RENDENT est jugé (la nouvelle règle absente n'est pas, à elle seule, la preuve).
    dit(!!(M && S), 'les règles du CA de l’année se chargent (microEntreprise, seuilsAnnee)');
    dit(!!A, 'A0 · la règle « vendue cette année ⇒ versée cette année » existe (src/aDaterAnnee.js)');
    dit(!!G, 'D0 · la règle du prochain geste existe (src/prochainGesteAnnonces.js)');
    if (!(M && S)) throw new Error('modules absents');

    const D = (y, m, j) => new Date(y, m, j, 12).getTime();
    const LECT = D(2026, 10, 6);
    if (A) dit(A.anneeSureDeVente(D(2026, 1, 3), LECT) === 2026, 'A1 · vendue en février 2026, lue finalisée en novembre 2026 ⇒ versée en 2026');
    if (A) dit(A.anneeSureDeVente(D(2025, 11, 28), LECT) === null, 'A1 · vendue fin décembre 2025 ⇒ versement en 2025 OU 2026 : pas su');
    if (A) dit(A.anneeSureDeVente(D(2026, 1, 3), D(2027, 0, 2)) === null, 'A1 · lue en 2027 : une vente de 2026 peut avoir été versée en 2027 ⇒ pas su');
    if (A) dit(A.anneeSureDeVente(D(2026, 10, 20), LECT) === null, 'A1 · une date de vente APRÈS la lecture est illisible ⇒ pas su');
    if (A) dit(A.anneeSureDeVente(NaN, LECT) === null && A.anneeSureDeVente(null, LECT) === null, 'A1 · date de vente illisible ⇒ pas su (jamais deviné)');

    // Les lignes « à dater » de ventesDeclarables, inventées : 3 vendues en 2026, 2 en 2025, 1 sans date.
    const ad = [
      { plateforme: 'Vinted', eur: 40, dateVente: new Date(D(2026, 0, 10)).toISOString() },
      { plateforme: 'Vinted', eur: 60.5, dateVente: new Date(D(2026, 4, 2)).toISOString() },
      { plateforme: 'Vinted', eur: 25, dateVente: new Date(D(2026, 5, 30)).toISOString() },
      { plateforme: 'Vinted', eur: 33, dateVente: new Date(D(2025, 4, 17)).toISOString() },
      { plateforme: 'Vinted', eur: 12, dateVente: new Date(D(2025, 11, 1)).toISOString() },
      { plateforme: 'Leboncoin', eur: 50 },
    ];
    // Sans la règle (arbre d'avant), la répartition attendue est posée telle quelle :
    // ce qui est jugé, c'est ce que le CA de l'année en FAIT.
    const P = A ? A.aDaterParAnnee(ad) : { annees: { 2026: { n: 3, ca: 125.5, par: { Vinted: { n: 3, ca: 125.5 } } }, 2025: { n: 2, ca: 45, par: { Vinted: { n: 2, ca: 45 } } } }, de: D(2025, 4, 17), a: D(2026, 5, 30), sansDate: 1 };
    if (A) dit(P.annees['2026'] && P.annees['2026'].n === 3 && Math.round(P.annees['2026'].ca * 100) === 12550 && P.annees['2025'].n === 2 && P.sansDate === 1,
      'A2 · réparties par ANNÉE DE VENTE (3 en 2026 · 125,50 € ; 2 en 2025 ; 1 sans date)', JSON.stringify(P.annees));
    if (A) dit(A.periodeADater({ de: P.de, a: P.a }) === 'vendues de mai 2025 à juin 2026', 'A2 · la période en mots : « vendues de mai 2025 à juin 2026 »', A.periodeADater({ de: P.de, a: P.a }));

    // La ligne publiée (forme de `vinted_urssaf_mois`), 2026 : 2 mois datés.
    const ligne = { at: LECT, sources: { Vinted: 'lu', Leboncoin: 'lu' },
      mois: [{ ym: '2026-09', ca: 400, n: 8, par: { Vinted: { n: 8, ca: 400 } } }, { ym: '2026-10', ca: 100, n: 2, par: { Vinted: { n: 2, ca: 100 } } }],
      aDater: { n: 6, ca: 220.5, par: { Vinted: { n: 5, ca: 170.5 }, Leboncoin: { n: 1, ca: 50 } }, annees: P.annees, de: P.de, a: P.a } };
    const C = M.caAnnee(ligne, 2026);
    dit(C && Math.round(C.ca * 100) === 62550, 'A3 · CA 2026 = 500 € datés + 125,50 € vendus en 2026 pas encore datés = 625,50 €', C && C.ca);
    dit(C && C.partiel && C.raisons.some((r) => /^3 ventes sans date de versement$/.test(r)), 'A3 · les 3 autres (vendues en 2025, sans date) restent NOMMÉES : « au moins »', C && C.raisons.join(' | '));
    dit(C && C.aDaterSur && C.aDaterSur.n === 3, 'A3 · la part prouvée est rendue pour être DITE à l’écran', C && JSON.stringify(C.aDaterSur));
    const C25 = M.caAnnee(ligne, 2025);
    dit(C25 && C25.ca === 0 && !C25.aDaterSur, 'A3 · une année passée n’y gagne rien (le versement d’une vente de 2025 peut être de 2026)', C25 && JSON.stringify(C25));
    const vieille = { ...ligne, at: D(2025, 11, 31) };
    dit(M.caAnnee(vieille, 2026) && !M.caAnnee(vieille, 2026).aDaterSur, 'A3 · publiée une autre année ⇒ rien de prouvé');
    const avant = { ...ligne, aDater: { n: 6, ca: 220.5, par: ligne.aDater.par } };
    const Cav = M.caAnnee(avant, 2026);
    dit(Cav && Cav.ca === 500 && Cav.raisons.some((r) => /^6 ventes/.test(r)), 'A3 · une publication d’avant cette règle (sans `annees`) : rien ne change', Cav && JSON.stringify(Cav));
    // Aucun mois ne bouge : la somme des mois reste celle de `mois`.
    const J = M.jaugeSeuils({ ligne, now: new Date(LECT) });
    dit(J && Math.round(J.ca * 100) === 62550 && J.aDaterSur && J.aDaterSur.n === 3, 'A4 · la jauge des seuils lit le même CA d’année (et dit la part prouvée)', J && JSON.stringify({ ca: J.ca, s: J.aDaterSur }));
    const R = M.declarationRevenus && M.declarationRevenus({ ligne, now: new Date(D(2027, 3, 15)) });
    dit(!R || R.ca === 0 || R.ca === 500 || Math.round(R.ca * 100) === 62550, 'A4 · déclaration de revenus : jamais plus que la règle ne prouve', R && JSON.stringify({ ca: R.ca }));
    const K = S.dac7ParPlateforme({ ligne, annee: 2026 });
    const kv = K && K.plateformes.find((x) => x.plateforme === 'Vinted');
    dit(kv && kv.n === 13 && kv.centimes === 62550 && kv.nAd === 2 && kv.ctsAd === 4500, 'A5 · DAC7 Vinted : 10 datées + 3 vendues en 2026 = 13 sûres ; 2 « peut-être » (vendues en 2025)', kv && JSON.stringify([kv.n, kv.centimes, kv.nAd, kv.ctsAd]));
    const kl = K && K.plateformes.find((x) => x.plateforme === 'Leboncoin');
    dit(kl && kl.n === 0 && kl.nAd === 1, 'A5 · DAC7 Leboncoin : la vente sans date reste « peut-être »', kl && JSON.stringify([kl.n, kl.nAd]));

    // ── A6. LES ÉCRANS LISENT LA RÈGLE (app) ──────────────────────────────────
    const app = sans(require("./_source-app.cjs").sourceApp());
    dit(/ad\.annees = R\.annees/.test(app) && /aDaterParAnnee\(aDater\)/.test(app), 'A6 · Ventes PUBLIE les ventes à dater par année de vente (`aDater.annees`, `de`, `a`)');
    dit(/anneeSureDeVente\(tsVenteADater\(l\), Date\.now\(\)\)/.test(app), 'A6 · la case « CA de l’année » de Ventes applique la MÊME règle (même nombre partout)');
    dit(/data-micro-adater-sur=/.test(app), 'A6 · Compta DIT la part prouvée (« Dont N ventes vendues en … »)');
    const dac = sans(lire('src/dac7Comptes.js'));
    dit(/anneeSureDeVente\(tsV, maintenant\) === annee/.test(dac), 'A6 · DAC7 compte par compte : la même règle');

    // ── B. DÉCLARER EN TROIS ÉTAPES ───────────────────────────────────────────
    const carte = (() => { const i = app.indexOf('function PrevisionUrssafCarte('); const j = app.indexOf('function ComptaFusion(', i); return i > 0 && j > i ? app.slice(i, j) : ''; })();
    dit(['1', '2', '3'].every((k) => carte.includes(`data-urssaf-etape="${k}"`)), 'B1 · « Déclarer » en trois étapes : ce qui est sûr · ce qui manque · déclarer');
    dit(/<SourceChiffre id="ca">/.test(carte) && /<SourceChiffre id="cotis">/.test(carte), 'B2 · chaque chiffre de la déclaration a son « ? »');
    dit(/ligne\.mois\.filter\(\(m\) => m && \(P\.mois \|\| \[\]\)\.includes\(m\.ym\)\)/.test(carte), 'B2 · la phrase du « ? » vient de la MÊME ligne publiée que le chiffre');
    dit(/periodeADater\(ligne && ligne\.aDater\)/.test(carte) && /data-urssaf-adater-periode/.test(carte), 'B3 · les ventes à dater disent QUAND elles ont été vendues');
    dit(/data-urssaf-rien-manque/.test(carte), 'B3 · rien ne manque : la carte le DIT (l’étape 2 n’est jamais muette)');
    dit(!/encaiss/i.test(carte), 'B4 · jamais « encaissé »');
    dit(/data-urssaf-copier="ca"/.test(carte) && /data-urssaf-cest-declare=/.test(carte) && /data-urssaf-manque=/.test(carte), 'B4 · « Copier », « J’ai déclaré » et le manque nommé restent (bancs du chantier F)');

    // ── C. PARAMÈTRES PAR INTENTION ───────────────────────────────────────────
    const gi = app.indexOf('const GROUPES_REGLAGES = ['), gj = app.indexOf('const GROUPES_COMPTE', gi);
    const reg = gi > 0 && gj > gi ? app.slice(gi, gj) : '';
    const titres = [...reg.matchAll(/titre:'([^']+)'/g)].map((m) => m[1]);
    const voulus = ['Mes comptes', 'Mes e-mails', 'Notifications', 'Mon abonnement', 'Sécurité et sauvegarde', 'Aide'];
    dit(voulus.every((t) => titres.includes(t)), 'C1 · les groupes d’intention : ' + voulus.join(' · '), titres.join(' · '));
    dit(titres.indexOf('Mes comptes') === 0 && titres.indexOf('Aide') === titres.length - 1, 'C1 · « Mes comptes » en premier, « Aide » en dernier', titres.join(' · '));
    const lignesReg = [...reg.matchAll(/\{ ?id:'([a-z-]+)', ?type:'(nav|panneau|switch|action)'([^\n]*)/g)].filter((m) => !/^(signalements)$/.test(m[1]));
    // Le texte d'une ligne court jusqu'à la ligne suivante (une ligne peut tenir sur plusieurs).
    const corpsDe = (m) => { const i = m.index, j = reg.indexOf("{ id:'", i + 6); return reg.slice(i, j > i ? j : i + 600); };
    const sansPhrase = lignesReg.filter((m) => !/desc ?:/.test(corpsDe(m))).map((m) => m[1]);
    dit(lignesReg.length >= 18 && !sansPhrase.length, `C2 · chaque réglage dit en une phrase ce qu’il fait (${lignesReg.length} lignes)`, sansPhrase.join(', '));
    dit(/data-reglage-abonnement/.test(reg) && /setVue\('abonnement'\)/.test(reg), 'C3 · « Mon abonnement » mène à l’onglet Abonnement (le même écran)');
    const rech = sans(lire('src/rechercheReglages.js'));
    dit(/typeof it\.desc==='string'\?it\.desc/.test(rech) && /'abonnement-ouvrir':/.test(rech), 'C4 · la recherche lit les phrases et trouve l’abonnement');

    // ── D. ANNONCES : LE PROCHAIN GESTE ───────────────────────────────────────
    if (G) {
      const g1 = G.prochainGesteAnnonces({ aVerifier: 4, sansNum: 2, prixConnus: 0, prixTotal: 49, dorment: 3 });
      dit(g1 && g1.cle === 'verifier', 'D1 · un N° à vérifier passe AVANT tout (un faux N° envoie la mauvaise paire)', g1 && g1.cle);
      const g2 = G.prochainGesteAnnonces({ aVerifier: 0, sansNum: 2, prixConnus: 0, prixTotal: 49, dorment: 3 });
      dit(g2 && g2.cle === 'sansnum', 'D1 · puis une annonce en ligne sans N°', g2 && g2.cle);
      const g3 = G.prochainGesteAnnonces({ aVerifier: 0, sansNum: 0, prixConnus: 3, prixTotal: 49, dorment: 3 });
      dit(g3 && g3.cle === 'prix' && /3\/49/.test(g3.texte), 'D1 · puis les prix d’achat (la couverture dite : 3/49)', g3 && g3.texte);
      const g4 = G.prochainGesteAnnonces({ aVerifier: 0, sansNum: 0, prixConnus: 49, prixTotal: 49, dorment: 3 });
      dit(g4 && g4.cle === 'dorment', 'D1 · puis les annonces qui dorment', g4 && g4.cle);
      dit(G.prochainGesteAnnonces({}) === null && G.prochainGesteAnnonces({ aVerifier: null, sansNum: undefined, prixConnus: null, prixTotal: null, dorment: NaN }) === null, 'D2 · des compteurs pas sus ne déclenchent AUCUN geste (jamais inventé)');
      dit(g1 && !/\d/.test(g1.texte) && g2 && !/\d/.test(g2.texte) && g4 && !/\d/.test(g4.texte), 'D3 · le geste ne redit pas un compteur déjà affiché (§7)');
    }
    dit(/prochainGesteAnnonces\(\{ aVerifier: aVerifierCarton\.length, sansNum: annStats\.sansNum, prixConnus: n, prixTotal: m, dorment: annStats\.sleeping(?:, ecrit: numeroEcritActif\(\))? \}\)/.test(app), 'D4 · Annonces passe SES compteurs (aucun recalcul)');
    dit(/&& !\(geste && geste\.cle === 'prix'\)/.test(app), 'D4 · « Prix d’achat N/M » ne s’écrit qu’une fois sur l’écran');

    // ── E. STATISTIQUES ──────────────────────────────────────────────────────
    dit(/if \(F\.sites\.every\(\(x\) => x\.passu\)\) return \(/.test(app) && /data-frais-tous-passu/.test(app), 'E1 · « Frais par site » sans aucun site lu : une ligne, pas trois rangées « pas lu »');
  } catch (e) {
    dit(false, 'audit exécuté', e && e.message);
  } finally {
    for (const t of copies) { try { fs.unlinkSync(t); } catch (_) {} }
  }
  console.log(ko ? `❌ audit-onglets-d : ${ko}/${n} rouge(s)` : `✅ audit-onglets-d : ${n} contrôles verts`);
  process.exit(ko ? 1 : 0);
})();
