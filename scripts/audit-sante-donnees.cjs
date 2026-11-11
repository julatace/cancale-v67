// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : « SANTÉ DE TES DONNÉES » (11 nov., lot sante-donnees)
//        node scripts/audit-sante-donnees.cjs            (le module + l'app)
//        node scripts/audit-sante-donnees.cjs --mutations (chaque mutation doit le rendre ROUGE)
// EXÉCUTE src/santeDonnees.js avec les VRAIES règles des propriétaires
// (src/aTrancher.js `lignesATrancher`, src/sourceAchats.js `beneficeParSource`,
// src/fraicheurComptes.js `lignesFraicheur`, api/_lib/garde-capture.js `etatVersion`).
// ═══════════════════════════════════════════════════════════════════════════
//  1. chaque nombre = celui de la règle du PROPRIÉTAIRE, appelée ici à part sur les
//     mêmes données (jamais une copie dans le module) ;
//  2. « pas su » ⇒ null et « — » (jamais 0) pour CHAQUE source absente, trop vieille,
//     d'un autre compte VRM, ou dont la lecture a échoué ;
//  3. « Tout est à jour ✓ » seulement si TOUTES les lignes sont lues et à 0 ; une
//     seule ligne pas lue (ou en lecture) l'interdit ;
//  4. l'ordre : le rouge (deux articles sous un N°, SEUL rouge) d'abord, puis les
//     gestes dans l'ordre de gravité, puis « pas lu », puis « à jour » ;
//  5. `aVoirCapture` rend EXACTEMENT ce que rendait le calcul de « Tout va bien ? »
//     avant son déplacement (cas par cas), et « Tout va bien ? » l'appelle ;
//  6. chaque geste OUVRE (clés de navigation seulement) — aucun n'écrit ;
//  7. `publierSante` : entier ≥ 0, source connue, compte VRM, pas de réécriture dans l'heure ;
//  8. l'app : les deux sources neuves sont publiées par leur écran, l'écran est dans
//     Paramètres, la coque ouvre les gestes, la ligne compacte est dans « Tout va bien ? ».
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const RACINE = path.join(__dirname, '..');
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (d != null && d !== '' ? ' — ' + d : '')); };
const memoire = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; };
const sansCommentaires = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');

// ── LES MUTATIONS : chacune réaffaiblit UNE règle ; l'audit doit alors échouer ──
const MUTATIONS = [
  ['pas su compté 0', (s) => s.replace("{ n: null, raison: `pas encore compté sur cet appareil : ouvre ${ecran}` }", '{ n: 0, raison: "" }')],
  ['« à jour » malgré un pas su', (s) => s.replace('const toutAJour = !aFaire.length && !passu.length && !enLecture;', 'const toutAJour = !aFaire.length;')],
  ['le rouge retiré', (s) => s.replace("{ cle: 'numeros-double', ton: 'rouge',", "{ cle: 'numeros-double',")],
  ['ventes recomptées à part', (s) => s.replace('beneficeParSource(sources.lignes).sansAchat', 'sources.lignes.filter((l) => !l.benefice).length')],
  ['publication jamais vieille', (s) => s.replace('if (age > FRAIS_MS) return', 'if (false) return')],
  ['0 avec une partie pas lue', (s) => s.replace('!Number.isInteger(v) || (ps && v === 0)', '!Number.isInteger(v)')],
  ['tri par gravité retiré', (s) => s.replace('lignes.sort((a, b) => rang[a.etat] - rang[b.etat] || a.ordre - b.ordre);', '')],
  ['un geste qui écrit', (s) => s.replace("geste: { libelle: 'Vérifier', tab: 'cat_bord', onglet: 'envoyes' }", "geste: { libelle: 'Vérifier', tab: 'cat_bord', onglet: 'envoyes', ecrire: 'vrm_coches' }")],
];
if (process.argv.includes('--mutations')) {
  const src = fs.readFileSync(path.join(RACINE, 'src', 'santeDonnees.js'), 'utf8');
  let rates = 0;
  for (const [nom, f] of MUTATIONS) {
    const mut = f(src);
    if (mut === src) { console.log('❌ mutation « ' + nom + ' » : le motif n’existe plus (l’audit ne la juge pas)'); rates++; continue; }
    const tmp = path.join(RACINE, 'src', `.sante-mutation-${process.pid}.js`);
    fs.writeFileSync(tmp, mut);
    const r = spawnSync(process.execPath, [__filename], { env: { ...process.env, SANTE_MODULE: tmp }, encoding: 'utf8' });
    try { fs.unlinkSync(tmp); } catch (_) {}
    const rouge = r.status !== 0;
    if (!rouge) rates++;
    console.log((rouge ? '✅ ' : '❌ ') + `mutation « ${nom} » ⇒ ${rouge ? 'ROUGE' : 'reste vert (l’audit ne la voit pas)'}` + (rouge ? ' — ' + ((r.stdout.split('\n').find((l) => l.startsWith('❌')) || '').slice(0, 110)) : ''));
  }
  console.log(rates ? `\n${rates} mutation(s) non vue(s)` : `\nLes ${MUTATIONS.length} mutations rendent l’audit rouge.`);
  process.exit(rates ? 1 : 0);
}

