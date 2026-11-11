// ═══════════════════════════════════════════════════════════════════════════
//  AUDIT : GLISSER POUR AGIR (src/glisserRegle.js + src/LigneGlissable.jsx) — EXÉCUTÉ
//  (11 nov., lot « gestes-glisser »)          node scripts/audit-ligne-glissable.cjs
// ═══════════════════════════════════════════════════════════════════════════
// La règle est un module PUR : il est chargé et EXÉCUTÉ ici (aucune lecture de son
// orthographe). Puis les écrans : chaque action du glisser est la MÊME fonction que
// le bouton existant de la ligne (jamais un geste caché seul, jamais une action chez
// Vinted sans sa feuille). `--mutation` : chaque règle réaffaiblie doit rendre rouge.
const fs = require('fs'), path = require('path'), os = require('os');
const RACINE = path.join(__dirname, '..');
const lire = (f) => fs.readFileSync(path.join(RACINE, f), 'utf8');
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1').replace(/\{\s*\}/g, '{}');

// Charge un module ES pur en CommonJS (export ⇒ module.exports).
function charger(src) {
  const code = src.replace(/^export (const|function|let) /gm, '$1 ') + '\nmodule.exports = { AMORCE, BORD, LARGEUR_ACTION, largeurActions, seuilLong, departPermis, sensGeste, positionGlisse, decision, actionsRetenues };';
  const m = { exports: {} }; new Function('module', 'exports', code)(m, m.exports); return m.exports;
}

