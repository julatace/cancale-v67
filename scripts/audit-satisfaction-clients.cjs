// ── audit-satisfaction-clients — LA SATISFACTION DES VENDEURS (16 nov.) ─────────────────────
// Récit : docs/passation/2026-11-16-satisfaction-clients.md. Quatre points validés par Julien :
//   N  le contrôle de nuit iPhone : un workflow PLANIFIÉ (sans secret, build de main, base inventée)
//      qui passe le banc stabilite-iphone sous WebKit « iPhone 15 » ET Chromium 390 ; rouge ⇒ le job
//      échoue ; un résumé lisible (scripts/bancs/_resume-nuit.cjs, exécuté ici sur des mesures inventées) ;
//   S  « Signaler un problème » : reçu · en cours · corrigé (+ un mot), notification au passage à
//      « corrigé » (une fois), propriétaire seul, lecture ratée ⇒ rien d'écrit, le vendeur lit SON état ;
//   M  les 10 premières minutes « sans abus » : étape atteinte + temps seulement, coupable, regroupé
//      côté serveur, RIEN sous 5 vendeurs, aucune donnée personnelle, dit dans la confidentialité ;
//   W  Ma semaine : argent à venir (règle de la coque, semaine en cours) et temps gagné (règle du
//      calculateur, estimation, « au moins » quand la règle ne sait pas tout compter).
//   node scripts/audit-satisfaction-clients.cjs                 la règle du dépôt
//   node scripts/audit-satisfaction-clients.cjs --mutation=NOM  une règle réaffaiblie (doit rougir)
//   node scripts/audit-satisfaction-clients.cjs --prouve        toutes les mutations : chacune doit rougir
// Aucune donnée réelle : tout est inventé ici.
'use strict';
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const R = path.join(__dirname, '..');
const lireF = (f) => fs.readFileSync(path.join(R, f), 'utf8');

// [nom, fichier, avant, après] : chaque mutation réaffaiblit UNE règle.
const MUTATIONS = [
  ['nuit-sans-planning', '.github/workflows/controle-nuit-iphone.yml', "  schedule:\n    - cron: '37 1 * * *'", "  push:\n    branches: [nulle-part]"],
  ['nuit-sans-webkit', '.github/workflows/controle-nuit-iphone.yml', '          - moteur: webkit\n', '          - moteur: firefox\n'],
  ['banc-toujours-vert', 'scripts/bancs/stabilite-iphone.cjs', 'process.exit(bilan.ko ? 1 : 0);', 'process.exit(0);'],
  ['etat-sans-garde', 'api/_lib/signalement.js', "  if (String(utilisateur.id).toLowerCase() !== proprio) return { code: 403, corps: { ok: false, raison: 'proprietaire' } };\n  const id = String((corps && corps.id) || '');\n  if (!ID_SIG.test(id)) return { code: 400, corps: { ok: false, raison: 'id' } };\n  const etat", "  const id = String((corps && corps.id) || '');\n  if (!ID_SIG.test(id)) return { code: 400, corps: { ok: false, raison: 'id' } };\n  const etat"],
  ['corrige-deux-fois', 'api/_lib/signalement.js', "prevenir: etat === 'corrige' && avant !== 'corrige' && !!de", "prevenir: etat === 'corrige' && !!de"],
  ['suivi-sans-etat', 'api/_lib/signalement.js', "    etat: etatDe(x), mot: motTexte(x.mot), etatLe: dateIso(x.etatLe),\n  }));", "  }));"],
  ['seuil-anonymat', 'src/mesureDemarrage.js', 'if (n < seuil) return { ok: true, assez: false, seuil };', 'if (n < 1) return { ok: true, assez: false, seuil };'],
  ['mesure-pas-coupable', 'src/mesureDemarrage.js', '    if (mesureCoupee(r.off)) continue;', ''],
  ['mesure-bavarde', 'src/mesureDemarrage.js', "  return { v: 1, t: { ...m.t, [etape]: s } };", "  return { ...(avant || {}), v: 1, t: { ...m.t, [etape]: s } };"],
  ['temps-sans-borne', 'src/maSemaine.js', 'partiel: !!ventes.partiel || n > MAX_VENTES_TEMPS', 'partiel: !!ventes.partiel'],
];
const arg = process.argv.find((a) => a.startsWith('--mutation='));
if (process.argv.includes('--prouve')) {
  let rates = 0;
  for (const [nom] of MUTATIONS) {
    const r = spawnSync(process.execPath, [__filename, `--mutation=${nom}`], { encoding: 'utf8' });
    const rouge = r.status !== 0;
    if (!rouge) rates++;
    console.log(`${rouge ? '✅' : '❌'} mutation « ${nom} » ${rouge ? 'rougit' : 'NE ROUGIT PAS'}`);
  }
  console.log(rates ? `\n❌ ${rates} mutation(s) passent inaperçues` : `\n✅ les ${MUTATIONS.length} mutations rougissent`);
  process.exit(rates ? 1 : 0);
}
let restaurer = null;
if (arg) {
  const m = MUTATIONS.find((x) => x[0] === arg.slice(11));
  if (!m) { console.log('❌ mutation inconnue'); process.exit(2); }
  const f = path.join(R, m[1]), avant = fs.readFileSync(f, 'utf8');
  if (!avant.includes(m[2])) { console.log(`❌ mutation « ${m[0]} » : le texte visé n'existe plus — mettre la mutation à jour`); process.exit(3); }
  fs.writeFileSync(f, avant.replace(m[2], m[3]));
  restaurer = () => fs.writeFileSync(f, avant);
  process.on('exit', restaurer);
  for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => { restaurer(); process.exit(130); });
}

