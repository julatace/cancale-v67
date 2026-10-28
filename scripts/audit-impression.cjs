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
const bloc = (nom) => morceau(new RegExp(`const ${nom} = (?:async )?\\([\\s\\S]*?\\n\\};`), '`' + nom + '`');
const ligne = (nom) => morceau(new RegExp(`const ${nom} = [^\\n]*\\n`), '`' + nom + '`');
const parts = [
  morceau(/const IMPR_MODES = \[[^\n]*\n/, '`IMPR_MODES`'),
  morceau(/const imprMode = \([^\n]*\n/, '`imprMode`'),
  morceau(/const PAS_L_ETIQUETTE = \/[^\n]*\n/, '`PAS_L_ETIQUETTE`'),
  morceau(/const _mulM = \([^\n]*\n/, '`_mulM`'),
  morceau(/const _apM = \([^\n]*\n/, '`_apM`'),
  ligne('MM_PT'), ligne('ETIQ_TH'), ligne('TAILLES_ETIQUETTE'), ligne('TH_MARGE'),
  morceau(/const TYPES_BORDEREAU = \[[\s\S]*?\n\];/, '`TYPES_BORDEREAU`'),
  bloc('relevePage'), bloc('_couperSelon'), bloc('estTailleEtiquette'), bloc('avecSens'), bloc('zoneEtiquette'),
  bloc('posePrefsImpression'), bloc('drawBordereauStamp'), bloc('placementThermique'), bloc('poserEtiquettesThermiques'),
  bloc('poserBordereau'), bloc('typeBordereau'),
  // `espaceBlancBordereau` (28 oct.) cherche une zone BLANCHE en dessinant la page
  // avec pdf.js dans un canvas : rien de ça n'existe hors d'un navigateur. Cet
  // audit juge la DÉCOUPE et la taille des pages, pas la place du numéro (le banc
  // `imprimante.cjs` la rend dans Chromium) : une place fixe, vérifiée, suffit ici.
  'const espaceBlancBordereau = async (pdf, avecTitre = false) => ({ x: 20, y: 20, w: avecTitre ? 160 : 84, h: avecTitre ? 38 : 28, verifie: true });',
];

let R = null;
if (parts.every(Boolean)) {
  let src = parts.join('\n');
  if (PROUVE) {
    // RÉAFFAIBLISSEMENTS : chacun doit faire virer au rouge au moins un contrôle.
    // (1) on découpe TOUJOURS, même sans avoir rien reconnu ;
    src = src.replace(/return \{ ok: false, raison: \(cand\[0\][^\n]*\n/,
      'return { ok:true, x:0, y:0, w:Math.round(W*0.5), h:Math.round(H*0.5) };\n');
    src = src.replace(/if \(dans\.length < 10\) return parObjets\(\) \|\| \{ ok: false, raison: [^\n]*\n/,
      'if (dans.length < 10) return { ok:true, x:0, y:0, w:Math.round(W*0.5), h:Math.round(H*0.5) };\n');
    // (2) deux étiquettes qui se chevauchent seraient prises quand même ;
    src = src.replace(/\{ etiquettes\.length = 0; break; \}/, '{}');
    // (3) la page thermique garde la taille de la zone (l'ancien rendu).
    src = src.replace(/const p = out\.addPage\(\[ETIQ_TH\.w, ETIQ_TH\.h\]\);/, 'const p = out.addPage([r.w, r.h]);');
  }
  try {
    // ⚠️ `new Function`, pas `vm` : pdf-lib vérifie `instanceof Array`, et un
    // tableau né dans un autre « realm » n'en est pas un (§ dossier, `vm`).
    R = new Function('TextDecoder', `${src}\nreturn { imprMode, zoneEtiquette, posePrefsImpression, placementThermique, poserBordereau, typeBordereau, estTailleEtiquette, ETIQ_TH, TH_MARGE, TH_BANDE };`)(TextDecoder);
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
      // ce qui sort vraiment : une page 100×150 mm, l'étiquette entière dedans,
      // le N° dans la bande SOUS l'étiquette (il ne recouvre plus rien)
      const out = await PL.PDFDocument.create();
      const r1 = await R.poserBordereau(PL, out, d, { numero: '412', title: 'x', pos: null, thermique: true });
      dit(r1.isole === true && out.getPageCount() === 1, `« ${cas} » : en thermique, une étiquette = une page`, `${out.getPageCount()} page(s)`);
      const pg = out.getPages()[0], { width: tw, height: th } = pg.getSize();
      dit(Math.abs(tw - 283.46) < 0.05 && Math.abs(th - 425.2) < 0.05, `« ${cas} » : la page fait exactement 100 × 150 mm`, `${(tw / 72 * 25.4).toFixed(1)} × ${(th / 72 * 25.4).toFixed(1)} mm`);
      const pl = R.placementThermique(z, z.sens, true);
      const b = pl.boite;
      dit(b.x >= R.TH_MARGE - 0.01 && b.x + b.w <= R.ETIQ_TH.w - R.TH_MARGE + 0.01 && b.y + b.h <= R.ETIQ_TH.h - R.TH_MARGE + 0.01,
        `« ${cas} » : l'étiquette tient entière dans la marge (rien de rogné)`, `boîte ${b.x.toFixed(1)},${b.y.toFixed(1)} ${b.w.toFixed(1)}×${b.h.toFixed(1)}`);
      dit(b.y >= R.TH_MARGE + R.TH_BANDE - 0.01, `« ${cas} » : le N° a sa bande sous l'étiquette, il ne recouvre rien`);
      const sansNum = R.placementThermique(z, z.sens, false);
      dit(sansNum.bande === 0, `« ${cas} » : pas de numéro ⇒ pas de bande vide`);
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
  const poser = (APP.match(/const poserBordereau = async[\s\S]*?\n\};/) || [])[0] || '';
  dit(/zoneEtiquette\(PL, first\)/.test(poser) && /if \(thermique && z\.ok\)/.test(poser),
    'la découpe ne part que d’une zone MESURÉE (`poserBordereau`)');
  const fusion = (APP.match(/const mergeAndDownloadBordereaux(?:Brut)? = async[\s\S]*?\n\};/) || [])[0] || '';
  const unique = (APP.match(/const annotateAndDownloadBordereau(?:Brut)? = async[\s\S]*?\n\};/) || [])[0] || '';
  const avecFacture = (APP.match(/const printBordAndInvoice = async[\s\S]*?\n  \};/) || [])[0] || '';
  dit(/poserBordereau\(/.test(fusion) && /poserBordereau\(/.test(unique) && /poserBordereau\(/.test(avecFacture),
    'les trois chemins d’impression (lot, un bordereau, bordereau + facture) passent par LA même règle');
  dit(!/setMediaBox|drawSkuThermique/.test(fusion + unique + avecFacture), 'plus aucune découpe « à la main » à côté de la règle');
  dit(/entiers\.push/.test(fusion), 'et le lot retient ce qu’il n’a pas su découper');

  // ── 6. L'ÉTIQUETTE POSÉE TELLE QUELLE PAR LE TRANSPORTEUR ──────────────────
  // (a) une page qui EST déjà une étiquette 10×15 : entière, rien de coupé.
  await essaie('page au format étiquette', async () => {
    const d = await PL.PDFDocument.create(); const p = d.addPage([R.ETIQ_TH.w, R.ETIQ_TH.h]);
    p.drawRectangle({ x: 10, y: 10, width: 200, height: 60, color: PL.rgb(0, 0, 0) });
    const z = R.zoneEtiquette(PL, (await PL.PDFDocument.load(await d.save())).getPages()[0]);
    dit(z.ok && z.via === 'page' && Math.abs(z.w - R.ETIQ_TH.w) < 0.5, 'une page déjà au format 10×15 part entière', JSON.stringify(z).slice(0, 80));
  });
  // (b) deux étiquettes en images de 100×150, côte à côte, aucun mot lisible
  //     (la forme mesurée de l'envoi international Mondial Relay → An Post).
  const deuxImages = async (chevauche) => {
    const d = await PL.PDFDocument.create(); const p = d.addPage(A4);
    const png = await d.embedPng(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64'));
    p.drawImage(png, { x: 8.5, y: 36.9, width: 283.44, height: 425.28 });
    p.drawImage(png, { x: chevauche ? 150 : 297.6, y: 30.2, width: 288, height: 432 });
    for (let i = 0; i < 12; i++) p.drawRectangle({ x: 40, y: 800 - i * 22, width: 500, height: 8, color: PL.rgb(0.3, 0.3, 0.3) });
    return PL.PDFDocument.load(await d.save());
  };
  await essaie('deux étiquettes images', async () => {
    const d = await deuxImages(false);
    const z = R.zoneEtiquette(PL, d.getPages()[0]);
    dit(z.ok && z.via === 'objet' && (z.etiquettes || []).length === 2, 'deux étiquettes posées en images ⇒ deux étiquettes reconnues', z.ok ? `${(z.etiquettes || []).length}` : z.raison);
    const out = await PL.PDFDocument.create();
    const r1 = await R.poserBordereau(PL, out, d, { numero: '7', title: '', pos: null, thermique: true });
    dit(r1.isole && out.getPageCount() === 2 && out.getPages().every((pg) => Math.abs(pg.getWidth() - 283.46) < 0.05 && Math.abs(pg.getHeight() - 425.2) < 0.05),
      'et deux pages 100×150 (les deux vont sur le colis)', `${out.getPageCount()} page(s)`);
  });
  await essaie('étiquettes qui se chevauchent', async () => {
    const z = R.zoneEtiquette(PL, (await deuxImages(true)).getPages()[0]);
    dit(!(z.ok && z.via === 'objet'), 'deux « étiquettes » qui se chevauchent ne sont PAS découpées', z.ok ? `via ${z.via}` : '');
  });
  // (c) une étiquette couchée est tournée pour tenir debout, entière
  const couchee = R.placementThermique({ x: 0, y: 0, w: 433, h: 291 }, -90, true);
  dit(couchee.angle === -90 && couchee.boite.w <= R.ETIQ_TH.w - 2 * R.TH_MARGE + 0.01 && couchee.boite.h <= R.ETIQ_TH.h - 2 * R.TH_MARGE - R.TH_BANDE + 0.01,
    'une étiquette couchée est tournée et tient entière sur le rouleau');
  dit(couchee.s <= 1.25, 'et elle n’est jamais agrandie de plus de 25 %');

  // ── 7. SUR SES VRAIS BORDEREAUX (s'ils sont là, hors dépôt) ─────────────────
  // `scripts/bancs/fx/bordereaux/*.pdf` : copie locale de ses PDF, gitignorée
  // (vrais acheteurs, vraies adresses, dépôt PUBLIC — §6). Absents ⇒ on le dit,
  // on ne fait pas semblant.
  const FX = path.join(racine, 'scripts', 'bancs', 'fx', 'bordereaux');
  const vrais = fs.existsSync(FX) ? fs.readdirSync(FX).filter((f) => f.endsWith('.pdf')) : [];
  if (!vrais.length) console.log('ℹ︎  aucun vrai bordereau local (scripts/bancs/fx/bordereaux) : section 7 sautée');
  else await essaie('vrais bordereaux', async () => {
    let iso = 0, pages = 0, mauvaises = 0, hors = 0; const types = {};
    for (const f of vrais) {
      const d = await PL.PDFDocument.load(fs.readFileSync(path.join(FX, f)));
      const t = R.typeBordereau(PL, d); types[t.type] = (types[t.type] || 0) + 1;
      const z = R.zoneEtiquette(PL, d.getPages()[0]);
      const out = await PL.PDFDocument.create();
      const r1 = await R.poserBordereau(PL, out, await PL.PDFDocument.load(fs.readFileSync(path.join(FX, f))), { numero: '123', title: '', pos: null, thermique: true });
      if (r1.isole) {
        iso++;
        for (const pg of out.getPages()) { pages++; if (Math.abs(pg.getWidth() - 283.46) > 0.05 || Math.abs(pg.getHeight() - 425.2) > 0.05) mauvaises++; }
        const { width: W, height: H } = d.getPages()[0].getSize();
        for (const e of (z.etiquettes || [z])) if (e.x < -0.5 || e.y < -0.5 || e.x + e.w > W + 0.5 || e.y + e.h > H + 0.5) hors++;
      }
    }
    console.log(`ℹ︎  ${vrais.length} vrais bordereaux : ${iso} découpés · types ${JSON.stringify(types)}`);
    dit(iso > 0, 'sur ses vrais bordereaux, des étiquettes sont découpées', `${iso}/${vrais.length}`);
    dit(mauvaises === 0, 'toutes les pages thermiques font exactement 100 × 150 mm', `${mauvaises} sur ${pages}`);
    dit(hors === 0, 'aucune zone ne déborde de sa page');
    dit(!types.autre || types.autre < vrais.length, 'le type de chaque bordereau se reconnaît (au moins en partie)', JSON.stringify(types));
  });

  console.log(`\n${ko ? `${ko} contrôle(s) au rouge.` : 'Une feuille par bordereau, et rien n’est rogné au hasard.'}`);
  process.exit(ko ? 1 : 0);
})();
