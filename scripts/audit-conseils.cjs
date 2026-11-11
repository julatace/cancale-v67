// audit-conseils.cjs — L'ACCOMPAGNEMENT (6 nov. 2026)
//
// Julien : « Je veux quelque chose de plus beau, simple et visuel ; peut-être un
// accompagnement à faire telle ou telle action quand tu juges favorable, que l'on
// peut skip. » La règle vit dans src/accompagnement.js ; cet audit L'EXÉCUTE :
//  1. Une condition vraie sur un chiffre LU ⇒ un conseil ; « pas su » (null) ou
//     « en cours » (undefined) ⇒ rien ; une condition fausse ⇒ rien.
//  2. « Plus tard », le geste fait, ou un simple « vu » ⇒ pas avant 3 jours ;
//     « Ne plus montrer » ⇒ jamais ; `uneFois` ⇒ une seule fois.
//  3. Plafonds : 2 par jour, 1 par écran et par jour (jour de Paris).
//  4. Le silence : app pas prête, appareil coupé, visite en cours, mode exemple,
//     mode stream, garde-fou, chargement, feuille ouverte, mémoire pas lue,
//     conseils coupés, un conseil déjà là ⇒ rien.
//  5. La mémoire : lecture ratée ⇒ RIEN n'est écrit ; conflit ⇒ relue puis
//     réécrite (comparer-et-échanger sur `rev`) ; rien ne se perd entre deux
//     appareils (les deux « vu » restent).
//  6. La place : la pointe tombe DANS la cible ; la bulle tient dans l'écran et
//     au-dessus de la barre du bas.
//  7. Le branchement (src/App.jsx, src/Conseils.jsx, la porte de banc) : chaque
//     chiffre d'un conseil est publié par un `<ChiffreConseil cle=…>` ; chaque cible
//     existe dans le source ; le conseil n'est montré qu'après l'écriture de son
//     « vu » ; les bancs le coupent ; aucun sujet refusé par Julien (§3).
// Données INVENTÉES. Usage : node scripts/audit-conseils.cjs
//   (MODULE=<chemin> pour juger une copie mutée de la règle.)
require('./_source-app.cjs').brancher(); // (8 nov.) App.jsx découpé : sa lecture texte rend aussi src/ecrans/*.jsx
const fs = require('fs'), path = require('path');
const RACINE = path.join(__dirname, '..');
const MODULE = process.env.MODULE || path.join(RACINE, 'src/accompagnement.js');
const APP = process.env.APP || path.join(RACINE, 'src/App.jsx');
const COMPOSANT = process.env.COMPOSANT || path.join(RACINE, 'src/Conseils.jsx');
const PORTE = path.join(RACINE, 'scripts/bancs/_porte-banc.cjs');
let ok = 0, ko = 0;
const dit = (c, m, d = '') => { if (c) { ok++; console.log('  ✓ ' + m); } else { ko++; console.log('  ✗ ' + m + (d ? '\n      ' + d : '')); } };
const fin = () => { console.log(`\n${ko ? '❌' : '✅'} audit-conseils : ${ok} ✓, ${ko} ✗`); process.exit(ko ? 1 : 0); };
const lire = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch (_) { return ''; } };
// Les lignes de commentaire retirées (un `/*` dans une chaîne ferait mentir un
// découpage des blocs sur 70 000 lignes) : on juge le code, pas ce qu'il raconte.
const sansCommentaires = (t) => t.split('\n').filter((l) => !/^\s*(\/\/|\/?\*|\{\/\*)/.test(l)).join('\n');

// --prouve : chaque règle réaffaiblie dans une COPIE de src/accompagnement.js ⇒ l'audit doit être ROUGE.
const MUTATIONS = [
  ['repos-zero', 'export const REPOS_JOURS = 3;', 'export const REPOS_JOURS = 0;'],
  ['plafond-jour-large', 'export const PLAFOND_JOUR = 2;', 'export const PLAFOND_JOUR = 99;'],
  ['plafond-ecran-large', 'export const PLAFOND_ECRAN = 1;', 'export const PLAFOND_ECRAN = 9;'],
  ['pas-su-vaut-oui', '    if (v === undefined || v === null) continue;           // en cours · pas su ⇒ rien\n', ''],
  ['jamais-oublie', '  if (fini(e.jamais)) return false;\n', ''],
  ['une-fois-oublie', '  if (c.uneFois && (fini(e.vu) || fini(e.fait) || fini(e.plusTard))) return false;\n', ''],
  ['ecrit-sans-lire', "    if (!l || !estObjet(l)) return { etat: 'ko' };", "    if (!l || !estObjet(l)) l = { existe: false, data: {} };"],
  ['conflit-ecrase', "    if (r !== 'conflit') return { etat: 'ko' };", "    return { etat: 'ok', data };"],
  ['stream-ignore', "  if (c.stream) return 'stream';\n", ''],
  ['feuille-ignoree', "  if (c.feuille) return 'feuille';\n", ''],
  ['tour-ignore', "  if (c.tour) return 'tour';\n", ''],
  ['memoire-pas-su-parle', "  if (memoire === null || !estObjet(memoire)) return 'memoire-pas-su';", "  if (memoire === null || !estObjet(memoire)) memoire = { etats: {}, vus: [] };"],
  ['pointe-hors-cible', '  const flecheX = borne(dansBulle, Math.min(r.right, r.left + 6) - x, Math.max(r.left, r.right - 6) - x);', '  const flecheX = borne(cx - x, 18, bw - 18);'],
  ['barre-ignoree', '  const limite = H - Math.max(0, bas);', '  const limite = H;'],
  ['jour-utc', "timeZone: 'Europe/Paris', ", "timeZone: 'UTC', "],
];
if (process.argv.includes('--prouve')) {
  const os = require('os'); const { spawnSync } = require('child_process');
  const src = lire(MODULE); let rates = 0;
  for (const [nom, a, b] of MUTATIONS) {
    if (src.split(a).length !== 2) { console.log(`  ✗ mutation ${nom} : ancre introuvable`); rates++; continue; }
    const f = path.join(os.tmpdir(), `vrm-conseils-${process.pid}-${nom}.mjs`);
    fs.writeFileSync(f, src.split(a).join(b));
    const r = spawnSync(process.execPath, [__filename], { env: { ...process.env, MODULE: f }, encoding: 'utf8' });
    fs.unlinkSync(f);
    const rouge = r.status !== 0;
    if (!rouge) rates++;
    console.log(`  ${rouge ? '✓' : '✗'} mutation ${nom} ⇒ ${rouge ? 'ROUGE' : 'reste vert (la règle n’est pas tenue)'}`);
  }
  console.log(rates ? `\n❌ ${rates} mutation(s) passent inaperçues` : '\n✅ chaque mutation est vue');
  process.exit(rates ? 1 : 0);
}

(async () => {
  let M;
  try { M = await import('file://' + MODULE); } catch (e) { dit(false, 'la règle de l’accompagnement existe (src/accompagnement.js)', String(e && e.message)); return fin(); }
  const { CONSEILS, choisirConseil, raisonSilence, modifierMemoire, noterVu, noterReponse, memoireVide, placerConseil, publierChiffre, retirerChiffre, lireChiffres, couperConseils, revoirConseils, REPOS_JOURS, PLAFOND_JOUR, PLAFOND_ECRAN } = M;
  dit([choisirConseil, raisonSilence, modifierMemoire, noterVu, noterReponse, placerConseil, publierChiffre].every((f) => typeof f === 'function') && Array.isArray(CONSEILS), 'le module exporte la règle (choisir, se taire, écrire, placer, publier)');
  dit(REPOS_JOURS === 3 && PLAFOND_JOUR === 2 && PLAFOND_ECRAN === 1, 'les plafonds sont ceux demandés : 3 jours de repos, 2 par jour, 1 par écran', `${REPOS_JOURS}/${PLAFOND_JOUR}/${PLAFOND_ECRAN}`);

  const J = 86400000;
  const T0 = Date.parse('2026-11-06T09:00:00+01:00');
  const CTX = { pret: true, telephone: false };
  const VIDE = memoireVide();
  const c1 = (chiffres, o = {}) => choisirConseil({ ecran: o.ecran || 'annonces', chiffres, memoire: o.memoire === undefined && !('memoire' in o) ? VIDE : o.memoire, contexte: o.contexte || CTX, maintenant: o.maintenant || T0, enCours: o.enCours || null });

  console.log('§1 une condition vraie sur un chiffre LU ⇒ un conseil ; pas su ⇒ rien');
  const cas = [
    ['colis-imprimer', 'colis.imprimer', { nLot: 3, presse: true }, { nLot: 3, presse: false }, 'cat_bord'],
    ['comptes-muets', 'colis.comptesMuets', 1, 0, 'cat_bord'],
    ['ebay-relier', 'ebay.aRelier', 4, 0, 'annonces'],
    ['prix-achat', 'annonces.prixAchat', { n: 10, m: 40 }, { n: 37, m: 40 }, 'annonces'],
    ['dorment', 'annonces.dorment', 7, 0, 'annonces'],
    ['prix-mini', 'annonces.prixMini', { offresAuto: true, nbMini: 1, total: 30 }, { offresAuto: false, nbMini: 1, total: 30 }, 'annonces'],
    ['inventaire', 'stock.inventaire', { jamais: true, numeros: 42 }, { jamais: false, numeros: 42 }, 'garage'],
    ['extension', 'coque.extension', 'retard', 'ok', 'journee', { pret: true, telephone: false }],
    ['ecran-accueil', 'coque.iphone', 'a-installer', 'installee', 'journee', { pret: true, telephone: true }],
  ];
  for (const [cle, ch, oui, non, ecran, ctx] of cas) {
    const r = c1({ [ch]: oui }, { ecran, contexte: ctx || CTX });
    dit(r && r.cle === cle, `« ${cle} » : condition vraie ⇒ le conseil`, JSON.stringify(r && r.cle));
    dit(!c1({ [ch]: non }, { ecran, contexte: ctx || CTX }), `« ${cle} » : condition fausse ⇒ rien`);
    dit(!c1({ [ch]: null }, { ecran, contexte: ctx || CTX }) && !c1({ [ch]: undefined }, { ecran, contexte: ctx || CTX }) && !c1({}, { ecran, contexte: ctx || CTX }), `« ${cle} » : pas su (null), en cours (undefined), absent ⇒ rien`);
  }
  // Les seuils au bord.
  dit(!c1({ 'annonces.prixAchat': { n: 0, m: 4 } }) && !c1({ 'annonces.prixAchat': { n: 36, m: 40 } }) && !!c1({ 'annonces.prixAchat': { n: 35, m: 40 } }), 'prix d’achat : m ≥ 5 et au moins 5 manquants (4 manquants ⇒ rien, 5 ⇒ oui)');
  dit(!c1({ 'annonces.prixMini': { offresAuto: true, nbMini: 1, total: 4 } }) && !c1({ 'annonces.prixMini': { offresAuto: true, nbMini: 2, total: 10 } }) && !!c1({ 'annonces.prixMini': { offresAuto: true, nbMini: 1, total: 10 } }), 'prix mini : moins de 20 % d’au moins 5 annonces (2/10 ⇒ rien, 1/10 ⇒ oui, 4 annonces ⇒ rien)');
  dit(!c1({ 'stock.inventaire': { jamais: true, numeros: 9 } }), 'inventaire : moins de 10 N° ⇒ rien');
  dit(!c1({ 'colis.imprimer': { nLot: 0, presse: true } }), 'bordereaux : aucun dans le lot ⇒ rien, même pressé');
  dit(!c1({ 'coque.extension': 'retard' }, { ecran: 'journee', contexte: { pret: true, telephone: true } }) && !c1({ 'coque.iphone': 'a-installer' }, { ecran: 'journee', contexte: { pret: true, telephone: false } }), 'extension : ordinateur seulement ; écran d’accueil : téléphone seulement');
  dit(!c1({ 'coque.extension': 'retard' }, { ecran: 'annonces' }), 'les conseils de la coque : sur Ma journée seulement');
  // Une cible absente de l'écran : pas de conseil (jamais une bulle dans le vide).
  dit(!choisirConseil({ ecran: 'annonces', chiffres: { 'annonces.dorment': 3 }, memoire: VIDE, contexte: CTX, maintenant: T0, cibleVisible: () => null }), 'cible absente de l’écran ⇒ rien');
  dit(!!choisirConseil({ ecran: 'annonces', chiffres: { 'annonces.dorment': 3 }, memoire: VIDE, contexte: CTX, maintenant: T0, cibleVisible: () => ({}) }), 'cible visible ⇒ le conseil');
  // « Pas su » se juge AVANT la condition : même une condition toujours vraie ne parle pas sur null.
  const toujours = [{ cle: 'toujours', chiffre: 'x', quand: () => true, cibles: ['[data-x]'], titre: 't', texte: 't', geste: 'g' }];
  dit(!choisirConseil({ ecran: 'e', chiffres: { x: null }, memoire: VIDE, contexte: CTX, maintenant: T0, catalogue: toujours })
    && !choisirConseil({ ecran: 'e', chiffres: { x: undefined }, memoire: VIDE, contexte: CTX, maintenant: T0, catalogue: toujours })
    && !!choisirConseil({ ecran: 'e', chiffres: { x: 0 }, memoire: VIDE, contexte: CTX, maintenant: T0, catalogue: toujours }), 'pas su (null) et en cours (undefined) ⇒ rien, quelle que soit la condition ; 0 lu est une valeur');
  // Une condition qui lève ⇒ rien (jamais une erreur).
  dit(!c1({ 'annonces.prixAchat': 'n’importe quoi' }) && !c1({ 'colis.imprimer': 7 }), 'une valeur de mauvaise forme ⇒ rien, sans erreur');

  console.log('§2 « Plus tard », vu, fait ⇒ 3 jours ; « Ne plus montrer » ⇒ jamais ; une fois');
  const ch = { 'annonces.dorment': 5 };
  for (const rep of ['plusTard', 'fait']) {
    const m = noterReponse(noterVu(VIDE, 'dorment', 'annonces', T0), 'dorment', rep, T0);
    const apres = (j) => c1(ch, { memoire: m, maintenant: T0 + j * J });
    dit(!apres(1) && !apres(2.9), `« ${rep} » : pas le lendemain, ni avant 3 jours`);
    dit(apres(3.01) && apres(3.01).cle === 'dorment', `« ${rep} » : de retour après 3 jours`);
  }
  {
    const m = noterVu(VIDE, 'dorment', 'annonces', T0);
    dit(!c1(ch, { memoire: m, maintenant: T0 + 2 * J }) && !!c1(ch, { memoire: m, maintenant: T0 + 3.01 * J }), 'vu sans réponse (il a changé d’écran) : 3 jours de repos aussi');
    const j = noterReponse(m, 'dorment', 'jamais', T0);
    dit([1, 3.5, 30, 365].every((d) => !c1(ch, { memoire: j, maintenant: T0 + d * J })), '« Ne plus montrer » : ni dans 3 jours, ni dans un an');
    const inv = { 'stock.inventaire': { jamais: true, numeros: 50 } };
    const vuInv = noterVu(VIDE, 'inventaire', 'garage', T0);
    dit(!c1(inv, { ecran: 'garage', memoire: vuInv, maintenant: T0 + 60 * J }), '« Ton premier inventaire » (une fois) : vu une fois, plus jamais');
    const rv = revoirConseils(j);
    dit(!!c1(ch, { memoire: rv, maintenant: T0 + J }), '« Revoir les conseils » : un conseil masqué peut revenir');
    dit(!c1(ch, { memoire: couperConseils(VIDE, true) }), 'interrupteur « Conseils » coupé ⇒ rien');
  }

  console.log('§3 plafonds : 2 par jour, 1 par écran et par jour');
  {
    const tous = { 'annonces.dorment': 5, 'ebay.aRelier': 2, 'colis.comptesMuets': 1, 'colis.imprimer': { nLot: 2, presse: true }, 'stock.inventaire': { jamais: true, numeros: 20 } };
    let m = VIDE;
    const a = c1(tous, { ecran: 'annonces', memoire: m });
    m = noterVu(m, a.cle, 'annonces', T0);
    dit(!c1(tous, { ecran: 'annonces', memoire: m, maintenant: T0 + 3600e3 }), 'un conseil vu sur Annonces ⇒ plus rien sur Annonces ce jour-là');
    const b = c1(tous, { ecran: 'cat_bord', memoire: m, maintenant: T0 + 3600e3 });
    dit(b && b.cle !== a.cle, 'un autre écran peut en montrer un autre');
    m = noterVu(m, b.cle, 'cat_bord', T0 + 3600e3);
    dit(!c1(tous, { ecran: 'garage', memoire: m, maintenant: T0 + 7200e3 }), 'deux conseils vus aujourd’hui ⇒ plus rien, sur aucun écran');
    // Le lendemain matin (heure de Paris) : le compteur repart.
    const lendemain = Date.parse('2026-11-07T08:00:00+01:00');
    dit(!!c1(tous, { ecran: 'garage', memoire: m, maintenant: lendemain }), 'le lendemain (heure de Paris) : de nouveau possible');
    const minuitMoins = Date.parse('2026-11-06T23:30:00+01:00');
    dit(!c1(tous, { ecran: 'garage', memoire: m, maintenant: minuitMoins }), '23 h 30 le même jour à Paris : toujours le même jour');
    // 0 h 30 à Paris le 7 = 23 h 30 UTC le 6 : c'est le jour de Julien qui compte.
    const minuitPlus = Date.parse('2026-11-07T00:30:00+01:00');
    dit(!!c1(tous, { ecran: 'garage', memoire: m, maintenant: minuitPlus }), '0 h 30 à Paris (encore la veille en UTC) : un nouveau jour');
  }

  console.log('§4 le silence');
  const ctxs = [['pas-pret', { pret: false }], ['appareil', { pret: true, appareilCoupe: true }], ['tour', { pret: true, tour: true }], ['exemple', { pret: true, exemple: true }], ['stream', { pret: true, stream: true }], ['garde-fou', { pret: true, garde: true }], ['chargement', { pret: true, chargement: true }], ['feuille', { pret: true, feuille: true }]];
  for (const [raison, ctx] of ctxs) {
    dit(raisonSilence({ contexte: ctx, memoire: VIDE }) === raison && !c1({ 'annonces.dorment': 9 }, { contexte: ctx }), `${raison} ⇒ aucun conseil`);
  }
  dit(raisonSilence({ contexte: CTX, memoire: undefined }) === 'memoire-en-cours' && !c1({ 'annonces.dorment': 9 }, { memoire: undefined }), 'mémoire en cours de lecture ⇒ rien');
  dit(raisonSilence({ contexte: CTX, memoire: null }) === 'memoire-pas-su' && !c1({ 'annonces.dorment': 9 }, { memoire: null }), 'mémoire pas lue (lecture ratée) ⇒ rien');
  dit(!c1({ 'annonces.dorment': 9 }, { enCours: 'prix-achat' }), 'un conseil déjà à l’écran ⇒ pas un second');
  dit(raisonSilence({ contexte: CTX, memoire: VIDE }) === null, 'tout est calme ⇒ pas de raison de se taire');

  console.log('§5 la mémoire : lecture ratée ⇒ rien d’écrit ; comparer-et-échanger');
  {
    let ecrits = 0;
    const r = await modifierMemoire(async () => null, async () => { ecrits++; return 'ok'; }, (m) => noterVu(m, 'dorment', 'annonces', T0));
    dit(r.etat === 'ko' && ecrits === 0, 'lecture ratée ⇒ AUCUNE écriture, état « ko »', JSON.stringify(r) + ' écrits=' + ecrits);
    const r2 = await modifierMemoire(async () => { throw new Error('réseau'); }, async () => { ecrits++; return 'ok'; }, (m) => m);
    dit(r2.etat === 'ko' && ecrits === 0, 'lecture qui lève ⇒ aucune écriture');
    // Deux appareils : la ligne change entre la lecture et l'écriture.
    let base = { existe: true, data: { rev: 4, coupe: false, etats: { 'prix-achat': { vu: T0 - 10 } }, vus: [{ c: 'prix-achat', e: 'annonces', at: T0 - 10 }] } };
    let tour = 0; const vues = [];
    const lireB = async () => JSON.parse(JSON.stringify(base));
    const ecrireB = async ({ existe, rev, data }) => {
      vues.push(rev);
      if (tour++ === 0) { base = { existe: true, data: { ...base.data, rev: 5, etats: { ...base.data.etats, 'ebay-relier': { vu: T0 - 5 } }, vus: [...base.data.vus, { c: 'ebay-relier', e: 'annonces', at: T0 - 5 }] } }; return 'conflit'; }
      if (String(rev) !== String(base.data.rev)) return 'conflit';
      base = { existe, data }; return 'ok';
    };
    const r3 = await modifierMemoire(lireB, ecrireB, (m) => noterVu(m, 'dorment', 'cat_bord', T0));
    dit(r3.etat === 'ok' && vues.join(',') === '4,5', 'conflit ⇒ relue puis réécrite sur la nouvelle révision', vues.join(','));
    const e = base.data.etats || {};
    dit(!!(e['prix-achat'] && e['ebay-relier'] && e.dorment) && base.data.vus.length === 3 && base.data.rev === 6, 'rien ne se perd entre deux appareils (les trois « vu » restent, rev 6)', JSON.stringify(base.data).slice(0, 200));
    let nouv = null;
    const r4 = await modifierMemoire(async () => ({ existe: false, data: {} }), async (x) => { nouv = x; return 'ok'; }, (m) => noterVu(m, 'dorment', 'annonces', T0));
    dit(r4.etat === 'ok' && nouv && nouv.existe === false && nouv.rev === null && nouv.data.rev === 1, 'ligne absente ⇒ créée (rev 1)');
    let n5 = 0;
    const r5 = await modifierMemoire(async () => ({ existe: true, data: { rev: 1 } }), async () => { n5++; return 'ko'; }, (m) => m);
    dit(r5.etat === 'ko' && n5 === 1, 'écriture refusée ⇒ « ko », pas de boucle');
  }

  console.log('§6 la place de la bulle');
  {
    const W = 390, H = 844, bw = 320 - 32 + 0, bh = 170, bas = 84;
    const essais = [
      ['bouton du haut', { left: 220, right: 374, top: 120, bottom: 164 }],
      ['bouton du bas, au-dessus de la barre', { left: 16, right: 140, top: 700, bottom: 744 }],
      ['« Plus » dans la barre', { left: 312, right: 390, top: 776, bottom: 844 }, 0],
      ['bouton collé au bord gauche', { left: 0, right: 48, top: 300, bottom: 344 }],
      ['bouton collé au bord droit', { left: 350, right: 390, top: 300, bottom: 344 }],
      ['petite icône collée au bord gauche', { left: 0, right: 30, top: 300, bottom: 330 }],
      ['bouton au milieu bas : la place dessous est prise par la barre', { left: 120, right: 270, top: 560, bottom: 604 }],
    ];
    for (const [nom, r, b = bas] of essais) {
      const p = placerConseil(r, W, H, bw, bh, { bas: b });
      const px = p.x + p.flecheX;
      const dedans = p.x >= 0 && p.x + bw <= W && p.y >= 0 && p.y + bh <= H - b + 0.5;
      const pointe = px >= r.left && px <= r.right;
      const cote = p.cote === 'dessous' ? p.y >= r.bottom : p.y + bh <= r.top;
      dit(dedans && pointe && cote, `${nom} : la bulle tient (au-dessus de la barre), la pointe tombe dans la cible, sans la couvrir`, JSON.stringify({ p, r }));
    }
    const pOrdi = placerConseil({ left: 1200, right: 1340, top: 80, bottom: 124 }, 1512, 950, 320, 170, {});
    dit(pOrdi.cote === 'dessous' && pOrdi.x + 320 <= 1512 - 16, 'ordinateur : sous le bouton, dans l’écran');
  }

  console.log('§7 les chiffres publiés (un tableau, retiré au démontage)');
  publierChiffre('audit.x', 3); dit(lireChiffres()['audit.x'] === 3, 'publier ⇒ lu');
  publierChiffre('audit.x', undefined); dit(!('audit.x' in lireChiffres()), 'publier undefined ⇒ retiré');
  publierChiffre('audit.x', 2); retirerChiffre('audit.x'); dit(!('audit.x' in lireChiffres()), 'retirer ⇒ plus lu');

  console.log('§8 le branchement');
  const app = sansCommentaires(lire(APP)), comp = sansCommentaires(lire(COMPOSANT)), porte = lire(PORTE);
  const publies = new Set([...app.matchAll(/<ChiffreConseil\s+cle="([^"]+)"/g)].map((m) => m[1]));
  for (const c of CONSEILS) {
    dit(publies.has(c.chiffre), `« ${c.cle} » : son chiffre « ${c.chiffre} » est publié par un écran`, [...publies].join(', '));
    const attrs = c.cibles.flatMap((s) => [...s.matchAll(/\[(data-[a-z0-9-]+)/g)].map((m) => m[1]));
    const classes = c.cibles.flatMap((s) => [...s.matchAll(/\.([a-z][a-z0-9-]+)/g)].map((m) => m[1]));
    // (11 nov.) la ligne de fraîcheur du haut (src/LigneFraicheur.jsx) porte aussi des cibles
    const tout = app + lire(path.join(RACINE, 'src/GuideDemarrage.jsx')) + lire(path.join(RACINE, 'src/LigneFraicheur.jsx'));
    dit(attrs.every((a) => tout.includes(a)) && classes.every((k) => tout.includes(k)), `« ${c.cle} » : sa cible existe dans le source (${c.cibles[0]})`, attrs.concat(classes).filter((a) => !tout.includes(a)).join(', '));
    // Des valeurs reconnaissables (17, 3/20, 7 sur 41…) : aucune ne doit se retrouver dans la bulle.
    const exemple = { 'prix-achat': { n: 3, m: 20 }, 'colis-imprimer': { nLot: 17, presse: true }, 'prix-mini': { offresAuto: true, nbMini: 7, total: 41 }, inventaire: { jamais: true, numeros: 43 } }[c.cle] ?? 17;
    const dire = (x) => (typeof x === 'function' ? x(exemple) : x);
    const mots = [dire(c.titre), dire(c.texte)].join(' ');
    dit(!/évaluation|sans réponse|prix conseillé|jamais arriv|pas arriv/i.test(mots), `« ${c.cle} » : aucun sujet refusé par Julien (§3)`, mots);
    dit(String(dire(c.texte)).split(/[.!?]/).filter((x) => x.trim()).length <= 1 && String(dire(c.texte)).length <= 90, `« ${c.cle} » : une phrase courte`, dire(c.texte));
    dit(!/\b(17|20|41|43|7)\b/.test(mots), `« ${c.cle} » : aucun nombre de l’écran redit dans la bulle (§7)`, mots);
  }
  dit(/<Conseils\b[\s\S]{0,400}tour:\s*!!\(bienvenue \|\| visite \|\| (?:configOuverte \|\| )?\(premierJour && !load\(CLE_VISITE/.test(app), 'monté avec `tour` = Bienvenue, visite, Ma configuration ouverte, ou une personne neuve qui ne l’a pas vue');   // (11 nov.) + Ma configuration (feuille d'accueil)
  dit(/<Conseils\b[\s\S]{0,500}exemple:\s*exempleActif\(\)[\s\S]{0,80}stream:\s*!!streamOn/.test(app), 'le mode exemple et le mode stream font taire les conseils');
  dit(/lireLigneAccompagnement[\s\S]{0,400}if \(!r\.ok\) return null;/.test(app) && /data->>rev=eq\.\$\{rev\}/.test(app.slice(app.indexOf('const ecrireLigneAccompagnement'))), 'la ligne `vrm_accompagnement` : lecture ratée ⇒ null, écriture en comparer-et-échanger sur rev');
  const iVu = comp.indexOf('noterVu('), iMontre = comp.indexOf('setMontre({ ...choix');
  dit(iVu > 0 && iMontre > iVu && /if \(r\.etat !== 'ok'\)/.test(comp.slice(iVu, iMontre)), 'le conseil ne paraît qu’après l’écriture réussie de son « vu »');
  dit(/'Escape'[\s\S]{0,120}fermer\('plusTard'\)/.test(comp), 'Échap = « Plus tard »');
  dit(/vrm_conseils_appareil', 'coupes'/.test(porte) && /vrm_banc_conseils/.test(porte), 'la porte de banc coupe les conseils (sauf vrm_banc_conseils)');
  dit(/id:'conseils', type:'switch'/.test(app) && /data-reglage-conseils-revoir/.test(app), 'Paramètres → Aide : l’interrupteur « Conseils » et « Revoir les conseils »');
  fin();
})();
