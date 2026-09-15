// ⚠️⚠️ CONTRÔLE PERMANENT — IMPRESSION DES BORDEREAUX.
//
// Demande de Julien, 15 septembre : « quand tu imprimes un bordereau et que tu
// mets tout imprimer, ça imprime des fois en recto verso, je veux juste que ça
// imprime plusieurs feuilles avec un seul bordereau sur chaque feuille », et
// « imprimante classique / imprimante thermique — en thermique c'est simplement
// le bordereau sans la partie fiche destinataire, et pub pour les Mondial
// Relay, avec un tout petit SKU en bas ».
//
// MESURÉ AVANT DE CODER, sur ses 148 bordereaux qui portent un PDF :
//   • tous font UNE seule page A4 — jamais deux ;
//   • 67 en paysage (842×595, Chronopost), 81 en portrait (595×842, InPost) ;
//   • et cette page unique porte l'étiquette ET la fiche destinataire ET la pub,
//     séparées par une ligne de découpe (✂) — c'est exactement ce qu'il décrit ;
//   • `zoneEtiquette` en isole **144 sur 148 (97 %)**, en 4 mises en page, et la
//     zone est identique d'un bordereau à l'autre pour une mise en page donnée.
//
// ⚠️ CE QUI EST EN JEU, ET POURQUOI CE CONTRÔLE EXISTE : une zone devinée de
//    travers, c'est un CODE-BARRES COUPÉ, donc un colis qui ne part pas. Le
//    repli n'est donc pas « on découpe au milieu » mais « la page part
//    ENTIÈRE », et l'écran doit le DIRE. Ce contrôle exige les deux moitiés :
//    ça découpe quand on sait, ça ne découpe pas quand on ne sait pas.
//
// ⚠️ IL EXÉCUTE LE VRAI CODE extrait d'`App.jsx` dans un `vm`, sur de vrais PDF
//    fabriqués avec pdf-lib : il juge ce que les fonctions RENDENT, pas comment
//    elles sont écrites (§6.5). `--prouve` réaffaiblit la règle (on découpe même
//    sans savoir) et vérifie que les contrôles passent au ROUGE — « la fonction
//    n'existait pas avant » n'est pas une preuve (§6.1).
const fs = require('fs'), vm = require('vm'), path = require('path');
const racine = path.join(__dirname, '..');
const APP = fs.readFileSync(path.join(racine, 'src', 'App.jsx'), 'utf8');
const PL = require(path.join(racine, 'node_modules', 'pdf-lib', 'cjs', 'index.js'));
const PROUVE = process.argv.includes('--prouve');

let ko = 0;
const dit = (ok, nom, det) => { if (!ok) ko++; console.log(`${ok ? '✅' : '❌'} ${nom}${det ? ' — ' + det : ''}`); };
// Un audit ne meurt pas, il rapporte (§6, six récidives dans ce dossier).
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { dit(false, quoi, String((e && e.message) || e)); return null; } };

