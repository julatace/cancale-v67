// ════════════════════════════════════════════════════════════════════════════
// AUDIT DU SUIVI D'UN TRAVAIL LONG (11 nov., lot suivi-travail — Julien : « quand
// l'app republie, publie de Vinted à Leboncoin, VRM reste FIGÉ avec le DÉTAIL de
// tout ce que VRM fait et une BARRE DE PROGRESSION »). Exécute la VRAIE règle
// (src/suiviTravail.js) ; lecture seule.
//   P  progression : N sur M, part, temps restant ESTIMÉ au rythme réel, « — » tant
//      qu'aucune annonce n'est finie (jamais un chiffre inventé)
//   J  journal : horodaté, rien de personnel (adresse, @pseudo, téléphone, lien de profil)
//   F  fin d'une annonce : une seule fois, « réussie » seulement si l'écran le dit
//   S  statut de fin : arrêt / pause / fini selon ce qui reste et la demande
//   C  pause et reprise d'une boucle (continuer), arrêt en pause
//   R  reprise après rechargement : « interrompu », l'annonce en cours jamais déclarée
//      faite ; l'étape dite par l'extension si elle la sait
//   X  une commande de l'extension suivie : « fait » seulement APRÈS le départ
//   B  branchements : chaque travail long démarre la feuille ; la feuille est montée
//   --prouve : chaque mutation de la règle doit rendre l'audit ROUGE.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const R = process.env.SUIVI_RACINE || path.join(__dirname, '..');
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log(`${c ? '✅' : '❌'} ${m}${!c && d !== undefined ? '  → ' + JSON.stringify(d).slice(0, 400) : ''}`); };
const lire = (p) => fs.readFileSync(path.join(R, p), 'utf8');