function juger(regleSrc, sources) {
  const res = [];
  const dit = (c, m) => res.push([!!c, m]);
  let G = null;
  try { G = charger(regleSrc); } catch (e) { dit(false, 'la règle se charge : ' + e.message); return res; }
  const { BORD, largeurActions, seuilLong, departPermis, sensGeste, positionGlisse, decision, actionsRetenues } = G;
  // ── Départ ────────────────────────────────────────────────────────────────
  dit(departPermis(10, 'touch') === false && departPermis(BORD - 1, 'touch') === false, 'un appui au bord gauche (< 24 px, le retour arrière d’iOS) ne commence jamais un glisser');
  dit(BORD >= 20, 'le bord gauche réservé fait au moins 20 px');
  dit(departPermis(200, 'touch') === true && departPermis(200, 'pen') === true, 'au doigt et au stylet, ailleurs : le glisser peut commencer');
  dit(departPermis(200, 'mouse') === false, 'à la souris : jamais (le clic a ses boutons, la souris sélectionne du texte)');
  // ── Sens ──────────────────────────────────────────────────────────────────
  dit(sensGeste(4, 3) === null, 'avant l’amorce, rien n’est décidé');
  dit(sensGeste(-40, -10) === 'h', 'franchement horizontal vers la gauche ⇒ le glisser');
  dit(sensGeste(-20, -30) === 'v' && sensGeste(-30, -25) === 'v', 'un geste plutôt vertical (|dx| ≤ 1,4 |dy|) ⇒ le défilement, la ligne ne bouge pas');
  dit(sensGeste(40, 5) === 'v', 'vers la droite, ligne fermée ⇒ pas un glisser (jamais de conflit avec le retour arrière)');
  dit(sensGeste(40, 5, true) === 'h', 'vers la droite, tiroir ouvert ⇒ le referme');
  // ── Position ──────────────────────────────────────────────────────────────
  const w = 390, n = 2, s = seuilLong(w, n);
  dit(s >= w * 0.5 && s >= largeurActions(n) + 40, 'le glisser long demande au moins la moitié de la ligne et plus que les actions révélées');
  dit(positionGlisse(0, 30, w, n) === 0, 'jamais vers la droite au-delà de la place');
  dit(positionGlisse(0, -100, w, n) === -100, 'la ligne suit le doigt 1:1 avant le seuil');
  const loin = positionGlisse(0, -(s + 200), w, n);
  dit(loin < -s && loin > -(s + 200), 'au-delà du seuil, elle résiste (élastique), jamais un arrêt sec');
  dit(positionGlisse(-largeurActions(n), -20, w, n) === -largeurActions(n) - 20, 'ouverte, le glisser part de la position ouverte');
  // ── Décision ──────────────────────────────────────────────────────────────
  dit(decision(-(s + 1), w, n, 0) === 'principale', 'relâchée au-delà du seuil long ⇒ l’action principale');
  dit(decision(-(s - 1), w, n, 0) === 'ouvrir', 'juste avant le seuil long ⇒ le tiroir reste ouvert, RIEN n’est fait');
  dit(decision(-largeurActions(n) / 2 - 1, w, n, 0) === 'ouvrir' && decision(-largeurActions(n) / 2 + 10, w, n, 0) === 'fermer', 'moins de la moitié des actions ⇒ elle revient');
  dit(decision(-30, w, n, 0.9) === 'ouvrir', 'un coup de doigt rapide ouvre le tiroir');
  dit(decision(-(s + 50), w, 0, 0) === 'fermer', 'sans action, rien n’arrive jamais');
  dit(decision(-100, w, n, -0.9) === 'fermer', 'un coup de doigt vers la droite le referme');
  // ── Actions ───────────────────────────────────────────────────────────────
  const f = () => {};
  const r = actionsRetenues([{ libelle: 'A', faire: f }, null, { libelle: 'B', href: 'https://x' }, { libelle: 'C', faire: f }, { faire: f }]);
  dit(r.length === 2 && r[0].libelle === 'A' && r[1].libelle === 'B', 'au plus deux actions, chacune nommée et qui fait quelque chose ; la principale en premier');

  // ── Le composant ──────────────────────────────────────────────────────────
  const C = sansCommentaires(sources.composant);
  dit(/inert=""/.test(C) && /aria-hidden="true"/.test(C), 'le tiroir fermé est inert + aria-hidden (aucune tabulation dans un tiroir caché)');
  dit(/prefers-reduced-motion: reduce/.test(C) && /anime && !reduit\(\) \? 'translate/.test(C), 'mouvement réduit : pas de ressort (la ligne se pose sans animation)');
  dit(/navigator\.vibrate/.test(C), 'retour haptique si l’appareil sait le faire');
  dit(/pointerdown',\s*dehors/.test(C), 'un toucher ailleurs referme la ligne ouverte');
  dit(/localStorage\.getItem\(CLE_INDICE\)/.test(C) && /indicePris\s*=\s*true/.test(C), 'l’indice : une fois par appareil, une seule ligne');
  dit(/departPermis\(e\.clientX, e\.pointerType\)/.test(C) && /sensGeste\(/.test(C) && /decision\(/.test(C), 'le composant applique la règle (départ, sens, décision)');
  dit(/stopPropagation\(\);\s*lancer\(a\)/.test(C), 'une action du tiroir n’ouvre pas la ligne par-dessous');
  // ── Les écrans : les MÊMES fonctions que les boutons ──────────────────────
  const A = sansCommentaires(sources.app), R = sansCommentaires(sources.relais), Q = sansCommentaires(sources.dorment);
  const memeQue = (src, action, bouton) => src.includes(action) && src.includes(bouton);
  dit(memeQue(A, "faire: ()=>demanderDepose(txL, o, libDepose)", "onClick={()=>demanderDepose(txL, o, libDepose)}>Déposé</Bouton>"), 'Ventes : « Déposé » au glisser = le bouton « Déposé » (sa barre « Annuler » 5 s)');
  dit(memeQue(A, "faire: ()=>imprimerBordereauVente(o)", "onClick={()=>imprimerBordereauVente(o)}"), 'Ventes : « Imprimer » au glisser = le bouton « Imprimer le bordereau »');
  dit(/fuPdf \? \{ cle: 'imprimer'/.test(A), 'Ventes : « Imprimer » seulement quand le PDF est là (comme le bouton)');
  dit(/<LigneGlissable actif=\{peutDeposer && !deposeIci\}/.test(A), 'Ventes : seule une vente à expédier, pas déjà en attente, se glisse');
  dit(memeQue(R, "faire: () => retirer(x)", "onClick={(ev) => { ev.stopPropagation(); retirer(x); }}>J’ai retiré</button>"), 'À retirer : « Retiré » au glisser = « J’ai retiré » (le geste annulable)');
  dit(/faire: \(\) => \(desaccord \? setOuvert\(true\) : voirCode\(\)\)/.test(R), 'À retirer : « Le code » = le bouton « Code » ; deux codes en désaccord ⇒ la ligne s’ouvre, rien n’est choisi');
  dit(memeQue(A, "faire: ()=>markCollected(t)", "onClick={()=>markCollected(t)}") && memeQue(A, "faire: ()=>markPickupDone(o)", "onClick={()=>markPickupDone(o)}"), 'Achats (cartes) : « Retiré » = « J’ai retiré » de la carte');
  dit(/qrVivant\(t\) \? \{ cle: 'code'[\s\S]{0,200}?faire: \(\)=>openQrView\(t\)/.test(A), 'Achats (cartes) : « Le code » seulement quand la carte porte le bouton du QR (`openQrView`)');
  dit(memeQue(Q, "faire: () => onBaisser([a])", "onClick={() => onBaisser(liste.filter((a) => selection.has(a.id)))}") && memeQue(Q, "faire: () => onAgir(a)", "onClick={() => onAgir(a)}>Agir</button>"), 'Qui dorment : « Baisser » ouvre la FEUILLE (comme « Baisser le prix (N) ») ; « Agir » = « Agir »');
  // Rien chez Vinted au glisser : aucune commande d'extension, aucun appel réseau dans les actions.
  const actionsTxt = [A, R, Q].map((src) => (src.match(/actions(?:G)?=\{\[[\s\S]*?\]\}/g) || []).join('\n') + (src.match(/const actionsG = \[[\s\S]*?\];/g) || []).join('\n')).join('\n');
  dit(actionsTxt.length > 200 && !/commanderExt|executerCommande|baisserPrixVinted|fetch\(|cmdExt|envoyerCommande/.test(actionsTxt), 'aucune action du glisser ne commande l’extension ni n’appelle le réseau (rien chez Vinted sans sa feuille)');
  dit(!/GlisserVente/.test(A) && !/function GlisserVente/.test(sources.depose), 'un seul composant : l’ancien GlisserVente n’existe plus');
  return res;
}

const SOURCES = () => ({ composant: lire('src/LigneGlissable.jsx'), app: require('./_source-app.cjs').enFrancais(lire('src/App.jsx'), RACINE)   /* (11 nov.) tr() ⇒ sa phrase française */, relais: lire('src/CarteRelais.jsx'), dorment: lire('src/design/QuiDorment.jsx'), depose: lire('src/GlisserDepose.jsx') });
const REGLE = () => lire('src/glisserRegle.js');

if (process.argv.includes('--mutation')) {
  const muts = [
    ['bord gauche non réservé', (r) => r.replace('return Number(x) >= BORD;', 'return true;')],
    ['la souris glisse', (r) => r.replace("if (typePointeur === 'mouse') return false;", '')],
    ['le vertical compte comme horizontal', (r) => r.replace('Math.abs(dx) > Math.abs(dy) * 1.4', 'Math.abs(dx) > 0')],
    ['vers la droite fermée glisse', (r) => r.replace("return dx < 0 || ouvert ? 'h' : 'v';", "return 'h';")],
    ['seuil long à 20 %', (r) => r.replace('PART_LONG = 0.55', 'PART_LONG = 0.2').replace('MARGE_LONG = 64', 'MARGE_LONG = 0')],
    ['pas d’élastique', (r) => r.replace('if (d <= s) return brut;', 'return brut;')],
    ['ouvrir déclenche l’action', (r) => r.replace("if (nActions > 0 && d >= seuilLong(largeur, nActions)) return 'principale';", "if (nActions > 0 && d >= largeurActions(nActions) / 2) return 'principale';")],
    ['trois actions', (r) => r.replace('.slice(0, 2)', '.slice(0, 3)')],
  ];
  const mutsSrc = [
    ['tiroir jamais inert', (s) => ({ ...s, composant: s.composant.replace('inert="" aria-hidden="true"', '') })],
    ['Déposé autre fonction', (s) => ({ ...s, app: s.app.replace("faire: ()=>demanderDepose(txL, o, libDepose)", "faire: ()=>marquerPoste(o)") })],
    ['Baisser direct chez Vinted', (s) => ({ ...s, dorment: s.dorment.replace("faire: () => onBaisser([a])", "faire: () => baisserPrixVinted(a)") })],
    ['Retiré autre fonction', (s) => ({ ...s, relais: s.relais.replace("faire: () => retirer(x)", "faire: () => markAll(x)") })],
    ['ressort même en mouvement réduit', (s) => ({ ...s, composant: s.composant.replace('anime && !reduit() ?', 'anime ?') })],
    ['Le code sans bouton QR', (s) => ({ ...s, app: s.app.replace("qrVivant(t) ? { cle: 'code'", "true ? { cle: 'code'") })],
    ['Imprimer sans PDF', (s) => ({ ...s, app: s.app.replace("fuPdf ? { cle: 'imprimer'", "true ? { cle: 'imprimer'") })],
  ];
  let tues = 0, total = 0;
  for (const [nom, m] of muts) { total++; const r = juger(m(REGLE()), SOURCES()); const rouge = r.some(([c]) => !c); if (rouge) tues++; console.log((rouge ? 'TUÉE   ' : 'SURVIT ') + nom); }
  for (const [nom, m] of mutsSrc) { total++; const r = juger(REGLE(), m(SOURCES())); const rouge = r.some(([c]) => !c); if (rouge) tues++; console.log((rouge ? 'TUÉE   ' : 'SURVIT ') + nom); }
  console.log(tues === total ? `\n✅ ${tues}/${total} mutations tuées` : `\n❌ ${total - tues} mutation(s) survivent`);
  process.exit(tues === total ? 0 : 1);
}

let res;
try { res = juger(REGLE(), SOURCES()); } catch (e) { res = [[false, 'les fichiers existent : ' + e.message]]; }
for (const [c, m] of res) console.log((c ? 'OK  ' : 'KO  ') + m);
const ko = res.filter(([c]) => !c).length;
console.log(ko ? `\n❌ glisser pour agir : ${ko} rouge(s)` : `\n✅ glisser pour agir : tout est vert (${res.length} contrôles)`);
process.exit(ko ? 1 : 0);