let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log(`${c ? '✅' : '❌'} ${m}${!c && d !== undefined ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)) : ''}`); };
const essaie = async (m, f) => { try { await f(); } catch (e) { dit(false, m + ' (plantage)', String((e && e.stack) || e).split('\n').slice(0, 3).join(' ')); } };
const sans = (s) => s.replace(/\/\/.*$/gm, '').replace(/^\s*#.*$/gm, '');

(async () => {
  // ── N. le contrôle de nuit ──
  console.log('── N. le contrôle de nuit iPhone');
  await essaie('N', async () => {
    const f = '.github/workflows/controle-nuit-iphone.yml';
    const wf = fs.existsSync(path.join(R, f)) ? sans(lireF(f)) : '';
    dit(!!wf, 'le workflow du contrôle de nuit existe');
    dit(/\n  schedule:\n    - cron: '\d+ [0-4] \* \* \*'/.test(wf), 'planifié chaque nuit (entre 0 h et 5 h UTC)');
    dit(/- moteur: webkit\n\s+largeur: ''/.test(wf) && /- moteur: chromium\n\s+largeur: '390'/.test(wf) && /fail-fast: false/.test(wf), 'deux moteurs : WebKit « iPhone 15 » et Chromium 390, l’un n’arrête pas l’autre');
    dit(!/secrets\./.test(wf) && !/vrm\.center/.test(wf), 'aucun secret, jamais la production');
    dit(/ref: main/.test(wf) && /npm run build/.test(wf) && /_garde-reseau\.cjs/.test(wf), 'le build de main, la garde réseau posée (un banc qui sortirait rougit)');
    dit(/node scripts\/bancs\/stabilite-iphone\.cjs/.test(wf) && /NAVIGATEUR: \$\{\{ matrix\.moteur \}\}/.test(wf) && /LARGEUR: \$\{\{ matrix\.largeur \}\}/.test(wf), 'le banc de TOUS les écrans, par moteur et par largeur');
    dit(/- name: Résumé lisible\n\s+if: always\(\)\n\s+run: node scripts\/bancs\/_resume-nuit\.cjs/.test(wf), 'le résumé lisible s’écrit même quand le banc est rouge');
    const banc = lireF('scripts/bancs/stabilite-iphone.cjs');
    dit(/process\.exit\(bilan\.ko \? 1 : 0\);/.test(banc), 'un rouge du banc ⇒ code de sortie 1 ⇒ le job échoue');
    dit(/process\.env\.LARGEUR/.test(banc) && /largeur: IPHONE\.viewport\.width/.test(banc), 'LARGEUR=390 change la largeur et la mesure la dit');
    const familles = new Set([...banc.matchAll(/`(S\d+) \$\{suf\}/g)].map((m) => m[1]));
    const RN = require(path.join(R, 'scripts', 'bancs', '_resume-nuit.cjs'));
    const absentes = [...familles].filter((x) => !RN.FAMILLES[x]);
    dit(familles.size >= 10 && !absentes.length, `chaque famille de contrôle du banc a son nom lisible (${familles.size})`, absentes);
    const r = RN.resumer([
      { fichier: 'nuit-webkit/mesures.json', moteur: 'webkit', largeur: 393, ecrans: 30, themes: ['clair', 'sombre'], bilan: { ok: 900, ko: 3 }, ko: ['S3 ventes-clair : contraste ≥ 4,5:1 sur le fond réel (120 textes)', 'S3 argent-sombre › Factures : contraste ≥ 4,5:1 sur le fond réel (40 textes)', 'S6 stock-clair : tout en bas, rien sous la barre du bas'] },
      { fichier: 'nuit-chromium/mesures.json', moteur: 'chromium', largeur: 390, ecrans: 30, themes: ['clair', 'sombre'], bilan: { ok: 903, ko: 0 }, ko: [] },
    ]);
    dit(r.rouges === 3 && /Safari \(WebKit\)/.test(r.texte) && /3 problèmes/.test(r.texte) && /Texte trop pâle[^|]*\| ventes-clair, argent-sombre › Factures/.test(r.texte) && /Contenu caché sous la barre du bas/.test(r.texte) && /Chromium · 390 px/.test(r.texte) && /Tout va bien : 903/.test(r.texte),
      'le résumé dit par moteur, par famille, les écrans touchés', r.texte);
    const r2 = RN.resumer([{ fichier: 'x/mesures.json', illisible: 'ENOENT' }]);
    dit(r2.illisibles === 1 && /Pas de résultat/.test(r2.texte), 'banc planté avant la fin : le résumé le dit (jamais « tout va bien »)');
  });

  // ── S. les états d'un signalement ──
  console.log('\n── S. reçu · en cours · corrigé');
  await essaie('S', async () => {
    const SIG = await import(path.join(R, 'api', '_lib', 'signalement.js'));
    const PROPRIO = '11111111-1111-4111-8111-111111111111', VENDEUR = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', AUTRE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const env = { SUPABASE_URL: 'https://banc.invalid', SUPABASE_SERVICE_KEY: 'cle-inventee', VRM_OWNER_UID: PROPRIO };
    const ID = 'signalement_2026111609_aaaaaaaaaaaa_1', ID2 = 'signalement_2026111610_bbbbbbbbbbbb_1';
    const rows = [
      { owner: PROPRIO, id: ID, data: { texte: 'Colis vide', ecran: 'cat_bord', de: VENDEUR, at: '2026-11-16T09:00:00Z', traite: false } },
      { owner: PROPRIO, id: ID2, data: { texte: 'Autre', ecran: 'ventes', de: AUTRE, at: '2026-11-16T10:00:00Z', traite: true } },
    ];
    let panneLecture = false; const ecrits = [];
    const fetcher = async (url, o = {}) => {
      const u = new URL(url); const q = u.searchParams;
      const json = (j, s = 200) => ({ ok: s < 400, status: s, json: async () => j });
      if ((o.method || 'GET') === 'PATCH') {
        const id = (q.get('id') || '').replace(/^eq\./, ''); const b = JSON.parse(o.body); const r = rows.find((x) => x.id === id);
        ecrits.push({ id, data: b.data }); if (r) r.data = b.data; return json(r ? [r] : []);
      }
      if (panneLecture) return json({ message: 'panne' }, 503);
      const idq = q.get('id') || '', de = q.get('data->>de');
      let l = rows.filter((x) => (idq.startsWith('eq.') ? x.id === idq.slice(3) : true) && (!de || x.data.de === de.slice(3)));
      const sel = q.get('select') || '';
      if (/etat:data->>etat/.test(sel)) l = l.map((x) => ({ id: x.id, texte: x.data.texte, ecran: x.data.ecran, at: x.data.at, traite: String(x.data.traite), reponse: x.data.reponse, reponduLe: x.data.reponduLe, etat: x.data.etat, mot: x.data.mot, etatLe: x.data.etatLe, de: x.data.de }));
      else if (sel === 'data') l = l.map((x) => ({ data: x.data }));
      return json(l);
    };
    const changer = (uid, corps) => SIG.changerEtatSignalement({ utilisateur: { id: uid }, corps, env, fetcher, maintenant: Date.parse('2026-11-16T12:00:00Z') });
    dit(SIG.etatDe({}) === 'recu' && SIG.etatDe({ traite: true }) === 'corrige' && SIG.etatDe({ etat: 'en_cours', traite: true }) === 'en_cours', 'une ligne d’avant : traité ⇒ corrigé, sinon reçu ; l’état rangé gagne');
    const vole = await changer(AUTRE, { id: ID, etat: 'corrige', mot: 'faux' });
    dit(vole.code === 403 && !ecrits.length, 'un autre compte ne change rien (403, rien d’écrit)', vole);
    const mauvais = await changer(PROPRIO, { id: ID, etat: 'archive' });
    dit(mauvais.code === 400 && !ecrits.length, 'un état inconnu est refusé (400)', mauvais);
    panneLecture = true;
    const pan = await changer(PROPRIO, { id: ID, etat: 'corrige' });
    panneLecture = false;
    dit(pan.code === 503 && !ecrits.length, 'lecture ratée : rien d’écrit', pan);
    const enc = await changer(PROPRIO, { id: ID, etat: 'en_cours' });
    dit(enc.code === 200 && rows[0].data.etat === 'en_cours' && rows[0].data.texte === 'Colis vide' && enc.prevenir === false, '« en cours » : rangé, la ligne garde tout, personne n’est notifié', enc);
    const cor = await changer(PROPRIO, { id: ID, etat: 'corrige', mot: '  Réglé\n dans la version du soir  ' });
    dit(cor.code === 200 && cor.prevenir === true && cor.de === VENDEUR && rows[0].data.mot === 'Réglé dans la version du soir' && rows[0].data.traite === true, '« corrigé » + un mot : rangé, l’auteur sera prévenu', cor);
    const n = SIG.notifCorrige({ mot: cor.mot });
    dit(n.cat === 'signalement' && /corrigé/.test(n.title) && n.body === 'Réglé dans la version du soir' && /reglage=mes-signalements/.test(n.url), 'la notification : famille « signalement », le mot, ouvre « Mes signalements »', n);
    const re = await changer(PROPRIO, { id: ID, etat: 'corrige' });
    dit(re.code === 200 && re.prevenir === false, 'déjà corrigé : aucune seconde notification', re);
    const suivi = await SIG.suiviSignalements({ utilisateur: { id: VENDEUR }, env, fetcher });
    const s = suivi.corps.signalements || [];
    dit(suivi.code === 200 && s.length === 1 && s[0].id === ID && s[0].etat === 'corrige' && s[0].mot === 'Réglé dans la version du soir', 'le vendeur lit SON signalement, son état et le mot — jamais celui d’un autre', s);
    const route = lireF('api/compte.js');
    dit(/corps\.action === 'etat'[\s\S]{0,300}changerEtatSignalement[\s\S]{0,200}r\.prevenir[\s\S]{0,200}contexteVendeur\.run\(\{ owner: r\.de \}[\s\S]{0,80}notifCorrige/.test(route), 'la route prévient l’auteur dans SON contexte (sendPushToAll), seulement si `prevenir`');
    const ui = lireF('src/composants/SignalerProbleme.jsx');
    dit(/action: 'etat'/.test(ui) && /data-signalement-etat=\{etatDe\(x\)\}/.test(ui) && /<PastilleEtat etat=\{etatDe\(x\)\}\/>/.test(ui), 'l’écran : le propriétaire envoie l’état, le vendeur voit la même pastille (même règle `etatDe`)');
  });

  // ── M. les 10 premières minutes ──
  console.log('\n── M. les 10 premières minutes, sans abus');
  // (23 nov., intégration) Les étapes de « Bien démarrer » de main (plateformes, extension, comptes, etiquetage…) : la même règle, décalée d'un nom.
  await essaie('M', async () => {
    const M = await import(path.join(R, 'src', 'mesureDemarrage.js'));
    const a = M.noterEtape(null, 'plateformes', 0.4);
    const b = M.noterEtape(a, 'extension', 44);
    dit(JSON.stringify(b) === JSON.stringify({ v: 1, t: { plateformes: 0, extension: 40 } }), 'rangé : l’étape et le temps (arrondi à 10 s), rien d’autre', b);
    dit(M.noterEtape(b, 'extension', 999) === undefined, 'une étape déjà atteinte n’est jamais réécrite');
    dit(M.noterEtape(b, 'comptes', 50, { coupee: true }) === null, 'coupée : rien n’est écrit');
    const c = M.noterEtape({ v: 1, t: { plateformes: 0 }, email: 'x@exemple.invalid', pseudo: 'p', at: '2026-11-16' }, 'etiquetage', 99999);
    dit(JSON.stringify(c) === JSON.stringify({ v: 1, t: { plateformes: 0, etiquetage: M.PLAFOND_S } }), 'un champ en trop n’est jamais recopié ; le temps est plafonné à une heure', c);
    dit(M.tempsDejaPasse({ t: { plateformes: 0, extension: 40, comptes: 300 } }, 'extension') === 40, 'repris dans le parcours : le temps déjà passé jusqu’à l’étape (jamais une date)');
    const P = '11111111-1111-4111-8111-111111111111', N = '00000000-0000-0000-0000-000000000000';
    const u = (i) => `aaaaaaaa-aaaa-4aaa-8aaa-${String(i).padStart(12, '0')}`;
    const rows = [0, 1, 2, 3].map((i) => ({ owner: u(i), md: { t: { plateformes: 0, extension: 30 + i * 10 } } }));
    rows.push({ owner: P, md: { t: { plateformes: 0 } } }, { owner: N, md: { t: { plateformes: 0 } } }, { owner: u(9), md: { t: { plateformes: 0 } }, off: 'true' }, { owner: u(8), md: null });
    const peu = M.agregerDemarrage(rows, { proprio: P });
    dit(peu.ok && peu.assez === false && !('n' in peu) && !('etapes' in peu), 'moins de 5 vendeurs mesurés (propriétaire, neutre, coupée, jamais mesuré écartés) : RIEN, pas même le nombre', peu);
    rows.push({ owner: u(4), md: { t: { plateformes: 0, extension: 80, comptes: 300 } } });
    const ag = M.agregerDemarrage(rows, { proprio: P });
    const e = Object.fromEntries((ag.etapes || []).map((x) => [x.etape, x]));
    dit(ag.assez === true && ag.n === 5 && e.plateformes.atteinte === 5 && e.extension.atteinte === 5 && e.comptes.atteinte === 1 && e.extension.mediane === 50 && e.comptes.mediane === null, 'à 5 : des nombres PAR ÉTAPE ; un temps médian seulement si 5 l’ont atteinte', ag);
    dit(ag.perte && ag.perte.apres === 'extension' && ag.perte.perdus === 4, 'l’étape qui perd le plus est nommée', ag.perte);
    const sortie = JSON.stringify(ag);
    dit(!/aaaaaaaa|owner|11111111/.test(sortie), 'aucun identifiant ne sort du regroupement');
    const PC = await import(path.join(R, 'api', '_lib', 'parcours-comptes.js'));
    dit(/md:data->vrm_mesure_demarrage,off:data->>vrm_mesure_demarrage_coupee/.test(PC.REQUETES.mains) && !/select=data(,|&|$)/.test(PC.REQUETES.mains), 'le serveur projette la mesure et l’interrupteur (jamais `select=data`)', PC.REQUETES.mains);
    dit(/corps\.demarrage = agregerDemarrage\(mains, \{ proprio \}\)/.test(lireF('api/_lib/parcours-comptes.js')), 'le tableau du propriétaire reçoit le regroupement seul (route déjà réservée au propriétaire)');
    const app = lireF('src/App.jsx');
    dit(/mesureDemarrageCoupee\(load\(CLE_MESURE_COUPEE, false\)\)\) return;/.test(app) && /noterEtapeDemarrage\(avant, e,/.test(app) && /CLE_MESURE_DEMARRAGE, CLE_MESURE_COUPEE,/.test(app), 'l’app : coupée ⇒ rien ; les deux clés synchronisées (un réglage suit le compte)');
    const reg = lireF('src/ecrans/Reglages.jsx');
    dit(/id:'mesure-demarrage', type:'switch'/.test(reg) && /if \(coupe\) save\(CLE_MESURE_DEMARRAGE, null\)/.test(reg) && /'mesure-demarrage'/.test(lireF('src/parametres/categories.js')), 'Paramètres : l’interrupteur ; coupée ⇒ ce qui était rangé est effacé');
    const conf = lireF('public/legal/confidentialite.html');
    dit(/data-mesure-demarrage/.test(conf) && /5 nouveaux comptes/.test(conf) && /Mesure du démarrage/.test(conf), 'la page de confidentialité la dit (quoi, seuil, comment la couper)');
  });

  // ── W. Ma semaine ──
  console.log('\n── W. Ma semaine : argent à venir, temps gagné');
  await essaie('W', async () => {
    const S = await import(path.join(R, 'src', 'maSemaine.js'));
    const T = await import(path.join(R, 'src', 'accueil', 'tempsGagne.js'));
    const ref = T.arrondiSemaine(T.tempsGagne({ ventes: 10, achats: 0, comptes: 1, plateformes: 1, baisses: 0 }).secondes);
    const a = S.tempsSemaine({ valeur: 10, partiel: false, manque: [] });
    dit(a.valeur === ref && a.partiel === false && a.estimation === true, `10 ventes : le chiffre du calculateur (${ref} min), dit « estimation »`, a);
    dit(S.tempsSemaine({ valeur: null, raison: 'encours' }).valeur === null, 'ventes pas sues ⇒ temps « — »');
    dit(S.tempsSemaine({ valeur: 4, partiel: true, manque: ['x'] }).partiel === true, 'ventes partielles ⇒ « au moins »');
    const g = S.tempsSemaine({ valeur: 500, partiel: false });
    dit(g.partiel === true, 'plus de ventes que la règle ne sait compter ⇒ « au moins », jamais un chiffre complet faux', g);
    const R0 = { bilanLignes: () => ({ n: 0, eur: 0 }), beneficeDesJours: () => null, chiffreBrut: () => ({ valeur: null }) };
    let M1 = null, M2 = null;
    try { M1 = S.maSemaine({ maintenant: Date.parse('2026-11-18T12:00:00Z'), vendu: null, aVenir: { valeur: 120, partiel: false, manque: [] }, R: R0 }); } catch (_) {}
    try { M2 = S.maSemaine({ maintenant: Date.parse('2026-11-18T12:00:00Z'), lundi: '2026-11-09', vendu: null, aVenir: { valeur: 120, partiel: false, manque: [] }, R: R0 }); } catch (_) {}
    dit(M1 && M1.aVenir && M1.aVenir.valeur === 120 && M2 && M2.aVenir === null, 'l’argent à venir : seulement sur la semaine en cours (un chiffre d’aujourd’hui)', { cours: M1 && M1.aVenir, passee: M2 && M2.aVenir });
    dit(/aVenir: aVenirPour\(liveStats && liveStats\.aVenir\)/.test(lireF('src/App.jsx')), 'l’argent à venir vient de la règle de la coque (`aVenirPour`), jamais recalculé');
  });

  console.log(`\n${ko ? '❌' : '✅'} audit-satisfaction-clients : ${ok}/${ok + ko}`);
  process.exit(ko ? 1 : 0);
})();
