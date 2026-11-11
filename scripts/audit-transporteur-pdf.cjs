// ════════════════════════════════════════════════════════════════════════════
//  LE TRANSPORTEUR LU SUR L'ÉTIQUETTE (PDF DU BORDEREAU) — 9 nov.
//  Julien : « Règle le problème des transporteurs inconnus. »
//  · la VRAIE route `api/email-inbound.js` EXÉCUTÉE (faux Supabase, forme réelle :
//    pièce « Bordereau-Vinted-{tx}.pdf », ligne `email_bord_{tx}`) avec des PDF
//    FABRIQUÉS ici (pdf-lib) : un PDF qui nomme Mondial Relay, un qui nomme deux
//    transporteurs, un illisible, une police composite (Type0 + ToUnicode), des
//    lettres dessinées une à une ;
//  · la règle `transporteurDeVente` avec la source `pdf` (ordre, identité) ;
//  · le rattrapage borné `passeTransporteursPdf` (lecture ratée ⇒ rien écrit,
//    idempotent, un PDF par requête, `label_latest` jamais lu) ;
//  · la fusion `transporteurRelu` (le relu ne remplace jamais la réception).
//  Données inventées ; aucune donnée réelle.
// ════════════════════════════════════════════════════════════════════════════
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'cle-service-audit';
const path = require('path');
const R = path.join(__dirname, '..');
let ko = 0, ok = 0;
const dit = (bon, quoi, detail) => { if (bon) { ok++; console.log(`✅ ${quoi}`); } else { ko++; console.log(`❌ ${quoi}${detail ? ' — ' + detail : ''}`); } };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'a levé : ' + String(e && e.stack || e).slice(0, 300)); } };
const imp = (rel) => import('file://' + path.join(R, rel));

const J = '11111111-1111-1111-1111-111111111111';
const LIGNE_J = { owner: J, data: { adresses: { 'recu@vrm.center': { owner: J } } } };