async function principal() {
  const S = await import(pathToFileURL(path.join(R, 'src/suiviTravail.js')).href + '?v=' + Math.random());
  const T0 = 1_000_000_000_000;
  const arts = [{ id: 'a', num: '12', titre: 'Nike' }, { id: 'b', num: '13', titre: 'Adidas' }, { id: 'c', num: '', titre: 'Puma' }];
  let s = S.creer({ sorte: 'republier', titre: 'Republier', etapes: [['photos', 'Photos'], ['brouillon', 'Brouillon'], ['en-ligne', 'Mise en ligne']], articles: arts }, T0);

  // ── P
  let p = S.progression(s, T0 + 10_000);
  dit(p.total === 3 && p.nFinis === 0 && p.part === 0, 'P1 au départ : 0 sur 3, barre vide', p);
  dit(p.restant === null, 'P2 aucune annonce finie : temps restant « — » (null), jamais inventé', p.restant);
  s = S.etapeArticle(s, 'a', 'brouillon', T0 + 20_000);
  p = S.progression(s, T0 + 20_000);
  dit(p.enCours && p.enCours.id === 'a' && p.iEtape === 1 && p.part > 0 && p.part < 1 / 3, 'P3 étape en cours comptée dans la barre, sans compter l\'annonce finie', { iEtape: p.iEtape, part: p.part });
  s = S.finArticle(s, 'a', { etat: 'ok' }, T0 + 60_000);
  p = S.progression(s, T0 + 60_000);
  dit(p.nFinis === 1 && p.nOk === 1 && Math.round(p.restant) === 120, 'P4 rythme réel : 60 s pour 1 ⇒ environ 120 s pour les 2 restantes', p.restant);
  dit(p.rang === 2 && !p.enCours, 'P5 la suivante est la 2 sur 3', p.rang);
  // (11 nov., intégration) La barre d'un travail qui ne tourne plus dit EXACTEMENT fait/total :
  // « 1 sur 1 » ⇒ pleine ; une annonce restée « en cours » à la fin ne la laisse plus à moitié.
  {
    const E3 = [['a', 'A'], ['b', 'B'], ['c', 'C']];
    let u = S.creer({ sorte: 'x', titre: 'Un', etapes: E3, articles: [{ id: '1' }] }, T0);
    u = S.etapeArticle(u, '1', 'b', T0 + 1000);
    const enCoursFini = S.progression(S.terminer(u, 'fini', T0 + 2000), T0 + 2000);
    dit(enCoursFini.part === enCoursFini.nFinis / enCoursFini.total, 'P6 travail terminé, annonce restée en cours : barre = fait/total (pas une moitié estimée)', enCoursFini.part);
    const unSurUn = S.progression(S.terminer(S.finArticle(u, '1', { etat: 'ok' }, T0 + 1500), 'fini', T0 + 2000), T0 + 2000);
    dit(unSurUn.nFinis === 1 && unSurUn.total === 1 && unSurUn.part === 1, 'P7 « 1 sur 1 » terminé : barre pleine', unSurUn);
    let d = S.creer({ sorte: 'x', titre: 'Deux', etapes: E3, articles: [{ id: '1' }, { id: '2' }] }, T0);
    d = S.finArticle(d, '1', { etat: 'ok' }, T0 + 1000); d = S.etapeArticle(d, '2', 'c', T0 + 1100);
    const arr = S.progression(S.terminer(d, 'arrete', T0 + 2000), T0 + 2000);
    dit(arr.part === 0.5, 'P8 arrêté à « 1 sur 2 » : barre à 1/2 exactement', arr.part);
    const vivant = S.progression(d, T0 + 1200);
    dit(vivant.part > 0.5 && vivant.part < 1, 'P9 pendant le travail, l\'étape en cours avance encore la barre', vivant.part);
  }

  // ── J
  const sale = S.nettoyer('Refus pour jean.dupont@mail.fr, @vanessa5723, 06 12 34 56 78, https://www.vinted.fr/member/123-x');
  dit(!/jean\.dupont|vanessa5723|06 12 34|member\/123/.test(sale), 'J1 rien de personnel : adresse, @pseudo, téléphone, lien de profil retirés', sale);
  const sj = S.noter(s, { id: 'b', texte: 'écrit à @lepseudo' }, T0 + 61_000);
  const l = sj.journal[sj.journal.length - 1];
  dit(l.at === T0 + 61_000 && l.qui === 'N°13' && !/lepseudo/.test(l.texte), 'J2 ligne horodatée, désignée par son N°, sans pseudo', l);
  const txt = S.texteJournal(sj);
  dit(txt.split('\n').length === sj.journal.length + 1 && /N°12/.test(txt), 'J3 journal copiable : une ligne par geste', txt.split('\n').length);
  let gros = s; for (let i = 0; i < 500; i++) gros = S.noter(gros, { texte: 'x' + i }, T0 + i);
  dit(gros.journal.length === S.MAX_JOURNAL && /^Début/.test(gros.journal[0].texte), 'J4 journal borné, la ligne de début gardée', gros.journal.length);

  // ── F
  const s2 = S.finArticle(s, 'a', { etat: 'refus', raison: 'tard' }, T0 + 70_000);
  dit(s2 === s, 'F1 une annonce finie ne se refinit pas', s2 === s);
  const s3 = S.finArticle(s, 'b', {}, T0 + 70_000);
  dit(S.recap(s3).reussies.length === 2, 'F2 fin sans précision = réussie seulement si l\'écran l\'appelle (défaut ok explicite)', S.recap(s3).reussies.length);
  const s4 = S.finArticle(s, 'b', { etat: 'n-importe' }, T0 + 70_000);
  dit(S.recap(s4).refusees.length === 1 && S.recap(s4).reussies.length === 1, 'F3 une issue inconnue est un refus, jamais une réussite', S.recap(s4));
  const s5 = S.finArticle(s, 'b', { etat: 'main', lien: 'javascript:alert(1)' }, T0);
  dit(S.recap(s5).aLaMain[0].lien === '', 'F4 un lien qui n\'est pas https est écarté', S.recap(s5).aLaMain[0].lien);
  const deb = S.debutArticle(S.debutArticle(s, 'b', T0 + 1), 'b', T0 + 2);
  dit(deb.journal.filter((x) => x.qui === 'N°13').length === 1, 'F5 « commencée » notée une fois (l\'écran repasse)', deb.journal.length);
  const et = S.etapeArticle(S.etapeArticle(s, 'b', 'photos', T0 + 1, 'photo 1 sur 3'), 'b', 'photos', T0 + 2, 'photo 1 sur 3');
  dit(et.journal.filter((x) => /Photos/.test(x.texte)).length === 1, 'F6 la même étape au même détail : une seule ligne', et.journal.length);
  const pa = S.poserPause(S.poserPause(s, { jusqua: T0 + 5000, raison: 'Pause' }, T0), { jusqua: T0 + 5400, raison: 'Pause' }, T0 + 400);
  dit(pa.journal.filter((x) => x.ton === 'pause').length === 1 && S.progression(pa, T0 + 1000).pause.sec === 4, 'F7 pause de sécurité : une ligne, compte à rebours lu sur son échéance', S.progression(pa, T0 + 1000).pause);

  // ── S
  dit(S.statutDeFin(s, undefined) === 'arrete', 'S1 il reste des annonces pas commencées ⇒ « arrêté »', S.statutDeFin(s));
  const tout = S.finArticle(S.finArticle(s, 'b', { etat: 'ok' }), 'c', { etat: 'refus' });
  dit(S.statutDeFin({ ...tout, demande: 'pause' }) === 'fini', 'S2 plus rien à faire ⇒ « terminé », même si une pause était demandée', S.statutDeFin({ ...tout, demande: 'pause' }));
  dit(S.statutDeFin({ ...s, demande: 'pause' }) === 'pause' && S.statutDeFin({ ...s, demande: 'arret' }) === 'arrete', 'S3 pause demandée ⇒ en pause ; arrêt demandé ⇒ arrêté', null);
  dit(S.statutDeFin(tout, 'arrete') === 'arrete', 'S4 l\'écran arrêté sur un refus de Vinted ⇒ « arrêté »', null);

  // ── C (le magasin et le pilote)
  S.suivi._poser(null);
  const t = S.suivi.demarrer({ sorte: 'baisse', titre: 'Baisse', articles: arts });
  dit(!!t && S.suivi.demarrer({ sorte: 'x', articles: arts }) === null, 'C1 un seul travail à la fois', null);
  dit((await t.continuer()) === true, 'C2 rien demandé ⇒ continuer', null);
  S.suivi.demander('pause');
  const attente = t.continuer();
  let resolu = null; attente.then((v) => { resolu = v; });
  await new Promise((r) => setTimeout(r, 20));
  dit(resolu === null && S.suivi.lire().statut === 'pause', 'C3 « Mettre en pause » : la boucle attend, le travail est en pause', { resolu, statut: S.suivi.lire().statut });
  S.suivi.reprendre();
  await new Promise((r) => setTimeout(r, 5));
  dit(resolu === true && S.suivi.lire().statut === 'cours', 'C4 « Reprendre » : la boucle repart', resolu);
  S.suivi.demander('pause');
  const att2 = t.continuer(); let r2 = null; att2.then((v) => { r2 = v; });
  await new Promise((r) => setTimeout(r, 5));
  S.suivi.arreterEnPause();
  await new Promise((r) => setTimeout(r, 5));
  dit(r2 === false && S.suivi.lire().statut === 'arrete', 'C5 « Arrêter » en pause : la boucle s\'arrête, rien d\'autre ne part', { r2, statut: S.suivi.lire().statut });
  t.terminer('');
  dit(S.suivi.lire().statut === 'arrete', 'C6 un travail arrêté ne redevient pas « terminé »', S.suivi.lire().statut);
  dit(S.suivi.fermer() === true && S.suivi.lire() === null, 'C7 « Fermer » range le travail (Ce que VRM a fait)', null);

  // ── R
  let enc = S.etapeArticle(S.finArticle(s, 'b', { etat: 'ok' }, T0 + 1), 'c', 'brouillon', T0 + 2);
  const rep = S.repriseApresChargement(enc, null, T0 + 3);
  dit(rep.statut === 'interrompu', 'R1 après rechargement : « interrompu » (la boucle de l\'écran est morte)', rep.statut);
  const c = rep.articles.find((x) => x.id === 'c');
  dit(c.etat === 'encours' && S.recap(rep).pasCommencees.some((x) => x.id === 'c') && S.recap(rep).reussies.length === 2, 'R2 l\'annonce en cours n\'est NI faite NI ratée : à vérifier', c.etat);
  dit(/regarde l’annonce/.test(rep.journal[rep.journal.length - 2].texte), 'R3 le journal dit de regarder l\'annonce avant de relancer', rep.journal.slice(-2));
  const rep2 = S.repriseApresChargement(enc, { 'repub:c': { etape: 'en-ligne', vivant: true, at: 5 }, 'repub:z': { etape: 'photos', at: 9 } }, T0 + 3);
  dit(/l’extension dit : en-ligne/.test(rep2.journal.map((x) => x.texte).join('|')), 'R4 l\'étape dite par l\'extension (ses cmds), pour CETTE annonce seulement', rep2.journal.slice(-2));
  dit(S.repriseApresChargement({ ...enc, statut: 'fini' }, null, T0) .statut === 'fini' && S.repriseApresChargement({ x: 1 }) === null, 'R5 un travail fini reste fini ; une forme inconnue ne donne rien', null);

  // ── X
  const jobs = { 'lbc:9': { etape: 'fait', at: T0 - 1000 } };
  let horloge = T0;
  const x1 = await S.suivreJob(null, '9', { jobId: 'lbc:9', lireJobs: () => jobs, depuis: T0, delaiMs: 3000, pasMs: 1000, attendre: async (ms) => { horloge += ms; }, maintenant: () => horloge });
  dit(x1.fin === 'delai', 'X1 un « fait » d\'AVANT le départ ne vaut pas « publiée »', x1.fin);
  jobs['lbc:9'] = { etape: 'depot', at: T0 + 10, progres: { etape: 'champ-manquant' } };
  horloge = T0;
  const x2 = await S.suivreJob(null, '9', { jobId: 'lbc:9', lireJobs: () => jobs, depuis: T0, delaiMs: 3000, attendre: async (ms) => { horloge += ms; }, maintenant: () => horloge });
  dit(x2.fin === 'geste', 'X2 un champ à choisir dans l\'onglet ⇒ « à finir à la main »', x2.fin);
  jobs['lbc:9'] = { etape: 'fait', at: T0 + 10 };
  horloge = T0;
  const x3 = await S.suivreJob(null, '9', { jobId: 'lbc:9', lireJobs: () => jobs, depuis: T0, delaiMs: 3000, attendre: async (ms) => { horloge += ms; }, maintenant: () => horloge });
  dit(x3.fin === 'fait', 'X3 « fait » dit par l\'extension après le départ ⇒ publiée', x3.fin);

  // ── L (l'API unique lancerTravail)
  S.suivi._poser(null);
  let r = await S.lancerTravail({ titre: 'Rapide', articles: [{ id: '1' }, { id: '2' }], executer: async () => true });
  dit(r.statut === 'fini' && S.suivi.lire() === null, 'L1 une action finie sous le seuil, tout réussi : rien ne fige, rien ne reste', r.statut);
  r = await S.lancerTravail({ titre: 'Un refus', articles: [{ id: '1' }, { id: '2' }], executer: async (a) => (a.id === '2' ? { etat: 'refus', raison: 'non', geste: 'refais' } : true) });
  dit(S.suivi.lire() && S.suivi.lire().visibleDes === 0 && S.recap(S.suivi.lire()).refusees.length === 1, 'L2 un refus, même rapide : la feuille s\'ouvre sur le récapitulatif', S.suivi.lire() && S.suivi.lire().visibleDes);
  S.suivi.fermer();
  const vus = [];
  r = await S.lancerTravail({ titre: 'Plafond', articles: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], executer: async (a) => { vus.push(a.id); return a.id === 'a' ? { etat: 'refus', raison: '429', arreterTout: true } : true; } });
  dit(vus.join() === 'a' && r.statut === 'arrete' && r.resultats.c.etat === 'saute', 'L3 un refus qui vaut pour la suite : rien d\'autre ne part, le reste « pas fait »', { vus, statut: r.statut });
  S.suivi.fermer();
  const t2 = S.suivi.demarrer({ titre: 'occupe', articles: [{ id: 'x' }] });
  r = await S.lancerTravail({ titre: 'Deuxième', executer: async () => { vus.push('jamais'); } });
  dit(r.statut === 'occupe' && !vus.includes('jamais'), 'L4 un autre travail en cours : rien ne part', r.statut);
  t2.fin('x', { etat: 'ok' }); t2.terminer(''); S.suivi.fermer();
  r = await S.lancerTravail({ titre: 'Panne', executer: async () => { throw new Error('réseau coupé'); } });
  dit(r.resultats.action.etat === 'refus' && /réseau coupé/.test(r.resultats.action.raison) && S.suivi.lire() !== null, 'L5 une exception : refus avec son message, montré', r.resultats.action);
  S.suivi.fermer();
  r = await S.lancerTravail({ titre: 'Annulé', executer: async () => ({ annule: true }) });
  dit(S.suivi.lire() === null && r.valeur && r.valeur.annule, 'L6 annulé par lui : rien à montrer ni à garder');
  r = await S.lancerTravail({ titre: 'Une action', executer: async (o) => { o.etape('x'); return '3 faits'; } });
  dit(r.valeur === '3 faits' && S.suivi.lire() === null, 'L7 une action seule rend sa valeur (le résumé de l\'écran)', r.valeur);

  // ── B (branchements, commentaires retirés)
  const sansCom = (t0) => t0.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
  const BR = [
    ['src/ecrans/Republier.jsx', /suivi\.demarrer\(\{ sorte: `republier-/],
    ['src/ecrans/Leboncoin.jsx', /suivi\.demarrer\(\{ sorte: 'republier-lbc'/],
    ['src/ecrans/Leboncoin.jsx', /suivrePublicationSite\(\{ sorte: 'publier-lbc'/],
    ['src/ecrans/Ebay.jsx', /suivi\.demarrer\(\{ sorte: 'publier-ebay'/],
    ['src/ecrans/Vestiaire.jsx', /suivi\.demarrer\(\{ sorte: auto \? 'publier-vc'/],
    ['src/BaissePrixSerie.jsx', /suivi\.demarrer\(\{ sorte: 'baisse-prix'/],
    ['src/ModeVacances.jsx', /suivi\.demarrer\(\{ sorte: 'vacances'/],
    ['src/App.jsx', /suiviTravail\.demarrer\(\{ sorte: 'retirer-ailleurs'/],
    ['src/App.jsx', /suiviTravail\.demarrer\(\{ sorte: 'bordereaux'/],
    ['src/composants/SelectionSerie.jsx', /await lancerTravail\(\{ sorte: `serie-/],
  ];
  for (const [f, re] of BR) dit(re.test(sansCom(lire(f))), `B1 ${f} démarre la feuille (${re.source.slice(0, 50)})`);
  const app = sansCom(lire('src/App.jsx'));
  dit(/<SuiviTravailCoque\/>/.test(app) && /function SuiviTravailCoque\(/.test(app), 'B2 la feuille est montée dans la coque (AppCoeur)');
  const repub = sansCom(lire('src/ecrans/Republier.jsx'));
  dit(/case 'double': return \{ etat: 'main'/.test(repub) && /case 'incertain': return \{ etat: 'main'/.test(repub), 'B3 Republier : « double » et « incertain » ne sont jamais « réussie »');
  dit(/if \(s0\.etat === 'fait'\) t\.etape\(a\.id, 'accepte'\)/.test(repub), 'B4 Republier : « acceptée par Vinted ✓ » cochée seulement sur le « fait » de l\'extension');
  const comp = sansCom(lire('src/composants/SuiviTravail.jsx'));
  dit(/setAttribute\('inert'/.test(comp) && /beforeunload/.test(comp) && /popstate/.test(comp) && /e\.key === 'Escape'/.test(comp), 'B5 la feuille fige le reste (inert), retient le retour, Échap et la fermeture d\'onglet');
  dit(/Z_SUIVI = 15000/.test(comp) && /Z_CONFIRMATION = 20000/.test(app), 'B6 la feuille passe SOUS les confirmations (une question posée pendant le travail reste répondable)');
  // (11 nov., intégration) Les couleurs de la feuille viennent de jetons que l'app POSE (themeMineral) :
  // un jeton jamais posé (`--vrm-card`) retombe sur son repli clair ⇒ blanc sur blanc en mode sombre.
  {
    const theme = lire('src/themeMineral.js');
    const poses = new Set([...theme.matchAll(/'(--vrm-[\w-]+)'\s*:/g)].map((m) => m[1]));
    let css = ''; try { css = lire('src/composants/suivi-travail.css'); } catch (_) {}
    const vus = [...new Set([...css.matchAll(/var\((--vrm-[\w-]+)/g)].map((m) => m[1]))];
    const absents = vus.filter((v) => !poses.has(v) && !['--vrm-police', '--vrm-focus'].includes(v));
    dit(css && !absents.length, 'B7 la feuille n’utilise que des jetons --vrm-* posés par le thème (rien de blanc sur blanc en sombre)', absents);
  }
}

function prouver() {
  const base = path.join(__dirname, '..');
  const MUT = [
    ['temps restant inventé avant toute annonce finie', 'src/suiviTravail.js', "(restants === 0 ? 0 : null)", "(restants === 0 ? 0 : 600)"],
    ['pseudo laissé dans le journal', 'src/suiviTravail.js', ".replace(/(^|[\\s(«\"'])@[\\w.-]{2,}/g, '$1[pseudo]')", ''],
    ['annonce en cours déclarée faite au rechargement', 'src/suiviTravail.js', "return terminer(s2, 'interrompu', now, 'l’app a été rechargée ou fermée');", "return terminer({ ...s2, articles: s2.articles.map((a) => (a.etat === 'encours' ? { ...a, etat: 'ok' } : a)) }, 'interrompu', now, 'l’app a été rechargée ou fermée');"],
    ['« fait » d\'avant le départ accepté', 'src/suiviTravail.js', "if (j.etape === 'fait' && at >= depuis)", "if (j.etape === 'fait')"],
    ['pause sans fin (statut fini ignoré)', 'src/suiviTravail.js', "if (!s.articles.some((a) => a.etat === 'attente' || a.etat === 'encours')) return 'fini';", ''],
    ['issue inconnue = réussie', 'src/suiviTravail.js', "const e = FINIS.has(etat) ? etat : 'refus';", "const e = FINIS.has(etat) ? etat : 'ok';"],
    ['Republier : double compté réussi', 'src/ecrans/Republier.jsx', "case 'double': return { etat: 'main'", "case 'double': return { etat: 'ok'"],
    ['action rapide avec un refus jamais montrée', 'src/suiviTravail.js', "&& toutBon && statut === 'fini') suivi.oublier();", "&& statut === 'fini') suivi.oublier();"],
    ['la suite part après un refus « pour tout »', 'src/suiviTravail.js', "if (iss.arreterTout) {", "if (false) {"],
    ['barre d’un travail fini estimée (moitié sur « Terminé »)', 'src/suiviTravail.js', ": finis.length / total;", ": Math.min(1, (finis.length + Math.min(0.95, partEnCours)) / total);"],
    ['feuille au-dessus des confirmations', 'src/composants/SuiviTravail.jsx', 'Z_SUIVI = 15000', 'Z_SUIVI = 25000'],
  ];
  let rouges = 0;
  for (const [nom, f, avant, apres] of MUT) {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'suivi-mut-'));
    for (const g of ['src/composants/SelectionSerie.jsx', 'src/suiviTravail.js', 'src/ecrans/Republier.jsx', 'src/ecrans/Leboncoin.jsx', 'src/ecrans/Ebay.jsx', 'src/ecrans/Vestiaire.jsx', 'src/BaissePrixSerie.jsx', 'src/ModeVacances.jsx', 'src/App.jsx', 'src/composants/SuiviTravail.jsx']) {
      fs.mkdirSync(path.dirname(path.join(d, g)), { recursive: true }); fs.copyFileSync(path.join(base, g), path.join(d, g));
    }
    fs.writeFileSync(path.join(d, 'package.json'), '{"type":"module"}');
    const src = fs.readFileSync(path.join(d, f), 'utf8');
    if (!src.includes(avant)) { console.log(`❌ mutation introuvable : ${nom}`); ko++; continue; }
    fs.writeFileSync(path.join(d, f), src.replace(avant, apres));
    const r = spawnSync(process.execPath, [__filename], { env: { ...process.env, SUIVI_RACINE: d }, encoding: 'utf8' });
    const rouge = r.status !== 0;
    if (rouge) rouges++;
    dit(rouge, `M mutation « ${nom} » ⇒ audit rouge`);
    fs.rmSync(d, { recursive: true, force: true });
  }
  return rouges;
}

(async () => {
  try { await principal(); } catch (e) { ko++; console.log('❌ exception', e && e.stack); }
  if (process.argv.includes('--prouve') && !process.env.SUIVI_RACINE) prouver();
  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})();