(async () => {
  const S = await import(process.env.SANTE_MODULE || path.join(RACINE, 'src', 'santeDonnees.js'));
  const A = await import(path.join(RACINE, 'src', 'aTrancher.js'));
  const SA = await import(path.join(RACINE, 'src', 'sourceAchats.js'));
  const F = await import(path.join(RACINE, 'src', 'fraicheurComptes.js'));
  const G = await import(path.join(RACINE, 'api', '_lib', 'garde-capture.js'));
  const T = 1_800_000_000_000, U = 'u1';
  const ATT = '5.342.0';
  const ligne = (r, cle) => r.lignes.find((l) => l.cle === cle);

  // ── des données (inventées) telles que les propriétaires les publient ──
  const ST = memoire();
  for (const [k, n] of Object.entries({ 'numeros-double': 1, 'numeros-a-ecrire': 2, 'colis-postes': 3, 'achats-sans-prix': 4 })) A.publierSource(ST, U, k, n, T);
  const pubsTr = A.lirePublications(ST, U);
  const colisRetirer = { aVerifier: 1, at: T }, urssafMois = { aDater: { n: 6 }, at: T };
  const trancher = A.lignesATrancher({ pubs: pubsTr, colisRetirer, urssafMois, comptes: undefined, maintenant: T });
  const SS = memoire();
  dit(S.publierSante(SS, U, 'colis-a-confirmer', 2, T) && S.publierSante(SS, U, 'annonces-a-confirmer', 7, T), '7 · les deux sources neuves se publient');
  const pubsSante = S.lirePubsSante(SS, U);
  const sources = { at: T, partiel: false, lignes: [{ id: 'a', cle: 'vinted' }, { id: 'b', cle: '' }, { id: 'c', cle: null }, { id: 'd', cle: 'non-saisie' }, { id: 'e', cle: '' }] };
  // Les comptes : lus par la VRAIE règle de fraîcheur (un compte relu il y a 3 jours, un à l'instant, un banni).
  const lignesF = F.lignesFraicheur([
    { plateforme: 'vinted', id: '1', nom: 'a', lu: T - 3 * 86400e3 },
    { plateforme: 'vinted', id: '2', nom: 'b', lu: T - 60e3 },
    { plateforme: 'vinted', id: '3', nom: 'c', lu: T - 60e3, banni: true },
  ], { maintenant: T });
  const appareils = [{ id: 'x', ver: '5.300.0', code: '5.300.0', at: T }, { id: 'y', ver: ATT, code: ATT, at: T }];
  const capture = { comptesPrets: true, passu: [], lignes: lignesF, pannes: [], appareils, ancien: { ver: '5.200.0', code: '', at: T - 3 * 86400e3 } };
  const av = S.aVoirCapture(capture, { etatVersion: G.etatVersion, attendue: ATT });
  const misDeCote = { emails: [{ id: 1 }, { id: 2 }] };
  const r = S.lignesSante({ trancher, pubsSante, sources, capture: av, misDeCote, aVerifier: 5, maintenant: T });

  // ── 1 : chaque nombre = la règle du propriétaire ──
  const tr = (cle) => trancher.lignes.find((l) => l.cle === cle).n;
  const attendu = {
    'numeros-double': tr('numeros-double'), 'numeros-a-ecrire': tr('numeros-a-ecrire'), 'colis-postes': tr('colis-postes'),
    'achats-sans-prix': tr('achats-sans-prix'), 'ventes-a-dater': tr('ventes-a-dater'),
    'ventes-sans-achat': SA.beneficeParSource(sources.lignes).sansAchat,
    'comptes-a-relire': lignesF.filter((l) => l.geste).length,
    'extension-en-retard': appareils.filter((a) => G.etatVersion(a, ATT) === 'ancienne').length,
    'emails-mis-de-cote': misDeCote.emails.length, 'emails-a-verifier': 5,
    'colis-a-confirmer': 2, 'annonces-a-confirmer': 7,
  };
  for (const [cle, n] of Object.entries(attendu)) dit(ligne(r, cle) && ligne(r, cle).n === n, `1 · ${cle} = la règle du propriétaire (${n})`, ligne(r, cle) && ligne(r, cle).n);
  dit(SA.beneficeParSource(sources.lignes).sansAchat === 3, '1 · (contrôle du banc d’essai) 3 ventes sans achat relié, faites à la main');
  dit(lignesF.filter((l) => l.geste).length === 1, '1 · (contrôle) la fraîcheur dit 1 compte à relire (3 jours), le banni et le frais non');
  dit(r.lignes.length === S.LIGNES.length && new Set(r.lignes.map((l) => l.cle)).size === S.LIGNES.length, '1 · une ligne par vérification, aucune en double');
  const cles = ['numeros-double', 'numeros-a-ecrire', 'achats-sans-prix', 'ventes-sans-achat', 'ventes-a-dater', 'comptes-a-relire', 'extension-en-retard', 'emails-mis-de-cote', 'emails-a-verifier', 'colis-postes', 'annonces-a-confirmer'];
  dit(cles.every((c) => S.CLES_LIGNES.includes(c)), '1 · les dix vérifications demandées sont toutes là', cles.filter((c) => !S.CLES_LIGNES.includes(c)).join(','));

  // ── 2 : pas su ⇒ null, jamais 0 ──
  const vide = S.lignesSante({ trancher: A.lignesATrancher({ pubs: {}, colisRetirer: null, urssafMois: null, comptes: undefined, maintenant: T }),
    pubsSante: {}, sources: null, capture: S.aVoirCapture({ comptesPrets: true, passu: ['tes appareils', 'Vinted'], lignes: [], pannes: [], appareils: null }, { etatVersion: G.etatVersion, attendue: ATT }),
    misDeCote: null, aVerifier: null, maintenant: T });
  dit(vide.lignes.every((l) => l.n === null && l.etat === 'passu' && l.raison), '2 · rien de lu : CHAQUE ligne « pas lu » avec sa raison, aucune à 0', vide.lignes.filter((l) => l.n !== null).map((l) => `${l.cle}=${l.n}`).join(' '));
  dit(!vide.toutAJour && S.resumeSante(vide).titre !== 'Tout est à jour ✓', '2 · rien de lu ⇒ jamais « Tout est à jour »', S.resumeSante(vide).titre);
  const vieux = S.lignesSante({ trancher: A.lignesATrancher({ pubs: pubsTr, colisRetirer, urssafMois, comptes: undefined, maintenant: T + 13 * 3600e3 }), pubsSante, sources, capture: av, misDeCote, aVerifier: 5, maintenant: T + 13 * 3600e3 });
  dit(['colis-a-confirmer', 'annonces-a-confirmer', 'ventes-sans-achat'].every((c) => ligne(vieux, c).n === null) && ['numeros-double', 'numeros-a-ecrire'].every((c) => ligne(vieux, c).n === null),
    '2 · une publication de plus de 12 h redevient « pas su » (les neuves comme celles d’À trancher)', vieux.lignes.map((l) => `${l.cle}=${l.n}`).join(' '));
  dit(Object.keys(S.lirePubsSante(SS, 'autre')).length === 0, '2 · une publication d’un autre compte VRM n’est jamais lue');
  dit(ligne(S.lignesSante({ trancher, pubsSante, sources: { ...sources, lignes: null }, capture: av, misDeCote, aVerifier: 5, maintenant: T }), 'ventes-sans-achat').n === null, '2 · ventes jamais publiées ⇒ pas su');
  // Une partie des comptes pas lue : 0 ⇒ pas su ; > 0 ⇒ le nombre (au moins).
  const partiel0 = S.aVoirCapture({ comptesPrets: true, passu: ['Leboncoin'], lignes: [], pannes: [], appareils: [] }, { etatVersion: G.etatVersion, attendue: ATT });
  const partiel2 = S.aVoirCapture({ ...capture, passu: ['Leboncoin'] }, { etatVersion: G.etatVersion, attendue: ATT });
  dit(ligne(S.lignesSante({ trancher, capture: partiel0, maintenant: T }), 'comptes-a-relire').n === null, '2 · comptes : 0 lu mais Leboncoin pas lu ⇒ « pas su », pas 0');
  const l2 = ligne(S.lignesSante({ trancher, capture: partiel2, maintenant: T }), 'comptes-a-relire');
  dit(l2.n === 1 && /au moins/.test(l2.raison), '2 · comptes : 1 lu, Leboncoin pas lu ⇒ 1, « au moins »', JSON.stringify(l2));
  const enCours = S.lignesSante({ trancher: undefined, capture: S.aVoirCapture(undefined), maintenant: T });
  dit(enCours.lignes.every((l) => l.n === undefined || l.n === null) && !enCours.toutAJour && S.resumeSante(enCours).titre !== 'Tout est à jour ✓', '2 · en lecture : rien n’est affirmé');

  // ── 3 : « Tout est à jour ✓ » seulement si TOUT est lu et à 0 ──
  const ST0 = memoire();
  for (const k of A.CLES_SOURCES) A.publierSource(ST0, U, k, 0, T);
  const tr0 = A.lignesATrancher({ pubs: A.lirePublications(ST0, U), colisRetirer: { aVerifier: 0, at: T }, urssafMois: { aDater: { n: 0 }, at: T }, comptes: undefined, maintenant: T });
  const SS0 = memoire(); S.publierSante(SS0, U, 'colis-a-confirmer', 0, T); S.publierSante(SS0, U, 'annonces-a-confirmer', 0, T);
  const cap0 = S.aVoirCapture({ comptesPrets: true, passu: [], lignes: [lignesF[1]], pannes: [], appareils: [appareils[1]] }, { etatVersion: G.etatVersion, attendue: ATT });
  const base0 = { trancher: tr0, pubsSante: S.lirePubsSante(SS0, U), sources: { at: T, lignes: [{ id: 'a', cle: 'vinted' }] }, capture: cap0, misDeCote: { emails: [] }, aVerifier: 0, maintenant: T };
  const zero = S.lignesSante(base0);
  dit(zero.toutAJour && S.resumeSante(zero).titre === 'Tout est à jour ✓' && zero.lignes.every((l) => l.n === 0), '3 · tout lu et à 0 ⇒ « Tout est à jour ✓ »', zero.lignes.filter((l) => l.n !== 0).map((l) => `${l.cle}=${l.n}`).join(' '));
  for (const [nom, patch] of [['e-mails pas lus', { misDeCote: null }], ['journal pas lu', { aVerifier: null }], ['ventes jamais publiées', { sources: null }], ['journal en lecture', { aVerifier: undefined }]]) {
    const x = S.lignesSante({ ...base0, ...patch });
    dit(!x.toutAJour && S.resumeSante(x).titre !== 'Tout est à jour ✓', `3 · tout à 0 sauf ${nom} ⇒ PAS « à jour »`, S.resumeSante(x).titre);
  }

  // ── 4 : l'ordre, le seul rouge ──
  dit(r.lignes[0].cle === 'numeros-double' && r.lignes[0].etat === 'rouge', '4 · deux articles sous un N° en tête, en rouge');
  dit(r.lignes.filter((l) => l.etat === 'rouge').length === 1 && S.LIGNES.filter((l) => l.ton === 'rouge').map((l) => l.cle).join() === 'numeros-double', '4 · c’est la SEULE ligne rouge (§7)');
  const rang = { rouge: 0, geste: 1, passu: 2, lecture: 3, ok: 4 };
  const melange = S.lignesSante({ ...base0, trancher, misDeCote: null });
  dit(melange.lignes.every((l, i, t) => i === 0 || rang[t[i - 1].etat] <= rang[l.etat]), '4 · à corriger, puis pas lu, puis à jour', melange.lignes.map((l) => l.etat[0]).join(''));
  const gestes = r.lignes.filter((l) => l.etat === 'geste').map((l) => S.CLES_LIGNES.indexOf(l.cle));
  dit(gestes.every((v, i, t) => i === 0 || t[i - 1] < v), '4 · les gestes dans l’ordre de gravité de LIGNES');
  dit(S.CLES_LIGNES.indexOf('numeros-a-ecrire') < S.CLES_LIGNES.indexOf('achats-sans-prix') && S.CLES_LIGNES.indexOf('colis-a-confirmer') < S.CLES_LIGNES.indexOf('ventes-a-dater'), '4 · un N° et un colis avant l’argent');
  dit(S.resumeSante(r).titre === `${r.nAFaire} choses à corriger` && r.nAFaire === r.lignes.filter((l) => l.n > 0).length, '4 · le résumé compte les lignes à corriger', S.resumeSante(r).titre);

  // ── 5 : `aVoirCapture` = l'ancien calcul de « Tout va bien ? » ──
  const ancienCalcul = (etat) => {   // recopié de src/ToutVaBien.jsx avant le 11 nov. (git show origin/main:src/ToutVaBien.jsx)
    const { appareils: ap, pannes, lignes, ancien } = etat;
    const panneDe = new Map(pannes.map((p) => [`${p.plateforme}:${p.id}`, p]));
    const anciens = (ap || []).filter((a) => G.etatVersion(a, ATT) === 'ancienne');
    const ancienInconnu = ancien && ancien.ver && G.etatVersion({ ver: ancien.ver, code: ancien.code }, ATT) === 'ancienne' && !(ap || []).some((a) => a.at >= ancien.at - 60000) ? ancien : null;
    return lignes.filter((l) => l.geste || panneDe.has(`${l.plateforme}:${l.id}`)).length + anciens.length + (ancienInconnu ? 1 : 0);
  };
  const cas = [capture, { ...capture, appareils: null }, { ...capture, ancien: null }, { ...capture, ancien: { ver: '5.200.0', at: T + 10 } }, { ...capture, pannes: [{ plateforme: 'vinted', id: '2' }] }, { ...capture, passu: ['Vinted'], lignes: [] }, { comptesPrets: true, passu: [], lignes: [], pannes: [], appareils: [] }];
  for (const [i, c] of cas.entries()) { const a = S.aVoirCapture(c, { etatVersion: G.etatVersion, attendue: ATT }); dit(a.comptes + a.extensions === ancienCalcul(c), `5 · cas ${i + 1} : aVoirCapture = l’ancien « N choses à voir »`, `${a.comptes}+${a.extensions} / ${ancienCalcul(c)}`); }
  const TVB = sansCommentaires(fs.readFileSync(path.join(RACINE, 'src', 'ToutVaBien.jsx'), 'utf8'));
  dit(/aVoirCapture\(etat, \{ etatVersion, attendue: EXT_ATTENDUE \}\)/.test(TVB) && !/const anciens = \(appareils/.test(TVB), '5 · « Tout va bien ? » appelle la règle, il n’en garde pas une copie');
  dit(/<LigneSante capture=\{etat\}\/>/.test(TVB), '5 · la ligne compacte est dans « Tout va bien ? », sur SA lecture (aucune seconde lecture)');

  // ── 6 : chaque geste ouvre, rien n'écrit ──
  const NAV = new Set(['libelle', 'tab', 'onglet', 'vue', 'cible', 'clic', 'saisiePrix', 'reglage', 'emails', 'filtre']);
  dit(S.LIGNES.every((l) => l.geste && l.geste.libelle && (l.geste.tab || l.geste.reglage) && Object.keys(l.geste).every((k) => NAV.has(k))), '6 · chaque ligne a UN geste de navigation (aucune clé d’écriture)', S.LIGNES.filter((l) => !Object.keys(l.geste || {}).every((k) => NAV.has(k))).map((l) => l.cle).join(','));
  const MOD = sansCommentaires(fs.readFileSync(process.env.SANTE_MODULE || path.join(RACINE, 'src', 'santeDonnees.js'), 'utf8'));
  dit(!/fetch\(|localStorage|sessionStorage|\.from\(/.test(MOD), '6 · le module ne lit rien et n’écrit rien lui-même (le stockage est passé)');
  dit(/from '\.\/aTrancher\.js'/.test(MOD) && /from '\.\/sourceAchats\.js'/.test(MOD) && /beneficeParSource\(sources\.lignes\)\.sansAchat/.test(MOD), '6 · les nombres viennent des modules propriétaires');
  const ach = ligne(r, 'achats-sans-prix').geste;
  dit(ach.saisiePrix === true, '6 · « sans prix d’achat » ouvre la saisie en série (celle de « Coût d’achat · 1/184 »)');

  // ── 7 : la publication ──
  const P = memoire();
  dit(S.publierSante(P, U, 'colis-a-confirmer', 1, T) === true && S.publierSante(P, U, 'colis-a-confirmer', 1, T + 60e3) === false, '7 · le même nombre dans l’heure ne réécrit rien');
  dit(S.publierSante(P, U, 'colis-a-confirmer', null, T) === false && S.publierSante(P, U, 'colis-a-confirmer', 1.5, T) === false && S.publierSante(P, U, 'colis-a-confirmer', -1, T) === false, '7 · pas su / non entier / négatif : rien écrit');
  dit(S.publierSante(P, U, 'numeros-double', 1, T) === false && S.publierSante(P, '', 'colis-a-confirmer', 1, T) === false, '7 · source inconnue ou sans compte VRM : rien écrit');

  // ── 8 : l'app ──
  const APP = sansCommentaires(fs.readFileSync(path.join(RACINE, 'src', 'App.jsx'), 'utf8'));
  const REG = sansCommentaires(fs.readFileSync(path.join(RACINE, 'src', 'ecrans', 'Reglages.jsx'), 'utf8'));
  for (const c of S.SOURCES_SANTE) dit(new RegExp(`publierSanteApp\\('${c}'`).test(APP), `8 · « ${c} » est publiée par son écran (aucune source orpheline)`);
  dit(/publierSanteApp\('annonces-a-confirmer', annAConfirmer\.length\)/.test(APP), '8 · annonces à confirmer = le nombre de `FraicheurAnnonces` (annAConfirmer)');
  dit(/aConfirmer\.etat === 'lu'\) publierSanteApp\('colis-a-confirmer', aConfirmer\.liste\.length\)/.test(APP), '8 · colis à confirmer = `aConfirmerVisibles`, publié seulement LU');
  dit(/id:'sante', type:'panneau'[^\n]*el:<SanteDonnees\/>/.test(REG), '8 · Paramètres → « Santé de tes données »');
  dit(/addEventListener\('vrm:sante-aller'/.test(APP) && /DEMANDE_SAISIE_PRIX\.on=true/.test(APP) && /allerTrancherRef\.current=allerTrancher/.test(APP), '8 · la coque ouvre les gestes par le chemin d’À trancher');
  const iE = APP.indexOf("addEventListener('vrm:sante-aller'"), iC = APP.indexOf('function AppCoeur()'), iR = APP.indexOf('if (MULTI_USER && !authState.ready) return', iC);
  dit(iE > iC && iE < iR, '8 · l’effet de la coque est posé AVANT ses retours anticipés (règle des hooks)');
  dit(/section==='sante'/.test(APP), '8 · lien direct ?tab=settings&section=sante');

  console.log(ko ? `\n${ko} contrôle(s) en échec` : '\nTout est vert.');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ ' + (e && e.stack || e)); process.exit(1); });