// ── On extrait le VRAI code, rien d'autre ───────────────────────────────────
const morceau = (re, quoi) => { const m = re.exec(APP); if (!m) { dit(false, `${quoi} introuvable dans App.jsx`); return null; } return m[0]; };
const parts = [
  morceau(/const IMPR_MODES = \[[^\n]*\n/, '`IMPR_MODES`'),
  morceau(/const imprMode = \([^\n]*\n/, '`imprMode`'),
  morceau(/const PAS_L_ETIQUETTE = \/[^\n]*\n/, '`PAS_L_ETIQUETTE`'),
  morceau(/const _mulM = \([^\n]*\n/, '`_mulM`'),
  morceau(/const _apM = \([^\n]*\n/, '`_apM`'),
  morceau(/const relevePage = \([\s\S]*?\n\};/, '`relevePage`'),
  morceau(/const _couperSelon = \([\s\S]*?\n\};/, '`_couperSelon`'),
  morceau(/const zoneEtiquette = \([\s\S]*?\n\};/, '`zoneEtiquette`'),
  morceau(/const posePrefsImpression = \([\s\S]*?\n\};/, '`posePrefsImpression`'),
  morceau(/const drawSkuThermique = \([\s\S]*?\n\};/, '`drawSkuThermique`'),
];

let R = null;
if (parts.every(Boolean)) {
  let src = parts.join('\n');
  if (PROUVE) {
    // RÉAFFAIBLISSEMENT : on découpe TOUJOURS, même quand on n'a rien reconnu —
    // c'est-à-dire qu'on rogne au hasard le bordereau dont on ignore la mise en
    // page. Les contrôles doivent virer au rouge.
    src = src.replace(/return \{ ok: false, raison: \(cand\[0\][^\n]*\n/,
      'return { ok:true, x:0, y:0, w:Math.round(W*0.5), h:Math.round(H*0.5) };\n');
    src = src.replace(/if \(dans\.length < 10\) return \{ ok: false, raison: [^\n]*\n/,
      'if (dans.length < 10) return { ok:true, x:0, y:0, w:Math.round(W*0.5), h:Math.round(H*0.5) };\n');
  }
  try {
    const ctx = { console: { log() {} }, TextDecoder };
    vm.createContext(ctx);
    vm.runInContext(`${src}\nglobalThis.R = { imprMode, zoneEtiquette, posePrefsImpression, drawSkuThermique };`, ctx, { filename: 'App.jsx' });
    R = ctx.R;
  } catch (e) { dit(false, 'le code d’impression se charge', String((e && e.message) || e)); }
}

// ── Les trois mises en page RÉELLEMENT reçues, refaites à l'identique ────────
// (a) deux colonnes, fiche destinataire nommée à droite — InPost ;
// (b) notice en haut, étiquette encadrée en bas, AUCUN mot lisible (police sans
//     table ToUnicode : mesuré sur 44 des 81 bordereaux Mondial Relay) ;
// (c) une page dont rien n'est reconnaissable — le cas où il ne faut PAS couper.
const A4 = [595.28, 841.89];
const faire = async (quoi) => {
  const d = await PL.PDFDocument.create();
  const p = d.addPage(quoi === 'paysage' ? [A4[1], A4[0]] : A4);
  const f = await d.embedFont(PL.StandardFonts.Helvetica);
  const { width: W, height: H } = p.getSize();
  if (quoi === 'colonnes') {
    // étiquette à gauche (x 20→280), fiche destinataire à droite (x 330→570)
    p.drawRectangle({ x: 20, y: 380, width: 260, height: 430, borderColor: PL.rgb(0,0,0), borderWidth: 1 });
    for (let i = 0; i < 12; i++) p.drawText('ADRESSE DESTINATION 35260', { x: 28, y: 780 - i * 30, size: 9, font: f });
    p.drawRectangle({ x: 30, y: 700, width: 240, height: 60, color: PL.rgb(0,0,0) });   // le code-barres
    p.drawText('Fiche destinataire', { x: 340, y: 700, size: 14, font: f });
    p.drawText('A mettre a l interieur du colis', { x: 340, y: 680, size: 10, font: f });
    for (let i = 0; i < 8; i++) p.drawText('Dimensions max de mon colis', { x: 340, y: 640 - i * 24, size: 9, font: f });
  } else if (quoi === 'notice') {
    // notice en haut (aucun mot lisible : on ne dessine QUE des blocs), étiquette
    // encadrée en bas — c'est le cadre tracé qui doit la sauver.
    for (let i = 0; i < 10; i++) p.drawRectangle({ x: 90, y: 760 - i * 28, width: 420, height: 10, color: PL.rgb(0.25,0.25,0.25) });
    p.drawRectangle({ x: 60, y: 40, width: 470, height: 300, borderColor: PL.rgb(0,0,0), borderWidth: 1 });
    p.drawRectangle({ x: 80, y: 250, width: 300, height: 60, color: PL.rgb(0,0,0) });
    for (let i = 0; i < 6; i++) p.drawRectangle({ x: 80, y: 200 - i * 24, width: 260, height: 8, color: PL.rgb(0.2,0.2,0.2) });
  } else {
    // rien de reconnaissable : du texte partout, aucune séparation, aucun cadre
    for (let i = 0; i < 40; i++) p.drawText('texte sans repere particulier sur toute la page', { x: 30, y: 800 - i * 20, size: 10, font: f });
  }
  // ⚠️ ON SERT LA MÊME FORME QUE LA VRAIE (§6.3). Un PDF qu'on vient de
  // construire porte un flux de contenu EN OBJET ; celui que l'app reçoit de
  // Vinted arrive toujours par `PDFDocument.load`, donc en flux compressé. Sans
  // ce passage par l'enregistrement, le banc mesurerait une fiction — et il l'a
  // fait : « ce PDF ne contient aucun texte lisible » sur du texte bien présent.
  return PL.PDFDocument.load(await d.save());
};

const airePage = (p) => { const s = p.getSize(); return s.width * s.height; };

(async () => {
  if (!R) { console.log(`\n${ko} contrôle(s) au rouge.`); process.exit(ko ? 1 : 0); }

  // ── 1. « Un seul bordereau par feuille » : le PDF DEMANDE le recto simple ──
  await essaie('le PDF produit demande le recto simple', async () => {
    const d = await PL.PDFDocument.create(); d.addPage(A4);
    R.posePrefsImpression(PL, d);
    const s = Buffer.from(await d.save({ useObjectStreams: false })).toString('latin1');
    dit(/\/Duplex\s*\/Simplex/.test(s), 'le PDF porte `/Duplex /Simplex` (une feuille par bordereau)');
    dit(/\/PickTrayByPDFSize\s*false/.test(s), 'le bac ne suit pas la taille de page');
  });

  // ── 2. Thermique : l'étiquette est isolée quand on SAIT où elle est ────────
  for (const cas of ['colonnes', 'notice']) {
    await essaie(`mise en page « ${cas} »`, async () => {
      const d = await faire(cas);
      const p = d.getPages()[0], avant = airePage(p);
      const z = R.zoneEtiquette(PL, p);
      dit(!!z.ok, `« ${cas} » : l'étiquette est repérée`, z.ok ? '' : (z.raison || ''));
      if (!z.ok) return;
      // la zone doit être STRICTEMENT plus petite que la page — sinon on n'a rien retiré
      const part = (z.w * z.h) / avant;
      dit(part < 0.65, `« ${cas} » : la fiche destinataire et la pub sont retirées`, `${Math.round(part * 100)} % de la feuille gardés`);
      // le code-barres doit être DEDANS : c'est lui qui fait partir le colis
      const bx = cas === 'colonnes' ? { x: 30, y: 700, X: 270, Y: 760 } : { x: 80, y: 250, X: 380, Y: 310 };
      const dedans = z.x <= bx.x + 1 && z.y <= bx.y + 1 && z.x + z.w >= bx.X - 1 && z.y + z.h >= bx.Y - 1;
      dit(dedans, `« ${cas} » : le code-barres est entier dans la découpe`,
        dedans ? '' : `zone x${Math.round(z.x)}..${Math.round(z.x + z.w)} y${Math.round(z.y)}..${Math.round(z.y + z.h)} contre code-barres x${bx.x}..${bx.X} y${bx.y}..${bx.Y}`);
      // le SKU : un petit numéro, DANS la zone
      const bold = await d.embedFont(PL.StandardFonts.HelveticaBold);
      const pose = R.drawSkuThermique(p, PL.rgb, bold, '412', z);
      dit(pose === true, `« ${cas} » : le N° est tamponné en petit dans l'étiquette`);
      dit(R.drawSkuThermique(p, PL.rgb, bold, '', z) === false, `« ${cas} » : pas de numéro ⇒ pas de cartouche vide`);
    });
  }

  // ── 3. ET L'AUTRE MOITIÉ : ON NE DÉCOUPE PAS CE QU'ON N'A PAS RECONNU ──────
  // C'est le contrôle qui compte le plus. Un code-barres coupé, c'est un colis
  // qui ne part pas — et ça ne se voit qu'au comptoir.
  await essaie('page non reconnue', async () => {
    const d = await faire('inconnue');
    const z = R.zoneEtiquette(PL, d.getPages()[0]);
    dit(z.ok !== true, 'une mise en page inconnue n’est PAS découpée', z.ok ? `découpée quand même en ${Math.round(z.w)}×${Math.round(z.h)}` : '');
    dit(!z.ok && !!z.raison, 'et la raison est dite en clair', z.raison || 'aucune raison');
  });
  await essaie('PDF vide', async () => {
    const d = await PL.PDFDocument.create(); d.addPage(A4);
    const z = R.zoneEtiquette(PL, d.getPages()[0]);
    dit(z.ok !== true, 'un PDF sans contenu n’est PAS découpé', z.ok ? 'découpé quand même' : '');
  });

  // ── 4. Le mode par défaut reste l'A4 : une nouveauté n'éteint pas ce qui marche
  dit(R.imprMode(undefined) === 'normale' && R.imprMode('n import quoi') === 'normale',
    'le mode par défaut est l’imprimante normale');
  dit(R.imprMode('thermique') === 'thermique', 'le mode thermique se retient');

  // ── 5. L'écran DIT ce qui est parti entier (le chiffre, jamais la promesse) ─
  const bloc = (APP.match(/\{bordResult\.thermique && \(\(\)=>\{[\s\S]*?\}\)\(\)\}/) || [])[0] || '';
  dit(/isoles/.test(bloc) && /entiers/.test(bloc),
    'le compte rendu écrit combien sont découpés ET combien sont partis entiers');
  dit(/raison/.test(bloc), 'et il donne la raison quand il n’a pas su découper');
  dit(!/(ton étiquette est prête|tout est prêt)/i.test(bloc),
    'il ne promet pas « ton étiquette est prête »');
  // la découpe ne part QUE du résultat de zoneEtiquette, jamais d'une position écrite en dur
  const fusion = (APP.match(/const mergeAndDownloadBordereaux = async[\s\S]*?\n\};/) || [])[0] || '';
  dit(/zoneEtiquette\(PL, first\)/.test(fusion) && /if \(thermique && z\.ok\)/.test(fusion),
    'le lot ne découpe que sur une zone MESURÉE');
  dit(/entiers\.push/.test(fusion), 'et il retient ce qu’il n’a pas su découper');

  console.log(`\n${ko ? `${ko} contrôle(s) au rouge.` : 'Une feuille par bordereau, et rien n’est rogné au hasard.'}`);
  process.exit(ko ? 1 : 0);
})();