(async () => {
  const PL = require(path.join(R, 'node_modules', 'pdf-lib'));
  const { PDFDocument, StandardFonts, PDFName } = PL;
  // ── Des PDF fabriqués ─────────────────────────────────────────────────────
  const pdfLignes = async (lignes, { lettreParLettre = false } = {}) => {
    const d = await PDFDocument.create(); const f = await d.embedFont(StandardFonts.Helvetica);
    const p = d.addPage([283, 425]);
    let y = 400;
    for (const l of lignes) {
      if (lettreParLettre) { let x = 10; for (const c of l) { p.drawText(c, { x, y, font: f, size: 10 }); x += 8; } }
      else p.drawText(l, { x: 10, y, font: f, size: 10 });
      y -= 16;
    }
    return Buffer.from(await d.save()).toString('base64');
  };
  // Une police COMPOSITE (Type0) dont les codes ne disent rien sans sa table ToUnicode.
  const pdfType0 = async (texte) => {
    const d = await PDFDocument.create();
    const p = d.addPage([283, 425]);
    const lettres = [...new Set([...texte])];
    const code = (c) => (lettres.indexOf(c) + 1).toString(16).padStart(4, '0');
    const cmap = `/CIDInit /ProcSet findresource begin 12 dict begin begincmap\n1 begincodespacerange <0000> <FFFF> endcodespacerange\n${lettres.length} beginbfchar\n${lettres.map((c) => `<${code(c)}> <${c.charCodeAt(0).toString(16).padStart(4, '0')}>`).join('\n')}\nendbfchar\nendcmap CMapName currentdict /CMap defineresource pop end end`;
    const tu = d.context.register(d.context.flateStream(cmap));
    const font = d.context.obj({ Type: 'Font', Subtype: 'Type0', BaseFont: 'AAAAAA+Inconnue', Encoding: 'Identity-H', ToUnicode: tu });
    const fRef = d.context.register(font);
    p.node.setFontDictionary(PDFName.of('F9'), fRef);
    const hex = [...texte].map(code).join('');
    const contenu = d.context.register(d.context.flateStream(`BT /F9 11 Tf 10 380 Td <${hex}> Tj ET`));
    p.node.set(PDFName.of('Contents'), contenu);
    return Buffer.from(await d.save()).toString('base64');
  };

  // ── La route exécutée ─────────────────────────────────────────────────────
  process.env.VRM_OWNER_UID = J;
  process.env.EMAIL_INBOUND_SECRET = 'cle-banc-pdf';
  const ecrites = [];
  const rep = (corps, status = 200) => new Response(typeof corps === 'string' ? corps : JSON.stringify(corps), { status, headers: { 'content-type': 'application/json' } });
  global.fetch = async (url, opts = {}) => {
    const u = decodeURIComponent(String(url));
    if (!u.includes('/rest/v1/')) return rep({});
    if ((opts.method || 'GET') === 'POST') { try { JSON.parse(opts.body || '[]').forEach((x) => ecrites.push({ id: x.id, data: x.data })); } catch (_) {} return rep('', 201); }
    if (/select=owner&limit=1/.test(u)) return rep([{ owner: J }]);
    if (/id=eq\.vrm_email_owners/.test(u)) return rep([LIGNE_J]);
    if (/vrm_email_preuve_/.test(u)) { const { idPreuve } = await imp('api/_lib/preuve-adresse.js'); return rep([{ id: idPreuve(J, 'recu@vrm.center'), owner: J, adresse: 'recu@vrm.center', etat: 'prouvee' }]); }
    return rep([]);
  };
  const faireRes = () => { const x = { code: null, corps: null }; x.status = (n) => { x.code = n; return x; }; x.json = (o) => { x.corps = o; return x; }; x.setHeader = () => {}; x.end = () => x; return x; };
  const route = await import('file://' + path.join(R, 'api', 'email-inbound.js') + '?pdf');
  let n = 0;
  const bord = async (tx, b64, text = `N° de transaction : ${tx}\nTon bordereau d'envoi est prêt. Rends-toi au point relais.`) => {
    ecrites.length = 0; n++;
    const res = faireRes();
    await route.default({ method: 'POST', query: {}, headers: { 'x-vrm-email-key': 'cle-banc-pdf' }, body: { messageId: `<pdf-${n}@banc>`, to: 'recu@vrm.center', from: "L'équipe Vinted <no-reply@vinted.fr>", subject: "Bordereau d'envoi pour Salomon XT-6 42", text, html: '', attachments: [{ filename: `Bordereau-Vinted-${tx}.pdf`, contentType: 'application/pdf', contentB64: b64 }] } }, res);
    const l = ecrites.find((x) => x.id === 'email_bord_' + tx);
    return { code: res.code, d: l ? l.data : null };
  };

  await essaie('R1', async () => {
    const { code, d } = await bord('41000000001', await pdfLignes(['Mondial Relay', 'Point Relais destinataire', 'N° Expédition : 87654321', 'Poids 1,2 kg', 'Réf. 20261109']));
    dit(code === 200 && d && d.transporteurPdf === 'mondialrelay' && d.pdfLu === 'ok', 'R1 un PDF qui nomme Mondial Relay ⇒ transporteurPdf « mondialrelay » rangé (scalaire)', JSON.stringify(d && [d.pdfLu, d.transporteurPdf]));
    dit(d && d.suiviPdf === '87654321' && d.suivi === '87654321' && d.suiviSource === 'pdf', 'R1 le n° MR après « Expédition » (forme propre, unique) ⇒ n° du bordereau sans n° dans l’e-mail', JSON.stringify(d && [d.suiviPdf, d.suivi]));
    dit(d && d.pdfB64 && !Object.values(d).some((v) => typeof v === 'string' && /Point Relais destinataire/.test(v)), 'R1 le TEXTE du PDF n’est jamais gardé (il porte l’adresse de l’acheteur)');
  });
  await essaie('R2', async () => {
    const { code, d } = await bord('41000000002', await pdfLignes(['Mondial Relay', 'En partenariat avec Chronopost', 'N° Expédition : 87654322']));
    dit(code === 200 && d && d.pdfLu === 'plusieurs' && d.transporteurPdf === '' && d.suiviPdf === '' && !d.suivi, 'R2 un PDF qui nomme DEUX transporteurs ⇒ rien (ni nom ni n°)', JSON.stringify(d && [d.pdfLu, d.transporteurPdf, d.suivi]));
  });
  await essaie('R3', async () => {
    const { code, d } = await bord('41000000003', Buffer.from('%PDF-1.4\n%%illisible, coupé').toString('base64'));
    dit(code === 200 && d && d.pdfLu === 'illisible' && d.transporteurPdf === '' && d.pdfB64, 'R3 PDF illisible ⇒ « illisible », rien posé, le bordereau reste rangé (jamais jeté)', JSON.stringify(d && [code, d.pdfLu]));
  });
  await essaie('R4', async () => {
    const { d } = await bord('41000000004', await pdfLignes(['Chronopost', 'Shop2Shop', 'XW 123 456 789 TS', 'Colis 12345678', 'Code 20261109']));
    dit(d && d.transporteurPdf === 'chronopost' && d.suiviPdf === 'XW123456789TS', 'R4 Chronopost + Shop2Shop = Chronopost ; seul le n° de forme propre Chronopost est gardé (pas le 8 chiffres)', JSON.stringify(d && [d.transporteurPdf, d.suiviPdf]));
  });
  await essaie('R5', async () => {
    const { d } = await bord('41000000005', await pdfType0('Livraison Colissimo'));
    dit(d && d.transporteurPdf === 'colissimo' && d.pdfLu === 'ok', 'R5 police composite (Type0) lue par SA table ToUnicode ⇒ Colissimo', JSON.stringify(d && [d.pdfLu, d.transporteurPdf]));
  });
  await essaie('R6', async () => {
    const { d } = await bord('41000000006', await pdfLignes(['Mondial Relay'], { lettreParLettre: true }));
    dit(d && d.transporteurPdf === 'mondialrelay', 'R6 lettres dessinées une à une ⇒ le nom long est reconnu quand même', JSON.stringify(d && [d.pdfLu, d.transporteurPdf]));
  });
  await essaie('R7', async () => {
    const { d } = await bord('41000000007', await pdfLignes(['Mondial Relay', '87654329', 'Poids 1 kg']));
    dit(d && d.transporteurPdf === 'mondialrelay' && d.suiviPdf === '', 'R7 8 chiffres sans « suivi / expédition / colis » devant ⇒ aucun n° gardé', JSON.stringify(d && d.suiviPdf));
  });
  await essaie('R8', async () => {
    const { d } = await bord('41000000008', await pdfLignes(['Vinted', 'Ton colis', 'Merci !']));
    dit(d && d.pdfLu === 'aucun' && d.transporteurPdf === '', 'R8 « Vinted » seul n’est pas un transporteur ⇒ « aucun »', JSON.stringify(d && d.pdfLu));
  });

  // ── La règle de Colis ─────────────────────────────────────────────────────
  const { transporteurDeVente } = await imp('src/colisEnvoyes.js');
  await essaie('V', async () => {
    const t1 = transporteurDeVente({ bord: { transaction: '1', suivi: '', transporteurPdf: 'mondialrelay' } });
    dit(t1.cle === 'mondialrelay' && t1.source === 'pdf', 'V1 bordereau dont l’étiquette nomme Mondial Relay ⇒ Mondial Relay (source pdf)', JSON.stringify(t1));
    const dep = new Map([['XW123456789TS', { suivi: 'XW123456789TS', carrier: 'chronopost', priseAt: '2026-11-08T10:00:00Z' }]]);
    const t2 = transporteurDeVente({ bord: { suivi: 'XW123456789TS', transporteurPdf: 'mondialrelay' }, departs: dep });
    dit(t2.cle === 'chronopost' && t2.source === 'transporteur', 'V2 la prise en charge lue chez le transporteur passe AVANT l’étiquette', JSON.stringify(t2));
    const t3 = transporteurDeVente({ bord: { transporteur: 'chronopost', transporteurPdf: 'mondialrelay' } });
    dit(t3.cle === 'mondialrelay' && t3.source === 'pdf', 'V3 l’étiquette passe avant le nom écrit dans l’e-mail', JSON.stringify(t3));
    const t4 = transporteurDeVente({ bord: { transporteurPdf: '' } });
    dit(!t4.cle && !t4.nom, 'V4 rien sur l’étiquette ni ailleurs ⇒ « Transporteur inconnu » (rien deviné)', JSON.stringify(t4));
    const t5 = transporteurDeVente({ bord: null, pdf: { t: 'chronopost', s: 'XW123456789SP' } });
    dit(t5.cle === 'chronopost' && t5.source === 'pdf', 'V5 vente sans bordereau e-mail : l’étiquette captée par l’extension (relue au cron) nomme', JSON.stringify(t5));
    // 8 ventes au MÊME titre : seule celle dont l'étiquette (SON n°) nomme un transporteur le prend.
    const ventes = Array.from({ length: 8 }, (_, i) => ({ tx: String(42000000000 + i), title: 'Nike Air Force 1 42' }));
    const bords = { [ventes[3].tx]: { transaction: ventes[3].tx, modele: 'Nike Air Force 1 42', transporteurPdf: 'mondialrelay' } };
    const tr = ventes.map((v) => transporteurDeVente({ bord: bords[v.tx] || null }).cle || null);
    dit(tr.filter(Boolean).length === 1 && tr[3] === 'mondialrelay', 'V6 8 ventes au même titre : une seule (son n° de transaction) prend le transporteur de son étiquette', JSON.stringify(tr));
  });

  // ── Le rattrapage borné ───────────────────────────────────────────────────
  const A = await imp('api/_lib/transporteur-anciens.js');
  const pdfMR = await pdfLignes(['Mondial Relay', 'N° de suivi : 87654330']);
  const pdfDeux = await pdfLignes(['Mondial Relay', 'Chronopost']);
  const faux = ({ bords, labels, ligne, pdfs, listeKO = false, ligneKO = false, pdfKO = new Set() }) => {
    const lus = []; const ecr = [];
    return { lus, ecr, deps: {
      lireTout: async (p) => (listeKO ? null : /email_bord/.test(p) ? bords : /_label_/.test(p) ? labels : []),
      getRow: async () => (ligneKO ? undefined : ligne),
      ecrire: async (id, data) => { ecr.push({ id, data }); return true; },
      lirePdf: async (id) => { lus.push(id); return pdfKO.has(id) ? null : (pdfs[id] == null ? '' : pdfs[id]); },
    } };
  };
  await essaie('P', async () => {
    const bords = [
      { id: 'email_bord_43000000001', tx: '43000000001', pdfLu: null, transporteur: null, suivi: '', recu: '2026-11-01T10:00:00Z' },
      { id: 'email_bord_43000000002', tx: '43000000002', pdfLu: 'ok', transporteur: null, suivi: '', recu: '2026-11-02T10:00:00Z' },
      { id: 'email_bord_43000000003', tx: '43000000003', pdfLu: null, transporteur: '', suivi: '', recu: '2026-11-03T10:00:00Z' },
    ];
    const labels = [
      { id: 'harvest_9_label_latest', tx: '43000000009', cap: '2026-11-09T10:00:00Z' },
      { id: 'harvest_9_label_43000000001', tx: '43000000001', cap: '2026-11-04T10:00:00Z' },
      { id: 'harvest_9_label_43000000004', tx: '43000000004', cap: '2026-11-05T10:00:00Z' },
    ];
    const pdfs = { email_bord_43000000001: pdfMR, email_bord_43000000003: pdfDeux, harvest_9_label_43000000004: pdfMR };
    const ligne = { v: 1, parTx: { 43000000007: { t: 'chronopost', at: 'x' } }, vus: {} };
    const f = faux({ bords, labels, ligne, pdfs });
    const r = await A.passeTransporteursPdf(f.deps);
    dit(r.fait && r.ranges === 2 && r.vus === 1, 'P1 rattrapage : 2 étiquettes nommées, 1 « plusieurs » notée', JSON.stringify(r));
    dit(!f.lus.includes('harvest_9_label_latest') && !f.lus.includes('harvest_9_label_43000000001') && !f.lus.includes('email_bord_43000000002'), 'P2 jamais `label_latest`, jamais un label doublé par un bordereau e-mail, jamais un PDF déjà lu à la réception', JSON.stringify(f.lus));
    const w = f.ecr[0] && f.ecr[0].data;
    dit(w && w.pdf['43000000001'].t === 'mondialrelay' && w.pdf['43000000001'].s === '87654330' && w.pdf['43000000004'].t === 'mondialrelay' && w.pdfVus['43000000003'].r === 'plusieurs', 'P3 rangé par n° de transaction dans `vrm_bord_transporteurs` (pdf / pdfVus)', JSON.stringify(w && [w.pdf, w.pdfVus]));
    dit(w && w.parTx && w.parTx['43000000007'], 'P4 la ligne garde ce que l’autre passe y avait rangé (parTx)');
    const f2 = faux({ bords, labels, ligne: w, pdfs });
    const r2 = await A.passeTransporteursPdf(f2.deps);
    dit(r2.fait && f2.lus.length === 0 && f2.ecr.length === 0, 'P5 idempotent : rien relu, rien réécrit au passage suivant', JSON.stringify([r2, f2.lus]));
    const f3 = faux({ bords, labels, ligne, pdfs, listeKO: true });
    const r3 = await A.passeTransporteursPdf(f3.deps);
    dit(!r3.fait && f3.ecr.length === 0 && f3.lus.length === 0, 'P6 liste illisible ⇒ rien lu, rien écrit', JSON.stringify(r3));
    const f4 = faux({ bords, labels, ligne, pdfs, ligneKO: true });
    const r4 = await A.passeTransporteursPdf(f4.deps);
    dit(!r4.fait && f4.ecr.length === 0, 'P7 ligne de rangement illisible ⇒ rien écrit (elle serait écrasée)', JSON.stringify(r4));
    const f5 = faux({ bords, labels, ligne, pdfs, pdfKO: new Set(['email_bord_43000000001']) });
    await A.passeTransporteursPdf(f5.deps);
    const w5 = f5.ecr[0] && f5.ecr[0].data;
    dit(w5 && !w5.pdf['43000000001'] && !(w5.pdfVus || {})['43000000001'], 'P8 un PDF dont la lecture rate n’est pas noté (relu plus tard), « pas su » ≠ « rien »', JSON.stringify(w5 && [w5.pdf, w5.pdfVus]));
    const f6 = faux({ bords, labels, ligne, pdfs, });
    await A.passeTransporteursPdf({ ...f6.deps, max: 1 });
    dit(f6.lus.length === 1 && f6.lus[0] === 'harvest_9_label_43000000004', 'P9 borné (max) et le plus récent d’abord', JSON.stringify(f6.lus));
  });
  await essaie('F', async () => {
    const l = A.ligneRelueDe([{ parTx: null, pdf: { 44000000001: { t: 'mondialrelay', s: '87654331' } } }]);
    const b1 = A.transporteurRelu({ transaction: '44000000001', suivi: '' }, l);
    dit(b1.transporteurPdf === 'mondialrelay' && b1.suivi === '87654331', 'F1 l’app fusionne l’étiquette relue (nom + n° de forme propre) là où rien n’était rangé', JSON.stringify(b1));
    const b2 = A.transporteurRelu({ transaction: '44000000001', suivi: 'XW123456789TS', transporteurPdf: 'chronopost' }, l);
    dit(b2.transporteurPdf === 'chronopost' && b2.suivi === 'XW123456789TS', 'F2 le relu ne remplace JAMAIS ce que la réception a rangé', JSON.stringify(b2));
    dit(String(A.REQ_RELUS).includes('pdf:data->pdf') && !/select=data(&|$)/.test(A.REQ_RELUS) && !/pdfB64/.test(A.REQ_BORDS_PDF + A.REQ_LABELS_PDF), 'F3 lectures légères : jamais `select=data`, jamais le PDF dans une liste (§4.4)');
  });

  // (11 nov., Julien : « tu les vois sur les bordereaux » ; « InPost est avec Mondial Relay ») MESURÉ sur ses vrais
  // bordereaux InPost / Mondial Relay : aucun nom en texte (logos en image), mais le code-barres imprimé en clair,
  // 26 chiffres « 56… », dont les chiffres 3 à 10 = le n° Mondial Relay de l'e-mail (3 sur 3). Valeurs INVENTÉES ici.
  await essaie('M', async () => {
    const TP = await imp('api/_lib/transporteur-pdf.js');
    const TB = await imp('api/_lib/transporteur-bordereau.js');
    const d1 = await TP.transporteurDuPdf(await pdfLignes(['Receiver', 'Shipment Nr', '56 87654321 0101 0992 7303 3798', 'Customer Reference']));
    dit(d1.etat === 'ok' && d1.t === 'mondialrelay' && d1.s === '87654321', 'M1 étiquette InPost/Mondial Relay sans nom : le code 56… UNIQUE ⇒ Mondial Relay et son n° (chiffres 3 à 10)', JSON.stringify(d1));
    const d2 = await TP.transporteurDuPdf(await pdfLignes(['Receiver', '56 87654321 0101 0992 7303 3798', '56 11112222 0101 0992 7303 3798']));
    dit(d2.etat === 'aucun' && !d2.t, 'M2 deux codes 56… différents ⇒ rien (jamais deviné)', JSON.stringify(d2));
    const d3 = await TP.transporteurDuPdf(await pdfLignes(['InPost', 'Mondial Relay', 'Receiver']));
    dit(d3.etat === 'ok' && d3.t === 'mondialrelay', 'M3 « InPost » et « Mondial Relay » sur la même étiquette = UN réseau (plus « plusieurs »)', JSON.stringify(d3));
    const d4 = await TP.transporteurDuPdf(await pdfLignes(['Chronopost', 'Mondial Relay']));
    dit(d4.etat === 'plusieurs', 'M4 deux réseaux différents ⇒ toujours rien', JSON.stringify(d4));
    dit(TB.transporteurDeTexteBordereau('Ton colis InPost / Mondial Relay') === 'mondialrelay' && TB.transporteurDeTexteBordereau('Colis InPost') === 'mondialrelay', 'M5 l’e-mail aussi : InPost = Mondial Relay');
    const c = A.candidatsPdf([{ id: 'email_bord_45000000001', tx: '45000000001', pdfLu: 'aucun' }, { id: 'email_bord_45000000002', tx: '45000000002', pdfLu: 'plusieurs' }], [], { pdfVus: {} });
    const c2 = A.candidatsPdf([{ id: 'email_bord_45000000001', tx: '45000000001', pdfLu: 'aucun' }], [], { pdfVus: { 45000000001: { r: 'aucun', v: TP.REGLE_PDF } } });
    dit(c.map((x) => x.tx).join() === '45000000001' && c2.length === 0, 'M6 un ancien « aucun » est relu UNE fois avec la nouvelle règle (« plusieurs » ne l’est pas)', JSON.stringify({ c, c2 }));
  });

  console.log(ko ? `\n❌ audit-transporteur-pdf : ${ko} rouge(s) sur ${ok + ko}` : `\n✅ audit-transporteur-pdf : ${ok} verts`);
  process.exit(ko ? 1 : 0);
})();
